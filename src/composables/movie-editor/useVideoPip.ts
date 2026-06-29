import { computed, nextTick, onMounted, onUnmounted, ref, watch } from "vue";

export const PIP_DEFAULT_WIDTH = 200;
export const PIP_MIN_WIDTH = 140;
export const PIP_MAX_WIDTH_RATIO = 0.75;

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

export interface UseVideoPipOptions {
  getViewportEl: () => HTMLElement | undefined;
  getViewOnly: () => boolean;
  getIsPreviewMode: () => boolean;
  getHasVideo: () => boolean;
  getVideoDisplayWidth: () => number;
  setVideoDisplayWidth: (width: number) => void;
}

export function useVideoPip({
  getViewportEl,
  getViewOnly,
  getIsPreviewMode,
  getHasVideo,
  getVideoDisplayWidth,
  setVideoDisplayWidth
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
    const style: Record<string, string> = { width: `${pipWidth.value}px` };
    if (!pipPresentationMode.value) {
      style.left = `${pipLeft.value}px`;
      style.top = `${pipTop.value}px`;
    }
    return style;
  });

  function clampPipBounds() {
    const viewport = getViewportEl();
    const group = pipGroupRef.value;
    if (!viewport || !group) return;

    const maxWidth = Math.max(PIP_MIN_WIDTH, viewport.clientWidth * PIP_MAX_WIDTH_RATIO);
    pipWidth.value = clamp(pipWidth.value, PIP_MIN_WIDTH, maxWidth);

    const maxLeft = Math.max(0, viewport.clientWidth - pipWidth.value);
    const maxTop = Math.max(0, viewport.clientHeight - group.offsetHeight);
    pipLeft.value = clamp(pipLeft.value, 0, maxLeft);
    pipTop.value = clamp(pipTop.value, 0, maxTop);
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

  function placePipToRight(resetWidth = false) {
    const viewport = getViewportEl();
    if (!viewport) return;
    const presentation = getViewOnly() || getIsPreviewMode();
    if (resetWidth) {
      const storedWidth = getVideoDisplayWidth();
      if (presentation && isDesktopLandscape() && storedWidth > 0) {
        const maxWidth = Math.max(PIP_MIN_WIDTH, viewport.clientWidth * PIP_MAX_WIDTH_RATIO);
        pipWidth.value = clamp(storedWidth, PIP_MIN_WIDTH, maxWidth);
      } else {
        pipWidth.value = resolvePipWidth(viewport.clientWidth, presentation);
      }
    }
    if (!presentation) {
      const inset = { top: 10, right: 10 };
      pipLeft.value = Math.max(inset.right, viewport.clientWidth - pipWidth.value - inset.right);
      pipTop.value = inset.top;
      requestAnimationFrame(clampPipBounds);
    }
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
      if (isDesktopLandscape()) {
        setVideoDisplayWidth(Math.round(pipWidth.value));
      }
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
      placePipToRight(getViewOnly() || getIsPreviewMode());
      const viewport = getViewportEl();
      if (viewport) {
        viewportObserver = new ResizeObserver(() => {
          if (getViewOnly() || getIsPreviewMode()) placePipToRight();
          else clampPipBounds();
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
      nextTick(() => placePipToRight(getViewOnly() || getIsPreviewMode()));
    }
  );

  watch(
    () => getIsPreviewMode(),
    isPreview => {
      if (!isPreview || !getHasVideo()) return;
      nextTick(() => setTimeout(() => placePipToRight(true), 120));
    }
  );

  watch(
    () => getViewOnly(),
    only => {
      if (!only || !getHasVideo()) return;
      nextTick(() => placePipToRight(true));
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
