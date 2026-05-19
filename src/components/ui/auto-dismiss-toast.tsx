"use client";

import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";

import { cn } from "@/lib/utils";

type ToastVariant = "success" | "error" | "warning" | "info";

type AutoDismissToastProps = {
  message: string | null | undefined;
  variant?: ToastVariant;
  onDismiss: () => void;
  duration?: number;
};

const variantStyles: Record<ToastVariant, string> = {
  success: "border-emerald-700 bg-emerald-600 text-white",
  error: "border-rose-700 bg-rose-600 text-white",
  warning: "border-amber-500 bg-amber-400 text-neutral-950",
  info: "border-blue-700 bg-blue-600 text-white",
};

const defaultDurations: Record<ToastVariant, number> = {
  success: 3600,
  error: 4800,
  warning: 4200,
  info: 3600,
};

export function AutoDismissToast({
  message,
  variant = "info",
  onDismiss,
  duration,
}: AutoDismissToastProps) {
  const [isLeaving, setIsLeaving] = useState(false);
  const onDismissRef = useRef(onDismiss);

  useEffect(() => {
    onDismissRef.current = onDismiss;
  }, [onDismiss]);

  useEffect(() => {
    if (!message) return;

    setIsLeaving(false);

    const visibleMs = duration ?? defaultDurations[variant];
    const leaveTimer = window.setTimeout(() => setIsLeaving(true), visibleMs);
    const dismissTimer = window.setTimeout(() => onDismissRef.current(), visibleMs + 220);

    return () => {
      window.clearTimeout(leaveTimer);
      window.clearTimeout(dismissTimer);
    };
  }, [duration, message, variant]);

  if (!message) return null;

  function dismiss() {
    setIsLeaving(true);
    window.setTimeout(() => onDismissRef.current(), 180);
  }

  return (
    <div
      role="status"
      aria-live={variant === "error" ? "assertive" : "polite"}
      className={cn(
        "fixed left-1/2 top-4 z-[150] flex w-[calc(100vw-2rem)] max-w-md -translate-x-1/2 items-start gap-3 rounded-xl border px-4 py-3 text-sm font-medium shadow-none transition-all duration-200 ease-out",
        isLeaving ? "-translate-y-3 opacity-0" : "translate-y-0 opacity-100",
        variantStyles[variant],
      )}
    >
      <span className="min-w-0 flex-1 leading-5">{message}</span>
      <button
        type="button"
        onClick={dismiss}
        className="grid h-6 w-6 shrink-0 place-items-center rounded-md text-current/85 transition hover:bg-white/15 hover:text-current"
        aria-label="Fechar notificação"
        title="Fechar"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
