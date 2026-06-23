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

export interface UploadVideoResult {
  url: string;
  path: string;
}

const DEFAULT_SERVER_PORT = "4000";
const DEFAULT_EDITOR_PORT = "5173";

export function editorServerBaseUrl() {
  const envUrl = (import.meta.env.VITE_EDITOR_SERVER_URL as string | undefined)?.trim();
  if (envUrl) return envUrl.replace(/\/$/, "");
  const { protocol, hostname } = window.location;
  return `${protocol}//${hostname}:${DEFAULT_SERVER_PORT}`;
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

export function buildScenePreviewLink(sceneCode: string) {
  const base = editorFrontendBaseUrl();
  return `${base}/#/project/editor?mode=view&code=${encodeURIComponent(sceneCode)}`;
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
    const base = new URL(editorServerBaseUrl());
    u.protocol = base.protocol;
    u.hostname = base.hostname;
    u.port = base.port;
    return u.toString();
  } catch {
    return url;
  }
}

async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${editorServerBaseUrl()}${path}`, {
    ...init,
    headers: {
      ...(init?.body instanceof FormData ? {} : { "Content-Type": "application/json" }),
      ...(init?.headers || {})
    }
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error((data as any).message || res.statusText) as Error & { status?: number };
    err.status = res.status;
    throw err;
  }
  return data as T;
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
