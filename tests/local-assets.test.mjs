import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { answersLocally, assetContentType, createLocalAssetIndex, localFolder } from "../dist/shared/local-assets.js";
import { serverDir as findServerDir } from "../scripts/server-dir.mjs";

const repo = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const serverDir = findServerDir(repo);

// A host path resolves to the app's own copy only when the build's manifest
// lists it; a build whose manifest lists no icons resolves every icon
// locally; everything else goes to the host, which may be newer than the app.
test("the manifest decides which host paths the app answers itself", () => {
  const index = createLocalAssetIndex({
    "/assets/tiles/": ["grass.webp"],
    "/assets/ui/": ["scroll.webp"],
    "/fx/": ["crit-flare.webp"],
  });
  assert.equal(index.localPath("/assets/tiles/grass.webp"), "game/public/assets/tiles/grass.webp");
  assert.equal(index.localPath("/assets/tiles/grass.webp?v=2"), "game/public/assets/tiles/grass.webp", "a query is dropped");
  assert.equal(index.localPath("/assets/tiles/newer.webp"), null, "art the app was not built with comes from the host");
  assert.equal(index.localPath("/assets/tiles/"), null);
  assert.equal(index.localPath("/assets/ui/scroll.webp"), "game/ui-art/scroll.webp", "the sheet's furniture keeps its folder");
  assert.equal(index.localPath("/fx/crit-flare.webp"), "game/public/fx/crit-flare.webp");
  assert.equal(index.localPath("/assets/icons/glyph/die-d20.webp"), "game/icons/glyph/die-d20.webp", "icons need no manifest");
  assert.equal(index.localPath("/uploads/grass.webp"), null);
  assert.equal(index.localPath("//assets/tiles/grass.webp"), null);
  assert.equal(index.localPath("assets/tiles/grass.webp"), null);
});

// Audit C3: once the manifest lists icons, an icon a newer host has and the
// app does not goes to the host instead of a file the app does not carry.
test("a manifest that lists icons sends an unlisted icon to the host", () => {
  const index = createLocalAssetIndex({ "/assets/icons/glyph/": ["die-d20.webp"] });
  assert.equal(index.localPath("/assets/icons/glyph/die-d20.webp"), "game/icons/glyph/die-d20.webp");
  assert.equal(index.localPath("/assets/icons/glyph/newer-glyph.webp"), null);
  assert.equal(index.localPath("/assets/icons/cards/strike.webp"), null);
});

// A page's fetch for a carried file is answered by the app itself: a plain
// read of a picture or a data file, never a write and never a catalogue,
// whose content is the host's own.
test("a fetch is answered locally for a read of anything but a catalogue", () => {
  assert.equal(answersLocally("GET", "/assets/tiles/floor/grass.webp"), true);
  assert.equal(answersLocally("get", "/pdfjs/pdf.worker.min.mjs"), true);
  assert.equal(answersLocally("GET", "/pdfjs/cmaps/78-H.bcmap?x=1"), true);
  assert.equal(answersLocally("GET", "/assets/tiles/manifest.json"), false, "a newer host may list art the app lacks");
  assert.equal(answersLocally("GET", "/fx/manifest.JSON?v=3"), false);
  assert.equal(answersLocally("POST", "/assets/tiles/floor/grass.webp"), false);
  assert.equal(answersLocally("HEAD", "/assets/tiles/floor/grass.webp"), false);
});

test("an answer the shell builds names the type a host would", () => {
  assert.equal(assetContentType("/assets/tiles/floor/grass.webp"), "image/webp");
  assert.equal(assetContentType("/assets/themes/dawn.JPG?w=256"), "image/jpeg");
  assert.equal(assetContentType("/dice-box/sounds/dicehit/hit1.mp3"), "audio/mpeg");
  assert.equal(assetContentType("/pdfjs/pdf.worker.min.mjs"), "text/javascript");
  assert.equal(assetContentType("/pdfjs/wasm/openjpeg.wasm"), "application/wasm");
  assert.equal(assetContentType("/pdfjs/cmaps/78-H.bcmap"), "application/octet-stream");
  assert.equal(assetContentType("/pdfjs.d/LICENSE"), "application/octet-stream", "a dot in a folder is not an extension");
});

// The build copied every file it listed to where the runtime will look.
test("every manifest entry of the desktop build exists beside the bundle", () => {
  const game = path.join(repo, "dist", "renderer", "game");
  const file = path.join(game, "public", "manifest.json");
  assert.ok(fs.existsSync(file), "dist/renderer/game/public/manifest.json is missing");
  const manifest = JSON.parse(fs.readFileSync(file, "utf8"));
  const dirs = Object.keys(manifest);
  assert.ok(dirs.includes("/assets/tiles/"), "the tiles were not shipped");
  for (const prefix of ["/assets/ui/", "/assets/icons/", "/fx/", "/dice-box/", "/sidebar-icons/"]) {
    assert.ok(dirs.some((dir) => dir.startsWith(prefix)), `${prefix} was not shipped`);
  }
  assert.ok(!dirs.some((dir) => dir.startsWith("/ambience/")), "ambience is login-gated and must not ship");
  let count = 0;
  for (const [dir, files] of Object.entries(manifest)) {
    assert.deepEqual(files, [...files].sort((a, b) => a.localeCompare(b)), `${dir} is not sorted`);
    for (const name of files) {
      const local = path.join(repo, "dist", "renderer", localFolder(dir), name);
      assert.ok(fs.existsSync(local), `${dir}${name} is listed but ${local} is missing`);
      count += 1;
    }
  }
  assert.ok(count > 3000, `only ${count} files shipped`);
});

// A visual theme is its pictures: the frame, the grain, the corner and the
// backdrop the server's catalog names for it, by night and by day. The page
// is handed them as "/assets/themes/..." addresses, which only resolve in the
// apps when the build carries each one, so a theme added to the server with
// a picture the build left out would show without it in every app.
const catalogFile = path.join(serverDir, "src", "lib", "appearance-themes.ts");
test("the build carries every picture the server's theme catalog names", { skip: !fs.existsSync(catalogFile) }, () => {
  const named = [...new Set([...fs.readFileSync(catalogFile, "utf8").matchAll(/"(\/assets\/themes\/[^"]+)"/g)].map((match) => match[1]))];
  assert.ok(named.length >= 40, `the catalog names only ${named.length} pictures; has its shape changed?`);
  const manifest = JSON.parse(fs.readFileSync(path.join(repo, "dist", "renderer", "game", "public", "manifest.json"), "utf8"));
  const index = createLocalAssetIndex(manifest);
  const missing = named.filter((hostPath) => {
    const local = index.localPath(hostPath);
    return !local || !fs.existsSync(path.join(repo, "dist", "renderer", local));
  });
  assert.deepEqual(missing, [], `theme pictures the apps do not carry: ${missing.join(", ")}`);
});

// The shell's Settings draws two of the server's panels with no host
// connected (the theme picker and the audio and dice controls), so no world's
// observer is watching them. The picker's previews take their frame and
// grain from inline custom properties, and with nothing rewriting those every
// preview asked the app's own origin and stood bare. Each such panel is
// watched from its own root for as long as it is mounted.
test("a game panel drawn with no host connected has its inline artwork sent to the app's copies", () => {
  const runtime = fs.readFileSync(path.join(repo, "src", "renderer", "game", "runtime.ts"), "utf8");
  const install = runtime.slice(runtime.indexOf("export function installLocalAssets("));
  const body = install.slice(0, install.indexOf("\n}\n"));
  assert.match(body, /^export function installLocalAssets\(root: HTMLElement\): \(\) => void \{/, "installLocalAssets no longer takes the panel's root");
  assert.match(body, /new MutationObserver\(onMutations\)/, "the panel is not watched");
  assert.match(body, /\.observe\(root, WATCHED\)/, "the watch is not on the panel's own root");
  assert.match(body, /scan\(root\)/, "what the panel already holds is not looked at");
  assert.match(runtime, /const WATCHED: MutationObserverInit = \{[^}]*attributeFilter: \[[^\]]*"style"\]/, "a change of inline style is not watched");
  // And before the write, for whatever needs no wait: a screen that measures
  // itself as it mounts has the browser ask for a picture ahead of the
  // observer, so the app was asked for its own carried art and missed.
  const hook = runtime.slice(runtime.indexOf("function hookInlineStyles("), runtime.indexOf("function fixBackgroundImage("));
  assert.match(hook, /const previous = options\.vnode;/, "the hook drops whoever was on Preact's vnode hook before it");
  assert.match(hook, /options\.vnode = \(vnode\) => \{/, "inline styles are not looked at as they are drawn");
  assert.match(hook, /cssValueAsDrawn\(value\)/);
  assert.match(hook, /\{ \.\.\.style \}/, "the page's own style object is changed in place");
  assert.match(hook, /previous\?\.\(vnode\);/);
  assert.match(runtime, /mediaPatched = true;\n\s+hookInlineStyles\(\);/, "the hook is not laid with the picture setters");
  const index = fs.readFileSync(path.join(repo, "src", "renderer", "game", "index.tsx"), "utf8");
  for (const mount of ["mountDeviceSettings", "mountAppearance"]) {
    const start = index.indexOf(`export function ${mount}(`);
    assert.ok(start >= 0, `${mount} is gone`);
    const text = index.slice(start, index.indexOf("\n}\n", start));
    assert.match(text, /const release = installLocalAssets\(root\);\n\s+render\(</, `${mount} does not watch its panel before drawing it`);
    assert.match(text, /release\(\);/, `${mount} leaves its watch behind`);
  }
});
