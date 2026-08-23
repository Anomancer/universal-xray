(() => {
  if (!("serviceWorker" in navigator)) return;
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/service-worker.js", { scope: "/" })
      .catch(err => console.warn("[BHC PWA] registration failed", err));
  });
})();
