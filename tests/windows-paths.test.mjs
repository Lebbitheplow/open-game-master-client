import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const repo = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

// import() takes a URL, and on Windows an absolute path ("C:\...") is not
// one: Node stops with ERR_UNSUPPORTED_ESM_URL_SCHEME. Client PR #109 found
// two in mobile/scripts/build-www.mjs; a generated import in a test probe
// was the same fault. Every import of a computed file goes through
// pathToFileURL(...).href.
test("no script or test imports a raw file path", () => {
  const offenders = [];
  for (const dir of ["scripts", path.join("mobile", "scripts"), "tests"]) {
    for (const name of fs.readdirSync(path.join(repo, dir))) {
      if (!/\.(mjs|js|ts)$/.test(name)) continue;
      const text = fs.readFileSync(path.join(repo, dir, name), "utf8");
      if (/\bimport\(\s*path\./.test(text) || /from \$\{JSON\.stringify\(path\./.test(text)) offenders.push(path.join(dir, name));
    }
  }
  assert.deepEqual(offenders, []);
});
