import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { splitDeclarations, splitRules, splitSelectors } from "../scripts/scope-css.mjs";

// The shell's grain and its bottom-right corner bracket are both ::after. On
// a card that is both (Settings, the guide, the tour) the grain's inset put
// the bracket at the top left, and its opacity, noise and radius all but hid
// it. Every property the grain sets beyond the bare pseudo-element must be
// undone where the two meet, so a property added to the grain later cannot
// hide the bracket again.

const style = path.join(path.dirname(path.dirname(fileURLToPath(import.meta.url))), "src", "renderer", "style.css");

function declarationsOf(css, match) {
  const rules = splitRules(css.replace(/\/\*[\s\S]*?\*\//g, ""));
  const rule = rules.find((r) => r.prelude && splitSelectors(r.prelude).some((s) => match(s.trim())));
  assert.ok(rule, "rule not found");
  return new Map(
    splitDeclarations(rule.body)
      .map((d) => d.trim())
      .filter(Boolean)
      .map((d) => [d.slice(0, d.indexOf(":")).trim(), d.slice(d.indexOf(":") + 1).trim()]),
  );
}

test("a card with grain and brackets keeps its bottom-right bracket in its corner and in full", () => {
  const css = fs.readFileSync(style, "utf8");
  const grain = declarationsOf(css, (s) => s === ".grain::after");
  const bracket = declarationsOf(css, (s) => /^\.ornate\.grain\b.*::after$/.test(s));
  // The bracket draws from its bottom and right; the grain's inset also sets
  // its top and left, which win over bottom and right at a fixed size.
  const undo = { inset: ["top", "left"] };
  const shared = new Set(["content", "position", "pointer-events"]);
  const missing = [...grain.keys()]
    .filter((prop) => !shared.has(prop))
    .flatMap((prop) => undo[prop] ?? [prop])
    .filter((prop) => !bracket.has(prop));
  assert.deepEqual(missing, []);
  assert.equal(bracket.get("opacity"), "1");
  assert.equal(bracket.get("top"), "auto");
  assert.equal(bracket.get("left"), "auto");
});
