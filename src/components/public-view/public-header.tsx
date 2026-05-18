"use client";

import { Moon, Sun } from "lucide-react";

import { useTheme } from "@/components/theme/theme-provider";
import { Button } from "@/components/ui/button";
import { ZacxLogo } from "@/components/zacx-logo";
import { cn } from "@/lib/utils";

type PublicHeaderProps = {
  type: "planning" | "presentation";
};

const labelByType: Record<PublicHeaderProps["type"], string> = {
  planning: "PLANEJAMENTO PÚBLICO",
  presentation: "APRESENTAÇÃO PÚBLICA",
};

export function PublicHeader({ type }: PublicHeaderProps) {
  const { theme, isLight, toggleTheme } = useTheme();

  return (
    <header className="w-full border-b border-border bg-background">
      <div className="grid grid-cols-[auto_1fr_auto] items-center gap-3 px-4 py-4 sm:px-6">
        <ZacxLogo className="h-4 w-auto text-[var(--zacx-brand)]" />
        <span className="min-w-0 justify-self-end truncate text-right text-xs font-medium uppercase tracking-normal text-muted-foreground sm:text-sm">
          {labelByType[type]}
        </span>
        <Button
          type="button"
          size="icon"
          variant="outline"
          onClick={toggleTheme}
          aria-label={theme === "dark" ? "Ativar modo claro" : "Ativar modo escuro"}
          title={theme === "dark" ? "Ativar modo claro" : "Ativar modo escuro"}
          className={cn(
            "h-9 w-9 shrink-0 rounded-lg border shadow-none transition-colors sm:h-10 sm:w-10",
            isLight
              ? "border-neutral-200 bg-background text-neutral-950 hover:bg-foreground/[0.05]"
              : "border-white/10 bg-background text-white hover:bg-white/[0.06]",
          )}
        >
          {theme === "dark" ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
        </Button>
      </div>
    </header>
  );
}
