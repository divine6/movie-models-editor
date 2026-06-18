/** 批量导入期间暂停 project localStorage 写入，避免频繁序列化导致卡顿/崩溃 */
let suspended = false;
let cachedSnapshot: string | null = null;

export function suspendProjectPersist() {
  if (suspended) return;
  suspended = true;
  cachedSnapshot = localStorage.getItem("movie-model-editor-project");
}

export function resumeProjectPersist() {
  suspended = false;
  cachedSnapshot = null;
}

export function isProjectPersistSuspended() {
  return suspended;
}

export function getSuspendedPersistSnapshot() {
  return cachedSnapshot ?? localStorage.getItem("movie-model-editor-project") ?? "{}";
}
