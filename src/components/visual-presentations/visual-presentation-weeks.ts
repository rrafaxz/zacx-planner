import { formatDateInput, isValidDayMonth } from "@/lib/date-mask";
import type { VisualPresentation } from "@/lib/supabase/types";

import { storyImageMetadata } from "./story-image-notes";
import type { VisualItemWithImages } from "./visual-item-board";

export type VisualPresentationWeek = {
  id: string;
  index: number;
  label: string;
  actionLabel: string;
  startLabel: string;
  endLabel: string;
  periodLabel: string;
  startDate: Date | null;
  endDate: Date | null;
};

const referenceYear = 2026;
const dayInMs = 24 * 60 * 60 * 1000;

function atSafeNoon(date: Date) {
  const nextDate = new Date(date);

  nextDate.setHours(12, 0, 0, 0);
  return nextDate;
}

function parseDayMonth(value?: string | null, year = referenceYear) {
  const formattedValue = formatDateInput(value || "");

  if (!isValidDayMonth(formattedValue)) return null;

  const [dayText, monthText] = formattedValue.split("/");
  const date = new Date(year, Number(monthText) - 1, Number(dayText), 12, 0, 0, 0);

  return atSafeNoon(date);
}

function formatDayMonth(date: Date | null) {
  if (!date) return "--/--";

  return `${String(date.getDate()).padStart(2, "0")}/${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function addDays(date: Date, days: number) {
  const nextDate = new Date(date);

  nextDate.setDate(nextDate.getDate() + days);
  return atSafeNoon(nextDate);
}

function minDate(left: Date, right: Date) {
  return left.getTime() <= right.getTime() ? left : right;
}

function maxDate(left: Date, right: Date) {
  return left.getTime() >= right.getTime() ? left : right;
}

function dateRangeFromPresentation(presentation: VisualPresentation) {
  const startLabel =
    formatDateInput(presentation.start_display_date || "") ||
    formatDateInput(presentation.period_label?.match(/\d{1,2}\/\d{1,2}/)?.[0] || "");
  const rangeMatch = presentation.period_label?.match(/(\d{1,2}\/\d{1,2}).*?(\d{1,2}\/\d{1,2})/);
  const endLabel =
    formatDateInput(presentation.end_display_date || "") ||
    formatDateInput(rangeMatch?.[2] || "");
  const startDate = parseDayMonth(startLabel);
  let endDate = parseDayMonth(endLabel);

  if (!startDate || !endDate) return null;

  if (endDate.getTime() < startDate.getTime()) {
    endDate = parseDayMonth(endLabel, referenceYear + 1);
  }

  return {
    startDate,
    endDate: endDate ?? startDate,
  };
}

export function visualPresentationPeriodKind(presentationType?: string | null) {
  const value = `${presentationType ?? ""}`
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

  if (!value) return "legacy";
  if (value.includes("quinzenal") || value.includes("biweekly")) return "quinzenal";
  if (value.includes("mensal") || value.includes("monthly")) return "mensal";
  if (value.includes("semanal") || value.includes("weekly")) return "semanal";

  return "semanal";
}

export function buildVisualPresentationWeeks(presentation: VisualPresentation): VisualPresentationWeek[] {
  const range = dateRangeFromPresentation(presentation);

  if (!range) {
    return [
      {
        id: "week-1",
        index: 0,
        label: "Semana 1",
        actionLabel: "AP SEMANA 1",
        startLabel: "--/--",
        endLabel: "--/--",
        periodLabel: presentation.period_label || "Periodo nao definido",
        startDate: null,
        endDate: null,
      },
    ] satisfies VisualPresentationWeek[];
  }

  const totalDays = Math.max(1, Math.floor((range.endDate.getTime() - range.startDate.getTime()) / dayInMs) + 1);
  const periodKind = visualPresentationPeriodKind(presentation.presentation_type);
  const weekCount =
    periodKind === "semanal" || periodKind === "legacy"
      ? 1
      : periodKind === "quinzenal"
        ? 2
        : Math.min(5, Math.max(4, Math.ceil(totalDays / 7)));
  const effectiveEndDate =
    periodKind === "quinzenal"
      ? maxDate(range.endDate, addDays(range.startDate, 13))
      : periodKind === "mensal"
        ? maxDate(range.endDate, addDays(range.startDate, weekCount * 7 - 1))
        : range.endDate;
  const weeks: VisualPresentationWeek[] = [];

  for (let index = 0; index < weekCount; index += 1) {
    const startDate = addDays(range.startDate, index * 7);

    if (startDate.getTime() > effectiveEndDate.getTime()) break;

    const endDate = minDate(addDays(startDate, 6), effectiveEndDate);
    const label = `Semana ${index + 1}`;

    weeks.push({
      id: `week-${index + 1}`,
      index,
      label,
      actionLabel: `AP SEMANA ${index + 1}`,
      startLabel: formatDayMonth(startDate),
      endLabel: formatDayMonth(endDate),
      periodLabel: `${formatDayMonth(startDate)} a ${formatDayMonth(endDate)}`,
      startDate,
      endDate,
    });
  }

  return weeks.length
    ? weeks
    : buildVisualPresentationWeeks({ ...presentation, presentation_type: "semanal" });
}

export function dateLabelForWeekOffset(week: VisualPresentationWeek | null | undefined, offset = 0) {
  if (!week?.startDate || !week.endDate) return "";

  return formatDayMonth(minDate(addDays(week.startDate, offset), week.endDate));
}

export function isDayMonthInVisualWeek(value: string | null | undefined, week: VisualPresentationWeek | null | undefined) {
  if (!week?.startDate || !week.endDate) return true;

  let candidate = parseDayMonth(value, week.startDate.getFullYear());

  if (!candidate) return false;

  if (candidate.getTime() < week.startDate.getTime() && week.startDate.getFullYear() > referenceYear) {
    candidate = parseDayMonth(value, referenceYear + 1);
  }

  return Boolean(
    candidate &&
      candidate.getTime() >= week.startDate.getTime() &&
      candidate.getTime() <= week.endDate.getTime(),
  );
}

function itemMode(item: VisualItemWithImages) {
  const format = `${item.format ?? ""}`.toLowerCase();

  if (format.includes("stories") || format.includes("story")) return "stories";
  if (format.includes("carousel") || format.includes("carrossel")) return "carousel";

  return "post";
}

function imageDate(item: VisualItemWithImages, imageIndex: number, imageId?: string | null, orderIndex?: number | null) {
  return storyImageMetadata({
    notes: item.notes,
    imageId,
    orderIndex: orderIndex ?? imageIndex,
    fallbackDate: item.display_date,
    fallbackWeekday: item.weekday,
  }).displayDate;
}

export function filterVisualItemsForWeek(
  items: VisualItemWithImages[],
  week: VisualPresentationWeek | null | undefined,
) {
  if (!week) return items;

  return items.flatMap((item) => {
    if (itemMode(item) !== "stories") {
      const isInWeek = isDayMonthInVisualWeek(item.display_date, week);
      const isFallback = !isValidDayMonth(formatDateInput(item.display_date || "")) && week.index === 0;

      return isInWeek || isFallback ? [item] : [];
    }

    const images = [...(item.images ?? [])].sort(
      (left, right) =>
        (left.order_index ?? 0) - (right.order_index ?? 0) ||
        `${left.created_at ?? ""}`.localeCompare(`${right.created_at ?? ""}`),
    );

    if (!images.length) {
      const isInWeek = isDayMonthInVisualWeek(item.display_date, week);
      const isFallback = !isValidDayMonth(formatDateInput(item.display_date || "")) && week.index === 0;

      return isInWeek || isFallback ? [item] : [];
    }

    const datedImages = images.filter((image, index) => {
      const displayDate = imageDate(item, index, image.id, image.order_index);

      return isValidDayMonth(formatDateInput(displayDate || ""));
    });

    if (!datedImages.length) {
      const isInWeek = isDayMonthInVisualWeek(item.display_date, week);
      const isFallback = week.index === 0;

      return isInWeek || isFallback ? [{ ...item, images }] : [];
    }

    const weekImages = images.filter((image, index) =>
      isDayMonthInVisualWeek(imageDate(item, index, image.id, image.order_index), week),
    );

    return weekImages.length ? [{ ...item, images: weekImages }] : [];
  });
}
