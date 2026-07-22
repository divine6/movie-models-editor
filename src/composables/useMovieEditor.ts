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
import { dracoDecoderPath } from "@/utils/projectAssets";
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
  fetchSceneList,
  fetchScene,
  isTransientMediaUrl,
  rewireEditorFrontendHost,
  rewireEditorServerHost,
  resolveAssetUrl,
  saveScene as saveSceneToBackend,
  toPersistableAssetPath,
  unwrapTransientMediaUrl,
  updateScene as updateSceneOnBackend,
  uploadSceneVideo
} from "@/api/modules/editor-server";
import {
  ANTIALIASING_MODE_OPTIONS,
  CHAPTER_END_EPS,
  CHAPTER_TIME_EPS,
  DEFAULT_ANIMATION_NODE_DURATION,
  MIN_ANIMATION_NODE_DURATION,
  CHAPTER_CAMERA_SWITCH_EDIT_SEC,
  CHAPTER_CAMERA_SWITCH_MAX_SEC,
  CHAPTER_CAMERA_SWITCH_MIN_SEC,
  CHAPTER_CAMERA_SWITCH_PLAYBACK_SEC,
  CURVE_LABELS,
  DEFAULT_SCENE_SETTINGS,
  EASING_LIST,
  getSceneSettingsStorageKey,
  PLAYBACK_RATES,
  SCENE_SETTINGS_STORAGE_KEY,
  SEEK_EVENT_TIMEOUT_MS,
  SEEK_READY_TIMEOUT_MS,
  normalizeAntialiasRatio,
  normalizeTargetFps,
  resolveEditorRenderPixelRatio,
  TARGET_FPS_OPTIONS,
  TONE_MAPPING_MAP,
  TONE_MAPPING_OPTIONS,
  type AntialiasingMode,
  type TargetFps
} from "@/composables/movie-editor/constants";
export { MOVIE_EDITOR_KEY } from "@/composables/movie-editor/keys";
import { MOVIE_EDITOR_KEY } from "@/composables/movie-editor/keys";
import { ColorCorrectionShader } from "@/composables/movie-editor/shaders/colorCorrection";
import { FXAAPass } from "three/addons/postprocessing/FXAAPass.js";
import { SMAAPass } from "three/addons/postprocessing/SMAAPass.js";
import { mapStoredAnimSegment, nextAnimSegmentId, roundAnimNum } from "@/composables/movie-editor/utils/animation";
import { createDefaultModelConfig, getModelConfig, DEFAULT_OUTLINE_COLOR, DEFAULT_WIREFRAME_COLOR, DEFAULT_MODEL_HIGHLIGHT_COLOR } from "@/composables/movie-editor/utils/modelConfig";
import {
  buildSceneLightRuntime,
  computeSceneLightPosition,
  createDefaultSceneLight,
  disposeSceneLightRuntime,
  migrateLegacySceneLights,
  syncSceneLightRuntime,
  type SceneLightRuntime
} from "@/composables/movie-editor/sceneLights";
import { createTimelineHelpers } from "@/composables/movie-editor/utils/timeline";
import { exportPlayer } from "@/composables/usePlayerExport";
import { resumeProjectPersist, suspendProjectPersist } from "@/utils/projectPersist";
import { createSceneNodeEditorApi } from "@/composables/movie-editor/sceneNodeEditorApi";
import { getDescendantChapterIds } from "@/utils/chapterTree";
import { ensureProjectNodes, SCHEMA_VERSION } from "@/utils/sceneMigration";
import {
  flattenSceneNodeTree,
  getAnimationNodes,
  getNodeById,
  getParentVideoNodeById,
  getTimelineAnimations,
  getVideoAnimations,
  isAnimationNode,
  isVideoNode,
  getDescendantNodeIds,
  getChildNodes,
  getRootNodes,
  resolveActiveAnimationAtTime
} from "@/utils/sceneNodeTree";
import { isCoarsePointerDevice, withVideoPosterFragment } from "@/utils/device";
import {
  type Chapter,
  type Model,
  type ModelType,
  type SceneNode,
  type SceneVideoNode,
  type ModelConfig,
  type ModelHierarchyNode,
  type Subtitle,
  SUBTITLE_DEFAULT_BACKGROUND,
  SUBTITLE_TEXT_MAX_LENGTH
} from "@/interface/project";
import type { SceneLightSettings, SceneLightType } from "@/interface/sceneLight";
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
import { createEnvReflectionProbe, type EnvReflectionProbe } from "@/utils/three/envReflectionProbe";
import { applyMeshTextureQuality, resolvePresentationPixelRatio } from "@/utils/three/presentationQuality";
import {
  applyGltfSpecularGlassReflection,
  clearBoundSceneEnvMaps,
  prepareGltfMaterials,
  updateGltfMaterialBaseOverrides
} from "@/utils/three/gltfMaterials";
import { detectGpuTierProfile, type GpuTierProfile } from "@/utils/three/gpuTier";
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
  type PresentationPlaybackPhase = "paused" | "playing" | "seeking" | "ended" | "blocked";
  type PresentationPlaybackIntent = "play" | "pause";
  type PresentationPlaybackSession = {
    phase: PresentationPlaybackPhase;
    intent: PresentationPlaybackIntent;
    committedTime: number;
    targetTime: number;
    navChapterId: string | null;
    playableChapterId: string | null;
    requestId: number;
    autoAdvance: boolean;
  };
  const presentationPlaybackSession = reactive<PresentationPlaybackSession>({
    phase: "paused",
    intent: "pause",
    committedTime: 0,
    targetTime: 0,
    navChapterId: null,
    playableChapterId: null,
    requestId: 0,
    autoAdvance: false
  });
  const isLooping = ref(true);
  const playbackRate = ref<number>(1);
  const playingIdx = ref(-1);
  const selectedChapterId = ref<string | null>(null);
  const selectedNodeId = ref<string | null>(null);
  const activeVideoId = ref<string | null>(null);
  const expandedNodeIds = ref<Set<string>>(new Set());
  const sceneNodeDraggingId = ref<string | null>(null);
  const sceneNodeDropTargetId = ref<string | null>(null);
  const sceneNodeDropKind = ref<"allow" | "forbid" | null>(null);
  const videoNodeUploadTargetId = ref<string | null>(null);
  const videoOnlyMode = ref(false);
  const selModelId = ref<string | null>(null);
  const selModelNodeId = ref<string | null>(null);
  const hoverModelId = ref<string | null>(null);
  const hoverModelNodeId = ref<string | null>(null);
  const modelHierarchies = reactive<Record<string, ModelHierarchyNode[]>>({});
  const hierarchyRevision = ref(0);
  let lastSelModelId: string | null = null;
  const modelFormRevision = ref(0);
  const animSegmentRevision = ref(0);
  const cameraFormRevision = ref(0);
  const chapterFormRevision = ref(0);
  // 折叠面板状态
  const chInfoOpen = ref(false);
  const camOpen = ref(false);
  const exporting = ref(false);
  const displaySubtitle = ref(false);
  const tooltipText = ref("");
  const viewOnly = ref((route.query.mode as string) === "view" && !!(route.query.code as string));
  /** 编辑页内预览：仅内存切换，不跟随 URL mode=preview（避免 fullPath 变化整页重挂载） */
  const isPreviewMode = ref(viewOnly.value);
  const editorBootLoading = ref(true);
  const editorInitializing = computed(() => editorBootLoading.value || sceneBootstrapBusy.value);
  const rightTab = ref("model");
  const videoFps = ref(0);
  const modelSetCode = ref<string | null>(null);
  const pendingModelSetCode = ref<string | null>(null);
  const modelSetModelsLoaded = ref(false);
  /** 编辑场景链接 (?code=) 进入：模型需等上传视频后再加载（场景列表「修改」除外） */
  const editSceneLinkEntry = ref(
    !!(route.query.code as string) && (route.query.mode as string) !== "view"
  );
  const sceneCode = ref<string | null>(null);
  const shareLink = ref("");
  const sceneSavedAt = ref("");
  const savingScene = ref(false);
  const sceneListVersion = ref(0);
  /** 当前模型集下已保存场景数量（编辑列表≥1 才可打开） */
  const savedSceneCount = ref(0);
  const sceneSavedSignature = ref("");
  const editSceneCompanyName = ref("");
  const editSceneToolName = ref("");

  async function refreshSavedSceneCount() {
    const code = modelSetCode.value;
    if (!code) {
      savedSceneCount.value = 0;
      return;
    }
    try {
      const list = await fetchSceneList(code);
      savedSceneCount.value = Array.isArray(list) ? list.length : 0;
    } catch {
      savedSceneCount.value = 0;
    }
  }

  const canOpenSceneList = computed(() => !!modelSetCode.value && savedSceneCount.value >= 1);

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
  const roundInt = (n: number) => Math.round(Number(n) || 0);
  const round3 = (n: number) => roundAnimNum(Number(n) || 0, 3);
  const roundVec3 = (v: [number, number, number]): [number, number, number] => [round3(v[0]), round3(v[1]), round3(v[2])];

  let editingSId: string | null = null;
  const mOff = reactive([0, 0, 0]);
  const mScl = ref(1);
  const mVis = ref(true);
  const mHL = ref(false);
  const mAni = ref(true);
  const mWire = ref(false);
  const mRot = reactive([0, 0, 0]);
  const mOutlineColor = ref(DEFAULT_OUTLINE_COLOR);
  const mWireColor = ref(DEFAULT_WIREFRAME_COLOR);
  const mHLColor = ref(DEFAULT_MODEL_HIGHLIGHT_COLOR);
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
  let chAnimChapterId: string | null = null;
  let editPlaybackSyncChapterId: string | null = null;
  let editPlaybackSyncElapsed = -1;
  let lastVideoPlaybackSyncTime = -1;
  /** 编辑态播放中已运镜的章节，避免 timeupdate 重复触发镜头 */
  let editPlaybackCameraChapterId: string | null = null;
  let chAnimWallclock = false;
  let chAnimWallclockStart = 0;
  let chAnimWallclockMaxDur = 0;
  let videoAnimLastSyncAt = 0;
  let chapterAnimTargetsCache: {
    chapterId: string;
    targets: Array<{ objs: THREE.Object3D[]; cfg: ModelConfig; liveSegs?: any[] }>;
  } | null = null;
  const chapterPlayTarget = ref<Chapter | null>(null);
  /** 展示/预览：切换过程中暂存的 UI 节点 id */
  const presentationUiChapterId = ref<string | null>(null);
  /** 展示/预览：导航列表中的当前索引（暂停/章节边界时与视频时间解耦） */
  const presentationNavIndex = ref(-1);
  /** 展示/预览：列表高亮修订号，强制树节点重算 active */
  const presentationUiRevision = ref(0);
  const chapterAutoNext = ref(false);
  /** 展示/预览模式章节衔接中：避免 pause 回调误停动画 */
  let presentationChapterTransition = false;
  /** 展示态跳转后应当继续播放：忽略 seek 引起的 pause，并强制续播 */
  let presentationExpectPlaying = false;
  /** 用户显式暂停：忽略 seek/ended 触发的误 play */
  let presentationUserWantsPaused = false;
  let presentationResumeTimer: ReturnType<typeof setTimeout> | null = null;
  const chapterNavLock = ref(false);
  const isCameraTransitioning = ref(false);
  let seekGeneration = 0;
  let chapterNavGeneration = 0;
  let lastSyncedModelFormChapterId: string | null = null;
  let videoChapterSyncPaused = false;
  let chapterNavFollowUpRaf = 0;
  let chapterPlaybackRequestSeq = 0;
  let presentationChapterCooldownUntil = 0;
  /** 用户手动 seek/左右键后短时间内钉住列表高亮（与自动切段 cooldown 分离） */
  let presentationManualNavUntil = 0;
  /** 展示态 seek 目标：媒体未落点前禁止用 video.currentTime 回刷进度/动画 */
  let presentationSeekTargetTime: number | null = null;
  let lastPresentationAutoSwitchChapterId: string | null = null;
  let lastPresentationPlaybackChapterId: string | null = null;
  /** 片尾 UI 已同步过一次，避免每帧 resolve */
  let presentationEndedUiSynced = false;
  let segmentPlaybackRafId: number | null = null;
  let segmentPlaybackGeneration = 0;
  let activeSegmentPlaybackSeg: any = null;
  let sceneModelCenterValid = false;
  const _cachedSceneModelCenter = new THREE.Vector3();
  const totalPlaying = ref(false);
  const totalProgress = ref(0);
  const animDirty = ref(false);
  /** live animSegments 归属的 chapterId|modelId::nodeId，防止切动画时误把旧段落写入其它节点 */
  let animSegmentsOwnerKey: string | null = null;

  type SelectionEditDraft = {
    animSegments: any[];
    animDuration: number;
    animEasing: string;
    animDirty: boolean;
    form: {
      visible: boolean;
      outline: boolean;
      wireframe: boolean;
      highlight: boolean;
      outlineColor: string;
      wireframeColor: string;
      modelHighlightColor: string;
      posOffsetX: number;
      posOffsetY: number;
      posOffsetZ: number;
      scale: number;
      rotX: number;
      rotY: number;
      rotZ: number;
      animation: boolean;
      intro: string;
    };
  };
  /** 同节点内切换模型/子层级时的编辑会话（未切换节点前不写 chapter.modelConfigs） */
  const selectionEditDrafts = new Map<string, SelectionEditDraft>();
  const remoteUrl = ref("");
  const videoSourceTab = ref<"local" | "url">("local");
  const isDragOver = ref(false);
  const showVideoPip = ref(false);
  const modelIntroLabels = ref<Array<{ modelId: string; nodeId: string | null; text: string; x: number; y: number }>>([]);
  const playbackHintVisible = ref(false);
  const playbackHintFading = ref(false);
  let playbackHintTimer: ReturnType<typeof setTimeout> | null = null;
  let playbackHintFadeTimer: ReturnType<typeof setTimeout> | null = null;
  let introPresentationChapterId: string | null = null;
  let introPresentationPlaying = false;
  let lastIntroStateKey = "";
  const _introWorldPos = new THREE.Vector3();
  const _overlayAttachPos = new THREE.Vector3();
  const _overlayAttachQuat = new THREE.Quaternion();
  const _overlayAttachScale = new THREE.Vector3();
  const _overlayAttachMat = new THREE.Matrix4();
  const importingModel = ref(false);
  const sceneBootstrapBusy = ref(false);
  const showSettings = ref(false);
  const spTab = ref("lighting");

  // Lighting
  const ambIntensity = ref(DEFAULT_SCENE_SETTINGS.ambIntensity);
  const sceneLights = ref<SceneLightSettings[]>(
    migrateLegacySceneLights({
      dirIntensity: DEFAULT_SCENE_SETTINGS.dirIntensity,
      fillIntensity: DEFAULT_SCENE_SETTINGS.fillIntensity
    })
  );
  const selectedSceneLightId = ref<string | null>(sceneLights.value[0]?.id ?? null);
  const sceneLightRuntimes = new Map<string, SceneLightRuntime>();
  // Material (per-model)
  const matColor = ref(DEFAULT_SCENE_SETTINGS.matColor);
  const matRoughness = ref(DEFAULT_SCENE_SETTINGS.matRoughness);
  const matMetalness = ref(DEFAULT_SCENE_SETTINGS.matMetalness);
  const matNormalStr = ref(DEFAULT_SCENE_SETTINGS.matNormalStr);
  const matEmissiveInt = ref(DEFAULT_SCENE_SETTINGS.matEmissiveInt);
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
  const envReflectionIntensity = ref(DEFAULT_SCENE_SETTINGS.envReflectionIntensity);
  const envRotation = ref(DEFAULT_SCENE_SETTINGS.envRotation);
  const envReflectionSphereVisible = ref(DEFAULT_SCENE_SETTINGS.envReflectionSphereVisible);
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
  const msaaEnabled = ref(DEFAULT_SCENE_SETTINGS.msaaEnabled);
  const antialiasingMode = ref<AntialiasingMode>(DEFAULT_SCENE_SETTINGS.antialiasingMode);
  const maxPixelRatio = ref(DEFAULT_SCENE_SETTINGS.maxPixelRatio);
  /** 当前实际生效的渲染像素比（切换 2/4/8 后可在面板查看） */
  const effectiveRenderPixelRatio = ref(DEFAULT_SCENE_SETTINGS.maxPixelRatio);
  const targetFps = ref<TargetFps>(DEFAULT_SCENE_SETTINGS.targetFps);
  const displayFps = ref(0);
  let viewportLastPresentAt = 0;
  let viewportFpsAccumMs = 0;
  let viewportFpsFrameCount = 0;
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
  const nodes = computed(() => {
    if (currProj.value) ensureProjectNodes(currProj.value);
    return currProj.value?.nodes || [];
  });
  const activeVideoNode = computed(() => {
    if (!activeVideoId.value) return null;
    const n = getNodeById(nodes.value, activeVideoId.value);
    return n && isVideoNode(n) ? n : null;
  });
  const hasVideo = computed(() => !!activeVideoNode.value?.videoSrc);
  const showNodePanel = computed(() => !!currProj.value && (!viewOnly.value || nodes.value.length > 0));
  watch(hasVideo, function (v, prev) {
    // 编辑态未打开视频窗时，不自动挂载 video src
    if (v && (viewOnly.value || isPreviewMode.value || showVideoPip.value)) {
      syncVideoElementSrc();
    }
    if (!v) {
      if (videoEl.value) delete videoEl.value.dataset.editorSrc;
      return;
    }
    if (!pendingModelSetCode.value || modelSetModelsLoaded.value) return;
    if (editSceneLinkEntry.value && prev !== false) return;
    void tryLoadPendingModelSet();
  });
  const videoSrc = computed(() => activeVideoNode.value?.videoSrc || "");
  watch(videoSrc, (src, prev) => {
    if (!src || src === prev) return;
    if (viewOnly.value || isPreviewMode.value || showVideoPip.value) {
      syncVideoElementSrc(src);
    }
  });
  const videoWidth = computed(() => activeVideoNode.value?.videoWidth || 0);
  const videoHeight = computed(() => activeVideoNode.value?.videoHeight || 0);
  const chapters = computed(() => getAnimationNodes(nodes.value));
  const sortedChapters = computed(() => [...chapters.value].sort((a, b) => a.startTime - b.startTime));
  const timelineChapters = computed(() => getTimelineAnimations(nodes.value, activeVideoId.value));
  const chapterTreeList = computed(() =>
    flattenSceneNodeTree(nodes.value).map(item => ({
      chapter: item.node as Chapter,
      depth: item.depth
    }))
  );
  const hasChapters = computed(() => chapters.value.length > 0);
  const rootSceneNodes = computed(() => getRootNodes(nodes.value));
  const currentChapterIdx = computed(() => findChIdx(currentTime.value));
  const presentationNavChapterCount = computed(() => getPresentationNavChapters().length);
  const presentationNavChapters = computed(() => getPresentationNavChapters());
  const presentationTimelineChapterIdx = computed(() => {
    if (!viewOnly.value && !isPreviewMode.value) return currentChapterIdx.value;
    const navIdx = getActivePresentationNavIndex();
    if (navIdx >= 0) return navIdx;
    const activeId = getActiveChapterIdForUi();
    if (!activeId) return currentChapterIdx.value;
    const ch = chapters.value.find(c => c.id === activeId);
    if (!ch) return currentChapterIdx.value;
    return getTimelineChapterIndex(ch);
  });
  const presentationDisplayTime = computed(() =>
    presentationPlaybackSession.phase === "seeking"
      ? presentationPlaybackSession.targetTime
      : presentationPlaybackSession.committedTime
  );
  const presentationCurrentNavChapterId = computed(
    () => presentationPlaybackSession.navChapterId
  );
  const presentationDisplayPlaying = computed(
    () =>
      presentationPlaybackSession.intent === "play" &&
      (presentationPlaybackSession.phase === "playing" ||
        presentationPlaybackSession.phase === "seeking")
  );
  watch(presentationDisplayTime, value => {
    if (viewOnly.value || isPreviewMode.value) currentTime.value = value;
  });
  watch(presentationDisplayPlaying, value => {
    if (viewOnly.value || isPreviewMode.value) isPlaying.value = value;
  });
  /** 展示态意外暂停后的续播节流，避免 RAF/pause 回调打爆 play() */
  let presentationBlockedResumeAt = 0;
  /** 片尾循环命令节流，避免 seeking 卡住时既不重发也不前进 */
  let presentationLoopCommandAt = 0;
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
  const sceneDraftSignature = computed(() => buildSceneDraftSignature());
  const sceneHasUnsavedChanges = computed(
    () => !!sceneDraftSignature.value && sceneDraftSignature.value !== sceneSavedSignature.value
  );
  const canSaveScene = computed(
    () => hasVideo.value && chapters.value.length > 0 && sceneHasUnsavedChanges.value && !savingScene.value
  );

  /** 将当前草稿记为「已对齐已保存」，用于加载/刷新后消除误报红点 */
  function markSceneAsSavedBaseline() {
    sceneSavedSignature.value = buildSceneDraftSignature();
  }
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
    const parentId = selectedNodeId.value || selectedChapterId.value || activeVideoId.value;
    if (!parentId) return [];
    return sortedSubtitles.value.filter(s => s.parentNodeId === parentId);
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
  let sceneLightsGroup: THREE.Group;
  let composer: EffectComposer | undefined;
  let bloomPass: UnrealBloomPass;
  let colorPass: ShaderPass;
  let hueSatPass: ShaderPass;
  let brightContrastPass: ShaderPass;
  let fxaaPass: FXAAPass;
  let smaaPass: SMAAPass;
  let envMap: THREE.Texture | null = null;
  let envMapEquirect: THREE.Texture | null = null;
  let envMapSourceUrl: string | null = null;
  /** 已成功套用的环境贴图键（resolvedUrl|hdr），用于跳过重复 PMREM */
  let appliedEnvMapKey: string | null = null;
  let envMapLoadGen = 0;
  /** PMREM / RoomEnvironment 烘焙期间暂停视口绘制，避免与渲染循环抢 GPU */
  let envBakeBusy = false;
  let envReflectionProbe: EnvReflectionProbe | null = null;
  const textureLoader = new THREE.TextureLoader();
  const rgbeLoader = new RGBELoader();
  let outlinePass: OutlinePass;
  let hoverOutlinePass: OutlinePass;
  let modelConfigOutlinePass: OutlinePass;
  const modelConfigOutlineRegistry = new Map<THREE.Mesh, string>();
  const raycaster = new THREE.Raycaster();
  const pickPointer = new THREE.Vector2();
  const SELECTION_COLOR = 0x409eff;
  const HOVER_EDGE_COLOR = 0x66b3ff;
  const HIDDEN_EDGE_COLOR = 0x1a3a5f;
  const _pickNormal = new THREE.Vector3();
  const _pickView = new THREE.Vector3();
  const _gizmoWorldPos = new THREE.Vector3();
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
  /** 展示页触控双击：与桌面 dblclick 分工，避免单击误切播放 */
  let presentationTapGesture: { x: number; y: number; time: number } | null = null;
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
  let editorPerfScale = 1;
  let editorAvgFrameMs = 0;
  const editorFrameDts: number[] = [];
  let introLabelLastUpdateAt = 0;
  let lastHoverPickAtMs = 0;
  let lastBloomPostKey = "";
  let lastHoverOutlineKey = "";
  let lastHoverPickAt = { x: 0, y: 0 };
  const HOVER_PICK_MOVE_PX = 10;
  const HOVER_PICK_MIN_INTERVAL_MS = 90;
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

    // 热更新/重复初始化前先释放旧上下文，避免浏览器触发 “context loss blocked”
    if (renderer) {
      try {
        composer?.dispose?.();
      } catch {
        /* ignore */
      }
      composer = undefined;
      try {
        renderer.forceContextLoss?.();
      } catch {
        /* ignore */
      }
      try {
        renderer.dispose();
      } catch {
        /* ignore */
      }
      renderer = undefined as unknown as THREE.WebGLRenderer;
    }

    const coarse = isCoarsePointerDevice();
    const makeRenderer = (antialias: boolean) =>
      new THREE.WebGLRenderer({
        canvas: canvasEl.value!,
        antialias,
        // 手机用 default，high-performance 在部分机型更容易触发 context loss
        powerPreference: coarse ? "default" : "high-performance",
        alpha: false,
        depth: true,
        failIfMajorPerformanceCaveat: false
      });

    try {
      renderer = makeRenderer(true);
    } catch (e) {
      console.warn("[movie-editor] WebGL antialias init failed, retry without antialias", e);
      try {
        renderer = makeRenderer(false);
      } catch (e2) {
        console.error("[movie-editor] WebGL context create failed", e2);
        toastShow("3D 渲染初始化失败，请关闭其它 3D 页面后刷新", "error");
        throw e2;
      }
    }
    renderer.setPixelRatio(getRenderPixelRatio());
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
    controls.minDistance = 0.5;
    controls.maxDistance = 30;
    controls.maxPolarAngle = Math.PI / 2;
    bindControlsInteraction();
    syncOrbitControlsDom();
    syncPresentationInteractionMode();

    // 光照（初始值与 DEFAULT_SCENE_SETTINGS 一致，loadAllSettings 后会再同步）
    ambientLight = new THREE.AmbientLight(0xffffff, DEFAULT_SCENE_SETTINGS.ambIntensity);
    scene.add(ambientLight);

    sceneLightsGroup = new THREE.Group();
    sceneLightsGroup.name = "SceneLights";
    scene.add(sceneLightsGroup);
    syncSceneLights();

    // 地面 - 已移除；网格在 loadAllSettings 后由 applyGrid 创建
    try {
      loadAllSettings();
      applySettings();
      applyGrid();
      applyFog();
      if (shadowEnabled.value) applyShadow();
      // composer 常驻：渲染路径永不切换，避免选中/悬停时画面闪烁
      initComposer();
      applyAntialiasing();
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
    dracoLoader.setDecoderPath(dracoDecoderPath());
    // dracoLoader.setDecoderConfig({ type: "js" }); // 可选：强制使用 JS 解码器（调试用）
    gltfLoader.setDRACOLoader(dracoLoader);
    gltfLoader.setMeshoptDecoder(MeshoptDecoder);
    try {
      // 服务端场景会随后恢复设置；此处只建默认环境，避免与后续 HDR PMREM 竞态
      ensureDefaultViewportEnvironment();
      if (!skipStoredSceneSettings && envMapUrl.value) {
        void loadEnvironmentMapFromUrlAsync(envMapUrl.value, envMapIsHdr.value);
      } else {
        applyBackgroundFromSettings();
      }
    } catch (e) {
      console.warn("Viewport environment init failed", e);
    }
    bindWebGlContextGuards();
    bindViewportPicking();
    syncEditorGizmosVisibility();
    animate();
  }

  function bindWebGlContextGuards() {
    const canvas = canvasEl.value;
    if (!canvas || (canvas as any).__editorWebglGuards) return;
    (canvas as any).__editorWebglGuards = true;
    canvas.addEventListener(
      "webglcontextlost",
      (e: Event) => {
        e.preventDefault();
        console.error("[movie-editor] WebGL context lost");
        toastShow("3D 渲染上下文丢失，请刷新页面", "error");
      },
      false
    );
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
      if (isPresentationInteraction() && isPresentationUiTarget(e.target)) return;
      if (isPresentationInteraction()) {
        viewportPickState = { x: e.clientX, y: e.clientY, time: performance.now() };
        return;
      }
      orbitDragVisualsSuspended = false;
      viewportPickState = { x: e.clientX, y: e.clientY, time: performance.now() };
    };

    onCanvasPointerUp = (e: PointerEvent) => {
      if (e.button !== 0 || e.isPrimary === false || !viewportPickState) return;
      if (isPresentationUiTarget(e.target)) {
        viewportPickState = null;
        return;
      }
      const dx = e.clientX - viewportPickState.x;
      const dy = e.clientY - viewportPickState.y;
      const elapsed = performance.now() - viewportPickState.time;
      const wasDrag = Math.hypot(dx, dy) > 10 || elapsed > 600;
      viewportPickState = null;

      if (isPresentationInteraction()) {
        // 播放/暂停只允许：进度条按钮，或双击/双触屏幕。单击、左右键、列表不得切换。
        if (
          !wasDrag &&
          e.pointerType !== "mouse" &&
          (viewOnly.value || isPreviewMode.value)
        ) {
          const now = performance.now();
          const prev = presentationTapGesture;
          const nearPrev =
            !!prev &&
            Math.hypot(e.clientX - prev.x, e.clientY - prev.y) < 48 &&
            now - prev.time < 360;
          if (nearPrev) {
            presentationTapGesture = null;
            togglePlay();
          } else {
            presentationTapGesture = { x: e.clientX, y: e.clientY, time: now };
          }
        }
        return;
      }

      if (!wasDrag) {
        const picked = pickModelAtViewport(e.clientX, e.clientY);
        // 编辑模式点击画布空白处时清空当前模型选中
        if (!picked) {
          setSelectedModelId(null, false);
          clearHoverTarget();
        }
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

  function invalidateSceneModelCenterCache() {
    sceneModelCenterValid = false;
  }

  function getSceneModelCenter(out = _orbitPivotCenter): THREE.Vector3 | null {
    if (sceneModelCenterValid) {
      out.copy(_cachedSceneModelCenter);
      return out;
    }
    const box = new THREE.Box3();
    meshes.forEach(group => box.expandByObject(group));
    if (box.isEmpty()) return null;
    box.getCenter(out);
    _cachedSceneModelCenter.copy(out);
    sceneModelCenterValid = true;
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
    const h = viewportEl.value?.clientHeight ?? 600;
    let mul = 2.2;
    if (viewOnly.value || isPreviewMode.value) {
      if (w <= 480) mul = 3.45;
      else if (w <= 768) mul = 3.0;
      else mul = 2.4;
    }
    const minDist = w <= 480 ? 4.2 : w <= 768 ? 3.4 : 2.5;
    let desired = Math.max(maxDim * mul, minDist);
    const navSafePx = w <= 768 ? 64 : 40;
    const effectiveAspect = Math.max((w - navSafePx * 2) / Math.max(h, 1), 0.45);
    const portraitBoost = effectiveAspect < 0.85 ? 1.28 : 1.08;
    desired *= portraitBoost;
    if (controls?.maxDistance) {
      desired = Math.min(desired, controls.maxDistance * 0.92);
    }
    return desired;
  }

  function computePresentationSafeFitFrame(chapter?: Chapter | null): {
    position: [number, number, number];
    target: [number, number, number];
    fov: number;
  } | null {
    if (!camera || !controls || meshes.size === 0) return null;

    const viewport = viewportEl.value;
    const vw = viewport?.clientWidth ?? 0;
    const vh = viewport?.clientHeight ?? 0;
    if (vw <= 0 || vh <= 0) return null;

    const box = new THREE.Box3();
    meshes.forEach(group => box.expandByObject(group));
    if (box.isEmpty()) return null;
    box.getCenter(_focusCenter);
    box.getSize(_focusSize);

    const navSafePx = vw <= 768 ? 64 : 40;
    const topSafePx = viewOnly.value ? 96 : 72;
    const bottomSafePx = 120;
    const effectiveW = Math.max(vw - navSafePx * 2, vw * 0.48);
    const effectiveH = Math.max(vh - topSafePx - bottomSafePx, vh * 0.48);
    const aspect = effectiveW / effectiveH;

    const baseFov = viewCameraBaseFov ?? camera.fov;
    let fov = baseFov;
    if (vw <= 480) fov = Math.min(80, baseFov + 28);
    else if (vw <= 768) fov = Math.min(72, baseFov + 18);

    const vFovRad = THREE.MathUtils.degToRad(fov);
    const hFovRad = 2 * Math.atan(Math.tan(vFovRad / 2) * aspect);
    const halfW = Math.max(_focusSize.x, _focusSize.z) * 0.52;
    const halfH = _focusSize.y * 0.52;
    const fitDist = Math.max(halfW / Math.tan(hFovRad / 2), halfH / Math.tan(vFovRad / 2), 0.45) * 1.32;

    const storedFrame = chapter ? getStoredChapterCameraFrame(chapter) : null;
    if (storedFrame) {
      const st = new THREE.Vector3(...storedFrame.target);
      const sp = new THREE.Vector3(...storedFrame.position);
      const dir = sp.clone().sub(st);
      if (dir.lengthSq() > 1e-6) {
        dir.normalize();
        const distance = Math.max(fitDist, sp.distanceTo(st) * (vw <= 768 ? 1.15 : 1.05));
        return {
          position: [st.x + dir.x * distance, st.y + dir.y * distance, st.z + dir.z * distance],
          target: [st.x, st.y, st.z],
          fov: Math.max(fov, storedFrame ? chapter!.camera.fov : fov)
        };
      }
    }

    const distance = Math.max(fitDist, getPresentationCameraDistance(Math.max(_focusSize.x, _focusSize.y, _focusSize.z, 0.4)));
    _focusOffset.copy(_defaultCamViewDir).multiplyScalar(distance);
    return {
      position: [
        _focusCenter.x + _focusOffset.x,
        Math.max(_focusCenter.y + _focusOffset.y, _focusCenter.y + _focusSize.y * 0.25),
        _focusCenter.z + _focusOffset.z
      ],
      target: [_focusCenter.x, _focusCenter.y, _focusCenter.z],
      fov
    };
  }

  function shouldUsePresentationSafeFitCamera() {
    return (viewOnly.value || isPreviewMode.value) && isCoarsePointerDevice();
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

    // 编辑态：滚轮可推进到距模型约 0.5m；展示态仍保留更保守的下限以免穿模。
    const minOrbit =
      viewOnly.value || isPreviewMode.value
        ? Math.max(extent * 0.55, 1.5)
        : 0.5;
    let maxOrbit = Math.max(extent * 4.2, 14);
    if (viewOnly.value || isPreviewMode.value) {
      if (shouldUsePresentationSafeFitCamera()) {
        maxOrbit = Math.max(extent * 5.8, 22);
      } else {
        maxOrbit = Math.min(maxOrbit, Math.max(extent * 3.6, 12));
      }
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
    syncPresentationInteractionMode();
    const w = viewportEl.value?.clientWidth ?? 0;
    if (w <= 0) return;
    if (viewCameraBaseFov === null) viewCameraBaseFov = camera.fov;

    if (shouldUsePresentationSafeFitCamera()) {
      const frame = computePresentationSafeFitFrame(
        chapters.value.find(ch => ch.id === selectedChapterId.value) ?? getActiveChapter()
      );
      if (frame) {
        snapCam(frame.position, frame.target, frame.fov);
        syncSceneOrbitLimits();
        applyFog();
        controls.update();
        return;
      }
    }

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

  function syncPresentationInteractionMode() {
    if (!controls) return;
    controls.enabled = true;
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
    const now = performance.now();
    if (now - lastHoverPickAtMs < HOVER_PICK_MIN_INTERVAL_MS) return;
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
      lastHoverPickAtMs = performance.now();
      updateHoverHighlight(x, y);
    });
  }

  function isEditorGizmoVisible() {
    return !viewOnly.value && !isPreviewMode.value;
  }

  function hideAllPivotHelpers() {
    for (const id of [...pivotHelpers.keys()]) {
      hidePivotHelpers(id);
    }
  }

  function syncEditorGizmosVisibility() {
    const visible = isEditorGizmoVisible();
    for (const runtime of sceneLightRuntimes.values()) {
      runtime.gizmo.visible = visible;
    }
    if (envReflectionProbe) {
      envReflectionProbe.group.visible = visible && envReflectionSphereVisible.value;
    }
    if (!visible) {
      hideAllPivotHelpers();
    }
  }

  function layoutEditorGizmosNearScene() {
    if (!scene) return;
    const box = new THREE.Box3();
    meshes.forEach(group => box.expandByObject(group));
    if (box.isEmpty()) return;

    box.getCenter(_focusCenter);
    box.getSize(_focusSize);
    const extent = Math.max(_focusSize.x, _focusSize.y, _focusSize.z, 0.6);

    if (envReflectionProbe) {
      envReflectionProbe.group.position.set(
        _focusCenter.x + extent * 0.42,
        _focusCenter.y + Math.max(_focusSize.y * 0.25, 0.2),
        _focusCenter.z + extent * 0.12
      );
    }
  }

  function updateEditorGizmoScales() {
    if (!isEditorGizmoVisible() || !camera) return;

    const applyScreenScale = (obj: THREE.Object3D) => {
      obj.getWorldPosition(_gizmoWorldPos);
      const dist = camera.position.distanceTo(_gizmoWorldPos);
      const s = THREE.MathUtils.clamp(dist * 0.055, 0.4, 2.2);
      obj.scale.setScalar(s);
    };

    for (const runtime of sceneLightRuntimes.values()) {
      if (runtime.gizmo.visible) applyScreenScale(runtime.gizmo);
    }
    if (envReflectionProbe?.group.visible) {
      applyScreenScale(envReflectionProbe.group);
    }
  }

  function syncSceneLights() {
    if (!sceneLightsGroup) return;
    const ids = new Set(sceneLights.value.map(l => l.id));

    for (const [id, runtime] of sceneLightRuntimes) {
      if (!ids.has(id)) {
        disposeSceneLightRuntime(runtime);
        sceneLightRuntimes.delete(id);
      }
    }

    for (const config of sceneLights.value) {
      const selected = config.id === selectedSceneLightId.value;
      let runtime = sceneLightRuntimes.get(config.id);
      if (!runtime) {
        runtime = buildSceneLightRuntime(config, selected);
        sceneLightRuntimes.set(config.id, runtime);
        sceneLightsGroup.add(runtime.group);
      } else {
        syncSceneLightRuntime(runtime, config, selected);
      }
    }
    syncEditorGizmosVisibility();
  }

  let sceneLightsPinnedFromSettings = false;

  function snapSceneLightsToModelDefaults() {
    // 已从场景设置恢复过灯光时，不再用模型中心覆盖用户保存的灯光位姿
    if (sceneLightsPinnedFromSettings) return;
    const center = getSceneModelCenter();
    if (!center) return;
    const typeCounters: Record<SceneLightType, number> = { directional: 0, point: 0, spot: 0 };
    sceneLights.value = sceneLights.value.map(light => {
      const variant = typeCounters[light.type]++;
      return {
        ...light,
        position: computeSceneLightPosition(light.type, center, variant)
      };
    });
    syncSceneLights();
    scheduleSaveSettings();
  }

  function addSceneLight(type: SceneLightType) {
    const index = sceneLights.value.filter(l => l.type === type).length + 1;
    const light = createDefaultSceneLight(type, index, getSceneModelCenter());
    sceneLights.value.push(light);
    selectedSceneLightId.value = light.id;
    syncSceneLights();
    applyShadow();
    scheduleSaveSettings();
  }

  function removeSceneLight(id: string) {
    const idx = sceneLights.value.findIndex(l => l.id === id);
    if (idx < 0) return;
    sceneLights.value.splice(idx, 1);
    if (selectedSceneLightId.value === id) {
      selectedSceneLightId.value = sceneLights.value[0]?.id ?? null;
    }
    syncSceneLights();
    applyShadow();
    scheduleSaveSettings();
  }

  function selectSceneLight(id: string | null) {
    selectedSceneLightId.value = id;
    syncSceneLights();
  }

  function applySceneLights() {
    syncSceneLights();
    // 拖动灯光滑块：同步灯光；applyShadow 仅在贴图结构变化时重建，避免闪屏
    applyShadow();
  }

  function applyShadowGroundOpacity() {
    if (groundMesh?.material && "opacity" in groundMesh.material) {
      (groundMesh.material as THREE.ShadowMaterial).opacity = shadowIntensity.value * 0.5;
    }
  }

  let lastShadowRebuildKey = "";

  function applyShadow() {
    if (!renderer || !scene) return;
    const rebuildKey = [
      shadowEnabled.value ? 1 : 0,
      shadowMapSize.value,
      shadowType.value,
      shadowBias.value,
      shadowNormalBias.value,
      [...sceneLights.value]
        .map(l => `${l.id}:${l.castShadow ? 1 : 0}:${l.type}`)
        .sort()
        .join("|")
    ].join(";");
    const needsRebuild = rebuildKey !== lastShadowRebuildKey;
    lastShadowRebuildKey = rebuildKey;

    renderer.shadowMap.enabled = shadowEnabled.value;
    if (needsRebuild) {
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
    }

    let shadowCaster: THREE.DirectionalLight | null = null;
    for (const runtime of sceneLightRuntimes.values()) {
      const light = runtime.light;
      light.castShadow = false;
      if (
        shadowEnabled.value &&
        runtime.config.castShadow &&
        light instanceof THREE.DirectionalLight &&
        !shadowCaster
      ) {
        shadowCaster = light;
        light.castShadow = true;
        if (needsRebuild) {
          light.shadow.mapSize.set(shadowMapSize.value, shadowMapSize.value);
          light.shadow.bias = shadowBias.value;
          light.shadow.normalBias = shadowNormalBias.value;
          light.shadow.camera.near = 0.5;
          light.shadow.camera.far = 60;
          light.shadow.camera.left = -15;
          light.shadow.camera.right = 15;
          light.shadow.camera.top = 15;
          light.shadow.camera.bottom = -15;
          light.shadow.camera.updateProjectionMatrix();
          // 仅在贴图尺寸/类型等真正变化时丢弃旧 shadow map
          if (light.shadow.map) {
            light.shadow.map.dispose();
            light.shadow.map = null;
          }
        }
      }
    }

    if (shadowEnabled.value) {
      if (!groundMesh || !groundMesh.parent) {
        const geo = new THREE.PlaneGeometry(40, 40);
        const mat = new THREE.ShadowMaterial({ transparent: true });
        groundMesh = new THREE.Mesh(geo, mat);
        groundMesh.rotation.x = -Math.PI / 2;
        groundMesh.position.y = 0;
        groundMesh.receiveShadow = true;
        scene.add(groundMesh);
      }
      applyShadowGroundOpacity();
    } else if (groundMesh && groundMesh.parent) {
      scene.remove(groundMesh);
    }

    if (needsRebuild) {
      meshes.forEach(m => {
        m.traverse(child => {
          const mesh = child as THREE.Mesh;
          if (mesh.isMesh) {
            mesh.castShadow = shadowEnabled.value;
            mesh.receiveShadow = shadowEnabled.value;
          }
        });
      });
    }

    scheduleSaveSettings();
  }

  /** 阴影强度滑块：只改地面阴影透明度，避免每帧重建 shadow map 闪屏 */
  function applyShadowIntensity() {
    applyShadowGroundOpacity();
    scheduleSaveSettings();
  }

  function disposeEnvTextures() {
    meshes.forEach(root => clearBoundSceneEnvMaps(root));
    if (envReflectionProbe?.ball) clearBoundSceneEnvMaps(envReflectionProbe.ball);
    if (envMapEquirect) {
      envMapEquirect.dispose();
      envMapEquirect = null;
    }
    disposeViewportEnvironment(envMap);
    envMap = null;
    appliedEnvMapKey = null;
  }

  function ensureEnvReflectionSphere() {
    if (!scene) return;
    if (!envReflectionProbe) {
      envReflectionProbe = createEnvReflectionProbe();
      scene.add(envReflectionProbe.group);
      layoutEditorGizmosNearScene();
    }
    syncEditorGizmosVisibility();
  }

  function normalizeViewportBgColor(raw: string): string {
    const normalized = String(raw).toLowerCase().trim();
    if (
      !normalized ||
      normalized === "#f2f3f5" ||
      normalized === "#0a0c10" ||
      normalized === "#ffffff" ||
      normalized === "#fff" ||
      normalized === "white" ||
      normalized === "#fafafa" ||
      normalized === "#f5f5f5"
    ) {
      return SCENE_VIEWPORT_BG;
    }
    return raw;
  }

  function applyBackgroundFromSettings() {
    if (!scene || !renderer) return;
    // 背景始终保持编辑器默认背景色；环境贴图仅用于模型反射
    const bg = new THREE.Color(normalizeViewportBgColor(bgColorVal.value));
    scene.background = bg;
    renderer.setClearColor(bg, 1);
  }

  function ensureDefaultViewportEnvironment() {
    if (!renderer || !scene) return;
    if (envMap && !envMapEquirect) return;
    envBakeBusy = true;
    try {
      disposeEnvTextures();
      envMap = createViewportEnvironment(renderer);
      scene.environment = envMap;
      applyBackgroundFromSettings();
      ensureEnvReflectionSphere();
      applyEnv();
    } catch (e) {
      console.warn("Viewport environment init failed", e);
    } finally {
      envBakeBusy = false;
    }
  }

  function applyEnvironmentTexture(equirect: THREE.Texture, isHdr: boolean) {
    if (!renderer || !scene) return;
    envBakeBusy = true;
    try {
      disposeEnvTextures();
      equirect.mapping = THREE.EquirectangularReflectionMapping;
      if (!isHdr) {
        equirect.colorSpace = THREE.SRGBColorSpace;
      }
      envMapEquirect = equirect;

      const pmrem = new THREE.PMREMGenerator(renderer);
      pmrem.compileEquirectangularShader();
      envMap = pmrem.fromEquirectangular(equirect).texture;
      pmrem.dispose();

      scene.environment = envMap;
      applyBackgroundFromSettings();
      ensureEnvReflectionSphere();
      applyEnv();
    } catch (e) {
      console.warn("PMREM environment failed, falling back to RoomEnvironment", e);
      try {
        equirect.dispose();
      } catch {
        /* ignore */
      }
      envMapEquirect = null;
      ensureDefaultViewportEnvironment();
    } finally {
      envBakeBusy = false;
    }
  }

  let SETTINGS_KEY = SCENE_SETTINGS_STORAGE_KEY;
  let skipStoredSceneSettings = false;
  function collectSceneSettingsData() {
    return {
      ambIntensity: ambIntensity.value,
      sceneLights: sceneLights.value,
      matColor: matColor.value,
      matRoughness: matRoughness.value,
      matMetalness: matMetalness.value,
      matNormalStr: matNormalStr.value,
      matEmissiveInt: matEmissiveInt.value,
      bloomIntensity: bloomIntensity.value,
      bloomThreshold: bloomThreshold.value,
      bloomRadius: bloomRadius.value,
      ppExposure: ppExposure.value,
      ppContrast: ppContrast.value,
      ppSaturation: ppSaturation.value,
      toneMapping: toneMapping.value,
      envIntensityVal: envIntensityVal.value,
      envReflectionIntensity: envReflectionIntensity.value,
      envRotation: envRotation.value,
      envReflectionSphereVisible: envReflectionSphereVisible.value,
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
      gridHeight: gridHeight.value,
      msaaEnabled: msaaEnabled.value,
      antialiasingMode: antialiasingMode.value,
      maxPixelRatio: maxPixelRatio.value,
      targetFps: targetFps.value
    };
  }
  function applySceneSettingsData(d: Record<string, any>) {
    if (d.ambIntensity !== undefined) ambIntensity.value = d.ambIntensity;
    if (Array.isArray(d.sceneLights) && d.sceneLights.length > 0) {
      sceneLights.value = d.sceneLights;
      selectedSceneLightId.value = d.sceneLights[0]?.id ?? null;
    } else if (d.dirIntensity !== undefined || d.fillIntensity !== undefined) {
      sceneLights.value = migrateLegacySceneLights(d);
      selectedSceneLightId.value = sceneLights.value[0]?.id ?? null;
    }
    if (d.matColor) matColor.value = d.matColor;
    if (d.matRoughness !== undefined) matRoughness.value = d.matRoughness;
    if (d.matMetalness !== undefined) matMetalness.value = d.matMetalness;
    if (d.matNormalStr !== undefined) matNormalStr.value = d.matNormalStr;
    if (d.matEmissiveInt !== undefined) matEmissiveInt.value = d.matEmissiveInt;
    if (d.bloomIntensity !== undefined) bloomIntensity.value = d.bloomIntensity;
    if (d.bloomThreshold !== undefined) bloomThreshold.value = d.bloomThreshold;
    if (d.bloomRadius !== undefined) bloomRadius.value = d.bloomRadius;
    if (d.ppExposure !== undefined) ppExposure.value = d.ppExposure;
    if (d.ppContrast !== undefined) ppContrast.value = d.ppContrast;
    if (d.ppSaturation !== undefined) ppSaturation.value = d.ppSaturation;
    if (d.toneMapping) toneMapping.value = d.toneMapping;
    if (d.envIntensityVal !== undefined) envIntensityVal.value = d.envIntensityVal;
    if (d.envReflectionIntensity !== undefined) envReflectionIntensity.value = d.envReflectionIntensity;
    if (d.envRotation !== undefined) envRotation.value = d.envRotation;
    if (d.envReflectionSphereVisible !== undefined) envReflectionSphereVisible.value = d.envReflectionSphereVisible;
    if (d.envMapUrl !== undefined) envMapUrl.value = d.envMapUrl;
    if (d.envMapIsHdr !== undefined) envMapIsHdr.value = d.envMapIsHdr;
    if (d.fogEnabled !== undefined) fogEnabled.value = d.fogEnabled;
    if (d.fogNear !== undefined) fogNear.value = d.fogNear;
    if (d.fogFar !== undefined) fogFar.value = d.fogFar;
    if (d.bgColorVal) {
      bgColorVal.value = normalizeViewportBgColor(d.bgColorVal);
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
    if (d.msaaEnabled !== undefined) msaaEnabled.value = d.msaaEnabled;
    if (d.antialiasingMode !== undefined) {
      antialiasingMode.value = d.antialiasingMode as AntialiasingMode;
    } else if (d.fxaaEnabled === true) {
      antialiasingMode.value = "fxaa";
    } else if (d.fxaaEnabled === false) {
      antialiasingMode.value = "smaa";
    }
    if (d.maxPixelRatio !== undefined) maxPixelRatio.value = normalizeAntialiasRatio(d.maxPixelRatio);
    if (d.targetFps !== undefined) targetFps.value = normalizeTargetFps(d.targetFps);
  }

  function setTargetFps(fps: TargetFps) {
    targetFps.value = fps;
    viewportLastPresentAt = 0;
    scheduleSaveSettings();
  }
  function saveAllSettings() {
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(collectSceneSettingsData()));
    } catch (e) {}
  }
  function loadAllSettings() {
    try {
      if (skipStoredSceneSettings) return;
      let raw = localStorage.getItem(SETTINGS_KEY);
      if (!raw) return;
      const data = JSON.parse(raw);
      if (data.envMapUrl === "/hdr/default.hdr") {
        data.envMapUrl = null;
        data.envReflectionSphereVisible = false;
      }
      applySceneSettingsData(data);
    } catch (e) {}
  }
  async function applySceneSettingsFromServer(sceneSettings: unknown) {
    if (!sceneSettings || typeof sceneSettings !== "object") return;
    applySceneSettingsData(sceneSettings as Record<string, any>);
    sceneLightsPinnedFromSettings = true;
    applySettings();
    applyGrid();
    applyFog();
    if (shadowEnabled.value) applyShadow();
    if (bloomIntensity.value > 0 || ppContrast.value !== 0 || ppSaturation.value !== 0) {
      toggleBloom();
      toggleColor();
    }
    saveAllSettings();
    const settings = sceneSettings as { envMapUrl?: string; envMapIsHdr?: boolean };
    if (settings.envMapUrl) {
      await loadEnvironmentMapFromUrlAsync(settings.envMapUrl, !!settings.envMapIsHdr);
    }
    applyAntialiasing();
    applyModelEnvReflectionIntensity();
  }

  function resetSceneSettings() {
    const d = DEFAULT_SCENE_SETTINGS;
    ambIntensity.value = d.ambIntensity;
    sceneLights.value = migrateLegacySceneLights({
      dirIntensity: d.dirIntensity,
      fillIntensity: d.fillIntensity
    }, getSceneModelCenter());
    selectedSceneLightId.value = sceneLights.value[0]?.id ?? null;
    matColor.value = d.matColor;
    matRoughness.value = d.matRoughness;
    matMetalness.value = d.matMetalness;
    matNormalStr.value = d.matNormalStr;
    matEmissiveInt.value = d.matEmissiveInt;
    bloomIntensity.value = d.bloomIntensity;
    bloomThreshold.value = d.bloomThreshold;
    bloomRadius.value = d.bloomRadius;
    ppExposure.value = d.ppExposure;
    ppContrast.value = d.ppContrast;
    ppSaturation.value = d.ppSaturation;
    toneMapping.value = d.toneMapping;
    envIntensityVal.value = d.envIntensityVal;
    envReflectionIntensity.value = d.envReflectionIntensity;
    envRotation.value = d.envRotation;
    envReflectionSphereVisible.value = d.envReflectionSphereVisible;
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
    msaaEnabled.value = d.msaaEnabled;
    antialiasingMode.value = d.antialiasingMode;
    maxPixelRatio.value = normalizeAntialiasRatio(d.maxPixelRatio);

    applySettings();
    toggleBloom();
    toggleColor();
    applyShadow();
    applyGrid();
    void resetEnvironmentMap();
    applyFog();
    applyAntialiasing();
    if (selModel.value) syncMaterialUiFromModel();
    toastShow("场景参数已重置");
  }

  function loadEnvironmentMapFromUrl(url: string, isHdr: boolean) {
    void loadEnvironmentMapFromUrlAsync(url, isHdr);
  }

  function resolveEnvMapLoadUrl(url: string) {
    if (!url) return "";
    if (url.startsWith("blob:") || url.startsWith("data:")) return url;
    return resolveAssetUrl(url);
  }

  function makeEnvMapKey(resolvedUrl: string, isHdr: boolean) {
    return `${resolvedUrl}|${isHdr ? 1 : 0}`;
  }

  function loadEnvironmentMapFromUrlAsync(url: string, isHdr: boolean): Promise<boolean> {
    if (!renderer || !scene || !url) return Promise.resolve(false);
    const resolved = resolveEnvMapLoadUrl(url);
    if (!resolved) return Promise.resolve(false);
    const key = makeEnvMapKey(resolved, isHdr);
    if (appliedEnvMapKey === key && envMap) {
      envMapUrl.value = url;
      envMapIsHdr.value = isHdr;
      envMapSourceUrl = resolved;
      return Promise.resolve(true);
    }

    const gen = ++envMapLoadGen;
    envMapPreview.value = isHdr ? "" : resolved;
    envMapSourceUrl = resolved;
    envMapUrl.value = url;
    envMapIsHdr.value = isHdr;

    return new Promise(resolve => {
      const onLoaded = (texture: THREE.Texture) => {
        if (gen !== envMapLoadGen) {
          texture.dispose();
          resolve(false);
          return;
        }
        try {
          applyEnvironmentTexture(texture, isHdr);
          if (gen === envMapLoadGen && envMap) {
            appliedEnvMapKey = key;
            applyModelEnvReflectionIntensity();
            resolve(true);
            return;
          }
          resolve(false);
        } catch (e) {
          console.warn("Environment map apply failed", resolved, e);
          resolve(false);
        }
      };
      const onError = () => {
        if (gen !== envMapLoadGen) {
          resolve(false);
          return;
        }
        console.warn("Environment map load failed", resolved);
        if (url === "/hdr/default.hdr") {
          envMapPreview.value = "";
        }
        if (!envMap) ensureDefaultViewportEnvironment();
        resolve(false);
      };
      if (isHdr) {
        rgbeLoader.load(resolved, onLoaded, undefined, onError);
      } else {
        textureLoader.load(resolved, onLoaded, undefined, onError);
      }
    });
  }

  /** 模型加载完成后重新套用场景设置，避免灯光自动吸附覆盖已保存参数 */
  async function finalizeSceneVisualBootstrap() {
    if (!renderer || !scene) return;
    applySettings();
    applyGrid();
    applyFog();
    if (shadowEnabled.value) applyShadow();
    if (bloomIntensity.value > 0 || ppContrast.value !== 0 || ppSaturation.value !== 0) {
      toggleBloom();
      toggleColor();
    }
    applyAntialiasing();
    if (envMapUrl.value) {
      const ok = await loadEnvironmentMapFromUrlAsync(envMapUrl.value, envMapIsHdr.value);
      if (!ok && !envMap) ensureDefaultViewportEnvironment();
    } else if (!envMap) {
      ensureDefaultViewportEnvironment();
    }
    meshes.forEach(root => {
      prepareGltfMaterials(root, renderer);
      applyMeshTextureQuality(root, renderer!);
      root.traverse(child => {
        const mesh = child as THREE.Mesh;
        if (!mesh.isMesh || !mesh.material) return;
        const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        for (const mat of mats) {
          if (!mat) continue;
          mat.needsUpdate = true;
        }
      });
    });
    // 先整理贴图/快照原始 PBR，再套用反射强度（只乘 envMapIntensity）
    applyModelEnvReflectionIntensity();
    syncSceneOrbitLimits();
    layoutEditorGizmosNearScene();
    applyBackgroundFromSettings();
    handleResize();
  }

  function applyToneMapping() {
    if (!renderer) return;
    renderer.toneMapping = TONE_MAPPING_MAP[toneMapping.value] ?? THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = ppExposure.value;
    scheduleSaveSettings();
  }

  function applyFog() {
    if (!scene) return;
    const bg = new THREE.Color(normalizeViewportBgColor(bgColorVal.value));

    if (!fogEnabled.value) {
      scene.fog = null;
    } else if (!(scene.fog instanceof THREE.Fog)) {
      scene.fog = new THREE.Fog(bg.getHex(), fogNear.value, fogFar.value);
    } else {
      scene.fog.color.copy(bg);
      scene.fog.near = fogNear.value;
      scene.fog.far = Math.max(fogFar.value, fogNear.value + 0.5);
    }

    scene.background = bg;
    renderer?.setClearColor(bg, 1);

    meshes.forEach(group => {
      group.traverse(child => {
        const mesh = child as THREE.Mesh;
        if (!mesh.isMesh || !mesh.material) return;
        const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        mats.forEach(mat => {
          (mat as THREE.Material & { fog?: boolean }).fog = fogEnabled.value;
        });
      });
    });

    if (gridHelper) {
      gridHelper.traverse(child => {
        const line = child as THREE.LineSegments;
        if (line.material) {
          const mats = Array.isArray(line.material) ? line.material : [line.material];
          mats.forEach(mat => {
            (mat as THREE.Material & { fog?: boolean }).fog = true;
          });
        }
      });
    }

    if (envReflectionProbe) {
      const mat = envReflectionProbe.ball.material as THREE.MeshStandardMaterial;
      (mat as THREE.MeshStandardMaterial & { fog?: boolean }).fog = true;
    }

    scheduleSaveSettings();
  }

  async function resetEnvironmentMap() {
    if (envMapSourceUrl?.startsWith("blob:")) URL.revokeObjectURL(envMapSourceUrl);
    envMapUrl.value = DEFAULT_SCENE_SETTINGS.envMapUrl;
    envMapIsHdr.value = DEFAULT_SCENE_SETTINGS.envMapIsHdr;
    envMapPreview.value = "";
    envMapSourceUrl = envMapUrl.value;
    if (!renderer || !scene) return;
    if (envMapUrl.value) {
      loadEnvironmentMapFromUrl(envMapUrl.value, envMapIsHdr.value);
    } else {
      ensureDefaultViewportEnvironment();
    }
    saveAllSettings();
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
      applyEnvironmentTexture(texture, isHdr);
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
    const targets =
      selModelNodeId.value != null
        ? getNodeObjects(model.id, selModelNodeId.value, true)
        : ([meshes.get(model.id)].filter(Boolean) as THREE.Object3D[]);
    if (!targets.length) return;

    let found = false;
    const visit = (root: THREE.Object3D) => {
      root.traverse(child => {
        if (found) return;
        const mesh = child as THREE.Mesh;
        if (!mesh.isMesh || !mesh.material) return;
        const mat = (Array.isArray(mesh.material) ? mesh.material[0] : mesh.material) as THREE.MeshStandardMaterial;
        if (!mat?.isMeshStandardMaterial && !(mat as THREE.MeshPhysicalMaterial)?.isMeshPhysicalMaterial) return;
        if (mat.color) matColor.value = `#${mat.color.getHexString()}`;
        if (mat.roughness !== undefined) matRoughness.value = mat.roughness;
        if (mat.metalness !== undefined) matMetalness.value = mat.metalness;
        // 法线强度用绝对值展示；glTF 可能为 -1（翻转），滑杆下限为 0 时不能直接读负值
        if (mat.normalScale) matNormalStr.value = Math.abs(mat.normalScale.x);
        if (mat.emissiveIntensity !== undefined) matEmissiveInt.value = mat.emissiveIntensity;
        else matEmissiveInt.value = 0;
        found = true;
      });
    };
    targets.forEach(visit);
  }

  function syncViewportFog() {
    if (!scene) return;
    applyFog();
  }

  function applySettings() {
    if (!scene || !renderer || !ambientLight) return;
    ambientLight.intensity = ambIntensity.value;
    syncSceneLights();
    applyToneMapping();
    applyBackgroundFromSettings();
    applyFog();
    ensureEnvReflectionSphere();
    scheduleSaveSettings();
  }

  function applyMatToModel(modelId: string) {
    const root = meshes.get(modelId);
    if (!root) return;
    // 有子节点选中时只改当前选中部件，便于修局部材质；否则改整个模型
    const targets =
      selModelId.value === modelId && selModelNodeId.value
        ? getNodeObjects(modelId, selModelNodeId.value, true)
        : [root];

    const applyToMat = (mat: THREE.Material) => {
      const m = mat as THREE.MeshStandardMaterial;
      if (!m.isMeshStandardMaterial && !(m as THREE.MeshPhysicalMaterial).isMeshPhysicalMaterial) return;
      // 标量与贴图相乘（Three/glTF 惯例），滑杆始终生效
      updateGltfMaterialBaseOverrides(m, {
        color: matColor.value,
        roughness: matRoughness.value,
        metalness: matMetalness.value,
        normalScale: matNormalStr.value,
        emissiveIntensity: matEmissiveInt.value
      });
    };

    for (const target of targets) {
      target.traverse(child => {
        const mesh = child as THREE.Mesh;
        if (!mesh.isMesh || !mesh.material) return;
        // GLB 常共享 Material：改色前先克隆，避免改一个部件/模型牵连其它
        ensureUniqueMeshMaterials(mesh);
        const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        mats.forEach(applyToMat);
      });
    }
    applyModelEnvReflectionIntensity(root);
    scheduleSaveSettings();
  }

  let presentationGpuProfile: GpuTierProfile | null = null;
  let presentationPerfScale = 1;
  let presentationFrameDts: number[] = [];
  let lastPresentationRatioSyncAt = 0;
  let lastPresentationHeavyMotion = false;
  let lastFramePresentAt = 0;
  let lastRendererPresentationStateKey = "";

  function ensurePresentationGpuProfile() {
    if (!renderer) return null;
    if (!presentationGpuProfile) {
      presentationGpuProfile = detectGpuTierProfile(renderer, isCoarsePointerDevice());
    }
    return presentationGpuProfile;
  }

  /** 展示模式：章节/镜头/视频播放等重负载运动（不含 GLTF 循环动画） */
  function isPresentationHeavyMotion() {
    return !!(
      isPlaying.value ||
      chapterPlayTarget.value ||
      camTrans ||
      cameraAnimating ||
      _chAnimLock
    );
  }

  function isEditorHeavyMotion() {
    return !!(
      isPlaying.value ||
      chapterPlayTarget.value ||
      camTrans ||
      cameraAnimating ||
      chapterNavLock.value ||
      _chAnimLock ||
      hoverModelId.value
    );
  }

  function isViewportMotionBusy() {
    return !!(camTrans || _chAnimLock || chapterPlayTarget.value || isPlaying.value);
  }

  /** 展示模式动画播放掉帧时仅降低渲染分辨率，不影响动画计算 */
  function adaptPresentationRenderPerf(frameDtSec: number) {
    if (!isPresentationMode() || !isCoarsePointerDevice()) {
      if (presentationPerfScale !== 1 || lastPresentationHeavyMotion) {
        presentationPerfScale = 1;
        lastPresentationHeavyMotion = false;
        presentationFrameDts = [];
        syncPresentationMotionRenderProfile(false);
      }
      return;
    }

    const heavyMotion = isPresentationHeavyMotion();
    if (heavyMotion !== lastPresentationHeavyMotion) {
      lastPresentationHeavyMotion = heavyMotion;
      syncPresentationMotionRenderProfile(heavyMotion);
    }

    if (!heavyMotion) {
      if (presentationPerfScale < 1) {
        presentationPerfScale = 1;
        syncRenderPixelRatio();
      }
      presentationFrameDts = [];
      return;
    }

    presentationFrameDts.push(frameDtSec);
    if (presentationFrameDts.length > 36) presentationFrameDts.shift();
    if (presentationFrameDts.length < 18) return;

    const avgMs = (presentationFrameDts.reduce((a, b) => a + b, 0) / presentationFrameDts.length) * 1000;
    const prev = presentationPerfScale;
    // 掉帧时优先降分辨率（保持 SMAA），比关抗锯齿更划算
    if (avgMs > 22) presentationPerfScale = Math.max(0.78, presentationPerfScale - 0.04);
    else if (avgMs < 16.5) presentationPerfScale = Math.min(1, presentationPerfScale + 0.035);

    const now = performance.now();
    if (Math.abs(prev - presentationPerfScale) > 0.02 && now - lastPresentationRatioSyncAt > 800) {
      lastPresentationRatioSyncAt = now;
      syncRenderPixelRatio();
    }
  }

  /** 展示模式运动期间：移动端临时关 MSAA 保帧率，静止时恢复清晰度 */
  function syncPresentationMotionRenderProfile(heavyMotion: boolean) {
    if (!isPresentationMode()) return;
    syncComposerMsaaSamples(heavyMotion);
    if (!heavyMotion && presentationPerfScale < 1) {
      presentationPerfScale = 1;
      syncRenderPixelRatio();
    }
  }

  function isPresentationMode() {
    return viewOnly.value || isPreviewMode.value;
  }

  function getRenderPixelRatio() {
    if (isPresentationMode()) {
      const w = viewportEl.value?.clientWidth ?? 0;
      const h = viewportEl.value?.clientHeight ?? 0;
      const maxTex = renderer?.capabilities.maxTextureSize ?? 4096;
      const gpu = ensurePresentationGpuProfile() ?? {
        tier: 1 as const,
        maxPresentationDpr: isCoarsePointerDevice() ? 1.75 : 2,
        enableComposerMsaa: false
      };
      // 展示页：至少 1.5 档，配合 SMAA；过高会触发手机 context loss
      const configured = Math.max(maxPixelRatio.value, isCoarsePointerDevice() ? 1.5 : 1.75);
      return resolvePresentationPixelRatio(
        configured,
        w,
        h,
        maxTex,
        gpu,
        presentationPerfScale
      );
    }
    const base = resolveEditorRenderPixelRatio(maxPixelRatio.value);
    return Math.max(1, base * editorPerfScale);
  }

  /** 编辑模式：按帧耗时自适应分辨率，运镜期间冻结避免画面抖动 */
  function adaptEditorRenderPerf(frameDtSec: number) {
    if (isPresentationMode()) return;
    if (camTrans || cameraAnimating || isCameraTransitioning.value) return;

    editorFrameDts.push(frameDtSec);
    if (editorFrameDts.length > 24) editorFrameDts.shift();
    if (editorFrameDts.length < 8) return;

    editorAvgFrameMs = (editorFrameDts.reduce((a, b) => a + b, 0) / editorFrameDts.length) * 1000;
    const targetMs = 1000 / Math.min(targetFps.value, 30);
    const prev = editorPerfScale;
    const heavy = isEditorHeavyMotion();

    if (editorAvgFrameMs > targetMs * 1.06) {
      editorPerfScale = Math.max(0.68, editorPerfScale - 0.04);
    } else if (!heavy && editorAvgFrameMs < targetMs * 0.88) {
      editorPerfScale = Math.min(1, editorPerfScale + 0.025);
    }

    if (Math.abs(prev - editorPerfScale) > 0.015) {
      syncRenderPixelRatio();
    }
    syncEditorOutlineDownsample();
  }

  function syncEditorOutlineDownsample() {
    if (!composer || isPresentationMode()) return;
    if (camTrans || cameraAnimating || isCameraTransitioning.value) return;
    const pressure = isEditorHeavyMotion() || editorAvgFrameMs > 1000 / 30;
    // 选中描边始终全分辨率，避免斜视/远近景时出现皱折锯齿；仅悬停与配置高亮在重压时降采样
    if (outlinePass && outlinePass.downSampleRatio !== 1) {
      outlinePass.downSampleRatio = 1;
    }
    const softRatio = pressure ? 3 : 2;
    for (const pass of [hoverOutlinePass, modelConfigOutlinePass]) {
      if (pass && pass.downSampleRatio !== softRatio) pass.downSampleRatio = softRatio;
    }
  }

  function syncEditorComposerPasses() {
    if (!composer) return;
    const presentation = isPresentationMode();
    const hasSelection = !!selModelId.value;
    const hasHover = !!(
      hoverModelId.value &&
      hoverOutlinePass?.selectedObjects?.length &&
      !(hoverModelId.value === selModelId.value && (hoverModelNodeId.value ?? null) === (selModelNodeId.value ?? null))
    );
    const hasModelCfgOutline = modelConfigOutlineRegistry.size > 0;

    if (outlinePass) outlinePass.enabled = !presentation && hasSelection;
    if (hoverOutlinePass) hoverOutlinePass.enabled = !presentation && hasHover;
    if (modelConfigOutlinePass) {
      modelConfigOutlinePass.enabled = hasModelCfgOutline;
      if (presentation && hasModelCfgOutline) {
        modelConfigOutlinePass.downSampleRatio = 1;
        modelConfigOutlinePass.edgeGlow = 0;
        modelConfigOutlinePass.edgeThickness = 1.35;
        modelConfigOutlinePass.edgeStrength = 5.5;
      }
    }
    if (bloomPass) bloomPass.enabled = !presentation && bloomIntensity.value > 0;
    // 每帧同步色彩校正数值，避免只改了 ref、uniforms 未刷新导致「滑了没效果」
    if (colorPass) colorPass.enabled = !presentation;
    if (hueSatPass) {
      hueSatPass.enabled = !presentation;
      if (hueSatPass.uniforms?.saturation) {
        hueSatPass.uniforms.saturation.value = ppSaturation.value;
      }
    }
    if (brightContrastPass) {
      brightContrastPass.enabled = !presentation;
      if (brightContrastPass.uniforms?.contrast) {
        brightContrastPass.uniforms.contrast.value = ppContrast.value;
      }
    }
    // 展示页每帧兜底：SMAA 常开（手机/电脑锯齿主防线，成本远低于高 MSAA）
    if (presentation) {
      if (fxaaPass) fxaaPass.enabled = false;
      if (smaaPass) smaaPass.enabled = true;
    }
  }

  /** 展示模式：SMAA + MSAA 轻量后处理（对齐 Oxide PostProcessing 思路） */
  function renderViewportFrame() {
    if (!renderer || !scene || !camera || envBakeBusy) return;
    if (renderer.getContext()?.isContextLost?.()) return;
    syncRendererPresentationState();
    syncEditorComposerPasses();
    if (composer) {
      applyPostProcessing();
      composer.render();
    } else {
      renderer.render(scene, camera);
    }
  }

  /** 展示模式关闭编辑器专用 Pass，强制 SMAA 抗锯齿 */
  function syncPresentationRenderProfile() {
    const presentation = isPresentationMode();
    if (outlinePass) {
      outlinePass.enabled = !presentation;
      if (presentation) outlinePass.selectedObjects = [];
    }
    if (hoverOutlinePass) {
      if (presentation) {
        hoverOutlinePass.enabled = false;
        hoverOutlinePass.selectedObjects = [];
      }
    }
    if (modelConfigOutlinePass) {
      modelConfigOutlinePass.enabled = modelConfigOutlineRegistry.size > 0;
      // 展示页轮廓必须全分辨率，降采样会让红框锯齿非常明显
      if (presentation) {
        modelConfigOutlinePass.downSampleRatio = 1;
        modelConfigOutlinePass.edgeGlow = 0;
        modelConfigOutlinePass.edgeThickness = 1.35;
        modelConfigOutlinePass.edgeStrength = 5.5;
      }
    }
    if (bloomPass) bloomPass.enabled = !presentation && bloomIntensity.value > 0;
    if (colorPass) colorPass.enabled = !presentation;
    if (hueSatPass) hueSatPass.enabled = !presentation;
    if (brightContrastPass) brightContrastPass.enabled = !presentation;
    if (presentation) {
      if (fxaaPass) fxaaPass.enabled = false;
      if (smaaPass) smaaPass.enabled = true;
    } else {
      syncAntialiasingPasses();
    }
    syncComposerMsaaSamples();
    syncRenderPixelRatio();
    if (presentation && renderer) {
      ensurePresentationGpuProfile();
      meshes.forEach(root => applyMeshTextureQuality(root, renderer));
    }
  }

  function syncComposerMsaaSamples(presentationHeavyMotion = isPresentationHeavyMotion()) {
    if (!composer || !renderer) return;
    const gl = renderer.getContext();
    const gpu = isPresentationMode() ? ensurePresentationGpuProfile() : null;
    const presentation = isPresentationMode();
    const editorMotion = !presentation && isEditorHeavyMotion();
    const coarse = isCoarsePointerDevice();
    const msaaBase = presentation ? gpu?.enableComposerMsaa ?? false : msaaEnabled.value;

    let samples = 0;
    if (presentation) {
      // 电脑展示：固定 2x MSAA（不随播放开关，避免 RT 反复重建打爆显存）
      // 手机展示：0，完全靠 SMAA + DPR（更稳、更省）
      if (msaaBase && gl instanceof WebGL2RenderingContext && !coarse) {
        samples = 2;
      }
    } else if (msaaBase && gl instanceof WebGL2RenderingContext && !editorMotion) {
      samples = 4;
    }

    // 展示页用 8bit RT：SMAA 更合适，也比 HalfFloat+MSAA 省显存
    const rtType = presentation ? THREE.UnsignedByteType : THREE.HalfFloatType;
    const prevRt = composer.renderTarget1;
    const sameSamples = prevRt?.samples === samples;
    const sameType = prevRt?.texture?.type === rtType;
    if (sameSamples && sameType) return;

    const ratio = renderer.getPixelRatio();
    const size = renderer.getSize(new THREE.Vector2());
    const pw = Math.max(Math.round(size.width * ratio), 1);
    const ph = Math.max(Math.round(size.height * ratio), 1);
    const rt = new THREE.WebGLRenderTarget(pw, ph, {
      type: rtType,
      samples
    });
    rt.texture.name = "EffectComposer.rt1";
    composer.reset(rt);
    for (const pass of composer.passes) {
      pass.setSize?.(pw, ph);
    }
  }

  function syncRenderPixelRatio() {
    if (!renderer) return;
    const ratio = getRenderPixelRatio();
    renderer.setPixelRatio(ratio);
    composer?.setPixelRatio(ratio);
    effectiveRenderPixelRatio.value = ratio;
  }

  function syncAntialiasingPasses() {
    const mode = antialiasingMode.value;
    const presentation = isPresentationMode();
    if (presentation) {
      // 展示页统一走 SMAA（电脑 DPR 高还不明显；手机关了会严重锯齿）
      if (fxaaPass) fxaaPass.enabled = false;
      if (smaaPass) smaaPass.enabled = true;
      return;
    }
    if (fxaaPass) fxaaPass.enabled = mode === "fxaa";
    if (smaaPass) smaaPass.enabled = mode === "smaa";
  }

  function syncRendererPresentationState() {
    if (!renderer) return;
    const key = [
      shadowEnabled.value,
      shadowType.value,
      toneMapping.value,
      ppExposure.value,
      bgColorVal.value
    ].join("|");
    if (key === lastRendererPresentationStateKey) return;
    lastRendererPresentationStateKey = key;
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
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = TONE_MAPPING_MAP[toneMapping.value] ?? THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = ppExposure.value;
    renderer.setClearColor(new THREE.Color(normalizeViewportBgColor(bgColorVal.value)), 1);
  }

  let pendingAntialiasingApply = 0;

  function applyAntialiasingNow() {
    if (!renderer) return;
    const attrs = renderer.getContext().getContextAttributes();
    if (attrs && attrs.antialias !== msaaEnabled.value) {
      toastShow("MSAA 需要刷新页面后生效", "warning");
    }

    syncRenderPixelRatio();
    // 先按编辑器模式同步，再套展示配置（展示必须最后强制开 SMAA）
    syncAntialiasingPasses();
    syncPresentationRenderProfile();
    if (viewportEl.value) {
      const vw = viewportEl.value.clientWidth;
      const vh = viewportEl.value.clientHeight;
      if (vw > 0 && vh > 0) {
        renderer.setSize(vw, vh);
        composer?.setSize(vw, vh);
      }
    }
    effectiveRenderPixelRatio.value = getRenderPixelRatio();
    scheduleSaveSettings();
  }

  function applyAntialiasing() {
    if (pendingAntialiasingApply) cancelAnimationFrame(pendingAntialiasingApply);
    pendingAntialiasingApply = requestAnimationFrame(() => {
      pendingAntialiasingApply = 0;
      applyAntialiasingNow();
    });
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

    // 选中轮廓：全分辨率（downSampleRatio=1），降低 glow，减少斜视皱折
    outlinePass = new OutlinePass(size, scene, camera);
    outlinePass.downSampleRatio = 1;
    outlinePass.visibleEdgeColor.set(SELECTION_COLOR);
    outlinePass.hiddenEdgeColor.set(HIDDEN_EDGE_COLOR);
    outlinePass.edgeStrength = 5;
    outlinePass.edgeThickness = 1.6;
    outlinePass.edgeGlow = 0;
    outlinePass.pulsePeriod = 0;
    composer.addPass(outlinePass);

    // 悬停轮廓（浅蓝）— 可降采样；选中描边不跟随降采样以免发皱
    hoverOutlinePass = new OutlinePass(size, scene, camera);
    hoverOutlinePass.downSampleRatio = 2;
    hoverOutlinePass.visibleEdgeColor.set(HOVER_EDGE_COLOR);
    hoverOutlinePass.hiddenEdgeColor.set(HIDDEN_EDGE_COLOR);
    hoverOutlinePass.edgeStrength = 3.5;
    hoverOutlinePass.edgeThickness = 1.2;
    hoverOutlinePass.edgeGlow = 0;
    hoverOutlinePass.pulsePeriod = 0;
    hoverOutlinePass.enabled = false;
    composer.addPass(hoverOutlinePass);

    // 模型配置轮廓高亮
    modelConfigOutlinePass = new OutlinePass(size, scene, camera);
    modelConfigOutlinePass.downSampleRatio = 2;
    composer.addPass(modelConfigOutlinePass);
    applyModelConfigOutlinePassStyle(DEFAULT_OUTLINE_COLOR);

    smaaPass = new SMAAPass();
    smaaPass.enabled = antialiasingMode.value === "smaa";
    composer.addPass(smaaPass);

    fxaaPass = new FXAAPass();
    fxaaPass.enabled = antialiasingMode.value === "fxaa";
    composer.addPass(fxaaPass);

    composer.addPass(new OutputPass());
    syncAntialiasingPasses();
    syncPresentationRenderProfile();
  }

  function collectOutlineMeshes(objects: THREE.Object3D[]): THREE.Object3D[] {
    const result: THREE.Object3D[] = [];
    const seen = new Set<THREE.Object3D>();
    for (const root of objects) {
      root.traverse(child => {
        if (seen.has(child)) return;
        if (
          child.userData?.isEdgeLine ||
          child.userData?.isSelectionHelper ||
          child.userData?.isOutlineShell ||
          child.userData?.isBodyHighlightOverlay
        ) {
          return;
        }
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
    if (composer && bloomPass) {
      bloomPass.strength = bloomIntensity.value * 0.4;
      bloomPass.threshold = Math.max(0.35, bloomThreshold.value);
      bloomPass.radius = bloomRadius.value;
      bloomPass.enabled = !isPresentationMode() && bloomIntensity.value > 0;
    }
    scheduleSaveSettings();
  }

  function toggleColor() {
    if (!composer) initComposer();
    const colorEnabled = !isPresentationMode();
    if (composer) {
      if (colorPass) colorPass.enabled = colorEnabled;
      if (hueSatPass) {
        hueSatPass.enabled = colorEnabled;
        if (hueSatPass.uniforms?.saturation) {
          hueSatPass.uniforms.saturation.value = ppSaturation.value;
        }
      }
      if (brightContrastPass) {
        brightContrastPass.enabled = colorEnabled;
        if (brightContrastPass.uniforms?.contrast) {
          brightContrastPass.uniforms.contrast.value = ppContrast.value;
        }
      }
    }
    scheduleSaveSettings();
  }

  /** 滑块/输入框共用：必须写闭包内的 ref，避免面板侧赋值写不到真实状态 */
  function setPpContrast(val?: number | null) {
    if (typeof val === "number" && Number.isFinite(val)) ppContrast.value = val;
    toggleColor();
  }

  function setPpSaturation(val?: number | null) {
    if (typeof val === "number" && Number.isFinite(val)) ppSaturation.value = val;
    toggleColor();
  }

  function setPpExposure(val?: number | null) {
    if (typeof val === "number" && Number.isFinite(val)) ppExposure.value = val;
    applyToneMapping();
  }

  function applyGrid() {
    if (!scene) return;
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

  watch(gridHeight, () => {
    applyGrid();
  });

  function applyModelEnvReflectionIntensity(targetRoot?: THREE.Object3D) {
    const intensity = Math.max(0, envReflectionIntensity.value);
    const envI = Math.max(0, envIntensityVal.value);
    const envTex = envMap ?? scene?.environment ?? null;
    const applyToRoot = (root: THREE.Object3D) => {
      applyGltfSpecularGlassReflection(root, intensity, envTex as THREE.Texture | null, envI);
    };
    if (targetRoot) {
      applyToRoot(targetRoot);
      return;
    }
    meshes.forEach(root => applyToRoot(root));
  }

  function applyEnv() {
    if (!scene) return;
    const rotY = THREE.MathUtils.degToRad(envRotation.value);
    scene.environmentRotation.set(0, rotY, 0);
    scene.backgroundRotation.set(0, rotY, 0);

    const envI = Math.max(0, envIntensityVal.value);
    // 环境贴图强度：全局 IBL / 背景；模型镜面反射由材质清漆+粗糙度控制（见 applyModelEnvReflectionIntensity）
    scene.environmentIntensity = envI;
    scene.backgroundIntensity = envI;

    applyModelEnvReflectionIntensity();
    if (envReflectionProbe?.ball) {
      applyGltfSpecularGlassReflection(
        envReflectionProbe.ball,
        Math.max(0, envReflectionIntensity.value),
        (envMap ?? scene.environment) as THREE.Texture | null,
        envI
      );
    }
    ensureEnvReflectionSphere();
    syncEditorGizmosVisibility();
    scheduleSaveSettings();
  }

  function setEnvReflectionIntensity(val?: number | null) {
    if (typeof val === "number" && Number.isFinite(val)) envReflectionIntensity.value = val;
    applyEnv();
  }

  function setEnvIntensityVal(val?: number | null) {
    if (typeof val === "number" && Number.isFinite(val)) envIntensityVal.value = val;
    applyEnv();
  }

  function setEnvRotation(val?: number | null) {
    if (typeof val === "number" && Number.isFinite(val)) envRotation.value = val;
    applyEnv();
  }

  function applyPostProcessing() {
    if (!composer || !bloomPass) return;
    const key = `${bloomIntensity.value}|${bloomThreshold.value}|${bloomRadius.value}`;
    if (key === lastBloomPostKey) return;
    lastBloomPostKey = key;
    // 强度做衰减映射：UI 数值直观，实际辉光更克制，避免 0.05 就过亮。
    bloomPass.strength = bloomIntensity.value * 0.4;
    bloomPass.threshold = Math.max(0.35, bloomThreshold.value);
    bloomPass.radius = bloomRadius.value;
  }

  function easeInOutCubic(t: number) {
    return t * t * (3 - 2 * t);
  }

  /** 运镜按实际渲染帧增量推进，避免节点切换阻塞主线程后墙钟超时直接跳到终点 */
  function advanceCameraTransition(now: number) {
    if (!camTrans || !camera || !controls) return;

    if (!camTransAdvanceLastAt) {
      camTransAdvanceLastAt = now;
      camTrans.elapsed = 0;
    }

    const dtSec = Math.min((now - camTransAdvanceLastAt) / 1000, 0.05);
    camTransAdvanceLastAt = now;
    camTrans.elapsed = Math.min(camTrans.elapsed + dtSec, camTrans.dur);
    const t = camTrans.elapsed / camTrans.dur;
    const ease = easeInOutCubic(t);

    camera.position.lerpVectors(camTrans.sp, camTrans.ep, ease);
    controls.target.lerpVectors(camTrans.st, camTrans.et, ease);
    camera.fov = camTrans.sf + (camTrans.tf - camTrans.sf) * ease;
    camera.updateProjectionMatrix();
    camera.lookAt(controls.target);

    if (t >= 1) {
      camera.position.copy(camTrans.ep);
      controls.target.copy(camTrans.et);
      camera.fov = camTrans.tf;
      camera.updateProjectionMatrix();
      camera.lookAt(controls.target);
      camTrans = null;
      camTransAdvanceLastAt = 0;
      cameraAnimating = false;
      isCameraTransitioning.value = false;
      finishCameraAnimationState();
      completeCameraTransition();
    }
  }

  function detectVideoLoopRewind(t: number) {
    return lastVideoPlaybackSyncTime > 0.2 && t + 0.25 < lastVideoPlaybackSyncTime;
  }

  /** 章节动画驱动 mesh 时暂停 GLTF 自带动画，避免每帧覆盖自定义位移 */
  function shouldAdvanceGltfMixers() {
    return !(_chAnimLock && !chAnimWallclock);
  }

  function resetGltfMixersForChapterResync() {
    for (const mixer of mixers) {
      try {
        mixer.setTime(0);
      } catch {
        /* ignore */
      }
    }
  }

  /** 视频循环/回退/切章：整树重置后再套章节动画（仅边界调用） */
  function resyncChapterMeshFromVideo(
    video: HTMLVideoElement,
    ch: Chapter,
    elapsed: number,
    options?: { rebuildOutlines?: boolean }
  ) {
    invalidateChapterAnimTargetsCache(ch.id);
    invalidateChapterAnimPivotCaches(ch);
    resetGltfMixersForChapterResync();
    // 切章或本章含线框/描边/高亮时必须重建；skip 会留下「有模型无线框」或 colorWrite=false 变黑
    const rebuildOutlines =
      options?.rebuildOutlines === true || chapterNeedsOutlineRebuild(ch);
    applyChapterModelState(ch, elapsed, {
      skipOutlineRebuild: !rebuildOutlines,
      skipOverlaySync: false,
      forceElapsed: elapsed,
      immediatePresent: true
    });
    editPlaybackSyncChapterId = ch.id;
    editPlaybackSyncElapsed = elapsed;
    lastVideoPlaybackSyncTime = video.currentTime;
  }

  /** 编辑态是否正跟视频时间刷 mesh（切选中时勿再套 start/end 预览） */
  function isEditVideoMeshSyncActive() {
    if (viewOnly.value || isPreviewMode.value) return false;
    const video = videoEl.value;
    return !!(video && !video.paused && _chAnimLock && !chAnimWallclock);
  }

  /** 按当前视频时间整章节刷新 mesh（选中切换时用） */
  function applyChapterMeshFromCurrentVideo(ch?: Chapter | null) {
    const video = videoEl.value;
    const chapter = ch ?? (video ? getPlaybackChapterAtTime(video.currentTime) : selectedChapter.value);
    if (!chapter) return;
    if (!chapterHasAnyModelEdits(chapter)) {
      resetAllModelsToDefault();
      return;
    }
    const elapsed = video ? getChapterAnimElapsed(chapter, video.currentTime) : 0;
    applyChapterModelState(chapter, elapsed, {
      skipOutlineRebuild: false,
      skipOverlaySync: false,
      forceElapsed: elapsed
    });
    editPlaybackSyncChapterId = chapter.id;
    editPlaybackSyncElapsed = elapsed;
    if (video) lastVideoPlaybackSyncTime = video.currentTime;
  }

  /**
   * 视频驱动章节位移：编辑/预览/展示共用同一套「可播放章节 + elapsed」。
   * 章节解析与预览 syncPresentationPlaybackFromVideo 一致：nav → resolvePlayable。
   */
  function syncVideoDrivenChapterMesh() {
    const video = videoEl.value;
    if (!video || video.paused) return;
    if (chAnimWallclock) return;

    // 切章/seek 锁定期：禁止用「尚未 seek 到位」的旧 currentTime 解析上一章。
    // 否则会出现：动画2已隐藏模型 → 旧时间又把动画1显示态刷回来 → 肉眼闪一下。
    if (videoChapterSyncPaused || chapterNavLock.value || presentationChapterTransition || video.seeking) {
      return;
    }

    const t = video.currentTime;
    const loopRewind = detectVideoLoopRewind(t);
    const queryTime = loopRewind ? 0 : t;

    if (loopRewind) chapterPlayTarget.value = null;

    // 优先走统一解析（含 playTarget 钉住），避免仅按 queryTime 在 seek 尾段回刷上一章
    let ch = resolveVideoPlaybackChapter(video);
    if (!ch || !chapterBelongsToActiveVideo(ch)) {
      const navChapter = getPresentationChapterAtVideoTime(queryTime);
      const playable = navChapter ? resolvePlayableChapterForPresentation(navChapter) : null;
      ch = chapterBelongsToActiveVideo(playable) ? playable : null;
    }
    // 再兜底：严格按当前活动视频时间轴解析，绝不跨视频
    if (!ch) {
      ch = activeVideoId.value
        ? resolveActiveAnimationAtTime(nodes.value, activeVideoId.value, queryTime)
        : null;
    }

    if (!ch) {
      lastVideoPlaybackSyncTime = t;
      return;
    }

    // 时间已落入当前章后，playTarget 跟随视频；未落入时 resolve 已钉住目标章，勿改写
    if (
      chapterPlayTarget.value?.id !== ch.id &&
      isChapterInPlaybackRange(ch, queryTime)
    ) {
      chapterPlayTarget.value = ch;
    }

    if (!viewOnly.value && !isPreviewMode.value) {
      const navForCam = getPresentationChapterAtVideoTime(queryTime) ?? ch;
      if (editPlaybackCameraChapterId !== ch.id) {
        editPlaybackCameraChapterId = ch.id;
        applyChapterCameraForNav(navForCam, "playback");
      }
    }

    const elapsed = getChapterAnimElapsed(ch, queryTime);
    const chapterChanged = editPlaybackSyncChapterId !== ch.id || chAnimChapterId !== ch.id;
    const elapsedRegressed =
      !chapterChanged &&
      !loopRewind &&
      editPlaybackSyncElapsed > CHAPTER_TIME_EPS &&
      elapsed + CHAPTER_TIME_EPS < editPlaybackSyncElapsed;
    // 循环回跳 / 切章 / 时间回退：必须整树重置。仅 applyChapterAnimOnly 不会清掉
    // 「当前章未配置、但上一章移动过」的子部件，第二轮会从错误姿态起跳。
    const needsFullResync = loopRewind || chapterChanged || elapsedRegressed;

    _chAnimLock = true;
    chAnimWallclock = false;

    // 自动切章：先写可见性再动位姿，避免上一章显示态残留一帧
    if (chapterChanged) {
      lastPresentationAutoSwitchChapterId = ch.id;
      applyChapterVisibilityOnly(ch);
    }

    if (!chapterHasAnyModelEdits(ch)) {
      if (needsFullResync) {
        resetAllModelsToDefault();
        invalidateChapterAnimTargetsCache(ch.id);
        if (chapterChanged) {
          applyChapterVisibilityOnly(ch);
          renderViewportFrame();
        }
      }
      lastVideoPlaybackSyncTime = t;
      editPlaybackSyncChapterId = ch.id;
      editPlaybackSyncElapsed = elapsed;
      chAnimChapterId = ch.id;
      return;
    }

    if (needsFullResync || !chapterHasAnimation(ch)) {
      chAnimChapterId = ch.id;
      resyncChapterMeshFromVideo(video, ch, elapsed, {
        // 自动切章：隐藏→显示+线框 必须重建 overlay，否则只见实体不见线框
        rebuildOutlines: chapterChanged || loopRewind || chapterNeedsOutlineRebuild(ch)
      });
      if (loopRewind) lastPresentationAutoSwitchChapterId = null;
      return;
    }

    applyChapterAnimOnly(ch, elapsed);
    chAnimChapterId = ch.id;
    editPlaybackSyncChapterId = ch.id;
    editPlaybackSyncElapsed = elapsed;
    lastVideoPlaybackSyncTime = t;
  }

  function syncVideoChapterAnimationInMainLoop(_now: number) {
    // mesh 已在节流前由 syncVideoDrivenChapterMesh 统一处理
  }

  function syncWallclockChapterAnimationInMainLoop(now: number) {
    if (!_chAnimLock || !chAnimWallclock || !chAnimChapterId) return;
    const ch = chapters.value.find(c => c.id === chAnimChapterId);
    if (!ch) return;
    const elapsed = (now - chAnimWallclockStart) / 1000;
    const clamped = Math.min(elapsed, chAnimWallclockMaxDur);
    applyChapterWallclockFrame(ch, clamped);
    if (elapsed >= chAnimWallclockMaxDur) {
      applyChapterWallclockFrame(ch, chAnimWallclockMaxDur);
      stopChapterAnimation();
      syncTransformVisualOverlays();
    }
  }

  /** 展示/预览：RAF 只观察并校准 session；媒体副作用只由 command effect 执行。 */
  function isPresentationAtMediaEnd(video: HTMLVideoElement): boolean {
    const dur = Number.isFinite(video.duration) && video.duration > 0 ? video.duration : duration.value;
    if (!(dur > 0)) return false;
    return video.currentTime >= dur - Math.max(CHAPTER_END_EPS, 0.08);
  }

  /** Boot/seek race: media still at EOF while session targets an earlier time. */
  function isStalePresentationMediaEnd(video: HTMLVideoElement): boolean {
    if (
      presentationPlaybackSession.phase === "seeking" ||
      presentationChapterTransition ||
      videoChapterSyncPaused ||
      presentationSeekTargetTime != null
    ) {
      return true;
    }
    // Only suppress EOF during the short post-command settle window (load / seek to start).
    if (performance.now() >= presentationManualNavUntil) return false;
    const dur =
      Number.isFinite(video.duration) && video.duration > 0 ? video.duration : duration.value;
    if (!(dur > 0)) return false;
    const target = presentationPlaybackSession.targetTime;
    return Number.isFinite(target) && target < dur - Math.max(0.5, CHAPTER_END_EPS * 4);
  }

  function syncPresentationProgressInMainLoop(_now: number) {
    if (!viewOnly.value && !isPreviewMode.value) return;
    const video = videoEl.value;
    if (!video) return;

    const seekLocked =
      videoChapterSyncPaused || chapterNavLock.value || presentationChapterTransition;

    if (video.ended || (video.paused && isPresentationAtMediaEnd(video))) {
      // Do not overwrite a start/seek command with a stale EOF from cached media.
      if (isStalePresentationMediaEnd(video)) {
        if (!seekLocked && presentationPlaybackSession.phase === "seeking") {
          syncPresentationUiFromTimeline(presentationPlaybackSession.targetTime);
        }
        return;
      }
      // 播放意图未手动暂停：片尾循环，不把 intent 改成 pause。
      if (loopPresentationPlaybackFromStart()) return;
      if (presentationPlaybackSession.phase === "ended") return;
      presentationPlaybackSession.phase = "ended";
      presentationPlaybackSession.intent = "pause";
      presentationPlaybackSession.committedTime = video.currentTime;
      presentationPlaybackSession.targetTime = video.currentTime;
      presentationExpectPlaying = false;
      presentationUserWantsPaused = true;
      presentationEndedUiSynced = true;
      clearPresentationResumeTimer();
      if (!seekLocked) syncPresentationUiFromTimeline(video.currentTime);
      return;
    }
    presentationEndedUiSynced = false;

    if (!video.seeking && !video.paused && !video.ended) {
      // Stale play() after a pause command: re-assert pause, never adopt as playing.
      if (presentationPlaybackSession.intent === "pause") {
        video.pause();
        return;
      }
      const target = presentationPlaybackSession.targetTime;
      if (canAdoptPresentationVideoTime(video, target)) {
        presentationSeekTargetTime = null;
        presentationPlaybackSession.committedTime = video.currentTime;
        presentationPlaybackSession.phase = "playing";
      } else if (
        presentationPlaybackSession.phase === "playing" &&
        presentationSeekTargetTime == null
      ) {
        // 已在播放且无未完成 seek：每帧跟视频时钟，避免进度条一顿一顿。
        presentationPlaybackSession.committedTime = video.currentTime;
      }
      if (maybeAutoAdvancePresentation(video)) return;
      syncPresentationUiFromTimeline();
      if (!seekLocked) {
        syncPresentationPlaybackFromVideo(video);
      }
    } else if (
      presentationPlaybackSession.intent === "play" &&
      !presentationUserWantsPaused &&
      video.paused &&
      !seekLocked
    ) {
      // seeking 卡住（seek 完仍 paused）也必须续播，不能只刷 UI。
      if (
        presentationPlaybackSession.phase === "seeking" ||
        presentationPlaybackSession.phase === "playing" ||
        presentationPlaybackSession.phase === "blocked"
      ) {
        presentationPlaybackSession.phase = "blocked";
        void recoverPresentationPlaybackAfterUnexpectedPause();
      }
    } else if (seekLocked || presentationPlaybackSession.phase === "seeking") {
      syncPresentationUiFromTimeline();
    }
  }

  /** 编辑态：RAF 跟视频推进高亮，避免 timeupdate 稀疏或播完仍停在上一章 */
  function syncEditProgressHighlightInMainLoop() {
    if (viewOnly.value || isPreviewMode.value) return;
    const video = videoEl.value;
    if (!video || video.seeking) return;

    const seekLocked =
      videoChapterSyncPaused || chapterNavLock.value || presentationChapterTransition;
    if (seekLocked) return;

    if (!video.paused && !video.ended) {
      currentTime.value = video.currentTime;
      syncEditModePlaybackFromVideo(video);
    } else if (video.ended) {
      currentTime.value = video.currentTime;
      syncEditModePlaybackFromVideo(video);
    }
  }

  function animate(now = performance.now()) {
    afid = requestAnimationFrame(animate);
    advanceCameraTransition(now);
    syncPresentationProgressInMainLoop(now);
    syncEditProgressHighlightInMainLoop();

    // 视频驱动位移：编辑/预览共用，放在 FPS 节流之前以免漏掉循环回跳帧
    syncVideoDrivenChapterMesh();

    const targetInterval = 1000 / targetFps.value;
    const sinceLastPresent = viewportLastPresentAt ? now - viewportLastPresentAt : targetInterval;
    if (viewportLastPresentAt && sinceLastPresent < targetInterval * 0.9 && !camTrans) {
      return;
    }
    const frameDtSec = viewportLastPresentAt
      ? Math.min(sinceLastPresent / 1000, 0.05)
      : targetInterval / 1000;
    viewportLastPresentAt = now;

    if (!camTrans) controls.update();

    if (shouldAdvanceGltfMixers()) {
      mixers.forEach(m => m.update(frameDtSec));
    }

    syncWallclockChapterAnimationInMainLoop(now);

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

    if (!isViewportMotionBusy()) {
      syncTransformVisualOverlays();
      updateEditorGizmoScales();
    }
    lastFramePresentAt = now;
    adaptPresentationRenderPerf(frameDtSec);
    adaptEditorRenderPerf(frameDtSec);
    renderViewportFrame();
    updateModelIntroLabelPositions(now);

    viewportFpsFrameCount++;
    viewportFpsAccumMs += sinceLastPresent;
    if (viewportFpsAccumMs >= 400) {
      displayFps.value = Math.round(viewportFpsFrameCount / (viewportFpsAccumMs / 1000));
      viewportFpsFrameCount = 0;
      viewportFpsAccumMs = 0;
    }
  }

  let camTrans: any = null;
  let camTransAdvanceLastAt = 0;
  let afterCameraChapterId: string | null = null;
  let afterCameraCallback: (() => void) | null = null;

  function finishCameraAnimationState() {
    if (!controls || !camera) return;
    controls.enableDamping = false;
    controls.update();
    controls.enableDamping = true;
  }

  function resetControlsDamping() {
    finishCameraAnimationState();
  }

  function cancelCameraTransitionSilently() {
    camTrans = null;
    camTransAdvanceLastAt = 0;
    cameraAnimating = false;
    isCameraTransitioning.value = false;
    afterCameraChapterId = null;
    afterCameraCallback = null;
    chapterNavLock.value = false;
  }

  function completeCameraTransition() {
    if (!afterCameraCallback) return;
    const fn = afterCameraCallback;
    afterCameraChapterId = null;
    afterCameraCallback = null;
    fn();
  }

  function animCam(pos: number[], tgt: number[], fov: number, dur = CHAPTER_CAMERA_TRANSITION_SEC, forceTransition = false) {
    cameraAnimating = true;
    isCameraTransitioning.value = true;
    clearHoverTarget();
    if (controls) {
      controls.enableDamping = false;
      controls.update();
    }
    const ep = new THREE.Vector3(...pos);
    const et = new THREE.Vector3(...tgt);
    const dist = camera.position.distanceTo(ep) + controls.target.distanceTo(et);
    const fovDelta = Math.abs(camera.fov - fov);
    const safeDur = Math.max(dur, CHAPTER_CAMERA_SWITCH_MIN_SEC);
    if (!forceTransition && dist < 1e-4 && fovDelta < 0.01) {
      snapCam(pos, tgt, fov);
      return;
    }
    camTransAdvanceLastAt = 0;
    camTrans = {
      sp: camera.position.clone(),
      st: controls.target.clone(),
      sf: camera.fov,
      ep,
      et,
      tf: fov,
      dur: safeDur,
      elapsed: 0
    };
  }

  function snapCam(pos: number[], tgt: number[], fov: number) {
    camTrans = null;
    camTransAdvanceLastAt = 0;
    cameraAnimating = false;
    isCameraTransitioning.value = false;
    camera.position.set(pos[0], pos[1], pos[2]);
    controls.target.set(tgt[0], tgt[1], tgt[2]);
    camera.fov = fov;
    camera.updateProjectionMatrix();
    camera.lookAt(controls.target);
    finishCameraAnimationState();
    completeCameraTransition();
  }

  function defaultModelCfg() {
    return JSON.parse(JSON.stringify(createDefaultModelConfig()));
  }

  function chapterModelCfg(ch: Chapter, modelId: string) {
    if (!chapterModelHasEdits(ch, modelId)) return null;
    const raw = ch.modelConfigs?.[modelId];
    if (!raw) return null;
    return getModelConfig(raw);
  }

  function chapterRootModelHasEdits(ch: Chapter | null | undefined, modelId: string): boolean {
    if (!ch?.modelConfigs) return false;
    const raw = ch.modelConfigs[modelId] as ModelConfig | undefined;
    if (!raw) return false;
    const model = models.value.find(m => m.id === modelId);
    return modelHasEditsForConfig(getModelConfig(raw), createDefaultModelConfig(), model ?? null, null);
  }

  function chapterNodeConfigsHaveEdits(ch: Chapter | null | undefined, modelId: string): boolean {
    const raw = ch?.modelConfigs?.[modelId] as ModelConfig | undefined;
    if (!raw?.nodeConfigs) return false;
    const def = createDefaultModelConfig();
    const model = models.value.find(m => m.id === modelId);
    for (const [nodeId, nodeCfg] of Object.entries(raw.nodeConfigs)) {
      const displayId = model
        ? resolveDisplayNodeId(getModelHierarchy(modelId), nodeId)
        : nodeId;
      if (modelHasEditsForConfig(getModelConfig(nodeCfg as ModelConfig), def, model ?? null, displayId)) {
        return true;
      }
    }
    return false;
  }

  function chapterModelHasEdits(ch: Chapter | null | undefined, modelId: string): boolean {
    return chapterRootModelHasEdits(ch, modelId) || chapterNodeConfigsHaveEdits(ch, modelId);
  }

  function pruneChapterModelConfigIfUnedited(ch: Chapter, modelId: string) {
    if (!ch.modelConfigs?.[modelId]) return;
    const raw = ch.modelConfigs[modelId] as ModelConfig;
    const def = createDefaultModelConfig();
    if (raw.nodeConfigs) {
      const model = models.value.find(m => m.id === modelId);
      for (const [nodeId, nodeCfg] of Object.entries(raw.nodeConfigs)) {
        const displayId = resolveDisplayNodeId(getModelHierarchy(modelId), nodeId);
        if (!modelHasEditsForConfig(getModelConfig(nodeCfg as ModelConfig), def, model ?? null, displayId)) {
          delete raw.nodeConfigs[nodeId];
        }
      }
      if (Object.keys(raw.nodeConfigs).length === 0) delete raw.nodeConfigs;
    }
    if (!chapterModelHasEdits(ch, modelId)) {
      delete ch.modelConfigs[modelId];
    }
  }

  function ensureChapterModelConfigsMap(ch: Chapter) {
    if (!ch.modelConfigs) ch.modelConfigs = {};
  }

  function formSnapshotHasVisualEdits(snapshot: ReturnType<typeof getModelFormSnapshot>): boolean {
    const def = createDefaultModelConfig();
    return (
      snapshot.visible !== def.visible ||
      snapshot.outline !== def.outline ||
      snapshot.wireframe !== !!def.wireframe ||
      snapshot.highlight !== def.highlight ||
      !!snapshot.intro?.trim() ||
      snapshot.scale !== def.scale ||
      Math.abs(snapshot.posOffsetX) > 1e-4 ||
      Math.abs(snapshot.posOffsetY) > 1e-4 ||
      Math.abs(snapshot.posOffsetZ) > 1e-4
    );
  }

  function liveAnimSegmentsHaveEdits(): boolean {
    if (!selModel.value || animSegments.length === 0) return false;
    if (!animSegmentsBelongToCurrentSelection()) return false;
    return animSegmentsHaveRealEdits(animSegments, selModel.value, selModelNodeId.value);
  }

  function selectionOwnerKey(
    modelId?: string | null,
    nodeId?: string | null | undefined,
    chapterId?: string | null | undefined
  ): string | null {
    const mid = modelId ?? selModelId.value;
    if (!mid) return null;
    const nid = nodeId !== undefined ? nodeId : selModelNodeId.value;
    const cid = chapterId !== undefined ? chapterId : selectedChapterId.value;
    // 必须含章节 id：同一子物体在动画 A/B 下是两份独立编辑，不能共享 live 段落归属
    return `${cid ?? ""}|${mid}::${nid ?? ""}`;
  }

  function animSegmentsBelongToCurrentSelection(): boolean {
    if (!animSegmentsOwnerKey) return animSegments.length === 0;
    return animSegmentsOwnerKey === selectionOwnerKey();
  }

  function animSegmentsBelongToChapter(chapterId: string | null | undefined): boolean {
    if (!chapterId || !animSegmentsOwnerKey) return false;
    return animSegmentsOwnerKey.startsWith(`${chapterId}|`);
  }

  function bindAnimSegmentsToSelection(
    modelId?: string | null,
    nodeId?: string | null | undefined,
    chapterId?: string | null | undefined
  ) {
    animSegmentsOwnerKey = selectionOwnerKey(modelId, nodeId, chapterId);
  }

  function clearLiveAnimEditorState() {
    animDirty.value = false;
    animSegments.splice(0);
    animSegmentsOwnerKey = null;
    editingSeg.value = null;
    editingSegMode.value = "start";
  }

  function resetLiveAnimEditorBuffers() {
    clearLiveAnimEditorState();
  }

  function selectionDraftKey(chapterId: string, modelId: string, nodeId: string | null): string {
    return `${chapterId}|${modelId}|${nodeId ?? ""}`;
  }

  function parseSelectionDraftKey(key: string): { chapterId: string; modelId: string; nodeId: string | null } | null {
    const match = key.match(/^([^|]+)\|([^|]+)\|(.*)$/);
    if (!match) return null;
    const [, chapterId, modelId, nodeIdStr] = match;
    return { chapterId, modelId, nodeId: nodeIdStr || null };
  }

  function cloneAnimSegmentsForDraft(segments: any[]): any[] {
    return segments.map(s => ({
      id: s.id,
      pauseTime: s.pauseTime,
      animTime: s.animTime,
      easing: s.easing,
      pivot: s.pivot,
      startPos: [...(s.startPos ?? [0, 0, 0])],
      endPos: [...(s.endPos ?? [0, 0, 0])],
      startScale: s.startScale,
      endScale: s.endScale,
      startRot: [...(s.startRot ?? [0, 0, 0])],
      endRot: [...(s.endRot ?? [0, 0, 0])],
      _expandedPanels: s._expandedPanels ? [...s._expandedPanels] : undefined
    }));
  }

  /** 待机时间/时长/曲线/轴心是否相对默认有改动（不含位姿） */
  function animSegmentHasNonDefaultMeta(seg: any): boolean {
    if (!seg) return false;
    if ((seg.pauseTime ?? 0) !== 0) return true;
    if (Math.abs((seg.animTime ?? 3) - 3) > 1e-3) return true;
    if ((seg.easing ?? "easeInOut") !== "easeInOut") return true;
    if ((seg.pivot ?? "center") !== "center") return true;
    return false;
  }

  function animSegmentsHaveRealEdits(segments: any[], model: Model, nodeId: string | null): boolean {
    return segments.some(
      seg => animSegmentDiffersFromDefault(seg, model, nodeId) || animSegmentHasNonDefaultMeta(seg)
    );
  }

  function draftHasEdits(draft: SelectionEditDraft, model: Model, nodeId: string | null): boolean {
    if (formSnapshotHasVisualEdits(draft.form)) return true;
    if (draft.animSegments.length === 0) return false;
    // 不以裸 animDirty 判定：章节切换时易误标 dirty，导致未编辑节点显示「已改」
    return animSegmentsHaveRealEdits(draft.animSegments, model, nodeId);
  }

  function hasSelectionEditDraft(chapterId: string, modelId: string, nodeId: string | null): boolean {
    const draft = selectionEditDrafts.get(selectionDraftKey(chapterId, modelId, nodeId));
    if (!draft) return false;
    const model = models.value.find(m => m.id === modelId);
    if (!model) return true;
    return draftHasEdits(draft, model, nodeId);
  }

  function modelHasSelectionEditDrafts(chapterId: string, modelId: string): boolean {
    const prefix = `${chapterId}|${modelId}|`;
    for (const key of selectionEditDrafts.keys()) {
      if (!key.startsWith(prefix)) continue;
      const parsed = parseSelectionDraftKey(key);
      if (!parsed) continue;
      if (hasSelectionEditDraft(parsed.chapterId, parsed.modelId, parsed.nodeId)) return true;
    }
    return false;
  }

  function clearSelectionEditDraftsForChapter(chapterId: string) {
    for (const key of [...selectionEditDrafts.keys()]) {
      if (key.startsWith(`${chapterId}|`)) selectionEditDrafts.delete(key);
    }
  }

  /** 同节点内切换选中时，缓存当前 live 编辑（不写 chapter.modelConfigs） */
  function captureSelectionSession(chapterId: string, modelId: string, nodeId: string | null) {
    const model = models.value.find(m => m.id === modelId);
    if (!model) return;

    const key = selectionDraftKey(chapterId, modelId, nodeId);
    const ownerKey = selectionOwnerKey(modelId, nodeId, chapterId);
    // live 段落必须同时匹配「章节 + 模型 + 子节点」，否则会把动画 A 的编辑落到动画 B
    if (selectionOwnerKey() !== ownerKey) return;
    if (animSegments.length > 0 && animSegmentsOwnerKey !== ownerKey) return;

    const snapshot = getModelFormSnapshot();
    const segments =
      animSegmentsOwnerKey === ownerKey && animSegments.length > 0
        ? cloneAnimSegmentsForDraft(animSegments)
        : [];

    const hasVisualEdits = formSnapshotHasVisualEdits(snapshot);
    const hasAnimEdits = segments.length > 0 && animSegmentsHaveRealEdits(segments, model, nodeId);

    if (!hasAnimEdits && !hasVisualEdits) {
      selectionEditDrafts.delete(key);
      return;
    }

    selectionEditDrafts.set(key, {
      animSegments: segments,
      animDuration: animDuration.value,
      animEasing: animEasing.value,
      animDirty: animDirty.value && hasAnimEdits,
      form: { ...snapshot }
    });
  }

  /** @deprecated 使用 captureSelectionSession */
  function saveSelectionEditDraft(chapterId: string, modelId: string, nodeId: string | null) {
    captureSelectionSession(chapterId, modelId, nodeId);
  }

  function buildModelConfigFromDraft(draft: SelectionEditDraft, model: Model, nodeId: string | null): ModelConfig {
    const cfg = createDefaultModelConfig();
    const s = draft.form;
    cfg.visible = s.visible;
    cfg.outline = s.outline;
    cfg.wireframe = s.wireframe;
    cfg.highlight = s.highlight;
    cfg.outlineColor = s.outlineColor;
    cfg.wireframeColor = s.wireframeColor;
    cfg.modelHighlightColor = s.modelHighlightColor;
    cfg.animation = s.animation;
    cfg.intro = s.intro;
    cfg.scale = s.scale;
    cfg.posOffset = [s.posOffsetX, s.posOffsetY, s.posOffsetZ];

    const hasAnimEdits =
      draft.animSegments.length > 0 && animSegmentsHaveRealEdits(draft.animSegments, model, nodeId);
    if (hasAnimEdits) {
      cfg.animation = true;
      const obj = getTransformTarget(model.id, nodeId);
      cfg.animConfig = {
        duration: draft.animDuration,
        easing: draft.animEasing,
        segments: draft.animSegments.map(seg => {
          const startPos = [...seg.startPos];
          const endPos = [...seg.endPos];
          const startRot = [...seg.startRot];
          const endRot = [...seg.endRot];
          if (obj && usesRelativeAnimRotation(obj)) {
            return {
              id: seg.id,
              pauseTime: seg.pauseTime || 0,
              animTime: seg.animTime || 3,
              easing: seg.easing || draft.animEasing,
              pivot: seg.pivot || "center",
              startPos: animPosToAbsolute(obj, startPos),
              endPos: animPosToAbsolute(obj, endPos),
              startScale: seg.startScale,
              endScale: seg.endScale,
              startRot: animRotToAbsolute(obj, startRot),
              endRot: animRotToAbsolute(obj, endRot)
            };
          }
          return {
            id: seg.id,
            pauseTime: seg.pauseTime || 0,
            animTime: seg.animTime || 3,
            easing: seg.easing || draft.animEasing,
            pivot: seg.pivot || "center",
            startPos: [...seg.startPos],
            endPos: [...seg.endPos],
            startScale: seg.startScale,
            endScale: seg.endScale,
            startRot: [...seg.startRot],
            endRot: [...seg.endRot]
          };
        })
      } as any;
    }
    return cfg;
  }

  function applySelectionEditDraftToEditor(draft: SelectionEditDraft) {
    applyModelFormSnapshot(draft.form);
    animDuration.value = draft.animDuration;
    animEasing.value = draft.animEasing;
    animSegments.splice(
      0,
      animSegments.length,
      ...cloneAnimSegmentsForDraft(draft.animSegments)
    );
    if (animSegments[0] && selModel.value) {
      // 草稿来自 live 编辑器，已是相对值，勿再做绝对→相对转换
      invalidateSegPivotCache(animSegments[0]);
    }
    bindAnimSegmentsToSelection(undefined, undefined, selectedChapterId.value);
    animDirty.value = draft.animDirty;
    if (animSegments[0]) {
      editingSeg.value = animSegments[0];
      // 默认起始帧预览；「已改」段也不自动切到 end，否则切选中会把 mesh 打到结束位移
      editingSegMode.value = "start";
    }
    bumpAnimSegmentRevision();
  }

  function flushDraftToChapter(ch: Chapter, modelId: string, nodeId: string | null, draft: SelectionEditDraft) {
    const model = models.value.find(m => m.id === modelId);
    if (!model) return;

    const hasAnimEdits =
      draft.animSegments.length > 0 && animSegmentsHaveRealEdits(draft.animSegments, model, nodeId);
    const hasVisualEdits = formSnapshotHasVisualEdits(draft.form);

    if (!hasAnimEdits && !hasVisualEdits) {
      pruneActiveTargetModelConfigIfUnedited(ch, modelId, nodeId);
      return;
    }

    if (hasAnimEdits) {
      persistAnimConfigToChapterFor(ch, modelId, nodeId, draft.animSegments, {
        duration: draft.animDuration,
        easing: draft.animEasing
      });
    }

    const targetCfg = getWritableModelConfigForTarget(ch, modelId, nodeId);
    const s = draft.form;
    targetCfg.visible = s.visible;
    targetCfg.outline = s.outline;
    targetCfg.wireframe = s.wireframe;
    targetCfg.highlight = s.highlight;
    targetCfg.outlineColor = s.outlineColor;
    targetCfg.wireframeColor = s.wireframeColor;
    targetCfg.modelHighlightColor = s.modelHighlightColor;
    targetCfg.animation = s.animation;
    targetCfg.intro = s.intro;
    targetCfg.scale = s.scale;
    if (hasVisualEdits || hasAnimEdits) {
      targetCfg.posOffset = [s.posOffsetX, s.posOffsetY, s.posOffsetZ];
    }
  }

  function flushChapterDraftsToModelConfigs(ch: Chapter) {
    for (const [key, draft] of selectionEditDrafts.entries()) {
      const parsed = parseSelectionDraftKey(key);
      if (!parsed || parsed.chapterId !== ch.id) continue;
      flushDraftToChapter(ch, parsed.modelId, parsed.nodeId, draft);
    }
    clearSelectionEditDraftsForChapter(ch.id);
    invalidateChapterAnimTargetsCache(ch.id);
  }

  /** 切换节点 / 保存场景 / 预览播放：会话落盘到 chapter.modelConfigs */
  function flushChapterSessionsToConfigs(ch: Chapter) {
    if (viewOnly.value || isPreviewMode.value) return;
    // 仅当 live 段落明确属于该章节时才捕获，避免把其它动画的编辑写入本节点
    if (
      selModel.value &&
      selectedChapterId.value === ch.id &&
      animSegmentsBelongToChapter(ch.id)
    ) {
      captureSelectionSession(ch.id, selModel.value.id, selModelNodeId.value);
    }
    flushChapterDraftsToModelConfigs(ch);
  }

  function persistActiveChapterDrafts(ch: Chapter) {
    flushChapterSessionsToConfigs(ch);
  }

  function persistAllChapterDrafts() {
    if (viewOnly.value || isPreviewMode.value) return;
    const active = selectedChapter.value;
    if (selModel.value && active && animSegmentsBelongToChapter(active.id)) {
      captureSelectionSession(active.id, selModel.value.id, selModelNodeId.value);
    }
    for (const ch of chapters.value) {
      flushChapterDraftsToModelConfigs(ch);
    }
  }

  /** 解析当前选中目标在节点下的有效配置：会话缓存 > chapter.modelConfigs > 默认 */
  function resolveEditorConfigForSelection(
    ch: Chapter,
    model: Model,
    nodeId: string | null
  ): { cfg: ModelConfig; fromSession: boolean } {
    const draftKey = selectionDraftKey(ch.id, model.id, nodeId);
    const draft = selectionEditDrafts.get(draftKey);
    if (draft && draftHasEdits(draft, model, nodeId)) {
      return { cfg: buildModelConfigFromDraft(draft, model, nodeId), fromSession: true };
    }
    return { cfg: readModelConfigForTarget(ch, model.id, nodeId), fromSession: false };
  }

  function sanitizeChapterModelConfigs(ch: Chapter) {
    if (!ch.modelConfigs) return;
    for (const modelId of Object.keys(ch.modelConfigs)) {
      pruneChapterModelConfigIfUnedited(ch, modelId);
    }
  }

  function pruneAllChapterModelConfigs() {
    for (const ch of chapters.value) {
      sanitizeChapterModelConfigs(ch);
    }
  }

  function resetObject3DTransformToDefault(m: Model, obj: THREE.Object3D, isRoot: boolean) {
    if (isRoot) {
      const bp = obj.userData.basePos || m.basePosition || DEFAULT_MODEL_BASE_POSITION;
      obj.position.set(bp[0], bp[1], bp[2]);
      obj.rotation.set(0, 0, 0);
      obj.quaternion.identity();
      obj.scale.setScalar(1);
    } else {
      const bp = obj.userData.baseLocalPos || [0, 0, 0];
      const br = obj.userData.baseLocalRot || [0, 0, 0];
      const bs = obj.userData.baseLocalScale ?? 1;
      obj.position.set(bp[0], bp[1], bp[2]);
      obj.rotation.set(br[0], br[1], br[2]);
      obj.quaternion.setFromEuler(new THREE.Euler(br[0], br[1], br[2], "XYZ"));
      obj.scale.setScalar(bs);
    }
  }

  function resetObject3DToDefaultState(
    m: Model,
    obj: THREE.Object3D,
    isRoot: boolean,
    options?: { preserveVisibility?: boolean }
  ) {
    resetObject3DTransformToDefault(m, obj, isRoot);
    rebuildOutlineForObject(m, obj, createDefaultModelConfig(), {
      touchVisibility: !options?.preserveVisibility
    });
  }

  function resetModelTreeTransformsOnly(m: Model) {
    const root = meshes.get(m.id);
    if (!root) return;
    resetObject3DTransformToDefault(m, root, true);
    traverseObject3DSafely(root, child => {
      if (child === root) return;
      if (
        child.userData?.isEdgeLine ||
        child.userData?.isSelectionHelper ||
        child.userData?.isOutlineShell ||
        child.userData?.isBodyHighlightOverlay
      ) {
        return;
      }
      if (!child.userData?.nodeId) return;
      resetObject3DTransformToDefault(m, child, false);
    });
  }

  function resetModelTreeToDefault(m: Model) {
    const root = meshes.get(m.id);
    if (!root) return;
    resetObject3DToDefaultState(m, root, true);
    traverseObject3DSafely(root, child => {
      if (child === root) return;
      if (
        child.userData?.isEdgeLine ||
        child.userData?.isSelectionHelper ||
        child.userData?.isOutlineShell ||
        child.userData?.isBodyHighlightOverlay
      ) {
        return;
      }
      if (!child.userData?.nodeId) return;
      resetObject3DToDefaultState(m, child, false);
    });
  }

  function traverseObject3DSafely(root: THREE.Object3D, visitor: (obj: THREE.Object3D) => void) {
    const stack: THREE.Object3D[] = [root];
    while (stack.length) {
      const current = stack.pop();
      if (!current) continue;
      visitor(current);
      const children = (current as any).children;
      if (!Array.isArray(children) || children.length === 0) continue;
      for (let i = children.length - 1; i >= 0; i--) {
        const child = children[i];
        if (child && typeof child === "object") {
          stack.push(child as THREE.Object3D);
        }
      }
    }
  }

  function isNodeConfiguredInChapter(cfg: ModelConfig, modelId: string, nodeId: string): boolean {
    if (!cfg.nodeConfigs) return false;
    const displayId = resolveDisplayNodeId(getModelHierarchy(modelId), nodeId);
    return !!(cfg.nodeConfigs[displayId] || cfg.nodeConfigs[nodeId]);
  }

  function applyModelVisualOnly(m: Model, obj: THREE.Object3D, cfg: ModelConfig, skipOutlineRebuild = false) {
    const modelRoot = meshes.get(m.id);
    const ownerKey = (obj.userData?.nodeId as string | undefined) || `root:${m.id}`;
    if (!cfg.visible) {
      obj.visible = false;
      // 隐藏时务必清掉描边/线框 overlay；否则 skipOutline 路径会残留轮廓闪一下
      if (modelRoot) {
        removeVisualOverlaysForOwner(modelRoot, ownerKey);
      }
      if (!skipOutlineRebuild) {
        syncModelConfigOutlinePass();
        invalidatePickMeshCache();
      }
      return;
    }
    obj.visible = true;
    if (!skipOutlineRebuild) {
      rebuildOutlineForObject(m, obj, cfg);
      return;
    }
    // skip 重建时仍须处理：线框/描边必须套上；非线框则恢复上一章 colorWrite=false 残留（否则变黑）
    if (cfg.wireframe || cfg.outline || cfg.highlight) {
      rebuildOutlineForObject(m, obj, cfg);
    } else if (modelRoot) {
      removeVisualOverlaysForOwner(modelRoot, ownerKey);
    }
  }

  function applyStaticModelTransform(m: Model, obj: THREE.Object3D, cfg: ModelConfig, isRoot: boolean) {
    obj.scale.setScalar(cfg.scale || 1);
    if (isRoot) {
      const bp = obj.userData.basePos || m.basePosition || DEFAULT_MODEL_BASE_POSITION;
      obj.position.set(
        bp[0] + (cfg.posOffset?.[0] || 0),
        bp[1] + (cfg.posOffset?.[1] || 0),
        bp[2] + (cfg.posOffset?.[2] || 0)
      );
      obj.rotation.set(0, 0, 0);
    } else {
      const bp = obj.userData.baseLocalPos || [0, 0, 0];
      const br = obj.userData.baseLocalRot || [0, 0, 0];
      obj.position.set(
        bp[0] + (cfg.posOffset?.[0] || 0),
        bp[1] + (cfg.posOffset?.[1] || 0),
        bp[2] + (cfg.posOffset?.[2] || 0)
      );
      obj.rotation.set(br[0], br[1], br[2]);
    }
  }

  function shouldUseLiveAnimSegments(modelId: string, nodeId: string | null): boolean {
    if (viewOnly.value || isPreviewMode.value || chapterPlayTarget.value) return false;
    const video = videoEl.value;
    if (video && !video.paused) return false;
    if (_chAnimLock) return false;
    if (selectedChapterId.value && lastSyncedModelFormChapterId !== selectedChapterId.value) return false;
    if (!animSegmentsBelongToCurrentSelection()) return false;
    if (!animSegmentsBelongToChapter(selectedChapterId.value)) return false;
    if (selModel.value?.id !== modelId) return false;
    if (nodeId) {
      return resolveDisplayNodeId(getModelHierarchy(modelId), selModelNodeId.value ?? "") === nodeId;
    }
    return !selModelNodeId.value;
  }

  type ApplyChapterModelStateOptions = {
    skipOutlineRebuild?: boolean;
    skipOverlaySync?: boolean;
    forceElapsed?: number;
    /** 切章隐藏后立刻出画，避免等下一拍 RAF */
    immediatePresent?: boolean;
  };

  function isChapterPlaybackActive() {
    if (viewOnly.value || isPreviewMode.value) return true;
    if (chapterPlayTarget.value) return true;
    if (_chAnimLock) return true;
    const video = videoEl.value;
    return !!(video && !video.paused);
  }

  function resolveChapterModelElapsed(_ch: Chapter, elapsedSec: number, options?: ApplyChapterModelStateOptions) {
    if (options?.forceElapsed !== undefined) return options.forceElapsed;
    if (isChapterPlaybackActive()) return elapsedSec;
    // 编辑态暂停时展示起始帧，与播放按钮一致，避免结束位移在切换动画后残留
    return 0;
  }

  function animSegmentHasTransformEdits(seg: any): boolean {
    return animSegmentDiffersFromDefault(seg, selModel.value, selModelNodeId.value);
  }

  function applyEditPreviewTransform(m: Model, obj: THREE.Object3D, cfg: ModelConfig, isRoot: boolean) {
    if (cfg.animation && cfg.animConfig?.segments?.length) {
      applyElapsedAnimToObject(obj, cfg, Number.POSITIVE_INFINITY);
    } else {
      applyStaticModelTransform(m, obj, cfg, isRoot);
    }
  }

  function selectionHasStoredEdits(ch: Chapter, model: Model, nodeId: string | null): boolean {
    if (hasSelectionEditDraft(ch.id, model.id, nodeId)) return true;
    if (hasModelConfigForTarget(ch, model.id, nodeId)) return true;
    const cfg = readModelConfigForTarget(ch, model.id, nodeId);
    return !!(cfg.animConfig?.segments?.length);
  }

  /** 解析目标在当前章节下的有效动画段（编辑器相对坐标） */
  function resolveAnimSegmentForTarget(
    ch: Chapter,
    model: Model,
    nodeId: string | null
  ): { seg: any; mode: "start" | "end"; hasAnim: boolean } {
    const draftKey = selectionDraftKey(ch.id, model.id, nodeId);
    const draft = selectionEditDrafts.get(draftKey);
    const draftSeg = draft?.animSegments?.[0];
    const cfg = readModelConfigForTarget(ch, model.id, nodeId);
    const hasStoredAnim = !!(cfg.animation && cfg.animConfig?.segments?.length);
    const draftHasAnimEdits =
      !!draftSeg && animSegmentsHaveRealEdits(draft!.animSegments, model, nodeId);

    if (draftHasAnimEdits && !(hasStoredAnim && draft && !draft.animDirty)) {
      return {
        seg: cloneAnimSegmentsForDraft([draftSeg!])[0],
        mode: resolveAnimPreviewMode(draftSeg!, model, nodeId),
        hasAnim: true
      };
    }

    if (hasStoredAnim) {
      const seg = mapStoredAnimSegment(cfg.animConfig.segments[0]);
      normalizeAnimSegmentTransformForEditor(
        model,
        nodeId,
        seg,
        !!(cfg.animConfig as any).relativeTransform
      );
      return {
        seg,
        mode: resolveAnimPreviewMode(seg, model, nodeId),
        hasAnim: true
      };
    }

    const seg = createDefaultAnimSegment(model, nodeId);
    seedPristineAnimSegmentFromDefaults(seg, model, nodeId);
    return { seg, mode: "start", hasAnim: false };
  }

  function targetHasChapterEdits(ch: Chapter, modelId: string, nodeId: string | null): boolean {
    if (hasSelectionEditDraft(ch.id, modelId, nodeId)) return true;
    return hasModelConfigForTarget(ch, modelId, nodeId);
  }

  /** 将指定模型/子节点在当前章节下的动画与视觉状态应用到 mesh（单一应用路径） */
  function applyTargetAnimVisualState(ch: Chapter, model: Model, nodeId: string | null) {
    const def = createDefaultModelConfig();
    const isRoot = !nodeId;
    const objs = isRoot
      ? (meshes.get(model.id) ? [meshes.get(model.id)!] : [])
      : getNodeObjects(model.id, nodeId, true);
    if (!objs.length) return;

    const draftKey = selectionDraftKey(ch.id, model.id, nodeId);
    const draft = selectionEditDrafts.get(draftKey);
    const cfg = readModelConfigForTarget(ch, model.id, nodeId);
    const { seg, mode, hasAnim } = resolveAnimSegmentForTarget(ch, model, nodeId);

    // 当前选中目标优先用 live 表单，避免草稿滞后导致开关无效。
    const isLiveSelection =
      !viewOnly.value &&
      !isPreviewMode.value &&
      selectedChapterId.value === ch.id &&
      selModelId.value === model.id &&
      (selModelNodeId.value ?? null) === (nodeId ?? null);

    const liveForm = isLiveSelection ? getModelFormSnapshot() : null;

    const hasVisual = liveForm
      ? formSnapshotHasVisualEdits(liveForm)
      : draft
        ? formSnapshotHasVisualEdits(draft.form)
        : cfg.visible !== def.visible ||
          cfg.outline !== def.outline ||
          cfg.highlight !== def.highlight ||
          cfg.wireframe !== def.wireframe ||
          !!cfg.intro ||
          cfg.scale !== def.scale ||
          !!(cfg.posOffset && (cfg.posOffset[0] || cfg.posOffset[1] || cfg.posOffset[2]));

    if (!hasAnim && !hasVisual) {
      for (const obj of objs) {
        // 仅恢复可见性与描边默认，不重置位姿（避免显隐开关把动画起点打飞）
        rebuildOutlineForObject(model, obj, def, { touchVisibility: true });
      }
      return;
    }

    const visualCfg = liveForm
      ? ({
          ...def,
          visible: liveForm.visible,
          outline: liveForm.outline,
          wireframe: liveForm.wireframe,
          highlight: liveForm.highlight,
          outlineColor: liveForm.outlineColor,
          wireframeColor: liveForm.wireframeColor,
          modelHighlightColor: liveForm.modelHighlightColor,
          animation: liveForm.animation,
          intro: liveForm.intro,
          scale: liveForm.scale,
          posOffset: [liveForm.posOffsetX, liveForm.posOffsetY, liveForm.posOffsetZ] as [
            number,
            number,
            number
          ]
        } as ModelConfig)
      : draft
        ? ({
            ...def,
            visible: draft.form.visible,
            outline: draft.form.outline,
            wireframe: draft.form.wireframe,
            highlight: draft.form.highlight,
            outlineColor: draft.form.outlineColor,
            wireframeColor: draft.form.wireframeColor,
            modelHighlightColor: draft.form.modelHighlightColor,
            animation: draft.form.animation,
            intro: draft.form.intro,
            scale: draft.form.scale,
            posOffset: [draft.form.posOffsetX, draft.form.posOffsetY, draft.form.posOffsetZ] as [
              number,
              number,
              number
            ]
          } as ModelConfig)
        : cfg;

    for (const obj of objs) {
      applyModelVisualOnly(model, obj, visualCfg, false);
    }

    if (hasAnim) {
      // 与视频播放同一套 elapsed 插值，避免 applyAnimSegmentTransformToMesh 相对坐标偏差
      const displayMode = resolveMeshAnimDisplayMode(model, nodeId, seg, mode);
      const elapsed = displayMode === "end" ? Number.POSITIVE_INFINITY : 0;
      const fromLiveOrDraft = !!(liveForm || draft);
      if (fromLiveOrDraft) {
        const animCfg: ModelConfig = {
          ...visualCfg,
          animation: true,
          animConfig: {
            duration: seg.animTime || 3,
            easing: seg.easing || "easeInOut",
            segments: [seg]
          } as any
        };
        for (const obj of objs) {
          applyElapsedAnimToObject(obj, animCfg, elapsed, [seg]);
        }
      } else {
        const storedCfg: ModelConfig = { ...cfg, animation: true };
        for (const obj of objs) {
          applyElapsedAnimToObject(obj, storedCfg, elapsed);
        }
      }
    } else {
      for (const obj of objs) {
        applyStaticModelTransform(model, obj, visualCfg, isRoot);
      }
    }
  }

  /** 同模型内所有子节点按章节配置/草稿各自同步 mesh（已编辑→应用动画，未编辑→恢复默认） */
  function applyAllEditedTargetsForModel(ch: Chapter, model: Model) {
    if (!chapterModelHasEdits(ch, model.id)) {
      resetModelTreeToDefault(model);
      return;
    }

    // 只重置变换，保留当前可见性；随后由本章配置一次写到位，避免「先显示再隐藏」闪一下
    resetModelTreeTransformsOnly(model);

    const applied = new Set<string>();
    const tree = getModelHierarchy(model.id);

    const visitTarget = (nodeId: string | null) => {
      const key = nodeId ?? "__root__";
      if (applied.has(key)) return;
      applied.add(key);
      applyTargetAnimVisualState(ch, model, nodeId);
    };

    visitTarget(null);

    const walk = (nodes: ModelHierarchyNode[]) => {
      for (const node of nodes) {
        visitTarget(node.id);
        if (node.mergedNodeIds?.length) {
          for (const mergedId of node.mergedNodeIds) visitTarget(mergedId);
        }
        walk(node.children);
      }
    };
    walk(tree);

    const draftPrefix = `${ch.id}|${model.id}|`;
    for (const key of selectionEditDrafts.keys()) {
      if (!key.startsWith(draftPrefix)) continue;
      const parsed = parseSelectionDraftKey(key);
      if (!parsed || !hasSelectionEditDraft(parsed.chapterId, parsed.modelId, parsed.nodeId)) continue;
      visitTarget(parsed.nodeId);
    }
  }

  /** @deprecated 使用 applyAllEditedTargetsForModel + applyTargetAnimVisualState */
  function applySelectedTargetPreview(ch: Chapter, model: Model) {
    if (!chapterModelHasEdits(ch, model.id)) {
      resetModelTreeToDefault(model);
      return;
    }
    applyAllEditedTargetsForModel(ch, model);
  }

  /** 仅应用单个模型在当前节点下的状态（同节点内切换模型时使用，不影响其他模型） */
  function applySingleModelChapterState(
    ch: Chapter,
    m: Model,
    elapsedSec = 0,
    options?: ApplyChapterModelStateOptions
  ) {
    const skipOutline = options?.skipOutlineRebuild ?? false;
    const effectiveElapsed = resolveChapterModelElapsed(ch, elapsedSec, options);
    const def = defaultModelCfg();
    const root = meshes.get(m.id);
    if (!root) return;

    const raw = ch.modelConfigs?.[m.id];
    const hasRootEdits = chapterRootModelHasEdits(ch, m.id);
    const hasNodeEdits = chapterNodeConfigsHaveEdits(ch, m.id);

    if (!hasRootEdits && !hasNodeEdits) {
      resetModelTreeToDefault(m);
      return;
    }

    // 只重置位姿，不改 visible/描边；可见性由下方本章 cfg 一次写入，避免切章闪一下
    resetModelTreeTransformsOnly(m);

    if (hasRootEdits && raw) {
      const cfg = getModelConfig(raw);
      applyModelVisualOnly(m, root, cfg, skipOutline);
      if (cfg.animation && cfg.animConfig?.segments?.length) {
        const liveSegs =
          !(_chAnimLock && !chAnimWallclock) && shouldUseLiveAnimSegments(m.id, null)
            ? animSegments
            : undefined;
        applyElapsedAnimToObject(root, cfg, effectiveElapsed, liveSegs);
      } else {
        applyStaticModelTransform(m, root, cfg, true);
      }
    } else {
      applyModelVisualOnly(m, root, def, skipOutline);
      applyStaticModelTransform(m, root, def, true);
    }

    traverseObject3DSafely(root, child => {
      if (child === root) return;
      if (
        child.userData?.isEdgeLine ||
        child.userData?.isSelectionHelper ||
        child.userData?.isOutlineShell ||
        child.userData?.isBodyHighlightOverlay
      ) {
        return;
      }
      const nodeId = child.userData?.nodeId as string | undefined;
      if (!nodeId) return;
      const displayId = resolveDisplayNodeId(getModelHierarchy(m.id), nodeId);
      const nodeCfg = raw?.nodeConfigs?.[displayId] ?? raw?.nodeConfigs?.[nodeId];
      const nodeEdited =
        nodeCfg &&
        modelHasEditsForConfig(getModelConfig(nodeCfg as ModelConfig), def, m, displayId);
      if (!nodeEdited) {
        // 未编辑子节点：只回默认变换。可见性已由 applyChapterVisibilityOnly 写好，
        // 切勿在此强制 visible=true（skipOutline 路径曾因此把「本章隐藏」冲掉一帧）。
        resetObject3DTransformToDefault(m, child, false);
        if (!skipOutline) {
          rebuildOutlineForObject(m, child, def, { touchVisibility: false });
        }
      }
    });

    if (raw?.nodeConfigs) {
      const seenDisplayIds = new Set<string>();
      const tree = getModelHierarchy(m.id);
      for (const [nodeId, nodeCfg] of Object.entries(raw.nodeConfigs)) {
        const displayId = resolveDisplayNodeId(tree, nodeId);
        if (seenDisplayIds.has(displayId)) continue;
        seenDisplayIds.add(displayId);
        const merged = { ...def, ...nodeCfg } as ModelConfig;
        if (!modelHasEditsForConfig(merged, def, m, displayId)) continue;
        const liveSegs =
          !(_chAnimLock && !chAnimWallclock) && shouldUseLiveAnimSegments(m.id, displayId)
            ? animSegments
            : undefined;
        for (const obj of collectObjectsForNodeId(root, displayId)) {
          applyModelVisualOnly(m, obj, merged, skipOutline);
          if (merged.animation && merged.animConfig?.segments?.length) {
            applyElapsedAnimToObject(obj, merged, effectiveElapsed, liveSegs);
          } else {
            applyStaticModelTransform(m, obj, merged, false);
          }
        }
      }
    }
  }

  /** 先统一写入本章可见性（不碰位姿），再算变换/描边，避免切章时「先显示再隐藏」闪一下 */
  function applyChapterVisibilityOnly(ch: Chapter) {
    const def = createDefaultModelConfig();
    let anyHidden = false;
    for (const m of models.value) {
      const root = meshes.get(m.id);
      if (!root) continue;
      const raw = ch.modelConfigs?.[m.id] as ModelConfig | undefined;
      const hasRootEdits = chapterRootModelHasEdits(ch, m.id);
      const hasNodeEdits = chapterNodeConfigsHaveEdits(ch, m.id);

      if (!hasRootEdits && !hasNodeEdits) {
        root.visible = true;
        traverseObject3DSafely(root, child => {
          if (child === root || !child.userData?.nodeId) return;
          if (
            child.userData?.isEdgeLine ||
            child.userData?.isSelectionHelper ||
            child.userData?.isOutlineShell ||
            child.userData?.isBodyHighlightOverlay
          ) {
            return;
          }
          child.visible = true;
        });
        continue;
      }

      if (hasRootEdits && raw) {
        root.visible = getModelConfig(raw).visible !== false;
      } else {
        root.visible = true;
      }
      if (!root.visible) {
        anyHidden = true;
        removeVisualOverlaysForOwner(root, `root:${m.id}`);
      }

      const tree = getModelHierarchy(m.id);
      traverseObject3DSafely(root, child => {
        if (child === root || !child.userData?.nodeId) return;
        if (
          child.userData?.isEdgeLine ||
          child.userData?.isSelectionHelper ||
          child.userData?.isOutlineShell ||
          child.userData?.isBodyHighlightOverlay
        ) {
          return;
        }
        const nodeId = child.userData.nodeId as string;
        const displayId = resolveDisplayNodeId(tree, nodeId);
        const nodeCfg = raw?.nodeConfigs?.[displayId] ?? raw?.nodeConfigs?.[nodeId];
        if (
          nodeCfg &&
          modelHasEditsForConfig(getModelConfig(nodeCfg as ModelConfig), def, m, displayId)
        ) {
          child.visible = getModelConfig(nodeCfg as ModelConfig).visible !== false;
        } else {
          child.visible = true;
        }
        if (!child.visible) {
          anyHidden = true;
          removeVisualOverlaysForOwner(root, (child.userData?.nodeId as string) || displayId);
        }
      });
    }
    if (anyHidden) {
      syncModelConfigOutlinePass();
      invalidatePickMeshCache();
    }
  }

  /** 统一应用节点下的模型可见性、材质效果与变换（含动画进度）；仅在切换节点/播放时调用 */
  function applyChapterModelState(ch: Chapter, elapsedSec = 0, options?: ApplyChapterModelStateOptions) {
    // 可见性必须先于位姿/描边写完，保证同一帧内不会出现错误的显示态
    applyChapterVisibilityOnly(ch);
    models.value.forEach(m => applySingleModelChapterState(ch, m, elapsedSec, options));
    // 位姿/描边回默认时会短暂把 visible 写回 true，收尾再盖一次本章可见性
    applyChapterVisibilityOnly(ch);
    if (!options?.skipOverlaySync) {
      invalidatePickMeshCache();
      syncTransformVisualOverlays();
    }
    invalidateSceneModelCenterCache();
    if (options?.immediatePresent) {
      renderViewportFrame();
    }
  }

  function applyChapterModelVisibility(ch: Chapter) {
    applyChapterVisibilityOnly(ch);
  }

  function getChapterCameraTransitionSec(ch: Chapter) {
    const sec = ch.camera.transitionSec;
    return typeof sec === "number" && sec > 0 ? sec : CHAPTER_CAMERA_TRANSITION_SEC;
  }

  type ChapterCameraSwitchMode = "edit" | "playback" | "auto";

  function getChapterCameraSwitchDuration(ch: Chapter, _mode?: ChapterCameraSwitchMode) {
    if (_mode === "playback" && (viewOnly.value || isPreviewMode.value)) {
      // 展示页播放中切章：几乎瞬切运镜，避免「停约 1 秒」体感。
      if (presentationPlaybackSession.intent === "play" && !presentationUserWantsPaused) {
        return Math.min(0.08, CHAPTER_CAMERA_SWITCH_MIN_SEC);
      }
    }
    if (_mode === "playback" && !viewOnly.value && !isPreviewMode.value) {
      return 0.5;
    }
    return Math.max(CHAPTER_CAMERA_SWITCH_MIN_SEC, getChapterCameraTransitionSec(ch));
  }

  function getPresentationNavChapters(): Chapter[] {
    const result: Chapter[] = [];
    for (const root of timelineChapters.value) {
      const children = getSortedChapterChildren(root.id);
      if (children.length > 0) {
        result.push(...children);
      } else {
        result.push(root);
      }
    }
    return result;
  }

  /** 将任意节点映射到展示导航列表中的可导航项（父节点有子节点时落到对应子节点） */
  function resolvePresentationNavChapter(chapter: Chapter): Chapter {
    const nav = getPresentationNavChapters();
    const direct = nav.find(item => item.id === chapter.id);
    if (direct) return direct;

    const children = getSortedChapterChildren(chapter.id);
    if (children.length > 0) {
      const video = videoEl.value;
      if (video) {
        const atTime = children.find(child =>
          isChapterInPlaybackRange(child, resolvePresentationPlaybackTime(video))
        );
        if (atTime) return atTime;
      }
      return children[0];
    }

    if (chapter.parentId) {
      const siblings = getSortedChapterChildren(chapter.parentId);
      const self = siblings.find(child => child.id === chapter.id);
      if (self) return self;
    }

    return chapter;
  }

  function isPresentationNavChapterAtTime(ch: Chapter, t: number): boolean {
    return t >= ch.startTime - CHAPTER_TIME_EPS && t <= ch.endTime + CHAPTER_END_EPS;
  }

  function findPresentationNavIndexByTime(t: number): number {
    const nav = getPresentationNavChapters();
    if (nav.length === 0) return -1;
    const matched = nav.filter(ch => isPresentationNavChapterAtTime(ch, t));
    if (matched.length > 0) {
      return nav.findIndex(ch => ch.id === matched[matched.length - 1].id);
    }
    for (let i = nav.length - 1; i >= 0; i--) {
      if (nav[i].startTime <= t + CHAPTER_TIME_EPS) return i;
    }
    return 0;
  }

  function isPresentationSeekLocked(): boolean {
    return presentationChapterTransition || videoChapterSyncPaused || chapterNavLock.value;
  }

  function shouldSyncProgressFromVideo(v: HTMLVideoElement, seekLocked: boolean): boolean {
    if (v.seeking) return false;
    if (viewOnly.value || isPreviewMode.value) {
      if (
        presentationPlaybackSession.phase === "seeking" ||
        presentationSeekTargetTime != null
      ) {
        const target = presentationSeekTargetTime ?? presentationPlaybackSession.targetTime;
        if (!canAdoptPresentationVideoTime(v, target)) return false;
        presentationSeekTargetTime = null;
      }
      // Pause intent must never follow a free-running media clock (stale play race).
      if (presentationPlaybackSession.intent === "pause" && !v.paused) return false;
      // 无锚点时也拒绝「突然掉回片头」覆盖当前进度
      if (isPresentationSeekRollback(v.currentTime, currentTime.value)) return false;
      // 已在播：不要被 transition 锁挡住进度条（await seek 常卡 2~5 秒）
      if (seekLocked && v.paused) return false;
      return true;
    }
    if (seekLocked) return false;
    return true;
  }

  function commitPresentationSeekTarget(
    target: number,
    video?: HTMLVideoElement | null
  ): number {
    const v = video ?? videoEl.value;
    presentationSeekTargetTime = target;
    currentTime.value = target;
    if (v && isSeekNearTarget(v, target)) {
      presentationSeekTargetTime = null;
      currentTime.value = v.currentTime;
      return v.currentTime;
    }
    return target;
  }

  function getPresentationChapterAtVideoTime(t: number): Chapter | null {
    // 编辑/预览/展示统一：按导航时间轴取章节，再 resolvePlayable，避免两边套不同 modelConfigs
    const nav = getPresentationNavChapters();
    const idx = findPresentationNavIndexByTime(t);
    return idx >= 0 ? nav[idx] : null;
  }

  function getActivePresentationNavIndex(): number {
    const nav = getPresentationNavChapters();
    if (nav.length === 0) return -1;

    // Session is the sole source of truth for L/R stepping. Chapter changes while playing
    // come from commandPresentationPlayback / maybeAutoAdvance — never from lagged media.
    if (presentationPlaybackSession.navChapterId) {
      let sessionIdx = nav.findIndex(
        ch => ch.id === presentationPlaybackSession.navChapterId
      );
      // Session may hold a playable child id; map back to its nav parent.
      if (sessionIdx < 0) {
        const raw = chapters.value.find(
          ch => ch.id === presentationPlaybackSession.navChapterId
        );
        if (raw) {
          const navChapter = resolvePresentationNavChapter(raw);
          sessionIdx = nav.findIndex(ch => ch.id === navChapter.id);
        }
      }
      if (sessionIdx >= 0) return sessionIdx;
    }

    if (presentationNavIndex.value >= 0 && presentationNavIndex.value < nav.length) {
      return presentationNavIndex.value;
    }
    if (presentationUiChapterId.value) {
      const idx = nav.findIndex(ch => ch.id === presentationUiChapterId.value);
      if (idx >= 0) return idx;
    }
    const timelineT = resolvePresentationPlaybackTime();
    const timeIdx = findPresentationNavIndexByTime(timelineT);
    if (timeIdx >= 0) return timeIdx;
    return 0;
  }

  function getPresentationNavIndex(ch: Chapter): number {
    const navChapter = resolvePresentationNavChapter(ch);
    return getPresentationNavChapters().findIndex(item => item.id === navChapter.id);
  }

  /** 展示/预览/编辑播放：统一解析「此刻该套哪一章」（可播放节点） */
  function resolveVideoPlaybackChapter(video?: HTMLVideoElement | null): Chapter | null {
    const v = video ?? videoEl.value;
    if (!v) {
      return chapterBelongsToActiveVideo(chapterPlayTarget.value) ? chapterPlayTarget.value : null;
    }
    const timelineT = resolvePresentationPlaybackTime(v);

    // 切章/seek 锁定期：编辑态也必须钉住 playTarget（且必须属于当前视频）。
    if (isPresentationSeekLocked()) {
      if (chapterBelongsToActiveVideo(chapterPlayTarget.value)) {
        return chapterPlayTarget.value;
      }
      const nav = getPresentationChapterAtVideoTime(timelineT);
      return nav ? resolvePlayableChapterForPresentation(nav) : null;
    }

    const pinned = chapterBelongsToActiveVideo(chapterPlayTarget.value)
      ? chapterPlayTarget.value
      : null;
    // 仅当时间仍早于目标章（seek 未到位）时钉住；已落入或已越过则跟视频走
    if (
      pinned &&
      !isChapterInPlaybackRange(pinned, timelineT) &&
      timelineT < pinned.startTime - CHAPTER_TIME_EPS
    ) {
      return pinned;
    }

    const navChapter =
      getPresentationChapterAtVideoTime(timelineT) ??
      ((viewOnly.value || isPreviewMode.value) && presentationUiChapterId.value
        ? (() => {
            const uiChapter = chapters.value.find(ch => ch.id === presentationUiChapterId.value);
            return uiChapter ? resolvePresentationNavChapter(uiChapter) : null;
          })()
        : null);

    if (navChapter) {
      const playable = resolvePlayableChapterForPresentation(navChapter);
      if (chapterBelongsToActiveVideo(playable)) return playable;
    }

    if (pinned && isChapterInPlaybackRange(pinned, timelineT)) {
      return pinned;
    }
    // 编辑态超出区间不残留 playTarget（避免间隙套结束位移）
    if (!viewOnly.value && !isPreviewMode.value) return null;
    return pinned;
  }

  function chapterBelongsToActiveVideo(ch: Chapter | null | undefined): ch is Chapter {
    if (!ch) return false;
    const activeVid = activeVideoId.value;
    if (!activeVid) return true;
    return !ch.parentId || ch.parentId === activeVid;
  }

  function resolvePresentationPlaybackChapter(video?: HTMLVideoElement | null): Chapter | null {
    return resolveVideoPlaybackChapter(video);
  }

  function getPresentationAnimElapsed(video: HTMLVideoElement, ch?: Chapter | null): number {
    const chapter = ch ?? resolvePresentationPlaybackChapter(video);
    if (!chapter) return 0;
    return getChapterAnimElapsed(chapter, resolvePresentationPlaybackTime(video));
  }

  function canAutoAdvancePresentationChapter(navChapter: Chapter, v: HTMLVideoElement): boolean {
    if (presentationChapterTransition || videoChapterSyncPaused || v.seeking) return false;
    if (performance.now() < presentationChapterCooldownUntil) return false;
    const t = resolvePresentationPlaybackTime(v);
    if (t > navChapter.endTime + CHAPTER_END_EPS) return false;
    if (!isPresentationNavChapterAtTime(navChapter, t) && t < navChapter.endTime - CHAPTER_END_EPS) {
      return false;
    }
    const span = navChapter.endTime - navChapter.startTime;
    if (span < MIN_CHAPTER_DURATION - CHAPTER_TIME_EPS) return false;
    const minPlayed = Math.min(0.8, span * 0.3);
    if (t < navChapter.startTime + minPlayed) return false;
    return t >= navChapter.endTime - CHAPTER_END_EPS;
  }

  /**
   * 播放意图未手动暂停时：片尾/末章结束后回到第一导航章继续播（展示页循环）。
   */
  function loopPresentationPlaybackFromStart(): boolean {
    if (!viewOnly.value && !isPreviewMode.value) return false;
    if (presentationPlaybackSession.intent !== "play" || presentationUserWantsPaused) {
      return false;
    }
    // 切章 seek 尚未落地时禁止片尾循环，否则会从旧时钟误跳回第一章。
    if (presentationSeekTargetTime != null) {
      const dur =
        (videoEl.value && Number.isFinite(videoEl.value.duration) && videoEl.value.duration > 0
          ? videoEl.value.duration
          : duration.value) || 0;
      if (dur > 0 && presentationSeekTargetTime < dur - Math.max(0.5, CHAPTER_END_EPS * 4)) {
        return true;
      }
    }
    const nav = getPresentationNavChapters();
    const first = nav[0] ?? getPresentationStartChapter();
    if (!first) return false;
    const navChapter = resolvePresentationNavChapter(first);
    const start = navChapter.startTime;
    const now = performance.now();
    // 已有指向片头的 seek：短时间内不重复发；超时则重发，防止 seeking 永久卡住。
    if (
      presentationPlaybackSession.phase === "seeking" &&
      Math.abs(presentationPlaybackSession.targetTime - start) < 0.55 &&
      now - presentationLoopCommandAt < 2200
    ) {
      return true;
    }
    presentationLoopCommandAt = now;
    commandPresentationPlayback({
      targetTime: start,
      intent: "play",
      navChapter,
      autoAdvance: true
    });
    return true;
  }

  /** 播放意图仍在，但媒体意外 pause/blocked：节流后续播，避免多轮循环后卡死。 */
  async function recoverPresentationPlaybackAfterUnexpectedPause() {
    if (!viewOnly.value && !isPreviewMode.value) return;
    if (presentationPlaybackSession.intent !== "play" || presentationUserWantsPaused) return;
    const video = videoEl.value;
    if (!video) return;
    const now = performance.now();
    if (now - presentationBlockedResumeAt < 450) return;
    presentationBlockedResumeAt = now;

    if (video.ended || isPresentationAtMediaEnd(video)) {
      if (!isStalePresentationMediaEnd(video)) {
        loopPresentationPlaybackFromStart();
      }
      return;
    }
    if (!video.paused) {
      presentationPlaybackSession.phase = "playing";
      return;
    }

    const target = presentationPlaybackSession.targetTime;
    // 先确保离开 ended / 落到目标点，再 play（移动端片尾后最稳）。
    if (!isSeekNearTarget(video, target)) {
      try {
        video.currentTime = target;
      } catch {
        /* ignore */
      }
    }

    try {
      video.muted = true;
      await video.play();
    } catch {
      /* fall through */
    }
    if (!isCurrentPresentationPlayIntent()) return;
    if (!video.paused && !video.ended) {
      presentationPlaybackSession.phase = "playing";
      presentationExpectPlaying = true;
      isPlaying.value = true;
      if (canAdoptPresentationVideoTime(video, target)) {
        presentationSeekTargetTime = null;
        presentationPlaybackSession.committedTime = video.currentTime;
      }
      return;
    }
    // play() 仍失败：用当前目标重发命令（含 seek），比永久 blocked 更可恢复。
    const navChapter = presentationPlaybackSession.navChapterId
      ? getPresentationNavChapters().find(ch => ch.id === presentationPlaybackSession.navChapterId) ??
        null
      : getPresentationChapterAtVideoTime(presentationPlaybackSession.targetTime);
    commandPresentationPlayback({
      targetTime: presentationPlaybackSession.targetTime,
      intent: "play",
      navChapter,
      autoAdvance: true
    });
  }

  function isCurrentPresentationPlayIntent() {
    return (
      presentationPlaybackSession.intent === "play" &&
      !presentationUserWantsPaused
    );
  }

  function maybeAutoAdvancePresentation(v: HTMLVideoElement): boolean {
    if (!viewOnly.value && !isPreviewMode.value) return false;
    if (
      presentationPlaybackSession.intent !== "play" ||
      !presentationPlaybackSession.autoAdvance ||
      presentationPlaybackSession.phase === "seeking" ||
      presentationSeekTargetTime != null ||
      v.paused ||
      v.ended
    ) {
      return false;
    }
    const nav = getPresentationNavChapters();
    if (nav.length === 0) return false;
    const currentIdx = presentationPlaybackSession.navChapterId
      ? nav.findIndex(ch => ch.id === presentationPlaybackSession.navChapterId)
      : findPresentationNavIndexByTime(presentationPlaybackSession.committedTime);
    if (currentIdx < 0) return false;
    const current = nav[currentIdx];
    // 末章结束 → 回到第一章，保持循环直到用户手动暂停。
    const next = nav[currentIdx + 1] ?? nav[0];
    if (!next) return false;
    const t = Math.max(presentationPlaybackSession.committedTime, v.currentTime);
    // Require a real end-of-chapter window. A stale committedTime from before the latest
    // seek (e.g. still at 12s after jumping to chapter start) must not skip ahead.
    if (t < current.endTime - CHAPTER_END_EPS) return false;
    if (t > current.endTime + Math.max(CHAPTER_END_EPS, 0.35)) return false;
    if (t < current.startTime - CHAPTER_TIME_EPS) return false;
    // 单章场景：末尾窗口内回到起点，避免与紧接着的 seek 目标相同而空转。
    if (next.id === current.id && Math.abs(t - next.startTime) < CHAPTER_TIME_EPS) {
      return false;
    }
    commandPresentationPlayback({
      targetTime: next.startTime,
      intent: "play",
      navChapter: next,
      autoAdvance: true
    });
    return true;
  }

  function canPresentationPrevChapter(): boolean {
    if (!viewOnly.value && !isPreviewMode.value) return false;
    const nav = getPresentationNavChapters();
    if (nav.length <= 1) return false;
    return getActivePresentationNavIndex() > 0;
  }

  function canPresentationNextChapter(): boolean {
    if (!viewOnly.value && !isPreviewMode.value) return false;
    const nav = getPresentationNavChapters();
    if (nav.length <= 1) return false;
    const idx = getActivePresentationNavIndex();
    return idx >= 0 && idx < nav.length - 1;
  }

  function resolvePresentationPlaybackTime(v?: HTMLVideoElement | null): number {
    if (viewOnly.value || isPreviewMode.value) {
      return presentationDisplayTime.value;
    }
    const video = v ?? videoEl.value;
    if (isPresentationSeekLocked()) {
      return presentationSeekTargetTime ?? currentTime.value;
    }
    if (presentationSeekTargetTime != null) {
      if (
        video &&
        isSeekNearTarget(video, presentationSeekTargetTime) &&
        !isPresentationSeekRollback(video.currentTime, presentationSeekTargetTime)
      ) {
        presentationSeekTargetTime = null;
        return video.currentTime;
      }
      return presentationSeekTargetTime;
    }
    if (video && Number.isFinite(video.currentTime)) {
      // 与底部进度条同源：优先 currentTime（seek 锁/续播时可能比 video.currentTime 更准）
      if (viewOnly.value || isPreviewMode.value) {
        if (isPresentationSeekRollback(video.currentTime, currentTime.value)) {
          return currentTime.value;
        }
        return currentTime.value;
      }
      return video.currentTime;
    }
    return currentTime.value;
  }

  function getActiveChapterIdForUi(): string | null {
    if (viewOnly.value || isPreviewMode.value) {
      if (presentationCurrentNavChapterId.value) {
        return presentationCurrentNavChapterId.value;
      }
      const nav = getPresentationNavChapters();
      const video = videoEl.value;
      const paused = !video || video.paused || video.ended;
      // 暂停或 seek 锁 / 手动导航：导航索引优先，避免 video 落点滞后把列表拉回旧章
      if (
        (paused ||
          isPresentationSeekLocked() ||
          performance.now() < presentationManualNavUntil) &&
        presentationNavIndex.value >= 0 &&
        presentationNavIndex.value < nav.length
      ) {
        return nav[presentationNavIndex.value].id;
      }
      if (presentationUiChapterId.value) return presentationUiChapterId.value;

      const timelineT = resolvePresentationPlaybackTime();
      const playback = getPresentationChapterAtVideoTime(timelineT);
      if (playback) return playback.id;
      if (selectedNodeId.value) {
        const node = getNodeById(nodes.value, selectedNodeId.value);
        if (node && isAnimationNode(node)) return node.id;
      }
      if (selectedChapterId.value) return selectedChapterId.value;
      if (chapterPlayTarget.value) {
        return resolvePresentationNavChapter(chapterPlayTarget.value).id;
      }
    } else {
      // 编辑态：树高亮只跟用户选中，不因 currentTime=0 默认点亮第一章
      if (selectedNodeId.value) {
        const node = getNodeById(nodes.value, selectedNodeId.value);
        if (node && isAnimationNode(node)) return node.id;
      }
      if (selectedChapterId.value) return selectedChapterId.value;
      return null;
    }
    if (selectedChapterId.value) return selectedChapterId.value;
    const ci = currentChapterIdx.value;
    if (ci >= 0) return timelineChapters.value[ci]?.id ?? null;
    return null;
  }

  /** 展示/预览：按统一时间轴同步列表/进度条/左右按钮高亮 */
  function syncPresentationUiFromTimeline(atTime?: number) {
    if (!viewOnly.value && !isPreviewMode.value) return;
    const nav = getPresentationNavChapters();
    const timelineT = atTime ?? resolvePresentationPlaybackTime();

    // Session is the source of truth while seeking / after manual nav.
    if (presentationPlaybackSession.navChapterId) {
      const sessionChapter = nav.find(ch => ch.id === presentationPlaybackSession.navChapterId);
      if (sessionChapter) {
        if (
          presentationPlaybackSession.phase === "seeking" ||
          presentationPlaybackSession.intent === "pause" ||
          performance.now() < presentationManualNavUntil ||
          isPresentationSeekLocked()
        ) {
          syncPresentationUiFromChapter(sessionChapter, timelineT);
          return;
        }
      }
    }

    const navChapter = getPresentationChapterAtVideoTime(timelineT);
    if (!navChapter) return;
    syncPresentationUiFromChapter(navChapter, timelineT);
  }

  /** 展示/预览：同步应用目标章（不等待视频 seek），保证左右键/进度条点击立即有反馈 */
  function applyPresentationChapterAtTime(target: number, navChapter?: Chapter | null) {
    if (!viewOnly.value && !isPreviewMode.value) return;
    const navForTarget = navChapter ?? getPresentationChapterAtVideoTime(target);
    if (!navForTarget) return;

    commitPresentationSeekTarget(target);
    const playableForTarget = resolvePlayableChapterForPresentationAtTime(navForTarget, target);
    chapterPlayTarget.value = playableForTarget;
    lastPresentationAutoSwitchChapterId = playableForTarget.id;
    syncPresentationUiFromChapter(navForTarget, target);
    applyChapterCameraForNav(navForTarget, "playback");
    const keepPlaying =
      presentationPlaybackSession.intent === "play" && !presentationUserWantsPaused;
    // 播放中切章：跳过昂贵描边重建，优先立刻出画面与续播。
    syncChapterVisualState(playableForTarget, Math.max(0, target - playableForTarget.startTime), {
      skipOutlineRebuild: keepPlaying,
      skipOverlaySync: false,
      immediatePresent: true
    });
    if (!keepPlaying && chapterNeedsOutlineRebuild(playableForTarget)) {
      refreshChapterOutlines(playableForTarget);
    }
    renderViewportFrame();
  }

  type PresentationPlaybackCommand = {
    targetTime: number;
    intent: PresentationPlaybackIntent;
    navChapter?: Chapter | null;
    autoAdvance?: boolean;
  };

  function resetPresentationPlaybackSession(time = 0) {
    const requestId = presentationPlaybackSession.requestId + 1;
    Object.assign(presentationPlaybackSession, {
      phase: "paused" as PresentationPlaybackPhase,
      intent: "pause" as PresentationPlaybackIntent,
      committedTime: time,
      targetTime: time,
      navChapterId: null,
      playableChapterId: null,
      requestId,
      autoAdvance: false
    });
    presentationSeekTargetTime = null;
    presentationExpectPlaying = false;
    presentationUserWantsPaused = true;
    presentationChapterTransition = false;
    videoChapterSyncPaused = false;
    presentationEndedUiSynced = false;
    clearPresentationResumeTimer();
  }

  /**
   * 展示态唯一媒体副作用入口。命令先原子提交 target/intent，再执行 seek/play/pause；
   * requestId 令后发命令取消所有较早的异步收尾。
   */
  function commandPresentationPlayback(command: PresentationPlaybackCommand) {
    if (!viewOnly.value && !isPreviewMode.value) return;
    const video = videoEl.value;
    if (!video) return;

    const targetTime = clampVideoTime(command.targetTime, video);
    const navChapter =
      command.navChapter ??
      getPresentationChapterAtVideoTime(targetTime) ??
      (presentationPlaybackSession.navChapterId
        ? getPresentationNavChapters().find(
            ch => ch.id === presentationPlaybackSession.navChapterId
          ) ?? null
        : null);
    const playableChapter = navChapter
      ? resolvePlayableChapterForPresentationAtTime(navChapter, targetTime)
      : null;
    const requestId = presentationPlaybackSession.requestId + 1;

    Object.assign(presentationPlaybackSession, {
      phase: "seeking" as PresentationPlaybackPhase,
      intent: command.intent,
      targetTime,
      committedTime: targetTime,
      navChapterId: navChapter?.id ?? null,
      playableChapterId: playableChapter?.id ?? null,
      requestId,
      autoAdvance: command.autoAdvance ?? command.intent === "play"
    });

    presentationSeekTargetTime = targetTime;
    presentationExpectPlaying = command.intent === "play";
    presentationUserWantsPaused = command.intent === "pause";
    chapterAutoNext.value = presentationPlaybackSession.autoAdvance;
    clearPresentationResumeTimer();
    // 覆盖常见移动端 seek 耗时，防止切章过程中旧时钟触发片尾循环。
    presentationManualNavUntil = performance.now() + 900;
    presentationChapterCooldownUntil = performance.now() + 220;

    if (navChapter) applyPresentationChapterAtTime(targetTime, navChapter);
    void runPresentationPlaybackEffect(requestId, video, targetTime, command.intent);
  }

  async function runPresentationPlaybackEffect(
    requestId: number,
    video: HTMLVideoElement,
    targetTime: number,
    intent: PresentationPlaybackIntent
  ) {
    presentationChapterTransition = true;
    videoChapterSyncPaused = true;

    const isCurrentRequest = () => requestId === presentationPlaybackSession.requestId;
    const abandonIfStale = () => {
      if (isCurrentRequest()) return false;
      if (presentationPlaybackSession.intent === "pause" && !video.paused) {
        video.pause();
      }
      return true;
    };
    const releaseMediaLocks = () => {
      if (!isCurrentRequest()) return;
      presentationChapterTransition = false;
      videoChapterSyncPaused = false;
    };

    const finishPlayState = () => {
      if (!isCurrentRequest()) return;
      const mediaIsUsable =
        canAdoptPresentationVideoTime(video, targetTime) || isSeekNearTarget(video, targetTime);
      presentationPlaybackSession.committedTime = mediaIsUsable ? video.currentTime : targetTime;
      if (intent === "pause") {
        presentationPlaybackSession.phase = "paused";
        presentationSeekTargetTime = mediaIsUsable ? null : targetTime;
        syncPresentationUiFromTimeline(targetTime);
        return;
      }
      if (!video.paused && !video.ended) {
        presentationPlaybackSession.phase = "playing";
        if (mediaIsUsable) {
          presentationSeekTargetTime = null;
          presentationPlaybackSession.committedTime = video.currentTime;
        } else {
          presentationSeekTargetTime = targetTime;
        }
        stopChapterAnimation();
        ensureVideoSyncedChapterAnimation();
        syncCurrentChapterAnimationFromVideo();
        return;
      }
      presentationPlaybackSession.phase = "blocked";
      presentationSeekTargetTime = targetTime;
      void recoverPresentationPlaybackAfterUnexpectedPause();
    };

    try {
      const atEofForPlay =
        intent === "play" && (video.ended || isPresentationAtMediaEnd(video));
      const needsSeek = !isSeekNearTarget(video, targetTime);

      if (intent === "pause") {
        video.pause();
      } else if (viewOnly.value || isPreviewMode.value) {
        video.muted = true;
      }

      // 同源视频通常已有 metadata；不要为切章干等最多 800ms。
      if (video.readyState < HTMLMediaElement.HAVE_METADATA) {
        await waitForVideoReady(400);
        if (abandonIfStale()) return;
      }

      if (intent === "play") {
        // 关键点：手势栈内立刻 play + seek，不 await seeked（那会造出约 1 秒停顿）。
        let playPromise: Promise<void> | null = null;
        try {
          if (!atEofForPlay) {
            playPromise = video.play();
            void playPromise.catch(() => undefined);
          }
        } catch {
          playPromise = null;
        }
        if (needsSeek) {
          try {
            video.currentTime = targetTime;
          } catch {
            /* keep optimistic target */
          }
        }
        // 立刻放锁 + 乐观 playing，列表/左右键切换立即有反馈。
        presentationPlaybackSession.phase = "playing";
        presentationPlaybackSession.committedTime = targetTime;
        presentationExpectPlaying = true;
        isPlaying.value = true;
        releaseMediaLocks();

        // 后台补齐：seek 落点后再确认 play，绝不挡住交互。
        void (async () => {
          if (abandonIfStale()) return;
          if (needsSeek) {
            await waitForPresentationSeekSettle(video, targetTime, requestId, 280);
            if (abandonIfStale()) return;
          }
          try {
            if (playPromise) await playPromise.catch(() => undefined);
            if (abandonIfStale()) return;
            if (viewOnly.value || isPreviewMode.value) video.muted = true;
            if (video.paused || video.ended) await video.play();
          } catch {
            if (!isCurrentRequest()) return;
            presentationPlaybackSession.phase = "blocked";
            showPresentationPlaybackHint();
            void recoverPresentationPlaybackAfterUnexpectedPause();
            return;
          }
          finishPlayState();
        })();
        return;
      }

      if (needsSeek) {
        try {
          video.currentTime = targetTime;
        } catch {
          /* ignore */
        }
      }
      releaseMediaLocks();
      if (needsSeek) {
        await waitForPresentationSeekSettle(video, targetTime, requestId, 280);
        if (abandonIfStale()) return;
      }
      video.pause();
      finishPlayState();
    } finally {
      releaseMediaLocks();
    }
  }

  function waitForPresentationSeekSettle(
    video: HTMLVideoElement,
    targetTime: number,
    requestId: number,
    timeoutMs = 700
  ): Promise<void> {
    if (isSeekNearTarget(video, targetTime)) return Promise.resolve();
    return new Promise(resolve => {
      let settled = false;
      const finish = () => {
        if (settled) return;
        settled = true;
        video.removeEventListener("seeked", onSeeked);
        resolve();
      };
      const onSeeked = () => {
        if (requestId !== presentationPlaybackSession.requestId) {
          finish();
          return;
        }
        finish();
      };
      video.addEventListener("seeked", onSeeked);
      window.setTimeout(finish, timeoutMs);
    });
  }

  function isPresentationUserPaused(): boolean {
    // 用户点过暂停才算暂停；播放意图在时，seek 造成的短暂 paused 不得改成暂停导航
    if (presentationUserWantsPaused) return true;
    if (presentationExpectPlaying) return false;
    const video = videoEl.value;
    if (!video) return true;
    if (video.ended) return true;
    if (presentationChapterTransition || videoChapterSyncPaused || video.seeking) {
      return false;
    }
    return video.paused;
  }

  function navigatePresentationChapter(delta: -1 | 1) {
    const video = videoEl.value;
    if (!video || !hasChapters.value) return;
    if (!viewOnly.value && !isPreviewMode.value) return;

    const nav = getPresentationNavChapters();
    if (nav.length <= 1) return;

    // Strict session stepping: Next/Prev = sessionIndex ± 1. Never soft-sync from
    // lagged video.currentTime (that skipped chapters on mobile seek lag).
    const ci = getActivePresentationNavIndex();
    const targetIdx = ci + delta;
    if (targetIdx < 0 || targetIdx >= nav.length) return;

    const targetChapter = nav[targetIdx];
    const targetTime = targetChapter.startTime;
    commandPresentationPlayback({
      targetTime,
      intent: presentationPlaybackSession.intent,
      navChapter: targetChapter,
      autoAdvance: presentationPlaybackSession.autoAdvance
    });
  }

  function syncPresentationPlayStateFromVideo(v: HTMLVideoElement) {
    if (!viewOnly.value && !isPreviewMode.value) return;
    if (v.ended) {
      // 片尾循环由 loopPresentationPlaybackFromStart / onVideoEnd 处理，勿在此强制 pause。
      if (presentationPlaybackSession.intent === "play" && !presentationUserWantsPaused) {
        return;
      }
      presentationPlaybackSession.phase = "ended";
      presentationPlaybackSession.intent = "pause";
    } else if (!v.paused && presentationPlaybackSession.intent === "play") {
      if (
        presentationPlaybackSession.phase !== "seeking" ||
        canAdoptPresentationVideoTime(v, presentationPlaybackSession.targetTime)
      ) {
        presentationPlaybackSession.phase = "playing";
      }
    } else if (
      v.paused &&
      presentationPlaybackSession.intent === "play" &&
      presentationPlaybackSession.phase === "playing"
    ) {
      presentationPlaybackSession.phase = "blocked";
    }
  }

  function syncPresentationPlaybackFromVideo(v: HTMLVideoElement) {
    if (!viewOnly.value && !isPreviewMode.value && v.paused) return;
    if (isPresentationSeekLocked()) return;
    // Pause / seeking: never follow a free-running media clock for chapter visuals.
    if (
      (viewOnly.value || isPreviewMode.value) &&
      (presentationPlaybackSession.intent === "pause" ||
        presentationPlaybackSession.phase === "seeking")
    ) {
      return;
    }

    const playbackTime = resolvePresentationPlaybackTime(v);
    const navChapter = getPresentationChapterAtVideoTime(playbackTime);
    if (!navChapter) return;

    const playable = resolvePlayableChapterForPresentation(navChapter);
    const isPresentation = viewOnly.value || isPreviewMode.value;
    // Do not write session here — chapter identity changes only via commandPresentationPlayback.
    const elapsed = getChapterAnimElapsed(playable, playbackTime);

    if (isPresentation) {
      // 播放中只在切章时刷列表，避免每帧 resolvePlayable 刷屏/耗 CPU
      if (playable.id !== lastPresentationAutoSwitchChapterId) {
        syncPresentationUiFromTimeline(playbackTime);
      }
    }
    if (chapterPlayTarget.value?.id !== playable.id) {
      chapterPlayTarget.value = playable;
    }

    if (playable.id === lastPresentationAutoSwitchChapterId) {
      if (!v.paused) {
        if (chapterHasAnimation(playable)) {
          ensureVideoSyncedChapterAnimation();
        }
      }
      // 展示/预览：同章内也要跟视频时间刷 mesh（可见性/位姿/线框）
      if (isPresentation && chapterHasAnyModelEdits(playable)) {
        applyChapterAnimOnly(playable, elapsed);
      }
      return;
    }
    lastPresentationAutoSwitchChapterId = playable.id;

    const resolved = resolveChapter(playable);
    if (!resolved) return;
    playingIdx.value = resolved.idx;
    applyChapterCameraForNav(navChapter, "playback");
    if (!isPresentation) {
      editPlaybackCameraChapterId = playable.id;
      // 编辑态自动切章：只先写可见性，mesh 由 syncVideoDrivenChapterMesh 统一写入
      editPlaybackSyncChapterId = null;
      chAnimChapterId = null;
      applyChapterVisibilityOnly(playable);
      if (chapterNeedsOutlineRebuild(playable)) {
        refreshChapterOutlines(playable);
      }
      renderViewportFrame();
      return;
    }

    // 展示/预览切章：必须整章 visual + 描边，否则进度条播放不触发模型动画
    syncChapterVisualState(playable, elapsed, {
      skipOutlineRebuild: false,
      skipOverlaySync: false,
      immediatePresent: true
    });
    if (chapterNeedsOutlineRebuild(playable)) {
      refreshChapterOutlines(playable);
    }
    if (!v.paused && chapterHasAnimation(playable)) {
      ensureVideoSyncedChapterAnimation();
    }
  }

  function isPresentationTimelineSegmentCurrent(segmentIdx: number): boolean {
    if (!viewOnly.value && !isPreviewMode.value) {
      const segs = timelineChapters.value;
      if (segmentIdx < 0 || segmentIdx >= segs.length) return false;
      const activeId = getActiveChapterIdForUi();
      if (activeId) return segs[segmentIdx]?.id === activeId;
      return findChIdx(currentTime.value) === segmentIdx;
    }
    const nav = getPresentationNavChapters();
    const activeId = getActiveChapterIdForUi();
    if (!activeId || segmentIdx < 0 || segmentIdx >= nav.length) return false;
    return nav[segmentIdx].id === activeId;
  }

  /** UI-only: list / nav highlight. Must never write PlaybackSession (command owns that). */
  function syncPresentationUiFromChapter(chapter: Chapter, atTime?: number) {
    if (!viewOnly.value && !isPreviewMode.value) return;
    const navChapter = resolvePresentationNavChapter(chapter);
    const nav = getPresentationNavChapters();
    const idx = nav.findIndex(ch => ch.id === navChapter.id);

    // 先做轻量判断：无章切换时不要走 resolvePlayable（否则每帧刷 debug / 扫 chapters）
    if (
      presentationUiChapterId.value === navChapter.id &&
      selectedNodeId.value === navChapter.id &&
      (idx < 0 || presentationNavIndex.value === idx)
    ) {
      return;
    }

    // seek 锁定期视频尚未落到目标点：用显式时间 / 乐观 currentTime，避免仍按旧时间解析动画节点。
    const syncTime =
      atTime ??
      (isPresentationSeekLocked() ? currentTime.value : undefined) ??
      resolvePresentationPlaybackTime() ??
      chapter.startTime;
    const playableChapter = resolvePlayableChapterForPresentationAtTime(navChapter, syncTime);

    const chapterChanged = presentationUiChapterId.value !== navChapter.id;
    const indexChanged = idx >= 0 && presentationNavIndex.value !== idx;
    const selectedChanged = selectedNodeId.value !== navChapter.id;
    const playableChanged = selectedChapterId.value !== playableChapter.id;
    const videoChanged =
      !!playableChapter.parentId && activeVideoId.value !== playableChapter.parentId;

    if (!chapterChanged && !indexChanged && !selectedChanged && !playableChanged && !videoChanged) {
      return;
    }

    if (chapterChanged) {
      presentationUiChapterId.value = navChapter.id;
      presentationUiRevision.value += 1;
    }
    if (idx >= 0 && indexChanged) presentationNavIndex.value = idx;
    if (chapterChanged && (viewOnly.value || isPreviewMode.value)) {
      sceneNodeApi.revealSceneNodeInTree(navChapter.id, { accordion: true });
    }
    if (playableChanged) selectedChapterId.value = playableChapter.id;
    if (selectedChanged) selectedNodeId.value = navChapter.id;
    if (videoChanged && playableChapter.parentId) {
      activeVideoId.value = playableChapter.parentId;
      const parentVideo = getNodeById(nodes.value, playableChapter.parentId);
      // 同源只绑定一次：syncVideoElementSrc 内部对相同 url 直接跳过 load。
      if (parentVideo && isVideoNode(parentVideo) && parentVideo.videoSrc) {
        syncVideoElementSrc(parentVideo.videoSrc);
      }
    }
  }

  function isChapterListActive(ch: Chapter): boolean {
    const activeId = getActiveChapterIdForUi();
    return !!activeId && activeId === ch.id;
  }

  function isChapterBeforeSelected(ch: Chapter): boolean {
    const selectedId = selectedChapterId.value;
    if (!selectedId || ch.id === selectedId) return false;
    // 不同视频的时间轴相互独立，不能拿全局时间比较
    if (ch.parentId && activeVideoId.value && ch.parentId !== activeVideoId.value) return false;
    const selected = chapters.value.find(c => c.id === selectedId);
    if (!selected) return false;
    if (ch.parentId && selected.parentId && ch.parentId !== selected.parentId) return false;
    return ch.endTime <= selected.startTime + CHAPTER_TIME_EPS;
  }

  function chapterListFillPct(ch: Chapter) {
    // 只展示当前活动视频内动画的进度，避免多视频同时间轴重叠误亮
    if (ch.parentId && activeVideoId.value && ch.parentId !== activeVideoId.value) return 0;
    const t = currentTime.value;
    if (!Number.isFinite(t) || ch.endTime <= ch.startTime) return 0;
    if (t >= ch.endTime - CHAPTER_END_EPS) return 100;
    if (t <= ch.startTime + CHAPTER_TIME_EPS) return 0;
    return Math.max(0, Math.min(100, ((t - ch.startTime) / (ch.endTime - ch.startTime)) * 100));
  }

  function resolveNavChapterElapsed(chapter: Chapter, previewAnimation: boolean) {
    if (!isPreviewMode.value && !viewOnly.value && !previewAnimation && !chapterPlayTarget.value) {
      return 0;
    }
    const v = videoEl.value;
    if (!v || !isChapterInPlaybackRange(chapter, v.currentTime)) return 0;
    return resolveChapterAnimElapsed(chapter, v.currentTime);
  }

  function resolveChapterAnimElapsed(ch: Chapter, t?: number) {
    const time = t ?? videoEl.value?.currentTime ?? currentTime.value;
    if (!isChapterInPlaybackRange(ch, time)) return 0;
    return getChapterAnimElapsed(ch, time);
  }

  function resolveChapterForAnimSync(chapter: Chapter) {
    // 展示/预览：调用方已给出目标章；禁止用滞后的 video.currentTime 回退到旧章，
    // 否则暂停切章时模型仍套上一章配置。
    if (viewOnly.value || isPreviewMode.value) return chapter;
    const video = videoEl.value;
    if (prefersVideoSyncedChapterAnim() && video) {
      return getPlaybackChapterAtTime(video.currentTime) ?? chapter;
    }
    return chapter;
  }

  function chapterHasAnyModelEdits(ch: Chapter | null | undefined): boolean {
    if (!ch?.modelConfigs) return false;
    return Object.keys(ch.modelConfigs).some(id => chapterModelHasEdits(ch, id));
  }

  /** 编辑态：按与「节点播放按钮」相同的路径刷 mesh（elapsed=0 起始帧） */
  function applyChapterEditorVisualState(ch: Chapter) {
    if (!viewOnly.value && !isPreviewMode.value) {
      flushChapterSessionsToConfigs(ch);
    }
    sanitizeChapterModelConfigs(ch);
    // 关键：必须与 prepareChapterForPreviewPlayback / 进度条播放 同一套
    // applyChapterModelState(0)。applyAllEditedTargetsForModel → applyAnimSegmentTransformToMesh
    // 对子节点相对坐标/pivot 会与播放路径不一致，表现为停播切章后门板等停在错误起点。
    applyChapterModelState(ch, 0, {
      skipOutlineRebuild: false,
      skipOverlaySync: false,
      forceElapsed: 0,
      immediatePresent: true
    });
  }

  /** 切换节点时立即刷新 3D 场景（不等待 RAF，避免短暂显示上一节点状态） */
  function applyChapterVisualStateForNav(ch: Chapter, previewAnimation = false, visualElapsed?: number) {
    const videoPlaying = !!(videoEl.value && !videoEl.value.paused);
    // 编辑态暂停时一律走起始帧预览；勿因残留 chapterPlayTarget 误入播放路径（会 skip 线框且停在结束位移）
    const inEditMode =
      !previewAnimation && !viewOnly.value && !isPreviewMode.value && !videoPlaying;
    if (inEditMode) {
      applyChapterEditorVisualState(ch);
      return;
    }
    if (!viewOnly.value && !isPreviewMode.value) {
      sanitizeChapterModelConfigs(ch);
    }
    const hasEdits = chapterHasAnyModelEdits(ch);
    const video = videoEl.value;
    const playingVideo = !!(video && !video.paused);
    const elapsed =
      visualElapsed !== undefined
        ? visualElapsed
        : previewAnimation
          ? 0
          : playingVideo
            ? resolveChapterAnimElapsed(ch, video!.currentTime)
            : hasEdits
              ? 0
              : 0;
    if (!previewAnimation && !hasEdits) {
      for (const m of models.value) {
        resetModelTreeToDefault(m);
      }
    } else {
      const isPresentation = viewOnly.value || isPreviewMode.value;
      applyChapterModelState(ch, elapsed, {
        // 编辑播放路径也需在含线框章节重建，否则隐藏→线框切章只见实体
        skipOutlineRebuild: isPresentation ? false : !chapterNeedsOutlineRebuild(ch),
        skipOverlaySync: false,
        forceElapsed: previewAnimation ? 0 : playingVideo || visualElapsed !== undefined ? elapsed : hasEdits ? undefined : 0,
        immediatePresent: true
      });
      if (chapterNeedsOutlineRebuild(ch)) {
        refreshChapterOutlines(ch);
      }
    }
    invalidatePickMeshCache();
    syncTransformVisualOverlays();
  }

  function syncChapterVisualState(
    chapter: Chapter,
    elapsedSec?: number,
    options?: ApplyChapterModelStateOptions
  ) {
    const animChapter = resolveChapterForAnimSync(chapter);
    const elapsed =
      elapsedSec ??
      (prefersVideoSyncedChapterAnim() && videoEl.value
        ? resolveChapterAnimElapsed(animChapter, videoEl.value.currentTime)
        : 0);
    applyChapterModelState(animChapter, elapsed, options);
  }

  function resolveDefaultChapterCameraFrame(): {
    position: [number, number, number];
    target: [number, number, number];
  } | null {
    if (!controls || meshes.size === 0) return null;

    const box = new THREE.Box3();
    meshes.forEach(group => box.expandByObject(group));
    if (box.isEmpty()) return null;

    box.getCenter(_focusCenter);
    box.getSize(_focusSize);
    const maxDim = Math.max(_focusSize.x, _focusSize.y, _focusSize.z, 0.4);
    const distance = getPresentationCameraDistance(maxDim);
    _focusOffset.copy(_defaultCamViewDir).multiplyScalar(distance);

    return {
      position: [
        _focusCenter.x + _focusOffset.x,
        Math.max(_focusCenter.y + _focusOffset.y, _focusCenter.y + maxDim * 0.25),
        _focusCenter.z + _focusOffset.z
      ],
      target: [_focusCenter.x, _focusCenter.y, _focusCenter.z]
    };
  }

  function getStoredChapterCameraFrame(ch: Chapter) {
    return {
      position: [ch.camera.position[0], ch.camera.position[1], ch.camera.position[2]] as [number, number, number],
      target: [ch.camera.target[0], ch.camera.target[1], ch.camera.target[2]] as [number, number, number]
    };
  }

  function resolveChapterCameraFrame(ch: Chapter) {
    if (!isDefaultChapterCamera(ch)) {
      return getStoredChapterCameraFrame(ch);
    }
    const framed = resolveDefaultChapterCameraFrame();
    if (framed) return framed;
    return {
      position: [ch.camera.position[0], ch.camera.position[1], ch.camera.position[2]] as [number, number, number],
      target: [ch.camera.target[0], ch.camera.target[1], ch.camera.target[2]] as [number, number, number]
    };
  }

  function resetAllModelsToDefault() {
    for (const m of models.value) resetModelTreeToDefault(m);
    invalidatePickMeshCache();
    syncTransformVisualOverlays();
  }

  function isTreeNodeHighlighted(node: SceneNode): boolean {
    if (viewOnly.value || isPreviewMode.value) {
      if (isAnimationNode(node)) {
        const navNode = resolvePresentationNavChapter(node);
        const activeId = getActiveChapterIdForUi();
        if (activeId && (activeId === node.id || activeId === navNode.id)) return true;
        if (presentationUiChapterId.value === node.id || presentationUiChapterId.value === navNode.id) {
          return true;
        }
        return selectedNodeId.value === node.id || selectedNodeId.value === navNode.id;
      }
      return selectedNodeId.value === node.id;
    }
    if (videoOnlyMode.value) {
      return node.type === "video" && node.id === selectedNodeId.value;
    }
    if (isAnimationNode(node)) {
      const activeId = getActiveChapterIdForUi();
      if (!activeId || activeId !== node.id) return false;
      // 编辑态再保险：动画高亮不得跨出当前活动视频
      if (node.parentId && activeVideoId.value && node.parentId !== activeVideoId.value) {
        return false;
      }
      return true;
    }
    return selectedNodeId.value === node.id;
  }

  /** 编辑态：树 / 进度条 / 表单共用同一选中目标（不在此处换片源，避免播放中未上锁就 load） */
  function setEditModeActiveChapter(ch: Chapter) {
    selectedNodeId.value = ch.id;
    selectedChapterId.value = ch.id;
    videoOnlyMode.value = false;
    if (ch.parentId) {
      const switched = activeVideoId.value !== ch.parentId;
      activeVideoId.value = ch.parentId;
      const parentVideo = getNodeById(nodes.value, ch.parentId);
      if (parentVideo && isVideoNode(parentVideo)) {
        const storedDur = parentVideo.videoDuration;
        if (Number.isFinite(storedDur) && storedDur > 0) duration.value = storedDur;
        if (parentVideo.videoSrc) showVideoPip.value = true;
      }
      // 切到其它视频时立刻丢掉旧视频的 playTarget，避免 mesh 仍套用视频1 动画
      if (
        switched &&
        chapterPlayTarget.value &&
        chapterPlayTarget.value.parentId &&
        chapterPlayTarget.value.parentId !== ch.parentId
      ) {
        chapterPlayTarget.value = null;
        stopChapterAnimation();
        editPlaybackSyncChapterId = null;
        editPlaybackSyncElapsed = -1;
        chAnimChapterId = null;
      }
    }
  }

  /** 编辑态：timeupdate 同步 UI + 运镜；mesh 由 syncVideoDrivenChapterMesh 负责 */
  function syncEditModePlaybackFromVideo(v: HTMLVideoElement) {
    const t = currentTime.value;
    const ci = findChIdx(t);
    playingIdx.value = ci;

    // 仅在真正播放时跟时间轴切换高亮；暂停后固定在用户选中的动画
    const followTimeline = !v.paused && !v.ended && (isPlaying.value || !!chapterPlayTarget.value);
    if (ci >= 0 && followTimeline) {
      const ch = timelineChapters.value[ci];
      if (selectedNodeId.value !== ch.id || selectedChapterId.value !== ch.id) {
        selectedNodeId.value = ch.id;
        selectedChapterId.value = ch.id;
        videoOnlyMode.value = false;
        syncChapterMetaForm(ch);
      }
    }

    if (v.paused || ci < 0) return;

    const ch = timelineChapters.value[ci];
    if (editPlaybackCameraChapterId !== ch.id) {
      editPlaybackCameraChapterId = ch.id;
      applyChapterCameraForNav(ch, "playback");
    }
  }

  function applyChapterCameraForNav(chapter: Chapter, mode?: ChapterCameraSwitchMode) {
    const safeFrame = shouldUsePresentationSafeFitCamera()
      ? computePresentationSafeFitFrame(chapter)
      : null;
    const frame = safeFrame ?? getStoredChapterCameraFrame(chapter);
    const fov = safeFrame?.fov ?? chapter.camera.fov;
    const chapterId = chapter.id;

    if (mode === "edit") {
      snapCam(frame.position, frame.target, fov);
      syncCameraFormFromStored(chapter);
      chapterNavLock.value = false;
      return;
    }

    afterCameraChapterId = chapterId;
    afterCameraCallback = () => {
      syncCameraFormFromStored(chapter);
      chapterNavLock.value = false;
    };
    const dur = getChapterCameraSwitchDuration(chapter);
    animCam(frame.position, frame.target, fov, dur, true);
  }

  function transitionChapterCamera(ch: Chapter, after?: () => void, switchMode: ChapterCameraSwitchMode = "auto") {
    afterCameraChapterId = ch.id;
    afterCameraCallback = after ?? null;
    const frame = resolveChapterCameraFrame(ch);
    const dur = getChapterCameraSwitchDuration(ch, switchMode);
    animCam(frame.position, frame.target, ch.camera.fov, dur);
  }

  function refreshChapterOutlines(ch: Chapter) {
    models.value.forEach(m => {
      const root = meshes.get(m.id);
      const cfg = chapterModelCfg(ch, m.id);
      if (!root || !cfg) return;
      applyModelVisualOnly(m, root, cfg, false);
      if (cfg.nodeConfigs) {
        const seenDisplayIds = new Set<string>();
        const tree = getModelHierarchy(m.id);
        for (const [nodeId, nodeCfg] of Object.entries(cfg.nodeConfigs)) {
          const displayId = resolveDisplayNodeId(tree, nodeId);
          if (seenDisplayIds.has(displayId)) continue;
          seenDisplayIds.add(displayId);
          const merged = { ...defaultModelCfg(), ...nodeCfg } as ModelConfig;
          for (const obj of collectObjectsForNodeId(root, displayId)) {
            applyModelVisualOnly(m, obj, merged, false);
          }
        }
      }
    });
    invalidatePickMeshCache();
    syncTransformVisualOverlays();
  }

  function applyChapter(ch: Chapter) {
    videoOnlyMode.value = false;
    const resolved = resolveChapter(ch);
    if (!resolved) return;
    if (ch.parentId) {
      activeVideoId.value = ch.parentId;
      const parentVideo = getNodeById(nodes.value, ch.parentId);
      if (parentVideo && isVideoNode(parentVideo) && parentVideo.videoSrc) {
        showVideoPip.value = true;
        syncVideoElementSrc(parentVideo.videoSrc);
      }
    }

    const video = videoEl.value;
    // 仅在视频正在播时走播放管线；编辑态暂停切换只刷编辑预览，避免位移叠加上一动画残留
    const shouldKeepPlaying = !!(video && showVideoPip.value && (isPlaying.value || !video.paused));
    if (shouldKeepPlaying) {
      selectedNodeId.value = ch.id;
      void startChapterPlayback(ch, {
        syncVideo: true,
        autoplay: true,
        keepPlaying: true,
        userGesture: true,
        seekTime: ch.startTime
      });
      return;
    }

    chapterPlayTarget.value = null;
    stopChapterAnimation();
    // 不在此处提前改 selectedChapterId：交给 navigateToChapter，先落盘上一章再切 id
    selectedNodeId.value = ch.id;
    navigateToChapter(resolved.chapter, resolved.idx, {
      seek: false,
      cameraMode: "playback",
      visualElapsed: 0,
      holdCurrentTime: true
    });
    if (video && showVideoPip.value) {
      videoChapterSyncPaused = true;
      try {
        if (Math.abs(video.currentTime - ch.startTime) >= CHAPTER_TIME_EPS) {
          video.currentTime = ch.startTime;
        }
        currentTime.value = ch.startTime;
      } catch {
        /* ignore */
      } finally {
        videoChapterSyncPaused = false;
      }
    }
    // 暂停切章：与节点播放按钮同一套起始帧
    if (!viewOnly.value && !isPreviewMode.value) {
      applyChapterEditorVisualState(resolved.chapter);
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
    invalidateSceneModelCenterCache();
    return mesh;
  }

  function onGLTFLoaded(m: Model, gltf: { scene: THREE.Group; animations: THREE.AnimationClip[] }) {
    const isFirstModel = meshes.size === 0;
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
    prepareGltfMaterials(root, renderer);
    if (renderer) applyMeshTextureQuality(root, renderer);
    invalidateSceneModelCenterCache();
    applyModelEnvReflectionIntensity(root);
    registerModelHierarchy(m.id, root, m.name);
    if (gltf.animations.length > 0 && !importingModel.value) {
      attachModelMixer(m.id, root, gltf.animations);
    }
    if (selModel.value?.id === m.id) syncMaterialUiFromModel();
    if (selModelId.value === m.id) {
      updateSelectionHighlight();
      syncModelForm(getActiveChapter());
    }
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
    layoutEditorGizmosNearScene();
    if (isFirstModel) {
      snapSceneLightsToModelDefaults();
    }
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

  function ensureWritableActiveModelConfig(ch: Chapter): ModelConfig {
    const model = selModel.value;
    const defaultCfg = createDefaultModelConfig();
    if (!model) return defaultCfg;
    const rootCfg = ensureChapterModelConfig(ch, model.id);
    if (!selModelNodeId.value) return rootCfg;
    const displayNodeId = resolveDisplayNodeId(getModelHierarchy(model.id), selModelNodeId.value);
    if (!rootCfg.nodeConfigs) rootCfg.nodeConfigs = {};
    if (!rootCfg.nodeConfigs[displayNodeId]) {
      rootCfg.nodeConfigs[displayNodeId] = JSON.parse(JSON.stringify(createDefaultModelConfig()));
    }
    return rootCfg.nodeConfigs[displayNodeId];
  }

  /** @deprecated 写入请用 ensureWritableActiveModelConfig；读取请用 readActiveModelConfig */
  function getActiveModelConfig(ch?: Chapter | null): ModelConfig {
    const chapter = ch ?? getActiveChapter();
    if (!chapter) return createDefaultModelConfig();
    return ensureWritableActiveModelConfig(chapter);
  }

  function readModelConfigForTarget(
    ch: Chapter | null | undefined,
    modelId: string,
    nodeId: string | null
  ): ModelConfig {
    const defaultCfg = createDefaultModelConfig();
    if (!ch) return defaultCfg;
    const rootCfg = ch.modelConfigs?.[modelId] as ModelConfig | undefined;
    if (!nodeId) {
      if (!rootCfg) return defaultCfg;
      // deep clone animConfig，避免编辑器误改到其它章节的共享引用
      return {
        ...defaultCfg,
        ...rootCfg,
        animConfig: rootCfg.animConfig ? JSON.parse(JSON.stringify(rootCfg.animConfig)) : undefined,
        nodeConfigs: rootCfg.nodeConfigs
      };
    }
    const displayNodeId = resolveDisplayNodeId(getModelHierarchy(modelId), nodeId);
    const nodeCfg = rootCfg?.nodeConfigs?.[displayNodeId] ?? rootCfg?.nodeConfigs?.[nodeId];
    if (!nodeCfg) return defaultCfg;
    return {
      ...defaultCfg,
      ...nodeCfg,
      animConfig: nodeCfg.animConfig ? JSON.parse(JSON.stringify(nodeCfg.animConfig)) : undefined
    };
  }

  function getWritableModelConfigForTarget(ch: Chapter, modelId: string, nodeId: string | null): ModelConfig {
    const rootCfg = ensureChapterModelConfig(ch, modelId);
    if (!nodeId) return rootCfg;
    const displayNodeId = resolveDisplayNodeId(getModelHierarchy(modelId), nodeId);
    if (!rootCfg.nodeConfigs) rootCfg.nodeConfigs = {};
    if (!rootCfg.nodeConfigs[displayNodeId]) {
      rootCfg.nodeConfigs[displayNodeId] = JSON.parse(JSON.stringify(createDefaultModelConfig()));
    }
    return rootCfg.nodeConfigs[displayNodeId];
  }

  function hasModelConfigForTarget(ch: Chapter | null | undefined, modelId: string, nodeId: string | null): boolean {
    if (!ch) return false;
    const model = models.value.find(m => m.id === modelId);
    if (!nodeId) return chapterRootModelHasEdits(ch, modelId);
    const displayNodeId = resolveDisplayNodeId(getModelHierarchy(modelId), nodeId);
    const rootCfg = ch.modelConfigs?.[modelId] as ModelConfig | undefined;
    const nodeCfg = rootCfg?.nodeConfigs?.[displayNodeId] ?? rootCfg?.nodeConfigs?.[nodeId];
    if (!nodeCfg) return false;
    return modelHasEditsForConfig(
      getModelConfig(nodeCfg as ModelConfig),
      createDefaultModelConfig(),
      model ?? null,
      displayNodeId
    );
  }

  function pruneActiveTargetModelConfigIfUnedited(ch: Chapter, modelId: string, nodeId: string | null) {
    if (!ch.modelConfigs?.[modelId]) return;
    const raw = ch.modelConfigs[modelId] as ModelConfig;
    const model = models.value.find(m => m.id === modelId) ?? null;
    const def = createDefaultModelConfig();

    if (!nodeId) {
      if (!chapterRootModelHasEdits(ch, modelId) && !chapterNodeConfigsHaveEdits(ch, modelId)) {
        delete ch.modelConfigs[modelId];
      }
      return;
    }

    const displayId = resolveDisplayNodeId(getModelHierarchy(modelId), nodeId);
    const nodeCfg = raw.nodeConfigs?.[displayId] ?? raw.nodeConfigs?.[nodeId];
    if (nodeCfg && !modelHasEditsForConfig(getModelConfig(nodeCfg as ModelConfig), def, model, displayId)) {
      delete raw.nodeConfigs[displayId];
      if (displayId !== nodeId && raw.nodeConfigs?.[nodeId]) delete raw.nodeConfigs[nodeId];
    }
    if (raw.nodeConfigs && Object.keys(raw.nodeConfigs).length === 0) delete raw.nodeConfigs;
    if (!chapterModelHasEdits(ch, modelId)) delete ch.modelConfigs[modelId];
  }

  function readActiveModelConfig(ch?: Chapter | null): ModelConfig {
    const model = selModel.value;
    const defaultCfg = createDefaultModelConfig();
    if (!model) return defaultCfg;
    const chapter = ch ?? getActiveChapter();
    if (!chapter) return defaultCfg;
    return readModelConfigForTarget(chapter, model.id, selModelNodeId.value);
  }

  function hasActiveModelConfig(ch?: Chapter | null): boolean {
    const model = selModel.value;
    const chapter = ch ?? getActiveChapter();
    if (!model || !chapter) return false;
    if (!selModelNodeId.value) return chapterRootModelHasEdits(chapter, model.id);
    const displayNodeId = resolveDisplayNodeId(getModelHierarchy(model.id), selModelNodeId.value);
    const rootCfg = chapter.modelConfigs?.[model.id] as ModelConfig | undefined;
    const nodeCfg = rootCfg?.nodeConfigs?.[displayNodeId] ?? rootCfg?.nodeConfigs?.[selModelNodeId.value];
    if (!nodeCfg) return false;
    return modelHasEditsForConfig(
      getModelConfig(nodeCfg as ModelConfig),
      createDefaultModelConfig(),
      model,
      displayNodeId
    );
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
    // 仅在明确选中某个动画节点时展示「已改」，避免刷新后未选中却回退到第一章节误标
    const ch = selectedChapter.value;
    if (!ch) return false;
    if (modelHasSelectionEditDrafts(ch.id, modelId)) return true;
    return chapterModelHasEdits(ch, modelId);
  }

  /** 不依赖 mesh 判断已保存动画段是否含有效变化（模型尚未加载时 prune 不能误删） */
  function storedAnimSegmentHasEdits(seg: any): boolean {
    if (!seg) return false;
    const normVec = (a: number[] = [0, 0, 0], b: number[] = [0, 0, 0]) =>
      a.length === 3 && b.length === 3 && a.every((v, i) => Math.abs(v - b[i]) <= 1e-3);
    if (!normVec(seg.startPos ?? [0, 0, 0], seg.endPos ?? [0, 0, 0])) return true;
    if (!normVec(seg.startRot ?? [0, 0, 0], seg.endRot ?? [0, 0, 0])) return true;
    if (Math.abs((seg.startScale ?? 1) - (seg.endScale ?? 1)) > 1e-3) return true;
    return false;
  }

  function modelHasEditsForConfig(
    cfg: ModelConfig,
    def: ModelConfig,
    model: Model | null = null,
    nodeId: string | null = null
  ): boolean {
    if (
      cfg.visible !== def.visible ||
      cfg.scale !== def.scale ||
      !!cfg.wireframe !== !!def.wireframe ||
      cfg.highlight !== def.highlight ||
      cfg.outline !== def.outline ||
      !!cfg.intro ||
      (cfg.posOffset && (cfg.posOffset[0] !== 0 || cfg.posOffset[1] !== 0 || cfg.posOffset[2] !== 0))
    ) {
      return true;
    }
    if (cfg.animConfig?.segments?.length) {
      if (!model) {
        return cfg.animConfig.segments.some(seg => storedAnimSegmentHasEdits(mapStoredAnimSegment(seg)));
      }
      return cfg.animConfig.segments.some(seg =>
        animSegmentDiffersFromDefault(mapStoredAnimSegment(seg), model, nodeId)
      );
    }
    return false;
  }

  function modelNodeHasEdits(modelId: string, nodeId: string): boolean {
    // 与 modelHasEdits 一致：未选中动画时不显示「已改」
    const ch = selectedChapter.value;
    if (!ch) return false;
    const displayId = resolveDisplayNodeId(getModelHierarchy(modelId), nodeId);
    if (hasSelectionEditDraft(ch.id, modelId, displayId) || hasSelectionEditDraft(ch.id, modelId, nodeId)) {
      return true;
    }
    if (hasModelConfigForTarget(ch, modelId, displayId) || hasModelConfigForTarget(ch, modelId, nodeId)) {
      return true;
    }
    const nodeConfigs = ch.modelConfigs?.[modelId]?.nodeConfigs;
    if (!nodeConfigs) return false;
    const nodeCfg = (nodeConfigs[displayId] ?? nodeConfigs[nodeId]) as ModelConfig | undefined;
    if (!nodeCfg) return false;
    const model = models.value.find(m => m.id === modelId);
    return modelHasEditsForConfig(
      getModelConfig(nodeCfg),
      createDefaultModelConfig(),
      model ?? null,
      displayId
    );
  }

  function getChapterAnimDuration(ch: Chapter): number {
    let maxDur = 0;
    for (const { cfg } of collectChapterAnimTargets(ch)) {
      if (!cfg.animation || !cfg.animConfig?.segments?.length) continue;
      const segs = resolvePlaybackSegments(cfg.animConfig.segments);
      let total = 0;
      for (const seg of segs) total += (seg.pauseTime || 0) + (seg.animTime || 3);
      maxDur = Math.max(maxDur, total);
    }
    return maxDur;
  }

  function resolvePlaybackChapterAtTime(t: number): Chapter | null {
    const video = videoEl.value;
    const followVideoTime =
      viewOnly.value || isPreviewMode.value || !!(video && !video.paused) || !!chapterPlayTarget.value;
    if (!followVideoTime) {
      const selected = chapters.value.find(c => c.id === selectedChapterId.value);
      if (
        selected &&
        chapterBelongsToActiveVideo(selected) &&
        t >= selected.startTime - CHAPTER_TIME_EPS &&
        t < selected.endTime
      ) {
        return selected;
      }
    }
    // 有活动视频时绝不扫全场景章节，避免视频2时间点命中视频1动画
    if (activeVideoId.value) {
      return resolveActiveAnimationAtTime(nodes.value, activeVideoId.value, t);
    }
    return null;
  }

  function collectChapterAnimTargets(ch: Chapter): Array<{ objs: THREE.Object3D[]; cfg: ModelConfig; liveSegs?: any[] }> {
    const targets: Array<{ objs: THREE.Object3D[]; cfg: ModelConfig; liveSegs?: any[] }> = [];
    if (!ch.modelConfigs) return targets;
    const def = createDefaultModelConfig();

    for (const [cmid, rootCfg] of Object.entries(ch.modelConfigs)) {
      if (!chapterModelHasEdits(ch, cmid)) continue;
      const root = meshes.get(cmid);
      if (!root) continue;
      const model = models.value.find(m => m.id === cmid);

      const rootCfgTyped = getModelConfig(rootCfg as ModelConfig);
      if (
        chapterRootModelHasEdits(ch, cmid) &&
        rootCfgTyped.animation &&
        rootCfgTyped.animConfig?.segments?.length
      ) {
        targets.push({
          objs: [root],
          cfg: rootCfgTyped,
          liveSegs:
            !isEditVideoMeshSyncActive() &&
            shouldUseLiveAnimSegments(cmid, null) &&
            animSegments.length > 0
              ? animSegments
              : undefined
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
        const nodeCfgTyped = getModelConfig((nodeConfigs[displayId] as ModelConfig) ?? (nodeCfg as ModelConfig));
        if (!modelHasEditsForConfig(nodeCfgTyped, def, model ?? null, displayId)) continue;
        if (!nodeCfgTyped.animation || !nodeCfgTyped.animConfig?.segments?.length) continue;
        targets.push({
          objs: nodeObjs,
          cfg: nodeCfgTyped,
          // 播放跟视频时禁止挂 live 段，避免缓存里残留编辑相对坐标与存储绝对坐标混用
          liveSegs:
            !isEditVideoMeshSyncActive() &&
            shouldUseLiveAnimSegments(cmid, displayId) &&
            animSegments.length > 0
              ? animSegments
              : undefined
        });
      }
    }
    return targets;
  }

  function invalidateChapterAnimTargetsCache(chapterId?: string | null) {
    if (!chapterId || chapterAnimTargetsCache?.chapterId === chapterId) {
      chapterAnimTargetsCache = null;
    }
  }

  function getChapterAnimTargetsCached(ch: Chapter) {
    if (chapterAnimTargetsCache?.chapterId === ch.id) {
      return chapterAnimTargetsCache.targets;
    }
    const targets = collectChapterAnimTargets(ch);
    chapterAnimTargetsCache = { chapterId: ch.id, targets };
    return targets;
  }

  /** 播放循环中仅更新动画变换，避免每帧全量重置模型树 */
  function applyChapterAnimOnly(ch: Chapter, elapsedSec: number) {
    const targets = getChapterAnimTargetsCached(ch);
    // 视频驱动时禁止 live 段：缓存里可能残留编辑态相对坐标，与存储绝对坐标混用会飞位
    const allowLive = !(_chAnimLock && !chAnimWallclock);
    for (const { objs, cfg, liveSegs } of targets) {
      const segs = allowLive ? liveSegs : undefined;
      for (const obj of objs) {
        applyElapsedAnimToObject(obj, cfg, elapsedSec, segs);
      }
    }
    syncVisualOverlayTransforms();
  }

  /** 墙钟预览帧：仅更新有动画的目标（初始帧已由 applyChapterModelState(0) 完成） */
  function applyChapterWallclockFrame(ch: Chapter, elapsedSec: number) {
    applyChapterAnimOnly(ch, elapsedSec);
  }

  function applyElapsedAnimToObject(obj: THREE.Object3D, cfg: ModelConfig, elapsedSec: number, liveSegs?: any[]) {
    const cac = cfg.animConfig;
    if (!cac?.segments?.length || !cfg.animation) return;

    const rawSegs = liveSegs?.length ? liveSegs : cac.segments;
    const csegs = resolvePlaybackSegments(rawSegs).map(seg =>
      liveSegs?.length
        ? cloneAnimSegmentForApply(obj, seg)
        : cloneStoredAnimSegmentForPlayback(obj, seg, cac as any)
    );
    let ctotal = 0;
    for (let cs = 0; cs < csegs.length; cs++) ctotal += (csegs[cs].pauseTime || 0) + (csegs[cs].animTime || 3);
    if (ctotal <= 0) return;
    for (let cs2 = 0; cs2 < csegs.length; cs2++) getSegPivotCache(csegs[cs2], obj);

    const elapsed = Math.max(0, elapsedSec);
    if (elapsed <= 0) {
      const cfirst = csegs[0];
      const pc = getSegPivotCache(cfirst, obj);
      applyPivotPathFrame(
        obj,
        [cfirst.startPos[0], cfirst.startPos[1], cfirst.startPos[2]],
        [cfirst.startRot[0], cfirst.startRot[1], cfirst.startRot[2]],
        pc,
        0
      );
      obj.scale.setScalar(cfirst.startScale);
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

  function resolveModelLoadUrl(m: Model): string {
    if (!m.url) return "";
    if (m.url.startsWith("blob:") || m.url.startsWith("data:")) return m.url;
    const raw = getModelSourcePath(m) || m.url;
    return resolveAssetUrl(raw);
  }

  async function loadGLB(m: Model) {
    const url = resolveModelLoadUrl(m);
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
    invalidateSceneModelCenterCache();
    invalidatePickMeshCache();
    const model = models.value.find(m => m.id === mid);
    if (model?.url?.startsWith("blob:")) URL.revokeObjectURL(model.url);
  }

  function clearSelectionHighlight() {
    if (outlinePass) outlinePass.selectedObjects = [];
  }

  function clearHoverHighlight() {
    lastHoverOutlineKey = "";
    if (hoverOutlinePass) hoverOutlinePass.selectedObjects = [];
    syncEditorComposerPasses();
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
    if (viewportInteracting || cameraAnimating || camTrans || !hoverOutlinePass) return;
    const outlineKey = `${modelId}:${resolvedNodeId ?? ""}:${hitObject?.uuid ?? ""}`;
    if (outlineKey === lastHoverOutlineKey) return;
    lastHoverOutlineKey = outlineKey;

    const meshes =
      hitObject && (hitObject as THREE.Mesh).isMesh
        ? collectOutlineMeshes([hitObject])
        : collectOutlineMeshes(getNodeObjects(modelId, resolvedNodeId));
    hoverOutlinePass.selectedObjects = meshes;
    syncEditorComposerPasses();
    syncComposerMsaaSamples();
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
    if (viewOnly.value || isPreviewMode.value) {
      outlinePass.selectedObjects = [];
      syncEditorComposerPasses();
      return;
    }
    if (!selModelId.value) {
      outlinePass.selectedObjects = [];
      syncEditorComposerPasses();
      return;
    }
    const roots = getNodeObjects();
    // 整模：根节点一次写入蒙版，外轮廓更干净；子部件：再落到可见 Mesh
    outlinePass.selectedObjects = selModelNodeId.value
      ? collectOutlineMeshes(roots)
      : roots.filter(o => !!o);
    syncEditorComposerPasses();
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
    syncVisualOverlayTransforms();
    if (selModelId.value && pivotHelpers.has(selModelId.value)) {
      updateActivePivotHelper(selModelId.value);
    }
  }

  function isPickExemptObject(obj: THREE.Object3D): boolean {
    let current: THREE.Object3D | null = obj;
    while (current) {
      if (
        current.userData?.isSelectionHelper ||
        current.userData?.isEdgeLine ||
        current.userData?.isOutlineShell ||
        current.userData?.isBodyHighlightOverlay
      ) {
        return true;
      }
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
    scene.updateMatrixWorld(false);
    const hits = raycaster.intersectObjects(pickMeshes, false);

    for (const mesh of outlineHidden) {
      mesh.visible = false;
    }
    return hits;
  }

  type PickTargetResult = { modelId: string; nodeId: string | null; hitObject: THREE.Object3D; hitPoint: THREE.Vector3 };

  function isPresentationUiTarget(target: EventTarget | null) {
    if (!(target instanceof Element)) return false;
    return !!target.closest(
      ".viewport-preview-nav, .viewport-preview-nav-btn, .viewport-play-hint, .pip-group, .progress-area, .editor-topbar, .chapter-list-panel, .chapter-preview-backdrop"
    );
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
    if (!controls || camTrans || cameraAnimating) return;

    const box = new THREE.Box3().setFromObject(obj);
    if (box.isEmpty()) return;

    box.getCenter(_focusCenter);
    box.getSize(_focusSize);
    const maxDim = Math.max(_focusSize.x, _focusSize.y, _focusSize.z, 0.4);
    const distance = getPresentationCameraDistance(maxDim);

    // 俯视倾斜角度：沿用默认场景相机的 elevated 视角，而非当前水平视线
    _focusOffset.copy(_defaultCamViewDir).multiplyScalar(distance);

    const newPos: [number, number, number] = [
      _focusCenter.x + _focusOffset.x,
      Math.max(_focusCenter.y + _focusOffset.y, _focusCenter.y + maxDim * 0.35),
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
    if (hasAnim) {
      const rawSeg = cfg.animConfig!.segments![0];
      // chapter 内已是绝对坐标，禁止再用 cloneAnimSegmentForApply（会对子节点再加一次 baseLocalPos）
      const seg = cloneStoredAnimSegmentForPlayback(obj, mapStoredAnimSegment(rawSeg), cfg.animConfig as any);
      invalidateSegPivotCache(seg);
      getSegPivotCache(seg, obj);
      applyPivotPathFrame(
        obj,
        seg.startPos,
        seg.startRot,
        seg._animPivotCache,
        0
      );
      obj.scale.setScalar(seg.startScale);
    } else {
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
    // 若动画属于其它视频，先切到其父视频时间轴再算索引（否则会命中旧视频的 timeline[0]）
    if (chapter.parentId && activeVideoId.value !== chapter.parentId) {
      activeVideoId.value = chapter.parentId;
      const parentVideo = getNodeById(nodes.value, chapter.parentId);
      if (parentVideo && isVideoNode(parentVideo)) {
        const storedDur = parentVideo.videoDuration;
        if (Number.isFinite(storedDur) && storedDur > 0) duration.value = storedDur;
      }
    }
    const timelineIdx = timelineChapters.value.findIndex(c => c.id === chapter.id);
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
      await new Promise(resolve => window.setTimeout(resolve, 16));
    }
  }

  function isSeekNearTarget(video: HTMLVideoElement, target: number) {
    // 移动端解码/缓冲常有更大误差，过严会把已成功的 seek 判失败，随后又从 0 继续播。
    const eps = isCoarsePointerDevice() ? Math.max(CHAPTER_TIME_EPS, 0.35) : CHAPTER_TIME_EPS;
    return Math.abs(video.currentTime - target) < eps;
  }

  /** seek 失败时浏览器常把 currentTime 打回 0；禁止用这种回落覆盖展示进度 */
  function isPresentationSeekRollback(mediaTime: number, uiTarget: number): boolean {
    if (!Number.isFinite(mediaTime) || !Number.isFinite(uiTarget)) return false;
    if (uiTarget <= 0.45) return false;
    return mediaTime < 0.4 && Math.abs(mediaTime - uiTarget) > 0.5;
  }

  function canAdoptPresentationVideoTime(video: HTMLVideoElement, uiTarget?: number | null): boolean {
    const target = uiTarget ?? presentationSeekTargetTime;
    if (target == null) return true;
    if (isPresentationSeekRollback(video.currentTime, target)) return false;
    if (isSeekNearTarget(video, target)) return true;
    // While a seek is outstanding, the pre-seek media clock is not "progress past target".
    if (
      presentationPlaybackSession.phase === "seeking" ||
      presentationSeekTargetTime != null
    ) {
      return false;
    }
    // Cached EOF must not count as "already past" an early target (refresh boot race).
    if (isPresentationAtMediaEnd(video) || video.ended) {
      const dur =
        Number.isFinite(video.duration) && video.duration > 0 ? video.duration : duration.value;
      if (dur > 0 && target < dur - Math.max(0.5, CHAPTER_END_EPS * 4)) {
        return false;
      }
    }
    // Seek cleared: follow media only once it has actually advanced past the target while playing.
    return !video.paused && video.currentTime > target + CHAPTER_TIME_EPS;
  }

  async function forceResumeVideoPlayback(
    video: HTMLVideoElement,
    options?: { requestSeq?: number }
  ): Promise<boolean> {
    if (video.ended || isPresentationAtMediaEnd(video)) {
      if (
        (viewOnly.value || isPreviewMode.value) &&
        presentationPlaybackSession.intent === "play" &&
        !presentationUserWantsPaused
      ) {
        return loopPresentationPlaybackFromStart();
      }
      presentationExpectPlaying = false;
      isPlaying.value = false;
      return false;
    }
    if (!video.paused) {
      isPlaying.value = true;
      return true;
    }
    const req = options?.requestSeq;
    // 短重试：过长会叠到「停几秒才播」，并和主循环补播打架
    const delays = [0, 40, 120, 280, 560];
    for (const delay of delays) {
      if (req !== undefined && req !== chapterPlaybackRequestSeq) return false;
      if (delay > 0) await new Promise(resolve => window.setTimeout(resolve, delay));
      if (req !== undefined && req !== chapterPlaybackRequestSeq) return false;
      if ((viewOnly.value || isPreviewMode.value) && (!presentationExpectPlaying || presentationUserWantsPaused)) {
        return false;
      }
      if (video.ended || isPresentationAtMediaEnd(video)) {
        presentationExpectPlaying = false;
        isPlaying.value = false;
        return false;
      }
      try {
        if (video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) {
          await waitForVideoReady(1200);
          if (req !== undefined && req !== chapterPlaybackRequestSeq) return false;
        }
        await video.play();
      } catch {
        /* retry */
      }
      if (!video.paused && !video.ended) {
        isPlaying.value = true;
        return true;
      }
    }
    return !video.paused && !video.ended;
  }

  function clearPresentationResumeTimer() {
    if (presentationResumeTimer != null) {
      clearTimeout(presentationResumeTimer);
      presentationResumeTimer = null;
    }
  }

  /** Legacy call sites are inert; only commandPresentationPlayback may issue presentation media work. */
  function schedulePresentationPlaybackResume(_requestSeq: number) {
    clearPresentationResumeTimer();
  }

  /** 在点击同步栈内先触发 play，给后续 await seek 后的续播保留媒体授权。 */
  function claimPresentationPlaybackGesture(video: HTMLVideoElement) {
    presentationExpectPlaying = true;
    chapterAutoNext.value = true;
    isPlaying.value = true;
    try {
      const p = video.play();
      if (p && typeof p.catch === "function") void p.catch(() => undefined);
    } catch {
      /* ignore */
    }
  }

  function isPresentationSeekAcceptable(video: HTMLVideoElement, target: number) {
    if (isSeekNearTarget(video, target)) return true;
    // 移动端缓冲落点误差更大：宁可接受“基本到点”也不要判定 seek 失败并放弃续播。
    const looseEps = isCoarsePointerDevice() ? 1.25 : 0.55;
    return Math.abs(video.currentTime - target) < looseEps;
  }

  /**
   * 展示/预览跳转：始终不断播 seek（禁止 pause→seek 路径，避免丢掉移动端播放权）；
   * play 失败也返回成功，由 schedulePresentationPlaybackResume / onVideoPause 继续补播。
   */
  async function seekPresentationMedia(
    target: number,
    shouldPlay: boolean,
    options?: { requestSeq?: number; preferContinuous?: boolean }
  ): Promise<boolean> {
    const video = videoEl.value;
    if (!video) return false;
    const req = options?.requestSeq;
    if (shouldPlay) {
      presentationExpectPlaying = true;
      chapterAutoNext.value = true;
      isPlaying.value = true;
    }

    // 展示续播：优先不断播 seek，保留播放权；落点由锚点保护，禁止把失败回落的 0 写成进度
    let seekOk = await seekVideoTo(target, { pause: !shouldPlay });
    if (req !== undefined && req !== chapterPlaybackRequestSeq) return false;

    if (!seekOk && !isPresentationSeekAcceptable(video, target)) {
      try {
        video.currentTime = clampVideoTime(target, video);
      } catch {
        /* ignore */
      }
      await waitUntilSeekable(video, target);
      if (req !== undefined && req !== chapterPlaybackRequestSeq) return false;
      await new Promise<void>(resolve => {
        let settled = false;
        const finish = () => {
          if (settled) return;
          settled = true;
          video.removeEventListener("seeked", onSeeked);
          resolve();
        };
        const onSeeked = () => finish();
        video.addEventListener("seeked", onSeeked);
        window.setTimeout(finish, isCoarsePointerDevice() ? 2200 : 1200);
      });
      if (req !== undefined && req !== chapterPlaybackRequestSeq) return false;
      seekOk = isPresentationSeekAcceptable(video, target);
    }
    seekOk = seekOk || isPresentationSeekAcceptable(video, target);

    if (seekOk) {
      if (canAdoptPresentationVideoTime(video, target)) {
        presentationSeekTargetTime = null;
        currentTime.value = video.currentTime;
      } else {
        presentationSeekTargetTime = target;
        currentTime.value = target;
      }
    } else if (shouldPlay || (viewOnly.value || isPreviewMode.value)) {
      // 校验未过也保持目标点：暂停 seek 仍更新 UI，续播则由 resume 继续补。
      // 若媒体已错误回落片头，绝不能用 0 覆盖乐观进度。
      presentationSeekTargetTime = target;
      currentTime.value = target;
      seekOk = true;
    } else {
      return false;
    }

    if (shouldPlay) {
      try {
        const p = video.play();
        if (p && typeof p.catch === "function") void p.catch(() => undefined);
      } catch {
        /* ignore */
      }
      await forceResumeVideoPlayback(video, { requestSeq: req });
      if (req !== undefined && req !== chapterPlaybackRequestSeq) return false;
      if (canAdoptPresentationVideoTime(video, target)) {
        presentationSeekTargetTime = null;
        currentTime.value = video.currentTime;
      } else {
        // 仍未到点或回落片头：钉住目标，交由 scheduleResume 温和重试（最多一次 reseek）
        presentationSeekTargetTime = target;
        currentTime.value = target;
      }
      return true;
    }
    return seekOk;
  }

  async function seekVideoTo(time: number, options?: { pause?: boolean }): Promise<boolean> {
    const video = videoEl.value;
    if (!video) return false;

    const target = clampVideoTime(time, video);
    if (!Number.isFinite(target)) return false;

    const gen = ++seekGeneration;
    const coarse = isCoarsePointerDevice();
    // 尊重调用方 pause 意图：续播跳转可不断播 seek；仅默认场景 pause→seek。
    const shouldPause = options?.pause ?? true;

    if (
      video.ended &&
      Number.isFinite(video.duration) &&
      target + CHAPTER_TIME_EPS < video.duration
    ) {
      try {
        video.pause();
        video.currentTime = Math.max(0, video.duration - 0.05);
      } catch {
        /* ignore */
      }
    }

    if (shouldPause && !video.paused) {
      video.pause();
    }

    const commitSeekUi = (ok: boolean) => {
      if (gen !== seekGeneration) return;
      // 失败时不要用错误的 currentTime（常为 0）覆盖乐观进度。
      // 展示态：即便 ok，若实际是回落片头也禁止覆盖。
      if (!ok) return;
      if (
        (viewOnly.value || isPreviewMode.value) &&
        isPresentationSeekRollback(video.currentTime, target)
      ) {
        return;
      }
      currentTime.value = video.currentTime;
    };

    const tryAssignCurrentTime = () => {
      try {
        video.currentTime = target;
        return true;
      } catch {
        return false;
      }
    };

    if (!tryAssignCurrentTime()) return false;

    if (isSeekNearTarget(video, target)) {
      commitSeekUi(true);
      return true;
    }

    await waitUntilSeekable(video, target);
    if (gen !== seekGeneration) return false;

    const waitForSeeked = (timeoutMs: number) =>
      new Promise<boolean>(resolve => {
        let settled = false;
        const finish = (ok: boolean) => {
          if (settled) return;
          settled = true;
          video.removeEventListener("seeked", onSeeked);
          commitSeekUi(ok);
          resolve(ok);
        };
        const onSeeked = () => finish(isSeekNearTarget(video, target));
        video.addEventListener("seeked", onSeeked);
        if (!tryAssignCurrentTime()) {
          finish(false);
          return;
        }
        window.setTimeout(() => finish(isSeekNearTarget(video, target)), timeoutMs);
      });

    let seeked = await waitForSeeked(coarse ? 2800 : SEEK_EVENT_TIMEOUT_MS);
    if (gen !== seekGeneration) return false;

    // 部分手机需先短暂激活管线；仅在明确要求 pause 时再停，避免展示续播丢播放权。
    if (!seeked && coarse) {
      try {
        await video.play();
      } catch {
        /* ignore */
      }
      if (shouldPause) video.pause();
      await new Promise(resolve => window.setTimeout(resolve, 40));
      if (gen !== seekGeneration) return false;
      seeked = await waitForSeeked(2500);
      if (!seeked && isPresentationSeekAcceptable(video, target)) {
        commitSeekUi(true);
        return true;
      }
    }
    if (!seeked && isPresentationSeekAcceptable(video, target)) {
      commitSeekUi(true);
      return true;
    }
    return seeked;
  }

  function resetChapterModelsToStart(chapter: Chapter) {
    applyChapterModelState(chapter, 0);
  }

  function syncPausedChapterAnimation(v: HTMLVideoElement, _ci: number) {
    if (!viewOnly.value && !isPreviewMode.value) {
      syncEditModePlaybackFromVideo(v);
      return;
    }
    if (!v.paused) return;
    const ch = resolvePresentationPlaybackChapter(v);
    if (!ch) {
      resetAllModelsToDefault();
      return;
    }
    stopChapterAnimation();
    if (!chapterHasAnyModelEdits(ch)) {
      resetAllModelsToDefault();
      return;
    }
    applyChapterModelState(ch, getPresentationAnimElapsed(v, ch));
  }

  function syncChapterSubtitle(v: HTMLVideoElement) {
    const scopeId = selectedChapterId.value || activeVideoId.value;
    const subtitle = subtitles.value.find(
      sb =>
        v.currentTime >= sb.startTime &&
        v.currentTime < sb.endTime &&
        (!scopeId || sb.parentNodeId === scopeId || sb.parentNodeId === activeVideoId.value)
    );
    if (subtitle) {
      showSubtitle(subtitle);
      return;
    }
    displaySubtitle.value = false;
  }

  // ── Ticker ──
  function findChIdx(t: number) {
    const list = timelineChapters.value;
    if (!list.length) return -1;
    const exact = list.findIndex(c => t >= c.startTime - CHAPTER_TIME_EPS && t < c.endTime);
    if (exact >= 0) return exact;
    // 循环瞬间 video.currentTime 常卡在 duration（= 末章 endTime），按末章处理
    const last = list[list.length - 1];
    if (t >= last.endTime - CHAPTER_END_EPS && t <= last.endTime + CHAPTER_END_EPS) {
      return list.length - 1;
    }
    return -1;
  }

  function chapterAtTime(t: number): Chapter | null {
    if (!activeVideoId.value) return null;
    return resolveActiveAnimationAtTime(nodes.value, activeVideoId.value, t);
  }

  function getPlaybackChapterAtTime(t: number): Chapter | null {
    return resolvePlaybackChapterAtTime(t);
  }

  function getTimelineChapterIndex(ch: Chapter): number {
    return timelineChapters.value.findIndex(c => c.id === ch.id);
  }

  function isChapterInPlaybackRange(ch: Chapter, t: number): boolean {
    return t >= ch.startTime - CHAPTER_TIME_EPS && t < ch.endTime;
  }

  function clampNumber(value: number, min: number, max: number) {
    if (max < min) return min;
    return Math.min(Math.max(value, min), max);
  }

  function getChapterScope(parentVideoId?: string) {
    const video =
      parentVideoId ? getNodeById(nodes.value, parentVideoId) : activeVideoNode.value;
    const nodeDur =
      video && isVideoNode(video) && Number.isFinite(video.videoDuration) && video.videoDuration > 0
        ? video.videoDuration
        : 0;
    const projectDur =
      currProj.value?.videoDuration && currProj.value.videoDuration > 0
        ? currProj.value.videoDuration
        : 0;
    const mediaDur =
      videoEl.value && Number.isFinite(videoEl.value.duration) && videoEl.value.duration > 0
        ? videoEl.value.duration
        : 0;
    const uiDur = duration.value > 0 ? duration.value : 0;
    // 只读取最大有效时长：不可在此处写回响应式字段（会被 selectedChapterTimeBounds 等 computed 调用）。
    const videoDur = Math.max(nodeDur, projectDur, mediaDur, uiDur);
    return {
      parent: video && isVideoNode(video) ? video : null,
      startTime: 0,
      endTime: videoDur
    };
  }

  /** 在用户操作路径上纠正过期的视频时长（不可在 computed 中调用） */
  function syncVideoDurationFromScope(parentVideoId?: string) {
    const scope = getChapterScope(parentVideoId);
    const videoDur = scope.endTime;
    if (videoDur <= 0) return videoDur;
    const video = scope.parent;
    if (video && video.videoDuration + CHAPTER_TIME_EPS < videoDur) {
      video.videoDuration = videoDur;
    }
    if (currProj.value && (currProj.value.videoDuration || 0) + CHAPTER_TIME_EPS < videoDur) {
      currProj.value.videoDuration = videoDur;
    }
    if (duration.value + CHAPTER_TIME_EPS < videoDur) {
      duration.value = videoDur;
    }
    return videoDur;
  }

  function getSiblingChapters(parentId?: string, excludeId?: string) {
    return chapters.value
      .filter(ch => (ch.parentId || undefined) === (parentId || undefined) && ch.id !== excludeId)
      .sort((a, b) => a.startTime - b.startTime || a.endTime - b.endTime);
  }

  function getSortedChapterChildren(videoId: string) {
    return getVideoAnimations(nodes.value, videoId);
  }

  function isVideoAnimationScope(parentId?: string) {
    if (!parentId) return false;
    const node = getNodeById(nodes.value, parentId);
    return !!node && isVideoNode(node);
  }

  function getMinChapterDurationForParent(parentId?: string) {
    return isVideoAnimationScope(parentId) ? MIN_ANIMATION_NODE_DURATION : MIN_CHAPTER_DURATION;
  }

  function getDefaultChapterSegmentDuration(rangeDuration: number, parentId?: string) {
    if (isVideoAnimationScope(parentId)) {
      if (rangeDuration <= MIN_ANIMATION_NODE_DURATION + CHAPTER_TIME_EPS) return rangeDuration;
      return Math.min(rangeDuration, DEFAULT_ANIMATION_NODE_DURATION);
    }
    if (rangeDuration < MIN_CHAPTER_DURATION * 2 - CHAPTER_TIME_EPS) return 0;
    if (rangeDuration <= CHAPTER_SPLIT_INTERVAL + CHAPTER_TIME_EPS) return rangeDuration / 2;
    return CHAPTER_SPLIT_INTERVAL;
  }

  function getProtectedChildEnd(ch: Chapter) {
    return ch.startTime;
  }

  function getNextChapterRange(parentId?: string): { startTime: number; endTime: number; splitChapter?: Chapter } | null {
    syncVideoDurationFromScope(parentId);
    const scope = getChapterScope(parentId);
    const scopeDuration = scope.endTime - scope.startTime;
    const minDur = getMinChapterDurationForParent(parentId);
    const animationScope = isVideoAnimationScope(parentId);

    if (animationScope) {
      if (scopeDuration < minDur - CHAPTER_TIME_EPS) return null;
    } else if (scopeDuration < MIN_CHAPTER_DURATION * 2 - CHAPTER_TIME_EPS) {
      return null;
    }

    const siblings = getSiblingChapters(parentId);
    if (siblings.length === 0) {
      const segmentDuration = getDefaultChapterSegmentDuration(scopeDuration, parentId);
      if (segmentDuration <= 0) return null;
      return {
        startTime: scope.startTime,
        endTime: Math.min(scope.endTime, scope.startTime + segmentDuration)
      };
    }

    let cursor = scope.startTime;
    for (const sibling of siblings) {
      const siblingStart = clampNumber(sibling.startTime, scope.startTime, scope.endTime);
      if (siblingStart - cursor >= minDur - CHAPTER_TIME_EPS) {
        const gapDuration = siblingStart - cursor;
        const segmentDuration = getDefaultChapterSegmentDuration(gapDuration, parentId);
        return {
          startTime: cursor,
          endTime: Math.min(scope.endTime, cursor + segmentDuration)
        };
      }
      cursor = Math.max(cursor, clampNumber(sibling.endTime, scope.startTime, scope.endTime));
    }

    if (scope.endTime - cursor >= minDur - CHAPTER_TIME_EPS) {
      const gapDuration = scope.endTime - cursor;
      const segmentDuration = getDefaultChapterSegmentDuration(gapDuration, parentId);
      return {
        startTime: cursor,
        endTime: Math.min(scope.endTime, cursor + segmentDuration)
      };
    }

    if (animationScope) return null;

    const splitTarget = [...siblings].sort((a, b) => b.endTime - a.endTime)[0];
    if (!splitTarget) return null;

    const protectedEnd = getProtectedChildEnd(splitTarget);
    const targetDuration = splitTarget.endTime - splitTarget.startTime;
    const preferredDuration = getDefaultChapterSegmentDuration(targetDuration, parentId);
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
    const minDur = getMinChapterDurationForParent(ch.parentId);

    const startMin = prev?.endTime ?? scope.startTime;
    const endMax = next?.startTime ?? scope.endTime;
    const startMax = Math.max(
      startMin,
      Math.min(ch.endTime - minDur, endMax - minDur, firstChildStart)
    );
    const endMin = Math.min(endMax, Math.max(ch.startTime + minDur, startMin + minDur, lastChildEnd));

    return { startMin, startMax, endMin, endMax };
  }

  function normalizeChapterFormRange(ch: Chapter) {
    syncVideoDurationFromScope(ch.parentId);
    const bounds = getChapterTimeInputBounds(ch);
    const minDur = getMinChapterDurationForParent(ch.parentId);
    let startTime = clampNumber(chForm.startTime, bounds.startMin, bounds.startMax);
    let endTime = clampNumber(chForm.endTime, Math.max(bounds.endMin, startTime + minDur), bounds.endMax);

    if (endTime - startTime < minDur) {
      endTime = clampNumber(startTime + minDur, bounds.endMin, bounds.endMax);
      if (endTime - startTime < minDur) {
        startTime = clampNumber(endTime - minDur, bounds.startMin, bounds.startMax);
        endTime = clampNumber(startTime + minDur, bounds.endMin, bounds.endMax);
      }
    }

    return { startTime, endTime };
  }

  function normalizeChapterSiblingRanges(parentId: string | undefined, scopeStart: number, scopeEnd: number) {
    const siblings = getSiblingChapters(parentId);
    if (siblings.length === 0) return;

    const minDur = getMinChapterDurationForParent(parentId);
    const availableDuration = scopeEnd - scopeStart;
    if (availableDuration < minDur - CHAPTER_TIME_EPS) return;

    let cursor = scopeStart;
    siblings.forEach((sibling, index) => {
      const remainingSlots = siblings.length - index - 1;
      const latestEnd = scopeEnd - remainingSlots * minDur;
      if (latestEnd - cursor < minDur - CHAPTER_TIME_EPS) return;

      let desiredDuration = Math.max(sibling.endTime - sibling.startTime, minDur);
      const isSingleFullRangeChild =
        !!parentId &&
        siblings.length === 1 &&
        sibling.startTime <= scopeStart + CHAPTER_TIME_EPS &&
        sibling.endTime >= scopeEnd - CHAPTER_TIME_EPS &&
        availableDuration >= minDur * 2 - CHAPTER_TIME_EPS;

      if (isSingleFullRangeChild) {
        desiredDuration = getDefaultChapterSegmentDuration(availableDuration, parentId) || desiredDuration;
      }

      const endTime = clampNumber(cursor + desiredDuration, cursor + minDur, latestEnd);
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
    const metaDuration = Number.isFinite(v.duration) && v.duration > 0 ? v.duration : 0;
    const videoNode = activeVideoNode.value;
    if (videoNode) {
      sceneNodeApi.setVideoNodeInfo(
        videoNode,
        videoNode.videoSrc || v.currentSrc || v.src,
        metaDuration,
        v.videoWidth,
        v.videoHeight
      );
    }
    if (currProj.value) {
      currProj.value.videoDuration = metaDuration;
      currProj.value.videoWidth = v.videoWidth;
      currProj.value.videoHeight = v.videoHeight;
    }
    if (metaDuration > 0) duration.value = metaDuration;
    v.loop = resolveEffectiveVideoLoop();
    v.playbackRate = playbackRate.value;
    if (metaDuration > 0) ensureDefaultChapter(metaDuration);
    // 避免 captureStream + rAF 检测导致编辑页卡顿；展示时再按需估算
    if (!videoFps.value && metaDuration > 0) videoFps.value = 30;
  }

  function onTick(e: Event) {
    const v = e.target as HTMLVideoElement;
    syncPresentationPlayStateFromVideo(v);
    const seekLocked =
      videoChapterSyncPaused || chapterNavLock.value || presentationChapterTransition;
    // seek/章节切换锁定期内不要用 video.currentTime 覆盖进度条。
    // 移动端 seek 失败时常停在 0，否则绿色条会被立刻拉回起点。
    // 但若 video 已在播放，必须跟 video 时间，否则会一直停在点击位置。
    if (shouldSyncProgressFromVideo(v, seekLocked)) {
      if (viewOnly.value || isPreviewMode.value) {
        if (canAdoptPresentationVideoTime(v, presentationPlaybackSession.targetTime)) {
          presentationPlaybackSession.committedTime = v.currentTime;
          if (!v.paused && presentationPlaybackSession.intent === "play") {
            presentationPlaybackSession.phase = "playing";
          }
          currentTime.value = v.currentTime;
        }
      } else {
        currentTime.value = v.currentTime;
      }
    }

    if (sceneBootstrapBusy.value || editorInitializing.value) {
      syncChapterSubtitle(v);
      return;
    }

    if ((viewOnly.value || isPreviewMode.value || !v.paused) && !presentationChapterTransition && !seekLocked) {
      syncPresentationPlaybackFromVideo(v);
    } else if ((viewOnly.value || isPreviewMode.value) && seekLocked) {
      syncPresentationUiFromTimeline();
    }

    if (viewOnly.value || isPreviewMode.value) {
      const timelineT = resolvePresentationPlaybackTime(v);
      const navChapter =
        getPresentationChapterAtVideoTime(timelineT) ??
        (presentationUiChapterId.value
          ? (() => {
              const uiChapter = chapters.value.find(ch => ch.id === presentationUiChapterId.value);
              return uiChapter ? resolvePresentationNavChapter(uiChapter) : null;
            })()
          : null);
      const playTarget = navChapter ? resolvePlayableChapterForPresentation(navChapter) : null;
      if (navChapter && playTarget && canAutoAdvancePresentationChapter(navChapter, v)) {
        const nav = getPresentationNavChapters();
        const navIdx = getPresentationNavIndex(navChapter);
        const next = navIdx >= 0 ? nav[navIdx + 1] : null;

        if (presentationPlaybackSession.autoAdvance) {
          // Same end-window guard as maybeAutoAdvancePresentation: ignore stale clocks.
          const t = resolvePresentationPlaybackTime(v);
          const nearEnd =
            t >= navChapter.endTime - CHAPTER_END_EPS &&
            t <= navChapter.endTime + Math.max(CHAPTER_END_EPS, 0.35);
          const wrapTarget = next ?? (nav.length > 0 ? nav[0] : null);
          if (nearEnd && wrapTarget) {
            if (
              wrapTarget.id === navChapter.id &&
              Math.abs(t - wrapTarget.startTime) < CHAPTER_TIME_EPS
            ) {
              // single-chapter at start after wrap — fall through
            } else {
              commandPresentationPlayback({
                targetTime: wrapTarget.startTime,
                intent: "play",
                navChapter: wrapTarget,
                autoAdvance: true
              });
            }
          }
        } else if (next) {
          chapterAutoNext.value = false;
        }
        syncChapterSubtitle(v);
        return;
      }
    }

    const ci = findChIdx(v.currentTime);

    if (seekLocked) {
      if (!videoChapterSyncPaused && !chapterNavLock.value && v.paused) {
        syncPausedChapterAnimation(v, ci);
      }
      syncChapterSubtitle(v);
      return;
    }

    if (chapterPlayTarget.value && !viewOnly.value && !isPreviewMode.value) {
      syncEditModePlaybackFromVideo(v);
      if (v.paused) {
        syncPausedChapterAnimation(v, ci);
      }
      syncChapterSubtitle(v);
      syncIntroPresentation();
      return;
    }

    if (!viewOnly.value && !isPreviewMode.value) {
      syncEditModePlaybackFromVideo(v);
      syncChapterSubtitle(v);
      syncIntroPresentation();
      return;
    }

    syncChapterSubtitle(v);
    syncIntroPresentation();
  }

  function onVideoEnd() {
    if (viewOnly.value || isPreviewMode.value) {
      const v = videoEl.value;
      if (v && isStalePresentationMediaEnd(v)) {
        // Cached EOF during start/seek — keep optimistic target; effect will re-seek.
        syncPresentationUiFromTimeline(presentationDisplayTime.value);
        return;
      }
      // 展示页：未手动暂停则循环续播，不因 ended 自动暂停。
      if (loopPresentationPlaybackFromStart()) return;
      const endTime = v?.currentTime ?? presentationDisplayTime.value;
      presentationPlaybackSession.phase = "ended";
      presentationPlaybackSession.intent = "pause";
      presentationPlaybackSession.committedTime = endTime;
      presentationPlaybackSession.targetTime = endTime;
      presentationPlaybackSession.autoAdvance = false;
      presentationExpectPlaying = false;
      presentationUserWantsPaused = true;
      chapterAutoNext.value = false;
      clearPresentationResumeTimer();
      if (!presentationEndedUiSynced) {
        presentationEndedUiSynced = true;
        syncPresentationUiFromTimeline(endTime);
      }
      stopChapterAnimation();
      syncCurrentChapterAnimationFromVideo();
      syncIntroPresentation();
      return;
    }
    presentationExpectPlaying = false;
    clearPresentationResumeTimer();
    chapterPlayTarget.value = null;
    chapterAutoNext.value = false;

    // 编辑态循环：只循环「当前活动视频」，从该视频动画1播到末尾再重来
    if (!viewOnly.value && !isPreviewMode.value && isLooping.value) {
      const v = videoEl.value;
      if (v) {
        lastPresentationAutoSwitchChapterId = null;
        lastVideoPlaybackSyncTime = Number.POSITIVE_INFINITY;
        editPlaybackSyncElapsed = Number.POSITIVE_INFINITY;
        editPlaybackSyncChapterId = null;
        chAnimChapterId = null;
        // 严格取当前视频时间轴第一章，绝不回落到其它视频
        const headCh = timelineChapters.value[0] ?? null;
        if (headCh) {
          setEditModeActiveChapter(headCh);
          chapterPlayTarget.value = headCh;
        } else {
          chapterPlayTarget.value = null;
        }
        try {
          v.currentTime = 0;
        } catch {
          /* ignore */
        }
        currentTime.value = 0;
        isPlaying.value = true;
        if (headCh) {
          _chAnimLock = true;
          chAnimWallclock = false;
          chAnimChapterId = headCh.id;
          resyncChapterMeshFromVideo(v, headCh, 0);
        }
        void v.play().catch(() => undefined);
      }
      syncIntroPresentation();
      return;
    }

    isPlaying.value = false;
    editPlaybackSyncChapterId = null;
    editPlaybackSyncElapsed = -1;
    lastVideoPlaybackSyncTime = -1;
    stopChapterAnimation();
    syncCurrentChapterAnimationFromVideo();
    syncIntroPresentation();
  }

  function onVideoSeeked() {
    const v = videoEl.value;
    if (!v) return;
    if (viewOnly.value || isPreviewMode.value) {
      const requestTarget = presentationPlaybackSession.targetTime;
      if (canAdoptPresentationVideoTime(v, requestTarget)) {
        presentationPlaybackSession.committedTime = v.currentTime;
        presentationSeekTargetTime = null;
        if (presentationPlaybackSession.intent === "play" && !v.paused) {
          presentationPlaybackSession.phase = "playing";
        } else if (presentationPlaybackSession.intent === "pause") {
          presentationPlaybackSession.phase = "paused";
        }
      }
    }
    // 循环 seek 到 0 时可能仍 paused 一帧；只要 UI 认为在播就按真实时间重刷
    if (v.paused && !isPlaying.value && !presentationExpectPlaying) return;
    lastVideoPlaybackSyncTime = Number.POSITIVE_INFINITY;
    if (!v.paused) {
      syncVideoDrivenChapterMesh();
    } else {
      const ch = getPlaybackChapterAtTime(v.currentTime);
      if (ch) {
        chapterPlayTarget.value = ch;
        _chAnimLock = true;
        chAnimWallclock = false;
        resyncChapterMeshFromVideo(v, ch, getChapterAnimElapsed(ch, v.currentTime));
      }
    }
  }

  let ignoreVideoErrorUntil = 0;

  function onVideoErr() {
    if (performance.now() < ignoreVideoErrorUntil) return;
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

  function presentationFillScale(i: number) {
    const ch = presentationNavChapters.value[i];
    if (!ch || !duration.value) return 0;
    if (currentTime.value >= ch.endTime) return 1;
    if (currentTime.value > ch.startTime) return (currentTime.value - ch.startTime) / (ch.endTime - ch.startTime);
    return 0;
  }

  function presentationChapterSegmentFlex(ch: Chapter) {
    return chapterSegmentFlex(ch);
  }

  function uploadVideo(file: File) {
    if (!currProj.value) return false;
    ensureProjectNodes(currProj.value);
    let videoId = videoNodeUploadTargetId.value || activeVideoId.value;
    let video = videoId ? getNodeById(currProj.value.nodes, videoId) : null;
    if (!video || !isVideoNode(video)) {
      sceneNodeApi.addVideoNode();
      video = currProj.value.nodes.filter(isVideoNode).at(-1) ?? null;
      if (!video) return false;
      videoId = video.id;
    }
    activeVideoId.value = video.id;
    selectedNodeId.value = video.id;
    const url = URL.createObjectURL(file);
    sceneNodeApi.setVideoNodeInfo(video, url, 0, 0, 0);
    toastShow("视频已导入");
    syncVideoElementSrc(url);
    void tryLoadPendingModelSet();
    videoNodeUploadTargetId.value = null;
    return false;
  }

  function syncVideoAudioState() {
    const video = videoEl.value;
    if (!video) return;
    // 展示页保持静音，避免移动端/自动化环境丢失手势后无法 play。
    video.muted = viewOnly.value || isPreviewMode.value;
    video.volume = 1;
  }

  function resolveEffectiveVideoLoop() {
    // 与预览一致：不用原生 loop。编辑开启循环时由 onVideoEnd 回到 0 续播，位移跟 currentTime。
    return false;
  }

  function clearVideoElementSrc(options?: { silent?: boolean }) {
    const video = videoEl.value;
    if (!video) return;
    if (options?.silent !== false) {
      ignoreVideoErrorUntil = performance.now() + 800;
    }
    try {
      video.pause();
    } catch {
      /* ignore */
    }
    try {
      video.removeAttribute("src");
      delete video.dataset.editorSrc;
      delete video.dataset.editorSrcKey;
      delete video.dataset.editorReloading;
      video.load();
    } catch {
      /* ignore */
    }
  }

  function normalizePresentationVideoSrcKey(raw: string): string {
    const resolved = resolveAssetUrl(raw) || raw;
    try {
      const abs = new URL(resolved, window.location.href);
      abs.hash = "";
      return abs.href;
    } catch {
      return resolved;
    }
  }

  /** @returns true 表示重新绑定了媒体源并触发 load；false 表示同源复用，未重新加载 */
  function syncVideoElementSrc(src?: string): boolean {
    const raw = src || videoSrc.value;
    if (!raw) return false;

    // 已失效的 blob（刷新后或被存成 /blob:...）无法播放，提示重新上传
    if (isTransientMediaUrl(raw)) {
      const live = unwrapTransientMediaUrl(raw);
      if (!live || live.startsWith("data:")) {
        toastShow("视频地址已失效，请重新上传视频文件", "error");
        return false;
      }
      // blob: 仅当前页会话有效；若页面已刷新则 fetch 会失败，交给 error 处理
      const applyBlob = (): "missing" | "reused" | "rebound" => {
        if (!videoEl.value) return "missing";
        const video = videoEl.value;
        const key = normalizePresentationVideoSrcKey(live);
        if (
          video.dataset.editorSrcKey === key &&
          video.src &&
          !video.error &&
          video.readyState >= HTMLMediaElement.HAVE_METADATA
        ) {
          video.loop = resolveEffectiveVideoLoop();
          video.playbackRate = playbackRate.value;
          syncVideoAudioState();
          return "reused";
        }
        ignoreVideoErrorUntil = 0;
        video.dataset.editorSrc = live;
        video.dataset.editorSrcKey = key;
        video.preload = "metadata";
        video.removeAttribute("crossorigin");
        video.src = live;
        video.loop = resolveEffectiveVideoLoop();
        video.playbackRate = playbackRate.value;
        syncVideoAudioState();
        video.dataset.editorReloading = "1";
        video.load();
        return "rebound";
      };
      const blobResult = applyBlob();
      if (blobResult === "missing") {
        nextTick(() => applyBlob());
        return true;
      }
      return blobResult === "rebound";
    }

    const url = resolveAssetUrl(raw);
    if (!url) return false;
    const presentation = viewOnly.value || isPreviewMode.value;
    const resolvedUrl =
      presentation && isCoarsePointerDevice() ? url : isCoarsePointerDevice() ? withVideoPosterFragment(url) : url;
    const key = normalizePresentationVideoSrcKey(url);
    const apply = (): "missing" | "reused" | "rebound" => {
      if (!videoEl.value) return "missing";
      const video = videoEl.value;
      const currentKey =
        video.dataset.editorSrcKey ||
        (video.dataset.editorSrc ? normalizePresentationVideoSrcKey(video.dataset.editorSrc) : "");
      const currentSrcKey = video.currentSrc
        ? normalizePresentationVideoSrcKey(video.currentSrc)
        : video.src
          ? normalizePresentationVideoSrcKey(video.src)
          : "";
      // 同源（含不同视频节点但 url 相同）：只要已绑定成功就绝不改 src / load()。
      // 注意：重复赋值相同 src 在部分浏览器仍会触发重新加载，表现为切章/拖进度条闪刷新。
      if (
        !video.error &&
        video.getAttribute("src") &&
        (currentKey === key || currentSrcKey === key)
      ) {
        if (!video.dataset.editorSrcKey) video.dataset.editorSrcKey = key;
        if (!video.dataset.editorSrc) video.dataset.editorSrc = url;
        video.loop = resolveEffectiveVideoLoop();
        video.playbackRate = playbackRate.value;
        syncVideoAudioState();
        return "reused";
      }
      // 换源瞬间可能触发 error，短暂忽略
      ignoreVideoErrorUntil = performance.now() + 400;
      video.dataset.editorSrc = url;
      video.dataset.editorSrcKey = key;
      video.preload = presentation && isCoarsePointerDevice() ? "auto" : "metadata";
      video.src = resolvedUrl;
      // 同源 /editor-api 代理不需要 crossorigin，避免部分浏览器误判 CORS
      try {
        const abs = new URL(resolvedUrl, window.location.href);
        if (abs.origin !== window.location.origin) {
          video.setAttribute("crossorigin", "anonymous");
        } else {
          video.removeAttribute("crossorigin");
        }
      } catch {
        video.removeAttribute("crossorigin");
      }
      video.loop = resolveEffectiveVideoLoop();
      video.playbackRate = playbackRate.value;
      syncVideoAudioState();
      video.dataset.editorReloading = "1";
      if (!isCoarsePointerDevice() || presentation) video.load();
      return "rebound";
    };
    const result = apply();
    if (result === "missing") {
      nextTick(() => apply());
      return true;
    }
    return result === "rebound";
  }

  function removeVideo() {
    ElMessageBox.confirm("移除视频将清除所有节点数据和已导入的模型", "警告", { type: "warning" })
      .then(() => {
        // 1. 清除项目数据
        if (currProj.value) {
          const video = activeVideoNode.value;
          if (video) {
            video.videoSrc = null;
            video.videoDuration = 0;
            video.videoWidth = 0;
            video.videoHeight = 0;
            video.videoDisplayWidth = 0;
            currProj.value.nodes = currProj.value.nodes.filter(
              n => !(n.type === "animation" && n.parentId === video.id)
            );
          } else {
            currProj.value.nodes = [];
          }
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
        showVideoPip.value = false;
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
        mOutlineColor.value = DEFAULT_OUTLINE_COLOR;
        mWireColor.value = DEFAULT_WIREFRAME_COLOR;
        mHLColor.value = DEFAULT_MODEL_HIGHLIGHT_COLOR;
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
    if (!viewOnly.value && !isPreviewMode.value) {
      showTransientPlaybackHint(500);
      return;
    }
    showPresentationPlaybackHint();
  }

  function showTransientPlaybackHint(hideAfterMs = 500) {
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
    }, hideAfterMs);
  }

  /** 展示/预览页：移动端需用户手动播放，提示保持可见直至开始播放 */
  function showPresentationPlaybackHint() {
    playbackHintVisible.value = true;
    playbackHintFading.value = false;
    if (playbackHintTimer) clearTimeout(playbackHintTimer);
    if (playbackHintFadeTimer) clearTimeout(playbackHintFadeTimer);
    if (isCoarsePointerDevice()) return;
    playbackHintTimer = setTimeout(() => {
      playbackHintFading.value = true;
      playbackHintFadeTimer = setTimeout(() => {
        playbackHintVisible.value = false;
        playbackHintFading.value = false;
      }, 300);
    }, 2500);
  }

  function primePresentationVideoElement(video: HTMLVideoElement) {
    if (video.readyState >= HTMLMediaElement.HAVE_METADATA) return;
    try {
      video.load();
    } catch {
      /* ignore */
    }
  }

  function syncPresentationVideoTimeToChapter(video: HTMLVideoElement, chapter: Chapter) {
    const navChapter = resolvePresentationNavChapter(chapter);
    const target = navChapter.startTime;
    if (isPresentationNavChapterAtTime(navChapter, video.currentTime)) return;
    if (video.currentTime > navChapter.endTime + CHAPTER_END_EPS) return;
    try {
      video.currentTime = target;
      currentTime.value = video.currentTime;
    } catch {
      /* ignore */
    }
  }

  function togglePlay() {
    const video = videoEl.value;
    if (!video) return;
    if (viewOnly.value || isPreviewMode.value) {
      const pauseRequested = presentationDisplayPlaying.value;
      let targetTime = presentationDisplayTime.value;
      let navChapter = presentationPlaybackSession.navChapterId
        ? getPresentationNavChapters().find(
            ch => ch.id === presentationPlaybackSession.navChapterId
          ) ?? null
        : getPresentationChapterAtVideoTime(targetTime);
      const atMediaEnd =
        presentationPlaybackSession.phase === "ended" ||
        video.ended ||
        isPresentationAtMediaEnd(video);
      // 片尾再播：必须从第一导航章起点重来，不能用「最后一章 startTime」(常接近片尾)。
      if (!pauseRequested && atMediaEnd) {
        navChapter = getPresentationNavChapters()[0] ?? null;
        targetTime = navChapter?.startTime ?? 0;
      }
      commandPresentationPlayback({
        targetTime,
        intent: pauseRequested ? "pause" : "play",
        navChapter,
        autoAdvance: !pauseRequested
      });
      return;
    }
    if (video.paused) {
      chapterPlayTarget.value = null;
      if (video.ended || video.currentTime >= Math.max((duration.value || video.duration || 0) - CHAPTER_END_EPS, 0)) {
        const ci = findChIdx(video.currentTime);
        const resumeChapter = ci >= 0 ? timelineChapters.value[ci] : timelineChapters.value[0];
        const resumeAt = resumeChapter?.startTime ?? 0;
        try {
          video.currentTime = Math.max(0, resumeAt);
          currentTime.value = video.currentTime;
        } catch {
          /* ignore */
        }
      }
      void video.play().catch(() => {
        void waitForVideoReady().then(ok => {
          if (!ok || !videoEl.value) return;
          void videoEl.value.play().catch(() => {});
        });
      });
    } else {
      video.pause();
      chapterPlayTarget.value = null;
      syncCurrentChapterAnimationFromVideo();
    }
    showPlaybackHint();
  }

  function onVideoPlay() {
    if (viewOnly.value || isPreviewMode.value) {
      // Observe only. A stale play event cannot change the latest pause intent.
      if (presentationPlaybackSession.intent === "pause") return;
      const video = videoEl.value;
      if (
        video &&
        canAdoptPresentationVideoTime(video, presentationPlaybackSession.targetTime)
      ) {
        presentationPlaybackSession.committedTime = video.currentTime;
        presentationSeekTargetTime = null;
        presentationPlaybackSession.phase = "playing";
      }
    }
    isPlaying.value = true;
    playbackHintVisible.value = false;
    playbackHintFading.value = false;
    if (viewOnly.value || isPreviewMode.value) {
      presentationExpectPlaying = true;
    }
    const video = videoEl.value;
    const ch = video ? getPlaybackChapterAtTime(video.currentTime) : null;
    if (!viewOnly.value && !isPreviewMode.value) {
      // 编辑态：开播即对齐当前动画运镜（不依赖下一次 timeupdate）
      if (ch && editPlaybackCameraChapterId !== ch.id) {
        editPlaybackCameraChapterId = ch.id;
        applyChapterCameraForNav(ch, "playback");
      }
      if (ch && (chapterHasAnimation(ch) || chapterHasAnyModelEdits(ch))) {
        ensureVideoSyncedChapterAnimation();
      }
    } else if (ch && chapterHasAnimation(ch)) {
      ensureVideoSyncedChapterAnimation();
    }
    syncIntroPresentation();
    syncComposerMsaaSamples();
  }

  function onVideoPause() {
    if (viewOnly.value || isPreviewMode.value) {
      // Seek/transition pauses are media noise, not user intent or a blocked autoplay.
      if (
        presentationChapterTransition ||
        videoChapterSyncPaused ||
        presentationPlaybackSession.phase === "seeking"
      ) {
        return;
      }
      const video = videoEl.value;
      if (video && (video.ended || isPresentationAtMediaEnd(video))) {
        if (isStalePresentationMediaEnd(video)) {
          syncPresentationUiFromTimeline(presentationDisplayTime.value);
          return;
        }
        // 片尾 pause：若仍是播放意图则循环，禁止把 intent 改成 pause（会导致轮播几次后卡死）。
        if (
          presentationPlaybackSession.intent === "play" &&
          !presentationUserWantsPaused
        ) {
          loopPresentationPlaybackFromStart();
          return;
        }
        presentationPlaybackSession.phase = "ended";
        presentationPlaybackSession.intent = "pause";
        presentationPlaybackSession.committedTime = video.currentTime;
        presentationPlaybackSession.targetTime = video.currentTime;
      } else if (
        presentationPlaybackSession.intent === "play" &&
        !presentationUserWantsPaused &&
        video?.paused
      ) {
        presentationPlaybackSession.phase = "blocked";
        void recoverPresentationPlaybackAfterUnexpectedPause();
      } else if (presentationPlaybackSession.intent === "pause") {
        presentationPlaybackSession.phase = "paused";
        if (video && canAdoptPresentationVideoTime(video, presentationPlaybackSession.targetTime)) {
          presentationPlaybackSession.committedTime = video.currentTime;
        }
      }
      syncPresentationUiFromTimeline(presentationDisplayTime.value);
      return;
    }
    if (presentationChapterTransition || videoChapterSyncPaused) {
      return;
    }
    // 循环开启时，播到片尾会先触发 pause 再 ended；勿清锁
    if (!viewOnly.value && !isPreviewMode.value && isLooping.value) {
      const v = videoEl.value;
      const dur = v?.duration || 0;
      if (v && (v.ended || (dur > 0 && v.currentTime >= dur - 0.08))) {
        return;
      }
    }
    isPlaying.value = false;
    stopChapterAnimation();
    // 编辑态停播：清 playTarget，并回到当前章起始帧预览。
    // 若仍按 video.currentTime 套结束位移，再切动画/点选子模型会把错误姿态写进编辑态。
    if (!viewOnly.value && !isPreviewMode.value) {
      chapterPlayTarget.value = null;
      const ch =
        selectedChapter.value ??
        (videoEl.value ? getPlaybackChapterAtTime(videoEl.value.currentTime) : null);
      if (ch) {
        applyChapterEditorVisualState(ch);
      } else {
        resetAllModelsToDefault();
      }
    } else {
      syncCurrentChapterAnimationFromVideo();
      syncPresentationUiFromTimeline(resolvePresentationPlaybackTime());
    }
    syncIntroPresentation();
    syncComposerMsaaSamples();
  }

  function cyclePlaybackRate() {
    const idx = PLAYBACK_RATES.indexOf(playbackRate.value as (typeof PLAYBACK_RATES)[number]);
    playbackRate.value = PLAYBACK_RATES[(idx + 1) % PLAYBACK_RATES.length];
    if (videoEl.value) videoEl.value.playbackRate = playbackRate.value;
  }

  // ── Animation Helpers (运动段) ──

  function usesRelativeAnimRotation(obj: THREE.Object3D | null | undefined): boolean {
    return !!(obj && obj.userData?.nodeId);
  }

  function getRestRotDegForObject(obj: THREE.Object3D): [number, number, number] {
    const br = obj.userData.baseLocalRot || [0, 0, 0];
    return [
      roundAnimNum((br[0] * 180) / Math.PI),
      roundAnimNum((br[1] * 180) / Math.PI),
      roundAnimNum((br[2] * 180) / Math.PI)
    ];
  }

  /** 子节点动画旋转存相对值（0=模型初始姿态）；应用到 mesh 时叠加 rest */
  function animRotToAbsolute(obj: THREE.Object3D, rotDeg: number[]): number[] {
    if (!usesRelativeAnimRotation(obj)) return rotDeg.map(n => roundAnimNum(n));
    const rest = getRestRotDegForObject(obj);
    return rotDeg.map((v, i) => roundAnimNum(v + rest[i]));
  }

  function animRotFromAbsolute(obj: THREE.Object3D, rotDeg: number[]): number[] {
    if (!usesRelativeAnimRotation(obj)) return rotDeg.map(n => roundAnimNum(n));
    const rest = getRestRotDegForObject(obj);
    return rotDeg.map((v, i) => roundAnimNum(v - rest[i]));
  }

  function isLikelyAbsoluteStoredAnimRot(obj: THREE.Object3D, rotDeg: number[]): boolean {
    if (!usesRelativeAnimRotation(obj)) return true;
    if (rotDeg.every(v => Math.abs(v) < 2)) return false;
    const rest = getRestRotDegForObject(obj);
    if (rotDeg.every((v, i) => Math.abs(v - rest[i]) < 2)) return true;
    return rotDeg.some(v => Math.abs(v) > 45);
  }

  function normalizeStoredAnimRotForEditor(
    obj: THREE.Object3D | null,
    rotDeg: number[],
    _allowLegacyAbsolute = false
  ): number[] {
    // 子节点动画旋转统一按相对值读写（0 = GLB 初始姿态）
    return rotDeg.map(n => roundAnimNum(n));
  }

  function getRestLocalPosForObject(obj: THREE.Object3D): [number, number, number] {
    const bp = obj.userData.baseLocalPos || [0, 0, 0];
    return [roundAnimNum(bp[0]), roundAnimNum(bp[1]), roundAnimNum(bp[2])];
  }

  function animPosToAbsolute(obj: THREE.Object3D, pos: number[]): number[] {
    if (!usesRelativeAnimRotation(obj)) return pos.map(n => roundAnimNum(n));
    const rest = getRestLocalPosForObject(obj);
    return pos.map((v, i) => roundAnimNum(v + rest[i]));
  }

  function animPosFromAbsolute(obj: THREE.Object3D, pos: number[]): number[] {
    if (!usesRelativeAnimRotation(obj)) return pos.map(n => roundAnimNum(n));
    const rest = getRestLocalPosForObject(obj);
    return pos.map((v, i) => roundAnimNum(v - rest[i]));
  }

  function normalizeStoredAnimPosForEditor(obj: THREE.Object3D | null, pos: number[]): number[] {
    return pos.map(n => roundAnimNum(n));
  }

  function normalizeAnimSegmentTransformForEditor(
    model: Model,
    nodeId: string | null,
    seg: any,
    storedAsRelative = false
  ) {
    const obj = getTransformTarget(model.id, nodeId);
    if (!obj) return;
    // 旧数据：相对值存储 → 先转绝对再转编辑器相对值
    if (storedAsRelative || (seg as any)._relativeTransform) {
      seg.startPos = animPosToAbsolute(obj, seg.startPos || [0, 0, 0]);
      seg.endPos = animPosToAbsolute(obj, seg.endPos || [0, 0, 0]);
      seg.startRot = animRotToAbsolute(obj, seg.startRot || [0, 0, 0]);
      seg.endRot = animRotToAbsolute(obj, seg.endRot || [0, 0, 0]);
      delete (seg as any)._relativeTransform;
    }
    // 章节内绝对值 → 编辑器相对值（0 = GLB 初始姿态）
    if (usesRelativeAnimRotation(obj)) {
      seg.startPos = animPosFromAbsolute(obj, seg.startPos || [0, 0, 0]);
      seg.endPos = animPosFromAbsolute(obj, seg.endPos || [0, 0, 0]);
      seg.startRot = animRotFromAbsolute(obj, seg.startRot || [0, 0, 0]);
      seg.endRot = animRotFromAbsolute(obj, seg.endRot || [0, 0, 0]);
    }
    seg.startPos = (seg.startPos || [0, 0, 0]).map((n: number) => roundAnimNum(n));
    seg.endPos = (seg.endPos || [0, 0, 0]).map((n: number) => roundAnimNum(n));
    seg.startRot = (seg.startRot || [0, 0, 0]).map((n: number) => roundAnimNum(n));
    seg.endRot = (seg.endRot || [0, 0, 0]).map((n: number) => roundAnimNum(n));
  }

  /** chapter.modelConfigs 内动画段默认绝对坐标；仅旧数据 relativeTransform 时先转绝对 */
  function cloneStoredAnimSegmentForPlayback(obj: THREE.Object3D, seg: any, animConfig?: { relativeTransform?: boolean }) {
    const asRelative =
      !!(animConfig as any)?.relativeTransform || !!(seg as any)._relativeTransform;
    if (asRelative && usesRelativeAnimRotation(obj)) {
      return cloneAnimSegmentForApply(obj, seg);
    }
    return cloneStoredAnimSegmentForApply(seg);
  }

  function cloneAnimSegmentForApply(obj: THREE.Object3D, seg: any) {
    let startPos = [...(seg.startPos || [0, 0, 0])];
    let endPos = [...(seg.endPos || [0, 0, 0])];
    let startRot = [...(seg.startRot || [0, 0, 0])];
    let endRot = [...(seg.endRot || [0, 0, 0])];
    if (usesRelativeAnimRotation(obj)) {
      startPos = animPosToAbsolute(obj, startPos);
      endPos = animPosToAbsolute(obj, endPos);
      startRot = animRotToAbsolute(obj, startRot);
      endRot = animRotToAbsolute(obj, endRot);
    }
    const {
      _animPivotCache: _dropPivot,
      _playing: _dropPlaying,
      _progress: _dropProgress,
      _expandedPanels: _dropPanels,
      ...rest
    } = seg;
    return {
      ...rest,
      startPos,
      endPos,
      startRot,
      endRot,
      _applyAsAbsolute: true
    };
  }

  /** chapter.modelConfigs 内动画段已是绝对坐标，勿再做相对→绝对转换 */
  function cloneStoredAnimSegmentForApply(seg: any) {
    const {
      _animPivotCache: _dropPivot,
      _playing: _dropPlaying,
      _progress: _dropProgress,
      _expandedPanels: _dropPanels,
      ...rest
    } = seg;
    return {
      ...rest,
      startPos: [...(seg.startPos || [0, 0, 0])],
      endPos: [...(seg.endPos || [0, 0, 0])],
      startRot: [...(seg.startRot || [0, 0, 0])],
      endRot: [...(seg.endRot || [0, 0, 0])],
      _applyAsAbsolute: true
    };
  }

  function segRotForPivotApply(mesh: THREE.Object3D, seg: any, key: "startRot" | "endRot"): number[] {
    const rot = [...(seg[key] || [0, 0, 0])];
    if (seg._applyAsAbsolute || !usesRelativeAnimRotation(mesh)) return rot;
    return animRotToAbsolute(mesh, rot);
  }

  function resolveAnimPreviewMode(seg: any, model: Model, nodeId: string | null): "start" | "end" {
    return animSegmentDiffersFromDefault(seg, model, nodeId) ? "end" : "start";
  }

  /** 编辑态暂停时默认展示起始帧；仅当前选中且正在编辑结束帧时才用 end。
   *  绝不能在 isChapterPlaybackActive 时套 end —— 播放锁/切选中会把子模型打到结束位移。 */
  function resolveMeshAnimDisplayMode(
    model: Model,
    nodeId: string | null,
    seg: any,
    _resolvedMode: "start" | "end"
  ): "start" | "end" {
    const isLiveEndEdit =
      !viewOnly.value &&
      !isPreviewMode.value &&
      !isEditVideoMeshSyncActive() &&
      selModelId.value === model.id &&
      (selModelNodeId.value ?? null) === (nodeId ?? null) &&
      editingSeg.value === seg &&
      editingSegMode.value === "end";
    return isLiveEndEdit ? "end" : "start";
  }

  /** 读取 mesh 当前绝对变换作为动画段默认值 */
  function readMeshAnimTransform(mesh: THREE.Object3D) {
    return {
      pos: [round3(mesh.position.x), round3(mesh.position.y), round3(mesh.position.z)] as [number, number, number],
      rot: [
        round3((mesh.rotation.x * 180) / Math.PI),
        round3((mesh.rotation.y * 180) / Math.PI),
        round3((mesh.rotation.z * 180) / Math.PI)
      ] as [number, number, number],
      scale: round3(mesh.scale.x)
    };
  }

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
    const bs = o.userData.baseLocalScale ?? 1;
    return {
      pos: [0, 0, 0],
      scale: roundAnimNum(bs),
      rot: [0, 0, 0]
    };
  }

  function selectionHasStoredAnimConfig(ch: Chapter | null | undefined, modelId: string, nodeId: string | null): boolean {
    if (!ch) return false;
    const cfg = readModelConfigForTarget(ch, modelId, nodeId);
    return !!(cfg.animConfig?.segments?.length);
  }

  function bootstrapAnimSegmentFromMesh(seg: any, model: Model, nodeId: string | null) {
    const mesh = getTransformTarget(model.id, nodeId);
    if (!mesh) return;
    syncSegToMesh(seg, mesh);
  }

  /** 未保存配置的节点：动画段使用模型初始相对变换，不读 mesh（避免上一节点残留） */
  function applyDefaultTransformToAnimSegment(
    seg: any,
    model: Model,
    nodeId: string | null,
    mode?: "start" | "end"
  ) {
    const { pos, scale, rot } = getDefaultTransformForAnimTarget(model, nodeId);
    if (mode === "start") {
      seg.startPos = [...pos];
      seg.startRot = [...rot];
      seg.startScale = scale;
    } else if (mode === "end") {
      seg.endPos = [...pos];
      seg.endRot = [...rot];
      seg.endScale = scale;
    } else {
      seg.startPos = [...pos];
      seg.endPos = [...pos];
      seg.startRot = [...rot];
      seg.endRot = [...rot];
      seg.startScale = scale;
      seg.endScale = scale;
    }
    invalidateSegPivotCache(seg);
    bumpAnimSegmentRevision();
  }

  function seedPristineAnimSegmentFromDefaults(seg: any, model: Model, nodeId: string | null) {
    applyDefaultTransformToAnimSegment(seg, model, nodeId);
  }

  /** 动画段与 mesh 偏差过大时，以 mesh 当前绝对坐标为准（避免旋转时模型飞走） */
  function ensureSegModeSyncedWithMesh(seg: any, mesh: THREE.Object3D, mode: "start" | "end") {
    const posKey = mode === "start" ? "startPos" : "endPos";
    const rotKey = mode === "start" ? "startRot" : "endRot";
    const meshT = readMeshAnimTransform(mesh);
    const meshPos = usesRelativeAnimRotation(mesh)
      ? animPosFromAbsolute(mesh, meshT.pos)
      : meshT.pos;
    const meshRot = usesRelativeAnimRotation(mesh)
      ? animRotFromAbsolute(mesh, meshT.rot)
      : meshT.rot;
    const segPos = seg[posKey] || [0, 0, 0];
    const segRot = seg[rotKey] || [0, 0, 0];
    const posOff = segPos.some((v: number, i: number) => Math.abs(v - meshPos[i]) > 0.02);
    const rotOff = segRot.some((v: number, i: number) => Math.abs(v - meshRot[i]) > 0.5);
    if (posOff || rotOff) syncSegToMesh(seg, mesh, mode);
  }

  function createDefaultAnimSegment(model?: Model | null, nodeId?: string | null) {
    const m = model ?? selModel.value;
    const nid = nodeId !== undefined ? nodeId : selModelNodeId.value;
    const { pos, scale, rot } = m
      ? getDefaultTransformForAnimTarget(m, nid)
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

  function buildDefaultAnimSegmentSnapshot(model: Model, nodeId: string | null) {
    const { pos, scale, rot } = getDefaultTransformForAnimTarget(model, nodeId);
    return {
      startPos: pos.map(n => roundAnimNum(n)),
      endPos: pos.map(n => roundAnimNum(n)),
      startRot: rot.map(n => roundAnimNum(n)),
      endRot: rot.map(n => roundAnimNum(n)),
      startScale: roundAnimNum(scale),
      endScale: roundAnimNum(scale)
    };
  }

  /** 相对模型初始姿态比较：子节点默认局部坐标非零，不能按绝对零判断 */
  function animSegmentDiffersFromDefault(
    seg: any,
    model: Model | null | undefined,
    nodeId: string | null
  ): boolean {
    if (!seg || !model) return false;
    const def = buildDefaultAnimSegmentSnapshot(model, nodeId);
    const normVec = (a: number[] = [0, 0, 0], b: number[] = [0, 0, 0]) =>
      a.length === 3 && b.length === 3 && a.every((v, i) => Math.abs(v - b[i]) <= 1e-3);
    if (!normVec(seg.startPos, def.startPos) || !normVec(seg.endPos, def.endPos)) return true;
    if (!normVec(seg.startRot, def.startRot) || !normVec(seg.endRot, def.endRot)) return true;
    if (Math.abs((seg.startScale ?? 1) - def.startScale) > 1e-3) return true;
    if (Math.abs((seg.endScale ?? 1) - def.endScale) > 1e-3) return true;
    if (!normVec(seg.startPos, seg.endPos) || !normVec(seg.startRot, seg.endRot)) return true;
    if (Math.abs((seg.startScale ?? 1) - (seg.endScale ?? 1)) > 1e-3) return true;
    return false;
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
    bindAnimSegmentsToSelection(model?.id ?? selModelId.value, selModelNodeId.value, selectedChapterId.value);
    recalcAnimDuration();
  }

  function resolvePlaybackSegments(segments: any[]) {
    return segments?.length ? segments : [];
  }

  function markAnimDirty() {
    animDirty.value = true;
    bindAnimSegmentsToSelection(undefined, undefined, selectedChapterId.value);
  }

  function resetAnimConfig() {
    if (!selModel.value) return;
    animSegments.splice(0, animSegments.length, createDefaultAnimSegment(selModel.value));
    animDuration.value = 3;
    animEasing.value = "easeInOut";
    animDirty.value = true;
    modelFormRevision.value++;
    if (animSegments[0]) focusSegTransform(animSegments[0], "start");
  }

  function recalcAnimDuration() {
    let total = 0;
    for (let s = 0; s < animSegments.length; s++) {
      total += (animSegments[s].pauseTime || 0) + (animSegments[s].animTime || 3);
    }
    if (total > 0) animDuration.value = total;
  }
  function persistAnimConfigToChapterFor(
    ch: Chapter,
    modelId?: string,
    nodeId?: string | null,
    segments?: any[],
    opts?: { duration?: number; easing?: string }
  ) {
    const mid = modelId ?? selModel.value?.id;
    const nid = nodeId !== undefined ? nodeId : selModelNodeId.value;
    const segs = segments ?? animSegments;
    if (!mid || segs.length === 0) return;
    const cfg = getWritableModelConfigForTarget(ch, mid, nid ?? null);
    if (mid === selModel.value?.id && (nid ?? null) === (selModelNodeId.value ?? null)) {
      recalcAnimDuration();
    }
    const duration = opts?.duration ?? animDuration.value;
    const easing = opts?.easing ?? animEasing.value;
    const model = models.value.find(m => m.id === mid);
    cfg.animConfig = {
      duration,
      easing,
      relativeTransform: false,
      segments: segs.map(s => {
        const startPos = [...(s.startPos || [0, 0, 0])];
        const endPos = [...(s.endPos || [0, 0, 0])];
        const startRot = [...(s.startRot || [0, 0, 0])];
        const endRot = [...(s.endRot || [0, 0, 0])];
        const obj = model ? getTransformTarget(model.id, nid ?? null) : null;
        if (obj && usesRelativeAnimRotation(obj)) {
          return {
            id: s.id,
            pauseTime: s.pauseTime || 0,
            animTime: s.animTime || 3,
            easing: s.easing || animEasing.value,
            pivot: s.pivot || "center",
            startPos: animPosToAbsolute(obj, startPos).map(n => round3(n)),
            endPos: animPosToAbsolute(obj, endPos).map(n => round3(n)),
            startScale: s.startScale,
            endScale: s.endScale,
            startRot: animRotToAbsolute(obj, startRot).map(n => round3(n)),
            endRot: animRotToAbsolute(obj, endRot).map(n => round3(n))
          };
        }
        return {
          id: s.id,
          pauseTime: s.pauseTime || 0,
          animTime: s.animTime || 3,
          easing: s.easing || animEasing.value,
          pivot: s.pivot || "center",
          startPos: startPos.map((n: number) => round3(n)),
          endPos: endPos.map((n: number) => round3(n)),
          startScale: s.startScale,
          endScale: s.endScale,
          startRot: startRot.map((n: number) => round3(n)),
          endRot: endRot.map((n: number) => round3(n))
        };
      })
    } as any;
    cfg.animation = true;
    if (mid === selModel.value?.id && (nid ?? null) === (selModelNodeId.value ?? null)) {
      mAni.value = true;
      animDirty.value = false;
    }
    invalidateChapterAnimTargetsCache(ch.id);
  }

  function persistAnimConfigToChapter() {
    if (!selectedChapter.value) return;
    persistAnimConfigToChapterFor(selectedChapter.value);
  }

  function saveAnimConfig() {
    if (!selectedChapter.value || !selModel.value) return;
    const ch = selectedChapter.value;
    const mid = selModel.value.id;
    const nid = selModelNodeId.value;

    // live 段不属于当前章节时拒绝写入，防止串到其它动画节点
    if (animSegments.length > 0 && !animSegmentsBelongToChapter(ch.id)) {
      toastShow("当前动画段不属于该节点，请重新选中子物体后再保存", "warning");
      return;
    }
    bindAnimSegmentsToSelection(mid, nid, ch.id);
    persistAnimConfigToChapterFor(ch, mid, nid, animSegments);
    animDirty.value = false;

    // 同步会话缓存（已保存、未脏），切换模型后可直接恢复
    selectionEditDrafts.set(selectionDraftKey(ch.id, mid, nid), {
      animSegments: cloneAnimSegmentsForDraft(animSegments),
      animDuration: animDuration.value,
      animEasing: animEasing.value,
      animDirty: false,
      form: { ...getModelFormSnapshot() }
    });

    const seg = animSegments[0];
    if (seg) {
      applyAnimSegmentTransformToMesh(
        selModel.value,
        nid,
        seg,
        resolveAnimPreviewMode(seg, selModel.value, nid)
      );
    }
    bumpAnimSegmentRevision();
    toastShow(nid ? "子层级动画已保存" : "动画已保存");
  }

  function refreshActiveHighlightOutline() {
    const m = selModel.value;
    const ch = getActiveChapter();
    if (!m || !ch) return;
    const cfg = readActiveModelConfig(ch);
    if (!cfg.highlight && !cfg.outline && !cfg.wireframe) {
      // live 开关也可能刚打开但尚未写入章节
      if (!mHL.value && !mOut.value && !mWire.value) return;
    }
    const liveCfg = {
      ...createDefaultModelConfig(),
      ...cfg,
      highlight: mHL.value,
      outline: mOut.value,
      wireframe: mWire.value,
      outlineColor: mOutlineColor.value,
      wireframeColor: mWireColor.value,
      modelHighlightColor: mHLColor.value
    };
    for (const target of getNodeObjects(m.id, selModelNodeId.value, true)) {
      rebuildOutlineForObject(m, target, liveCfg);
    }
  }

  function playSegOnce(seg: any) {
    if (seg._playing) return;
    stopSegmentPlayback();
    const playbackGen = segmentPlaybackGeneration;
    seg._playing = true;
    activeSegmentPlaybackSeg = seg;
    seg._progress = 0;
    const m = selModel.value;
    if (!m) {
      seg._playing = false;
      activeSegmentPlaybackSeg = null;
      return;
    }
    refreshActiveHighlightOutline();
    const objs = getNodeObjects(m.id, selModelNodeId.value);
    if (!objs.length) {
      seg._playing = false;
      activeSegmentPlaybackSeg = null;
      return;
    }
    // 子节点 segment 存相对值，播放时先转绝对坐标再插值
    const absStart = segModeToAbsoluteTransform(m, selModelNodeId.value, seg, "start");
    const absEnd = segModeToAbsoluteTransform(m, selModelNodeId.value, seg, "end");
    const sp = { x: absStart.pos[0], y: absStart.pos[1], z: absStart.pos[2] };
    const ss = seg.startScale;
    const sr = { x: absStart.rot[0], y: absStart.rot[1], z: absStart.rot[2] };
    const ep = { x: absEnd.pos[0], y: absEnd.pos[1], z: absEnd.pos[2] };
    const es = seg.endScale;
    const er = { x: absEnd.rot[0], y: absEnd.rot[1], z: absEnd.rot[2] };
    const dur = (seg.animTime || 3) * 1000;
    const easingType = seg.easing || animEasing.value;
    invalidateSegPivotCache(seg);
    for (const o of objs) getSegPivotCache(seg, o);
    const st = performance.now();
    function tick() {
      if (playbackGen !== segmentPlaybackGeneration) {
        seg._playing = false;
        return;
      }
      try {
        const el = performance.now() - st;
        const t = Math.min(el / dur, 1);
        seg._progress = t;
        const ep2 = applyEasingInline(t, easingType);
        const midPos = [sp.x + (ep.x - sp.x) * ep2, sp.y + (ep.y - sp.y) * ep2, sp.z + (ep.z - sp.z) * ep2];
        const midRot = [sr.x + (er.x - sr.x) * ep2, sr.y + (er.y - sr.y) * ep2, sr.z + (er.z - sr.z) * ep2];
        for (const o of objs) {
          applyPivotPathFrame(o, midPos, midRot, seg._animPivotCache, ep2);
          o.scale.setScalar(ss + (es - ss) * ep2);
        }
        syncTransformVisualOverlays();
        if (t >= 1) {
          seg._progress = 1;
          seg._playing = false;
          activeSegmentPlaybackSeg = null;
          segmentPlaybackRafId = null;
          liveSeg(seg, editingSegMode.value);
          return;
        }
      } catch {
        seg._playing = false;
        activeSegmentPlaybackSeg = null;
        segmentPlaybackRafId = null;
        return;
      }
      segmentPlaybackRafId = requestAnimationFrame(tick);
    }
    tick();
  }
  function invalidateSegPivotCache(seg: any) {
    delete seg._animPivotCache;
  }

  function invalidateAnimPivotCachesInConfig(cfg: ModelConfig) {
    const segs = cfg.animConfig?.segments;
    if (segs) {
      for (const seg of segs as any[]) invalidateSegPivotCache(seg);
    }
    if (cfg.nodeConfigs) {
      for (const nodeCfg of Object.values(cfg.nodeConfigs)) {
        invalidateAnimPivotCachesInConfig(nodeCfg as ModelConfig);
      }
    }
  }

  function invalidateChapterAnimPivotCaches(ch?: Chapter | null) {
    for (const seg of animSegments) invalidateSegPivotCache(seg);
    const chapter = ch ?? getActiveChapter();
    if (!chapter?.modelConfigs) return;
    for (const cfg of Object.values(chapter.modelConfigs)) {
      invalidateAnimPivotCachesInConfig(cfg as ModelConfig);
    }
  }

  function stopSegmentPlayback() {
    segmentPlaybackGeneration++;
    if (segmentPlaybackRafId !== null) {
      cancelAnimationFrame(segmentPlaybackRafId);
      segmentPlaybackRafId = null;
    }
    if (activeSegmentPlaybackSeg) {
      activeSegmentPlaybackSeg._playing = false;
      activeSegmentPlaybackSeg = null;
    }
    totalPlaying.value = false;
  }
  function getSegPivotCache(seg: any, mesh: THREE.Object3D): any {
    const pivot = seg.pivot || "center";
    if (seg._animPivotCache && seg._animPivotCache.pivot === pivot) return seg._animPivotCache;
    if (pivot === "center") {
      seg._animPivotCache = { center: true, pivot };
      return seg._animPivotCache;
    }
    const L = getPivotPointLocal(mesh, pivot);
    const absStart = segRotForPivotApply(mesh, seg, "startRot");
    const absEnd = segRotForPivotApply(mesh, seg, "endRot");
    const sRad = [(absStart[0] * Math.PI) / 180, (absStart[1] * Math.PI) / 180, (absStart[2] * Math.PI) / 180];
    const eRad = [(absEnd[0] * Math.PI) / 180, (absEnd[1] * Math.PI) / 180, (absEnd[2] * Math.PI) / 180];
    const sq_ = new THREE.Quaternion().setFromEuler(new THREE.Euler(sRad[0], sRad[1], sRad[2], "XYZ"));
    const eq_ = new THREE.Quaternion().setFromEuler(new THREE.Euler(eRad[0], eRad[1], eRad[2], "XYZ"));
    const startScale = seg.startScale ?? 1;
    const endScale = seg.endScale ?? 1;
    seg._animPivotCache = {
      pivot,
      L: L.clone(),
      startScale,
      endScale,
      startOffset: pivotOffsetVector(L, sq_, startScale),
      endOffset: pivotOffsetVector(L, eq_, endScale)
    };
    return seg._animPivotCache;
  }
  function applyPivotPathFrame(o: any, midPos: number[], midRot: number[], pivotCache: any, ep2: number) {
    if (!pivotCache || pivotCache.center) {
      applyPivotRotation(o, midPos, midRot, "center");
      return;
    }
    const rad = [(midRot[0] * Math.PI) / 180, (midRot[1] * Math.PI) / 180, (midRot[2] * Math.PI) / 180];
    const cq = new THREE.Quaternion().setFromEuler(new THREE.Euler(rad[0], rad[1], rad[2], "XYZ"));
    const startScale = pivotCache.startScale ?? pivotCache.scale ?? 1;
    const endScale = pivotCache.endScale ?? pivotCache.scale ?? 1;
    const scale = startScale + (endScale - startScale) * ep2;
    const curOff = pivotCache.L.clone().multiplyScalar(scale).applyQuaternion(cq);
    const interpOff = new THREE.Vector3().copy(pivotCache.startOffset).lerp(pivotCache.endOffset, ep2);
    o.position.set(
      midPos[0] + interpOff.x - curOff.x,
      midPos[1] + interpOff.y - curOff.y,
      midPos[2] + interpOff.z - curOff.z
    );
    o.quaternion.copy(cq);
    o.rotation.set(rad[0], rad[1], rad[2], "XYZ");
  }
  function playAllSegments() {
    if (totalPlaying.value) return;
    stopSegmentPlayback();
    const playbackGen = segmentPlaybackGeneration;
    totalPlaying.value = true;
    totalProgress.value = 0;
    let totalDur = 0;
    const times: number[] = [];
    for (let s = 0; s < animSegments.length; s++) {
      totalDur += (animSegments[s].pauseTime || 0) + (animSegments[s].animTime || 3);
      times.push(totalDur);
    }
    const m = selModel.value;
    if (!m) {
      totalPlaying.value = false;
      return;
    }
    refreshActiveHighlightOutline();
    const objs = getNodeObjects(m.id, selModelNodeId.value);
    if (!objs.length) {
      totalPlaying.value = false;
      return;
    }
    // Set initial position to first seg start
    const first = animSegments[0];
    const firstAbsStart = segModeToAbsoluteTransform(m, selModelNodeId.value, first, "start");
    invalidateSegPivotCache(first);
    for (const o of objs) {
      getSegPivotCache(first, o);
      applyPivotPathFrame(o, firstAbsStart.pos, firstAbsStart.rot, first._animPivotCache, 0);
      o.scale.setScalar(first.startScale);
    }
    // Pre-compute pivot cache for all segments
    for (let si = 0; si < animSegments.length; si++) {
      for (const o of objs) getSegPivotCache(animSegments[si], o);
    }
    const st = performance.now();
    function tick() {
      if (playbackGen !== segmentPlaybackGeneration) {
        totalPlaying.value = false;
        return;
      }
      const el = performance.now() - st;
      const t = Math.min(el / (totalDur * 1000), 1);
      const absT = t * totalDur;
      let cumT = 0;
      for (let s = 0; s < animSegments.length; s++) {
        const seg = animSegments[s];
        let segTotal = (seg.pauseTime || 0) + (seg.animTime || 3);
        if (absT >= cumT && absT <= cumT + segTotal) {
          const localT = absT - cumT;
          const pauseT = seg.pauseTime || 0;
          const pc = seg._animPivotCache;
          const absStart = segModeToAbsoluteTransform(m, selModelNodeId.value, seg, "start");
          const absEnd = segModeToAbsoluteTransform(m, selModelNodeId.value, seg, "end");
          for (const o of objs) {
            if (localT < pauseT) {
              applyPivotPathFrame(o, absStart.pos, absStart.rot, pc, 0);
              o.scale.setScalar(seg.startScale);
            } else {
              const animT = (localT - pauseT) / (seg.animTime || 3);
              const ep2 = applyEasingInline(Math.min(1, animT), seg.easing || animEasing.value);
              const animPos = [
                absStart.pos[0] + (absEnd.pos[0] - absStart.pos[0]) * ep2,
                absStart.pos[1] + (absEnd.pos[1] - absStart.pos[1]) * ep2,
                absStart.pos[2] + (absEnd.pos[2] - absStart.pos[2]) * ep2
              ];
              const animRot = [
                absStart.rot[0] + (absEnd.rot[0] - absStart.rot[0]) * ep2,
                absStart.rot[1] + (absEnd.rot[1] - absStart.rot[1]) * ep2,
                absStart.rot[2] + (absEnd.rot[2] - absStart.rot[2]) * ep2
              ];
              applyPivotPathFrame(o, animPos, animRot, pc, ep2);
              o.scale.setScalar(seg.startScale + (seg.endScale - seg.startScale) * ep2);
            }
          }
          break;
        }
        cumT += segTotal;
      }
      syncTransformVisualOverlays();
      if (t >= 1) {
        const last = animSegments[animSegments.length - 1];
        const lastAbsEnd = segModeToAbsoluteTransform(m, selModelNodeId.value, last, "end");
        const lpc = last._animPivotCache;
        for (const o of objs) {
          applyPivotPathFrame(o, lastAbsEnd.pos, lastAbsEnd.rot, lpc, 1);
          o.scale.setScalar(last.endScale);
        }
        totalPlaying.value = false;
        segmentPlaybackRafId = null;
        return;
      }
      totalProgress.value = t;
      segmentPlaybackRafId = requestAnimationFrame(tick);
    }
    tick();
  }
  function playSegment(seg: any) {
    stopSegmentPlayback();
    const playbackGen = segmentPlaybackGeneration;
    const m = selModel.value;
    if (!m) return;
    const objs = getNodeObjects(m.id, selModelNodeId.value);
    if (!objs.length) return;
    invalidateSegPivotCache(seg);
    for (const o of objs) getSegPivotCache(seg, o);
    const sp = { x: seg.startPos[0], y: seg.startPos[1], z: seg.startPos[2] };
    const ss = seg.startScale;
    const sr = { x: seg.startRot[0], y: seg.startRot[1], z: seg.startRot[2] };
    const ep = { x: seg.endPos[0], y: seg.endPos[1], z: seg.endPos[2] };
    const es = seg.endScale;
    const er = { x: seg.endRot[0], y: seg.endRot[1], z: seg.endRot[2] };
    const dur = (seg.animTime || 3) * 1000;
    const easingType = seg.easing || animEasing.value;
    const st = performance.now();
    function tick() {
      if (playbackGen !== segmentPlaybackGeneration) return;
      const el = performance.now() - st;
      const t = Math.min(el / dur, 1);
      const ep2 = applyEasingInline(t, easingType);
      const midPos = [sp.x + (ep.x - sp.x) * ep2, sp.y + (ep.y - sp.y) * ep2, sp.z + (ep.z - sp.z) * ep2];
      const midRot = [sr.x + (er.x - sr.x) * ep2, sr.y + (er.y - sr.y) * ep2, sr.z + (er.z - sr.z) * ep2];
      for (const o of objs) {
        applyPivotPathFrame(o, midPos, midRot, seg._animPivotCache, ep2);
        o.scale.setScalar(ss + (es - ss) * ep2);
      }
      syncTransformVisualOverlays();
      if (t < 1) segmentPlaybackRafId = requestAnimationFrame(tick);
      else {
        segmentPlaybackRafId = null;
        liveSeg(seg, editingSegMode.value);
      }
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
  function syncSegToMesh(seg: any, mesh: THREE.Object3D, mode?: "start" | "end") {
    if (!mesh) return;
    const meshPos = [round3(mesh.position.x), round3(mesh.position.y), round3(mesh.position.z)];
    const meshRot = [
      round3((mesh.rotation.x * 180) / Math.PI),
      round3((mesh.rotation.y * 180) / Math.PI),
      round3((mesh.rotation.z * 180) / Math.PI)
    ];
    const pos = usesRelativeAnimRotation(mesh) ? animPosFromAbsolute(mesh, meshPos) : meshPos;
    const rot = usesRelativeAnimRotation(mesh) ? animRotFromAbsolute(mesh, meshRot) : meshRot;
    const scale = round3(mesh.scale.x);
    if (mode === "start") {
      seg.startPos = pos;
      seg.startRot = rot;
      seg.startScale = scale;
    } else if (mode === "end") {
      seg.endPos = pos;
      seg.endRot = rot;
      seg.endScale = scale;
    } else {
      seg.startPos = pos;
      seg.endPos = pos;
      seg.startRot = rot;
      seg.endRot = rot;
      seg.startScale = scale;
      seg.endScale = scale;
    }
    invalidateSegPivotCache(seg);
    bumpAnimSegmentRevision();
  }

  function bumpAnimSegmentRevision() {
    animSegmentRevision.value++;
  }
  function focusSegTransform(seg: any, mode: "start" | "end") {
    editingSeg.value = seg;
    editingSegMode.value = mode;
    if (selModel.value) {
      const ch = getActiveChapter();
      const pristine =
        ch &&
        !animDirty.value &&
        !selectionHasStoredAnimConfig(ch, selModel.value.id, selModelNodeId.value) &&
        !animSegmentDiffersFromDefault(seg, selModel.value, selModelNodeId.value);
      if (pristine) {
        applyDefaultTransformToAnimSegment(seg, selModel.value, selModelNodeId.value);
      }
      showPivotHelpers(selModel.value.id, seg);
      applyAnimSegmentTransformToMesh(selModel.value, selModelNodeId.value, seg, mode);
      updateActivePivotHelper(selModel.value.id);
      bumpAnimSegmentRevision();
    }
  }
  function calcObjectLocalBBox(object: THREE.Object3D): THREE.Box3 {
    const box = new THREE.Box3();
    const temp = new THREE.Vector3();
    const relMatrix = new THREE.Matrix4();
    object.updateWorldMatrix(true, false);
    const invRoot = new THREE.Matrix4().copy(object.matrixWorld).invert();
    object.traverse(child => {
      const mesh = child as THREE.Mesh;
      if (!mesh.isMesh || !mesh.geometry) return;
      const geo = mesh.geometry;
      if (!geo.boundingBox) geo.computeBoundingBox();
      if (!geo.boundingBox) return;
      relMatrix.multiplyMatrices(invRoot, child.matrixWorld);
      const bb = geo.boundingBox;
      const mins = bb.min;
      const maxs = bb.max;
      for (let xi = 0; xi <= 1; xi++) {
        for (let yi = 0; yi <= 1; yi++) {
          for (let zi = 0; zi <= 1; zi++) {
            temp.set(xi ? maxs.x : mins.x, yi ? maxs.y : mins.y, zi ? maxs.z : mins.z).applyMatrix4(relMatrix);
            box.expandByPoint(temp);
          }
        }
      }
    });
    return box;
  }

  function getPivotPointLocal(object: THREE.Object3D, pivotType: string): THREE.Vector3 {
    if (pivotType === "center") return new THREE.Vector3(0, 0, 0);
    const bbox = calcObjectLocalBBox(object);
    if (bbox.isEmpty()) return new THREE.Vector3(0, 0, 0);
    const geoCenter = bbox.getCenter(new THREE.Vector3());
    return geoCenter.clone().add(getPivotLocal(bbox, pivotType));
  }

  function pivotOffsetVector(L: THREE.Vector3, quat: THREE.Quaternion, scale = 1): THREE.Vector3 {
    return L.clone().multiplyScalar(scale).applyQuaternion(quat);
  }

  function shouldBootstrapSegFromMesh(seg: any, mesh: THREE.Object3D, mode: "start" | "end") {
    const pos = mode === "start" ? seg.startPos : seg.endPos;
    const rot = mode === "start" ? seg.startRot : seg.endRot;
    const scale = mode === "start" ? seg.startScale : seg.endScale;
    if (!pos || !rot) return true;
    const posDefault = pos.every((v: number) => Math.abs(v) < 1e-4);
    const rotDefault = rot.every((v: number) => Math.abs(v) < 1e-4);
    const scaleDefault = Math.abs((scale ?? 1) - 1) < 1e-4;
    if (!posDefault || !rotDefault || !scaleDefault) return false;
    const moved =
      Math.abs(mesh.position.x) > 1e-3 || Math.abs(mesh.position.y) > 1e-3 || Math.abs(mesh.position.z) > 1e-3;
    if (usesRelativeAnimRotation(mesh)) {
      const br = mesh.userData.baseLocalRot || [0, 0, 0];
      const bp = mesh.userData.baseLocalPos || [0, 0, 0];
      const atRest =
        Math.abs(mesh.rotation.x - br[0]) < 1e-3 &&
        Math.abs(mesh.rotation.y - br[1]) < 1e-3 &&
        Math.abs(mesh.rotation.z - br[2]) < 1e-3 &&
        Math.abs(mesh.position.x - bp[0]) < 1e-3 &&
        Math.abs(mesh.position.y - bp[1]) < 1e-3 &&
        Math.abs(mesh.position.z - bp[2]) < 1e-3;
      return !atRest;
    }
    const rotated =
      Math.abs(mesh.rotation.x) > 1e-3 || Math.abs(mesh.rotation.y) > 1e-3 || Math.abs(mesh.rotation.z) > 1e-3;
    return moved || rotated;
  }

  function alignAnimSegmentWithMesh(seg: any, mode: "start" | "end" = "start") {
    const m = selModel.value;
    if (!m) return;
    const mesh = getTransformTarget(m.id, selModelNodeId.value);
    if (!mesh || !shouldBootstrapSegFromMesh(seg, mesh, mode)) return;
    syncSegToMesh(seg, mesh, mode);
    if (mode === "start") syncSegToMesh(seg, mesh, "end");
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
  /** 编辑器内相对值 → 应用到 mesh 的绝对值 */
  function segModeToAbsoluteTransform(
    model: Model,
    nodeId: string | null,
    seg: any,
    mode: "start" | "end"
  ): { pos: number[]; rot: number[] } {
    const obj = getTransformTarget(model.id, nodeId);
    const posKey = mode === "start" ? "startPos" : "endPos";
    const rotKey = mode === "start" ? "startRot" : "endRot";
    const pos = (seg[posKey] || [0, 0, 0]).map((n: number) => round3(n));
    const rot = (seg[rotKey] || [0, 0, 0]).map((n: number) => round3(n));
    if (!obj || !usesRelativeAnimRotation(obj)) return { pos, rot };
    return {
      pos: animPosToAbsolute(obj, pos),
      rot: animRotToAbsolute(obj, rot)
    };
  }

  /** 将动画段变换应用到 mesh，不回写 segment（避免欧拉角回读漂移破坏旋转编辑） */
  function applyAnimSegmentTransformToMesh(
    model: Model,
    nodeId: string | null,
    seg: any,
    mode: "start" | "end"
  ) {
    const objs = getNodeObjects(model.id, nodeId, true);
    if (!objs.length) return;
    const scaleKey = mode === "start" ? "startScale" : "endScale";
    const { pos, rot } = segModeToAbsoluteTransform(model, nodeId, seg, mode);
    const scale = round3(seg[scaleKey] ?? 1);
    const pivot = seg.pivot || "center";
    invalidateSegPivotCache(seg);
    for (const o of objs) {
      if (pivot === "center") {
        applyPivotRotation(o, pos, rot, "center", scale);
      } else {
        const pc = getSegPivotCache(seg, o);
        pc.scale = scale;
        applyPivotPathFrame(o, pos, rot, pc, mode === "end" ? 1 : 0);
        o.scale.setScalar(scale);
      }
    }
  }

  function applyPivotRotation(mesh: any, pos: number[], rot: number[], pivotType: string, scaleVal?: number) {
    const rad = [(rot[0] * Math.PI) / 180, (rot[1] * Math.PI) / 180, (rot[2] * Math.PI) / 180];
    if (scaleVal !== undefined) mesh.scale.setScalar(scaleVal);
    mesh.rotation.set(rad[0], rad[1], rad[2], "XYZ");
    mesh.position.set(pos[0], pos[1], pos[2]);
  }
  function onPivotChange(seg: any, mode: "start" | "end" = editingSegMode.value) {
    if (!selModel.value) return;
    const mesh = getTransformTarget(selModel.value.id, selModelNodeId.value);
    if (mesh) syncSegToMesh(seg, mesh, mode);
    invalidateSegPivotCache(seg);
    editingSeg.value = seg;
    editingSegMode.value = mode;
    showPivotHelpers(selModel.value.id, seg);
    updateActivePivotHelper(selModel.value.id);
    markAnimDirty();
    bumpAnimSegmentRevision();
  }
  function onRotChange(seg: any, mode: "start" | "end" = editingSegMode.value) {
    if (!selModel.value) return;
    editingSeg.value = seg;
    editingSegMode.value = mode;
    const mesh = getTransformTarget(selModel.value.id, selModelNodeId.value);
    if (!mesh) return;
    const rotKey = mode === "start" ? "startRot" : "endRot";
    const posKey = mode === "start" ? "startPos" : "endPos";
    const scaleKey = mode === "start" ? "startScale" : "endScale";
    const nextRot = (seg[rotKey] || [0, 0, 0]).map((n: number) => round3(n));
    seg[rotKey] = [...nextRot];
    const pivotType = seg.pivot || "center";
    invalidateSegPivotCache(seg);
    if (pivotType !== "center") {
      const { rot: absRotDeg } = segModeToAbsoluteTransform(selModel.value, selModelNodeId.value, seg, mode);
      const oldQuat = mesh.quaternion.clone();
      const oldPos = mesh.position.clone();
      const scale = seg[scaleKey] ?? mesh.scale.x ?? 1;
      const L = getPivotPointLocal(mesh, pivotType);
      const rad = [(absRotDeg[0] * Math.PI) / 180, (absRotDeg[1] * Math.PI) / 180, (absRotDeg[2] * Math.PI) / 180];
      const newQuat = new THREE.Quaternion().setFromEuler(new THREE.Euler(rad[0], rad[1], rad[2], "XYZ"));
      const oldOff = pivotOffsetVector(L, oldQuat, scale);
      const newOff = pivotOffsetVector(L, newQuat, scale);
      const newPos = oldPos.clone().add(oldOff).sub(newOff);
      const absPos = [round3(newPos.x), round3(newPos.y), round3(newPos.z)];
      if (usesRelativeAnimRotation(mesh)) {
        seg[posKey] = animPosFromAbsolute(mesh, absPos);
      } else {
        seg[posKey] = absPos;
      }
    }
    liveSeg(seg, mode);
    markAnimDirty();
  }
  function liveSeg(seg: any, mode: "start" | "end" = editingSegMode.value) {
    const m = selModel.value;
    if (!m) return;
    editingSeg.value = seg;
    editingSegMode.value = mode;
    applyAnimSegmentTransformToMesh(m, selModelNodeId.value, seg, mode);
    updateActivePivotHelper(m.id);
    bumpAnimSegmentRevision();
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
    if (!isEditorGizmoVisible()) return;
    hidePivotHelpers(modelId);
    const mesh = getTransformTarget(modelId, selModelId.value === modelId ? selModelNodeId.value : null);
    if (!mesh) return;
    const pivotType = seg?.pivot || editingSeg.value?.pivot || "center";
    const localPt = getPivotPointLocal(mesh, pivotType);
    const worldPt = mesh.localToWorld(localPt.clone());
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
    const pivotType = editingSeg.value?.pivot || "center";
    const localPt = getPivotPointLocal(target, pivotType);
    const worldPt = target.localToWorld(localPt.clone());
    sphere.position.copy(worldPt);
  }

  function meshBelongsToVisualOwner(mesh: THREE.Mesh, ownerObj: THREE.Object3D): boolean {
    // 多材质合并节点：owner 常是 Group/host，子 mesh 的 nodeId 与 host 不同。
    // 以祖先关系为准，否则轮廓/线框/高亮会收集到空列表（本柜子模型即此情况）。
    if (mesh === ownerObj) return true;
    let cur: THREE.Object3D | null = mesh.parent;
    while (cur) {
      if (cur === ownerObj) return true;
      cur = cur.parent;
    }

    const ownerNodeId = ownerObj.userData?.nodeId as string | undefined;
    if (!ownerNodeId) return false;
    const ownerMerged = (ownerObj.userData?.mergedNodeIds as string[] | undefined) ?? [];
    const meshNodeId = mesh.userData?.nodeId as string | undefined;
    const meshMergedId = mesh.userData?.mergedNodeId as string | undefined;
    if (meshNodeId === ownerNodeId || meshMergedId === ownerNodeId) return true;
    if (meshNodeId && ownerMerged.includes(meshNodeId)) return true;
    if (meshMergedId && ownerMerged.includes(meshMergedId)) return true;
    return false;
  }

  function registerModelConfigOutlineMesh(mesh: THREE.Mesh, color: string, ownerKey: string) {
    mesh.userData.configOutlineOwner = ownerKey;
    modelConfigOutlineRegistry.set(mesh, color);
  }

  function unregisterModelConfigOutlineForOwner(modelRoot: THREE.Object3D, ownerKey: string) {
    const toDelete: THREE.Mesh[] = [];
    modelConfigOutlineRegistry.forEach((_color, mesh) => {
      if (mesh.userData.configOutlineOwner === ownerKey) {
        delete mesh.userData.configOutlineOwner;
        toDelete.push(mesh);
      }
    });
    toDelete.forEach(mesh => modelConfigOutlineRegistry.delete(mesh));
  }

  function applyModelConfigOutlinePassStyle(color: string) {
    if (!modelConfigOutlinePass) return;
    modelConfigOutlinePass.visibleEdgeColor.set(new THREE.Color(color));
    modelConfigOutlinePass.hiddenEdgeColor.set(HIDDEN_EDGE_COLOR);
    modelConfigOutlinePass.pulsePeriod = 0;
    if (isPresentationMode()) {
      // 展示页：全分辨率 + 稍细描边，配合 SMAA，红框锯齿会轻很多
      modelConfigOutlinePass.downSampleRatio = 1;
      modelConfigOutlinePass.edgeStrength = 5.5;
      modelConfigOutlinePass.edgeThickness = 1.35;
      modelConfigOutlinePass.edgeGlow = 0;
    } else {
      modelConfigOutlinePass.edgeStrength = 7;
      modelConfigOutlinePass.edgeThickness = 2;
      modelConfigOutlinePass.edgeGlow = 0.12;
    }
  }

  function attachOutlineEdgeGlow(
    attachOwner: THREE.Object3D,
    sourceMesh: THREE.Mesh,
    color: string,
    ownerKey: string,
    thresholdAngle = 28
  ) {
    const glow = createContourEdgeLines(sourceMesh, color, 0.55, thresholdAngle, {
      isOutlineShell: true,
      outlineOwner: ownerKey
    });
    const core = createContourEdgeLines(sourceMesh, color, 1.85, thresholdAngle, {
      isOutlineShell: true,
      outlineOwner: ownerKey
    });
    if (glow) {
      glow.renderOrder = 10;
      attachOverlayToOwner(attachOwner, sourceMesh, glow);
    }
    if (core) {
      core.renderOrder = 11;
      attachOverlayToOwner(attachOwner, sourceMesh, core);
    }
  }

  function syncModelConfigOutlinePass() {
    if (!modelConfigOutlinePass) return;
    const selectedSet = new Set<THREE.Object3D>();
    let color = DEFAULT_OUTLINE_COLOR;
    modelConfigOutlineRegistry.forEach((outlineColor, mesh) => {
      if (!isObjectVisibleChain(mesh)) return;
      for (const obj of collectOutlineMeshes([mesh])) {
        selectedSet.add(obj);
      }
      color = outlineColor;
    });
    modelConfigOutlinePass.selectedObjects = [...selectedSet];
    if (selectedSet.size) applyModelConfigOutlinePassStyle(color);
    syncEditorComposerPasses();
  }

  function clearModelConfigOutlineRegistry() {
    modelConfigOutlineRegistry.forEach((_color, mesh) => {
      delete mesh.userData.configOutlineOwner;
    });
    modelConfigOutlineRegistry.clear();
    if (modelConfigOutlinePass) modelConfigOutlinePass.selectedObjects = [];
  }

  function isModelVisualOverlay(obj: THREE.Object3D): boolean {
    return !!(
      obj.userData?.isOutlineShell ||
      obj.userData?.isBodyHighlightOverlay ||
      obj.userData?.isWireframeOnly ||
      obj.userData?.isEdgeLine
    );
  }

  function disposeVisualOverlay(obj: THREE.Object3D) {
    obj.parent?.remove(obj);
    const mesh = obj as THREE.Mesh;
    const line = obj as THREE.LineSegments;
    const geo = mesh.isMesh ? mesh.geometry : line.isLineSegments ? line.geometry : null;
    if (geo?.userData?.isOverlayGeometry) geo.dispose();
    const mat = mesh.isMesh ? mesh.material : line.isLineSegments ? line.material : null;
    if (mat) {
      if (Array.isArray(mat)) mat.forEach(item => item.dispose());
      else mat.dispose();
    }
  }

  function disposeOverlayMaterial(material: THREE.Material | THREE.Material[]) {
    if (Array.isArray(material)) material.forEach(item => item.dispose());
    else material.dispose();
  }

  /**
   * GLB 常让多个零件共享同一 Material。线框/高亮若原地改 emissive/colorWrite，
   * 会“选一个 PACK03001 却亮一整排”。对当前 mesh 克隆出独立材质再改。
   */
  function ensureUniqueMeshMaterials(mesh: THREE.Mesh) {
    if (mesh.userData.__uniqueMaterials) return;
    const src = mesh.material;
    if (!src) return;
    const list = Array.isArray(src) ? src : [src];
    const cloned = list.map(mat => {
      const next = mat.clone();
      // Three r184 把 name 写进 #define SHADER_NAME；克隆后清空，避免 T_text_* 再炸着色器
      next.name = "";
      next.needsUpdate = true;
      return next;
    });
    mesh.userData.__sharedMaterialsBeforeUnique = src;
    mesh.material = Array.isArray(src) ? cloned : cloned[0];
    mesh.userData.__uniqueMaterials = true;
  }

  function attachOverlayToOwner(owner: THREE.Object3D, sourceMesh: THREE.Mesh, overlay: THREE.Object3D) {
    sourceMesh.updateWorldMatrix(true, false);
    owner.updateWorldMatrix(true, false);
    _overlayAttachMat.copy(owner.matrixWorld).invert().multiply(sourceMesh.matrixWorld);
    _overlayAttachMat.decompose(_overlayAttachPos, _overlayAttachQuat, _overlayAttachScale);
    overlay.position.copy(_overlayAttachPos);
    overlay.quaternion.copy(_overlayAttachQuat);
    overlay.scale.copy(_overlayAttachScale);
    overlay.visible = true;
    overlay.userData.overlaySourceMesh = sourceMesh;
    overlay.userData.overlayAttachOwner = owner;
    owner.add(overlay);
  }

  function syncVisualOverlayTransforms() {
    meshes.forEach(modelRoot => {
      modelRoot.traverse(obj => {
        if (!isModelVisualOverlay(obj)) return;
        const sourceMesh = obj.userData.overlaySourceMesh as THREE.Mesh | undefined;
        const owner = obj.userData.overlayAttachOwner as THREE.Object3D | undefined;
        if (!sourceMesh || !owner || obj.parent !== owner) return;
        sourceMesh.updateWorldMatrix(true, false);
        owner.updateWorldMatrix(true, false);
        _overlayAttachMat.copy(owner.matrixWorld).invert().multiply(sourceMesh.matrixWorld);
        _overlayAttachMat.decompose(_overlayAttachPos, _overlayAttachQuat, _overlayAttachScale);
        obj.position.copy(_overlayAttachPos);
        obj.quaternion.copy(_overlayAttachQuat);
        obj.scale.copy(_overlayAttachScale);
      });
    });
  }

  /** 线框/轮廓不能挂在已 hidden 的 mesh 上，需挂到可见父级或模型根 */
  function resolveOverlayAttachOwner(
    modelRoot: THREE.Object3D,
    ownerObj: THREE.Object3D,
    sourceMesh: THREE.Mesh
  ): THREE.Object3D {
    if (ownerObj !== sourceMesh) return ownerObj;
    let parent = sourceMesh.parent;
    while (parent && parent !== modelRoot) {
      if (parent.visible !== false) return parent;
      parent = parent.parent;
    }
    return modelRoot;
  }

  function restoreWireframeSurface(mesh: THREE.Mesh) {
    const snaps = mesh.userData.wireframeMaterialSnap as
      | Array<{
          mat: THREE.Material;
          colorWrite: boolean;
          depthWrite: boolean;
          transparent: boolean;
          opacity: number;
          wireframe?: boolean;
        }>
      | undefined;
    if (Array.isArray(snaps)) {
      for (const snap of snaps) {
        const mat = snap.mat;
        if (!mat) continue;
        mat.colorWrite = snap.colorWrite;
        mat.depthWrite = snap.depthWrite;
        mat.transparent = snap.transparent;
        mat.opacity = snap.opacity;
        if (typeof snap.wireframe === "boolean" && "wireframe" in mat) {
          (mat as THREE.MeshBasicMaterial).wireframe = snap.wireframe;
        }
        mat.needsUpdate = true;
      }
      delete mesh.userData.wireframeMaterialSnap;
    }
    if (mesh.userData.wireframeSavedMaterials !== undefined) {
      const temp = mesh.material;
      mesh.material = mesh.userData.wireframeSavedMaterials;
      delete mesh.userData.wireframeSavedMaterials;
      if (temp !== mesh.material) disposeOverlayMaterial(temp);
    }
    if (mesh.userData.wireframeSavedVisible !== undefined) {
      mesh.visible = mesh.userData.wireframeSavedVisible;
      delete mesh.userData.wireframeSavedVisible;
    }
    delete mesh.userData.wireframeSurfaceHidden;
    delete mesh.userData.wireframeMaterialApplied;
    delete mesh.userData.wireframeOwner;
    delete mesh.userData.pickHiddenForOutline;
  }

  function removeVisualOverlaysForOwner(modelRoot: THREE.Object3D, ownerKey: string) {
    const toRemove: THREE.Object3D[] = [];
    modelRoot.traverse(c => {
      if (isModelVisualOverlay(c) && c.userData.outlineOwner === ownerKey) {
        toRemove.push(c);
      }
    });
    toRemove.forEach(disposeVisualOverlay);
    unregisterModelConfigOutlineForOwner(modelRoot, ownerKey);

    modelRoot.traverse(c => {
      if (c instanceof THREE.Mesh && c.userData.wireframeOwner === ownerKey) {
        restoreWireframeSurface(c);
      }
      if (c instanceof THREE.Mesh && c.userData.bodyHighlightOwner === ownerKey) {
        restoreBodyHighlight(c);
      }
    });
  }

  function createCenteredOverlayMesh(
    sourceMesh: THREE.Mesh,
    material: THREE.Material,
    scale: number
  ): THREE.Mesh {
    const geometry = sourceMesh.geometry.clone();
    geometry.computeBoundingBox();
    const center = new THREE.Vector3();
    if (geometry.boundingBox) geometry.boundingBox.getCenter(center);
    geometry.translate(-center.x, -center.y, -center.z);
    geometry.userData.isOverlayGeometry = true;

    const overlay = new THREE.Mesh(geometry, material);
    overlay.position.copy(center);
    overlay.scale.setScalar(scale);
    return overlay;
  }

  function hideMeshSurfaceForWireframe(mesh: THREE.Mesh, ownerKey: string) {
    // 保持 mesh.visible=true，否则 OutlinePass / 模型高亮在线框模式下会一起失效。
    // 仅关闭 colorWrite，用边线 overlay 表达线框。
    ensureUniqueMeshMaterials(mesh);
    if (!mesh.userData.wireframeSurfaceHidden) {
      const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      mesh.userData.wireframeMaterialSnap = mats.map(mat => ({
        mat,
        colorWrite: mat.colorWrite !== false,
        depthWrite: mat.depthWrite !== false,
        transparent: !!mat.transparent,
        opacity: typeof mat.opacity === "number" ? mat.opacity : 1,
        wireframe: "wireframe" in mat ? !!(mat as THREE.MeshBasicMaterial).wireframe : false
      }));
      for (const mat of mats) {
        mat.colorWrite = false;
        mat.transparent = true;
        mat.opacity = 0;
        mat.needsUpdate = true;
      }
    }
    if (mesh.userData.wireframeSavedVisible === undefined) {
      mesh.userData.wireframeSavedVisible = mesh.visible;
    }
    mesh.visible = true;
    mesh.userData.wireframeSurfaceHidden = true;
    mesh.userData.wireframeOwner = ownerKey;
    delete mesh.userData.pickHiddenForOutline;
  }

  function createContourEdgeLines(
    sourceMesh: THREE.Mesh,
    color: string,
    opacity: number,
    thresholdAngle: number,
    userData: Record<string, unknown>
  ): THREE.LineSegments | null {
    const srcGeo = sourceMesh.geometry;
    if (!srcGeo?.attributes?.position) return null;

    const posCount = srcGeo.attributes.position.count;
    const triCount = srcGeo.index ? srcGeo.index.count / 3 : posCount / 3;
    let edges: THREE.BufferGeometry | null = null;
    try {
      // CAD 高模用 EdgesGeometry 极慢且常超上限；改用 WireframeGeometry 兜底。
      if (triCount > 60000 || posCount > 120000) {
        edges = new THREE.WireframeGeometry(srcGeo);
      } else {
        edges = new THREE.EdgesGeometry(srcGeo, thresholdAngle);
        if (edges.attributes.position.count > 250000) {
          edges.dispose();
          edges = new THREE.WireframeGeometry(srcGeo);
        }
      }
    } catch {
      try {
        edges = new THREE.WireframeGeometry(srcGeo);
      } catch {
        return null;
      }
    }
    if (!edges?.attributes?.position || edges.attributes.position.count < 2) {
      edges?.dispose();
      return null;
    }
    if (edges.attributes.position.count > 500000) {
      edges.dispose();
      return null;
    }
    edges.userData.isOverlayGeometry = true;
    const line = new THREE.LineSegments(
      edges,
      new THREE.LineBasicMaterial({
        color: new THREE.Color(color),
        transparent: opacity < 1,
        opacity,
        depthTest: true,
        depthWrite: false,
        // 展示页 SMAA 对 toneMapped 线条更友好；避免额外色调映射加粗锯齿感
        toneMapped: false
      })
    );
    line.frustumCulled = false;
    line.renderOrder = 10;
    Object.assign(line.userData, userData);
    line.userData.isEdgeLine = true;
    return line;
  }

  /** 轮廓高亮：仅外壳外轮廓光晕（BackSide 描边），不绘制模型内部棱线 */
  function applyOutlineHighlight(mesh: THREE.Mesh, color: string, ownerKey: string, _attachOwner?: THREE.Object3D) {
    registerModelConfigOutlineMesh(mesh, color, ownerKey);
  }

  function applyBodyHighlightToMesh(mesh: THREE.Mesh, color: string, ownerKey: string) {
    // 线框仅关掉 colorWrite，mesh 仍可见；允许与线框叠加时仍改 emissive（关掉 colorWrite 时效果弱，但非线框时正常）
    if (mesh.visible === false) return;
    ensureUniqueMeshMaterials(mesh);

    if (mesh.userData.bodyHighlightSaved === undefined) {
      const src = mesh.material;
      const list = Array.isArray(src) ? src : [src];
      mesh.userData.bodyHighlightSaved = list.map(mat => {
        const snap: Record<string, any> = { mat };
        if (
          mat instanceof THREE.MeshStandardMaterial ||
          mat instanceof THREE.MeshPhysicalMaterial ||
          mat instanceof THREE.MeshLambertMaterial ||
          mat instanceof THREE.MeshPhongMaterial
        ) {
          snap.emissive = mat.emissive.clone();
          snap.emissiveIntensity = mat.emissiveIntensity;
          snap.color = mat.color.clone();
        } else if (mat instanceof THREE.MeshBasicMaterial) {
          snap.color = mat.color.clone();
        }
        return snap;
      });
    }

    const tint = new THREE.Color(color);
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    for (const mat of mats) {
      if (
        mat instanceof THREE.MeshStandardMaterial ||
        mat instanceof THREE.MeshPhysicalMaterial
      ) {
        mat.emissive.copy(tint);
        mat.emissiveIntensity = 1.15;
        mat.color.lerp(tint, 0.25);
        mat.needsUpdate = true;
      } else if (mat instanceof THREE.MeshLambertMaterial || mat instanceof THREE.MeshPhongMaterial) {
        mat.emissive.copy(tint);
        mat.emissiveIntensity = 0.85;
        mat.color.lerp(tint, 0.3);
        mat.needsUpdate = true;
      } else if (mat instanceof THREE.MeshBasicMaterial) {
        mat.color.copy(tint);
        mat.needsUpdate = true;
      }
    }
    mesh.userData.bodyHighlightOwner = ownerKey;
  }

  function restoreBodyHighlight(mesh: THREE.Mesh) {
    if (mesh.userData.bodyHighlightOwner === undefined) return;
    const snaps = mesh.userData.bodyHighlightSaved as Array<Record<string, any>> | undefined;
    if (Array.isArray(snaps)) {
      for (const snap of snaps) {
        const mat = snap.mat as THREE.Material | undefined;
        if (!mat) continue;
        if (snap.emissive && (mat as any).emissive) {
          (mat as any).emissive.copy(snap.emissive);
        }
        if (typeof snap.emissiveIntensity === "number" && "emissiveIntensity" in mat) {
          (mat as any).emissiveIntensity = snap.emissiveIntensity;
        }
        if (snap.color && (mat as any).color) {
          (mat as any).color.copy(snap.color);
        }
        mat.needsUpdate = true;
      }
    }
    delete mesh.userData.bodyHighlightSaved;
    delete mesh.userData.bodyHighlightOwner;
  }

  function collectMeshesForVisualOwner(obj: THREE.Object3D): THREE.Mesh[] {
    const meshesToOutline: THREE.Mesh[] = [];
    const visit = (mesh: THREE.Mesh) => {
      if (mesh.geometry && !isModelVisualOverlay(mesh) && meshBelongsToVisualOwner(mesh, obj)) {
        meshesToOutline.push(mesh);
      }
    };
    if ((obj as THREE.Mesh).isMesh && obj.geometry) visit(obj as THREE.Mesh);
    obj.traverse(c => {
      if (c !== obj && c instanceof THREE.Mesh) visit(c);
    });
    return meshesToOutline;
  }

  function rebuildOutlineForObject(
    m: Model,
    obj: THREE.Object3D,
    cfg: ModelConfig,
    options?: { touchVisibility?: boolean }
  ) {
    const modelRoot = meshes.get(m.id);
    if (!modelRoot) return;

    const touchVisibility = options?.touchVisibility !== false;
    const ownerKey = (obj.userData?.nodeId as string | undefined) || `root:${m.id}`;
    removeVisualOverlaysForOwner(modelRoot, ownerKey);

    if (!cfg.visible) {
      if (touchVisibility) obj.visible = false;
      invalidatePickMeshCache();
      return;
    }
    if (touchVisibility) obj.visible = true;
    if (!cfg.outline && !cfg.highlight && !cfg.wireframe) {
      syncModelConfigOutlinePass();
      invalidatePickMeshCache();
      return;
    }

    const resolvedCfg = getModelConfig(cfg);
    const outlineColor = resolvedCfg.outlineColor;
    const wireframeColor = resolvedCfg.wireframeColor;
    const modelHighlightColor = resolvedCfg.modelHighlightColor;
    const meshesToOutline = collectMeshesForVisualOwner(obj);

    for (const c of meshesToOutline) {
      try {
        if (cfg.wireframe) {
          const attachOwner = resolveOverlayAttachOwner(modelRoot, obj, c);
          const wireContour = createContourEdgeLines(c, wireframeColor, 1, 24, {
            isWireframeOnly: true,
            outlineOwner: ownerKey
          });
          if (wireContour) {
            hideMeshSurfaceForWireframe(c, ownerKey);
            attachOverlayToOwner(attachOwner, c, wireContour);
          } else {
            // 边线生成失败（超大网格等）：退回原生 wireframe，避免“开关开了没变化”
            ensureUniqueMeshMaterials(c);
            hideMeshSurfaceForWireframe(c, ownerKey);
            const mats = Array.isArray(c.material) ? c.material : [c.material];
            for (const mat of mats) {
              (mat as THREE.MeshBasicMaterial).wireframe = true;
              mat.colorWrite = true;
              mat.opacity = 1;
              mat.transparent = false;
              mat.needsUpdate = true;
            }
          }

          if (cfg.outline) {
            applyOutlineHighlight(c, outlineColor, ownerKey);
            attachOutlineEdgeGlow(attachOwner, c, outlineColor, ownerKey);
          }
        } else if (cfg.outline) {
          applyOutlineHighlight(c, outlineColor, ownerKey);
          const attachOwner = resolveOverlayAttachOwner(modelRoot, obj, c);
          attachOutlineEdgeGlow(attachOwner, c, outlineColor, ownerKey, 12);
        }

        if (cfg.highlight) {
          applyBodyHighlightToMesh(c, modelHighlightColor, ownerKey);
        }
      } catch {
        /* ignore per-mesh failures so其他 mesh 仍可应用 */
      }
    }
    syncModelConfigOutlinePass();
    invalidatePickMeshCache();
  }

  function rebuildOutline(m: Model, cfg?: ModelConfig | null) {
    const o = meshes.get(m.id);
    if (!o || !cfg) return;
    rebuildOutlineForObject(m, o, cfg);
  }

  function seekTrack(e: MouseEvent | PointerEvent) {
    if (!trackEl.value || !videoEl.value || !duration.value || !hasChapters.value) return;
    const target = e.target as HTMLElement;
    const segEl = target.closest(".prog-seg");
    if (segEl) return;

    const r = trackEl.value.getBoundingClientRect();
    const t = ((e.clientX - r.left) / r.width) * duration.value;
    void seekToTimelineTime(t, { userGesture: true });
  }

  async function seekToTimelineTime(
    time: number,
    options?: { autoplay?: boolean; userGesture?: boolean }
  ) {
    const video = videoEl.value;
    if (!video || !duration.value) return;

    const target = clampVideoTime(time, video);
    const wasPlaying =
      viewOnly.value || isPreviewMode.value
        ? presentationPlaybackSession.intent === "play"
        : !video.paused && !video.ended;
    const shouldPlay = options?.autoplay ?? wasPlaying;

    if (viewOnly.value || isPreviewMode.value) {
      await seekPresentationTimelineTime(target, shouldPlay);
      return;
    }

    const chapterAtTarget = chapterAtTime(target);
    if (chapterAtTarget) {
      const resolved = resolveChapter(chapterAtTarget);
      if (resolved) {
        await executeChapterPlayback(resolved.chapter, {
          syncVideo: true,
          autoplay: shouldPlay,
          userGesture: options?.userGesture,
          seekTime: target,
          keepPlaying: wasPlaying
        });
        return;
      }
    }

    stopChapterAnimation();
    chapterPlayTarget.value = null;
    await seekVideoTo(target, { pause: !shouldPlay });
    currentTime.value = video.currentTime;
    if (!viewOnly.value && !isPreviewMode.value) {
      editPlaybackSyncChapterId = null;
      editPlaybackSyncElapsed = -1;
      syncEditModePlaybackFromVideo(video);
    } else {
      const playback = getPlaybackChapterAtTime(video.currentTime);
      if (playback) {
        syncPresentationUiFromChapter(playback);
        syncCurrentChapterAnimationFromVideo();
      } else {
        resetAllModelsToDefault();
      }
    }
    if (shouldPlay) {
      try {
        await video.play();
        ensureVideoSyncedChapterAnimation();
      } catch {
        if (viewOnly.value || isPreviewMode.value) showPresentationPlaybackHint();
      }
    }
  }

  async function seekPresentationTimelineTime(target: number, shouldPlay: boolean) {
    const video = videoEl.value;
    if (!video) return;
    commandPresentationPlayback({
      targetTime: target,
      intent: shouldPlay ? "play" : "pause",
      navChapter: getPresentationChapterAtVideoTime(target),
      autoAdvance: shouldPlay
    });
  }

  async function waitForVideoReady(timeoutMs = 12000): Promise<boolean> {
    const video = videoEl.value;
    if (!video || !videoSrc.value) return false;
    if (video.readyState >= HTMLMediaElement.HAVE_FUTURE_DATA) return true;

    return new Promise(resolve => {
      let settled = false;
      const finish = (ok: boolean) => {
        if (settled) return;
        settled = true;
        video.removeEventListener("canplay", onReady);
        video.removeEventListener("loadeddata", onReady);
        video.removeEventListener("error", onError);
        window.clearTimeout(timer);
        resolve(ok);
      };
      const onReady = () => finish(true);
      const onError = () => finish(false);
      const timer = window.setTimeout(
        () => finish(video.readyState >= HTMLMediaElement.HAVE_METADATA),
        timeoutMs
      );
      video.addEventListener("canplay", onReady);
      video.addEventListener("loadeddata", onReady);
      video.addEventListener("error", onError);
      if (video.readyState === HTMLMediaElement.HAVE_NOTHING) {
        try {
          video.load();
        } catch {
          finish(false);
        }
      }
    });
  }

  function getPresentationStartChapter(): Chapter | null {
    const firstRoot = timelineChapters.value[0] ?? chapters.value[0] ?? null;
    if (!firstRoot) return null;
    if (chapterHasAnimation(firstRoot)) return firstRoot;
    const children = getChapterChildren(firstRoot.id).sort((a, b) => a.startTime - b.startTime);
    const firstAnimatedChild = children.find(ch => chapterHasAnimation(ch));
    return firstAnimatedChild ?? children[0] ?? firstRoot;
  }

  function isViewModeDebugEnabled() {
    return viewOnly.value;
  }

  function debugViewPlayback(label: string, payload?: Record<string, unknown>) {
    if (!isViewModeDebugEnabled()) return;
    // 热路径每帧都会进：直接静默，需要时用其它一次性事件日志
    if (
      label.startsWith("resolvePlayableChapter:") ||
      label.startsWith("ensureVideoSyncedChapterAnimation:")
    ) {
      return;
    }
    if (payload) {
      console.log(`[view-debug] ${label}`, payload);
    } else {
      console.log(`[view-debug] ${label}`);
    }
  }

  function resolvePlayableChapterForPresentation(chapter: Chapter): Chapter {
    if (chapterHasAnimation(chapter)) {
      debugViewPlayback("resolvePlayableChapter:use-self", {
        clickedChapterId: chapter.id,
        clickedChapterName: chapter.name
      });
      return chapter;
    }
    const descendantIds = new Set(getAllDescendantChapterIds(chapter.id));
    const descendants = descendantIds.size
      ? chapters.value
          .filter(item => descendantIds.has(item.id))
          .sort((a, b) => a.startTime - b.startTime || a.endTime - b.endTime)
      : [];
    const descendantAnimated = descendants.find(item => chapterHasAnimation(item));
    if (descendantAnimated) {
      debugViewPlayback("resolvePlayableChapter:fallback-descendant", {
        clickedChapterId: chapter.id,
        clickedChapterName: chapter.name,
        resolvedChapterId: descendantAnimated.id,
        resolvedChapterName: descendantAnimated.name
      });
      return descendantAnimated;
    }

    // 兼容历史数据：仅在同一父视频内找同时间段兄弟节点，禁止跨视频互抢
    const overlapCandidates = chapters.value
      .filter(item => {
        if (item.id === chapter.id) return false;
        if (chapter.parentId && item.parentId !== chapter.parentId) return false;
        const overlap =
          item.startTime <= chapter.endTime - CHAPTER_TIME_EPS &&
          item.endTime >= chapter.startTime + CHAPTER_TIME_EPS;
        return overlap;
      })
      .sort((a, b) => a.startTime - b.startTime || a.endTime - b.endTime);
    const overlapAnimated = overlapCandidates.find(item => chapterHasAnimation(item));
    if (overlapAnimated) {
      debugViewPlayback("resolvePlayableChapter:fallback-overlap", {
        clickedChapterId: chapter.id,
        clickedChapterName: chapter.name,
        resolvedChapterId: overlapAnimated.id,
        resolvedChapterName: overlapAnimated.name
      });
      return overlapAnimated;
    }

    debugViewPlayback("resolvePlayableChapter:no-anim-candidate", {
      clickedChapterId: chapter.id,
      clickedChapterName: chapter.name,
      descendants: descendants.length,
      overlapCandidates: overlapCandidates.length
    });
    return chapter;
  }

  function resolvePlayableChapterForPresentationAtTime(chapter: Chapter, time: number): Chapter {
    const descendantIds = new Set([chapter.id, ...getAllDescendantChapterIds(chapter.id)]);
    const timeMatchedAnimated = chapters.value
      .filter(item => {
        if (!descendantIds.has(item.id)) return false;
        if (!chapterHasAnimation(item)) return false;
        return time >= item.startTime - CHAPTER_TIME_EPS && time < item.endTime - CHAPTER_END_EPS;
      })
      .sort((a, b) => {
        const spanDiff = (a.endTime - a.startTime) - (b.endTime - b.startTime);
        if (Math.abs(spanDiff) > CHAPTER_TIME_EPS) return spanDiff;
        return b.startTime - a.startTime;
      });
    if (timeMatchedAnimated.length > 0) {
      return timeMatchedAnimated[0];
    }
    return resolvePlayableChapterForPresentation(chapter);
  }

  function resetEditPlaybackBeforePresentation() {
    stopChapterAnimation();
    chapterPlayTarget.value = null;
    resetPresentationPlaybackSession(0);
    presentationUiChapterId.value = null;
    presentationNavIndex.value = -1;
    presentationUiRevision.value = 0;
    lastPresentationAutoSwitchChapterId = null;
    chapterAutoNext.value = false;
    presentationManualNavUntil = 0;
    totalPlaying.value = false;
    if (videoEl.value) videoEl.value.pause();
  }

  function beginPresentationPlayback(
    chapter?: Chapter | null,
    options?: { autoplay?: boolean }
  ) {
    const startChapter = chapter ?? getPresentationStartChapter();
    if (!startChapter) return;
    showVideoPip.value = true;
    const autoplay = options?.autoplay ?? true;
    const navChapter = resolvePresentationNavChapter(startChapter);
    const startTime = Math.max(0, navChapter.startTime);
    presentationEndedUiSynced = false;

    // Refresh / remount often leaves media at EOF (browser resume). Force the clock
    // back to the presentation start before the unified command runs.
    const video = videoEl.value;
    if (video) {
      try {
        video.pause();
      } catch {
        /* ignore */
      }
      try {
        if (
          video.ended ||
          isPresentationAtMediaEnd(video) ||
          Math.abs(video.currentTime - startTime) > CHAPTER_TIME_EPS
        ) {
          video.currentTime = startTime;
        }
      } catch {
        /* metadata may not be ready; effect will seek again */
      }
    }

    commandPresentationPlayback({
      targetTime: startTime,
      intent: autoplay ? "play" : "pause",
      navChapter,
      autoAdvance: autoplay
    });
    // Give mobile seek more time before EOF observers can clobber the start target.
    if (isCoarsePointerDevice()) {
      presentationManualNavUntil = Math.max(
        presentationManualNavUntil,
        performance.now() + 2800
      );
    }
  }

  async function startChapterPlayback(
    ch: Chapter,
    options?: {
      autoplay?: boolean;
      syncVideo?: boolean;
      userGesture?: boolean;
      seekTime?: number;
      keepPlaying?: boolean;
    }
  ): Promise<void> {
    return executeChapterPlayback(ch, options);
  }

  async function executeChapterPlayback(
    ch: Chapter,
    options?: {
      autoplay?: boolean;
      syncVideo?: boolean;
      userGesture?: boolean;
      seekTime?: number;
      keepPlaying?: boolean;
    }
  ): Promise<void> {
    const syncVideo = options?.syncVideo ?? false;
    const presentationSync = syncVideo && (viewOnly.value || isPreviewMode.value);
    if (presentationSync) {
      const navChapter = resolvePresentationNavChapter(ch);
      const targetTime = options?.seekTime ?? navChapter.startTime;
      const shouldPlay =
        options?.autoplay ?? options?.keepPlaying ?? presentationPlaybackSession.intent === "play";
      commandPresentationPlayback({
        targetTime,
        intent: shouldPlay ? "play" : "pause",
        navChapter,
        autoAdvance: shouldPlay
      });
      return;
    }
    const navChapter = presentationSync ? resolvePresentationNavChapter(ch) : ch;
    const playableChapter = presentationSync
      ? resolvePlayableChapterForPresentationAtTime(navChapter, options?.seekTime ?? navChapter.startTime)
      : navChapter;
    const navResolved = resolveChapter(navChapter);
    const playableResolved = resolveChapter(playableChapter);
    if (!navResolved || !playableResolved) return;

    const { chapter: navCh, idx: navIdx } = navResolved;
    const { chapter: playableCh } = playableResolved;
    let video = videoEl.value;
    const playbackReq = ++chapterPlaybackRequestSeq;
    let switchedVideoSource = false;

    // 先上锁再换片源：防止 load/timeupdate 在锁外用旧时间套到其它视频的动画
    presentationChapterTransition = true;
    videoChapterSyncPaused = true;
    stopChapterAnimation();
    if (
      playableCh.parentId &&
      chapterPlayTarget.value?.parentId &&
      chapterPlayTarget.value.parentId !== playableCh.parentId
    ) {
      chapterPlayTarget.value = null;
      editPlaybackSyncChapterId = null;
      editPlaybackSyncElapsed = -1;
      chAnimChapterId = null;
      lastVideoPlaybackSyncTime = Number.POSITIVE_INFINITY;
      invalidateChapterAnimTargetsCache();
    }

    if (syncVideo && playableCh.parentId) {
      const targetVideo = getNodeById(nodes.value, playableCh.parentId);
      if (targetVideo && isVideoNode(targetVideo) && targetVideo.videoSrc) {
        if (activeVideoId.value !== targetVideo.id) {
          activeVideoId.value = targetVideo.id;
          const storedDur = targetVideo.videoDuration;
          if (Number.isFinite(storedDur) && storedDur > 0) duration.value = storedDur;
          showVideoPip.value = true;
        }
        // 仅当真实换源时才算 switched；同源 url 不重新 load、不等待。
        switchedVideoSource = syncVideoElementSrc(targetVideo.videoSrc);
        video = videoEl.value;
      }
    }

    if (syncVideo && video && (switchedVideoSource || video.readyState < HTMLMediaElement.HAVE_METADATA)) {
      await waitForVideoReady();
      if (playbackReq !== chapterPlaybackRequestSeq) return;
      video = videoEl.value;
    }

    if (viewOnly.value || isPreviewMode.value) {
      syncPresentationUiFromChapter(navChapter);
    }

    if (!syncVideo) {
      presentationChapterTransition = false;
      videoChapterSyncPaused = false;
      if (selectedChapterId.value !== playableCh.id) {
        navigateToChapter(playableCh, navIdx, {
          seek: false,
          previewAnimation: true,
          cameraMode: "playback",
          visualElapsed: 0
        });
      } else {
        restartChapterPreviewPlayback(playableCh);
      }
      return;
    }

    if (!viewOnly.value && !isPreviewMode.value) {
      // 仅当目标就是当前正在编辑的节点且确有未落盘改动时再写入，
      // 避免切到未编辑节点播放时把上一节点残留状态持久化进去。
      if (
        selectedChapterId.value === playableCh.id &&
        selModel.value &&
        animSegmentsBelongToChapter(playableCh.id) &&
        hasUnstagedActiveModelEdits()
      ) {
        persistActiveChapterDrafts(playableCh);
      }
    }

    const autoplay = options?.autoplay ?? true;
    const keepPlaying = !!(options?.keepPlaying && video && !video.ended);
    debugViewPlayback("startChapterPlayback:begin", {
      clickedChapterId: ch.id,
      clickedChapterName: ch.name,
      navChapterId: navCh.id,
      navChapterName: navCh.name,
      resolvedChapterId: playableCh.id,
      resolvedChapterName: playableCh.name,
      syncVideo,
      autoplay,
      keepPlaying,
      userGesture: !!options?.userGesture,
      chapterHasAnimation: chapterHasAnimation(playableCh),
      chapterAnimTargets: getChapterAnimTargetsCached(playableCh).length
    });

    let target =
      options?.seekTime ??
      (syncVideo && (viewOnly.value || isPreviewMode.value) ? navCh.startTime : playableCh.startTime);
    if (syncVideo && (viewOnly.value || isPreviewMode.value) && options?.seekTime === undefined) {
      target = Math.max(
        navCh.startTime,
        Math.min(target, navCh.endTime - CHAPTER_END_EPS)
      );
    }
    const visualElapsed = Math.max(0, target - playableCh.startTime);
    const needsSeek = !!(video && Math.abs(video.currentTime - target) >= CHAPTER_TIME_EPS);
    ++seekGeneration;

    chapterAutoNext.value = true;
    if (viewOnly.value || isPreviewMode.value) {
      // 先更新进度条反馈，再等待媒体 seek 完成，避免点击后绿色进度停留在旧位置。
      commitPresentationSeekTarget(target, video);
      if (autoplay || keepPlaying) {
        if (video) claimPresentationPlaybackGesture(video);
      }
    }

    try {
      chapterPlayTarget.value = playableCh;
      lastPresentationAutoSwitchChapterId = playableCh.id;
      syncPresentationUiFromChapter(navCh, target);

      navigateToChapter(navCh, navIdx, {
        seek: false,
        cameraMode: "playback",
        visualElapsed,
        holdCurrentTime: true
      });
      if (viewOnly.value || isPreviewMode.value) {
        applyChapterCameraForNav(navCh, "playback");
      }
      syncChapterVisualState(playableCh, visualElapsed, {
        skipOutlineRebuild: false,
        skipOverlaySync: false,
        immediatePresent: true
      });
      if (chapterNeedsOutlineRebuild(playableCh)) {
        refreshChapterOutlines(playableCh);
      }
      if (visualElapsed <= CHAPTER_TIME_EPS) {
        prepareChapterForPreviewPlayback(playableCh);
      } else {
        invalidateChapterAnimTargetsCache(playableCh.id);
      }
      if (playbackReq !== chapterPlaybackRequestSeq) return;

      if (!video) {
        chapterPlayTarget.value = playableCh;
        syncPresentationUiFromChapter(navCh, target);
        currentTime.value = target;
        if (chapterHasAnimation(playableCh)) {
          runChapterAnimationWallclock(playableCh);
        }
        return;
      }

      if (!keepPlaying && !autoplay) {
        video.pause();
      }

      let seekOk = true;
      if (needsSeek) {
        const shouldResume = !!(autoplay || keepPlaying);
        if (viewOnly.value || isPreviewMode.value) {
          // 展示/预览：统一走不断播 seek + 强制续播（禁止 pause→seek）
          seekOk = await seekPresentationMedia(target, shouldResume, {
            requestSeq: playbackReq,
            preferContinuous: isPlaying.value || !video.paused
          });
          if (playbackReq !== chapterPlaybackRequestSeq) return;
        } else {
          const pauseDuringSeek = isCoarsePointerDevice() ? true : !shouldResume;
          seekOk = await seekVideoTo(target, { pause: pauseDuringSeek });
          if (playbackReq !== chapterPlaybackRequestSeq) return;
          if (!seekOk && !isSeekNearTarget(video, target)) {
            seekOk = await seekVideoTo(target, { pause: true });
            if (playbackReq !== chapterPlaybackRequestSeq) return;
          }
          seekOk = seekOk || isSeekNearTarget(video, target);
        }
        debugViewPlayback("startChapterPlayback:seek-complete", {
          chapterId: playableCh.id,
          navChapterId: navCh.id,
          target,
          currentTime: video.currentTime,
          seekOk
        });
      } else if (!autoplay && !keepPlaying) {
        video.pause();
      }

      if (!seekOk) {
        debugViewPlayback("startChapterPlayback:seek-abort", {
          chapterId: playableCh.id,
          navChapterId: navCh.id,
          target,
          currentTime: video.currentTime
        });
        chapterPlayTarget.value = playableCh;
        syncPresentationUiFromChapter(navCh, target);
        // 失败时用真实时间；展示态若仍要续播则不要强制 pause/清 expectPlaying。
        const shouldResume = !!(autoplay || keepPlaying);
        if (!(viewOnly.value || isPreviewMode.value) || !shouldResume) {
          video.pause();
          currentTime.value = video.currentTime;
        } else {
          currentTime.value = isPresentationSeekAcceptable(video, target) ? video.currentTime : target;
          presentationExpectPlaying = true;
          isPlaying.value = true;
          await forceResumeVideoPlayback(video, { requestSeq: playbackReq });
          if (playbackReq !== chapterPlaybackRequestSeq) return;
        }
        syncChapterVisualState(playableCh, Math.max(0, (video.currentTime || target) - playableCh.startTime), {
          skipOutlineRebuild: false,
          skipOverlaySync: false
        });
        if (chapterNeedsOutlineRebuild(playableCh)) {
          refreshChapterOutlines(playableCh);
        }
        if ((viewOnly.value || isPreviewMode.value) && shouldResume) {
          showPresentationPlaybackHint();
        } else if (viewOnly.value || isPreviewMode.value) {
          presentationExpectPlaying = false;
          clearPresentationResumeTimer();
          showPresentationPlaybackHint();
        }
        return;
      }

      chapterPlayTarget.value = playableCh;
      const committedTime = commitPresentationSeekTarget(target, video);
      syncPresentationUiFromChapter(navCh, committedTime);
      const actualElapsed = Math.max(0, committedTime - playableCh.startTime);
      syncChapterVisualState(playableCh, actualElapsed, {
        skipOutlineRebuild: false,
        skipOverlaySync: false,
        immediatePresent: true
      });
      if (chapterNeedsOutlineRebuild(playableCh)) {
        refreshChapterOutlines(playableCh);
      }

      if (!autoplay) {
        if (viewOnly.value || isPreviewMode.value) {
          presentationExpectPlaying = false;
          clearPresentationResumeTimer();
          showPresentationPlaybackHint();
        }
        return;
      }

      // 展示路径里 seekPresentationMedia 已续播；编辑路径或其他仍 paused 时再强制续播。
      const played = await forceResumeVideoPlayback(video, { requestSeq: playbackReq });
      if (playbackReq !== chapterPlaybackRequestSeq) return;
      if (played) {
        // 禁止“播完后再 pause 修正”——移动端会丢掉播放权导致停在点击位置。
        if (
          (viewOnly.value || isPreviewMode.value) &&
          !isSeekNearTarget(video, target)
        ) {
          const repaired = await seekVideoTo(target, { pause: false });
          if (playbackReq !== chapterPlaybackRequestSeq) return;
          if (repaired || isSeekNearTarget(video, target)) {
            if (isPresentationSeekAcceptable(video, target)) {
              presentationSeekTargetTime = null;
              currentTime.value = video.currentTime;
            } else {
              presentationSeekTargetTime = target;
              currentTime.value = target;
            }
            await forceResumeVideoPlayback(video, { requestSeq: playbackReq });
            if (playbackReq !== chapterPlaybackRequestSeq) return;
          }
        }
        stopChapterAnimation();
        // 必须钉住目标章重刷，禁止 ensure/sync 按「可能仍是旧时间」的 currentTime 解析上一章
        startVideoSyncedChapterAnimation(playableCh);
        debugViewPlayback("startChapterPlayback:play-success", {
          chapterId: playableCh.id,
          navChapterId: navCh.id,
          currentTime: video.currentTime,
          chapterPlayTargetId: chapterPlayTarget.value?.id ?? null
        });
      } else {
        syncChapterVisualState(playableCh, Math.max(0, video.currentTime - playableCh.startTime), {
          skipOutlineRebuild: false,
          skipOverlaySync: false,
          immediatePresent: true
        });
        if (viewOnly.value || isPreviewMode.value) {
          // 不立刻放弃：finally 里还会 schedule 续播。
          debugViewPlayback("startChapterPlayback:play-pending", {
            chapterId: playableCh.id,
            navChapterId: navCh.id,
            currentTime: video.currentTime,
            chapterPlayTargetId: chapterPlayTarget.value?.id ?? null
          });
        }
      }
    } finally {
      if (playbackReq === chapterPlaybackRequestSeq) {
        presentationChapterTransition = false;
        videoChapterSyncPaused = false;
        presentationChapterCooldownUntil = performance.now() + 800;
        const activeVideo = videoEl.value;
        if (viewOnly.value || isPreviewMode.value) {
          if (activeVideo && isPresentationSeekAcceptable(activeVideo, target)) {
            presentationSeekTargetTime = null;
            currentTime.value = activeVideo.currentTime;
          } else {
            presentationSeekTargetTime = target;
            currentTime.value = target;
          }
        } else if (activeVideo && isSeekNearTarget(activeVideo, target)) {
          currentTime.value = activeVideo.currentTime;
        }
        // 编辑态：时间仍早于目标章时继续钉住 playTarget，防止旧 currentTime 回刷显示态
        if (!viewOnly.value && !isPreviewMode.value) {
          const stillBeforeTarget =
            !!activeVideo && activeVideo.currentTime < playableCh.startTime - CHAPTER_TIME_EPS;
          chapterPlayTarget.value = stillBeforeTarget ? playableCh : null;
          editPlaybackSyncChapterId = playableCh.id;
          editPlaybackSyncElapsed = Math.max(
            0,
            (activeVideo?.currentTime ?? target) - playableCh.startTime
          );
          // 未续播：编辑态一律回到起始帧预览（与节点播放按钮初始态一致）
          if (!autoplay && !keepPlaying) {
            chapterPlayTarget.value = null;
            _chAnimLock = false;
            chAnimWallclock = false;
            setEditModeActiveChapter(playableCh);
            syncChapterMetaForm(playableCh);
            applyChapterEditorVisualState(playableCh);
          } else {
            setEditModeActiveChapter(playableCh);
          }
        } else if (chapterPlayTarget.value) {
          lastPresentationAutoSwitchChapterId = chapterPlayTarget.value.id;
        }
        if ((viewOnly.value || isPreviewMode.value) && (autoplay || keepPlaying) && presentationExpectPlaying) {
          schedulePresentationPlaybackResume(playbackReq);
        }
      }
    }
  }

  function jumpToChapter(ch: Chapter, seekTime?: number) {
    const video = videoEl.value;
    const presentation = viewOnly.value || isPreviewMode.value;
    // 展示页：播放意图只由播放按钮/双击切换；列表与导航只改起点，不改 play/pause。
    const wasPlaying = presentation
      ? presentationPlaybackSession.intent === "play"
      : !!(video && !video.paused && !video.ended);
    const navChapter =
      presentation ? resolvePresentationNavChapter(ch) : ch;
    let targetTime = seekTime ?? navChapter.startTime;
    if (viewOnly.value || isPreviewMode.value) {
      targetTime = Math.max(
        navChapter.startTime,
        Math.min(targetTime, navChapter.endTime - CHAPTER_END_EPS)
      );
      commandPresentationPlayback({
        targetTime,
        intent: wasPlaying ? "play" : "pause",
        navChapter,
        autoAdvance: wasPlaying
      });
      return;
    }
    void startChapterPlayback(ch, {
      syncVideo: true,
      autoplay: wasPlaying,
      userGesture: true,
      keepPlaying: wasPlaying,
      seekTime: targetTime
    });
  }

  function prevCh() {
    if (!videoEl.value || !hasChapters.value) return;
    if (viewOnly.value || isPreviewMode.value) {
      navigatePresentationChapter(-1);
      return;
    }

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
      void startChapterPlayback(timelineChapters.value[prevIdx], {
        syncVideo: true,
        autoplay: !videoEl.value.paused || isPlaying.value,
        userGesture: true,
        keepPlaying: !videoEl.value.paused || isPlaying.value
      });
    }
  }

  function nextCh() {
    if (!videoEl.value || !hasChapters.value) return;
    if (viewOnly.value || isPreviewMode.value) {
      navigatePresentationChapter(1);
      return;
    }

    const t = videoEl.value.currentTime;
    const ci = findChIdx(t);
    let nextIdx = -1;
    if (ci >= 0 && ci < timelineChapters.value.length - 1) {
      nextIdx = ci + 1;
    } else if (ci === -1) {
      nextIdx = timelineChapters.value.findIndex(c => c.startTime > t + CHAPTER_TIME_EPS);
    }
    if (nextIdx < 0) return;
    void startChapterPlayback(timelineChapters.value[nextIdx], {
      syncVideo: true,
      autoplay: !videoEl.value.paused,
      userGesture: true
    });
  }

  function toggleLoop() {
    isLooping.value = !isLooping.value;
    if (videoEl.value) videoEl.value.loop = resolveEffectiveVideoLoop();
    toastShow(isLooping.value ? "循环播放 开" : "循环播放 关", "success");
  }

  function saveTitle() {
    if (currProj.value) pStore.updateProject({ title: projectTitle.value } as any);
  }

  function createNewSceneDraft() {
    const proj = currProj.value;
    if (!proj) return;
    const newTitle = "未命名场景";

    stopChapterAnimation();
    cancelPendingChapterNavWork();
    cancelCameraTransitionSilently();
    chapterPlayTarget.value = null;
    chapterAutoNext.value = false;
    resetPresentationPlaybackSession(0);
    presentationUiChapterId.value = null;
    presentationNavIndex.value = -1;
    presentationUiRevision.value = 0;
    lastPresentationAutoSwitchChapterId = null;
    presentationManualNavUntil = 0;
    chapterNavLock.value = false;

    ensureProjectNodes(proj);
    proj.videoSrc = null;
    proj.videoDuration = 0;
    proj.videoWidth = 0;
    proj.videoHeight = 0;
    proj.videoDisplayWidth = 0;
    proj.nodes = [];
    proj.subtitles = [];

    sceneCode.value = null;
    shareLink.value = "";
    sceneSavedAt.value = "";
    projectTitle.value = newTitle;
    proj.title = newTitle;
    pStore.updateProject({ title: newTitle } as any);

    currentTime.value = 0;
    duration.value = 0;
    isPlaying.value = false;
    playingIdx.value = -1;
    selectedNodeId.value = null;
    selectedChapterId.value = null;
    activeVideoId.value = null;
    videoOnlyMode.value = false;
    showVideoPip.value = false;
    displaySubtitle.value = false;
    clearVideoElementSrc({ silent: true });
    selectionEditDrafts.clear();
    editPlaybackSyncChapterId = null;
    editPlaybackSyncElapsed = -1;
    resetLiveAnimEditorBuffers();
    resetAllModelsToDefault();
    syncIntroPresentation();

    markSceneAsSavedBaseline();
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

  function normalizeModelAssetKey(input: { path?: string | null; url?: string | null; name?: string | null }): string {
    const raw = input.path || input.url || "";
    if (raw) {
      try {
        const pathname = raw.startsWith("http") ? new URL(raw).pathname : raw;
        return pathname.replace(/\\/g, "/").replace(/^\/+/, "").toLowerCase();
      } catch {
        return raw.replace(/\\/g, "/").replace(/^\/+/, "").toLowerCase();
      }
    }
    return (input.name || "").replace(/\..*$/, "").trim().toLowerCase();
  }

  function findExistingModelByAsset(item: { path?: string; name?: string }): Model | undefined {
    if (!currProj.value) return undefined;
    const key = normalizeModelAssetKey({ path: item.path, name: item.name });
    if (!key) return undefined;
    return currProj.value.models.find(m => normalizeModelAssetKey({ path: getModelSourcePath(m), url: m.url, name: m.name }) === key);
  }

  function dedupeProjectModelsByAsset() {
    if (!currProj.value) return;
    const seen = new Set<string>();
    const keep: Model[] = [];
    for (const m of currProj.value.models) {
      const key = normalizeModelAssetKey({ path: getModelSourcePath(m), url: m.url, name: m.name });
      if (!key) {
        keep.push(m);
        continue;
      }
      if (seen.has(key)) {
        rmMesh(m.id);
        continue;
      }
      seen.add(key);
      keep.push(m);
    }
    currProj.value.models = keep;
  }

  function pruneProjectModelsOutsideModelSet(setItems: Array<{ path?: string; name?: string }>) {
    if (!currProj.value) return;
    const allowed = new Set(
      setItems.map(item => normalizeModelAssetKey({ path: item.path, name: item.name })).filter(Boolean)
    );
    if (allowed.size === 0) return;
    currProj.value.models = currProj.value.models.filter(m => {
      const key = normalizeModelAssetKey({ path: getModelSourcePath(m), url: m.url, name: m.name });
      if (key && allowed.has(key)) return true;
      rmMesh(m.id);
      return false;
    });
  }

  async function ensureModelLoaded(m: Model) {
    if (!meshes.has(m.id)) await loadGLB(m);
    if (meshes.has(m.id)) refreshModelHierarchyIfLoaded(m.id, m.name);
  }

  function buildShareLink(code: string) {
    return buildScenePreviewLink(code);
  }

  function stripRuntimeAnimFieldsFromChapters(chapterList: Chapter[]) {
    for (const ch of chapterList) {
      if (!ch.modelConfigs) continue;
      for (const cfg of Object.values(ch.modelConfigs)) {
        stripRuntimeAnimFieldsFromConfig(cfg as ModelConfig);
      }
    }
  }

  function stripRuntimeAnimFieldsFromConfig(cfg: ModelConfig) {
    const segs = cfg.animConfig?.segments;
    if (segs) {
      for (const seg of segs as any[]) {
        delete seg._animPivotCache;
        delete seg._playing;
        delete seg._progress;
        delete seg._expandedPanels;
      }
    }
    if (cfg.nodeConfigs) {
      for (const nodeCfg of Object.values(cfg.nodeConfigs)) {
        stripRuntimeAnimFieldsFromConfig(nodeCfg as ModelConfig);
      }
    }
  }

  function sanitizeChaptersForModels(chapterList: Chapter[], modelIds: Set<string>) {
    for (const ch of chapterList) {
      if (!ch.modelConfigs) continue;
      for (const id of Object.keys(ch.modelConfigs)) {
        if (!modelIds.has(id)) delete ch.modelConfigs[id];
      }
    }
  }

  function buildSceneDraftSignature() {
    const proj = currProj.value;
    if (!proj) return "";
    ensureProjectNodes(proj);
    const modelIds = new Set(proj.models.map(m => m.id));
    const nodeList = JSON.parse(JSON.stringify(proj.nodes)) as SceneNode[];
    const animations = getAnimationNodes(nodeList);
    sanitizeChaptersForModels(animations, modelIds);
    stripRuntimeAnimFieldsFromChapters(animations);
    const firstVideo = nodeList.find(n => n.type === "video");
    return JSON.stringify({
      title: projectTitle.value.trim() || editSceneToolName.value.trim() || "未命名场景",
      videoSrc: firstVideo && firstVideo.type === "video" ? firstVideo.videoSrc : proj.videoSrc,
      videoDuration: firstVideo && firstVideo.type === "video" ? firstVideo.videoDuration : proj.videoDuration,
      videoWidth: firstVideo && firstVideo.type === "video" ? firstVideo.videoWidth : proj.videoWidth,
      videoHeight: firstVideo && firstVideo.type === "video" ? firstVideo.videoHeight : proj.videoHeight,
      videoDisplayWidth:
        firstVideo && firstVideo.type === "video" ? firstVideo.videoDisplayWidth : proj.videoDisplayWidth || 0,
      nodes: nodeList,
      subtitles: JSON.parse(JSON.stringify(proj.subtitles)),
      models: proj.models.map(m => ({
        id: m.id,
        name: m.name,
        type: m.type,
        color: m.color,
        path: getModelSourcePath(m),
        basePosition: m.basePosition
      })),
      sceneSettings: collectSceneSettingsData()
    });
  }

  function buildScenePayload() {
    const proj = currProj.value;
    if (!proj) return null;
    ensureProjectNodes(proj);
    const modelIds = new Set(proj.models.map(m => m.id));
    const nodeList = JSON.parse(JSON.stringify(proj.nodes)) as SceneNode[];
    const animations = getAnimationNodes(nodeList);
    sanitizeChaptersForModels(animations, modelIds);
    stripRuntimeAnimFieldsFromChapters(animations);
    const firstVideo = nodeList.find(n => n.type === "video");
    return {
      schemaVersion: SCHEMA_VERSION,
      title: syncProjectTitleToStore(),
      modelSetCode: modelSetCode.value || undefined,
      videoSrc: firstVideo && firstVideo.type === "video" ? firstVideo.videoSrc : proj.videoSrc,
      videoDuration: firstVideo && firstVideo.type === "video" ? firstVideo.videoDuration : proj.videoDuration,
      videoWidth: firstVideo && firstVideo.type === "video" ? firstVideo.videoWidth : proj.videoWidth,
      videoHeight: firstVideo && firstVideo.type === "video" ? firstVideo.videoHeight : proj.videoHeight,
      videoDisplayWidth:
        firstVideo && firstVideo.type === "video" ? firstVideo.videoDisplayWidth : proj.videoDisplayWidth || 0,
      nodes: nodeList,
      subtitles: JSON.parse(JSON.stringify(proj.subtitles)),
      models: proj.models.map(m => ({
        id: m.id,
        name: m.name,
        type: m.type,
        color: m.color,
        path: getModelSourcePath(m),
        basePosition: m.basePosition
      })),
      sceneSettings: collectSceneSettingsData()
    };
  }

  function clearEditorThreeScene() {
    clearModelConfigOutlineRegistry();
    [...meshes.keys()].forEach(id => rmMesh(id));
    mixers.forEach(m => m.stopAllAction());
    mixers = [];
    invalidatePickMeshCache();
  }

  function clearAllEditorModels() {
    clearEditorThreeScene();
    if (currProj.value) {
      currProj.value.models = [];
      currProj.value.nodes = [];
      currProj.value.subtitles = [];
    }
    selectedChapterId.value = null;
    selectedNodeId.value = null;
    activeVideoId.value = null;
    selModelId.value = null;
    selModelNodeId.value = null;
    lastSelModelId = null;
  }

  async function rehydrateEditorSessionFromProject() {
    const proj = currProj.value;
    ensureProjectNodes(proj);
    const firstVideo = proj?.nodes.find(n => n.type === "video" && n.videoSrc);
    if (!firstVideo || firstVideo.type !== "video") return false;

    sceneNodeApi.setActiveVideo(firstVideo.id);
    syncVideoElementSrc();
    duration.value = firstVideo.videoDuration || 0;

    for (const m of models.value) {
      if (m.url && !meshes.has(m.id)) await loadGLB(m);
    }
    for (const m of models.value) {
      refreshModelHierarchyIfLoaded(m.id, m.name);
    }
    dedupeProjectModelsByAsset();
    ensureAllModelMixers();
    layoutEditorGizmosNearScene();

    // 刷新/恢复会话：不默认选中动画，只框选模型到视野。
    selectedChapterId.value = null;
    selectedNodeId.value = null;
    resetAllModelsToDefault();
    if (meshes.size > 0) {
      frameCameraOnSceneModels(0);
    }

    editSceneLinkEntry.value = false;
    modelSetModelsLoaded.value = true;
    return true;
  }

  function applyChapterCameraForLoadedModels() {
    // 仅恢复相机框选，不自动选中任何动画节点
    if (meshes.size === 0) return;
    if (selectedChapter.value) {
      const ch = selectedChapter.value;
      const dur = getChapterCameraTransitionSec(ch);
      if (isDefaultChapterCamera(ch)) frameCameraOnSceneModels(dur, ch);
      else applyChapterCameraForNav(ch, "edit");
      return;
    }
    frameCameraOnSceneModels(0);
  }

  async function loadModelSetByCode(code: string) {
    if (!currProj.value || modelSetModelsLoaded.value) return;
    sceneBootstrapBusy.value = true;
    try {
      const set = await fetchModelSet(code);
      modelSetCode.value = set.code;
      editSceneCompanyName.value = set.companyName || "";
      editSceneToolName.value = set.name || "";
      modelSetModelsLoaded.value = true;
      pendingModelSetCode.value = null;

      const setItems = set.models || [];
      dedupeProjectModelsByAsset();
      pruneProjectModelsOutsideModelSet(setItems);

      suspendProjectPersist();
      importingModel.value = true;
      try {
        for (const item of setItems) {
          const existing = findExistingModelByAsset(item);
          if (existing) {
            adoptSceneModelIdentity(existing, item);
            await ensureModelLoaded(existing);
            continue;
          }
          const url = resolveAssetUrl(item.path);
          const m = mStore.createCustomModel(currProj.value.id, item.name, url);
          adoptSceneModelIdentity(m, item);
          await loadGLB(m);
          if (meshes.has(m.id)) {
            currProj.value.models.push(m);
            refreshModelHierarchyIfLoaded(m.id, m.name);
          }
        }
        dedupeProjectModelsByAsset();
        ensureAllModelMixers();
        await finalizeSceneVisualBootstrap();
        if (meshes.size > 0) applyChapterCameraForLoadedModels();
      } finally {
        importingModel.value = false;
        resumeProjectPersist();
      }
    } finally {
      sceneBootstrapBusy.value = false;
    }
  }

  function adoptSceneModelIdentity(
    m: Model,
    item: { id?: string; path?: string; basePosition?: [number, number, number] }
  ) {
    if (item.id) {
      m.id = item.id;
      const match = /^model_(\d+)$/.exec(item.id);
      if (match) {
        const num = Number(match[1]);
        if (Number.isFinite(num)) {
          mStore.modelIdCounter = Math.max(mStore.modelIdCounter, num);
        }
      }
    }
    if (item.path) (m as any).sourcePath = item.path;
    if (Array.isArray(item.basePosition)) m.basePosition = item.basePosition;
  }

  /** 将当前选中模型的 mesh 变换同步到章节配置（mesh 为位移/缩放的真实来源） */
  function syncActiveModelTransformFromMesh(ch: Chapter) {
    if (!selModel.value) return;
    const model = selModel.value;
    const target = getTransformTarget(model.id, selModelNodeId.value);
    if (!target) return;
    const cfg = getWritableModelConfigForTarget(ch, model.id, selModelNodeId.value);
    const isRoot = !selModelNodeId.value;
    const bp = isRoot
      ? (target.userData.basePos || model.basePosition || DEFAULT_MODEL_BASE_POSITION)
      : (target.userData.baseLocalPos || [0, 0, 0]);
    cfg.posOffset = [
      round3(target.position.x - bp[0]),
      round3(target.position.y - bp[1]),
      round3(target.position.z - bp[2])
    ];
    cfg.scale = round3(target.scale.x);
    cfg.visible = target.visible !== false;
    mOff[0] = cfg.posOffset[0];
    mOff[1] = cfg.posOffset[1];
    mOff[2] = cfg.posOffset[2];
    mScl.value = cfg.scale;
    mVis.value = cfg.visible;
  }

  function hasUnstagedActiveModelEdits(): boolean {
    if (!selModel.value) return false;
    if (!animSegmentsBelongToCurrentSelection()) return formSnapshotHasVisualEdits(getModelFormSnapshot());
    return liveAnimSegmentsHaveEdits() || formSnapshotHasVisualEdits(getModelFormSnapshot());
  }

  /** 将指定目标的编辑写入章节（切换选中时传入上一选中项，避免串目标） */
  function stashActiveModelConfigToChapterFor(
    ch: Chapter,
    target?: { modelId: string; nodeId: string | null }
  ) {
    const modelId = target?.modelId ?? selModel.value?.id;
    const nodeId = target !== undefined ? target.nodeId : selModelNodeId.value;
    if (!modelId) return;
    const model = models.value.find(m => m.id === modelId);
    if (!model) return;

    const ownerKey = selectionOwnerKey(modelId, nodeId);
    const segmentsForTarget =
      animSegmentsOwnerKey === ownerKey && animSegments.length > 0 ? animSegments : null;
    const formMatchesTarget = !target || selectionOwnerKey() === ownerKey;

    const hasAnimEdits = !!(
      segmentsForTarget && animSegmentsHaveRealEdits(segmentsForTarget, model, nodeId ?? null)
    );
    const snapshot = getModelFormSnapshot();
    const hasVisualEdits = formMatchesTarget && formSnapshotHasVisualEdits(snapshot);

    if (!hasAnimEdits && !hasVisualEdits) {
      pruneActiveTargetModelConfigIfUnedited(ch, modelId, nodeId ?? null);
      return;
    }

    if (hasAnimEdits && segmentsForTarget) {
      persistAnimConfigToChapterFor(ch, modelId, nodeId ?? null, segmentsForTarget);
    }

    if (formMatchesTarget) {
      const targetCfg = getWritableModelConfigForTarget(ch, modelId, nodeId ?? null);
      targetCfg.visible = snapshot.visible;
      targetCfg.outline = snapshot.outline;
      targetCfg.wireframe = snapshot.wireframe;
      targetCfg.highlight = snapshot.highlight;
      targetCfg.outlineColor = snapshot.outlineColor;
      targetCfg.wireframeColor = snapshot.wireframeColor;
      targetCfg.modelHighlightColor = snapshot.modelHighlightColor;
      targetCfg.animation = snapshot.animation;
      targetCfg.intro = snapshot.intro;
      targetCfg.scale = snapshot.scale;

      if (hasVisualEdits) {
        syncActiveModelTransformFromMesh(ch);
      }
    }

    invalidateChapterAnimTargetsCache(ch.id);
  }

  /** 将当前编辑中的模型配置写入内存中的节点数据（不触发服务端保存、不弹 toast） */
  function stashActiveModelConfigToChapter() {
    if (!selectedChapter.value) return;
    stashActiveModelConfigToChapterFor(selectedChapter.value);
  }

  async function tryLoadPendingModelSet() {
    const code = pendingModelSetCode.value;
    if (
      !code ||
      viewOnly.value ||
      !currProj.value ||
      modelSetModelsLoaded.value ||
      sceneBootstrapBusy.value
    ) {
      return;
    }
    await loadModelSetByCode(code);
  }

  async function applyFetchedSceneData(sceneData: any, code: string, options?: { manageBusy?: boolean }) {
    const manageBusy = options?.manageBusy !== false;
    if (manageBusy) sceneBootstrapBusy.value = true;
    sceneLightsPinnedFromSettings = false;
    try {
      const proj = currProj.value || pStore.createProject(sceneData.title || "未命名场景");
      projectTitle.value = sceneData.title || proj.title;
      proj.title = projectTitle.value;
      if (viewOnly.value) {
        setPageTitle(projectTitle.value);
        viewCameraBaseFov = null;
      }
      sceneCode.value = sceneData.code || code;
      sceneSavedAt.value = sceneData.updatedAt || sceneData.createdAt || "";
      modelSetCode.value = sceneData.modelSetCode || null;
      modelSetModelsLoaded.value = true;
      pendingModelSetCode.value = null;
      shareLink.value = sceneData.previewUrl
        ? rewireEditorFrontendHost(sceneData.previewUrl)
        : buildShareLink(sceneData.code || code);
      proj.videoSrc = sceneData.videoSrc ? resolveAssetUrl(sceneData.videoSrc) : null;
      proj.videoDuration = sceneData.videoDuration || 0;
      proj.videoWidth = sceneData.videoWidth || 0;
      proj.videoHeight = sceneData.videoHeight || 0;
      proj.videoDisplayWidth = sceneData.videoDisplayWidth || 0;
      if (Array.isArray(sceneData.nodes) && sceneData.nodes.length) {
        proj.nodes = JSON.parse(JSON.stringify(sceneData.nodes));
        proj.schemaVersion = sceneData.schemaVersion || SCHEMA_VERSION;
      } else {
        proj.chapters = Array.isArray(sceneData.chapters)
          ? (JSON.parse(JSON.stringify(sceneData.chapters)) as Chapter[])
          : [];
      }
      ensureProjectNodes(proj);
      let clearedStaleBlobVideo = false;
      for (const node of proj.nodes) {
        if (node.type === "video" && node.videoSrc) {
          // 保留服务端相对路径，绑定播放时再 resolve；清理误存的 blob
          try {
            if (isTransientMediaUrl(node.videoSrc)) {
              node.videoSrc = null;
              clearedStaleBlobVideo = true;
              continue;
            }
            const u = node.videoSrc;
            if (/^https?:\/\//i.test(u)) {
              const parsed = new URL(u);
              node.videoSrc =
                parsed.pathname.replace(/^\/editor-api(?=\/|$)/, "") || node.videoSrc;
            } else {
              node.videoSrc = u.replace(/^\/editor-api(?=\/|$)/, "");
            }
          } catch {
            /* keep original */
          }
        }
      }
      if (clearedStaleBlobVideo) {
        toastShow("检测到未上传到服务器的临时视频，请重新上传视频后再保存", "warning");
      }
      if (isTransientMediaUrl(proj.videoSrc || "")) {
        proj.videoSrc = null;
      }
      proj.subtitles = Array.isArray(sceneData.subtitles)
        ? sceneData.subtitles.map((sub: Subtitle) => ({
            ...sub,
            parentNodeId: sub.parentNodeId || proj.nodes.find(n => n.type === "video")?.id || ""
          }))
        : [];
      proj.models = [];

      const loadedAssetKeys = new Set<string>();
      for (const item of sceneData.models || []) {
        if (!item.path) {
          const primitiveType = (item.type || "cube") as ModelType;
          if (primitiveType === "custom") continue;
          const m = mStore.createPrimitiveModel(proj.id, primitiveType, item.name || primitiveType);
          adoptSceneModelIdentity(m, item);
          if (item.color) m.color = item.color;
          createPrim(m);
          proj.models.push(m);
          continue;
        }
        const assetKey = normalizeModelAssetKey({ path: item.path, name: item.name });
        if (assetKey && loadedAssetKeys.has(assetKey)) continue;
        const url = resolveAssetUrl(item.path);
        const m = mStore.createCustomModel(proj.id, item.name, url);
        adoptSceneModelIdentity(m, item);
        await loadGLB(m);
        if (meshes.has(m.id)) {
          proj.models.push(m);
          refreshModelHierarchyIfLoaded(m.id, m.name);
          if (assetKey) loadedAssetKeys.add(assetKey);
        }
      }
      if (sceneData.sceneSettings) {
        await applySceneSettingsFromServer(sceneData.sceneSettings);
      }
      const loadedModelIds = new Set(proj.models.map(m => m.id));
      sanitizeChaptersForModels(getAnimationNodes(proj.nodes), loadedModelIds);
      stripRuntimeAnimFieldsFromChapters(getAnimationNodes(proj.nodes));
      dedupeProjectModelsByAsset();
      pruneAllChapterModelConfigs();
    } finally {
      if (manageBusy) sceneBootstrapBusy.value = false;
    }
  }

  async function syncEditorAfterSceneLoad() {
    // 编辑态刷新：只准备节点数据，不自动挂载/展示视频；视频仅在点击视频节点后显示
    const firstVideo = nodes.value.find(n => n.type === "video" && n.videoSrc);
    if (firstVideo && firstVideo.type === "video") {
      activeVideoId.value = firstVideo.id;
      const storedDur = firstVideo.videoDuration;
      if (Number.isFinite(storedDur) && storedDur > 0) duration.value = storedDur;
    }

    selectedChapterId.value = null;
    selectedNodeId.value = null;
    videoOnlyMode.value = false;
    showVideoPip.value = viewOnly.value || isPreviewMode.value;

    if (viewOnly.value || isPreviewMode.value) {
      if (firstVideo && firstVideo.type === "video" && firstVideo.videoSrc) {
        syncVideoElementSrc(firstVideo.videoSrc);
      } else if (videoSrc.value) {
        syncVideoElementSrc();
      }
      const roots = rootSceneNodes.value.filter(n => n.type === "group" || n.type === "video");
      const firstExpandable = roots.find(n => getChildNodes(nodes.value, n.id).length > 0);
      expandedNodeIds.value = firstExpandable ? new Set([firstExpandable.id]) : new Set();
    } else {
      // 编辑态：清空 video 元素，避免刷新后黑窗/加载失败闪现
      clearVideoElementSrc({ silent: true });
      const expanded = new Set<string>();
      for (const n of nodes.value) {
        if ((n.type === "group" || n.type === "video") && getChildNodes(nodes.value, n.id).length > 0) {
          expanded.add(n.id);
        }
      }
      expandedNodeIds.value = expanded;
    }

    resetAllModelsToDefault();
    await finalizeSceneVisualBootstrap();
    if (meshes.size > 0) {
      // 刷新后只框选模型到视野，不自动选中动画/打开视频
      frameCameraOnSceneModels(0);
    }

    if (videoEl.value && (viewOnly.value || isPreviewMode.value)) {
      videoEl.value.pause();
      videoEl.value.currentTime = 0;
    }
    currentTime.value = 0;
    isPlaying.value = false;
    syncVideoAudioState();
    await nextTick();
    handleResize();
    adaptPresentationViewport();
    markSceneAsSavedBaseline();
  }

  async function loadSceneByCode(code: string): Promise<"ok" | "not-found" | "error"> {
    sceneBootstrapBusy.value = true;
    try {
      clearAllEditorModels();
      const sceneData = await fetchScene(code);
      await applyFetchedSceneData(sceneData, code, { manageBusy: false });
      await syncEditorAfterSceneLoad();
      return "ok";
    } catch (e: any) {
      if (e?.status === 404) return "not-found";
      toastShow("加载场景失败: " + (e?.message || "未知错误"), "error");
      return "error";
    } finally {
      sceneBootstrapBusy.value = false;
    }
  }

  async function loadSceneForEdit(code: string): Promise<boolean> {
    sceneBootstrapBusy.value = true;
    try {
      clearAllEditorModels();
      const sceneData = await fetchScene(code);
      editSceneLinkEntry.value = false;
      await applyFetchedSceneData(sceneData, code, { manageBusy: false });
      await syncEditorAfterSceneLoad();
      isPreviewMode.value = false;
      await nextTick();
      handleResize();
      return true;
    } catch (e: any) {
      toastShow("加载场景失败: " + (e?.message || "未知错误"), "error");
      return false;
    } finally {
      sceneBootstrapBusy.value = false;
    }
  }

  async function hydrateSceneSettingsFromServer(modelSetCode: string, preferredSceneCode?: string | null) {
    try {
      const list = await fetchSceneList(modelSetCode);
      if (!list.length) return false;
      const target =
        (preferredSceneCode && list.find(item => item.code === preferredSceneCode)) ||
        (sceneCode.value && list.find(item => item.code === sceneCode.value)) ||
        list[0];
      if (!target?.code) return false;
      const sceneData = await fetchScene(target.code);
      if (sceneData.code) sceneCode.value = sceneData.code;
      if (sceneData.sceneSettings) {
        await applySceneSettingsFromServer(sceneData.sceneSettings);
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }

  async function restoreSceneSettingsForEditor(modelSetCode: string) {
    SETTINGS_KEY = getSceneSettingsStorageKey(modelSetCode);
    const restoredFromServer = await hydrateSceneSettingsFromServer(modelSetCode, sceneCode.value);
    if (restoredFromServer) {
      sceneLightsPinnedFromSettings = true;
      return;
    }
    const prevSkip = skipStoredSceneSettings;
    skipStoredSceneSettings = false;
    try {
      loadAllSettings();
      sceneLightsPinnedFromSettings = true;
      applySettings();
      applyGrid();
      applyFog();
      if (shadowEnabled.value) applyShadow();
      if (bloomIntensity.value > 0 || ppContrast.value !== 0 || ppSaturation.value !== 0) {
        toggleBloom();
        toggleColor();
      }
      applyAntialiasing();
      const settings = collectSceneSettingsData() as { envMapUrl?: string; envMapIsHdr?: boolean };
      if (settings.envMapUrl) {
        await loadEnvironmentMapFromUrlAsync(settings.envMapUrl, !!settings.envMapIsHdr);
      }
    } catch {
      /* ignore */
    } finally {
      skipStoredSceneSettings = prevSkip;
    }
  }

  async function tryLoadSavedSceneForModelSet(code: string): Promise<boolean> {
    try {
      const list = await fetchSceneList(code);
      if (!list.length) return false;
      return await loadSceneForEdit(list[0].code);
    } catch {
      return false;
    }
  }

  async function uploadTransientVideoSrc(src: string): Promise<string | null> {
    const live = unwrapTransientMediaUrl(src);
    if (!live || !live.startsWith("blob:")) return null;
    try {
      const r = await fetch(live);
      const b = await r.blob();
      if (!b || b.size <= 0) return null;
      const ext = (b.type.split("/")[1] || "mp4").replace(/[^a-z0-9]/gi, "").toLowerCase() || "mp4";
      const uploaded = await uploadSceneVideo(new File([b], `scene-video.${ext}`, { type: b.type || "video/mp4" }));
      return uploaded.path || uploaded.url || null;
    } catch (e) {
      console.warn("uploadTransientVideoSrc failed", e);
      return null;
    }
  }

  /** 保存前把各视频节点的 blob 上传为持久路径，避免刷新后失效 */
  async function persistVideoSourcesInPayload(payload: ReturnType<typeof buildScenePayload>) {
    if (!payload) return false;
    let ok = true;
    for (const node of payload.nodes) {
      if (node.type !== "video" || !node.videoSrc) continue;
      if (!isTransientMediaUrl(node.videoSrc)) continue;
      const path = await uploadTransientVideoSrc(node.videoSrc);
      if (!path) {
        ok = false;
        node.videoSrc = toPersistableAssetPath(node.videoSrc);
        continue;
      }
      node.videoSrc = path;
      const live = getNodeById(nodes.value, node.id);
      if (live && isVideoNode(live)) live.videoSrc = path;
    }
    const firstVideo = payload.nodes.find(n => n.type === "video" && n.videoSrc);
    payload.videoSrc =
      firstVideo && firstVideo.type === "video" ? firstVideo.videoSrc : toPersistableAssetPath(payload.videoSrc);
    if (currProj.value && payload.videoSrc) {
      currProj.value.videoSrc = payload.videoSrc;
    }
    return ok;
  }

  async function saveSceneToServer() {
    if (!currProj.value || chapters.value.length === 0) {
      toastShow("请先创建至少一个节点", "warning");
      return null;
    }
    persistAllChapterDrafts();
    const payload = buildScenePayload();
    if (!payload) return null;
    savingScene.value = true;
    try {
      const uploadedOk = await persistVideoSourcesInPayload(payload);
      if (!uploadedOk) {
        toastShow("有视频仍是本地临时文件且上传失败，请重新选择视频后再保存", "error");
        return null;
      }
      if (payload.nodes.some(n => n.type === "video" && isTransientMediaUrl(n.videoSrc || ""))) {
        toastShow("请先重新上传视频文件后再保存场景", "error");
        return null;
      }
      const result = sceneCode.value ? await updateSceneOnBackend(sceneCode.value, payload) : await saveSceneToBackend(payload);
      sceneCode.value = result.code;
      shareLink.value = result.previewUrl ? rewireEditorFrontendHost(result.previewUrl) : buildShareLink(result.code);
      sceneSavedAt.value = result.updatedAt || result.createdAt || new Date().toISOString();
      sceneListVersion.value += 1;
      void refreshSavedSceneCount();
      saveAllSettings();
      resumeProjectPersist();
      markSceneAsSavedBaseline();
      toastShow(sceneCode.value ? "场景已保存" : "场景已创建", "success");
      return result;
    } catch (e: any) {
      toastShow("保存失败: " + (e?.message || "未知错误"), "error");
      return null;
    } finally {
      savingScene.value = false;
    }
  }

  // Chapters — 点击瞬间：UI + 运镜；重计算下一帧执行，避免阻塞点击响应
  function cancelPendingChapterNavWork() {
    if (chapterNavFollowUpRaf) {
      cancelAnimationFrame(chapterNavFollowUpRaf);
      chapterNavFollowUpRaf = 0;
    }
  }

  function chapterNeedsOutlineRebuild(ch: Chapter) {
    if (!ch.modelConfigs) return false;
    for (const [modelId, raw] of Object.entries(ch.modelConfigs)) {
      if (!chapterModelHasEdits(ch, modelId)) continue;
      const cfg = getModelConfig(raw as ModelConfig);
      if (cfg.outline || cfg.highlight || cfg.wireframe) return true;
      if (cfg.nodeConfigs) {
        for (const nodeCfg of Object.values(cfg.nodeConfigs)) {
          const merged = getModelConfig({ ...defaultModelCfg(), ...nodeCfg } as ModelConfig);
          if (merged.outline || merged.highlight || merged.wireframe) return true;
        }
      }
    }
    return false;
  }

  function scheduleChapterOutlineIdleRefresh(chapter: Chapter, gen: number) {
    if (!chapterNeedsOutlineRebuild(chapter)) return;
    const run = () => {
      if (gen !== chapterNavGeneration) return;
      refreshChapterOutlines(chapter);
    };
    if (typeof requestIdleCallback === "function") {
      requestIdleCallback(run, { timeout: 1500 });
    } else {
      window.setTimeout(run, 500);
    }
  }

  function scheduleChapterNavDeferredWork(
    chapter: Chapter,
    gen: number,
    elapsed = 0,
    previewAnimation = false
  ) {
    chapterNavFollowUpRaf = requestAnimationFrame(() => {
      chapterNavFollowUpRaf = 0;
      if (gen !== chapterNavGeneration) return;
      invalidateChapterAnimPivotCaches(chapter);
      invalidateChapterAnimTargetsCache(chapter.id);
      if (!viewOnly.value && !isPreviewMode.value) {
        sanitizeChapterModelConfigs(chapter);
      }
      startChapterAnimPlayback(chapter, gen, { previewAnimation });
      scheduleChapterOutlineIdleRefresh(chapter, gen);
    });
  }

  function prefersVideoSyncedChapterAnim() {
    return viewOnly.value || isPreviewMode.value || !!chapterPlayTarget.value;
  }

  function startChapterAnimPlayback(chapter: Chapter, gen: number, options?: { previewAnimation?: boolean }) {
    if (gen !== chapterNavGeneration) return;

    const video = videoEl.value;
    if (video && !video.paused && !options?.previewAnimation) {
      ensureVideoSyncedChapterAnimation();
      return;
    }

    if (options?.previewAnimation) {
      prepareChapterForPreviewPlayback(chapter);
      if (chapterHasAnimation(chapter)) {
        runChapterAnimationWallclock(chapter);
      }
    }
  }

  function navigateToChapter(
    chapter: Chapter,
    idx: number,
    options?: {
      seek?: boolean;
      previewAnimation?: boolean;
      cameraMode?: ChapterCameraSwitchMode;
      visualElapsed?: number;
      holdCurrentTime?: boolean;
    }
  ) {
    // 必须在改 selectedChapterId 之前取出上一章并落盘
    const prevChapter =
      selectedChapterId.value && selectedChapterId.value !== chapter.id
        ? chapters.value.find(c => c.id === selectedChapterId.value) ?? null
        : null;
    if (prevChapter && !isPreviewMode.value && !viewOnly.value) {
      if (selModel.value && animSegmentsBelongToChapter(prevChapter.id)) {
        captureSelectionSession(prevChapter.id, selModel.value.id, selModelNodeId.value);
      }
      flushChapterDraftsToModelConfigs(prevChapter);
      sanitizeChapterModelConfigs(prevChapter);
    }

    // 切换节点后清空全部内存会话，避免新节点读到旧节点的草稿
    if (!prevChapter || prevChapter.id !== chapter.id) {
      selectionEditDrafts.clear();
      clearLiveAnimEditorState();
      editPlaybackSyncChapterId = null;
      editPlaybackSyncElapsed = -1;
    }

    stopChapterAnimation();
    cancelPendingChapterNavWork();
    cancelCameraTransitionSilently();
    chapterNavLock.value = true;
    const gen = ++chapterNavGeneration;
    const previewAnimation = options?.previewAnimation ?? false;
    const cameraMode = options?.cameraMode ?? "playback";
    const elapsed = options?.visualElapsed ?? resolveNavChapterElapsed(chapter, previewAnimation);

    selectedChapterId.value = chapter.id;
    playingIdx.value = idx;
    // 编辑态：树选中与章节选中必须同一 id，否则会出现「树高亮 A + 进度条高亮 B」
    if (!viewOnly.value && !isPreviewMode.value) {
      selectedNodeId.value = chapter.id;
      videoOnlyMode.value = false;
      if (chapter.parentId) activeVideoId.value = chapter.parentId;
    }
    if (!options?.holdCurrentTime) {
      currentTime.value = chapter.startTime;
    }

    // 切换动画前先取消模型选中，避免 live 段/表单与上一动画叠到当前章 mesh
    if (!viewOnly.value && !isPreviewMode.value && (selModelId.value || selModelNodeId.value)) {
      selModelNodeId.value = null;
      selModelId.value = null;
    }

    applyChapterCameraForNav(chapter, cameraMode);
    lastSyncedModelFormChapterId = null;
    applyChapterVisualStateForNav(chapter, previewAnimation, options?.visualElapsed);
    syncModelSelectionForChapter(chapter);
    scheduleChapterNavDeferredWork(chapter, gen, elapsed, previewAnimation);
    lastIntroStateKey = "";
    syncIntroPresentation();

    queueMicrotask(() => {
      if (gen !== chapterNavGeneration) return;
      syncChapterMetaForm(chapter);
      if (!camTrans && !isCameraTransitioning.value && !cameraAnimating) {
        syncCameraFormFromStored(chapter);
        chapterNavLock.value = false;
      }
    });

    if (options?.seek !== false) {
      videoChapterSyncPaused = true;
      void seekVideoTo(chapter.startTime).finally(() => {
        if (gen !== chapterNavGeneration) return;
        videoChapterSyncPaused = false;
        const v = videoEl.value;
        if (!v) return;
        currentTime.value = v.currentTime;
        if (chAnimWallclock) return;
        const playbackChapter = resolveChapterForAnimSync(chapter);
        const editing =
          !viewOnly.value && !isPreviewMode.value && !chapterPlayTarget.value && v.paused;
        if (!editing) {
          const animElapsed = resolveChapterAnimElapsed(playbackChapter, v.currentTime);
          if (Math.abs(animElapsed - elapsed) > CHAPTER_TIME_EPS) {
            syncChapterVisualState(playbackChapter, animElapsed, {
              skipOutlineRebuild: true,
              skipOverlaySync: true
            });
          }
        }
        if (!v.paused) ensureVideoSyncedChapterAnimation();
      });
    }
  }

  function selectChapter(ch: Chapter) {
    videoOnlyMode.value = false;
    if (ch.parentId) sceneNodeApi.setActiveVideo(ch.parentId);
    setEditModeActiveChapter(ch);
    const video = videoEl.value;
    if (video && !video.paused) {
      presentationExpectPlaying = false;
      clearPresentationResumeTimer();
      video.pause();
      chapterPlayTarget.value = null;
      chapterAutoNext.value = false;
    }
    const resolved = resolveChapter(ch);
    if (!resolved) return;

    chapterPlayTarget.value = null;
    chapterAutoNext.value = false;
    presentationExpectPlaying = false;
    clearPresentationResumeTimer();
    stopChapterAnimation();

    if (video) {
      videoChapterSyncPaused = true;
      try {
        const target = resolved.chapter.startTime;
        if (Math.abs(video.currentTime - target) >= CHAPTER_TIME_EPS) {
          video.currentTime = target;
        }
        currentTime.value = target;
      } catch {
        /* ignore */
      } finally {
        videoChapterSyncPaused = false;
      }
    }

    navigateToChapter(resolved.chapter, resolved.idx, {
      seek: false,
      cameraMode: "playback",
      visualElapsed: 0,
      holdCurrentTime: true
    });
    // navigate 后再强制起始帧一次，避免 seeked/残留锁把姿态打乱
    if (!viewOnly.value && !isPreviewMode.value) {
      setEditModeActiveChapter(resolved.chapter);
      applyChapterEditorVisualState(resolved.chapter);
    }
  }

  function getChapterAnimElapsed(ch: Chapter, t: number) {
    return Math.max(0, t - ch.startTime);
  }

  function chapterHasAnimation(ch: Chapter) {
    return getChapterAnimTargetsCached(ch).length > 0;
  }

  /** 播放前将当前编辑写入节点并刷新动画目标缓存 */
  function prepareChapterForPreviewPlayback(ch: Chapter) {
    if (!viewOnly.value && !isPreviewMode.value) {
      flushChapterSessionsToConfigs(ch);
      sanitizeChapterModelConfigs(ch);
    }
    // 不调用 resetLiveAnimEditorBuffers：会清空动画段导致右侧设置框闪一下关掉，
    // 播放时 shouldUseLiveAnimSegments 已因 chapterPlayTarget 关闭而不读 live 段。
    editPlaybackSyncChapterId = ch.id;
    editPlaybackSyncElapsed = 0;
    applyChapterModelState(ch, 0, {
      skipOutlineRebuild: false,
      skipOverlaySync: false,
      forceElapsed: 0
    });
    invalidateChapterAnimTargetsCache(ch.id);
    invalidateChapterAnimPivotCaches(ch);
  }

  /** 节点播放按钮：墙钟模式从头重播当前节点全部效果与动画（不跟视频时间轴） */
  function restartChapterPreviewPlayback(ch: Chapter) {
    prepareChapterForPreviewPlayback(ch);
    stopChapterAnimation();
    chapterPlayTarget.value = null;
    chapterAutoNext.value = false;
    presentationExpectPlaying = false;
    clearPresentationResumeTimer();
    if (videoEl.value) videoEl.value.pause();

    applyChapterModelState(ch, 0, {
      skipOutlineRebuild: false,
      skipOverlaySync: false,
      forceElapsed: 0
    });
    getChapterAnimTargetsCached(ch);

    if (!chapterHasAnimation(ch)) return false;
    runChapterAnimationWallclock(ch);
    return true;
  }

  function stopChapterAnimation() {
    stopSegmentPlayback();
    chAnimChapterId = null;
    chAnimWallclock = false;
    chAnimWallclockStart = 0;
    chAnimWallclockMaxDur = 0;
    videoAnimLastSyncAt = 0;
    _chAnimLock = false;
    editPlaybackSyncChapterId = null;
    editPlaybackSyncElapsed = -1;
    editPlaybackCameraChapterId = null;
    invalidateChapterAnimTargetsCache();
  }

  function syncCurrentChapterAnimationFromVideo() {
    const video = videoEl.value;
    if (!video) return;
    const ch = resolvePresentationPlaybackChapter(video);
    if (!ch || !chapterHasAnyModelEdits(ch)) {
      // 钉住目标章时不要 reset（会把已隐藏模型整树显示回来）
      if (chapterPlayTarget.value) return;
      resetAllModelsToDefault();
      return;
    }
    const elapsed = getPresentationAnimElapsed(video, ch);
    if (!viewOnly.value && !isPreviewMode.value) {
      invalidateChapterAnimTargetsCache(ch.id);
      invalidateChapterAnimPivotCaches(ch);
      applyChapterModelState(ch, elapsed, {
        skipOutlineRebuild: false,
        skipOverlaySync: false,
        forceElapsed: elapsed,
        immediatePresent: true
      });
      return;
    }
    applyChapterAnimOnly(ch, elapsed);
  }

  function applyChapterAnimationAtElapsed(ch: Chapter, elapsedSec: number) {
    applyChapterModelState(ch, elapsedSec);
  }

  function syncChapterAnimationToVideo(ch: Chapter, t: number) {
    if (_chAnimLock && !chAnimWallclock) return;
    applyChapterAnimOnly(ch, getChapterAnimElapsed(ch, t));
  }

  function ensureVideoSyncedChapterAnimation() {
    const video = videoEl.value;
    if (!video || video.paused) return false;
    // 优先 playTarget：seek 尾段 currentTime 可能仍在上一章
    const activeCh = chapterPlayTarget.value ?? resolvePresentationPlaybackChapter(video);
    if (!activeCh || !chapterHasAnimation(activeCh)) {
      debugViewPlayback("ensureVideoSyncedChapterAnimation:skip", {
        currentTime: video.currentTime,
        playTargetId: chapterPlayTarget.value?.id ?? null,
        activeChapterId: activeCh?.id ?? null,
        activeHasAnimation: !!activeCh && chapterHasAnimation(activeCh)
      });
      return false;
    }
    if (_chAnimLock && !chAnimWallclock && chAnimChapterId === activeCh.id) return true;
    debugViewPlayback("ensureVideoSyncedChapterAnimation:start", {
      currentTime: video.currentTime,
      activeChapterId: activeCh.id,
      activeChapterName: activeCh.name
    });
    return startVideoSyncedChapterAnimation(activeCh);
  }

  function startVideoSyncedChapterAnimation(_ch?: Chapter) {
    _chAnimLock = true;
    chAnimWallclock = false;
    chAnimChapterId = _ch?.id ?? null;
    totalPlaying.value = false;
    videoAnimLastSyncAt = 0;
    invalidateChapterAnimTargetsCache(_ch?.id);
    const video = videoEl.value;
    if (video && _ch) {
      const timelineT = resolvePresentationPlaybackTime(video);
      const elapsed = isChapterInPlaybackRange(_ch, timelineT)
        ? getChapterAnimElapsed(_ch, timelineT)
        : Math.max(0, timelineT - _ch.startTime);
      resyncChapterMeshFromVideo(video, _ch, elapsed);
    } else {
      syncCurrentChapterAnimationFromVideo();
    }
    return true;
  }

  function runChapterAnimationWallclock(ch: Chapter) {
    const wallclockGen = chapterNavGeneration;
    stopChapterAnimation();
    if (wallclockGen !== chapterNavGeneration) return false;
    invalidateChapterAnimTargetsCache(ch.id);
    if (!getChapterAnimTargetsCached(ch).length) return false;

    _chAnimLock = true;
    chAnimWallclock = true;
    chAnimChapterId = ch.id;
    chAnimWallclockStart = performance.now();
    chAnimWallclockMaxDur = getChapterAnimDuration(ch);
    totalPlaying.value = false;
    applyChapterModelState(ch, 0, {
      skipOutlineRebuild: false,
      skipOverlaySync: false,
      forceElapsed: 0
    });
    refreshActiveHighlightOutline();
    return true;
  }

  function runChapterAnimation(ch: Chapter, options?: { wallclock?: boolean }) {
    if (options?.wallclock) return runChapterAnimationWallclock(ch);
    return ensureVideoSyncedChapterAnimation() || startVideoSyncedChapterAnimation(ch);
  }

  function highlightSceneNode(nodeId: string) {
    selectedNodeId.value = nodeId;
    const node = getNodeById(nodes.value, nodeId);
    if (!node || !isAnimationNode(node)) return;

    if (viewOnly.value || isPreviewMode.value) {
      // Presentation: do not mutate session or sync UI from the *current* clock.
      // List clicks must go through jumpToChapter → commandPresentationPlayback only.
      return;
    }
    setEditModeActiveChapter(node);
  }

  function playChapter(ch: Chapter) {
    setEditModeActiveChapter(ch);
    videoOnlyMode.value = false;

    const resolved = resolveChapter(ch);
    if (!resolved) return;
    const { chapter } = resolved;
    const presentation = viewOnly.value || isPreviewMode.value;

    // 编辑态：从点中的动画播到该视频末尾；不沿用其它视频的播放态
    void startChapterPlayback(chapter, {
      syncVideo: true,
      autoplay: true,
      keepPlaying: presentation,
      userGesture: true,
      seekTime: chapter.startTime
    });

    if (chapterHasAnimation(chapter)) toastShow("正在播放节点动画", "success");
    else toastShow("当前节点没有动画", "warning");
  }

  function syncCameraFormFromStored(ch: Chapter) {
    syncCameraFormFromFrame(getStoredChapterCameraFrame(ch), ch);
  }

  function syncCameraFormFromFrame(
    frame: { position: [number, number, number]; target: [number, number, number] },
    ch: Chapter
  ) {
    camP[0] = round3(frame.position[0]);
    camP[1] = round3(frame.position[1]);
    camP[2] = round3(frame.position[2]);
    camT[0] = round3(frame.target[0]);
    camT[1] = round3(frame.target[1]);
    camT[2] = round3(frame.target[2]);
    camFov.value = clampChapterCameraFov(ch.camera.fov);
    camTransitionSec.value = ch.camera.transitionSec ?? CHAPTER_CAMERA_TRANSITION_SEC;
    cameraFormRevision.value++;
  }

  function syncCameraFormFromResolved(ch: Chapter) {
    syncCameraFormFromFrame(resolveChapterCameraFrame(ch), ch);
  }

  function syncChapterMetaForm(ch: Chapter) {
    chForm.name = ch.name;
    chForm.startTime = ch.startTime;
    chForm.endTime = ch.endTime;
    chapterFormRevision.value++;
  }

  function syncChapterForm(ch: Chapter) {
    syncChapterMetaForm(ch);
    syncCameraFormFromResolved(ch);
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
      posX: round3(camP[0]),
      posY: round3(camP[1]),
      posZ: round3(camP[2]),
      targetX: round3(camT[0]),
      targetY: round3(camT[1]),
      targetZ: round3(camT[2]),
      fov: camFov.value,
      transitionSec: camTransitionSec.value
    };
  }

  function clampChapterCameraFov(fov: number) {
    return clampNumber(fov, 10, 60);
  }

  function applyCameraFormSnapshot(snapshot: ReturnType<typeof getCameraFormSnapshot>) {
    camP[0] = round3(snapshot.posX);
    camP[1] = round3(snapshot.posY);
    camP[2] = round3(snapshot.posZ);
    camT[0] = round3(snapshot.targetX);
    camT[1] = round3(snapshot.targetY);
    camT[2] = round3(snapshot.targetZ);
    camFov.value = clampChapterCameraFov(snapshot.fov);
    camTransitionSec.value = snapshot.transitionSec;
  }

  function applyCameraFormToViewport() {
    if (!camera || !controls) return;
    if (camTrans || chapterNavLock.value || isCameraTransitioning.value || cameraAnimating) return;
    camera.position.set(camP[0], camP[1], camP[2]);
    controls.target.set(camT[0], camT[1], camT[2]);
    camFov.value = clampChapterCameraFov(camFov.value);
    camera.fov = camFov.value;
    camera.updateProjectionMatrix();
    finishCameraAnimationState();
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
    mWire.value = cfg.wireframe ?? false;
    mHL.value = cfg.highlight ?? false;
    mOut.value = cfg.outline ?? false;
    const resolvedCfg = getModelConfig(cfg);
    mOutlineColor.value = resolvedCfg.outlineColor;
    mWireColor.value = resolvedCfg.wireframeColor;
    mHLColor.value = resolvedCfg.modelHighlightColor;
    mAni.value = cfg.animation ?? true;
    mIntro.value = cfg.intro ?? "";
    mRot[0] = 0;
    mRot[1] = 0;
    mRot[2] = 0;

    const ac = cfg.animConfig;
    if (ac?.segments?.length) {
      animDuration.value = ac.duration || 3;
      animEasing.value = (ac as any).easing || "easeInOut";
      const seg = mapStoredAnimSegment(ac.segments[0]);
      if (selModel.value) {
        normalizeAnimSegmentTransformForEditor(
          selModel.value,
          selModelNodeId.value,
          seg,
          !!(ac as any).relativeTransform
        );
      }
      animSegments.splice(0, animSegments.length, seg);
      bindAnimSegmentsToSelection(selModel.value?.id, selModelNodeId.value, selectedChapterId.value);
      invalidateSegPivotCache(seg);
      animDirty.value = false;
    } else {
      animSegments.splice(0);
      animSegmentsOwnerKey = null;
      animDirty.value = false;
      if (mAni.value && selModel.value) {
        const seg = createDefaultAnimSegment(selModel.value, selModelNodeId.value);
        seedPristineAnimSegmentFromDefaults(seg, selModel.value, selModelNodeId.value);
        animSegments.push(seg);
        bindAnimSegmentsToSelection(selModel.value.id, selModelNodeId.value, selectedChapterId.value);
      }
    }

    if (animSegments.length > 0) {
      editingSeg.value = animSegments[0];
      // 加载配置后默认起始帧；用户点「结束」再切 editingSegMode
      editingSegMode.value = "start";
    } else {
      editingSeg.value = null;
      editingSegMode.value = "start";
    }
    bumpAnimSegmentRevision();
  }

  function collectIntroLabelsForChapter(ch: Chapter): Array<{ modelId: string; nodeId: string | null; text: string; x: number; y: number }> {
    const labels: Array<{ modelId: string; nodeId: string | null; text: string; x: number; y: number }> = [];
    const def = createDefaultModelConfig();

    for (const m of models.value) {
      if (!chapterModelHasEdits(ch, m.id)) continue;
      const raw = ch.modelConfigs?.[m.id] as ModelConfig | undefined;
      if (!raw) continue;

      const rootCfg = getModelConfig(raw);
      const rootIntro = rootCfg.intro?.trim();
      if (rootIntro && rootCfg.visible) {
        labels.push({ modelId: m.id, nodeId: null, text: rootIntro, x: 0, y: 0 });
      }

      if (!raw.nodeConfigs) continue;
      for (const [nodeId, nodeCfg] of Object.entries(raw.nodeConfigs)) {
        const merged = getModelConfig({ ...def, ...nodeCfg } as ModelConfig);
        const intro = merged.intro?.trim();
        if (!intro || !merged.visible) continue;
        labels.push({ modelId: m.id, nodeId, text: intro, x: 0, y: 0 });
      }
    }
    return labels;
  }

  function syncIntroPresentation() {
    const video = videoEl.value;
    const playing = !!(video && !video.paused);
    const t = video?.currentTime ?? currentTime.value;
    // 播放中：按视频所在节点展示；非播放：按当前选中/激活节点展示
    const chapter = playing ? getPlaybackChapterAtTime(t) : getActiveChapter();
    const chapterId = chapter?.id ?? null;

    const editingModel = !playing ? selModel.value : null;
    const editingNodeId = !playing ? selModelNodeId.value : null;
    let editingIntro = "";
    let editingVisible = true;
    if (chapter && editingModel) {
      const liveIntro = mIntro.value?.trim();
      if (liveIntro) {
        editingIntro = liveIntro;
        editingVisible = mVis.value;
      } else {
        const cfg = resolveEditorConfigForSelection(chapter, editingModel, editingNodeId).cfg;
        editingIntro = cfg.intro?.trim() || "";
        editingVisible = cfg.visible;
      }
    }
    const editingShouldShow = !!(editingModel && editingVisible && editingIntro);

    // 播放中：展示所有有介绍的模型/子节点；编辑中：展示当前选中目标的介绍
    const shouldShow = playing || editingShouldShow;

    let introSignature = "";
    if (shouldShow && chapter) {
      if (!playing && editingModel) {
        introSignature = editingShouldShow ? `${editingModel.id}|${editingNodeId ?? ""}|${editingIntro}` : "";
      } else {
        introSignature = collectIntroLabelsForChapter(chapter)
          .map(l => `${l.modelId}|${l.nodeId ?? ""}|${l.text}`)
          .join(";");
      }
    }
    const stateKey = `${shouldShow ? 1 : 0}:${chapterId ?? ""}:${introSignature}`;
    if (stateKey === lastIntroStateKey) return;
    lastIntroStateKey = stateKey;

    if (!shouldShow || !chapter) {
      modelIntroLabels.value = [];
      introPresentationPlaying = false;
      introPresentationChapterId = null;
      return;
    }

    if (!playing && editingModel && editingShouldShow) {
      modelIntroLabels.value = [
        { modelId: editingModel.id, nodeId: editingNodeId, text: editingIntro, x: 0, y: 0 }
      ];
    } else {
      modelIntroLabels.value = collectIntroLabelsForChapter(chapter);
    }

    introPresentationPlaying = playing;
    introPresentationChapterId = chapterId;
  }

  function updateModelIntroLabelPositions(now = performance.now()) {
    if (!viewportEl.value || !camera || modelIntroLabels.value.length === 0) return;
    if (isPlaying.value && now - introLabelLastUpdateAt < 1000 / 15) return;
    introLabelLastUpdateAt = now;

    const width = viewportEl.value.clientWidth;
    const height = viewportEl.value.clientHeight;
    if (width <= 0 || height <= 0) return;

    for (const label of modelIntroLabels.value) {
      const obj = label.nodeId
        ? getTransformTarget(label.modelId, label.nodeId)
        : meshes.get(label.modelId);
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

    // 如果当前已有选中模型，保持选中并刷新表单（即使该模型在本节点没有配置）
    if (selModelId.value) {
      syncModelForm(chapter);
      return;
    }

    // 未选中模型时不自动选中：下方设置框应保持隐藏
    resetModelFormDefaults();
    clearLiveAnimEditorState();
    modelFormRevision.value++;
    lastIntroStateKey = "";
    syncIntroPresentation();
  }

  function syncModelForm(ch?: Chapter | null) {
    const model = selModel.value;
    if (!model) {
      resetModelFormDefaults();
      modelFormRevision.value++;
      return;
    }

    // 未显式传入时只用当前选中动画；禁止回退到第一章，避免未选中时套用线框/高亮盖住贴图
    const activeChapter = ch !== undefined ? ch : selectedChapter.value;
    const defaultCfg = createDefaultModelConfig();

    if (!activeChapter) {
      applyModelConfigToEditor(defaultCfg);
      resetModelTreeToDefault(model);
      modelFormRevision.value++;
      return;
    }

    const chapterId = activeChapter.id;
    const chapterChanged = chapterId !== lastSyncedModelFormChapterId;
    lastSyncedModelFormChapterId = chapterId;

    // 章节切换时 mesh 已在 applyChapterEditorVisualState 中统一刷新，此处只加载表单
    if (!chapterChanged) {
      if (isEditVideoMeshSyncActive()) {
        // 播放跟视频时：按 elapsed 刷整章，切选中不得套 start/end 预览
        applyChapterMeshFromCurrentVideo(activeChapter);
      } else if (!chapterModelHasEdits(activeChapter, model.id)) {
        resetModelTreeToDefault(model);
      } else {
        // 与播放按钮同一套起始帧，避免 applyAnimSegmentTransformToMesh 相对坐标偏差
        applyChapterModelState(activeChapter, 0, {
          skipOutlineRebuild: false,
          skipOverlaySync: false,
          forceElapsed: 0
        });
      }
    }

    const { cfg, fromSession } = resolveEditorConfigForSelection(
      activeChapter,
      model,
      selModelNodeId.value
    );
    const useSession = fromSession && !chapterChanged;
    if (useSession) {
      applySelectionEditDraftToEditor(selectionEditDrafts.get(
        selectionDraftKey(chapterId, model.id, selModelNodeId.value)
      )!);
    } else {
      applyModelConfigToEditor(cfg);
      if (
        !selectionHasStoredAnimConfig(activeChapter, model.id, selModelNodeId.value) &&
        animSegments[0] &&
        selModel.value
      ) {
        seedPristineAnimSegmentFromDefaults(animSegments[0], selModel.value, selModelNodeId.value);
      }
    }

    // 表单加载后再统一刷新 mesh，避免首次切节点时 UI/3D 短暂不一致
    if (isEditVideoMeshSyncActive()) {
      applyChapterMeshFromCurrentVideo(activeChapter);
    } else if (chapterModelHasEdits(activeChapter, model.id)) {
      flushChapterSessionsToConfigs(activeChapter);
      applyChapterModelState(activeChapter, 0, {
        skipOutlineRebuild: false,
        skipOverlaySync: false,
        forceElapsed: 0,
        immediatePresent: true
      });
      // 仅当前正在编辑「结束帧」时覆盖为 end；默认保持起始帧（与播放一致）
      if (
        animSegments[0] &&
        selModel.value &&
        editingSeg.value === animSegments[0] &&
        editingSegMode.value === "end"
      ) {
        applyAnimSegmentTransformToMesh(
          selModel.value,
          selModelNodeId.value,
          animSegments[0],
          "end"
        );
      }
    } else {
      resetModelTreeToDefault(model);
    }
    invalidatePickMeshCache();
    syncTransformVisualOverlays();

    modelFormRevision.value++;
  }

  // 模型配置改为“按节点手动添加”，不再在新节点里自动为所有模型创建默认配置
  function ensureModelConfigsOnChapter(_ch: Chapter) {}

  function resetChaptersForNewVideo() {
    if (!currProj.value) return;
    const videoId = videoNodeUploadTargetId.value || activeVideoId.value;
    if (videoId) {
      const video = getNodeById(currProj.value.nodes, videoId);
      if (video && isVideoNode(video)) {
        const deleteIds = new Set([videoId, ...getDescendantNodeIds(currProj.value.nodes, videoId)]);
        currProj.value.nodes = currProj.value.nodes.filter(n => !deleteIds.has(n.id) || n.id !== videoId);
        getVideoAnimations(currProj.value.nodes, videoId).forEach(() => {});
        currProj.value.nodes = currProj.value.nodes.filter(
          n => !(n.type === "animation" && n.parentId === videoId)
        );
        video.videoSrc = null;
        video.videoDuration = 0;
        video.videoWidth = 0;
        video.videoHeight = 0;
        video.videoDisplayWidth = 0;
      }
    }
    selectedChapterId.value = null;
    playingIdx.value = -1;
    chapterPlayTarget.value = null;
  }

  function ensureDefaultChapter(videoDur?: number) {
    if (!currProj.value) return;
    const dur = videoDur ?? duration.value;
    if (dur <= 0) return;
    ensureProjectNodes(currProj.value);
    let video = activeVideoId.value ? getNodeById(currProj.value.nodes, activeVideoId.value) : null;
    if (!video || !isVideoNode(video)) {
      video = currProj.value.nodes.find(isVideoNode) ?? null;
    }
    if (!video || !isVideoNode(video) || !video.videoSrc) return;
    if (getVideoAnimations(currProj.value.nodes, video.id).length > 0) return;

    sceneNodeApi.addAnimationNode(video.id);
  }

  function addChapter() {
    const videoId = activeVideoId.value;
    if (videoId) sceneNodeApi.addAnimationNode(videoId);
    else toastShow("请先选择或添加视频节点", "warning");
  }

  function addChildChapter(parent: Chapter) {
    if (parent.parentId) sceneNodeApi.addAnimationNode(parent.parentId);
    else toastShow("动画节点需挂在视频下", "warning");
  }

  function canAddChildChapter(parent: Chapter) {
    return !!parent.parentId && !!getNextChapterRange(parent.parentId);
  }

  function getChapterChildren(videoId: string): Chapter[] {
    return getVideoAnimations(nodes.value, videoId);
  }

  function getAllDescendantChapterIds(chapterId: string): string[] {
    return getDescendantNodeIds(nodes.value, chapterId);
  }

  function applyVideoNodePlayback(video: SceneVideoNode) {
    videoOnlyMode.value = true;
    showVideoPip.value = true;
    if (!video.videoSrc) {
      toastShow("该视频节点尚未上传视频文件", "warning");
      return;
    }

    if (isTransientMediaUrl(video.videoSrc)) {
      const live = unwrapTransientMediaUrl(video.videoSrc);
      // 刷新后 blob 已失效，或被错误存成 /blob:...
      if (!live || live.startsWith("data:") || !live.startsWith("blob:")) {
        toastShow("视频未正确保存到服务器，请重新上传后再保存场景", "error");
        return;
      }
      // 仍是当前会话 blob，尝试播放；失败则 onVideoErr 提示
    }

    const storedDur = video.videoDuration;
    if (Number.isFinite(storedDur) && storedDur > 0) duration.value = storedDur;

    const bindAndSeek = () => {
      syncVideoElementSrc(video.videoSrc || undefined);
      const v = videoEl.value;
      if (!v) return false;
      try {
        v.pause();
      } catch {
        /* ignore */
      }
      // 等元数据后再 seek，避免未就绪时 currentTime=0 触发异常
      const seekToStart = () => {
        try {
          if (Number.isFinite(v.currentTime)) v.currentTime = 0;
        } catch {
          /* ignore */
        }
        currentTime.value = 0;
        isPlaying.value = false;
      };
      if (v.readyState >= HTMLMediaElement.HAVE_METADATA) seekToStart();
      else v.addEventListener("loadedmetadata", seekToStart, { once: true });
      return true;
    };

    // video 组件是 v-if 挂载，需等 DOM 就绪后再绑 src
    if (bindAndSeek()) return;
    void nextTick(async () => {
      for (let i = 0; i < 20; i++) {
        if (bindAndSeek()) return;
        await new Promise(r => setTimeout(r, 50));
      }
      toastShow("视频播放器未就绪，请再点一次视频节点", "warning");
    });
  }

  function hideVideoPip() {
    showVideoPip.value = false;
    clearVideoElementSrc({ silent: true });
    isPlaying.value = false;
  }

  const sceneNodeApi = createSceneNodeEditorApi({
    currProj,
    nodes,
    activeVideoId,
    selectedNodeId,
    selectedChapterId,
    expandedNodeIds,
    sceneNodeDraggingId,
    sceneNodeDropTargetId,
    sceneNodeDropKind,
    videoNodeUploadTargetId,
    duration,
    getNextChapterRange,
    ensureChapterModelConfigsMap,
    syncChapterForm,
    applyChapter,
    applyVideoNodePlayback,
    syncVideoElementSrc,
    resetAllModelsToDefault,
    onClearAnimationSelection: () => {
      stopChapterAnimation();
      chapterPlayTarget.value = null;
      // 点到视频/分组等非动画节点时取消模型选中
      if (!viewOnly.value && !isPreviewMode.value) {
        clearModelSelection();
      }
    },
    hideVideoPip,
    videoOnlyMode,
    chapterFormRevision
  });

  function isChapterPlaying(ch: Chapter): boolean {
    // 多视频各自有 0 起点时间轴：播放态必须限定在当前活动视频内
    if (ch.parentId && activeVideoId.value && ch.parentId !== activeVideoId.value) {
      return false;
    }
    const video = videoEl.value;
    const actuallyPlaying = isPlaying.value || !!(video && !video.paused && !video.ended);
    if (!actuallyPlaying) return false;
    if (chapterPlayTarget.value?.id === ch.id) return true;
    return isChapterInPlaybackRange(ch, currentTime.value);
  }

  /** 编辑页动画行：播放中点暂停，未播放点播放 */
  function toggleChapterPlayback(ch: Chapter) {
    if (viewOnly.value || isPreviewMode.value) {
      playChapter(ch);
      return;
    }
    if (isChapterPlaying(ch)) {
      presentationExpectPlaying = false;
      clearPresentationResumeTimer();
      chapterAutoNext.value = false;
      chapterPlayTarget.value = null;
      const video = videoEl.value;
      if (video && !video.paused) {
        try {
          video.pause();
        } catch {
          /* ignore */
        }
      }
      isPlaying.value = false;
      stopChapterAnimation();
      applyChapterEditorVisualState(ch);
      return;
    }
    playChapter(ch);
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
          if (!currProj.value) break;
          const clone = JSON.parse(JSON.stringify(ch)) as Chapter;
          clone.id = `anim_${Date.now()}`;
          clone.name = ch.name + " (副本)";
          currProj.value.nodes.push(clone);
          toastShow("节点已复制");
        }
        break;
      case "del":
        sceneNodeApi.deleteSceneNode(ch);
        break;
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
    selectedChapter.value.camera.position = roundVec3([...camP] as [number, number, number]);
    selectedChapter.value.camera.target = roundVec3([...camT] as [number, number, number]);
    selectedChapter.value.camera.fov = clampChapterCameraFov(camFov.value);
    selectedChapter.value.camera.transitionSec = camTransitionSec.value;
    if (selModel.value) {
      persistActiveChapterDrafts(ch);
    }
    toastShow("节点已保存");
  }

  function deleteChapter() {
    if (!selectedChapter.value) return;
    sceneNodeApi.deleteSceneNode(selectedChapter.value);
  }

  function liveCam() {
    if (!camera || !controls) return;
    if (chapterNavLock.value || camTrans || isCameraTransitioning.value) return;
    camera.position.set(camP[0], camP[1], camP[2]);
    controls.target.set(camT[0], camT[1], camT[2]);
  }

  function liveFov() {
    if (!camera || camTrans || isCameraTransitioning.value) return;
    camFov.value = clampChapterCameraFov(camFov.value);
    camera.fov = camFov.value;
    camera.updateProjectionMatrix();
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
    const position: [number, number, number] = roundVec3([camera.position.x, camera.position.y, camera.position.z]);
    const target: [number, number, number] = roundVec3([controls.target.x, controls.target.y, controls.target.z]);
    const fov = clampChapterCameraFov(camera.fov);
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
    cameraAnimating = false;
    isCameraTransitioning.value = false;
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
  /** 取消模型/子部件选中（切换动画节点或视频节点时调用） */
  function clearModelSelection() {
    if (selModelId.value) hidePivotHelpers(selModelId.value);
    selModelNodeId.value = null;
    selModelId.value = null;
    clearLiveAnimEditorState();
    resetModelFormDefaults();
    modelFormRevision.value++;
    updateSelectionHighlight();
    lastIntroStateKey = "";
    syncIntroPresentation();
  }

  function setSelectedModelId(modelId: string | null, sync = true) {
    if (modelId === null) {
      clearModelSelection();
      return;
    }
    const prevModelId = selModelId.value;
    const prevNodeId = selModelNodeId.value;
    if (
      prevModelId &&
      modelId &&
      prevModelId !== modelId &&
      selectedChapter.value &&
      !viewOnly.value &&
      !isPreviewMode.value &&
      animSegmentsBelongToChapter(selectedChapter.value.id)
    ) {
      captureSelectionSession(selectedChapter.value.id, prevModelId, prevNodeId);
      clearLiveAnimEditorState();
    }
    // Hide pivot for previous selection when switching
    if (selModelId.value && selModelId.value !== modelId) {
      hidePivotHelpers(selModelId.value);
    }
    if (selModelId.value !== modelId) selModelNodeId.value = null;
    selModelId.value = modelId;
    if (modelId) lastSelModelId = modelId;
    if (sync && modelId) syncModelForm(selectedChapter.value);
    updateSelectionHighlight();
  }

  function selectModelNode(modelId: string, nodeId: string | null, opts?: { focusCamera?: boolean }) {
    const m = models.value.find(item => item.id === modelId);
    if (!m) return;
    selectModel(m, { focusCamera: opts?.focusCamera, nodeId });
  }

  function restoreLastModelSelection() {
    if (selModelId.value) return;
    const ch = selectedChapter.value;
    const chapterModelList = getChapterModels(ch);
    if (chapterModelList.length === 0) return;

    const target = (lastSelModelId ? chapterModelList.find(m => m.id === lastSelModelId) : null) ?? chapterModelList[0];
    setSelectedModelId(target.id, true);
  }

  function refreshModelHierarchyIfLoaded(modelId: string, modelDisplayName?: string) {
    const root = meshes.get(modelId);
    if (root) registerModelHierarchy(modelId, root, modelDisplayName);
  }

  function hasUnsavedAnimChanges() {
    if (!animDirty.value || animSegments.length === 0) return false;
    const ch = getActiveChapter();
    if (!ch || !selModel.value) return animDirty.value;
    const cfg = readActiveModelConfig(ch);
    const saved = cfg.animConfig?.segments?.[0];
    if (!saved) return true;
    const current = animSegments[0];
    const norm = (seg: any) =>
      JSON.stringify({
        pauseTime: seg.pauseTime ?? 0,
        animTime: seg.animTime ?? 3,
        easing: seg.easing ?? "easeInOut",
        pivot: seg.pivot ?? "center",
        startPos: seg.startPos ?? [0, 0, 0],
        endPos: seg.endPos ?? [0, 0, 0],
        startScale: seg.startScale ?? 1,
        endScale: seg.endScale ?? 1,
        startRot: seg.startRot ?? [0, 0, 0],
        endRot: seg.endRot ?? [0, 0, 0]
      });
    return norm(current) !== norm(mapStoredAnimSegment(saved));
  }

  function selectModel(m: Model, opts?: { focusCamera?: boolean; nodeId?: string | null }) {
    const focusCamera = opts?.focusCamera ?? false;
    const nodeId = opts?.nodeId ?? null;
    const resolvedNodeId = nodeId ? resolveSelectedNodeId(m.id, nodeId) : null;
    const prevModelId = selModelId.value;
    const prevNodeId = selModelNodeId.value;
    const selectionChanged = prevModelId !== m.id || prevNodeId !== resolvedNodeId;

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

    if (!selectionChanged && selModelId.value === m.id && selModelNodeId.value === resolvedNodeId) {
      if (focusCamera) {
        requestAnimationFrame(() => {
          const obj = getSelectedObject3D();
          if (obj) focusCameraOnObject(obj);
        });
      }
      return;
    }

    if (selectionChanged && selectedChapter.value && !viewOnly.value && !isPreviewMode.value) {
      if (prevModelId && animSegmentsBelongToChapter(selectedChapter.value.id)) {
        captureSelectionSession(selectedChapter.value.id, prevModelId, prevNodeId);
        if (isEditVideoMeshSyncActive()) {
          // 播放中切选中：整章跟视频 elapsed，禁止把上一目标套成 end 预览帧
          applyChapterMeshFromCurrentVideo(selectedChapter.value);
        } else {
          const prevModel = models.value.find(item => item.id === prevModelId);
          if (prevModel) {
            applyTargetAnimVisualState(selectedChapter.value, prevModel, prevNodeId);
          }
        }
      }
      clearLiveAnimEditorState();
    } else if (selectionChanged) {
      clearLiveAnimEditorState();
    }
    applySelection();
    if (!getActiveChapter()) {
      toastShow("请先添加节点后再配置模型样式", "warning");
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
          const assetKey = normalizeModelAssetKey({ name });
          const existing = proj.models.find(
            m => normalizeModelAssetKey({ path: getModelSourcePath(m), url: m.url, name: m.name }) === assetKey
          );
          if (existing) {
            lastImportedId = existing.id;
            await yieldImportGap(i);
            continue;
          }
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
    const assetKey = normalizeModelAssetKey({ name });
    const existing = currProj.value.models.find(
      m => normalizeModelAssetKey({ path: getModelSourcePath(m), url: m.url, name: m.name }) === assetKey
    );
    if (existing) {
      toastShow(`模型「${name}」已在列表中`, "warning");
      setSelectedModelId(existing.id, true);
      return false;
    }
    const m = mStore.createCustomModel(currProj.value.id, name, "");
    const buffer = await file.arrayBuffer();
    await loadGLBFromArrayBuffer(m, buffer);
    if (!meshes.has(m.id)) {
      toastShow("模型加载失败", "error");
      return false;
    }
    currProj.value.models.push(m);
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
      wireframe: mWire.value,
      highlight: mHL.value,
      outlineColor: mOutlineColor.value,
      wireframeColor: mWireColor.value,
      modelHighlightColor: mHLColor.value,
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
    mWire.value = snapshot.wireframe ?? false;
    mHL.value = snapshot.highlight;
    mOutlineColor.value = snapshot.outlineColor;
    mWireColor.value = snapshot.wireframeColor;
    mHLColor.value = snapshot.modelHighlightColor;
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

  function syncWritableModelConfigFromForm(ch: Chapter) {
    const writable = ensureWritableActiveModelConfig(ch);
    writable.visible = mVis.value;
    writable.outline = mOut.value;
    writable.wireframe = mWire.value;
    writable.highlight = mHL.value;
    writable.outlineColor = mOutlineColor.value;
    writable.wireframeColor = mWireColor.value;
    writable.modelHighlightColor = mHLColor.value;
    writable.animation = mAni.value;
    writable.intro = mIntro.value;
    writable.scale = mScl.value;
    writable.posOffset = [mOff[0], mOff[1], mOff[2]];
  }

  function applyMCfgLive(field: string, value?: any) {
    if (!selModel.value) return;
    const ch = getActiveChapter();
    // 用 live 快照驱动即时预览，避免 getActiveModelConfig 在未编辑节点写入空壳配置
    const cfg = {
      ...createDefaultModelConfig(),
      visible: mVis.value,
      posOffset: [mOff[0], mOff[1], mOff[2]] as [number, number, number],
      scale: mScl.value,
      highlight: mHL.value,
      outlineColor: mOutlineColor.value,
      wireframeColor: mWireColor.value,
      modelHighlightColor: mHLColor.value,
      outline: mOut.value,
      wireframe: mWire.value,
      animation: mAni.value,
      intro: mIntro.value
    };
    const targets = getNodeObjects(undefined, undefined, true);
    const root = meshes.get(selModel.value.id);

    if (field === "visible") {
      cfg.visible = mVis.value;
      for (const target of targets) {
        // 显隐必须直接写 Object3D.visible，避免后续章节同步路径跳过 touchVisibility
        target.visible = !!mVis.value;
        rebuildOutlineForObject(selModel.value, target, cfg);
      }
    } else if (field === "outline") {
      cfg.outline = mOut.value;
      for (const target of targets) rebuildOutlineForObject(selModel.value, target, cfg);
    } else if (field === "wireframe") {
      cfg.wireframe = mWire.value;
      for (const target of targets) rebuildOutlineForObject(selModel.value, target, cfg);
    } else if (field === "highlight") {
      cfg.highlight = mHL.value;
      cfg.modelHighlightColor = mHLColor.value;
      for (const target of targets) rebuildOutlineForObject(selModel.value, target, cfg);
    } else if (field === "outlineColor") {
      cfg.outlineColor = mOutlineColor.value;
      if (cfg.outline) {
        for (const target of targets) rebuildOutlineForObject(selModel.value, target, cfg);
      }
    } else if (field === "wireframeColor") {
      cfg.wireframeColor = mWireColor.value;
      if (cfg.wireframe) {
        for (const target of targets) rebuildOutlineForObject(selModel.value, target, cfg);
      }
    } else if (field === "modelHighlightColor") {
      cfg.modelHighlightColor = mHLColor.value;
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
      if (ch) {
        if (mIntro.value?.trim()) {
          syncWritableModelConfigFromForm(ch);
          captureSelectionSession(ch.id, selModel.value.id, selModelNodeId.value);
        } else {
          pruneActiveTargetModelConfigIfUnedited(ch, selModel.value.id, selModelNodeId.value);
          captureSelectionSession(ch.id, selModel.value.id, selModelNodeId.value);
        }
      }
      lastIntroStateKey = "";
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

    // 编辑态：开关类变更需落盘并刷新描边；显隐单独处理，禁止整树重算动画位姿
    if (
      ch &&
      !viewOnly.value &&
      !isPreviewMode.value &&
      ["visible", "outline", "wireframe", "highlight", "outlineColor", "wireframeColor", "modelHighlightColor"].includes(field)
    ) {
      const snapshot = getModelFormSnapshot();
      const hasVisual = formSnapshotHasVisualEdits(snapshot);
      if (hasVisual) {
        syncWritableModelConfigFromForm(ch);
        captureSelectionSession(ch.id, selModel.value.id, selModelNodeId.value);
      } else {
        pruneActiveTargetModelConfigIfUnedited(ch, selModel.value.id, selModelNodeId.value);
        captureSelectionSession(ch.id, selModel.value.id, selModelNodeId.value);
      }

      const liveCfg = {
        ...createDefaultModelConfig(),
        visible: mVis.value,
        outline: mOut.value,
        wireframe: mWire.value,
        highlight: mHL.value,
        outlineColor: mOutlineColor.value,
        wireframeColor: mWireColor.value,
        modelHighlightColor: mHLColor.value,
        animation: mAni.value,
        intro: mIntro.value,
        scale: mScl.value,
        posOffset: [mOff[0], mOff[1], mOff[2]] as [number, number, number]
      };

      if (field === "visible") {
        // 只改可见性/描边，绝不走 applyAllEditedTargetsForModel（会 reset 变换把动画 mesh 打飞）
        for (const target of getNodeObjects(selModel.value.id, selModelNodeId.value, true)) {
          target.visible = !!mVis.value;
          rebuildOutlineForObject(selModel.value, target, liveCfg);
        }
      } else {
        applyAllEditedTargetsForModel(ch, selModel.value);
        for (const target of getNodeObjects(selModel.value.id, selModelNodeId.value, true)) {
          rebuildOutlineForObject(selModel.value, target, liveCfg);
        }
      }
      syncModelConfigOutlinePass();
      invalidatePickMeshCache();
      syncTransformVisualOverlays();
      modelFormRevision.value++;
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
    const normalizedStart = roundInt(subForm.startTime);
    const normalizedEnd = roundInt(subForm.endTime);
    subForm.startTime = normalizedStart;
    subForm.endTime = normalizedEnd;

    if (normalizedEnd <= normalizedStart) {
      toastShow("结束时间必须大于起始时间", "warning");
      return;
    }
    if (duration.value > 0 && normalizedEnd > duration.value) {
      toastShow("结束时间不能超过视频总时长", "warning");
      return;
    }
    if (editingSId) {
      const s = subtitles.value.find(x => x.id === editingSId);
      if (s) {
        sStore.updateSubtitle(s, {
          startTime: normalizedStart,
          endTime: normalizedEnd,
          text: subForm.text,
          color: subForm.color,
          backgroundColor: subForm.backgroundColor,
          displayMode: "fadeIn"
        });
      }
      editingSId = null;
    } else {
      if (!currProj.value) return;
      const parentNodeId = selectedNodeId.value || selectedChapterId.value || activeVideoId.value;
      if (!parentNodeId) {
        toastShow("请先选择视频或动画节点", "warning");
        return;
      }
      const s = sStore.createSubtitle(
        currProj.value.id,
        parentNodeId,
        subForm.text,
        normalizedStart,
        normalizedEnd
      );
      s.color = subForm.color;
      s.backgroundColor = subForm.backgroundColor;
      s.displayMode = "fadeIn";
      currProj.value.subtitles.push(s);
    }
    // Reset form with smart defaults
    const lastSub = sortedSubtitles.value[sortedSubtitles.value.length - 1];
    subForm.startTime = roundInt(lastSub ? lastSub.endTime : 0);
    subForm.endTime = roundInt(duration.value > 0 ? duration.value : subForm.startTime + 5);
    subForm.text = "";
    activeSubId = null;
  }

  function editSub(s: Subtitle) {
    editingSId = s.id;
    subForm.startTime = roundInt(s.startTime);
    subForm.endTime = roundInt(s.endTime);
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

  function stripPreviewModeFromLocation() {
    if (viewOnly.value) return;
    const hash = window.location.hash;
    if (!hash.includes("mode=preview")) return;
    const nextHash = hash
      .replace(/([?&])mode=preview(?=&|$)/, (_, sep) => (sep === "?" ? "?" : ""))
      .replace(/\?&/, "?")
      .replace(/[?&]$/, "");
    if (nextHash !== hash) {
      window.history.replaceState(history.state, "", `${window.location.pathname}${window.location.search}${nextHash}`);
    }
  }

  function resolvePreviewStartChapter(): Chapter | null {
    return getPresentationStartChapter();
  }

  function enterPreview() {
    if (viewOnly.value || isPreviewMode.value) return;
    if (!hasVideo.value || chapters.value.length === 0) {
      toastShow("请先上传视频并创建节点", "warning");
      return;
    }
    if (meshes.size === 0 && models.value.length > 0) {
      void rehydrateEditorSessionFromProject();
    }

    persistAllChapterDrafts();
    resetEditPlaybackBeforePresentation();
    isPreviewMode.value = true;
    showVideoPip.value = true;
    if (videoSrc.value) syncVideoElementSrc(videoSrc.value);
    syncEditorGizmosVisibility();
    syncPresentationInteractionMode();
    syncVideoAudioState();
    syncPresentationRenderProfile();

    void beginPresentationPlayback(getPresentationStartChapter(), {
      autoplay: true
    });

    nextTick(() => {
      handleResize();
      adaptPresentationViewport();
    });
  }

  /** 退出预览后按当前选中恢复右上角视频窗（选中动画/视频时应仍显示） */
  function restoreEditModeVideoPipFromSelection() {
    const selNode = selectedNodeId.value ? getNodeById(nodes.value, selectedNodeId.value) : null;

    let video: SceneVideoNode | null = null;
    if (selNode && isAnimationNode(selNode) && selNode.parentId) {
      const parent = getNodeById(nodes.value, selNode.parentId);
      if (parent && isVideoNode(parent)) video = parent;
    } else if (selNode && isVideoNode(selNode)) {
      video = selNode;
    } else if (videoOnlyMode.value && activeVideoId.value) {
      const active = getNodeById(nodes.value, activeVideoId.value);
      if (active && isVideoNode(active)) video = active;
    }

    if (video?.videoSrc) {
      showVideoPip.value = true;
      syncVideoElementSrc(video.videoSrc);
      return true;
    }

    showVideoPip.value = false;
    clearVideoElementSrc({ silent: true });
    return false;
  }

  function exitPreview() {
    if (viewOnly.value || !isPreviewMode.value) return;

    isPreviewMode.value = false;
    chapterPlayTarget.value = null;
    resetPresentationPlaybackSession(currentTime.value);
    presentationUiChapterId.value = null;
    presentationNavIndex.value = -1;
    presentationUiRevision.value = 0;
    lastPresentationAutoSwitchChapterId = null;
    chapterAutoNext.value = false;
    presentationManualNavUntil = 0;
    stopChapterAnimation();
    isPlaying.value = false;

    // 优先用当前选中的动画节点，避免预览过程把 selectedChapterId 改掉后状态不一致
    const selNode = selectedNodeId.value ? getNodeById(nodes.value, selectedNodeId.value) : null;
    const ch =
      (selNode && isAnimationNode(selNode) ? selNode : null) ??
      selectedChapter.value ??
      null;

    if (ch) {
      selectedChapterId.value = ch.id;
      selectedNodeId.value = ch.id;
      videoOnlyMode.value = false;
    }

    restoreEditModeVideoPipFromSelection();

    const seekTime = ch?.startTime ?? 0;
    currentTime.value = seekTime;

    syncEditorGizmosVisibility();
    syncPresentationInteractionMode();
    syncVideoAudioState();
    syncPresentationRenderProfile();

    if (ch) {
      applyChapterEditorVisualState(ch);
      syncChapterForm(ch);
      syncModelSelectionForChapter(ch);
      if (meshes.size > 0) {
        if (isDefaultChapterCamera(ch)) {
          frameCameraOnSceneModels(Math.min(0.2, getChapterCameraTransitionSec(ch)), ch);
        } else {
          applyChapterCameraForNav(ch, "edit");
        }
      }
    }
    updateSelectionHighlight();

    nextTick(() => {
      const v = videoEl.value;
      if (v) {
        try {
          v.pause();
          if (Number.isFinite(seekTime)) v.currentTime = seekTime;
        } catch {
          /* ignore */
        }
      }
      handleResize();
      adaptPresentationViewport();
    });
  }

  function togglePreview() {
    if (viewOnly.value) return;
    if (isPreviewMode.value) exitPreview();
    else enterPreview();
  }

  // Keyboard
  function onKey(e: KeyboardEvent) {
    if (editorInitializing.value) return;
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
      exitPreview();
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
    syncRenderPixelRatio();
    renderer.setSize(w, h);
    if (composer) composer.setSize(w, h);
    effectiveRenderPixelRatio.value = getRenderPixelRatio();
    if (viewOnly.value || isPreviewMode.value) adaptPresentationViewport();
  }

  watch(isPreviewMode, () => {
    syncEditorGizmosVisibility();
    syncVideoAudioState();
    syncPresentationRenderProfile();
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
    // 含切到其他动画、或离开动画节点（selectedChapterId → null）
    const chapterIdChanged = prevChapterId !== selectedChapterId.value;

    if (chapterIdChanged && prevChapterId) {
      // 落盘/清草稿已在 navigateToChapter 完成；此处只清 UI 选中
      if (!viewOnly.value && !isPreviewMode.value) {
        selectionEditDrafts.clear();
        clearLiveAnimEditorState();
        lastSyncedModelFormChapterId = null;

        if (selModelId.value || selModelNodeId.value) {
          selModelNodeId.value = null;
          selModelId.value = null;
          resetModelFormDefaults();
        }

        // 关键：播放跟视频时禁止在这里套编辑态起始帧！
        // syncEditModePlaybackFromVideo 会随时间改 selectedChapterId，若此处
        // applyChapterEditorVisualState，会与 syncVideoDrivenChapterMesh 抢 mesh，
        // 第二轮循环表现为「奇怪起点→奇怪终点」。预览没有这段逻辑所以正常。
        // 仅以「视频正在播」为准；停播后残留的 chapterPlayTarget 不得挡住起始帧恢复。
        const videoDriving = !!(videoEl.value && !videoEl.value.paused);
        if (!videoDriving) {
          if (ch) {
            applyChapterEditorVisualState(ch);
          } else {
            resetAllModelsToDefault();
          }
        }

        modelFormRevision.value++;
        updateSelectionHighlight();
      }
      lastIntroStateKey = "";
      queueMicrotask(() => {
        syncIntroPresentation();
      });
      return;
    }

    if (selModel.value) {
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
    try {
    const queryCode = (route.query.code as string) || "";
    const isViewMode = (route.query.mode as string) === "view" && !!queryCode;
    const routeProjectId = (route.query.id as string) || "";

    if (isViewMode) {
      viewOnly.value = true;
      isPreviewMode.value = true;
      skipStoredSceneSettings = true;
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
      syncPresentationRenderProfile();
      syncPresentationInteractionMode();
      showVideoPip.value = true;
      adaptPresentationViewport();
      handleResize();
      window.addEventListener("resize", handleResize);
      if (timelineChapters.value.length > 0) {
        // 展示页刷新：停在片头，等待用户手势再播（避免无点击自动播放）。
        void beginPresentationPlayback(getPresentationStartChapter(), {
          autoplay: false
        });
      }
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
      sceneSavedAt.value = "";
      SETTINGS_KEY = getSceneSettingsStorageKey(queryCode);

      if (routeProjectId) {
        const existing = pStore.projects.find(p => p.id === routeProjectId) as any;
        if (existing) {
          // 带 code 的编辑入口刷新后只展示服务端已保存内容，不恢复本地未保存草稿
          existing.title = defaultTitle;
          existing.videoSrc = null;
          existing.videoDuration = 0;
          existing.videoWidth = 0;
          existing.videoHeight = 0;
          existing.videoDisplayWidth = 0;
          existing.nodes = [];
          existing.models = [];
          existing.subtitles = [];
          existing.updatedAt = new Date().toISOString();
          pStore.setCurrentProject(existing);
          projectTitle.value = defaultTitle;
        } else {
          pStore.clearCurrentProject();
          pStore.ensureProject(routeProjectId, defaultTitle);
          projectTitle.value = defaultTitle;
        }
      } else {
        pStore.clearCurrentProject();
        const p = pStore.createProject(defaultTitle);
        projectTitle.value = defaultTitle;
        await router.replace({ query: { code: queryCode, id: p.id } });
      }
      // 带 code 的编辑入口优先走服务端场景，避免不同 origin 的本地缓存造成画面不一致
      skipStoredSceneSettings = true;
      setPageTitle(defaultTitle);
    } else {
      skipStoredSceneSettings = false;
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

    pStore.clearInvalidVideoData();
    await nextTick();
    init3D();

    let loadedFromServer = false;
    if (queryCode && !isViewMode) {
      suspendProjectPersist();
      // 有已保存场景时直接加载（场景内含设置），避免先 hydrate 再 load 导致 HDR/PMREM 重复烘焙
      loadedFromServer = await tryLoadSavedSceneForModelSet(queryCode);
      if (!loadedFromServer) {
        await restoreSceneSettingsForEditor(queryCode);
      }
    }

    if (!loadedFromServer && queryCode && !isViewMode) {
      // 无已保存场景时：仍加载模型集/本地模型，保证刷新后默认可见
      await tryLoadPendingModelSet();
      for (const m of models.value) {
        if (m.url && !meshes.has(m.id)) await loadGLB(m);
      }
      for (const m of models.value) {
        refreshModelHierarchyIfLoaded(m.id, m.name);
      }
      dedupeProjectModelsByAsset();
      ensureAllModelMixers();
      await finalizeSceneVisualBootstrap();
      if (meshes.size > 0) {
        resetAllModelsToDefault();
        frameCameraOnSceneModels(0);
      }
      showVideoPip.value = false;
      videoOnlyMode.value = false;
      selectedChapterId.value = null;
      selectedNodeId.value = null;
    }

    if (!loadedFromServer && !queryCode && videoSrc.value) {
      syncVideoElementSrc();
      duration.value = currProj.value?.videoDuration || 0;
      if (duration.value > 0) {
        ensureDefaultChapter(duration.value);
        normalizeProjectChapterRanges();
      }
    }

    if (!loadedFromServer && !queryCode) {
      // 模型改为手动添加，不自动注入默认模型
      for (const m of models.value) {
        if (m.url && !meshes.has(m.id)) await loadGLB(m);
      }
      for (const m of models.value) {
        refreshModelHierarchyIfLoaded(m.id, m.name);
      }
    }

    if (chapters.value.length > 0) {
      pruneAllChapterModelConfigs();
    }

    if (!loadedFromServer) {
      selectedChapterId.value = null;
      selectedNodeId.value = null;
      videoOnlyMode.value = false;
      if (!viewOnly.value && !isPreviewMode.value) showVideoPip.value = false;
      if (meshes.size > 0) {
        resetAllModelsToDefault();
        frameCameraOnSceneModels(0);
      }
    }

    handleResize();
    window.addEventListener("resize", handleResize);
    stripPreviewModeFromLocation();
    // 灯光布局/环境贴图等可能在下一帧才落稳，延迟再标定一次，避免误报未保存红点
    markSceneAsSavedBaseline();
    await nextTick();
    markSceneAsSavedBaseline();
    requestAnimationFrame(() => {
      markSceneAsSavedBaseline();
      window.setTimeout(() => markSceneAsSavedBaseline(), 300);
    });
    void refreshSavedSceneCount();
    setTimeout(() => rootEl.value?.focus(), 100);
    } catch (e) {
      console.error("[movie-editor] boot failed", e);
      toastShow("编辑器初始化失败", "error");
      try {
        if (renderer && scene) {
          ensureDefaultViewportEnvironment();
          applyBackgroundFromSettings();
          handleResize();
        }
      } catch {
        /* ignore recovery errors */
      }
    } finally {
      editorBootLoading.value = false;
    }
  });

  onUnmounted(() => {
    cancelPendingChapterNavWork();
    cancelAnimationFrame(afid);
    resumeProjectPersist();
    unbindViewportPicking();
    unbindControlsInteraction();
    clearHoverHighlight();
    clearSelectionHighlight();
    try {
      composer?.dispose?.();
    } catch {
      /* ignore */
    }
    composer = undefined;
    meshes.forEach((_, id) => rmMesh(id));
    disposeViewportEnvironment(envMap);
    envMap = null;
    try {
      renderer?.forceContextLoss?.();
    } catch {
      /* ignore */
    }
    try {
      renderer?.dispose();
    } catch {
      /* ignore */
    }
    renderer = undefined as unknown as THREE.WebGLRenderer;
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

  function renameActiveVideoNode(name: string) {
    const video = activeVideoNode.value;
    if (!video) return;
    // 允许清空（输入过程中），勿用旧名回填否则最后一个字符删不掉
    video.name = name;
    video.updatedAt = new Date().toISOString();
  }

  function renameSelectedGroup(name: string) {
    const id = selectedNodeId.value;
    if (!id || !currProj.value) return;
    const node = currProj.value.nodes.find(n => n.id === id);
    if (!node || node.type !== "group") return;
    node.name = name;
    node.updatedAt = new Date().toISOString();
  }

  function getPresentationModelState(modelId: string) {
    const object = meshes.get(modelId);
    if (!object) return null;
    return {
      visible: object.visible,
      position: [object.position.x, object.position.y, object.position.z],
      scale: [object.scale.x, object.scale.y, object.scale.z]
    };
  }

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
    presentationPlaybackSession,
    presentationDisplayTime,
    presentationCurrentNavChapterId,
    presentationDisplayPlaying,
    getPresentationModelState,
    isLooping,
    playbackRate,
    playbackRateLabel,
    playbackHintVisible,
    playbackHintFading,
    playingIdx,
    selectedChapterId,
    chapterNavLock,
    isCameraTransitioning,
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
    selectModelNode,
    modelFormRevision,
    animSegmentRevision,
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
    editorBootLoading,
    editorInitializing,
    rightTab,
    videoFps,
    modelSetCode,
    pendingModelSetCode,
    sceneCode,
    shareLink,
    sceneSavedAt,
    savingScene,
    sceneHasUnsavedChanges,
    canSaveScene,
    sceneListVersion,
    savedSceneCount,
    canOpenSceneList,
    refreshSavedSceneCount,
    chapterFormRevision,
    chForm,
    subForm,
    mOff,
    mScl,
    mVis,
    mHL,
    mAni,
    mRot,
    mOutlineColor,
    mWireColor,
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
    sceneLights,
    selectedSceneLightId,
    matColor,
    matRoughness,
    matMetalness,
    matNormalStr,
    matEmissiveInt,
    bloomIntensity,
    bloomThreshold,
    bloomRadius,
    ppExposure,
    ppContrast,
    ppSaturation,
    toneMapping,
    envIntensityVal,
    envReflectionIntensity,
    envRotation,
    envReflectionSphereVisible,
    envMapUrl,
    envMapIsHdr,
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
    msaaEnabled,
    antialiasingMode,
    ANTIALIASING_MODE_OPTIONS,
    maxPixelRatio,
    effectiveRenderPixelRatio,
    targetFps,
    displayFps,
    TARGET_FPS_OPTIONS,
    setTargetFps,
    applyAntialiasing,
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
    presentationNavChapterCount,
    presentationNavChapters,
    presentationTimelineChapterIdx,
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
    presentationFillScale,
    presentationChapterSegmentFlex,
    chapterFillPct,
    chapterListFillPct,
    chapterSegmentFlex,
    chapterSegmentStyle,
    toastShow,
    uploadVideo,
    removeVideo,
    createNewSceneDraft,
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
    waitForVideoReady,
    prevCh,
    nextCh,
    toggleLoop,
    saveTitle,
    selectChapter,
    playChapter,
    toggleChapterPlayback,
    highlightSceneNode,
    addChapter,
    addChildChapter,
    canAddChildChapter,
    getChapterChildren,
    getAllDescendantChapterIds,
    isChapterPlaying,
    isChapterListActive,
    getActiveChapterIdForUi,
    isPresentationTimelineSegmentCurrent,
    presentationUiChapterId,
    presentationNavIndex,
    presentationUiRevision,
    canPresentationPrevChapter,
    canPresentationNextChapter,
    getPresentationNavChapters,
    resolvePresentationNavChapter,
    chCmd,
    deleteSceneNode: sceneNodeApi.deleteSceneNode,
    selectSceneNode: sceneNodeApi.selectSceneNode,
    addGroupNode: sceneNodeApi.addGroupNode,
    addVideoNode: sceneNodeApi.addVideoNode,
    addAnimationNode: sceneNodeApi.addAnimationNode,
    getSceneNodeChildren: sceneNodeApi.getSceneNodeChildren,
    isSceneNodeExpanded: sceneNodeApi.isSceneNodeExpanded,
    toggleSceneNodeExpanded: sceneNodeApi.toggleSceneNodeExpanded,
    isSceneNodeSelected: isTreeNodeHighlighted,
    getVideoNodeSrc: sceneNodeApi.getVideoNodeSrc,
    moveSceneVideoToGroup: sceneNodeApi.moveSceneVideoToGroup,
    startDragSceneVideo: sceneNodeApi.startDragSceneVideo,
    endDragSceneVideo: sceneNodeApi.endDragSceneVideo,
    setSceneNodeDropTarget: sceneNodeApi.setSceneNodeDropTarget,
    canDropDraggedVideoTo: sceneNodeApi.canDropDraggedVideoTo,
    triggerVideoNodeUpload: sceneNodeApi.triggerVideoNodeUpload,
    renameActiveVideoNode,
    renameSelectedGroup,
    nodes,
    rootSceneNodes,
    selectedNodeId,
    activeVideoId,
    expandedNodeIds,
    sceneNodeDraggingId,
    sceneNodeDropTargetId,
    sceneNodeDropKind,
    videoOnlyMode,
    showNodePanel,
    activeVideoNode,
    saveChF,
    saveChapterFull,
    deleteChapter,
    liveCam,
    liveFov,
    getCameraFormSnapshot,
    applyCameraFormSnapshot,
    applyCameraFormToViewport,
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
    enterPreview,
    exitPreview,
    onKey,
    onMeta,
    onTick,
    onVideoPlay,
    onVideoPause,
    onVideoEnd,
    onVideoSeeked,
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
    setPpContrast,
    setPpSaturation,
    setPpExposure,
    applyGrid,
    applyEnv,
    setEnvReflectionIntensity,
    setEnvIntensityVal,
    setEnvRotation,
    applyShadow,
    applyShadowIntensity,
    addSceneLight,
    removeSceneLight,
    selectSceneLight,
    applySceneLights,
    EASING_LIST,
    CURVE_LABELS,
    TONE_MAPPING_OPTIONS
  });
}
