import type { NavigationGuardNext, RouteLocationNormalized } from "vue-router";

import { fetchModelSet, fetchScene, isEditorServerNotFoundError } from "@/api/modules/editor-server";

export async function editorCodeRouteGuard(
  to: RouteLocationNormalized,
  _from: RouteLocationNormalized,
  next: NavigationGuardNext
) {
  const code = (to.query.code as string) || "";
  if (!code) {
    next();
    return;
  }

  try {
    if ((to.query.mode as string) === "view") {
      const scene = await fetchScene(code);
      document.title = (scene.title || "未命名场景").trim();
    } else {
      const set = await fetchModelSet(code);
      document.title = (set.name || "").trim();
    }
    next();
  } catch (err) {
    if (isEditorServerNotFoundError(err)) {
      next({ path: "/404", replace: true });
      return;
    }
    next();
  }
}
