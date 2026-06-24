import type { ModelConfig } from "@/interface/project";

export function createDefaultModelConfig(): ModelConfig {
  return {
    visible: true,
    posOffset: [0, 0, 0],
    scale: 1,
    highlight: false,
    highlightColor: "#00ff00",
    outline: false,
    animation: true,
    intro: ""
  };
}

export function getModelConfig(cfg?: Partial<ModelConfig> | null): ModelConfig {
  return { ...createDefaultModelConfig(), ...cfg };
}
