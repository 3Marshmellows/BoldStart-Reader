(() => {
  const normalize = (lines) => {
    const cleaned = lines.map((line) => line.trim().toLowerCase()).filter(Boolean);
    return Array.from(new Set(cleaned)).sort();
  };

  const reconcileLists = ({
    allowlist,
    blocklist,
    lastAllowlist,
    lastBlocklist,
    confirmMoveToAllow
  }) => {
    const lastAllow = new Set(lastAllowlist || []);
    const lastBlock = new Set(lastBlocklist || []);
    const allowSet = new Set(allowlist || []);
    const blockSet = new Set(blocklist || []);

    const addedToAllow = (allowlist || []).filter((item) => !lastAllow.has(item));
    const addedToBlock = (blocklist || []).filter((item) => !lastBlock.has(item));

    addedToBlock.forEach((item) => {
      if (allowSet.has(item)) {
        allowSet.delete(item);
      }
    });

    addedToAllow.forEach((item) => {
      if (!allowSet.has(item)) return;
      if (lastBlock.has(item)) {
        const confirmed = confirmMoveToAllow ? confirmMoveToAllow(item) : true;
        if (confirmed) {
          blockSet.delete(item);
        } else {
          allowSet.delete(item);
          blockSet.add(item);
        }
      }
    });

    blockSet.forEach((item) => {
      if (allowSet.has(item)) {
        allowSet.delete(item);
      }
    });

    return {
      allowlist: Array.from(allowSet).sort(),
      blocklist: Array.from(blockSet).sort()
    };
  };

  const api = { normalize, reconcileLists };
  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
  globalThis.ListUtils = api;
})();
