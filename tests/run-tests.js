const path = require("path");

const tests = [
  path.join(__dirname, "list-utils.test.js"),
  path.join(__dirname, "rate-limit.test.js")
];

let exitCode = 0;
tests.forEach((testPath) => {
  try {
    require(testPath);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error(`Failed to load ${testPath}`);
    // eslint-disable-next-line no-console
    console.error(err && err.stack ? err.stack : err);
    exitCode = 1;
  }
});

process.exit(exitCode);
