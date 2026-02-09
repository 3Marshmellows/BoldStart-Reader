(() => {
  const shouldRun = (nowMs, lastMs, minIntervalMs) => {
    if (typeof nowMs !== "number") return false;
    if (typeof lastMs !== "number") return true;
    if (typeof minIntervalMs !== "number") return true;
    return nowMs - lastMs >= minIntervalMs;
  };

  const api = { shouldRun };
  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
  globalThis.RateLimit = api;
})();
