const DEFAULT_ALLOWLIST = [
  "ycombinator.com",
  "news.ycombinator.com",
  "reddit.com",
  "substack.com",
  "medium.com",
  "techcrunch.com",
  "economist.com"
];

const setBadge = (tabId, enabled) => {
  chrome.action.setBadgeText({ tabId, text: enabled ? "ON" : "OFF" });
  chrome.action.setBadgeBackgroundColor({ tabId, color: enabled ? "#16a34a" : "#dc2626" });
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
};

const isAllowlistedHost = async (host) => {
  const list = await getAllowlist();
  return list.some((allowed) => host === allowed || host.endsWith(`.${allowed}`));
};

const ensureInjected = async (tabId) => {
  try {
    await chrome.scripting.executeScript({
      target: { tabId },
      files: ["src/content/index.js"]
    });
  } catch {
    // No permission or tab not injectable.
  }
};

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
  chrome.tabs.sendMessage(tab.id, { type: "TOGGLE" }, async (response) => {
    if (chrome.runtime.lastError) {
      await ensureInjected(tab.id);
      setBadge(tab.id, true);
      return;
    }
    if (response && typeof response.enabled === "boolean") {
      setBadge(tab.id, response.enabled);
    }
  });
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
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (!tab || !tab.id) return;
  if (info.menuItemId === "allow-site") {
    updateAllowlist(tab.id, "add");
  }
  if (info.menuItemId === "remove-site") {
    updateAllowlist(tab.id, "remove");
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
