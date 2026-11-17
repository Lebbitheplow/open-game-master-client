// The visual themes' colour tokens for the shell's own screens. The server
// keys each theme's palette on <html> ([data-appearance=x][data-theme=y]),
// and the game sheet (scope-css.mjs) can only lay those values on the game's
// root, so the home, the drawer, Settings and every other shell screen never
// saw them. This sheet carries the same tokens at <html> level, custom
// properties only, and loads with the shell (index.html) so the first frame
// is already in the reader's theme. The shell's own sheets read them with
// Arcane's values as the fallback, so a server from before the themes (no
// theme files, an empty sheet) looks exactly as it did.
import fs from "node:fs";
import path from "node:path";
import { splitDeclarations, splitRules, splitSelectors } from "./scope-css.mjs";

const DOCUMENT = /^(?:html|:root)?((?:\[data-(?:appearance|theme)(?:="[^"\]]*")?\])+)$/;

// Keeps the top-level rules whose every selector is <html>'s theme attributes
// alone (at least one data-appearance) and keeps only their custom properties.
export function themeTokens(css) {
  const out = [];
  for (const rule of splitRules(css)) {
    if (!rule.prelude || rule.prelude.startsWith("@")) continue;
    const matches = splitSelectors(rule.prelude).map((part) => DOCUMENT.exec(part.trim()));
    if (matches.some((match) => !match) || !matches.some((match) => match[1].includes("[data-appearance"))) continue;
    // Comments go first: an apostrophe in one ("the screen's") reads as an
    // open string to the declaration splitter and swallows the rest.
    const tokens = splitDeclarations(rule.body.replace(/\/\*[\s\S]*?\*\//g, ""))
      .map((declaration) => declaration.trim())
      .filter((declaration) => declaration.startsWith("--"));
    if (tokens.length) out.push(`${matches.map((match) => `html${match[1]}`).join(",")}{${tokens.join(";")}}`);
  }
  return out.join("\n");
}

// The server's theme sheets in the order globals.css imports them, and the
// shared appearance tokens after them.
export function themeSheets(server) {
  const styles = path.join(server, "src", "app");
  const globals = fs.readFileSync(path.join(styles, "globals.css"), "utf8");
  const files = [...globals.matchAll(/^@import\s+"\.\/(styles\/(?:themes\/[\w-]+|appearance)\.css)";/gm)].map((match) => path.join(styles, match[1]));
  return files.filter((file) => fs.existsSync(file));
}

export function buildThemeTokens(server, outDir) {
  const css = themeSheets(server)
    .map((file) => themeTokens(fs.readFileSync(file, "utf8")))
    .filter(Boolean)
    .join("\n");
  fs.writeFileSync(path.join(outDir, "themes.css"), css ? `${css}\n` : "");
}
