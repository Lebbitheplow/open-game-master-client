import assert from "node:assert/strict";
import test from "node:test";
import { imageAiPatch, pointsAtManagedComfy } from "../dist/main/local-ai/wiring.js";

// What the masked admin settings answer (GET /api/admin/settings).
const settings = (images) => ({ config: { images } });
const managed = "http://127.0.0.1:8188";

test("the world still wired to the app's own ComfyUI is unwired", () => {
  assert.equal(pointsAtManagedComfy(settings({ defaultBackend: "comfyui", comfyUrl: managed }), managed), true);
  assert.equal(pointsAtManagedComfy(settings({ defaultBackend: "comfyui", comfyUrl: `${managed}/ ` }), managed), true);
});

test("an address the player typed, another backend or no pictures is left alone", () => {
  assert.equal(pointsAtManagedComfy(settings({ defaultBackend: "comfyui", comfyUrl: "http://192.168.1.20:8188" }), managed), false);
  assert.equal(pointsAtManagedComfy(settings({ defaultBackend: "openai", comfyUrl: managed }), managed), false);
  assert.equal(pointsAtManagedComfy(settings({ defaultBackend: "", comfyUrl: "" }), managed), false);
  assert.equal(pointsAtManagedComfy(settings({ defaultBackend: "comfyui", comfyUrl: "" }), managed), false);
  assert.equal(pointsAtManagedComfy(null, managed), false);
  assert.equal(pointsAtManagedComfy({}, managed), false);
});

// Issue 943: a ComfyUI started outside the app answered at the address, with
// no checkpoints at all, and the world was told to paint with the app's SDXL.
test("an install names the app's checkpoint only when the app's own ComfyUI will answer", () => {
  assert.deepEqual(imageAiPatch(managed, "sd_xl_base_1.0.safetensors", false), {
    images: { defaultBackend: "comfyui", comfyUrl: managed, comfyCheckpoint: "sd_xl_base_1.0.safetensors" },
  });
  assert.deepEqual(imageAiPatch(managed, "sd_xl_base_1.0.safetensors", true), { images: { defaultBackend: "comfyui", comfyUrl: managed } });
  assert.deepEqual(imageAiPatch(managed, "", false), { images: { defaultBackend: "comfyui", comfyUrl: managed } }, "an empty name never clears the admin's pick");
});
