import { computed, nextTick, onMounted, onUnmounted, ref, watch } from "vue";

export const PIP_DEFAULT_WIDTH = 200;
export const PIP_MIN_WIDTH = 140;
export const PIP_MAX_WIDTH_RATIO = 0.75;

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

type PipBounds = {
  minLeft: number;
  maxLeft: number;
  minTop: number;
  maxTop: number;
};

export interface UseVideoPipOptions {
  getViewportEl: () => HTMLElement | undefined;
  getViewOnly: () => boolean;
  getIsPreviewMode: () => boolean;
  getHasVideo: () => boolean;
  getVideoDisplayWidth: () => number;
  getVideoDisplayWidthRatio: () => number | undefined;
  getVideoDisplayLeft: () => number | undefined;
  getVideoDisplayTop: () => number | undefined;
  getVideoDisplayXRatio: () => number | undefined;
  getVideoDisplayYRatio: () => number | undefined;
  getVideoDisplayViewportWidth: () => number | undefined;
  getVideoDisplayViewportHeight: () => number | undefined;
  setVideoDisplayWidth: (width: number) => void;
  setVideoDisplayWidthRatio: (ratio: number) => void;
  setVideoDisplayPosition: (left: number, top: number) => void;
  setVideoDisplayPositionRatio: (xRatio: number, yRatio: number) => void;
  setVideoDisplayViewportSize: (width: number, height: number) => void;
}

export function useVideoPip({
  getViewportEl,
  getViewOnly,
  getIsPreviewMode,
  getHasVideo,
  getVideoDisplayWidth,
  getVideoDisplayWidthRatio,
  getVideoDisplayLeft,
  getVideoDisplayTop,
  getVideoDisplayXRatio,
  getVideoDisplayYRatio,
  getVideoDisplayViewportWidth,
  getVideoDisplayViewportHeight,
  setVideoDisplayWidth,
  setVideoDisplayWidthRatio,
  setVideoDisplayPosition,
  setVideoDisplayPositionRatio,
  setVideoDisplayViewportSize
}: UseVideoPipOptions) {
  const pipGroupRef = ref<HTMLElement | null>(null);
  const pipWidth = ref(PIP_DEFAULT_WIDTH);
  const pipLeft = ref(10);
  const pipTop = ref(10);
  const pipDragging = ref(false);
  const pipResizing = ref(false);
  /** 首次按存储布局落位前隐藏，避免闪到默认角再跳过去 */
  const pipLayoutReady = ref(false);

  function isMobilePresentationViewport() {
    if (typeof window === "undefined") return false;
    const coarse = window.matchMedia?.("(pointer: coarse)")?.matches ?? false;
    return coarse || window.innerWidth <= 768;
  }

  const pipStyle = computed(() => {
    const style: Record<string, string> = {
      width: `${pipWidth.value}px`,
      left: `${pipLeft.value}px`,
      top: `${pipTop.value}px`
    };
    if (!pipLayoutReady.value) {
      style.opacity = "0";
      style.pointerEvents = "none";
    }
    return style;
  });

  /** 用视频画面高度算坐标，信息栏显隐不影响编辑↔预览换算 */
  function getPipVideoHeight() {
    const group = pipGroupRef.value;
    if (!group) return 0;
    const videoBox = group.querySelector(".video-pip") as HTMLElement | null;
    if (videoBox && videoBox.offsetHeight > 0) return videoBox.offsetHeight;
    return group.offsetHeight;
  }

  function getPipGroupHeight() {
    return pipGroupRef.value?.offsetHeight || 0;
  }

  function resolveStorageBounds(viewport: HTMLElement, boxHeight: number): PipBounds {
    return {
      minLeft: 0,
      maxLeft: Math.max(0, viewport.clientWidth - pipWidth.value),
      minTop: 0,
      maxTop: Math.max(0, viewport.clientHeight - boxHeight)
    };
  }

  function clampPipBounds() {
    const viewport = getViewportEl();
    const group = pipGroupRef.value;
    if (!viewport || !group) return;

    const maxWidth = Math.max(PIP_MIN_WIDTH, viewport.clientWidth * PIP_MAX_WIDTH_RATIO);
    pipWidth.value = clamp(pipWidth.value, PIP_MIN_WIDTH, maxWidth);

    // 拖拽可活动范围仍按整组高度，避免信息栏拖出屏幕
    const bounds = resolveStorageBounds(viewport, getPipGroupHeight());
    pipLeft.value = clamp(pipLeft.value, bounds.minLeft, bounds.maxLeft);
    pipTop.value = clamp(pipTop.value, bounds.minTop, bounds.maxTop);
  }

  function resolvePipWidth(viewportWidth: number, presentation: boolean) {
    if (presentation) {
      if (viewportWidth <= 480) return Math.min(240, Math.max(168, Math.round(viewportWidth * 0.5)));
      if (viewportWidth <= 768) return Math.min(240, Math.max(180, Math.round(viewportWidth * 0.42)));
      return Math.min(150, Math.max(120, Math.round(viewportWidth * 0.11)));
    }
    if (viewportWidth <= 640) return 160;
    return PIP_DEFAULT_WIDTH;
  }

  function resolveDefaultPipPosition(viewport: HTMLElement) {
    const bounds = resolveStorageBounds(viewport, getPipVideoHeight() || getPipGroupHeight());
    return {
      left: bounds.maxLeft,
      top: bounds.minTop
    };
  }

  /** 手机展示/预览：固定右上（避开顶栏），对齐设计标注位，不沿用桌面编辑态坐标 */
  function resolveFixedMobilePipLayout(viewport: HTMLElement) {
    const root = document.querySelector(".movie-editor") as HTMLElement | null;
    const topbar = document.querySelector(".editor-topbar") as HTMLElement | null;
    let topbarH = 48;
    if (topbar) {
      const h = topbar.getBoundingClientRect().height;
      if (Number.isFinite(h) && h > 0) topbarH = h;
    } else if (root) {
      const raw = getComputedStyle(root).getPropertyValue("--preview-topbar-height").trim();
      const n = parseFloat(raw);
      if (Number.isFinite(n) && n > 0) topbarH = n;
    }

    const gap = viewport.clientWidth <= 480 ? 16 : 20;
    const right = 16;
    const maxWidth = Math.max(PIP_MIN_WIDTH, viewport.clientWidth * PIP_MAX_WIDTH_RATIO);
    const width = clamp(resolvePipWidth(viewport.clientWidth, true), PIP_MIN_WIDTH, maxWidth);
    const left = Math.max(0, viewport.clientWidth - width - right);
    const top = Math.max(0, Math.round(topbarH + gap));

    return { width, left, top };
  }

  /**
   * 编辑/预览视口尺寸不同：用落盘时记录的视口把像素换算到当前区域。
   * 优先 视口比例；其次 绝对像素 × (当前视口/落盘视口)；最后才用裸像素。
   */
  function resolveConvertedLayout(viewport: HTMLElement) {
    const currentW = viewport.clientWidth;
    const currentH = viewport.clientHeight;
    const maxWidth = Math.max(PIP_MIN_WIDTH, currentW * PIP_MAX_WIDTH_RATIO);

    const storedWidth = getVideoDisplayWidth();
    const storedWidthRatio = getVideoDisplayWidthRatio();
    const storedLeft = getVideoDisplayLeft();
    const storedTop = getVideoDisplayTop();
    const storedXRatio = getVideoDisplayXRatio();
    const storedYRatio = getVideoDisplayYRatio();
    const refW = getVideoDisplayViewportWidth();
    const refH = getVideoDisplayViewportHeight();

    const hasWidthRatio = Number.isFinite(storedWidthRatio) && (storedWidthRatio as number) > 0;
    const hasPosRatio = Number.isFinite(storedXRatio) && Number.isFinite(storedYRatio);
    const hasAbsPos = Number.isFinite(storedLeft) && Number.isFinite(storedTop);
    const hasRefSize =
      Number.isFinite(refW) && (refW as number) > 0 && Number.isFinite(refH) && (refH as number) > 0;

    let width: number;
    if (hasWidthRatio) {
      width = currentW * (storedWidthRatio as number);
    } else if (storedWidth > 0 && hasRefSize) {
      width = storedWidth * (currentW / (refW as number));
    } else if (storedWidth > 0) {
      width = storedWidth;
    } else {
      width = resolvePipWidth(currentW, getViewOnly() || getIsPreviewMode());
    }
    width = clamp(Math.round(width), PIP_MIN_WIDTH, maxWidth);

    // 先写入宽度，后续边界计算依赖 pipWidth
    pipWidth.value = width;

    const boxHeight = getPipVideoHeight() || Math.round(width * 9 / 16);
    const bounds = resolveStorageBounds(viewport, boxHeight);
    const xSpan = Math.max(0, bounds.maxLeft - bounds.minLeft);
    const ySpan = Math.max(0, bounds.maxTop - bounds.minTop);

    let left: number;
    let top: number;

    if (hasPosRatio) {
      // 存的是相对「可放区域」的 0~1，在当前视口可放区域里还原
      left = bounds.minLeft + xSpan * clamp(storedXRatio as number, 0, 1);
      top = bounds.minTop + ySpan * clamp(storedYRatio as number, 0, 1);
    } else if (hasAbsPos && hasRefSize) {
      left = (storedLeft as number) * (currentW / (refW as number));
      top = (storedTop as number) * (currentH / (refH as number));
    } else if (hasAbsPos) {
      left = storedLeft as number;
      top = storedTop as number;
    } else {
      const fallback = resolveDefaultPipPosition(viewport);
      left = fallback.left;
      top = fallback.top;
    }

    return {
      width,
      left: Math.round(clamp(left, bounds.minLeft, bounds.maxLeft)),
      top: Math.round(clamp(top, bounds.minTop, bounds.maxTop))
    };
  }

  function placePipToRight(resetWidth = false, preferStoredPosition = false) {
    const viewport = getViewportEl();
    if (!viewport) return;
    const presentation = getViewOnly() || getIsPreviewMode();
    const fixedMobilePresentation = presentation && isMobilePresentationViewport();

    if (fixedMobilePresentation) {
      const layout = resolveFixedMobilePipLayout(viewport);
      pipWidth.value = layout.width;
      pipLeft.value = layout.left;
      pipTop.value = layout.top;
      // 不再 clamp 到贴顶，保持顶栏下方的固定位
      pipLayoutReady.value = true;
      return;
    }

    if (preferStoredPosition || resetWidth) {
      const layout = resolveConvertedLayout(viewport);
      pipWidth.value = layout.width;
      pipLeft.value = layout.left;
      pipTop.value = layout.top;
      clampPipBounds();
      pipLayoutReady.value = true;
      return;
    }

    if (resetWidth) {
      const maxWidth = Math.max(PIP_MIN_WIDTH, viewport.clientWidth * PIP_MAX_WIDTH_RATIO);
      pipWidth.value = clamp(resolvePipWidth(viewport.clientWidth, presentation), PIP_MIN_WIDTH, maxWidth);
    }
    const fallback = resolveDefaultPipPosition(viewport);
    pipLeft.value = fallback.left;
    pipTop.value = fallback.top;
    clampPipBounds();
    pipLayoutReady.value = true;
  }

  function persistCurrentPipPosition() {
    const viewport = getViewportEl();
    const group = pipGroupRef.value;
    if (!viewport || !group) return;

    // 比例用视频画面高度，保证预览隐藏信息栏后仍能还原相对位置/大小
    const bounds = resolveStorageBounds(viewport, getPipVideoHeight() || group.offsetHeight);
    const xSpan = Math.max(0, bounds.maxLeft - bounds.minLeft);
    const ySpan = Math.max(0, bounds.maxTop - bounds.minTop);
    const widthRatio = viewport.clientWidth > 0 ? pipWidth.value / viewport.clientWidth : 0;
    const xRatio = xSpan > 0 ? (pipLeft.value - bounds.minLeft) / xSpan : 1;
    const yRatio = ySpan > 0 ? (pipTop.value - bounds.minTop) / ySpan : 0;

    setVideoDisplayWidth(Math.round(pipWidth.value));
    setVideoDisplayWidthRatio(clamp(widthRatio, 0, PIP_MAX_WIDTH_RATIO));
    setVideoDisplayPosition(Math.round(pipLeft.value), Math.round(pipTop.value));
    setVideoDisplayPositionRatio(clamp(xRatio, 0, 1), clamp(yRatio, 0, 1));
    setVideoDisplayViewportSize(viewport.clientWidth, viewport.clientHeight);
  }

  function onPipDragStart(e: MouseEvent) {
    if (getViewOnly() || getIsPreviewMode()) return;
    if (e.button !== 0) return;
    const target = e.target as HTMLElement;
    if (target.closest(".video-pip-del, .pip-resize-handle")) return;

    const viewport = getViewportEl();
    const group = pipGroupRef.value;
    if (!viewport || !group) return;

    e.preventDefault();
    pipDragging.value = true;

    const startX = e.clientX;
    const startY = e.clientY;
    const originLeft = pipLeft.value;
    const originTop = pipTop.value;
    const maxLeft = viewport.clientWidth - pipWidth.value;
    const maxTop = viewport.clientHeight - group.offsetHeight;

    const onMove = (ev: MouseEvent) => {
      pipLeft.value = clamp(originLeft + ev.clientX - startX, 0, maxLeft);
      pipTop.value = clamp(originTop + ev.clientY - startY, 0, maxTop);
    };

    const onUp = () => {
      pipDragging.value = false;
      persistCurrentPipPosition();
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
      document.body.style.removeProperty("user-select");
      document.body.style.removeProperty("cursor");
    };

    document.body.style.userSelect = "none";
    document.body.style.cursor = "move";
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  }

  function onPipResizeStart(e: MouseEvent) {
    if (getViewOnly() || getIsPreviewMode()) return;
    if (e.button !== 0) return;

    const viewport = getViewportEl();
    if (!viewport) return;

    e.preventDefault();
    pipResizing.value = true;

    const startX = e.clientX;
    const originLeft = pipLeft.value;
    const originWidth = pipWidth.value;
    const originRight = originLeft + originWidth;
    const maxWidth = Math.max(PIP_MIN_WIDTH, viewport.clientWidth * PIP_MAX_WIDTH_RATIO);

    const onMove = (ev: MouseEvent) => {
      const dx = ev.clientX - startX;
      const newLeft = clamp(originLeft + dx, 0, originRight - PIP_MIN_WIDTH);
      const newWidth = clamp(originRight - newLeft, PIP_MIN_WIDTH, maxWidth);
      pipWidth.value = newWidth;
      pipLeft.value = originRight - newWidth;
    };

    const onUp = () => {
      pipResizing.value = false;
      persistCurrentPipPosition();
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
      document.body.style.removeProperty("user-select");
      document.body.style.removeProperty("cursor");
    };

    document.body.style.userSelect = "none";
    document.body.style.cursor = "nesw-resize";
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  }

  function applyStoredLayoutSoon() {
    placePipToRight(true, true);
    nextTick(() => {
      placePipToRight(true, true);
      requestAnimationFrame(() => placePipToRight(true, true));
    });
  }

  let viewportObserver: ResizeObserver | null = null;

  onMounted(() => {
    pipLayoutReady.value = false;
    applyStoredLayoutSoon();
    const viewport = getViewportEl();
    if (viewport) {
      viewportObserver = new ResizeObserver(() => {
        if (pipDragging.value || pipResizing.value) return;
        // 视口尺寸变化（进/出预览侧栏变化）时按存储比例重新换算
        placePipToRight(true, true);
      });
      viewportObserver.observe(viewport);
    }
  });

  onUnmounted(() => {
    viewportObserver?.disconnect();
  });

  watch(
    () => getHasVideo(),
    value => {
      if (!value) {
        pipLayoutReady.value = false;
        return;
      }
      applyStoredLayoutSoon();
    }
  );

  watch(
    () => getIsPreviewMode(),
    () => {
      if (!getHasVideo()) return;
      pipLayoutReady.value = false;
      applyStoredLayoutSoon();
    }
  );

  watch(
    () => getViewOnly(),
    only => {
      if (!only || !getHasVideo()) return;
      pipLayoutReady.value = false;
      applyStoredLayoutSoon();
    }
  );

  return {
    pipGroupRef,
    pipStyle,
    pipDragging,
    pipResizing,
    pipLayoutReady,
    placePipToRight,
    onPipDragStart,
    onPipResizeStart
  };
}
