import { onMounted, ref } from "vue";

export function useServiceWorker() {
  const needRefresh = ref(false);
  const offlineReady = ref(false);
  const updateSW = ref<((reloadPage?: boolean) => Promise<void>) | null>(null);

  onMounted(async () => {
    // 开发环境不注册 SW，避免 virtual:pwa-register 在部分环境下触发 CORS 报错
    if (import.meta.env.DEV) {
      return;
    }

    try {
      const { registerSW } = await import("virtual:pwa-register");
      updateSW.value = registerSW({
        onNeedRefresh() {
          needRefresh.value = true;
        },
        onRegistered(registration) {
          if (registration) {
            setInterval(() => {
              registration.update();
            }, 60 * 1000);
            document.addEventListener("visibilitychange", () => {
              if (!document.hidden) {
                registration.update();
              }
            });
          }
        },
        onRegisterError(error) {
          console.error("Service Worker 注册失败:", error);
        }
      });
    } catch (e) {
      // PWA plugin not installed - skip service worker registration
    }
  });

  const handleUpdate = () => {
    if (updateSW.value) {
      updateSW.value(true);
    }
  };

  const handleCancel = () => {
    needRefresh.value = false;
  };

  return {
    needRefresh,
    offlineReady,
    handleUpdate,
    handleCancel
  };
}
