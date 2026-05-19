"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  ChevronLeft,
  ChevronRight,
  Menu,
  Moon,
  Sun,
  UsersRound,
  X,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { PwaInstallButton } from "@/components/pwa-install-button";
import { useTheme } from "@/components/theme/theme-provider";
import { ZacxLogo } from "@/components/zacx-logo";
import { ZacxMark } from "@/components/zacx-mark";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/admin", label: "Visao geral", icon: BarChart3 },
  { href: "/admin/clientes", label: "Clientes", icon: UsersRound },
];

function ThemeMenuButton({ compact = false }: { compact?: boolean }) {
  const { theme, toggleTheme } = useTheme();
  const Icon = theme === "dark" ? Sun : Moon;
  const label = theme === "dark" ? "Tema claro" : "Tema escuro";

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className={cn(
        "flex h-11 items-center gap-3 rounded-md px-3 text-sm text-muted-foreground transition-colors hover:bg-foreground/[0.06] hover:text-foreground",
        compact && "justify-center px-0",
      )}
      title={compact ? label : undefined}
      aria-label={label}
    >
      <Icon className="h-4 w-4 shrink-0" />
      {!compact ? label : null}
    </button>
  );
}

export function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  useEffect(() => {
    setIsCollapsed(window.localStorage.getItem("zacx-sidebar-collapsed") === "true");
  }, []);

  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [pathname]);

  function toggleSidebar() {
    setIsCollapsed((currentValue) => {
      const nextValue = !currentValue;

      window.localStorage.setItem("zacx-sidebar-collapsed", String(nextValue));

      return nextValue;
    });
  }

  return (
    <div className="min-h-screen bg-background text-foreground transition-colors">
      <div className="fixed inset-0 -z-10 subtle-grid opacity-35" />

      <header className="sticky top-0 z-[100] border-b border-border bg-background md:hidden">
        <div className="grid h-14 grid-cols-[44px_1fr_44px] items-center px-3">
          <button
            type="button"
            onClick={() => setIsMobileMenuOpen(true)}
            className="grid h-10 w-10 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-foreground/[0.06] hover:text-foreground"
            aria-label="Abrir menu"
          >
            <Menu className="h-5 w-5" />
          </button>

          <Link href="/admin" className="flex min-w-0 justify-center">
            <ZacxLogo className="h-5 w-auto max-w-[104px] text-[var(--zacx-brand)]" />
          </Link>

          <div aria-hidden="true" />
        </div>

        {isMobileMenuOpen ? (
          <div
            className="fixed inset-0 z-[120] bg-black/45"
            onClick={() => setIsMobileMenuOpen(false)}
          >
            <aside
              className="relative z-[121] h-full w-[min(82vw,300px)] border-r border-border bg-background p-4"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="grid grid-cols-[36px_1fr_36px] items-center gap-3">
                <span aria-hidden="true" />
                <ZacxLogo className="mx-auto h-5 w-auto max-w-[112px] text-[var(--zacx-brand)]" />
                <button
                  type="button"
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="grid h-9 w-9 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-foreground/[0.06] hover:text-foreground"
                  aria-label="Fechar menu"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <nav className="mt-8 grid gap-2">
                {navItems.map((item) => {
                  const isActive = pathname === item.href;
                  const Icon = item.icon;

                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={cn(
                        "flex h-11 items-center gap-3 rounded-md px-3 text-sm transition-colors",
                        isActive
                          ? "bg-foreground/[0.06] text-foreground"
                          : "text-muted-foreground hover:bg-foreground/[0.06] hover:text-foreground",
                      )}
                    >
                      <Icon className="h-4 w-4 shrink-0" />
                      {item.label}
                    </Link>
                  );
                })}

                <PwaInstallButton />
                <ThemeMenuButton />
              </nav>
            </aside>
          </div>
        ) : null}

        <nav className="hidden gap-2 overflow-x-auto px-4 pb-3">
          {navItems.map((item) => {
            const isActive = pathname === item.href;
            const Icon = item.icon;

            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "inline-flex h-10 shrink-0 items-center gap-2 rounded-md border px-3 text-sm transition-colors",
                  isActive
                    ? "border-primary/40 bg-primary text-primary-foreground"
                    : "border-border bg-card text-muted-foreground",
                )}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
      </header>

      <aside
        className={cn(
          "fixed left-0 top-0 hidden h-screen border-r border-border bg-background p-4 transition-all duration-300 md:block",
          isCollapsed ? "w-20" : "w-72",
        )}
      >
        <div
          className={cn(
            "transition-all",
            isCollapsed
              ? "flex flex-col items-center gap-3 pt-7"
              : "flex items-center justify-between gap-3 pt-7",
          )}
        >
          <Link
            href="/admin"
          className={cn("flex min-w-0 items-center", isCollapsed ? "justify-center" : "flex-1 justify-center pl-9")}
          >
            {isCollapsed ? (
              <ZacxMark className="h-8 w-8 text-[var(--zacx-brand)] transition-colors" />
            ) : (
              <ZacxLogo className="h-7 w-auto max-w-[128px] text-[var(--zacx-brand)] transition-colors" />
            )}
          </Link>
          <Button
            type="button"
            variant="ghostSecondary"
            size="icon"
            onClick={toggleSidebar}
            className="h-9 w-9 shrink-0"
            aria-label={isCollapsed ? "Expandir sidebar" : "Recolher sidebar"}
          >
            {isCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          </Button>
        </div>

        <nav className="mt-8 grid gap-2">
          {navItems.map((item) => {
            const isActive = pathname === item.href;
            const Icon = item.icon;

            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex h-11 items-center gap-3 rounded-md px-3 text-sm transition-colors",
                  isCollapsed && "justify-center px-0",
                  isActive
                    ? "bg-foreground/[0.06] text-foreground"
                    : "text-muted-foreground hover:bg-foreground/[0.06] hover:text-foreground",
                )}
                title={isCollapsed ? item.label : undefined}
              >
                <Icon className="h-4 w-4 shrink-0" />
                {!isCollapsed ? item.label : null}
              </Link>
            );
          })}

          <ThemeMenuButton compact={isCollapsed} />
        </nav>

        <nav className="absolute bottom-5 left-4 right-4 grid gap-2">
          <PwaInstallButton compact={isCollapsed} />
        </nav>
      </aside>

      <main
        className={cn(
          "px-4 py-6 transition-all duration-300 md:px-8 md:py-8",
          isCollapsed ? "md:ml-20" : "md:ml-72",
        )}
      >
        <div className="mx-auto w-full max-w-6xl">{children}</div>
      </main>
    </div>
  );
}
