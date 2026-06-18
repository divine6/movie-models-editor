import { BaseTableViewParams } from "base-components";

import { PORT1 } from "@/api/config/servicePort";
import http from "@/api/http";
import { Result, ResultData } from "@/api/interface";

/**
 * 电影模型 API 服务
 */
export const MovieServiceApi = {
  page: (params: BaseTableViewParams) => http.post<Result>(PORT1 + `/v1/movie/findPage`, params),
  findMovieInfo: (movieId: string) => http.get<ResultData>(PORT1 + `/v1/movie/findMovieInfo/${movieId}`),
  addMovie: (params: Record<string, any>) => http.post<Result>(PORT1 + `/v1/movie/add`, params),
  editMovie: (params: Record<string, any>) => http.put<Result>(PORT1 + `/v1/movie/edit`, params),
  deleteMovie: (movieId: string) => http.delete<Result>(PORT1 + `/v1/movie/delete/${movieId}`)
};
