import { getAdminSettings, patchAdminSettings } from "../odm-api";

// After a local AI install succeeds, point the local world's settings at it.
// Each helper returns "" on success or a warning sentence: the install
// itself already worked, so a failed PATCH must never read as a failed
// install, only as wiring left for the player to finish by hand.

const TEXT_BASE_URL = "http://127.0.0.1:8001/v1";

function reason(err: unknown): string {
  return err instanceof Error ? err.message : "Something went wrong.";
}

export async function wireTextAi(
  origin: string,
  token: string,
  alias: string,
  utilityAlias: string,
): Promise<string> {
  try {
    await patchAdminSettings(origin, token, {
      text: {
        provider: "custom",
        customBaseUrl: TEXT_BASE_URL,
        customModel: alias,
        customApiKey: "",
        utilityProvider: "custom",
        utilityBaseUrl: TEXT_BASE_URL,
        utilityModel: utilityAlias,
        utilityApiKey: "",
      },
    });
    return "";
  } catch (err) {
    return (
      `The model installed and works, but updating the world's AI settings failed: ${reason(err)} ` +
      `In the game's admin settings, point text AI at ${TEXT_BASE_URL} with model ${alias}.`
    );
  }
}

// The world's image settings after an install. When a ComfyUI the app did
// not start already answers at the address, the world paints with that one,
// which never has the app's checkpoint: naming it there sent every map and
// scene picture back as ComfyUI's "not in []" (issue 943), and switched off
// a catalog model the admin had chosen. Only the address is set then, and
// the model is left to pick.
export function imageAiPatch(comfyUrl: string, checkpoint: string, external: boolean) {
  return {
    images: { defaultBackend: "comfyui", comfyUrl, ...(external || !checkpoint ? {} : { comfyCheckpoint: checkpoint }) },
  };
}

export async function wireImageAi(
  origin: string,
  token: string,
  comfyUrl: string,
  checkpoint: string,
  external = false,
): Promise<string> {
  try {
    await patchAdminSettings(origin, token, imageAiPatch(comfyUrl, checkpoint, external));
    return external
      ? "Another ComfyUI already answers on this computer, so the world paints with that one. Pick one of its models in the game's admin settings, under Images."
      : "";
  } catch (err) {
    return (
      `Image generation installed and works, but updating the world's image settings failed: ${reason(err)} ` +
      `In the game's admin settings, point images at ComfyUI on ${comfyUrl}.`
    );
  }
}

// Whether the world's pictures still go to the app's own ComfyUI, as
// wireImageAi left them: ComfyUI at the managed address. An address the
// player typed in the admin panel is theirs, and is never undone.
export function pointsAtManagedComfy(body: unknown, comfyUrl: string): boolean {
  const images = (body as { config?: { images?: { defaultBackend?: unknown; comfyUrl?: unknown } } } | null)?.config
    ?.images;
  const bare = (url: unknown) => (typeof url === "string" ? url.trim().replace(/\/+$/, "") : "");
  return images?.defaultBackend === "comfyui" && bare(images.comfyUrl) !== "" && bare(images.comfyUrl) === bare(comfyUrl);
}

// After the image stack is removed, stop pointing the world at it, so its
// tables go back to placeholder art instead of queuing maps and scene
// pictures that fail with "Could not reach ComfyUI". The server then treats
// the world as having no pictures, the same as one that never installed
// them. Called when the stack is uninstalled while the world runs, and at
// every start (an uninstall made while the world slept could not reach it).
export async function unwireImageAi(origin: string, token: string, comfyUrl: string): Promise<string> {
  try {
    if (!pointsAtManagedComfy(await getAdminSettings(origin, token), comfyUrl)) return "";
    await patchAdminSettings(origin, token, {
      images: { defaultBackend: "", comfyUrl: "", comfyCheckpoint: "", comfyWorkflowPreset: "checkpoint" },
    });
    return "";
  } catch (err) {
    return (
      `Image generation was removed, but updating the world's image settings failed: ${reason(err)} ` +
      "In the game's admin settings, choose no pictures."
    );
  }
}
