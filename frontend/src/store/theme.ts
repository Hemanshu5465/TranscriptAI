import { create } from "zustand";

export type ThemePref = "light" | "dark" | "system";
const KEY = "transcriptai.theme";

function readPref(): ThemePref {
  try {
    const v = localStorage.getItem(KEY);
    if (v === "light" || v === "dark" || v === "system") return v;
  } catch {
    /* ignore */
  }
  return "system";
}

function systemDark(): boolean {
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ?? false;
}

export function applyTheme(pref: ThemePref) {
  const dark = pref === "dark" || (pref === "system" && systemDark());
  document.documentElement.classList.toggle("dark", dark);
  document.documentElement.style.colorScheme = dark ? "dark" : "light";
}

interface ThemeState {
  pref: ThemePref;
  setPref: (p: ThemePref) => void;
  cycle: () => void;
}

export const useTheme = create<ThemeState>((set, get) => ({
  pref: readPref(),
  setPref: (pref) => {
    try {
      localStorage.setItem(KEY, pref);
    } catch {
      /* ignore */
    }
    applyTheme(pref);
    set({ pref });
  },
  cycle: () => {
    const order: ThemePref[] = ["light", "dark", "system"];
    const next = order[(order.indexOf(get().pref) + 1) % order.length];
    get().setPref(next);
  },
}));

export function initTheme() {
  applyTheme(readPref());
  window.matchMedia?.("(prefers-color-scheme: dark)").addEventListener("change", () => {
    if (useTheme.getState().pref === "system") applyTheme("system");
  });
}
