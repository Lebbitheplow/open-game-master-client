// The route table (index.tsx) imports the server's page components through
// the bundler's "@/" alias (scripts/build-renderer.mjs); tsc only needs to
// know they are page modules. A script file, not a module, so this is an
// ambient declaration rather than an augmentation.
declare module "@/app/*" {
  const page: import("preact").ComponentType<{ params: unknown; searchParams?: unknown }>;
  export default page;
}

// The server's device panel (src/components/DeviceSettings.tsx), mounted on
// the shell's Settings screen.
// The visual theme picker (server 0.37.0), for the shell's Settings.
declare module "@/components/AppearancePicker" {
  import type { ComponentType } from "preact/compat";
  export const AppearancePicker: ComponentType<Record<string, never>>;
}

declare module "@/components/DeviceSettings" {
  import type { ComponentType } from "preact/compat";
  export const DeviceSettings: ComponentType<Record<string, never>>;
}

// The server's page skeletons (src/components/PageSkeleton.tsx): the shape a
// page holds while its code loads, shown by the game router's Suspense.
declare module "@/components/PageSkeleton" {
  import type { ComponentType } from "preact/compat";
  export type SkeletonKind = "home" | "lobby" | "table" | "roster" | "sheet" | "shelf" | "hub" | "list" | "flat";
  export const PageSkeleton: ComponentType<{ kind?: SkeletonKind; className?: string }>;
}

// The server's confirm and notice host (src/components/ui/ConfirmDialog.tsx),
// which its root layout mounts; the game root mounts it here, so appConfirm
// and appNotice draw the app's own dialog instead of the web view's.
declare module "@/components/ui/ConfirmDialog" {
  import type { ComponentType } from "preact/compat";
  export const ConfirmHost: ComponentType<Record<string, never>>;
}

// The reader's theme and interface scale (src/lib/theme-mode.ts), which the
// server applies from its root layout; the game root applies a saved choice
// here when the screens load.
declare module "@/lib/theme-mode" {
  export type ThemeChoice = "auto" | "dark" | "light";
  export function applyTheme(): void;
  export function readThemeChoice(): ThemeChoice;
  export function readUiScale(): number;
}

// The reader's language (src/lib/locale.tsx), which the server applies from
// its root layout; the game root applies the device's choice here when the
// screens load.
declare module "@/lib/locale" {
  export type LocaleChoice = "auto" | "en" | "fr";
  export function applyLocale(): void;
  export function readLocaleChoice(): LocaleChoice;
  export function resolveLocale(choice: LocaleChoice): "en" | "fr";
}

// The French catalog's loader (src/lib/i18n/catalog-loader.ts): the
// catalog is its own chunk, fetched when the reader's language needs it.
declare module "@/lib/i18n/catalog-loader" {
  export function loadCatalog(locale: "en" | "fr"): Promise<void>;
}
