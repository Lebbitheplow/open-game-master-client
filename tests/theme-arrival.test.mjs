import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { serverDir as findServerDir } from "../scripts/server-dir.mjs";

const repo = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const serverDir = findServerDir(repo);
const arrival = path.join(serverDir, "src", "lib", "theme-arrival", "run.ts");
const hasArrival = fs.existsSync(arrival);

// A theme arrives its own way (the server's src/lib/theme-arrival): a pick in
// the theme panel or in Settings spreads over the old look as a rune circle,
// frost, a turned page. It reaches the apps with the server's screens and
// needs no code here, but it stands on three things the shell does, and none
// of them fails loudly when broken: the arrival just stops playing in the
// apps while the website and every other test stay green.

// The arrival pictures the whole document, the shell's topbar and home
// included. The shell takes the document's transition name away so that its
// own page changes fade the page column alone, and the arrival's rule puts
// the name back for its own length with a priority. A priority on the shell's
// rule would win over it, and the arrival would have no page to cut.
test("the shell's rule that takes the document's transition name can be overridden", () => {
  const css = fs.readFileSync(path.join(repo, "src", "renderer", "home.css"), "utf8");
  const rules = [...css.matchAll(/:root\s*\{[^}]*view-transition-name\s*:\s*([^;}]+)/g)].map((match) => match[1].trim());
  assert.deepEqual(rules, ["none"], "home.css should take the document's transition name away once, with no priority");
});

// A page change names the page column from script, for the change only. The
// arrival's rules clear every other name while it plays; a name set with a
// priority would stay, and the column would fade on its own in the middle of
// the arrival instead of being cut with the rest of the screen.
test("a page change names the page column without a priority", () => {
  const source = fs.readFileSync(path.join(repo, "src", "renderer", "game", "index.tsx"), "utf8");
  assert.match(source, /root\.style\.viewTransitionName = "odm-game";/);
  assert.doesNotMatch(source, /setProperty\(\s*"view-transition-name"[^)]*"important"/);
});

test("the server's arrival still names the document itself and clears the other names", { skip: !hasArrival }, () => {
  const source = fs.readFileSync(arrival, "utf8");
  const recheck = "the server's theme arrival changed how it names the document: recheck that it still plays in the apps (the server's scripts/browser/scenarios/153-theme-arrival.mjs with --app)";
  assert.match(source, /:root\[data-theme-arrival\]\{view-transition-name:root !important\}/, recheck);
  assert.match(source, /:root\[data-theme-arrival\] \*\{view-transition-name:none !important\}/, recheck);
  // Its rules are a stylesheet made in script: one written into the game's
  // own sheet would be confined to the page column (scripts/scope-css.mjs).
  assert.match(source, /new CSSStyleSheet\(\)/, recheck);
});

// The arrivals are only needed once a theme changes. The server loads them
// on demand, and the game bundle is split, so they stay out of what every
// start of the app reads.
test("the arrivals are a chunk of their own, outside the game's entry", { skip: !hasArrival }, () => {
  const game = path.join(repo, "dist", "renderer", "game");
  const carries = (file) => fs.readFileSync(file, "utf8").includes("data-theme-arrival");
  assert.ok(!carries(path.join(game, "game.js")), "the game's entry carries the theme arrivals: they should load when a theme first changes");
  const chunks = fs.readdirSync(path.join(game, "chunks")).filter((name) => name.endsWith(".js"));
  const holding = chunks.filter((name) => carries(path.join(game, "chunks", name)));
  assert.equal(holding.length, 1, `the theme arrivals should be in one chunk of the game bundle, found in: ${holding.join(", ") || "none"}`);
});
