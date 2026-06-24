import { inject, provide, ref, type InjectionKey, type Ref } from "vue";

export interface PreviewChapterDrawerContext {
  open: Ref<boolean>;
  show: () => void;
  hide: () => void;
  toggle: () => void;
}

export const PREVIEW_CHAPTER_DRAWER_KEY: InjectionKey<PreviewChapterDrawerContext> = Symbol("previewChapterDrawer");

export function providePreviewChapterDrawer() {
  const open = ref(false);
  const ctx: PreviewChapterDrawerContext = {
    open,
    show: () => {
      open.value = true;
    },
    hide: () => {
      open.value = false;
    },
    toggle: () => {
      open.value = !open.value;
    }
  };
  provide(PREVIEW_CHAPTER_DRAWER_KEY, ctx);
  return ctx;
}

export function usePreviewChapterDrawer() {
  const ctx = inject(PREVIEW_CHAPTER_DRAWER_KEY);
  if (!ctx) {
    throw new Error("usePreviewChapterDrawer 必须在编辑器页面内使用");
  }
  return ctx;
}

export function usePreviewChapterDrawerOptional() {
  return inject(PREVIEW_CHAPTER_DRAWER_KEY, null);
}
