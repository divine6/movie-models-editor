import {
  Close,
  Delete,
  Download,
  Loading,
  MoreFilled,
  Plus,
  Setting,
  VideoPause,
  VideoPlay,
  View
} from "@element-plus/icons-vue";
import { ElMessageBox } from "element-plus";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { DRACOLoader } from "three/addons/loaders/DRACOLoader.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { RGBELoader } from "three/addons/loaders/RGBELoader.js";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { OutlinePass } from "three/addons/postprocessing/OutlinePass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { ShaderPass } from "three/addons/postprocessing/ShaderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { BrightnessContrastShader } from "three/addons/shaders/BrightnessContrastShader.js";
import { HueSaturationShader } from "three/addons/shaders/HueSaturationShader.js";
import { computed, nextTick, onMounted, onUnmounted, reactive, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";

import {
  buildScenePreviewLink,
  fetchModelSet,
  fetchScene,
  rewireEditorFrontendHost,
  rewireEditorServerHost,
  resolveAssetUrl,
  saveScene as saveSceneToBackend,
  updateScene as updateSceneOnBackend,
  uploadSceneVideo
} from "@/api/modules/editor-server";
import {
  CHAPTER_END_EPS,
  CHAPTER_TIME_EPS,
  CURVE_LABELS,
  DEFAULT_SCENE_SETTINGS,
  EASING_LIST,
  PLAYBACK_RATES,
  SCENE_SETTINGS_STORAGE_KEY,
  SEEK_EVENT_TIMEOUT_MS,
  SEEK_READY_TIMEOUT_MS,
  TONE_MAPPING_MAP,
  TONE_MAPPING_OPTIONS
} from "@/composables/movie-editor/constants";
export { MOVIE_EDITOR_KEY } from "@/composables/movie-editor/keys";
import { MOVIE_EDITOR_KEY } from "@/composables/movie-editor/keys";
import { ColorCorrectionShader } from "@/composables/movie-editor/shaders/colorCorrection";
import { mapStoredAnimSegment, nextAnimSegmentId, roundAnimNum } from "@/composables/movie-editor/utils/animation";
import { createDefaultModelConfig, getModelConfig } from "@/composables/movie-editor/utils/modelConfig";
import { createTimelineHelpers } from "@/composables/movie-editor/utils/timeline";
import { exportPlayer } from "@/composables/usePlayerExport";
import { resumeProjectPersist, suspendProjectPersist } from "@/utils/projectPersist";
import { flattenChapterTree, getDescendantChapterIds, getRootChapters } from "@/utils/chapterTree";
import { isCoarsePointerDevice, withVideoPosterFragment } from "@/utils/device";
import {
  type Chapter,
  type Model,
  type ModelConfig,
  type ModelHierarchyNode,
  type Subtitle,
  SUBTITLE_DEFAULT_BACKGROUND,
  SUBTITLE_TEXT_MAX_LENGTH
} from "@/interface/project";
import { useChapterStore } from "@/stores/modules/chapter";
import { useModelStore } from "@/stores/modules/model";
import { useProjectStore } from "@/stores/modules/project";
import { useSubtitleStore } from "@/stores/modules/subtitle";
import {
  CHAPTER_DETECTION,
  CHAPTER_CAMERA_TRANSITION_SEC,
  CHAPTER_SPLIT_INTERVAL,
  DEFAULT_CAMERA,
  DEFAULT_MODEL_BASE_POSITION,
  MODEL_CAMERA_FOCUS_SEC,
  PIVOT_HELPER_RADIUS,
  SCENE_FOG_FAR,
  SCENE_FOG_MIN_VISIBILITY_AT_MAX_ORBIT,
  SCENE_FOG_NEAR,
  SCENE_GRID_DIVISIONS,
  SCENE_GRID_SIZE,
  SCENE_TONE_MAPPING_EXPOSURE,
  SCENE_VIEWPORT_BG
} from "@/utils/three/constants";
import {
  buildModelHierarchy,
  collectObjectsForNodeId,
  findHierarchyNode,
  resolveDisplayNodeId
} from "@/utils/three/modelHierarchy";
import { createViewportGrid, disposeViewportGrid } from "@/utils/three/viewportGrid";
import { createViewportEnvironment, disposeViewportEnvironment } from "@/utils/three/viewportEnvironment";
import { toastShow } from "@/utils/toast";

export { TONE_MAPPING_OPTIONS };

export function useMovieEditor() {
  const route = useRoute();
  const router = useRouter();
  const pStore = useProjectStore();
  const chStore = useChapterStore();
  const mStore = useModelStore();
  const sStore = useSubtitleStore();

  // ── State ──
  const projectTitle = ref("");
  const currentTime = ref(0);
  const duration = ref(0);
  const isPlaying = ref(false);
  const isLooping = ref(true);
  const playbackRate = ref<number>(1);
  const playingIdx = ref(-1);
  const selectedChapterId = ref<string | null>(null);
  const selModelId = ref<string | null>(null);
  const selModelNodeId = ref<string | null>(null);
  const hoverModelId = ref<string | null>(null);
  const hoverModelNodeId = ref<string | null>(null);
  const modelHierarchies = reactive<Record<string, ModelHierarchyNode[]>>({});
  const hierarchyRevision = ref(0);
  let lastSelModelId: string | null = null;
  const modelFormRevision = ref(0);
  const cameraFormRevision = ref(0);
  const chapterFormRevision = ref(0);
  // 折叠面板状态
  const chInfoOpen = ref(false);
  const camOpen = ref(false);
  const exporting = ref(false);
  const displaySubtitle = ref(false);
  const tooltipText = ref("");
  const isPreviewMode = ref(false);
  const viewOnly = ref((route.query.mode as string) === "view" && !!(route.query.code as string));
  const routeGateLoading = ref(!!(route.query.code as string));
  const rightTab = ref("model");
  const videoFps = ref(0);
  const modelSetCode = ref<string | null>(null);
  const pendingModelSetCode = ref<string | null>(null);
  const modelSetModelsLoaded = ref(false);
  const sceneCode = ref<string | null>(null);
  const shareLink = ref("");
  const savingScene = ref(false);
  const sceneListVersion = ref(0);
  const editSceneCompanyName = ref("");
  const editSceneToolName = ref("");

  // Forms
  const chForm = reactive({ name: "", startTime: 0, endTime: 0 });
  const MIN_CHAPTER_DURATION = CHAPTER_DETECTION.MIN_CHAPTER_DURATION;
  const subForm = reactive({
    text: "",
    startTime: 0,
    endTime: 5,
    color: "#ffffff",
    backgroundColor: SUBTITLE_DEFAULT_BACKGROUND,
    displayMode: "fadeIn" as "fadeIn" | "typewriter"
  });
  let editingSId: string | null = null;
  const mOff = reactive([0, 0, 0]);
  const mScl = ref(1);
  const mVis = ref(true);
  const mHL = ref(false);
  const mAni = ref(true);
  const mRot = reactive([0, 0, 0]);
  const mHLColor = ref("#00ff00");
  const mIntro = ref("");
  const mOut = ref(false);
  const mdTab = ref<"props" | "anim">("props");
  const animDuration = ref(3);
  const animLoop = ref(true);
  const animEasing = ref("easeInOut");
  const animSegments = reactive<any[]>([]);
  const editingSeg = ref<any>(null);
  const editingSegMode = ref<"start" | "end">("start");
  let _chAnimLock = false; // prevent re-entrant chapter animation from onTick
  let chAnimRafId: number | null = null;
  let chAnimChapterId: string | null = null;
  let chAnimWallclock = false;
  const chapterPlayTarget = ref<Chapter | null>(null);
  const chapterAutoNext = ref(false);
  const chapterNavLock = ref(false);
  const totalPlaying = ref(false);
  const totalProgress = ref(0);
  const animDirty = ref(false);
  const remoteUrl = ref("");
  const videoSourceTab = ref<"local" | "url">("local");
  const isDragOver = ref(false);
  const showVideoPip = ref(true);
  const modelIntroLabels = ref<Array<{ modelId: string; text: string; x: number; y: number }>>([]);
  const introPreviewVisible = ref(false);
  let introPreviewTimer: ReturnType<typeof setTimeout> | null = null;
  const playbackHintVisible = ref(false);
  const playbackHintFading = ref(false);
  let playbackHintTimer: ReturnType<typeof setTimeout> | null = null;
  let playbackHintFadeTimer: ReturnType<typeof setTimeout> | null = null;
  let introPresentationChapterId: string | null = null;
  let introPresentationPlaying = false;
  let lastIntroStateKey = "";
  const _introWorldPos = new THREE.Vector3();
  const importingModel = ref(false);
  const showSettings = ref(false);
  const spTab = ref("lighting");

  // Lighting
  const ambIntensity = ref(DEFAULT_SCENE_SETTINGS.ambIntensity);
  const dirIntensity = ref(DEFAULT_SCENE_SETTINGS.dirIntensity);
  const dirPos = reactive([...DEFAULT_SCENE_SETTINGS.dirPos]);
  const fillIntensity = ref(DEFAULT_SCENE_SETTINGS.fillIntensity);
  const fillPos = reactive([...DEFAULT_SCENE_SETTINGS.fillPos]);
  // Material (per-model)
  const matColor = ref(DEFAULT_SCENE_SETTINGS.matColor);
  const matRoughness = ref(DEFAULT_SCENE_SETTINGS.matRoughness);
  const matMetalness = ref(DEFAULT_SCENE_SETTINGS.matMetalness);
  const matNormalStr = ref(DEFAULT_SCENE_SETTINGS.matNormalStr);
  const matEmissiveInt = ref(DEFAULT_SCENE_SETTINGS.matEmissiveInt);
  const matAoInt = ref(DEFAULT_SCENE_SETTINGS.matAoInt);
  // Post-processing
  const bloomIntensity = ref(DEFAULT_SCENE_SETTINGS.bloomIntensity);
  const bloomThreshold = ref(DEFAULT_SCENE_SETTINGS.bloomThreshold);
  const bloomRadius = ref(DEFAULT_SCENE_SETTINGS.bloomRadius);
  const ppExposure = ref(DEFAULT_SCENE_SETTINGS.ppExposure);
  const ppContrast = ref(DEFAULT_SCENE_SETTINGS.ppContrast);
  const ppSaturation = ref(DEFAULT_SCENE_SETTINGS.ppSaturation);
  const toneMapping = ref(DEFAULT_SCENE_SETTINGS.toneMapping);
  // Environment
  const envIntensityVal = ref(DEFAULT_SCENE_SETTINGS.envIntensityVal);
  const envMapUrl = ref<string | null>(DEFAULT_SCENE_SETTINGS.envMapUrl);
  const envMapIsHdr = ref(DEFAULT_SCENE_SETTINGS.envMapIsHdr);
  const bgColorVal = ref(DEFAULT_SCENE_SETTINGS.bgColorVal);
  const fogEnabled = ref(DEFAULT_SCENE_SETTINGS.fogEnabled);
  const fogNear = ref(DEFAULT_SCENE_SETTINGS.fogNear);
  const fogFar = ref(DEFAULT_SCENE_SETTINGS.fogFar);
  let saveSettingsTimer: ReturnType<typeof setTimeout> | null = null;
  const envMapPreview = ref("");
  const shadowEnabled = ref(DEFAULT_SCENE_SETTINGS.shadowEnabled);
  const shadowIntensity = ref(DEFAULT_SCENE_SETTINGS.shadowIntensity);
  const shadowMapSize = ref(DEFAULT_SCENE_SETTINGS.shadowMapSize);
  const shadowBias = ref(DEFAULT_SCENE_SETTINGS.shadowBias);
  const shadowNormalBias = ref(DEFAULT_SCENE_SETTINGS.shadowNormalBias);
  const shadowType = ref(DEFAULT_SCENE_SETTINGS.shadowType);
  // Grid
  const gridVisible = ref(DEFAULT_SCENE_SETTINGS.gridVisible);
  const gridSize = ref(DEFAULT_SCENE_SETTINGS.gridSize);
  const gridDivisions = ref(DEFAULT_SCENE_SETTINGS.gridDivisions);
  const gridHeight = ref(DEFAULT_SCENE_SETTINGS.gridHeight);
  // Picking behavior
  const pickOnlyVisible = ref(true); // when true, raycast ignores invisible objects
  const camP = reactive([...DEFAULT_CAMERA.position]);
  const camT = reactive([...DEFAULT_CAMERA.target]);
  const camFov = ref(DEFAULT_CAMERA.fov);
  const camTransitionSec = ref(DEFAULT_CAMERA.transitionSec);

  // Refs
  const rootEl = ref<HTMLDivElement>();
  const viewportEl = ref<HTMLDivElement>();
  const canvasEl = ref<HTMLCanvasElement>();
  const videoEl = ref<HTMLVideoElement>();
  const subEl = ref<HTMLDivElement>();
  const trackEl = ref<HTMLDivElement>();
  const tooltipEl = ref<HTMLDivElement>();
  const fileInputEl = ref<HTMLInputElement>();
  const multiFileInput = ref<HTMLInputElement>();
  const folderInput = ref<HTMLInputElement>();

  // Computed
  const currProj = computed(() => pStore.currentProject);
  const hasVideo = computed(() => !!currProj.value?.videoSrc);
  watch(hasVideo, function (v) {
    if (v) syncVideoElementSrc();
    if (v) void tryLoadPendingModelSet();
  });
  const videoSrc = computed(() => currProj.value?.videoSrc || "");
  const videoWidth = computed(() => currProj.value?.videoWidth || 0);
  const videoHeight = computed(() => currProj.value?.videoHeight || 0);
  const chapters = computed(() => currProj.value?.chapters || []);
  const sortedChapters = computed(() => [...chapters.value].sort((a, b) => a.startTime - b.startTime));
  const timelineChapters = computed(() => getRootChapters(chapters.value));
  const chapterTreeList = computed(() => flattenChapterTree(chapters.value));
  const hasChapters = computed(() => chapters.value.length > 0);
  const currentChapterIdx = computed(() => findChIdx(currentTime.value));
  const playbackRateLabel = computed(() => {
    const rate = playbackRate.value;
    return Number.isInteger(rate) ? `${rate}x` : `${rate}x`;
  });
  const canAddChapter = computed(() => {
    if (!hasVideo.value) return false;
    const dur = currProj.value?.videoDuration || duration.value;
    if (dur <= 0) return false;
    if (chapters.value.length === 0) return true;
    return !!getNextChapterRange(undefined);
  });
  const models = computed(() => currProj.value?.models || []);
  const subtitles = computed(() => currProj.value?.subtitles || []);
  const selectedChapter = computed(() => chapters.value.find(c => c.id === selectedChapterId.value));
  const selectedChapterTimeBounds = computed(() => {
    const ch = selectedChapter.value;
    return ch ? getChapterTimeInputBounds(ch) : { startMin: 0, startMax: 0, endMin: 0, endMax: duration.value || 0 };
  });
  const selModel = computed(() => models.value.find(m => m.id === selModelId.value));
  const selModelNode = computed(() => {
    hierarchyRevision.value;
    if (!selModelId.value || !selModelNodeId.value) return null;
    const tree = modelHierarchies[selModelId.value];
    if (!tree) return null;
    return findHierarchyNode(tree, selModelNodeId.value);
  });
  // 模型列表显示全局 models（参考 MovieModelEditor 策略）
  const chapterModels = computed(() => models.value);
  const modelDisplayName = computed(() => {
    const m = selModel.value;
    if (!m) return "";
    const base = (m.name || "").replace(/\..*$/, "");
    const node = selModelNode.value;
    return node ? `${base} / ${node.name}` : base;
  });
  const sortedSubtitles = computed(() => [...subtitles.value].sort((a, b) => a.startTime - b.startTime));
  const chapterSubtitles = computed(() => {
    const ch = selectedChapter.value;
    if (!ch) return [];
    return sortedSubtitles.value.filter(s => s.startTime >= ch.startTime - 0.1 && s.endTime <= ch.endTime + 0.1);
  });

  // ── Three.js ──
  let scene: THREE.Scene;
  let camera: THREE.PerspectiveCamera;
  let renderer: THREE.WebGLRenderer;
  let controls: OrbitControls;
  let gltfLoader: GLTFLoader;
  let dracoLoader: DRACOLoader;
  let meshes = new Map<string, THREE.Mesh | THREE.Group>();
  let mixers: THREE.AnimationMixer[] = [];
  let afid = 0;
  let groundMesh: THREE.Mesh;
  let gridHelper: THREE.Object3D;
  let ambientLight: THREE.AmbientLight;
  let dirLight: THREE.DirectionalLight;
  let fillLight: THREE.DirectionalLight;
  let composer: EffectComposer;
  let bloomPass: UnrealBloomPass;
  let colorPass: ShaderPass;
  let hueSatPass: ShaderPass;
  let brightContrastPass: ShaderPass;
  let envMap: THREE.Texture | null = null;
  let envMapSourceUrl: string | null = null;
  const textureLoader = new THREE.TextureLoader();
  const rgbeLoader = new RGBELoader();
  let outlinePass: OutlinePass;
  let hoverOutlinePass: OutlinePass;
  const raycaster = new THREE.Raycaster();
  const pickPointer = new THREE.Vector2();
  const SELECTION_COLOR = 0x409eff;
  const HOVER_EDGE_COLOR = 0x66b3ff;
  const HIDDEN_EDGE_COLOR = 0x1a3a5f;
  const _pickNormal = new THREE.Vector3();
  const _pickView = new THREE.Vector3();
  const _focusCenter = new THREE.Vector3();
  const _focusSize = new THREE.Vector3();
  const _focusOffset = new THREE.Vector3();
  const _orbitPivotCenter = new THREE.Vector3();
  const _defaultCamViewDir = new THREE.Vector3(
    DEFAULT_CAMERA.position[0] - DEFAULT_CAMERA.target[0],
    DEFAULT_CAMERA.position[1] - DEFAULT_CAMERA.target[1],
    DEFAULT_CAMERA.position[2] - DEFAULT_CAMERA.target[2]
  ).normalize();
  let viewCameraBaseFov: number | null = null;
  let viewportPickState: { x: number; y: number; time: number } | null = null;
  let onCanvasPointerDown: ((e: PointerEvent) => void) | null = null;
  let onCanvasPointerUp: ((e: PointerEvent) => void) | null = null;
  let onCanvasPointerMove: ((e: PointerEvent) => void) | null = null;
  let onCanvasPointerLeave: (() => void) | null = null;
  let lastViewportPointer: { x: number; y: number } | null = null;
  let pendingHoverPointer: { x: number; y: number } | null = null;
  let hoverPickRaf = 0;
  let viewportInteracting = false;
  let pickableMeshCache: THREE.Mesh[] = [];
  let pickableMeshCacheKey = "";
  let orbitDragVisualsSuspended = false;
  let cameraAnimating = false;
  let lastHoverPickAt = { x: 0, y: 0 };
  const HOVER_PICK_MOVE_PX = 4;
  const ORBIT_DRAG_SUSPEND_PX = 8;
  let onControlsInteractionEnd: (() => void) | null = null;
  let onControlsInteractionStart: (() => void) | null = null;
  let onCanvasContextMenu: ((e: Event) => void) | null = null;

  function init3D() {
    if (!viewportEl.value || !canvasEl.value) return;
    const w = viewportEl.value.clientWidth;
    const h = viewportEl.value.clientHeight;

    const bgColor = new THREE.Color(SCENE_VIEWPORT_BG);
    scene = new THREE.Scene();
    scene.background = bgColor;
    scene.fog = new THREE.Fog(bgColor.getHex(), SCENE_FOG_NEAR, SCENE_FOG_FAR);

    camera = new THREE.PerspectiveCamera(50, w / Math.max(h, 1), 0.1, 200);
    camera.position.set(...DEFAULT_CAMERA.position);

    renderer = new THREE.WebGLRenderer({ canvas: canvasEl.value, antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(w, h);
    renderer.shadowMap.enabled = false;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = SCENE_TONE_MAPPING_EXPOSURE;
    renderer.setClearColor(bgColor, 1);

    controls = new OrbitControls(camera, canvasEl.value);
    controls.target.set(...DEFAULT_CAMERA.target);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.enablePan = false;
    controls.minDistance = 2;
    controls.maxDistance = 30;
    controls.maxPolarAngle = Math.PI / 2;
    bindControlsInteraction();
    syncOrbitControlsDom();

    // 光照（初始值与 DEFAULT_SCENE_SETTINGS 一致，loadAllSettings 后会再同步）
    ambientLight = new THREE.AmbientLight(0xffffff, DEFAULT_SCENE_SETTINGS.ambIntensity);
    scene.add(ambientLight);

    dirLight = new THREE.DirectionalLight(0xffffff, DEFAULT_SCENE_SETTINGS.dirIntensity);
    dirLight.position.set(...DEFAULT_SCENE_SETTINGS.dirPos);
    dirLight.target.position.set(0, 0, 0);
    scene.add(dirLight);
    scene.add(dirLight.target);

    fillLight = new THREE.DirectionalLight(0x88bbff, DEFAULT_SCENE_SETTINGS.fillIntensity);
    fillLight.position.set(...DEFAULT_SCENE_SETTINGS.fillPos);
    fillLight.target.position.set(0, 0, 0);
    scene.add(fillLight);
    scene.add(fillLight.target);
    // mainLight.castShadow = true;
    // mainLight.shadow.mapSize.width = 2048;
    // mainLight.shadow.mapSize.height = 2048;
    // mainLight.shadow.camera.near = 0.5;
    //mainLight.shadow.camera.far = 60;
    //mainLight.shadow.camera.left = -15;
    //mainLight.shadow.camera.right = 15;
    //mainLight.shadow.camera.top = 15;
    //mainLight.shadow.camera.bottom = -15;

    // 地面 - 已移除；网格在 loadAllSettings 后由 applyGrid 创建
    try {
      loadAllSettings();
      applySettings();
      applyGrid();
      applyFog();
      if (shadowEnabled.value) applyShadow();
      // composer 常驻：渲染路径永不切换，避免选中/悬停时画面闪烁
      initComposer();
      if (bloomIntensity.value > 0 || ppContrast.value !== 0 || ppSaturation.value !== 0) {
        toggleBloom();
        toggleColor();
      }
      saveAllSettings();
    } catch (e) {
      console.warn("Settings restore error", e);
    }
    gltfLoader = new GLTFLoader();
    dracoLoader = new DRACOLoader();
    dracoLoader.setDecoderPath("/draco/");
    // dracoLoader.setDecoderConfig({ type: "js" }); // 可选：强制使用 JS 解码器（调试用）
    gltfLoader.setDRACOLoader(dracoLoader);
    gltfLoader.setMeshoptDecoder(MeshoptDecoder);
    try {
      envMap = createViewportEnvironment(renderer);
      scene.environment = envMap;
      scene.environmentIntensity = envIntensityVal.value;
      if (envMapUrl.value) {
        loadEnvironmentMapFromUrl(envMapUrl.value, envMapIsHdr.value);
      }
    } catch (e) {
      console.warn("Viewport environment init failed", e);
    }
    bindViewportPicking();
    animate();
  }

  function bindViewportPicking() {
    const canvas = canvasEl.value;
    const viewport = viewportEl.value;
    if (!canvas || !viewport) return;

    viewport.style.touchAction = "none";
    canvas.style.touchAction = "none";

    const isPresentationInteraction = () => viewOnly.value || isPreviewMode.value;

    onCanvasPointerDown = (e: PointerEvent) => {
      if (e.button !== 0 || e.isPrimary === false) return;
      if (isPresentationInteraction()) {
        viewportPickState = { x: e.clientX, y: e.clientY, time: performance.now() };
        return;
      }
      orbitDragVisualsSuspended = false;
      viewportPickState = { x: e.clientX, y: e.clientY, time: performance.now() };
    };

    onCanvasPointerUp = (e: PointerEvent) => {
      if (e.button !== 0 || e.isPrimary === false || !viewportPickState) return;
      const dx = e.clientX - viewportPickState.x;
      const dy = e.clientY - viewportPickState.y;
      const elapsed = performance.now() - viewportPickState.time;
      const wasDrag = Math.hypot(dx, dy) > 10 || elapsed > 600;
      viewportPickState = null;

      if (isPresentationInteraction()) {
        if (!wasDrag && isPreviewMode.value) {
          tryTogglePlayOnPreviewTap(e.clientX, e.clientY);
        }
        return;
      }

      if (!wasDrag) {
        pickModelAtViewport(e.clientX, e.clientY);
      }
    };

    onCanvasPointerMove = (e: PointerEvent) => {
      if (e.isPrimary === false) return;
      if (isPresentationInteraction()) {
        if (viewportPickState) {
          const dx = e.clientX - viewportPickState.x;
          const dy = e.clientY - viewportPickState.y;
          if (Math.hypot(dx, dy) >= ORBIT_DRAG_SUSPEND_PX) {
            viewportPickState = null;
          }
        }
        return;
      }
      lastViewportPointer = { x: e.clientX, y: e.clientY };
      if (viewportPickState && !orbitDragVisualsSuspended) {
        const dx = e.clientX - viewportPickState.x;
        const dy = e.clientY - viewportPickState.y;
        if (Math.hypot(dx, dy) >= ORBIT_DRAG_SUSPEND_PX) {
          beginOrbitVisualSuspend();
        }
      }
      if (!orbitDragVisualsSuspended) {
        scheduleHoverPick(e.clientX, e.clientY);
      }
    };

    onCanvasContextMenu = (e: Event) => {
      e.preventDefault();
    };

    onCanvasPointerLeave = () => {
      lastViewportPointer = null;
      if (!isPresentationInteraction()) clearHoverTarget();
    };

    canvas.addEventListener("pointerdown", onCanvasPointerDown);
    canvas.addEventListener("pointerup", onCanvasPointerUp);
    canvas.addEventListener("pointermove", onCanvasPointerMove);
    canvas.addEventListener("contextmenu", onCanvasContextMenu);
    if (onCanvasPointerLeave) canvas.addEventListener("pointerleave", onCanvasPointerLeave);
  }

  function unbindViewportPicking() {
    const canvas = canvasEl.value;
    if (!canvas) return;
    if (onCanvasPointerDown) canvas.removeEventListener("pointerdown", onCanvasPointerDown);
    if (onCanvasPointerUp) canvas.removeEventListener("pointerup", onCanvasPointerUp);
    if (onCanvasPointerMove) canvas.removeEventListener("pointermove", onCanvasPointerMove);
    if (onCanvasContextMenu) canvas.removeEventListener("contextmenu", onCanvasContextMenu);
    if (onCanvasPointerLeave) canvas.removeEventListener("pointerleave", onCanvasPointerLeave);
    onCanvasPointerDown = null;
    onCanvasPointerUp = null;
    onCanvasPointerMove = null;
    onCanvasContextMenu = null;
    onCanvasPointerLeave = null;
    viewportPickState = null;
    lastViewportPointer = null;
    pendingHoverPointer = null;
    viewportInteracting = false;
    orbitDragVisualsSuspended = false;
    cameraAnimating = false;
    if (hoverPickRaf) {
      cancelAnimationFrame(hoverPickRaf);
      hoverPickRaf = 0;
    }
    invalidatePickMeshCache();
    clearHoverTarget();
  }

  function invalidatePickMeshCache() {
    pickableMeshCacheKey = "";
    pickableMeshCache = [];
  }

  function beginOrbitVisualSuspend() {
    if (viewOnly.value || isPreviewMode.value) return;
    if (orbitDragVisualsSuspended) return;
    orbitDragVisualsSuspended = true;
    viewportInteracting = true;
    pendingHoverPointer = null;
    if (hoverPickRaf) {
      cancelAnimationFrame(hoverPickRaf);
      hoverPickRaf = 0;
    }
    clearHoverTarget();
  }

  function endOrbitVisualSuspend() {
    viewportInteracting = false;
    orbitDragVisualsSuspended = false;
  }

  function getSceneModelCenter(out = _orbitPivotCenter): THREE.Vector3 | null {
    const box = new THREE.Box3();
    meshes.forEach(group => box.expandByObject(group));
    if (box.isEmpty()) return null;
    box.getCenter(out);
    return out;
  }

  function alignLoadedModelToGround(m: Model, root: THREE.Object3D): [number, number, number] {
    const bpX = m.basePosition?.[0] ?? DEFAULT_MODEL_BASE_POSITION[0];
    const bpZ = m.basePosition?.[2] ?? DEFAULT_MODEL_BASE_POSITION[2];

    root.position.set(bpX, 0, bpZ);
    root.updateMatrixWorld(true);

    const box = new THREE.Box3().setFromObject(root);
    if (box.isEmpty()) {
      const basePos: [number, number, number] = [bpX, 0, bpZ];
      m.basePosition = basePos;
      mStore.setModelGroundY(m, 0);
      return basePos;
    }

    const groundY = gridHeight.value - box.min.y;
    mStore.setModelGroundY(m, groundY);
    const basePos: [number, number, number] = [bpX, groundY, bpZ];
    root.position.set(basePos[0], basePos[1], basePos[2]);
    m.basePosition = basePos;
    return basePos;
  }

  function isDefaultChapterCamera(ch: Chapter) {
    const p = ch.camera.position;
    const t = ch.camera.target;
    const dp = DEFAULT_CAMERA.position;
    const dt = DEFAULT_CAMERA.target;
    const eps = 0.001;
    const positionMatches = Math.abs(p[0] - dp[0]) < eps && Math.abs(p[1] - dp[1]) < eps && Math.abs(p[2] - dp[2]) < eps;
    const targetMatchesDefault = Math.abs(t[0] - dt[0]) < eps && Math.abs(t[1] - dt[1]) < eps && Math.abs(t[2] - dt[2]) < eps;
    const targetMatchesLegacy = Math.abs(t[0]) < eps && Math.abs(t[1] - 0.5) < eps && Math.abs(t[2]) < eps;
    return positionMatches && (targetMatchesDefault || targetMatchesLegacy) && ch.camera.fov === DEFAULT_CAMERA.fov;
  }

  function frameCameraOnSceneModels(dur = CHAPTER_CAMERA_TRANSITION_SEC, chapter?: Chapter | null) {
    if (!controls || meshes.size === 0) return false;

    const box = new THREE.Box3();
    meshes.forEach(group => box.expandByObject(group));
    if (box.isEmpty()) return false;

    box.getCenter(_focusCenter);
    box.getSize(_focusSize);
    const maxDim = Math.max(_focusSize.x, _focusSize.y, _focusSize.z, 0.4);
    const distance = getPresentationCameraDistance(maxDim);

    _focusOffset.copy(_defaultCamViewDir).multiplyScalar(distance);

    const newPos: [number, number, number] = [
      _focusCenter.x + _focusOffset.x,
      Math.max(_focusCenter.y + _focusOffset.y, _focusCenter.y + maxDim * 0.25),
      _focusCenter.z + _focusOffset.z
    ];
    const target: [number, number, number] = [_focusCenter.x, _focusCenter.y, _focusCenter.z];
    const fov = camera.fov;

    animCam(newPos, target, fov, dur);
    if (chapter) {
      chStore.setChapterCamera(chapter, newPos, target, fov);
    }
    return true;
  }

  function setPageTitle(title: string) {
    const name = title.trim();
    if (name) document.title = name;
  }

  function getPresentationCameraDistance(maxDim: number) {
    const w = viewportEl.value?.clientWidth ?? 800;
    let mul = 2.2;
    if (viewOnly.value || isPreviewMode.value) {
      if (w <= 480) mul = 3.0;
      else if (w <= 768) mul = 2.6;
      else mul = 2.4;
    }
    const minDist = w <= 480 ? 3.2 : 2.5;
    let desired = Math.max(maxDim * mul, minDist);
    if (controls?.maxDistance) {
      desired = Math.min(desired, controls.maxDistance * 0.88);
    }
    return desired;
  }

  function scheduleSaveSettings() {
    if (saveSettingsTimer) clearTimeout(saveSettingsTimer);
    saveSettingsTimer = setTimeout(() => {
      saveSettingsTimer = null;
      saveAllSettings();
    }, 280);
  }

  function syncSceneOrbitLimits() {
    if (!scene || !controls) return;

    const box = new THREE.Box3();
    meshes.forEach(group => box.expandByObject(group));
    let extent = 3;
    if (!box.isEmpty()) {
      box.getSize(_focusSize);
      extent = Math.max(_focusSize.x, _focusSize.y, _focusSize.z, 1);
    }

    const minOrbit = Math.max(extent * 0.55, 1.5);
    let maxOrbit = Math.max(extent * 4.2, 14);
    if (viewOnly.value || isPreviewMode.value) {
      maxOrbit = Math.min(maxOrbit, Math.max(extent * 3.6, 12));
    }

    controls.minDistance = minOrbit;
    controls.maxDistance = maxOrbit;

    if (camera) {
      const target = controls.target;
      const dist = camera.position.distanceTo(target);
      if (dist > maxOrbit) {
        const dir = camera.position.clone().sub(target);
        if (dir.lengthSq() < 1e-6) dir.copy(_defaultCamViewDir);
        dir.normalize().multiplyScalar(maxOrbit);
        camera.position.copy(target).add(dir);
        camera.updateProjectionMatrix();
      }
    }
  }

  /** @deprecated use syncSceneOrbitLimits */
  function syncSceneFogAndOrbitLimits() {
    syncSceneOrbitLimits();
  }

  function adaptPresentationViewport() {
    if (!camera || !controls) return;
    if (!viewOnly.value && !isPreviewMode.value) return;
    const w = viewportEl.value?.clientWidth ?? 0;
    if (w <= 0) return;
    if (viewCameraBaseFov === null) viewCameraBaseFov = camera.fov;
    const base = viewCameraBaseFov;
    let fov = base;
    if (w <= 480) fov = Math.min(72, base + 18);
    else if (w <= 768) fov = Math.min(64, base + 10);
    if (Math.abs(camera.fov - fov) > 0.5) {
      camera.fov = fov;
      camera.updateProjectionMatrix();
    }

    const center = getSceneModelCenter();
    if (!center || meshes.size === 0) {
      controls.update();
      return;
    }

    const box = new THREE.Box3();
    meshes.forEach(group => box.expandByObject(group));
    box.getSize(_focusSize);
    const maxDim = Math.max(_focusSize.x, _focusSize.y, _focusSize.z, 0.4);
    const minDist = getPresentationCameraDistance(maxDim);
    const currentDist = camera.position.distanceTo(controls.target);
    if (currentDist < minDist * 0.92) {
      const dir = camera.position.clone().sub(controls.target);
      if (dir.lengthSq() < 1e-6) dir.copy(_defaultCamViewDir);
      dir.normalize().multiplyScalar(minDist);
      const newPos: [number, number, number] = [center.x + dir.x, center.y + dir.y, center.z + dir.z];
      snapCam(newPos, [center.x, center.y, center.z], camera.fov);
    }
    syncSceneOrbitLimits();
    applyFog();
    controls.update();
  }

  function bindControlsInteraction() {
    if (!controls) return;
    onControlsInteractionStart = () => {
      viewportPickState = null;
    };
    onControlsInteractionEnd = () => {
      endOrbitVisualSuspend();
    };
    controls.addEventListener("start", onControlsInteractionStart);
    controls.addEventListener("end", onControlsInteractionEnd);
  }

  function syncOrbitControlsDom() {
    const canvas = canvasEl.value;
    if (!controls || !canvas) return;
    if (controls.domElement !== canvas) {
      controls.disconnect();
      controls.connect(canvas);
    }
    canvas.style.touchAction = "none";
    viewportEl.value && (viewportEl.value.style.touchAction = "none");
  }

  function unbindControlsInteraction() {
    if (!controls) return;
    if (onControlsInteractionStart) controls.removeEventListener("start", onControlsInteractionStart);
    if (onControlsInteractionEnd) controls.removeEventListener("end", onControlsInteractionEnd);
    onControlsInteractionStart = null;
    onControlsInteractionEnd = null;
  }

  function scheduleHoverPick(clientX: number, clientY: number) {
    if (viewportInteracting || cameraAnimating || camTrans || isPreviewMode.value) return;
    const moved = Math.hypot(clientX - lastHoverPickAt.x, clientY - lastHoverPickAt.y);
    if (moved < HOVER_PICK_MOVE_PX && hoverModelId.value) return;

    pendingHoverPointer = { x: clientX, y: clientY };
    if (hoverPickRaf) return;
    hoverPickRaf = requestAnimationFrame(() => {
      hoverPickRaf = 0;
      if (!pendingHoverPointer || viewportInteracting || cameraAnimating || camTrans || isPreviewMode.value) return;
      const { x, y } = pendingHoverPointer;
      pendingHoverPointer = null;
      lastHoverPickAt = { x, y };
      updateHoverHighlight(x, y);
    });
  }

  let SETTINGS_KEY = SCENE_SETTINGS_STORAGE_KEY;
  function saveAllSettings() {
    try {
      let data = {
        ambIntensity: ambIntensity.value,
        dirIntensity: dirIntensity.value,
        dirPos: [dirPos[0], dirPos[1], dirPos[2]],
        fillIntensity: fillIntensity.value,
        fillPos: [fillPos[0], fillPos[1], fillPos[2]],
        matColor: matColor.value,
        matRoughness: matRoughness.value,
        matMetalness: matMetalness.value,
        matNormalStr: matNormalStr.value,
        matEmissiveInt: matEmissiveInt.value,
        matAoInt: matAoInt.value,
        bloomIntensity: bloomIntensity.value,
        bloomThreshold: bloomThreshold.value,
        bloomRadius: bloomRadius.value,
        ppExposure: ppExposure.value,
        ppContrast: ppContrast.value,
        ppSaturation: ppSaturation.value,
        toneMapping: toneMapping.value,
        envIntensityVal: envIntensityVal.value,
        envMapUrl: envMapUrl.value,
        envMapIsHdr: envMapIsHdr.value,
        bgColorVal: bgColorVal.value,
        fogEnabled: fogEnabled.value,
        fogNear: fogNear.value,
        fogFar: fogFar.value,
        shadowEnabled: shadowEnabled.value,
        shadowIntensity: shadowIntensity.value,
        shadowMapSize: shadowMapSize.value,
        shadowBias: shadowBias.value,
        shadowNormalBias: shadowNormalBias.value,
        shadowType: shadowType.value,
        gridVisible: gridVisible.value,
        gridSize: gridSize.value,
        gridDivisions: gridDivisions.value,
        gridHeight: gridHeight.value
      };
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(data));
    } catch (e) {}
  }
  function loadAllSettings() {
    try {
      let raw = localStorage.getItem(SETTINGS_KEY);
      if (!raw) return;
      let d = JSON.parse(raw);
      if (d.ambIntensity !== undefined) ambIntensity.value = d.ambIntensity;
      if (d.dirIntensity !== undefined) dirIntensity.value = d.dirIntensity;
      if (d.dirPos) {
        dirPos[0] = d.dirPos[0];
        dirPos[1] = d.dirPos[1];
        dirPos[2] = d.dirPos[2];
      }
      if (d.fillIntensity !== undefined) fillIntensity.value = d.fillIntensity;
      if (d.fillPos) {
        fillPos[0] = d.fillPos[0];
        fillPos[1] = d.fillPos[1];
        fillPos[2] = d.fillPos[2];
      }
      if (d.matColor) matColor.value = d.matColor;
      if (d.matRoughness !== undefined) matRoughness.value = d.matRoughness;
      if (d.matMetalness !== undefined) matMetalness.value = d.matMetalness;
      if (d.matNormalStr !== undefined) matNormalStr.value = d.matNormalStr;
      if (d.matEmissiveInt !== undefined) matEmissiveInt.value = d.matEmissiveInt;
      if (d.matAoInt !== undefined) matAoInt.value = d.matAoInt;
      if (d.bloomIntensity !== undefined) bloomIntensity.value = d.bloomIntensity;
      if (d.bloomThreshold !== undefined) bloomThreshold.value = d.bloomThreshold;
      if (d.bloomRadius !== undefined) bloomRadius.value = d.bloomRadius;
      if (d.ppExposure !== undefined) ppExposure.value = d.ppExposure;
      if (d.ppContrast !== undefined) ppContrast.value = d.ppContrast;
      if (d.ppSaturation !== undefined) ppSaturation.value = d.ppSaturation;
      if (d.toneMapping) toneMapping.value = d.toneMapping;
      if (d.envIntensityVal !== undefined) envIntensityVal.value = d.envIntensityVal;
      if (d.envMapUrl !== undefined) envMapUrl.value = d.envMapUrl;
      if (d.envMapIsHdr !== undefined) envMapIsHdr.value = d.envMapIsHdr;
      if (d.fogEnabled !== undefined) fogEnabled.value = d.fogEnabled;
      if (d.fogNear !== undefined) fogNear.value = d.fogNear;
      if (d.fogFar !== undefined) fogFar.value = d.fogFar;
      if (d.bgColorVal) {
        const normalized = String(d.bgColorVal).toLowerCase();
        bgColorVal.value = normalized === "#f2f3f5" || normalized === "#0a0c10" ? SCENE_VIEWPORT_BG : d.bgColorVal;
      }
      if (d.shadowEnabled !== undefined) shadowEnabled.value = d.shadowEnabled;
      if (d.shadowIntensity !== undefined) shadowIntensity.value = d.shadowIntensity;
      if (d.shadowMapSize !== undefined) shadowMapSize.value = d.shadowMapSize;
      if (d.shadowBias !== undefined) shadowBias.value = d.shadowBias;
      if (d.shadowNormalBias !== undefined) shadowNormalBias.value = d.shadowNormalBias;
      if (d.shadowType) shadowType.value = d.shadowType;
      if (d.gridVisible !== undefined) gridVisible.value = d.gridVisible;
      if (d.gridSize !== undefined) {
        gridSize.value = d.gridSize > 30 ? SCENE_GRID_SIZE : d.gridSize;
      }
      if (d.gridDivisions !== undefined) {
        gridDivisions.value = d.gridDivisions > 60 ? SCENE_GRID_DIVISIONS : d.gridDivisions;
      }
      if (d.gridHeight !== undefined) gridHeight.value = d.gridHeight;
    } catch (e) {}
  }

  function resetSceneSettings() {
    const d = DEFAULT_SCENE_SETTINGS;
    ambIntensity.value = d.ambIntensity;
    dirIntensity.value = d.dirIntensity;
    dirPos[0] = d.dirPos[0];
    dirPos[1] = d.dirPos[1];
    dirPos[2] = d.dirPos[2];
    fillIntensity.value = d.fillIntensity;
    fillPos[0] = d.fillPos[0];
    fillPos[1] = d.fillPos[1];
    fillPos[2] = d.fillPos[2];
    matColor.value = d.matColor;
    matRoughness.value = d.matRoughness;
    matMetalness.value = d.matMetalness;
    matNormalStr.value = d.matNormalStr;
    matEmissiveInt.value = d.matEmissiveInt;
    matAoInt.value = d.matAoInt;
    bloomIntensity.value = d.bloomIntensity;
    bloomThreshold.value = d.bloomThreshold;
    bloomRadius.value = d.bloomRadius;
    ppExposure.value = d.ppExposure;
    ppContrast.value = d.ppContrast;
    ppSaturation.value = d.ppSaturation;
    toneMapping.value = d.toneMapping;
    envIntensityVal.value = d.envIntensityVal;
    envMapUrl.value = d.envMapUrl;
    envMapIsHdr.value = d.envMapIsHdr;
    fogEnabled.value = d.fogEnabled;
    fogNear.value = d.fogNear;
    fogFar.value = d.fogFar;
    bgColorVal.value = d.bgColorVal;
    shadowEnabled.value = d.shadowEnabled;
    shadowIntensity.value = d.shadowIntensity;
    shadowMapSize.value = d.shadowMapSize;
    shadowBias.value = d.shadowBias;
    shadowNormalBias.value = d.shadowNormalBias;
    shadowType.value = d.shadowType;
    gridVisible.value = d.gridVisible;
    gridSize.value = d.gridSize;
    gridDivisions.value = d.gridDivisions;
    gridHeight.value = d.gridHeight;

    applySettings();
    toggleBloom();
    toggleColor();
    applyShadow();
    applyGrid();
    void resetEnvironmentMap();
    applyFog();
    if (selModel.value) syncMaterialUiFromModel();
    toastShow("场景参数已重置");
  }

  function loadEnvironmentMapFromUrl(url: string, isHdr: boolean) {
    if (!renderer || !scene) return;
    envMapPreview.value = isHdr ? "" : url;
    envMapSourceUrl = url;
    const onLoaded = (texture: THREE.Texture) => {
      disposeViewportEnvironment(envMap);
      envMap = buildEnvMapFromTexture(texture);
      scene.environment = envMap;
      scene.environmentIntensity = envIntensityVal.value;
    };
    const onError = () => {
      console.warn("Environment map load failed", url);
    };
    if (isHdr) {
      rgbeLoader.load(url, onLoaded, undefined, onError);
    } else {
      textureLoader.load(url, onLoaded, undefined, onError);
    }
  }

  function applyToneMapping() {
    if (!renderer) return;
    renderer.toneMapping = TONE_MAPPING_MAP[toneMapping.value] ?? THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = ppExposure.value;
    scheduleSaveSettings();
  }

  function applyFog() {
    if (!scene) return;
    const bg = new THREE.Color(bgColorVal.value);
    scene.background = bg;
    renderer?.setClearColor(bg, 1);

    if (!fogEnabled.value) {
      scene.fog = null;
      scheduleSaveSettings();
      return;
    }

    if (!(scene.fog instanceof THREE.Fog)) {
      scene.fog = new THREE.Fog(bg.getHex(), fogNear.value, fogFar.value);
    } else {
      scene.fog.color.copy(bg);
      scene.fog.near = fogNear.value;
      scene.fog.far = Math.max(fogFar.value, fogNear.value + 0.5);
    }

    meshes.forEach(group => {
      group.traverse(child => {
        const mesh = child as THREE.Mesh;
        if (!mesh.isMesh || !mesh.material) return;
        const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        mats.forEach(mat => {
          (mat as THREE.Material).fog = true;
        });
      });
    });

    if (gridHelper) {
      gridHelper.traverse(child => {
        const line = child as THREE.LineSegments;
        if (line.material) {
          const mats = Array.isArray(line.material) ? line.material : [line.material];
          mats.forEach(mat => {
            (mat as THREE.Material).fog = true;
          });
        }
      });
    }

    scheduleSaveSettings();
  }

  async function resetEnvironmentMap() {
    envMapUrl.value = null;
    envMapIsHdr.value = false;
    envMapPreview.value = "";
    if (envMapSourceUrl?.startsWith("blob:")) URL.revokeObjectURL(envMapSourceUrl);
    envMapSourceUrl = null;
    if (!renderer) return;
    disposeViewportEnvironment(envMap);
    envMap = createViewportEnvironment(renderer);
    scene.environment = envMap;
    scene.environmentIntensity = envIntensityVal.value;
    saveAllSettings();
  }

  function buildEnvMapFromTexture(texture: THREE.Texture): THREE.Texture {
    if (!renderer) return texture;
    texture.mapping = THREE.EquirectangularReflectionMapping;
    const isHdr = texture.type === THREE.HalfFloatType || texture.type === THREE.FloatType;
    if (!isHdr) {
      texture.colorSpace = THREE.SRGBColorSpace;
    }
    const pmrem = new THREE.PMREMGenerator(renderer);
    pmrem.compileEquirectangularShader();
    const env = pmrem.fromEquirectangular(texture).texture;
    pmrem.dispose();
    texture.dispose();
    return env;
  }

  async function applyEnvironmentMapFile(file: File) {
    if (!renderer || !scene) return;
    const isHdr = /\.hdr$/i.test(file.name);
    const url = URL.createObjectURL(file);
    if (envMapSourceUrl?.startsWith("blob:")) URL.revokeObjectURL(envMapSourceUrl);
    envMapSourceUrl = url;
    envMapUrl.value = url;
    envMapIsHdr.value = isHdr;
    envMapPreview.value = isHdr ? "" : url;
    const onLoaded = (texture: THREE.Texture) => {
      disposeViewportEnvironment(envMap);
      envMap = buildEnvMapFromTexture(texture);
      scene.environment = envMap;
      scene.environmentIntensity = envIntensityVal.value;
      scheduleSaveSettings();
    };
    const onError = () => {
      toastShow("环境贴图加载失败", "error");
    };

    return new Promise<void>((resolve, reject) => {
      if (isHdr) {
        rgbeLoader.load(
          url,
          texture => {
            onLoaded(texture);
            resolve();
          },
          undefined,
          err => {
            onError();
            reject(err);
          }
        );
      } else {
        textureLoader.load(
          url,
          texture => {
            onLoaded(texture);
            resolve();
          },
          undefined,
          err => {
            onError();
            reject(err);
          }
        );
      }
    });
  }

  function clearEnvironmentMap() {
    void resetEnvironmentMap();
  }

  function syncMaterialUiFromModel() {
    const model = selModel.value;
    if (!model) return;
    const root = meshes.get(model.id);
    if (!root) return;

    let found = false;
    root.traverse(child => {
      if (found) return;
      const mesh = child as THREE.Mesh;
      if (!mesh.isMesh || !mesh.material) return;
      const mat = (Array.isArray(mesh.material) ? mesh.material[0] : mesh.material) as THREE.MeshStandardMaterial;
      if (!mat?.isMeshStandardMaterial) return;
      if (mat.roughness !== undefined) matRoughness.value = mat.roughness;
      if (mat.metalness !== undefined) matMetalness.value = mat.metalness;
      if (mat.normalScale) matNormalStr.value = mat.normalScale.x;
      if (mat.emissiveIntensity !== undefined) matEmissiveInt.value = mat.emissiveIntensity;
      else matEmissiveInt.value = 0;
      if (mat.aoMapIntensity !== undefined) matAoInt.value = mat.aoMapIntensity;
      else matAoInt.value = mat.aoMap ? 1 : 0;
      found = true;
    });
  }

  function syncViewportFog() {
    if (!scene) return;
    applyFog();
  }

  function applySettings() {
    if (!scene || !renderer || !ambientLight || !dirLight || !fillLight) return;
    ambientLight.intensity = ambIntensity.value;
    dirLight.intensity = dirIntensity.value;
    dirLight.position.set(dirPos[0], dirPos[1], dirPos[2]);
    fillLight.intensity = fillIntensity.value;
    fillLight.position.set(fillPos[0], fillPos[1], fillPos[2]);
    applyToneMapping();
    applyFog();
    scheduleSaveSettings();
  }

  function applyMatToModel(modelId: string) {
    const root = meshes.get(modelId);
    if (!root) return;
    root.traverse(child => {
      const mesh = child as THREE.Mesh;
      if (!mesh.isMesh || !mesh.material) return;
      const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      mats.forEach(mat => {
        const m = mat as THREE.MeshStandardMaterial;
        if (!m.isMeshStandardMaterial) return;
        if (m.roughness !== undefined) m.roughness = matRoughness.value;
        if (m.metalness !== undefined) m.metalness = matMetalness.value;
        if (m.normalScale) m.normalScale.setScalar(matNormalStr.value);
        if (m.emissiveIntensity !== undefined) m.emissiveIntensity = matEmissiveInt.value;
        if (m.aoMapIntensity !== undefined) m.aoMapIntensity = matAoInt.value;
        m.needsUpdate = true;
      });
    });
    scheduleSaveSettings();
  }

  function initComposer() {
    if (composer) return;
    const size = new THREE.Vector2(renderer.domElement.width, renderer.domElement.height);
    composer = new EffectComposer(renderer);
    composer.addPass(new RenderPass(scene, camera));
    bloomPass = new UnrealBloomPass(size, 0, 0, 0);
    composer.addPass(bloomPass);
    colorPass = new ShaderPass(ColorCorrectionShader);
    composer.addPass(colorPass);
    hueSatPass = new ShaderPass(HueSaturationShader);
    composer.addPass(hueSatPass);
    brightContrastPass = new ShaderPass(BrightnessContrastShader);
    composer.addPass(brightContrastPass);

    // 选中轮廓（蓝色实线）
    outlinePass = new OutlinePass(size, scene, camera);
    outlinePass.visibleEdgeColor.set(SELECTION_COLOR);
    outlinePass.hiddenEdgeColor.set(HIDDEN_EDGE_COLOR);
    outlinePass.edgeStrength = 3.5;
    outlinePass.edgeThickness = 1.5;
    outlinePass.edgeGlow = 0;
    outlinePass.pulsePeriod = 0;
    composer.addPass(outlinePass);

    // 悬停轮廓（浅蓝）
    hoverOutlinePass = new OutlinePass(size, scene, camera);
    hoverOutlinePass.visibleEdgeColor.set(HOVER_EDGE_COLOR);
    hoverOutlinePass.hiddenEdgeColor.set(HIDDEN_EDGE_COLOR);
    hoverOutlinePass.edgeStrength = 2.5;
    hoverOutlinePass.edgeThickness = 1;
    hoverOutlinePass.edgeGlow = 0;
    hoverOutlinePass.pulsePeriod = 0;
    composer.addPass(hoverOutlinePass);

    composer.addPass(new OutputPass());
  }

  function collectOutlineMeshes(objects: THREE.Object3D[]): THREE.Object3D[] {
    const result: THREE.Object3D[] = [];
    const seen = new Set<THREE.Object3D>();
    for (const root of objects) {
      root.traverse(child => {
        if (seen.has(child)) return;
        if (child.userData?.isEdgeLine || child.userData?.isSelectionHelper) return;
        if (pickOnlyVisible.value && !isObjectVisibleChain(child)) return;
        if ((child as THREE.Mesh).isMesh && child.visible !== false) {
          seen.add(child);
          result.push(child);
        }
      });
    }
    return result;
  }

  function applyMatToCurModel() {
    if (selModel.value) applyMatToModel(selModel.value.id);
  }

  function toggleBloom() {
    if (bloomIntensity.value > 0 && !composer) initComposer();
    if (composer) {
      bloomPass.strength = bloomIntensity.value;
      bloomPass.threshold = bloomThreshold.value;
      bloomPass.radius = bloomRadius.value;
    }
    scheduleSaveSettings();
  }

  function toggleColor() {
    if (!composer) initComposer();
    if (composer) {
      if (hueSatPass.uniforms) {
        hueSatPass.uniforms.saturation.value = ppSaturation.value;
      }
      if (brightContrastPass.uniforms) {
        brightContrastPass.uniforms.contrast.value = ppContrast.value;
      }
    }
    scheduleSaveSettings();
  }

  function applyGrid() {
    if (gridHelper) {
      scene.remove(gridHelper);
      disposeViewportGrid(gridHelper);
    }
    gridHelper = createViewportGrid(gridSize.value, gridDivisions.value);
    gridHelper.position.set(0, gridHeight.value, 0);
    gridHelper.visible = gridVisible.value;
    scene.add(gridHelper);
    applyFog();
    scheduleSaveSettings();
  }

  function applyEnv() {
    if (!scene) return;
    scene.environmentIntensity = envIntensityVal.value;
    scheduleSaveSettings();
  }

  function applyShadow() {
    renderer.shadowMap.enabled = shadowEnabled.value;
    switch (shadowType.value) {
      case "basic":
        renderer.shadowMap.type = THREE.BasicShadowMap;
        break;
      case "vsm":
        renderer.shadowMap.type = THREE.VSMShadowMap;
        break;
      case "pcf":
        renderer.shadowMap.type = THREE.PCFShadowMap;
        break;
      default:
        renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    }
    dirLight.castShadow = shadowEnabled.value;
    fillLight.castShadow = false; // Only main light casts shadow to avoid double shadows
    if (shadowEnabled.value && dirLight.shadow) {
      dirLight.shadow.mapSize.set(shadowMapSize.value, shadowMapSize.value);
      dirLight.shadow.bias = shadowBias.value;
      dirLight.shadow.normalBias = shadowNormalBias.value;
      dirLight.shadow.camera.near = 0.5;
      dirLight.shadow.camera.far = 60;
      dirLight.shadow.camera.left = -15;
      dirLight.shadow.camera.right = 15;
      dirLight.shadow.camera.top = 15;
      dirLight.shadow.camera.bottom = -15;
      dirLight.shadow.camera.updateProjectionMatrix();
      dirLight.shadow.map = null;
    }
    // Shadow ground plane
    if (shadowEnabled.value) {
      if (!groundMesh || !groundMesh.parent) {
        let geo = new THREE.PlaneGeometry(40, 40);
        let mat = new THREE.ShadowMaterial({ transparent: true });
        groundMesh = new THREE.Mesh(geo, mat);
        groundMesh.rotation.x = -Math.PI / 2;
        groundMesh.position.y = 0;
        groundMesh.receiveShadow = true;
        scene.add(groundMesh);
      }
      groundMesh.material.opacity = shadowIntensity.value * 0.5;
    } else if (groundMesh && groundMesh.parent) {
      scene.remove(groundMesh);
    }
    // Update all meshes cast/receive shadow
    meshes.forEach(function (m) {
      m.traverse(function (child) {
        if (child.isMesh) {
          child.castShadow = shadowEnabled.value;
          child.receiveShadow = shadowEnabled.value;
        }
      });
    });
    scheduleSaveSettings();
    renderer.render(scene, camera);
  }

  function applyPostProcessing() {
    if (!composer) return;
    bloomPass.strength = bloomIntensity.value;
    bloomPass.threshold = bloomThreshold.value;
    bloomPass.radius = bloomRadius.value;
  }

  function animate() {
    afid = requestAnimationFrame(animate);
    if (camTrans) {
      const el = performance.now() / 1000 - camTrans.start;
      const t = Math.min(el / camTrans.dur, 1);
      const ease = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
      camera.position.lerpVectors(camTrans.sp, camTrans.ep, ease);
      controls.target.lerpVectors(camTrans.st, camTrans.et, ease);
      camera.fov = camTrans.sf + (camTrans.tf - camTrans.sf) * ease;
      camera.updateProjectionMatrix();
      if (t >= 1) {
        camera.position.copy(camTrans.ep);
        controls.target.copy(camTrans.et);
        camera.fov = camTrans.tf;
        camera.updateProjectionMatrix();
        camTrans = null;
        cameraAnimating = false;
      }
    }
    controls.update();

    const dt = 0.016;
    mixers.forEach(m => m.update(dt));

    // ── 运动段动画播放（段+曲线） ──
    function applyEasing(t: number, type: string): number {
      switch (type) {
        case "linear":
          return t;
        case "easeIn":
          return t * t;
        case "easeOut":
          return t * (2 - t);
        case "easeInOut":
          return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
        case "bounce": {
          if (t < 1 / 2.75) return 7.5625 * t * t;
          if (t < 2 / 2.75) {
            t -= 1.5 / 2.75;
            return 7.5625 * t * t + 0.75;
          }
          if (t < 2.5 / 2.75) {
            t -= 2.25 / 2.75;
            return 7.5625 * t * t + 0.9375;
          }
          t -= 2.625 / 2.75;
          return 7.5625 * t * t + 0.984375;
        }
        case "elastic": {
          if (t === 0 || t >= 1) return t;
          return Math.pow(2, -10 * t) * Math.sin(((t - 0.075) * (2 * Math.PI)) / 0.3) + 1;
        }
        default:
          return t;
      }
    }
    // Chapter animation is now handled by runChapterAnimation (called from onTick on chapter change).
    // The old video-time sync code was removed because it could not reliably track video time
    // and did not follow pivot center settings correctly.

    syncTransformVisualOverlays();
    if (composer) {
      applyPostProcessing();
      composer.render();
    } else {
      renderer.render(scene, camera);
    }
    updateModelIntroLabelPositions();
  }

  let camTrans: any = null;

  function animCam(pos: number[], tgt: number[], fov: number, dur = CHAPTER_CAMERA_TRANSITION_SEC) {
    cameraAnimating = true;
    clearHoverTarget();
    camTrans = {
      sp: camera.position.clone(),
      st: controls.target.clone(),
      sf: camera.fov,
      ep: new THREE.Vector3(...pos),
      et: new THREE.Vector3(...tgt),
      tf: fov,
      start: performance.now() / 1000,
      dur
    };
  }

  function snapCam(pos: number[], tgt: number[], fov: number) {
    camTrans = null;
    cameraAnimating = false;
    camera.position.set(pos[0], pos[1], pos[2]);
    controls.target.set(tgt[0], tgt[1], tgt[2]);
    camera.fov = fov;
    camera.updateProjectionMatrix();
  }

  function defaultModelCfg() {
    return {
      visible: true,
      posOffset: [0, 0, 0],
      scale: 1,
      highlight: false,
      highlightColor: "#00ff00",
      outline: false,
      animation: true,
      intro: ""
    };
  }

  function chapterModelCfg(ch: Chapter, modelId: string) {
    const raw = ch.modelConfigs?.[modelId];
    if (!raw) return null;
    return { ...defaultModelCfg(), ...raw };
  }

  function resetObject3DToDefaultState(m: Model, obj: THREE.Object3D, isRoot: boolean) {
    const def = createDefaultModelConfig();
    if (isRoot) {
      const bp = obj.userData.basePos || m.basePosition || DEFAULT_MODEL_BASE_POSITION;
      obj.position.set(bp[0], bp[1], bp[2]);
      obj.rotation.set(0, 0, 0);
      obj.scale.setScalar(1);
    } else {
      const bp = obj.userData.baseLocalPos || [0, 0, 0];
      const br = obj.userData.baseLocalRot || [0, 0, 0];
      const bs = obj.userData.baseLocalScale ?? 1;
      obj.position.set(bp[0], bp[1], bp[2]);
      obj.rotation.set(br[0], br[1], br[2]);
      obj.scale.setScalar(bs);
    }
    rebuildOutlineForObject(m, obj, def);
  }

  function resetModelTreeToDefault(m: Model) {
    const root = meshes.get(m.id);
    if (!root) return;
    resetObject3DToDefaultState(m, root, true);
    root.traverse(child => {
      if (child === root) return;
      if (child.userData?.isEdgeLine || child.userData?.isSelectionHelper) return;
      if (!child.userData?.nodeId) return;
      resetObject3DToDefaultState(m, child, false);
    });
  }

  function isNodeConfiguredInChapter(cfg: ModelConfig, modelId: string, nodeId: string): boolean {
    if (!cfg.nodeConfigs) return false;
    const displayId = resolveDisplayNodeId(getModelHierarchy(modelId), nodeId);
    return !!(cfg.nodeConfigs[displayId] || cfg.nodeConfigs[nodeId]);
  }

  function applyChapterModelVisibility(ch: Chapter) {
    models.value.forEach(m => {
      const root = meshes.get(m.id);
      if (!root) return;
      const cfg = chapterModelCfg(ch, m.id);
      if (!cfg) {
        resetModelTreeToDefault(m);
        return;
      }
      applyConfigToObject(m, root, cfg, true);
      root.traverse(child => {
        if (child === root) return;
        if (child.userData?.isEdgeLine || child.userData?.isSelectionHelper) return;
        const nodeId = child.userData?.nodeId as string | undefined;
        if (nodeId && !isNodeConfiguredInChapter(cfg, m.id, nodeId)) {
          resetObject3DToDefaultState(m, child, false);
        }
      });
      if (cfg.nodeConfigs) {
        for (const [nodeId, nodeCfg] of Object.entries(cfg.nodeConfigs)) {
          for (const obj of collectObjectsForNodeId(root, nodeId)) {
            applyConfigToObject(m, obj, { ...defaultModelCfg(), ...nodeCfg }, false);
          }
        }
      }
    });
    invalidatePickMeshCache();
  }

  function getChapterCameraTransitionSec(ch: Chapter) {
    const sec = ch.camera.transitionSec;
    return typeof sec === "number" && sec > 0 ? sec : CHAPTER_CAMERA_TRANSITION_SEC;
  }

  function resolveChapterCameraFrame(ch: Chapter) {
    const center = getSceneModelCenter();
    if (!center) {
      return { position: ch.camera.position, target: ch.camera.target };
    }
    const pos = ch.camera.position;
    const tgt = ch.camera.target;
    return {
      position: [pos[0] - tgt[0] + center.x, pos[1] - tgt[1] + center.y, pos[2] - tgt[2] + center.z] as [number, number, number],
      target: [center.x, center.y, center.z] as [number, number, number]
    };
  }

  function applyChapter(ch: Chapter) {
    applyChapterModelVisibility(ch);
    const frame = resolveChapterCameraFrame(ch);
    const dur = getChapterCameraTransitionSec(ch);
    if (viewOnly.value || isPreviewMode.value) {
      snapCam(frame.position, frame.target, ch.camera.fov);
    } else {
      animCam(frame.position, frame.target, ch.camera.fov, dur);
    }
  }

  // ── Model helpers ──
  function createPrim(m: Model): THREE.Mesh {
    const geos: Record<string, THREE.BufferGeometry> = {
      cube: new THREE.BoxGeometry(1, 1, 1),
      sphere: new THREE.SphereGeometry(0.6, 32, 32),
      cylinder: new THREE.CylinderGeometry(0.5, 0.5, 1.2, 32),
      torus: new THREE.TorusGeometry(0.5, 0.2, 16, 32),
      cone: new THREE.ConeGeometry(0.5, 1.2, 32),
      dodecahedron: new THREE.DodecahedronGeometry(0.6, 0)
    };
    const geo = geos[m.type] || geos.cube;
    const mat = new THREE.MeshStandardMaterial({ color: new THREE.Color(m.color), roughness: 0.3, metalness: 0.1 });
    const mesh = new THREE.Mesh(geo, mat);
    // mesh.castShadow = true;
    // mesh.receiveShadow = true;
    mesh.position.set(0, 0.5, 0);
    mesh.userData = { modelId: m.id, basePos: [0, 0.5, 0], isCustom: false };
    scene.add(mesh);
    meshes.set(m.id, mesh);
    return mesh;
  }

  function onGLTFLoaded(m: Model, gltf: { scene: THREE.Group; animations: THREE.AnimationClip[] }) {
    const root = gltf.scene;
    const origPos = root.position.clone();
    const basePos = alignLoadedModelToGround(m, root);
    root.userData = {
      modelId: m.id,
      basePos: [...basePos],
      isCustom: true,
      origPosition: [origPos.x, origPos.y, origPos.z],
      animations: gltf.animations
    };
    scene.add(root);
    meshes.set(m.id, root);
    registerModelHierarchy(m.id, root, m.name);
    if (gltf.animations.length > 0 && !importingModel.value) {
      attachModelMixer(m.id, root, gltf.animations);
    }
    if (selModel.value?.id === m.id) syncMaterialUiFromModel();
    if (selModelId.value === m.id) updateSelectionHighlight();
    invalidatePickMeshCache();
    if (shadowEnabled.value) {
      root.traverse(function (c) {
        if (c.isMesh) {
          c.castShadow = true;
          c.receiveShadow = true;
        }
      });
    }
    syncSceneOrbitLimits();
    applyFog();
  }

  function registerModelHierarchy(modelId: string, root: THREE.Object3D, modelDisplayName?: string) {
    const name = modelDisplayName ?? models.value.find(m => m.id === modelId)?.name;
    const tree = buildModelHierarchy(root, modelId, name);
    if (tree.length > 0) {
      modelHierarchies[modelId] = tree;
    } else {
      delete modelHierarchies[modelId];
    }
    if (selModelId.value === modelId && selModelNodeId.value) {
      const stillInTree = findHierarchyNode(tree, selModelNodeId.value);
      if (!stillInTree) selModelNodeId.value = null;
    }
    hierarchyRevision.value++;
  }

  function removeModelHierarchy(modelId: string) {
    if (modelHierarchies[modelId]) {
      delete modelHierarchies[modelId];
      hierarchyRevision.value++;
    }
  }

  function getModelHierarchy(modelId: string): ModelHierarchyNode[] {
    hierarchyRevision.value;
    return modelHierarchies[modelId] ?? [];
  }

  function togglePickOnlyVisible() {
    pickOnlyVisible.value = !pickOnlyVisible.value;
    invalidatePickMeshCache();
  }

  function findObject3DByNodeId(modelId: string, nodeId: string): THREE.Object3D | null {
    const root = meshes.get(modelId);
    if (!root) return null;
    const objs = collectObjectsForNodeId(root, nodeId);
    return objs[0] ?? null;
  }

  function getNodeObjects(modelId?: string | null, nodeId?: string | null, includeHidden = false): THREE.Object3D[] {
    const mid = modelId ?? selModelId.value;
    if (!mid) return [];
    const root = meshes.get(mid);
    if (!root) return [];
    const nid = nodeId !== undefined ? nodeId : selModelNodeId.value;
    if (!nid) return includeHidden || root.visible ? [root] : [];
    const objs = collectObjectsForNodeId(root, nid);
    return includeHidden ? objs : objs.filter(o => o.visible !== false);
  }

  function getSelectedObject3D(): THREE.Object3D | null {
    const objs = getNodeObjects();
    return objs[0] ?? null;
  }

  function getTransformTarget(modelId?: string | null, nodeId?: string | null): THREE.Object3D | null {
    return getNodeObjects(modelId, nodeId)[0] ?? null;
  }

  function resolveSelectedNodeId(modelId: string, nodeId: string | null): string | null {
    if (!nodeId) return null;
    return resolveDisplayNodeId(getModelHierarchy(modelId), nodeId);
  }

  function ensureChapterModelConfig(ch: Chapter, modelId: string): ModelConfig {
    if (!ch.modelConfigs) ch.modelConfigs = {};
    if (!ch.modelConfigs[modelId]) {
      ch.modelConfigs[modelId] = JSON.parse(JSON.stringify(createDefaultModelConfig()));
    }
    return ch.modelConfigs[modelId];
  }

  function getActiveModelConfig(ch?: Chapter | null): ModelConfig {
    const model = selModel.value;
    const defaultCfg = createDefaultModelConfig();
    if (!model) return defaultCfg;
    const chapter = ch ?? getActiveChapter();
    if (!chapter) return defaultCfg;
    const rootCfg = ensureChapterModelConfig(chapter, model.id);
    if (!selModelNodeId.value) return rootCfg;
    const displayNodeId = resolveDisplayNodeId(getModelHierarchy(model.id), selModelNodeId.value);
    if (!rootCfg.nodeConfigs) rootCfg.nodeConfigs = {};
    if (!rootCfg.nodeConfigs[displayNodeId]) {
      rootCfg.nodeConfigs[displayNodeId] = JSON.parse(JSON.stringify(createDefaultModelConfig()));
    }
    return rootCfg.nodeConfigs[displayNodeId];
  }

  function readActiveModelConfig(ch?: Chapter | null): ModelConfig {
    const model = selModel.value;
    const defaultCfg = createDefaultModelConfig();
    if (!model) return defaultCfg;
    const chapter = ch ?? getActiveChapter();
    if (!chapter) return defaultCfg;
    const rootCfg = chapter.modelConfigs?.[model.id] as ModelConfig | undefined;
    if (!selModelNodeId.value) return rootCfg ? { ...defaultCfg, ...rootCfg } : defaultCfg;
    const displayNodeId = resolveDisplayNodeId(getModelHierarchy(model.id), selModelNodeId.value);
    const nodeCfg = rootCfg?.nodeConfigs?.[displayNodeId] ?? rootCfg?.nodeConfigs?.[selModelNodeId.value];
    return nodeCfg ? { ...defaultCfg, ...nodeCfg } : defaultCfg;
  }

  function hasActiveModelConfig(ch?: Chapter | null): boolean {
    const model = selModel.value;
    const chapter = ch ?? getActiveChapter();
    if (!model || !chapter) return false;
    const rootCfg = chapter.modelConfigs?.[model.id] as ModelConfig | undefined;
    if (!selModelNodeId.value) return !!rootCfg;
    const displayNodeId = resolveDisplayNodeId(getModelHierarchy(model.id), selModelNodeId.value);
    return !!(rootCfg?.nodeConfigs?.[displayNodeId] || rootCfg?.nodeConfigs?.[selModelNodeId.value]);
  }

  function configHasAnimation(cfg: ModelConfig): boolean {
    if (cfg.animation && cfg.animConfig?.segments?.length) return true;
    if (cfg.nodeConfigs) {
      for (const nodeCfg of Object.values(cfg.nodeConfigs)) {
        if (configHasAnimation(nodeCfg)) return true;
      }
    }
    return false;
  }

  function modelHasEdits(modelId: string): boolean {
    const ch = getActiveChapter();
    if (!ch || !ch.modelConfigs) return false;
    const cfg = ch.modelConfigs[modelId] as ModelConfig | undefined;
    if (!cfg) return false;
    const def = createDefaultModelConfig();
    const rootEdited =
      cfg.visible !== def.visible ||
      cfg.scale !== def.scale ||
      cfg.highlight !== def.highlight ||
      cfg.outline !== def.outline ||
      cfg.intro !== def.intro ||
      (cfg.posOffset && (cfg.posOffset[0] !== 0 || cfg.posOffset[1] !== 0 || cfg.posOffset[2] !== 0)) ||
      !!(cfg.animConfig?.segments?.length ?? 0);
    if (rootEdited) return true;
    if (cfg.nodeConfigs) {
      for (const nodeCfg of Object.values(cfg.nodeConfigs)) {
        if (modelHasEditsForConfig(nodeCfg, def)) return true;
      }
    }
    return false;
  }

  function modelHasEditsForConfig(cfg: ModelConfig, def: ModelConfig): boolean {
    return (
      cfg.visible !== def.visible ||
      cfg.scale !== def.scale ||
      cfg.highlight !== def.highlight ||
      cfg.outline !== def.outline ||
      !!cfg.intro ||
      (cfg.posOffset && (cfg.posOffset[0] !== 0 || cfg.posOffset[1] !== 0 || cfg.posOffset[2] !== 0)) ||
      !!(cfg.animConfig?.segments?.length ?? 0)
    );
  }

  function modelNodeHasEdits(modelId: string, nodeId: string): boolean {
    const ch = getActiveChapter();
    const nodeConfigs = ch?.modelConfigs?.[modelId]?.nodeConfigs;
    if (!nodeConfigs) return false;
    const displayId = resolveDisplayNodeId(getModelHierarchy(modelId), nodeId);
    const nodeCfg = (nodeConfigs[displayId] ?? nodeConfigs[nodeId]) as ModelConfig | undefined;
    if (!nodeCfg) return false;
    return modelHasEditsForConfig(nodeCfg, createDefaultModelConfig());
  }

  function collectChapterAnimTargets(ch: Chapter): Array<{ objs: THREE.Object3D[]; cfg: ModelConfig; liveSegs?: any[] }> {
    const targets: Array<{ objs: THREE.Object3D[]; cfg: ModelConfig; liveSegs?: any[] }> = [];
    if (!ch.modelConfigs) return targets;

    for (const [cmid, rootCfg] of Object.entries(ch.modelConfigs)) {
      const root = meshes.get(cmid);
      if (!root) continue;

      const rootCfgTyped = rootCfg as ModelConfig;
      const isEditingRoot = selModel.value?.id === cmid && !selModelNodeId.value;
      if (rootCfgTyped.animation && rootCfgTyped.animConfig?.segments?.length) {
        targets.push({
          objs: [root],
          cfg: rootCfgTyped,
          liveSegs: isEditingRoot && animSegments.length > 0 ? animSegments : undefined
        });
      }

      const nodeConfigs = (rootCfg as ModelConfig).nodeConfigs;
      if (!nodeConfigs) continue;
      const seenDisplayIds = new Set<string>();
      const tree = getModelHierarchy(cmid);
      for (const [nodeId, nodeCfg] of Object.entries(nodeConfigs)) {
        const displayId = resolveDisplayNodeId(tree, nodeId);
        if (seenDisplayIds.has(displayId)) continue;
        seenDisplayIds.add(displayId);
        const nodeObjs = collectObjectsForNodeId(root, displayId);
        if (!nodeObjs.length) continue;
        const isEditingNode = selModel.value?.id === cmid && resolveDisplayNodeId(tree, selModelNodeId.value ?? "") === displayId;
        const nodeCfgTyped = ((nodeConfigs[displayId] as ModelConfig) ?? nodeCfg) as ModelConfig;
        if (!nodeCfgTyped.animation || !nodeCfgTyped.animConfig?.segments?.length) continue;
        targets.push({
          objs: nodeObjs,
          cfg: nodeCfgTyped,
          liveSegs: isEditingNode && animSegments.length > 0 ? animSegments : undefined
        });
      }
    }
    return targets;
  }

  function applyElapsedAnimToObject(obj: THREE.Object3D, cfg: ModelConfig, elapsedSec: number, liveSegs?: any[]) {
    const cac = cfg.animConfig;
    if (!cac?.segments?.length || !cfg.animation) return;

    const rawSegs = liveSegs?.length ? liveSegs : cac.segments;
    const csegs = resolvePlaybackSegments(rawSegs);
    let ctotal = 0;
    for (let cs = 0; cs < csegs.length; cs++) ctotal += (csegs[cs].pauseTime || 0) + (csegs[cs].animTime || 3);
    if (ctotal <= 0) return;
    for (let cs2 = 0; cs2 < csegs.length; cs2++) getSegPivotCache(csegs[cs2], obj);

    const elapsed = Math.max(0, elapsedSec);
    if (elapsed <= 0) {
      const cfirst = csegs[0];
      applyPivotRotation(
        obj,
        [cfirst.startPos[0], cfirst.startPos[1], cfirst.startPos[2]],
        [cfirst.startRot[0], cfirst.startRot[1], cfirst.startRot[2]],
        cfirst.pivot || "center",
        cfirst.startScale
      );
      return;
    }

    if (elapsed >= ctotal) {
      const alast = csegs[csegs.length - 1];
      try {
        applyPivotPathFrame(
          obj,
          [alast.endPos[0], alast.endPos[1], alast.endPos[2]],
          [alast.endRot[0], alast.endRot[1], alast.endRot[2]],
          alast._animPivotCache,
          1
        );
        obj.scale.setScalar(alast.endScale);
      } catch {
        /* ignore */
      }
      return;
    }

    const aabs = elapsed;
    let acum = 0;
    let applied = false;
    for (let aseg = 0; aseg < csegs.length; aseg++) {
      const as = csegs[aseg];
      const asTotal = (as.pauseTime || 0) + (as.animTime || 3);
      if (aabs >= acum && aabs <= acum + asTotal) {
        const alocal = aabs - acum;
        const apause = as.pauseTime || 0;
        const apc = as._animPivotCache;
        if (alocal < apause) {
          applyPivotPathFrame(
            obj,
            [as.startPos[0], as.startPos[1], as.startPos[2]],
            [as.startRot[0], as.startRot[1], as.startRot[2]],
            apc,
            0
          );
          obj.scale.setScalar(as.startScale);
        } else {
          const aAnimT = (alocal - apause) / (as.animTime || 3);
          const aep2 = applyEasingInline(Math.min(1, aAnimT), as.easing || animEasing.value);
          const apos = [
            as.startPos[0] + (as.endPos[0] - as.startPos[0]) * aep2,
            as.startPos[1] + (as.endPos[1] - as.startPos[1]) * aep2,
            as.startPos[2] + (as.endPos[2] - as.startPos[2]) * aep2
          ];
          const arot = [
            as.startRot[0] + (as.endRot[0] - as.startRot[0]) * aep2,
            as.startRot[1] + (as.endRot[1] - as.startRot[1]) * aep2,
            as.startRot[2] + (as.endRot[2] - as.startRot[2]) * aep2
          ];
          applyPivotPathFrame(obj, apos, arot, apc, aep2);
          obj.scale.setScalar(as.startScale + (as.endScale - as.startScale) * aep2);
        }
        applied = true;
        break;
      }
      acum += asTotal;
    }
    if (!applied) {
      const alast = csegs[csegs.length - 1];
      try {
        applyPivotPathFrame(
          obj,
          [alast.endPos[0], alast.endPos[1], alast.endPos[2]],
          [alast.endRot[0], alast.endRot[1], alast.endRot[2]],
          alast._animPivotCache,
          1
        );
        obj.scale.setScalar(alast.endScale);
      } catch {
        /* ignore */
      }
    }
  }

  function attachModelMixer(modelId: string, root: THREE.Object3D, animations: THREE.AnimationClip[]) {
    if (mixers.some(mixer => (mixer.getRoot() as THREE.Object3D).userData?.modelId === modelId)) return;
    const mixer = new THREE.AnimationMixer(root);
    animations.forEach(clip => mixer.clipAction(clip).play());
    mixers.push(mixer);
  }

  function ensureAllModelMixers() {
    meshes.forEach((root, id) => {
      const animations = root.userData?.animations as THREE.AnimationClip[] | undefined;
      if (animations?.length) attachModelMixer(id, root, animations);
    });
  }

  async function loadGLB(m: Model) {
    const url = m.url;
    if (!url) return;
    return new Promise<void>(resolve => {
      gltfLoader.load(
        url,
        gltf => {
          onGLTFLoaded(m, gltf);
          resolve();
        },
        undefined,
        err => {
          console.error("Failed to load GLB model:", m.name || m.id, err);
          resolve();
        }
      );
    });
  }

  async function loadGLBFromArrayBuffer(m: Model, buffer: ArrayBuffer) {
    return new Promise<void>(resolve => {
      gltfLoader.parse(
        buffer,
        "",
        gltf => {
          onGLTFLoaded(m, gltf);
          resolve();
        },
        err => {
          console.error("Failed to parse GLB model:", m.name || m.id, err);
          resolve();
        }
      );
    });
  }

  function disposeObject3D(obj: THREE.Object3D) {
    obj.traverse(child => {
      const mesh = child as THREE.Mesh;
      if (!mesh.isMesh) return;
      mesh.geometry?.dispose();
      const material = mesh.material;
      if (Array.isArray(material)) material.forEach(mat => mat.dispose());
      else material?.dispose();
    });
  }

  function removeModelMixer(mid: string) {
    mixers = mixers.filter(mixer => {
      const root = mixer.getRoot() as THREE.Object3D;
      if (root.userData?.modelId !== mid) return true;
      mixer.stopAllAction();
      return false;
    });
  }

  function rmMesh(mid: string) {
    const o = meshes.get(mid);
    if (!o) return;
    if (selModelId.value === mid) {
      clearSelectionHighlight();
      if (selModelNodeId.value) selModelNodeId.value = null;
    }
    removeModelHierarchy(mid);
    removeModelMixer(mid);
    scene.remove(o);
    disposeObject3D(o);
    meshes.delete(mid);
    invalidatePickMeshCache();
    const model = models.value.find(m => m.id === mid);
    if (model?.url?.startsWith("blob:")) URL.revokeObjectURL(model.url);
  }

  function clearSelectionHighlight() {
    if (outlinePass) outlinePass.selectedObjects = [];
  }

  function clearHoverHighlight() {
    if (hoverOutlinePass) hoverOutlinePass.selectedObjects = [];
  }

  function clearHoverTarget() {
    hoverModelId.value = null;
    hoverModelNodeId.value = null;
    clearHoverHighlight();
  }

  function setHoverTarget(modelId: string | null, nodeId?: string | null, hitObject?: THREE.Object3D | null) {
    if (!modelId) {
      clearHoverTarget();
      return;
    }
    const resolvedNodeId = nodeId ? resolveSelectedNodeId(modelId, nodeId) : null;
    const sameAsSelection = modelId === selModelId.value && (resolvedNodeId ?? null) === (selModelNodeId.value ?? null);

    if (hoverModelId.value === modelId && hoverModelNodeId.value === resolvedNodeId) {
      if (!sameAsSelection && !viewportInteracting) {
        applyHoverVisualMeshes(modelId, resolvedNodeId, hitObject);
      }
      return;
    }

    hoverModelId.value = modelId;
    hoverModelNodeId.value = resolvedNodeId;

    if (sameAsSelection) {
      clearHoverHighlight();
      return;
    }

    applyHoverVisualMeshes(modelId, resolvedNodeId, hitObject);
  }

  function applyHoverVisualMeshes(modelId: string, resolvedNodeId: string | null, hitObject?: THREE.Object3D | null) {
    if (viewportInteracting || cameraAnimating || camTrans) return;
    if (!hoverOutlinePass) {
      clearHoverHighlight();
      return;
    }
    let meshes: THREE.Object3D[] = [];
    if (hitObject && (hitObject as THREE.Mesh).isMesh) {
      meshes = collectOutlineMeshes([hitObject]);
    } else {
      meshes = collectOutlineMeshes(getNodeObjects(modelId, resolvedNodeId));
    }
    hoverOutlinePass.selectedObjects = meshes;
  }

  function hoverModelInList(modelId: string, nodeId?: string | null) {
    if (isPreviewMode.value) return;
    setHoverTarget(modelId, nodeId ?? null);
  }

  function clearHoverModelInList() {
    clearHoverTarget();
  }

  function isModelCardHovered(modelId: string): boolean {
    return hoverModelId.value === modelId && !hoverModelNodeId.value;
  }

  function isModelNodeHovered(modelId: string, nodeId: string): boolean {
    if (hoverModelId.value !== modelId || !hoverModelNodeId.value) return false;
    if (hoverModelNodeId.value === nodeId) return true;
    const node = findHierarchyNode(getModelHierarchy(modelId), nodeId);
    return node?.mergedNodeIds?.includes(hoverModelNodeId.value) ?? false;
  }

  function updateSelectionHighlight() {
    if (!outlinePass) return;
    if (!selModelId.value) {
      outlinePass.selectedObjects = [];
      return;
    }
    outlinePass.selectedObjects = collectOutlineMeshes(getNodeObjects());
  }

  function updateHoverHighlight(clientX: number, clientY: number) {
    if (viewportInteracting || viewportPickState || cameraAnimating || camTrans || isPreviewMode.value) return;
    const result = raycastAt(clientX, clientY);
    if (!result) {
      clearHoverTarget();
      return;
    }
    setHoverTarget(result.modelId, result.nodeId, result.hitObject);
  }

  function syncTransformVisualOverlays() {
    if (selModelId.value && pivotHelpers.has(selModelId.value)) {
      updateActivePivotHelper(selModelId.value);
    }
  }

  function isPickExemptObject(obj: THREE.Object3D): boolean {
    let current: THREE.Object3D | null = obj;
    while (current) {
      if (current.userData?.isSelectionHelper || current.userData?.isEdgeLine) return true;
      current = current.parent;
    }
    return false;
  }

  function getModelIdFromHit(obj: THREE.Object3D): string | null {
    return resolvePickTarget(obj)?.modelId ?? null;
  }

  function isObjectVisibleChain(obj: THREE.Object3D | null): boolean {
    let cur: THREE.Object3D | null = obj;
    while (cur) {
      if (cur.visible === false) return false;
      cur = cur.parent;
    }
    return true;
  }

  function resolvePickTarget(obj: THREE.Object3D): { modelId: string; nodeId: string | null } | null {
    if (isPickExemptObject(obj)) return null;

    let modelId: string | null = null;
    let current: THREE.Object3D | null = obj;
    while (current) {
      if (current.userData?.modelId) {
        modelId = current.userData.modelId as string;
        break;
      }
      current = current.parent;
    }
    if (!modelId || !meshes.get(modelId)?.visible) return null;
    if (pickOnlyVisible.value && !isObjectVisibleChain(obj)) return null;

    let nodeId: string | null = null;
    if (obj.userData?.mergedNodeId) {
      nodeId = obj.userData.mergedNodeId as string;
    } else if (obj.userData?.nodeId) {
      nodeId = obj.userData.nodeId as string;
    } else {
      current = obj.parent;
      while (current) {
        if (current.userData?.mergedNodeId) {
          nodeId = current.userData.mergedNodeId as string;
          break;
        }
        if (current.userData?.nodeId) {
          nodeId = current.userData.nodeId as string;
          break;
        }
        current = current.parent;
      }
    }
    return { modelId, nodeId };
  }

  function isMeshPickable(modelId: string, mesh: THREE.Mesh): boolean {
    const root = meshes.get(modelId);
    if (!root?.visible) return false;
    if (pickOnlyVisible.value && !isObjectVisibleChain(mesh)) return false;
    const ch = getActiveChapter();
    const cfg = ch ? chapterModelCfg(ch, modelId) : null;
    if (pickOnlyVisible.value && cfg && !cfg.visible) return false;
    return true;
  }

  function collectPickableMeshes(): THREE.Mesh[] {
    const key = `${meshes.size}:${hierarchyRevision.value}:${pickOnlyVisible.value}:${selectedChapterId.value}`;
    if (key === pickableMeshCacheKey) return pickableMeshCache;

    const result: THREE.Mesh[] = [];
    for (const [modelId, root] of meshes) {
      if (!root.visible) continue;
      root.traverse(obj => {
        if (isPickExemptObject(obj)) return;
        const mesh = obj as THREE.Mesh;
        if (!mesh.isMesh) return;
        if (!isMeshPickable(modelId, mesh)) return;
        result.push(mesh);
      });
    }
    pickableMeshCache = result;
    pickableMeshCacheKey = key;
    return result;
  }

  function isFrontFaceHit(hit: THREE.Intersection): boolean {
    if (!hit.face) return true;
    _pickNormal.copy(hit.face.normal).transformDirection(hit.object.matrixWorld);
    _pickView.subVectors(camera.position, hit.point).normalize();
    return _pickNormal.dot(_pickView) > 0.02;
  }

  function intersectPickableMeshes(pickMeshes: THREE.Mesh[]): THREE.Intersection[] {
    const outlineHidden: THREE.Mesh[] = [];
    for (const mesh of pickMeshes) {
      if (!mesh.visible && mesh.userData.pickHiddenForOutline) {
        mesh.visible = true;
        outlineHidden.push(mesh);
      }
    }

    camera.updateMatrixWorld(true);
    scene.updateMatrixWorld(true);
    const hits = raycaster.intersectObjects(pickMeshes, false);

    for (const mesh of outlineHidden) {
      mesh.visible = false;
    }
    return hits;
  }

  type PickTargetResult = { modelId: string; nodeId: string | null; hitObject: THREE.Object3D; hitPoint: THREE.Vector3 };

  const _previewHitBox = new THREE.Box3();
  const _previewHitCenter = new THREE.Vector3();
  const _previewHitSize = new THREE.Vector3();
  const _previewHitLocal = new THREE.Vector3();

  function isPreviewModelCenterHit(clientX: number, clientY: number) {
    const result = raycastAt(clientX, clientY);
    if (!result) return false;
    const root = meshes.get(result.modelId);
    if (!root) return false;
    _previewHitBox.setFromObject(root);
    if (_previewHitBox.isEmpty()) return false;
    _previewHitBox.getCenter(_previewHitCenter);
    _previewHitBox.getSize(_previewHitSize);
    _previewHitLocal.copy(result.hitPoint).sub(_previewHitCenter);
    const rx = _previewHitSize.x > 1e-6 ? Math.abs(_previewHitLocal.x) / (_previewHitSize.x * 0.5) : 0;
    const ry = _previewHitSize.y > 1e-6 ? Math.abs(_previewHitLocal.y) / (_previewHitSize.y * 0.5) : 0;
    const rz = _previewHitSize.z > 1e-6 ? Math.abs(_previewHitLocal.z) / (_previewHitSize.z * 0.5) : 0;
    return Math.max(rx, ry, rz) <= 0.7;
  }

  function tryTogglePlayOnPreviewTap(clientX: number, clientY: number) {
    if (!isPreviewMode.value || !hasVideo.value) return;
    if (!isPreviewModelCenterHit(clientX, clientY)) return;
    togglePlay();
  }

  function raycastAt(clientX: number, clientY: number): PickTargetResult | null {
    if (!renderer || !camera) return null;
    const rect = renderer.domElement.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return null;

    const localX = clientX - rect.left;
    const localY = clientY - rect.top;
    if (localX < 0 || localY < 0 || localX > rect.width || localY > rect.height) return null;

    pickPointer.x = (localX / rect.width) * 2 - 1;
    pickPointer.y = -(localY / rect.height) * 2 + 1;
    raycaster.setFromCamera(pickPointer, camera);
    raycaster.params.Line.threshold = 0;
    raycaster.params.Points.threshold = 0;

    const pickMeshes = collectPickableMeshes();
    if (pickMeshes.length === 0) return null;

    const meshHits = intersectPickableMeshes(pickMeshes);
    for (const hit of meshHits) {
      const mesh = hit.object as THREE.Mesh;
      if (!mesh.isMesh) continue;
      if (!isFrontFaceHit(hit)) continue;
      const target = resolvePickTarget(mesh);
      if (target) return { ...target, hitObject: mesh, hitPoint: hit.point.clone() };
    }
    return null;
  }

  function raycastModelTarget(clientX: number, clientY: number): { modelId: string; nodeId: string | null } | null {
    const result = raycastAt(clientX, clientY);
    if (!result) return null;
    return { modelId: result.modelId, nodeId: result.nodeId };
  }

  function raycastModelId(clientX: number, clientY: number): string | null {
    return raycastModelTarget(clientX, clientY)?.modelId ?? null;
  }

  function focusCameraOnObject(obj: THREE.Object3D, dur = MODEL_CAMERA_FOCUS_SEC) {
    if (!controls) return;

    const box = new THREE.Box3().setFromObject(obj);
    if (box.isEmpty()) return;

    box.getCenter(_focusCenter);
    box.getSize(_focusSize);
    const maxDim = Math.max(_focusSize.x, _focusSize.y, _focusSize.z, 0.4);
    const distance = getPresentationCameraDistance(maxDim);

    _focusOffset.copy(_defaultCamViewDir).multiplyScalar(distance);

    const newPos: [number, number, number] = [
      _focusCenter.x + _focusOffset.x,
      Math.max(_focusCenter.y + _focusOffset.y, _focusCenter.y + maxDim * 0.25),
      _focusCenter.z + _focusOffset.z
    ];
    const target: [number, number, number] = [_focusCenter.x, _focusCenter.y, _focusCenter.z];
    animCam(newPos, target, camera.fov, dur);
  }

  function focusCameraOnSelection(dur = MODEL_CAMERA_FOCUS_SEC) {
    const obj = getSelectedObject3D();
    if (obj) focusCameraOnObject(obj, dur);
  }

  function focusCameraOnModel(modelId: string, dur = MODEL_CAMERA_FOCUS_SEC) {
    const obj = meshes.get(modelId);
    if (obj) focusCameraOnObject(obj, dur);
  }

  function scrollSelectedModelIntoView() {
    nextTick(() => {
      document
        .querySelector(".model-tree-node.selected, .model-card.selected")
        ?.scrollIntoView({ block: "nearest", behavior: "smooth" });
    });
  }

  function pickModelAtViewport(clientX: number, clientY: number): boolean {
    if (viewOnly.value || isPreviewMode.value) return false;
    controls?.update();
    const target = raycastModelTarget(clientX, clientY);
    if (!target) return false;
    const model = models.value.find(m => m.id === target.modelId);
    if (!model) return false;
    clearHoverTarget();
    selectModel(model, { focusCamera: true, nodeId: target.nodeId });
    rightTab.value = "model";
    scrollSelectedModelIntoView();
    return true;
  }

  function applyMConfig(m: Model, cfg: ModelConfig) {
    const root = meshes.get(m.id);
    if (!root) return;
    applyConfigToObject(m, root, cfg, true);
    if (cfg.nodeConfigs) {
      for (const [nodeId, nodeCfg] of Object.entries(cfg.nodeConfigs)) {
        const nodeObj = findObject3DByNodeId(m.id, nodeId);
        if (nodeObj) applyConfigToObject(m, nodeObj, nodeCfg, false);
      }
    }
  }

  function applyConfigToObject(m: Model, obj: THREE.Object3D, cfg: ModelConfig, isRoot: boolean) {
    const hasAnim = !!(cfg.animation && (cfg.animConfig?.segments?.length ?? 0) > 0);
    if (!hasAnim) {
      obj.scale.setScalar(cfg.scale || 1);
      if (isRoot) {
        const bp = obj.userData.basePos || DEFAULT_MODEL_BASE_POSITION;
        obj.position.set(bp[0] + (cfg.posOffset?.[0] || 0), bp[1] + (cfg.posOffset?.[1] || 0), bp[2] + (cfg.posOffset?.[2] || 0));
      } else {
        const bp = obj.userData.baseLocalPos || [obj.position.x, obj.position.y, obj.position.z];
        obj.position.set(bp[0] + (cfg.posOffset?.[0] || 0), bp[1] + (cfg.posOffset?.[1] || 0), bp[2] + (cfg.posOffset?.[2] || 0));
      }
    }
    rebuildOutlineForObject(m, obj, cfg);
  }

  // ── Chapter navigation ──

  function resolveChapter(ch: Chapter) {
    const chapter = chapters.value.find(c => c.id === ch.id);
    if (!chapter) return null;
    const timelineIdx = chapter.parentId
      ? timelineChapters.value.findIndex(c => c.id === chapter.parentId)
      : timelineChapters.value.findIndex(c => c.id === chapter.id);
    return { chapter, idx: timelineIdx >= 0 ? timelineIdx : 0 };
  }

  function focusChapter(chapter: Chapter, idx: number) {
    selectedChapterId.value = chapter.id;
    playingIdx.value = idx;
    syncChapterForm(chapter);
  }

  async function withChapterNavLock(fn: () => void | Promise<void>) {
    chapterNavLock.value = true;
    try {
      await fn();
    } finally {
      chapterNavLock.value = false;
    }
  }

  function clampVideoTime(time: number, video = videoEl.value) {
    if (!video) return time;
    const maxTime = Number.isFinite(video.duration) && video.duration > 0 ? video.duration : duration.value;
    return Math.max(0, Math.min(time, maxTime || time));
  }

  function getVideoSeekEnd(video: HTMLVideoElement) {
    if (video.seekable.length > 0) return video.seekable.end(video.seekable.length - 1);
    if (video.buffered.length > 0) return video.buffered.end(video.buffered.length - 1);
    return 0;
  }

  async function waitUntilSeekable(video: HTMLVideoElement, target: number) {
    const deadline = performance.now() + SEEK_READY_TIMEOUT_MS;
    while (performance.now() < deadline) {
      if (getVideoSeekEnd(video) >= target - CHAPTER_TIME_EPS) return;
      await new Promise(resolve => window.setTimeout(resolve, 50));
    }
  }

  async function seekVideoTo(time: number) {
    const video = videoEl.value;
    if (!video) return;

    const target = clampVideoTime(time, video);
    if (!Number.isFinite(target)) return;

    if (Math.abs(video.currentTime - target) < CHAPTER_TIME_EPS) {
      currentTime.value = video.currentTime;
      return;
    }

    video.pause();
    await waitUntilSeekable(video, target);

    await new Promise<void>(resolve => {
      let settled = false;
      const finish = () => {
        if (settled) return;
        settled = true;
        video.removeEventListener("seeked", onSeeked);
        currentTime.value = video.currentTime;
        resolve();
      };
      const onSeeked = () => finish();
      video.addEventListener("seeked", onSeeked);
      try {
        video.currentTime = target;
      } catch {
        finish();
        return;
      }
      window.setTimeout(finish, SEEK_EVENT_TIMEOUT_MS);
    });
  }

  function resetChapterModelsToStart(chapter: Chapter) {
    for (const { objs, cfg, liveSegs } of collectChapterAnimTargets(chapter)) {
      for (const obj of objs) {
        if (cfg.animation && cfg.animConfig?.segments?.length) {
          applyElapsedAnimToObject(obj, cfg, 0, liveSegs);
        } else if (!obj.userData?.nodeId) {
          const bp = obj.userData.basePos || DEFAULT_MODEL_BASE_POSITION;
          obj.position.set(bp[0], bp[1], bp[2]);
          obj.rotation.set(0, 0, 0);
          obj.scale.setScalar(1);
        } else {
          const bp = obj.userData.baseLocalPos || [0, 0, 0];
          const br = obj.userData.baseLocalRot || [0, 0, 0];
          const bs = obj.userData.baseLocalScale ?? 1;
          obj.position.set(bp[0], bp[1], bp[2]);
          obj.rotation.set(br[0], br[1], br[2]);
          obj.scale.setScalar(bs);
        }
      }
    }
  }

  function syncPausedChapterAnimation(v: HTMLVideoElement, _ci: number) {
    if (!v.paused) return;
    const ch = getPlaybackChapterAtTime(v.currentTime);
    if (!ch) return;
    stopChapterAnimation();
    applyChapterAnimationAtElapsed(ch, getChapterAnimElapsed(ch, v.currentTime));
  }

  function syncChapterSubtitle(v: HTMLVideoElement) {
    const subtitle = subtitles.value.find(sb => v.currentTime >= sb.startTime && v.currentTime < sb.endTime);
    if (subtitle) {
      showSubtitle(subtitle);
      return;
    }
    displaySubtitle.value = false;
  }

  // ── Ticker ──
  function findChIdx(t: number) {
    return timelineChapters.value.findIndex(c => t >= c.startTime - CHAPTER_TIME_EPS && t < c.endTime);
  }

  function chapterAtTime(t: number): Chapter | null {
    const hit = timelineChapters.value.find(c => t >= c.startTime && t < c.endTime);
    if (hit) return hit;
    let last: Chapter | null = null;
    for (const ch of timelineChapters.value) {
      if (ch.startTime <= t + CHAPTER_TIME_EPS) last = ch;
      else break;
    }
    return last ?? timelineChapters.value[0] ?? null;
  }

  function getPlaybackChapterAtTime(t: number): Chapter | null {
    const selected = chapters.value.find(c => c.id === selectedChapterId.value);
    if (selected && t >= selected.startTime - CHAPTER_TIME_EPS && t < selected.endTime) {
      return selected;
    }
    const ci = findChIdx(t);
    return ci >= 0 ? timelineChapters.value[ci] : null;
  }

  function getTimelineChapterIndex(ch: Chapter): number {
    if (!ch.parentId) return timelineChapters.value.findIndex(c => c.id === ch.id);
    return timelineChapters.value.findIndex(c => c.id === ch.parentId);
  }

  function isChapterInPlaybackRange(ch: Chapter, t: number): boolean {
    return t >= ch.startTime - CHAPTER_TIME_EPS && t < ch.endTime;
  }

  function clampNumber(value: number, min: number, max: number) {
    if (max < min) return min;
    return Math.min(Math.max(value, min), max);
  }

  function getChapterScope(parentId?: string) {
    const parent = parentId ? chapters.value.find(ch => ch.id === parentId) : null;
    return {
      parent,
      startTime: parent?.startTime ?? 0,
      endTime: parent?.endTime ?? (currProj.value?.videoDuration || duration.value)
    };
  }

  function getSiblingChapters(parentId?: string, excludeId?: string) {
    return chapters.value
      .filter(ch => (ch.parentId || undefined) === (parentId || undefined) && ch.id !== excludeId)
      .sort((a, b) => a.startTime - b.startTime || a.endTime - b.endTime);
  }

  function getSortedChapterChildren(chapterId: string) {
    return chapters.value
      .filter(ch => ch.parentId === chapterId)
      .sort((a, b) => a.startTime - b.startTime || a.endTime - b.endTime);
  }

  function getDefaultChapterSegmentDuration(rangeDuration: number) {
    if (rangeDuration < MIN_CHAPTER_DURATION * 2 - CHAPTER_TIME_EPS) return 0;
    if (rangeDuration <= CHAPTER_SPLIT_INTERVAL + CHAPTER_TIME_EPS) return rangeDuration / 2;
    return CHAPTER_SPLIT_INTERVAL;
  }

  function getProtectedChildEnd(ch: Chapter) {
    const children = getSortedChapterChildren(ch.id);
    if (children.length === 0) return ch.startTime;
    return Math.max(...children.map(child => child.endTime));
  }

  function getNextChapterRange(parentId?: string): { startTime: number; endTime: number; splitChapter?: Chapter } | null {
    const scope = getChapterScope(parentId);
    const scopeDuration = scope.endTime - scope.startTime;
    if (scopeDuration < MIN_CHAPTER_DURATION * 2 - CHAPTER_TIME_EPS) return null;

    const siblings = getSiblingChapters(parentId);
    if (siblings.length === 0) {
      const segmentDuration = getDefaultChapterSegmentDuration(scopeDuration);
      if (segmentDuration <= 0) return null;
      return {
        startTime: scope.startTime,
        endTime: Math.min(scope.endTime, scope.startTime + segmentDuration)
      };
    }

    let cursor = scope.startTime;
    for (const sibling of siblings) {
      const siblingStart = clampNumber(sibling.startTime, scope.startTime, scope.endTime);
      if (siblingStart - cursor >= MIN_CHAPTER_DURATION - CHAPTER_TIME_EPS) {
        const gapDuration = siblingStart - cursor;
        const segmentDuration = Math.min(gapDuration, CHAPTER_SPLIT_INTERVAL);
        return {
          startTime: cursor,
          endTime: cursor + segmentDuration
        };
      }
      cursor = Math.max(cursor, clampNumber(sibling.endTime, scope.startTime, scope.endTime));
    }

    if (scope.endTime - cursor >= MIN_CHAPTER_DURATION - CHAPTER_TIME_EPS) {
      const gapDuration = scope.endTime - cursor;
      const segmentDuration = Math.min(gapDuration, CHAPTER_SPLIT_INTERVAL);
      return {
        startTime: cursor,
        endTime: cursor + segmentDuration
      };
    }

    const splitTarget = [...siblings].sort((a, b) => b.endTime - a.endTime)[0];
    if (!splitTarget) return null;

    const protectedEnd = getProtectedChildEnd(splitTarget);
    const targetDuration = splitTarget.endTime - splitTarget.startTime;
    const preferredDuration = getDefaultChapterSegmentDuration(targetDuration);
    if (preferredDuration <= 0) return null;
    if (protectedEnd > splitTarget.endTime - MIN_CHAPTER_DURATION + CHAPTER_TIME_EPS) return null;

    const splitAt = clampNumber(
      Math.max(splitTarget.startTime + preferredDuration, protectedEnd),
      splitTarget.startTime + MIN_CHAPTER_DURATION,
      splitTarget.endTime - MIN_CHAPTER_DURATION
    );

    if (splitAt <= splitTarget.startTime + CHAPTER_TIME_EPS || splitAt >= splitTarget.endTime - CHAPTER_TIME_EPS) {
      return null;
    }

    return {
      startTime: splitAt,
      endTime: splitTarget.endTime,
      splitChapter: splitTarget
    };
  }

  function getChapterTimeInputBounds(ch: Chapter) {
    const scope = getChapterScope(ch.parentId);
    const siblings = getSiblingChapters(ch.parentId);
    const index = siblings.findIndex(item => item.id === ch.id);
    const prev = index > 0 ? siblings[index - 1] : null;
    const next = index >= 0 && index < siblings.length - 1 ? siblings[index + 1] : null;
    const children = getSortedChapterChildren(ch.id);
    const firstChildStart = children.length > 0 ? children[0].startTime : Number.POSITIVE_INFINITY;
    const lastChildEnd = children.length > 0 ? Math.max(...children.map(child => child.endTime)) : Number.NEGATIVE_INFINITY;

    const startMin = prev?.endTime ?? scope.startTime;
    const endMax = next?.startTime ?? scope.endTime;
    const startMax = Math.max(
      startMin,
      Math.min(ch.endTime - MIN_CHAPTER_DURATION, endMax - MIN_CHAPTER_DURATION, firstChildStart)
    );
    const endMin = Math.min(endMax, Math.max(ch.startTime + MIN_CHAPTER_DURATION, startMin + MIN_CHAPTER_DURATION, lastChildEnd));

    return { startMin, startMax, endMin, endMax };
  }

  function normalizeChapterFormRange(ch: Chapter) {
    const bounds = getChapterTimeInputBounds(ch);
    let startTime = clampNumber(chForm.startTime, bounds.startMin, bounds.startMax);
    let endTime = clampNumber(chForm.endTime, Math.max(bounds.endMin, startTime + MIN_CHAPTER_DURATION), bounds.endMax);

    if (endTime - startTime < MIN_CHAPTER_DURATION) {
      startTime = clampNumber(endTime - MIN_CHAPTER_DURATION, bounds.startMin, bounds.startMax);
      endTime = clampNumber(startTime + MIN_CHAPTER_DURATION, bounds.endMin, bounds.endMax);
    }

    return { startTime, endTime };
  }

  function normalizeChapterSiblingRanges(parentId: string | undefined, scopeStart: number, scopeEnd: number) {
    const siblings = getSiblingChapters(parentId);
    if (siblings.length === 0) return;

    const availableDuration = scopeEnd - scopeStart;
    if (availableDuration < MIN_CHAPTER_DURATION - CHAPTER_TIME_EPS) return;

    let cursor = scopeStart;
    siblings.forEach((sibling, index) => {
      const remainingSlots = siblings.length - index - 1;
      const latestEnd = scopeEnd - remainingSlots * MIN_CHAPTER_DURATION;
      if (latestEnd - cursor < MIN_CHAPTER_DURATION - CHAPTER_TIME_EPS) return;

      let desiredDuration = Math.max(sibling.endTime - sibling.startTime, MIN_CHAPTER_DURATION);
      const isSingleFullRangeChild =
        !!parentId &&
        siblings.length === 1 &&
        sibling.startTime <= scopeStart + CHAPTER_TIME_EPS &&
        sibling.endTime >= scopeEnd - CHAPTER_TIME_EPS &&
        availableDuration >= MIN_CHAPTER_DURATION * 2 - CHAPTER_TIME_EPS;

      if (isSingleFullRangeChild) {
        desiredDuration = getDefaultChapterSegmentDuration(availableDuration) || desiredDuration;
      }

      const endTime = clampNumber(cursor + desiredDuration, cursor + MIN_CHAPTER_DURATION, latestEnd);
      if (Math.abs(sibling.startTime - cursor) > CHAPTER_TIME_EPS || Math.abs(sibling.endTime - endTime) > CHAPTER_TIME_EPS) {
        chStore.updateChapter(sibling, { startTime: cursor, endTime });
      }

      normalizeChapterSiblingRanges(sibling.id, cursor, endTime);
      cursor = endTime;
    });
  }

  function normalizeProjectChapterRanges() {
    const dur = currProj.value?.videoDuration || duration.value;
    if (!currProj.value || dur <= 0 || chapters.value.length === 0) return;
    normalizeChapterSiblingRanges(undefined, 0, dur);
  }

  function onMeta(e: Event) {
    const v = e.target as HTMLVideoElement;
    if (currProj.value) {
      currProj.value.videoDuration = v.duration;
      currProj.value.videoWidth = v.videoWidth;
      currProj.value.videoHeight = v.videoHeight;
    }
    duration.value = v.duration;
    v.loop = isLooping.value;
    v.playbackRate = playbackRate.value;
    ensureDefaultChapter(v.duration);
    // 检测 FPS
    try {
      const track = (v as any).captureStream ? (v as any).captureStream().getVideoTracks()[0] : null;
      if (track) {
        const settings = track.getSettings();
        videoFps.value = Math.round(settings.frameRate || 0);
      }
    } catch {
      /* ignore */
    }
    if (!videoFps.value) {
      let fc = 0;
      let last = performance.now();
      const cb = () => {
        fc++;
        if (fc >= 30) {
          videoFps.value = Math.round(fc / ((performance.now() - last) / 1000));
          return;
        }
        requestAnimationFrame(cb);
      };
      requestAnimationFrame(cb);
    }
  }

  function onTick(e: Event) {
    const v = e.target as HTMLVideoElement;
    currentTime.value = v.currentTime;

    const playTarget = chapterPlayTarget.value;
    if (playTarget && v.currentTime >= playTarget.endTime - CHAPTER_END_EPS) {
      v.pause();
      v.currentTime = playTarget.endTime;
      currentTime.value = playTarget.endTime;
      chapterPlayTarget.value = null;

      if (chapterAutoNext.value) {
        const ci = getTimelineChapterIndex(playTarget);
        const next = ci >= 0 ? timelineChapters.value[ci + 1] : null;
        if (next) {
          // 继续顺序播放下一节点
          void startChapterPlayback(next);
        } else {
          chapterAutoNext.value = false;
        }
      }
    }

    const ci = findChIdx(v.currentTime);
    const locked = chapterNavLock.value || chapterPlayTarget.value;

    if (locked) {
      syncPausedChapterAnimation(v, ci);
      syncChapterSubtitle(v);
      return;
    }

    if (ci !== playingIdx.value) {
      playingIdx.value = ci;
      if (ci >= 0) {
        const ch = timelineChapters.value[ci];
        const selected = chapters.value.find(c => c.id === selectedChapterId.value);
        const keepChildSelection = !!(selected?.parentId && isChapterInPlaybackRange(selected, v.currentTime));
        if (!keepChildSelection && ch.id !== selectedChapterId.value) {
          _chAnimLock = false;
          selectedChapterId.value = ch.id;
          applyChapter(ch);
          syncChapterForm(ch);
          syncModelSelectionForChapter(ch);
          if (!v.paused) ensureVideoSyncedChapterAnimation();
        }
      }
    }

    syncPausedChapterAnimation(v, ci);
    syncChapterSubtitle(v);
    syncIntroPresentation();
  }

  function onVideoEnd() {
    isPlaying.value = false;
    stopChapterAnimation();
    syncIntroPresentation();
  }

  function onVideoErr() {
    toastShow("视频加载失败，请检查文件或CORS设置", "error");
  }

  // Subtitle animation
  let subTimer: any = null;
  let subIdx = 0;
  let subFull = "";
  let activeSubId: string | null = null;
  function applySubtitleElementStyle(el: HTMLElement, s: Pick<Subtitle, "color" | "backgroundColor">) {
    el.style.color = s.color;
    el.style.backgroundColor = s.backgroundColor ?? SUBTITLE_DEFAULT_BACKGROUND;
  }

  function showSubtitle(s: Subtitle) {
    if (!subEl.value) return;
    const aid = s.id;
    if (s.displayMode === "typewriter") {
      if (aid !== activeSubId) {
        clearInterval(subTimer);
        activeSubId = aid;
        subIdx = 0;
        subFull = s.text;
        subEl.value.textContent = "";
        applySubtitleElementStyle(subEl.value, s);
        displaySubtitle.value = true;
        subTimer = setInterval(() => {
          subIdx++;
          if (subEl.value) subEl.value.textContent = subFull.slice(0, subIdx);
          if (subIdx >= subFull.length) {
            clearInterval(subTimer);
            subTimer = null;
          }
        }, 80);
      }
    } else {
      if (aid !== activeSubId) {
        clearInterval(subTimer);
        activeSubId = aid;
        subEl.value.textContent = s.text;
        applySubtitleElementStyle(subEl.value, s);
        displaySubtitle.value = true;
        subEl.value.classList.remove("sub-fade");
        void subEl.value.offsetWidth;
        subEl.value.classList.add("sub-fade");
      }
    }
  }

  // ── Actions ──
  const { fmt, pct, fillScale, chapterFillPct, chapterSegmentFlex, chapterSegmentStyle } = createTimelineHelpers(
    duration,
    currentTime,
    timelineChapters
  );

  function uploadVideo(file: File) {
    if (!currProj.value) return false;
    const url = URL.createObjectURL(file);
    resetChaptersForNewVideo();
    pStore.setVideoInfo(url, 0, 0, 0);
    toastShow("视频已导入");
    syncVideoElementSrc(url);
    void tryLoadPendingModelSet();
    return false;
  }

  function syncVideoAudioState() {
    const video = videoEl.value;
    if (!video) return;
    video.muted = false;
    video.volume = 1;
  }

  function syncVideoElementSrc(src?: string) {
    const url = src || videoSrc.value;
    if (!url) return;
    const resolvedUrl = isCoarsePointerDevice() ? withVideoPosterFragment(url) : url;
    const apply = () => {
      if (!videoEl.value) return false;
      videoEl.value.preload = "metadata";
      videoEl.value.src = resolvedUrl;
      if (url.startsWith("http")) videoEl.value.setAttribute("crossorigin", "anonymous");
      videoEl.value.loop = isLooping.value;
      videoEl.value.playbackRate = playbackRate.value;
      syncVideoAudioState();
      if (!isCoarsePointerDevice()) videoEl.value.load();
      return true;
    };
    if (apply()) return;
    nextTick(() => apply());
  }

  function removeVideo() {
    ElMessageBox.confirm("移除视频将清除所有节点数据和已导入的模型", "警告", { type: "warning" })
      .then(() => {
        // 1. 清除项目数据
        if (currProj.value) {
          currProj.value.videoSrc = null;
          currProj.value.videoDuration = 0;
          currProj.value.videoWidth = 0;
          currProj.value.videoHeight = 0;
          currProj.value.chapters = [];
          currProj.value.subtitles = [];
          currProj.value.models = [];
        }

        // 2. 清除 Three.js 场景中所有模型和边缘线
        meshes.forEach(obj => {
          scene.remove(obj);
          obj.traverse((child: any) => {
            if (child.geometry) child.geometry.dispose();
            if (child.material) {
              if (Array.isArray(child.material)) child.material.forEach((m: any) => m.dispose());
              else child.material.dispose();
            }
          });
        });
        meshes.clear();

        // 3. 清除动画混合器
        mixers.forEach(m => m.stopAllAction());
        mixers = [];

        // 4. 清除场景中残留的 LineSegments
        const lines: THREE.Object3D[] = [];
        scene.traverse(c => {
          if (c.type === "LineSegments" || c.type === "Line") lines.push(c);
        });
        lines.forEach(c => {
          if (c.parent) c.parent.remove(c);
        });

        // 5. 重置计时/播放状态
        duration.value = 0;
        currentTime.value = 0;
        isPlaying.value = false;
        isLooping.value = true;
        playingIdx.value = -1;
        selectedChapterId.value = null;
        selModelId.value = null;
        lastSelModelId = null;
        showVideoPip.value = true;
        videoFps.value = 0;

        // 6. 重置相机到默认位置
        camera.position.set(...DEFAULT_CAMERA.position);
        controls.target.set(...DEFAULT_CAMERA.target);
        controls.update();

        // 7. 重置相机 UI 控件
        camP.splice(0, 3, ...DEFAULT_CAMERA.position);
        camT.splice(0, 3, ...DEFAULT_CAMERA.target);
        camFov.value = DEFAULT_CAMERA.fov;

        // 8. 重置动画编辑状态
        animSegments.splice(0);
        mdTab.value = "props";

        // 9. 重置模型属性面板
        mVis.value = true;
        mOut.value = false;
        mHL.value = false;
        mAni.value = true;
        mScl.value = 1;
        mRot.splice(0, 3, 0, 0, 0);
        mHLColor.value = "#00ff00";
        mIntro.value = "";
        modelIntroLabels.value = [];

        toastShow("已重置，可以重新开始");
      })
      .catch(() => {});
  }

  function onDragOver(e) {
    isDragOver.value = true;
  }
  function onDragLeave(e) {
    isDragOver.value = false;
  }
  function onVideoDrop(e) {
    isDragOver.value = false;
    const files = e.dataTransfer?.files;
    if (files && files.length > 0) uploadVideo(files[0]);
  }
  function triggerVideoUpload() {
    fileInputEl.value?.click();
  }
  function onVideoFileChange(e) {
    const input = e.target;
    const file = input.files?.[0];
    if (file) {
      uploadVideo(file);
      input.value = "";
    }
  }
  function loadRemoteVideo() {
    const url = remoteUrl.value.trim();
    if (!url) {
      toastShow("请输入视频链接", "warning");
      return;
    }
    let re = new RegExp("^https?://.+");
    if (!re.test(url)) {
      toastShow("请输入有效的 HTTP/HTTPS 链接", "warning");
      return;
    }
    if (!currProj.value) return;
    resetChaptersForNewVideo();
    pStore.setVideoInfo(url, 0, 0, 0);
    toastShow("正在加载在线视频...", "success");
    syncVideoElementSrc(url);
  }
  function showPlaybackHint() {
    playbackHintVisible.value = true;
    playbackHintFading.value = false;
    if (playbackHintTimer) clearTimeout(playbackHintTimer);
    if (playbackHintFadeTimer) clearTimeout(playbackHintFadeTimer);
    playbackHintTimer = setTimeout(() => {
      playbackHintFading.value = true;
      playbackHintFadeTimer = setTimeout(() => {
        playbackHintVisible.value = false;
        playbackHintFading.value = false;
      }, 300);
    }, 500);
  }

  function togglePlay() {
    if (!videoEl.value) return;
    if (videoEl.value.paused) {
      chapterPlayTarget.value = null;
      videoEl.value.play().catch(() => {});
    } else {
      chapterPlayTarget.value = null;
      videoEl.value.pause();
    }
    if (!viewOnly.value && !isPreviewMode.value) showPlaybackHint();
  }

  function onVideoPlay() {
    isPlaying.value = true;
    ensureVideoSyncedChapterAnimation();
    syncIntroPresentation();
  }

  function onVideoPause() {
    isPlaying.value = false;
    stopChapterAnimation();
    syncCurrentChapterAnimationFromVideo();
    syncIntroPresentation();
  }

  function cyclePlaybackRate() {
    const idx = PLAYBACK_RATES.indexOf(playbackRate.value as (typeof PLAYBACK_RATES)[number]);
    playbackRate.value = PLAYBACK_RATES[(idx + 1) % PLAYBACK_RATES.length];
    if (videoEl.value) videoEl.value.playbackRate = playbackRate.value;
  }

  // ── Animation Helpers (运动段) ──

  function getDefaultTransformForAnimTarget(model: Model, nodeId: string | null) {
    const isRoot = !nodeId;
    const o = getTransformTarget(model.id, nodeId);
    if (!o) {
      const bp = isRoot ? model.basePosition || DEFAULT_MODEL_BASE_POSITION : [0, 0, 0];
      return { pos: [...bp], scale: 1, rot: [0, 0, 0] };
    }
    if (isRoot) {
      const bp = o.userData.basePos || model.basePosition || DEFAULT_MODEL_BASE_POSITION;
      return { pos: [roundAnimNum(bp[0]), roundAnimNum(bp[1]), roundAnimNum(bp[2])], scale: 1, rot: [0, 0, 0] };
    }
    const bp = o.userData.baseLocalPos || [0, 0, 0];
    const br = o.userData.baseLocalRot || [0, 0, 0];
    const bs = o.userData.baseLocalScale ?? 1;
    return {
      pos: [roundAnimNum(bp[0]), roundAnimNum(bp[1]), roundAnimNum(bp[2])],
      scale: roundAnimNum(bs),
      rot: [roundAnimNum((br[0] * 180) / Math.PI), roundAnimNum((br[1] * 180) / Math.PI), roundAnimNum((br[2] * 180) / Math.PI)]
    };
  }

  function createDefaultAnimSegment(model?: Model | null) {
    const m = model ?? selModel.value;
    const { pos, scale, rot } = m
      ? getDefaultTransformForAnimTarget(m, selModelNodeId.value)
      : { pos: [...DEFAULT_MODEL_BASE_POSITION], scale: 1, rot: [0, 0, 0] };
    return {
      id: nextAnimSegmentId(),
      pauseTime: 0,
      animTime: 3,
      easing: "easeInOut",
      pivot: "center",
      startPos: [...pos],
      endPos: [...pos],
      startScale: scale,
      endScale: scale,
      startRot: [...rot],
      endRot: [...rot],
      _expandedPanels: ["start", "end"] as string[]
    };
  }

  function ensureSingleAnimSegment(model?: Model | null) {
    if (animSegments.length === 0) {
      animSegments.push(createDefaultAnimSegment(model));
    } else if (animSegments.length > 1) {
      animSegments.splice(0, animSegments.length, animSegments[0]);
    }
    const seg = animSegments[0];
    if (seg) {
      if (!seg._expandedPanels) seg._expandedPanels = ["start", "end"];
    }
    recalcAnimDuration();
  }

  function resolvePlaybackSegments(segments: any[]) {
    return segments?.length ? [segments[0]] : [];
  }

  function markAnimDirty() {
    animDirty.value = true;
  }

  function resetAnimConfig() {
    if (!selModel.value) return;
    animSegments.splice(0, animSegments.length, createDefaultAnimSegment(selModel.value));
    animDuration.value = 3;
    animEasing.value = "easeInOut";
    animDirty.value = true;
    modelFormRevision.value++;
  }

  function recalcAnimDuration() {
    let total = 0;
    for (let s = 0; s < animSegments.length; s++) {
      total += (animSegments[s].pauseTime || 0) + (animSegments[s].animTime || 3);
    }
    if (total > 0) animDuration.value = total;
  }
  function saveAnimConfig() {
    if (!selectedChapter.value || !selModel.value) return;
    const cfg = getActiveModelConfig(selectedChapter.value);
    recalcAnimDuration();
    cfg.animConfig = {
      duration: animDuration.value,
      easing: animEasing.value,
      segments: animSegments.slice(0, 1).map(s => ({
        id: s.id,
        pauseTime: s.pauseTime || 0,
        animTime: s.animTime || 3,
        easing: s.easing || animEasing.value,
        pivot: s.pivot || "center",
        startPos: [...s.startPos],
        endPos: [...s.endPos],
        startScale: s.startScale,
        endScale: s.endScale,
        startRot: [...s.startRot],
        endRot: [...s.endRot]
      }))
    } as any;
    cfg.animation = true;
    mAni.value = true;
    animDirty.value = false;
    toastShow(selModelNodeId.value ? "子层级动画已保存" : "动画已保存");
  }

  function refreshActiveHighlightOutline() {
    const m = selModel.value;
    const ch = getActiveChapter();
    if (!m || !ch) return;
    const cfg = getActiveModelConfig(ch);
    if (!cfg.highlight && !cfg.outline) return;
    for (const target of getNodeObjects(m.id, selModelNodeId.value, true)) {
      rebuildOutlineForObject(m, target, cfg);
    }
  }

  function playSegOnce(seg: any) {
    if (seg._playing) return;
    seg._playing = true;
    seg._progress = 0;
    let m = selModel.value;
    if (!m) {
      seg._playing = false;
      return;
    }
    refreshActiveHighlightOutline();
    let o = getTransformTarget(m.id, selModelNodeId.value);
    if (!o) {
      seg._playing = false;
      return;
    }
    // Start from seg.startPos — rotation values are in DEGREES (applyPivotRotation converts)
    let sp = { x: seg.startPos[0], y: seg.startPos[1], z: seg.startPos[2] };
    let ss = seg.startScale;
    let sr = { x: seg.startRot[0], y: seg.startRot[1], z: seg.startRot[2] };
    let ep = { x: seg.endPos[0], y: seg.endPos[1], z: seg.endPos[2] };
    let es = seg.endScale;
    let er = { x: seg.endRot[0], y: seg.endRot[1], z: seg.endRot[2] };
    let dur = (seg.animTime || 3) * 1000;
    let easingType = seg.easing || animEasing.value;
    // Pre-compute pivot path correction for non-center pivot
    let pivot = seg.pivot || "center";
    let pivotCache: any = null;
    if (pivot !== "center") {
      let sp2 = o.position.clone();
      let sq2 = o.quaternion.clone();
      o.position.set(0, 0, 0);
      o.quaternion.identity();
      o.updateMatrixWorld(true);
      let bbox = calcModelBBox(o);
      o.position.copy(sp2);
      o.quaternion.copy(sq2);
      o.updateMatrixWorld(true);
      if (bbox.min.x !== Infinity) {
        let gc = new THREE.Vector3();
        bbox.getCenter(gc);
        let pl = getPivotLocal(bbox, pivot);
        let L = gc.add(pl);
        let sRad = [(sr.x * Math.PI) / 180, (sr.y * Math.PI) / 180, (sr.z * Math.PI) / 180];
        let eRad = [(er.x * Math.PI) / 180, (er.y * Math.PI) / 180, (er.z * Math.PI) / 180];
        let sq_ = new THREE.Quaternion().setFromEuler(new THREE.Euler(sRad[0], sRad[1], sRad[2]));
        let eq_ = new THREE.Quaternion().setFromEuler(new THREE.Euler(eRad[0], eRad[1], eRad[2]));
        pivotCache = {
          L: L.clone(),
          startOffset: L.clone().applyQuaternion(sq_),
          endOffset: L.clone().applyQuaternion(eq_)
        };
      }
    }
    let st = performance.now();
    function tick() {
      try {
        let el = performance.now() - st;
        let t = Math.min(el / dur, 1);
        seg._progress = t;
        let ep2 = applyEasingInline(t, easingType);
        let midPos = [sp.x + (ep.x - sp.x) * ep2, sp.y + (ep.y - sp.y) * ep2, sp.z + (ep.z - sp.z) * ep2];
        let midRot = [sr.x + (er.x - sr.x) * ep2, sr.y + (er.y - sr.y) * ep2, sr.z + (er.z - sr.z) * ep2];
        if (pivotCache) {
          let rad = [(midRot[0] * Math.PI) / 180, (midRot[1] * Math.PI) / 180, (midRot[2] * Math.PI) / 180];
          let cq = new THREE.Quaternion().setFromEuler(new THREE.Euler(rad[0], rad[1], rad[2]));
          let curOff = pivotCache.L.clone().applyQuaternion(cq);
          let interpOff = new THREE.Vector3().copy(pivotCache.startOffset).lerp(pivotCache.endOffset, ep2);
          o.position.set(
            midPos[0] + interpOff.x - curOff.x,
            midPos[1] + interpOff.y - curOff.y,
            midPos[2] + interpOff.z - curOff.z
          );
          o.quaternion.copy(cq);
        } else {
          applyPivotRotation(o, midPos, midRot, pivot);
        }
        syncTransformVisualOverlays();
        if (t >= 1) {
          seg._progress = 1;
          seg._playing = false;
          return;
        }
      } catch (e) {
        seg._playing = false;
        return;
      }
      requestAnimationFrame(tick);
    }
    tick();
  }
  function getSegPivotCache(seg: any, mesh: any): any {
    if (seg._animPivotCache) return seg._animPivotCache;
    let pivot = seg.pivot || "center";
    if (pivot === "center") {
      seg._animPivotCache = { center: true };
      return seg._animPivotCache;
    }
    let sp = mesh.position.clone();
    let sq = mesh.quaternion.clone();
    mesh.position.set(0, 0, 0);
    mesh.quaternion.identity();
    mesh.updateMatrixWorld(true);
    let bbox = calcModelBBox(mesh);
    mesh.position.copy(sp);
    mesh.quaternion.copy(sq);
    mesh.updateMatrixWorld(true);
    if (bbox.min.x === Infinity) {
      seg._animPivotCache = { center: true };
      return seg._animPivotCache;
    }
    let gc = new THREE.Vector3();
    bbox.getCenter(gc);
    let pl = getPivotLocal(bbox, pivot);
    let L = gc.add(pl);
    let sRad = [(seg.startRot[0] * Math.PI) / 180, (seg.startRot[1] * Math.PI) / 180, (seg.startRot[2] * Math.PI) / 180];
    let eRad = [(seg.endRot[0] * Math.PI) / 180, (seg.endRot[1] * Math.PI) / 180, (seg.endRot[2] * Math.PI) / 180];
    let sq_ = new THREE.Quaternion().setFromEuler(new THREE.Euler(sRad[0], sRad[1], sRad[2]));
    let eq_ = new THREE.Quaternion().setFromEuler(new THREE.Euler(eRad[0], eRad[1], eRad[2]));
    seg._animPivotCache = {
      L: L.clone(),
      startOffset: L.clone().applyQuaternion(sq_),
      endOffset: L.clone().applyQuaternion(eq_)
    };
    return seg._animPivotCache;
  }
  function applyPivotPathFrame(o: any, midPos: number[], midRot: number[], pivotCache: any, ep2: number) {
    if (!pivotCache || pivotCache.center) {
      applyPivotRotation(o, midPos, midRot, "center");
      return;
    }
    let rad = [(midRot[0] * Math.PI) / 180, (midRot[1] * Math.PI) / 180, (midRot[2] * Math.PI) / 180];
    let cq = new THREE.Quaternion().setFromEuler(new THREE.Euler(rad[0], rad[1], rad[2]));
    let curOff = pivotCache.L.clone().applyQuaternion(cq);
    let interpOff = new THREE.Vector3().copy(pivotCache.startOffset).lerp(pivotCache.endOffset, ep2);
    o.position.set(midPos[0] + interpOff.x - curOff.x, midPos[1] + interpOff.y - curOff.y, midPos[2] + interpOff.z - curOff.z);
    o.quaternion.copy(cq);
  }
  function playAllSegments() {
    if (totalPlaying.value) return;
    totalPlaying.value = true;
    totalProgress.value = 0;
    let totalDur = 0;
    let times: number[] = [];
    for (let s = 0; s < animSegments.length; s++) {
      totalDur += (animSegments[s].pauseTime || 0) + (animSegments[s].animTime || 3);
      times.push(totalDur);
    }
    let m = selModel.value;
    if (!m) {
      totalPlaying.value = false;
      return;
    }
    refreshActiveHighlightOutline();
    let o = getTransformTarget(m.id, selModelNodeId.value);
    if (!o) {
      totalPlaying.value = false;
      return;
    }
    // Set initial position to first seg start
    let first = animSegments[0];
    o.position.set(first.startPos[0], first.startPos[1], first.startPos[2]);
    o.scale.setScalar(first.startScale);
    o.rotation.set((first.startRot[0] * Math.PI) / 180, (first.startRot[1] * Math.PI) / 180, (first.startRot[2] * Math.PI) / 180);
    // Pre-compute pivot cache for all segments
    for (let si = 0; si < animSegments.length; si++) getSegPivotCache(animSegments[si], o);
    let st = performance.now();
    function tick() {
      let el = performance.now() - st;
      let t = Math.min(el / (totalDur * 1000), 1);
      let absT = t * totalDur;
      let cumT = 0;
      for (let s = 0; s < animSegments.length; s++) {
        let seg = animSegments[s];
        let segTotal = (seg.pauseTime || 0) + (seg.animTime || 3);
        if (absT >= cumT && absT <= cumT + segTotal) {
          let localT = absT - cumT;
          let pauseT = seg.pauseTime || 0;
          let pc = seg._animPivotCache;
          if (localT < pauseT) {
            // Pausing - stay at start
            applyPivotPathFrame(
              o,
              [seg.startPos[0], seg.startPos[1], seg.startPos[2]],
              [seg.startRot[0], seg.startRot[1], seg.startRot[2]],
              pc,
              0
            );
          } else {
            let animT = (localT - pauseT) / (seg.animTime || 3);
            let ep2 = applyEasingInline(Math.min(1, animT), seg.easing || animEasing.value);
            let animPos = [
              seg.startPos[0] + (seg.endPos[0] - seg.startPos[0]) * ep2,
              seg.startPos[1] + (seg.endPos[1] - seg.startPos[1]) * ep2,
              seg.startPos[2] + (seg.endPos[2] - seg.startPos[2]) * ep2
            ];
            let animRot = [
              seg.startRot[0] + (seg.endRot[0] - seg.startRot[0]) * ep2,
              seg.startRot[1] + (seg.endRot[1] - seg.startRot[1]) * ep2,
              seg.startRot[2] + (seg.endRot[2] - seg.startRot[2]) * ep2
            ];
            applyPivotPathFrame(o, animPos, animRot, pc, ep2);
          }
          break;
        }
        cumT += segTotal;
      }
      syncTransformVisualOverlays();
      if (t >= 1) {
        // Set final state
        let last = animSegments[animSegments.length - 1];
        let lpc = last._animPivotCache;
        applyPivotPathFrame(
          o,
          [last.endPos[0], last.endPos[1], last.endPos[2]],
          [last.endRot[0], last.endRot[1], last.endRot[2]],
          lpc,
          1
        );
        totalPlaying.value = false;
        return;
      }
      totalProgress.value = t;
      requestAnimationFrame(tick);
    }
    tick();
  }
  function playSegment(seg: any) {
    let m = selModel.value;
    if (!m) return;
    let o = getTransformTarget(m.id, selModelNodeId.value);
    if (!o) return;
    // Animate to end state
    let sp = { x: o.position.x, y: o.position.y, z: o.position.z };
    let ss = o.scale.x;
    let sr = { x: o.rotation.x, y: o.rotation.y, z: o.rotation.z };
    let ep = { x: seg.endPos[0], y: seg.endPos[1], z: seg.endPos[2] };
    let es = seg.endScale;
    let er = { x: (seg.endRot[0] * Math.PI) / 180, y: (seg.endRot[1] * Math.PI) / 180, z: (seg.endRot[2] * Math.PI) / 180 };
    let dur = (seg.animTime || 3) * 1000;
    let easingType = seg.easing || animEasing.value;
    let st = performance.now();
    function tick() {
      let el = performance.now() - st;
      let t = Math.min(el / dur, 1);
      let ep2 = applyEasingInline(t, easingType);
      o.position.set(sp.x + (ep.x - sp.x) * ep2, sp.y + (ep.y - sp.y) * ep2, sp.z + (ep.z - sp.z) * ep2);
      o.scale.setScalar(ss + (es - ss) * ep2);
      o.rotation.set(sr.x + (er.x - sr.x) * ep2, sr.y + (er.y - sr.y) * ep2, sr.z + (er.z - sr.z) * ep2);
      if (t < 1) requestAnimationFrame(tick);
    }
    tick();
  }
  function applyEasingInline(t: number, type: string): number {
    switch (type) {
      case "linear":
        return t;
      case "easeIn":
        return t * t;
      case "easeOut":
        return t * (2 - t);
      case "easeInOut":
        return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
      case "bounce": {
        if (t < 1 / 2.75) return 7.5625 * t * t;
        if (t < 2 / 2.75) {
          t -= 1.5 / 2.75;
          return 7.5625 * t * t + 0.75;
        }
        if (t < 2.5 / 2.75) {
          t -= 2.25 / 2.75;
          return 7.5625 * t * t + 0.9375;
        }
        t -= 2.625 / 2.75;
        return 7.5625 * t * t + 0.984375;
      }
      case "elastic": {
        if (t === 0 || t >= 1) return t;
        return Math.pow(2, -10 * t) * Math.sin(((t - 0.075) * (2 * Math.PI)) / 0.3) + 1;
      }
      default:
        return t;
    }
  }
  function syncSegToMesh(seg: any, mesh: any, mode?: string) {
    // Sync seg pos to mesh's current world position (pos IS the mesh position).
    // mode="start"/"end" = only that mode; undefined = update both.
    if (!mesh) return;
    let p = mesh.position;
    let pos = [p.x, p.y, p.z];
    if (mode === "start") {
      seg.startPos = pos;
    } else if (mode === "end") {
      seg.endPos = pos;
    } else {
      seg.startPos = pos;
      seg.endPos = pos;
    }
  }
  function focusSegTransform(seg: any, mode: "start" | "end") {
    editingSeg.value = seg;
    editingSegMode.value = mode;
    if (selModel.value) {
      showPivotHelpers(selModel.value.id, seg);
      updateActivePivotHelper(selModel.value.id);
    }
  }
  function calcModelBBox(mesh: any): THREE.Box3 {
    let bbox = new THREE.Box3();
    let first = true;
    mesh.traverse(function (child: any) {
      if (child.isMesh && child.geometry && child.geometry.attributes.position) {
        let pos = child.geometry.attributes.position;
        let arr = pos.array;
        let localBox = new THREE.Box3();
        let v = new THREE.Vector3();
        let w = new THREE.Vector3();
        for (let i = 0; i < arr.length; i += 3) {
          v.set(arr[i], arr[i + 1], arr[i + 2]);
          v.applyMatrix4(child.matrixWorld);
          if (first) {
            localBox.min.copy(v);
            localBox.max.copy(v);
            first = false;
          } else localBox.expandByPoint(v);
        }
        bbox.expandByPoint(localBox.min);
        bbox.expandByPoint(localBox.max);
      }
    });
    return bbox;
  }

  function getPivotLocal(bbox: THREE.Box3, pivotType: string): THREE.Vector3 {
    let geoCenter = new THREE.Vector3();
    bbox.getCenter(geoCenter);
    let pl = new THREE.Vector3();
    if (pivotType !== "center") {
      switch (pivotType) {
        case "top":
          pl.set(0, bbox.max.y - geoCenter.y, 0);
          break;
        case "bottom":
          pl.set(0, bbox.min.y - geoCenter.y, 0);
          break;
        case "left":
          pl.set(bbox.min.x - geoCenter.x, 0, 0);
          break;
        case "right":
          pl.set(bbox.max.x - geoCenter.x, 0, 0);
          break;
        case "front":
          pl.set(0, 0, bbox.max.z - geoCenter.z);
          break;
        case "back":
          pl.set(0, 0, bbox.min.z - geoCenter.z);
          break;
      }
    }
    return pl;
  }
  function applyPivotRotation(mesh: any, pos: number[], rot: number[], pivotType: string, scaleVal?: number) {
    // pos = mesh world position. Rotation centering handled by onRotChange.
    let rad = [(rot[0] * Math.PI) / 180, (rot[1] * Math.PI) / 180, (rot[2] * Math.PI) / 180];
    if (scaleVal !== undefined) mesh.scale.setScalar(scaleVal);
    mesh.position.set(pos[0], pos[1], pos[2]);
    mesh.rotation.set(rad[0], rad[1], rad[2]);
  }
  function onPivotChange(seg: any, mode: "start" | "end" = editingSegMode.value) {
    if (!selModel.value) return;
    focusSegTransform(seg, mode);
    liveSeg(seg, mode);
  }
  function onRotChange(seg: any, mode: "start" | "end" = editingSegMode.value) {
    // Rotation with non-center pivot: adjust mesh position so rotation appears around pivot
    if (!selModel.value) return;
    let mesh = getTransformTarget(selModel.value.id, selModelNodeId.value);
    if (!mesh) return;
    let pivotType = seg.pivot || "center";
    if (pivotType === "center") {
      liveSeg(seg, mode);
      return;
    }
    // Save old transform
    let oldPos = mesh.position.clone();
    let oldQuat = mesh.quaternion.clone();
    // Get new rotation from seg (already updated by v-model)
    let rot = mode === "start" ? seg.startRot : seg.endRot;
    let rad = [(rot[0] * Math.PI) / 180, (rot[1] * Math.PI) / 180, (rot[2] * Math.PI) / 180];
    let newQuat = new THREE.Quaternion().setFromEuler(new THREE.Euler(rad[0], rad[1], rad[2]));
    // Compute bbox at identity for pivot calculation
    let sp = mesh.position.clone();
    let sq = mesh.quaternion.clone();
    mesh.position.set(0, 0, 0);
    mesh.quaternion.identity();
    mesh.updateMatrixWorld(true);
    let bbox = calcModelBBox(mesh);
    mesh.position.copy(sp);
    mesh.quaternion.copy(sq);
    mesh.updateMatrixWorld(true);
    if (bbox.min.x !== Infinity) {
      let geoCenter = new THREE.Vector3();
      bbox.getCenter(geoCenter);
      let pivotLocal = getPivotLocal(bbox, pivotType);
      let L = new THREE.Vector3().copy(geoCenter).add(pivotLocal);
      let oldOff = L.clone().applyQuaternion(oldQuat);
      let newOff = L.clone().applyQuaternion(newQuat);
      // newPos = oldPos + oldOff - newOff  (pivot stays fixed in world)
      mesh.position.copy(oldPos).add(oldOff).sub(newOff);
    }
    mesh.quaternion.copy(newQuat);
    // Update seg pos to reflect pivot-adjusted mesh position
    let np = [mesh.position.x, mesh.position.y, mesh.position.z];
    if (mode === "start") seg.startPos = np;
    else seg.endPos = np;
    updateActivePivotHelper(selModel.value.id);
  }
  function liveSeg(seg: any, mode: "start" | "end" = editingSegMode.value) {
    const m = selModel.value;
    if (!m) return;
    const objs = getNodeObjects(m.id, selModelNodeId.value);
    if (!objs.length) return;
    const pos = mode === "start" ? seg.startPos : seg.endPos;
    const rot = mode === "start" ? seg.startRot : seg.endRot;
    const scale = mode === "start" ? seg.startScale : seg.endScale;
    for (const o of objs) {
      applyPivotRotation(o, pos, rot, seg.pivot || "center", scale);
    }
    updateActivePivotHelper(m.id);
  }

  const PIVOT_COLORS: Record<string, number> = {
    center: 0x00ff00,
    top: 0xff0000,
    bottom: 0x0000ff,
    left: 0xff8800,
    right: 0x88ff00,
    front: 0x00ffff,
    back: 0xff00ff
  };
  const pivotHelpers = new Map<string, THREE.Object3D[]>();
  function showPivotHelpers(modelId: string, seg?: any) {
    hidePivotHelpers(modelId);
    const mesh = getTransformTarget(modelId, selModelId.value === modelId ? selModelNodeId.value : null);
    if (!mesh) return;
    let pivotType = seg?.pivot || editingSeg.value?.pivot || "center";
    let sp = mesh.position.clone();
    let sq = mesh.quaternion.clone();
    mesh.position.set(0, 0, 0);
    mesh.quaternion.identity();
    mesh.updateMatrixWorld(true);
    const bbox = calcModelBBox(mesh);
    mesh.position.copy(sp);
    mesh.quaternion.copy(sq);
    mesh.updateMatrixWorld(true);
    if (bbox.min.x === Infinity || bbox.max.x === -Infinity) return;
    const ctr = new THREE.Vector3();
    bbox.getCenter(ctr);
    let localPt = new THREE.Vector3(ctr.x, ctr.y, ctr.z);
    switch (pivotType) {
      case "top":
        localPt.y = bbox.max.y;
        break;
      case "bottom":
        localPt.y = bbox.min.y;
        break;
      case "left":
        localPt.x = bbox.min.x;
        break;
      case "right":
        localPt.x = bbox.max.x;
        break;
      case "front":
        localPt.z = bbox.max.z;
        break;
      case "back":
        localPt.z = bbox.min.z;
        break;
    }
    let worldPt = localPt.clone().applyQuaternion(mesh.quaternion).add(mesh.position);
    // Smaller pivot indicator so it doesn't block the model
    let sphere = new THREE.Mesh(
      new THREE.SphereGeometry(PIVOT_HELPER_RADIUS, 8, 8),
      new THREE.MeshBasicMaterial({
        color: PIVOT_COLORS[pivotType] || 0xffffff,
        transparent: true,
        opacity: 0.85,
        depthTest: false,
        depthWrite: false
      })
    );
    sphere.renderOrder = 999;
    sphere.position.copy(worldPt);
    sphere.userData.isPivotHelper = true;
    scene.add(sphere);
    pivotHelpers.set(modelId, [sphere]);
  }
  function hidePivotHelpers(modelId: string) {
    let list = pivotHelpers.get(modelId);
    if (list) {
      list.forEach(function (s) {
        scene.remove(s);
      });
      pivotHelpers.delete(modelId);
    }
  }

  /** Update the position of an active pivot helper (called during live transform) */
  function updateActivePivotHelper(modelId: string) {
    const helpers = pivotHelpers.get(modelId);
    if (!helpers || helpers.length === 0) return;
    const sphere = helpers[0];
    const target = getTransformTarget(modelId, selModelId.value === modelId ? selModelNodeId.value : null);
    if (!target) return;
    // Recompute the pivot point in current transform
    let pivotType = editingSeg.value?.pivot || "center";
    let sp = target.position.clone();
    let sq = target.quaternion.clone();
    target.position.set(0, 0, 0);
    target.quaternion.identity();
    target.updateMatrixWorld(true);
    const bbox = calcModelBBox(target);
    target.position.copy(sp);
    target.quaternion.copy(sq);
    target.updateMatrixWorld(true);
    if (bbox.min.x === Infinity || bbox.max.x === -Infinity) return;
    const ctr = new THREE.Vector3();
    bbox.getCenter(ctr);
    let localPt = new THREE.Vector3(ctr.x, ctr.y, ctr.z);
    switch (pivotType) {
      case "top":
        localPt.y = bbox.max.y;
        break;
      case "bottom":
        localPt.y = bbox.min.y;
        break;
      case "left":
        localPt.x = bbox.min.x;
        break;
      case "right":
        localPt.x = bbox.max.x;
        break;
      case "front":
        localPt.z = bbox.max.z;
        break;
      case "back":
        localPt.z = bbox.min.z;
        break;
    }
    const worldPt = localPt.clone().applyQuaternion(target.quaternion).add(target.position);
    sphere.position.copy(worldPt);
  }
  function rebuildOutlineForObject(m: Model, obj: THREE.Object3D, cfg: ModelConfig) {
    const ownerKey = (obj.userData?.nodeId as string | undefined) || `root:${m.id}`;
    const toRemove: THREE.Object3D[] = [];
    obj.traverse(c => {
      if (c.userData?.isEdgeLine && c.userData.outlineOwner === ownerKey) toRemove.push(c);
    });
    toRemove.forEach(c => c.parent?.remove(c));

    obj.traverse(c => {
      if (c instanceof THREE.Mesh && !c.userData?.isEdgeLine) {
        c.visible = true;
        delete c.userData.pickHiddenForOutline;
      }
    });

    if (!cfg.visible) {
      obj.visible = false;
      return;
    }
    obj.visible = true;
    if (!cfg.outline && !cfg.highlight) return;

    const meshesToOutline: THREE.Mesh[] = [];
    if ((obj as THREE.Mesh).isMesh && obj.geometry) meshesToOutline.push(obj as THREE.Mesh);
    obj.traverse(c => {
      if (c !== obj && c instanceof THREE.Mesh && c.geometry && !c.userData?.isEdgeLine) {
        meshesToOutline.push(c);
      }
    });

    for (const c of meshesToOutline) {
      try {
        const edges = new THREE.EdgesGeometry(c.geometry, 15);
        if (edges.attributes.position.count > 50000) continue;

        if (cfg.outline && !cfg.highlight) {
          c.visible = false;
          c.userData.pickHiddenForOutline = true;
          const line = new THREE.LineSegments(
            edges,
            new THREE.LineBasicMaterial({ color: 0x888888, transparent: true, opacity: 0.5 })
          );
          line.userData.isEdgeLine = true;
          line.userData.outlineOwner = ownerKey;
          line.position.copy(c.position);
          line.quaternion.copy(c.quaternion);
          line.scale.copy(c.scale);
          c.parent?.add(line);
          continue;
        }

        const line = new THREE.LineSegments(
          edges,
          new THREE.LineBasicMaterial({ color: new THREE.Color(cfg.highlightColor || "#00ff00") })
        );
        line.userData.isEdgeLine = true;
        line.userData.outlineOwner = ownerKey;
        // 作为 mesh 子节点，随动画变换一起移动
        c.add(line);
      } catch {
        /* ignore */
      }
    }
    invalidatePickMeshCache();
  }

  function rebuildOutline(m: Model, cfg?: ModelConfig | null) {
    const o = meshes.get(m.id);
    if (!o || !cfg) return;
    rebuildOutlineForObject(m, o, cfg);
  }

  function seekTrack(e: MouseEvent) {
    if (!trackEl.value || !videoEl.value || !duration.value || !hasChapters.value) return;
    const target = e.target as HTMLElement;
    const segEl = target.closest(".prog-seg");
    if (segEl) return;

    const r = trackEl.value.getBoundingClientRect();
    const t = ((e.clientX - r.left) / r.width) * duration.value;
    const ch = chapterAtTime(t);
    if (ch) void startChapterPlayback(ch);
  }

  async function startChapterPlayback(ch: Chapter, options?: { autoplay?: boolean }) {
    const resolved = resolveChapter(ch);
    const video = videoEl.value;
    if (!resolved || !video) return;

    const { chapter, idx } = resolved;
    const autoplay = options?.autoplay ?? !isCoarsePointerDevice();
    chapterPlayTarget.value = chapter;
    chapterAutoNext.value = true;
    _chAnimLock = false;

    await withChapterNavLock(async () => {
      focusChapter(chapter, idx);
      applyChapter(chapter);
      syncModelSelectionForChapter(chapter);
      video.pause();
      await seekVideoTo(chapter.startTime);
      currentTime.value = video.currentTime;
    });

    // 模型动画与节点视频同步播放（由 onVideoPlay 启动，从当前进度续播）
    _chAnimLock = false;
    if (autoplay) {
      try {
        await video.play();
      } catch {
        /* ignore autoplay restrictions */
      }
    } else {
      video.pause();
    }
  }

  function jumpToChapter(ch: Chapter) {
    void startChapterPlayback(ch);
  }

  function prevCh() {
    if (!videoEl.value || !hasChapters.value) return;
    const t = videoEl.value.currentTime;
    const ci = findChIdx(t);
    let prevIdx = -1;
    if (ci > 0) {
      prevIdx = ci - 1;
    } else if (ci === -1) {
      for (let i = timelineChapters.value.length - 1; i >= 0; i--) {
        if (timelineChapters.value[i].startTime < t - CHAPTER_TIME_EPS) {
          prevIdx = i;
          break;
        }
      }
    }
    if (prevIdx >= 0) {
      void startChapterPlayback(timelineChapters.value[prevIdx]);
    } else if (timelineChapters.value.length > 0) {
      void startChapterPlayback(timelineChapters.value[0]);
    } else {
      videoEl.value.currentTime = 0;
      currentTime.value = 0;
    }
  }

  function nextCh() {
    if (!videoEl.value || !hasChapters.value) return;
    const t = videoEl.value.currentTime;
    const ci = findChIdx(t);
    let nextIdx = -1;
    if (ci >= 0 && ci < timelineChapters.value.length - 1) {
      nextIdx = ci + 1;
    } else if (ci === -1) {
      nextIdx = timelineChapters.value.findIndex(c => c.startTime > t + CHAPTER_TIME_EPS);
    }
    if (nextIdx < 0) return;
    void startChapterPlayback(timelineChapters.value[nextIdx]);
  }

  function toggleLoop() {
    isLooping.value = !isLooping.value;
    if (videoEl.value) videoEl.value.loop = isLooping.value;
    toastShow(isLooping.value ? "循环播放 开" : "循环播放 关", "success");
  }

  function saveTitle() {
    if (currProj.value) pStore.updateProject({ title: projectTitle.value } as any);
  }

  function syncProjectTitleToStore() {
    const title = projectTitle.value.trim() || editSceneToolName.value.trim() || "未命名场景";
    projectTitle.value = title;
    if (currProj.value) pStore.updateProject({ title } as any);
    return title;
  }

  async function loadEditSceneMeta(code: string) {
    try {
      const set = await fetchModelSet(code);
      editSceneCompanyName.value = set.companyName || "";
      editSceneToolName.value = set.name || "";
      if (editSceneToolName.value) setPageTitle(editSceneToolName.value);
      return set;
    } catch {
      return null;
    }
  }

  function getModelSourcePath(m: Model): string | null {
    const sourcePath = (m as any).sourcePath as string | undefined;
    if (sourcePath) return sourcePath;
    if (m.url && /^https?:\/\//i.test(m.url)) return m.url;
    return null;
  }

  function buildShareLink(code: string) {
    return buildScenePreviewLink(code);
  }

  function buildScenePayload() {
    const proj = currProj.value;
    if (!proj) return null;
    return {
      title: syncProjectTitleToStore(),
      modelSetCode: modelSetCode.value || undefined,
      videoSrc: proj.videoSrc,
      videoDuration: proj.videoDuration,
      videoWidth: proj.videoWidth,
      videoHeight: proj.videoHeight,
      chapters: JSON.parse(JSON.stringify(proj.chapters)),
      subtitles: JSON.parse(JSON.stringify(proj.subtitles)),
      models: proj.models.map(m => ({
        id: m.id,
        name: m.name,
        type: m.type,
        color: m.color,
        path: getModelSourcePath(m),
        basePosition: m.basePosition
      }))
    };
  }

  function clearAllEditorModels() {
    [...meshes.keys()].forEach(id => rmMesh(id));
    mixers.forEach(m => m.stopAllAction());
    mixers = [];
    if (currProj.value) {
      currProj.value.models = [];
      currProj.value.chapters = [];
      currProj.value.subtitles = [];
      currProj.value.videoSrc = null;
      currProj.value.videoDuration = 0;
      currProj.value.videoWidth = 0;
      currProj.value.videoHeight = 0;
    }
    selectedChapterId.value = null;
    selModelId.value = null;
    selModelNodeId.value = null;
    lastSelModelId = null;
    invalidatePickMeshCache();
  }

  function applyChapterCameraForLoadedModels() {
    const ch = selectedChapter.value ?? (chapters.value.length > 0 ? chapters.value[0] : null);
    if (!ch || meshes.size === 0) return;
    const dur = getChapterCameraTransitionSec(ch);
    if (isDefaultChapterCamera(ch)) {
      frameCameraOnSceneModels(dur, ch);
    } else {
      applyChapter(ch);
    }
    syncChapterForm(ch);
    nextTick(handleResize);
  }

  async function loadModelSetByCode(code: string) {
    if (!currProj.value || modelSetModelsLoaded.value) return;
    const set = await fetchModelSet(code);
    modelSetCode.value = set.code;
    editSceneCompanyName.value = set.companyName || "";
    editSceneToolName.value = set.name || "";
    modelSetModelsLoaded.value = true;

    suspendProjectPersist();
    importingModel.value = true;
    try {
      for (const item of set.models || []) {
        const url = resolveAssetUrl(item.path);
        const m = mStore.createCustomModel(currProj.value.id, item.name, url);
        (m as any).sourcePath = item.path;
        if (Array.isArray(item.basePosition)) m.basePosition = item.basePosition as [number, number, number];
        await loadGLB(m);
        if (meshes.has(m.id)) {
          currProj.value.models.push(m);
          refreshModelHierarchyIfLoaded(m.id, m.name);
        }
      }
      ensureAllModelMixers();
      applyChapterCameraForLoadedModels();
    } finally {
      importingModel.value = false;
      resumeProjectPersist();
    }
  }

  async function tryLoadPendingModelSet() {
    const code = pendingModelSetCode.value;
    if (!code || viewOnly.value || !hasVideo.value || !currProj.value || modelSetModelsLoaded.value) return;
    pendingModelSetCode.value = null;
    await loadModelSetByCode(code);
  }

  async function applyFetchedSceneData(sceneData: any, code: string) {
    const proj = currProj.value || pStore.createProject(sceneData.title || "未命名场景");
    projectTitle.value = sceneData.title || proj.title;
    proj.title = projectTitle.value;
    if (viewOnly.value) {
      setPageTitle(projectTitle.value);
      viewCameraBaseFov = null;
    }
    sceneCode.value = sceneData.code || code;
    modelSetCode.value = sceneData.modelSetCode || null;
    modelSetModelsLoaded.value = true;
    pendingModelSetCode.value = null;
    shareLink.value = sceneData.previewUrl
      ? rewireEditorFrontendHost(sceneData.previewUrl)
      : buildShareLink(sceneData.code || code);
    proj.videoSrc = sceneData.videoSrc ? rewireEditorServerHost(sceneData.videoSrc) : null;
    proj.videoDuration = sceneData.videoDuration || 0;
    proj.videoWidth = sceneData.videoWidth || 0;
    proj.videoHeight = sceneData.videoHeight || 0;
    proj.chapters = Array.isArray(sceneData.chapters) ? sceneData.chapters : [];
    proj.subtitles = Array.isArray(sceneData.subtitles) ? sceneData.subtitles : [];
    proj.models = [];

    for (const item of sceneData.models || []) {
      if (!item.path) continue;
      const url = resolveAssetUrl(item.path);
      const m = mStore.createCustomModel(proj.id, item.name, url);
      (m as any).sourcePath = item.path;
      if (Array.isArray(item.basePosition)) m.basePosition = item.basePosition;
      await loadGLB(m);
      if (meshes.has(m.id)) {
        proj.models.push(m);
        refreshModelHierarchyIfLoaded(m.id, m.name);
      }
    }
  }

  async function syncEditorAfterSceneLoad() {
    if (videoSrc.value) {
      syncVideoElementSrc();
      duration.value = currProj.value?.videoDuration || 0;
    }
    if (chapters.value.length > 0) {
      const ch = chapters.value[0];
      selectedChapterId.value = ch.id;
      if (meshes.size > 0 && isDefaultChapterCamera(ch)) {
        frameCameraOnSceneModels(getChapterCameraTransitionSec(ch), ch);
      } else {
        applyChapter(ch);
      }
      syncChapterForm(ch);
      syncModelSelectionForChapter(ch);
      resetChapterModelsToStart(ch);
    }
    if (videoEl.value) {
      videoEl.value.pause();
      videoEl.value.currentTime = 0;
    }
    currentTime.value = 0;
    syncVideoAudioState();
    nextTick(adaptPresentationViewport);
  }

  async function loadSceneByCode(code: string): Promise<"ok" | "not-found" | "error"> {
    try {
      clearAllEditorModels();
      const sceneData = await fetchScene(code);
      await applyFetchedSceneData(sceneData, code);
      await syncEditorAfterSceneLoad();
      return "ok";
    } catch (e: any) {
      if (e?.status === 404) return "not-found";
      toastShow("加载场景失败: " + (e?.message || "未知错误"), "error");
      return "error";
    }
  }

  async function loadSceneForEdit(code: string): Promise<boolean> {
    try {
      clearAllEditorModels();
      const sceneData = await fetchScene(code);
      await applyFetchedSceneData(sceneData, code);
      await syncEditorAfterSceneLoad();
      isPreviewMode.value = false;
      await nextTick();
      handleResize();
      return true;
    } catch (e: any) {
      toastShow("加载场景失败: " + (e?.message || "未知错误"), "error");
      return false;
    }
  }

  async function saveSceneToServer() {
    if (!currProj.value || chapters.value.length === 0) {
      toastShow("请先创建至少一个节点", "warning");
      return null;
    }
    const payload = buildScenePayload();
    if (!payload) return null;
    savingScene.value = true;
    try {
      if (currProj.value.videoSrc?.startsWith("blob:")) {
        const r = await fetch(currProj.value.videoSrc);
        const b = await r.blob();
        const ext = (b.type.split("/")[1] || "mp4").replace(/[^a-z0-9]/gi, "").toLowerCase();
        const uploaded = await uploadSceneVideo(new File([b], `scene-video.${ext}`, { type: b.type || "video/mp4" }));
        currProj.value.videoSrc = uploaded.url;
        payload.videoSrc = uploaded.url;
        syncVideoElementSrc(uploaded.url);
      }
      const result = sceneCode.value ? await updateSceneOnBackend(sceneCode.value, payload) : await saveSceneToBackend(payload);
      sceneCode.value = result.code;
      shareLink.value = result.previewUrl ? rewireEditorFrontendHost(result.previewUrl) : buildShareLink(result.code);
      sceneListVersion.value += 1;
      toastShow(sceneCode.value ? "场景已保存" : "场景已创建", "success");
      return result;
    } catch (e: any) {
      toastShow("保存失败: " + (e?.message || "未知错误"), "error");
      return null;
    } finally {
      savingScene.value = false;
    }
  }

  // Chapters
  async function selectChapter(ch: Chapter) {
    const resolved = resolveChapter(ch);
    if (!resolved) return;
    const { chapter, idx } = resolved;

    await withChapterNavLock(async () => {
      focusChapter(chapter, idx);
      applyChapter(chapter);
      syncModelSelectionForChapter(chapter);
      if (videoEl.value) await seekVideoTo(chapter.startTime);
    });

    const video = videoEl.value;
    if (!video) return;
    if (!video.paused) {
      _chAnimLock = false;
      ensureVideoSyncedChapterAnimation();
    } else {
      resetChapterModelsToStart(chapter);
    }
  }

  function getChapterAnimElapsed(ch: Chapter, t: number) {
    return Math.max(0, t - ch.startTime);
  }

  function chapterHasAnimation(ch: Chapter) {
    if (!ch.modelConfigs) return false;
    for (const cfg of Object.values(ch.modelConfigs)) {
      if (configHasAnimation(cfg as ModelConfig)) return true;
    }
    return false;
  }

  function stopChapterAnimation() {
    if (chAnimRafId !== null) {
      cancelAnimationFrame(chAnimRafId);
      chAnimRafId = null;
    }
    chAnimChapterId = null;
    chAnimWallclock = false;
    _chAnimLock = false;
  }

  function syncCurrentChapterAnimationFromVideo() {
    const video = videoEl.value;
    if (!video) return;
    const ch = getPlaybackChapterAtTime(video.currentTime);
    if (!ch) return;
    applyChapterAnimationAtElapsed(ch, getChapterAnimElapsed(ch, video.currentTime));
  }

  function applyChapterAnimationAtElapsed(ch: Chapter, elapsedSec: number) {
    for (const { objs, cfg, liveSegs } of collectChapterAnimTargets(ch)) {
      for (const obj of objs) {
        applyElapsedAnimToObject(obj, cfg, elapsedSec, liveSegs);
      }
    }
  }

  function syncChapterAnimationToVideo(ch: Chapter, t: number) {
    if (_chAnimLock) return;
    applyChapterAnimationAtElapsed(ch, getChapterAnimElapsed(ch, t));
  }

  function ensureVideoSyncedChapterAnimation() {
    const video = videoEl.value;
    if (!video || video.paused) return false;
    const ch = getPlaybackChapterAtTime(video.currentTime);
    if (!ch) return false;
    if (!chapterHasAnimation(ch)) return false;
    if (_chAnimLock && chAnimChapterId === ch.id && !chAnimWallclock) return true;
    return startVideoSyncedChapterAnimation(ch);
  }

  function startVideoSyncedChapterAnimation(ch: Chapter) {
    stopChapterAnimation();
    if (!chapterHasAnimation(ch)) return false;

    _chAnimLock = true;
    chAnimChapterId = ch.id;
    chAnimWallclock = false;
    totalPlaying.value = false;

    const tick = () => {
      const video = videoEl.value;
      if (!video || !_chAnimLock || chAnimWallclock) {
        stopChapterAnimation();
        return;
      }
      if (video.paused) {
        stopChapterAnimation();
        syncCurrentChapterAnimationFromVideo();
        return;
      }

      const activeCh = getPlaybackChapterAtTime(video.currentTime);
      if (!activeCh) {
        chAnimRafId = requestAnimationFrame(tick);
        return;
      }
      chAnimChapterId = activeCh.id;
      if (chapterHasAnimation(activeCh)) {
        applyChapterAnimationAtElapsed(activeCh, getChapterAnimElapsed(activeCh, video.currentTime));
      }
      chAnimRafId = requestAnimationFrame(tick);
    };

    syncCurrentChapterAnimationFromVideo();
    chAnimRafId = requestAnimationFrame(tick);
    return true;
  }

  function runChapterAnimationWallclock(ch: Chapter) {
    stopChapterAnimation();
    _chAnimLock = true;
    totalPlaying.value = false;
    const animEntries: Array<{ objs: THREE.Object3D[]; segs: any[]; totalDur: number }> = [];

    for (const { objs, cfg, liveSegs } of collectChapterAnimTargets(ch)) {
      if (!cfg.animation || !cfg.animConfig?.segments?.length) continue;
      const rawSegs = liveSegs?.length ? liveSegs : cfg.animConfig.segments;
      const csegs = resolvePlaybackSegments(rawSegs);
      let ctotal = 0;
      for (let cs = 0; cs < csegs.length; cs++) ctotal += (csegs[cs].pauseTime || 0) + (csegs[cs].animTime || 3);
      for (const obj of objs) {
        for (let cs2 = 0; cs2 < csegs.length; cs2++) getSegPivotCache(csegs[cs2], obj);
        const cfirst = csegs[0];
        applyPivotRotation(
          obj,
          [cfirst.startPos[0], cfirst.startPos[1], cfirst.startPos[2]],
          [cfirst.startRot[0], cfirst.startRot[1], cfirst.startRot[2]],
          cfirst.pivot || "center",
          cfirst.startScale
        );
      }
      animEntries.push({ objs, segs: csegs, totalDur: ctotal });
    }

    if (animEntries.length === 0) {
      _chAnimLock = false;
      chAnimWallclock = false;
      return false;
    }
    refreshActiveHighlightOutline();
    chAnimWallclock = true;
    let chAnimStart = performance.now();
    function chTick() {
      let cel = performance.now() - chAnimStart;
      let allDone = true;
      for (let ce = 0; ce < animEntries.length; ce++) {
        try {
          let ae = animEntries[ce];
          let at = Math.min(cel / (ae.totalDur * 1000), 1);
          if (at >= 1) continue;
          allDone = false;
          let aabs = at * ae.totalDur;
          let acum = 0;
          for (let aseg = 0; aseg < ae.segs.length; aseg++) {
            let as = ae.segs[aseg];
            let asTotal = (as.pauseTime || 0) + (as.animTime || 3);
            if (aabs >= acum && aabs <= acum + asTotal) {
              let alocal = aabs - acum;
              let apause = as.pauseTime || 0;
              let apc = as._animPivotCache;
              if (alocal < apause) {
                for (const o of ae.objs) {
                  applyPivotPathFrame(
                    o,
                    [as.startPos[0], as.startPos[1], as.startPos[2]],
                    [as.startRot[0], as.startRot[1], as.startRot[2]],
                    apc,
                    0
                  );
                }
              } else {
                let aAnimT = (alocal - apause) / (as.animTime || 3);
                let aep2 = applyEasingInline(Math.min(1, aAnimT), as.easing || animEasing.value);
                let apos = [
                  as.startPos[0] + (as.endPos[0] - as.startPos[0]) * aep2,
                  as.startPos[1] + (as.endPos[1] - as.startPos[1]) * aep2,
                  as.startPos[2] + (as.endPos[2] - as.startPos[2]) * aep2
                ];
                let arot = [
                  as.startRot[0] + (as.endRot[0] - as.startRot[0]) * aep2,
                  as.startRot[1] + (as.endRot[1] - as.startRot[1]) * aep2,
                  as.startRot[2] + (as.endRot[2] - as.startRot[2]) * aep2
                ];
                for (const o of ae.objs) {
                  applyPivotPathFrame(o, apos, arot, apc, aep2);
                }
              }
              break;
            }
            acum += asTotal;
          }
        } catch (e) {
          /* per-model error — skip this model's frame */
        }
      }
      if (allDone) {
        for (let ce2 = 0; ce2 < animEntries.length; ce2++) {
          let ae2 = animEntries[ce2];
          let alast = ae2.segs[ae2.segs.length - 1];
          try {
            for (const o of ae2.objs) {
              applyPivotPathFrame(
                o,
                [alast.endPos[0], alast.endPos[1], alast.endPos[2]],
                [alast.endRot[0], alast.endRot[1], alast.endRot[2]],
                alast._animPivotCache,
                1
              );
            }
          } catch (e) {}
        }
        _chAnimLock = false;
        chAnimWallclock = false;
        chAnimRafId = null;
        syncTransformVisualOverlays();
        return;
      }
      syncTransformVisualOverlays();
      chAnimRafId = requestAnimationFrame(chTick);
    }
    chAnimRafId = requestAnimationFrame(chTick);
    return true;
  }

  function runChapterAnimation(ch: Chapter, options?: { wallclock?: boolean }) {
    if (options?.wallclock) return runChapterAnimationWallclock(ch);
    return ensureVideoSyncedChapterAnimation() || startVideoSyncedChapterAnimation(ch);
  }

  function playChapter(ch: Chapter) {
    if (videoEl.value) videoEl.value.pause();
    selectChapter(ch);
    if (runChapterAnimation(ch, { wallclock: true })) toastShow("正在播放节点动画", "success");
    else toastShow("当前节点没有动画", "warning");
  }

  function syncChapterForm(ch: Chapter) {
    chForm.name = ch.name;
    chForm.startTime = ch.startTime;
    chForm.endTime = ch.endTime;
    const frame = resolveChapterCameraFrame(ch);
    camP[0] = frame.position[0];
    camP[1] = frame.position[1];
    camP[2] = frame.position[2];
    camT[0] = frame.target[0];
    camT[1] = frame.target[1];
    camT[2] = frame.target[2];
    camFov.value = ch.camera.fov;
    camTransitionSec.value = ch.camera.transitionSec ?? CHAPTER_CAMERA_TRANSITION_SEC;
    chapterFormRevision.value++;
    cameraFormRevision.value++;
  }

  function getChapterFormSnapshot() {
    return {
      name: chForm.name,
      startTime: chForm.startTime,
      endTime: chForm.endTime
    };
  }

  function applyChapterFormSnapshot(snapshot: ReturnType<typeof getChapterFormSnapshot>) {
    chForm.name = snapshot.name;
    chForm.startTime = snapshot.startTime;
    chForm.endTime = snapshot.endTime;
  }

  function getCameraFormSnapshot() {
    return {
      posX: camP[0],
      posY: camP[1],
      posZ: camP[2],
      targetX: camT[0],
      targetY: camT[1],
      targetZ: camT[2],
      fov: camFov.value,
      transitionSec: camTransitionSec.value
    };
  }

  function applyCameraFormSnapshot(snapshot: ReturnType<typeof getCameraFormSnapshot>) {
    camP[0] = snapshot.posX;
    camP[1] = snapshot.posY;
    camP[2] = snapshot.posZ;
    camT[0] = snapshot.targetX;
    camT[1] = snapshot.targetY;
    camT[2] = snapshot.targetZ;
    camFov.value = snapshot.fov;
    camTransitionSec.value = snapshot.transitionSec;
    liveCam();
    liveFov();
  }

  function restoreModelOutlines(ch: Chapter) {
    for (const m of models.value) {
      const cfg = chapterModelCfg(ch, m.id);
      if (cfg) applyMConfig(m, cfg);
    }
  }

  function applyModelConfigToEditor(cfg: ModelConfig) {
    mOff[0] = cfg.posOffset?.[0] ?? 0;
    mOff[1] = cfg.posOffset?.[1] ?? 0;
    mOff[2] = cfg.posOffset?.[2] ?? 0;
    mScl.value = cfg.scale ?? 1;
    mVis.value = cfg.visible ?? true;
    mHL.value = cfg.highlight ?? false;
    mOut.value = cfg.outline ?? false;
    mHLColor.value = cfg.highlightColor || "#00ff00";
    mAni.value = cfg.animation ?? true;
    mIntro.value = cfg.intro ?? "";
    mRot[0] = 0;
    mRot[1] = 0;
    mRot[2] = 0;

    const ac = cfg.animConfig;
    if (ac?.segments?.length) {
      animDuration.value = ac.duration || 3;
      animEasing.value = (ac as any).easing || "easeInOut";
      animSegments.splice(0, animSegments.length, mapStoredAnimSegment(ac.segments[0]));
      animDirty.value = false;
    } else {
      animSegments.splice(0);
      ensureSingleAnimSegment(selModel.value);
      animDirty.value = false;
    }
    if (mAni.value) ensureSingleAnimSegment(selModel.value);
  }

  function syncIntroPresentation() {
    const video = videoEl.value;
    const playing = !!(video && !video.paused);
    const t = video?.currentTime ?? currentTime.value;
    // 播放中：按视频所在节点展示；非播放：按当前选中/激活节点展示
    const chapter = playing ? getPlaybackChapterAtTime(t) : getActiveChapter();
    const chapterId = chapter?.id ?? null;

    const editingModel = !playing ? selModel.value : null;
    const editingCfg = chapter && editingModel ? getModelConfig(chapter.modelConfigs?.[editingModel.id]) : null;
    const editingIntro = editingCfg?.intro?.trim() || "";
    const editingShouldShow = !!(chapter && editingModel && editingCfg?.visible && editingIntro);

    // 播放中：展示所有有介绍的模型；编辑中：只展示当前选中模型的介绍
    const shouldShow = playing || introPreviewVisible.value || editingShouldShow;

    let introSignature = "";
    if (shouldShow && chapter) {
      if (!playing && editingModel) {
        introSignature = editingShouldShow ? `${editingModel.id}|${editingIntro}` : "";
      } else {
        introSignature = models.value
          .map(m => {
            if (!chapter.modelConfigs?.[m.id]) return "";
            const cfg = getModelConfig(chapter.modelConfigs[m.id]);
            const intro = cfg.intro?.trim();
            if (!intro || !cfg.visible) return "";
            return `${m.id}|${intro}`;
          })
          .filter(Boolean)
          .join(";");
      }
    }
    const stateKey = `${shouldShow ? 1 : 0}:${chapterId ?? ""}:${introSignature}`;
    if (stateKey === lastIntroStateKey) return;
    lastIntroStateKey = stateKey;

    if (!shouldShow || !chapter) {
      if (introPresentationPlaying || introPresentationChapterId) {
        modelIntroLabels.value = [];
        const restoreChapter =
          chapter ??
          (introPresentationChapterId
            ? (sortedChapters.value.find(c => c.id === introPresentationChapterId) ?? getActiveChapter())
            : getActiveChapter());
        if (restoreChapter && !viewOnly.value && !isPreviewMode.value) {
          restoreModelOutlines(restoreChapter);
        }
      }
      introPresentationPlaying = false;
      introPresentationChapterId = null;
      lastIntroStateKey = "";
      return;
    }

    const labels: Array<{ modelId: string; text: string; x: number; y: number }> = [];
    if (!playing && editingModel) {
      if (editingShouldShow) {
        labels.push({ modelId: editingModel.id, text: editingIntro, x: 0, y: 0 });
      }
      // 编辑态不强制改 outline/highlight，避免打扰编辑视图
    } else if (!viewOnly.value && !isPreviewMode.value) {
      for (const m of models.value) {
        if (!chapter.modelConfigs?.[m.id]) continue;
        const cfg = getModelConfig(chapter.modelConfigs[m.id]);
        const intro = cfg.intro?.trim();
        if (!intro || !cfg.visible) continue;
        labels.push({ modelId: m.id, text: intro, x: 0, y: 0 });
        rebuildOutline(m, { ...cfg, highlight: true });
      }

      for (const m of models.value) {
        if (labels.some(label => label.modelId === m.id)) continue;
        rebuildOutline(m, chapterModelCfg(chapter, m.id));
      }
    } else {
      for (const m of models.value) {
        if (!chapter.modelConfigs?.[m.id]) continue;
        const cfg = getModelConfig(chapter.modelConfigs[m.id]);
        const intro = cfg.intro?.trim();
        if (!intro || !cfg.visible) continue;
        labels.push({ modelId: m.id, text: intro, x: 0, y: 0 });
      }
    }

    modelIntroLabels.value = labels;
    introPresentationPlaying = playing;
    introPresentationChapterId = chapterId;
  }

  function updateModelIntroLabelPositions() {
    if (!viewportEl.value || !camera || modelIntroLabels.value.length === 0) return;

    const width = viewportEl.value.clientWidth;
    const height = viewportEl.value.clientHeight;
    if (width <= 0 || height <= 0) return;

    for (const label of modelIntroLabels.value) {
      const obj = meshes.get(label.modelId);
      if (!obj) continue;

      const box = new THREE.Box3().setFromObject(obj);
      box.getCenter(_introWorldPos);
      _introWorldPos.y = box.max.y + 0.12;
      _introWorldPos.project(camera);

      if (_introWorldPos.z > 1) {
        label.x = -9999;
        label.y = -9999;
        continue;
      }

      label.x = (_introWorldPos.x * 0.5 + 0.5) * width;
      label.y = (-_introWorldPos.y * 0.5 + 0.5) * height;
    }
  }

  function resetModelFormDefaults() {
    applyModelConfigToEditor(createDefaultModelConfig());
  }

  function getActiveChapter(): Chapter | null {
    return selectedChapter.value ?? chapters.value[0] ?? null;
  }

  function getChapterModels(ch?: Chapter | null): Model[] {
    if (!ch?.modelConfigs) return [];
    const ids = new Set(Object.keys(ch.modelConfigs));
    return models.value.filter(m => ids.has(m.id));
  }

  function syncModelSelectionForChapter(ch?: Chapter | null) {
    const chapter = ch ?? getActiveChapter();

    // 如果当前已有选中模型，保持选中（即使该模型在本节点没有配置）
    if (selModelId.value) {
      syncModelForm(chapter);
      return;
    }

    // 没有选中模型时，尝试选中本节点第一个有配置的模型（向后兼容）
    const chapterModelList = getChapterModels(chapter);
    if (!chapter || chapterModelList.length === 0) {
      resetModelFormDefaults();
      modelFormRevision.value++;
      lastIntroStateKey = "";
      syncIntroPresentation();
      return;
    }

    setSelectedModelId(chapterModelList[0].id, true);
  }

  function syncModelForm(ch?: Chapter | null) {
    const model = selModel.value;
    if (!model) {
      resetModelFormDefaults();
      modelFormRevision.value++;
      return;
    }

    const activeChapter = ch ?? getActiveChapter();
    const defaultCfg = createDefaultModelConfig();

    if (!activeChapter) {
      applyModelConfigToEditor(defaultCfg);
      applyMConfig(model, defaultCfg);
      modelFormRevision.value++;
      return;
    }

    const cfg = readActiveModelConfig(activeChapter);
    applyModelConfigToEditor(cfg);

    const target = getTransformTarget(model.id, selModelNodeId.value);
    if (target && hasActiveModelConfig(activeChapter)) {
      applyConfigToObject(model, target, cfg, !selModelNodeId.value);
    }
    modelFormRevision.value++;
  }

  // 模型配置改为“按节点手动添加”，不再在新节点里自动为所有模型创建默认配置
  function ensureModelConfigsOnChapter(_ch: Chapter) {}

  function resetChaptersForNewVideo() {
    if (!currProj.value) return;
    currProj.value.chapters = [];
    selectedChapterId.value = null;
    playingIdx.value = -1;
    chapterPlayTarget.value = null;
  }

  function ensureDefaultChapter(videoDur?: number) {
    if (!currProj.value) return;
    const dur = videoDur ?? currProj.value.videoDuration ?? duration.value;
    if (dur <= 0 || currProj.value.chapters.length > 0) return;

    const ch = chStore.createChapter(currProj.value.id, "节点 1", 0, dur);
    currProj.value.chapters.push(ch);
    selectedChapterId.value = ch.id;
    syncChapterForm(ch);
    applyChapter(ch);
    syncModelSelectionForChapter(ch);
  }

  function addChapter() {
    if (!currProj.value || !hasVideo.value) return;
    const dur = currProj.value.videoDuration || duration.value;
    if (dur <= 0) {
      toastShow("请等待视频加载完成", "warning");
      return;
    }

    const proj = currProj.value;

    if (timelineChapters.value.length === 0) {
      ensureDefaultChapter(dur);
      toastShow("已添加节点 1");
      return;
    }

    const nextRange = getNextChapterRange(undefined);
    if (!nextRange) {
      toastShow("视频时间已无可用区间，无法再添加节点", "warning");
      return;
    }

    if (nextRange.splitChapter) {
      chStore.updateChapter(nextRange.splitChapter, { endTime: nextRange.startTime });
    }

    const rootCount = timelineChapters.value.length;
    const newCh = chStore.createChapter(proj.id, `节点 ${rootCount + 1}`, nextRange.startTime, nextRange.endTime);
    proj.chapters.push(newCh);

    selectedChapterId.value = newCh.id;
    syncChapterForm(newCh);
    applyChapter(newCh);
    syncModelSelectionForChapter(newCh);
    toastShow(`已添加节点 ${rootCount + 1}`);
  }

  function addChildChapter(parent: Chapter) {
    if (!currProj.value) return;

    const nextRange = getNextChapterRange(parent.id);
    if (!nextRange) {
      toastShow("父节点时间范围内已无可用区间，无法再添加子节点", "warning");
      return;
    }

    if (nextRange.splitChapter) {
      chStore.updateChapter(nextRange.splitChapter, { endTime: nextRange.startTime });
    }

    const children = getSortedChapterChildren(parent.id);
    const childIndex = children.length + 1;
    const newCh = chStore.createChapter(
      currProj.value.id,
      `${parent.name} - 子节点 ${childIndex}`,
      nextRange.startTime,
      nextRange.endTime,
      parent.id
    );
    newCh.camera = JSON.parse(JSON.stringify(parent.camera));
    newCh.modelConfigs = JSON.parse(JSON.stringify(parent.modelConfigs || {}));

    currProj.value.chapters.push(newCh);
    selectedChapterId.value = newCh.id;
    syncChapterForm(newCh);
    applyChapter(newCh);
    syncModelSelectionForChapter(newCh);
    chapterFormRevision.value++;
    toastShow(`已添加子节点 ${childIndex}`);
  }

  function canAddChildChapter(parent: Chapter) {
    return !!getNextChapterRange(parent.id);
  }

  function getChapterChildren(chapterId: string): Chapter[] {
    return chapters.value.filter(ch => ch.parentId === chapterId);
  }

  function getAllDescendantChapterIds(chapterId: string): string[] {
    return getDescendantChapterIds(chapters.value, chapterId);
  }

  function isChapterPlaying(ch: Chapter): boolean {
    if (!isPlaying.value) return false;
    if (selectedChapterId.value === ch.id) return true;
    const ci = currentChapterIdx.value;
    if (ci < 0) return false;
    return timelineChapters.value[ci]?.id === ch.id;
  }

  function chCmd(c: string, ch: Chapter) {
    switch (c) {
      case "edit":
        selectChapter(ch);
        break;
      case "play":
        playChapter(ch);
        break;
      case "dup":
        {
          const clone = chStore.createChapter(ch.projectId, ch.name + " (副本)", ch.startTime, ch.endTime, ch.parentId);
          Object.assign(clone.camera, ch.camera);
          clone.modelConfigs = JSON.parse(JSON.stringify(ch.modelConfigs));
          currProj.value?.chapters.push(clone);
          toastShow("节点已复制");
        }
        break;
      case "del":
        ElMessageBox.confirm(`删除"${ch.name}"？`, "确认", { type: "warning" })
          .then(() => {
            if (currProj.value) {
              const deleteIds = new Set([ch.id, ...getAllDescendantChapterIds(ch.id)]);
              currProj.value.chapters = currProj.value.chapters.filter(c => !deleteIds.has(c.id));
              if (selectedChapterId.value && deleteIds.has(selectedChapterId.value)) {
                selectedChapterId.value = null;
              }
            }
            toastShow("节点已删除");
          })
          .catch(() => {});
    }
  }

  function saveChF() {
    if (chapterNavLock.value) return;
    if (selectedChapter.value) {
      const ch = selectedChapter.value;
      const { startTime, endTime } = normalizeChapterFormRange(ch);

      chStore.updateChapter(ch, {
        name: chForm.name,
        startTime,
        endTime
      });
      if (startTime !== chForm.startTime || endTime !== chForm.endTime) {
        syncChapterForm(ch);
      } else {
        chapterFormRevision.value++;
      }
    }
  }

  function saveChapterFull() {
    if (!selectedChapter.value) return;
    const ch = selectedChapter.value;
    const { startTime, endTime } = normalizeChapterFormRange(ch);

    chStore.updateChapter(ch, {
      name: chForm.name,
      startTime,
      endTime
    });
    selectedChapter.value.camera.position = [...camP] as [number, number, number];
    selectedChapter.value.camera.target = [...camT] as [number, number, number];
    selectedChapter.value.camera.fov = camFov.value;
    selectedChapter.value.camera.transitionSec = camTransitionSec.value;
    // Capture model states
    for (const m of models.value) {
      if (!selectedChapter.value.modelConfigs) selectedChapter.value.modelConfigs = {};
      if (!selectedChapter.value.modelConfigs[m.id]) {
        selectedChapter.value.modelConfigs[m.id] = {
          visible: true,
          posOffset: [0, 0, 0],
          scale: 1,
          highlight: false,
          highlightColor: "#00ff00",
          outline: false,
          animation: true
        };
      }
      if (selModel.value && m.id === selModel.value.id) {
        const targetCfg = getActiveModelConfig(selectedChapter.value);
        targetCfg.posOffset = [...mOff] as [number, number, number];
        targetCfg.scale = mScl.value;
        targetCfg.highlight = mHL.value;
        targetCfg.highlightColor = mHLColor.value;
        targetCfg.outline = mOut.value;
        targetCfg.animation = mAni.value;
        targetCfg.intro = mIntro.value;
        targetCfg.visible = mVis.value;
      } else {
        const cfg = selectedChapter.value.modelConfigs[m.id];
        const mesh = meshes.get(m.id);
        if (mesh) {
          cfg.visible = mesh.visible;
          const bp = mesh.userData.basePos || DEFAULT_MODEL_BASE_POSITION;
          cfg.posOffset = [mesh.position.x - bp[0], mesh.position.y - bp[1], mesh.position.z - bp[2]];
          cfg.scale = mesh.scale.x;
        }
      }
    }
    toastShow("节点已保存");
  }

  function deleteChapter() {
    if (!selectedChapter.value) return;
    ElMessageBox.confirm(`删除"${selectedChapter.value.name}"？`, "确认", { type: "warning" })
      .then(() => {
        if (currProj.value) {
          const deleteIds = new Set([selectedChapter.value!.id, ...getAllDescendantChapterIds(selectedChapter.value!.id)]);
          currProj.value.chapters = currProj.value.chapters.filter(c => !deleteIds.has(c.id));
          if (selectedChapterId.value && deleteIds.has(selectedChapterId.value)) selectedChapterId.value = null;
        }
        toastShow("节点已删除");
      })
      .catch(() => {});
  }

  function liveCam() {
    if (!camera || !controls) return;
    camera.position.set(camP[0], camP[1], camP[2]);
    controls.target.set(camT[0], camT[1], camT[2]);
  }

  function liveFov() {
    if (camera) {
      camera.fov = camFov.value;
      camera.updateProjectionMatrix();
    }
  }

  function captureCam() {
    const ch = getActiveChapter();
    if (!ch) {
      toastShow("请先选择一个节点", "warning");
      return;
    }
    if (!camera || !controls) {
      toastShow("3D 场景未就绪", "warning");
      return;
    }
    controls.update();
    const center = getSceneModelCenter();
    const position: [number, number, number] = [camera.position.x, camera.position.y, camera.position.z];
    const target: [number, number, number] = center
      ? [center.x, center.y, center.z]
      : [controls.target.x, controls.target.y, controls.target.z];
    const fov = camera.fov;
    chStore.setChapterCamera(ch, position, target, fov);
    if (!selectedChapterId.value) {
      selectedChapterId.value = ch.id;
    }
    camP[0] = position[0];
    camP[1] = position[1];
    camP[2] = position[2];
    camT[0] = target[0];
    camT[1] = target[1];
    camT[2] = target[2];
    camFov.value = fov;
    camTrans = null;
    cameraFormRevision.value++;
    toastShow("镜头视角已捕获");
  }

  function previewCam() {
    if (selectedChapter.value) {
      const ch = selectedChapter.value;
      const frame = resolveChapterCameraFrame(ch);
      animCam(frame.position, frame.target, ch.camera.fov, getChapterCameraTransitionSec(ch));
      toastShow("正在预览镜头: " + ch.name, "success");
    }
  }

  // Models
  function setSelectedModelId(modelId: string | null, sync = true) {
    // Hide pivot for previous selection when switching
    if (selModelId.value && selModelId.value !== modelId) {
      hidePivotHelpers(selModelId.value);
    }
    if (selModelId.value !== modelId) selModelNodeId.value = null;
    selModelId.value = modelId;
    if (modelId) lastSelModelId = modelId;
    if (sync && modelId) syncModelForm(getActiveChapter());
    updateSelectionHighlight();
  }

  function selectModelNode(modelId: string, nodeId: string | null, opts?: { focusCamera?: boolean }) {
    const m = models.value.find(item => item.id === modelId);
    if (!m) return;
    selectModel(m, { focusCamera: opts?.focusCamera, nodeId });
  }

  function restoreLastModelSelection() {
    if (selModelId.value) return;
    const ch = getActiveChapter();
    const chapterModelList = getChapterModels(ch);
    if (chapterModelList.length === 0) return;

    const target = (lastSelModelId ? chapterModelList.find(m => m.id === lastSelModelId) : null) ?? chapterModelList[0];
    setSelectedModelId(target.id, true);
  }

  function refreshModelHierarchyIfLoaded(modelId: string, modelDisplayName?: string) {
    const root = meshes.get(modelId);
    if (root) registerModelHierarchy(modelId, root, modelDisplayName);
  }

  function selectModel(m: Model, opts?: { focusCamera?: boolean; nodeId?: string | null }) {
    refreshModelHierarchyIfLoaded(m.id, m.name);
    const focusCamera = opts?.focusCamera ?? false;
    const nodeId = opts?.nodeId ?? null;
    const resolvedNodeId = nodeId ? resolveSelectedNodeId(m.id, nodeId) : null;
    const applySelection = () => {
      if (selModelId.value && selModelId.value !== m.id) {
        hidePivotHelpers(selModelId.value);
      }
      selModelId.value = m.id;
      lastSelModelId = m.id;
      selModelNodeId.value = resolvedNodeId;
      syncModelForm(getActiveChapter());

      const applyVisuals = () => updateSelectionHighlight();
      if (focusCamera) {
        requestAnimationFrame(() => {
          applyVisuals();
          const obj = getSelectedObject3D();
          if (obj) focusCameraOnObject(obj);
        });
      } else {
        applyVisuals();
      }
    };

    if (selModelId.value === m.id && selModelNodeId.value === resolvedNodeId) {
      syncModelForm(getActiveChapter());
      if (focusCamera) {
        requestAnimationFrame(() => {
          const obj = getSelectedObject3D();
          if (obj) focusCameraOnObject(obj);
        });
      }
      return;
    }
    if (animDirty.value) {
      ElMessageBox.confirm("当前模型的动画修改尚未保存，是否放弃？", "提示", {
        type: "warning",
        confirmButtonText: "放弃",
        cancelButtonText: "取消"
      })
        .then(() => {
          animDirty.value = false;
          applySelection();
        })
        .catch(() => {});
    } else {
      applySelection();
      if (!getActiveChapter()) {
        toastShow("请先添加节点后再配置模型样式", "warning");
      }
    }
  }

  function importCmd(cmd: string) {
    if (cmd === "file") multiFileInput.value?.click();
    else if (cmd === "folder") folderInput.value?.click();
  }

  function validateModelFile(file) {
    const maxSize = 100 * 1024 * 1024;
    if (file.size > maxSize) return { valid: false, msg: "文件过大，建议不超过 50MB" };
    const n = file.name.toLowerCase();
    if (!n.endsWith(".glb") && !n.endsWith(".gltf")) return { valid: false, msg: "仅支持 .glb 和 .gltf 格式" };
    return { valid: true, msg: "" };
  }

  function onMultiFileChange(e: Event) {
    let fl = (e.target as HTMLInputElement).files;
    if (!fl || fl.length === 0) return;
    let files: File[] = [];
    for (let fi = 0; fi < fl.length; fi++) files.push(fl[fi]);
    importBatch(files);
    (e.target as HTMLInputElement).value = "";
  }

  function onFolderChange(e: Event) {
    let fl = (e.target as HTMLInputElement).files;
    if (!fl || fl.length === 0) return;
    let modelFiles: File[] = [];
    for (let fi = 0; fi < fl.length; fi++) {
      let f = fl[fi];
      if (f.name.match(/.(glb|gltf)$/i)) modelFiles.push(f);
    }
    if (modelFiles.length === 0) {
      toastShow("文件夹中未找到 GLB/GLTF 模型文件", "warning");
      return;
    }
    importBatch(modelFiles);
    (e.target as HTMLInputElement).value = "";
  }

  async function importBatch(files: File[]) {
    if (!currProj.value || files.length === 0) return;
    if (importingModel.value) {
      toastShow("正在导入中，请稍候", "warning");
      return;
    }

    const glbFiles = files.filter(f => /\.(glb|gltf)$/i.test(f.name));
    if (glbFiles.length === 0) {
      toastShow("未找到 GLB/GLTF 模型文件", "warning");
      return;
    }

    const totalBytes = glbFiles.reduce((sum, f) => sum + f.size, 0);
    const maxCount = 30;
    const batch = glbFiles.slice(0, maxCount);
    const totalMB = (totalBytes / (1024 * 1024)).toFixed(1);

    if (totalBytes > 150 * 1024 * 1024) {
      toastShow(`批量导入约 ${totalMB}MB，将逐个加载以节省内存，请稍候…`, "warning");
    }

    importingModel.value = true;
    suspendProjectPersist();
    const proj = currProj.value;
    const ch = getActiveChapter();
    let count = 0;
    let lastImportedId: string | null = null;
    const importedModels: Model[] = [];
    const importedIds: string[] = [];

    const yieldImportGap = (index: number) =>
      new Promise<void>(resolve => {
        const delay = index % 4 === 3 ? 150 : 80;
        setTimeout(() => requestAnimationFrame(() => resolve()), delay);
      });

    try {
      for (let i = 0; i < batch.length; i++) {
        const f = batch[i];
        try {
          const validation = validateModelFile(f);
          if (!validation.valid) {
            console.warn("Skip model:", f.name, validation.msg);
            await yieldImportGap(i);
            continue;
          }

          const name = f.name.replace(/\.(glb|gltf)$/i, "");
          const m = mStore.createCustomModel(proj.id, name, "");
          const buffer = await f.arrayBuffer();
          await loadGLBFromArrayBuffer(m, buffer);
          if (!meshes.has(m.id)) {
            await yieldImportGap(i);
            continue;
          }

          importedModels.push(m);
          importedIds.push(m.id);
          lastImportedId = m.id;
          count++;
        } catch (e) {
          console.warn("Import error:", f?.name, e);
        }
        await yieldImportGap(i);
      }

      if (importedModels.length > 0) {
        proj.models.push(...importedModels);
        if (ch) {
          if (!ch.modelConfigs) ch.modelConfigs = {};
          for (const id of importedIds) {
            if (!ch.modelConfigs[id]) {
              ch.modelConfigs[id] = JSON.parse(JSON.stringify(defaultModelCfg()));
            }
          }
        }
      }

      ensureAllModelMixers();
    } finally {
      importingModel.value = false;
      resumeProjectPersist();
      pStore.$patch({ projectIdCounter: pStore.projectIdCounter });
    }

    if (lastImportedId) setSelectedModelId(lastImportedId, true);
    if (count === 0) {
      toastShow("模型导入失败，请检查文件格式", "error");
      return;
    }
    toastShow(
      `已导入 ${count} 个模型（共 ${totalMB}MB）` + (glbFiles.length > maxCount ? `，超过上限 ${maxCount} 个，其余已跳过` : ""),
      glbFiles.length > maxCount ? "warning" : "success"
    );
  }

  async function importGLB(file: File) {
    if (!currProj.value) return false;
    const validation = validateModelFile(file);
    if (!validation.valid) {
      toastShow(validation.msg, "warning");
      return false;
    }
    const name = file.name.replace(/\.(glb|gltf)$/i, "");
    const m = mStore.createCustomModel(currProj.value.id, name, "");
    const buffer = await file.arrayBuffer();
    await loadGLBFromArrayBuffer(m, buffer);
    if (!meshes.has(m.id)) {
      toastShow("模型加载失败", "error");
      return false;
    }
    currProj.value.models.push(m);
    // 仅添加到当前节点
    const ch = getActiveChapter();
    if (ch) {
      if (!ch.modelConfigs) ch.modelConfigs = {};
      if (!ch.modelConfigs[m.id]) ch.modelConfigs[m.id] = JSON.parse(JSON.stringify(defaultModelCfg()));
    }
    setSelectedModelId(m.id, true);
    return false;
  }

  function delModel(m: Model) {
    ElMessageBox.confirm(`删除"${m.name}"？`, "确认", { type: "warning" })
      .then(() => {
        if (currProj.value) {
          const i = currProj.value.models.findIndex(x => x.id === m.id);
          if (i !== -1) currProj.value.models.splice(i, 1);
          rmMesh(m.id);
          if (selModelId.value === m.id) {
            selModelId.value = null;
            selModelNodeId.value = null;
            if (lastSelModelId === m.id) lastSelModelId = null;
            restoreLastModelSelection();
          }
          // Remove from chapter configs
          for (const ch of chapters.value) {
            if (ch.modelConfigs) delete ch.modelConfigs[m.id];
          }
          // 删除模型后，同步当前节点的选择/空状态
          syncModelSelectionForChapter(getActiveChapter());
        }
        toastShow("模型已删除");
      })
      .catch(() => {});
  }

  function getModelFormSnapshot() {
    return {
      visible: mVis.value,
      outline: mOut.value,
      highlight: mHL.value,
      highlightColor: mHLColor.value,
      posOffsetX: mOff[0],
      posOffsetY: mOff[1],
      posOffsetZ: mOff[2],
      scale: mScl.value,
      rotX: mRot[0],
      rotY: mRot[1],
      rotZ: mRot[2],
      animation: mAni.value,
      intro: mIntro.value
    };
  }

  function applyModelFormSnapshot(snapshot: ReturnType<typeof getModelFormSnapshot>) {
    mVis.value = snapshot.visible;
    mOut.value = snapshot.outline;
    mHL.value = snapshot.highlight;
    mHLColor.value = snapshot.highlightColor;
    mOff[0] = snapshot.posOffsetX;
    mOff[1] = snapshot.posOffsetY;
    mOff[2] = snapshot.posOffsetZ;
    mScl.value = snapshot.scale;
    mRot[0] = snapshot.rotX;
    mRot[1] = snapshot.rotY;
    mRot[2] = snapshot.rotZ;
    mAni.value = snapshot.animation;
    mIntro.value = snapshot.intro;
  }

  function applyMCfgLive(field: string, value?: any) {
    if (!selModel.value) return;
    const ch = getActiveChapter();
    const cfg = ch
      ? getActiveModelConfig(ch)
      : {
          visible: mVis.value,
          posOffset: [mOff[0], mOff[1], mOff[2]] as [number, number, number],
          scale: mScl.value,
          highlight: mHL.value,
          highlightColor: mHLColor.value,
          outline: mOut.value,
          animation: mAni.value,
          intro: mIntro.value
        };
    const targets = getNodeObjects(undefined, undefined, true);
    const root = meshes.get(selModel.value.id);

    if (field === "visible") {
      cfg.visible = mVis.value;
      for (const target of targets) rebuildOutlineForObject(selModel.value, target, cfg);
    } else if (field === "outline") {
      cfg.outline = mOut.value;
      for (const target of targets) rebuildOutlineForObject(selModel.value, target, cfg);
    } else if (field === "highlight") {
      cfg.highlight = mHL.value;
      cfg.highlightColor = mHLColor.value;
      for (const target of targets) rebuildOutlineForObject(selModel.value, target, cfg);
    } else if (field === "highlightColor") {
      cfg.highlightColor = mHLColor.value;
      if (cfg.highlight) {
        for (const target of targets) rebuildOutlineForObject(selModel.value, target, cfg);
      }
    } else if (field === "animation") {
      const mixer = mixers.find(m => {
        const mixerRoot = m.getRoot();
        return (mixerRoot as any).userData?.modelId === selModel.value?.id;
      });
      if (mixer) {
        mixer.timeScale = mAni.value ? 1 : 0;
      }
    } else if (field === "intro") {
      cfg.intro = mIntro.value;
      lastIntroStateKey = "";
      introPreviewVisible.value = true;
      if (introPreviewTimer) clearTimeout(introPreviewTimer);
      introPreviewTimer = setTimeout(() => {
        introPreviewVisible.value = false;
        lastIntroStateKey = "";
        syncIntroPresentation();
      }, 2200);
      syncIntroPresentation();
    } else if (field === "position") {
      if (targets.length) {
        if (selModelNodeId.value) {
          for (const target of targets) {
            const bp = target.userData.baseLocalPos || [target.position.x, target.position.y, target.position.z];
            target.position.set(bp[0] + mOff[0], bp[1] + mOff[1], bp[2] + mOff[2]);
          }
        } else if (root) {
          const bp = root.userData.basePos || DEFAULT_MODEL_BASE_POSITION;
          root.position.set(bp[0] + mOff[0], bp[1] + mOff[1], bp[2] + mOff[2]);
        }
        cfg.posOffset = [mOff[0], mOff[1], mOff[2]];
      }
    } else if (field === "scale") {
      for (const target of targets) {
        target.scale.setScalar(mScl.value);
      }
      cfg.scale = mScl.value;
    } else if (field === "rotation") {
      for (const target of targets) {
        target.rotation.set(
          THREE.MathUtils.degToRad(mRot[0]),
          THREE.MathUtils.degToRad(mRot[1]),
          THREE.MathUtils.degToRad(mRot[2])
        );
      }
    }
  }

  // Subtitles
  function addOrUpdateSub() {
    if (!subForm.text.trim()) {
      toastShow("请输入字幕文本", "warning");
      return;
    }
    if (subForm.text.length > SUBTITLE_TEXT_MAX_LENGTH) {
      toastShow(`字幕文本不能超过 ${SUBTITLE_TEXT_MAX_LENGTH} 个字符`, "warning");
      return;
    }
    if (subForm.endTime <= subForm.startTime) {
      toastShow("结束时间必须大于起始时间", "warning");
      return;
    }
    if (duration.value > 0 && subForm.endTime > duration.value) {
      toastShow("结束时间不能超过视频总时长", "warning");
      return;
    }
    if (editingSId) {
      const s = subtitles.value.find(x => x.id === editingSId);
      if (s) {
        sStore.updateSubtitle(s, {
          startTime: subForm.startTime,
          endTime: subForm.endTime,
          text: subForm.text,
          color: subForm.color,
          backgroundColor: subForm.backgroundColor,
          displayMode: "fadeIn"
        });
      }
      editingSId = null;
    } else {
      if (!currProj.value) return;
      const s = sStore.createSubtitle(currProj.value.id, subForm.text, subForm.startTime, subForm.endTime);
      s.color = subForm.color;
      s.backgroundColor = subForm.backgroundColor;
      s.displayMode = "fadeIn";
      currProj.value.subtitles.push(s);
    }
    // Reset form with smart defaults
    const lastSub = sortedSubtitles.value[sortedSubtitles.value.length - 1];
    subForm.startTime = lastSub ? lastSub.endTime : 0;
    subForm.endTime = duration.value > 0 ? duration.value : subForm.startTime + 5;
    subForm.text = "";
    activeSubId = null;
  }

  function editSub(s: Subtitle) {
    editingSId = s.id;
    subForm.startTime = s.startTime;
    subForm.endTime = s.endTime;
    subForm.text = s.text;
    subForm.color = s.color;
    subForm.backgroundColor = s.backgroundColor ?? SUBTITLE_DEFAULT_BACKGROUND;
    subForm.displayMode = "fadeIn";
  }

  function delSub(s: Subtitle) {
    ElMessageBox.confirm("确定删除此字幕？", "确认", { type: "warning" })
      .then(() => {
        if (currProj.value) {
          const i = currProj.value.subtitles.findIndex(x => x.id === s.id);
          if (i !== -1) currProj.value.subtitles.splice(i, 1);
          if (editingSId === s.id) editingSId = null;
          activeSubId = null;
        }
      })
      .catch(() => {});
  }

  // Export
  async function doExport() {
    if (!currProj.value || chapters.value.length === 0) {
      toastShow("请先创建至少一个节点", "warning");
      return;
    }
    exporting.value = true;
    try {
      let vf: File | undefined;
      if (currProj.value.videoSrc?.startsWith("blob:")) {
        const r = await fetch(currProj.value.videoSrc);
        const b = await r.blob();
        vf = new File([b], "video.mp4", { type: b.type });
      }
      await exportPlayer(currProj.value as any, vf);
    } catch (e: any) {
      toastShow("导出失败: " + (e.message || "未知错误"), "error");
    } finally {
      exporting.value = false;
    }
  }

  // 预览模式
  function togglePreview() {
    if (viewOnly.value) return;
    if (!hasVideo.value || chapters.value.length === 0) {
      toastShow("请先上传视频并创建节点", "warning");
      return;
    }
    isPreviewMode.value = !isPreviewMode.value;
    syncVideoAudioState();
    if (isPreviewMode.value) {
      if (videoEl.value && chapters.value.length > 0) {
        void startChapterPlayback(timelineChapters.value[0]);
      }
    }
    setTimeout(handleResize, 100);
  }

  // Keyboard
  function onKey(e: KeyboardEvent) {
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
    if (e.code === "Space") {
      e.preventDefault();
      togglePlay();
    }
    if (e.code === "ArrowLeft") {
      e.preventDefault();
      if (hasChapters.value) prevCh();
    }
    if (e.code === "ArrowRight") {
      e.preventDefault();
      if (hasChapters.value) nextCh();
    }
    if (e.code === "Escape" && isPreviewMode.value && !viewOnly.value) {
      togglePreview();
    }
  }

  // Resize
  function handleResize() {
    if (!viewportEl.value || !renderer || !camera) return;
    const w = viewportEl.value.clientWidth;
    const h = viewportEl.value.clientHeight;
    if (w <= 0 || h <= 0) return;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
    if (composer) composer.setSize(w, h);
    if (viewOnly.value || isPreviewMode.value) adaptPresentationViewport();
  }

  watch(isPreviewMode, () => {
    syncVideoAudioState();
    nextTick(() => {
      syncOrbitControlsDom();
      handleResize();
      adaptPresentationViewport();
    });
  });

  watch([selModelId, selectedChapterId], (_vals, oldVals) => {
    const prevModelId = oldVals?.[0];
    const prevChapterId = oldVals?.[1];
    if (prevModelId) hidePivotHelpers(prevModelId);
    updateSelectionHighlight();

    const ch = getActiveChapter();
    if (selectedChapterId.value && selectedChapterId.value !== prevChapterId && ch) {
      applyChapterModelVisibility(ch);
      syncModelSelectionForChapter(ch);
    } else if (selModel.value) {
      syncModelForm(ch);
    }

    lastIntroStateKey = "";
    syncIntroPresentation();
  });

  watch(selModelNodeId, () => {
    // When sub-node selection changes on same model, hide previous pivot indicator
    if (selModelId.value) hidePivotHelpers(selModelId.value);
    updateSelectionHighlight();
    if (selModelId.value) {
      syncModelForm(getActiveChapter());
      syncMaterialUiFromModel();
      modelFormRevision.value++;
    }
  });

  watch(selModelId, id => {
    if (id) syncMaterialUiFromModel();
  });

  watch(rightTab, tab => {
    if (tab === "model") restoreLastModelSelection();
  });

  function ensureModelChapterConfigs(_modelId: string) {}

  // Lifecycle
  onMounted(async () => {
    const queryCode = (route.query.code as string) || "";
    const isViewMode = (route.query.mode as string) === "view" && !!queryCode;
    const routeProjectId = (route.query.id as string) || "";

    if (isViewMode) {
      viewOnly.value = true;
      isPreviewMode.value = true;
      const p = pStore.createProject("");
      projectTitle.value = p.title;
      await nextTick();
      init3D();
      const result = await loadSceneByCode(queryCode);
      if (result === "not-found") {
        await router.replace("/404");
        return;
      }
      viewCameraBaseFov = camera?.fov ?? null;
      adaptPresentationViewport();
      routeGateLoading.value = false;
      handleResize();
      window.addEventListener("resize", handleResize);
      if (timelineChapters.value.length > 0) void startChapterPlayback(timelineChapters.value[0]);
      return;
    }

    const editMeta = queryCode ? await loadEditSceneMeta(queryCode) : null;
    const defaultTitle = editMeta?.name?.trim() || "演示项目";

    if (queryCode) {
      modelSetCode.value = queryCode;
      pendingModelSetCode.value = queryCode;
      modelSetModelsLoaded.value = false;
      sceneCode.value = null;
      shareLink.value = "";

      const existing = routeProjectId ? (pStore.projects.find(p => p.id === routeProjectId) as any) : null;
      const canReuse =
        existing && !existing.videoSrc && (existing.chapters?.length || 0) === 0 && (existing.models?.length || 0) === 0;
      if (canReuse) {
        pStore.setCurrentProject(existing as any);
        projectTitle.value = defaultTitle;
        existing.title = defaultTitle;
      } else {
        pStore.clearCurrentProject();
        const p = pStore.createProject(defaultTitle);
        projectTitle.value = defaultTitle;
        if (routeProjectId !== p.id) await router.replace({ query: { code: queryCode, id: p.id } });
      }
      setPageTitle(defaultTitle);
    } else {
      pStore.clearInvalidVideoData();
      if (routeProjectId) {
        const p = pStore.projects.find(p => p.id === routeProjectId);
        if (p) {
          pStore.setCurrentProject(p as any);
          projectTitle.value = p.title;
        }
      }
      if (!currProj.value) {
        const p = pStore.createProject(defaultTitle);
        projectTitle.value = p.title;
        await router.replace({ query: { id: p.id } });
      }
    }

    routeGateLoading.value = false;
    pStore.clearInvalidVideoData();
    await nextTick();
    init3D();

    if (videoSrc.value) {
      syncVideoElementSrc();
      duration.value = currProj.value?.videoDuration || 0;
      if (duration.value > 0) {
        ensureDefaultChapter(duration.value);
        normalizeProjectChapterRanges();
      }
    }

    // 模型改为手动添加，不自动注入默认模型
    for (const m of models.value) {
      if (m.url && !meshes.has(m.id)) await loadGLB(m);
    }
    for (const m of models.value) {
      refreshModelHierarchyIfLoaded(m.id, m.name);
    }

    if (chapters.value.length > 0) {
      selectedChapterId.value = chapters.value[0].id;
      if (meshes.size > 0) {
        applyChapterCameraForLoadedModels();
      } else {
        applyChapter(chapters.value[0]);
        syncChapterForm(chapters.value[0]);
      }
      syncModelSelectionForChapter(chapters.value[0]);
    }

    handleResize();
    window.addEventListener("resize", handleResize);
    setTimeout(() => rootEl.value?.focus(), 100);
  });

  onUnmounted(() => {
    cancelAnimationFrame(afid);
    unbindViewportPicking();
    unbindControlsInteraction();
    clearHoverHighlight();
    clearSelectionHighlight();
    composer?.dispose?.();
    meshes.forEach((_, id) => rmMesh(id));
    disposeViewportEnvironment(envMap);
    envMap = null;
    renderer?.dispose();
    dracoLoader?.dispose?.();
    clearInterval(subTimer);
    window.removeEventListener("resize", handleResize);
  });

  type DomRefKey =
    | "rootEl"
    | "viewportEl"
    | "canvasEl"
    | "videoEl"
    | "subEl"
    | "trackEl"
    | "tooltipEl"
    | "fileInputEl"
    | "multiFileInput"
    | "folderInput";

  const domRefMap = {
    rootEl,
    viewportEl,
    canvasEl,
    videoEl,
    subEl,
    trackEl,
    tooltipEl,
    fileInputEl,
    multiFileInput,
    folderInput
  };

  /** 绑定模板 DOM 引用到 composable */
  const bindRef = (key: DomRefKey) => {
    return (el: unknown) => {
      domRefMap[key].value = el as never;
    };
  };

  return reactive({
    bindRef,
    Close,
    Delete,
    Download,
    Loading,
    MoreFilled,
    Plus,
    Setting,
    VideoPause,
    VideoPlay,
    View,
    projectTitle,
    currentTime,
    duration,
    isPlaying,
    isLooping,
    playbackRate,
    playbackRateLabel,
    playbackHintVisible,
    playbackHintFading,
    playingIdx,
    selectedChapterId,
    chapterNavLock,
    selModelId,
    selModelNodeId,
    hoverModelId,
    hoverModelNodeId,
    hoverModelInList,
    clearHoverModelInList,
    isModelCardHovered,
    isModelNodeHovered,
    selModelNode,
    hierarchyRevision,
    getModelHierarchy,
    modelHasEdits,
    modelNodeHasEdits,
    pickOnlyVisible,
    togglePickOnlyVisible,
    selectModelNode,
    modelFormRevision,
    cameraFormRevision,
    getChapterFormSnapshot,
    applyChapterFormSnapshot,
    chInfoOpen,
    camOpen,
    exporting,
    displaySubtitle,
    tooltipText,
    isPreviewMode,
    viewOnly,
    routeGateLoading,
    rightTab,
    videoFps,
    modelSetCode,
    pendingModelSetCode,
    sceneCode,
    shareLink,
    savingScene,
    sceneListVersion,
    chapterFormRevision,
    chForm,
    subForm,
    mOff,
    mScl,
    mVis,
    mHL,
    mAni,
    mRot,
    mHLColor,
    mIntro,
    mOut,
    mdTab,
    animDuration,
    animLoop,
    animEasing,
    animSegments,
    editingSeg,
    editingSegMode,
    totalPlaying,
    totalProgress,
    animDirty,
    remoteUrl,
    videoSourceTab,
    isDragOver,
    showVideoPip,
    modelIntroLabels,
    importingModel,
    showSettings,
    spTab,
    ambIntensity,
    dirIntensity,
    dirPos,
    fillIntensity,
    fillPos,
    matColor,
    matRoughness,
    matMetalness,
    matNormalStr,
    matEmissiveInt,
    matAoInt,
    bloomIntensity,
    bloomThreshold,
    bloomRadius,
    ppExposure,
    ppContrast,
    ppSaturation,
    toneMapping,
    envIntensityVal,
    envMapUrl,
    envMapPreview,
    bgColorVal,
    fogEnabled,
    fogNear,
    fogFar,
    shadowEnabled,
    shadowIntensity,
    shadowMapSize,
    shadowBias,
    shadowNormalBias,
    shadowType,
    gridVisible,
    gridSize,
    gridDivisions,
    gridHeight,
    camP,
    camT,
    camFov,
    rootEl,
    viewportEl,
    canvasEl,
    videoEl,
    subEl,
    trackEl,
    tooltipEl,
    fileInputEl,
    multiFileInput,
    folderInput,
    currProj,
    hasVideo,
    hasChapters,
    canAddChapter,
    currentChapterIdx,
    videoSrc,
    videoWidth,
    videoHeight,
    chapters,
    sortedChapters,
    timelineChapters,
    chapterTreeList,
    models,
    subtitles,
    selectedChapter,
    selectedChapterTimeBounds,
    selModel,
    chapterModels,
    modelDisplayName,
    sortedSubtitles,
    chapterSubtitles,
    fmt,
    pct,
    fillScale,
    chapterFillPct,
    chapterSegmentFlex,
    chapterSegmentStyle,
    toastShow,
    uploadVideo,
    removeVideo,
    onDragOver,
    onDragLeave,
    onVideoDrop,
    triggerVideoUpload,
    onVideoFileChange,
    loadRemoteVideo,
    togglePlay,
    cyclePlaybackRate,
    markAnimDirty,
    resetAnimConfig,
    saveAnimConfig,
    playSegOnce,
    playAllSegments,
    focusSegTransform,
    liveSeg,
    onRotChange,
    onPivotChange,
    seekTrack,
    jumpToChapter,
    startChapterPlayback,
    prevCh,
    nextCh,
    toggleLoop,
    saveTitle,
    selectChapter,
    playChapter,
    addChapter,
    addChildChapter,
    canAddChildChapter,
    getChapterChildren,
    getAllDescendantChapterIds,
    isChapterPlaying,
    chCmd,
    saveChF,
    saveChapterFull,
    deleteChapter,
    liveCam,
    liveFov,
    getCameraFormSnapshot,
    applyCameraFormSnapshot,
    captureCam,
    previewCam,
    selectModel,
    pickModelAtViewport,
    importCmd,
    onMultiFileChange,
    onFolderChange,
    importGLB,
    delModel,
    getModelFormSnapshot,
    applyModelFormSnapshot,
    applyMCfgLive,
    addOrUpdateSub,
    editSub,
    delSub,
    doExport,
    saveSceneToServer,
    loadSceneByCode,
    loadSceneForEdit,
    togglePreview,
    onKey,
    onMeta,
    onTick,
    onVideoPlay,
    onVideoPause,
    onVideoEnd,
    onVideoErr,
    applySettings,
    applyToneMapping,
    applyFog,
    resetSceneSettings,
    applyMatToCurModel,
    syncMaterialUiFromModel,
    applyEnvironmentMapFile,
    clearEnvironmentMap,
    toggleBloom,
    toggleColor,
    applyGrid,
    applyEnv,
    applyShadow,
    EASING_LIST,
    CURVE_LABELS,
    TONE_MAPPING_OPTIONS
  });
}
