import type { ModelConfig } from "@/interface/project";

/** 与编辑器选中模型轮廓色一致 */
export const DEFAULT_OUTLINE_COLOR = "#409eff";
export const DEFAULT_WIREFRAME_COLOR = "#000000";
export const DEFAULT_MODEL_HIGHLIGHT_COLOR = "#4ade80";

export function createDefaultModelConfig(): ModelConfig {
  return {
    visible: true,
    posOffset: [0, 0, 0],
    scale: 1,
    wireframe: false,
    highlight: false,
    outlineColor: DEFAULT_OUTLINE_COLOR,
    wireframeColor: DEFAULT_WIREFRAME_COLOR,
    modelHighlightColor: DEFAULT_MODEL_HIGHLIGHT_COLOR,
    outline: false,
    animation: true,
    intro: ""
  };
}

export function getModelConfig(cfg?: Partial<ModelConfig> | null): ModelConfig {
  const merged = { ...createDefaultModelConfig(), ...cfg };
  if (cfg?.highlightColor && !cfg.outlineColor && !cfg.modelHighlightColor) {
    merged.outlineColor = cfg.highlightColor;
    merged.modelHighlightColor = cfg.highlightColor;
  }
  return merged;
}
