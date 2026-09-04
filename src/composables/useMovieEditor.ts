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
import { GTAOPass } from "three/addons/postprocessing/GTAOPass.js";
import { BrightnessContrastShader } from "three/addons/shaders/BrightnessContrastShader.js";
import { HueSaturationShader } from "three/addons/shaders/HueSaturationShader.js";
import { computed, nextTick, onMounted, onUnmounted, markRaw, reactive, ref, shallowRef, watch } from "vue";
import { useRoute, useRouter } from "vue-router";

import {
  buildScenePreviewLink,
  fetchModelSet,
  fetchSceneList,
  fetchScene,
  isEditorServerNotFoundError,
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
  getBoundSceneCodeStorageKey,
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
import {
  annotateSegmentsAbsoluteTimes,
  calcSegmentsTotalDuration,
  cloneClipVisual,
  createDefaultClipVisual,
  findAnimatingSegmentAtElapsed,
  mapStoredAnimSegment,
  nextAnimSegmentId,
  roundAnimNum,
  serializeClipVisual,
  syncPauseChainFromAbsoluteTimes,
  type ClipVisualState
} from "@/composables/movie-editor/utils/animation";
import {
  cloneAnimationClip,
  cloneCameraConfig,
  cameraConfigsNearlyEqual,
  clipTargetKey,
  createAnimationClip,
  createEmptyClipTarget,
  DEFAULT_CLIP_ANIM_TIME,
  DEFAULT_CLIP_PAUSE_TIME,
  ensureClipTimingFields,
  findActiveClipAtElapsed,
  getClipsTotalDuration,
  liveSegmentToTarget,
  migrateModelAnimConfigsToClips,
  projectClipsToModelAnimConfigs,
  rebuildClipAbsoluteTimes,
  resolveClipAnimTime,
  resolveClipPauseTime,
  resolveTargetAnimTime,
  resolveTargetPauseTime,
  syncClipTimes,
  targetToLiveSegment
} from "@/composables/movie-editor/utils/animationClips";
import {
  beginPlaybackDiagSpan,
  bindVisibilityRenderController,
  clearGlbUrlCache,
  clearVideoWarmPool,
  DEFAULT_GLB_LOAD_CONCURRENCY,
  getCachedGlbLoad,
  getPlaybackDiagSamples,
  isPlaybackDiagnosticsEnabled,
  logPlaybackReproChecklist,
  mapPool,
  markPlaybackDiag,
  MOBILE_PRESENTATION_DPR_SOFT_CAP,
  resolvePlaybackClock,
  scheduleWarmVideoSrcs,
  warmVideoSrc,
  peekSeekableMediaUrl,
  prefetchSeekableMedia,
  ensureSeekableMediaUrl,
  clearSeekableMediaCache,
  setCachedGlbLoad,
  shouldForceClearPlaybackLocks,
  shouldPresentFrame,
  shouldSampleClipsOnly,
  shouldSampleLegacyAnimConfig,
  summarizePlaybackDiag,
  type VisibilityRenderController
} from "@/composables/movie-editor/playback";
import type { AnimationClip, AnimationClipTarget } from "@/interface/project";
import { createDefaultModelConfig, getModelConfig, DEFAULT_OUTLINE_COLOR, DEFAULT_WIREFRAME_COLOR, DEFAULT_MODEL_HIGHLIGHT_COLOR } from "@/composables/movie-editor/utils/modelConfig";
import {
  buildSceneLightRuntime,
  computeSceneLightPosition,
  createDefaultSceneLight,
  createDefaultSceneLights,
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
  getVideoNodes,
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
import { useSceneNodeStore } from "@/stores/modules/sceneNode";
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
  buildNodeObjectIndex,
  collectObjectsForNodeId,
  countHierarchyNodes,
  findHierarchyNode,
  findHierarchyPathIds,
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
  const savingClips = ref(false);
  const persistPercent = ref(0);
  const persistText = ref("");
  /** 动画已写入 clips，但尚未点右上角「更新」同步到服务器 */
  const clipsAwaitingSceneSave = ref(false);
  const sceneListVersion = ref(0);
  /** 当前模型集下已保存场景数量（编辑列表≥1 才可打开） */
  const savedSceneCount = ref(0);
  const sceneSavedSignature = ref("");
  /** 轻量脏标记：禁止在模板 computed 中深拷贝/序列化完整场景。 */
  const sceneDraftRevision = ref(0);
  const sceneSavedRevision = ref(0);
  let lastSavedSceneSettingsSig = "";
  let sceneDirtySuspendCount = 0;
  let clipUiSyncing = false;
  let clipUiSyncGen = 0;
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
  /** 动画时间轴：当前编辑的时间片段 id */
  const activeAnimClipId = ref<string | null>(null);
  /** 当前片段内主编辑目标 key：`${modelId}|${nodeId||''}` */
  const activeClipTargetKey = ref<string | null>(null);
  /** 片段内多选目标（Shift 加选 / Ctrl 取消） */
  const activeClipTargetKeys = ref<string[]>([]);
  /** 正在编辑但尚未写入片段的草稿目标（改过才入列表） */
  const clipDraftTargetKey = ref<string | null>(null);
  const animClipListRevision = ref(0);
  /** 当前片段「已改」目标 key 集合（树节点 O(1) 查询，避免 144 节点 × targets 扫树） */
  const activeClipEditedKeySet = shallowRef(new Set<string>());
  /** 当前多选 key 集合（树节点 O(1) 查询） */
  const activeClipSelectedKeySet = shallowRef(new Set<string>());
  /** 片段目标数超过该阈值：轻量预览（只刷主目标）、跳过描边重建，避免每步 O(N) 卡死 */
  const CLIP_HEAVY_TARGET_THRESHOLD = 32;
  /** modelId → (rawNodeId → displayNodeId) */
  const hierarchyDisplayIdMaps = new Map<string, Map<string, string>>();
  /** @deprecated 兼容旧导出；请用 activeAnimClipId */
  const activeAnimTrackKey = activeAnimClipId;
  const animTrackListRevision = animClipListRevision;
  let _chAnimLock = false; // prevent re-entrant chapter animation from onTick
  let chAnimChapterId: string | null = null;
  /** 延迟预览与切换视频共用的代次，旧回调不得提交到新会话。 */
  let chapterPreviewGeneration = 0;
  let videoSourceGeneration = 0;
  /** 编辑态点选动画：延后刷景 / 同步片段的代次 */
  let pendingClipSyncGen = 0;
  let editPlaybackSyncChapterId: string | null = null;
  let editPlaybackSyncElapsed = -1;
  let lastVideoPlaybackSyncTime = -1;
  /** 编辑态播放中已运镜的章节，避免 timeupdate 重复触发镜头 */
  let editPlaybackCameraChapterId: string | null = null;
  let chAnimWallclock = false;
  /** 进度条章节名等 UI：普通 let 不会触发 computed，切章时 +1 */
  const playbackUiRevision = ref(0);
  /** 预览/展示：用户手势后才取消静音，满足自动播放策略同时能出声 */
  const userAudioUnlocked = ref(false);
  function bumpPlaybackUiRevision() {
    playbackUiRevision.value++;
  }
  function unlockVideoAudio() {
    if (!userAudioUnlocked.value) userAudioUnlocked.value = true;
    syncVideoAudioState();
  }
  const videoIsMuted = computed(
    () => (viewOnly.value || isPreviewMode.value) && !userAudioUnlocked.value
  );
  /** 墙钟开播时刻（performance.now），用真实时间推进，保证片段按时长完整播完 */
  let chAnimWallclockStart = 0;
  let chAnimWallclockMaxDur = 0;
  /** 墙钟播放中上次已套用外观的片段 */
  let wallclockVisualClipId: string | null = null;
  /** 播放中用户拖拽过视口：停止强制运镜，允许自由旋转 */
  let playbackCameraUserOverride = false;
  /** 大体量轮廓/线框异步重建令牌 */
  let visualRebuildGeneration = 0;
  const pendingVisualRebuildOwners = new Map<string, number>();
  /** 播放中多模型外观分帧任务；换片段/停止时作废 */
  let playbackVisualGeneration = 0;
  let playbackVisApplied: Array<{ obj: THREE.Object3D; modelId: string }> = [];
  let chapterHiddenRestoreList: THREE.Object3D[] = [];
  /** 上一章已套到场景上的 clip 目标，切章时必须还原，否则模型会叠在一起 */
  let lastPlaybackAppliedChapterId: string | null = null;
  let lastPlaybackAppliedKeys: string[] = [];
  /** 诊断：当前日志片段与上一帧时间 */
  let wallclockDebugClipId: string | null = null;
  let wallclockDebugLastNow = 0;
  let videoAnimLastSyncAt = 0;
  let chapterAnimTargetsCache: {
    chapterId: string;
    targets: Array<{ objs: THREE.Object3D[]; cfg: ModelConfig; liveSegs?: any[]; modelId?: string }>;
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
  /** seek 锁上锁时间：用于播放中残留锁的自愈，避免进度条/动画永久卡住 */
  let videoChapterSyncPausedAt = 0;
  let chapterNavFollowUpRaf = 0;
  let chapterPlaybackRequestSeq = 0;
  /** 用户点了某动画播放、视频还未 seek 到位：无论向前/向后都钉住该章，避免高亮和进度仍跟旧时间 */
  let chapterSeekPinId: string | null = null;
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
  /** 墙钟预览：当前已播放秒数 / 总时长（供片段条进度与高亮） */
  const clipPlayElapsed = ref(0);
  const clipPlayDuration = ref(0);
  const wallclockPreviewActive = computed(() => chAnimWallclock && totalPlaying.value);
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
  const sceneLights = ref<SceneLightSettings[]>(createDefaultSceneLights());
  const selectedSceneLightId = ref<string | null>(sceneLights.value[0]?.id ?? null);
  const sceneLightRuntimes = new Map<string, SceneLightRuntime>();
  // Material (per-model)
  const matColor = ref(DEFAULT_SCENE_SETTINGS.matColor);
  // Ambient Occlusion
  const aoDistanceFallOff = ref(DEFAULT_SCENE_SETTINGS.aoDistanceFallOff);
  const aoRadius = ref(DEFAULT_SCENE_SETTINGS.aoRadius);
  const aoScale = ref(DEFAULT_SCENE_SETTINGS.aoScale);
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
  let lastOverlaySyncAt = 0;
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

  function boundSceneCodeStorageKey() {
    return getBoundSceneCodeStorageKey(modelSetCode.value, currProj.value?.id);
  }

  function persistBoundSceneCode(code: string | null = sceneCode.value) {
    try {
      const key = boundSceneCodeStorageKey();
      if (!code) localStorage.removeItem(key);
      else localStorage.setItem(key, code);
    } catch {
      /* ignore quota / private mode */
    }
  }

  function readBoundSceneCode(): string | null {
    try {
      return localStorage.getItem(boundSceneCodeStorageKey());
    } catch {
      return null;
    }
  }

  function isDuplicateNodeIdError(err: unknown) {
    const msg = err instanceof Error ? err.message : String(err ?? "");
    return /duplicate entry/i.test(msg);
  }

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
  /** 进度条 / 播放按钮唯一时钟（展示 session / 编辑 video / 墙钟 wall） */
  const playbackClock = computed(() =>
    resolvePlaybackClock({
      isPresentation: viewOnly.value || isPreviewMode.value,
      wallclockActive: !!(chAnimWallclock && totalPlaying.value),
      sessionTime: presentationDisplayTime.value,
      sessionPlaying: presentationDisplayPlaying.value,
      wallElapsed: clipPlayElapsed.value,
      wallDuration: clipPlayDuration.value,
      wallPlaying: totalPlaying.value,
      videoTime: currentTime.value,
      videoDuration: duration.value,
      videoPlaying: isPlaying.value
    })
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
  const sceneHasUnsavedChanges = computed(
    () => sceneDraftRevision.value !== sceneSavedRevision.value
  );
  const sceneNeedsPersist = computed(
    () => sceneHasUnsavedChanges.value || animDirty.value || clipsAwaitingSceneSave.value
  );
  const canSaveScene = computed(
    () => hasVideo.value && chapters.value.length > 0 && !savingScene.value && !savingClips.value
  );

  function yieldToUi() {
    return new Promise<void>(resolve => {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => resolve());
      });
    });
  }

  function setPersistProgress(percent: number, text: string) {
    persistPercent.value = Math.max(0, Math.min(100, Math.round(percent)));
    persistText.value = text;
  }

  function clearPersistProgress() {
    persistPercent.value = 0;
    persistText.value = "";
  }

  /** 将当前草稿记为「已对齐已保存」，用于加载/刷新后消除误报红点 */
  function markSceneAsSavedBaseline() {
    sceneSavedRevision.value = sceneDraftRevision.value;
    clipsAwaitingSceneSave.value = false;
    try {
      lastSavedSceneSettingsSig = JSON.stringify(collectSceneSettingsData());
    } catch {
      lastSavedSceneSettingsSig = "";
    }
  }

  function runWithoutSceneDirty<T>(fn: () => T): T {
    sceneDirtySuspendCount++;
    try {
      return fn();
    } finally {
      sceneDirtySuspendCount = Math.max(0, sceneDirtySuspendCount - 1);
    }
  }

  function suppressClipUiCommits() {
    const gen = ++clipUiSyncGen;
    clipUiSyncing = true;
    void nextTick(() => {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          window.setTimeout(() => {
            if (gen === clipUiSyncGen) clipUiSyncing = false;
          }, 80);
        });
      });
    });
  }

  function bumpSceneDraft() {
    if (sceneDirtySuspendCount > 0 || sceneBootstrapBusy.value || editorInitializing.value) return;
    sceneDraftRevision.value++;
  }
  const models = computed(() => currProj.value?.models || []);
  const subtitles = computed(() => currProj.value?.subtitles || []);
  const selectedChapter = computed(() => chapters.value.find(c => c.id === selectedChapterId.value));
  watch(
    () => ({
      title: projectTitle.value,
      nodes: nodes.value.map(node => {
        const base = [
          node.id,
          node.type,
          node.parentId ?? "",
          node.sortOrder,
          node.name,
          node.updatedAt
        ];
        if (node.type === "video") {
          return [
            ...base,
            node.videoSrc,
            node.videoDuration,
            node.videoWidth,
            node.videoHeight,
            node.videoDisplayWidth
          ];
        }
        if (node.type === "animation") {
          return [
            ...base,
            node.startTime,
            node.endTime,
            node.subtitle,
            node.color,
            node.camera.position.join(","),
            node.camera.target.join(","),
            node.camera.fov,
            node.camera.transitionSec
          ];
        }
        return base;
      }),
      models: models.value.map(model => [
        model.id,
        model.name,
        model.color,
        model.groundY,
        model.basePosition.join(","),
        model.updatedAt
      ]),
      subtitles: subtitles.value.map(subtitle => [
        subtitle.id,
        subtitle.parentNodeId,
        subtitle.startTime,
        subtitle.endTime,
        subtitle.text,
        subtitle.color,
        subtitle.backgroundColor,
        subtitle.displayMode,
        subtitle.updatedAt
      ])
    }),
    () => {
      bumpSceneDraft();
    },
    { deep: false, flush: "post" }
  );
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
  /** 当前编辑器实例是否仍挂载；replace query 导致 fullPath remount 时旧实例必须停掉 loadGLB */
  let editorAlive = true;
  let editorSessionGen = 0;
  let meshes = new Map<string, THREE.Mesh | THREE.Group>();
  let mixers: THREE.AnimationMixer[] = [];
  let afid = 0;
  let viewportNeedsRender = true;
  let renderLoopPausedByVisibility = false;
  let visibilityRenderController: VisibilityRenderController | null = null;
  /** 交互后短时强制出画，避免 on-demand 让点击「半天没反应」 */
  let viewportInteractionKeepAliveUntil = 0;
  const requestViewportRender = () => {
    viewportNeedsRender = true;
    viewportInteractionKeepAliveUntil = performance.now() + 2000;
  };
  let groundMesh: THREE.Mesh;
  let gridHelper: THREE.Object3D;
  let ambientLight: THREE.AmbientLight;
  let sceneLightsGroup: THREE.Group;
  let composer: EffectComposer | undefined;
  let bloomPass: UnrealBloomPass;
  let gtaoPass: GTAOPass;
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
  let orbitSettling = false;
  let orbitSettleIdleFrames = 0;
  let pendingSelectedViewport: { ch: Chapter; prevClipKeys: string[] } | null = null;
  let cameraAnimating = false;
  let editorPerfScale = 1;
  let editorAvgFrameMs = 0;
  const editorFrameDts: number[] = [];
  let editorPerfAdaptHoldUntil = 0;
  let introLabelLastUpdateAt = 0;
  let lastHoverPickAtMs = 0;
  let lastBloomPostKey = "";
  let lastAoPostKey = "";
  let lastHoverOutlineKey = "";
  let lastHoverPickAt = { x: 0, y: 0 };
  const HOVER_PICK_MOVE_PX = 10;
  const HOVER_PICK_MIN_INTERVAL_MS = 90;
  const ORBIT_DRAG_SUSPEND_PX = 8;
  let onControlsInteractionEnd: (() => void) | null = null;
  let onControlsInteractionStart: (() => void) | null = null;
  let onControlsChange: (() => void) | null = null;
  let cameraUiSyncRaf = 0;
  let onCanvasContextMenu: ((e: Event) => void) | null = null;
  let viewportResizeObserver: ResizeObserver | null = null;
  let viewportResizeRaf = 0;

  function init3D() {
    if (!editorAlive) return;
    if (scene && renderer && canvasEl.value) return;
    if (!viewportEl.value || !canvasEl.value) return;
    const w = viewportEl.value.clientWidth;
    const h = viewportEl.value.clientHeight;

    editorSessionGen++;
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

    // Check EXT_float_blend support — required for AO/GTAO blending on HalfFloat RTs
    try {
      const gl = renderer.getContext();
      const hasFloatBlend = gl instanceof WebGL2RenderingContext
        ? gl.getExtension("EXT_float_blend")
        : gl.getExtension("EXT_float_blend");
      if (!hasFloatBlend) {
        console.warn(
          "[movie-editor] EXT_float_blend NOT supported. AO/GTAO blend on HalfFloat will fail. " +
          "Forcing UnsignedByteType for composer render targets."
        );
      }
      (window as any).__hasFloatBlend = !!hasFloatBlend;
    } catch {
      (window as any).__hasFloatBlend = false;
    }

    controls = new OrbitControls(camera, canvasEl.value);
    controls.target.set(...DEFAULT_CAMERA.target);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    // 右键平移镜头；左键旋转、中键缩放（默认映射，显式写出避免被覆盖）
    controls.enablePan = true;
    controls.screenSpacePanning = true;
    controls.mouseButtons = {
      LEFT: THREE.MOUSE.ROTATE,
      MIDDLE: THREE.MOUSE.DOLLY,
      RIGHT: THREE.MOUSE.PAN
    };
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
      applyAO();
      applyAntialiasingNow();
      if (bloomIntensity.value > 0 || ppContrast.value !== 0 || ppSaturation.value !== 0) {
        toggleBloom();
        toggleColor();
      }
      saveAllSettings();
      sceneLightsPinnedFromSettings = true;
    } catch (e) {
      console.warn("Settings restore error", e);
    }

    ensureModelLoaders();
    // dracoLoader.setDecoderConfig({ type: "js" }); // 可选：强制使用 JS 解码器（调试用）
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
    bindViewportResizeObserver();
    animate();
    if (!visibilityRenderController) {
      visibilityRenderController = bindVisibilityRenderController({
        onHide: () => {
          renderLoopPausedByVisibility = true;
          if (afid) {
            cancelAnimationFrame(afid);
            afid = 0;
          }
          markPlaybackDiag("lock", "visibility-hide");
        },
        onShow: () => {
          renderLoopPausedByVisibility = false;
          requestViewportRender();
          if (!afid) animate();
          markPlaybackDiag("unlock", "visibility-show");
        }
      });
    }
    if (isPlaybackDiagnosticsEnabled()) {
      logPlaybackReproChecklist();
      (window as any).__movieEditorPlaybackDiag = {
        samples: () => getPlaybackDiagSamples(),
        summarize: () => summarizePlaybackDiag()
      };
    }
  }

  function isEditorSceneReady() {
    return editorAlive && !!scene && !!renderer;
  }

  async function ensureSceneReady(timeoutMs = 4000): Promise<boolean> {
    if (isEditorSceneReady()) return true;
    if (!editorAlive) return false;
    if (viewportEl.value && canvasEl.value) {
      init3D();
      if (isEditorSceneReady()) return true;
    }
    const t0 = performance.now();
    while (editorAlive && !isEditorSceneReady() && performance.now() - t0 < timeoutMs) {
      await nextTick();
      if (!editorAlive) return false;
      if (viewportEl.value && canvasEl.value) init3D();
      if (isEditorSceneReady()) return true;
      await new Promise<void>(r => window.setTimeout(r, 32));
    }
    return isEditorSceneReady();
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
      viewportPickState = { x: e.clientX, y: e.clientY, time: performance.now() };
      // 按下立刻进入旋转态：不要等 8px，也不要先做大 GLB 悬停拾取
      beginOrbitVisualSuspend();
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
        } else if (wasDrag) {
          endOrbitVisualSuspend();
        }
        return;
      }

      if (!wasDrag) {
        const picked = pickModelAtViewport(e.clientX, e.clientY, {
          shiftKey: e.shiftKey,
          ctrlKey: e.ctrlKey,
          metaKey: e.metaKey
        });
        // 编辑模式点击画布空白处：取消模型选中 + 片段多选高亮
        if (!picked) {
          clearViewportModelSelection();
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
            // 播放中拖拽：立刻停运镜抢镜头，允许自由旋转
            beginOrbitVisualSuspend();
          }
        }
        return;
      }
      lastViewportPointer = { x: e.clientX, y: e.clientY };
      if (viewportPickState || viewportInteracting || orbitDragVisualsSuspended || orbitSettling) return;
      scheduleHoverPick(e.clientX, e.clientY);
    };

    onCanvasContextMenu = (e: Event) => {
      // 仅拦截 3D 画布右键菜单，避免与网页其它右键交互冲突
      e.preventDefault();
      e.stopPropagation();
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
    orbitSettling = false;
    orbitSettleIdleFrames = 0;
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
    viewportInteracting = true;
    requestViewportRender();
    // 取消还在播的运镜，避免和手动旋转抢镜头
    cancelCameraTransitionSilently();
    if (controls) controls.enableDamping = true;
    // 预览/展示/编辑：播放中拖拽后接管镜头，运镜不再每帧写回
    if (
      chAnimWallclock ||
      isPlaying.value ||
      totalPlaying.value ||
      (videoEl.value && !videoEl.value.paused)
    ) {
      playbackCameraUserOverride = true;
    }
    // 预览/展示：只接管镜头，不做编辑态的悬停/叠加挂起
    if (viewOnly.value || isPreviewMode.value) return;
    if (orbitDragVisualsSuspended) return;
    orbitDragVisualsSuspended = true;
    orbitSettling = false;
    orbitSettleIdleFrames = 0;
    pendingHoverPointer = null;
    if (hoverPickRaf) {
      cancelAnimationFrame(hoverPickRaf);
      hoverPickRaf = 0;
    }
    clearHoverTarget();
  }

  function flushOrbitSettleWork() {
    if (!orbitSettling) return;
    orbitSettling = false;
    orbitSettleIdleFrames = 0;
    syncEditorComposerPasses();
    // 只同步表单数字，禁止写回节点相机：旋转视口不是编辑，不能点亮「更新」
    runWithoutSceneDirty(() => {
      syncCameraUiFromViewport({ persistChapter: false });
    });
    const pending = pendingSelectedViewport;
    pendingSelectedViewport = null;
    if (pending && selectedChapterId.value === pending.ch.id) {
      if (pending.prevClipKeys.length) {
        restoreMeshesForClipKeys(pending.prevClipKeys, {
          skipOutlineRebuild: true,
          bindPose: true
        });
      }
      applySelectedChapterViewport(pending.ch);
    }
  }

  function endOrbitVisualSuspend() {
    viewportInteracting = false;
    if (controls) controls.enableDamping = true;
    // 预览/展示：松手后继续保留用户视角（playbackCameraUserOverride），直到停播/切章
    if (viewOnly.value || isPreviewMode.value) return;
    orbitDragVisualsSuspended = false;
    orbitSettling = true;
    orbitSettleIdleFrames = 0;
    // 松手当帧禁止落盘/整树同步：否则主线程一卡，阻尼再补到目标角
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
    if (
      !sceneBootstrapBusy.value &&
      !editorInitializing.value &&
      sceneDirtySuspendCount === 0
    ) {
      try {
        const sig = JSON.stringify(collectSceneSettingsData());
        if (sig !== lastSavedSceneSettingsSig) bumpSceneDraft();
      } catch {
        /* ignore signature errors */
      }
    }
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

  /** 将当前 Orbit 视角写回镜头表单（相机位置 / 观察目标） */
  function syncCameraUiFromViewport(opts?: { persistChapter?: boolean }) {
    if (!camera || !controls) return;
    if (viewOnly.value || isPreviewMode.value) return;
    if (chapterNavLock.value || camTrans || isCameraTransitioning.value || cameraAnimating) return;

    const position = roundVec3([camera.position.x, camera.position.y, camera.position.z]);
    const target = roundVec3([controls.target.x, controls.target.y, controls.target.z]);
    if (
      camP[0] === position[0] &&
      camP[1] === position[1] &&
      camP[2] === position[2] &&
      camT[0] === target[0] &&
      camT[1] === target[1] &&
      camT[2] === target[2]
    ) {
      return;
    }

    // 拖拽过程中禁止写响应式 camP：否则每帧触发 Vue 刷新，转镜头会先顿再跳
    if ((viewportInteracting || orbitSettling) && !opts?.persistChapter) return;

    camP[0] = position[0];
    camP[1] = position[1];
    camP[2] = position[2];
    camT[0] = target[0];
    camT[1] = target[1];
    camT[2] = target[2];

    // 旋转/平移视口绝不写回节点相机。运镜落盘只走「捕获视口」。
    if (!opts?.persistChapter) return;
  }

  function scheduleSyncCameraUiFromViewport() {
    if (cameraUiSyncRaf) return;
    cameraUiSyncRaf = requestAnimationFrame(() => {
      cameraUiSyncRaf = 0;
      syncCameraUiFromViewport();
    });
  }

  function bindControlsInteraction() {
    if (!controls) return;
    onControlsInteractionStart = () => {
      beginOrbitVisualSuspend();
    };
    onControlsChange = () => {
      if (viewportInteracting || orbitSettling) return;
      scheduleSyncCameraUiFromViewport();
    };
    onControlsInteractionEnd = () => {
      endOrbitVisualSuspend();
    };
    controls.addEventListener("start", onControlsInteractionStart);
    controls.addEventListener("change", onControlsChange);
    controls.addEventListener("end", onControlsInteractionEnd);
  }

  function syncPresentationInteractionMode() {
    if (!controls) return;
    controls.enabled = true;
    controls.enableRotate = true;
    controls.enableZoom = true;
    // 展示模式关闭平移，避免误触；编辑模式右键可平移
    controls.enablePan = !isPresentationMode();
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
    if (onControlsChange) controls.removeEventListener("change", onControlsChange);
    if (onControlsInteractionEnd) controls.removeEventListener("end", onControlsInteractionEnd);
    onControlsInteractionStart = null;
    onControlsChange = null;
    onControlsInteractionEnd = null;
    if (cameraUiSyncRaf) {
      cancelAnimationFrame(cameraUiSyncRaf);
      cameraUiSyncRaf = 0;
    }
  }

  function scheduleHoverPick(clientX: number, clientY: number) {
    if (viewportInteracting || orbitSettling || cameraAnimating || camTrans || isPreviewMode.value) return;
    const now = performance.now();
    if (now - lastHoverPickAtMs < HOVER_PICK_MIN_INTERVAL_MS) return;
    const moved = Math.hypot(clientX - lastHoverPickAt.x, clientY - lastHoverPickAt.y);
    if (moved < HOVER_PICK_MOVE_PX && hoverModelId.value) return;

    pendingHoverPointer = { x: clientX, y: clientY };
    if (hoverPickRaf) return;
    hoverPickRaf = requestAnimationFrame(() => {
      hoverPickRaf = 0;
      if (!pendingHoverPointer || viewportInteracting || orbitSettling || cameraAnimating || camTrans || isPreviewMode.value) return;
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
      aoDistanceFallOff: aoDistanceFallOff.value,
      aoRadius: aoRadius.value,
      aoScale: aoScale.value,
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
      sceneLightsPinnedFromSettings = true;
    } else if (d.dirIntensity !== undefined || d.fillIntensity !== undefined) {
      sceneLights.value = migrateLegacySceneLights(d);
      selectedSceneLightId.value = sceneLights.value[0]?.id ?? null;
    }
    if (d.matColor) matColor.value = d.matColor;
    if (d.aoDistanceFallOff !== undefined) aoDistanceFallOff.value = d.aoDistanceFallOff;
    if (d.aoRadius !== undefined) aoRadius.value = d.aoRadius;
    if (d.aoScale !== undefined) aoScale.value = d.aoScale;
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
    saveAllSettings();
    const settings = sceneSettings as { envMapUrl?: string; envMapIsHdr?: boolean };
    if (settings.envMapUrl) {
      await loadEnvironmentMapFromUrlAsync(settings.envMapUrl, !!settings.envMapIsHdr);
    }
    commitStoredSceneVisuals();
  }

  function resetSceneSettings() {
    const d = DEFAULT_SCENE_SETTINGS;
    ambIntensity.value = d.ambIntensity;
    sceneLights.value = createDefaultSceneLights();
    selectedSceneLightId.value = sceneLights.value[0]?.id ?? null;
    sceneLightsPinnedFromSettings = true;
    matColor.value = d.matColor;
    aoDistanceFallOff.value = d.aoDistanceFallOff;
    aoRadius.value = d.aoRadius;
    aoScale.value = d.aoScale;
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
    applyAO();
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
      applyEnv();
      applyModelEnvReflectionIntensity();
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
    applyAntialiasingNow();
    if (envMapUrl.value) {
      const ok = await loadEnvironmentMapFromUrlAsync(envMapUrl.value, envMapIsHdr.value);
      if (!ok && !envMap) ensureDefaultViewportEnvironment();
    } else if (!envMap) {
      ensureDefaultViewportEnvironment();
    } else {
      applyEnv();
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
    commitStoredSceneVisuals();
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
        color: matColor.value
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
  let presentationTextureQualityApplied = false;

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
    // 编辑页「预览」保持编辑器 DPR，避免每次进出重建 composer RT
    if (viewOnly.value) {
      const w = viewportEl.value?.clientWidth ?? 0;
      const h = viewportEl.value?.clientHeight ?? 0;
      const maxTex = renderer?.capabilities.maxTextureSize ?? 4096;
      const gpu = ensurePresentationGpuProfile() ?? {
        tier: 1 as const,
        maxPresentationDpr: isCoarsePointerDevice() ? 1.75 : 2,
        enableComposerMsaa: false
      };
      // 展示页：手机软顶 1.5；桌面至少 1.75，配合 SMAA
      const coarse = isCoarsePointerDevice();
      const configured = Math.max(
        maxPixelRatio.value,
        coarse ? MOBILE_PRESENTATION_DPR_SOFT_CAP : 1.75
      );
      const ratio = resolvePresentationPixelRatio(
        configured,
        w,
        h,
        maxTex,
        gpu,
        presentationPerfScale
      );
      return coarse ? Math.min(ratio, MOBILE_PRESENTATION_DPR_SOFT_CAP) : ratio;
    }
    const base = resolveEditorRenderPixelRatio(maxPixelRatio.value);
    return Math.max(1, base * editorPerfScale);
  }

  /** 编辑模式：按帧耗时自适应分辨率，运镜期间冻结避免画面抖动 */
  function adaptEditorRenderPerf(frameDtSec: number) {
    if (isPresentationMode()) return;
    if (camTrans || cameraAnimating || isCameraTransitioning.value) return;
    if (performance.now() < editorPerfAdaptHoldUntil) return;

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
    // 选中描边始终全分辨率，避免斜视/远近景时出现皱折锯齿
    if (outlinePass && outlinePass.downSampleRatio !== 1) {
      outlinePass.downSampleRatio = 1;
    }
    // 场景采样 ≥1.5x 时轮廓/外观高亮也走全分辨率，否则刷新后看起来像没开 2X
    const wantFull = maxPixelRatio.value >= 1.5;
    const softRatio = wantFull ? 1 : pressure ? 3 : 2;
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

    // 动画信息播放时关掉选中描边，避免「显示=false」的零件被 OutlinePass 画成蓝线框
    const clipPreviewPlaying = !!_chAnimLock;
    if (outlinePass) outlinePass.enabled = !presentation && hasSelection && !clipPreviewPlaying;
    if (hoverOutlinePass) hoverOutlinePass.enabled = !presentation && hasHover && !clipPreviewPlaying;
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
    if (gtaoPass) gtaoPass.enabled = !presentation;
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
  /** 播放（墙钟/视频跟播）时跳过逐帧后处理同步与 overlay 扫描，避免 100+ 目标卡顿 */
  function isAnyPlaybackActive(): boolean {
    return !!(chAnimWallclock || totalPlaying.value || (_chAnimLock && videoEl.value && !videoEl.value.paused));
  }

  function renderViewportFrame() {
    if (!renderer || !scene || !camera || envBakeBusy) return;
    if (renderer.getContext()?.isContextLost?.()) return;
    syncRendererPresentationState();
    if (composer) {
      applyPostProcessing();
      composer.render();
    } else {
      renderer.render(scene, camera);
    }
  }

  /** 展示模式关闭编辑器专用 Pass，强制 SMAA 抗锯齿 */
  function syncPresentationRenderProfile(opts?: { skipComposerRt?: boolean }) {
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
    if (!opts?.skipComposerRt) {
      syncComposerMsaaSamples();
      syncRenderPixelRatio();
    }
    if (presentation && renderer) {
      ensurePresentationGpuProfile();
      if (!presentationTextureQualityApplied) {
        meshes.forEach(root => applyMeshTextureQuality(root, renderer));
        presentationTextureQualityApplied = true;
      }
    }
  }

  function syncComposerMsaaSamples(presentationHeavyMotion = isPresentationHeavyMotion()) {
    if (!composer || !renderer) return;
    const gl = renderer.getContext();
    const gpu = viewOnly.value ? ensurePresentationGpuProfile() : null;
    const presentation = viewOnly.value;
    const editorMotion = !presentation && isEditorHeavyMotion();
    const coarse = isCoarsePointerDevice();
    const msaaBase = presentation ? gpu?.enableComposerMsaa ?? false : msaaEnabled.value;
    // GTAOPass 与 EffectComposer MSAA 不兼容（官方示例也禁用 MSAA）；AO 开启时强制 0
    const aoActive = !!(gtaoPass && gtaoPass.enabled);

    let samples = 0;
    if (aoActive) {
      samples = 0;
    } else if (presentation) {
      // 电脑展示：固定 2x MSAA（不随播放开关，避免 RT 反复重建打爆显存）
      // 手机展示：0，完全靠 SMAA + DPR（更稳、更省）
      if (msaaBase && gl instanceof WebGL2RenderingContext && !coarse) {
        samples = 2;
      }
    } else if (msaaBase && gl instanceof WebGL2RenderingContext && !editorMotion) {
      samples = 4;
    }

    // 展示页用 8bit RT：SMAA 更合适，也比 HalfFloat+MSAA 省显存
    // 编辑器默认 HalfFloat 以获得 HDR 精度，但不支持 EXT_float_blend 时回退到 UnsignedByte
    // AO 开启时也强制 UnsignedByte：GTAO multiply blend 在 HalfFloat RT 上常失效
    const hasFloatBlend = !!(window as any).__hasFloatBlend;
    const rtType =
      presentation || !hasFloatBlend || aoActive ? THREE.UnsignedByteType : THREE.HalfFloatType;
    const ratio = renderer.getPixelRatio();
    const size = renderer.getSize(new THREE.Vector2());
    const pw = Math.max(Math.round(size.width * ratio), 1);
    const ph = Math.max(Math.round(size.height * ratio), 1);
    const prevRt = composer.renderTarget1;
    const sameSamples = prevRt?.samples === samples;
    const sameType = prevRt?.texture?.type === rtType;
    const sameSize = prevRt?.width === pw && prevRt?.height === ph;
    if (sameSamples && sameType) {
      if (!sameSize) {
        composer.setPixelRatio(ratio);
        if (size.width > 0 && size.height > 0) composer.setSize(size.width, size.height);
      }
      return;
    }

    const rt = new THREE.WebGLRenderTarget(pw, ph, {
      type: rtType,
      samples
    });
    rt.texture.name = "EffectComposer.rt1";
    composer.reset(rt);
    rt.dispose();
    composer.setPixelRatio(ratio);
    if (size.width > 0 && size.height > 0) {
      composer.setSize(size.width, size.height);
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
    // 编辑中的模型轮廓在旋转/移动时，SMAA 对粗描边比 FXAA 更稳定，减少锯齿闪动
    const preferSmaaForModelOutline = modelConfigOutlineRegistry.size > 0;
    if (fxaaPass) fxaaPass.enabled = !preferSmaaForModelOutline && mode === "fxaa";
    if (smaaPass) smaaPass.enabled = preferSmaaForModelOutline || mode === "smaa";
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

    resetEditorAdaptiveResolution();
    // 先按编辑器模式同步，再套展示配置（展示必须最后强制开 SMAA）
    syncAntialiasingPasses();
    handleResize();
    syncPresentationRenderProfile();
    syncEditorOutlineDownsample();
    scheduleSaveSettings();
  }

  function applyAntialiasing() {
    if (pendingAntialiasingApply) cancelAnimationFrame(pendingAntialiasingApply);
    pendingAntialiasingApply = requestAnimationFrame(() => {
      pendingAntialiasingApply = 0;
      applyAntialiasingNow();
    });
  }

  function resetEditorAdaptiveResolution() {
    editorPerfScale = 1;
    editorAvgFrameMs = 0;
    editorFrameDts.length = 0;
    editorPerfAdaptHoldUntil = performance.now() + 2500;
  }

  /** 按当前场景面板参数立刻套上渲染（含采样倍数），不走 rAF，避免刷新后要点一次才生效 */
  function commitStoredSceneVisuals() {
    if (!renderer || !scene) return;
    runWithoutSceneDirty(() => {
      resetEditorAdaptiveResolution();
      applySettings();
      applyGrid();
      applyFog();
      applyAO();
      toggleBloom();
      toggleColor();
      applyShadow();
      applyEnv();
      applyModelEnvReflectionIntensity();
      applyAntialiasingNow();
      handleResize();
      applyAO();
    });
  }

  async function flushStoredSceneVisualsAfterLayout() {
    await nextTick();
    commitStoredSceneVisuals();
    await new Promise<void>(resolve => {
      requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
    });
    commitStoredSceneVisuals();
  }

  function initComposer() {
    if (composer) return;
    const size = renderer.getSize(new THREE.Vector2());
    if (size.x < 1 || size.y < 1) {
      const cssW = Math.max(viewportEl.value?.clientWidth || 1, 1);
      const cssH = Math.max(viewportEl.value?.clientHeight || 1, 1);
      size.set(cssW, cssH);
    }
    composer = new EffectComposer(renderer);
    composer.addPass(new RenderPass(scene, camera));

    // GTAO Screen-Space Ambient Occlusion
    // 注意：与 EffectComposer MSAA 不兼容，AO 开启时 syncComposerMsaaSamples 会强制 samples=0
    gtaoPass = new GTAOPass(scene, camera, size.width, size.height);
    gtaoPass.output = GTAOPass.OUTPUT.Default;
    gtaoPass.blendIntensity = 1;
    gtaoPass.enabled = true;
    installGtaoPassModelCoverage();
    updateAoSceneCoverage();
    composer.addPass(gtaoPass);

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

    // 悬停轮廓（浅蓝）；默认全分辨率，避免刷新后轮廓发虚
    hoverOutlinePass = new OutlinePass(size, scene, camera);
    hoverOutlinePass.downSampleRatio = 1;
    hoverOutlinePass.visibleEdgeColor.set(HOVER_EDGE_COLOR);
    hoverOutlinePass.hiddenEdgeColor.set(HIDDEN_EDGE_COLOR);
    hoverOutlinePass.edgeStrength = 3.5;
    hoverOutlinePass.edgeThickness = 1.2;
    hoverOutlinePass.edgeGlow = 0;
    hoverOutlinePass.pulsePeriod = 0;
    hoverOutlinePass.enabled = false;
    composer.addPass(hoverOutlinePass);

    // 模型配置轮廓高亮（与场景 2X 采样对齐，默认全分辨率）
    modelConfigOutlinePass = new OutlinePass(size, scene, camera);
    modelConfigOutlinePass.downSampleRatio = 1;
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
        if (!isObjectVisibleChain(child)) return;
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

  /**
   * GTAO G-buffer 阶段临时隐藏编辑器辅助物，确保 AO 只采样全部模型及其子 Mesh。
   * 颜色缓冲仍来自前面的 RenderPass，不受影响。
   */
  function hideNonModelObjectsForAo(): THREE.Object3D[] {
    const hidden: THREE.Object3D[] = [];
    const hide = (obj?: THREE.Object3D | null) => {
      if (!obj || !obj.visible) return;
      obj.visible = false;
      hidden.push(obj);
    };
    hide(gridHelper);
    hide(envReflectionProbe?.group);
    sceneLightRuntimes.forEach(rt => hide(rt.gizmo));
    scene?.traverse(obj => {
      if (
        obj.userData?.isEdgeLine ||
        obj.userData?.isSelectionHelper ||
        obj.userData?.isOutlineShell ||
        obj.userData?.isBodyHighlightOverlay ||
        obj.userData?.isLightGizmo ||
        obj.userData?.isSceneLightGizmo ||
        obj.userData?.isEditorGizmo
      ) {
        hide(obj);
      }
    });
    return hidden;
  }

  /** 包装 GTAOPass.render：G-buffer 只包含模型树，覆盖全部模型与子部件 */
  function installGtaoPassModelCoverage() {
    if (!gtaoPass || (gtaoPass as { __aoCoverageInstalled?: boolean }).__aoCoverageInstalled) return;
    const origRender = gtaoPass.render.bind(gtaoPass);
    gtaoPass.render = ((renderer, writeBuffer, readBuffer, deltaTime, maskActive) => {
      const hidden = hideNonModelObjectsForAo();
      try {
        return origRender(renderer, writeBuffer, readBuffer, deltaTime, maskActive);
      } finally {
        for (const obj of hidden) obj.visible = true;
      }
    }) as typeof gtaoPass.render;
    (gtaoPass as { __aoCoverageInstalled?: boolean }).__aoCoverageInstalled = true;
  }

  /**
   * 让 AO 均匀覆盖全部模型与子部件：
   * - screenSpaceRadius：半径随深度缩放，避免大/小模型世界尺度不一致导致部分无 AO
   * - setSceneClipBox：裁剪盒覆盖 meshes 中所有模型包围盒
   */
  function updateAoSceneCoverage() {
    if (!gtaoPass) return;

    gtaoPass.updateGtaoMaterial({
      distanceFallOff: aoDistanceFallOff.value,
      radius: aoRadius.value,
      scale: aoScale.value,
      screenSpaceRadius: true
    });
    gtaoPass.gtaoMaterial.needsUpdate = true;

    const box = new THREE.Box3();
    let hasContent = false;
    for (const root of meshes.values()) {
      const modelBox = new THREE.Box3().setFromObject(root);
      if (modelBox.isEmpty()) continue;
      box.union(modelBox);
      hasContent = true;
    }

    if (hasContent) {
      const size = box.getSize(new THREE.Vector3());
      const pad = Math.max(size.length() * 0.08, Math.max(aoRadius.value, 0.25) * 2);
      box.expandByScalar(pad);
      gtaoPass.setSceneClipBox(box);
    } else {
      gtaoPass.setSceneClipBox(null);
    }
  }

  function applyAO() {
    if (!composer) initComposer();
    if (!composer || !gtaoPass) return;

    if (!composer.passes.includes(gtaoPass)) {
      // Pass was removed from chain (e.g., after composer.reset edge case)
      composer.passes.splice(1, 0, gtaoPass);
    }

    gtaoPass.enabled = !isPresentationMode();
    gtaoPass.output = GTAOPass.OUTPUT.Default;
    gtaoPass.blendIntensity = 1;
    installGtaoPassModelCoverage();
    updateAoSceneCoverage();

    // AO 开启时必须关掉 Composer MSAA，否则 multiply blend 无效
    syncComposerMsaaSamples();
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
    if (key !== lastBloomPostKey) {
      lastBloomPostKey = key;
      // 强度做衰减映射：UI 数值直观，实际辉光更克制，避免 0.05 就过亮。
      bloomPass.strength = bloomIntensity.value * 0.4;
      bloomPass.threshold = Math.max(0.35, bloomThreshold.value);
      bloomPass.radius = bloomRadius.value;
    }

    // 每帧兜底同步 AO：避免滑杆事件未正确触发 applyAO 时参数不生效
    if (gtaoPass) {
      const aoKey = `${aoDistanceFallOff.value}|${aoRadius.value}|${aoScale.value}|${gtaoPass.enabled}|${meshes.size}`;
      if (aoKey !== lastAoPostKey) {
        lastAoPostKey = aoKey;
        updateAoSceneCoverage();
      }
    }
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
    adoptPlaybackCache(ch);
    invalidateChapterAnimPivotCaches(ch);
    resetGltfMixersForChapterResync();
    // 切章或本章含线框/描边/高亮时必须重建；skip 会留下「有模型无线框」或 colorWrite=false 变黑
    const rebuildOutlines =
      options?.rebuildOutlines === true || chapterNeedsOutlineRebuild(ch);
    applyChapterModelState(ch, elapsed, {
      skipOutlineRebuild: !rebuildOutlines,
      skipOverlaySync: false,
      forceElapsed: elapsed,
      immediatePresent: true,
      // 跟视频重同步：始终优先 clips 缓存（编辑卸投影后 modelConfigs 无 anim）
      forcePlaybackVisuals: !!(ch.clips?.length)
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
    if (!chapterHasAnimation(chapter) && !chapterHasAnyModelEdits(chapter)) {
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

    // 播放中解开残留运镜/seek 锁，避免 mesh 永久停在首帧
    recoverStuckPlaybackLocks(video);

    // 切章/seek 锁定期：禁止用尚未到位的旧 currentTime 解析上一章。
    // 交互 cut 已套好目标姿态；seeking 时不要再用旧时钟覆盖。
    if (videoChapterSyncPaused || presentationChapterTransition) {
      return;
    }
    if (video.seeking && presentationSeekTargetTime != null) {
      return;
    }

    const mediaT = video.currentTime;
    const loopRewind = detectVideoLoopRewind(mediaT);
    // 切章/seek 未到位时必须用目标时间采样 clips，禁止拿旧 currentTime 把片段直接打到末帧/默认
    const t = loopRewind ? 0 : resolvePresentationPlaybackTime(video);
    const queryTime = t;

    if (loopRewind) {
      chapterPlayTarget.value = null;
      chapterSeekPinId = null;
    }

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
      lastVideoPlaybackSyncTime = mediaT;
      return;
    }

    // 时间已落入当前章后，playTarget 跟随视频；未落入时 resolve 已钉住目标章，勿改写
    if (
      chapterPlayTarget.value?.id !== ch.id &&
      isChapterInPlaybackRange(ch, queryTime)
    ) {
      chapterPlayTarget.value = ch;
    }

    const elapsed = getChapterAnimElapsed(ch, queryTime);
    const chapterChanged = editPlaybackSyncChapterId !== ch.id || chAnimChapterId !== ch.id;
    if (chapterChanged || !clipPlayCameraOrigin) {
      capturePlaybackCameraOrigin();
      clipPlayCameraOrigin = resolvePlaybackCameraFrom(ch, elapsed) ?? clipPlayCameraOrigin;
    }
    const elapsedRegressed =
      !chapterChanged &&
      !loopRewind &&
      editPlaybackSyncElapsed > 0.35 &&
      elapsed + 0.35 < editPlaybackSyncElapsed;

    _chAnimLock = true;
    chAnimWallclock = false;

    if (chapterChanged) {
      lastPresentationAutoSwitchChapterId = ch.id;
      // 换动画后必须重套片段外观，否则会沿用上一动画的 clipVisual / 运镜起点
      wallclockVisualClipId = null;
      lastClipCameraId = null;
      restorePlaybackTargetsNotInChapter(ch);
      applyChapterVisibilityOnly(ch);
      adoptPlaybackCache(ch);
    }

    if (!chapterHasAnimation(ch) && !chapterHasAnyModelEdits(ch)) {
      if (loopRewind || chapterChanged) {
        resetAllModelsToDefault();
        if (chapterChanged) {
          applyChapterVisibilityOnly(ch);
          renderViewportFrame();
        }
      }
      lastVideoPlaybackSyncTime = mediaT;
      editPlaybackSyncChapterId = ch.id;
      editPlaybackSyncElapsed = elapsed;
      chAnimChapterId = ch.id;
      if (chapterChanged) markPlaybackAppliedChapter(ch);
      return;
    }

    if (loopRewind || chapterChanged || elapsedRegressed) {
      chAnimChapterId = ch.id;
      const heavyClipChapter = chapterClipTargetCount(ch) >= CLIP_HEAVY_TARGET_THRESHOLD;
      resyncChapterMeshFromVideo(video, ch, elapsed, {
        // 百级显隐片段禁止切章 rebuildOutline；否则主线程卡死、进度条也跟着停
        rebuildOutlines:
          !heavyClipChapter &&
          (chapterChanged || loopRewind || chapterNeedsOutlineRebuild(ch))
      });
      applyClipCameraAtElapsed(ch, elapsed);
      if (heavyClipChapter || chapterChanged) {
        applyPlaybackVisibilityFast(ch, elapsed);
        const activeClip =
          ch.clips?.length
            ? findActiveClipAtElapsed(ch.clips, elapsed) ?? (elapsed <= 1e-4 ? ch.clips[0] : null)
            : null;
        wallclockVisualClipId = activeClip?.id ?? "__none__";
      }
      if (chapterChanged) markPlaybackAppliedChapter(ch);
      if (loopRewind) lastPresentationAutoSwitchChapterId = null;
      return;
    }

    applyChapterWallclockFrame(ch, elapsed);
    chAnimChapterId = ch.id;
    editPlaybackSyncChapterId = ch.id;
    editPlaybackSyncElapsed = elapsed;
    lastVideoPlaybackSyncTime = mediaT;
  }

  function syncVideoChapterAnimationInMainLoop(_now: number) {
    // mesh 已在节流前由 syncVideoDrivenChapterMesh 统一处理
  }

  function syncWallclockChapterAnimationInMainLoop(now: number) {
    if (!_chAnimLock || !chAnimWallclock || !chAnimChapterId) return;
    const ch = chapters.value.find(c => c.id === chAnimChapterId);
    if (!ch) {
      stopChapterAnimation();
      return;
    }
    const maxDur = Math.max(0.1, chAnimWallclockMaxDur);
    // 真实时间：片段按时长完整走完；不做边界咬合（会截断片长 + 画面跳动）
    const elapsed = Math.min(maxDur, Math.max(0, (now - chAnimWallclockStart) / 1000));
    clipPlayElapsed.value = elapsed;
    clipPlayDuration.value = maxDur;
    totalProgress.value = Math.min(1, elapsed / maxDur);
    // 诊断：哪些片段实际被访问、每帧耗时
    const activeClip =
      ch.clips?.length
        ? findActiveClipAtElapsed(ch.clips, elapsed) ?? (elapsed <= 1e-4 ? ch.clips[0] : null)
        : null;
    if (activeClip && activeClip.id !== wallclockDebugClipId) {
      wallclockDebugClipId = activeClip.id;
    }
    wallclockDebugLastNow = now;
    applyChapterWallclockFrame(ch, elapsed);
    if (elapsed >= maxDur - 1e-8) {
      clipPlayElapsed.value = maxDur;
      totalProgress.value = 1;
      applyChapterWallclockFrame(ch, maxDur);
      finishWallclockChapterPlayback(ch);
    }
  }

  /** 墙钟预览结束：停时钟，画面同步回当前选中片段（勿停在最后一帧却 UI 显示第一段） */
  function finishWallclockChapterPlayback(ch: Chapter) {
    stopChapterAnimation({ keepProgressUi: true, keepPlaybackCache: true });
    totalPlaying.value = false;
    totalProgress.value = 1;
    clipPlayElapsed.value = clipPlayDuration.value;
    const preferredId = activeAnimClipId.value;
    const clip =
      (preferredId ? ch.clips?.find(c => c.id === preferredId) : null) ||
      ch.clips?.[0] ||
      null;
    if (clip) {
      // 播完后 UI 已回到当前/首段：强制套该片段设置，避免画面仍停在末段效果
      selectAnimationClip(clip.id, { applyCamera: true });
    } else {
      renderViewportFrame();
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
      adoptPresentationNavFromClock(video.currentTime);
      syncPresentationUiFromTimeline();
      syncClipProgressFromVideoTime(video.currentTime);
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

    // 播放中 seek/运镜锁残留：强制解锁，否则进度条与动画组件会一直不动
    recoverStuckPlaybackLocks(video);

    // 运镜 chapterNavLock 不应挡住进度 UI（只挡未完成的媒体 seek）
    const seekLocked = videoChapterSyncPaused || presentationChapterTransition;
    if (seekLocked) return;

    if (!video.paused && !video.ended) {
      if (!isPresentationSeekRollback(video.currentTime, currentTime.value)) {
        currentTime.value = video.currentTime;
        syncEditModePlaybackFromVideo(video);
        syncClipProgressFromVideoTime(video.currentTime);
      }
    } else if (video.ended) {
      currentTime.value = video.currentTime;
      syncEditModePlaybackFromVideo(video);
      if (!chAnimWallclock) {
        totalPlaying.value = false;
        totalProgress.value = 0;
      }
    }
  }

  /** 视频时钟映射到当前动画段进度，供列表/动画信息条与底部进度条同步 */
  function syncClipProgressFromVideoTime(t: number) {
    if (chAnimWallclock) return;
    const pinned = resolveChapterSeekPin();
    const ch =
      pinned ||
      (chapterPlayTarget.value && isChapterInPlaybackRange(chapterPlayTarget.value, t)
        ? chapterPlayTarget.value
        : null) ||
      getPlaybackChapterAtTime(t);
    if (pinned && !isChapterInPlaybackRange(pinned, t)) {
      const span = Math.max(0.1, pinned.endTime - pinned.startTime);
      totalPlaying.value = true;
      clipPlayElapsed.value = 0;
      clipPlayDuration.value = span;
      totalProgress.value = 0;
      return;
    }
    if (!ch || !isChapterInPlaybackRange(ch, t)) {
      if (totalPlaying.value) {
        totalPlaying.value = false;
        totalProgress.value = 0;
      }
      return;
    }
    const span = Math.max(0.1, ch.endTime - ch.startTime);
    const elapsed = Math.max(0, Math.min(span, t - ch.startTime));
    totalPlaying.value = true;
    clipPlayElapsed.value = elapsed;
    clipPlayDuration.value = span;
    totalProgress.value = elapsed / span;
  }

  function animate(now = performance.now()) {
    afid = requestAnimationFrame(animate);
    if (renderLoopPausedByVisibility) return;

    const frameDiagT0 = isPlaybackDiagnosticsEnabled() ? performance.now() : 0;
    advanceCameraTransition(now);
    syncPresentationProgressInMainLoop(now);
    syncEditProgressHighlightInMainLoop();

    // 视频驱动位移：编辑/预览共用，放在 FPS 节流之前以免漏掉循环回跳帧
    syncVideoDrivenChapterMesh();
    // 墙钟预览必须每帧推进（进度条 + 片段态），不能被 present 节流吞掉
    syncWallclockChapterAnimationInMainLoop(now);

    // 转镜头必须每帧更新，不能跟出画节流绑在一起
    const camPx = camera.position.x;
    const camPy = camera.position.y;
    const camPz = camera.position.z;
    const tgtX = controls.target.x;
    const tgtY = controls.target.y;
    const tgtZ = controls.target.z;
    if (!camTrans || viewportInteracting || playbackCameraUserOverride) {
      controls.update();
    }
    const dampingMoving =
      Math.abs(camera.position.x - camPx) > 1e-5 ||
      Math.abs(camera.position.y - camPy) > 1e-5 ||
      Math.abs(camera.position.z - camPz) > 1e-5 ||
      Math.abs(controls.target.x - tgtX) > 1e-5 ||
      Math.abs(controls.target.y - tgtY) > 1e-5 ||
      Math.abs(controls.target.z - tgtZ) > 1e-5;

    if (orbitSettling) {
      if (viewportInteracting) {
        orbitSettling = false;
        orbitSettleIdleFrames = 0;
      } else if (dampingMoving) {
        orbitSettleIdleFrames = 0;
      } else if (++orbitSettleIdleFrames >= 3) {
        flushOrbitSettleWork();
      }
    }

    const orbitBusy = viewportInteracting || orbitSettling || !!viewportPickState;
    const mediaPlaying = !!(
      isPlaying.value ||
      (videoEl.value && !videoEl.value.paused && !videoEl.value.ended)
    );
    const playbackActive = isAnyPlaybackActive() || mediaPlaying;

    const targetInterval = 1000 / targetFps.value;
    const sinceLastPresent = viewportLastPresentAt ? now - viewportLastPresentAt : targetInterval;
    // 拖转/阻尼惯性必须每帧出画，否则会一顿一顿再补到目标角
    if (
      viewportLastPresentAt &&
      sinceLastPresent < targetInterval * 0.9 &&
      !camTrans &&
      !orbitBusy &&
      !dampingMoving
    ) {
      return;
    }

    // 空闲 on-demand：无播放/运镜/交互时，仅在显式需要时出画（降低发热）
    const interactionKeepAlive = now < viewportInteractionKeepAliveUntil;
    const shouldPresent = shouldPresentFrame(
      {
        playing: playbackActive || interactionKeepAlive,
        cameraTransition: !!camTrans,
        orbitBusy,
        dampingMoving,
        needsRender: viewportNeedsRender || interactionKeepAlive
      },
      { onDemandWhenIdle: true }
    );
    if (!shouldPresent) {
      return;
    }
    viewportNeedsRender = false;

    const frameDtSec = viewportLastPresentAt
      ? Math.min(sinceLastPresent / 1000, 0.05)
      : targetInterval / 1000;
    viewportLastPresentAt = now;

    if (shouldAdvanceGltfMixers()) {
      mixers.forEach(m => m.update(frameDtSec));
    }

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

    // 播放锁期间跳过 overlay/gizmo/自适应扫描，只推进时钟 + 位姿 + 运镜
    if (!playbackActive && !isViewportMotionBusy()) {
      // 拖拽旋转时禁止整树 overlay/gizmo，否则选中动画后转镜头会一顿一顿
      if (!orbitBusy && (!lastOverlaySyncAt || now - lastOverlaySyncAt > 200)) {
        lastOverlaySyncAt = now;
        syncTransformVisualOverlays();
        updateEditorGizmoScales();
      }
    }
    lastFramePresentAt = now;
    if (!playbackActive && !orbitBusy) {
      adaptPresentationRenderPerf(frameDtSec);
      adaptEditorRenderPerf(frameDtSec);
    }
    renderViewportFrame();
    if (!orbitBusy) {
      syncIntroPresentation();
      updateModelIntroLabelPositions(now);
    }

    if (frameDiagT0) {
      markPlaybackDiag("frame", "present", undefined, performance.now() - frameDiagT0);
    }

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
    if (dur <= 1e-8) {
      snapCam(pos, tgt, fov);
      return;
    }
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
      start: s.start,
      end: s.end,
      clipVisual: cloneClipVisual(s.clipVisual),
      _expandedPanels: s._expandedPanels ? [...s._expandedPanels] : undefined
    }));
  }

  function clipVisualFromModelForm(): ClipVisualState {
    const snap = getModelFormSnapshot();
    return createDefaultClipVisual({
      visible: snap.visible,
      outline: snap.outline,
      wireframe: snap.wireframe,
      highlight: snap.highlight,
      outlineColor: snap.outlineColor,
      wireframeColor: snap.wireframeColor,
      modelHighlightColor: snap.modelHighlightColor,
      intro: snap.intro
    });
  }

  function clipVisualFromModelConfig(cfg: ModelConfig): ClipVisualState {
    const resolved = getModelConfig(cfg);
    return createDefaultClipVisual({
      visible: resolved.visible,
      outline: resolved.outline,
      wireframe: resolved.wireframe,
      highlight: resolved.highlight,
      outlineColor: resolved.outlineColor,
      wireframeColor: resolved.wireframeColor,
      modelHighlightColor: resolved.modelHighlightColor,
      intro: resolved.intro ?? ""
    });
  }

  function modelConfigFromClipVisual(visual: ClipVisualState, base?: ModelConfig): ModelConfig {
    return {
      ...createDefaultModelConfig(),
      ...(base || {}),
      visible: visual.visible,
      outline: visual.outline,
      wireframe: visual.wireframe,
      highlight: visual.highlight,
      outlineColor: visual.outlineColor,
      wireframeColor: visual.wireframeColor,
      modelHighlightColor: visual.modelHighlightColor,
      intro: visual.intro,
      animation: true
    };
  }

  function serializeAnimSegmentForPersist(s: any, obj: THREE.Object3D | null, easingFallback: string) {
    const startPos = [...(s.startPos || [0, 0, 0])];
    const endPos = [...(s.endPos || [0, 0, 0])];
    const startRot = [...(s.startRot || [0, 0, 0])];
    const endRot = [...(s.endRot || [0, 0, 0])];
    const clipVisual = serializeClipVisual(s.clipVisual);
    const base: Record<string, any> = {
      id: s.id,
      pauseTime: s.pauseTime ?? 0,
      animTime: s.animTime ?? 3,
      easing: s.easing || easingFallback,
      pivot: s.pivot || "center",
      startScale: s.startScale,
      endScale: s.endScale,
      clipVisual
    };
    if (typeof s.start === "number" && Number.isFinite(s.start)) base.start = s.start;
    if (typeof s.end === "number" && Number.isFinite(s.end)) base.end = s.end;
    if (obj && usesRelativeAnimRotation(obj)) {
      return {
        ...base,
        startPos: animPosToAbsolute(obj, startPos).map((n: number) => round3(n)),
        endPos: animPosToAbsolute(obj, endPos).map((n: number) => round3(n)),
        startRot: animRotToAbsolute(obj, startRot).map((n: number) => round3(n)),
        endRot: animRotToAbsolute(obj, endRot).map((n: number) => round3(n))
      };
    }
    return {
      ...base,
      startPos: startPos.map((n: number) => round3(n)),
      endPos: endPos.map((n: number) => round3(n)),
      startRot: startRot.map((n: number) => round3(n)),
      endRot: endRot.map((n: number) => round3(n))
    };
  }

  /** 待机时间/时长/曲线/轴心/片段外观是否相对默认有改动（不含位姿） */
  function animSegmentHasNonDefaultMeta(seg: any): boolean {
    if (!seg) return false;
    if ((seg.pauseTime ?? 0) !== 0) return true;
    if (Math.abs((seg.animTime ?? 3) - 3) > 1e-3) return true;
    if ((seg.easing ?? "easeInOut") !== "easeInOut") return true;
    if ((seg.pivot ?? "center") !== "center") return true;
    const vis = serializeClipVisual(seg.clipVisual);
    const defVis = createDefaultClipVisual();
    if (
      vis.visible !== defVis.visible ||
      vis.outline !== defVis.outline ||
      vis.wireframe !== defVis.wireframe ||
      vis.highlight !== defVis.highlight ||
      vis.outlineColor !== defVis.outlineColor ||
      vis.wireframeColor !== defVis.wireframeColor ||
      vis.modelHighlightColor !== defVis.modelHighlightColor ||
      (vis.intro || "") !== (defVis.intro || "")
    ) {
      return true;
    }
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
        segments: draft.animSegments.map(seg =>
          serializeAnimSegmentForPersist(seg, obj, draft.animEasing)
        )
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
    annotateSegmentsAbsoluteTimes(animSegments);
    for (const seg of animSegments) invalidateSegPivotCache(seg);
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

    // 片段模式下 animConfig 只能由 clips 投影生成；草稿直写会丢掉「等前序片段播完」的 pause，导致片段2开门在片段1就出现
    const clipMode = !!(ch.clips?.length || activeAnimClipId.value);
    if (hasAnimEdits && !clipMode) {
      persistAnimConfigToChapterFor(ch, modelId, nodeId, draft.animSegments, {
        duration: draft.animDuration,
        easing: draft.animEasing
      });
    }

    const targetCfg = getWritableModelConfigForTarget(ch, modelId, nodeId);
    const s = draft.form;
    // 片段外观以 clipVisual 为准，勿用表单盖章节默认显隐
    if (!clipMode) {
      targetCfg.visible = s.visible;
      targetCfg.outline = s.outline;
      targetCfg.wireframe = s.wireframe;
      targetCfg.highlight = s.highlight;
      targetCfg.outlineColor = s.outlineColor;
      targetCfg.wireframeColor = s.wireframeColor;
      targetCfg.modelHighlightColor = s.modelHighlightColor;
      targetCfg.animation = s.animation;
      targetCfg.intro = s.intro;
    }
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

  function objectContainsNode(root: THREE.Object3D, node?: THREE.Object3D | null): boolean {
    let cur: THREE.Object3D | null | undefined = node;
    while (cur) {
      if (cur === root) return true;
      cur = cur.parent;
    }
    return false;
  }

  /** 隐藏时必须清掉子级 colorWrite=false 和挂在父级/根上的线框轮廓，否则会看起来像蓝线框 */
  function hideObjectWithVisualCleanup(m: Model, obj: THREE.Object3D) {
    const modelRoot = meshes.get(m.id);
    delete obj.userData._clipVisualSig;
    if (!modelRoot) {
      obj.visible = false;
      syncModelConfigOutlinePass();
      invalidatePickMeshCache();
      return;
    }
    const ownerKey = (obj.userData?.nodeId as string | undefined) || `root:${m.id}`;
    removeVisualOverlaysForOwner(modelRoot, ownerKey);

    const extraOverlays: THREE.Object3D[] = [];
    modelRoot.traverse(c => {
      if (!isModelVisualOverlay(c)) return;
      const src = c.userData.overlaySourceMesh as THREE.Object3D | undefined;
      if (src && objectContainsNode(obj, src)) extraOverlays.push(c);
    });
    extraOverlays.forEach(disposeVisualOverlay);

    obj.traverse(child => {
      if (child instanceof THREE.Mesh) {
        restoreWireframeSurface(child);
        restoreBodyHighlight(child);
      }
      delete child.userData._clipVisualSig;
    });
    // restoreWireframeSurface 可能把 mesh.visible 写回 true，最后再关掉
    obj.visible = false;

    syncModelConfigOutlinePass();
    invalidatePickMeshCache();
  }

  function applyModelVisualOnly(m: Model, obj: THREE.Object3D, cfg: ModelConfig, skipOutlineRebuild = false) {
    const modelRoot = meshes.get(m.id);
    const ownerKey = (obj.userData?.nodeId as string | undefined) || `root:${m.id}`;
    if (!cfg.visible) {
      hideObjectWithVisualCleanup(m, obj);
      return;
    }
    obj.visible = true;
    const needsFx = !!(cfg.wireframe || cfg.outline || cfg.highlight);
    if (!skipOutlineRebuild || needsFx) {
      rebuildOutlineForObject(m, obj, cfg);
      return;
    }
    // 无外观效果时：播放锁/轻量路径只清残留叠加，避免误留线框轮廓
    if (modelRoot) removeVisualOverlaysForOwner(modelRoot, ownerKey);
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
    /** 片段编辑态：只用章节静态位姿，不套用投影 animConfig（避免其它片段起点姿态串过来） */
    skipAnimSegments?: boolean;
    /** 强制走播放视觉路径（忽略片段编辑预览），用于点「播放」前的准备帧 */
    forcePlaybackVisuals?: boolean;
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
    const skipAnim = !!options?.skipAnimSegments;
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
      if (!skipAnim && cfg.animation && cfg.animConfig?.segments?.length) {
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
          !skipAnim &&
          !(_chAnimLock && !chAnimWallclock) &&
          shouldUseLiveAnimSegments(m.id, displayId)
            ? animSegments
            : undefined;
        for (const obj of collectObjectsForNodeId(root, displayId)) {
          applyModelVisualOnly(m, obj, merged, skipOutline);
          if (!skipAnim && merged.animation && merged.animConfig?.segments?.length) {
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

  /** 片段编辑预览态：不用「全部片段投影」刷视口，只叠当前活动片段 */
  function isClipEditorPreviewMode(options?: ApplyChapterModelStateOptions) {
    if (options?.forcePlaybackVisuals) return false;
    if (!activeAnimClipId.value) return false;
    if (viewOnly.value || isPreviewMode.value || chapterPlayTarget.value) return false;
    if (_chAnimLock) return false;
    const video = videoEl.value;
    if (video && !video.paused) return false;
    return true;
  }

  /** 播放态：从 clips 缓存采样位姿（不依赖 modelConfigs 投影） */
  function applyChapterPlaybackPosesFromCache(ch: Chapter, elapsedSec: number) {
    if (!ch.clips?.length) return;
    ensureClipPlaybackCache(ch);
    const cache =
      chapterPlaybackCache?.chapterId === ch.id ? chapterPlaybackCache : null;
    if (!cache?.targets?.length) return;
    for (const entry of cache.targets as Array<{
      objs: THREE.Object3D[];
      modelId: string;
      nodeId?: string | null;
      pbWindows?: PlaybackPoseWindow[];
      firstStart?: number;
      lastEnd?: number;
      cfg: ModelConfig;
    }>) {
      if (entry.pbWindows?.length) {
        let applied = false;
        for (const obj of entry.objs) {
          if (
            applyPlaybackTargetPoseFast(
              obj,
              entry.pbWindows,
              entry.firstStart ?? 0,
              entry.lastEnd ?? 0,
              elapsedSec
            )
          ) {
            applied = true;
          }
        }
        if (!applied) restorePlaybackEntryBindPose(entry);
      } else {
        for (const obj of entry.objs) {
          applyElapsedAnimToObject(obj, entry.cfg, elapsedSec);
        }
      }
    }
  }

  /** 预览/展示/视频跟播：有 clips 时一律走缓存，与编辑墙钟播放一致 */
  function shouldApplyChapterFromClipCache(
    ch: Chapter,
    options?: ApplyChapterModelStateOptions
  ): boolean {
    if (!ch.clips?.length) return false;
    if (isClipEditorPreviewMode(options)) return false;
    if (options?.forcePlaybackVisuals) return true;
    if (viewOnly.value || isPreviewMode.value) return true;
    if (_chAnimLock || chAnimWallclock || chapterPlayTarget.value) return true;
    const video = videoEl.value;
    return !!(video && !video.paused);
  }

  /** 统一应用节点下的模型可见性、材质效果与变换（含动画进度）；仅在切换节点/播放时调用 */
  function applyChapterModelState(ch: Chapter, elapsedSec = 0, options?: ApplyChapterModelStateOptions) {
    if (options?.forcePlaybackVisuals && ch.clips?.length) {
      ensureClipPlaybackCache(ch);
    }
    // 可见性必须先于位姿/描边写完，保证同一帧内不会出现错误的显示态
    applyChapterVisibilityOnly(ch);
    if (isClipEditorPreviewMode(options)) {
      // 片段编辑：章节层只用静态位姿；其它片段的投影起点绝不能套上来
      models.value.forEach(m =>
        applySingleModelChapterState(ch, m, elapsedSec, { ...options, skipAnimSegments: true })
      );
      applyChapterVisibilityOnly(ch);
      syncActiveClipViewportPreview({ mode: editingSegMode.value || "start" });
    } else if (shouldApplyChapterFromClipCache(ch, options)) {
      // 预览/展示：modelConfigs 可能已卸投影，必须从 clips 缓存写位姿+片段外观
      ensureClipPlaybackCache(ch);
      models.value.forEach(m =>
        applySingleModelChapterState(ch, m, elapsedSec, { ...options, skipAnimSegments: true })
      );
      applyChapterVisibilityOnly(ch);
      applyChapterPlaybackPosesFromCache(ch, elapsedSec);
      applyPlaybackVisibilityFast(ch, elapsedSec);
      wallclockVisualClipId =
        (ch.clips?.length
          ? findActiveClipAtElapsed(ch.clips, elapsedSec) ?? (elapsedSec <= 1e-4 ? ch.clips[0] : null)
          : null)?.id ?? "__none__";
    } else {
      models.value.forEach(m => applySingleModelChapterState(ch, m, elapsedSec, options));
      // 位姿/描边回默认时会短暂把 visible 写回 true，收尾再盖一次本章可见性
      applyChapterVisibilityOnly(ch);
      applyChapterClipVisualsAtElapsed(ch, elapsedSec, { force: true });
    }
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
      // 编辑播放切章：短过渡，禁止 0.5s 运镜把已套上的片段镜头再拖回去
      return 0.08;
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

  function setVideoChapterSyncPaused(paused: boolean) {
    videoChapterSyncPaused = paused;
    videoChapterSyncPausedAt = paused ? performance.now() : 0;
    markPlaybackDiag(paused ? "lock" : "unlock", "videoChapterSync", {
      presentationChapterTransition,
      chapterNavLock: chapterNavLock.value
    });
  }

  function clearPlaybackSeekLocks() {
    presentationChapterTransition = false;
    setVideoChapterSyncPaused(false);
    // 运镜锁残留同样会卡死进度条 / mesh 跟播
    if (chapterNavLock.value) chapterNavLock.value = false;
  }

  function isPresentationSeekLocked(): boolean {
    return presentationChapterTransition || videoChapterSyncPaused || chapterNavLock.value;
  }

  /** 播放中强制解开残留锁（seek/运镜回调丢失时） */
  function recoverStuckPlaybackLocks(video: HTMLVideoElement) {
    const cleared = shouldForceClearPlaybackLocks(video, {
      videoChapterSyncPaused,
      presentationChapterTransition,
      chapterNavLock: chapterNavLock.value,
      pausedAt: videoChapterSyncPausedAt
    });
    if (!cleared) return false;
    markPlaybackDiag("stuckLock", "force-clear", {
      paused: video.paused,
      ended: video.ended,
      videoChapterSyncPaused,
      presentationChapterTransition,
      chapterNavLock: chapterNavLock.value,
      lockAgeMs:
        videoChapterSyncPausedAt > 0 ? performance.now() - videoChapterSyncPausedAt : null
    });
    clearPlaybackSeekLocks();
    return true;
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
      if (presentationPlaybackSession.intent === "pause") {
        const target = presentationPlaybackSession.targetTime;
        if (Number.isFinite(target) && Math.abs(v.currentTime - target) > 0.35) return false;
        if (!v.paused) return false;
      }
      // 无锚点时也拒绝「突然掉回片头」覆盖当前进度
      if (isPresentationSeekRollback(v.currentTime, currentTime.value)) return false;
      // 已在播：不要被 transition 锁挡住进度条（await seek 常卡 2~5 秒）
      if (seekLocked && v.paused) return false;
      return true;
    }
    if (seekLocked) return false;
    if (isPresentationSeekRollback(v.currentTime, currentTime.value)) return false;
    if (presentationSeekTargetTime != null) {
      const target = presentationSeekTargetTime;
      if (!canAdoptPresentationVideoTime(v, target) && Math.abs(v.currentTime - target) > 0.35) {
        return false;
      }
      if (Math.abs(v.currentTime - target) <= 0.35) presentationSeekTargetTime = null;
      else return false;
    }
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

  /** 严格命中：仅当 t 落在动画区间内才返回，间隙返回 null（与编辑态 findChIdx 一致） */
  function getStrictPresentationChapterAtTime(t: number): Chapter | null {
    const playable = resolvePlaybackChapterAtTime(t);
    if (playable && isChapterInPlaybackRange(playable, t)) {
      return resolvePresentationNavChapter(playable);
    }
    const nav = getPresentationNavChapters();
    return nav.find(ch => isChapterInPlaybackRange(ch, t)) ?? null;
  }

  function getActivePresentationNavIndex(): number {
    const nav = getPresentationNavChapters();
    if (nav.length === 0) return -1;

    // 播放中跟视频时钟高亮；间隙保留 session，方便左右键仍有锚点。
    const video = videoEl.value;
    const followClock =
      presentationPlaybackSession.intent === "play" &&
      presentationPlaybackSession.phase === "playing" &&
      !!video &&
      !video.paused &&
      !isPresentationSeekLocked() &&
      performance.now() >= presentationManualNavUntil;
    if (followClock) {
      const t = resolvePresentationPlaybackTime(video);
      const timeIdx = nav.findIndex(ch => isChapterInPlaybackRange(ch, t));
      if (timeIdx >= 0) return timeIdx;
    }

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

  function resolveChapterSeekPin(): Chapter | null {
    if (!chapterSeekPinId) return null;
    const ch = chapters.value.find(item => item.id === chapterSeekPinId);
    return chapterBelongsToActiveVideo(ch) ? ch : null;
  }

  function pinChapterPlayback(ch: Chapter | null) {
    if (!ch) {
      chapterSeekPinId = null;
      return;
    }
    chapterSeekPinId = ch.id;
    chapterPlayTarget.value = ch;
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
    const seekPin = resolveChapterSeekPin();
    if (seekPin) {
      if (isChapterInPlaybackRange(seekPin, timelineT)) {
        chapterSeekPinId = null;
      } else {
        return seekPin;
      }
    }
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
      if (chapterBelongsToActiveVideo(playable) && isChapterInPlaybackRange(playable, timelineT)) {
        return playable;
      }
    }

    if (pinned && isChapterInPlaybackRange(pinned, timelineT)) {
      return pinned;
    }
    // 编辑/预览/展示一致：间隙不套上一章结束位移，只播视频
    return null;
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
   * 播放意图未手动暂停时：视频播完后从 0 续播（与编辑态循环一致，不跳章节）。
   */
  function loopPresentationPlaybackFromStart(): boolean {
    if (!viewOnly.value && !isPreviewMode.value) return false;
    if (presentationPlaybackSession.intent !== "play" || presentationUserWantsPaused) {
      return false;
    }
    // 切章 seek 尚未落地时禁止片尾循环，否则会从旧时钟误跳回片头。
    if (presentationSeekTargetTime != null) {
      const dur =
        (videoEl.value && Number.isFinite(videoEl.value.duration) && videoEl.value.duration > 0
          ? videoEl.value.duration
          : duration.value) || 0;
      if (dur > 0 && presentationSeekTargetTime < dur - Math.max(0.5, CHAPTER_END_EPS * 4)) {
        return true;
      }
    }
    const start = 0;
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
      navChapter: getStrictPresentationChapterAtTime(start),
      autoAdvance: false
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
      video.muted = videoIsMuted.value;
      await video.play();
    } catch {
      try {
        video.muted = true;
        await video.play();
      } catch {
        /* fall through */
      }
    }
    if (userAudioUnlocked.value) video.muted = false;
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
    const navChapter = getStrictPresentationChapterAtTime(presentationPlaybackSession.targetTime);
    commandPresentationPlayback({
      targetTime: presentationPlaybackSession.targetTime,
      intent: "play",
      navChapter,
      autoAdvance: false
    });
  }

  function isCurrentPresentationPlayIntent() {
    return (
      presentationPlaybackSession.intent === "play" &&
      !presentationUserWantsPaused
    );
  }

  /** 播放中按视频时钟更新导航高亮，不 seek */
  function adoptPresentationNavFromClock(t: number) {
    if (!viewOnly.value && !isPreviewMode.value) return;
    if (presentationPlaybackSession.phase === "seeking") return;
    if (isPresentationSeekLocked()) return;
    if (performance.now() < presentationManualNavUntil) return;
    if (presentationPlaybackSession.intent !== "play") return;

    const hit = getStrictPresentationChapterAtTime(t);
    if (!hit) return;
    if (presentationPlaybackSession.navChapterId === hit.id) return;

    const playable = resolvePlayableChapterForPresentationAtTime(hit, t);
    presentationPlaybackSession.navChapterId = hit.id;
    presentationPlaybackSession.playableChapterId = playable?.id ?? hit.id;
    syncPresentationUiFromChapter(hit, t);
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
      const nav = getPresentationNavChapters();
      const pinned =
        presentationPlaybackSession.phase === "seeking" ||
        isPresentationSeekLocked() ||
        performance.now() < presentationManualNavUntil;
      // 左右键刚切章时 session.navChapterId 可能仍是上一章；高亮以 UI 锚点为准
      if (pinned) {
        if (presentationNavIndex.value >= 0 && presentationNavIndex.value < nav.length) {
          return nav[presentationNavIndex.value].id;
        }
        if (presentationUiChapterId.value) return presentationUiChapterId.value;
      }
      if (presentationUiChapterId.value && nav.some(ch => ch.id === presentationUiChapterId.value)) {
        return presentationUiChapterId.value;
      }
      // 展示/预览：唯一高亮源，禁止多路 id 并存
      if (presentationPlaybackSession.navChapterId) {
        return presentationPlaybackSession.navChapterId;
      }
      if (presentationCurrentNavChapterId.value) {
        return presentationCurrentNavChapterId.value;
      }
      const video = videoEl.value;
      const paused = !video || video.paused || video.ended;
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
      return null;
    }

    // 编辑态墙钟播放：高亮唯一跟随正在播的动画
    if (chAnimWallclock && chAnimChapterId) {
      return chAnimChapterId;
    }

    const video = videoEl.value;
    const mediaPlaying = !!(video && !video.paused && !video.ended);
    // 暂停只跟用户选中（selected* 是 ref，进度条章节名才能刷新）。
    // 播放中才跟 pin / 媒体时钟，避免 seek 失败停在 0 时把高亮打回第一章。
    const videoFollowing =
      mediaPlaying &&
      (!!chapterPlayTarget.value || !!chapterSeekPinId || !!isPlaying.value);
    if (videoFollowing) {
      const seekPin = resolveChapterSeekPin();
      if (seekPin) return seekPin.id;
      if (chapterPlayTarget.value) return chapterPlayTarget.value.id;
      const t = video?.currentTime ?? currentTime.value;
      const playable = getPlaybackChapterAtTime(t);
      if (playable) return playable.id;
    }

    // 暂停：只跟用户选中
    if (selectedNodeId.value) {
      const node = getNodeById(nodes.value, selectedNodeId.value);
      if (node && isAnimationNode(node)) return node.id;
    }
    if (selectedChapterId.value) return selectedChapterId.value;
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
      immediatePresent: true,
      forcePlaybackVisuals: true
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
    clearPlaybackSeekLocks();
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

    const endSpan = beginPlaybackDiagSpan("command", command.intent, {
      targetTime: command.targetTime,
      hasNav: Object.prototype.hasOwnProperty.call(command, "navChapter")
    });

    const targetTime = clampVideoTime(command.targetTime, video);
    const explicitNav = Object.prototype.hasOwnProperty.call(command, "navChapter");
    const navChapter = explicitNav
      ? command.navChapter ?? null
      : getStrictPresentationChapterAtTime(targetTime) ??
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
      autoAdvance: false
    });

    presentationSeekTargetTime = targetTime;
    presentationExpectPlaying = command.intent === "play";
    presentationUserWantsPaused = command.intent === "pause";
    chapterAutoNext.value = false;
    clearPresentationResumeTimer();
    // 覆盖常见移动端 seek 耗时，防止切章过程中旧时钟触发片尾循环。
    presentationManualNavUntil = performance.now() + 900;
    presentationChapterCooldownUntil = performance.now() + 220;

    if (navChapter && isChapterInPlaybackRange(navChapter, targetTime)) {
      applyPresentationChapterAtTime(targetTime, navChapter);
    } else {
      chapterPlayTarget.value = null;
      lastPresentationAutoSwitchChapterId = null;
    }
    void runPresentationPlaybackEffect(requestId, video, targetTime, command.intent).finally(() => {
      endSpan();
    });
  }

  async function runPresentationPlaybackEffect(
    requestId: number,
    video: HTMLVideoElement,
    targetTime: number,
    intent: PresentationPlaybackIntent
  ) {
    presentationChapterTransition = true;
    setVideoChapterSyncPaused(true);

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
      clearPlaybackSeekLocks();
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
        video.muted = videoIsMuted.value;
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
            video.muted = videoIsMuted.value;
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
    presentationManualNavUntil = Math.max(presentationManualNavUntil, performance.now() + 900);

    // Strict session stepping: Next/Prev = sessionIndex ± 1. Never soft-sync from
    // lagged video.currentTime (that skipped chapters on mobile seek lag).
    const ci = getActivePresentationNavIndex();
    const targetIdx = ci + delta;
    if (targetIdx < 0 || targetIdx >= nav.length) return;

    const targetChapter = nav[targetIdx];
    const targetTime = targetChapter.startTime;
    cutPlaybackToTime(targetTime, targetChapter, {
      keepPlaying: presentationPlaybackSession.intent === "play"
    });
    presentationPlaybackSession.navChapterId = targetChapter.id;
    presentationPlaybackSession.playableChapterId = targetChapter.id;
    presentationPlaybackSession.targetTime = targetTime;
    presentationPlaybackSession.committedTime = targetTime;
    presentationUiChapterId.value = targetChapter.id;
    const navIdx = nav.findIndex(ch => ch.id === targetChapter.id);
    if (navIdx >= 0) presentationNavIndex.value = navIdx;
    currentTime.value = targetTime;
    presentationSeekTargetTime = targetTime;
    selectedNodeId.value = targetChapter.id;
    selectedChapterId.value = targetChapter.id;
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
    const playable = resolvePlaybackChapterAtTime(playbackTime);
    if (!playable || !isChapterInPlaybackRange(playable, playbackTime)) {
      if (chapterPlayTarget.value) chapterPlayTarget.value = null;
      return;
    }
    const navChapter = resolvePresentationNavChapter(playable);
    const isPresentation = viewOnly.value || isPreviewMode.value;
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
        if (chapterHasAnimation(playable) || chapterHasAnyModelEdits(playable)) {
          ensureVideoSyncedChapterAnimation();
        }
      }
      // 展示/预览：同章内跟视频时间刷 mesh（与编辑墙钟同源：缓存位姿+片段外观）
      if (isPresentation && (chapterHasAnimation(playable) || chapterHasAnyModelEdits(playable))) {
        applyChapterWallclockFrame(playable, elapsed);
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
    // forcePlaybackVisuals：强制走 clips 缓存，与编辑墙钟效果一致
    syncChapterVisualState(playable, elapsed, {
      skipOutlineRebuild: false,
      skipOverlaySync: false,
      immediatePresent: true,
      forcePlaybackVisuals: true
    });
    if (chapterNeedsOutlineRebuild(playable)) {
      refreshChapterOutlines(playable);
    }
    if (!v.paused && (chapterHasAnimation(playable) || chapterHasAnyModelEdits(playable))) {
      ensureVideoSyncedChapterAnimation();
    }
  }

  function isPresentationTimelineSegmentCurrent(segmentIdx: number): boolean {
    const segs = timelineChapters.value;
    if (segmentIdx < 0 || segmentIdx >= segs.length) return false;
    const video = videoEl.value;
    const playing = !!video && !video.paused && !video.ended;
    const activeId = getActiveChapterIdForUi();
    if (!playing && activeId) return segs[segmentIdx]?.id === activeId;
    const idx = findChIdx(currentTime.value);
    if (idx >= 0) return idx === segmentIdx;
    if (playing) return false;
    if (activeId) return segs[segmentIdx]?.id === activeId;
    return false;
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
    if (ch.parentId && activeVideoId.value && ch.parentId !== activeVideoId.value) return 0;
    if (chAnimWallclock && totalPlaying.value && chAnimChapterId === ch.id) {
      const dur = Math.max(0.1, clipPlayDuration.value || 0);
      return Math.max(0, Math.min(100, (clipPlayElapsed.value / dur) * 100));
    }
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
    if (!ch) return false;
    // clips.targets 是编辑真相源；投影卸掉后 modelConfigs 可能为空，不能据此判定「无效果」
    if (ch.clips?.some(c => (c.targets?.length ?? 0) > 0 || !!c.camera)) return true;
    if (!ch.modelConfigs) return false;
    return Object.keys(ch.modelConfigs).some(id => chapterModelHasEdits(ch, id));
  }

  /** 编辑态：按与「节点播放按钮」相同的路径刷 mesh（elapsed=0 起始帧） */
  function applyChapterEditorVisualState(ch: Chapter) {
    ensureEditModeWithoutHeavyProjection(ch);
    if (!viewOnly.value && !isPreviewMode.value) {
      flushChapterSessionsToConfigs(ch);
    }
    // clips / nodeConfigs / 大 GLB：一律轻量，禁止 reset 整树
    const heavy = isHeavyEditNavChapter(ch);
    // 大体量：跳过 sanitize（会扫光 nodeConfigs）与整树 reset
    // 注意：切章时 activeAnimClipId 常被清空，不能依赖它才走轻量路径，否则点一下仍 reset 整树卡 2s+
    if (!heavy) {
      sanitizeChapterModelConfigs(ch);
    }
    // 有片段时：先整树回默认/章节静态，再由 syncAnimClips 叠当前片段，避免未编辑模型被全轨投影带偏
    if (ch.clips?.some(c => (c.targets?.length ?? 0) > 0) || activeAnimClipId.value) {
      // 大体量片段：禁止 reset 整棵 GLB 树 + 全量描边（点一下都要卡死）
      if (heavy && !viewOnly.value && !isPreviewMode.value) {
        applyChapterVisibilityOnly(ch);
        if (activeAnimClipId.value) {
          syncActiveClipViewportPreview({
            mode: editingSegMode.value || "start",
            light: true
          });
        }
        syncTransformVisualOverlays();
        renderViewportFrame();
        return;
      }
      resetAllModelsToDefault();
      applyChapterVisibilityOnly(ch);
      models.value.forEach(m =>
        applySingleModelChapterState(ch, m, 0, {
          skipAnimSegments: true,
          skipOutlineRebuild: false,
          forceElapsed: 0
        })
      );
      applyChapterVisibilityOnly(ch);
      if (activeAnimClipId.value && !viewOnly.value && !isPreviewMode.value) {
        syncActiveClipViewportPreview({ mode: editingSegMode.value || "start" });
      }
      syncTransformVisualOverlays();
      renderViewportFrame();
      return;
    }
    applyChapterModelState(ch, 0, {
      skipOutlineRebuild: false,
      skipOverlaySync: false,
      forceElapsed: 0,
      immediatePresent: true
    });
  }

  /** 切动画：用 clips 播放缓存套起始帧（姿态+显隐+效果+运镜），不 reset 整棵 GLB */
  function applySelectedChapterViewport(ch: Chapter) {
    if (viewOnly.value || isPreviewMode.value) return;
    sealHeavyClipsInChapter(ch);
    if (ch.clips?.some(c => (c.targets?.length ?? 0) > 0)) {
      if (chapterPlaybackCache?.chapterId !== ch.id) {
        buildChapterPlaybackCacheFromClips(ch);
      }
      wallclockVisualClipId = null;
      lastClipCameraId = null;
      // 不要走 applyChapterWallclockFrame：其显隐被墙钟锁挡住，切动画后仍停在上一章效果
      applyChapterPoseOnlyAtElapsed(ch, 0);
      applyPlaybackVisibilityFast(ch, 0);
      lastClipViewportOverlayKeys = [...new Set(collectAllChapterClipTargetKeys(ch))];
    } else if (chapterHasAnyModelEdits(ch) && !isHeavyEditNavChapter(ch)) {
      applyChapterVisibilityOnly(ch);
    }
    const cam = ch.clips?.[0]?.camera || ch.camera;
    if (cam && !viewportInteracting) applyCameraConfigImmediate(cam, { skipUiBump: true });
    renderViewportFrame();
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
    if (isAnimationNode(node)) {
      const activeId = getActiveChapterIdForUi();
      if (!activeId || activeId !== node.id) return false;
      // 编辑态：动画高亮不得跨出当前活动视频
      if (
        !viewOnly.value &&
        !isPreviewMode.value &&
        node.parentId &&
        activeVideoId.value &&
        node.parentId !== activeVideoId.value
      ) {
        return false;
      }
      return true;
    }
    if (viewOnly.value || isPreviewMode.value) {
      // 预览/展示：只允许一条动画行 .active，视频/分组行不得同时高亮
      return false;
    }
    if (videoOnlyMode.value) {
      return node.type === "video" && node.id === selectedNodeId.value;
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
    const dur = getChapterCameraSwitchDuration(chapter, mode);
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

  /** 空章节补一个轻量默认片段（禁止走 modelConfigs migrate，避免首点卡死） */
  function ensureDefaultEmptyClip(ch: Chapter): AnimationClip[] {
    if (Array.isArray(ch.clips) && ch.clips.length > 0) return ch.clips;
    ch.clips = [
      createAnimationClip({
        name: "片段 1",
        pauseTime: DEFAULT_CLIP_PAUSE_TIME,
        animTime: DEFAULT_CLIP_ANIM_TIME,
        camera: ch.camera,
        targets: []
      })
    ];
    rebuildClipAbsoluteTimes(ch.clips);
    return ch.clips;
  }

  /** 暂停点选动画：落到该段最后一帧（仍严格落在本段内），本视频此前片段视为已执行完 */
  function chapterLastFrameTime(ch: Chapter) {
    const start = Number(ch.startTime) || 0;
    const end = Number(ch.endTime) || start;
    if (!(end > start)) return start;
    return Math.max(start, end - CHAPTER_END_EPS - 0.001);
  }

  function applyChapter(ch: Chapter) {
    videoOnlyMode.value = false;
    requestViewportRender();
    clearPlaybackSeekLocks();
    const resolved = resolveChapter(ch);
    if (!resolved) return;

    const chapter = resolved.chapter;
    const video = videoEl.value;
    const keepPlaying = !!(
      isPlaying.value ||
      (video && !video.paused && !video.ended)
    );
    const prevId = selectedChapterId.value;
    const prevChapter =
      prevId && prevId !== chapter.id
        ? (chapters.value.find(c => c.id === prevId) ?? null)
        : null;
    const persistPrev =
      !!(prevChapter?.clips?.length && animDirty.value && !viewOnly.value && !isPreviewMode.value);

    if (prevId && prevId !== chapter.id && !viewOnly.value && !isPreviewMode.value) {
      selectionEditDrafts.clear();
      clearLiveAnimEditorState();
      activeAnimClipId.value = null;
      setClipTargetSelection([]);
      clipDraftTargetKey.value = null;
    }

    cutPlaybackToTime(
      keepPlaying ? chapter.startTime : chapterLastFrameTime(chapter),
      chapter,
      { keepPlaying }
    );

    if (!viewOnly.value && !isPreviewMode.value) {
      const clips = chapter.clips || [];
      if (clips.length && !clips.some(c => c.id === activeAnimClipId.value)) {
        activeAnimClipId.value = clips[0].id;
      }
      requestAnimationFrame(() => {
        if (selectedChapterId.value !== chapter.id) return;
        ensureDefaultEmptyClip(chapter);
        syncChapterMetaForm(chapter);
        syncCameraFormFromStored(chapter);
      });
      if (persistPrev && prevChapter) {
        const persistChapter = prevChapter;
        const persistIdle = () => {
          if (selectedChapterId.value === persistChapter.id) return;
          try {
            persistClipsEditorOnly(persistChapter, { skipUiBump: true });
            playbackCacheByChapterId.delete(persistChapter.id);
            if (chapterPlaybackCache?.chapterId === persistChapter.id) {
              chapterPlaybackCache = null;
            }
            ensurePlaybackCache(persistChapter);
          } catch {
            /* keep going */
          }
        };
        if (typeof requestIdleCallback === "function") {
          requestIdleCallback(persistIdle, { timeout: 400 });
        } else {
          window.setTimeout(persistIdle, 0);
        }
      }
    }
  }

  /** @deprecated 由 applyChapter 内 yieldToUi 后直接 uiOnly 同步；保留空壳避免外部调用报错 */
  function scheduleDeferredEditChapterEnter(ch: Chapter) {
    const chId = ch.id;
    const gen = ++pendingClipSyncGen;
    void (async () => {
      await yieldToUi();
      if (gen !== pendingClipSyncGen) return;
      if (selectedChapterId.value !== chId && selectedNodeId.value !== chId) return;
      if (viewOnly.value || isPreviewMode.value) return;
      suspendProjectPersist();
      try {
        if (ch.parentId) showVideoPip.value = true;
        syncAnimClipsForSelectedChapter({ uiOnly: true });
      } finally {
        resumeProjectPersist();
      }
    })();
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
    updateAoSceneCoverage();
    return mesh;
  }

  function onGLTFLoaded(m: Model, gltf: { scene: THREE.Group; animations: THREE.AnimationClip[] }) {
    if (!isEditorSceneReady()) {
      throw new Error("3D scene is not ready");
    }
    const root = gltf.scene;
    if (!root) {
      throw new Error("GLTF scene missing");
    }
    const isFirstModel = meshes.size === 0;
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
    enqueueChapterCachePrefetch();
    prepareGltfMaterials(root, renderer);
    if (renderer) applyMeshTextureQuality(root, renderer);
    invalidateSceneModelCenterCache();
    applyModelEnvReflectionIntensity(root);
    updateAoSceneCoverage();
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
    buildNodeObjectIndex(root);
    hierarchyDisplayIdMaps.delete(modelId);
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
      hierarchyDisplayIdMaps.delete(modelId);
      hierarchyRevision.value++;
    }
  }

  function getHierarchyDisplayIdMap(modelId: string): Map<string, string> {
    let map = hierarchyDisplayIdMaps.get(modelId);
    if (map) return map;
    map = new Map();
    const walk = (nodes: ModelHierarchyNode[]) => {
      for (const n of nodes) {
        map!.set(n.id, n.id);
        if (n.mergedNodeIds?.length) {
          for (const mid of n.mergedNodeIds) map!.set(mid, n.id);
        }
        if (n.children?.length) walk(n.children);
      }
    };
    walk(modelHierarchies[modelId] ?? []);
    hierarchyDisplayIdMaps.set(modelId, map);
    return map;
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
    // 片段编辑时常操作「显示关闭」的目标，必须能取到已隐藏 mesh，否则开关/轮廓会失效
    const allowHidden = includeHidden || !!activeAnimClipId.value;
    if (!nid) return allowHidden || root.visible ? [root] : [];
    const objs = collectObjectsForNodeId(root, nid);
    return allowHidden ? objs : objs.filter(o => o.visible !== false);
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
    return getHierarchyDisplayIdMap(modelId).get(nodeId) ?? nodeId;
  }

  function normalizeClipNodeKey(modelId: string, nodeId: string | null): string {
    if (!nodeId) return clipTargetKey(modelId, null);
    const displayId = getHierarchyDisplayIdMap(modelId).get(nodeId) || nodeId;
    return clipTargetKey(modelId, displayId);
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
    // 仅改显隐/线框/高亮等也算有效编辑（播放依赖 clipVisual）
    if (storedAnimSegmentHasClipVisualEdits(seg)) return true;
    return false;
  }

  /** 片段外观相对默认是否有改动（不含 animTime，避免片段窗长被误判） */
  function storedAnimSegmentHasClipVisualEdits(seg: any): boolean {
    if (!seg) return false;
    const vis = serializeClipVisual(seg.clipVisual);
    const defVis = createDefaultClipVisual();
    return (
      vis.visible !== defVis.visible ||
      vis.outline !== defVis.outline ||
      vis.wireframe !== defVis.wireframe ||
      vis.highlight !== defVis.highlight ||
      vis.outlineColor !== defVis.outlineColor ||
      vis.wireframeColor !== defVis.wireframeColor ||
      vis.modelHighlightColor !== defVis.modelHighlightColor ||
      (vis.intro || "") !== (defVis.intro || "")
    );
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
      return cfg.animConfig.segments.some(seg => {
        const mapped = mapStoredAnimSegment(seg);
        // 只改「显示关闭」等外观时也必须保留，否则播放前 sanitize 会清掉，全部又显示出来
        if (storedAnimSegmentHasClipVisualEdits(mapped)) return true;
        if ((mapped.easing ?? "easeInOut") !== "easeInOut") return true;
        if ((mapped.pivot ?? "center") !== "center") return true;
        if (!model) return storedAnimSegmentHasEdits(mapped);
        return animSegmentDiffersFromDefault(mapped, model, nodeId);
      });
    }
    return false;
  }

  function modelNodeHasEdits(modelId: string, nodeId: string): boolean {
    // 与 modelHasEdits 一致：未选中动画时不显示「已改」
    const ch = selectedChapter.value;
    if (!ch) return false;
    const displayId = getHierarchyDisplayIdMap(modelId).get(nodeId) ?? nodeId;
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
      maxDur = Math.max(maxDur, calcSegmentsTotalDuration(segs as any[]));
    }
    return maxDur;
  }

  /** 动画内容时长：片段总长（含未保存） */
  function getAnimationContentDuration(ch?: Chapter | null): number {
    const chapter = ch ?? selectedChapter.value;
    if (!chapter) return animDuration.value || 0;
    // 有 clips 时禁止走 collectChapterAnimTargets：那会扫全部 nodeConfigs + 整棵 GLB，
    // 点选后的 computed 会把 modelConfigs 全部收集进依赖，随后任意改动都让整页卡死。
    if (chapter.clips?.length) {
      return getClipsTotalDuration(chapter.clips);
    }
    let maxDur = getChapterAnimDuration(chapter);
    if (
      selModel.value &&
      animSegments.length > 0 &&
      animSegmentsBelongToChapter(chapter.id)
    ) {
      maxDur = Math.max(maxDur, calcSegmentsTotalDuration(animSegments));
    }
    return maxDur;
  }

  /** 将动画节点结束时间对齐到内容时长（Unity 式：轨长驱动节点时长） */
  function syncAnimationNodeDurationToContent(ch: Chapter, opts?: { silent?: boolean }): boolean {
    const contentDur = getAnimationContentDuration(ch);
    if (contentDur <= 0) return false;
    const windowDur = Math.max(0.1, (ch.endTime ?? 0) - (ch.startTime ?? 0));
    if (contentDur <= windowDur + 0.05) return false;
    const newEnd = roundAnimNum((ch.startTime ?? 0) + contentDur);
    chStore.updateChapter(ch, { endTime: newEnd });
    if (!opts?.silent && selectedChapter.value?.id === ch.id) {
      syncChapterForm(ch);
    }
    return true;
  }

  function resolveDefaultSegmentAnimTime(ch?: Chapter | null): number {
    const chapter = ch ?? selectedChapter.value;
    const windowSec = chapter
      ? Math.max(0.1, (chapter.endTime ?? 0) - (chapter.startTime ?? 0))
      : 3;
    const contentSec = chapter ? getAnimationContentDuration(chapter) : 0;
    return Math.max(0.5, Math.min(3, Math.max(windowSec, contentSec) || 3));
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

    for (const [cmid, rootCfg] of Object.entries(ch.modelConfigs)) {
      const root = meshes.get(cmid);
      if (!root) continue;

      const rootCfgTyped = getModelConfig(rootCfg as ModelConfig);
      if (rootCfgTyped.animation && rootCfgTyped.animConfig?.segments?.length) {
        targets.push({
          objs: [root],
          cfg: rootCfgTyped,
          modelId: cmid,
          nodeId: null,
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
        const nodeCfgTyped = getModelConfig((nodeConfigs[displayId] as ModelConfig) ?? (nodeCfg as ModelConfig));
        if (!nodeCfgTyped.animation || !nodeCfgTyped.animConfig?.segments?.length) continue;
        const nodeObjs = collectObjectsForNodeId(root, displayId);
        if (!nodeObjs.length) continue;
        targets.push({
          objs: nodeObjs,
          cfg: nodeCfgTyped,
          modelId: cmid,
          nodeId: displayId,
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

  const playbackCacheByChapterId = new Map<
    string,
    {
      chapterId: string;
      targets: any[];
      maxDur: number;
    }
  >();

  function invalidateChapterAnimTargetsCache(
    chapterId?: string | null,
    opts?: { dropPooled?: boolean }
  ) {
    if (!chapterId || chapterAnimTargetsCache?.chapterId === chapterId) {
      chapterAnimTargetsCache = null;
    }
    if (!chapterId || chapterPlaybackCache?.chapterId === chapterId) {
      chapterPlaybackCache = null;
    }
    if (opts?.dropPooled) {
      if (chapterId) playbackCacheByChapterId.delete(chapterId);
      else playbackCacheByChapterId.clear();
    }
  }

  /**
   * 从 clips 直接构建播放缓存（markRaw），不写入响应式 modelConfigs。
   * 解决：播放前 project 144 目标进 Pinia 导致卡 2s+。
   */
  let chapterPlaybackCache: {
    chapterId: string;
    targets: Array<{
      objs: THREE.Object3D[];
      cfg: ModelConfig;
      modelId: string;
      nodeId?: string | null;
      pbWindows?: Array<{
        as: any;
        start: number;
        end: number;
        animDur: number;
        clipId?: string;
        clipStart?: number;
        clipEnd?: number;
      }>;
      firstStart?: number;
      lastEnd?: number;
    }>;
    maxDur: number;
  } | null = null;

  function buildChapterPlaybackCacheFromClips(ch: Chapter) {
    const clips = ensureChapterClips(ch);
    rebuildClipAbsoluteTimes(clips);
    const byTarget = new Map<
      string,
      { modelId: string; nodeId: string | null; segments: any[] }
    >();

    for (const clip of clips) {
      const clipStart = roundAnimNum(clip.start ?? 0);
      const clipEnd = roundAnimNum(Math.max(clipStart, clip.end ?? clipStart));
      for (const target of clip.targets || []) {
        if (!target?.modelId) continue;
        const nodeId = target.nodeId ?? null;
        const key = clipTargetKey(target.modelId, nodeId);
        let bucket = byTarget.get(key);
        if (!bucket) {
          bucket = { modelId: target.modelId, nodeId, segments: [] };
          byTarget.set(key, bucket);
        }
        const localPause = resolveTargetPauseTime(target);
        const localAnim = resolveTargetAnimTime(target);
        const segStart = roundAnimNum(Math.min(clipEnd, clipStart + localPause));
        const segEnd = roundAnimNum(Math.min(clipEnd, segStart + localAnim));
        const mapped = mapStoredAnimSegment({
          id: nextAnimSegmentId(),
          pauseTime: 0,
          animTime: roundAnimNum(Math.max(0, segEnd - segStart)),
          easing: target.easing || "easeInOut",
          pivot: target.pivot || "center",
          startPos: [...(target.startPos || [0, 0, 0])],
          endPos: [...(target.endPos || [0, 0, 0])],
          startScale: target.startScale ?? 1,
          endScale: target.endScale ?? 1,
          startRot: [...(target.startRot || [0, 0, 0])],
          endRot: [...(target.endRot || [0, 0, 0])],
          clipVisual: serializeClipVisual(target.clipVisual),
          start: segStart,
          end: segEnd
        }) as any;
        mapped._clipId = clip.id;
        mapped._clipStart = clipStart;
        mapped._clipEnd = clipEnd;
        bucket.segments.push(mapped);
      }
    }

    const targets: Array<{ objs: THREE.Object3D[]; cfg: ModelConfig; modelId: string }> = [];
    let maxDur = getClipsTotalDuration(clips);

    for (const { modelId, nodeId, segments } of byTarget.values()) {
      const root = meshes.get(modelId);
      if (!root) continue;
      let synced = syncPauseChainFromAbsoluteTimes(segments);
      if (!synced.ok) {
        const sorted = [...segments].sort((a, b) => (a.start ?? 0) - (b.start ?? 0));
        let prevEnd = 0;
        for (const seg of sorted) {
          const start = Math.max(prevEnd, roundAnimNum(seg.start ?? prevEnd));
          const anim = Math.max(0, roundAnimNum((seg.end ?? start) - (seg.start ?? start)));
          seg.start = start;
          seg.end = roundAnimNum(start + anim);
          seg.pauseTime = roundAnimNum(Math.max(0, start - prevEnd));
          seg.animTime = anim;
          prevEnd = seg.end;
        }
        segments.splice(0, segments.length, ...sorted);
        synced = { ok: true, segments };
      }
      annotateSegmentsAbsoluteTimes(synced.segments);
      const obj = getTransformTarget(modelId, nodeId);
      const absSegs = synced.segments.map((s: any) => {
        const abs = serializeAnimSegmentForPersist(s, obj, s.easing || "easeInOut") as any;
        abs._clipId = s._clipId;
        abs._clipStart = s._clipStart;
        abs._clipEnd = s._clipEnd;
        return abs;
      });
      const dur = calcSegmentsTotalDuration(absSegs);
      maxDur = Math.max(maxDur, dur);
      const objs = nodeId ? collectObjectsForNodeId(root, nodeId) : [root];
      if (!objs.length) continue;
      // 预烘焙时间窗：播放帧零分配采样
      const pbWindows = absSegs.map((as: any) => {
        const start = typeof as.start === "number" ? as.start : 0;
        const animDur = Math.max(0, as.animTime ?? 0);
        const end = typeof as.end === "number" ? as.end : start + animDur;
        const clipStart =
          typeof as._clipStart === "number" && Number.isFinite(as._clipStart) ? as._clipStart : start;
        const clipEnd =
          typeof as._clipEnd === "number" && Number.isFinite(as._clipEnd)
            ? Math.max(clipStart, as._clipEnd)
            : end;
        return markRaw({
          as,
          start,
          end,
          animDur,
          clipId: as._clipId,
          clipStart,
          clipEnd
        });
      });
      const firstStart = pbWindows.length ? pbWindows[0].start : 0;
      const lastEnd = pbWindows.length ? pbWindows[pbWindows.length - 1].end : 0;
      targets.push(
        markRaw({
          objs,
          modelId,
          nodeId,
          firstStart,
          lastEnd,
          pbWindows,
          cfg: markRaw({
            animation: true,
            animConfig: markRaw({
              duration: dur,
              easing: "easeInOut",
              relativeTransform: false,
              segments: markRaw(absSegs)
            })
          }) as ModelConfig
        })
      );
    }

    chapterPlaybackCache = markRaw({
      chapterId: ch.id,
      targets: markRaw(targets),
      maxDur: Math.max(0.1, maxDur)
    });
    playbackCacheByChapterId.set(ch.id, chapterPlaybackCache);
    if (typeof window !== "undefined") {
      (window as any).__movieEditorCacheSize = playbackCacheByChapterId.size;
    }
    chapterAnimTargetsCache = {
      chapterId: ch.id,
      targets: chapterPlaybackCache.targets as any
    };
    return chapterPlaybackCache;
  }

  function adoptPlaybackCache(ch: Chapter): boolean {
    if (chapterPlaybackCache?.chapterId === ch.id) {
      if (chapterAnimTargetsCache?.chapterId !== ch.id) {
        chapterAnimTargetsCache = {
          chapterId: ch.id,
          targets: chapterPlaybackCache.targets as any
        };
      }
      return true;
    }
    const pooled = playbackCacheByChapterId.get(ch.id);
    if (!pooled) return false;
    chapterPlaybackCache = pooled;
    chapterAnimTargetsCache = {
      chapterId: ch.id,
      targets: pooled.targets as any
    };
    return true;
  }

  /** 无 clips 的旧场景：从 modelConfigs.animConfig 预烘焙位姿窗，不写 clips、不改服务端 JSON。 */
  function buildChapterPlaybackCacheFromLegacy(ch: Chapter) {
    if (adoptPlaybackCache(ch)) return chapterPlaybackCache;
    const collected = collectChapterAnimTargets(ch);
    const targets: Array<{
      objs: THREE.Object3D[];
      cfg: ModelConfig;
      modelId: string;
      nodeId?: string | null;
      pbWindows?: Array<{ as: any; start: number; end: number; animDur: number }>;
      firstStart?: number;
      lastEnd?: number;
    }> = [];
    let maxDur = Math.max(0.1, (Number(ch.endTime) || 0) - (Number(ch.startTime) || 0));
    for (const entry of collected as Array<{
      objs: THREE.Object3D[];
      cfg: ModelConfig;
      modelId?: string;
      nodeId?: string | null;
    }>) {
      const modelId = (entry as any).modelId;
      if (!modelId) continue;
      const segs = (entry.cfg.animConfig?.segments || []) as any[];
      const pbWindows = segs.map((as: any) => {
        const start = typeof as.start === "number" ? as.start : 0;
        const animDur = Math.max(0, as.animTime ?? 0);
        const end = typeof as.end === "number" ? as.end : start + animDur;
        return markRaw({ as, start, end, animDur });
      });
      if (pbWindows.length) {
        maxDur = Math.max(maxDur, pbWindows[pbWindows.length - 1].end);
      }
      targets.push(
        markRaw({
          objs: entry.objs,
          modelId,
          nodeId: entry.nodeId ?? null,
          firstStart: pbWindows[0]?.start ?? 0,
          lastEnd: pbWindows.length ? pbWindows[pbWindows.length - 1].end : 0,
          pbWindows,
          cfg: markRaw(entry.cfg)
        })
      );
    }
    chapterPlaybackCache = markRaw({
      chapterId: ch.id,
      targets: markRaw(targets),
      maxDur
    });
    playbackCacheByChapterId.set(ch.id, chapterPlaybackCache);
    if (typeof window !== "undefined") {
      (window as any).__movieEditorCacheSize = playbackCacheByChapterId.size;
    }
    chapterAnimTargetsCache = {
      chapterId: ch.id,
      targets: chapterPlaybackCache.targets as any
    };
    return chapterPlaybackCache;
  }

  function ensurePlaybackCache(ch: Chapter): boolean {
    if (adoptPlaybackCache(ch)) return true;
    if (shouldSampleClipsOnly(ch)) {
      buildChapterPlaybackCacheFromClips(ch);
      return true;
    }
    if (shouldSampleLegacyAnimConfig(ch)) {
      buildChapterPlaybackCacheFromLegacy(ch);
      return true;
    }
    return false;
  }

  /** 播放用：从 clips 建缓存。编辑态 modelConfigs 已卸投影，不能再 collect 空配置。 */
  function ensureClipPlaybackCache(ch: Chapter): boolean {
    if (!shouldSampleClipsOnly(ch)) return false;
    if (!adoptPlaybackCache(ch)) {
      buildChapterPlaybackCacheFromClips(ch);
    }
    return true;
  }

  let chapterCachePrefetchQueue: string[] = [];
  let chapterCachePrefetchScheduled = false;

  function enqueueChapterCachePrefetch(preferredVideoId?: string | null) {
    const all = chapters.value.filter(
      c =>
        (c.clips?.length ?? 0) > 0 ||
        !!(c.modelConfigs && Object.keys(c.modelConfigs).length) ||
        !!c.camera
    );
    const preferredParent = preferredVideoId || activeVideoId.value;
    const preferred = preferredParent ? all.filter(c => c.parentId === preferredParent) : [];
    const rest = preferredParent ? all.filter(c => c.parentId !== preferredParent) : all;
    for (const ch of [...preferred, ...rest]) {
      if (playbackCacheByChapterId.has(ch.id)) continue;
      if (!chapterCachePrefetchQueue.includes(ch.id)) chapterCachePrefetchQueue.push(ch.id);
    }
    pumpChapterCachePrefetch();
  }

  function pumpChapterCachePrefetch() {
    if (chapterCachePrefetchScheduled || !chapterCachePrefetchQueue.length) return;
    chapterCachePrefetchScheduled = true;
    const run = () => {
      chapterCachePrefetchScheduled = false;
      if (!meshes.size) {
        window.setTimeout(() => pumpChapterCachePrefetch(), 250);
        return;
      }
      const firstModelId = models.value[0]?.id;
      if (firstModelId && !(getModelHierarchy(firstModelId)?.length)) {
        window.setTimeout(() => pumpChapterCachePrefetch(), 250);
        return;
      }
      while (chapterCachePrefetchQueue.length && playbackCacheByChapterId.has(chapterCachePrefetchQueue[0])) {
        chapterCachePrefetchQueue.shift();
      }
      const id = chapterCachePrefetchQueue.shift();
      if (!id) return;
      const ch = chapters.value.find(c => c.id === id);
      if (ch && !playbackCacheByChapterId.has(id)) {
        const displayedId = chAnimChapterId || selectedChapterId.value;
        ensurePlaybackCache(ch);
        if (displayedId && playbackCacheByChapterId.has(displayedId)) {
          chapterPlaybackCache = playbackCacheByChapterId.get(displayedId)!;
          chapterAnimTargetsCache = {
            chapterId: displayedId,
            targets: chapterPlaybackCache.targets as any
          };
        }
        if (
          (chAnimChapterId === id || selectedChapterId.value === id) &&
          playbackCacheByChapterId.has(id)
        ) {
          const elapsed = Math.max(0, (Number(currentTime.value) || 0) - (Number(ch.startTime) || 0));
          applyChapterWallclockFrame(ch, elapsed);
          renderViewportFrame();
        }
      }
      if (chapterCachePrefetchQueue.length) pumpChapterCachePrefetch();
    };
    if (typeof requestIdleCallback === "function") {
      requestIdleCallback(() => run(), { timeout: 80 });
    } else {
      window.setTimeout(run, 0);
    }
  }

  function getChapterAnimTargetsCached(ch: Chapter) {
    if (chapterPlaybackCache?.chapterId === ch.id) {
      return chapterPlaybackCache.targets as any;
    }
    if (chapterAnimTargetsCache?.chapterId === ch.id) {
      return chapterAnimTargetsCache.targets;
    }
    if (adoptPlaybackCache(ch)) {
      return chapterPlaybackCache?.targets as any;
    }
    return [];
  }

  /** 只把当前编辑写回 clips，不投影到 modelConfigs（切换节点/开播前的轻量落盘） */
  function persistClipsEditorOnly(ch: Chapter, opts?: { markSceneDirty?: boolean; skipUiBump?: boolean }) {
    persistActiveClipEditorState();
    writeLiveTargetBackToActiveClip();
    const clips = Array.isArray(ch.clips) && ch.clips.length ? ch.clips : ensureChapterClips(ch);
    if (!opts?.skipUiBump) {
      rebuildClipAbsoluteTimes(clips);
      syncClipTimes(clips);
      bumpAnimClipListRevision();
      const lastClip = [...clips].sort((a, b) => (a.end ?? 0) - (b.end ?? 0)).pop();
      if (lastClip?.camera && !cameraConfigsNearlyEqual(ch.camera, lastClip.camera)) {
        ch.camera = cloneCameraConfig(lastClip.camera);
      }
      const contentDur = Math.max(getClipsTotalDuration(clips), 0.1);
      const windowDur = Math.max(0.1, (ch.endTime ?? 0) - (ch.startTime ?? 0));
      if (contentDur > windowDur + 0.05) {
        chStore.updateChapter(ch, { endTime: roundAnimNum((ch.startTime ?? 0) + contentDur) });
        if (selectedChapter.value?.id === ch.id) syncChapterForm(ch);
      }
    }
    sealHeavyClipsInChapter(ch);
    animDirty.value = false;
    // 切章热路径保留 pooled 缓存：丢掉会导致连点动画时 miss → 旧模型残留 + 卡顿
    invalidateChapterAnimTargetsCache(ch.id, { dropPooled: !!opts?.markSceneDirty });
    if (opts?.markSceneDirty) clipsAwaitingSceneSave.value = true;
  }

  function chapterClipTargetCount(ch: Chapter) {
    return (ch.clips || []).reduce((n, c) => n + (c.targets?.length ?? 0), 0);
  }

  /** 章节全部片段目标合计是否达到大体量阈值（勿只看单片段） */
  function isHeavyClipChapter(ch?: Chapter | null) {
    if (!ch?.clips?.length) return false;
    return chapterClipTargetCount(ch) >= CLIP_HEAVY_TARGET_THRESHOLD;
  }

  /** 编辑切章是否必须走轻量路径（clips / nodeConfigs / 大 GLB 任一超阈值） */
  let heavyHierarchyCacheKey = "";
  let heavyHierarchyCacheValue = false;
  function isHeavyEditNavChapter(ch?: Chapter | null) {
    if (!ch) return false;
    if (isHeavyClipChapter(ch)) return true;
    let nodeCfgCount = 0;
    for (const raw of Object.values(ch.modelConfigs || {})) {
      const nc = (raw as ModelConfig)?.nodeConfigs;
      if (!nc) continue;
      nodeCfgCount += Object.keys(nc).length;
      if (nodeCfgCount >= CLIP_HEAVY_TARGET_THRESHOLD) return true;
    }
    // 层级规模只随模型加载变化，缓存避免切章反复整树计数卡死
    const hierarchyKey = models.value.map(m => `${m.id}:${meshes.has(m.id) ? 1 : 0}`).join("|");
    if (hierarchyKey !== heavyHierarchyCacheKey) {
      heavyHierarchyCacheKey = hierarchyKey;
      heavyHierarchyCacheValue = models.value.some(
        m => countHierarchyNodes(getModelHierarchy(m.id)) >= CLIP_HEAVY_TARGET_THRESHOLD
      );
    }
    return heavyHierarchyCacheValue;
  }

  function clipVisualSig(segId: string | undefined, visual: ClipVisualState) {
    return `${segId || ""}|${JSON.stringify(visual)}`;
  }

  function resolveClipVisualAtElapsed(rawSegs: any[], elapsedSec: number): { visual: ClipVisualState; sigId: string } | null {
    if (!rawSegs?.length) return null;
    const active = findAnimatingSegmentAtElapsed(rawSegs, elapsedSec) as any;
    if (active) {
      return {
        visual: serializeClipVisual(active.clipVisual),
        sigId: String(active.id || "seg")
      };
    }
    return null;
  }

  function applyClipVisualToObjects(
    model: Model,
    objs: THREE.Object3D[],
    visual: ClipVisualState,
    segId: string | undefined,
    skipOutlineRebuild = false
  ) {
    const vis = serializeClipVisual(visual);
    const visualCfg = modelConfigFromClipVisual(vis);
    const sig = clipVisualSig(segId, vis);
    // 隐藏/线框/轮廓绝不能 skip：否则 colorWrite=false + 轮廓残留会变成「蓝线框」
    const skip = skipOutlineRebuild && vis.visible !== false && !vis.wireframe && !vis.outline && !vis.highlight;
    for (const obj of objs) {
      const actuallyVisible = obj.visible !== false;
      const stale =
        (vis.visible === false && actuallyVisible) || (vis.visible !== false && !actuallyVisible);
      if (!stale && obj.userData._clipVisualSig === sig) continue;
      obj.userData._clipVisualSig = sig;
      applyModelVisualOnly(model, obj, visualCfg, skip);
    }
  }

  function resolveChapterClipVisualTargets(ch: Chapter) {
    if (chapterPlaybackCache?.chapterId === ch.id) {
      return chapterPlaybackCache.targets as any;
    }
    if (_chAnimLock && ch.clips?.length) {
      ensureClipPlaybackCache(ch);
      return (chapterPlaybackCache?.targets as any) || [];
    }
    return getChapterAnimTargetsCached(ch);
  }

  /** 按 elapsed 对本章所有动画目标套用当前片段外观（全量 resync 后覆盖章节默认可见性） */
  function applyChapterClipVisualsAtElapsed(ch: Chapter, elapsedSec: number, options?: { force?: boolean }) {
    const targets = resolveChapterClipVisualTargets(ch);
    // 播放锁期间一律用已投影 segments，避免编辑态 live 把「显示关闭」冲掉
    const allowLive = !_chAnimLock;
    for (const { objs, cfg, liveSegs, modelId } of targets as Array<{
      objs: THREE.Object3D[];
      cfg: ModelConfig;
      liveSegs?: any[];
      modelId: string;
    }>) {
      const model = models.value.find(m => m.id === modelId);
      if (!model) continue;
      const rawSegs = (allowLive && liveSegs?.length ? liveSegs : cfg.animConfig?.segments) || [];
      if (!rawSegs.length) continue;
      const resolved = resolveClipVisualAtElapsed(rawSegs, elapsedSec);
      if (options?.force) {
        for (const obj of objs) delete obj.userData._clipVisualSig;
      }
      if (resolved) {
        applyClipVisualToObjects(model, objs, resolved.visual, resolved.sigId, false);
      } else {
        applyClipVisualToObjects(model, objs, createDefaultClipVisual(), `chapter:${modelId}`, false);
      }
    }
    applyActiveClipVisualsAtElapsed(ch, elapsedSec, options?.force);
  }

  type PlaybackVisualJob = {
    obj: THREE.Object3D;
    vis: ClipVisualState;
    sig: string;
    modelId: string;
  };

  /** 当前片段时间窗内：按该片段 targets 的 clipVisual 严格执行（显示关就必须藏掉） */
  function applyActiveClipVisualsAtElapsed(ch: Chapter, elapsedSec: number, force = false) {
    const clips = ch.clips;
    if (!clips?.length) return;
    const clip =
      findActiveClipAtElapsed(clips, elapsedSec) ?? (elapsedSec <= 1e-4 ? clips[0] : null);
    if (!clip?.targets?.length) return;
    const jobMap = new Map<THREE.Object3D, PlaybackVisualJob>();
    for (const target of clip.targets) {
      if (!target?.modelId) continue;
      const root = meshes.get(target.modelId);
      if (!root) continue;
      const nodeId = resolveClipTargetNodeId(target.modelId, target.nodeId ?? null);
      const objs = nodeId ? collectObjectsForNodeId(root, nodeId) : [root];
      if (!objs.length) continue;
      const vis = serializeClipVisual(target.clipVisual);
      const sig = clipVisualSig(
        `${clip.id}:${normalizeClipNodeKey(target.modelId, target.nodeId ?? null)}`,
        vis
      );
      for (const obj of objs) {
        if (force) delete obj.userData._clipVisualSig;
        jobMap.set(obj, { obj, vis, sig, modelId: target.modelId });
      }
    }
    commitPlaybackVisualJobs([...jobMap.values()]);
  }

  type PlaybackPoseWindow = {
    as: any;
    start: number;
    end: number;
    animDur: number;
    clipId?: string;
    clipStart?: number;
    clipEnd?: number;
  };

  function restorePlaybackEntryBindPose(entry: {
    modelId: string;
    nodeId?: string | null;
    objs: THREE.Object3D[];
  }) {
    const model = models.value.find(m => m.id === entry.modelId);
    if (!model) return;
    const isRoot = !entry.nodeId;
    for (const obj of entry.objs) resetObject3DTransformToDefault(model, obj, isRoot);
  }

  function resolvePlaybackPoseWindow(
    pbWindows: PlaybackPoseWindow[],
    elapsedSec: number
  ): PlaybackPoseWindow | null {
    if (!pbWindows.length) return null;
    const elapsed = Math.max(0, elapsedSec);
    for (let i = 0; i < pbWindows.length; i++) {
      const w = pbWindows[i];
      const clipStart = w.clipStart ?? w.start;
      const clipEnd = w.clipEnd ?? w.end;
      const isLast = i === pbWindows.length - 1;
      const inClip = isLast ? elapsed <= clipEnd + 1e-8 : elapsed < clipEnd - 1e-8;
      if (elapsed + 1e-8 >= clipStart && inClip) return w;
    }
    const first = pbWindows[0];
    const last = pbWindows[pbWindows.length - 1];
    const firstStart = first.clipStart ?? first.start;
    if (elapsed < firstStart) return first;
    return last;
  }

  /**
   * 墙钟专用：预烘焙窗 + 原地采样。
   * 只在「当前片段时间窗」内执行该片段起点→终点；不在本片段的目标回到默认，避免新片段沿用上一段结束态。
   */
  function applyPlaybackTargetPoseFast(
    obj: THREE.Object3D,
    pbWindows: PlaybackPoseWindow[],
    _firstStart: number,
    _lastEnd: number,
    elapsedSec: number
  ): boolean {
    if (!pbWindows.length) return false;
    const elapsed = Math.max(0, elapsedSec);
    const hit = resolvePlaybackPoseWindow(pbWindows, elapsed);
    if (!hit) return false;
    const { as, start, end, animDur } = hit;
    const applyStartFast = (seg: any) => {
      if (seg.pivot && seg.pivot !== "center") {
        const pivotCache = getSegPivotCache(seg, obj);
        applyPivotPathFrame(obj, seg.startPos, seg.startRot, pivotCache, 0);
        obj.scale.setScalar(seg.startScale ?? 1);
        return;
      }
      obj.position.set(seg.startPos[0], seg.startPos[1], seg.startPos[2]);
      obj.rotation.set(
        THREE.MathUtils.degToRad(seg.startRot[0] ?? 0),
        THREE.MathUtils.degToRad(seg.startRot[1] ?? 0),
        THREE.MathUtils.degToRad(seg.startRot[2] ?? 0)
      );
      obj.scale.setScalar(seg.startScale ?? 1);
    };
    const applyEndFast = (seg: any) => {
      if (seg.pivot && seg.pivot !== "center") {
        const pivotCache = getSegPivotCache(seg, obj);
        applyPivotPathFrame(obj, seg.endPos, seg.endRot, pivotCache, 1);
        obj.scale.setScalar(seg.endScale ?? 1);
        return;
      }
      obj.position.set(seg.endPos[0], seg.endPos[1], seg.endPos[2]);
      obj.rotation.set(
        THREE.MathUtils.degToRad(seg.endRot[0] ?? 0),
        THREE.MathUtils.degToRad(seg.endRot[1] ?? 0),
        THREE.MathUtils.degToRad(seg.endRot[2] ?? 0)
      );
      obj.scale.setScalar(seg.endScale ?? 1);
    };
    // 片段窗内、动画开始前：停在本片段起点（默认/设置起点），不沿用上一段终点
    if (elapsed < start - 1e-8) {
      applyStartFast(as);
      return true;
    }
    if (animDur <= 1e-8 || elapsed >= end - 1e-8) {
      applyEndFast(as);
      return true;
    }
    const span = Math.max(end - start, animDur, 1e-8);
    const t = Math.min(1, Math.max(0, (elapsed - start) / span));
    const ep = applyEasingInline(t, as.easing || "easeInOut");
    if (as.pivot && as.pivot !== "center") {
      const pivotCache = getSegPivotCache(as, obj);
      const pos = [
        as.startPos[0] + (as.endPos[0] - as.startPos[0]) * ep,
        as.startPos[1] + (as.endPos[1] - as.startPos[1]) * ep,
        as.startPos[2] + (as.endPos[2] - as.startPos[2]) * ep
      ];
      const rot = [
        as.startRot[0] + (as.endRot[0] - as.startRot[0]) * ep,
        as.startRot[1] + (as.endRot[1] - as.startRot[1]) * ep,
        as.startRot[2] + (as.endRot[2] - as.startRot[2]) * ep
      ];
      applyPivotPathFrame(obj, pos, rot, pivotCache, ep);
      obj.scale.setScalar((as.startScale ?? 1) + ((as.endScale ?? 1) - (as.startScale ?? 1)) * ep);
      return true;
    }
    obj.position.set(
      as.startPos[0] + (as.endPos[0] - as.startPos[0]) * ep,
      as.startPos[1] + (as.endPos[1] - as.startPos[1]) * ep,
      as.startPos[2] + (as.endPos[2] - as.startPos[2]) * ep
    );
    obj.rotation.set(
      THREE.MathUtils.degToRad(as.startRot[0] + (as.endRot[0] - as.startRot[0]) * ep),
      THREE.MathUtils.degToRad(as.startRot[1] + (as.endRot[1] - as.startRot[1]) * ep),
      THREE.MathUtils.degToRad(as.startRot[2] + (as.endRot[2] - as.startRot[2]) * ep)
    );
    obj.scale.setScalar((as.startScale ?? 1) + ((as.endScale ?? 1) - (as.startScale ?? 1)) * ep);
    return true;
  }

  /**
   * 墙钟播放专用轻量外观：只写 visible 与高亮，不重建线框/描边。
   * 144 目标时 rebuildOutline 一次就是几秒，必须避开。
   */
  function applyPlaybackVisualLight(
    obj: THREE.Object3D,
    visual: { visible?: boolean; highlight?: boolean; modelHighlightColor?: string }
  ) {
    const visible = visual.visible !== false;
    if (obj.visible !== visible) obj.visible = visible;
    if (!visible) return;
    obj.traverse((child: any) => {
      if (!(child instanceof THREE.Mesh)) return;
      const mats = Array.isArray(child.material) ? child.material : [child.material];
      for (const mat of mats) {
        if (!mat) continue;
        const m = mat as any;
        if (visual.highlight) {
          m.emissive = m.emissive ?? new THREE.Color(0x000000);
          m.emissive.set(visual.modelHighlightColor || "#4ade80");
          m.emissiveIntensity = 0.35;
        } else if (m.emissive && m.emissiveIntensity === 0.35) {
          m.emissive.set(0x000000);
          m.emissiveIntensity = 0;
        }
        m.needsUpdate = true;
      }
    });
  }

  /**
   * 播放外观：显示立刻生效；轮廓/线框/高亮走 OutlinePass + 原生线框，
   * 不建 EdgesGeometry。超量目标按 8ms 时间片分到后续帧，避免卡住位姿循环。
   */
  function commitPlaybackVisualJobs(jobs: PlaybackVisualJob[]) {
    const incoming = new Set(jobs.map(j => j.obj));
    for (const prev of playbackVisApplied) {
      if (incoming.has(prev.obj)) continue;
      const nodeId = (prev.obj.userData?.nodeId as string) || null;
      restoreChapterStaticVisualForClipTarget(prev.modelId, nodeId, {
        skipOutlineRebuild: true,
        bindPose: true
      });
    }
    playbackVisApplied = jobs.map(j => ({ obj: j.obj, modelId: j.modelId }));
    const pending: PlaybackVisualJob[] = [];
    for (const job of jobs) {
      const wantVisible = job.vis.visible !== false;
      const actuallyVisible = job.obj.visible !== false;
      const stale = wantVisible !== actuallyVisible;
      if (!stale && job.obj.userData._clipVisualSig === job.sig) continue;
      pending.push(job);
    }
    if (!pending.length) return;

    const token = ++playbackVisualGeneration;
    pendingVisualRebuildOwners.clear();
    visualRebuildGeneration++;

    const byRoot = new Map<
      THREE.Object3D,
      { owners: Set<string>; hideSet: Set<THREE.Object3D> }
    >();
    const fxItems: Array<{
      obj: THREE.Object3D;
      ownerKey: string;
      root: THREE.Object3D;
      cfg: ModelConfig;
      sig: string;
      colors: { outlineColor: string; wireframeColor: string; modelHighlightColor: string };
    }> = [];

    for (const job of pending) {
      const root = meshes.get(job.modelId);
      const ownerKey = (job.obj.userData?.nodeId as string | undefined) || `root:${job.modelId}`;
      if (root) {
        let bucket = byRoot.get(root);
        if (!bucket) {
          bucket = { owners: new Set(), hideSet: new Set() };
          byRoot.set(root, bucket);
        }
        bucket.owners.add(ownerKey);
        if (job.vis.visible === false) bucket.hideSet.add(job.obj);
      }
      if (
        job.vis.visible !== false &&
        (job.vis.outline || job.vis.wireframe || job.vis.highlight) &&
        root
      ) {
        fxItems.push({
          obj: job.obj,
          ownerKey,
          root,
          cfg: modelConfigFromClipVisual(job.vis),
          sig: job.sig,
          colors: {
            outlineColor: job.vis.outlineColor,
            wireframeColor: job.vis.wireframeColor,
            modelHighlightColor: job.vis.modelHighlightColor
          }
        });
      } else {
        job.obj.userData._clipVisualSig = job.sig;
      }
    }

    for (const [root, bucket] of byRoot) {
      removeVisualOverlaysForOwners(root, bucket.owners, bucket.hideSet.size ? bucket.hideSet : null);
    }
    for (const job of pending) {
      job.obj.visible = job.vis.visible !== false;
    }

    const applyOne = (item: (typeof fxItems)[number]) => {
      const meshList = collectMeshesForVisualOwner(item.obj);
      for (const mesh of meshList) {
        applyVisualEffectsToMesh(item.root, item.obj, mesh, item.cfg, item.ownerKey, item.colors, true);
      }
      item.obj.userData._clipVisualSig = item.sig;
    };

    const FX_BUDGET_MS = 8;
    let index = 0;
    const firstStart = performance.now();
    while (index < fxItems.length && performance.now() - firstStart < FX_BUDGET_MS) {
      applyOne(fxItems[index++]);
    }
    syncModelConfigOutlinePass();
    invalidatePickMeshCache();
    if (index >= fxItems.length) return;

    const step = () => {
      if (token !== playbackVisualGeneration) return;
      const t0 = performance.now();
      while (index < fxItems.length && performance.now() - t0 < FX_BUDGET_MS) {
        applyOne(fxItems[index++]);
      }
      syncModelConfigOutlinePass();
      invalidatePickMeshCache();
      if (index < fxItems.length) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

  /** 切片段：应用本片段外观（含线框/高亮/描边）；同签名则跳过，避免每帧重建 */
  function applyPlaybackVisibilityFast(ch: Chapter, elapsedSec: number, force = false) {
    const cacheTargets = (chapterPlaybackCache?.chapterId === ch.id
      ? chapterPlaybackCache.targets
      : getChapterAnimTargetsCached(ch)) as Array<{
      objs: THREE.Object3D[];
      cfg: ModelConfig;
      modelId: string;
      nodeId?: string | null;
      pbWindows?: PlaybackPoseWindow[];
    }>;
    const jobMap = new Map<THREE.Object3D, PlaybackVisualJob>();
    const objsByKey = new Map<string, { objs: THREE.Object3D[]; modelId: string }>();
    const addJob = (obj: THREE.Object3D, vis: ClipVisualState, sig: string, modelId: string) => {
      if (force) delete obj.userData._clipVisualSig;
      jobMap.set(obj, { obj, vis, sig, modelId });
    };

    for (const entry of cacheTargets) {
      const modelId = entry.modelId;
      objsByKey.set(normalizeClipNodeKey(modelId, entry.nodeId ?? null), {
        objs: entry.objs,
        modelId
      });
      const hit = entry.pbWindows?.length
        ? resolvePlaybackPoseWindow(entry.pbWindows, elapsedSec)
        : null;
      const vis = hit?.as
        ? serializeClipVisual(hit.as.clipVisual)
        : createDefaultClipVisual();
      const sigId = hit?.as
        ? String(hit.as.id || hit.clipId || "seg")
        : `chapter-default:${modelId}:${entry.nodeId ?? ""}`;
      const sig = clipVisualSig(sigId, vis);
      for (const obj of entry.objs) addJob(obj, vis, sig, modelId);
    }

    const clips = ch.clips;
    if (clips?.length) {
      const clip =
        findActiveClipAtElapsed(clips, elapsedSec) ?? (elapsedSec <= 1e-4 ? clips[0] : null);
      if (clip?.targets?.length) {
        for (const target of clip.targets) {
          if (!target?.modelId) continue;
          const nodeId = resolveClipTargetNodeId(target.modelId, target.nodeId ?? null);
          const key = normalizeClipNodeKey(target.modelId, nodeId);
          let objs = objsByKey.get(key)?.objs;
          if (!objs) {
            const root = meshes.get(target.modelId);
            if (!root) continue;
            objs = nodeId ? collectObjectsForNodeId(root, nodeId) : [root];
          }
          if (!objs.length) continue;
          const vis = serializeClipVisual(target.clipVisual);
          const sig = clipVisualSig(`${clip.id}:${key}`, vis);
          for (const obj of objs) addJob(obj, vis, sig, target.modelId);
        }
      }
    }

    commitPlaybackVisualJobs([...jobMap.values()]);
  }

  /** 播放循环中仅更新动画变换，避免每帧全量重置模型树 */
  function applyChapterAnimOnly(ch: Chapter, elapsedSec: number, opts?: { visualsOnlyOnClipChange?: boolean }) {
    const targets = getChapterAnimTargetsCached(ch);
    const allowLive = !_chAnimLock;
    const skipOutline = !!_chAnimLock || targets.length >= CLIP_HEAVY_TARGET_THRESHOLD;
    const activeClip =
      ch.clips?.length
        ? findActiveClipAtElapsed(ch.clips, elapsedSec) ?? (elapsedSec <= 1e-4 ? ch.clips[0] : null)
        : null;
    const clipChanged =
      !!opts?.visualsOnlyOnClipChange &&
      !!activeClip &&
      activeClip.id !== wallclockVisualClipId;

    for (const entry of targets as Array<{
      objs: THREE.Object3D[];
      cfg: ModelConfig;
      liveSegs?: any[];
      modelId?: string;
      pbWindows?: Array<{ as: any; start: number; end: number; animDur: number }>;
      firstStart?: number;
      lastEnd?: number;
    }>) {
      const { objs, cfg, liveSegs, modelId, pbWindows, firstStart, lastEnd } = entry;
      const segs = allowLive ? liveSegs : undefined;
      if (!segs?.length && pbWindows?.length) {
        let applied = false;
        for (const obj of objs) {
          if (applyPlaybackTargetPoseFast(obj, pbWindows, firstStart ?? 0, lastEnd ?? 0, elapsedSec)) {
            applied = true;
          }
        }
        if (!applied && modelId) {
          restorePlaybackEntryBindPose({
            modelId,
            nodeId: (entry as any).nodeId ?? null,
            objs
          });
        }
      } else {
        for (const obj of objs) {
          applyElapsedAnimToObject(obj, cfg, elapsedSec, segs);
        }
      }
      if (_chAnimLock || (opts?.visualsOnlyOnClipChange && !clipChanged && wallclockVisualClipId)) {
        continue;
      }
      const model = modelId ? models.value.find(m => m.id === modelId) : undefined;
      if (!model) continue;
      if (!segs?.length && pbWindows?.length) {
        const hit = resolvePlaybackPoseWindow(pbWindows as PlaybackPoseWindow[], elapsedSec);
        if (hit?.as) {
          applyClipVisualToObjects(
            model,
            objs,
            serializeClipVisual(hit.as.clipVisual),
            String(hit.as.id || hit.clipId || "seg"),
            skipOutline
          );
        } else {
          applyClipVisualToObjects(
            model,
            objs,
            createDefaultClipVisual(),
            `chapter-default:${modelId}`,
            skipOutline
          );
        }
        continue;
      }
      const rawSegs = (segs?.length ? segs : cfg.animConfig?.segments) || [];
      const resolved = resolveClipVisualAtElapsed(rawSegs, elapsedSec);
      if (resolved) {
        applyClipVisualToObjects(model, objs, resolved.visual, resolved.sigId, skipOutline);
      } else if (rawSegs.length) {
        applyClipVisualToObjects(
          model,
          objs,
          createDefaultClipVisual(),
          `chapter:${modelId || ""}`,
          skipOutline
        );
      }
    }
    if (!_chAnimLock) {
      syncVisualOverlayTransforms();
    } else if (clipChanged || !wallclockVisualClipId) {
      syncVisualOverlayTransforms();
    }
    if (_chAnimLock) {
      if (!opts?.visualsOnlyOnClipChange || clipChanged || !wallclockVisualClipId) {
        applyPlaybackVisibilityFast(ch, elapsedSec, !!clipChanged);
        if (activeClip) wallclockVisualClipId = activeClip.id;
      }
      applyClipCameraAtElapsed(ch, elapsedSec);
    }
  }

  /** 墙钟预览帧：轻量位姿采样 + 切段显隐 + 运镜 */
  function applyChapterWallclockFrame(ch: Chapter, elapsedSec: number) {
    if (chapterPlaybackCache?.chapterId !== ch.id) {
      adoptPlaybackCache(ch);
    }
    const cache =
      chapterPlaybackCache?.chapterId === ch.id ? chapterPlaybackCache : null;
    const maxDur = cache?.maxDur ?? (ch.clips?.length ? getClipsTotalDuration(ch.clips) : 0);
    const sampleElapsed =
      maxDur > 1e-8 ? Math.min(Math.max(0, elapsedSec), maxDur) : Math.max(0, elapsedSec);
    if (cache?.targets?.length) {
      for (const entry of cache.targets as Array<{
        objs: THREE.Object3D[];
        modelId: string;
        nodeId?: string | null;
        pbWindows?: PlaybackPoseWindow[];
        firstStart?: number;
        lastEnd?: number;
        cfg: ModelConfig;
      }>) {
        if (entry.pbWindows?.length) {
          let applied = false;
          for (const obj of entry.objs) {
            if (
              applyPlaybackTargetPoseFast(
                obj,
                entry.pbWindows,
                entry.firstStart ?? 0,
                entry.lastEnd ?? 0,
                sampleElapsed
              )
            ) {
              applied = true;
            }
          }
          if (!applied) restorePlaybackEntryBindPose(entry);
        } else {
          for (const obj of entry.objs) {
            applyElapsedAnimToObject(obj, entry.cfg, sampleElapsed);
          }
        }
      }
      const activeClip =
        ch.clips?.length
          ? findActiveClipAtElapsed(ch.clips, sampleElapsed) ??
            (sampleElapsed <= 1e-4 ? ch.clips[0] : null)
          : null;
      if (activeClip && activeClip.id !== wallclockVisualClipId) {
        wallclockVisualClipId = activeClip.id;
        // 切片段必须立刻套上该片段全部外观；延后一帧会导致「没按设置播」
        applyPlaybackVisibilityFast(ch, sampleElapsed, true);
      } else if (!wallclockVisualClipId) {
        applyPlaybackVisibilityFast(ch, sampleElapsed, true);
        wallclockVisualClipId = activeClip?.id ?? "__none__";
      }
      applyClipCameraAtElapsed(ch, sampleElapsed);
      return;
    }
    snapChapterCameraInstant(ch, sampleElapsed);
  }

  let lastClipCameraId: string | null = null;
  let clipPlayCameraOrigin: {
    position: [number, number, number];
    target: [number, number, number];
    fov: number;
  } | null = null;

  function lerpNum(a: number, b: number, t: number) {
    return a + (b - a) * t;
  }

  function sampleClipCameraPose(
    from: { position: number[]; target: number[]; fov: number },
    to: { position: number[]; target: number[]; fov: number },
    t: number
  ) {
    const e = easeInOutCubic(Math.max(0, Math.min(1, t)));
    return {
      position: [
        lerpNum(from.position[0], to.position[0], e),
        lerpNum(from.position[1], to.position[1], e),
        lerpNum(from.position[2], to.position[2], e)
      ] as [number, number, number],
      target: [
        lerpNum(from.target[0], to.target[0], e),
        lerpNum(from.target[1], to.target[1], e),
        lerpNum(from.target[2], to.target[2], e)
      ] as [number, number, number],
      fov: lerpNum(from.fov, to.fov, e)
    };
  }

  function capturePlaybackCameraOrigin() {
    if (!camera || !controls) {
      clipPlayCameraOrigin = null;
      return;
    }
    clipPlayCameraOrigin = {
      position: [camera.position.x, camera.position.y, camera.position.z],
      target: [controls.target.x, controls.target.y, controls.target.z],
      fov: camera.fov
    };
  }

  /** 墙钟/视频开播：运镜起点只取上一片段镜头；第一段没有上一镜时由采样函数用本段镜头（不拿章节末镜） */
  function resolvePlaybackCameraFrom(ch: Chapter, elapsedSec: number) {
    const clips = ch.clips || [];
    const clip = findActiveClipAtElapsed(clips, elapsedSec);
    const idx = clip ? clips.findIndex(c => c.id === clip.id) : 0;
    for (let i = idx - 1; i >= 0; i--) {
      const cam = clips[i]?.camera;
      if (!cam) continue;
      return {
        position: [...(cam.position || [0, 0, 0])] as [number, number, number],
        target: [...(cam.target || [0, 0, 0])] as [number, number, number],
        fov: cam.fov
      };
    }
    return null;
  }

  function applyClipCameraAtElapsed(ch: Chapter, elapsedSec: number) {
    const clips = ch.clips;
    if (!clips?.length || !camera || !controls) return;
    // 用户已手动旋转/拖拽视口：保留其视角，不要每帧抢镜头
    if (playbackCameraUserOverride || viewportInteracting) return;
    const clip = findActiveClipAtElapsed(clips, elapsedSec);
    if (!clip?.camera) return;
    const idx = clips.findIndex(c => c.id === clip.id);
    const to = clip.camera;
    let from = clipPlayCameraOrigin;
    for (let i = idx - 1; i >= 0; i--) {
      if (clips[i]?.camera) {
        from = {
          position: clips[i].camera!.position,
          target: clips[i].camera!.target,
          fov: clips[i].camera!.fov
        };
        break;
      }
    }
    if (!from) from = { position: to.position, target: to.target, fov: to.fov };

    const start = clip.start ?? 0;
    const clipDur = Math.max(0, (clip.end ?? start) - start);
    const hasAuthoredTransition =
      typeof to.transitionSec === "number" && Number.isFinite(to.transitionSec);
    const authoredTrans = hasAuthoredTransition ? Math.max(0, to.transitionSec!) : 0;
    // 运镜限制在本片段窗内，避免过渡长于窗长时还没到点就切下一段
    const transDur = hasAuthoredTransition
      ? Math.min(authoredTrans, Math.max(clipDur, 0))
      : Math.max(clipDur, 0.35);
    const u = transDur <= 1e-8 ? 1 : Math.max(0, Math.min(1, (elapsedSec - start) / transDur));
    const pose = sampleClipCameraPose(from, to, u);

    // 跟片段时钟采样，避免一次性 animCam 被章节运镜/OrbitControls 冲掉
    camTrans = null;
    camTransAdvanceLastAt = 0;
    cameraAnimating = false;
    isCameraTransitioning.value = false;
    camera.position.set(pose.position[0], pose.position[1], pose.position[2]);
    controls.target.set(pose.target[0], pose.target[1], pose.target[2]);
    if (Math.abs(camera.fov - pose.fov) > 1e-4) {
      camera.fov = pose.fov;
      camera.updateProjectionMatrix();
    }
    camera.lookAt(controls.target);
  }

  function applyObjectBindPoseForAnim(obj: THREE.Object3D) {
    if (obj.userData?.nodeId) {
      const bp = obj.userData.baseLocalPos || [obj.position.x, obj.position.y, obj.position.z];
      const br = obj.userData.baseLocalRot || [0, 0, 0];
      const bs = obj.userData.baseLocalScale ?? 1;
      obj.position.set(bp[0], bp[1], bp[2]);
      obj.rotation.set(br[0], br[1], br[2], "XYZ");
      obj.quaternion.setFromEuler(new THREE.Euler(br[0], br[1], br[2], "XYZ"));
      obj.scale.setScalar(bs);
      return;
    }
    const bp = obj.userData.basePos || DEFAULT_MODEL_BASE_POSITION;
    obj.position.set(bp[0], bp[1], bp[2]);
    obj.rotation.set(0, 0, 0);
    obj.quaternion.identity();
    obj.scale.setScalar(1);
  }

  function applyElapsedAnimToObject(obj: THREE.Object3D, cfg: ModelConfig, elapsedSec: number, liveSegs?: any[]) {
    const cac = cfg.animConfig;
    if (!cac?.segments?.length || !cfg.animation) return;

    const rawSegs = liveSegs?.length ? liveSegs : cac.segments;
    // 播放缓存段已是绝对坐标：禁止每帧 clone（144 目标时会把 3s 拖成 10s+）
    const canApplyInPlace = !liveSegs?.length && !(cac as any).relativeTransform;
    const csegs = canApplyInPlace
      ? resolvePlaybackSegments(rawSegs)
      : resolvePlaybackSegments(rawSegs).map(seg =>
          liveSegs?.length
            ? cloneAnimSegmentForApply(obj, seg)
            : cloneStoredAnimSegmentForPlayback(obj, seg, cac as any)
        );
    let ctotal = 0;
    for (let cs = 0; cs < csegs.length; cs++) ctotal += (csegs[cs].pauseTime || 0) + (csegs[cs].animTime ?? 0);
    if (ctotal <= 0) {
      // 全为瞬移：直接落到最后一段结束姿态
      const alast = csegs[csegs.length - 1];
      const pc = getSegPivotCache(alast, obj);
      applyPivotPathFrame(
        obj,
        [alast.endPos[0], alast.endPos[1], alast.endPos[2]],
        [alast.endRot[0], alast.endRot[1], alast.endRot[2]],
        pc,
        1
      );
      obj.scale.setScalar(alast.endScale);
      return;
    }
    for (let cs2 = 0; cs2 < csegs.length; cs2++) getSegPivotCache(csegs[cs2], obj);

    const elapsed = Math.max(0, elapsedSec);
    const windows: Array<{ as: (typeof csegs)[number]; start: number; end: number; animDur: number }> = [];
    let cursor = 0;
    for (let i = 0; i < csegs.length; i++) {
      const as = csegs[i];
      const animDur = Math.max(0, as.animTime ?? 0);
      const pause = as.pauseTime || 0;
      const start =
        typeof as.start === "number" && Number.isFinite(as.start)
          ? as.start
          : roundAnimNum(cursor + pause);
      const end =
        typeof as.end === "number" && Number.isFinite(as.end)
          ? as.end
          : roundAnimNum(start + animDur);
      windows.push({ as, start, end, animDur });
      cursor = Math.max(cursor, end, cursor + pause + animDur);
    }
    const firstAbsStart = windows[0].start;
    const lastAbsEnd = windows[windows.length - 1].end;
    const trackEnd = Math.max(lastAbsEnd, ctotal);
    // 尚未进入该目标的第一段动画（例如只在片段2出场）：保持 GLB 初始姿态
    if (elapsed < firstAbsStart - 1e-8) {
      applyObjectBindPoseForAnim(obj);
      return;
    }
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

    const applyEndPose = (alast: (typeof csegs)[number]) => {
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
    };

    if (elapsed >= trackEnd - 1e-8) {
      applyEndPose(csegs[csegs.length - 1]);
      return;
    }

    const applyHoldPose = (aseg: number) => {
      if (aseg <= 0) {
        applyObjectBindPoseForAnim(obj);
        return;
      }
      const hold = csegs[aseg - 1];
      const hpc = hold._animPivotCache || getSegPivotCache(hold, obj);
      applyPivotPathFrame(
        obj,
        [hold.endPos[0], hold.endPos[1], hold.endPos[2]],
        [hold.endRot[0], hold.endRot[1], hold.endRot[2]],
        hpc,
        1
      );
      obj.scale.setScalar(hold.endScale);
    };

    let applied = false;
    for (let aseg = 0; aseg < windows.length; aseg++) {
      const { as, start, end, animDur } = windows[aseg];
      const isLast = aseg === windows.length - 1;
      if (elapsed < start - 1e-8) {
        applyHoldPose(aseg);
        applied = true;
        break;
      }
      const inWin = isLast ? elapsed <= end + 1e-8 : elapsed < end - 1e-8;
      if (!inWin) continue;
      const apc = as._animPivotCache;
      const span = Math.max(end - start, animDur, 1e-8);
      if (animDur <= 1e-8) {
        applyEndPose(as);
      } else {
        const aAnimT = (elapsed - start) / span;
        const aep2 = applyEasingInline(Math.min(1, Math.max(0, aAnimT)), as.easing || animEasing.value);
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
    if (!applied) applyEndPose(csegs[csegs.length - 1]);
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

  function ensureModelLoaders() {
    if (!gltfLoader) {
      gltfLoader = new GLTFLoader();
    }
    if (!dracoLoader) {
      dracoLoader = new DRACOLoader();
      dracoLoader.setDecoderPath(dracoDecoderPath());
    }
    gltfLoader.setDRACOLoader(dracoLoader);
    gltfLoader.setMeshoptDecoder(MeshoptDecoder);
  }

  async function loadGLB(m: Model) {
    const url = resolveModelLoadUrl(m);
    if (!url) return;
    if (meshes.has(m.id)) return;
    if (!(await ensureSceneReady())) {
      console.error("Failed to load GLB model:", m.name || m.id, "3D scene is not ready");
      return;
    }
    ensureModelLoaders();
    // 仅合并「同一模型」的并发加载；同 URL 不同 modelId 必须各自实例化场景图
    const inflightKey = `${m.id}::${url}`;
    const cached = getCachedGlbLoad<boolean>(inflightKey);
    if (cached) {
      const ok = await cached;
      if (ok && meshes.has(m.id)) return;
      clearGlbUrlCache(inflightKey);
    }
    if (!editorAlive || meshes.has(m.id)) return;
    const session = editorSessionGen;
    const endSpan = beginPlaybackDiagSpan("sample", "loadGLB", { modelId: m.id, url });
    const run = new Promise<boolean>(resolve => {
      gltfLoader.load(
        url,
        gltf => {
          try {
            if (session !== editorSessionGen || !editorAlive || !isEditorSceneReady()) {
              clearGlbUrlCache(inflightKey);
              resolve(false);
              return;
            }
            onGLTFLoaded(m, gltf);
            requestViewportRender();
            resolve(meshes.has(m.id));
          } catch (err) {
            console.error("Failed to load GLB model:", m.name || m.id, err);
            clearGlbUrlCache(inflightKey);
            resolve(false);
          } finally {
            endSpan();
          }
        },
        undefined,
        err => {
          console.error("Failed to load GLB model:", m.name || m.id, err);
          clearGlbUrlCache(inflightKey);
          endSpan();
          resolve(false);
        }
      );
    });
    setCachedGlbLoad(inflightKey, run);
    const ok = await run;
    if (!ok) clearGlbUrlCache(inflightKey);
  }

  async function loadGLBFromArrayBuffer(m: Model, buffer: ArrayBuffer) {
    if (!(await ensureSceneReady())) return;
    ensureModelLoaders();
    const session = editorSessionGen;
    return new Promise<void>(resolve => {
      gltfLoader.parse(
        buffer,
        "",
        gltf => {
          try {
            if (session !== editorSessionGen || !editorAlive || !isEditorSceneReady()) {
              resolve();
              return;
            }
            onGLTFLoaded(m, gltf);
          } catch (err) {
            console.error("Failed to parse GLB model:", m.name || m.id, err);
          }
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
    scene?.remove(o);
    disposeObject3D(o);
    meshes.delete(mid);
    invalidateSceneModelCenterCache();
    invalidatePickMeshCache();
    updateAoSceneCoverage();
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
    // 大层级列表 hover 只更新 CSS 态，不重建 outline（避免 100+ 节点卡顿）
    const nodeCount = getHierarchyDisplayIdMap(modelId).size;
    if (nodeCount > 64) {
      hoverModelId.value = modelId;
      hoverModelNodeId.value = nodeId ? resolveSelectedNodeId(modelId, nodeId) : null;
      return;
    }
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
    const display = getHierarchyDisplayIdMap(modelId).get(hoverModelNodeId.value);
    return display === nodeId;
  }

  function isModelNodeSelected(modelId: string, nodeId: string): boolean {
    if (selModelId.value !== modelId || !selModelNodeId.value) return false;
    if (selModelNodeId.value === nodeId) return true;
    const display = getHierarchyDisplayIdMap(modelId).get(selModelNodeId.value);
    if (display === nodeId) return true;
    const node = findHierarchyNode(getModelHierarchy(modelId), nodeId);
    return !!node?.mergedNodeIds?.includes(selModelNodeId.value);
  }

  /** 视口点选后展开右侧模型树祖先并滚到选中项 */
  const modelTreeForceExpandIds = ref<Set<string>>(new Set());
  const modelTreeExpandRevision = ref(0);

  function isModelTreeNodeForceExpanded(nodeId: string): boolean {
    return modelTreeForceExpandIds.value.has(nodeId);
  }

  function revealModelTreeSelection(modelId?: string | null, nodeId?: string | null) {
    rightTab.value = "model";
    const mid = modelId ?? selModelId.value;
    const nid = nodeId !== undefined ? nodeId : selModelNodeId.value;
    if (!mid) {
      scrollSelectedModelIntoView();
      return;
    }
    if (nid) {
      const displayId = resolveSelectedNodeId(mid, nid) || nid;
      const path = findHierarchyPathIds(getModelHierarchy(mid), displayId);
      if (path.length) {
        const next = new Set(modelTreeForceExpandIds.value);
        // 展开祖先（不含叶节点自身也可展开，便于继续浏览子级）
        for (let i = 0; i < path.length; i++) next.add(path[i]);
        modelTreeForceExpandIds.value = next;
        modelTreeExpandRevision.value++;
      }
    }
    scrollSelectedModelIntoView();
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

  function syncTransformVisualOverlays(modelIds?: Iterable<string>) {
    syncVisualOverlayTransforms(modelIds);
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
      // 等树展开后再滚；再下一帧确保 v-show 布局完成
      requestAnimationFrame(() => {
        document
          .querySelector(".model-tree-node.selected, .model-card.selected")
          ?.scrollIntoView({ block: "nearest", behavior: "smooth" });
      });
    });
  }

  function pickModelAtViewport(
    clientX: number,
    clientY: number,
    mods?: { shiftKey?: boolean; ctrlKey?: boolean; metaKey?: boolean }
  ): boolean {
    if (viewOnly.value || isPreviewMode.value) return false;
    controls?.update();
    const target = raycastModelTarget(clientX, clientY);
    if (!target) return false;
    const model = models.value.find(m => m.id === target.modelId);
    if (!model) return false;
    clearHoverTarget();
    if (
      handleClipModelInteraction(target.modelId, target.nodeId, {
        shiftKey: mods?.shiftKey,
        ctrlKey: mods?.ctrlKey,
        metaKey: mods?.metaKey,
        focusCamera: true
      })
    ) {
      revealModelTreeSelection(target.modelId, selModelNodeId.value ?? target.nodeId);
      return true;
    }
    selectModel(model, { focusCamera: true, nodeId: target.nodeId, skipClipHook: true });
    revealModelTreeSelection(model.id, selModelNodeId.value ?? target.nodeId);
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
    if (!video) return Math.max(0, time);
    const mediaDur = Number.isFinite(video.duration) && video.duration > 0 ? video.duration : 0;
    const storedDur = Number(duration.value) || 0;
    const reloading = video.dataset.editorReloading === "1";
    // 换源瞬间 HTMLVideoElement.duration 仍是上一条视频，不能用它把目标时间夹死
    const maxTime =
      reloading && storedDur > mediaDur + 0.25
        ? storedDur
        : mediaDur > 0
          ? mediaDur
          : storedDur;
    if (!(maxTime > 0)) return Math.max(0, time);
    return Math.max(0, Math.min(time, maxTime));
  }

  function getVideoSeekEnd(video: HTMLVideoElement) {
    if (video.seekable.length > 0) return video.seekable.end(video.seekable.length - 1);
    if (video.buffered.length > 0) return video.buffered.end(video.buffered.length - 1);
    return 0;
  }

  async function waitUntilSeekable(_video: HTMLVideoElement, _target: number) {
    return;
  }

  function isSeekNearTarget(video: HTMLVideoElement, target: number) {
    // 移动端解码/缓冲常有更大误差，过严会把已成功的 seek 判失败，随后又从 0 继续播。
    // 桌面端必须精确回到章节起点；沿用章节命中容差会把 0.6s 误判为已到 0s。
    const eps = isCoarsePointerDevice() ? 0.35 : Math.min(CHAPTER_TIME_EPS, 0.12);
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
    const videoNode = activeVideoNode.value;
    const expectedSourceKey = videoNode?.videoSrc
      ? normalizePresentationVideoSrcKey(
          isTransientMediaUrl(videoNode.videoSrc)
            ? unwrapTransientMediaUrl(videoNode.videoSrc)
            : videoNode.videoSrc
        )
      : "";
    if (
      !videoNode ||
      v.dataset.editorVideoNodeId !== videoNode.id ||
      Number(v.dataset.editorVideoGeneration || "-1") !== videoSourceGeneration ||
      (expectedSourceKey && v.dataset.editorSrcKey !== expectedSourceKey)
    ) {
      return;
    }
    const metaDuration = Number.isFinite(v.duration) && v.duration > 0 ? v.duration : 0;
    sceneNodeApi.setVideoNodeInfo(
      videoNode,
      videoNode.videoSrc || v.currentSrc || v.src,
      metaDuration,
      v.videoWidth,
      v.videoHeight
    );
    if (currProj.value) {
      currProj.value.videoDuration = metaDuration;
      currProj.value.videoWidth = v.videoWidth;
      currProj.value.videoHeight = v.videoHeight;
    }
    if (metaDuration > 0) duration.value = metaDuration;
    v.loop = resolveEffectiveVideoLoop();
    v.playbackRate = playbackRate.value;
    if (metaDuration > 0) ensureDefaultChapter(metaDuration);
    if (presentationSeekTargetTime != null && metaDuration > 0) {
      const t = Math.max(0, Math.min(presentationSeekTargetTime, metaDuration));
      try {
        v.currentTime = t;
      } catch {
        /* ignore */
      }
    }
    // 避免 captureStream + rAF 检测导致编辑页卡顿；展示时再按需估算
    if (!videoFps.value && metaDuration > 0) videoFps.value = 30;
    maybeUpgradeVideoToSeekableBlob(v);
  }

  function videoSeekLooksBroken(video: HTMLVideoElement) {
    const dur = Number.isFinite(video.duration) ? video.duration : 0;
    if (dur < 1) return false;
    return getVideoSeekEnd(video) < 0.5;
  }

  function maybeUpgradeVideoToSeekableBlob(video: HTMLVideoElement) {
    const original = video.dataset.editorSrc;
    if (!original || original.startsWith("blob:") || original.startsWith("data:")) return;
    if (!videoSeekLooksBroken(video)) {
      prefetchSeekableMedia(original);
      return;
    }
    const key = video.dataset.editorSrcKey;
    const keepT = currentTime.value;
    const keepPlaying = !video.paused && !video.ended;
    void ensureSeekableMediaUrl(original).then(blobUrl => {
      if (!blobUrl) return;
      const v = videoEl.value;
      if (!v || v !== video) return;
      if (v.dataset.editorSrcKey !== key) return;
      if ((v.currentSrc || v.src || "").startsWith("blob:")) return;
      try {
        v.src = blobUrl;
      } catch {
        return;
      }
      const restore = () => {
        try {
          v.currentTime = keepT;
        } catch {
          /* ignore */
        }
        if (keepPlaying) void v.play().catch(() => {});
      };
      if (v.readyState >= HTMLMediaElement.HAVE_METADATA) restore();
      else v.addEventListener("loadedmetadata", restore, { once: true });
    });
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
    return fillScale(i);
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
    video.muted = videoIsMuted.value;
    video.volume = 1;
  }

  function resolveEffectiveVideoLoop() {
    // 与预览一致：不用原生 loop。编辑开启循环时由 onVideoEnd 回到 0 续播，位移跟 currentTime。
    return false;
  }

  function clearVideoElementSrc(options?: { silent?: boolean }) {
    videoSourceGeneration++;
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
      delete video.dataset.editorVideoNodeId;
      delete video.dataset.editorVideoGeneration;
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
        if (activeVideoId.value) video.dataset.editorVideoNodeId = activeVideoId.value;
        video.dataset.editorVideoGeneration = String(videoSourceGeneration);
        const key = normalizePresentationVideoSrcKey(live);
        if (isVideoElementBoundToKey(video, key)) {
          video.loop = resolveEffectiveVideoLoop();
          video.playbackRate = playbackRate.value;
          syncVideoAudioState();
          delete video.dataset.editorReloading;
          return "reused";
        }
        ignoreVideoErrorUntil = 0;
        video.dataset.editorSrc = live;
        video.dataset.editorSrcKey = key;
        video.preload = "auto";
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
    const cachedSeekable = peekSeekableMediaUrl(url);
    prefetchSeekableMedia(url);
    const resolvedUrl =
      cachedSeekable ||
      (presentation && isCoarsePointerDevice() ? url : isCoarsePointerDevice() ? withVideoPosterFragment(url) : url);
    const key = normalizePresentationVideoSrcKey(url);
    const apply = (): "missing" | "reused" | "rebound" => {
      if (!videoEl.value) return "missing";
      const video = videoEl.value;
      video.dataset.editorVideoGeneration = String(videoSourceGeneration);
      // 同节点 / 同源：只要已挂载该 key 就绝不改 src / load()（seek 中 readyState 掉档也不重载）
      if (isVideoElementBoundToKey(video, key)) {
        if (!video.dataset.editorSrcKey) video.dataset.editorSrcKey = key;
        if (!video.dataset.editorSrc) video.dataset.editorSrc = url;
        if (activeVideoId.value) video.dataset.editorVideoNodeId = activeVideoId.value;
        delete video.dataset.editorReloading;
        video.loop = resolveEffectiveVideoLoop();
        video.playbackRate = playbackRate.value;
        syncVideoAudioState();
        return "reused";
      }
      if (activeVideoId.value) video.dataset.editorVideoNodeId = activeVideoId.value;
      // 换源瞬间可能触发 error，短暂忽略
      ignoreVideoErrorUntil = performance.now() + 400;
      video.dataset.editorSrc = url;
      video.dataset.editorSrcKey = key;
      video.preload = "auto";
      video.src = resolvedUrl;
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
      // 已赋值 src：浏览器会自行拉流。再 load() 会重置解码器，跨视频首切常多出 100ms+。
      return "rebound";
    };
    const result = apply();
    if (result === "missing") {
      nextTick(() => apply());
      return true;
    }
    // 仅真实换源后 idle 预热其它视频；同节点复用不抢带宽
    if (result === "rebound") {
      try {
        const others = getVideoNodes(nodes.value)
          .filter(vnode => vnode.videoSrc && vnode.id !== activeVideoId.value)
          .filter(vnode => !isTransientMediaUrl(vnode.videoSrc!))
          .map(vnode => resolveAssetUrl(vnode.videoSrc!) || vnode.videoSrc!);
        scheduleWarmVideoSrcs(others);
      } catch {
        /* ignore */
      }
    }
    markPlaybackDiag("switchVideo", result, { url, activeVideoId: activeVideoId.value });
    return result === "rebound";
  }

  /** 元素是否已绑定到目标 key 且可直接 seek（不需重新 load） */
  function isVideoElementBoundToKey(
    video: HTMLVideoElement,
    key: string,
    allowWithoutSrcAttr = false
  ): boolean {
    if (video.error) return false;
    const currentKey =
      video.dataset.editorSrcKey ||
      (video.dataset.editorSrc ? normalizePresentationVideoSrcKey(video.dataset.editorSrc) : "");
    const currentSrcKey = video.currentSrc
      ? normalizePresentationVideoSrcKey(video.currentSrc)
      : video.src
        ? normalizePresentationVideoSrcKey(video.src)
        : "";
    const keyMatch = currentKey === key || currentSrcKey === key;
    if (!keyMatch) return false;
    // 同源已挂载：即使 seek 中 readyState 短暂掉档，也禁止再次 load()
    if (video.dataset.editorSrcKey === key && (video.getAttribute("src") || video.currentSrc)) {
      return true;
    }
    // 首次完成绑定前仍需 metadata
    if (video.readyState < HTMLMediaElement.HAVE_METADATA) return false;
    if (allowWithoutSrcAttr) return true;
    return !!(video.getAttribute("src") || video.currentSrc);
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
    requestViewportRender();
    unlockVideoAudio();
    const video = videoEl.value;
    if (viewOnly.value || isPreviewMode.value) {
      if (!video) return;
      // 以真实 media 为准：seeking 阶段 displayPlaying 也会为 true，再点播放会被当成暂停。
      const pauseRequested = !video.paused && presentationPlaybackSession.intent === "play";
      let targetTime = presentationDisplayTime.value;
      const atMediaEnd =
        presentationPlaybackSession.phase === "ended" ||
        video.ended ||
        isPresentationAtMediaEnd(video);
      // 片尾再播：从视频 0 重来，与编辑态一致（不要跳到第一章起点而跳过片头空隙）。
      if (!pauseRequested && atMediaEnd) {
        targetTime = 0;
      }
      commandPresentationPlayback({
        targetTime,
        intent: pauseRequested ? "pause" : "play",
        navChapter: getStrictPresentationChapterAtTime(targetTime),
        autoAdvance: false
      });
      return;
    }
    const videoReady = !!(video && (video.src || video.currentSrc));
    if (!video || !videoReady) {
      if (totalPlaying.value && chAnimWallclock) {
        stopChapterAnimation();
        return;
      }
      const clipChapter = selectedChapter.value || timelineChapters.value[0] || null;
      if (clipChapter) playChapterClipsWallclock(clipChapter);
      return;
    }
    if (chAnimWallclock || totalPlaying.value) {
      stopChapterAnimation();
    }
    if (video.paused || video.ended) {
      // 用户点播放：清掉残留 seek 锁，否则进度条/动画组件会一直不动
      clearPlaybackSeekLocks();
      playbackCameraUserOverride = false;
      isPlaying.value = true;
      chapterPlayTarget.value = null;
      setVideoChapterSyncPaused(true);
      if (video.ended || video.currentTime >= Math.max((duration.value || video.duration || 0) - CHAPTER_END_EPS, 0)) {
        try {
          video.currentTime = 0;
          currentTime.value = 0;
        } catch {
          currentTime.value = 0;
        }
      }
      void video.play().catch(() => {
        isPlaying.value = false;
        void waitForVideoReady().then(ok => {
          if (!ok || !videoEl.value) return;
          isPlaying.value = true;
          void videoEl.value.play().catch(() => {
            isPlaying.value = false;
          });
        });
      }).finally(() => {
        setVideoChapterSyncPaused(false);
      });
    } else {
      isPlaying.value = false;
      video.pause();
      chapterPlayTarget.value = null;
      stopChapterAnimation();
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
      if (ch) {
        buildChapterPlaybackCacheFromClips(ch);
        const elapsed = getChapterAnimElapsed(ch, video.currentTime);
        clipPlayCameraOrigin = resolvePlaybackCameraFrom(ch, elapsed);
        applyClipCameraAtElapsed(ch, elapsed);
        if (chapterHasAnimation(ch) || chapterHasAnyModelEdits(ch)) {
          ensureVideoSyncedChapterAnimation();
        }
        syncClipProgressFromVideoTime(video.currentTime);
      }
    } else if (ch && chapterHasAnimation(ch)) {
      buildChapterPlaybackCacheFromClips(ch);
      const elapsed = getChapterAnimElapsed(ch, video.currentTime);
      clipPlayCameraOrigin = resolvePlaybackCameraFrom(ch, elapsed);
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

  /**
   * 修复「相对 0 被当绝对投影 → normalize 成 -rest」或「绝对 rest 写进相对字段」导致的位置污染。
   * 仅在数值几乎等于 ±rest 时纠正为 0，避免误伤真实位移关键帧。
   */
  function healCorruptedRelativeAnimPos(obj: THREE.Object3D | null, pos: number[] | undefined): [number, number, number] {
    const src = [...(pos || [0, 0, 0])] as [number, number, number];
    if (!obj || !usesRelativeAnimRotation(obj)) {
      return src.map(n => roundAnimNum(n)) as [number, number, number];
    }
    const rest = getRestLocalPosForObject(obj);
    const restMag = Math.abs(rest[0]) + Math.abs(rest[1]) + Math.abs(rest[2]);
    if (restMag < 0.05) return src.map(n => roundAnimNum(n)) as [number, number, number];
    const near = (a: number[], b: number[]) => a.every((v, i) => Math.abs(v - b[i]) <= 0.05);
    if (near(src, rest.map(v => -v)) || near(src, rest)) {
      return [0, 0, 0];
    }
    return src.map(n => roundAnimNum(n)) as [number, number, number];
  }

  function healClipTargetRelativeTransforms(target: AnimationClipTarget) {
    const obj = getTransformTarget(target.modelId, target.nodeId ?? null);
    if (!obj || !usesRelativeAnimRotation(obj)) return;
    target.startPos = healCorruptedRelativeAnimPos(obj, target.startPos);
    target.endPos = healCorruptedRelativeAnimPos(obj, target.endPos);
  }

  function healLiveSegmentRelativeTransforms(
    model: Model,
    nodeId: string | null,
    seg: any
  ) {
    const obj = getTransformTarget(model.id, nodeId);
    if (!obj || !usesRelativeAnimRotation(obj) || !seg) return;
    seg.startPos = healCorruptedRelativeAnimPos(obj, seg.startPos);
    seg.endPos = healCorruptedRelativeAnimPos(obj, seg.endPos);
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

  function createDefaultAnimSegment(
    model?: Model | null,
    nodeId?: string | null,
    animTimeSec?: number
  ) {
    const m = model ?? selModel.value;
    const nid = nodeId !== undefined ? nodeId : selModelNodeId.value;
    const animTime = animTimeSec ?? resolveDefaultSegmentAnimTime();
    const { pos, scale, rot } = m
      ? getDefaultTransformForAnimTarget(m, nid)
      : { pos: [...DEFAULT_MODEL_BASE_POSITION], scale: 1, rot: [0, 0, 0] };
    const clipVisual =
      activeAnimClipId.value
        ? createDefaultClipVisual()
        : m && selModel.value?.id === m.id && (nid ?? null) === (selModelNodeId.value ?? null)
          ? clipVisualFromModelForm()
          : createDefaultClipVisual();
    return {
      id: nextAnimSegmentId(),
      pauseTime: 0,
      animTime,
      start: 0,
      end: animTime,
      easing: "easeInOut",
      pivot: "center",
      startPos: [...pos],
      endPos: [...pos],
      startScale: scale,
      endScale: scale,
      startRot: [...rot],
      endRot: [...rot],
      clipVisual,
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

  /** 保证至少一段，并同步绝对时间；允许多段 */
  function ensureAnimSegments(model?: Model | null) {
    if (animSegments.length === 0) {
      animSegments.push(createDefaultAnimSegment(model));
    }
    annotateSegmentsAbsoluteTimes(animSegments);
    const seg = animSegments[0];
    if (seg && !seg._expandedPanels) seg._expandedPanels = ["start", "end"];
    bindAnimSegmentsToSelection(model?.id ?? selModelId.value, selModelNodeId.value, selectedChapterId.value);
    recalcAnimDuration();
  }

  function resolvePlaybackSegments(segments: any[]) {
    return segments?.length ? segments : [];
  }

  function markAnimDirty() {
    animDirty.value = true;
    if (activeAnimClipId.value && !clipAutoCommitSuppressed) {
      scheduleLiveClipBatch();
    }
  }

  /** 片段编辑加载中：禁止误触发「已改入列表」 */
  let clipAutoCommitSuppressed = false;
  function withClipAutoCommitSuppressed(fn: () => void) {
    clipAutoCommitSuppressed = true;
    try {
      fn();
    } finally {
      requestAnimationFrame(() => {
        clipAutoCommitSuppressed = false;
        animDirty.value = false;
      });
    }
  }

  /** 离开片段/切选前：把当前编辑器状态写入 ch.clips（源数据），避免切走再回来丢失 */
  function persistActiveClipEditorState() {
    flushPendingClipIntro();
    flushPendingClipVisual();
    if (!activeAnimClipId.value) return;
    if (clipAutoCommitSuppressed) return;
    const clip = getActiveAnimationClip();
    const ch = selectedChapter.value;
    if (!clip || !ch) return;

    let wrote = false;
    if (selModel.value && animSegments.length && animSegmentsBelongToChapter(selectedChapterId.value)) {
      const modelId = selModel.value.id;
      const nodeId = selModelNodeId.value;
      healLiveSegmentRelativeTransforms(selModel.value, nodeId, animSegments[0]);
      const key = normalizeClipNodeKey(modelId, nodeId);
      const idx = clip.targets.findIndex(
        t => normalizeClipNodeKey(t.modelId, t.nodeId ?? null) === key
      );
      const hasEdits = clipLiveHasUserEdits(selModel.value, nodeId);
      const multi = resolveClipPreviewKeys().length > 1;

      if (multi && (animDirty.value || hasEdits)) {
        commitTransformToClipSelection();
        if (animSegments[0]?.clipVisual) {
          commitClipVisualToSelection(serializeClipVisual(animSegments[0].clipVisual));
        }
        wrote = true;
      } else if (hasEdits || animDirty.value) {
        const target = liveSegmentToTarget(modelId, nodeId, animSegments[0]);
        if (idx >= 0) {
          clip.targets[idx] = target;
        } else {
          clip.targets.push(target);
        }
        wrote = true;
        clipDraftTargetKey.value = null;
        if (!activeClipTargetKeys.value.includes(key)) {
          activeClipTargetKeys.value = [...activeClipTargetKeys.value, key];
        }
        activeClipTargetKey.value = key;
      }
    }

    if (!wrote) return;
    ch.updatedAt = new Date().toISOString();
    bumpAnimClipListRevision();
  }

  /** 切换选中前：把当前片段编辑落盘到 ch.clips */
  function flushCurrentClipEditBeforeSwitch() {
    if (!activeAnimClipId.value) return;
    if (clipAutoCommitSuppressed) return;
    persistActiveClipEditorState();
    clipDraftTargetKey.value = null;
  }

  /** 片段语境下：只认位姿/外观改动，忽略由片段窗长带来的 animTime≠3 */
  function clipLiveHasUserEdits(model: Model, nodeId: string | null): boolean {
    if (!animSegments.length) return false;
    return animSegments.some(seg => {
      if (animSegmentDiffersFromDefault(seg, model, nodeId)) return true;
      if ((seg.easing ?? "easeInOut") !== "easeInOut") return true;
      if ((seg.pivot ?? "center") !== "center") return true;
      const vis = serializeClipVisual(seg.clipVisual);
      const defVis = createDefaultClipVisual();
      if (
        vis.visible !== defVis.visible ||
        vis.outline !== defVis.outline ||
        vis.wireframe !== defVis.wireframe ||
        vis.highlight !== defVis.highlight ||
        vis.outlineColor !== defVis.outlineColor ||
        vis.wireframeColor !== defVis.wireframeColor ||
        vis.modelHighlightColor !== defVis.modelHighlightColor ||
        (vis.intro || "") !== (defVis.intro || "")
      ) {
        return true;
      }
      return false;
    });
  }

  function resetAnimConfig() {
    if (!selModel.value) return;
    animSegments.splice(0, animSegments.length, createDefaultAnimSegment(selModel.value));
    annotateSegmentsAbsoluteTimes(animSegments);
    animDuration.value = 3;
    animEasing.value = "easeInOut";
    animDirty.value = true;
    modelFormRevision.value++;
    editingSeg.value = animSegments[0] ?? null;
    editingSegMode.value = "start";
    if (animSegments[0]) focusSegTransform(animSegments[0], "start");
    bumpAnimSegmentRevision();
  }

  function recalcAnimDuration() {
    const total = calcSegmentsTotalDuration(animSegments);
    if (total > 0) animDuration.value = total;
  }

  /** 用绝对 start/end 重算 pause 链；失败则 toast 并返回 false */
  function commitAnimClipAbsoluteTimes(opts?: { silent?: boolean }): boolean {
    const result = syncPauseChainFromAbsoluteTimes(animSegments as any[]);
    if (!result.ok) {
      if (!opts?.silent) toastShow(result.error || "片段时间无效", "warning");
      annotateSegmentsAbsoluteTimes(animSegments);
      return false;
    }
    recalcAnimDuration();
    return true;
  }

  function addAnimSegment() {
    if (!selModel.value) return;
    if (totalPlaying.value || animSegments.some(s => s._playing)) return;
    if (!commitAnimClipAbsoluteTimes({ silent: true })) {
      annotateSegmentsAbsoluteTimes(animSegments);
    }
    const last = animSegments[animSegments.length - 1];
    const start = last ? roundAnimNum(last.end ?? calcSegmentsTotalDuration(animSegments)) : 0;
    const seg = createDefaultAnimSegment(selModel.value);
    if (last) {
      seg.startPos = [...(last.endPos || seg.startPos)];
      seg.endPos = [...(last.endPos || seg.endPos)];
      seg.startRot = [...(last.endRot || seg.startRot)];
      seg.endRot = [...(last.endRot || seg.endRot)];
      seg.startScale = last.endScale ?? seg.startScale;
      seg.endScale = last.endScale ?? seg.endScale;
      seg.pivot = last.pivot || seg.pivot;
      seg.easing = last.easing || seg.easing;
      seg.clipVisual = cloneClipVisual(last.clipVisual);
    }
    seg.pauseTime = 0;
    seg.animTime = 1;
    seg.start = start;
    seg.end = roundAnimNum(start + 1);
    animSegments.push(seg);
    if (!commitAnimClipAbsoluteTimes()) {
      animSegments.pop();
      annotateSegmentsAbsoluteTimes(animSegments);
      return;
    }
    editingSeg.value = seg;
    editingSegMode.value = "start";
    markAnimDirty();
    bumpAnimSegmentRevision();
  }

  function removeAnimSegment(segId: string) {
    if (animSegments.length <= 1) {
      toastShow("至少保留一个片段", "warning");
      return;
    }
    if (totalPlaying.value || animSegments.some(s => s._playing)) return;
    const idx = animSegments.findIndex(s => s.id === segId);
    if (idx < 0) return;
    const removed = animSegments[idx];
    animSegments.splice(idx, 1);
    annotateSegmentsAbsoluteTimes(animSegments);
    commitAnimClipAbsoluteTimes({ silent: true });
    if (editingSeg.value?.id === removed.id) {
      editingSeg.value = animSegments[Math.min(idx, animSegments.length - 1)] ?? null;
      editingSegMode.value = "start";
    }
    markAnimDirty();
    bumpAnimSegmentRevision();
  }

  function moveAnimSegment(segId: string, dir: -1 | 1) {
    if (totalPlaying.value || animSegments.some(s => s._playing)) return;
    const idx = animSegments.findIndex(s => s.id === segId);
    const j = idx + dir;
    if (idx < 0 || j < 0 || j >= animSegments.length) return;
    const tmp = animSegments[idx];
    animSegments[idx] = animSegments[j];
    animSegments[j] = tmp;
    // 按新顺序重排：保留各段时长，从 0 起顺序铺开（间隙可再用开始时间调）
    let t = 0;
    for (const seg of animSegments) {
      const dur = Math.max(
        0.1,
        typeof seg.animTime === "number"
          ? seg.animTime
          : roundAnimNum((seg.end ?? 0) - (seg.start ?? 0)) || 1
      );
      seg.start = t;
      seg.end = roundAnimNum(t + dur);
      t = seg.end as number;
    }
    if (!commitAnimClipAbsoluteTimes()) {
      annotateSegmentsAbsoluteTimes(animSegments);
      return;
    }
    markAnimDirty();
    bumpAnimSegmentRevision();
  }

  function onAnimClipTimeChange(seg: any, field: "start" | "end", value: number) {
    if (!seg) return;
    const v = roundAnimNum(Math.max(0, value));
    if (field === "start") {
      seg.start = v;
      if ((seg.end ?? 0) < v + 0.1) seg.end = roundAnimNum(v + 0.1);
    } else {
      const start = seg.start ?? 0;
      seg.end = Math.max(roundAnimNum(start + 0.1), v);
    }
    if (!commitAnimClipAbsoluteTimes()) return;
    markAnimDirty();
  }

  function ensureSegClipVisual(seg: any): ClipVisualState {
    if (!seg.clipVisual) seg.clipVisual = createDefaultClipVisual();
    return seg.clipVisual as ClipVisualState;
  }

  function resolveClipPreviewKeys(): string[] {
    if (activeClipTargetKeys.value.length) return [...activeClipTargetKeys.value];
    if (activeClipTargetKey.value) return [activeClipTargetKey.value];
    if (selModel.value) return [normalizeClipNodeKey(selModel.value.id, selModelNodeId.value)];
    return [];
  }

  function parseClipTargetKey(key: string): { modelId: string; nodeId: string | null } {
    const i = key.indexOf("|");
    if (i < 0) return { modelId: key, nodeId: null };
    return { modelId: key.slice(0, i), nodeId: key.slice(i + 1) || null };
  }

  type ClipTransformSnap = {
    pos: [number, number, number];
    rot: [number, number, number];
    scale: number;
  };

  /** 多选变换：记录主目标上一次姿态，用于把增量同步到其余选中项 */
  let clipMultiTransformSnap: ClipTransformSnap | null = null;

  function readSegTransformSnap(seg: any, mode: "start" | "end"): ClipTransformSnap {
    const posKey = mode === "start" ? "startPos" : "endPos";
    const rotKey = mode === "start" ? "startRot" : "endRot";
    const scaleKey = mode === "start" ? "startScale" : "endScale";
    const pos = seg[posKey] || [0, 0, 0];
    const rot = seg[rotKey] || [0, 0, 0];
    return {
      pos: [Number(pos[0] ?? 0), Number(pos[1] ?? 0), Number(pos[2] ?? 0)],
      rot: [Number(rot[0] ?? 0), Number(rot[1] ?? 0), Number(rot[2] ?? 0)],
      scale: Number(seg[scaleKey] ?? 1)
    };
  }

  function resetClipMultiTransformSnap(seg?: any, mode?: "start" | "end") {
    const s = seg ?? editingSeg.value ?? animSegments[0];
    const m = mode ?? editingSegMode.value ?? "start";
    clipMultiTransformSnap = s ? readSegTransformSnap(s, m) : null;
  }

  function addVec3(a: number[], b: number[]): [number, number, number] {
    return [roundAnimNum((a[0] ?? 0) + (b[0] ?? 0)), roundAnimNum((a[1] ?? 0) + (b[1] ?? 0)), roundAnimNum((a[2] ?? 0) + (b[2] ?? 0))];
  }

  function applyDeltaToTargetFields(
    target: AnimationClipTarget,
    mode: "start" | "end",
    delta: ClipTransformSnap
  ) {
    if (mode === "start") {
      target.startPos = addVec3(target.startPos || [0, 0, 0], delta.pos);
      target.startRot = addVec3(target.startRot || [0, 0, 0], delta.rot);
      target.startScale = roundAnimNum((target.startScale ?? 1) + delta.scale);
      target.endPos = addVec3(target.endPos || [0, 0, 0], delta.pos);
      target.endRot = addVec3(target.endRot || [0, 0, 0], delta.rot);
      target.endScale = roundAnimNum((target.endScale ?? 1) + delta.scale);
    } else {
      target.endPos = addVec3(target.endPos || [0, 0, 0], delta.pos);
      target.endRot = addVec3(target.endRot || [0, 0, 0], delta.rot);
      target.endScale = roundAnimNum((target.endScale ?? 1) + delta.scale);
    }
  }

  function targetAsLiveSeg(clip: AnimationClip, target: AnimationClipTarget) {
    return targetToLiveSegment(clip, target);
  }

  /**
   * 同片段内叠加预览：已入轨目标全部保留姿态/外观；
   * 当前主编辑目标用 live 段覆盖。
   * 切片段/空片段时，先把不再属于本片段的目标恢复为章节默认（全显示）。
   */
  let lastClipViewportOverlayKeys: string[] = [];

  function isHeavyClipTargetSet(clip?: AnimationClip | null) {
    const c = clip ?? getActiveAnimationClip();
    const n = Math.max(c?.targets?.length ?? 0, activeClipTargetKeys.value.length);
    return n >= CLIP_HEAVY_TARGET_THRESHOLD;
  }

  function cancelAllPendingVisualRebuilds() {
    visualRebuildGeneration++;
    pendingVisualRebuildOwners.clear();
  }

  function restoreChapterStaticVisualForClipTarget(
    modelId: string,
    nodeId: string | null,
    opts?: { skipOutlineRebuild?: boolean; bindPose?: boolean; forceHidden?: boolean }
  ) {
    const model = models.value.find(m => m.id === modelId);
    if (!model) return;
    const objs = getNodeObjects(modelId, nodeId, true);
    if (!objs.length) return;
    const isRoot = !nodeId;
    const skipOutline = opts?.skipOutlineRebuild === true;
    if (opts?.bindPose) {
      const visualCfg = createDefaultModelConfig();
      if (opts.forceHidden) visualCfg.visible = false;
      for (const obj of objs) {
        delete obj.userData._clipVisualSig;
        resetObject3DTransformToDefault(model, obj, isRoot);
        if (opts.forceHidden) {
          obj.visible = false;
          continue;
        }
        applyModelVisualOnly(model, obj, visualCfg, skipOutline);
      }
      return;
    }
    const ch = selectedChapter.value;
    if (!ch) return;
    const cfg = readModelConfigForTarget(ch, modelId, nodeId);
    const resolved = getModelConfig(cfg);
    // 只用章节静态外观，忽略投影到 animConfig 的其它片段 clipVisual / 起点姿态
    const visualCfg: ModelConfig = {
      ...createDefaultModelConfig(),
      visible: resolved.visible !== false,
      outline: !!resolved.outline,
      wireframe: !!resolved.wireframe,
      highlight: !!resolved.highlight,
      outlineColor: resolved.outlineColor,
      wireframeColor: resolved.wireframeColor,
      modelHighlightColor: resolved.modelHighlightColor,
      intro: resolved.intro ?? "",
      scale: resolved.scale ?? 1,
      posOffset: [
        resolved.posOffset?.[0] ?? 0,
        resolved.posOffset?.[1] ?? 0,
        resolved.posOffset?.[2] ?? 0
      ]
    };
    const def = createDefaultModelConfig();
    const useBindPose =
      Math.abs((visualCfg.scale ?? 1) - (def.scale ?? 1)) < 1e-6 &&
      !(visualCfg.posOffset?.[0] || visualCfg.posOffset?.[1] || visualCfg.posOffset?.[2]);
    for (const obj of objs) {
      delete obj.userData._clipVisualSig;
      if (useBindPose) {
        resetObject3DTransformToDefault(model, obj, isRoot);
      } else {
        applyStaticModelTransform(model, obj, visualCfg, isRoot);
      }
      applyModelVisualOnly(model, obj, visualCfg, skipOutline);
    }
  }

  /** 编辑态：若仍挂着 clips 投影轨，立刻卸掉（含小片段残留），避免扫 modelConfigs 卡死整页 */
  let editModeProjectionClearedChapterId: string | null = null;
  function ensureEditModeWithoutHeavyProjection(ch?: Chapter | null) {
    if (_chAnimLock || chAnimWallclock) return;
    const video = videoEl.value;
    if (video && !video.paused) return;
    const chapter = ch ?? selectedChapter.value;
    if (!chapter?.clips?.length) return;
    if (editModeProjectionClearedChapterId === chapter.id) return;
    sealHeavyClipsInChapter(chapter);
    // 先标记已处理，避免切片段反复扫 nodeConfigs
    editModeProjectionClearedChapterId = chapter.id;
    if (isHeavyClipChapter(chapter) || isHeavyEditNavChapter(chapter)) {
      // 大体量 / 大 GLB：播放与预览走 clips 缓存，清投影会卡死交互
      return;
    }
    suspendProjectPersist();
    try {
      const n = collectChapterProjectedAnimKeys(chapter).length;
      if (n > 0) clearClipProjectedAnimConfigs(chapter);
    } finally {
      resumeProjectPersist();
    }
  }

  function syncActiveClipViewportPreview(opts?: {
    mode?: "start" | "end";
    /** 轻量：只刷主目标/多选 live，不重扫全部已改目标（大体量编辑用） */
    light?: boolean;
    /** 切片段时：把其它片段目标也纳入恢复扫描 */
    fullRestore?: boolean;
  }) {
    ensureEditModeWithoutHeavyProjection();
    const clip = getActiveAnimationClip();
    if (!clip) return;
    const mode = opts?.mode ?? editingSegMode.value ?? "start";
    const heavy = isHeavyClipTargetSet(clip);
    const light = opts?.light === true || (heavy && opts?.fullRestore !== true);
    const skipOutline = heavy || light;
    const liveSegRef = editingSeg.value ?? animSegments[0];
    if (liveSegRef && selModel.value) {
      healLiveSegmentRelativeTransforms(selModel.value, selModelNodeId.value, liveSegRef);
    }
    const primaryKey =
      selModel.value != null ? normalizeClipNodeKey(selModel.value.id, selModelNodeId.value) : null;
    const liveKeys = new Set<string>();
    if (liveSegRef) {
      for (const k of resolveClipPreviewKeys()) liveKeys.add(k);
    } else if (activeClipTargetKeys.value.length) {
      for (const k of activeClipTargetKeys.value) liveKeys.add(k);
    } else if (activeClipTargetKey.value) {
      liveKeys.add(activeClipTargetKey.value);
    }

    const nextOverlayKeys = new Set<string>();
    if (!light) {
      for (const t of clip.targets) {
        nextOverlayKeys.add(normalizeClipNodeKey(t.modelId, t.nodeId ?? null));
      }
    }
    for (const k of liveKeys) nextOverlayKeys.add(k);
    if (primaryKey) nextOverlayKeys.add(primaryKey);

    // 仅恢复「离开叠加集合」的目标；全量章节扫描只在切片段时做（避免每步 O(全片段目标)）
    const restoreKeys = new Set<string>(lastClipViewportOverlayKeys);
    if (opts?.fullRestore) {
      for (const k of collectAllChapterClipTargetKeys(selectedChapter.value)) restoreKeys.add(k);
    }
    // light 下用 Set 判断，避免对每个 restoreKey 做 targets.some（144² 会卡死）
    let lightClipKeySet: Set<string> | null = null;
    if (light && (clip.targets?.length ?? 0) > 0) {
      lightClipKeySet = new Set(
        clip.targets.map(t => normalizeClipNodeKey(t.modelId, t.nodeId ?? null))
      );
    }
    for (const key of restoreKeys) {
      if (nextOverlayKeys.has(key)) continue;
      // light 模式下保留本片段其它已改目标的叠加，勿误恢复
      if (lightClipKeySet?.has(key)) continue;
      const { modelId, nodeId } = parseClipTargetKey(key);
      restoreChapterStaticVisualForClipTarget(modelId, nodeId);
    }

    const applyOne = (
      modelId: string,
      nodeId: string | null,
      seg: any,
      vis: ClipVisualState,
      sigPrefix: string
    ) => {
      const model = models.value.find(m => m.id === modelId);
      if (!model) return;
      applyAnimSegmentTransformToMesh(model, nodeId, seg, mode);
      const objs = getNodeObjects(modelId, nodeId, true);
      if (!objs.length) return;
      applyClipVisualToObjects(model, objs, vis, `${sigPrefix}:${clip.id}`, skipOutline);
    };

    if (light) {
      // 大体量：只预览主目标 + 当前多选 live，数据已写入 clips.targets
      if (liveSegRef && primaryKey && selModel.value) {
        applyOne(
          selModel.value.id,
          selModelNodeId.value,
          liveSegRef,
          ensureSegClipVisual(liveSegRef),
          "live"
        );
      }
      // 多选其余项：仅在有限数量时同步姿态，避免 144 次 mesh 写入
      if (liveSegRef && liveKeys.size > 1 && liveKeys.size < CLIP_HEAVY_TARGET_THRESHOLD) {
        for (const key of liveKeys) {
          if (key === primaryKey) continue;
          const { modelId, nodeId } = parseClipTargetKey(key);
          const t = findClipTarget(clip, modelId, nodeId);
          const seg = t ? targetAsLiveSeg(clip, t) : liveSegRef;
          const vis = t?.clipVisual
            ? serializeClipVisual(t.clipVisual)
            : ensureSegClipVisual(liveSegRef);
          applyOne(modelId, nodeId, seg, vis, "sel");
        }
      }
    } else {
      for (const t of clip.targets) {
        const key = normalizeClipNodeKey(t.modelId, t.nodeId ?? null);
        const model = models.value.find(m => m.id === t.modelId);
        if (!model) continue;
        healClipTargetRelativeTransforms(t);
        const useLive = !!(primaryKey && key === primaryKey && liveSegRef);
        const seg = useLive ? liveSegRef : targetAsLiveSeg(clip, t);
        if (!useLive) healLiveSegmentRelativeTransforms(model, t.nodeId ?? null, seg);
        const vis = useLive
          ? ensureSegClipVisual(liveSegRef)
          : serializeClipVisual(t.clipVisual ?? createDefaultClipVisual());
        applyOne(t.modelId, t.nodeId ?? null, seg, vis, useLive ? "live" : "clip");
      }

      if (liveSegRef && primaryKey && liveKeys.has(primaryKey)) {
        const inClip = clip.targets.some(
          t => normalizeClipNodeKey(t.modelId, t.nodeId ?? null) === primaryKey
        );
        if (!inClip && selModel.value) {
          applyOne(
            selModel.value.id,
            selModelNodeId.value,
            liveSegRef,
            ensureSegClipVisual(liveSegRef),
            "draft"
          );
        }
      }
    }

    // light：合并保留旧叠加 key，避免其它已改目标被下一帧误恢复
    if (light) {
      const merged = new Set(lastClipViewportOverlayKeys);
      for (const k of nextOverlayKeys) merged.add(k);
      lastClipViewportOverlayKeys = [...merged];
    } else {
      lastClipViewportOverlayKeys = [...nextOverlayKeys];
    }
    syncTransformVisualOverlays(selModel.value ? [selModel.value.id] : undefined);
  }

  /** 将外观预览到当前多选，并叠加同片段其他已改目标 */
  function previewAnimClipVisual(seg?: any) {
    if (seg) {
      editingSeg.value = seg;
      ensureSegClipVisual(seg);
    }
    syncActiveClipViewportPreview({
      mode: editingSegMode.value || "start",
      light: isHeavyClipTargetSet()
    });
  }

  /**
   * 外观变更：同步写入当前多选全部模型，并保留片段内其他已改目标的叠加效果
   */
  function commitClipVisualToSelection(
    visual: ClipVisualState,
    opts?: { skipPrimaryMesh?: boolean; skipMesh?: boolean }
  ) {
    const clip = getActiveAnimationClip();
    if (!clip || clipAutoCommitSuppressed) return;
    const keys = resolveClipPreviewKeys();
    if (!keys.length) return;
    const vis = serializeClipVisual(visual);
    const multi = keys.length > 1;

    // 先确保 live 段外观与开关一致，避免主目标回写旧值
    if (animSegments[0]) {
      animSegments[0].clipVisual = cloneClipVisual(vis);
      ensureSegClipVisual(animSegments[0]);
    }

    const modelIndex = new Map(models.value.map(m => [m.id, m]));
    const targetIndex = new Map<string, number>();
    for (let i = 0; i < clip.targets.length; i++) {
      const t = clip.targets[i];
      targetIndex.set(normalizeClipNodeKey(t.modelId, t.nodeId ?? null), i);
    }
    const selectedKeySet = new Set(activeClipTargetKeys.value);
    const pendingAdds: AnimationClipTarget[] = [];
    let membershipChanged = false;

    for (const key of keys) {
      const parsed = parseClipTargetKey(key);
      const modelId = parsed.modelId;
      const nodeId = resolveClipTargetNodeId(modelId, parsed.nodeId);
      const model = modelIndex.get(modelId);
      if (!model) continue;
      const normKey = normalizeClipNodeKey(modelId, nodeId);
      const idx = targetIndex.get(normKey);
      const isPrimary =
        !!selModel.value &&
        normalizeClipNodeKey(selModel.value.id, selModelNodeId.value) === normKey;

      if (idx != null && idx >= 0) {
        const cur = clip.targets[idx];
        if (isPrimary && animSegments[0]) {
          clip.targets[idx] = liveSegmentToTarget(modelId, nodeId, animSegments[0]);
          clip.targets[idx].nodeId = nodeId;
          clip.targets[idx].clipVisual = cloneClipVisual(vis);
        } else {
          cur.nodeId = nodeId;
          cur.clipVisual = cloneClipVisual(vis);
        }
      } else if (isPrimary && animSegments[0]) {
        const t = liveSegmentToTarget(modelId, nodeId, animSegments[0]);
        t.nodeId = nodeId;
        t.clipVisual = cloneClipVisual(vis);
        pendingAdds.push(t);
        targetIndex.set(normKey, clip.targets.length + pendingAdds.length - 1);
        membershipChanged = true;
      } else {
        const { pos, scale, rot } = getDefaultTransformForAnimTarget(model, nodeId);
        pendingAdds.push(createEmptyClipTarget(modelId, nodeId, { pos, scale, rot }, vis));
        membershipChanged = true;
      }

      if (!selectedKeySet.has(normKey)) {
        selectedKeySet.add(normKey);
        membershipChanged = true;
      }
    }

    if (pendingAdds.length) {
      clip.targets.push(...pendingAdds);
      if (clip.targets.length >= CLIP_HEAVY_TARGET_THRESHOLD) sealHeavyClipTargets(clip, true);
    }

    if (!opts?.skipMesh) {
      if (multi) {
        applySelectionClipVisualFast(vis);
      } else if (!opts?.skipPrimaryMesh) {
        const model = selModel.value;
        if (model) {
          const nodeId = selModelNodeId.value;
          const objs = getNodeObjects(model.id, nodeId, true);
          if (objs.length) {
            applyClipVisualToObjects(
              model,
              objs,
              vis,
              `clip-commit:${normalizeClipNodeKey(model.id, nodeId)}`
            );
          }
        }
      }
    }

    if (membershipChanged) dedupeClipTargets(clip);
    clipDraftTargetKey.value = null;
    if (membershipChanged) {
      activeClipTargetKeys.value = [...selectedKeySet];
      bumpAnimClipListRevision();
    }
  }

  /** 多选外观：每个模型只改自己的 mesh，整棵 GLB 只扫一遍清叠加 */
  function applySelectionClipVisualFast(visual: ClipVisualState) {
    const keys = resolveClipPreviewKeys();
    if (!keys.length) return;
    const vis = serializeClipVisual(visual);
    const cfg = modelConfigFromClipVisual(vis);
    const colors = {
      outlineColor: vis.outlineColor,
      wireframeColor: vis.wireframeColor,
      modelHighlightColor: vis.modelHighlightColor
    };
    const modelIndex = new Map(models.value.map(m => [m.id, m]));
    const items: Array<{ obj: THREE.Object3D; ownerKey: string; root: THREE.Object3D }> = [];
    const byRoot = new Map<THREE.Object3D, Set<string>>();
    const hideSet = new Set<THREE.Object3D>();

    for (const key of keys) {
      const parsed = parseClipTargetKey(key);
      const modelId = parsed.modelId;
      const nodeId = resolveClipTargetNodeId(modelId, parsed.nodeId);
      if (!modelIndex.get(modelId)) continue;
      const root = meshes.get(modelId);
      if (!root) continue;
      const objs = getNodeObjects(modelId, nodeId, true);
      if (!objs.length) continue;
      let owners = byRoot.get(root);
      if (!owners) {
        owners = new Set();
        byRoot.set(root, owners);
      }
      for (const obj of objs) {
        const ownerKey = (obj.userData?.nodeId as string | undefined) || `root:${modelId}`;
        owners.add(ownerKey);
        items.push({ obj, ownerKey, root });
        hideSet.add(obj);
        delete obj.userData._clipVisualSig;
      }
    }
    if (!items.length) return;

    const hiding = vis.visible === false;
    for (const [root, owners] of byRoot) {
      removeVisualOverlaysForOwners(root, owners, hiding ? hideSet : null);
    }

    if (hiding) {
      for (const { obj } of items) obj.visible = false;
      syncModelConfigOutlinePass();
      invalidatePickMeshCache();
      renderViewportFrame();
      return;
    }

    for (const { obj } of items) obj.visible = true;
    if (vis.outline || vis.wireframe || vis.highlight) {
      for (const { obj, ownerKey, root } of items) {
        const meshList = collectMeshesForVisualOwner(obj);
        for (const mesh of meshList) {
          applyVisualEffectsToMesh(root, obj, mesh, cfg, ownerKey, colors, true);
        }
      }
    }
    syncModelConfigOutlinePass();
    invalidatePickMeshCache();
    renderViewportFrame();
  }

  /** 多选变换：把主目标增量应用到其余选中目标并写入片段 */
  function applyTransformDeltaToOtherSelected(mode: "start" | "end", delta: ClipTransformSnap) {
    const clip = getActiveAnimationClip();
    if (!clip || !selModel.value) return;
    const primaryKey = normalizeClipNodeKey(selModel.value.id, selModelNodeId.value);
    const keys = resolveClipPreviewKeys();
    if (keys.length <= 1) return;

    const nearZero =
      Math.abs(delta.pos[0]) < 1e-6 &&
      Math.abs(delta.pos[1]) < 1e-6 &&
      Math.abs(delta.pos[2]) < 1e-6 &&
      Math.abs(delta.rot[0]) < 1e-6 &&
      Math.abs(delta.rot[1]) < 1e-6 &&
      Math.abs(delta.rot[2]) < 1e-6 &&
      Math.abs(delta.scale) < 1e-6;
    if (nearZero) return;

    const heavy = keys.length >= CLIP_HEAVY_TARGET_THRESHOLD;
    const targetIndex = new Map<string, number>();
    for (let i = 0; i < clip.targets.length; i++) {
      const target = clip.targets[i];
      targetIndex.set(normalizeClipNodeKey(target.modelId, target.nodeId ?? null), i);
    }
    const modelIndex = new Map(models.value.map(model => [model.id, model] as const));
    for (const key of keys) {
      if (key === primaryKey) continue;
      const { modelId, nodeId } = parseClipTargetKey(key);
      const model = modelIndex.get(modelId);
      if (!model) continue;
      const normKey = normalizeClipNodeKey(modelId, nodeId);
      let idx = targetIndex.get(normKey) ?? -1;
      if (idx < 0) {
        const { pos, scale, rot } = getDefaultTransformForAnimTarget(model, nodeId);
        const visual = animSegments[0]?.clipVisual
          ? serializeClipVisual(animSegments[0].clipVisual)
          : createDefaultClipVisual();
        clip.targets.push(createEmptyClipTarget(modelId, nodeId, { pos, scale, rot }, visual));
        idx = clip.targets.length - 1;
        targetIndex.set(normKey, idx);
      }
      applyDeltaToTargetFields(clip.targets[idx], mode, delta);
      // 大体量只写数据，视口只预览主目标；播放时再统一应用
      if (!heavy) {
        const seg = targetAsLiveSeg(clip, clip.targets[idx]);
        applyAnimSegmentTransformToMesh(model, nodeId, seg, mode);
      }
    }
    clipDraftTargetKey.value = null;
    if (!heavy) bumpAnimClipListRevision();
    else rebuildActiveClipEditedKeySet();
  }

  /** 将当前 live 姿态提交到多选/单选目标 */
  function commitTransformToClipSelection(opts?: { silentUi?: boolean }) {
    const clip = getActiveAnimationClip();
    if (!clip || clipAutoCommitSuppressed || !selModel.value || !animSegments[0]) return;
    const keys = resolveClipPreviewKeys();
    const primaryKey = normalizeClipNodeKey(selModel.value.id, selModelNodeId.value);
    let membershipChanged = false;
    const targetIndex = new Map<string, number>();
    for (let i = 0; i < clip.targets.length; i++) {
      const target = clip.targets[i];
      targetIndex.set(normalizeClipNodeKey(target.modelId, target.nodeId ?? null), i);
    }
    const modelIndex = new Map(models.value.map(model => [model.id, model] as const));
    const selectedKeys = new Set(activeClipTargetKeys.value);

    for (const key of keys) {
      const { modelId, nodeId } = parseClipTargetKey(key);
      const model = modelIndex.get(modelId);
      if (!model) continue;
      const normKey = normalizeClipNodeKey(modelId, nodeId);
      const idx = targetIndex.get(normKey) ?? -1;
      if (normKey === primaryKey) {
        const target = liveSegmentToTarget(modelId, nodeId, animSegments[0]);
        if (idx >= 0) clip.targets[idx] = target;
        else {
          clip.targets.push(target);
          targetIndex.set(normKey, clip.targets.length - 1);
          membershipChanged = true;
        }
      } else if (idx < 0) {
        // 其他项应已在 delta 路径入轨；兜底建一条
        const { pos, scale, rot } = getDefaultTransformForAnimTarget(model, nodeId);
        clip.targets.push(
          createEmptyClipTarget(modelId, nodeId, { pos, scale, rot }, animSegments[0].clipVisual)
        );
        targetIndex.set(normKey, clip.targets.length - 1);
        membershipChanged = true;
      }
      if (!selectedKeys.has(normKey)) {
        selectedKeys.add(normKey);
        membershipChanged = true;
      }
    }
    if (selectedKeys.size !== activeClipTargetKeys.value.length) {
      activeClipTargetKeys.value = [...selectedKeys];
    }
    clipDraftTargetKey.value = null;
    activeClipTargetKey.value = primaryKey;
    // 仅成员变化时刷树/列表；纯姿态改动勿 bump（144 节点会整树重算）
    if (!opts?.silentUi || membershipChanged) {
      if (membershipChanged) bumpAnimClipListRevision();
      else if (!opts?.silentUi) bumpAnimClipListRevision();
    } else {
      rebuildActiveClipEditedKeySet();
    }
  }

  function onAnimClipVisualChange(seg: any) {
    if (!seg) return;
    ensureSegClipVisual(seg);
    animDirty.value = true;
    const vis = serializeClipVisual(seg.clipVisual);
    const multi = resolveClipPreviewKeys().length > 1;
    if (multi) {
      if (clipVisualCommitTimer) {
        window.clearTimeout(clipVisualCommitTimer);
        clipVisualCommitTimer = 0;
        pendingClipVisual = null;
      }
      applySelectionClipVisualFast(vis);
      commitClipVisualToSelection(vis, { skipMesh: true });
    } else {
      applyPrimaryClipVisualNow(vis);
      scheduleClipVisualCommit(vis);
    }
    lastIntroStateKey = "";
    syncIntroPresentation();
  }

  let clipVisualCommitTimer = 0;
  let pendingClipVisual: ClipVisualState | null = null;

  function applyPrimaryClipVisualNow(visual: ClipVisualState) {
    const model = selModel.value;
    if (!model) return;
    const vis = serializeClipVisual(visual);
    const objs = getNodeObjects(model.id, selModelNodeId.value, true);
    if (!objs.length) return;
    const skipOutline = vis.visible !== false && !vis.wireframe && !vis.outline && !vis.highlight;
    const key = normalizeClipNodeKey(model.id, selModelNodeId.value);
    for (const obj of objs) delete obj.userData._clipVisualSig;
    applyClipVisualToObjects(model, objs, vis, `live-visual:${key}`, skipOutline);
  }

  function scheduleClipVisualCommit(visual: ClipVisualState) {
    pendingClipVisual = serializeClipVisual(visual);
    if (clipVisualCommitTimer) window.clearTimeout(clipVisualCommitTimer);
    clipVisualCommitTimer = window.setTimeout(() => {
      clipVisualCommitTimer = 0;
      flushPendingClipVisual();
    }, 80);
  }

  function flushPendingClipVisual() {
    if (clipVisualCommitTimer) {
      window.clearTimeout(clipVisualCommitTimer);
      clipVisualCommitTimer = 0;
    }
    if (!pendingClipVisual) return;
    const vis = pendingClipVisual;
    pendingClipVisual = null;
    if (!clipAutoCommitSuppressed) commitClipVisualToSelection(vis, { skipPrimaryMesh: true });
  }

  let introCommitTimer = 0;
  let pendingIntroText: string | null = null;
  let pendingIntroClipId: string | null = null;

  function patchEditingIntroBubble(text: string) {
    const trimmed = (text || "").trim();
    const model = selModel.value;
    const chapter = selectedChapter.value;
    if (!model || !chapter) return;
    const liveSeg = editingSeg.value ?? animSegments[0];
    const visible = liveSeg?.clipVisual ? liveSeg.clipVisual.visible !== false : true;
    if (!visible || !trimmed) {
      modelIntroLabels.value = [];
      lastIntroStateKey = `0:${chapter.id}:`;
      return;
    }
    const nodeId = selModelNodeId.value;
    const cur = modelIntroLabels.value;
    if (cur.length === 1 && cur[0].modelId === model.id && cur[0].nodeId === nodeId) {
      if (cur[0].text !== trimmed) cur[0].text = trimmed;
      lastIntroStateKey = `1:${chapter.id}:${model.id}|${nodeId ?? ""}|${trimmed}`;
      return;
    }
    modelIntroLabels.value = [{ modelId: model.id, nodeId, text: trimmed, x: 0, y: 0 }];
    lastIntroStateKey = `1:${chapter.id}:${model.id}|${nodeId ?? ""}|${trimmed}`;
  }

  function applyIntroTextToLiveAndTargets(text: string) {
    const next = typeof text === "string" ? text : "";
    const seg = editingSeg.value ?? animSegments[0];
    if (seg) {
      ensureSegClipVisual(seg);
      seg.clipVisual.intro = next;
    }
    const clip = getActiveAnimationClip();
    if (!clip || clipAutoCommitSuppressed) return;
    const applyIntro = (target: { clipVisual?: ClipVisualState | null }) => {
      const vis = serializeClipVisual(target.clipVisual);
      vis.intro = next;
      target.clipVisual = vis;
    };
    const keys = resolveClipPreviewKeys();
    if (!keys.length) {
      for (const t of clip.targets || []) applyIntro(t);
      return;
    }
    for (const key of keys) {
      const parsed = parseClipTargetKey(key);
      const modelId = parsed.modelId;
      const nodeId = resolveClipTargetNodeId(modelId, parsed.nodeId);
      const idx = findClipTargetIndex(clip, modelId, nodeId);
      if (idx >= 0) applyIntro(clip.targets[idx]);
    }
  }

  function flushPendingClipIntro() {
    if (introCommitTimer) {
      window.clearTimeout(introCommitTimer);
      introCommitTimer = 0;
    }
    if (pendingIntroText == null) return;
    const text = pendingIntroText;
    const clipId = pendingIntroClipId;
    pendingIntroText = null;
    pendingIntroClipId = null;
    if (clipId && activeAnimClipId.value && clipId !== activeAnimClipId.value) return;
    applyIntroTextToLiveAndTargets(text);
  }

  /** 介绍输入：只改文案与气泡，禁止走轮廓/线框重建（否则每字卡几秒） */
  function onAnimClipIntroChange(text: string) {
    const next = typeof text === "string" ? text : "";
    pendingIntroText = next;
    pendingIntroClipId = activeAnimClipId.value;
    animDirty.value = true;
    patchEditingIntroBubble(next);
    if (introCommitTimer) window.clearTimeout(introCommitTimer);
    introCommitTimer = window.setTimeout(() => {
      introCommitTimer = 0;
      flushPendingClipIntro();
    }, 280);
  }

  /** 当前动画节点时间窗（秒），用于时间条刻度 */
  function getSelectedChapterWindowDuration(): number {
    const ch = selectedChapter.value;
    if (!ch) return animDuration.value || 5;
    return Math.max(0.1, (ch.endTime ?? 0) - (ch.startTime ?? 0));
  }

  function playTrackOnce() {
    const ch = selectedChapter.value;
    if (ch?.clips?.length) {
      // 有片段：走整段墙钟播放（与时间轴「播放」一致），勿用单段 RAF 播
      playAnimationClipsOnce();
      return;
    }
    if (!commitAnimClipAbsoluteTimes({ silent: true })) {
      annotateSegmentsAbsoluteTimes(animSegments);
    }
    playAllSegments();
  }

  function bumpAnimClipListRevision() {
    animClipListRevision.value++;
    sealHeavyClipsInChapter(selectedChapter.value);
    rebuildActiveClipEditedKeySet();
    rebuildActiveClipSelectedKeySet();
  }

  function rebuildActiveClipEditedKeySet() {
    const set = new Set<string>();
    const clip = getActiveAnimationClip();
    if (clip) {
      for (const t of clip.targets || []) {
        const raw = clipTargetKey(t.modelId, t.nodeId ?? null);
        set.add(raw);
        set.add(normalizeClipNodeKey(t.modelId, t.nodeId ?? null));
      }
    }
    activeClipEditedKeySet.value = set;
  }

  function formatClipTargetLabel(modelId: string, nodeId: string | null): string {
    const model = models.value.find(m => m.id === modelId);
    const modelName = model?.name || modelId;
    if (!nodeId) return modelName;
    const node = findHierarchyNode(getModelHierarchy(modelId), nodeId);
    return `${modelName} / ${node?.name || nodeId}`;
  }

  function collectChapterAnimTargetSegments(ch: Chapter) {
    const out: Array<{ modelId: string; nodeId: string | null; segments: any[] }> = [];
    if (!ch.modelConfigs) return out;
    for (const [modelId, raw] of Object.entries(ch.modelConfigs)) {
      const rootCfg = getModelConfig(raw as ModelConfig);
      if (rootCfg.animation && rootCfg.animConfig?.segments?.length) {
        out.push({ modelId, nodeId: null, segments: rootCfg.animConfig.segments });
      }
      const nodeConfigs = (raw as ModelConfig).nodeConfigs;
      if (!nodeConfigs) continue;
      const tree = getModelHierarchy(modelId);
      const seen = new Set<string>();
      for (const [nid, ncfg] of Object.entries(nodeConfigs)) {
        const displayId = resolveDisplayNodeId(tree, nid);
        if (seen.has(displayId)) continue;
        seen.add(displayId);
        const nodeCfg = getModelConfig((nodeConfigs[displayId] as ModelConfig) ?? (ncfg as ModelConfig));
        if (nodeCfg.animation && nodeCfg.animConfig?.segments?.length) {
          out.push({ modelId, nodeId: displayId, segments: nodeCfg.animConfig.segments });
        }
      }
    }
    return out;
  }

  /** 确保 chapter.clips 存在；旧数据从 modelConfigs 反推 */
  function ensureChapterClips(ch: Chapter): AnimationClip[] {
    if (Array.isArray(ch.clips) && ch.clips.length > 0) {
      ensureClipTimingFields(ch.clips);
      return ch.clips;
    }
    const migrated = migrateModelAnimConfigsToClips(ch, collectChapterAnimTargetSegments(ch));
    if (migrated.length > 0) {
      ensureClipTimingFields(migrated);
      // modelConfigs 为绝对坐标；片段编辑态统一相对值（0=GLB 初始）
      for (const clip of migrated) {
        for (const t of clip.targets || []) {
          const obj = getTransformTarget(t.modelId, t.nodeId ?? null);
          if (!obj || !usesRelativeAnimRotation(obj)) continue;
          t.startPos = animPosFromAbsolute(obj, t.startPos || [0, 0, 0]) as [number, number, number];
          t.endPos = animPosFromAbsolute(obj, t.endPos || [0, 0, 0]) as [number, number, number];
          t.startRot = animRotFromAbsolute(obj, t.startRot || [0, 0, 0]) as [number, number, number];
          t.endRot = animRotFromAbsolute(obj, t.endRot || [0, 0, 0]) as [number, number, number];
        }
      }
      ch.clips = migrated;
      return ch.clips;
    }
    ch.clips = [
      createAnimationClip({
        name: "片段 1",
        pauseTime: DEFAULT_CLIP_PAUSE_TIME,
        animTime: DEFAULT_CLIP_ANIM_TIME,
        camera: ch.camera,
        targets: []
      })
    ];
    rebuildClipAbsoluteTimes(ch.clips);
    return ch.clips;
  }

  function listAnimationClips(ch?: Chapter | null): AnimationClip[] {
    animClipListRevision.value;
    const chapter = ch ?? selectedChapter.value;
    if (!chapter) return [];
    // 列表只读已有 clips；禁止在 computed/渲染路径里 ensure/migrate（144 目标会卡死首点）
    const clips = Array.isArray(chapter.clips) ? chapter.clips : [];
    return clips.map(clip => ({
      id: clip.id,
      name: clip.name,
      start: clip.start,
      end: clip.end,
      pauseTime: clip.pauseTime,
      animTime: clip.animTime,
      camera: clip.camera,
      targetCount: clip.targets?.length || 0,
      targets: []
    }));
  }

  /**
   * 大体量 targets 退出 Vue 深度代理，否则任意点击都可能触发 144×对象依赖收集并卡死页面。
   * force：章节合计已超阈值时，即使单片段 <32 也必须封印（多片段分摊时旧逻辑会漏封）。
   */
  function sealHeavyClipTargets(clip: AnimationClip, force = false) {
    const targets = clip.targets;
    if (!targets?.length) return;
    if (!force && targets.length < CLIP_HEAVY_TARGET_THRESHOLD) return;
    // 已封印则跳过，避免重复赋值触发 Pinia/Vue 风暴
    if ((targets as any).__v_skip) return;
    // 一次替换整表，禁止逐项 targets[i]= 触发 144 次响应式通知
    const sealed = new Array(targets.length);
    for (let i = 0; i < targets.length; i++) {
      const t = targets[i];
      sealed[i] = t && !(t as any).__v_skip ? markRaw(t) : t;
    }
    clip.targets = markRaw(sealed);
  }

  function sealHeavyClipsInChapter(ch: Chapter | null | undefined) {
    if (!ch?.clips?.length) return;
    const force = isHeavyClipChapter(ch);
    for (const clip of ch.clips) sealHeavyClipTargets(clip, force);
  }

  function getActiveAnimationClip(): AnimationClip | null {
    const ch = selectedChapter.value;
    if (!ch?.clips?.length || !activeAnimClipId.value) return null;
    // 只读：禁止在 computed/渲染路径里 seal（会改响应式触发反复重算）
    return ch.clips.find(c => c.id === activeAnimClipId.value) ?? null;
  }

  function writeLiveTargetBackToActiveClip() {
    // 仅更新「已在列表中」且确有用户改动的目标
    const clip = getActiveAnimationClip();
    if (!clip || !selModel.value) return;
    if (!animSegments.length || !animSegmentsBelongToChapter(selectedChapterId.value)) return;
    if (clipAutoCommitSuppressed) return;
    const modelId = selModel.value.id;
    const nodeId = selModelNodeId.value;
    const key = normalizeClipNodeKey(modelId, nodeId);
    const idx = clip.targets.findIndex(
      x => normalizeClipNodeKey(x.modelId, x.nodeId ?? null) === key
    );
    if (idx < 0) return;
    if (!clipLiveHasUserEdits(selModel.value, nodeId)) return;
    clip.targets[idx] = liveSegmentToTarget(modelId, nodeId, animSegments[0]);
  }

  /** 仅当确有用户改动时，才把当前模型写入片段 targets */
  function commitEditedModelToActiveClip(opts?: { silentUi?: boolean }): boolean {
    if (clipAutoCommitSuppressed) return false;
    const clip = getActiveAnimationClip();
    if (!clip || !selModel.value || !animSegments.length) return false;
    if (!animSegmentsBelongToChapter(selectedChapterId.value)) return false;
    const modelId = selModel.value.id;
    const nodeId = selModelNodeId.value;
    if (!clipLiveHasUserEdits(selModel.value, nodeId)) return false;

    const key = normalizeClipNodeKey(modelId, nodeId);
    const target = liveSegmentToTarget(modelId, nodeId, animSegments[0]);
    const idx = clip.targets.findIndex(
      x => normalizeClipNodeKey(x.modelId, x.nodeId ?? null) === key
    );
    let membershipChanged = false;
    if (idx >= 0) clip.targets[idx] = target;
    else {
      clip.targets.push(target);
      membershipChanged = true;
    }

    clipDraftTargetKey.value = null;
    if (!activeClipTargetKeys.value.includes(key)) {
      activeClipTargetKeys.value = [...activeClipTargetKeys.value, key];
      membershipChanged = true;
    }
    activeClipTargetKey.value = key;
    if (membershipChanged) bumpAnimClipListRevision();
    else if (!opts?.silentUi) rebuildActiveClipEditedKeySet();
    return true;
  }

  function setClipTargetSelection(keys: string[], primary?: string | null) {
    const primaryKey = primary !== undefined ? primary : keys[keys.length - 1] ?? null;
    const next: string[] = [];
    const seen = new Set<string>();
    for (const k of keys) {
      if (!k || seen.has(k)) continue;
      seen.add(k);
      next.push(k);
    }
    // 主选中必须落在多选集合里，避免右侧高亮 N 个、左侧只有 N-1
    if (primaryKey && !seen.has(primaryKey)) {
      next.push(primaryKey);
      seen.add(primaryKey);
    }
    activeClipTargetKeys.value = next;
    activeClipTargetKey.value = primaryKey;
    rebuildActiveClipSelectedKeySet(seen);
  }

  function rebuildActiveClipSelectedKeySet(base?: Set<string>) {
    const set = base ? new Set(base) : new Set<string>();
    if (!base) {
      for (const k of activeClipTargetKeys.value) {
        set.add(k);
        const { modelId, nodeId } = parseClipTargetKey(k);
        set.add(normalizeClipNodeKey(modelId, nodeId));
        set.add(clipTargetKey(modelId, nodeId));
      }
    } else {
      // 同时放入 normalize / raw 两种 key，供树查询
      for (const k of [...set]) {
        const { modelId, nodeId } = parseClipTargetKey(k);
        set.add(normalizeClipNodeKey(modelId, nodeId));
        set.add(clipTargetKey(modelId, nodeId));
      }
    }
    if (activeClipTargetKey.value) {
      const { modelId, nodeId } = parseClipTargetKey(activeClipTargetKey.value);
      set.add(activeClipTargetKey.value);
      set.add(normalizeClipNodeKey(modelId, nodeId));
      set.add(clipTargetKey(modelId, nodeId));
    }
    activeClipSelectedKeySet.value = set;
  }

  function resolveClipTargetNodeId(modelId: string, nodeId: string | null): string | null {
    if (!nodeId) return null;
    return resolveSelectedNodeId(modelId, nodeId);
  }

  function findClipTargetIndex(clip: AnimationClip, modelId: string, nodeId: string | null): number {
    const key = normalizeClipNodeKey(modelId, nodeId);
    return clip.targets.findIndex(t => normalizeClipNodeKey(t.modelId, t.nodeId ?? null) === key);
  }

  function findClipTarget(
    clip: AnimationClip,
    modelId: string,
    nodeId: string | null
  ): AnimationClipTarget | undefined {
    const idx = findClipTargetIndex(clip, modelId, nodeId);
    return idx >= 0 ? clip.targets[idx] : undefined;
  }

  /** 合并同 key 重复目标，并统一 nodeId 为 displayId */
  function dedupeClipTargets(clip: AnimationClip) {
    const map = new Map<string, AnimationClipTarget>();
    for (const t of clip.targets) {
      const nodeId = resolveClipTargetNodeId(t.modelId, t.nodeId ?? null);
      const key = normalizeClipNodeKey(t.modelId, nodeId);
      const prev = map.get(key);
      map.set(key, {
        ...(prev || t),
        ...t,
        nodeId,
        clipVisual: t.clipVisual
          ? createDefaultClipVisual(t.clipVisual)
          : prev?.clipVisual
            ? createDefaultClipVisual(prev.clipVisual)
            : createDefaultClipVisual()
      });
    }
    clip.targets = [...map.values()];
  }

  function prepareClipDraftForModel(
    model: Model,
    nodeId: string | null,
    opts?: { keepMultiSelect?: boolean; preserveKeys?: string[] }
  ) {
    const clip = getActiveAnimationClip();
    if (!clip) return;
    const resolvedNodeId = resolveClipTargetNodeId(model.id, nodeId);
    const key = normalizeClipNodeKey(model.id, resolvedNodeId);
    const existing = findClipTarget(clip, model.id, resolvedNodeId);

    withClipAutoCommitSuppressed(() => {
      if (existing) {
        clipDraftTargetKey.value = null;
        loadClipTargetIntoEditor(clip, existing, { focusCamera: false });
      } else {
        const { pos, scale, rot } = getDefaultTransformForAnimTarget(model, resolvedNodeId);
        const draft = createEmptyClipTarget(model.id, resolvedNodeId, { pos, scale, rot });
        const seg = targetToLiveSegment(clip, draft);
        animSegments.splice(0, animSegments.length, seg);
        annotateSegmentsAbsoluteTimes(animSegments);
        bindAnimSegmentsToSelection(model.id, resolvedNodeId, selectedChapterId.value);
        editingSeg.value = animSegments[0];
        editingSegMode.value = "start";
        mAni.value = true;
        clipDraftTargetKey.value = key;
        animDirty.value = false;
        bumpAnimSegmentRevision();
        if (animSegments[0]) focusSegTransform(animSegments[0], "start");
      }
      if (opts?.preserveKeys?.length) {
        setClipTargetSelection(
          opts.preserveKeys.map(k => {
            const p = parseClipTargetKey(k);
            return normalizeClipNodeKey(p.modelId, p.nodeId);
          }),
          key
        );
      } else if (opts?.keepMultiSelect) {
        const keys = activeClipTargetKeys.value.includes(key)
          ? activeClipTargetKeys.value
          : [...activeClipTargetKeys.value, key];
        setClipTargetSelection(keys, key);
      } else {
        setClipTargetSelection([key], key);
      }
    });
  }

  function loadClipTargetIntoEditor(
    clip: AnimationClip,
    target: AnimationClipTarget,
    opts?: {
      focusCamera?: boolean;
      skipViewport?: boolean;
      previewMode?: "start" | "end";
      /** 禁止展开模型树（大体量 GLB 展开会卡死） */
      skipReveal?: boolean;
    }
  ) {
    const model = models.value.find(m => m.id === target.modelId);
    if (!model) return;
    const nodeId = resolveClipTargetNodeId(target.modelId, target.nodeId ?? null);
    // 规范化落盘 nodeId，避免再次查找失败
    target.nodeId = nodeId;
    healClipTargetRelativeTransforms(target);
    if (!target.clipVisual) target.clipVisual = createDefaultClipVisual();
    else target.clipVisual = createDefaultClipVisual(target.clipVisual);

    const key = normalizeClipNodeKey(target.modelId, nodeId);
    // 不在此处清空多选；仅更新主焦点，keys 由调用方 setClipTargetSelection 决定
    activeClipTargetKey.value = key;
    if (!activeClipTargetKeys.value.includes(key)) {
      activeClipTargetKeys.value = [...activeClipTargetKeys.value, key];
    }
    clipDraftTargetKey.value = null;
    selectModel(model, {
      focusCamera: opts?.focusCamera ?? false,
      nodeId,
      skipClipHook: true,
      skipReveal: opts?.skipReveal
    });
    const seg = targetToLiveSegment(clip, target);
    healLiveSegmentRelativeTransforms(model, nodeId, seg);
    // 强制保留目标外观（含 visible:false），防止 map 链路丢失
    seg.clipVisual = createDefaultClipVisual(target.clipVisual);
    animSegments.splice(0, animSegments.length, seg);
    annotateSegmentsAbsoluteTimes(animSegments);
    bindAnimSegmentsToSelection(target.modelId, nodeId, selectedChapterId.value);
    editingSeg.value = animSegments[0];
    const mode = opts?.previewMode ?? "end";
    editingSegMode.value = mode;
    mAni.value = true;
    animDirty.value = false;
    bumpAnimSegmentRevision();
    if (!opts?.skipViewport && animSegments[0]) focusSegTransform(animSegments[0], mode);
  }

  /**
   * 片段激活时选中交互：
   * - 单击：单选并进入编辑（未改动不入「已改」列表）
   * - Shift+单击：范围多选（同模型树）/ 加选（跨模型）；不自动标已改
   * - Ctrl/Meta+单击：切换点选（未选则加入，已选则取消）
   */
  function flattenModelHierarchyKeys(modelId: string): string[] {
    const keys: string[] = [clipTargetKey(modelId, null)];
    const walk = (nodes: ModelHierarchyNode[]) => {
      for (const n of nodes) {
        keys.push(clipTargetKey(modelId, n.id));
        if (n.children?.length) walk(n.children);
      }
    };
    walk(getModelHierarchy(modelId));
    return keys;
  }

  /** Shift 范围多选的锚点 */
  let clipSelectAnchorKey: string | null = null;

  function currentClipSelectionKeys(): string[] {
    if (activeClipTargetKeys.value.length) return [...activeClipTargetKeys.value];
    if (activeClipTargetKey.value) return [activeClipTargetKey.value];
    return [];
  }

  /** 仅当用户已进入某个片段时，模型点选才走片段编辑；未选动画/片段时不要自动激活 clip */
  function ensureActiveAnimClipForEdit(): boolean {
    if (!activeAnimClipId.value) return false;
    const ch = selectedChapter.value;
    if (!ch || !isAnimationNode(ch)) return false;
    return !!getActiveAnimationClip();
  }

  function handleClipModelInteraction(
    modelId: string,
    nodeId: string | null,
    mods?: { shiftKey?: boolean; ctrlKey?: boolean; metaKey?: boolean; focusCamera?: boolean }
  ): boolean {
    const shift = !!mods?.shiftKey;
    const ctrl = !!(mods?.ctrlKey || mods?.metaKey);
    const wantsMulti = shift || ctrl;

    if (!ensureActiveAnimClipForEdit()) {
      if (wantsMulti) toastShow("请先选中动画节点并选择片段", "warning");
      return false;
    }

    const clip = getActiveAnimationClip();
    const model = models.value.find(m => m.id === modelId);
    if (!clip || !model) return false;

    const resolvedNodeId = nodeId ? resolveSelectedNodeId(modelId, nodeId) : null;
    const key = normalizeClipNodeKey(modelId, resolvedNodeId);
    const focusCamera = mods?.focusCamera ?? true;

    const focusPrimary = (primaryKey: string | null, keepMulti: boolean, preserveKeys?: string[]) => {
      if (!primaryKey) {
        animSegments.splice(0);
        editingSeg.value = null;
        mAni.value = false;
        activeClipTargetKey.value = null;
        return;
      }
      const p = parseClipTargetKey(primaryKey);
      const m = models.value.find(item => item.id === p.modelId);
      if (!m) return;
      selectModel(m, { focusCamera, nodeId: p.nodeId, skipClipHook: true });
      prepareClipDraftForModel(m, p.nodeId, {
        keepMultiSelect: keepMulti,
        preserveKeys
      });
    };

    if (ctrl) {
      // Ctrl：点选切换 — 未在多选中则加入，已在则去掉
      flushCurrentClipEditBeforeSwitch();
      let keys = currentClipSelectionKeys().map(k => {
        const p = parseClipTargetKey(k);
        return normalizeClipNodeKey(p.modelId, p.nodeId);
      });
      if (keys.includes(key)) {
        keys = keys.filter(k => k !== key);
        if (clipDraftTargetKey.value === key) clipDraftTargetKey.value = null;
      } else {
        keys.push(key);
      }
      const primary = keys.includes(key) ? key : keys[keys.length - 1] ?? null;
      setClipTargetSelection(keys, primary);
      clipSelectAnchorKey = primary || key;
      focusPrimary(primary, keys.length > 1, keys);
      bumpAnimClipListRevision();
      return true;
    }

    if (shift) {
      // Shift：同模型范围多选（以锚点到当前为闭区间，替换选区）；跨模型则加选
      flushCurrentClipEditBeforeSwitch();
      const existing = currentClipSelectionKeys().map(k => {
        const p = parseClipTargetKey(k);
        return normalizeClipNodeKey(p.modelId, p.nodeId);
      });
      const anchorRaw = clipSelectAnchorKey || activeClipTargetKey.value || existing[0] || key;
      const anchorParsed = parseClipTargetKey(anchorRaw);
      const anchor = normalizeClipNodeKey(anchorParsed.modelId, anchorParsed.nodeId);
      let keys: string[];
      if (anchorParsed.modelId === modelId) {
        const order = flattenModelHierarchyKeys(modelId).map(k => {
          const p = parseClipTargetKey(k);
          return normalizeClipNodeKey(p.modelId, p.nodeId);
        });
        const uniqOrder: string[] = [];
        const seenOrder = new Set<string>();
        for (const k of order) {
          if (seenOrder.has(k)) continue;
          seenOrder.add(k);
          uniqOrder.push(k);
        }
        const i0 = uniqOrder.indexOf(anchor);
        const i1 = uniqOrder.indexOf(key);
        if (i0 >= 0 && i1 >= 0) {
          const lo = Math.min(i0, i1);
          const hi = Math.max(i0, i1);
          // 与资源管理器一致：Shift 范围 = 锚点到当前的闭区间（不残留区间外旧项）
          keys = uniqOrder.slice(lo, hi + 1);
        } else {
          keys = existing.includes(key) ? existing : [...existing, key];
        }
      } else {
        keys = existing.includes(key) ? existing : [...existing, key];
      }
      setClipTargetSelection(keys, key);
      clipSelectAnchorKey = anchor;
      bumpAnimClipListRevision();
      selectModel(model, { focusCamera, nodeId: resolvedNodeId, skipClipHook: true });
      prepareClipDraftForModel(model, resolvedNodeId, { keepMultiSelect: true, preserveKeys: keys });
      // 再落一次，防止 draft 加载过程中主选中未写入 keys
      setClipTargetSelection(keys, key);
      bumpAnimClipListRevision();
      return true;
    }

    flushCurrentClipEditBeforeSwitch();
    clipSelectAnchorKey = key;
    selectModel(model, { focusCamera, nodeId: resolvedNodeId, skipClipHook: true });
    prepareClipDraftForModel(model, resolvedNodeId, { keepMultiSelect: false });
    bumpAnimClipListRevision();
    return true;
  }

  function collectAllChapterClipTargetKeys(ch?: Chapter | null): string[] {
    const keys: string[] = [];
    if (!ch?.clips?.length) return keys;
    for (const c of ch.clips) {
      for (const t of c.targets || []) {
        keys.push(normalizeClipNodeKey(t.modelId, t.nodeId ?? null));
      }
    }
    return keys;
  }

  /** 章节 modelConfigs 里仍挂着 animConfig 的目标（归一化 key） */
  function collectChapterProjectedAnimKeys(ch: Chapter): string[] {
    const keys = new Set<string>();
    if (!ch.modelConfigs) return [];
    for (const [modelId, raw] of Object.entries(ch.modelConfigs)) {
      const rootCfg = getModelConfig(raw as ModelConfig);
      if (rootCfg.animConfig?.segments?.length) {
        keys.add(normalizeClipNodeKey(modelId, null));
      }
      const nodeConfigs = (raw as ModelConfig).nodeConfigs;
      if (!nodeConfigs) continue;
      for (const nid of Object.keys(nodeConfigs)) {
        const nodeCfg = getModelConfig(nodeConfigs[nid] as ModelConfig);
        if (nodeCfg.animConfig?.segments?.length) {
          keys.add(normalizeClipNodeKey(modelId, nid));
        }
      }
    }
    return [...keys];
  }

  function clearProjectedAnimForTarget(ch: Chapter, modelId: string, nodeId: string | null) {
    const nodeIds = new Set<string | null>([nodeId]);
    if (nodeId) {
      const displayId = resolveDisplayNodeId(getModelHierarchy(modelId), nodeId);
      if (displayId) nodeIds.add(displayId);
    }
    for (const nid of nodeIds) {
      if (!hasModelConfigForTarget(ch, modelId, nid)) continue;
      const cfg = getWritableModelConfigForTarget(ch, modelId, nid);
      if (cfg.animConfig) delete cfg.animConfig;
      if (cfg.animation && !cfg.animConfig?.segments?.length) {
        cfg.animation = false;
      }
      pruneActiveTargetModelConfigIfUnedited(ch, modelId, nid);
    }
  }

  /**
   * clips.targets 存编辑器相对值；modelConfigs.animConfig 必须是绝对局部坐标。
   * projectClipsToModelAnimConfigs 只做结构拷贝，这里补上相对→绝对转换。
   */
  function absolutizeProjectedAnimConfigs(ch: Chapter, keys: Iterable<string>) {
    for (const key of keys) {
      const { modelId, nodeId } = parseClipTargetKey(key);
      const model = models.value.find(m => m.id === modelId);
      if (!model || !hasModelConfigForTarget(ch, modelId, nodeId)) continue;
      const cfg = getWritableModelConfigForTarget(ch, modelId, nodeId);
      const segs = cfg.animConfig?.segments;
      if (!segs?.length) continue;
      const obj = getTransformTarget(modelId, nodeId);
      const easing = (cfg.animConfig as any)?.easing || "easeInOut";
      cfg.animConfig = {
        ...cfg.animConfig!,
        relativeTransform: false,
        segments: segs.map((s: any) => serializeAnimSegmentForPersist(s, obj, easing)) as any
      };
    }
  }

  /**
   * 以 ch.clips 为唯一真相源重投影到 modelConfigs，并清掉已不在任何片段中的动画。
   * 解决：片段里去掉模型 / 删除片段后，播放仍执行旧 animConfig。
   */
  function resyncChapterClipsProjection(ch: Chapter): { cleared: string[] } {
    const clips = ensureChapterClips(ch);
    ensureClipTimingFields(clips);
    // 投影前先清理已被污染的相对坐标，避免 -rest 被当成相对值再 +rest 变成原点
    const targetCount = clips.reduce((n, c) => n + (c.targets?.length ?? 0), 0);
    // 大体量：跳过逐目标 heal（getTransformTarget×N），播放/保存时仍会 absolutize
    if (targetCount < CLIP_HEAVY_TARGET_THRESHOLD) {
      for (const clip of clips) {
        for (const t of clip.targets || []) healClipTargetRelativeTransforms(t);
      }
    }
    const previously = new Set(collectChapterProjectedAnimKeys(ch));

    const touchedRaw = projectClipsToModelAnimConfigs(
      clips,
      (modelId, nodeId) => getWritableModelConfigForTarget(ch, modelId, nodeId),
      (modelId, nodeId) => clearProjectedAnimForTarget(ch, modelId, nodeId)
    );

    const touched = new Set<string>();
    for (const key of touchedRaw) {
      const { modelId, nodeId } = parseClipTargetKey(key);
      touched.add(normalizeClipNodeKey(modelId, nodeId));
    }
    // 相对编辑值 → 播放用绝对局部坐标，否则子节点 [0,0,0] 会被当成原点把模型拉飞
    absolutizeProjectedAnimConfigs(ch, touched);

    const cleared: string[] = [];
    for (const key of previously) {
      if (touched.has(key)) continue;
      const { modelId, nodeId } = parseClipTargetKey(key);
      clearProjectedAnimForTarget(ch, modelId, nodeId);
      cleared.push(key);
    }
    // 再扫一遍：清掉未进 touched 的残留（含 key 归一化不一致的旧数据）
    for (const key of collectChapterProjectedAnimKeys(ch)) {
      if (touched.has(key)) continue;
      const { modelId, nodeId } = parseClipTargetKey(key);
      clearProjectedAnimForTarget(ch, modelId, nodeId);
      if (!cleared.includes(key)) cleared.push(key);
    }

    invalidateChapterAnimTargetsCache(ch.id);
    invalidateChapterAnimPivotCaches(ch);
    ch.updatedAt = new Date().toISOString();
    editModeProjectionClearedChapterId = null;
    return { cleared };
  }

  /**
   * 编辑态卸载 clips→modelConfigs 的投影轨。
   * 100+ 目标若长期挂在 nodeConfigs.animConfig 上，任何章节 apply / sanitize 都会扫全量导致整编辑器卡死。
   * clips.targets 仍是真相源；播放/保存前再 project。
   */
  function clearClipProjectedAnimConfigs(ch: Chapter) {
    if (!ch?.clips?.length || !ch.modelConfigs) return;
    const keys = new Set<string>([
      ...collectAllChapterClipTargetKeys(ch),
      ...collectChapterProjectedAnimKeys(ch)
    ]);
    if (!keys.size) return;
    for (const key of keys) {
      const { modelId, nodeId } = parseClipTargetKey(key);
      if (!hasModelConfigForTarget(ch, modelId, nodeId)) continue;
      const cfg = getWritableModelConfigForTarget(ch, modelId, nodeId);
      if (!cfg.animConfig && !cfg.animation) continue;
      delete cfg.animConfig;
      cfg.animation = false;
      pruneActiveTargetModelConfigIfUnedited(ch, modelId, nodeId);
    }
    invalidateChapterAnimTargetsCache(ch.id);
    invalidateChapterAnimPivotCaches(ch);
  }

  function restoreMeshesForClipKeys(
    keys: Iterable<string>,
    opts?: { skipOutlineRebuild?: boolean; bindPose?: boolean; forceHidden?: boolean }
  ) {
    for (const key of keys) {
      const { modelId, nodeId } = parseClipTargetKey(key);
      restoreChapterStaticVisualForClipTarget(modelId, nodeId, opts);
    }
  }

  /** 切到某片段前：清掉其它片段残留的姿态/轮廓/线框，避免点片段3却仍显示片段4效果 */
  function restoreOtherClipsViewportState(ch: Chapter, activeClip: AnimationClip) {
    const keep = new Set(
      (activeClip.targets || []).map(t => normalizeClipNodeKey(t.modelId, t.nodeId ?? null))
    );
    const keys = new Set<string>(lastClipViewportOverlayKeys);
    // 必须扫其它片段目标：大体量若只清 lastOverlay，上一片段线框/隐藏会残留
    for (const c of ch.clips || []) {
      if (c.id === activeClip.id) continue;
      for (const t of c.targets || []) {
        keys.add(normalizeClipNodeKey(t.modelId, t.nodeId ?? null));
      }
    }
    const toRestore = [...keys].filter(k => !keep.has(k));
    if (!toRestore.length) return;
    restoreMeshesForClipKeys(toRestore, {
      // 恢复默认姿态/显隐；描边走轻量清理，避免切片段卡死
      skipOutlineRebuild: true,
      bindPose: true
    });
  }

  /** 编辑预览：只采样累计位姿，不按 findActiveClip 套外观（避免边界错段） */
  function applyChapterPoseOnlyAtElapsed(ch: Chapter, elapsedSec: number) {
    if (!ensureClipPlaybackCache(ch)) return;
    const targets = getChapterAnimTargetsCached(ch) as Array<{
      objs: THREE.Object3D[];
      cfg: ModelConfig;
      modelId: string;
      nodeId?: string | null;
      pbWindows?: PlaybackPoseWindow[];
      firstStart?: number;
      lastEnd?: number;
    }>;
    for (const entry of targets) {
      if (entry.pbWindows?.length) {
        let applied = false;
        for (const obj of entry.objs) {
          if (
            applyPlaybackTargetPoseFast(
              obj,
              entry.pbWindows,
              entry.firstStart ?? 0,
              entry.lastEnd ?? 0,
              elapsedSec
            )
          ) {
            applied = true;
          }
        }
        if (!applied) restorePlaybackEntryBindPose(entry);
      } else {
        for (const obj of entry.objs) {
          applyElapsedAnimToObject(obj, entry.cfg, elapsedSec);
        }
      }
    }
  }

  /** 强制套「当前选中片段」全部目标的姿态与外观（点击片段必须按设置执行） */
  function applyClipTargetsEditorPreview(clip: AnimationClip, mode: "start" | "end") {
    const targets = clip.targets || [];
    const overlayKeys: string[] = [];
    for (const t of targets) {
      if (!t?.modelId) continue;
      const model = models.value.find(m => m.id === t.modelId);
      if (!model) continue;
      healClipTargetRelativeTransforms(t);
      const seg = targetAsLiveSeg(clip, t);
      healLiveSegmentRelativeTransforms(model, t.nodeId ?? null, seg);
      applyAnimSegmentTransformToMesh(model, t.nodeId ?? null, seg, mode);
      const objs = getNodeObjects(t.modelId, t.nodeId ?? null, true);
      if (!objs.length) continue;
      const key = normalizeClipNodeKey(t.modelId, t.nodeId ?? null);
      overlayKeys.push(key);
      for (const obj of objs) delete obj.userData._clipVisualSig;
      // skipOutline=false：有线框/轮廓/高亮时必须重建；无效果时也会清残留
      applyClipVisualToObjects(
        model,
        objs,
        serializeClipVisual(t.clipVisual),
        `clip-preview:${clip.id}:${key}`,
        false
      );
    }
    if (overlayKeys.length) lastClipViewportOverlayKeys = overlayKeys;
  }

  /** 切动画/视频前：清掉片段叠加残留，避免共享模型串姿态 */
  function resetClipEditorIsolationState(ch?: Chapter | null) {
    cancelAllPendingVisualRebuilds();
    const chapter = ch ?? selectedChapter.value;
    const heavy =
      isHeavyEditNavChapter(chapter) ||
      lastClipViewportOverlayKeys.length >= CLIP_HEAVY_TARGET_THRESHOLD;
    // 大体量：只恢复「上一轮叠加」的 key，禁止扫全部片段目标（否则 144×描边直接卡死）
    const keys = new Set<string>(lastClipViewportOverlayKeys);
    if (!heavy && chapter) {
      for (const k of collectAllChapterClipTargetKeys(chapter)) keys.add(k);
      for (const k of collectChapterProjectedAnimKeys(chapter)) keys.add(k);
    }
    restoreMeshesForClipKeys(keys, {
      skipOutlineRebuild: keys.size >= CLIP_HEAVY_TARGET_THRESHOLD || heavy
    });
    lastClipViewportOverlayKeys = [];
  }

  function selectClipTarget(
    modelId: string,
    nodeId: string | null = null,
    mods?: { shiftKey?: boolean; ctrlKey?: boolean; metaKey?: boolean }
  ) {
    handleClipModelInteraction(modelId, nodeId, { ...mods, focusCamera: true });
  }

  function removeSelectedClipTargets() {
    const clip = getActiveAnimationClip();
    const ch = selectedChapter.value;
    if (!clip || !ch || !activeClipTargetKeys.value.length) return;
    const removeSet = new Set(
      activeClipTargetKeys.value.map(k => {
        const { modelId, nodeId } = parseClipTargetKey(k);
        return normalizeClipNodeKey(modelId, nodeId);
      })
    );
    clip.targets = clip.targets.filter(
      t => !removeSet.has(normalizeClipNodeKey(t.modelId, t.nodeId ?? null))
    );
    setClipTargetSelection([]);
    clipDraftTargetKey.value = null;
    animSegments.splice(0);
    editingSeg.value = null;
    mAni.value = false;
    // 只清被移除目标的投影残留，勿全量 resync（会把其余 100+ 目标又写回 modelConfigs）
    for (const key of removeSet) {
      const { modelId, nodeId } = parseClipTargetKey(key);
      clearProjectedAnimForTarget(ch, modelId, nodeId);
    }
    restoreMeshesForClipKeys(removeSet);
    syncActiveClipViewportPreview({ mode: editingSegMode.value || "start", light: true });
    animDirty.value = true;
    bumpAnimClipListRevision();
  }

  function isClipTargetSelected(modelId: string, nodeId: string | null = null) {
    const set = activeClipSelectedKeySet.value;
    if (set.size) {
      if (set.has(normalizeClipNodeKey(modelId, nodeId))) return true;
      if (set.has(clipTargetKey(modelId, nodeId))) return true;
    }
    const key = normalizeClipNodeKey(modelId, nodeId);
    const raw = clipTargetKey(modelId, nodeId);
    return activeClipTargetKeys.value.includes(key) || activeClipTargetKeys.value.includes(raw);
  }

  function isClipTargetInClip(modelId: string, nodeId: string | null = null) {
    const set = activeClipEditedKeySet.value;
    if (!set.size) return false;
    if (set.has(clipTargetKey(modelId, nodeId))) return true;
    return set.has(normalizeClipNodeKey(modelId, nodeId));
  }

  /**
   * 点选片段：视口落到该片段播完后的目标态（含此前片段的结束姿态 + 本段运镜 + 全部目标外观）。
   */
  function previewChapterAtClipEnd(
    ch: Chapter,
    clip: AnimationClip,
    opts?: { applyCamera?: boolean }
  ) {
    cancelAllPendingVisualRebuilds();
    if (animDirty.value) persistClipsEditorOnly(ch, { skipUiBump: true });
    buildChapterPlaybackCacheFromClips(ch);
    const start = Math.max(0, clip.start ?? 0);
    const end = Math.max(start, clip.end ?? start);
    // 落在本片段窗内，避免 end 边界被判定成下一段（片段3 却套上片段4）
    const elapsed =
      end - start > 1e-6 ? Math.min(Math.max(0, end - 1e-3), start + (end - start) * 0.999) : start;
    const prevLock = _chAnimLock;
    const prevWall = chAnimWallclock;
    _chAnimLock = true;
    chAnimWallclock = false;
    applyChapterPoseOnlyAtElapsed(ch, elapsed);
    // 先清掉不在本片段的目标外观残留，再套当前片段全部目标
    applyPlaybackVisibilityFast(ch, elapsed, true);
    // 显式套当前选中片段全部目标，不依赖 findActiveClipAtElapsed / light 主目标
    applyClipTargetsEditorPreview(clip, "end");
    _chAnimLock = prevLock;
    chAnimWallclock = prevWall;
    if (opts?.applyCamera !== false) {
      const cam = clip.camera || ch.camera;
      if (cam) applyCameraConfigImmediate(cam);
    }
    if (selModel.value && animSegments[0]) {
      showPivotHelpers(selModel.value.id, animSegments[0]);
      updateActivePivotHelper(selModel.value.id);
    }
    // 保留播放缓存供随后点播放复用；勿清空否则大体量要重建一遍
    syncTransformVisualOverlays();
    syncModelConfigOutlinePass();
    renderViewportFrame();
  }

  function selectAnimationClip(
    clipId: string,
    opts?: { applyCamera?: boolean; /** 切章进入：只激活片段 UI，不 selectModel/reveal/刷 mesh */ uiOnly?: boolean }
  ) {
    const ch = selectedChapter.value;
    if (!ch) return;
    suppressClipUiCommits();

    // 切章首帧：禁止 ensure/migrate/rebuild editedSet/heal（刷新后首点卡死主因）
    if (opts?.uiOnly) {
      sealHeavyClipsInChapter(ch);
      const clips = Array.isArray(ch.clips) ? ch.clips : [];
      const clip = clips.find(c => c.id === clipId);
      if (!clip) return;
      cancelAllPendingVisualRebuilds();
      activeAnimClipId.value = clip.id;
      editingSegMode.value = "end";
      lastClipViewportOverlayKeys = [];
      animSegments.splice(0);
      animSegmentsOwnerKey = null;
      editingSeg.value = null;
      mAni.value = false;
      animDirty.value = false;
      // 切章不要预选 targets[0]：会立刻展开模型编辑器并扫片段列表，点选后整页持续卡
      activeClipTargetKeys.value = [];
      activeClipTargetKey.value = null;
      clipSelectAnchorKey = null;
      clipDraftTargetKey.value = null;
      activeClipSelectedKeySet.value = new Set();
      // 不在此处扫全量 targets 建 editedSet；空闲再建，且禁止 timeout 强行打断交互
      activeClipEditedKeySet.value = new Set();
      animClipListRevision.value++;
      const snapClipId = clip.id;
      const snapChId = ch.id;
      const rebuildEdited = () => {
        if (activeAnimClipId.value !== snapClipId || selectedChapterId.value !== snapChId) return;
        rebuildActiveClipEditedKeySet();
      };
      if (typeof requestIdleCallback === "function") {
        requestIdleCallback(rebuildEdited);
      } else {
        window.setTimeout(rebuildEdited, 1500);
      }
      return;
    }

    const clips = ensureChapterClips(ch);
    sealHeavyClipsInChapter(ch);
    ensureEditModeWithoutHeavyProjection(ch);
    rebuildClipAbsoluteTimes(clips);
    const clip = clips.find(c => c.id === clipId);
    if (!clip) return;

    cancelAllPendingVisualRebuilds();

    // 切片段前：只落盘 clips，不投影到 modelConfigs（100+ 目标投影会让整编辑器持续卡顿）
    if (activeAnimClipId.value && activeAnimClipId.value !== clipId) {
      persistActiveClipEditorState();
      if (!isHeavyClipChapter(ch) && !isHeavyEditNavChapter(ch)) {
        clearClipProjectedAnimConfigs(ch);
      }
    }
    // 清掉其它片段残留效果（否则点片段3仍可能留着片段4轮廓）
    restoreOtherClipsViewportState(ch, clip);
    lastClipViewportOverlayKeys = [];

    activeAnimClipId.value = clip.id;
    editingSegMode.value = "end";

    if (clip.targets.length > 0) {
      const prefer =
        clip.targets.find(t => normalizeClipNodeKey(t.modelId, t.nodeId ?? null) === activeClipTargetKey.value) ||
        clip.targets[0];
      const key = normalizeClipNodeKey(prefer.modelId, prefer.nodeId ?? null);
      setClipTargetSelection([key], key);
      clipSelectAnchorKey = key;
      clipDraftTargetKey.value = null;
      lastClipViewportOverlayKeys = (clip.targets || []).map(t =>
        normalizeClipNodeKey(t.modelId, t.nodeId ?? null)
      );
      withClipAutoCommitSuppressed(() => {
        loadClipTargetIntoEditor(clip, prefer, {
          focusCamera: false,
          skipViewport: true,
          previewMode: "end",
          skipReveal: true
        });
      });
      previewChapterAtClipEnd(ch, clip, { applyCamera: opts?.applyCamera !== false });
    } else {
      lastClipViewportOverlayKeys = [];
      setClipTargetSelection([]);
      clipSelectAnchorKey = null;
      clipDraftTargetKey.value = null;
      animSegments.splice(0);
      animSegmentsOwnerKey = null;
      editingSeg.value = null;
      mAni.value = false;
      previewChapterAtClipEnd(ch, clip, { applyCamera: opts?.applyCamera !== false });
    }
    animDirty.value = false;
    bumpAnimClipListRevision();
  }

  function applyCameraConfigImmediate(
    cam: { position: number[]; target: number[]; fov: number; transitionSec?: number },
    opts?: { skipUiBump?: boolean }
  ) {
    camP[0] = cam.position[0];
    camP[1] = cam.position[1];
    camP[2] = cam.position[2];
    camT[0] = cam.target[0];
    camT[1] = cam.target[1];
    camT[2] = cam.target[2];
    camFov.value = cam.fov;
    if (cam.transitionSec != null) camTransitionSec.value = cam.transitionSec;
    if (camera && controls) {
      camTrans = null;
      camTransAdvanceLastAt = 0;
      cameraAnimating = false;
      isCameraTransitioning.value = false;
      camera.position.set(cam.position[0], cam.position[1], cam.position[2]);
      controls.target.set(cam.target[0], cam.target[1], cam.target[2]);
      camera.fov = cam.fov;
      camera.updateProjectionMatrix();
      camera.lookAt(controls.target);
      finishCameraAnimationState();
    }
    if (!opts?.skipUiBump) cameraFormRevision.value++;
  }

  function addAnimationClip() {
    const ch = selectedChapter.value;
    if (!ch) {
      toastShow("请先选择动画节点", "warning");
      return;
    }
    persistActiveClipEditorState();
    const clips = ensureChapterClips(ch);
    ensureClipTimingFields(clips);
    const clip = createAnimationClip({
      name: `片段 ${clips.length + 1}`,
      pauseTime: DEFAULT_CLIP_PAUSE_TIME,
      animTime: DEFAULT_CLIP_ANIM_TIME,
      camera: ch.camera,
      targets: []
    });
    clips.push(clip);
    rebuildClipAbsoluteTimes(clips);
    invalidateChapterAnimTargetsCache(ch.id);
    animDirty.value = true;
    bumpAnimClipListRevision();
    selectAnimationClip(clip.id);
    toastShow(`已添加 ${clip.name}`);
  }

  function removeAnimationClip(clipId: string) {
    const ch = selectedChapter.value;
    if (!ch?.clips) return;
    if (ch.clips.length <= 1) {
      toastShow("至少保留一个片段", "warning");
      return;
    }
    const idx = ch.clips.findIndex(c => c.id === clipId);
    if (idx < 0) return;
    const removed = ch.clips[idx];
    const removedKeys = (removed.targets || []).map(t =>
      normalizeClipNodeKey(t.modelId, t.nodeId ?? null)
    );
    ch.clips.splice(idx, 1);
    rebuildClipAbsoluteTimes(ch.clips);
    for (const key of removedKeys) {
      const { modelId, nodeId } = parseClipTargetKey(key);
      clearProjectedAnimForTarget(ch, modelId, nodeId);
    }
    restoreMeshesForClipKeys(removedKeys);
    clearClipProjectedAnimConfigs(ch);
    if (activeAnimClipId.value === clipId) {
      activeAnimClipId.value = ch.clips[Math.min(idx, ch.clips.length - 1)]?.id ?? null;
      activeClipTargetKey.value = null;
      animSegments.splice(0);
    }
    animDirty.value = true;
    bumpAnimClipListRevision();
    if (activeAnimClipId.value) selectAnimationClip(activeAnimClipId.value);
    else syncActiveClipViewportPreview({ mode: "end", light: true });
    toastShow("已移除片段");
  }

  function updateActiveClipTime(field: "start" | "end", value: number) {
    if (clipUiSyncing) return;
    const clip = getActiveAnimationClip();
    const ch = selectedChapter.value;
    if (!clip || !ch?.clips) return;
    ensureClipTimingFields(ch.clips);
    const idx = ch.clips.findIndex(c => c.id === clip.id);
    if (idx < 0) return;
    const prevEnd = idx > 0 ? ch.clips[idx - 1].end : 0;
    if (field === "start") {
      const start = roundAnimNum(Math.max(0, value));
      if (Math.abs((clip.start ?? 0) - start) <= 1e-3) return;
      const anim = resolveClipAnimTime(clip);
      clip.start = start;
      clip.animTime = anim;
      clip.end = roundAnimNum(start + anim);
      clip.pauseTime = roundAnimNum(Math.max(0, start - prevEnd));
    } else {
      const start = clip.start ?? 0;
      const end = roundAnimNum(Math.max(start, value));
      if (Math.abs((clip.end ?? 0) - end) <= 1e-3) return;
      clip.start = start;
      clip.end = end;
      clip.animTime = roundAnimNum(Math.max(0, end - start));
      clip.pauseTime = roundAnimNum(Math.max(0, start - prevEnd));
    }
    rebuildClipAbsoluteTimes(ch.clips);
    const r = syncClipTimes(ch.clips);
    if (!r.ok) toastShow(r.error || "片段时间无效", "warning");
    // 刻意不同步姿态 timing：片段起止与姿态间隔/起始→结束互相独立
    animDirty.value = true;
    bumpAnimClipListRevision();
    syncAnimationNodeDurationToContent(ch, { silent: true });
  }

  /** 姿态面板：间隔时间 / 起始→结束（写入当前目标，不改片段窗长） */
  function updateActiveClipTiming(field: "pauseTime" | "animTime", value: number) {
    const clip = getActiveAnimationClip();
    const seg = animSegments[0];
    if (!clip || !seg) return;
    const next = roundAnimNum(Math.max(0, Number(value) || 0));
    const prev = field === "pauseTime" ? Number(seg.pauseTime ?? 0) : Number(seg.animTime ?? 0);
    if (Math.abs(prev - next) <= 1e-4) return;
    if (field === "pauseTime") seg.pauseTime = next;
    else seg.animTime = next;
    const pause = roundAnimNum(Math.max(0, seg.pauseTime ?? 0));
    const anim = roundAnimNum(Math.max(0, seg.animTime ?? 0));
    seg.pauseTime = pause;
    seg.animTime = anim;
    seg.start = roundAnimNum((clip.start ?? 0) + pause);
    seg.end = roundAnimNum(seg.start + anim);
    editingSeg.value = seg;
    animDirty.value = true;
    if (!clipAutoCommitSuppressed) scheduleLiveClipBatch();
  }

  function renameActiveClip(name: string) {
    const clip = getActiveAnimationClip();
    if (!clip) return;
    clip.name = name.trim() || clip.name;
    animDirty.value = true;
    bumpAnimClipListRevision();
  }

  function captureCameraToActiveClip() {
    const ch = selectedChapter.value;
    const clip = getActiveAnimationClip();
    if (!ch || !clip || !camera || !controls) {
      toastShow("请先选择片段", "warning");
      return;
    }
    const position = roundVec3([camera.position.x, camera.position.y, camera.position.z]) as [
      number,
      number,
      number
    ];
    const target = roundVec3([controls.target.x, controls.target.y, controls.target.z]) as [
      number,
      number,
      number
    ];
    clip.camera = cloneCameraConfig({
      position,
      target,
      fov: camera.fov,
      transitionSec: clip.camera?.transitionSec ?? camTransitionSec.value
    });
    // 同步节点默认镜头，保持表单一致
    ch.camera = cloneCameraConfig(clip.camera);
    applyCameraConfigImmediate(clip.camera);
    animDirty.value = true;
    bumpAnimClipListRevision();
    toastShow("已捕获运镜到当前片段");
  }

  /** 更新当前片段运镜参数（时间 / 位置 / 目标 / FOV） */
  function updateActiveClipCamera(
    patch: Partial<{
      transitionSec: number;
      position: [number, number, number];
      target: [number, number, number];
      fov: number;
      positionAxis: { axis: 0 | 1 | 2; value: number };
      targetAxis: { axis: 0 | 1 | 2; value: number };
    }>
  ) {
    if (clipUiSyncing) return;
    const ch = selectedChapter.value;
    const clip = getActiveAnimationClip();
    if (!ch || !clip) return;
    const base = cloneCameraConfig(clip.camera || ch.camera);
    if (patch.transitionSec != null) {
      base.transitionSec = roundAnimNum(Math.max(0, patch.transitionSec));
    }
    if (patch.fov != null) base.fov = patch.fov;
    if (patch.position) base.position = [...patch.position] as [number, number, number];
    if (patch.target) base.target = [...patch.target] as [number, number, number];
    if (patch.positionAxis) {
      base.position[patch.positionAxis.axis] = patch.positionAxis.value;
    }
    if (patch.targetAxis) {
      base.target[patch.targetAxis.axis] = patch.targetAxis.value;
    }
    if (cameraConfigsNearlyEqual(clip.camera || ch.camera, base)) return;
    clip.camera = base;
    if (!cameraConfigsNearlyEqual(ch.camera, base)) {
      ch.camera = cloneCameraConfig(base);
    }
    applyCameraConfigImmediate(base);
    animDirty.value = true;
    bumpAnimClipListRevision();
  }

  function listClipTargetCandidates(): Array<{ modelId: string; nodeId: string | null; label: string; key: string }> {
    const clip = getActiveAnimationClip();
    const existing = new Set((clip?.targets || []).map(t => clipTargetKey(t.modelId, t.nodeId)));
    const out: Array<{ modelId: string; nodeId: string | null; label: string; key: string }> = [];
    const walk = (modelId: string, modelName: string, nodes: ModelHierarchyNode[]) => {
      for (const n of nodes) {
        const key = clipTargetKey(modelId, n.id);
        if (!existing.has(key)) {
          out.push({ modelId, nodeId: n.id, label: `${modelName} / ${n.name}`, key });
        }
        if (n.children?.length) walk(modelId, modelName, n.children);
      }
    };
    for (const m of models.value) {
      const rootKey = clipTargetKey(m.id, null);
      if (!existing.has(rootKey)) {
        out.push({ modelId: m.id, nodeId: null, label: m.name, key: rootKey });
      }
      walk(m.id, m.name, getModelHierarchy(m.id));
    }
    return out;
  }

  function addClipTarget(modelId: string, nodeId: string | null = null) {
    const clip = getActiveAnimationClip();
    const ch = selectedChapter.value;
    const model = models.value.find(m => m.id === modelId);
    if (!clip || !ch || !model) {
      toastShow("请先选择片段", "warning");
      return;
    }
    const key = clipTargetKey(modelId, nodeId);
    if (clip.targets.some(t => clipTargetKey(t.modelId, t.nodeId) === key)) {
      const existing = clip.targets.find(t => clipTargetKey(t.modelId, t.nodeId) === key)!;
      setClipTargetSelection([key], key);
      loadClipTargetIntoEditor(clip, existing, { focusCamera: true });
      return;
    }
    writeLiveTargetBackToActiveClip();
    const { pos, scale, rot } = getDefaultTransformForAnimTarget(model, nodeId);
    const target = createEmptyClipTarget(modelId, nodeId, { pos, scale, rot });
    clip.targets.push(target);
    animDirty.value = true;
    setClipTargetSelection([key], key);
    clipDraftTargetKey.value = null;
    bumpAnimClipListRevision();
    loadClipTargetIntoEditor(clip, target, { focusCamera: true });
  }

  function addSelectedModelToActiveClip() {
    if (!selModel.value) {
      toastShow("请先在场景中选中模型", "warning");
      return;
    }
    addClipTarget(selModel.value.id, selModelNodeId.value);
  }

  function removeClipTarget(modelId: string, nodeId: string | null = null) {
    const clip = getActiveAnimationClip();
    const ch = selectedChapter.value;
    if (!clip || !ch) return;
    const key = normalizeClipNodeKey(modelId, nodeId);
    const beforeLen = clip.targets.length;
    clip.targets = clip.targets.filter(
      t => normalizeClipNodeKey(t.modelId, t.nodeId ?? null) !== key
    );
    if (clip.targets.length === beforeLen) return;

    const nextKeys = activeClipTargetKeys.value.filter(k => k !== key);
    setClipTargetSelection(nextKeys);
    if (clipDraftTargetKey.value === key) clipDraftTargetKey.value = null;
    if (activeClipTargetKey.value === key || !activeClipTargetKey.value) {
      if (nextKeys.length && clip.targets.length) {
        const p = parseClipTargetKey(nextKeys[nextKeys.length - 1]);
        const t = clip.targets.find(
          x => normalizeClipNodeKey(x.modelId, x.nodeId ?? null) === nextKeys[nextKeys.length - 1]
        );
        if (t) loadClipTargetIntoEditor(clip, t, { focusCamera: false });
        else {
          const m = models.value.find(mm => mm.id === p.modelId);
          if (m) prepareClipDraftForModel(m, p.nodeId);
        }
      } else if (clip.targets[0]) {
        const k = normalizeClipNodeKey(clip.targets[0].modelId, clip.targets[0].nodeId ?? null);
        setClipTargetSelection([k], k);
        loadClipTargetIntoEditor(clip, clip.targets[0], { focusCamera: false });
      } else {
        animSegments.splice(0);
        editingSeg.value = null;
        mAni.value = false;
      }
    }
    clearProjectedAnimForTarget(ch, modelId, nodeId);
    restoreMeshesForClipKeys([key]);
    syncActiveClipViewportPreview({
      mode: editingSegMode.value || "start",
      light: isHeavyClipTargetSet()
    });
    animDirty.value = true;
    bumpAnimClipListRevision();
  }

  /** 将片段投影到 modelConfigs 并延长节点时长 */
  function persistAnimationClipsToChapter(
    ch: Chapter,
    opts?: { silentUi?: boolean }
  ) {
    persistActiveClipEditorState();
    // 注意：不要在「刚移除」后又被 commit 把模型加回来；仅回写已在 targets 中的
    writeLiveTargetBackToActiveClip();
    const clips = ensureChapterClips(ch);
    rebuildClipAbsoluteTimes(clips);
    const timeOk = syncClipTimes(clips);
    if (!timeOk.ok) {
      toastShow(timeOk.error || "片段时间无效", "warning");
      return false;
    }

    resyncChapterClipsProjection(ch);

    // 节点默认镜头取最后片段运镜
    const lastClip = [...clips].sort((a, b) => a.end - b.end).pop();
    if (lastClip?.camera) {
      ch.camera = cloneCameraConfig(lastClip.camera);
    }

    const contentDur = Math.max(getClipsTotalDuration(clips), 0.1);
    const windowDur = Math.max(0.1, (ch.endTime ?? 0) - (ch.startTime ?? 0));
    if (contentDur > windowDur + 0.05) {
      chStore.updateChapter(ch, { endTime: roundAnimNum((ch.startTime ?? 0) + contentDur) });
      syncChapterForm(ch);
    }

    animDirty.value = false;
    // 播放/大体量：勿 bump 整树，否则 144 节点 Vue 重算会卡死主线程
    if (opts?.silentUi) {
      rebuildActiveClipEditedKeySet();
    } else {
      bumpAnimClipListRevision();
    }
    return true;
  }

  function saveAnimationClips() {
    const ch = selectedChapter.value;
    if (!ch) {
      toastShow("请先选择动画节点", "warning");
      return;
    }
    if (savingClips.value || savingScene.value) return;
    void runSaveAnimationClips(ch);
  }

  async function runSaveAnimationClips(ch: Chapter) {
    savingClips.value = true;
    setPersistProgress(8, "正在保存动画...");
    try {
      await yieldToUi();
      setPersistProgress(45, "正在写入片段数据...");
      persistClipsEditorOnly(ch, { markSceneDirty: true });
      clipsAwaitingSceneSave.value = true;
      rebuildActiveClipEditedKeySet();
      await yieldToUi();
      setPersistProgress(100, "动画已保存");
      await new Promise(r => setTimeout(r, 180));
      toastShow(
        sceneCode.value
          ? "动画已保存，请点击右上角「更新」同步到服务器"
          : "动画已保存，请点击右上角「保存」同步到服务器"
      );
    } catch (e: any) {
      toastShow("动画保存失败: " + (e?.message || "未知错误"), "error");
    } finally {
      savingClips.value = false;
      clearPersistProgress();
    }
  }

  /**
   * 把 clips 投影到「普通对象」章节（用于保存 payload），不写回编辑器响应式 modelConfigs。
   */
  function projectClipsOntoPlainChapter(ch: Chapter) {
    const clips = ch.clips;
    if (!clips?.length) return;
    rebuildClipAbsoluteTimes(clips);
    const touched = projectClipsToModelAnimConfigs(
      clips,
      (modelId, nodeId) => getWritableModelConfigForTarget(ch, modelId, nodeId),
      (modelId, nodeId) => {
        if (!ch.modelConfigs?.[modelId]) return;
        if (!nodeId) {
          const cfg = ch.modelConfigs[modelId] as ModelConfig;
          delete cfg.animConfig;
          cfg.animation = false;
          return;
        }
        const displayId = resolveDisplayNodeId(getModelHierarchy(modelId), nodeId);
        const nodeCfg = ch.modelConfigs[modelId]?.nodeConfigs?.[displayId];
        if (!nodeCfg) return;
        delete nodeCfg.animConfig;
        nodeCfg.animation = false;
      }
    );
    for (const key of touched) {
      const { modelId, nodeId } = parseClipTargetKey(key);
      const cfg = getWritableModelConfigForTarget(ch, modelId, nodeId);
      const segs = cfg.animConfig?.segments;
      if (!segs?.length) continue;
      const obj = getTransformTarget(modelId, nodeId);
      const easing = (cfg.animConfig as any)?.easing || "easeInOut";
      cfg.animConfig = {
        ...cfg.animConfig!,
        relativeTransform: false,
        segments: segs.map((s: any) => serializeAnimSegmentForPersist(s, obj, easing)) as any
      };
    }
  }

  /** 预览整动画：从当前选中片段起按各段参数依次播；无选中则从第一段开始 */
  function playChapterClipsWallclock(ch: Chapter, opts?: { fromElapsed?: number }) {
    suppressClipUiCommits();
    const previewGeneration = ++chapterPreviewGeneration;
    const sourceVideoId = ch.parentId ?? null;
    chAnimChapterId = ch.id;
    chAnimWallclock = true;
    const clips = ensureChapterClips(ch);
    rebuildClipAbsoluteTimes(clips);
    const fromElapsed = Math.max(0, opts?.fromElapsed ?? 0);
    const maxDurHint = Math.max(0.1, getClipsTotalDuration(clips));
    totalPlaying.value = true;
    totalProgress.value = fromElapsed > 0 ? fromElapsed / maxDurHint : 0;
    clipPlayElapsed.value = fromElapsed;
    clipPlayDuration.value = maxDurHint;

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (
          previewGeneration !== chapterPreviewGeneration ||
          selectedChapter.value?.id !== ch.id ||
          (sourceVideoId && activeVideoId.value !== sourceVideoId) ||
          !chapters.value.some(item => item.id === ch.id)
        ) {
          if (previewGeneration === chapterPreviewGeneration) stopChapterAnimation();
          return;
        }
        if (animDirty.value) persistClipsEditorOnly(ch, { skipUiBump: true });
        else sealHeavyClipsInChapter(ch);
        buildChapterPlaybackCacheFromClips(ch);
        lastClipViewportOverlayKeys = [];
        const ok = restartChapterPreviewPlayback(ch, {
          skipPreparePersist: true,
          fromElapsed
        });
        if (!ok) {
          totalPlaying.value = false;
          chAnimWallclock = false;
          chAnimChapterId = null;
          toastShow("当前动画暂无内容可播放", "warning");
        }
      });
    });
  }

  function playAnimationClipsOnce() {
    const ch = selectedChapter.value;
    if (!ch) {
      toastShow("请先选择动画节点", "warning");
      return;
    }
    playChapterClipsWallclock(ch, { fromElapsed: 0 });
  }

  function playActiveClipOnce() {
    const ch = selectedChapter.value;
    const clip = getActiveAnimationClip();
    if (!ch || !clip) {
      toastShow("请先选择片段", "warning");
      return;
    }
    const previewGeneration = ++chapterPreviewGeneration;
    const sourceVideoId = ch.parentId ?? null;
    totalPlaying.value = true;
    totalProgress.value = 0;
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (
          previewGeneration !== chapterPreviewGeneration ||
          selectedChapter.value?.id !== ch.id ||
          (sourceVideoId && activeVideoId.value !== sourceVideoId) ||
          !chapters.value.some(item => item.id === ch.id)
        ) {
          if (previewGeneration === chapterPreviewGeneration) stopChapterAnimation();
          return;
        }
        if (animDirty.value) persistClipsEditorOnly(ch, { skipUiBump: true });
        else sealHeavyClipsInChapter(ch);
        buildChapterPlaybackCacheFromClips(ch);
        lastClipViewportOverlayKeys = [];
        const ok = restartChapterPreviewPlayback(ch, { skipPreparePersist: true });
        if (!ok) {
          totalPlaying.value = false;
          toastShow("当前片段暂无内容可播放", "warning");
        }
      });
    });
  }

  function clearAnimationClips() {
    const ch = selectedChapter.value;
    if (!ch) return;
    for (const t of collectChapterAnimTargetSegments(ch)) {
      const cfg = getWritableModelConfigForTarget(ch, t.modelId, t.nodeId);
      delete cfg.animConfig;
      pruneActiveTargetModelConfigIfUnedited(ch, t.modelId, t.nodeId);
    }
    ch.clips = [
      createAnimationClip({
        name: "片段 1",
        pauseTime: DEFAULT_CLIP_PAUSE_TIME,
        animTime: DEFAULT_CLIP_ANIM_TIME,
        camera: ch.camera,
        targets: []
      })
    ];
    rebuildClipAbsoluteTimes(ch.clips);
    activeAnimClipId.value = ch.clips[0].id;
    setClipTargetSelection([]);
    clipDraftTargetKey.value = null;
    animSegments.splice(0);
    animDirty.value = false;
    invalidateChapterAnimTargetsCache(ch.id);
    bumpAnimClipListRevision();
    toastShow("已清除动画数据");
  }

  function syncAnimClipsForSelectedChapter(opts?: { uiOnly?: boolean }) {
    const ch = selectedChapter.value;
    if (!ch) {
      activeAnimClipId.value = null;
      setClipTargetSelection([]);
      clipDraftTargetKey.value = null;
      animClipListRevision.value++;
      return;
    }

    // 切章首帧：只激活片段 id；禁止 clear 投影 / migrate / 扫 editedSet（会卡死）
    if (opts?.uiOnly) {
      // 无 clips 时只补空默认片段，绝不 migrate 大体量 modelConfigs
      const clips = ensureDefaultEmptyClip(ch);
      sealHeavyClipsInChapter(ch);
      if (!clips.length) {
        activeAnimClipId.value = null;
        setClipTargetSelection([]);
        clipDraftTargetKey.value = null;
        animClipListRevision.value++;
        return;
      }
      const current = clips.find(c => c.id === activeAnimClipId.value);
      selectAnimationClip((current || clips[0]).id, { applyCamera: false, uiOnly: true });
      // 清投影改到首次真正编辑/预览（ensureEditModeWithoutHeavyProjection），
      // 点选后 idle 强行扫 100+ nodeConfigs 会让整页持续卡死。
      return;
    }

    if (ch.clips?.length) {
      clearClipProjectedAnimConfigs(ch);
      sealHeavyClipsInChapter(ch);
      editModeProjectionClearedChapterId = ch.id;
    }
    const clips = ensureChapterClips(ch);
    const current = clips.find(c => c.id === activeAnimClipId.value);
    selectAnimationClip((current || clips[0]).id, {
      applyCamera: false,
      uiOnly: false
    });
  }

  /** 先让选中态上屏，再同步片段预览，避免首点动画主线程堵死几秒 */
  function scheduleSyncAnimClipsForSelectedChapter() {
    const chId = selectedChapterId.value;
    const gen = ++pendingClipSyncGen;
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (gen !== pendingClipSyncGen) return;
        if (selectedChapterId.value !== chId) return;
        if (viewOnly.value || isPreviewMode.value) return;
        // 默认 uiOnly：全量 sync 会 clear 投影 + 刷 mesh，刷新后首点可卡 10s+
        syncAnimClipsForSelectedChapter({ uiOnly: true });
      });
    });
  }

  // —— 兼容旧「模型轨」命名，转调片段 API ——
  function animationTrackKey(modelId: string, nodeId?: string | null) {
    return clipTargetKey(modelId, nodeId);
  }
  function listAnimationTracks() {
    return [] as any[];
  }
  function listAnimationTrackCandidates() {
    return listClipTargetCandidates();
  }
  function selectAnimTrack(modelId: string, nodeId: string | null = null) {
    selectClipTarget(modelId, nodeId);
  }
  function addAnimationTrack(modelId: string, nodeId: string | null = null) {
    addClipTarget(modelId, nodeId);
  }
  function removeAnimationTrack(modelId: string, nodeId: string | null = null) {
    removeClipTarget(modelId, nodeId);
  }
  function playAnimationTracksOnce() {
    playAnimationClipsOnce();
  }
  function saveActiveAnimTrack() {
    saveAnimationClips();
  }
  function syncAnimTracksForSelectedChapter() {
    syncAnimClipsForSelectedChapter();
  }
  function bumpAnimTrackListRevision() {
    bumpAnimClipListRevision();
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
    const obj = model ? getTransformTarget(model.id, nid ?? null) : null;
    cfg.animConfig = {
      duration,
      easing,
      relativeTransform: false,
      segments: segs.map(s => serializeAnimSegmentForPersist(s, obj, easing))
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
    if (!commitAnimClipAbsoluteTimes()) return;
    bindAnimSegmentsToSelection(mid, nid, ch.id);
    persistAnimConfigToChapterFor(ch, mid, nid, animSegments);
    const extended = syncAnimationNodeDurationToContent(ch, { silent: true });
    animDirty.value = false;

    // 同步会话缓存（已保存、未脏），切换模型后可直接恢复
    selectionEditDrafts.set(selectionDraftKey(ch.id, mid, nid), {
      animSegments: cloneAnimSegmentsForDraft(animSegments),
      animDuration: animDuration.value,
      animEasing: animEasing.value,
      animDirty: false,
      form: { ...getModelFormSnapshot() }
    });

    const seg = editingSeg.value && animSegments.some(s => s.id === editingSeg.value.id)
      ? editingSeg.value
      : animSegments[0];
    if (seg) {
      applyAnimSegmentTransformToMesh(
        selModel.value,
        nid,
        seg,
        resolveAnimPreviewMode(seg, selModel.value, nid)
      );
    }
    bumpAnimSegmentRevision();
    if (extended) {
      syncChapterForm(ch);
      toastShow(
        nid
          ? `子层级动画已保存，节点时长已延长至 ${getAnimationContentDuration(ch).toFixed(1)}s`
          : `动画已保存，节点时长已延长至 ${getAnimationContentDuration(ch).toFixed(1)}s`
      );
    } else {
      toastShow(nid ? "子层级动画已保存" : "动画已保存");
    }
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
    flushPendingClipIntro();
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
    if (seg.clipVisual) {
      for (const o of objs) delete o.userData._clipVisualSig;
      applyClipVisualToObjects(m, objs, serializeClipVisual(seg.clipVisual), seg.id, false);
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
    const dur = Math.max(0, seg.animTime ?? 0) * 1000;
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
        const t = dur <= 1e-8 ? 1 : Math.min(el / dur, 1);
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
    flushPendingClipIntro();
    if (totalPlaying.value) return;
    stopSegmentPlayback();
    const playbackGen = segmentPlaybackGeneration;
    totalPlaying.value = true;
    totalProgress.value = 0;
    let totalDur = 0;
    const times: number[] = [];
    for (let s = 0; s < animSegments.length; s++) {
      totalDur += (animSegments[s].pauseTime || 0) + (animSegments[s].animTime ?? 0);
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
    if (first.clipVisual) {
      for (const o of objs) delete o.userData._clipVisualSig;
      applyClipVisualToObjects(m, objs, serializeClipVisual(first.clipVisual), first.id, false);
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
      const t = totalDur <= 1e-8 ? 1 : Math.min(el / (totalDur * 1000), 1);
      const absT = t * totalDur;
      let cumT = 0;
      for (let s = 0; s < animSegments.length; s++) {
        const seg = animSegments[s];
        let segTotal = (seg.pauseTime || 0) + (seg.animTime ?? 0);
        const matchSpan = Math.max(segTotal, 1e-6);
        if (absT >= cumT && absT <= cumT + matchSpan) {
          const localT = absT - cumT;
          const pauseT = seg.pauseTime || 0;
          const animDur = Math.max(0, seg.animTime ?? 0);
          const pc = seg._animPivotCache;
          const absStart = segModeToAbsoluteTransform(m, selModelNodeId.value, seg, "start");
          const absEnd = segModeToAbsoluteTransform(m, selModelNodeId.value, seg, "end");
          for (const o of objs) {
            if (animDur <= 1e-8) {
              applyPivotPathFrame(o, absEnd.pos, absEnd.rot, pc, 1);
              o.scale.setScalar(seg.endScale);
            } else if (localT < pauseT) {
              applyPivotPathFrame(o, absStart.pos, absStart.rot, pc, 0);
              o.scale.setScalar(seg.startScale);
            } else {
              const animT = (localT - pauseT) / animDur;
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
          if (seg.clipVisual) {
            applyClipVisualToObjects(m, objs, serializeClipVisual(seg.clipVisual), seg.id, false);
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
    const absStart = segModeToAbsoluteTransform(m, selModelNodeId.value, seg, "start");
    const absEnd = segModeToAbsoluteTransform(m, selModelNodeId.value, seg, "end");
    const sp = { x: absStart.pos[0], y: absStart.pos[1], z: absStart.pos[2] };
    const ss = seg.startScale;
    const sr = { x: absStart.rot[0], y: absStart.rot[1], z: absStart.rot[2] };
    const ep = { x: absEnd.pos[0], y: absEnd.pos[1], z: absEnd.pos[2] };
    const es = seg.endScale;
    const er = { x: absEnd.rot[0], y: absEnd.rot[1], z: absEnd.rot[2] };
    const dur = Math.max(0, seg.animTime ?? 0) * 1000;
    const easingType = seg.easing || animEasing.value;
    const st = performance.now();
    function tick() {
      if (playbackGen !== segmentPlaybackGeneration) return;
      const el = performance.now() - st;
      const t = dur <= 1e-8 ? 1 : Math.min(el / dur, 1);
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
      resetClipMultiTransformSnap(seg, mode);
      syncActiveClipViewportPreview({
        mode,
        light: true
      });
      updateActivePivotHelper(selModel.value.id);
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
    // liveSeg 内已处理多选增量 + 片段提交 + 叠加预览
    liveSeg(seg, mode);
  }
  let liveClipCommitRaf: number | null = null;
  function scheduleLiveClipBatch() {
    if (liveClipCommitRaf !== null) return;
    const chapterId = selectedChapterId.value;
    const clipId = activeAnimClipId.value;
    liveClipCommitRaf = requestAnimationFrame(() => {
      liveClipCommitRaf = null;
      if (
        selectedChapterId.value !== chapterId ||
        activeAnimClipId.value !== clipId ||
        !clipId ||
        clipAutoCommitSuppressed
      ) {
        return;
      }
      const keyCount = resolveClipPreviewKeys().length;
      if (keyCount > 1) commitTransformToClipSelection({ silentUi: true });
      else commitEditedModelToActiveClip({ silentUi: true });
    });
  }

  function liveSeg(seg: any, mode: "start" | "end" = editingSegMode.value) {
    const m = selModel.value;
    if (!m) return;
    editingSeg.value = seg;
    editingSegMode.value = mode;

    const after = readSegTransformSnap(seg, mode);
    if (activeAnimClipId.value && resolveClipPreviewKeys().length > 1 && clipMultiTransformSnap) {
      const before = clipMultiTransformSnap;
      const delta: ClipTransformSnap = {
        pos: [
          roundAnimNum(after.pos[0] - before.pos[0]),
          roundAnimNum(after.pos[1] - before.pos[1]),
          roundAnimNum(after.pos[2] - before.pos[2])
        ],
        rot: [
          roundAnimNum(after.rot[0] - before.rot[0]),
          roundAnimNum(after.rot[1] - before.rot[1]),
          roundAnimNum(after.rot[2] - before.rot[2])
        ],
        scale: roundAnimNum(after.scale - before.scale)
      };
      applyTransformDeltaToOtherSelected(mode, delta);
    }

    applyAnimSegmentTransformToMesh(m, selModelNodeId.value, seg, mode);
    clipMultiTransformSnap = after;
    updateActivePivotHelper(m.id);
    animDirty.value = true;

    if (activeAnimClipId.value && !clipAutoCommitSuppressed) {
      scheduleLiveClipBatch();
    }
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
      // 编辑态关闭 glow，避免拖动镜头时边缘发虚、闪锯齿
      modelConfigOutlinePass.edgeGlow = 0;
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
    // 轮廓出现/消失时，抗锯齿策略也要同步切换；否则会出现 UI 已是 2x，
    // 但第一次进页仍沿用旧 pass，必须再点一次采样按钮才“看起来生效”。
    syncAntialiasingPasses();
    syncEditorOutlineDownsample();
    syncEditorComposerPasses();
  }

  function clearModelConfigOutlineRegistry() {
    modelConfigOutlineRegistry.forEach((_color, mesh) => {
      delete mesh.userData.configOutlineOwner;
    });
    modelConfigOutlineRegistry.clear();
    if (modelConfigOutlinePass) modelConfigOutlinePass.selectedObjects = [];
    syncAntialiasingPasses();
    syncEditorOutlineDownsample();
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

  function syncVisualOverlayTransforms(modelIds?: Iterable<string>) {
    const roots = modelIds
      ? [...modelIds].map(modelId => meshes.get(modelId)).filter(Boolean) as THREE.Object3D[]
      : [...meshes.values()];
    for (const modelRoot of roots) {
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
    }
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
          color?: THREE.Color;
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
        if (snap.color && "color" in mat && (mat as THREE.MeshBasicMaterial).color) {
          (mat as THREE.MeshBasicMaterial).color.copy(snap.color);
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
    removeVisualOverlaysForOwners(modelRoot, new Set([ownerKey]));
  }

  /** 一次遍历清掉多个 owner 的线框/轮廓叠加，避免多选时对整棵 GLB 扫上百遍 */
  function removeVisualOverlaysForOwners(
    modelRoot: THREE.Object3D,
    ownerKeys: Set<string>,
    hideObjs?: Set<THREE.Object3D> | null
  ) {
    if (!ownerKeys.size && !hideObjs?.size) return;
    const toRemove: THREE.Object3D[] = [];
    const wireMeshes: THREE.Mesh[] = [];
    const highlightMeshes: THREE.Mesh[] = [];
    modelRoot.traverse(c => {
      if (isModelVisualOverlay(c)) {
        const owner = c.userData.outlineOwner as string | undefined;
        if (owner && ownerKeys.has(owner)) {
          toRemove.push(c);
          return;
        }
        if (hideObjs?.size) {
          const src = c.userData.overlaySourceMesh as THREE.Object3D | undefined;
          if (src) {
            let cur: THREE.Object3D | null | undefined = src;
            while (cur) {
              if (hideObjs.has(cur)) {
                toRemove.push(c);
                break;
              }
              cur = cur.parent;
            }
          }
        }
        return;
      }
      if (!(c instanceof THREE.Mesh)) return;
      const ownedWire = !!(c.userData.wireframeOwner && ownerKeys.has(c.userData.wireframeOwner));
      const ownedHighlight = !!(
        c.userData.bodyHighlightOwner && ownerKeys.has(c.userData.bodyHighlightOwner)
      );
      let underHidden = false;
      if (hideObjs?.size && (c.userData.wireframeOwner || c.userData.bodyHighlightOwner)) {
        let cur: THREE.Object3D | null = c;
        while (cur) {
          if (hideObjs.has(cur)) {
            underHidden = true;
            break;
          }
          cur = cur.parent;
        }
      }
      if (ownedWire || (underHidden && c.userData.wireframeOwner)) wireMeshes.push(c);
      if (ownedHighlight || (underHidden && c.userData.bodyHighlightOwner)) highlightMeshes.push(c);
    });
    toRemove.forEach(disposeVisualOverlay);
    for (const key of ownerKeys) unregisterModelConfigOutlineForOwner(modelRoot, key);
    for (const mesh of wireMeshes) restoreWireframeSurface(mesh);
    for (const mesh of highlightMeshes) restoreBodyHighlight(mesh);
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
        wireframe: "wireframe" in mat ? !!(mat as THREE.MeshBasicMaterial).wireframe : false,
        color:
          "color" in mat && (mat as THREE.MeshBasicMaterial).color
            ? (mat as THREE.MeshBasicMaterial).color.clone()
            : undefined
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

  function applyNativeWireframeMaterial(mesh: THREE.Mesh, wireframeColor?: string) {
    ensureUniqueMeshMaterials(mesh);
    const tint = wireframeColor ? new THREE.Color(wireframeColor) : null;
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    for (const mat of mats) {
      (mat as THREE.MeshBasicMaterial).wireframe = true;
      mat.colorWrite = true;
      mat.opacity = 1;
      mat.transparent = false;
      if (tint && "color" in mat && (mat as THREE.MeshBasicMaterial).color) {
        (mat as THREE.MeshBasicMaterial).color.copy(tint);
      }
      mat.needsUpdate = true;
    }
  }

  /** 对单个 mesh 套轮廓/线框；heavy=true 时走轻量路径（原生线框 + OutlinePass，不建 EdgesGeometry） */
  function applyVisualEffectsToMesh(
    modelRoot: THREE.Object3D,
    ownerObj: THREE.Object3D,
    mesh: THREE.Mesh,
    cfg: ModelConfig,
    ownerKey: string,
    colors: { outlineColor: string; wireframeColor: string; modelHighlightColor: string },
    heavy: boolean
  ) {
    try {
      if (cfg.wireframe) {
        const attachOwner = resolveOverlayAttachOwner(modelRoot, ownerObj, mesh);
        if (heavy) {
          // 分组级线框：原生 wireframe + 线框色
          hideMeshSurfaceForWireframe(mesh, ownerKey);
          applyNativeWireframeMaterial(mesh, colors.wireframeColor);
        } else {
          const wireContour = createContourEdgeLines(mesh, colors.wireframeColor, 1, 24, {
            isWireframeOnly: true,
            outlineOwner: ownerKey
          });
          if (wireContour) {
            hideMeshSurfaceForWireframe(mesh, ownerKey);
            attachOverlayToOwner(attachOwner, mesh, wireContour);
          } else {
            hideMeshSurfaceForWireframe(mesh, ownerKey);
            applyNativeWireframeMaterial(mesh, colors.wireframeColor);
          }
        }
        if (cfg.outline) {
          // 轮廓色与线框色分离
          applyOutlineHighlight(mesh, colors.outlineColor, ownerKey);
          if (!heavy) attachOutlineEdgeGlow(attachOwner, mesh, colors.outlineColor, ownerKey);
        }
      } else if (cfg.outline) {
        applyOutlineHighlight(mesh, colors.outlineColor, ownerKey);
        if (!heavy) {
          const attachOwner = resolveOverlayAttachOwner(modelRoot, ownerObj, mesh);
          attachOutlineEdgeGlow(attachOwner, mesh, colors.outlineColor, ownerKey, 12);
        }
      }

      if (cfg.highlight) {
        applyBodyHighlightToMesh(mesh, colors.modelHighlightColor, ownerKey);
        // 高亮会改 mat.color；大体量原生线框需把线框色压回去，高亮色留在 emissive
        if (cfg.wireframe && heavy) {
          applyNativeWireframeMaterial(mesh, colors.wireframeColor);
        }
      }
    } catch {
      /* ignore per-mesh failures */
    }
  }

  function scheduleChunkedVisualRebuild(
    m: Model,
    obj: THREE.Object3D,
    cfg: ModelConfig,
    meshList: THREE.Mesh[],
    ownerKey: string,
    heavy: boolean
  ) {
    const modelRoot = meshes.get(m.id);
    if (!modelRoot) return;
    const token = ++visualRebuildGeneration;
    pendingVisualRebuildOwners.set(ownerKey, token);
    const resolvedCfg = getModelConfig(cfg);
    const colors = {
      outlineColor: resolvedCfg.outlineColor,
      wireframeColor: resolvedCfg.wireframeColor,
      modelHighlightColor: resolvedCfg.modelHighlightColor
    };
    // 大体量分组：每帧只处理少量 mesh，避免点开关时整页卡死
    const chunkSize = heavy ? 6 : 12;
    let index = 0;

    const step = () => {
      if (pendingVisualRebuildOwners.get(ownerKey) !== token) return;
      if (!meshes.get(m.id)) {
        pendingVisualRebuildOwners.delete(ownerKey);
        return;
      }
      const end = Math.min(index + chunkSize, meshList.length);
      for (; index < end; index++) {
        applyVisualEffectsToMesh(modelRoot, obj, meshList[index], cfg, ownerKey, colors, heavy);
      }
      if (index < meshList.length) {
        requestAnimationFrame(step);
        return;
      }
      pendingVisualRebuildOwners.delete(ownerKey);
      syncModelConfigOutlinePass();
      invalidatePickMeshCache();
      renderViewportFrame();
    };
    requestAnimationFrame(step);
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
    // 取消该 owner 上一次未完成的分片重建
    pendingVisualRebuildOwners.set(ownerKey, -1);
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

    const meshesToOutline = collectMeshesForVisualOwner(obj);
    // CNG 这类分组：几十~上百 mesh 同步 EdgesGeometry 会卡死；改轻量路径并分帧
    const HEAVY_VISUAL_MESH_THRESHOLD = 18;
    const heavy = meshesToOutline.length >= HEAVY_VISUAL_MESH_THRESHOLD;

    if (meshesToOutline.length >= 8) {
      scheduleChunkedVisualRebuild(m, obj, cfg, meshesToOutline, ownerKey, heavy);
      // 先同步 OutlinePass 选中态，让用户立刻看到轮廓反馈
      if (cfg.outline) {
        const outlineColor = getModelConfig(cfg).outlineColor;
        for (const mesh of meshesToOutline) {
          applyOutlineHighlight(mesh, outlineColor, ownerKey);
        }
        syncModelConfigOutlinePass();
      }
      invalidatePickMeshCache();
      return;
    }

    const resolvedCfg = getModelConfig(cfg);
    const colors = {
      outlineColor: resolvedCfg.outlineColor,
      wireframeColor: resolvedCfg.wireframeColor,
      modelHighlightColor: resolvedCfg.modelHighlightColor
    };
    for (const c of meshesToOutline) {
      applyVisualEffectsToMesh(modelRoot, obj, c, cfg, ownerKey, colors, false);
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

  /** 交互切章：立刻套目标姿态，视频 seek 后台进行，禁止 await seeked / 整树 reset */
  function kickMediaSeek(target: number, keepPlaying: boolean) {
    const video = videoEl.value;
    if (!video) return;
    const mediaDur = Number.isFinite(video.duration) && video.duration > 0 ? video.duration : 0;
    const storedDur = Number(duration.value) || 0;
    const reloading = video.dataset.editorReloading === "1";
    const durationStale =
      mediaDur > 0 &&
      target > mediaDur + 0.25 &&
      (reloading || storedDur > mediaDur + 0.25 || video.readyState < HTMLMediaElement.HAVE_METADATA);
    presentationSeekTargetTime = target;
    if (durationStale || (reloading && video.readyState < HTMLMediaElement.HAVE_METADATA)) {
      if (keepPlaying) {
        isPlaying.value = true;
        presentationExpectPlaying = true;
      }
      return;
    }
    const t = clampVideoTime(target, video);
    if (Math.abs(t - target) > 0.25) {
      presentationSeekTargetTime = target;
      if (keepPlaying) {
        isPlaying.value = true;
        presentationExpectPlaying = true;
      }
      return;
    }
    currentTime.value = t;
    ++seekGeneration;
    if (!keepPlaying && !video.paused) {
      try {
        video.pause();
      } catch {
        /* ignore */
      }
    }
    try {
      video.currentTime = t;
    } catch {
      /* ignore */
    }
    if (keepPlaying) {
      isPlaying.value = true;
      presentationExpectPlaying = true;
      if (video.paused || video.ended) {
        void video.play().catch(() => {});
      }
    }
  }

  function applyChapterHiddenNodes(ch: Chapter) {
    for (const obj of chapterHiddenRestoreList) {
      obj.visible = true;
    }
    chapterHiddenRestoreList = [];
    const seen = new Set<string>();
    const hiddenNodeIdsByModel = new Map<string, Set<string>>();
    for (const [modelId, raw] of Object.entries(ch.modelConfigs || {})) {
      const root = meshes.get(modelId);
      if (!root) continue;
      seen.add(modelId);
      const cfg = getModelConfig(raw as ModelConfig);
      if (cfg.visible === false) {
        root.visible = false;
        chapterHiddenRestoreList.push(root);
        continue;
      }
      // 配置未隐藏整模时必须露出根节点。上一章 clipVisual/forceHidden 可能把 Scene/CNG 关掉，
      // 本章 clips.targets 又为空时 keep 集为空，视口就会只剩网格。
      root.visible = true;
      const nodeConfigs = (raw as ModelConfig).nodeConfigs;
      if (!nodeConfigs) continue;
      const hiddenIds = new Set<string>();
      for (const [nodeId, nodeCfg] of Object.entries(nodeConfigs)) {
        if (getModelConfig(nodeCfg as ModelConfig).visible !== false) continue;
        hiddenIds.add(nodeId);
        const objs = collectObjectsForNodeId(root, nodeId);
        for (const o of objs) {
          o.visible = false;
          chapterHiddenRestoreList.push(o);
        }
      }
      if (hiddenIds.size) hiddenNodeIdsByModel.set(modelId, hiddenIds);
    }
    meshes.forEach((root, modelId) => {
      if (seen.has(modelId)) return;
      root.visible = true;
    });
    healChapterWorldVisibility(ch, hiddenNodeIdsByModel);
  }

  /** 配置未整体隐藏时，若世界空间里没有任何网格，则打开未被章节显式隐藏的祖先。 */
  function healChapterWorldVisibility(ch: Chapter, hiddenNodeIdsByModel: Map<string, Set<string>>) {
    for (const m of models.value) {
      const root = meshes.get(m.id);
      if (!root) continue;
      const raw = ch.modelConfigs?.[m.id] as ModelConfig | undefined;
      if (raw && getModelConfig(raw).visible === false) continue;
      if (!root.visible) root.visible = true;
      let worldVis = 0;
      root.traverse(obj => {
        const mesh = obj as THREE.Mesh;
        if (!mesh.isMesh) return;
        if (
          obj.userData?.isEdgeLine ||
          obj.userData?.isSelectionHelper ||
          obj.userData?.isOutlineShell ||
          obj.userData?.isBodyHighlightOverlay
        ) {
          return;
        }
        let p: THREE.Object3D | null = obj;
        while (p) {
          if (!p.visible) return;
          p = p.parent;
        }
        worldVis++;
      });
      if (worldVis > 0) continue;
      const hiddenIds = hiddenNodeIdsByModel.get(m.id);
      root.traverse(obj => {
        if (
          obj.userData?.isEdgeLine ||
          obj.userData?.isSelectionHelper ||
          obj.userData?.isOutlineShell ||
          obj.userData?.isBodyHighlightOverlay
        ) {
          return;
        }
        const nodeId = (obj.userData?.nodeId as string) || "";
        if (nodeId && hiddenIds?.has(nodeId)) return;
        if (!obj.visible) obj.visible = true;
      });
    }
  }

  function snapChapterCameraInstant(ch: Chapter, elapsedSec: number) {
    if (!camera || !controls) return;
    if (playbackCameraUserOverride || viewportInteracting) return;
    if (ch.clips?.some(c => c.camera)) {
      applyClipCameraAtElapsed(ch, elapsedSec);
      return;
    }
    if (!ch.camera) return;
    const frame = getStoredChapterCameraFrame(ch);
    snapCam(frame.position, frame.target, ch.camera.fov);
  }

  /** 切到下一章前：把上一章仍停在结束位姿/显隐的目标还原，避免多章模型叠在一起 */
  function restorePlaybackTargetsNotInChapter(nextCh: Chapter) {
    if (lastPlaybackAppliedChapterId === nextCh.id) return;
    playbackVisualGeneration++;
    cancelAllPendingVisualRebuilds();
    const keep = new Set(collectAllChapterClipTargetKeys(nextCh));
    const restore = new Set<string>();
    for (const k of lastPlaybackAppliedKeys) {
      if (!keep.has(k)) restore.add(k);
    }
    for (const k of lastClipViewportOverlayKeys) {
      if (!keep.has(k)) restore.add(k);
    }
    if (restore.size) {
      const nodeKeys: string[] = [];
      const rootKeys: string[] = [];
      for (const k of restore) {
        const { nodeId } = parseClipTargetKey(k);
        if (nodeId) nodeKeys.push(k);
        else rootKeys.push(k);
      }
      if (rootKeys.length) {
        restoreMeshesForClipKeys(rootKeys, { skipOutlineRebuild: true, bindPose: true });
      }
      if (nodeKeys.length) {
        restoreMeshesForClipKeys(nodeKeys, {
          skipOutlineRebuild: true,
          bindPose: true
        });
      }
    }
    if (playbackVisApplied.length) {
      playbackVisApplied = playbackVisApplied.filter(prev => {
        if (keep.has(normalizeClipNodeKey(prev.modelId, (prev.obj.userData?.nodeId as string) || null))) {
          return true;
        }
        const nodeId = (prev.obj.userData?.nodeId as string) || null;
        const key = normalizeClipNodeKey(prev.modelId, nodeId);
        if (!restore.has(key)) {
          restoreChapterStaticVisualForClipTarget(prev.modelId, nodeId, {
            skipOutlineRebuild: true,
            bindPose: true
          });
        }
        return false;
      });
    }
  }

  function markPlaybackAppliedChapter(ch: Chapter) {
    lastPlaybackAppliedChapterId = ch.id;
    const fromCache =
      chapterPlaybackCache?.chapterId === ch.id
        ? (chapterPlaybackCache.targets as Array<{ modelId: string; nodeId?: string | null }>).map(t =>
            normalizeClipNodeKey(t.modelId, t.nodeId ?? null)
          )
        : [];
    lastPlaybackAppliedKeys = [...new Set([...fromCache, ...collectAllChapterClipTargetKeys(ch)])];
    if (lastPlaybackAppliedKeys.length) {
      lastClipViewportOverlayKeys = [...new Set(lastPlaybackAppliedKeys)];
    }
  }

  function applyInteractiveChapterVisual(ch: Chapter, timelineTime: number) {
    const elapsed = Math.max(0, timelineTime - ch.startTime);
    wallclockVisualClipId = null;
    lastClipCameraId = null;
    restorePlaybackTargetsNotInChapter(ch);
    applyChapterVisibilityOnly(ch);
    if (ensurePlaybackCache(ch)) {
      applyChapterWallclockFrame(ch, elapsed);
    } else {
      snapChapterCameraInstant(ch, elapsed);
    }
    applyChapterHiddenNodes(ch);
    markPlaybackAppliedChapter(ch);
    renderViewportFrame();
    enqueueChapterCachePrefetch(ch.parentId);
  }

  function cutPlaybackToTime(
    timelineTime: number,
    chapter?: Chapter | null,
    options?: { keepPlaying?: boolean }
  ) {
    const cutStartedAt = performance.now();
    requestViewportRender();
    const video = videoEl.value;
    const presentation = viewOnly.value || isPreviewMode.value;
    const keepPlaying =
      options?.keepPlaying ??
      (presentation
        ? presentationPlaybackSession.intent === "play"
        : !!(isPlaying.value || (video && !video.paused && !video.ended)));

    const rawChapter =
      chapter ??
      (presentation
        ? getStrictPresentationChapterAtTime(timelineTime) ?? getPlaybackChapterAtTime(timelineTime)
        : chapterAtTime(timelineTime) ?? getPlaybackChapterAtTime(timelineTime));
    const resolved = rawChapter ? resolveChapter(rawChapter) : null;
    const ch = resolved?.chapter ?? rawChapter ?? null;

    chapterPlaybackRequestSeq++;
    pendingClipSyncGen++;
    clearPlaybackSeekLocks();
    cancelCameraTransitionSilently();

    if (ch) {
      if (
        !viewOnly.value &&
        !isPreviewMode.value &&
        animDirty.value &&
        selectedChapterId.value === ch.id &&
        ch.clips?.length
      ) {
        persistClipsEditorOnly(ch, { skipUiBump: true });
        playbackCacheByChapterId.delete(ch.id);
        if (chapterPlaybackCache?.chapterId === ch.id) chapterPlaybackCache = null;
      }
      videoOnlyMode.value = false;
      if (ch.parentId) {
        activeVideoId.value = ch.parentId;
      }
      _chAnimLock = true;
      chAnimWallclock = false;
      chAnimChapterId = ch.id;
      if (keepPlaying) {
        pinChapterPlayback(ch);
      } else {
        chapterPlayTarget.value = null;
        chapterSeekPinId = ch.id;
      }
      editPlaybackSyncChapterId = ch.id;
      editPlaybackSyncElapsed = Math.max(0, timelineTime - ch.startTime);
      editPlaybackCameraChapterId = ch.id;
      const hadCache = playbackCacheByChapterId.has(ch.id);
      applyInteractiveChapterVisual(ch, timelineTime);
      if (ch.parentId) {
        const parentVideo = getNodeById(nodes.value, ch.parentId);
        if (parentVideo && isVideoNode(parentVideo) && parentVideo.videoSrc) {
          ensureVideoBound(parentVideo);
        }
      }
      selectedNodeId.value = ch.id;
      selectedChapterId.value = ch.id;
      playingIdx.value = resolved?.idx ?? getTimelineChapterIndex(ch);
      if (presentation) {
        const nav = resolvePresentationNavChapter(ch);
        Object.assign(presentationPlaybackSession, {
          phase: keepPlaying ? "playing" : "paused",
          intent: keepPlaying ? "play" : "pause",
          targetTime: timelineTime,
          committedTime: timelineTime,
          navChapterId: nav.id,
          playableChapterId: ch.id,
          requestId: presentationPlaybackSession.requestId + 1,
          autoAdvance: false
        });
        syncPresentationUiFromChapter(nav, timelineTime);
      }
      lastVideoPlaybackSyncTime = timelineTime;
      currentTime.value = timelineTime;
      presentationSeekTargetTime = timelineTime;
      bumpPlaybackUiRevision();
      unlockVideoAudio();
      if (presentation) {
        presentationManualNavUntil = Math.max(
          presentationManualNavUntil,
          performance.now() + 900
        );
      }
      if (typeof window !== "undefined") {
        (window as any).__movieEditorLastCut = {
          chapterId: ch.id,
          time: timelineTime,
          ms: Math.round(performance.now() - cutStartedAt),
          cached: hadCache
        };
        (window as any).__movieEditorCacheSize = playbackCacheByChapterId.size;
      }
    } else {
      currentTime.value = timelineTime;
      presentationSeekTargetTime = timelineTime;
    }

    requestAnimationFrame(() => {
      kickMediaSeek(timelineTime, keepPlaying);
    });
  }

  function seekToTimelineTime(
    time: number,
    options?: { autoplay?: boolean; userGesture?: boolean }
  ) {
    const video = videoEl.value;
    if (!duration.value) return;
    const target = video ? clampVideoTime(time, video) : Math.max(0, time);
    const wasPlaying =
      viewOnly.value || isPreviewMode.value
        ? presentationPlaybackSession.intent === "play"
        : !!(isPlaying.value || (video && !video.paused && !video.ended));
    const shouldPlay = options?.autoplay ?? wasPlaying;
    cutPlaybackToTime(target, null, { keepPlaying: shouldPlay });
  }

  async function seekPresentationTimelineTime(target: number, shouldPlay: boolean) {
    const video = videoEl.value;
    if (!video) return;
    commandPresentationPlayback({
      targetTime: target,
      intent: shouldPlay ? "play" : "pause",
      navChapter: getStrictPresentationChapterAtTime(target),
      autoAdvance: false
    });
  }

  async function waitForVideoReady(timeoutMs = 12000): Promise<boolean> {
    const video = videoEl.value;
    if (!video || !videoSrc.value) return false;
    // 有 metadata 即可 seek/切章；勿等到 HAVE_FUTURE_DATA（同节点切章会空等很久）
    if (video.readyState >= HTMLMediaElement.HAVE_METADATA) return true;
    // 已在缓冲中：只等事件，禁止再次 load() 打断
    const alreadyLoading =
      video.networkState === HTMLMediaElement.NETWORK_LOADING ||
      video.dataset.editorReloading === "1";

    return new Promise(resolve => {
      let settled = false;
      const finish = (ok: boolean) => {
        if (settled) return;
        settled = true;
        video.removeEventListener("canplay", onReady);
        video.removeEventListener("loadeddata", onReady);
        video.removeEventListener("loadedmetadata", onReady);
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
      video.addEventListener("loadedmetadata", onReady);
      video.addEventListener("error", onError);
      if (!alreadyLoading && video.readyState === HTMLMediaElement.HAVE_NOTHING) {
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
    // 与编辑态一致：时间轴从视频 0 开始，命中动画再播 3D。
    const startTime = 0;
    const navChapter = getStrictPresentationChapterAtTime(startTime);
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
      autoAdvance: false
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
        autoAdvance: false
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
    let target = 0;
    let autoplay = true;
    let keepPlaying = false;

    // 先上锁再换片源：防止 load/timeupdate 在锁外用旧时间套到其它视频的动画
    // 整段必须 try/finally，避免 waitForVideoReady 后早退导致进度条永久卡住
    presentationChapterTransition = true;
    setVideoChapterSyncPaused(true);
    try {
      const prevPlayTarget = chapterPlayTarget.value;
      stopChapterAnimation();
      if (
        playableCh.parentId &&
        prevPlayTarget?.parentId &&
        prevPlayTarget.parentId !== playableCh.parentId
      ) {
        editPlaybackSyncChapterId = null;
        editPlaybackSyncElapsed = -1;
        chAnimChapterId = null;
        lastVideoPlaybackSyncTime = Number.POSITIVE_INFINITY;
        invalidateChapterAnimTargetsCache();
      }
      pinChapterPlayback(playableCh);

      if (syncVideo && playableCh.parentId) {
        const targetVideo = getNodeById(nodes.value, playableCh.parentId);
        if (targetVideo && isVideoNode(targetVideo) && targetVideo.videoSrc) {
          if (activeVideoId.value !== targetVideo.id) {
            activeVideoId.value = targetVideo.id;
            const storedDur = targetVideo.videoDuration;
            if (Number.isFinite(storedDur) && storedDur > 0) duration.value = storedDur;
          }
          // 点动画播放时也必须显示视频窗（原先仅切视频 id 才开窗）
          showVideoPip.value = true;
          // 仅当真实换源时才算 switched；同源 url 不重新 load、不等待。
          switchedVideoSource = syncVideoElementSrc(targetVideo.videoSrc);
          video = videoEl.value;
        }
      }

      // 同视频节点内禁止 wait/load：只在真正换源且尚无 metadata 时等待
      if (
        syncVideo &&
        video &&
        switchedVideoSource &&
        video.readyState < HTMLMediaElement.HAVE_METADATA
      ) {
        await waitForVideoReady(8000);
        if (playbackReq !== chapterPlaybackRequestSeq) return;
        video = videoEl.value;
      }

      if (viewOnly.value || isPreviewMode.value) {
        syncPresentationUiFromChapter(navChapter);
      }

      if (!syncVideo) {
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

    autoplay = options?.autoplay ?? true;
    keepPlaying = !!(options?.keepPlaying && video && !video.ended);
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

    target =
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

      chapterPlayTarget.value = playableCh;
      lastPresentationAutoSwitchChapterId = playableCh.id;
      syncPresentationUiFromChapter(navCh, target);

      if (selectedChapterId.value !== navCh.id) {
        navigateToChapter(navCh, navIdx, {
          seek: false,
          cameraMode: "playback",
          visualElapsed,
          holdCurrentTime: true,
          skipVisualApply: true,
          skipDeferredNavWork: true
        });
      }
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
      } else if (playableCh.clips?.length) {
        // 中途 seek 也必须用 clips 缓存，禁止清空后落到空 modelConfigs
        ensureClipPlaybackCache(playableCh);
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
      // 被更新的点击接管时也必须放锁，否则列表连点后进度/mesh 会假死
      if (playbackReq === chapterPlaybackRequestSeq) {
        clearPlaybackSeekLocks();
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
        } else if (activeVideo) {
          // 编辑态：优先跟真实时钟；seek 未到位时用目标时间，避免进度停在旧点
          currentTime.value = isSeekNearTarget(activeVideo, target)
            ? activeVideo.currentTime
            : target;
        }
        // 编辑态：播放中必须钉住 playTarget，禁止 finally 清掉导致跟播丢章 / 进度条停住
        if (!viewOnly.value && !isPreviewMode.value) {
          const stillBeforeTarget =
            !!activeVideo && activeVideo.currentTime < playableCh.startTime - CHAPTER_TIME_EPS;
          if (autoplay || keepPlaying) {
            chapterPlayTarget.value = playableCh;
          } else {
            chapterPlayTarget.value = stillBeforeTarget ? playableCh : null;
          }
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
            // 确保视频跟播锁已开；避免仅 Icon/isPlaying 为真而 mesh/进度未驱动
            if (activeVideo && !activeVideo.paused) {
              startVideoSyncedChapterAnimation(playableCh);
              syncClipProgressFromVideoTime(activeVideo.currentTime);
            }
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
    const wasPlaying = presentation
      ? presentationPlaybackSession.intent === "play"
      : !!(isPlaying.value || (video && !video.paused && !video.ended));
    const navChapter = presentation ? resolvePresentationNavChapter(ch) : ch;
    const playable = presentation ? resolvePlayableChapterForPresentation(navChapter) : ch;
    let targetTime =
      seekTime ??
      (wasPlaying ? navChapter.startTime : chapterLastFrameTime(playable || navChapter));
    if (presentation) {
      targetTime = Math.max(
        navChapter.startTime,
        Math.min(targetTime, chapterLastFrameTime(navChapter))
      );
    }
    cutPlaybackToTime(targetTime, ch, { keepPlaying: wasPlaying });
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
      jumpToChapter(timelineChapters.value[prevIdx]);
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
    jumpToChapter(timelineChapters.value[nextIdx]);
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
    persistBoundSceneCode(null);
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
    // 新建场景统一回到当前默认曝光度（不沿用上一个场景/历史缓存）
    setPpExposure(DEFAULT_SCENE_SETTINGS.ppExposure);
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
      if (ch.modelConfigs) {
        for (const id of Object.keys(ch.modelConfigs)) {
          if (!modelIds.has(id)) delete ch.modelConfigs[id];
        }
      }
      if (ch.clips?.length) {
        for (const clip of ch.clips) {
          clip.targets = (clip.targets || []).filter(target => modelIds.has(target.modelId));
        }
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
    // 保存前：对齐 ID 计数器；若本地已有重复 id，给后续副本换新 id（避免 Duplicate entry）
    const nStore = useSceneNodeStore();
    nStore.syncCounterFromNodes(proj.nodes);
    const seen = new Set<string>();
    for (const node of proj.nodes) {
      if (!node?.id) continue;
      if (!seen.has(node.id)) {
        seen.add(node.id);
        continue;
      }
      // 本地重复 id：只改当前这条，勿动仍挂在「第一条」上的子节点 parentId
      const prefix = node.type === "group" ? "grp" : node.type === "video" ? "vid" : "anim";
      const newId = nStore.nextUniqueId(prefix, seen);
      node.id = newId;
      seen.add(newId);
    }
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

  /** 新建场景落库前换一套全局不重复的节点 id，并改写 parentId / 字幕 / 当前选中 */
  function remintAllSceneNodeIds() {
    const proj = currProj.value;
    if (!proj?.nodes?.length) return;
    const nStore = useSceneNodeStore();
    nStore.syncCounterFromNodes(proj.nodes);
    nStore.bumpCounterForGlobalUniqueness();
    const firstMap = new Map<string, string>();
    const newIds: string[] = [];
    const seen = new Set<string>();
    for (const node of proj.nodes) {
      const prefix = node.type === "group" ? "grp" : node.type === "video" ? "vid" : "anim";
      const newId = nStore.nextUniqueId(prefix, seen);
      newIds.push(newId);
      seen.add(newId);
      if (node.id && !firstMap.has(node.id)) firstMap.set(node.id, newId);
    }
    const remap = (id: string | null | undefined) => {
      if (!id) return id ?? null;
      return firstMap.get(id) || id;
    };
    proj.nodes.forEach((node, i) => {
      if (node.parentId) node.parentId = firstMap.get(node.parentId) || node.parentId;
      node.id = newIds[i];
    });
    for (const sub of proj.subtitles || []) {
      if (sub.parentNodeId && firstMap.has(sub.parentNodeId)) {
        sub.parentNodeId = firstMap.get(sub.parentNodeId)!;
      }
    }
    selectedNodeId.value = remap(selectedNodeId.value);
    selectedChapterId.value = remap(selectedChapterId.value);
    activeVideoId.value = remap(activeVideoId.value);
    presentationUiChapterId.value = remap(presentationUiChapterId.value);
    editPlaybackSyncChapterId = remap(editPlaybackSyncChapterId);
    lastSyncedModelFormChapterId = remap(lastSyncedModelFormChapterId);
    if (selectionEditDrafts.size) {
      const remapped = new Map<string, SelectionEditDraft>();
      for (const [key, draft] of selectionEditDrafts.entries()) {
        const parsed = parseSelectionDraftKey(key);
        if (!parsed) {
          remapped.set(key, draft);
          continue;
        }
        remapped.set(
          selectionDraftKey(remap(parsed.chapterId) || parsed.chapterId, parsed.modelId, parsed.nodeId),
          draft
        );
      }
      selectionEditDrafts.clear();
      for (const [key, draft] of remapped) selectionEditDrafts.set(key, draft);
    }
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
        await mapPool(setItems, DEFAULT_GLB_LOAD_CONCURRENCY, async item => {
          const existing = findExistingModelByAsset(item);
          if (existing) {
            adoptSceneModelIdentity(existing, item);
            await ensureModelLoaded(existing);
            return;
          }
          const url = resolveAssetUrl(item.path);
          const m = mStore.createCustomModel(currProj.value!.id, item.name, url);
          adoptSceneModelIdentity(m, item);
          currProj.value!.models.push(m);
          await loadGLB(m);
          if (!meshes.has(m.id) && editorAlive) await loadGLB(m);
          if (meshes.has(m.id)) {
            refreshModelHierarchyIfLoaded(m.id, m.name);
          }
        });
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
    // 片段编辑时显隐以 clipVisual 为准，禁止把 mesh.visible 回写污染章节默认
    if (!activeAnimClipId.value) {
      cfg.visible = target.visible !== false;
      mVis.value = cfg.visible;
    }
    mOff[0] = cfg.posOffset[0];
    mOff[1] = cfg.posOffset[1];
    mOff[2] = cfg.posOffset[2];
    mScl.value = cfg.scale;
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

    // 片段模式：姿态写入 ch.clips，禁止 live 段直写 animConfig（否则缺前序片段的等待时间）
    const clipMode = !!(ch.clips?.length || activeAnimClipId.value);
    if (hasAnimEdits && segmentsForTarget && !clipMode) {
      persistAnimConfigToChapterFor(ch, modelId, nodeId ?? null, segmentsForTarget);
    }

    if (formMatchesTarget) {
      const targetCfg = getWritableModelConfigForTarget(ch, modelId, nodeId ?? null);
      // 片段编辑中显隐/外观以 clipVisual 为准，勿把表单写回章节默认
      if (!activeAnimClipId.value) {
        targetCfg.visible = snapshot.visible;
        targetCfg.outline = snapshot.outline;
        targetCfg.wireframe = snapshot.wireframe;
        targetCfg.highlight = snapshot.highlight;
        targetCfg.outlineColor = snapshot.outlineColor;
        targetCfg.wireframeColor = snapshot.wireframeColor;
        targetCfg.modelHighlightColor = snapshot.modelHighlightColor;
        targetCfg.intro = snapshot.intro;
      }
      targetCfg.animation = snapshot.animation;
      targetCfg.scale = snapshot.scale;

      if (hasVisualEdits && !activeAnimClipId.value) {
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
      persistBoundSceneCode(sceneCode.value);
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
      useSceneNodeStore().syncCounterFromNodes(proj.nodes);
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
      const customItems: Array<{ item: any; m: Model; assetKey: string }> = [];
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
        if (assetKey) loadedAssetKeys.add(assetKey);
        const url = resolveAssetUrl(item.path);
        const m = mStore.createCustomModel(proj.id, item.name, url);
        adoptSceneModelIdentity(m, item);
        customItems.push({ item, m, assetKey: assetKey || m.id });
      }
      await mapPool(customItems, DEFAULT_GLB_LOAD_CONCURRENCY, async entry => {
        proj.models.push(entry.m);
        await loadGLB(entry.m);
        if (!meshes.has(entry.m.id) && editorAlive) {
          await loadGLB(entry.m);
        }
        if (meshes.has(entry.m.id)) {
          refreshModelHierarchyIfLoaded(entry.m.id, entry.m.name);
        }
      });
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
    // 加载完成后预先封印大体量 clips，避免刷新后第一次点动画时 markRaw + 序列化卡死
    suspendProjectPersist();
    try {
      for (const ch of chapters.value) sealHeavyClipsInChapter(ch);
    } finally {
      resumeProjectPersist();
    }
    await nextTick();
    handleResize();
    await flushStoredSceneVisualsAfterLayout();
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
    skipStoredSceneSettings = true;
    try {
      // 无任何已保存场景数据时：严格使用系统默认场景参数，
      // 不读取该 code 下本地历史缓存，保证本地/线上一致。
      runWithoutSceneDirty(() => {
        applySceneSettingsData(DEFAULT_SCENE_SETTINGS as unknown as Record<string, any>);
        sceneLights.value = createDefaultSceneLights();
        selectedSceneLightId.value = sceneLights.value[0]?.id ?? null;
      });
      sceneLightsPinnedFromSettings = true;
      const settings = collectSceneSettingsData() as { envMapUrl?: string; envMapIsHdr?: boolean };
      if (settings.envMapUrl) {
        await loadEnvironmentMapFromUrlAsync(settings.envMapUrl, !!settings.envMapIsHdr);
      }
      saveAllSettings();
      commitStoredSceneVisuals();
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
      const bound = readBoundSceneCode();
      const preferred = (bound && list.find(item => item.code === bound)?.code) || list[0].code;
      return await loadSceneForEdit(preferred);
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
    if (savingScene.value || savingClips.value) return null;
    if (!currProj.value || chapters.value.length === 0) {
      toastShow("请先创建至少一个节点", "warning");
      return null;
    }
    if (!sceneNeedsPersist.value) {
      toastShow("没有需要更新的内容", "warning");
      return null;
    }

    const isUpdate = !!sceneCode.value;
    savingScene.value = true;
    setPersistProgress(6, isUpdate ? "正在准备更新..." : "正在准备保存...");
    try {
      await yieldToUi();
      setPersistProgress(18, "正在整理动画数据...");
      persistAllChapterDrafts();
      for (const ch of chapters.value) {
        if (isAnimationNode(ch) && (ch.clips?.length || 0) > 0) {
          persistClipsEditorOnly(ch, { markSceneDirty: true });
        }
      }
      await yieldToUi();

      if (!sceneCode.value) remintAllSceneNodeIds();

      setPersistProgress(32, "正在生成场景数据...");
      let payload = buildScenePayload();
      if (!payload) {
        toastShow("场景数据无效，无法保存", "error");
        return null;
      }
      await yieldToUi();

      const packClipsIntoPayload = async () => {
        const animNodes = getAnimationNodes(payload!.nodes);
        const clipChapters = animNodes.filter(ch => (ch.clips?.length || 0) > 0);
        for (let i = 0; i < clipChapters.length; i++) {
          setPersistProgress(
            36 + Math.round((28 * (i + 1)) / Math.max(1, clipChapters.length)),
            `正在打包动画 ${i + 1}/${clipChapters.length}`
          );
          projectClipsOntoPlainChapter(clipChapters[i]);
          await yieldToUi();
        }
      };
      await packClipsIntoPayload();

      setPersistProgress(72, "正在上传资源...");
      const uploadedOk = await persistVideoSourcesInPayload(payload);
      if (!uploadedOk) {
        toastShow("有视频仍是本地临时文件且上传失败，请重新选择视频后再保存", "error");
        return null;
      }
      if (payload.nodes.some(n => n.type === "video" && isTransientMediaUrl(n.videoSrc || ""))) {
        toastShow("请先重新上传视频文件后再保存场景", "error");
        return null;
      }

      const rebuildPayloadAfterRemint = async () => {
        remintAllSceneNodeIds();
        payload = buildScenePayload();
        if (!payload) throw new Error("场景数据无效，无法保存");
        await packClipsIntoPayload();
        await persistVideoSourcesInPayload(payload);
      };

      setPersistProgress(88, sceneCode.value ? "正在提交更新..." : "正在保存场景...");
      let result: any;
      const creating = !sceneCode.value;
      if (!creating) {
        try {
          result = await updateSceneOnBackend(sceneCode.value!, payload);
        } catch (e) {
          if (isDuplicateNodeIdError(e)) {
            setPersistProgress(90, "正在处理节点编号冲突...");
            await rebuildPayloadAfterRemint();
            result = await updateSceneOnBackend(sceneCode.value!, payload!);
          } else if (isEditorServerNotFoundError(e)) {
            sceneCode.value = null;
            persistBoundSceneCode(null);
            setPersistProgress(90, "正在以新场景保存...");
            await rebuildPayloadAfterRemint();
            result = await saveSceneToBackend(payload!);
          } else {
            throw e;
          }
        }
      } else {
        try {
          result = await saveSceneToBackend(payload);
        } catch (e) {
          if (!isDuplicateNodeIdError(e)) throw e;
          setPersistProgress(92, "正在处理节点编号冲突...");
          await rebuildPayloadAfterRemint();
          result = await saveSceneToBackend(payload);
        }
      }
      sceneCode.value = result.code;
      persistBoundSceneCode(result.code);
      shareLink.value = result.previewUrl ? rewireEditorFrontendHost(result.previewUrl) : buildShareLink(result.code);
      sceneSavedAt.value = result.updatedAt || result.createdAt || new Date().toISOString();
      sceneListVersion.value += 1;
      void refreshSavedSceneCount();
      saveAllSettings();
      resumeProjectPersist();
      markSceneAsSavedBaseline();
      setPersistProgress(100, creating ? "保存完成" : "更新完成");
      await new Promise(r => setTimeout(r, 180));
      toastShow(creating ? "场景已创建" : "场景已更新", "success");
      return result;
    } catch (e: any) {
      toastShow((isUpdate ? "更新失败: " : "保存失败: ") + (e?.message || "未知错误"), "error");
      return null;
    } finally {
      savingScene.value = false;
      clearPersistProgress();
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
    // 大体量片段：idle 全量描边会再次卡主线程，编辑预览已走 light 路径
    if (chapterClipTargetCount(chapter) >= CLIP_HEAVY_TARGET_THRESHOLD) return;
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
      if (
        !viewOnly.value &&
        !isPreviewMode.value &&
        chapterClipTargetCount(chapter) < CLIP_HEAVY_TARGET_THRESHOLD
      ) {
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
      /** 编辑态点选：跳过同步刷 mesh，由 scheduleDeferredEditChapterEnter 处理 */
      skipVisualApply?: boolean;
      /** 跳过 RAF sanitize / 开播跟片（点选时用） */
      skipDeferredNavWork?: boolean;
      /** 跳过运镜（点选首帧只高亮） */
      skipCamera?: boolean;
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
      // 轻量点选离开：只落盘 clips，禁止 sanitize / 全量 isolation（第二次点也会卡死）
      if (options?.skipVisualApply) {
        if (animDirty.value && activeAnimClipId.value && prevChapter.clips?.length) {
          try {
            persistClipsEditorOnly(prevChapter, { skipUiBump: true });
          } catch {
            /* keep going */
          }
        }
        invalidateChapterAnimTargetsCache(prevChapter.id);
      } else {
        // 离开动画节点：只写回 clips，禁止 project 144 目标进 Pinia（切节点卡 2s+ 主因）
        if (animDirty.value && activeAnimClipId.value && prevChapter.clips?.length) {
          try {
            persistClipsEditorOnly(prevChapter, { skipUiBump: true });
            if (editModeProjectionClearedChapterId !== prevChapter.id) {
              clearClipProjectedAnimConfigs(prevChapter);
            }
          } catch {
            /* keep going */
          }
        }
        invalidateChapterAnimTargetsCache(prevChapter.id);
        flushChapterDraftsToModelConfigs(prevChapter);
        if (
          chapterClipTargetCount(prevChapter) < CLIP_HEAVY_TARGET_THRESHOLD &&
          !isHeavyEditNavChapter(prevChapter)
        ) {
          sanitizeChapterModelConfigs(prevChapter);
        }
        // 共享模型：清掉上一动画的片段叠加，避免串到下一动画
        resetClipEditorIsolationState(prevChapter);
      }
    }

    // 切换节点后清空全部内存会话，避免新节点读到旧节点的草稿
    if (!prevChapter || prevChapter.id !== chapter.id) {
      selectionEditDrafts.clear();
      clearLiveAnimEditorState();
      editPlaybackSyncChapterId = null;
      editPlaybackSyncElapsed = -1;
      activeAnimClipId.value = null;
      setClipTargetSelection([]);
      clipDraftTargetKey.value = null;
      lastClipViewportOverlayKeys = [];
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
    // 轻量点选：禁止在此 seal（会触发 Pinia 全量序列化卡死）；交给 suspend 后的 uiOnly 同步
    if (!options?.skipVisualApply && !viewOnly.value && !isPreviewMode.value) {
      sealHeavyClipsInChapter(chapter);
    }
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

    if (!options?.skipCamera) {
      applyChapterCameraForNav(chapter, cameraMode);
    } else {
      chapterNavLock.value = false;
    }
    lastSyncedModelFormChapterId = null;
    if (!options?.skipVisualApply) {
      applyChapterVisualStateForNav(chapter, previewAnimation, options?.visualElapsed);
      syncModelSelectionForChapter(chapter);
    }
    if (!options?.skipDeferredNavWork) {
      scheduleChapterNavDeferredWork(chapter, gen, elapsed, previewAnimation);
    }
    lastIntroStateKey = "";
    if (!options?.skipVisualApply) {
      syncIntroPresentation();
    }

    queueMicrotask(() => {
      if (gen !== chapterNavGeneration) return;
      syncChapterMetaForm(chapter);
      if (!camTrans && !isCameraTransitioning.value && !cameraAnimating) {
        syncCameraFormFromStored(chapter);
      }
      // 运镜未完成也要解锁：否则回调丢失时进度条/动画永久卡住
      chapterNavLock.value = false;
    });

    if (options?.seek !== false) {
      setVideoChapterSyncPaused(true);
      const seekGen = gen;
      void seekVideoTo(chapter.startTime).finally(() => {
        if (seekGen !== chapterNavGeneration) return;
        setVideoChapterSyncPaused(false);
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
    // 与 applyChapter 一致：同步只高亮，重活 yield 后再做
    applyChapter(ch);
  }

  function getChapterAnimElapsed(ch: Chapter, t: number) {
    return Math.max(0, t - ch.startTime);
  }

  function chapterHasAnimation(ch: Chapter) {
    if (ch.clips?.some(c => (c.targets?.length ?? 0) > 0 || !!c.camera)) return true;
    if (getChapterAnimTargetsCached(ch).length > 0) return true;
    if (!shouldSampleLegacyAnimConfig(ch) || !ch.modelConfigs) return false;
    for (const raw of Object.values(ch.modelConfigs)) {
      const cfg = raw as ModelConfig;
      if (cfg?.animation && cfg.animConfig?.segments?.length) return true;
      if (!cfg?.nodeConfigs) continue;
      for (const nc of Object.values(cfg.nodeConfigs)) {
        const nodeCfg = nc as ModelConfig;
        if (nodeCfg?.animation && nodeCfg.animConfig?.segments?.length) return true;
      }
    }
    return false;
  }

  /** 播放前将当前编辑写入 clips，并构建非响应式播放缓存（不写 Pinia animConfig） */
  function prepareChapterForPreviewPlayback(
    ch: Chapter,
    opts?: { skipPersist?: boolean }
  ) {
    if (!viewOnly.value && !isPreviewMode.value) {
      if (!opts?.skipPersist && animDirty.value) {
        if (ch.clips?.length || activeAnimClipId.value) {
          persistClipsEditorOnly(ch, { skipUiBump: true });
        }
        flushChapterSessionsToConfigs(ch);
      }
    }
    editPlaybackSyncChapterId = ch.id;
    editPlaybackSyncElapsed = 0;
    invalidateChapterAnimPivotCaches(ch);
    if (shouldSampleClipsOnly(ch)) {
      if (!adoptPlaybackCache(ch)) buildChapterPlaybackCacheFromClips(ch);
    } else if (shouldSampleLegacyAnimConfig(ch)) {
      if (!adoptPlaybackCache(ch)) buildChapterPlaybackCacheFromLegacy(ch);
    }
  }

  /** 节点播放按钮：墙钟模式从头重播当前节点全部效果与动画（不跟视频时间轴） */
  function restartChapterPreviewPlayback(
    ch: Chapter,
    opts?: { skipPreparePersist?: boolean; fromElapsed?: number }
  ) {
    // 开播前只持久化当前编辑并确保缓存就绪；先停旧播放，再一次性起时钟
    if (!opts?.skipPreparePersist) {
      prepareChapterForPreviewPlayback(ch, { skipPersist: false });
    } else if (ch.clips?.length && chapterPlaybackCache?.chapterId !== ch.id) {
      buildChapterPlaybackCacheFromClips(ch);
    }
    stopSegmentPlayback();
    chapterPlayTarget.value = null;
    chapterSeekPinId = null;
    chapterAutoNext.value = false;
    presentationExpectPlaying = false;
    clearPresentationResumeTimer();
    if (videoEl.value) videoEl.value.pause();
    _chAnimLock = false;
    chAnimWallclock = false;

    return !!runChapterAnimationWallclock(ch, { fromElapsed: opts?.fromElapsed ?? 0 });
  }

  function stopChapterAnimation(opts?: { keepProgressUi?: boolean; keepPlaybackCache?: boolean }) {
    playbackVisualGeneration++;
    chapterPreviewGeneration++;
    suppressClipUiCommits();
    stopSegmentPlayback();
    chAnimChapterId = null;
    chAnimWallclock = false;
    chAnimWallclockStart = 0;
    chAnimWallclockMaxDur = 0;
    wallclockVisualClipId = null;
    wallclockDebugClipId = null;
    wallclockDebugLastNow = 0;
    videoAnimLastSyncAt = 0;
    playbackCameraUserOverride = false;
    _chAnimLock = false;
    clipPlayCameraOrigin = null;
    lastClipCameraId = null;
    editPlaybackSyncChapterId = null;
    editPlaybackSyncElapsed = -1;
    editPlaybackCameraChapterId = null;
    finishCameraAnimationState();
    if (!opts?.keepProgressUi) {
      totalPlaying.value = false;
      totalProgress.value = 0;
      clipPlayElapsed.value = 0;
      clipPlayDuration.value = 0;
    }
    if (opts?.keepPlaybackCache) {
      chapterAnimTargetsCache = null;
    } else {
      invalidateChapterAnimTargetsCache();
      updateSelectionHighlight();
      syncEditorComposerPasses();
    }
  }

  function syncCurrentChapterAnimationFromVideo() {
    const video = videoEl.value;
    if (!video) return;
    const ch = resolvePresentationPlaybackChapter(video);
    if (!ch || (!chapterHasAnimation(ch) && !chapterHasAnyModelEdits(ch))) {
      // 钉住目标章时不要 reset（会把已隐藏模型整树显示回来）
      if (chapterPlayTarget.value) return;
      resetAllModelsToDefault();
      return;
    }
    const elapsed = getPresentationAnimElapsed(video, ch);
    if (!viewOnly.value && !isPreviewMode.value) {
      adoptPlaybackCache(ch);
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
    if (!activeCh || (!chapterHasAnimation(activeCh) && !chapterHasAnyModelEdits(activeCh))) {
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
    wallclockVisualClipId = null;
    lastClipCameraId = null;
    playbackCameraUserOverride = false;
    if (_ch) adoptPlaybackCache(_ch);
    const video = videoEl.value;
    if (video && _ch) {
      const timelineT = resolvePresentationPlaybackTime(video);
      const elapsed = isChapterInPlaybackRange(_ch, timelineT)
        ? getChapterAnimElapsed(_ch, timelineT)
        : Math.max(0, timelineT - _ch.startTime);
      capturePlaybackCameraOrigin();
      clipPlayCameraOrigin = resolvePlaybackCameraFrom(_ch, elapsed) ?? clipPlayCameraOrigin;
      resyncChapterMeshFromVideo(video, _ch, elapsed, {
        rebuildOutlines:
          chapterClipTargetCount(_ch) < CLIP_HEAVY_TARGET_THRESHOLD &&
          chapterNeedsOutlineRebuild(_ch)
      });
      applyPlaybackVisibilityFast(_ch, elapsed);
      const activeClip =
        _ch.clips?.length
          ? findActiveClipAtElapsed(_ch.clips, elapsed) ?? (elapsed <= 1e-4 ? _ch.clips[0] : null)
          : null;
      wallclockVisualClipId = activeClip?.id ?? "__none__";
      applyClipCameraAtElapsed(_ch, elapsed);
    } else {
      syncCurrentChapterAnimationFromVideo();
    }
    return true;
  }

  function runChapterAnimationWallclock(ch: Chapter, opts?: { fromElapsed?: number }) {
    const wallclockGen = chapterNavGeneration;
    // 只清锁态，不重建播放缓存/描边（已在 prepare/建缓存阶段处理）
    stopSegmentPlayback();
    chapterPlayTarget.value = null;
    if (wallclockGen !== chapterNavGeneration) return false;

    const fromElapsed = Math.max(0, opts?.fromElapsed ?? 0);

    _chAnimLock = true;
    chAnimWallclock = true;
    chAnimChapterId = ch.id;
    cancelCameraTransitionSilently();
    ensurePlaybackCache(ch);
    capturePlaybackCameraOrigin();
    clipPlayCameraOrigin = resolvePlaybackCameraFrom(ch, fromElapsed) ?? clipPlayCameraOrigin;
    clearSelectionHighlight();
    syncEditorComposerPasses();
    if (!getChapterAnimTargetsCached(ch).length && !(ch.clips?.some(c => c.targets?.length))) {
      if (!ch.clips?.length) {
        _chAnimLock = false;
        chAnimWallclock = false;
        chAnimChapterId = null;
        return false;
      }
    }

    const cachedDur =
      chapterPlaybackCache?.chapterId === ch.id ? chapterPlaybackCache.maxDur : 0;
    const maxDur = Math.max(
      0.1,
      cachedDur,
      getClipsTotalDuration(ch.clips || []),
      cachedDur > 0 || (ch.clips?.length ?? 0) > 0 ? 0 : getChapterAnimDuration(ch)
    );
    const startElapsed = Math.min(fromElapsed, maxDur);
    chAnimWallclockStart = performance.now() - startElapsed * 1000;
    chAnimWallclockMaxDur = maxDur;
    wallclockVisualClipId = null;
    lastClipCameraId = null;
    playbackCameraUserOverride = false;
    totalPlaying.value = true;
    totalProgress.value = startElapsed / maxDur;
    clipPlayElapsed.value = startElapsed;
    clipPlayDuration.value = maxDur;

    requestAnimationFrame(() => {
      if (chAnimChapterId !== ch.id || !chAnimWallclock) return;
      applyChapterWallclockFrame(ch, startElapsed);
      renderViewportFrame();
    });
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
    const resolved = resolveChapter(ch);
    if (!resolved) return;
    const { chapter } = resolved;
    const presentation = viewOnly.value || isPreviewMode.value;
    if (!presentation && selectedChapterId.value === chapter.id && animDirty.value) {
      persistClipsEditorOnly(chapter, { skipUiBump: true });
    }
    const video = videoEl.value;
    const videoReady = !!(video && (video.src || video.currentSrc));
    if (!presentation && !videoReady) {
      pinChapterPlayback(chapter);
      playChapterClipsWallclock(chapter);
      return;
    }
    cutPlaybackToTime(chapter.startTime, chapter, { keepPlaying: true });
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

  function applyModelConfigToEditor(cfg: ModelConfig, opts?: { skipAnimSegments?: boolean }) {
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

    // 片段编辑态：姿态真相源是 ch.clips / live animSegments，禁止用投影后的绝对坐标盖回编辑器
    if (opts?.skipAnimSegments || activeAnimClipId.value) {
      if (!opts?.skipAnimSegments && activeAnimClipId.value) {
        mAni.value = true;
      }
      return;
    }

    const ac = cfg.animConfig;
    if (ac?.segments?.length) {
      animDuration.value = ac.duration || 3;
      animEasing.value = (ac as any).easing || "easeInOut";
      const fallbackVisual = clipVisualFromModelConfig(cfg);
      const segs = ac.segments.map((raw: any) => {
        const seg = mapStoredAnimSegment({
          ...raw,
          clipVisual: raw.clipVisual ?? fallbackVisual
        });
        if (selModel.value) {
          normalizeAnimSegmentTransformForEditor(
            selModel.value,
            selModelNodeId.value,
            seg,
            !!(ac as any).relativeTransform
          );
        }
        if (!seg.clipVisual) seg.clipVisual = cloneClipVisual(fallbackVisual);
        if (!seg._expandedPanels) seg._expandedPanels = ["start", "end"];
        invalidateSegPivotCache(seg);
        return seg;
      });
      annotateSegmentsAbsoluteTimes(segs);
      animSegments.splice(0, animSegments.length, ...segs);
      bindAnimSegmentsToSelection(selModel.value?.id, selModelNodeId.value, selectedChapterId.value);
      animDirty.value = false;
      recalcAnimDuration();
    } else {
      animSegments.splice(0);
      animSegmentsOwnerKey = null;
      animDirty.value = false;
      // 仅片段编辑才引导默认段；否则会在右侧弹出旧「模型动画」面板
      if (mAni.value && selModel.value && activeAnimClipId.value) {
        const seg = createDefaultAnimSegment(selModel.value, selModelNodeId.value);
        seedPristineAnimSegmentFromDefaults(seg, selModel.value, selModelNodeId.value);
        animSegments.push(seg);
        annotateSegmentsAbsoluteTimes(animSegments);
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

  function collectIntroLabelsForChapter(
    ch: Chapter,
    elapsedSec?: number
  ): Array<{ modelId: string; nodeId: string | null; text: string; x: number; y: number }> {
    const labels: Array<{ modelId: string; nodeId: string | null; text: string; x: number; y: number }> = [];
    const def = createDefaultModelConfig();
    const elapsed = typeof elapsedSec === "number" ? elapsedSec : 0;

    // clips 是介绍真相源（编辑态常卸掉 modelConfigs 投影）
    if (ch.clips?.length) {
      const clip =
        findActiveClipAtElapsed(ch.clips, elapsed) ?? (elapsed <= 1e-4 ? ch.clips[0] : null);
      if (clip?.targets?.length) {
        const seen = new Set<string>();
        for (const target of clip.targets) {
          if (!target?.modelId) continue;
          const vis = serializeClipVisual(target.clipVisual);
          const intro = vis.intro?.trim();
          if (!intro || vis.visible === false) continue;
          const nodeId = target.nodeId ?? null;
          const key = `${target.modelId}|${nodeId ?? ""}`;
          if (seen.has(key)) continue;
          seen.add(key);
          labels.push({ modelId: target.modelId, nodeId, text: intro, x: 0, y: 0 });
        }
        if (labels.length) {
          // 百级同文案目标只留一条，避免视口刷爆
          if (labels.length > 12) {
            const byText = new Map<string, (typeof labels)[number]>();
            for (const label of labels) {
              const k = `${label.modelId}::${label.text}`;
              if (!byText.has(k)) byText.set(k, label);
            }
            return [...byText.values()];
          }
          return labels;
        }
      }
    }

    for (const m of models.value) {
      if (!chapterModelHasEdits(ch, m.id)) continue;
      const raw = ch.modelConfigs?.[m.id] as ModelConfig | undefined;
      if (!raw) continue;

      const rootCfg = getModelConfig(raw);
      let rootIntro = rootCfg.intro?.trim();
      let rootVisible = rootCfg.visible;
      if (rootCfg.animation && rootCfg.animConfig?.segments?.length) {
        const active = findAnimatingSegmentAtElapsed(rootCfg.animConfig.segments, elapsed) as any;
        if (active?.clipVisual) {
          const vis = serializeClipVisual(active.clipVisual);
          rootIntro = vis.intro?.trim() || "";
          rootVisible = vis.visible;
        }
      }
      if (rootIntro && rootVisible) {
        labels.push({ modelId: m.id, nodeId: null, text: rootIntro, x: 0, y: 0 });
      }

      if (!raw.nodeConfigs) continue;
      for (const [nodeId, nodeCfg] of Object.entries(raw.nodeConfigs)) {
        const merged = getModelConfig({ ...def, ...nodeCfg } as ModelConfig);
        let intro = merged.intro?.trim();
        let visible = merged.visible;
        if (merged.animation && merged.animConfig?.segments?.length) {
          const active = findAnimatingSegmentAtElapsed(merged.animConfig.segments, elapsed) as any;
          if (active?.clipVisual) {
            const vis = serializeClipVisual(active.clipVisual);
            intro = vis.intro?.trim() || "";
            visible = vis.visible;
          }
        }
        if (!intro || !visible) continue;
        labels.push({ modelId: m.id, nodeId, text: intro, x: 0, y: 0 });
      }
    }
    return labels;
  }

  function syncIntroPresentation() {
    const video = videoEl.value;
    const videoPlaying = !!(video && !video.paused);
    const wallclockPlaying = !!chAnimWallclock;
    const playing = videoPlaying || wallclockPlaying;
    const t = video?.currentTime ?? currentTime.value;
    // 播放中：按视频/墙钟所在节点展示；非播放：按当前选中/激活节点展示
    const chapter = wallclockPlaying
      ? chapters.value.find(c => c.id === chAnimChapterId) ?? getActiveChapter()
      : playing
        ? getPlaybackChapterAtTime(t)
        : getActiveChapter();
    const chapterId = chapter?.id ?? null;

    const editingModel = !playing ? selModel.value : null;
    const editingNodeId = !playing ? selModelNodeId.value : null;
    const liveSeg = !playing ? editingSeg.value ?? animSegments[0] ?? null : null;
    const segIntro = liveSeg?.clipVisual?.intro?.trim() || "";
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
    // 片段介绍写在 clipVisual，不能只认模型表单 intro
    const editingText = segIntro || editingIntro;
    const editingSegVisible = liveSeg?.clipVisual ? liveSeg.clipVisual.visible !== false : editingVisible;
    const editingShouldShow = !!(editingModel && editingSegVisible && editingText);

    const shouldShow = playing || editingShouldShow;
    const chapterElapsed = wallclockPlaying
      ? Math.max(0, clipPlayElapsed.value)
      : chapter
        ? getChapterAnimElapsed(chapter, t)
        : 0;

    let introSignature = "";
    if (shouldShow && chapter) {
      if (!playing && editingModel) {
        introSignature = editingShouldShow
          ? `${editingModel.id}|${editingNodeId ?? ""}|${editingText}`
          : "";
      } else {
        introSignature = collectIntroLabelsForChapter(chapter, chapterElapsed)
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

    if (!playing && editingModel) {
      modelIntroLabels.value = editingShouldShow
        ? [{ modelId: editingModel.id, nodeId: editingNodeId, text: editingText, x: 0, y: 0 }]
        : [];
    } else {
      modelIntroLabels.value = collectIntroLabelsForChapter(chapter, chapterElapsed);
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
    // 未选中动画时不要回退到第一章，否则点右侧模型会套上旧 animConfig / 旧动画面板
    return selectedChapter.value ?? null;
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
      applyModelConfigToEditor(defaultCfg, { skipAnimSegments: true });
      animSegments.splice(0);
      animSegmentsOwnerKey = null;
      editingSeg.value = null;
      mAni.value = false;
      modelFormRevision.value++;
      return;
    }

    const chapterId = activeChapter.id;
    const chapterChanged = chapterId !== lastSyncedModelFormChapterId;
    lastSyncedModelFormChapterId = chapterId;

    const clipEditing =
      !!activeAnimClipId.value &&
      !viewOnly.value &&
      !isPreviewMode.value &&
      !isEditVideoMeshSyncActive();

    // 片段编辑：切选中绝不能 applyChapterModelState / reset 整树，否则当前片段外观会被冲掉
    if (clipEditing) {
      const { cfg } = resolveEditorConfigForSelection(
        activeChapter,
        model,
        selModelNodeId.value
      );
      applyModelConfigToEditor(cfg, { skipAnimSegments: true });
      modelFormRevision.value++;
      return;
    }

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
        !activeAnimClipId.value &&
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

    // 章节默认可见性会把「片段内隐藏」冲掉；切选后必须再套一层当前片段外观
    if (activeAnimClipId.value && !viewOnly.value && !isPreviewMode.value) {
      syncActiveClipViewportPreview({ mode: editingSegMode.value || "start" });
    }

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
    stopChapterAnimation();
    const sourceGeneration = ++videoSourceGeneration;

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
      if (
        sourceGeneration !== videoSourceGeneration ||
        activeVideoId.value !== video.id
      ) {
        return true;
      }
      syncVideoElementSrc(video.videoSrc || undefined);
      const v = videoEl.value;
      if (!v) return false;
      v.dataset.editorVideoNodeId = video.id;
      v.dataset.editorVideoGeneration = String(sourceGeneration);
      try {
        v.pause();
      } catch {
        /* ignore */
      }
      // 等元数据后再 seek，避免未就绪时 currentTime=0 触发异常
      const seekToStart = () => {
        if (
          sourceGeneration !== videoSourceGeneration ||
          activeVideoId.value !== video.id ||
          v.dataset.editorVideoNodeId !== video.id
        ) {
          return;
        }
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
        if (
          sourceGeneration !== videoSourceGeneration ||
          activeVideoId.value !== video.id
        ) {
          return;
        }
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

  /**
   * 打开视频窗并绑定片源。首帧后 nextTick 再 sync，避免点选卡死；
   * syncVideoElementSrc 同源会直接 reused，同节点内不会重复 load。
   */
  function ensureVideoBound(video: SceneVideoNode) {
    if (!video.videoSrc) {
      toastShow("该视频节点尚未上传视频文件", "warning");
      return;
    }
    const key = normalizePresentationVideoSrcKey(resolveAssetUrl(video.videoSrc) || video.videoSrc);
    const el = videoEl.value;
    // 不能用 activeVideoId：cutPlaybackToTime 会先改 id，再进来，否则会把旧片源当成已绑定。
    const alreadyBound = showVideoPip.value && !!el && isVideoElementBoundToKey(el, key);
    activeVideoId.value = video.id;
    const storedDur = video.videoDuration;
    if (Number.isFinite(storedDur) && storedDur > 0) duration.value = storedDur;
    showVideoPip.value = true;
    requestViewportRender();
    if (alreadyBound) {
      if (el) {
        el.dataset.editorVideoNodeId = video.id;
        delete el.dataset.editorReloading;
      }
      return;
    }
    const videoId = video.id;
    const src = video.videoSrc;
    const bind = () => {
      if (activeVideoId.value !== videoId) return;
      syncVideoElementSrc(src || undefined);
      const v = videoEl.value;
      if (v) {
        v.dataset.editorVideoNodeId = videoId;
        delete v.dataset.editorReloading;
      }
    };
    // pip 是 v-if：可能尚无 videoEl，多等几帧
    if (videoEl.value) {
      bind();
      return;
    }
    void nextTick(async () => {
      for (let i = 0; i < 20; i++) {
        if (activeVideoId.value !== videoId) return;
        if (videoEl.value) {
          bind();
          return;
        }
        await new Promise(r => setTimeout(r, 32));
      }
    });
  }

  /** 预览/展示列表：点击视频节点时加载对应视频（不自动开播） */
  function activatePresentationVideoNode(video: SceneVideoNode) {
    if (!video.videoSrc) {
      toastShow("该视频节点尚未上传视频文件", "warning");
      return;
    }
    videoOnlyMode.value = true;
    selectedNodeId.value = video.id;
    selectedChapterId.value = null;
    stopChapterAnimation();
    chapterPlayTarget.value = null;
    ensureVideoBound(video);
    // 展示态：把导航锚到该视频片头，便于进度条与列表对齐
    if (viewOnly.value || isPreviewMode.value) {
      const firstAnim = getVideoAnimations(nodes.value, video.id)[0] ?? null;
      const targetTime = firstAnim ? firstAnim.startTime : 0;
      commandPresentationPlayback({
        targetTime,
        intent: "pause",
        navChapter: firstAnim,
        autoAdvance: false
      });
    } else {
      void nextTick(() => {
        const v = videoEl.value;
        if (!v || activeVideoId.value !== video.id) return;
        try {
          if (v.readyState >= HTMLMediaElement.HAVE_METADATA) v.currentTime = 0;
        } catch {
          /* ignore */
        }
        currentTime.value = 0;
        isPlaying.value = false;
      });
    }
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
    ensureVideoBound,
    resetAllModelsToDefault,
    onClearAnimationSelection: () => {
      stopChapterAnimation();
      chapterPlayTarget.value = null;
      activeAnimClipId.value = null;
      setClipTargetSelection([]);
      clipDraftTargetKey.value = null;
      clearLiveAnimEditorState();
      mAni.value = false;
      // 点到视频/分组等非动画节点时取消模型选中
      if (!viewOnly.value && !isPreviewMode.value) {
        clearModelSelection();
      }
    },
    onBeforeDeleteNodes: deleteIds => {
      if (
        (chAnimChapterId && deleteIds.has(chAnimChapterId)) ||
        (activeVideoId.value && deleteIds.has(activeVideoId.value))
      ) {
        stopChapterAnimation();
        const video = videoEl.value;
        if (video && !video.paused) video.pause();
        isPlaying.value = false;
      }
    },
    hideVideoPip,
    videoOnlyMode,
    chapterFormRevision,
    viewOnly,
    isPreviewMode,
    getActiveChapterIdForUi
  });

  function isChapterPlaying(ch: Chapter): boolean {
    // 与树高亮同源：任意时刻最多一个动画处于 playing
    if (chAnimWallclock && totalPlaying.value) {
      return chAnimChapterId === ch.id;
    }
    if (ch.parentId && activeVideoId.value && ch.parentId !== activeVideoId.value) {
      return false;
    }
    const video = videoEl.value;
    const mediaPlaying = !!(video && !video.paused && !video.ended);
    if (!mediaPlaying && !isPlaying.value) return false;
    // 视频已停、仅残留 isPlaying：不算在播，否则暂停图标会留在旧节点上
    if (!mediaPlaying && !chapterSeekPinId && !chapterPlayTarget.value) return false;
    return getActiveChapterIdForUi() === ch.id;
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
      chapterSeekPinId = null;
      isPlaying.value = false;
      clearPlaybackSeekLocks();
      const video = videoEl.value;
      if (video && !video.paused) {
        try {
          video.pause();
        } catch {
          /* ignore */
        }
      }
      stopChapterAnimation();
      applyChapterEditorVisualState(ch);
      return;
    }
    clearPlaybackSeekLocks();
    cancelCameraTransitionSilently();
    pinChapterPlayback(ch);
    isPlaying.value = true;
    currentTime.value = ch.startTime;
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
          const nStore = useSceneNodeStore();
          nStore.syncCounterFromNodes(currProj.value.nodes);
          const clone = JSON.parse(JSON.stringify(ch)) as Chapter;
          const existing = new Set(currProj.value.nodes.map(n => n.id));
          clone.id = nStore.nextUniqueId("anim", existing);
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
      const name = chForm.name;
      if (
        ch.name === name &&
        Math.abs((ch.startTime ?? 0) - startTime) <= 1e-3 &&
        Math.abs((ch.endTime ?? 0) - endTime) <= 1e-3
      ) {
        return;
      }

      chStore.updateChapter(ch, {
        name,
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

  /** 点击视口空白：取消模型选中与片段内多选高亮（不删除片段 targets） */
  function clearViewportModelSelection() {
    if (viewOnly.value || isPreviewMode.value) return;
    if (activeAnimClipId.value && !clipAutoCommitSuppressed) {
      flushCurrentClipEditBeforeSwitch();
    }
    if (activeClipTargetKeys.value.length || activeClipTargetKey.value || clipDraftTargetKey.value) {
      setClipTargetSelection([]);
      clipSelectAnchorKey = null;
      clipDraftTargetKey.value = null;
      bumpAnimClipListRevision();
    }
    clearModelSelection();
    clearHoverTarget();
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

  function selectModelNode(
    modelId: string,
    nodeId: string | null,
    opts?: { focusCamera?: boolean; shiftKey?: boolean; ctrlKey?: boolean; metaKey?: boolean }
  ) {
    const m = models.value.find(item => item.id === modelId);
    if (!m) return;
    if (
      handleClipModelInteraction(modelId, nodeId, {
        shiftKey: opts?.shiftKey,
        ctrlKey: opts?.ctrlKey,
        metaKey: opts?.metaKey,
        focusCamera: opts?.focusCamera ?? true
      })
    ) {
      return;
    }
    // 无动画片段语境：忽略多选修饰键，退回普通单选
    selectModel(m, { focusCamera: opts?.focusCamera, nodeId, skipClipHook: true });
  }

  function selectModel(
    m: Model,
    opts?: {
      focusCamera?: boolean;
      nodeId?: string | null;
      shiftKey?: boolean;
      ctrlKey?: boolean;
      metaKey?: boolean;
      skipClipHook?: boolean;
      /** 禁止展开模型树（大体量时展开会卡死页面） */
      skipReveal?: boolean;
    }
  ) {
    const focusCamera = opts?.focusCamera ?? false;
    const nodeId = opts?.nodeId ?? null;
    const resolvedNodeId = nodeId ? resolveSelectedNodeId(m.id, nodeId) : null;

    if (!opts?.skipClipHook) {
      const handled = handleClipModelInteraction(m.id, resolvedNodeId, {
        shiftKey: opts?.shiftKey,
        ctrlKey: opts?.ctrlKey,
        metaKey: opts?.metaKey,
        focusCamera
      });
      if (handled) return;
      // 多选修饰键在无片段时已 toast，避免再走单选把状态冲掉
      if (opts?.shiftKey || opts?.ctrlKey || opts?.metaKey) return;
    }

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
      syncModelForm(selectedChapter.value);

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
          applyChapterMeshFromCurrentVideo(selectedChapter.value);
        } else if (!activeAnimClipId.value) {
          // 非片段编辑：离开上一目标时用章节/草稿外观收尾
          const prevModel = models.value.find(item => item.id === prevModelId);
          if (prevModel) {
            applyTargetAnimVisualState(selectedChapter.value, prevModel, prevNodeId);
          }
        }
        // 片段编辑态：禁止用章节默认盖掉上一目标的 clipVisual（显隐/线框等）
      }
      clearLiveAnimEditorState();
    } else if (selectionChanged) {
      clearLiveAnimEditorState();
    }
    applySelection();
    if (!getActiveChapter()) {
      toastShow("请先添加节点后再配置模型样式", "warning");
    }
    // 列表点击也同步展开路径，保证深层选中可见（大体量跳过，否则瞬间挂载百级树节点卡死）
    if (!opts?.skipReveal) {
      revealModelTreeSelection(m.id, resolvedNodeId);
    } else {
      rightTab.value = "model";
    }
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
    const saved = cfg.animConfig?.segments;
    if (!saved?.length) return true;
    if (saved.length !== animSegments.length) return true;
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
        endRot: seg.endRot ?? [0, 0, 0],
        clipVisual: serializeClipVisual(seg.clipVisual)
      });
    return animSegments.some((seg, i) => norm(seg) !== norm(mapStoredAnimSegment({
      ...saved[i],
      clipVisual: saved[i].clipVisual ?? clipVisualFromModelConfig(cfg)
    })));
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

    const resumeTime = Number.isFinite(currentTime.value) ? currentTime.value : 0;
    const video = videoEl.value;
    const wasPlaying = !!(
      isPlaying.value ||
      (video && !video.paused && !video.ended)
    );
    const resumeChapter =
      selectedChapter.value ??
      getPlaybackChapterAtTime(resumeTime) ??
      getPresentationStartChapter();

    if (animDirty.value) persistAllChapterDrafts();
    if (resumeChapter && isAnimationNode(resumeChapter) && (resumeChapter.clips?.length || 0) > 0) {
      ensureClipPlaybackCache(resumeChapter);
    }

    stopChapterAnimation();
    chapterPlayTarget.value = null;
    isPreviewMode.value = true;
    showVideoPip.value = true;
    if (videoSrc.value) syncVideoElementSrc(videoSrc.value);
    syncEditorGizmosVisibility();
    syncPresentationInteractionMode();
    syncVideoAudioState();
    syncPresentationRenderProfile({ skipComposerRt: true });
    isPlaying.value = wasPlaying;

    const navChapter = resumeChapter
      ? resolvePresentationNavChapter(resumeChapter)
      : getStrictPresentationChapterAtTime(resumeTime);
    nextTick(() => {
      handleResize();
      if (!isPreviewMode.value) return;
      commandPresentationPlayback({
        targetTime: resumeTime,
        intent: wasPlaying ? "play" : "pause",
        navChapter,
        autoAdvance: false
      });
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

    const resumeTime = Number.isFinite(currentTime.value) ? currentTime.value : 0;
    const video = videoEl.value;
    const wasPlaying = !!(
      presentationPlaybackSession.intent === "play" ||
      isPlaying.value ||
      (video && !video.paused && !video.ended)
    );
    const selNode = selectedNodeId.value ? getNodeById(nodes.value, selectedNodeId.value) : null;
    const ch =
      (selNode && isAnimationNode(selNode) ? selNode : null) ??
      selectedChapter.value ??
      getPlaybackChapterAtTime(resumeTime) ??
      null;

    isPreviewMode.value = false;
    chapterPlayTarget.value = null;
    resetPresentationPlaybackSession(resumeTime);
    presentationUiChapterId.value = null;
    presentationNavIndex.value = -1;
    presentationUiRevision.value = 0;
    lastPresentationAutoSwitchChapterId = null;
    chapterAutoNext.value = false;
    presentationManualNavUntil = 0;
    stopChapterAnimation();

    if (ch) {
      selectedChapterId.value = ch.id;
      selectedNodeId.value = ch.id;
      videoOnlyMode.value = false;
    }

    restoreEditModeVideoPipFromSelection();
    currentTime.value = resumeTime;

    syncEditorGizmosVisibility();
    syncPresentationInteractionMode();
    syncVideoAudioState();
    syncPresentationRenderProfile({ skipComposerRt: true });

    if (ch) {
      applyChapterEditorVisualState(ch);
      syncChapterForm(ch);
      syncModelSelectionForChapter(ch);
      cutPlaybackToTime(resumeTime, ch, { keepPlaying: wasPlaying });
    }
    isPlaying.value = wasPlaying;
    if (wasPlaying && videoEl.value?.paused) {
      void videoEl.value.play()?.catch(() => undefined);
    }
    updateSelectionHighlight();

    nextTick(() => {
      handleResize();
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
    requestViewportRender();
    if (!viewportEl.value || !renderer || !camera) return;
    const w = viewportEl.value.clientWidth;
    const h = viewportEl.value.clientHeight;
    if (w <= 0 || h <= 0) return;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    syncRenderPixelRatio();
    renderer.setSize(w, h);
    if (composer) {
      composer.setPixelRatio(renderer.getPixelRatio());
      composer.setSize(w, h);
    }
    syncComposerMsaaSamples();
    syncEditorOutlineDownsample();
    effectiveRenderPixelRatio.value = getRenderPixelRatio();
    if (viewOnly.value) adaptPresentationViewport();
  }

  function unbindViewportResizeObserver() {
    viewportResizeObserver?.disconnect();
    viewportResizeObserver = null;
    if (viewportResizeRaf) {
      cancelAnimationFrame(viewportResizeRaf);
      viewportResizeRaf = 0;
    }
  }

  function bindViewportResizeObserver() {
    unbindViewportResizeObserver();
    const el = viewportEl.value;
    if (!el || typeof ResizeObserver === "undefined") return;
    viewportResizeObserver = new ResizeObserver(() => {
      if (viewportResizeRaf) return;
      viewportResizeRaf = requestAnimationFrame(() => {
        viewportResizeRaf = 0;
        handleResize();
      });
    });
    viewportResizeObserver.observe(el);
    handleResize();
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

  watch(editorInitializing, busy => {
    if (busy || !renderer) return;
    nextTick(() => {
      handleResize();
      requestAnimationFrame(() => {
        handleResize();
        commitStoredSceneVisuals();
        markSceneAsSavedBaseline();
        enqueueChapterCachePrefetch();
        try {
          const srcs = getVideoNodes(nodes.value).map(v =>
            v.videoSrc ? resolveAssetUrl(v.videoSrc) || v.videoSrc : null
          );
          for (const src of srcs) {
            if (!src) continue;
            prefetchSeekableMedia(src);
            warmVideoSrc(src);
          }
        } catch {
          /* ignore */
        }
      });
    });
  });

  watch(
    () => [editorInitializing.value, chapters.value.length] as const,
    ([busy, n]) => {
      if (busy || !n) return;
      enqueueChapterCachePrefetch();
    }
  );

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

        // 禁止在此 applyChapterEditorVisualState / resetAllModelsToDefault：
        // navigate/applyChapter 已处理；此处再刷一遍（尤其大 GLB）会把点击栈卡死。
        // 仅清 UI 选中与表单即可。
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
    // 介绍条可延后：勿挡切章首帧上屏
    queueMicrotask(() => {
      syncIntroPresentation();
    });
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
      if (!editorAlive) return;
      init3D();
      const result = await loadSceneByCode(queryCode);
      if (!editorAlive) return;
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
        // 展示页：预建 clips 播放缓存，避免仅靠空的 modelConfigs 导致效果丢失
        for (const ch of chapters.value) {
          if (isAnimationNode(ch) && (ch.clips?.length || 0) > 0) {
            buildChapterPlaybackCacheFromClips(ch);
          }
        }
        // 展示页刷新：停在片头，等待用户手势再播（避免无点击自动播放）。
        void beginPresentationPlayback(getPresentationStartChapter(), {
          autoplay: false
        });
      }
      return;
    }

    const editMeta = queryCode ? await loadEditSceneMeta(queryCode) : null;
    if (!editorAlive) return;
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
      // 本地无已保存场景时，启动一律使用默认场景参数，不吃历史缓存
      skipStoredSceneSettings = true;
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
    if (!editorAlive) return;
    init3D();

    let loadedFromServer = false;
    if (queryCode && !isViewMode) {
      suspendProjectPersist();
      // 有已保存场景时直接加载（场景内含设置），避免先 hydrate 再 load 导致 HDR/PMREM 重复烘焙
      loadedFromServer = await tryLoadSavedSceneForModelSet(queryCode);
      if (!editorAlive) return;
      if (!loadedFromServer) {
        await restoreSceneSettingsForEditor(queryCode);
        if (!editorAlive) return;
      }
    }

    if (!loadedFromServer && queryCode && !isViewMode) {
      // 无已保存场景时：仍加载模型集/本地模型，保证刷新后默认可见
      await tryLoadPendingModelSet();
      const pending = models.value.filter(m => m.url && !meshes.has(m.id));
      await mapPool(pending, DEFAULT_GLB_LOAD_CONCURRENCY, async m => {
        await loadGLB(m);
      });
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

    window.addEventListener("resize", handleResize);
    await flushStoredSceneVisualsAfterLayout();
    stripPreviewModeFromLocation();
    // 灯光布局/环境贴图等可能在下一帧才落稳，延迟再标定一次，避免误报未保存红点
    markSceneAsSavedBaseline();
    await nextTick();
    markSceneAsSavedBaseline();
    requestAnimationFrame(() => {
      markSceneAsSavedBaseline();
      window.setTimeout(() => markSceneAsSavedBaseline(), 300);
    });
    // 首屏刷新后，布局/RT 尺寸可能在后续帧才稳定；
    // 这里再补两次抗锯齿应用，等效用户手点一次「2x」，避免“UI 已选中但未立即生效”。
    requestAnimationFrame(() => {
      applyAntialiasingNow();
      handleResize();
    });
    window.setTimeout(() => {
      applyAntialiasingNow();
      handleResize();
    }, 320);
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
      nextTick(() => {
        handleResize();
        requestAnimationFrame(() => handleResize());
      });
    }
  });

  onUnmounted(() => {
    editorAlive = false;
    editorSessionGen++;
    cancelPendingChapterNavWork();
    cancelAnimationFrame(afid);
    afid = 0;
    visibilityRenderController?.dispose();
    visibilityRenderController = null;
    clearVideoWarmPool();
    clearSeekableMediaCache();
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
    unbindViewportResizeObserver();
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

  function getVisibilityAudit() {
    const out: Array<{
      modelId: string;
      name: string;
      rootVisible: boolean;
      worldVisMeshes: number;
      worldHidMeshes: number;
      hiddenAncestors: string[];
    }> = [];
    meshes.forEach((root, modelId) => {
      let worldVisMeshes = 0;
      let worldHidMeshes = 0;
      const hiddenAncestors: string[] = [];
      if (!root.visible) hiddenAncestors.push(root.name || "root");
      root.traverse(obj => {
        const mesh = obj as THREE.Mesh;
        if (!mesh.isMesh) return;
        if (
          obj.userData?.isEdgeLine ||
          obj.userData?.isSelectionHelper ||
          obj.userData?.isOutlineShell ||
          obj.userData?.isBodyHighlightOverlay
        ) {
          return;
        }
        let world = true;
        let p: THREE.Object3D | null = obj;
        while (p) {
          if (!p.visible) {
            world = false;
            if (hiddenAncestors.length < 4 && p.name && !hiddenAncestors.includes(p.name)) {
              hiddenAncestors.push(p.name);
            }
            break;
          }
          p = p.parent;
        }
        if (world) worldVisMeshes++;
        else worldHidMeshes++;
      });
      out.push({
        modelId,
        name: root.name || "",
        rootVisible: root.visible,
        worldVisMeshes,
        worldHidMeshes,
        hiddenAncestors
      });
    });
    return out;
  }

  function getScenePoseDigest() {
    const round3 = (n: number) => Math.round(n * 1000) / 1000;
    const samples: Array<{
      modelId: string;
      name: string;
      visible: boolean;
      p: [number, number, number];
      s: number;
      vis: string | null;
    }> = [];
    meshes.forEach((root, modelId) => {
      let n = 0;
      root.traverse(obj => {
        if (n >= 20) return;
        samples.push({
          modelId,
          name: obj.name || "",
          visible: obj.visible,
          p: [round3(obj.position.x), round3(obj.position.y), round3(obj.position.z)],
          s: round3(obj.scale.x),
          vis: typeof obj.userData._clipVisualSig === "string" ? obj.userData._clipVisualSig : null
        });
        n++;
      });
    });
    return samples;
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
    playbackClock,
    playbackUiRevision,
    videoIsMuted,
    presentationPlaybackSession,
    presentationDisplayTime,
    presentationCurrentNavChapterId,
    presentationDisplayPlaying,
    getPresentationModelState,
    getScenePoseDigest,
    getVisibilityAudit,
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
    isModelNodeSelected,
    isModelTreeNodeForceExpanded,
    modelTreeExpandRevision,
    revealModelTreeSelection,
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
    persistBoundSceneCode,
    shareLink,
    sceneSavedAt,
    savingScene,
    savingClips,
    persistPercent,
    persistText,
    sceneHasUnsavedChanges,
    sceneNeedsPersist,
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
    clipPlayElapsed,
    clipPlayDuration,
    wallclockPreviewActive,
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
    aoDistanceFallOff,
    aoRadius,
    aoScale,
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
    playTrackOnce,
    addAnimSegment,
    removeAnimSegment,
    moveAnimSegment,
    onAnimClipTimeChange,
    onAnimClipVisualChange,
    onAnimClipIntroChange,
    previewAnimClipVisual,
    getSelectedChapterWindowDuration,
    getAnimationContentDuration,
    activeAnimClipId,
    activeClipTargetKey,
    activeClipTargetKeys,
    clipDraftTargetKey,
    animClipListRevision,
    activeClipEditedKeySet,
    activeClipSelectedKeySet,
    listAnimationClips,
    getActiveAnimationClip,
    selectAnimationClip,
    addAnimationClip,
    removeAnimationClip,
    updateActiveClipTime,
    updateActiveClipTiming,
    updateActiveClipCamera,
    renameActiveClip,
    captureCameraToActiveClip,
    listClipTargetCandidates,
    addClipTarget,
    addSelectedModelToActiveClip,
    removeClipTarget,
    removeSelectedClipTargets,
    selectClipTarget,
    isClipTargetSelected,
    isClipTargetInClip,
    playAnimationClipsOnce,
    playActiveClipOnce,
    saveAnimationClips,
    clearAnimationClips,
    syncAnimClipsForSelectedChapter,
    formatClipTargetLabel,
    clipTargetKey,
    // 兼容旧导出名
    activeAnimTrackKey,
    animTrackListRevision,
    listAnimationTracks,
    listAnimationTrackCandidates,
    selectAnimTrack,
    addAnimationTrack,
    removeAnimationTrack,
    playAnimationTracksOnce,
    saveActiveAnimTrack,
    syncAnimTracksForSelectedChapter,
    animationTrackKey,
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
    activatePresentationVideoNode,
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
    applyAO,
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
