import { formatDateInput } from "@/lib/date-mask";

export type PlanningEndTone = "alert" | "critical" | "today" | "expired";

export type PlanningEndStatus = {
  daysLeft: number;
  tone: PlanningEndTone;
  label: string;
  progress: number;
  endDate: Date;
};

const dayMonthPattern = /\d{1,2}\/\d{1,2}(?:\/\d{2,4})?/g;

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 12, 0, 0, 0);
}

export function dateFromDayMonth(value?: string | null, referenceDate = new Date()) {
  const normalizedValue = formatDateInput(value || "");

  if (!normalizedValue) return null;

  const [dayText, monthText] = normalizedValue.split("/");
  const day = Number(dayText);
  const month = Number(monthText);

  if (!day || !month) return null;

  const date = new Date(referenceDate.getFullYear(), month - 1, day, 12, 0, 0, 0);

  if (date.getMonth() !== month - 1 || date.getDate() !== day) return null;

  return date;
}

export function extractEndDisplayDate(endDisplayDate?: string | null, periodLabel?: string | null) {
  const directValue = formatDateInput(endDisplayDate || "");

  if (directValue) return directValue;

  const matches = `${periodLabel ?? ""}`.match(dayMonthPattern);

  return matches?.length ? formatDateInput(matches[matches.length - 1]) : "";
}

export function planningEndStatus(
  endDisplayDate?: string | null,
  periodLabel?: string | null,
  referenceDate = new Date(),
): PlanningEndStatus | null {
  const endLabel = extractEndDisplayDate(endDisplayDate, periodLabel);
  const endDate = dateFromDayMonth(endLabel, referenceDate);

  if (!endDate) return null;

  const today = startOfDay(referenceDate);
  const daysLeft = Math.ceil((endDate.getTime() - today.getTime()) / 86_400_000);

  if (daysLeft > 10) return null;

  const tone: PlanningEndTone =
    daysLeft < 0 ? "expired" : daysLeft === 0 ? "today" : daysLeft <= 3 ? "critical" : "alert";
  const label =
    daysLeft < 0
      ? "Vencido"
      : daysLeft === 0
        ? "Acaba hoje"
        : `Faltam ${daysLeft} dia${daysLeft === 1 ? "" : "s"}`;

  return {
    daysLeft,
    tone,
    label,
    progress: Math.max(0, Math.min(100, ((10 - Math.max(daysLeft, 0)) / 10) * 100)),
    endDate,
  };
}
