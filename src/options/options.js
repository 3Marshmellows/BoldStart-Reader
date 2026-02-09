(() => {
  const DEFAULT_BLOCKLIST = [
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

  const textarea = document.getElementById("blocklist");
  const saveBtn = document.getElementById("save");
  const status = document.getElementById("status");

  const normalize = (lines) => {
    const cleaned = lines
      .map((line) => line.trim().toLowerCase())
      .filter(Boolean);
    return Array.from(new Set(cleaned)).sort();
  };

  const render = (list) => {
    textarea.value = list.join("\n");
  };

  const showStatus = (text) => {
    status.textContent = text;
    setTimeout(() => {
      status.textContent = "";
    }, 1200);
  };

  chrome.storage.local.get({ blocklist: DEFAULT_BLOCKLIST }, (result) => {
    const list = Array.isArray(result.blocklist) ? result.blocklist : DEFAULT_BLOCKLIST;
    render(list);
  });

  saveBtn.addEventListener("click", () => {
    const list = normalize(textarea.value.split("\n"));
    chrome.storage.local.set({ blocklist: list }, () => {
      render(list);
      showStatus("Saved");
    });
  });
})();
