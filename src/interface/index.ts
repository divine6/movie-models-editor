/**
 * @description 通用
 */
export * from "./common";

// ==================== 电影模型 ====================

/** 电影模型 */
export interface MovieModel {
  id: string;
  name: string;
  type: string;
  director: string;
  releaseYear: number;
  rating: number;
  status: number;
  remark: string;
  createTime: string;
  updateTime: string;
}
