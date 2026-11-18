import assert from "node:assert/strict";
import test from "node:test";
import { themeTokens } from "../scripts/theme-tokens.mjs";
import { bootTheme } from "../dist/shared/theme-boot.js";

test("themeTokens lifts each theme's custom properties to <html> and drops the rest", () => {
  const css = `
[data-appearance="woodland"] {
  /* The title screen's night. */
  --theme-night-amber-400: #bdd5ba; --material-edge: #6b5a3c; }
[data-appearance="woodland"][data-theme="dark"] { --background: #0c1510; color: red; --color-stone-950: #101b14; }
html[data-appearance="woodland"] .theme-table .cine-send { color: #fff; --x: 1px; }
[data-theme="light"] { --background: #fff; }
@media (forced-colors: active) { html[data-appearance="woodland"] { --material-edge: ButtonText; } }
[data-appearance] { --appearance-rule: color-mix(in srgb, var(--color-amber-400) 35%, transparent); }
`;
  assert.equal(
    themeTokens(css),
    [
      'html[data-appearance="woodland"]{--theme-night-amber-400: #bdd5ba;--material-edge: #6b5a3c}',
      'html[data-appearance="woodland"][data-theme="dark"]{--background: #0c1510;--color-stone-950: #101b14}',
      "html[data-appearance]{--appearance-rule: color-mix(in srgb, var(--color-amber-400) 35%, transparent)}",
    ].join("\n"),
  );
});

test("bootTheme takes the saved theme and brightness, else Arcane and the system's", () => {
  assert.deepEqual(bootTheme("woodland", "light", false), { appearance: "woodland", theme: "light" });
  assert.deepEqual(bootTheme(null, null, true), { appearance: "arcane", theme: "light" });
  assert.deepEqual(bootTheme(null, null, false), { appearance: "arcane", theme: "dark" });
  assert.deepEqual(bootTheme('x"]{}', "sepia", false), { appearance: "arcane", theme: "dark" });
});
