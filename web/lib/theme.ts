export const THEME_STORAGE_KEY = "cannacore-theme";

export type ThemeMode = "light" | "dark";

export function getStoredTheme(): ThemeMode | null {
  if (typeof window === "undefined") return null;
  try {
    const value = localStorage.getItem(THEME_STORAGE_KEY);
    if (value === "light" || value === "dark") return value;
  } catch {
    /* ignore */
  }
  return null;
}

export function applyTheme(mode: ThemeMode) {
  const root = document.documentElement;
  if (mode === "dark") {
    root.classList.add("dark");
  } else {
    root.classList.remove("dark");
  }
}

export function setTheme(mode: ThemeMode) {
  applyTheme(mode);
  try {
    localStorage.setItem(THEME_STORAGE_KEY, mode);
  } catch {
    /* ignore */
  }
}

export function getInitialTheme(): ThemeMode {
  return getStoredTheme() ?? "dark";
}
