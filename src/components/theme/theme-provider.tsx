"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import { Moon, Sun } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Theme = "dark" | "light";

type ThemeContextValue = {
  theme: Theme;
  isLight: boolean;
  toggleTheme: () => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);
const storageKey = "zacx-theme";

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>("dark");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const storedTheme = window.localStorage.getItem(storageKey);

    if (storedTheme === "light" || storedTheme === "dark") {
      setTheme(storedTheme);
    }

    setMounted(true);
  }, []);

  useEffect(() => {
    const root = document.documentElement;

    root.classList.toggle("dark", theme === "dark");
    root.classList.toggle("light", theme === "light");
    root.dataset.theme = theme;
    root.style.colorScheme = theme;
    window.localStorage.setItem(storageKey, theme);
  }, [theme]);

  const value = useMemo(
    () => ({
      theme,
      isLight: theme === "light",
      toggleTheme: () => setTheme((currentTheme) => (currentTheme === "dark" ? "light" : "dark")),
    }),
    [theme],
  );

  return (
    <ThemeContext.Provider value={value}>
      {children}
      {mounted ? <GlobalThemeToggle /> : null}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);

  if (!context) {
    throw new Error("useTheme must be used inside ThemeProvider");
  }

  return context;
}

function GlobalThemeToggle() {
  const { theme, isLight, toggleTheme } = useTheme();
  const pathname = usePathname();
  const isPublicDocument = pathname?.startsWith("/a/") || pathname?.startsWith("/p/");

  if (isPublicDocument) {
    return null;
  }

  return (
    <Button
      type="button"
      size="icon"
      variant="outline"
      onClick={toggleTheme}
      aria-label="Alternar tema"
      className={cn(
        "fixed right-4 top-4 z-[70] hidden h-10 w-10 rounded-lg border transition-colors md:inline-flex",
        isLight
          ? "border-neutral-200 bg-white text-neutral-950 shadow-sm hover:bg-neutral-100"
          : "border-white/10 bg-[#17171A] text-white shadow-sm hover:bg-[#202024]",
      )}
    >
      {theme === "dark" ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
    </Button>
  );
}
