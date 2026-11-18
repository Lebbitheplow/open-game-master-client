// What the shell lays on <html> before the game screens load: the server's
// theme-mode.ts writes data-appearance and data-theme from the same two saved
// choices once the game bundle runs (about a second after start), and the
// home, the drawer and Settings read both. Laying them at boot keeps the
// first frame in the reader's theme instead of Arcane's night.

export interface BootTheme {
  appearance: string;
  theme: "dark" | "light";
}

// A personal choice saved by the Appearance picker (odm.appearance), else
// Arcane: outside a campaign "Follow campaign" means Arcane. Brightness is
// odm.theme, else the system's. An id themes.css has no palette for paints
// with the shell's Arcane fallbacks, so only its shape is checked here.
export function bootTheme(storedAppearance: string | null, storedTheme: string | null, prefersLight: boolean): BootTheme {
  const appearance = storedAppearance && /^[a-z][a-z0-9-]{0,31}$/.test(storedAppearance) ? storedAppearance : "arcane";
  const theme = storedTheme === "dark" || storedTheme === "light" ? storedTheme : prefersLight ? "light" : "dark";
  return { appearance, theme };
}
