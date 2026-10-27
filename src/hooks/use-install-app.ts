import { useSyncExternalStore } from "react";

/** Chromium's `beforeinstallprompt` event; it isn't in the DOM typings. */
type InstallPromptEvent = Event & {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

/**
 * - available: the browser offered an install prompt we can trigger (Chrome, Edge, Android)
 * - ios: no prompt API; the user adds it from Safari's Share sheet
 * - manual: nothing offered (already dismissed, or an unsupported browser like Firefox)
 */
export type InstallState = "checking" | "installed" | "available" | "ios" | "manual";

// Chromium fires `beforeinstallprompt` once, typically long before someone opens Settings, so
// it's captured as soon as this module loads (Providers imports it) and held until it's used.
let deferredPrompt: InstallPromptEvent | null = null;
let installed = false;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((listener) => listener());

if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault(); // we show our own button instead of the browser's mini-infobar
    deferredPrompt = event as InstallPromptEvent;
    notify();
  });
  window.addEventListener("appinstalled", () => {
    deferredPrompt = null;
    installed = true;
    notify();
  });
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => void listeners.delete(listener);
}

function isStandalone() {
  return window.matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
}

function isIos() {
  // iPadOS reports itself as a Mac, so touch support tells them apart.
  return /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}

function getSnapshot(): InstallState {
  if (installed || isStandalone()) return "installed";
  if (deferredPrompt) return "available";
  return isIos() ? "ios" : "manual";
}

/** Opens the browser's install dialog. A captured prompt can only be used once. */
async function install(): Promise<"accepted" | "dismissed" | "unavailable"> {
  const prompt = deferredPrompt;
  if (!prompt) return "unavailable";
  deferredPrompt = null;
  notify();
  await prompt.prompt();
  return (await prompt.userChoice).outcome;
}

export function useInstallApp() {
  const state = useSyncExternalStore<InstallState>(subscribe, getSnapshot, () => "checking");
  return { state, install };
}
