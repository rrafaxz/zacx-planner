"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { DragEvent, FormEvent } from "react";
import Link from "next/link";
import {
  Archive,
  ArrowLeft,
  CheckSquare2,
  Clipboard,
  ExternalLink,
  ImageIcon,
  ImagePlus,
  Info,
  Pencil,
  Plus,
  Square,
  Trash2,
  Upload,
  X,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  fullWeekday,
  VisualItemBoard,
  type VisualArtworkImage,
  type VisualItemWithImages,
} from "@/components/visual-presentations/visual-item-board";
import {
  buildStoryImageNotes,
  storyImageMetadata,
} from "@/components/visual-presentations/story-image-notes";
import {
  applyAutomaticVisualPresentationRange,
  buildVisualPresentationSlugBaseFromRange,
  buildVisualPresentationTitleFromRange,
  buildVisualPresentationWeeks,
  buildVisualPresentationWeekNotes,
  dateLabelForWeekOffset,
  filterVisualItemsForWeek,
  getVisualPresentationDateRange,
  visualPresentationDateRangeFromPresentation,
  visualPresentationPreferredSlug,
  visualPresentationWeekNotesFromText,
  type VisualPresentationDateRange,
  type VisualPresentationWeek,
} from "@/components/visual-presentations/visual-presentation-weeks";
import { useTheme } from "@/components/theme/theme-provider";
import { formatDateInput, getDayMonthInputError } from "@/lib/date-mask";
import { optimizeImage } from "@/lib/image-optimizer";
import { supabase } from "@/lib/supabase/client";
import type { Client, VisualItemImage, VisualPresentation } from "@/lib/supabase/types";
import { resolveUniquePublicSlug } from "@/lib/unique-public-slug";
import { cn } from "@/lib/utils";

type VisualPresentationEditorProps = {
  presentationId: string;
};

type VisualFormat = "post" | "carousel" | "stories";

type StoryDraftImage = {
  draftId: string;
  file: File;
  date: string;
  weekday: string;
};

type VisualPublicationForm = {
  format: VisualFormat;
  weekday: string;
  date: string;
  imageFiles: File[];
  storyImages: StoryDraftImage[];
};

type EditImageDraft = {
  draftId: string;
  imageId?: string;
  imageUrl?: string | null;
  imagePath?: string | null;
  file?: File;
  date: string;
  weekday: string;
  orderIndex: number;
};

type EditPublicationForm = {
  itemId: string;
  format: VisualFormat;
  weekday: string;
  date: string;
  imageDrafts: EditImageDraft[];
};

type DragIndexState = {
  fromIndex: number;
  dropIndex: number;
};

type VisualItemDragState = DragIndexState & {
  itemId: string;
};

type EditorMode = "visual" | "edit";
type WeekEditForm = {
  title: string;
  startDate: string;
  endDate: string;
};
type VisualConfirmAction =
  | { kind: "delete-item"; item: VisualItemWithImages }
  | { kind: "delete-selected" }
  | { kind: "archive-presentation" }
  | null;

const weekdays = ["SEG", "TER", "QUA", "QUI", "SEX", "SÁB", "DOM"];
const visualPresentationsBucket = "visual-presentations";
const legacyPresentationAssetsBucket = "presentation-assets";

const publicationTypes: Array<{
  format: VisualFormat;
  label: string;
  description: string;
}> = [
  { format: "post", label: "Post", description: "1 imagem" },
  { format: "carousel", label: "Carrossel", description: "ate 20 imagens" },
  { format: "stories", label: "Stories", description: "ate 14 imagens" },
];

const formatLimits: Record<VisualFormat, number> = {
  post: 1,
  carousel: 20,
  stories: 14,
};

function initialPublicationForm(format: VisualFormat): VisualPublicationForm {
  return {
    format,
    weekday: "SEG",
    date: "",
    imageFiles: [],
    storyImages: [],
  };
}

function newDraftId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function imageFilesFromList(files: FileList | File[] | null | undefined) {
  return Array.from(files ?? []).filter((file) => file.type.startsWith("image/"));
}

function storyDraftsFromFiles(files: File[], week?: VisualPresentationWeek | null, startOffset = 0) {
  return files.map((file, index) => ({
    draftId: newDraftId(),
    file,
    date: dateLabelForWeekOffset(week, startOffset + index),
    weekday: "SEG",
  }));
}

function sortImagesByOrder(images?: VisualItemImage[]) {
  return [...(images ?? [])].sort(
    (left, right) =>
      (left.order_index ?? 0) - (right.order_index ?? 0) ||
      `${left.created_at ?? ""}`.localeCompare(`${right.created_at ?? ""}`),
  );
}

function nextOrderIndex(items: Array<{ order_index: number | null }>) {
  return items.reduce((max, item) => Math.max(max, item.order_index ?? -1), -1) + 1;
}

function safeStorageFileName(fileName: string) {
  const name = fileName.split(/[/\\]/).pop() || "image";
  const safeName = name.replace(/[^a-zA-Z0-9._-]/g, "-");

  return safeName || "image";
}

function visualPresentationStoragePath({
  clientId,
  presentationId,
  itemId,
  fileName,
  index,
}: {
  clientId: string;
  presentationId: string;
  itemId: string;
  fileName: string;
  index: number;
}) {
  return [
    "clients",
    clientId,
    "presentations",
    presentationId,
    itemId,
    `${Date.now()}-${index}-${safeStorageFileName(fileName)}`,
  ].join("/");
}

function publicationLabel(format: VisualFormat) {
  if (format === "carousel") return "Carrossel";
  if (format === "stories") return "Stories";

  return "Post";
}

function visualFormatFromValue(value?: string | null): VisualFormat {
  const format = `${value ?? ""}`.toLowerCase();

  if (format.includes("stories") || format.includes("story")) return "stories";
  if (format.includes("carousel") || format.includes("carrossel")) return "carousel";

  return "post";
}

function normalizeWeekdayValue(value?: string | null) {
  const normalizedValue = `${value ?? ""}`
    .trim()
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

  if (normalizedValue.startsWith("SEG")) return "SEG";
  if (normalizedValue.startsWith("TER")) return "TER";
  if (normalizedValue.startsWith("QUA")) return "QUA";
  if (normalizedValue.startsWith("QUI")) return "QUI";
  if (normalizedValue.startsWith("SEX")) return "SEX";
  if (normalizedValue.startsWith("SAB")) return "SÁB";
  if (normalizedValue.startsWith("DOM")) return "DOM";

  return "SEG";
}

function dateFromDisplayDate(value?: string | null) {
  return formatDateInput(value || "");
}

function parseDayMonthLabel(value?: string | null, year = 2026) {
  const formattedValue = formatDateInput(value || "");

  if (!formattedValue || getDayMonthInputError(formattedValue)) return null;

  const [dayText, monthText] = formattedValue.split("/");
  const date = new Date(year, Number(monthText) - 1, Number(dayText), 12, 0, 0, 0);

  return Number.isNaN(date.getTime()) ? null : date;
}

function formatDayMonthLabel(date: Date) {
  return `${String(date.getDate()).padStart(2, "0")}/${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function addDaysToDate(date: Date, days: number) {
  const nextDate = new Date(date);

  nextDate.setDate(nextDate.getDate() + days);
  nextDate.setHours(12, 0, 0, 0);
  return nextDate;
}

function presentationTypeFromWeekCount(weekCount: number) {
  if (weekCount <= 1) return "semanal";
  if (weekCount === 2) return "quinzenal";

  return "mensal";
}

function reorderCollection<T>(collection: T[], fromIndex: number, toIndex: number) {
  if (fromIndex === toIndex || fromIndex < 0 || toIndex < 0 || fromIndex >= collection.length || toIndex >= collection.length) {
    return collection;
  }

  const reordered = [...collection];
  const [moved] = reordered.splice(fromIndex, 1);

  reordered.splice(toIndex, 0, moved);
  return reordered;
}

function clampIndex(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function dragInsertIndex(
  event: DragEvent<HTMLElement>,
  fromIndex: number,
  targetIndex: number,
  totalItems: number,
) {
  const rect = event.currentTarget.getBoundingClientRect();
  const verticalDistance = Math.abs(event.clientY - (rect.top + rect.height / 2));
  const horizontalDistance = Math.abs(event.clientX - (rect.left + rect.width / 2));
  const useHorizontalAxis = horizontalDistance > verticalDistance && rect.width > rect.height * 0.65;
  const isAfter = useHorizontalAxis
    ? event.clientX > rect.left + rect.width / 2
    : event.clientY > rect.top + rect.height / 2;
  let insertIndex = targetIndex + (isAfter ? 1 : 0);

  if (fromIndex < insertIndex) {
    insertIndex -= 1;
  }

  return clampIndex(insertIndex, 0, Math.max(totalItems - 1, 0));
}

function shouldIgnoreImageDrag(target: EventTarget | null) {
  return target instanceof HTMLElement
    ? Boolean(target.closest("button,input,select,textarea,label,a,[data-no-image-drag='true']"))
    : false;
}

function isNativeUndoTarget(target: EventTarget | null) {
  return target instanceof HTMLElement
    ? Boolean(target.closest("input,textarea,select,[contenteditable='true'],[data-native-undo='true']"))
    : false;
}

function WeekdayControl({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="no-scrollbar flex max-w-full flex-nowrap gap-1.5 overflow-x-auto sm:flex-wrap sm:gap-2">
      {weekdays.map((weekday) => {
        const isActive = value === weekday;

        return (
          <button
            key={weekday}
            type="button"
            onClick={() => onChange(weekday)}
            className={
              isActive
                ? "h-8 min-w-9 rounded-md border border-primary bg-primary px-2 text-[11px] font-semibold text-primary-foreground sm:h-10 sm:min-w-10 sm:rounded-full sm:px-3 sm:text-xs"
                : "h-8 min-w-9 rounded-md border border-border bg-background px-2 text-[11px] font-semibold text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground sm:h-10 sm:min-w-10 sm:rounded-full sm:px-3 sm:text-xs"
            }
          >
            {weekday}
          </button>
        );
      })}
    </div>
  );
}

function AddFormatCard({
  format,
  label,
  description,
  active,
  onFiles,
}: {
  format: VisualFormat;
  label: string;
  description: string;
  active: boolean;
  onFiles: (files: File[]) => void;
}) {
  const inputId = `add-${format}-images`;
  const shapeClass = format === "stories" ? "aspect-[9/16]" : "aspect-[4/5]";

  function handleDrop(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    event.currentTarget.classList.remove("border-foreground/40");
    onFiles(imageFilesFromList(event.dataTransfer.files));
  }

  return (
    <label
      htmlFor={inputId}
      onDragOver={(event) => {
        event.preventDefault();
        event.dataTransfer.dropEffect = "copy";
        event.currentTarget.classList.add("border-foreground/40");
      }}
      onDragLeave={(event) => event.currentTarget.classList.remove("border-foreground/40")}
      onDrop={handleDrop}
      className={cn(
        "group relative flex min-w-[118px] cursor-pointer flex-col justify-center rounded-xl border border-dashed border-border bg-background p-2.5 text-center transition-colors hover:border-foreground/40 hover:bg-foreground/[0.03] md:min-w-0 md:rounded-2xl md:p-3",
        active && "border-foreground/50 bg-foreground/[0.04]",
      )}
    >
      <input
        id={inputId}
        type="file"
        accept="image/*"
        multiple={format !== "post"}
        className="sr-only"
        onChange={(event) => {
          onFiles(imageFilesFromList(event.target.files));
          event.currentTarget.value = "";
        }}
      />
      {format === "carousel" ? (
        <div className={cn("relative mx-auto grid w-full max-w-[96px] place-items-center overflow-visible sm:max-w-[118px]", shapeClass)}>
          <span className="pointer-events-none absolute -left-2 top-[13%] z-0 h-[74%] w-[42%] rounded-xl border border-dashed border-foreground/20 bg-background" />
          <span className="pointer-events-none absolute -right-2 top-[13%] z-0 h-[74%] w-[42%] rounded-xl border border-dashed border-foreground/20 bg-background" />
          <div className="relative z-10 grid h-full w-[82%] place-items-center rounded-xl border border-dashed border-border bg-background transition-colors group-hover:border-foreground/40">
            <div className="grid h-9 w-9 place-items-center rounded-full border border-border bg-background text-foreground transition-colors group-hover:border-foreground/40 sm:h-11 sm:w-11">
              <Plus className="h-4 w-4 sm:h-5 sm:w-5" />
            </div>
          </div>
        </div>
      ) : (
        <div
          className={cn(
            "mx-auto grid w-full max-w-[96px] place-items-center rounded-xl border border-dashed border-border bg-background transition-colors group-hover:border-foreground/40 sm:max-w-[118px]",
            "relative",
            shapeClass,
          )}
        >
          <div className="relative z-10 grid h-9 w-9 place-items-center rounded-full border border-border bg-background text-foreground transition-colors group-hover:border-foreground/40 sm:h-11 sm:w-11">
            <Plus className="h-4 w-4 sm:h-5 sm:w-5" />
          </div>
        </div>
      )}
      <span className="sora-heading mt-2 text-xs font-medium text-foreground sm:mt-3 sm:text-sm">{label}</span>
      <span className="mt-0.5 text-[10px] text-muted-foreground sm:mt-1 sm:text-[11px]">{description}</span>
    </label>
  );
}

function ReplaceableImageFrame({
  inputId,
  previewUrl,
  alt,
  index,
  aspectClass,
  onReplace,
  onRemove,
}: {
  inputId: string;
  previewUrl?: string | null;
  alt: string;
  index: number;
  aspectClass: string;
  onReplace: (files: File[]) => void;
  onRemove: () => void;
}) {
  return (
    <div className={cn("group relative overflow-hidden rounded-lg border border-border bg-background", aspectClass)}>
      <input
        id={inputId}
        type="file"
        accept="image/*"
        className="sr-only"
        data-no-image-drag="true"
        onChange={(event) => {
          onReplace(imageFilesFromList(event.target.files));
          event.currentTarget.value = "";
        }}
      />
      {previewUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={previewUrl}
          alt={alt}
          draggable={false}
          className="h-full w-full object-contain"
        />
      ) : (
        <div className="grid h-full place-items-center text-xs text-muted-foreground">
          Sem imagem
        </div>
      )}
      <span className="pointer-events-none absolute left-2 top-2 z-20 grid h-7 w-7 place-items-center rounded-md bg-black/75 text-xs font-medium text-white">
        {index + 1}
      </span>
      <Button
        type="button"
        variant="ghostSecondary"
        size="icon"
        data-no-image-drag="true"
        className="absolute right-2 top-2 z-20 h-7 w-7 rounded-md bg-black/60 text-white hover:bg-black/75 hover:text-white"
        onClick={onRemove}
        aria-label="Remover imagem"
        title="Remover imagem"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </Button>
      <label
        htmlFor={inputId}
        data-no-image-drag="true"
        className="absolute inset-0 z-10 grid cursor-pointer place-items-center bg-black/20 text-white opacity-100 transition duration-200 md:bg-black/0 md:opacity-0 md:group-hover:bg-black/35 md:group-hover:opacity-100"
        aria-label="Substituir imagem"
        title="Substituir imagem"
      >
        <span className="grid h-10 w-10 place-items-center rounded-full border border-white/30 bg-black/45">
          <ImageIcon className="h-5 w-5" />
        </span>
      </label>
    </div>
  );
}

function textColorForBackground(hexColor?: string | null) {
  const color = hexColor?.replace("#", "");

  if (!color || color.length !== 6) return "#0D0D0F";

  const red = Number.parseInt(color.slice(0, 2), 16);
  const green = Number.parseInt(color.slice(2, 4), 16);
  const blue = Number.parseInt(color.slice(4, 6), 16);
  const luminance = (0.299 * red + 0.587 * green + 0.114 * blue) / 255;

  return luminance > 0.55 ? "#0D0D0F" : "#FFFFFF";
}

function SectionTitleWithTooltip({
  title,
  tooltip,
}: {
  title: string;
  tooltip: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <h2 className="sora-heading text-[15px] font-semibold text-foreground">{title}</h2>
      <span className="group relative inline-grid h-6 w-6 place-items-center">
        <Info className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
        <span className="pointer-events-none absolute left-1/2 top-7 z-[80] hidden w-64 -translate-x-1/2 rounded-md border border-neutral-200 bg-white px-3 py-2 text-left text-[11px] leading-relaxed text-neutral-900 group-hover:block">
          {tooltip}
        </span>
      </span>
    </div>
  );
}

function WeekSelectionGrid({
  weeks,
  selectedWeekId,
  items,
  onSelect,
  onAddWeek,
  onEditWeek,
  onDeleteWeek,
}: {
  weeks: VisualPresentationWeek[];
  selectedWeekId: string | null;
  items: VisualItemWithImages[];
  onSelect: (weekId: string) => void;
  onAddWeek?: () => void;
  onEditWeek?: (week: VisualPresentationWeek) => void;
  onDeleteWeek?: (week: VisualPresentationWeek) => void;
}) {
  return (
    <div className="no-scrollbar flex max-w-full snap-x snap-mandatory gap-2 overflow-x-auto pb-1 sm:grid sm:grid-cols-2 sm:gap-3 sm:overflow-visible sm:pb-0 xl:grid-cols-4">
      {weeks.map((week) => {
        const isSelected = selectedWeekId === week.id;
        const weekItemCount = filterVisualItemsForWeek(items, week).length;

        return (
          <div
            key={week.id}
            className={cn(
              "group relative min-w-[138px] flex-none snap-start rounded-lg border border-dashed bg-background text-left transition-colors hover:border-foreground/40 hover:bg-foreground/[0.02] sm:min-w-0 sm:rounded-xl",
              isSelected
                ? "border-[#1D10D7] bg-neutral-900/[0.045] dark:border-[#DFFF06] dark:bg-[#DFFF06]/[0.07]"
                : "border-border",
            )}
          >
            <button
              type="button"
              onClick={() => onSelect(week.id)}
              className="w-full px-3 py-3.5 pr-11 text-left sm:px-4 sm:py-5 sm:pr-14"
            >
              <span className="sora-heading block text-xs font-semibold uppercase text-foreground sm:text-sm">
                {week.actionLabel}
              </span>
              <span className="mt-1 block text-[11px] text-muted-foreground sm:text-xs">{week.periodLabel}</span>
              <span className="mt-2 inline-flex rounded-md border border-border px-2 py-0.5 text-[10px] text-muted-foreground sm:mt-3 sm:rounded-full sm:px-2.5 sm:py-1 sm:text-[11px]">
                {weekItemCount} {weekItemCount === 1 ? "item" : "itens"}
              </span>
            </button>
            {onEditWeek || (onDeleteWeek && weeks.length > 1) ? (
              <div className="absolute right-1.5 top-1.5 flex items-center gap-0.5 opacity-90 transition-opacity md:right-2 md:top-2 md:gap-1 md:opacity-0 md:group-hover:opacity-100">
                {onEditWeek ? (
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      onEditWeek(week);
                    }}
                    className="grid h-6 w-6 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-foreground/[0.06] hover:text-foreground sm:h-7 sm:w-7"
                    aria-label={`Editar ${week.actionLabel}`}
                    title="Editar semana"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                ) : null}
                {onDeleteWeek && weeks.length > 1 ? (
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      onDeleteWeek(week);
                    }}
                    className="grid h-6 w-6 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-rose-500/10 hover:text-rose-500 sm:h-7 sm:w-7"
                    aria-label={`Excluir ${week.actionLabel}`}
                    title="Excluir semana"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                ) : null}
              </div>
            ) : null}
          </div>
        );
      })}
      {onAddWeek ? (
        <button
          type="button"
          onClick={onAddWeek}
          className="grid min-h-[96px] min-w-[138px] flex-none snap-start place-items-center rounded-lg border border-dashed border-border bg-background px-3 py-3.5 text-muted-foreground transition-colors hover:border-foreground/40 hover:bg-foreground/[0.02] hover:text-foreground sm:min-h-[118px] sm:min-w-0 sm:rounded-xl sm:px-4 sm:py-5"
          aria-label="Adicionar semana"
          title="Adicionar semana"
        >
          <Plus className="h-6 w-6" />
        </button>
      ) : null}
    </div>
  );
}

function VisualPreviewItemSection({
  item,
  client,
  theme,
  primaryColor,
  secondaryColor,
  editable = false,
  onQuickUpdate,
}: {
  item: VisualItemWithImages;
  client: Client | null;
  theme: "dark" | "light";
  primaryColor: string;
  secondaryColor: string;
  editable?: boolean;
  onQuickUpdate?: (
    item: VisualItemWithImages,
    values: { displayDate?: string; weekday?: string; imageId?: string | null; imageIndex?: number },
  ) => Promise<void> | void;
}) {
  const [activeImage, setActiveImage] = useState<VisualArtworkImage | null>(null);
  const format = visualFormatFromValue(item.format);
  const displayDate = format === "stories" ? activeImage?.display_date || item.display_date : item.display_date;
  const weekday = format === "stories" ? activeImage?.weekday || item.weekday : item.weekday;
  const [dateDraft, setDateDraft] = useState(formatDateInput(displayDate || ""));
  const [dateDay, dateMonth] = (displayDate || "--/--").split("/");
  const primaryTextColor = textColorForBackground(primaryColor);
  const secondaryTextColor = textColorForBackground(secondaryColor);
  const sortedImages = sortImagesByOrder(item.images);
  const activeImageIndex = activeImage?.id ? sortedImages.findIndex((image) => image.id === activeImage.id) : 0;

  useEffect(() => {
    setDateDraft(formatDateInput(displayDate || ""));
  }, [displayDate]);

  function saveDateDraft() {
    if (!editable || !onQuickUpdate) return;

    const normalizedDate = formatDateInput(dateDraft);

    if (!normalizedDate) return;

    onQuickUpdate(item, {
      displayDate: normalizedDate,
      imageId: format === "stories" ? activeImage?.id : null,
      imageIndex: format === "stories" ? Math.max(activeImageIndex, 0) : undefined,
    });
  }

  function saveWeekday(nextWeekday: string) {
    if (!editable || !onQuickUpdate) return;

    onQuickUpdate(item, {
      weekday: nextWeekday,
      imageId: format === "stories" ? activeImage?.id : null,
      imageIndex: format === "stories" ? Math.max(activeImageIndex, 0) : undefined,
    });
  }

  return (
    <section className="space-y-3 md:space-y-10">
      <div className="mx-auto grid w-full max-w-xl grid-cols-2 gap-2">
        <div
          className="flex h-10 items-center justify-center rounded-md px-2 text-xs font-medium sm:h-14 sm:rounded-lg sm:px-3 sm:text-sm md:text-base"
          style={{ backgroundColor: primaryColor, color: primaryTextColor }}
        >
          {editable ? (
            <input
              value={dateDraft}
              onChange={(event) => setDateDraft(formatDateInput(event.target.value))}
              onBlur={saveDateDraft}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  event.currentTarget.blur();
                }
              }}
              className="h-8 w-16 rounded-md border border-white/30 bg-transparent px-1.5 text-center text-xs font-medium outline-none sm:h-9 sm:w-20 sm:px-2 sm:text-sm"
              aria-label="Editar data"
            />
          ) : (
            <>
              <span>{dateDay || "--"}</span>
              <span className="opacity-65">/{dateMonth || "--"}</span>
            </>
          )}
        </div>
        <div
          className="flex h-10 items-center justify-center rounded-md px-2 text-center text-[11px] font-medium uppercase sm:h-14 sm:rounded-lg sm:px-3 sm:text-sm md:text-base"
          style={{ backgroundColor: secondaryColor, color: secondaryTextColor }}
        >
          {editable ? (
            <select
              value={normalizeWeekdayValue(weekday)}
              onChange={(event) => saveWeekday(event.target.value)}
              className="h-8 max-w-full rounded-md border border-white/30 bg-transparent px-1.5 text-center text-[11px] font-medium uppercase outline-none sm:h-9 sm:px-2 sm:text-xs"
              aria-label="Editar dia"
            >
              {weekdays.map((weekdayOption) => (
                <option key={weekdayOption} value={weekdayOption}>
                  {fullWeekday(weekdayOption).toUpperCase()}
                </option>
              ))}
            </select>
          ) : (
            fullWeekday(weekday).toUpperCase()
          )}
        </div>
      </div>
      <VisualItemBoard
        items={[item]}
        client={client}
        variant="public"
        theme={theme}
        onActiveImageChange={setActiveImage}
      />
    </section>
  );
}

function mapImagesToItems(items: VisualItemWithImages[], images: VisualItemImage[]) {
  const imagesByItem = new Map<string, VisualItemImage[]>();

  images.forEach((image) => {
    imagesByItem.set(image.visual_item_id, [...(imagesByItem.get(image.visual_item_id) ?? []), image]);
  });

  return items.map((item) => ({
    ...item,
    images: imagesByItem.get(item.id) ?? [],
  }));
}

export function VisualPresentationEditor({ presentationId }: VisualPresentationEditorProps) {
  const [presentation, setPresentation] = useState<VisualPresentation | null>(null);
  const [client, setClient] = useState<Client | null>(null);
  const [items, setItems] = useState<VisualItemWithImages[]>([]);
  const [activeFormat, setActiveFormat] = useState<VisualFormat | null>(null);
  const [form, setForm] = useState<VisualPublicationForm>(initialPublicationForm("post"));
  const [editForm, setEditForm] = useState<EditPublicationForm | null>(null);
  const [origin, setOrigin] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);
  const [deletingItemId, setDeletingItemId] = useState<string | null>(null);
  const [visualItemDrag, setVisualItemDrag] = useState<VisualItemDragState | null>(null);
  const [reorderingItemId, setReorderingItemId] = useState<string | null>(null);
  const [publicationImageDrag, setPublicationImageDrag] = useState<DragIndexState | null>(null);
  const [editImageDrag, setEditImageDrag] = useState<DragIndexState | null>(null);
  const [archiving, setArchiving] = useState(false);
  const [copied, setCopied] = useState(false);
  const [fileInputKey, setFileInputKey] = useState(0);
  const [editFileInputKey, setEditFileInputKey] = useState(0);
  const [editorMode, setEditorMode] = useState<EditorMode>("edit");
  const [selectedWeekId, setSelectedWeekId] = useState<string | null>(null);
  const [itemSelectionMode, setItemSelectionMode] = useState(false);
  const [selectedItemIds, setSelectedItemIds] = useState<string[]>([]);
  const [bulkDeletingItems, setBulkDeletingItems] = useState(false);
  const [weekToDelete, setWeekToDelete] = useState<VisualPresentationWeek | null>(null);
  const [weekToEdit, setWeekToEdit] = useState<VisualPresentationWeek | null>(null);
  const [weekEditForm, setWeekEditForm] = useState<WeekEditForm>({
    title: "",
    startDate: "",
    endDate: "",
  });
  const [savingWeekEdit, setSavingWeekEdit] = useState(false);
  const [deletingWeek, setDeletingWeek] = useState(false);
  const [visualConfirmAction, setVisualConfirmAction] = useState<VisualConfirmAction>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const itemsUndoStackRef = useRef<VisualItemWithImages[][]>([]);
  const isRestoringUndoRef = useRef(false);
  const itemsRef = useRef<VisualItemWithImages[]>([]);
  const visualOrderChangedRef = useRef(false);
  const { theme } = useTheme();

  const surfaceClass = "bg-background text-foreground";
  const nestedSurfaceClass = "border-border bg-background text-foreground";
  const mutedTextClass = "text-muted-foreground";
  const presentationWeeks = useMemo(
    () => (presentation ? buildVisualPresentationWeeks(presentation) : []),
    [presentation],
  );
  const selectedWeek =
    presentationWeeks.find((week) => week.id === selectedWeekId) ?? presentationWeeks[0] ?? null;
  const selectedWeekItems = useMemo(
    () => filterVisualItemsForWeek(items, selectedWeek),
    [items, selectedWeek],
  );
  const selectedImagePreviews = useMemo(
    () =>
      form.imageFiles.map((file) => ({
        id: file.name,
        name: file.name,
        url: URL.createObjectURL(file),
      })),
    [form.imageFiles],
  );
  const selectedStoryPreviews = useMemo(
    () =>
      form.storyImages.map((story) => ({
        id: story.draftId,
        name: story.file.name,
        url: URL.createObjectURL(story.file),
      })),
    [form.storyImages],
  );
  const editImagePreviews = useMemo(() => {
    const previews = new Map<string, string>();

    editForm?.imageDrafts.forEach((draft) => {
      if (draft.file) {
        previews.set(draft.draftId, URL.createObjectURL(draft.file));
      }
    });

    return previews;
  }, [editForm?.imageDrafts]);

  useEffect(() => {
    return () => {
      selectedImagePreviews.forEach((preview) => URL.revokeObjectURL(preview.url));
    };
  }, [selectedImagePreviews]);

  useEffect(() => {
    return () => {
      selectedStoryPreviews.forEach((preview) => URL.revokeObjectURL(preview.url));
    };
  }, [selectedStoryPreviews]);

  useEffect(() => {
    return () => {
      editImagePreviews.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [editImagePreviews]);

  useEffect(() => {
    itemsRef.current = items;
  }, [items]);

  useEffect(() => {
    if (!presentationWeeks.length) return;

    setSelectedWeekId((currentWeekId) =>
      currentWeekId && presentationWeeks.some((week) => week.id === currentWeekId)
        ? currentWeekId
        : presentationWeeks[0].id,
    );
  }, [presentationWeeks]);

  useEffect(() => {
    setItemSelectionMode(false);
    setSelectedItemIds([]);
  }, [selectedWeekId, editorMode]);

  async function syncPresentationAutomaticRangeFor(
    sourcePresentation: VisualPresentation,
    sourceItems: VisualItemWithImages[],
    sourceClient: Client | null = client,
  ) {
    const range = getVisualPresentationDateRange(sourceItems);

    if (!range) {
      return sourcePresentation;
    }

    const clientName = sourceClient?.name || client?.name || "Cliente";
    const currentRange = visualPresentationDateRangeFromPresentation(sourcePresentation);
    const currentBaseSlug = buildVisualPresentationSlugBaseFromRange(clientName, currentRange);
    const nextBaseSlug = buildVisualPresentationSlugBaseFromRange(clientName, range);
    const preferredCandidate = visualPresentationPreferredSlug(
      sourcePresentation.public_slug,
      currentBaseSlug,
      nextBaseSlug,
    );
    const nextTitle = buildVisualPresentationTitleFromRange(clientName, range);
    const nextSlug = await resolveUniquePublicSlug("visual_presentations", nextBaseSlug, {
      excludeId: sourcePresentation.id,
      preferredCandidate,
    });
    const nextPresentation = {
      ...sourcePresentation,
      title: nextTitle,
      public_slug: nextSlug,
      period_label: range.periodLabel,
      start_display_date: range.startLabel,
      end_display_date: range.endLabel,
    };
    const hasChanges =
      sourcePresentation.title !== nextTitle ||
      sourcePresentation.public_slug !== nextSlug ||
      sourcePresentation.period_label !== range.periodLabel ||
      sourcePresentation.start_display_date !== range.startLabel ||
      sourcePresentation.end_display_date !== range.endLabel;

    if (!hasChanges) {
      return nextPresentation;
    }

    const { data, error: updateError } = await supabase
      .from("visual_presentations")
      .update({
        title: nextTitle,
        public_slug: nextSlug,
        period_label: range.periodLabel,
        start_display_date: range.startLabel,
        end_display_date: range.endLabel,
        updated_at: new Date().toISOString(),
      } as never)
      .eq("id", sourcePresentation.id)
      .select("*")
      .maybeSingle();

    if (updateError) {
      setError(updateError.message);
      return nextPresentation;
    }

    return (data as VisualPresentation | null) ?? nextPresentation;
  }

  async function syncPresentationAutomaticRange(nextItems: VisualItemWithImages[], range?: VisualPresentationDateRange | null) {
    if (!presentation) return null;

    const sourceRange = range ?? getVisualPresentationDateRange(nextItems);

    if (!sourceRange) return presentation;

    const syncedPresentation = await syncPresentationAutomaticRangeFor(
      presentation,
      nextItems,
      client,
    );

    setPresentation(syncedPresentation);
    return syncedPresentation;
  }

  async function loadPresentation() {
    setLoading(true);
    setError(null);

    const { data: presentationData, error: presentationError } = await supabase
      .from("visual_presentations")
      .select("*")
      .eq("id", presentationId)
      .maybeSingle();

    if (presentationError || !presentationData) {
      setError(presentationError?.message || "Apresentacao nao encontrada.");
      setPresentation(null);
      setLoading(false);
      return;
    }

    const [clientResult, itemResult] = await Promise.all([
      supabase.from("clients").select("*").eq("id", presentationData.client_id).maybeSingle(),
      supabase
        .from("visual_items")
        .select("*")
        .eq("visual_presentation_id", presentationData.id)
        .order("order_index", { ascending: true })
        .order("created_at", { ascending: true }),
    ]);

    const firstError = clientResult.error || itemResult.error;

    if (firstError) {
      setError(firstError.message);
      setLoading(false);
      return;
    }

    const itemData = (itemResult.data ?? []) as VisualItemWithImages[];
    let itemImages: VisualItemImage[] = [];

    if (itemData.length) {
      const { data: imageData, error: imageError } = await supabase
        .from("visual_item_images")
        .select("*")
        .in(
          "visual_item_id",
          itemData.map((item) => item.id),
        )
        .order("order_index", { ascending: true })
        .order("created_at", { ascending: true });

      if (imageError) {
        setError(imageError.message);
        setLoading(false);
        return;
      }

      itemImages = imageData ?? [];
    }

    const mappedItems = mapImagesToItems(itemData, itemImages);
    const syncedPresentation = await syncPresentationAutomaticRangeFor(
      presentationData,
      mappedItems,
      clientResult.data,
    );

    setPresentation(applyAutomaticVisualPresentationRange(
      syncedPresentation,
      mappedItems,
      clientResult.data?.name || "Cliente",
    ));
    setClient(clientResult.data);
    setItems(mappedItems);
    setLoading(false);
  }

  useEffect(() => {
    setOrigin(window.location.origin);
    itemsUndoStackRef.current = [];
    loadPresentation();
  }, [presentationId]);

  function cloneItemsSnapshot(sourceItems: VisualItemWithImages[]) {
    return sourceItems.map((item) => ({
      ...item,
      images: item.images?.map((image) => ({ ...image })) ?? [],
    }));
  }

  function pushItemsUndoSnapshot(sourceItems = items) {
    itemsUndoStackRef.current = [
      ...itemsUndoStackRef.current.slice(-19),
      cloneItemsSnapshot(sourceItems),
    ];
  }

  async function restoreItemsSnapshot(snapshot: VisualItemWithImages[]) {
    if (isRestoringUndoRef.current) return;

    isRestoringUndoRef.current = true;
    setError(null);
    setNotice(null);
    setItems(cloneItemsSnapshot(snapshot));
    setVisualItemDrag(null);

    const results = await Promise.all(
      snapshot.map((item) =>
        supabase
          .from("visual_items")
          .update({
            order_index: item.order_index,
            display_date: item.display_date,
            weekday: item.weekday,
            notes: item.notes,
          })
          .eq("id", item.id),
      ),
    );
    const firstError = results.find((result) => result.error)?.error;

    if (firstError) {
      setError(firstError.message);
    } else {
      await syncPresentationAutomaticRange(snapshot);
      setNotice("Ultima alteracao desfeita.");
    }

    isRestoringUndoRef.current = false;
  }

  function undoLastVisualChange() {
    const previousSnapshot = itemsUndoStackRef.current.pop();

    if (!previousSnapshot) return false;

    void restoreItemsSnapshot(previousSnapshot);
    return true;
  }

  useEffect(() => {
    function handleUndoShortcut(event: KeyboardEvent) {
      const isUndo = (event.metaKey || event.ctrlKey) && !event.shiftKey && event.key.toLowerCase() === "z";

      if (!isUndo || isNativeUndoTarget(event.target)) return;

      if (undoLastVisualChange()) {
        event.preventDefault();
      }
    }

    window.addEventListener("keydown", handleUndoShortcut);

    return () => window.removeEventListener("keydown", handleUndoShortcut);
    // restoreItemsSnapshot reads only stable refs/setters here; keep one listener per page mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function limitedFilesForFormat(format: VisualFormat, files: File[], currentCount = 0) {
    const limit = formatLimits[format];
    const availableSlots = Math.max(limit - currentCount, 0);

    if (!files.length) {
      setError("Selecione pelo menos uma imagem valida.");
      return [];
    }

    if (availableSlots <= 0) {
      setError(`${publicationLabel(format)} ja atingiu o limite de ${limit} imagem${limit > 1 ? "s" : ""}.`);
      return [];
    }

    if (files.length > availableSlots) {
      setError(`${publicationLabel(format)} aceita no maximo ${limit} imagem${limit > 1 ? "s" : ""}.`);
    } else {
      setError(null);
    }

    return files.slice(0, availableSlots);
  }

  function selectedWeekDateError(date: string, label = "Essa data") {
    void date;
    void label;

    return "";
  }

  function validateFormDatesForSelectedWeek() {
    return selectedWeekDateError(form.date);
  }

  function validateEditDatesForSelectedWeek() {
    if (!editForm) return "";

    return selectedWeekDateError(editForm.date);
  }

  function openForm(format: VisualFormat, files: File[] = []) {
    setError(null);
    const nextForm = {
      ...initialPublicationForm(format),
      date: dateLabelForWeekOffset(selectedWeek),
    };
    const acceptedFiles = files.length ? limitedFilesForFormat(format, files) : [];

    if (acceptedFiles.length) {
      if (format === "stories") {
        nextForm.storyImages = storyDraftsFromFiles(acceptedFiles, selectedWeek);
      } else {
        nextForm.imageFiles = acceptedFiles;
      }
    }

    setActiveFormat(format);
    setForm(nextForm);
    setEditForm(null);
    setFileInputKey((current) => current + 1);
    setNotice(null);
  }

  function handleCreationCardFiles(format: VisualFormat, rawFiles: File[]) {
    const files = imageFilesFromList(rawFiles);

    if (!files.length) {
      setError("Envie arquivos de imagem validos.");
      return;
    }

    openForm(format, files);
  }

  function openEditForm(item: VisualItemWithImages) {
    const format = visualFormatFromValue(item.format);
    const sortedImages = sortImagesByOrder(item.images);
    const editableImages =
      sortedImages.length || !item.image_url
        ? sortedImages
        : [
            {
              id: item.id,
              visual_item_id: item.id,
              image_url: item.image_url,
              image_path: item.image_path,
              order_index: 0,
              created_at: item.created_at,
            },
          ];
    const imageDrafts: EditImageDraft[] = editableImages.map((image, index) => {
      const metadata =
        format === "stories"
          ? storyImageMetadata({
              notes: item.notes,
              imageId: image.id,
              orderIndex: image.order_index ?? index,
              fallbackDate: item.display_date,
              fallbackWeekday: item.weekday,
            })
          : {
              displayDate: item.display_date,
              weekday: item.weekday,
            };

      return {
        draftId: image.id,
        imageId: sortedImages.length ? image.id : undefined,
        imageUrl: image.image_url,
        imagePath: image.image_path,
        date: dateFromDisplayDate(metadata.displayDate),
        weekday: metadata.weekday || "SEG",
        orderIndex: index,
      };
    });

    setEditForm({
      itemId: item.id,
      format,
      weekday: item.weekday || "SEG",
      date: dateFromDisplayDate(item.display_date),
      imageDrafts,
    });
    setActiveFormat(null);
    setError(null);
    setNotice(null);
  }

  async function cleanupFailedPublication(itemId: string, imagePaths: string[]) {
    await supabase.from("visual_items").delete().eq("id", itemId);

    if (imagePaths.length) {
      await supabase.storage.from(visualPresentationsBucket).remove(imagePaths);
    }
  }

  async function handleAddPublication(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!presentation || !activeFormat) return;

    const filesToUpload =
      form.format === "stories" ? form.storyImages.map((story) => story.file) : form.imageFiles;
    const itemWeekday = form.format === "stories" ? form.storyImages[0]?.weekday : form.weekday;
    const itemDate = form.format === "stories" ? form.storyImages[0]?.date : form.date;

    if (!filesToUpload.length) {
      setError("Selecione pelo menos uma imagem.");
      return;
    }

    if (filesToUpload.length > formatLimits[form.format]) {
      setError(`${publicationLabel(form.format)} aceita no maximo ${formatLimits[form.format]} imagens.`);
      return;
    }

    if (form.format === "post" && filesToUpload.length !== 1) {
      setError("Post aceita apenas uma imagem.");
      return;
    }

    if (form.format === "stories") {
      const incompleteStoryIndex = form.storyImages.findIndex(
        (story) => !story.weekday || getDayMonthInputError(story.date),
      );

      if (incompleteStoryIndex >= 0) {
        setError(`Preencha data e dia do Story ${incompleteStoryIndex + 1}.`);
        return;
      }
    } else {
      if (!form.weekday) {
        setError("Selecione um dia da semana antes de salvar.");
        return;
      }

      const dateError = getDayMonthInputError(form.date);

      if (dateError) {
        setError(dateError);
        return;
      }
    }

    const weekDateError = validateFormDatesForSelectedWeek();

    if (weekDateError) {
      setError(weekDateError);
      return;
    }

    setSaving(true);
    setError(null);
    setNotice(null);

    const { data: itemData, error: itemError } = await supabase
      .from("visual_items")
      .insert({
        visual_presentation_id: presentation.id,
        format: form.format,
        label: null,
        weekday: itemWeekday,
        display_date: itemDate,
        order_index: nextOrderIndex(items),
        notes: null,
        is_visible: true,
      })
      .select("*")
      .single();

    if (itemError || !itemData) {
      setError(itemError?.message || "Nao foi possivel criar a publicacao.");
      setSaving(false);
      return;
    }

    const uploadedRows: Array<{
      visual_item_id: string;
      image_url: string;
      image_path: string;
      order_index: number;
    }> = [];
    const uploadedPaths: string[] = [];

    for (let index = 0; index < filesToUpload.length; index += 1) {
      const file = filesToUpload[index];
      const optimizedFile = await optimizeImage(file, form.format);
      const imagePath = visualPresentationStoragePath({
        clientId: presentation.client_id,
        presentationId: presentation.id,
        itemId: itemData.id,
        fileName: optimizedFile.name,
        index,
      });

      const { error: uploadError } = await supabase.storage
        .from(visualPresentationsBucket)
        .upload(imagePath, optimizedFile, {
          contentType: optimizedFile.type || undefined,
          upsert: false,
        });

      if (uploadError) {
        await cleanupFailedPublication(itemData.id, uploadedPaths);
        setError(uploadError.message);
        setSaving(false);
        return;
      }

      uploadedPaths.push(imagePath);

      const {
        data: { publicUrl },
      } = supabase.storage.from(visualPresentationsBucket).getPublicUrl(imagePath);

      if (!publicUrl) {
        await cleanupFailedPublication(itemData.id, uploadedPaths);
        setError("Nao foi possivel gerar a URL publica da imagem.");
        setSaving(false);
        return;
      }

      uploadedRows.push({
        visual_item_id: itemData.id,
        image_url: publicUrl,
        image_path: imagePath,
        order_index: index,
      });
    }

    const { data: insertedImageRows, error: imageInsertError } = await supabase
      .from("visual_item_images")
      .insert(uploadedRows)
      .select("*");

    if (imageInsertError) {
      await cleanupFailedPublication(itemData.id, uploadedPaths);
      setError(imageInsertError.message);
      setSaving(false);
      return;
    }

    const sortedInsertedImages = sortImagesByOrder((insertedImageRows ?? []) as VisualItemImage[]);
    const imagesForNotes = sortedInsertedImages.length ? sortedInsertedImages : uploadedRows;
    const firstUploadedImage = sortedInsertedImages[0] ?? uploadedRows[0];

    if (firstUploadedImage) {
      const updatePayload: {
        image_url: string | null;
        image_path: string | null;
        notes?: string | null;
      } = {
        image_url: firstUploadedImage.image_url,
        image_path: firstUploadedImage.image_path,
      };

      if (form.format === "stories") {
        updatePayload.notes = buildStoryImageNotes(imagesForNotes, form.storyImages);
      }

      await supabase.from("visual_items").update(updatePayload).eq("id", itemData.id);
    }

    setForm(initialPublicationForm(form.format));
    setFileInputKey((current) => current + 1);
    await loadPresentation();
    setNotice(`${publicationLabel(form.format)} adicionado.`);
    setActiveFormat(null);
    setSaving(false);
  }

  async function handleSaveEdit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!editForm || !presentation) return;

    if (!editForm.imageDrafts.length) {
      setError("Mantenha pelo menos uma imagem no item.");
      return;
    }

    if (editForm.imageDrafts.length > formatLimits[editForm.format]) {
      setError(`${publicationLabel(editForm.format)} aceita no maximo ${formatLimits[editForm.format]} imagens.`);
      return;
    }

    if (editForm.format === "stories") {
      const invalidStoryIndex = editForm.imageDrafts.findIndex(
        (draft) => !draft.weekday || getDayMonthInputError(draft.date),
      );

      if (invalidStoryIndex >= 0) {
        setError(`Preencha data e dia do Story ${invalidStoryIndex + 1}.`);
        return;
      }
    } else {
      if (!editForm.weekday) {
        setError("Selecione um dia da semana para salvar a edicao.");
        return;
      }

      const dateError = getDayMonthInputError(editForm.date);

      if (dateError) {
        setError(dateError);
        return;
      }
    }

    const weekDateError = validateEditDatesForSelectedWeek();

    if (weekDateError) {
      setError(weekDateError);
      return;
    }

    setSavingEdit(true);
    setError(null);
    setNotice(null);

    const currentItem = items.find((item) => item.id === editForm.itemId);
    const originalImages = sortImagesByOrder(currentItem?.images);
    const keptImageIds = new Set(editForm.imageDrafts.map((draft) => draft.imageId).filter(Boolean));
    const imagesToDelete = originalImages.filter((image) => !keptImageIds.has(image.id));
    const uploadedPaths: string[] = [];
    const pathsToRemove = imagesToDelete.map((image) => image.image_path).filter(Boolean) as string[];

    for (let index = 0; index < editForm.imageDrafts.length; index += 1) {
      const draft = editForm.imageDrafts[index];

      if (draft.file) {
        const optimizedFile = await optimizeImage(draft.file, editForm.format);
        const imagePath = visualPresentationStoragePath({
          clientId: presentation.client_id,
          presentationId: presentation.id,
          itemId: editForm.itemId,
          fileName: optimizedFile.name,
          index,
        });

        const { error: uploadError } = await supabase.storage
          .from(visualPresentationsBucket)
          .upload(imagePath, optimizedFile, {
            contentType: optimizedFile.type || undefined,
            upsert: false,
          });

        if (uploadError) {
          if (uploadedPaths.length) {
            await supabase.storage.from(visualPresentationsBucket).remove(uploadedPaths);
          }
          setError(uploadError.message);
          setSavingEdit(false);
          return;
        }

        uploadedPaths.push(imagePath);

        const {
          data: { publicUrl },
        } = supabase.storage.from(visualPresentationsBucket).getPublicUrl(imagePath);

        if (!publicUrl) {
          await supabase.storage.from(visualPresentationsBucket).remove(uploadedPaths);
          setError("Nao foi possivel gerar a URL publica da imagem.");
          setSavingEdit(false);
          return;
        }

        if (draft.imageId) {
          const originalImage = originalImages.find((image) => image.id === draft.imageId);
          const { error: imageUpdateError } = await supabase
            .from("visual_item_images")
            .update({
              image_url: publicUrl,
              image_path: imagePath,
              order_index: index,
            })
            .eq("id", draft.imageId);

          if (imageUpdateError) {
            await supabase.storage.from(visualPresentationsBucket).remove(uploadedPaths);
            setError(imageUpdateError.message);
            setSavingEdit(false);
            return;
          }

          if (originalImage?.image_path) {
            pathsToRemove.push(originalImage.image_path);
          }
        } else {
          const { error: imageInsertError } = await supabase.from("visual_item_images").insert({
            visual_item_id: editForm.itemId,
            image_url: publicUrl,
            image_path: imagePath,
            order_index: index,
          });

          if (imageInsertError) {
            await supabase.storage.from(visualPresentationsBucket).remove(uploadedPaths);
            setError(imageInsertError.message);
            setSavingEdit(false);
            return;
          }
        }
      } else if (draft.imageId) {
        const { error: imageOrderError } = await supabase
          .from("visual_item_images")
          .update({
            order_index: index,
          })
          .eq("id", draft.imageId);

        if (imageOrderError) {
          setError(imageOrderError.message);
          setSavingEdit(false);
          return;
        }
      } else if (draft.imageUrl) {
        const { error: legacyImageInsertError } = await supabase.from("visual_item_images").insert({
          visual_item_id: editForm.itemId,
          image_url: draft.imageUrl,
          image_path: draft.imagePath ?? null,
          order_index: index,
        });

        if (legacyImageInsertError) {
          setError(legacyImageInsertError.message);
          setSavingEdit(false);
          return;
        }
      }
    }

    if (imagesToDelete.length) {
      const { error: deleteImagesError } = await supabase
        .from("visual_item_images")
        .delete()
        .in(
          "id",
          imagesToDelete.map((image) => image.id),
        );

      if (deleteImagesError) {
        setError(deleteImagesError.message);
        setSavingEdit(false);
        return;
      }
    }

    const { data: currentImages, error: currentImagesError } = await supabase
      .from("visual_item_images")
      .select("*")
      .eq("visual_item_id", editForm.itemId)
      .order("order_index", { ascending: true })
      .order("created_at", { ascending: true });

    if (currentImagesError) {
      setError(currentImagesError.message);
      setSavingEdit(false);
      return;
    }

    const finalImages = sortImagesByOrder((currentImages ?? []) as VisualItemImage[]);
    const firstImage = finalImages[0];
    const itemWeekday =
      editForm.format === "stories" ? editForm.imageDrafts[0]?.weekday || editForm.weekday : editForm.weekday;
    const itemDate =
      editForm.format === "stories" ? editForm.imageDrafts[0]?.date || editForm.date : editForm.date;
    const notes =
      editForm.format === "stories"
        ? buildStoryImageNotes(
            finalImages,
            editForm.imageDrafts.map((draft) => ({
              displayDate: draft.date,
              weekday: draft.weekday,
            })),
          )
        : currentItem?.notes ?? null;

    const { error: updateError } = await supabase
      .from("visual_items")
      .update({
        format: editForm.format,
        weekday: itemWeekday,
        display_date: itemDate,
        image_url: firstImage?.image_url ?? null,
        image_path: firstImage?.image_path ?? null,
        notes,
      })
      .eq("id", editForm.itemId);

    if (updateError) {
      setError(updateError.message);
    } else {
      if (pathsToRemove.length) {
        await Promise.all([
          supabase.storage.from(visualPresentationsBucket).remove(pathsToRemove),
          supabase.storage.from(legacyPresentationAssetsBucket).remove(pathsToRemove),
        ]);
      }
      setEditForm(null);
      await loadPresentation();
      setNotice("Publicacao atualizada.");
    }

    setSavingEdit(false);
  }

  async function deleteItem(item: VisualItemWithImages) {
    setDeletingItemId(item.id);
    setError(null);
    setNotice(null);

    const storagePaths = [
      ...(item.images ?? []).map((image) => image.image_path).filter(Boolean),
      item.image_path,
    ].filter(Boolean) as string[];

    await supabase.from("visual_item_images").delete().eq("visual_item_id", item.id);

    const { error: deleteError } = await supabase.from("visual_items").delete().eq("id", item.id);

    if (deleteError) {
      setError(deleteError.message);
      setDeletingItemId(null);
      return;
    }

    if (storagePaths.length) {
      await Promise.all([
        supabase.storage.from(visualPresentationsBucket).remove(storagePaths),
        supabase.storage.from(legacyPresentationAssetsBucket).remove(storagePaths),
      ]);
    }

    await loadPresentation();
    setNotice("Publicacao excluida.");
    setDeletingItemId(null);
  }

  function toggleSelectedItem(id: string) {
    setSelectedItemIds((current) =>
      current.includes(id)
        ? current.filter((selectedId) => selectedId !== id)
        : [...current, id],
    );
  }

  async function deleteSelectedItems() {
    if (!selectedItemIds.length) return;

    const selectedItems = items.filter((item) => selectedItemIds.includes(item.id));
    const storagePaths = selectedItems
      .flatMap((item) => [
        ...(item.images ?? []).map((image) => image.image_path),
        item.image_path,
      ])
      .filter(Boolean) as string[];

    setBulkDeletingItems(true);
    setError(null);
    setNotice(null);

    const { error: deleteImagesError } = await supabase
      .from("visual_item_images")
      .delete()
      .in("visual_item_id", selectedItemIds);

    if (deleteImagesError) {
      setError(deleteImagesError.message);
      setBulkDeletingItems(false);
      return;
    }

    const { error: deleteItemsError } = await supabase
      .from("visual_items")
      .delete()
      .in("id", selectedItemIds);

    if (deleteItemsError) {
      setError(deleteItemsError.message);
      setBulkDeletingItems(false);
      return;
    }

    if (storagePaths.length) {
      await Promise.all([
        supabase.storage.from(visualPresentationsBucket).remove(storagePaths),
        supabase.storage.from(legacyPresentationAssetsBucket).remove(storagePaths),
      ]);
    }

    setItemSelectionMode(false);
    setSelectedItemIds([]);
    await loadPresentation();
    setNotice("Publicacoes excluidas.");
    setBulkDeletingItems(false);
  }

  async function updatePresentationWeekCount(nextWeekCount: number) {
    if (!presentation) return false;

    const firstWeek = presentationWeeks[0];
    const startDate =
      firstWeek?.startDate ||
      parseDayMonthLabel(presentation.start_display_date || presentation.period_label?.match(/\d{1,2}\/\d{1,2}/)?.[0] || "");

    if (!startDate) {
      setError("Nao foi possivel calcular o periodo da apresentacao.");
      return false;
    }

    const startLabel = formatDayMonthLabel(startDate);
    const endLabel = formatDayMonthLabel(addDaysToDate(startDate, Math.max(1, nextWeekCount) * 7 - 1));
    const presentationType = presentationTypeFromWeekCount(nextWeekCount);

    const { data, error: updateError } = await supabase
      .from("visual_presentations")
      .update({
        start_display_date: startLabel,
        end_display_date: endLabel,
        period_label: `${startLabel} a ${endLabel}`,
        presentation_type: presentationType,
        updated_at: new Date().toISOString(),
      } as never)
      .eq("id", presentation.id)
      .select("*")
      .maybeSingle();

    if (updateError) {
      setError(updateError.message);
      return false;
    }

    setPresentation((data as VisualPresentation | null) ?? {
      ...presentation,
      start_display_date: startLabel,
      end_display_date: endLabel,
      period_label: `${startLabel} a ${endLabel}`,
      presentation_type: presentationType,
    });
    return true;
  }

  async function addPresentationWeek() {
    setError(null);
    setNotice(null);

    const nextWeekCount = Math.max(1, presentationWeeks.length) + 1;
    const updated = await updatePresentationWeekCount(nextWeekCount);

    if (updated) {
      setSelectedWeekId(`week-${nextWeekCount}`);
      setNotice("Semana adicionada.");
    }
  }

  function openWeekEditModal(week: VisualPresentationWeek) {
    setSelectedWeekId(week.id);
    setWeekToEdit(week);
    setWeekEditForm({
      title: week.actionLabel,
      startDate: formatDateInput(week.startLabel),
      endDate: formatDateInput(week.endLabel),
    });
    setError(null);
    setNotice(null);
  }

  async function saveWeekEdit() {
    if (!presentation || !weekToEdit) return;

    const startDate = formatDateInput(weekEditForm.startDate);
    const endDate = formatDateInput(weekEditForm.endDate);
    const startDateError = getDayMonthInputError(startDate);
    const endDateError = getDayMonthInputError(endDate);

    if (startDateError) {
      setError(`Data inicial: ${startDateError}`);
      return;
    }

    if (endDateError) {
      setError(`Data final: ${endDateError}`);
      return;
    }

    setSavingWeekEdit(true);
    setError(null);
    setNotice(null);

    const currentNotes = visualPresentationWeekNotesFromText(presentation.client_notes);
    const nextWeekOverrides = {
      ...currentNotes.weekOverrides,
      [weekToEdit.id]: {
        title: weekEditForm.title.trim() || weekToEdit.actionLabel,
        startLabel: startDate,
        endLabel: endDate,
      },
    };

    const { data, error: requestError } = await supabase
      .from("visual_presentations")
      .update({
        client_notes: buildVisualPresentationWeekNotes(currentNotes.clientNotes, nextWeekOverrides),
        updated_at: new Date().toISOString(),
      } as never)
      .eq("id", presentation.id)
      .select("*")
      .maybeSingle();

    if (requestError) {
      setError(requestError.message);
    } else {
      setPresentation((data as VisualPresentation | null) ?? {
        ...presentation,
        client_notes: buildVisualPresentationWeekNotes(currentNotes.clientNotes, nextWeekOverrides),
      });
      setWeekToEdit(null);
      setNotice("Semana atualizada.");
    }

    setSavingWeekEdit(false);
  }

  async function deleteItemsForWeek(week: VisualPresentationWeek) {
    const weekItems = filterVisualItemsForWeek(items, week, { filterStoryImages: true });
    const itemIdsToDelete: string[] = [];
    const imageIdsToDelete: string[] = [];
    const storagePaths: string[] = [];
    const itemUpdates: Array<{
      itemId: string;
      notes: string | null;
      displayDate: string | null;
      weekday: string | null;
    }> = [];

    weekItems.forEach((weekItem) => {
      const fullItem = items.find((item) => item.id === weekItem.id) ?? weekItem;
      const sortedImages = sortImagesByOrder(fullItem.images);
      const weekImages = sortImagesByOrder(weekItem.images);
      const isPartialStory =
        visualFormatFromValue(fullItem.format) === "stories" &&
        sortedImages.length > 0 &&
        weekImages.length > 0 &&
        weekImages.length < sortedImages.length;

      if (!isPartialStory) {
        itemIdsToDelete.push(fullItem.id);
        storagePaths.push(
          ...sortedImages.flatMap((image) => (image.image_path ? [image.image_path] : [])),
          ...(fullItem.image_path ? [fullItem.image_path] : []),
        );
        return;
      }

      const removedImageIds = new Set(weekImages.map((image) => image.id));
      const remainingImages = sortedImages.filter((image) => !removedImageIds.has(image.id));
      const metadata = remainingImages.map((image, index) =>
        storyImageMetadata({
          notes: fullItem.notes,
          imageId: image.id,
          orderIndex: image.order_index ?? index,
          fallbackDate: fullItem.display_date,
          fallbackWeekday: fullItem.weekday,
        }),
      );
      const firstMetadata = metadata[0];

      imageIdsToDelete.push(...weekImages.map((image) => image.id));
      storagePaths.push(...weekImages.flatMap((image) => (image.image_path ? [image.image_path] : [])));
      itemUpdates.push({
        itemId: fullItem.id,
        notes: buildStoryImageNotes(remainingImages, metadata),
        displayDate: firstMetadata?.displayDate ?? fullItem.display_date,
        weekday: firstMetadata?.weekday ?? fullItem.weekday,
      });
    });

    if (imageIdsToDelete.length) {
      const { error: imageDeleteError } = await supabase
        .from("visual_item_images")
        .delete()
        .in("id", imageIdsToDelete);

      if (imageDeleteError) throw new Error(imageDeleteError.message);
    }

    if (itemIdsToDelete.length) {
      const { error: imageRowsDeleteError } = await supabase
        .from("visual_item_images")
        .delete()
        .in("visual_item_id", itemIdsToDelete);

      if (imageRowsDeleteError) throw new Error(imageRowsDeleteError.message);

      const { error: itemDeleteError } = await supabase
        .from("visual_items")
        .delete()
        .in("id", itemIdsToDelete);

      if (itemDeleteError) throw new Error(itemDeleteError.message);
    }

    for (const update of itemUpdates) {
      const { error: itemUpdateError } = await supabase
        .from("visual_items")
        .update({
          notes: update.notes,
          display_date: update.displayDate,
          weekday: update.weekday,
        })
        .eq("id", update.itemId);

      if (itemUpdateError) throw new Error(itemUpdateError.message);
    }

    if (storagePaths.length) {
      await Promise.all([
        supabase.storage.from(visualPresentationsBucket).remove(storagePaths),
        supabase.storage.from(legacyPresentationAssetsBucket).remove(storagePaths),
      ]);
    }
  }

  async function deletePresentationWeek(week: VisualPresentationWeek) {
    if (!presentation || presentationWeeks.length <= 1) return;

    setError(null);
    setNotice(null);
    setDeletingWeek(true);

    try {
      await deleteItemsForWeek(week);
      const nextWeekCount = Math.max(1, presentationWeeks.length - 1);
      const updated = await updatePresentationWeekCount(nextWeekCount);

      if (updated) {
        setSelectedWeekId(`week-${Math.min(week.index + 1, nextWeekCount)}`);
        await loadPresentation();
        setNotice("Semana excluida.");
        setWeekToDelete(null);
      }
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Nao foi possivel excluir a semana.");
    } finally {
      setDeletingWeek(false);
    }
  }

  async function archivePresentation() {
    if (!presentation) return;

    setArchiving(true);
    setError(null);
    setNotice(null);

    const { error: requestError } = await supabase
      .from("visual_presentations")
      .update({
        archived_at: new Date().toISOString(),
      })
      .eq("id", presentation.id);

    if (requestError) {
      setError(requestError.message);
    } else {
      await loadPresentation();
      setNotice("Apresentacao arquivada.");
    }

    setArchiving(false);
  }

  async function confirmVisualAction() {
    if (!visualConfirmAction) return;

    const action = visualConfirmAction;

    if (action.kind === "delete-item") await deleteItem(action.item);
    if (action.kind === "delete-selected") await deleteSelectedItems();
    if (action.kind === "archive-presentation") await archivePresentation();

    setVisualConfirmAction(null);
  }

  const visualConfirmConfig = visualConfirmAction
    ? {
        title:
          visualConfirmAction.kind === "archive-presentation"
            ? "Arquivar apresentação"
            : "Excluir publicação",
        message:
          visualConfirmAction.kind === "archive-presentation"
            ? "Você tem certeza que quer arquivar este item? Ele sairá da lista principal e ficará disponível em Arquivados."
            : "Você tem certeza que quer excluir este item? Essa ação não poderá ser desfeita.",
        confirmLabel: visualConfirmAction.kind === "archive-presentation" ? "Arquivar" : "Excluir",
      }
    : null;

  async function copyPublicLink() {
    if (!presentation) return;

    await navigator.clipboard.writeText(`${origin}/a/${presentation.public_slug}`);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }

  async function handleQuickUpdate(
    item: VisualItemWithImages,
    values: {
      displayDate?: string;
      weekday?: string;
      imageId?: string | null;
      imageIndex?: number;
    },
  ) {
    const format = visualFormatFromValue(item.format);
    const nextDate = values.displayDate ? formatDateInput(values.displayDate) : undefined;
    const nextWeekday = values.weekday ? normalizeWeekdayValue(values.weekday) : undefined;

    if (nextDate) {
      const dateError = getDayMonthInputError(nextDate);

      if (dateError) {
        setError(dateError);
        return;
      }

      const weekDateError = selectedWeekDateError(nextDate);

      if (weekDateError) {
        setError(weekDateError);
        return;
      }
    }

    setError(null);
    setNotice(null);
    pushItemsUndoSnapshot();

    if (format === "stories" && item.images?.length && (values.imageId || values.imageIndex !== undefined)) {
      const sortedImages = sortImagesByOrder(item.images);
      const targetIndex = Math.max(
        sortedImages.findIndex((image) => image.id === values.imageId),
        values.imageIndex ?? -1,
      );

      if (targetIndex < 0 || targetIndex >= sortedImages.length) return;

      const metadata = sortedImages.map((image, index) => {
        const currentMetadata = storyImageMetadata({
          notes: item.notes,
          imageId: image.id,
          orderIndex: image.order_index ?? index,
          fallbackDate: item.display_date,
          fallbackWeekday: item.weekday,
        });

        return index === targetIndex
          ? {
              displayDate: nextDate ?? currentMetadata.displayDate ?? item.display_date,
              weekday: nextWeekday ?? currentMetadata.weekday ?? item.weekday,
            }
          : {
              displayDate: currentMetadata.displayDate ?? item.display_date,
              weekday: currentMetadata.weekday ?? item.weekday,
            };
      });
      const notes = buildStoryImageNotes(sortedImages, metadata);
      const firstMetadata = metadata[0];

      const { error: updateError } = await supabase
        .from("visual_items")
        .update({
          notes,
          display_date: firstMetadata?.displayDate ?? item.display_date,
          weekday: firstMetadata?.weekday ?? item.weekday,
        })
        .eq("id", item.id);

      if (updateError) {
        setError(updateError.message);
        return;
      }

      const nextItems = items.map((currentItem) =>
        currentItem.id === item.id
          ? {
              ...currentItem,
              notes,
              display_date: firstMetadata?.displayDate ?? currentItem.display_date,
              weekday: firstMetadata?.weekday ?? currentItem.weekday,
            }
          : currentItem,
      );

      setItems(nextItems);
      await syncPresentationAutomaticRange(nextItems);
      return;
    }

    const updatePayload = {
      display_date: nextDate ?? item.display_date,
      weekday: nextWeekday ?? item.weekday,
    };
    const { error: updateError } = await supabase
      .from("visual_items")
      .update(updatePayload)
      .eq("id", item.id);

    if (updateError) {
      setError(updateError.message);
      return;
    }

    const nextItems = items.map((currentItem) =>
      currentItem.id === item.id
        ? {
            ...currentItem,
            display_date: updatePayload.display_date,
            weekday: updatePayload.weekday,
          }
        : currentItem,
    );

    setItems(nextItems);
    await syncPresentationAutomaticRange(nextItems);
  }

  async function persistItemOrder(nextItems: VisualItemWithImages[]) {
    const previousItems = items;
    const orderedItems = nextItems.map((item, index) => ({
      ...item,
      order_index: index,
    }));

    pushItemsUndoSnapshot(previousItems);
    setItems(orderedItems);
    setReorderingItemId(orderedItems.find((item, index) => item.id !== previousItems[index]?.id)?.id ?? null);
    setError(null);
    setNotice(null);

    const results = await Promise.all(
      orderedItems.map((item, index) =>
        supabase
          .from("visual_items")
          .update({
            order_index: index,
          })
          .eq("id", item.id),
      ),
    );
    const firstError = results.find((result) => result.error)?.error;

    if (firstError) {
      setItems(previousItems);
      setError(firstError.message);
    }

    setReorderingItemId(null);
  }

  function handleVisualItemDragStart(
    event: DragEvent<HTMLDivElement>,
    item: VisualItemWithImages,
  ) {
    if (shouldIgnoreImageDrag(event.target) || reorderingItemId) {
      event.preventDefault();
      return;
    }

    const index = items.findIndex((currentItem) => currentItem.id === item.id);

    if (index < 0) {
      event.preventDefault();
      return;
    }

    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", item.id);
    visualOrderChangedRef.current = false;
    setVisualItemDrag({
      itemId: item.id,
      fromIndex: index,
      dropIndex: index,
    });
  }

  function handleVisualItemDragOver(event: DragEvent<HTMLDivElement>, targetItem: VisualItemWithImages) {
    if (!visualItemDrag) return;

    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    const currentIndex = items.findIndex((item) => item.id === visualItemDrag.itemId);
    const targetIndex = items.findIndex((item) => item.id === targetItem.id);

    if (currentIndex < 0 || targetIndex < 0) return;

    const dropIndex = dragInsertIndex(event, currentIndex, targetIndex, items.length);

    if (currentIndex !== dropIndex) {
      const reorderedItems = reorderCollection(items, currentIndex, dropIndex);

      itemsRef.current = reorderedItems;
      visualOrderChangedRef.current = true;
      setItems(reorderedItems);
      setVisualItemDrag({
        itemId: visualItemDrag.itemId,
        fromIndex: dropIndex,
        dropIndex,
      });
    }
  }

  function dropVisualItem(event?: DragEvent<HTMLElement>) {
    event?.preventDefault();

    if (!visualItemDrag) return;

    setVisualItemDrag(null);

    if (visualOrderChangedRef.current) {
      const finalItems = itemsRef.current;

      visualOrderChangedRef.current = false;
      void persistItemOrder(finalItems);
    }
  }

  function cancelVisualItemDrag() {
    if (visualItemDrag && visualOrderChangedRef.current) {
      const finalItems = itemsRef.current;

      setVisualItemDrag(null);
      visualOrderChangedRef.current = false;
      void persistItemOrder(finalItems);
      return;
    }

    setVisualItemDrag(null);
    visualOrderChangedRef.current = false;
  }

  function addPublicationFiles(rawFiles: File[]) {
    if (!activeFormat) return;

    const files = imageFilesFromList(rawFiles);

    setForm((current) => {
      const currentCount =
        current.format === "stories" ? current.storyImages.length : current.imageFiles.length;
      const acceptedFiles = limitedFilesForFormat(current.format, files, currentCount);

      if (!acceptedFiles.length) return current;

      if (current.format === "stories") {
        return {
          ...current,
          storyImages: [
            ...current.storyImages,
            ...storyDraftsFromFiles(acceptedFiles, selectedWeek, current.storyImages.length),
          ],
        };
      }

      return {
        ...current,
        imageFiles:
          current.format === "post"
            ? acceptedFiles.slice(0, 1)
            : [...current.imageFiles, ...acceptedFiles],
      };
    });
  }

  function replacePublicationFile(index: number, rawFiles: File[]) {
    const [file] = imageFilesFromList(rawFiles);

    if (!file) return;

    setForm((current) => {
      if (current.format === "stories") {
        return {
          ...current,
          storyImages: current.storyImages.map((story, storyIndex) =>
            storyIndex === index ? { ...story, file } : story,
          ),
        };
      }

      return {
        ...current,
        imageFiles: current.imageFiles.map((currentFile, fileIndex) =>
          fileIndex === index ? file : currentFile,
        ),
      };
    });
  }

  function removePublicationImage(index: number) {
    setForm((current) => {
      if (current.format === "stories") {
        return {
          ...current,
          storyImages: current.storyImages.filter((_, storyIndex) => storyIndex !== index),
        };
      }

      return {
        ...current,
        imageFiles: current.imageFiles.filter((_, fileIndex) => fileIndex !== index),
      };
    });
  }

  function handlePublicationImageDragStart(event: DragEvent<HTMLDivElement>, index: number) {
    if (shouldIgnoreImageDrag(event.target)) {
      event.preventDefault();
      return;
    }

    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", String(index));
    setPublicationImageDrag({
      fromIndex: index,
      dropIndex: index,
    });
  }

  function handlePublicationImageDragOver(event: DragEvent<HTMLDivElement>, index: number) {
    if (!publicationImageDrag) return;

    event.preventDefault();
    event.dataTransfer.dropEffect = "move";

    const totalItems = form.format === "stories" ? form.storyImages.length : form.imageFiles.length;
    const dropIndex = dragInsertIndex(event, publicationImageDrag.fromIndex, index, totalItems);

    if (publicationImageDrag.fromIndex !== dropIndex) {
      setForm((current) =>
        current.format === "stories"
          ? {
              ...current,
              storyImages: reorderCollection(current.storyImages, publicationImageDrag.fromIndex, dropIndex),
            }
          : {
              ...current,
              imageFiles: reorderCollection(current.imageFiles, publicationImageDrag.fromIndex, dropIndex),
            },
      );
      setPublicationImageDrag({
        fromIndex: dropIndex,
        dropIndex,
      });
    }
  }

  function dropPublicationImage(event?: DragEvent<HTMLElement>) {
    event?.preventDefault();

    if (!publicationImageDrag) return;

    setPublicationImageDrag(null);
  }

  function stopPublicationImageDrag() {
    setPublicationImageDrag(null);
  }

  function updateStoryDraft(index: number, patch: Partial<Pick<StoryDraftImage, "date" | "weekday">>) {
    setForm((current) => ({
      ...current,
      storyImages: current.storyImages.map((story, storyIndex) =>
        storyIndex === index ? { ...story, ...patch } : story,
      ),
    }));
  }

  function updateEditImageDraft(
    index: number,
    patch: Partial<Pick<EditImageDraft, "date" | "weekday" | "file">>,
  ) {
    setEditForm((current) =>
      current
        ? {
            ...current,
            imageDrafts: current.imageDrafts.map((draft, draftIndex) =>
              draftIndex === index ? { ...draft, ...patch } : draft,
            ),
          }
        : current,
    );
  }

  function addEditFiles(rawFiles: File[]) {
    if (!editForm) return;

    const files = imageFilesFromList(rawFiles);
    const acceptedFiles = limitedFilesForFormat(editForm.format, files, editForm.imageDrafts.length);

    if (!acceptedFiles.length) return;

    setEditForm((current) =>
      current
        ? {
            ...current,
            imageDrafts: [
              ...current.imageDrafts,
              ...acceptedFiles.map((file, index) => ({
                draftId: newDraftId(),
                file,
                date:
                  current.format === "stories"
                    ? dateLabelForWeekOffset(selectedWeek, current.imageDrafts.length + index)
                    : current.date,
                weekday: current.format === "stories" ? "SEG" : current.weekday,
                orderIndex: current.imageDrafts.length + index,
              })),
            ],
          }
        : current,
    );
  }

  function removeEditImage(index: number) {
    setEditForm((current) =>
      current
        ? {
            ...current,
            imageDrafts: current.imageDrafts.filter((_, draftIndex) => draftIndex !== index),
          }
        : current,
    );
  }

  function handleEditImageDragStart(event: DragEvent<HTMLDivElement>, index: number) {
    if (shouldIgnoreImageDrag(event.target)) {
      event.preventDefault();
      return;
    }

    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", String(index));
    setEditImageDrag({
      fromIndex: index,
      dropIndex: index,
    });
  }

  function handleEditImageDragOver(event: DragEvent<HTMLDivElement>, index: number) {
    if (!editImageDrag || !editForm) return;

    event.preventDefault();
    event.dataTransfer.dropEffect = "move";

    const dropIndex = dragInsertIndex(event, editImageDrag.fromIndex, index, editForm.imageDrafts.length);

    if (editImageDrag.fromIndex !== dropIndex) {
      setEditForm((current) =>
        current
          ? {
              ...current,
              imageDrafts: reorderCollection(current.imageDrafts, editImageDrag.fromIndex, dropIndex),
            }
          : current,
      );
      setEditImageDrag({
        fromIndex: dropIndex,
        dropIndex,
      });
    }
  }

  function dropEditImage(event?: DragEvent<HTMLElement>) {
    event?.preventDefault();

    if (!editImageDrag) return;

    setEditImageDrag(null);
  }

  function stopEditImageDrag() {
    setEditImageDrag(null);
  }

  function closePublicationModal() {
    if (saving) return;

    setActiveFormat(null);
    setForm(initialPublicationForm("post"));
    setFileInputKey((current) => current + 1);
    setPublicationImageDrag(null);
  }

  function closeEditModal() {
    if (savingEdit) return;

    setEditForm(null);
    setError(null);
    setEditImageDrag(null);
  }

  if (loading) {
    return (
      <Card className={surfaceClass}>
        <CardContent className={cn("pt-5 text-sm", mutedTextClass)}>
          Carregando apresentacao...
        </CardContent>
      </Card>
    );
  }

  if (!presentation) {
    return (
      <Card className={surfaceClass}>
        <CardContent className={cn("pt-5 text-sm", mutedTextClass)}>
          {error || "Apresentacao nao encontrada."}
        </CardContent>
      </Card>
    );
  }

  const clientName = client?.name || "Cliente";
  const presentationPeriod = presentation.period_label || "Periodo nao definido";
  const presentationSubtitle = presentation.title?.includes(presentationPeriod)
    ? clientName
    : `${clientName} — ${presentationPeriod}`;
  const hasMultipleWeeks = presentationWeeks.length > 1;
  const primaryColor = client?.primary_color || "#DFFF06";
  const secondaryColor = client?.secondary_color || primaryColor;

  return (
    <section className="space-y-4 md:space-y-6">
      <div className="z-50 border-b border-border bg-background md:sticky md:top-0 md:-mx-8 md:-mt-8">
        <div className="flex flex-col gap-1.5 px-0 py-2 md:px-5 md:py-4">
          <div className="flex flex-col gap-1.5 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex min-w-0 items-center gap-2 lg:flex-1">
              <Button
                asChild
                variant="ghostSecondary"
                size="icon"
                className="h-8 w-8 shrink-0 rounded-full"
                title="Voltar para cliente"
              >
                <Link href={`/admin/clientes/${presentation.client_id}`} aria-label="Voltar para cliente">
                  <ArrowLeft className="h-4 w-4" />
                  <span className="sr-only">Voltar para cliente</span>
                </Link>
              </Button>

              <div className="min-w-0 flex-1">
                <h1 className="sora-heading truncate px-1 text-base font-medium tracking-normal text-foreground md:text-2xl">
                  {presentation.title}
                </h1>
                <p className={cn("mt-0.5 truncate px-1 text-[11px]", mutedTextClass)}>
                  {presentationSubtitle}
                </p>
              </div>
            </div>

            <div className="no-scrollbar flex w-full min-w-0 flex-nowrap items-center justify-start gap-1 overflow-x-auto lg:w-auto lg:justify-end">
              <div className="inline-flex h-8 shrink-0 items-center justify-center rounded-md border border-border bg-background p-0.5 text-muted-foreground lg:h-8">
                {(["visual", "edit"] as EditorMode[]).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setEditorMode(mode)}
                    className={cn(
                      "inline-flex h-7 items-center justify-center whitespace-nowrap rounded-md px-2.5 py-1 text-[11px] font-medium transition-all focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50 lg:text-xs",
                      editorMode === mode
                        ? "bg-background text-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {mode === "visual" ? "Visual" : "Edição"}
                  </button>
                ))}
              </div>
              <Button
                type="button"
                variant="ghostSecondary"
                size="sm"
                className="h-8 shrink-0 px-2 text-xs md:px-2.5"
                onClick={copyPublicLink}
                aria-label="Copiar link publico"
                title="Copiar link publico"
              >
                <Clipboard className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">{copied ? "Copiado" : "Copiar link publico"}</span>
              </Button>
              <Button asChild variant="ghostSecondary" size="sm" className="h-8 shrink-0 px-2 text-xs md:px-2.5">
                <Link href={`/a/${presentation.public_slug}`} target="_blank" rel="noreferrer" aria-label="Abrir publico" title="Abrir publico">
                  <ExternalLink className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Abrir publico</span>
                </Link>
              </Button>
              <Button
                type="button"
                variant="ghostSecondary"
                size="sm"
                className="h-8 shrink-0 px-2 text-xs md:px-2.5"
                onClick={() => setVisualConfirmAction({ kind: "archive-presentation" })}
                disabled={archiving}
                aria-label="Arquivar"
                title="Arquivar"
              >
                <Archive className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">{archiving ? "Arquivando..." : "Arquivar"}</span>
              </Button>
            </div>
          </div>
        </div>
      </div>

      {error && !activeFormat ? (
        <Card className="relative z-[60] border-rose-600 bg-rose-600 text-white">
          <CardContent className="pt-5 text-sm font-medium">{error}</CardContent>
        </Card>
      ) : null}

      {notice ? (
        <Card className="relative z-[60] border-emerald-600 bg-emerald-600 text-white">
          <CardContent className="pt-5 text-sm font-medium">{notice}</CardContent>
        </Card>
      ) : null}

      {editorMode === "visual" ? (
        <section className="space-y-5 md:space-y-7">
          {hasMultipleWeeks ? (
            <div className="space-y-2.5 md:space-y-3">
              <SectionTitleWithTooltip
                title="Semanas"
                tooltip="Aqui você organiza a apresentação por semana. Clique em uma semana para abrir os uploads e itens dessa semana."
              />
              <WeekSelectionGrid
                weeks={presentationWeeks}
                selectedWeekId={selectedWeek?.id ?? null}
                items={items}
                onSelect={setSelectedWeekId}
              />
            </div>
          ) : null}

          <div className="space-y-4 md:space-y-6">
            <div className="mb-3 flex flex-wrap items-end justify-between gap-2 md:mb-5 md:gap-3">
              <div>
                <h2 className="sora-heading text-sm font-semibold text-foreground md:text-base">
                  {selectedWeek?.label || "Prévia da apresentação"}
                </h2>
                <p className={cn("text-xs", mutedTextClass)}>
                  {selectedWeek?.periodLabel || presentation.period_label || "Periodo nao definido"}
                </p>
              </div>
              <span className="rounded-full border border-border px-2.5 py-1 text-[11px] text-muted-foreground">
                Prévia visual
              </span>
            </div>

            {selectedWeekItems.length ? (
            <div className="space-y-5 md:space-y-12">
                {selectedWeekItems.map((item) => (
                  <VisualPreviewItemSection
                    key={item.id}
                    item={item}
                    client={client}
                    theme={theme}
                    primaryColor={primaryColor}
                    secondaryColor={secondaryColor}
                    editable
                    onQuickUpdate={handleQuickUpdate}
                  />
                ))}
              </div>
            ) : (
              <p className={cn("text-sm", mutedTextClass)}>
                Nenhuma arte cadastrada para esta semana.
              </p>
            )}
          </div>
        </section>
      ) : (
        <section className="space-y-5 md:space-y-8">
          <div className="space-y-2.5 md:space-y-3">
            <SectionTitleWithTooltip
              title="Semanas"
              tooltip="Aqui você organiza a apresentação por semana. Clique em uma semana para abrir os uploads e itens dessa semana."
            />
            <WeekSelectionGrid
              weeks={presentationWeeks}
              selectedWeekId={selectedWeek?.id ?? null}
              items={items}
              onSelect={setSelectedWeekId}
              onAddWeek={addPresentationWeek}
              onEditWeek={openWeekEditModal}
              onDeleteWeek={setWeekToDelete}
            />
          </div>

          <div className="space-y-2.5 md:space-y-3">
            <SectionTitleWithTooltip
              title="Uploads"
              tooltip="Aqui você adiciona posts, carrosséis e stories da semana selecionada."
            />
            <div className="no-scrollbar grid max-w-full auto-cols-[minmax(118px,42vw)] grid-flow-col gap-2 overflow-x-auto pb-1 md:grid-flow-row md:grid-cols-3 md:gap-3 md:overflow-visible">
              {publicationTypes.map((type) => (
                <AddFormatCard
                  key={type.format}
                  format={type.format}
                  label={type.label}
                  description={type.description}
                  active={activeFormat === type.format}
                  onFiles={(files) => handleCreationCardFiles(type.format, files)}
                />
              ))}
            </div>
          </div>
        </section>
      )}

      {activeFormat ? (
        <div
          className="fixed inset-0 z-[110] grid place-items-end bg-black/35 px-3 py-3 dark:bg-black/55 sm:place-items-center sm:px-4 sm:py-6"
          onClick={closePublicationModal}
        >
          <div
            className={cn("max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-2xl border p-4 sm:p-5", surfaceClass)}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="sora-heading text-2xl font-medium text-foreground">
                  Adicionar {publicationLabel(activeFormat)}
                </h2>
              </div>
              <Button
                type="button"
                variant="ghostSecondary"
                size="icon"
                onClick={closePublicationModal}
                disabled={saving}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            <form className="mt-6 grid gap-5" onSubmit={handleAddPublication}>
              {activeFormat === "stories" ? (
                <div className="space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <p className={cn("text-xs", mutedTextClass)}>
                      Cada Story tem data e dia próprios. Limite de {formatLimits.stories} imagens.
                    </p>
                    {form.storyImages.length < formatLimits.stories ? (
                      <>
                        <input
                          key={fileInputKey}
                          id="publicationStoryImages"
                          type="file"
                          accept="image/*"
                          multiple
                          className="sr-only"
                          onChange={(event) => {
                            addPublicationFiles(imageFilesFromList(event.target.files));
                            event.currentTarget.value = "";
                          }}
                        />
                        <label
                          htmlFor="publicationStoryImages"
                          className="inline-flex h-9 cursor-pointer items-center justify-center gap-2 rounded-md border border-border bg-background px-3 text-xs font-medium text-foreground transition-colors hover:bg-secondary"
                        >
                          <Upload className="h-3.5 w-3.5" />
                          Adicionar imagens
                        </label>
                      </>
                    ) : null}
                  </div>

                  <div className="grid gap-3">
                    {form.storyImages.map((story, index) => {
                      const preview = selectedStoryPreviews[index];

                      return (
                        <div
                          key={story.draftId}
                          draggable
                          onDragStart={(event) => handlePublicationImageDragStart(event, index)}
                          onDragOver={(event) => handlePublicationImageDragOver(event, index)}
                          onDragEnd={stopPublicationImageDrag}
                          onDrop={dropPublicationImage}
                          className={cn(
                            "grid cursor-grab gap-3 rounded-xl border p-3 transition-transform duration-150 ease-out active:cursor-grabbing sm:grid-cols-[120px_1fr]",
                            nestedSurfaceClass,
                            publicationImageDrag?.fromIndex === index && "scale-[1.01] shadow-sm shadow-black/10",
                          )}
                        >
                          <ReplaceableImageFrame
                            inputId={`replace-story-${story.draftId}`}
                            previewUrl={preview?.url}
                            alt={preview?.name || `Story ${index + 1}`}
                            index={index}
                            aspectClass="aspect-[9/16]"
                            onReplace={(files) => replacePublicationFile(index, files)}
                            onRemove={() => removePublicationImage(index)}
                          />

                          <div className="grid gap-3">
                            <div className="grid gap-3 sm:grid-cols-[120px_1fr]">
                              <div className="space-y-2">
                                <Label htmlFor={`storyDate-${story.draftId}`}>Data</Label>
                                <Input
                                  id={`storyDate-${story.draftId}`}
                                  inputMode="numeric"
                                  maxLength={5}
                                  value={story.date}
                                  data-no-image-drag="true"
                                  onChange={(event) =>
                                    updateStoryDraft(index, {
                                      date: formatDateInput(event.target.value),
                                    })
                                  }
                                  placeholder="15/06"
                                />
                              </div>
                              <div className="space-y-2">
                                <Label>Dia da semana</Label>
                                <WeekdayControl
                                  value={story.weekday}
                                  onChange={(weekday) => updateStoryDraft(index, { weekday })}
                                />
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <>
                  <div className="space-y-2">
                    <Label>Dia da semana</Label>
                    <WeekdayControl
                      value={form.weekday}
                      onChange={(weekday) => setForm((current) => ({ ...current, weekday }))}
                    />
                  </div>

                  <div className="max-w-[160px] space-y-2">
                    <Label htmlFor="publicationDate">Data</Label>
                    <Input
                      id="publicationDate"
                      inputMode="numeric"
                      maxLength={5}
                      value={form.date}
                      className={error && getDayMonthInputError(form.date) ? "border-rose-500 focus-visible:ring-rose-500" : undefined}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          date: formatDateInput(event.target.value),
                        }))
                      }
                      placeholder="15/06"
                    />
                  </div>

                  <div className="space-y-2">
                    {form.imageFiles.length < formatLimits[activeFormat] ? (
                      <>
                        <input
                          key={fileInputKey}
                          id="publicationImages"
                          type="file"
                          accept="image/*"
                          multiple={activeFormat !== "post"}
                          className="sr-only"
                          onChange={(event) => {
                            addPublicationFiles(imageFilesFromList(event.target.files));
                            event.currentTarget.value = "";
                          }}
                        />
                        <label
                          htmlFor="publicationImages"
                          className="inline-flex h-10 cursor-pointer items-center justify-center gap-2 rounded-md border border-border bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-secondary"
                        >
                          <ImagePlus className="h-4 w-4" />
                          {form.imageFiles.length ? "Adicionar imagens" : "Subir imagens"}
                        </label>
                      </>
                    ) : null}
                    <p className={cn("text-xs", mutedTextClass)}>
                      {activeFormat === "post"
                        ? "Post aceita apenas 1 imagem."
                        : "Carrossel aceita ate 20 imagens na ordem de exibicao."}
                    </p>
                    {selectedImagePreviews.length ? (
                      <div className={cn("rounded-lg border p-3", nestedSurfaceClass)}>
                        <p className="mb-3 text-sm font-medium text-foreground">
                          {selectedImagePreviews.length} arquivo
                          {selectedImagePreviews.length > 1 ? "s" : ""} selecionado
                          {selectedImagePreviews.length > 1 ? "s" : ""}
                        </p>
                        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                          {selectedImagePreviews.map((preview, index) => (
                            <div
                              key={preview.url}
                              draggable
                              onDragStart={(event) => handlePublicationImageDragStart(event, index)}
                              onDragOver={(event) => handlePublicationImageDragOver(event, index)}
                              onDragEnd={stopPublicationImageDrag}
                              onDrop={dropPublicationImage}
                              className={cn(
                                "cursor-grab rounded-lg border border-border bg-background p-2 transition-transform duration-150 ease-out active:cursor-grabbing",
                                publicationImageDrag?.fromIndex === index && "scale-[1.01] shadow-sm shadow-black/10",
                              )}
                            >
                              <ReplaceableImageFrame
                                inputId={`replace-image-${preview.id}-${index}`}
                                previewUrl={preview.url}
                                alt={preview.name}
                                index={index}
                                aspectClass="aspect-[4/5]"
                                onReplace={(files) => replacePublicationFile(index, files)}
                                onRemove={() => removePublicationImage(index)}
                              />
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : null}
                  </div>
                </>
              )}

              {error ? (
                <p className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-700 dark:text-rose-200">
                  {error}
                </p>
              ) : null}

              <div className="flex flex-wrap gap-3">
                <Button type="submit" disabled={saving}>
                  <ImagePlus className="h-4 w-4" />
                  {saving ? "Enviando..." : `Adicionar ${publicationLabel(activeFormat)}`}
                </Button>
                <Button
                  type="button"
                  variant="ghostSecondary"
                  onClick={closePublicationModal}
                  disabled={saving}
                >
                  Cancelar
                </Button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {editForm ? (
        <div
          className="fixed inset-0 z-[110] grid place-items-end bg-black/35 px-3 py-3 dark:bg-black/55 sm:place-items-center sm:px-4 sm:py-6"
          onClick={closeEditModal}
        >
          <Card
            className={cn("max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-2xl border", surfaceClass)}
            onClick={(event) => event.stopPropagation()}
          >
          <CardHeader className="flex flex-row items-start justify-between gap-4">
            <div>
              <CardTitle>Editar publicacao</CardTitle>
              <CardDescription className={mutedTextClass}>
                Ajuste formato, data, dia e imagens sem perder as informacoes ja preenchidas.
              </CardDescription>
            </div>
            <Button
              type="button"
              variant="ghostSecondary"
              size="icon"
              onClick={closeEditModal}
              disabled={savingEdit}
              aria-label="Fechar edicao"
              title="Fechar edicao"
            >
              <X className="h-4 w-4" />
            </Button>
          </CardHeader>
          <CardContent>
            <form className="grid gap-4" onSubmit={handleSaveEdit}>
              <div className="grid gap-4 md:grid-cols-[1fr_140px]">
                <div className="space-y-2">
                  <Label htmlFor="editFormat">Formato</Label>
                  <select
                    id="editFormat"
                    value={editForm.format}
                    onChange={(event) =>
                      setEditForm((current) =>
                        current
                          ? {
                              ...current,
                              format: event.target.value as VisualFormat,
                            }
                          : current,
                      )
                    }
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <option value="post">Post</option>
                    <option value="carousel">Carrossel</option>
                    <option value="stories">Stories</option>
                  </select>
                </div>
                {editForm.format !== "stories" ? (
                  <div className="space-y-2">
                    <Label htmlFor="editDate">Data</Label>
                    <Input
                      id="editDate"
                      inputMode="numeric"
                      maxLength={5}
                      value={editForm.date}
                      className={error && getDayMonthInputError(editForm.date) ? "border-rose-500 focus-visible:ring-rose-500" : undefined}
                      onChange={(event) =>
                        setEditForm((current) =>
                          current
                            ? {
                                ...current,
                                date: formatDateInput(event.target.value),
                              }
                            : current,
                        )
                      }
                      placeholder="15/06"
                    />
                  </div>
                ) : null}
              </div>

              {editForm.format !== "stories" ? (
                <div className="space-y-2">
                  <Label>Dia da semana</Label>
                  <WeekdayControl
                    value={editForm.weekday}
                    onChange={(weekday) =>
                      setEditForm((current) =>
                        current
                          ? {
                              ...current,
                              weekday,
                            }
                          : current,
                      )
                    }
                  />
                </div>
              ) : (
                <p className={cn("text-xs", mutedTextClass)}>
                  Stories usam data e dia individuais para cada imagem.
                </p>
              )}

              <div className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <Label>Imagens</Label>
                  {editForm.imageDrafts.length < formatLimits[editForm.format] ? (
                    <>
                      <input
                        key={editFileInputKey}
                        id="editAddImages"
                        type="file"
                        accept="image/*"
                        multiple={editForm.format !== "post"}
                        className="sr-only"
                        onChange={(event) => {
                          addEditFiles(imageFilesFromList(event.target.files));
                          event.currentTarget.value = "";
                          setEditFileInputKey((current) => current + 1);
                        }}
                      />
                      <label
                        htmlFor="editAddImages"
                        className="inline-flex h-9 cursor-pointer items-center justify-center gap-2 rounded-md border border-border bg-background px-3 text-xs font-medium text-foreground transition-colors hover:bg-secondary"
                      >
                        <Upload className="h-3.5 w-3.5" />
                        Adicionar imagens
                      </label>
                    </>
                  ) : null}
                </div>

                <div className={cn("grid gap-3", editForm.format !== "stories" && "grid-cols-2 sm:grid-cols-3 md:grid-cols-4")}>
                  {editForm.imageDrafts.map((draft, index) => {
                    const previewUrl = editImagePreviews.get(draft.draftId) || draft.imageUrl;
                    const isStories = editForm.format === "stories";

                    return (
                      <div
                        key={draft.draftId}
                        draggable
                        onDragStart={(event) => handleEditImageDragStart(event, index)}
                        onDragOver={(event) => handleEditImageDragOver(event, index)}
                        onDragEnd={stopEditImageDrag}
                        onDrop={dropEditImage}
                        className={cn(
                          "grid cursor-grab gap-3 rounded-xl border p-3 transition-transform duration-150 ease-out active:cursor-grabbing",
                          isStories && "sm:grid-cols-[110px_1fr]",
                          nestedSurfaceClass,
                          editImageDrag?.fromIndex === index && "scale-[1.01] shadow-sm shadow-black/10",
                        )}
                      >
                        <ReplaceableImageFrame
                          inputId={`editReplaceImage-${draft.draftId}`}
                          previewUrl={previewUrl}
                          alt={`Imagem ${index + 1}`}
                          index={index}
                          aspectClass={isStories ? "aspect-[9/16]" : "aspect-[4/5]"}
                          onReplace={(files) => {
                            const [file] = files;

                            if (file) updateEditImageDraft(index, { file });
                          }}
                          onRemove={() => removeEditImage(index)}
                        />

                        {isStories ? (
                          <div className="grid gap-3">
                            <div className="grid gap-3 sm:grid-cols-[120px_1fr]">
                              <div className="space-y-2">
                                <Label htmlFor={`editStoryDate-${draft.draftId}`}>Data</Label>
                                <Input
                                  id={`editStoryDate-${draft.draftId}`}
                                  inputMode="numeric"
                                  maxLength={5}
                                  value={draft.date}
                                  data-no-image-drag="true"
                                  onChange={(event) =>
                                    updateEditImageDraft(index, {
                                      date: formatDateInput(event.target.value),
                                    })
                                  }
                                  placeholder="15/06"
                                />
                              </div>
                              <div className="space-y-2">
                                <Label>Dia da semana</Label>
                                <WeekdayControl
                                  value={draft.weekday}
                                  onChange={(weekday) => updateEditImageDraft(index, { weekday })}
                                />
                              </div>
                            </div>
                          </div>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              </div>

              {error ? (
                <p className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-700 dark:text-rose-200">
                  {error}
                </p>
              ) : null}

              <div className="flex flex-wrap gap-3">
                <Button type="submit" disabled={savingEdit}>
                  {savingEdit ? "Salvando..." : "Salvar edicao"}
                </Button>
                <Button type="button" variant="ghostSecondary" onClick={closeEditModal}>
                  Cancelar
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
        </div>
      ) : null}

      {editorMode === "edit" ? (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-background px-3 py-2 text-sm text-muted-foreground">
          <Button
            type="button"
            variant="ghostSecondary"
            size="sm"
            onClick={() => {
              setItemSelectionMode((current) => !current);
              setSelectedItemIds([]);
            }}
          >
            <CheckSquare2 className="h-3.5 w-3.5" />
            Selecionar
          </Button>
          {itemSelectionMode ? (
            <>
              <span className="mr-auto font-medium text-foreground">
                {selectedItemIds.length} selecionado{selectedItemIds.length === 1 ? "" : "s"}
              </span>
              {selectedItemIds.length ? (
                <Button
                  type="button"
                  variant="ghostSecondary"
                  size="sm"
	                onClick={() => setVisualConfirmAction({ kind: "delete-selected" })}
                  disabled={bulkDeletingItems}
                  className="text-rose-500 hover:text-rose-500"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Excluir
                </Button>
              ) : null}
              <Button
                type="button"
                variant="ghostSecondary"
                size="sm"
                onClick={() => {
                  setItemSelectionMode(false);
                  setSelectedItemIds([]);
                }}
              >
                Cancelar seleção
              </Button>
            </>
          ) : (
            <span className="text-xs text-muted-foreground">
              Use para excluir várias publicações da semana.
            </span>
          )}
        </div>
      ) : null}

      {editorMode === "edit" ? (
        selectedWeekItems.length ? (
        <div className="grid gap-5 lg:grid-cols-2 2xl:grid-cols-3">
          {selectedWeekItems.map((item) => {
            const fullItem = items.find((currentItem) => currentItem.id === item.id) ?? item;
            const isSelected = selectedItemIds.includes(item.id);

            return (
            <div
              key={item.id}
              data-visual-item-card
              draggable={!reorderingItemId && !itemSelectionMode}
              onDragStart={(event) => handleVisualItemDragStart(event, fullItem)}
              onDragOver={(event) => handleVisualItemDragOver(event, fullItem)}
              onDrop={dropVisualItem}
              onDragEnd={cancelVisualItemDrag}
              className={cn(
                "relative transition-transform duration-150 ease-out",
                itemSelectionMode ? "cursor-default" : "cursor-grab active:cursor-grabbing",
	                isSelected &&
	                  "rounded-2xl border border-blue-400 bg-neutral-900/[0.045] p-1 dark:border-blue-400/60 dark:bg-white/[0.06]",
                visualItemDrag?.itemId === item.id && "scale-[1.01] shadow-sm shadow-black/10",
                reorderingItemId === item.id && "opacity-75",
              )}
            >
              {itemSelectionMode ? (
                <button
                  type="button"
                  className="absolute left-3 top-3 z-20 grid h-8 w-8 place-items-center rounded-md border border-border bg-background text-foreground"
                  onClick={() => toggleSelectedItem(item.id)}
                  aria-label={isSelected ? "Remover da seleção" : "Selecionar publicação"}
                  title={isSelected ? "Remover da seleção" : "Selecionar"}
                >
                  {isSelected ? <CheckSquare2 className="h-4 w-4" /> : <Square className="h-4 w-4" />}
                </button>
              ) : null}
              <VisualItemBoard
                items={[item]}
                client={client}
                onEdit={() => openEditForm(fullItem)}
                onDelete={() => setVisualConfirmAction({ kind: "delete-item", item: fullItem })}
                deletingItemId={deletingItemId}
                theme={theme}
                onQuickUpdate={handleQuickUpdate}
                showDragHandle={!itemSelectionMode}
                dragHandleProps={{
                  "aria-label": "Arrastar para reorganizar publicacao",
                  className: "pointer-events-none",
                }}
              />
            </div>
            );
          })}
        </div>
        ) : (
        <Card className={surfaceClass}>
          <CardContent className={cn("pt-5 text-sm", mutedTextClass)}>
            Nenhuma publicacao visual criada para esta semana ainda.
          </CardContent>
        </Card>
        )
      ) : null}

      {visualConfirmConfig ? (
        <div
          className="fixed inset-0 z-[120] grid place-items-end bg-black/45 px-3 py-3 dark:bg-black/60 sm:place-items-center sm:px-4 sm:py-6"
          onClick={() => {
            if (!bulkDeletingItems && !archiving && !deletingItemId) setVisualConfirmAction(null);
          }}
        >
          <div
            className="w-full max-w-md rounded-2xl border border-border bg-background p-5 shadow-none"
            onClick={(event) => event.stopPropagation()}
          >
            <h2 className="sora-heading text-xl font-medium text-foreground">{visualConfirmConfig.title}</h2>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">{visualConfirmConfig.message}</p>
            <div className="mt-5 flex justify-end gap-3">
              <Button
                type="button"
                variant="ghostSecondary"
                onClick={() => setVisualConfirmAction(null)}
                disabled={bulkDeletingItems || archiving || Boolean(deletingItemId)}
              >
                Cancelar
              </Button>
              <Button
                type="button"
                onClick={confirmVisualAction}
                disabled={bulkDeletingItems || archiving || Boolean(deletingItemId)}
                className={
                  visualConfirmAction?.kind === "archive-presentation"
                    ? "bg-[var(--zacx-brand)] text-white hover:opacity-90 dark:text-black"
                    : "bg-rose-600 text-white hover:bg-rose-700"
                }
              >
                {bulkDeletingItems || archiving || deletingItemId ? "Processando..." : visualConfirmConfig.confirmLabel}
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      {weekToEdit ? (
        <div
          className="fixed inset-0 z-[120] grid place-items-end bg-black/45 px-3 py-3 dark:bg-black/60 sm:place-items-center sm:px-4 sm:py-6"
          onClick={() => {
            if (!savingWeekEdit) setWeekToEdit(null);
          }}
        >
          <div
            className="w-full max-w-md rounded-2xl border border-border bg-background p-5 shadow-none"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="sora-heading text-xl font-medium text-foreground">Editar semana</h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  Ajuste o card sem alterar os uploads cadastrados.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setWeekToEdit(null)}
                disabled={savingWeekEdit}
                className="grid h-8 w-8 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-foreground/[0.06] hover:text-foreground"
                aria-label="Fechar edição"
                title="Fechar"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-5 grid gap-4">
              <div className="grid gap-2">
                <Label htmlFor="week-title">Título</Label>
                <Input
                  id="week-title"
                  value={weekEditForm.title}
                  onChange={(event) =>
                    setWeekEditForm((current) => ({ ...current, title: event.target.value }))
                  }
                  placeholder={weekToEdit.actionLabel}
                />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="grid gap-2">
                  <Label htmlFor="week-start-date">Data inicial</Label>
                  <Input
                    id="week-start-date"
                    inputMode="numeric"
                    value={weekEditForm.startDate}
                    onChange={(event) =>
                      setWeekEditForm((current) => ({
                        ...current,
                        startDate: formatDateInput(event.target.value),
                      }))
                    }
                    placeholder="DD/MM"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="week-end-date">Data final</Label>
                  <Input
                    id="week-end-date"
                    inputMode="numeric"
                    value={weekEditForm.endDate}
                    onChange={(event) =>
                      setWeekEditForm((current) => ({
                        ...current,
                        endDate: formatDateInput(event.target.value),
                      }))
                    }
                    placeholder="DD/MM"
                  />
                </div>
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <Button
                type="button"
                variant="ghostSecondary"
                onClick={() => setWeekToEdit(null)}
                disabled={savingWeekEdit}
              >
                Cancelar
              </Button>
              <Button
                type="button"
                onClick={saveWeekEdit}
                disabled={savingWeekEdit}
                className="bg-[var(--zacx-brand)] text-white hover:opacity-90 dark:text-black"
              >
                {savingWeekEdit ? "Salvando..." : "Salvar edição"}
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      {weekToDelete ? (
        <div
          className="fixed inset-0 z-[120] grid place-items-end bg-black/45 px-3 py-3 dark:bg-black/60 sm:place-items-center sm:px-4 sm:py-6"
          onClick={() => {
            if (!deletingWeek) setWeekToDelete(null);
          }}
        >
          <div
            className="w-full max-w-md rounded-2xl border border-border bg-background p-5 shadow-none"
            onClick={(event) => event.stopPropagation()}
          >
            <h2 className="sora-heading text-xl font-medium text-foreground">Excluir semana</h2>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">
              Você tem certeza que quer excluir esta semana? Todos os posts, carrosséis, stories e arquivos dessa semana serão removidos.
            </p>
            <p className="mt-3 rounded-lg border border-border bg-background px-3 py-2 text-xs text-muted-foreground">
              {weekToDelete.actionLabel} - {weekToDelete.periodLabel}
            </p>
            <div className="mt-5 flex justify-end gap-3">
              <Button
                type="button"
                variant="ghostSecondary"
                onClick={() => setWeekToDelete(null)}
                disabled={deletingWeek}
              >
                Cancelar
              </Button>
              <Button
                type="button"
                onClick={() => deletePresentationWeek(weekToDelete)}
                disabled={deletingWeek}
                className="bg-rose-600 text-white hover:bg-rose-700"
              >
                {deletingWeek ? "Excluindo..." : "Excluir semana"}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
