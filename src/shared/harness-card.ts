// Pure decisions behind Story AI's agent picker (src/renderer/harness-ai.ts):
// what each program's card says, and which step its detail shows. The
// device world's server makes the same calls in its own setup and admin
// panels (src/app/setup/AgentPanel.tsx, src/app/admin/AdminHarnessSection.tsx).
// No DOM here so the rules can be tested on their own.
import type { HarnessCard } from "./types";

export interface HarnessTag {
  text: string;
  tone: "ok" | "warn" | "off";
}

// What the detail screen shows: why the program cannot run here, how to
// install it or sign it in, what is wrong with it, or the model form.
export type HarnessStep = "unavailable" | "install" | "signIn" | "fix" | "models";

// An installed program that lists no model and says why cannot narrate:
// opencode 1.x, which the server does not drive, or a config of the
// program's the server could not read. Saving it would only fail every turn.
export function harnessNeedsFixing(card: HarnessCard): boolean {
  return (
    card.availability === "ok" &&
    card.installed &&
    card.auth.state !== "signed-out" &&
    card.models.length === 0 &&
    Boolean(card.message)
  );
}

export function harnessStep(card: HarnessCard): HarnessStep {
  if (card.availability !== "ok") return "unavailable";
  if (!card.installed) return "install";
  if (card.auth.state === "signed-out") return "signIn";
  if (harnessNeedsFixing(card)) return "fix";
  return "models";
}

export function harnessTag(card: HarnessCard): HarnessTag {
  switch (harnessStep(card)) {
    case "unavailable":
      return { text: "not available here", tone: "off" };
    case "install":
      return { text: "not installed", tone: "off" };
    case "signIn":
      return { text: "sign in needed", tone: "warn" };
    case "fix":
      return { text: "needs attention", tone: "warn" };
    default:
      return { text: "ready", tone: "ok" };
  }
}

// The card's line. The server's message, when it sends one, is always part
// of it: it is what is wrong, or what the admin should know.
export function harnessDescription(card: HarnessCard): string {
  if (card.availability !== "ok" || !card.installed) {
    return card.message ?? `${card.label} was not found on this computer.`;
  }
  const version = card.version ? `Version ${card.version}. ` : "";
  if (harnessNeedsFixing(card)) {
    return `${version}${card.message}`;
  }
  const lockdown = card.lockdown === "removed" ? "Its own tools are removed" : "Its own tools are boxed in";
  const plan = card.auth.plan ? ` Signed in (${card.auth.plan}).` : "";
  const message = card.message ? ` ${card.message}` : "";
  return `${version}${lockdown}; it only touches the table's rules.${plan}${message}`;
}

// A program that cannot play the full rules: the Antigravity CLI loads too
// few tools for the table's full set, so it plays on a cut set that Open
// Game Master does not support or test. A server before 0.38.2 does not say
// so, and agy is the one program it would mean.
export function harnessReduced(card: HarnessCard): boolean {
  return card.reducedTools ?? card.id === "antigravity";
}

// The cards the picker lists: never one that cannot play the full rules,
// unless it is the device's current choice or the player asked to add it.
export function listedHarnessCards(statuses: HarnessCard[], currentId: string, addReduced: boolean): { listed: HarnessCard[]; unlisted: HarnessCard[] } {
  const listed = statuses.filter((card) => !harnessReduced(card) || addReduced || card.id === currentId);
  return { listed, unlisted: statuses.filter((card) => !listed.includes(card)) };
}

export function harnessReducedWarning(card: HarnessCard): string {
  return `${card.label} cannot play the full rules: it holds fewer tools than the table's full set, so it plays on a reduced tool set and rules. Open Game Master does not support or test this, and fights and other rules may not run properly. For real play, choose another program.`;
}
