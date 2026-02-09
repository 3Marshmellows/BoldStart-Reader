(() => {
  const DEFAULT_ALLOWLIST = globalThis.ALLOWLIST_DEFAULT || [];
  const DEFAULT_BLOCKLIST = globalThis.BLOCKLIST_DEFAULT || [];

  const allowlistArea = document.getElementById("allowlist");
  const textarea = document.getElementById("blocklist");
  const saveBtn = document.getElementById("save");
  const status = document.getElementById("status");
  let lastAllowlist = DEFAULT_ALLOWLIST.slice();
  let lastBlocklist = DEFAULT_BLOCKLIST.slice();

  const normalize = globalThis.ListUtils ? globalThis.ListUtils.normalize : null;
  const reconcileLists = globalThis.ListUtils ? globalThis.ListUtils.reconcileLists : null;
  if (!normalize || !reconcileLists) {
    status.textContent = "Missing list utilities. Please reload the extension.";
    saveBtn.disabled = true;
    return;
  }

  const render = (el, list) => {
    el.value = list.join("\n");
  };

  const showStatus = (text) => {
    status.textContent = text;
    setTimeout(() => {
      status.textContent = "";
    }, 1200);
  };

  const showNotice = (text) => {
    status.textContent = text;
  };

  chrome.storage.local.get(
    { allowlist: DEFAULT_ALLOWLIST, blocklist: DEFAULT_BLOCKLIST },
    (result) => {
      const allowlist = Array.isArray(result.allowlist)
        ? result.allowlist
        : DEFAULT_ALLOWLIST;
      const blocklist = Array.isArray(result.blocklist) ? result.blocklist : DEFAULT_BLOCKLIST;
      lastAllowlist = allowlist.slice();
      lastBlocklist = blocklist.slice();
      render(allowlistArea, allowlist);
      render(textarea, blocklist);
    }
  );

  saveBtn.addEventListener("click", () => {
    let allowlist = normalize(allowlistArea.value.split("\n"));
    let blocklist = normalize(textarea.value.split("\n"));

    ({ allowlist, blocklist } = reconcileLists({
      allowlist,
      blocklist,
      lastAllowlist,
      lastBlocklist,
      confirmMoveToAllow: (item) =>
        window.confirm(
          `"${item}" was previously in the blocklist. Do you really want to move it to the allowlist?`
        )
    }));

    chrome.storage.local.set({ allowlist, blocklist }, () => {
      lastAllowlist = allowlist.slice();
      lastBlocklist = blocklist.slice();
      render(allowlistArea, allowlist);
      render(textarea, blocklist);
      showStatus("Saved");
    });
  });

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "local") return;
    if (changes.listConflictNotice && changes.listConflictNotice.newValue) {
      showNotice(changes.listConflictNotice.newValue.message || "Lists updated.");
    }
  });
})();
