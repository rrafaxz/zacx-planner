"use client";

import { useEffect, useState } from "react";
import { Download } from "lucide-react";

import { cn } from "@/lib/utils";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

type NavigatorWithStandalone = Navigator & {
  standalone?: boolean;
};

type PwaInstallButtonProps = {
  compact?: boolean;
  className?: string;
};

let cachedInstallPrompt: BeforeInstallPromptEvent | null = null;
let cachedIsInstalled = false;
let cachedShowIosHint = false;
const listeners = new Set<() => void>();

function notifyListeners() {
  listeners.forEach((listener) => listener());
}

function isStandaloneMode() {
  if (typeof window === "undefined") return false;

  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    window.matchMedia("(display-mode: fullscreen)").matches ||
    Boolean((window.navigator as NavigatorWithStandalone).standalone)
  );
}

function isIosDevice() {
  if (typeof window === "undefined") return false;

  return /iphone|ipad|ipod/i.test(window.navigator.userAgent);
}

export function PwaInstallButton({ compact = false, className }: PwaInstallButtonProps) {
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(cachedInstallPrompt);
  const [isInstalled, setIsInstalled] = useState(cachedIsInstalled);
  const [showIosHint, setShowIosHint] = useState(cachedShowIosHint);

  useEffect(() => {
    function syncState() {
      setInstallPrompt(cachedInstallPrompt);
      setIsInstalled(cachedIsInstalled);
      setShowIosHint(cachedShowIosHint);
    }

    cachedIsInstalled = isStandaloneMode();
    cachedShowIosHint = isIosDevice() && !cachedIsInstalled && !cachedInstallPrompt;
    syncState();
    listeners.add(syncState);

    function handleBeforeInstallPrompt(event: Event) {
      event.preventDefault();
      cachedInstallPrompt = event as BeforeInstallPromptEvent;
      cachedShowIosHint = false;
      notifyListeners();
    }

    function handleAppInstalled() {
      cachedInstallPrompt = null;
      cachedIsInstalled = true;
      cachedShowIosHint = false;
      notifyListeners();
    }

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleAppInstalled);

    return () => {
      listeners.delete(syncState);
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("appinstalled", handleAppInstalled);
    };
  }, []);

  async function installApp() {
    if (!installPrompt) return;

    await installPrompt.prompt();
    const choice = await installPrompt.userChoice;

    if (choice.outcome === "accepted") {
      cachedIsInstalled = true;
    }

    cachedInstallPrompt = null;
    cachedShowIosHint = false;
    notifyListeners();
  }

  if (isInstalled) return null;

  if (installPrompt) {
    return (
      <button
        type="button"
        onClick={installApp}
        className={cn(
          "flex h-11 w-full items-center rounded-md text-sm text-muted-foreground transition-colors hover:bg-foreground/[0.06] hover:text-foreground",
          compact ? "justify-center px-0" : "gap-3 px-3",
          className,
        )}
        aria-label="Instalar app"
        title="Instalar app"
      >
        <Download className="h-4 w-4 shrink-0" />
        {!compact ? <span>Instalar app</span> : null}
      </button>
    );
  }

  if (showIosHint && !compact) {
    return (
      <div
        className={cn(
          "rounded-md border border-border px-3 py-2 text-xs leading-5 text-muted-foreground",
          className,
        )}
      >
        No iPhone: Compartilhar &gt; Adicionar a Tela de Inicio.
      </div>
    );
  }

  return null;
}
