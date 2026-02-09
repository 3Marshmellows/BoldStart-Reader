(() => {
  const CONFIG = {
    styleId: "hl-first-letters-style",
    processedClass: "hl-processed",
    boldClass: "hl-bold"
  };

  const DEFAULT_ALLOWLIST = globalThis.ALLOWLIST_DEFAULT || [];
  const DEFAULT_BLOCKLIST = globalThis.BLOCKLIST_DEFAULT || [];

  const SKIP_TAGS = new Set([
    "SCRIPT",
    "STYLE",
    "NOSCRIPT",
    "TEXTAREA",
    "INPUT",
    "SELECT",
    "OPTION",
    "CODE",
    "PRE"
  ]);

  let enabled = false;
  let allowlist = DEFAULT_ALLOWLIST.slice();
  let blocklist = DEFAULT_BLOCKLIST.slice();
  let observer = null;
  let pending = null;
  let lastRunAt = null;
  const MIN_INTERVAL_MS = 250;
  const shouldRun = globalThis.RateLimit ? globalThis.RateLimit.shouldRun : null;

  const isElement = (node) => node && node.nodeType === Node.ELEMENT_NODE;
  const isText = (node) => node && node.nodeType === Node.TEXT_NODE;
  const hasText = (node) => !!(node && node.nodeValue && node.nodeValue.trim());

  const shouldSkipElement = (el) => {
    if (!isElement(el)) return true;
    if (SKIP_TAGS.has(el.tagName)) return true;
    if (el.isContentEditable) return true;
    return false;
  };

  const isInsideProcessed = (node) => {
    const parent = node.parentElement;
    if (!parent) return false;
    return !!parent.closest(`.${CONFIG.processedClass}`);
  };

  const ensureStyle = () => {
    if (document.getElementById(CONFIG.styleId)) return;
    const style = document.createElement("style");
    style.id = CONFIG.styleId;
    style.textContent = `.${CONFIG.boldClass}{font-weight:bold;}`;
    document.head.appendChild(style);
  };

  const isBlockedHost = () => {
    const host = (location.hostname || "").toLowerCase();
    if (!host) return false;
    return blocklist.some((blocked) => host === blocked || host.endsWith(`.${blocked}`));
  };

  const isAllowlistedHost = () => {
    const host = (location.hostname || "").toLowerCase();
    if (!host) return false;
    return allowlist.some((allowed) => host === allowed || host.endsWith(`.${allowed}`));
  };

  const lettersForWord = (word) => {
    if (!word) return 0;
    const len = word.length;
    const MAX_BOLD = 6;
    if (len <= 3) return 1;
    if (len <= 6) {
      return Math.min(3, Math.max(2, Math.ceil(len * 0.4)));
    }
    return Math.min(MAX_BOLD, Math.ceil(len * 0.4));
  };

  const buildFragment = (text) => {
    if (!text || !text.trim()) return text;
    const fragment = document.createDocumentFragment();
    const wordRegex = /[A-Za-z0-9]+/g;
    let lastIndex = 0;
    let match;

    while ((match = wordRegex.exec(text))) {
      const word = match[0];
      const start = match.index;
      const end = start + word.length;

      if (start > lastIndex) {
        fragment.appendChild(document.createTextNode(text.slice(lastIndex, start)));
      }

      const n = Math.min(lettersForWord(word), word.length);
      const head = word.slice(0, n);
      const tail = word.slice(n);

      const span = document.createElement("span");
      span.className = CONFIG.boldClass;
      span.textContent = head;
      fragment.appendChild(span);

      if (tail) {
        fragment.appendChild(document.createTextNode(tail));
      }

      lastIndex = end;
    }

    if (lastIndex < text.length) {
      fragment.appendChild(document.createTextNode(text.slice(lastIndex)));
    }

    return fragment;
  };

  const processTextNode = (node) => {
    if (!isText(node) || !hasText(node)) return;
    if (isInsideProcessed(node)) return;

    const parent = node.parentElement;
    if (!parent || shouldSkipElement(parent)) return;

    const fragment = buildFragment(node.nodeValue);
    if (typeof fragment === "string") return;

    const wrapper = document.createElement("span");
    wrapper.className = CONFIG.processedClass;
    wrapper.appendChild(fragment);
    parent.replaceChild(wrapper, node);
  };

  const walkAndProcess = (root) => {
    const walker = document.createTreeWalker(
      root,
      NodeFilter.SHOW_TEXT,
      {
        acceptNode: (node) => {
          if (!hasText(node)) return NodeFilter.FILTER_REJECT;
          const parent = node.parentElement;
          if (!parent || shouldSkipElement(parent)) return NodeFilter.FILTER_REJECT;
          if (isInsideProcessed(node)) return NodeFilter.FILTER_REJECT;
          return NodeFilter.FILTER_ACCEPT;
        }
      }
    );

    const nodes = [];
    let current;
    while ((current = walker.nextNode())) {
      nodes.push(current);
    }

    nodes.forEach(processTextNode);
  };

  const canRun = () => {
    if (isBlockedHost()) return false;
    if (!isAllowlistedHost()) return false;
    const now = Date.now();
    if (shouldRun && !shouldRun(now, lastRunAt, MIN_INTERVAL_MS)) return false;
    lastRunAt = now;
    return true;
  };

  const apply = async () => {
    if (!canRun()) return;
    ensureStyle();
    walkAndProcess(document.body);
  };

  const resetProcessed = () => {
    document.querySelectorAll(`.${CONFIG.processedClass}`).forEach((el) => {
      const text = document.createTextNode(el.textContent || "");
      el.replaceWith(text);
    });
  };

  const disable = () => {
    resetProcessed();
    if (observer) {
      observer.disconnect();
      observer = null;
    }
  };

  const setEnabled = (next) => {
    enabled = next && !isBlockedHost() && isAllowlistedHost();
    if (enabled) {
      enable();
    } else {
      disable();
    }
    return enabled;
  };

  const enable = () => {
    apply();
    if (observer || !document.body) return;
    observer = new MutationObserver(() => {
      if (!enabled) return;
      if (pending) return;
      pending = setTimeout(() => {
        pending = null;
        apply();
      }, 150);
    });
    observer.observe(document.body, {
      childList: true,
      characterData: true,
      subtree: true
    });
  };

  const toggle = () => {
    return setEnabled(!enabled);
  };

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (!message || typeof message.type !== "string") return;
    if (message.type === "TOGGLE") {
      const next = toggle();
      sendResponse({ enabled: next });
      return true;
    }
    if (message.type === "STATE") {
      sendResponse({ enabled });
    }
  });

  const init = () => {
    chrome.storage.local.get(
      { allowlist: DEFAULT_ALLOWLIST, blocklist: DEFAULT_BLOCKLIST },
      (result) => {
        allowlist = Array.isArray(result.allowlist) ? result.allowlist : DEFAULT_ALLOWLIST;
        blocklist = Array.isArray(result.blocklist) ? result.blocklist : DEFAULT_BLOCKLIST;
      }
    );
  };

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "local") return;
    if (changes.allowlist) {
      allowlist = Array.isArray(changes.allowlist.newValue)
        ? changes.allowlist.newValue
        : DEFAULT_ALLOWLIST;
      if (enabled && !isAllowlistedHost()) {
        disable();
      }
    }
    if (changes.blocklist) {
      blocklist = Array.isArray(changes.blocklist.newValue)
        ? changes.blocklist.newValue
        : DEFAULT_BLOCKLIST;
      if (isBlockedHost()) {
        disable();
      }
    }
  });

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();
