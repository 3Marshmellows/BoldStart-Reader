(() => {
  const CONFIG = {
    styleId: "hl-first-letters-style",
    processedClass: "hl-processed",
    boldClass: "hl-bold"
  };

  const BLOCKED_HOSTS = [
    "chase.com",
    "bankofamerica.com",
    "wellsfargo.com",
    "citi.com",
    "usbank.com",
    "capitalone.com",
    "discover.com",
    "americanexpress.com",
    "schwab.com",
    "fidelity.com",
    "vanguard.com",
    // UK banks + banks operating in the UK (major retail/digital brands)
    "barclays.co.uk",
    "barclaycard.co.uk",
    "hsbc.co.uk",
    "firstdirect.com",
    "lloydsbank.com",
    "halifax.co.uk",
    "bankofscotland.co.uk",
    "natwest.com",
    "rbs.co.uk",
    "ulsterbank.co.uk",
    "santander.co.uk",
    "tsb.co.uk",
    "nationwide.co.uk",
    "metrobankonline.co.uk",
    "co-operativebank.co.uk",
    "virginmoney.com",
    "clydesdalebank.co.uk",
    "yorkshirebank.co.uk",
    "starlingbank.com",
    "monzo.com",
    "revolut.com",
    "chase.co.uk",
    "zopa.com",
    "atombank.co.uk",
    "tandem.co.uk",
    "aldermore.co.uk",
    "paragonbank.co.uk",
    "shawbrook.co.uk",
    "triodos.co.uk",
    "caterallen.co.uk",
    "sainsburysbank.co.uk",
    "tescobank.com",
    "marksandspencer.com",
    "bankofirelanduk.com",
    "aibgb.co.uk",
    "icicibank.co.uk",
    "citibank.co.uk",
    "sc.co.uk"
  ];

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

  let enabled = true;

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
    return BLOCKED_HOSTS.some((blocked) => host === blocked || host.endsWith(`.${blocked}`));
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

  const apply = async () => {
    if (isBlockedHost()) return;
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
  };

  const setEnabled = (next) => {
    enabled = next && !isBlockedHost();
    if (enabled) {
      enable();
    } else {
      disable();
    }
    return enabled;
  };

  const enable = () => {
    apply();
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

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => {
      if (enabled) apply();
    }, { once: true });
  } else {
    if (enabled) apply();
  }
})();
