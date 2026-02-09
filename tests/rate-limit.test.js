const assert = require("assert");
const { shouldRun } = require("../src/shared/rate-limit.js");

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

test("shouldRun allows first run", () => {
  assert.strictEqual(shouldRun(1000, null, 200), true);
});

test("shouldRun blocks too-fast runs", () => {
  assert.strictEqual(shouldRun(1100, 1000, 200), false);
});

test("shouldRun allows when interval elapsed", () => {
  assert.strictEqual(shouldRun(1300, 1000, 200), true);
});
