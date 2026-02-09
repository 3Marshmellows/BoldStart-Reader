importScripts("src/shared/allowlist.js");
importScripts("src/shared/blocklist.js");
importScripts("src/shared/list-utils.js");
importScripts("src/shared/rate-limit.js");

const DEFAULT_ALLOWLIST = globalThis.ALLOWLIST_DEFAULT || [];

const setBadge = (tabId, enabled) => {
  chrome.action.setBadgeText({ tabId, text: enabled ? "ON" : "OFF" });
  chrome.action.setBadgeBackgroundColor({ tabId, color: enabled ? "#16a34a" : "#dc2626" });
};

const arraysEqual = (a, b) => {
  if (a === b) return true;
  if (!Array.isArray(a) || !Array.isArray(b)) return false;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i += 1) {
    if (a[i] !== b[i]) return false;
  }
  return true;
};

const getHost = (urlString) => {
  try {
    return new URL(urlString).hostname.toLowerCase();
  } catch {
    return "";
  }
};

const getAllowlist = () =>
  new Promise((resolve) => {
    chrome.storage.local.get({ allowlist: DEFAULT_ALLOWLIST }, (result) => {
      const list = Array.isArray(result.allowlist) ? result.allowlist : DEFAULT_ALLOWLIST;
      resolve(list);
    });
  });

const setAllowlist = (list) =>
  new Promise((resolve) => {
    chrome.storage.local.set({ allowlist: list }, () => resolve());
  });

const updateAllowlist = async (tabId, mode) => {
  const tab = await chrome.tabs.get(tabId);
  const host = getHost(tab.url);
  if (!host) return;

  const current = await getAllowlist();
  let next = current.slice();

  if (mode === "add" && !next.includes(host)) {
    next.push(host);
  }

  if (mode === "remove") {
    next = next.filter((item) => item !== host);
  }

  await setAllowlist(next);
  lastAllowlist = next.slice();
};

const isAllowlistedHost = async (host) => {
  const list = await getAllowlist();
  return list.some((allowed) => host === allowed || host.endsWith(`.${allowed}`));
};

let lastAllowlist = DEFAULT_ALLOWLIST.slice();
let lastBlocklist = globalThis.BLOCKLIST_DEFAULT ? globalThis.BLOCKLIST_DEFAULT.slice() : [];

const resolveListConflicts = (nextAllow, nextBlock) => {
  const reconcileLists = globalThis.ListUtils ? globalThis.ListUtils.reconcileLists : null;
  if (!reconcileLists) return;
  return reconcileLists({
    allowlist: nextAllow,
    blocklist: nextBlock,
    lastAllowlist,
    lastBlocklist,
    confirmMoveToAllow: () => false
  });
};

const persistResolvedLists = async (nextAllow, nextBlock) => {
  const result = resolveListConflicts(nextAllow, nextBlock);
  if (!result) return;

  const changed =
    !arraysEqual(result.allowlist, nextAllow) || !arraysEqual(result.blocklist, nextBlock);

  if (!changed) {
    lastAllowlist = result.allowlist.slice();
    lastBlocklist = result.blocklist.slice();
    return;
  }

  await new Promise((resolve) => {
    chrome.storage.local.set(
      {
        allowlist: result.allowlist,
        blocklist: result.blocklist,
        listConflictNotice: {
          message:
            "Conflicts between allowlist and blocklist were resolved automatically. Blocklist wins.",
          at: Date.now()
        }
      },
      () => resolve()
    );
  });
  lastAllowlist = result.allowlist.slice();
  lastBlocklist = result.blocklist.slice();
};

const ensureInjected = async (tabId) => {
  try {
    await chrome.scripting.executeScript({
      target: { tabId },
      files: [
        "src/shared/allowlist.js",
        "src/shared/blocklist.js",
        "src/shared/rate-limit.js",
        "src/content/index.js"
      ]
    });
  } catch {
    // No permissoin or tab not injectable.
  }
};

const sendToggle = (tabId) =>
  new Promise((resolve) => {
    chrome.tabs.sendMessage(tabId, { type: "TOGGLE" }, (response) => {
      if (chrome.runtime.lastError) {
        resolve({ ok: false });
        return;
      }
      resolve({ ok: true, response });
    });
  });

const toggleForActiveTab = async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab || !tab.id) return;
  const host = getHost(tab.url || "");
  if (!host) return;
  const allowed = await isAllowlistedHost(host);
  if (!allowed) {
    setBadge(tab.id, false);
    return;
  }
  const result = await sendToggle(tab.id);
  if (!result.ok) {
    await ensureInjected(tab.id);
    const afterInject = await sendToggle(tab.id);
    if (afterInject.ok && afterInject.response && typeof afterInject.response.enabled === "boolean") {
      setBadge(tab.id, afterInject.response.enabled);
    } else {
      setBadge(tab.id, false);
    }
    return;
  }
  if (result.response && typeof result.response.enabled === "boolean") {
    setBadge(tab.id, result.response.enabled);
  }
};

chrome.action.onClicked.addListener(() => {
  toggleForActiveTab();
});

chrome.commands.onCommand.addListener((command) => {
  if (command === "toggle-extension") {
    toggleForActiveTab();
  }
});

chrome.contextMenus.removeAll(() => {
  chrome.contextMenus.create({
    id: "allow-site",
    title: "Allow this site",
    contexts: ["action"]
  });
  chrome.contextMenus.create({
    id: "remove-site",
    title: "Remove site from allowlist",
    contexts: ["action"]
  });
  chrome.contextMenus.create({
    id: "open-options",
    title: "Open allow/blocklist options",
    contexts: ["action"]
  });
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (!tab || !tab.id) return;
  if (info.menuItemId === "allow-site") {
    updateAllowlist(tab.id, "add");
  }
  if (info.menuItemId === "remove-site") {
    updateAllowlist(tab.id, "remove");
  }
  if (info.menuItemId === "open-options") {
    chrome.runtime.openOptionsPage();
  }
});

chrome.tabs.onActivated.addListener((activeInfo) => {
  chrome.tabs.sendMessage(activeInfo.tabId, { type: "STATE" }, (response) => {
    if (chrome.runtime.lastError) {
      setBadge(activeInfo.tabId, false);
      return;
    }
    if (response && typeof response.enabled === "boolean") {
      setBadge(activeInfo.tabId, response.enabled);
    }
  });
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status !== "complete") return;
  if (!tab || !tab.active) return;
  refreshActiveBadge();
});

const refreshActiveBadge = async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab || !tab.id) return;
  const host = getHost(tab.url || "");
  if (!host) {
    setBadge(tab.id, false);
    return;
  }
  const allowed = await isAllowlistedHost(host);
  if (!allowed) {
    setBadge(tab.id, false);
    return;
  }
  chrome.tabs.sendMessage(tab.id, { type: "STATE" }, (response) => {
    if (chrome.runtime.lastError) {
      setBadge(tab.id, false);
      return;
    }
    if (response && typeof response.enabled === "boolean") {
      setBadge(tab.id, response.enabled);
    }
  });
};

chrome.storage.local.get(
  { allowlist: DEFAULT_ALLOWLIST, blocklist: globalThis.BLOCKLIST_DEFAULT || [] },
  (result) => {
    const nextAllow = Array.isArray(result.allowlist) ? result.allowlist : DEFAULT_ALLOWLIST;
    const nextBlock = Array.isArray(result.blocklist)
      ? result.blocklist
      : globalThis.BLOCKLIST_DEFAULT || [];
    lastAllowlist = nextAllow.slice();
    lastBlocklist = nextBlock.slice();
    persistResolvedLists(nextAllow, nextBlock);
  }
);

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== "local") return;
  if (!changes.allowlist && !changes.blocklist) return;
  const nextAllow = changes.allowlist
    ? Array.isArray(changes.allowlist.newValue)
      ? changes.allowlist.newValue
      : DEFAULT_ALLOWLIST
    : lastAllowlist;
  const nextBlock = changes.blocklist
    ? Array.isArray(changes.blocklist.newValue)
      ? changes.blocklist.newValue
      : globalThis.BLOCKLIST_DEFAULT || []
    : lastBlocklist;
  persistResolvedLists(nextAllow, nextBlock);
  refreshActiveBadge();
});
