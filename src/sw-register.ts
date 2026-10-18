export async function registerServiceWorker(
  base: string = "./",
  enabled: boolean = import.meta.env.PROD,
): Promise<ServiceWorkerRegistration | null> {
  if (
    !enabled ||
    typeof window === "undefined" ||
    typeof navigator === "undefined" ||
    !("serviceWorker" in navigator)
  ) {
    return null;
  }

  try {
    const swUrl = new URL("sw.js", new URL(base, window.location.href)).href;
    return await navigator.serviceWorker.register(swUrl);
  } catch (error) {
    console.warn("Service worker registration failed:", error);
    return null;
  }
}
