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

const PRESENTATION_PIP_RIGHT_GAP = 0;

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
  setVideoDisplayWidth: (width: number) => void;
  setVideoDisplayWidthRatio: (ratio: number) => void;
  setVideoDisplayPosition: (left: number, top: number) => void;
  setVideoDisplayPositionRatio: (xRatio: number, yRatio: number) => void;
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
  setVideoDisplayWidth,
  setVideoDisplayWidthRatio,
  setVideoDisplayPosition,
  setVideoDisplayPositionRatio
}: UseVideoPipOptions) {
  const pipGroupRef = ref<HTMLElement | null>(null);
  const pipWidth = ref(PIP_DEFAULT_WIDTH);
  const pipLeft = ref(10);
  const pipTop = ref(10);
  const pipDragging = ref(false);
  const pipResizing = ref(false);

  const pipPresentationMode = computed(() => getViewOnly() || getIsPreviewMode());

  function isDesktopLandscape() {
    if (typeof window === "undefined") return false;
    const isCoarse = window.matchMedia?.("(pointer: coarse)")?.matches ?? false;
    return !isCoarse && window.innerWidth > window.innerHeight;
  }

  const pipStyle = computed(() => {
    const style: Record<string, string> = {
      width: `${pipWidth.value}px`,
      left: `${pipLeft.value}px`,
      top: `${pipTop.value}px`
    };
    return style;
  });

  function clampPipBounds() {
    const viewport = getViewportEl();
    const group = pipGroupRef.value;
    if (!viewport || !group) return;

    const maxWidth = Math.max(PIP_MIN_WIDTH, viewport.clientWidth * PIP_MAX_WIDTH_RATIO);
    pipWidth.value = clamp(pipWidth.value, PIP_MIN_WIDTH, maxWidth);

    const bounds = resolvePipBounds(viewport, group.offsetHeight);
    pipLeft.value = clamp(pipLeft.value, bounds.minLeft, bounds.maxLeft);
    pipTop.value = clamp(pipTop.value, bounds.minTop, bounds.maxTop);
  }

  function resolvePipWidth(viewportWidth: number, presentation: boolean) {
    if (presentation) {
      if (viewportWidth <= 480) return Math.min(200, Math.max(148, Math.round(viewportWidth * 0.42)));
      if (viewportWidth <= 768) return Math.min(220, Math.max(168, Math.round(viewportWidth * 0.38)));
      return Math.min(150, Math.max(120, Math.round(viewportWidth * 0.11)));
    }
    if (viewportWidth <= 640) return 160;
    return PIP_DEFAULT_WIDTH;
  }

  function resolveDefaultPipPosition(viewport: HTMLElement, presentation: boolean) {
    const groupHeight = pipGroupRef.value?.offsetHeight || 0;
    const bounds = resolvePipBounds(viewport, groupHeight);
    if (!presentation) {
      return {
        left: bounds.maxLeft,
        top: bounds.minTop
      };
    }
    return {
      left: bounds.maxLeft,
      top: bounds.minTop
    };
  }

  function resolvePipBounds(viewport: HTMLElement, groupHeight: number): PipBounds {
    let minLeft = 0;
    let minTop = 0;
    let maxLeft = Math.max(0, viewport.clientWidth - pipWidth.value);
    let maxTop = Math.max(0, viewport.clientHeight - groupHeight);
    if (!pipPresentationMode.value) {
      return { minLeft, maxLeft, minTop, maxTop };
    }

    maxLeft = Math.max(0, viewport.clientWidth - pipWidth.value - PRESENTATION_PIP_RIGHT_GAP);

    const margin = 8;
    const viewportRect = viewport.getBoundingClientRect();
    const topbar = document.querySelector(".editor-topbar") as HTMLElement | null;
    if (topbar) {
      const rect = topbar.getBoundingClientRect();
      const top = rect.bottom - viewportRect.top + margin;
      if (Number.isFinite(top)) minTop = Math.max(minTop, top);
    }

    const leftPanel = document.querySelector(".chapter-preview-panel") as HTMLElement | null;
    if (leftPanel) {
      const rect = leftPanel.getBoundingClientRect();
      const overlapsViewport = rect.right > viewportRect.left && rect.left < viewportRect.right;
      if (overlapsViewport && rect.width > 0 && rect.height > 0) {
        const left = rect.right - viewportRect.left + margin;
        if (Number.isFinite(left)) minLeft = Math.max(minLeft, left);
      }
    }

    const progress = document.querySelector(".progress-area.preview-progress") as HTMLElement | null;
    if (progress) {
      const rect = progress.getBoundingClientRect();
      const top = rect.top - viewportRect.top - groupHeight - margin;
      if (Number.isFinite(top)) maxTop = Math.min(maxTop, top);
    }

    maxLeft = Math.max(minLeft, maxLeft);
    maxTop = Math.max(minTop, maxTop);
    return { minLeft, maxLeft, minTop, maxTop };
  }

  function placePipToRight(resetWidth = false, preferStoredPosition = false) {
    const viewport = getViewportEl();
    if (!viewport) return;
    const presentation = getViewOnly() || getIsPreviewMode();
    if (resetWidth) {
      const storedWidth = getVideoDisplayWidth();
      const storedWidthRatio = getVideoDisplayWidthRatio();
      const maxWidth = Math.max(PIP_MIN_WIDTH, viewport.clientWidth * PIP_MAX_WIDTH_RATIO);
      if (Number.isFinite(storedWidthRatio) && (storedWidthRatio as number) > 0) {
        pipWidth.value = clamp(viewport.clientWidth * (storedWidthRatio as number), PIP_MIN_WIDTH, maxWidth);
      } else if (storedWidth > 0) {
        pipWidth.value = clamp(storedWidth, PIP_MIN_WIDTH, maxWidth);
      } else {
        pipWidth.value = resolvePipWidth(viewport.clientWidth, presentation);
      }
    }
    const storedLeft = getVideoDisplayLeft();
    const storedTop = getVideoDisplayTop();
    const storedXRatio = getVideoDisplayXRatio();
    const storedYRatio = getVideoDisplayYRatio();
    const hasStoredPosition = Number.isFinite(storedLeft) && Number.isFinite(storedTop);
    const hasStoredRatio = Number.isFinite(storedXRatio) && Number.isFinite(storedYRatio);
    if (preferStoredPosition && hasStoredPosition) {
      const groupHeight = pipGroupRef.value?.offsetHeight || 0;
      const bounds = resolvePipBounds(viewport, groupHeight);
      if (hasStoredRatio) {
        const xSpan = Math.max(0, bounds.maxLeft - bounds.minLeft);
        const ySpan = Math.max(0, bounds.maxTop - bounds.minTop);
        const nx = clamp(storedXRatio as number, 0, 1);
        const ny = clamp(storedYRatio as number, 0, 1);
        pipLeft.value = bounds.minLeft + xSpan * nx;
        pipTop.value = bounds.minTop + ySpan * ny;
      } else {
        pipLeft.value = Math.round(storedLeft as number);
        pipTop.value = Math.round(storedTop as number);
      }
    } else {
      const fallback = resolveDefaultPipPosition(viewport, presentation);
      pipLeft.value = fallback.left;
      pipTop.value = fallback.top;
    }
    requestAnimationFrame(clampPipBounds);
  }

  function persistCurrentPipPosition() {
    const viewport = getViewportEl();
    const group = pipGroupRef.value;
    if (!viewport || !group) return;
    const bounds = resolvePipBounds(viewport, group.offsetHeight);
    const xSpan = Math.max(0, bounds.maxLeft - bounds.minLeft);
    const ySpan = Math.max(0, bounds.maxTop - bounds.minTop);
    const widthRatio = viewport.clientWidth > 0 ? pipWidth.value / viewport.clientWidth : 0;
    const xRatio = xSpan > 0 ? (pipLeft.value - bounds.minLeft) / xSpan : 1;
    const yRatio = ySpan > 0 ? (pipTop.value - bounds.minTop) / ySpan : 0;
    setVideoDisplayWidthRatio(clamp(widthRatio, 0, PIP_MAX_WIDTH_RATIO));
    setVideoDisplayPosition(Math.round(pipLeft.value), Math.round(pipTop.value));
    setVideoDisplayPositionRatio(clamp(xRatio, 0, 1), clamp(yRatio, 0, 1));
  }

  function onPipDragStart(e: MouseEvent) {
    if (getViewOnly()) return;
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
    if (getViewOnly()) return;
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
      setVideoDisplayWidth(Math.round(pipWidth.value));
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

  let viewportObserver: ResizeObserver | null = null;

  onMounted(() => {
    nextTick(() => {
      placePipToRight(true, true);
      const viewport = getViewportEl();
      if (viewport) {
        viewportObserver = new ResizeObserver(() => {
          clampPipBounds();
        });
        viewportObserver.observe(viewport);
      }
    });
  });

  onUnmounted(() => {
    viewportObserver?.disconnect();
  });

  watch(
    () => getHasVideo(),
    value => {
      if (!value) return;
      nextTick(() => placePipToRight(true, true));
    }
  );

  watch(
    () => getIsPreviewMode(),
    isPreview => {
      if (!isPreview || !getHasVideo()) return;
      nextTick(() => setTimeout(() => placePipToRight(true, true), 120));
    }
  );

  watch(
    () => getViewOnly(),
    only => {
      if (!only || !getHasVideo()) return;
      nextTick(() => placePipToRight(true, true));
    }
  );

  return {
    pipGroupRef,
    pipStyle,
    pipDragging,
    pipResizing,
    placePipToRight,
    onPipDragStart,
    onPipResizeStart
  };
}
