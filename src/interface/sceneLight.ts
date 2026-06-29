export type SceneLightType = "directional" | "spot" | "point";

export interface SceneLightSettings {
  id: string;
  type: SceneLightType;
  name: string;
  color: string;
  intensity: number;
  position: [number, number, number];
  /** 欧拉角（度），用于平行光 / 聚光灯照射方向 */
  rotation: [number, number, number];
  distance: number;
  decay: number;
  /** 聚光灯锥角（度） */
  angle: number;
  penumbra: number;
  castShadow: boolean;
}
