import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { serverDir as findServerDir } from "../scripts/server-dir.mjs";

const repo = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const serverDir = findServerDir(repo);

// The server pages the apps open the old way, on purpose: the legal pages,
// which read the same anywhere.
const OPENED_THE_OLD_WAY = new Set(["/licenses", "/privacy", "/terms"]);

// Every page of the server a player reaches has a native screen. A page
// added on the server with no route here is handed to the shell's fallback
// in the apps, which a server rebuild alone never fixes: the library's build
// editor (server issue 229) was one.
function serverPages(dir, base = "") {
  const found = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (entry.name === "api" || entry.name.startsWith("_") || entry.name.startsWith("(")) continue;
      const segment = /^\[(.+)\]$/.exec(entry.name);
      found.push(...serverPages(path.join(dir, entry.name), `${base}/${segment ? `:${segment[1]}` : entry.name}`));
    } else if (entry.name === "page.tsx") {
      found.push(base || "/");
    }
  }
  return found;
}

test("every server page a player opens has a native screen", { skip: !fs.existsSync(path.join(serverDir, "src", "app")) }, () => {
  const source = fs.readFileSync(path.join(repo, "src", "renderer", "game", "index.tsx"), "utf8");
  const routed = new Set([...source.matchAll(/pattern: "([^"]+)"/g)].map((match) => match[1]));
  const missing = serverPages(path.join(serverDir, "src", "app"))
    .filter((page) => !OPENED_THE_OLD_WAY.has(page))
    .filter((page) => !routed.has(page));
  assert.deepEqual(missing, [], `server pages with no native screen: ${missing.join(", ")}`);
});

// The server's root layout mounts the host that draws appConfirm and
// appNotice; the apps compile the pages without that layout, so the game
// root mounts it itself. Without it every question a page asked (Discard
// this copy, deleting a campaign) fell back to the web view's bare confirm().
test("the game root mounts the host's confirm dialog, as the root layout does", { skip: !fs.existsSync(path.join(serverDir, "src", "app", "layout.tsx")) }, () => {
  const layout = fs.readFileSync(path.join(serverDir, "src", "app", "layout.tsx"), "utf8");
  assert.match(layout, /<ConfirmHost \/>/, "the server's layout no longer mounts ConfirmHost; recheck what the apps need");
  const source = fs.readFileSync(path.join(repo, "src", "renderer", "game", "index.tsx"), "utf8");
  assert.match(source, /import \{ ConfirmHost \} from "@\/components\/ui\/ConfirmDialog";/);
  assert.match(source, /<ConfirmHost \/>/);
});

// What the server's root layout lays on every page, and how the apps lay
// it instead, since they compile the pages without that layout. A component
// the layout gains is missing from every app screen until it is named here:
// the theme panel's host (server 0.39.1) was one, and the lobby's Theme
// button opened nothing in the apps.
const LAID_BY_THE_SHELL = new Map([
  ["ThemeApplier", "applyTheme() at start and on a change of the system's day or night (game/index.tsx)"],
  ["LocaleApplier", "applyLocale() at start (game/index.tsx)"],
  ["LocaleProvider", "the screens read the reader's language from src/lib/locale.tsx's store with no provider"],
  ["TopoBackground", "the shell's own contour lines (topo.ts)"],
  ["ServerAddressButton", "the shell's server list shows each world's address and QR"],
]);

function layoutComponents(layout) {
  const body = layout.slice(layout.indexOf("<body"));
  return [...new Set([...body.matchAll(/<([A-Z]\w*)[\s/>]/g)].map((match) => match[1]))];
}

test("every component the server's root layout lays is laid in the apps too", { skip: !fs.existsSync(path.join(serverDir, "src", "app", "layout.tsx")) }, () => {
  const layout = fs.readFileSync(path.join(serverDir, "src", "app", "layout.tsx"), "utf8");
  const source = fs.readFileSync(path.join(repo, "src", "renderer", "game", "index.tsx"), "utf8");
  const found = layoutComponents(layout);
  assert.ok(found.includes("ConfirmHost"), `no components read from the layout: ${found.join(", ")}`);
  const missing = found.filter((name) => !LAID_BY_THE_SHELL.has(name) && !new RegExp(`<${name}[\\s/>]`).test(source));
  assert.deepEqual(missing, [], `the server's layout lays ${missing.join(", ")}, which the game root does not`);
});

test("the theme panel's host is mounted beside the confirm host and closed with the screens", { skip: !fs.existsSync(path.join(serverDir, "src", "components", "ThemePanelHost.tsx")) }, () => {
  const source = fs.readFileSync(path.join(repo, "src", "renderer", "game", "index.tsx"), "utf8");
  assert.match(source, /import \{ ThemePanelHost \} from "@\/components\/ThemePanelHost";/);
  assert.match(source, /<ConfirmHost \/>[\s\S]*<ThemePanelHost \/>/);
  assert.match(source, /render\(null, root\);\s*(?:\/\/.*\s*)*setThemePanelOpen\(false\);/);
});

// A theme's day artwork (artDay) is laid by applyTheme, so a change of the
// system's brightness on Auto has to run it again.
test("the game root lays the day or night artwork again when the system turns over on Auto", () => {
  const source = fs.readFileSync(path.join(repo, "src", "renderer", "game", "index.tsx"), "utf8");
  assert.match(source, /matchMedia\?\.\("\(prefers-color-scheme: light\)"\)\.addEventListener\("change", \(\) => \{\s*if \(readThemeChoice\(\) === "auto"\) applyTheme\(\);/);
});
