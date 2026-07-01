export interface EditorServerModel {
  id: string;
  name: string;
  type: string;
  path: string;
  basePosition?: [number, number, number];
}

export interface EditorServerModelSet {
  id: string;
  code: string;
  name: string;
  companyName?: string;
  models: EditorServerModel[];
}

export interface EditorServerSceneItem {
  code: string;
  title: string;
  modelSetCode?: string;
  previewUrl?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface EditorAdminOverview {
  editSceneCount: number;
  sceneCount: number;
  adminUrl?: string;
  modelSets: Array<
    EditorServerModelSet & {
      editUrl: string;
      previewUrl?: string;
      modelsApiUrl: string;
      companyName?: string;
      createdAt?: string;
    }
  >;
  sceneTree: {
    tree: Array<{
      editSceneCode: string;
      editSceneName: string;
      companyName: string;
      editUrl: string;
      previewUrl?: string;
      scenes: EditorServerSceneItem[];
    }>;
    orphans: EditorServerSceneItem[];
  };
}

export type EditorRouteMode = "admin" | "edit" | "preview" | "view";

export interface UploadVideoResult {
  url: string;
  path: string;
}

const DEFAULT_SERVER_PORT = "4000";
const DEFAULT_EDITOR_PORT = "5173";

export function editorServerBaseUrl() {
  const envUrl = (import.meta.env.VITE_EDITOR_SERVER_URL as string | undefined)?.trim();
  if (envUrl) {
    const normalized = envUrl.replace(/\/$/, "");
    // 相对路径走 Vite 代理（开发环境同源，避免 Failed to fetch）
    if (normalized.startsWith("/")) {
      if (typeof window !== "undefined") return normalized;
      return `http://127.0.0.1:4000`;
    }
    return normalized;
  }
  if (typeof window === "undefined") {
    return `http://127.0.0.1:${DEFAULT_SERVER_PORT}`;
  }
  const { protocol, hostname } = window.location;
  return `${protocol}//${hostname}:${DEFAULT_SERVER_PORT}`;
}

/** 将 editorServerBaseUrl 解析为可用于 URL 重写的绝对地址（局域网访问时跟随当前页面 host） */
function resolveEditorServerAbsoluteBase(): URL {
  const base = editorServerBaseUrl();
  if (typeof window !== "undefined" && base.startsWith("/")) {
    return new URL(base.replace(/\/$/, ""), window.location.origin);
  }
  return new URL(base.endsWith("/") ? base : `${base}/`);
}

/** 编辑页前端地址（手机/局域网访问时跟随当前页面 host） */
export function editorFrontendBaseUrl() {
  const envUrl = (import.meta.env.VITE_EDITOR_FRONTEND_URL as string | undefined)?.trim();
  if (envUrl) return envUrl.replace(/\/$/, "");
  const { protocol, hostname, port } = window.location;
  const editorPort =
    port && port !== DEFAULT_SERVER_PORT && port !== "80" && port !== "443" ? port : DEFAULT_EDITOR_PORT;
  return `${protocol}//${hostname}:${editorPort}`;
}

export function buildModelSetEditLink(modelSetCode: string) {
  const base = editorFrontendBaseUrl();
  return `${base}/#/project/editor?code=${encodeURIComponent(modelSetCode)}`;
}

/** 编辑器内预览（非展示链接） */
export function buildModelSetPreviewLink(modelSetCode: string) {
  const base = editorFrontendBaseUrl();
  return `${base}/#/project/editor?mode=preview&code=${encodeURIComponent(modelSetCode)}`;
}

export function buildScenePreviewLink(sceneCode: string) {
  const base = editorFrontendBaseUrl();
  return `${base}/#/project/editor?mode=view&code=${encodeURIComponent(sceneCode)}`;
}

export function buildEditorAdminLink() {
  const base = editorFrontendBaseUrl();
  return `${base}/#/project/admin`;
}

/** 根据路由 query 解析编辑器四种模式 */
export function resolveEditorRouteMode(query: Record<string, string | string[] | undefined>): EditorRouteMode {
  const mode = String(query.mode || "");
  if (mode === "view" && query.code) return "view";
  if (mode === "preview") return "preview";
  if (query.code) return "edit";
  return "edit";
}

export function rewireEditorFrontendHost(url: string) {
  try {
    const u = new URL(url);
    const base = new URL(editorFrontendBaseUrl());
    u.protocol = base.protocol;
    u.hostname = base.hostname;
    u.port = base.port;
    return u.toString();
  } catch {
    return url;
  }
}

export function resolveAssetUrl(path: string) {
  if (!path) return "";
  if (/^https?:\/\//i.test(path)) return rewireEditorServerHost(path);
  return `${editorServerBaseUrl()}${path.startsWith("/") ? path : `/${path}`}`;
}

export function rewireEditorServerHost(url: string) {
  try {
    const u = new URL(url);
    const base = resolveEditorServerAbsoluteBase();
    const serverBase = editorServerBaseUrl();
    u.protocol = base.protocol;
    u.hostname = base.hostname;
    u.port = base.port;
    // 开发环境走 /editor-api 代理：127.0.0.1:4000/api/... → /editor-api/api/...
    if (serverBase.startsWith("/")) {
      const prefix = serverBase.replace(/\/$/, "");
      if (!u.pathname.startsWith(`${prefix}/`) && u.pathname !== prefix) {
        u.pathname = `${prefix}${u.pathname.startsWith("/") ? u.pathname : `/${u.pathname}`}`;
      }
    }
    return u.toString();
  } catch {
    return url;
  }
}

async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${editorServerBaseUrl()}${path}`, {
      cache: init?.cache ?? "no-store",
      ...init,
      headers: {
        ...(init?.body instanceof FormData ? {} : { "Content-Type": "application/json" }),
        ...(init?.headers || {})
      }
    });
  } catch (err) {
    throw wrapFetchError(err);
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error((data as any).message || res.statusText) as Error & { status?: number };
    err.status = res.status;
    throw err;
  }
  return data as T;
}

function wrapFetchError(err: unknown): Error {
  if (err instanceof TypeError && /fetch/i.test(err.message)) {
    return new Error("无法连接模型编辑器后端，请确认 movie-models-server 已启动（端口 4000）");
  }
  return err instanceof Error ? err : new Error(String(err));
}

export function isEditorServerNotFoundError(err: unknown) {
  return (err as { status?: number })?.status === 404;
}

export function fetchModelSet(code: string) {
  return requestJson<EditorServerModelSet>(`/api/model-sets/${encodeURIComponent(code)}`);
}

export function fetchScene(code: string) {
  return requestJson<any>(`/api/scenes/${encodeURIComponent(code)}`);
}

export function fetchSceneList(modelSetCode?: string) {
  const qs = modelSetCode ? `?modelSetCode=${encodeURIComponent(modelSetCode)}` : "";
  return requestJson<EditorServerSceneItem[]>(`/api/scenes${qs}`);
}

export function saveScene(payload: any) {
  return requestJson<any>("/api/scenes", { method: "POST", body: JSON.stringify(payload) });
}

export function updateScene(code: string, payload: any) {
  return requestJson<any>(`/api/scenes/${encodeURIComponent(code)}`, { method: "PUT", body: JSON.stringify(payload) });
}

export function deleteScene(code: string) {
  return requestJson<{ ok: true }>(`/api/scenes/${encodeURIComponent(code)}`, { method: "DELETE" });
}

export function uploadSceneVideo(file: File) {
  const fd = new FormData();
  fd.append("video", file);
  return requestJson<UploadVideoResult>("/api/uploads/video", { method: "POST", body: fd });
}

export function fetchAdminOverview() {
  return requestJson<EditorAdminOverview>("/api/admin/overview");
}

export function createModelSet(form: FormData) {
  return requestJson<EditorServerModelSet & { editUrl: string; modelsApiUrl: string; code: string }>(
    "/api/model-sets",
    { method: "POST", body: form }
  );
}

export function appendModelSetModels(code: string, form: FormData) {
  return requestJson<EditorServerModelSet>(`/api/model-sets/${encodeURIComponent(code)}`, {
    method: "PUT",
    body: form
  });
}

export function deleteModelSet(code: string) {
  return requestJson<{ ok: true }>(`/api/model-sets/${encodeURIComponent(code)}`, { method: "DELETE" });
}
