import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

import type { WeekStatus } from "@/lib/supabase/types";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDateBR(date?: string | null) {
  if (!date) return "Sem data";

  const normalizedDate = date.includes("T") ? date : `${date}T12:00:00`;
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(normalizedDate));
}

export function formatShortDate(date?: string | null) {
  if (!date) return "";

  const normalizedDate = date.includes("T") ? date : `${date}T12:00:00`;
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "short",
  }).format(new Date(normalizedDate));
}

export function periodLabel(startDate?: string | null, endDate?: string | null) {
  if (!startDate && !endDate) return "Periodo nao definido";
  if (startDate && !endDate) return `A partir de ${formatDateBR(startDate)}`;
  if (!startDate && endDate) return `Ate ${formatDateBR(endDate)}`;

  return `${formatShortDate(startDate)} - ${formatShortDate(endDate)}`;
}

export const statusLabel: Record<WeekStatus, string> = {
  draft: "Rascunho",
  active: "Ativo",
  awaiting_approval: "Aguardando aprovacao",
  approved: "Aprovado",
  changes_requested: "Ajustes solicitados",
};

export const statusTone: Record<WeekStatus, string> = {
  draft: "border-neutral-700 bg-neutral-900 text-neutral-300",
  active: "border-sky-500/30 bg-sky-500/10 text-sky-200",
  awaiting_approval: "border-amber-400/30 bg-amber-400/10 text-amber-200",
  approved: "border-emerald-400/30 bg-emerald-400/10 text-emerald-200",
  changes_requested: "border-rose-400/30 bg-rose-400/10 text-rose-200",
};

export function normalizeStatus(status?: string | null): WeekStatus {
  if (
    status === "draft" ||
    status === "active" ||
    status === "awaiting_approval" ||
    status === "approved" ||
    status === "changes_requested"
  ) {
    return status;
  }

  return "active";
}
