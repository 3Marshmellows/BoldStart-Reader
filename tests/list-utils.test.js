const assert = require("assert");
const { normalize, reconcileLists } = require("../src/shared/list-utils.js");

const test = (name, fn) => {
  try {
    fn();
    // eslint-disable-next-line no-console
    console.log(`ok - ${name}`);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error(`not ok - ${name}`);
    // eslint-disable-next-line no-console
    console.error(err && err.stack ? err.stack : err);
    process.exitCode = 1;
  }
};

test("normalize trims, lowercases, uniqs, sorts", () => {
  const out = normalize([" Example.com ", "example.com", "", "B.com"]);
  assert.deepStrictEqual(out, ["b.com", "example.com"]);
});

test("adding to blocklist removes from allowlist", () => {
  const result = reconcileLists({
    allowlist: ["a.com"],
    blocklist: ["a.com"],
    lastAllowlist: ["a.com"],
    lastBlocklist: [],
    confirmMoveToAllow: () => true
  });
  assert.deepStrictEqual(result.allowlist, []);
  assert.deepStrictEqual(result.blocklist, ["a.com"]);
});

test("moving from blocklist to allowlist (confirm true)", () => {
  const result = reconcileLists({
    allowlist: ["a.com"],
    blocklist: [],
    lastAllowlist: [],
    lastBlocklist: ["a.com"],
    confirmMoveToAllow: () => true
  });
  assert.deepStrictEqual(result.allowlist, ["a.com"]);
  assert.deepStrictEqual(result.blocklist, []);
});

test("moving from blocklist to allowlist (confirm false)", () => {
  const result = reconcileLists({
    allowlist: ["a.com"],
    blocklist: [],
    lastAllowlist: [],
    lastBlocklist: ["a.com"],
    confirmMoveToAllow: () => false
  });
  assert.deepStrictEqual(result.allowlist, []);
  assert.deepStrictEqual(result.blocklist, ["a.com"]);
});

test("conflict from external changes: blocklist wins", () => {
  const result = reconcileLists({
    allowlist: ["a.com", "b.com"],
    blocklist: ["a.com"],
    lastAllowlist: [],
    lastBlocklist: [],
    confirmMoveToAllow: () => true
  });
  assert.deepStrictEqual(result.allowlist, ["b.com"]);
  assert.deepStrictEqual(result.blocklist, ["a.com"]);
});

test("adding to blocklist keeps unrelated allowlist entries", () => {
  const result = reconcileLists({
    allowlist: ["a.com", "b.com"],
    blocklist: ["c.com"],
    lastAllowlist: ["a.com", "b.com"],
    lastBlocklist: [],
    confirmMoveToAllow: () => true
  });
  assert.deepStrictEqual(result.allowlist, ["a.com", "b.com"]);
  assert.deepStrictEqual(result.blocklist, ["c.com"]);
});
