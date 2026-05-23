"use client";

import { Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";
import { applyTheme, getInitialTheme, setTheme, type ThemeMode } from "@/lib/theme";
import { cn } from "@/lib/utils";

type ThemeToggleProps = {
  className?: string;
  showLabel?: boolean;
};

export function ThemeToggle({ className, showLabel = false }: ThemeToggleProps) {
  const [mode, setMode] = useState<ThemeMode>("dark");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMode(getInitialTheme());
    setMounted(true);
  }, []);

  function toggle() {
    const next: ThemeMode = mode === "dark" ? "light" : "dark";
    setMode(next);
    setTheme(next);
  }

  const isDark = mode === "dark";

  return (
    <button
      type="button"
      onClick={toggle}
      className={cn(
        "theme-toggle inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition-colors",
        className
      )}
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      title={isDark ? "Light mode" : "Dark mode"}
    >
      {mounted ? (
        isDark ? (
          <>
            <Sun className="h-4 w-4" aria-hidden />
            {showLabel ? <span>Light</span> : null}
          </>
        ) : (
          <>
            <Moon className="h-4 w-4" aria-hidden />
            {showLabel ? <span>Dark</span> : null}
          </>
        )
      ) : (
        <Sun className="h-4 w-4 opacity-50" aria-hidden />
      )}
    </button>
  );
}

/** Sync theme on client navigation without flash */
export function ThemeSync() {
  useEffect(() => {
    applyTheme(getInitialTheme());
  }, []);
  return null;
}
