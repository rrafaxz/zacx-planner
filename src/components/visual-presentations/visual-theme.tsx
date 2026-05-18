"use client";

import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";

import { Button } from "@/components/ui/button";

export type VisualTheme = "dark" | "light";

const storageKey = "zacx-visual-theme";

export function useVisualTheme() {
  const [theme, setTheme] = useState<VisualTheme>("dark");

  useEffect(() => {
    const storedTheme = window.localStorage.getItem(storageKey);

    if (storedTheme === "light" || storedTheme === "dark") {
      setTheme(storedTheme);
    }
  }, []);

  function toggleTheme() {
    setTheme((currentTheme) => {
      const nextTheme = currentTheme === "dark" ? "light" : "dark";

      window.localStorage.setItem(storageKey, nextTheme);

      return nextTheme;
    });
  }

  return { theme, toggleTheme };
}

export function VisualThemeToggle({
  theme,
  onToggle,
}: {
  theme: VisualTheme;
  onToggle: () => void;
}) {
  const isDark = theme === "dark";

  return (
    <Button
      type="button"
      variant="outline"
      size="icon"
      onClick={onToggle}
      aria-label={isDark ? "Ativar modo claro" : "Ativar modo escuro"}
      className={
        isDark
          ? "border-white/12 bg-white/5 text-white hover:bg-white/10"
          : "border-neutral-200 bg-white text-neutral-950 shadow-sm hover:bg-neutral-100"
      }
    >
      {isDark ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
    </Button>
  );
}
