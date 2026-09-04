/**
 * Render-loop helpers: visibility pause + idle on-demand gating.
 */

export type RenderLoopActivity = {
  playing: boolean;
  cameraTransition: boolean;
  orbitBusy: boolean;
  dampingMoving: boolean;
  needsRender: boolean;
};

/**
 * Whether the main loop should present a frame this tick.
 * Always present when playing / camera / orbit; otherwise honor needsRender.
 */
export function shouldPresentFrame(
  activity: RenderLoopActivity,
  opts?: { onDemandWhenIdle?: boolean }
): boolean {
  if (activity.playing || activity.cameraTransition || activity.orbitBusy || activity.dampingMoving) {
    return true;
  }
  if (opts?.onDemandWhenIdle === false) return true;
  return activity.needsRender;
}

export type VisibilityRenderController = {
  isHidden: () => boolean;
  dispose: () => void;
};

/**
 * Pause rAF work when the document is hidden (thermal relief).
 */
export function bindVisibilityRenderController(handlers: {
  onHide: () => void;
  onShow: () => void;
}): VisibilityRenderController {
  let hidden = typeof document !== "undefined" ? document.hidden : false;

  const onVis = () => {
    const next = document.hidden;
    if (next === hidden) return;
    hidden = next;
    if (hidden) handlers.onHide();
    else handlers.onShow();
  };

  if (typeof document !== "undefined") {
    document.addEventListener("visibilitychange", onVis);
  }

  return {
    isHidden: () => hidden,
    dispose: () => {
      if (typeof document !== "undefined") {
        document.removeEventListener("visibilitychange", onVis);
      }
    }
  };
}

/** Mobile presentation DPR soft cap (runtime only). */
export const MOBILE_PRESENTATION_DPR_SOFT_CAP = 1.5;
