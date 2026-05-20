import { dateWithDots, formatDateInput, isValidDayMonth } from "@/lib/date-mask";
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

export type VisualPresentationWeekOverride = {
  title?: string;
  startLabel?: string;
  endLabel?: string;
};

export type VisualPresentationDateRange = {
  startLabel: string;
  endLabel: string;
  startDate: Date;
  endDate: Date;
  periodLabel: string;
};

type VisualPresentationWeekNotesPayload = {
  clientNotes: string | null;
  weekOverrides: Record<string, VisualPresentationWeekOverride>;
};

const referenceYear = 2026;
const dayInMs = 24 * 60 * 60 * 1000;
const weekNotesPayloadVersion = 1;

function slugify(value: string) {
  const normalizedValue = value.trim() || "sem-titulo";

  return normalizedValue
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function clientNameForPresentationTitle(clientName: string) {
  return clientName.trim().toUpperCase() || "CLIENTE";
}

export function buildVisualPresentationTitleFromRange(
  clientName: string,
  range?: Pick<VisualPresentationDateRange, "startLabel" | "endLabel"> | null,
) {
  const clientLabel = clientNameForPresentationTitle(clientName);

  if (!range?.startLabel || !range.endLabel) {
    return `AP ${clientLabel}`;
  }

  return `AP ${clientLabel} ${dateWithDots(range.startLabel)}-${dateWithDots(range.endLabel)}`;
}

export function buildVisualPresentationSlugBaseFromRange(
  clientName: string,
  range?: Pick<VisualPresentationDateRange, "startLabel" | "endLabel"> | null,
) {
  return slugify(buildVisualPresentationTitleFromRange(clientName, range));
}

export function visualPresentationPreferredSlug(
  currentSlug: string,
  currentBaseSlug: string,
  nextBaseSlug: string,
) {
  const normalizedCurrentSlug = currentSlug.trim().replace(/-+/g, "-").replace(/^-+|-+$/g, "");
  const normalizedCurrentBase = currentBaseSlug.trim().replace(/-+/g, "-").replace(/^-+|-+$/g, "");
  const normalizedNextBase = nextBaseSlug.trim().replace(/-+/g, "-").replace(/^-+|-+$/g, "");

  if (!normalizedCurrentSlug || !normalizedNextBase) {
    return normalizedNextBase;
  }

  if (normalizedCurrentSlug === normalizedCurrentBase) {
    return normalizedNextBase;
  }

  if (normalizedCurrentBase && normalizedCurrentSlug.startsWith(`${normalizedCurrentBase}-`)) {
    const suffix = normalizedCurrentSlug.slice(normalizedCurrentBase.length + 1);

    if (/^\d+$/.test(suffix)) {
      return `${normalizedNextBase}-${suffix}`;
    }
  }

  return normalizedNextBase;
}

export function visualPresentationWeekNotesFromText(value?: string | null): VisualPresentationWeekNotesPayload {
  if (!value) {
    return {
      clientNotes: null,
      weekOverrides: {},
    };
  }

  try {
    const parsed = JSON.parse(value) as {
      zacxWeekNotesVersion?: number;
      clientNotes?: string | null;
      weekOverrides?: Record<string, VisualPresentationWeekOverride>;
    };

    if (parsed?.zacxWeekNotesVersion === weekNotesPayloadVersion) {
      return {
        clientNotes: parsed.clientNotes || null,
        weekOverrides: parsed.weekOverrides || {},
      };
    }
  } catch {
    return {
      clientNotes: value,
      weekOverrides: {},
    };
  }

  return {
    clientNotes: value,
    weekOverrides: {},
  };
}

export function buildVisualPresentationWeekNotes(
  clientNotes: string | null | undefined,
  weekOverrides: Record<string, VisualPresentationWeekOverride>,
) {
  return JSON.stringify({
    zacxWeekNotesVersion: weekNotesPayloadVersion,
    clientNotes: clientNotes || null,
    weekOverrides,
  });
}

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

function rangeFromWeekOverride(override?: VisualPresentationWeekOverride | null) {
  if (!override) return null;

  const startLabel = formatDateInput(override.startLabel || "");
  const endLabel = formatDateInput(override.endLabel || "");
  const startDate = parseDayMonth(startLabel);
  let endDate = parseDayMonth(endLabel);

  if (!startDate || !endDate) return null;

  if (endDate.getTime() < startDate.getTime()) {
    endDate = parseDayMonth(endLabel, referenceYear + 1);
  }

  if (!endDate) return null;

  return {
    startDate,
    endDate,
    startLabel: formatDayMonth(startDate),
    endLabel: formatDayMonth(endDate),
  };
}

function applyWeekOverride(week: VisualPresentationWeek, override?: VisualPresentationWeekOverride) {
  const overrideRange = rangeFromWeekOverride(override);
  const title = override?.title?.trim().toUpperCase();
  const actionLabel = title || week.actionLabel;

  if (!overrideRange) {
    return {
      ...week,
      label: title || week.label,
      actionLabel,
    };
  }

  return {
    ...week,
    label: title || week.label,
    actionLabel,
    startLabel: overrideRange.startLabel,
    endLabel: overrideRange.endLabel,
    periodLabel: `${overrideRange.startLabel} a ${overrideRange.endLabel}`,
    startDate: overrideRange.startDate,
    endDate: overrideRange.endDate,
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
  const { weekOverrides } = visualPresentationWeekNotesFromText(presentation.client_notes);

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
    ].map((week) => applyWeekOverride(week, weekOverrides[week.id])) satisfies VisualPresentationWeek[];
  }

  const totalDays = Math.max(1, Math.floor((range.endDate.getTime() - range.startDate.getTime()) / dayInMs) + 1);
  const periodKind = visualPresentationPeriodKind(presentation.presentation_type);
  const weekCount =
    periodKind === "semanal" || periodKind === "legacy"
      ? 1
      : periodKind === "quinzenal"
        ? 2
        : Math.max(3, Math.ceil(totalDays / 7));
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

    const id = `week-${index + 1}`;

    weeks.push(applyWeekOverride({
      id,
      index,
      label,
      actionLabel: `AP SEMANA ${index + 1}`,
      startLabel: formatDayMonth(startDate),
      endLabel: formatDayMonth(endDate),
      periodLabel: `${formatDayMonth(startDate)} a ${formatDayMonth(endDate)}`,
      startDate,
      endDate,
    }, weekOverrides[id]));
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

export function visualPresentationDateRangeFromPresentation(
  presentation: VisualPresentation,
): VisualPresentationDateRange | null {
  const range = dateRangeFromPresentation(presentation);

  if (!range) return null;

  const startLabel = formatDayMonth(range.startDate);
  const endLabel = formatDayMonth(range.endDate);

  return {
    startLabel,
    endLabel,
    startDate: range.startDate,
    endDate: range.endDate,
    periodLabel: `${startLabel} a ${endLabel}`,
  };
}

export function getVisualPresentationDateRange(items: VisualItemWithImages[]): VisualPresentationDateRange | null {
  const dates = items.flatMap((item) => {
    const mode = itemMode(item);

    if (mode !== "stories") {
      const date = parseDayMonth(item.display_date);

      return date ? [date] : [];
    }

    const images = [...(item.images ?? [])].sort(
      (left, right) =>
        (left.order_index ?? 0) - (right.order_index ?? 0) ||
        `${left.created_at ?? ""}`.localeCompare(`${right.created_at ?? ""}`),
    );

    const storyDates = images
      .map((image, index) => parseDayMonth(imageDate(item, index, image.id, image.order_index)))
      .filter((date): date is Date => Boolean(date));
    const itemDate = parseDayMonth(item.display_date);

    return storyDates.length ? storyDates : itemDate ? [itemDate] : [];
  });

  if (!dates.length) return null;

  const startDate = dates.reduce((currentStart, date) => minDate(currentStart, date), dates[0]);
  const endDate = dates.reduce((currentEnd, date) => maxDate(currentEnd, date), dates[0]);
  const startLabel = formatDayMonth(startDate);
  const endLabel = formatDayMonth(endDate);

  return {
    startLabel,
    endLabel,
    startDate,
    endDate,
    periodLabel: `${startLabel} a ${endLabel}`,
  };
}

export function applyAutomaticVisualPresentationRange(
  presentation: VisualPresentation,
  items: VisualItemWithImages[],
  clientName = "Cliente",
) {
  const range = getVisualPresentationDateRange(items);

  if (!range) {
    return presentation;
  }

  return {
    ...presentation,
    title: buildVisualPresentationTitleFromRange(clientName, range),
    period_label: range.periodLabel,
    start_display_date: range.startLabel,
    end_display_date: range.endLabel,
  };
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
