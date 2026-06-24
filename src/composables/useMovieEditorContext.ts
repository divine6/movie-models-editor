import { inject } from "vue";

import { MOVIE_EDITOR_KEY } from "@/composables/movie-editor/keys";
import type { useMovieEditor } from "@/composables/useMovieEditor";

export type MovieEditorContext = ReturnType<typeof useMovieEditor>;

/** 在编辑器子组件中获取共享上下文 */
export function useMovieEditorContext(): MovieEditorContext {
  const ctx = inject<MovieEditorContext>(MOVIE_EDITOR_KEY);
  if (!ctx) {
    throw new Error("useMovieEditorContext 必须在编辑器页面内使用");
  }
  return ctx;
}
