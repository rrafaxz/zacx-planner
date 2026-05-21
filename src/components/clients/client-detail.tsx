"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Archive,
  ArrowLeft,
  CheckSquare2,
  Clipboard,
  ExternalLink,
  FileText,
  ImagePlus,
  Pencil,
  Plus,
  RotateCcw,
  Search,
  SlidersHorizontal,
  Square,
  Trash2,
  X,
} from "lucide-react";

import { ClientAvatarInput } from "@/components/clients/client-avatar-input";
import { ColorDotInput } from "@/components/clients/color-dot-input";
import { AutoDismissToast } from "@/components/ui/auto-dismiss-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  formatDateInput,
  getDayMonthInputError,
  getMonthNameFromDayMonth,
  isValidDayMonth,
} from "@/lib/date-mask";
import { canSeeClient, isAdminUser } from "@/lib/auth/types";
import { useCurrentUser } from "@/lib/auth/current-user";
import { optimizeImage } from "@/lib/image-optimizer";
import { supabase } from "@/lib/supabase/client";
import type { Client, CopyPlanning, VisualItem, VisualItemImage, VisualPresentation } from "@/lib/supabase/types";
import { resolveUniquePublicSlug } from "@/lib/unique-public-slug";
import { cn, formatDateBR } from "@/lib/utils";
import {
  applyAutomaticVisualPresentationRange,
  buildVisualPresentationSlugBaseFromRange,
  buildVisualPresentationTitleFromRange,
  getVisualPresentationDateRange,
  visualPresentationDateRangeFromPresentation,
  visualPresentationPreferredSlug,
} from "@/components/visual-presentations/visual-presentation-weeks";
import type { VisualItemWithImages } from "@/components/visual-presentations/visual-item-board";

type ClientDetailProps = {
  clientId: string;
};

type CopyPlanningForm = {
  startDate: string;
  endDate: string;
};

type VisualPresentationForm = {
  startDate: string;
  endDate: string;
  presentationType: string;
};

type ClientProfileForm = {
  name: string;
  slug: string;
  logoUrl: string | null;
  primaryColor: string;
  secondaryColor: string;
  responsibleName: string;
};

type CreationMode = "copy" | "visual" | null;
type MonthFilter = "all" | string;
type PlanningSort = "recent" | "oldest" | "az" | "za" | "more-content" | "less-content";
type PresentationSort = "recent" | "oldest" | "az" | "za" | "more-art" | "less-art";
type PresentationTypeFilter = "all" | "semanal" | "quinzenal" | "mensal";
type LibraryConfirmAction = {
  kind:
    | "archive-planning"
    | "unarchive-planning"
    | "delete-planning"
    | "archive-presentation"
    | "unarchive-presentation"
    | "delete-presentation";
  ids: string[];
} | null;

type CopyPlanningWithPreview = CopyPlanning & {
  start_display_date?: string | null;
  end_display_date?: string | null;
  posts_content?: string | null;
  carousels_content?: string | null;
  stories_content?: string | null;
  videos_content?: string | null;
};

type VisualItemThumbnailRow = {
  id: string;
  visual_presentation_id: string;
  image_url: string | null;
  display_date: string | null;
  format: string | null;
  weekday: string | null;
  notes: string | null;
  order_index: number | null;
  created_at: string | null;
};

type VisualItemImageThumbnailRow = {
  id: string;
  visual_item_id: string;
  image_url: string | null;
  order_index: number | null;
  created_at: string | null;
};

const initialCopyPlanningForm: CopyPlanningForm = {
  startDate: "",
  endDate: "",
};

const initialVisualPresentationForm: VisualPresentationForm = {
  startDate: "",
  endDate: "",
  presentationType: "semanal",
};

const initialClientProfileForm: ClientProfileForm = {
  name: "",
  slug: "",
  logoUrl: null,
  primaryColor: "#A3E635",
  secondaryColor: "#60A5FA",
  responsibleName: "",
};

const responsibleOptions = ["Rafael", "Matheus"] as const;

const presentationTypeLabels: Record<string, string> = {
  weekly: "Semanal",
  biweekly: "Quinzenal",
  monthly: "Mensal",
  semanal: "Semanal",
  quinzenal: "Quinzenal",
  mensal: "Mensal",
};

const visualPresentationTypeOptions = [
  { value: "semanal", label: "Semanal" },
  { value: "quinzenal", label: "Quinzenal" },
  { value: "mensal", label: "Mensal" },
] as const;

const presentationTypeTabs: Array<{ value: PresentationTypeFilter; label: string }> = [
  { value: "all", label: "Todas" },
  { value: "semanal", label: "Semanais" },
  { value: "quinzenal", label: "Quinzenais" },
  { value: "mensal", label: "Mensais" },
];

const monthAbbreviations = [
  "JAN",
  "FEV",
  "MAR",
  "ABR",
  "MAI",
  "JUN",
  "JUL",
  "AGO",
  "SET",
  "OUT",
  "NOV",
  "DEZ",
];

const monthNames = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
];

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

function clientNameForTitle(clientName: string) {
  return clientName.trim().toUpperCase() || "CLIENTE";
}

function normalizeTitleComparison(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, " ");
}

function normalizeSlugComparison(value: string) {
  return value.trim().toLowerCase().replace(/-+/g, "-").replace(/^-+|-+$/g, "");
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function buildPresentationTitle(clientName: string, startDate: string, endDate: string) {
  if (!isValidDayMonth(startDate) || !isValidDayMonth(endDate)) {
    return buildVisualPresentationTitleFromRange(clientName);
  }

  return buildVisualPresentationTitleFromRange(clientName, {
    startLabel: startDate,
    endLabel: endDate,
  });
}

function buildPlanningTitle(clientName: string, startDate: string, sequenceNumber?: number | null) {
  const baseTitle = `${clientNameForTitle(clientName)} PLANEJAMENTO ${getMonthNameFromDayMonth(startDate) || "--"}`;

  return sequenceNumber && sequenceNumber > 1 ? `${baseTitle} ${sequenceNumber}` : baseTitle;
}

function buildPlanningSlug(clientSlug: string, monthName: string, sequenceNumber?: number | null) {
  const clientSlugPart = slugify(clientSlug) || "cliente";
  const monthSlugPart = slugify(monthName) || "sem-mes";
  const baseSlug = `${clientSlugPart}-planejamento-${monthSlugPart}`;

  return sequenceNumber && sequenceNumber > 1 ? `${baseSlug}-${sequenceNumber}` : baseSlug;
}

function buildSlugFromTitle(title: string) {
  return slugify(title);
}

function planningSequenceFromTitle(title: string | null | undefined, baseTitle: string) {
  const normalizedTitle = normalizeTitleComparison(title || "");
  const normalizedBaseTitle = normalizeTitleComparison(baseTitle);

  if (!normalizedTitle || !normalizedBaseTitle) return null;
  if (normalizedTitle === normalizedBaseTitle) return 1;

  const match = normalizedTitle.match(new RegExp(`^${escapeRegExp(normalizedBaseTitle)} (\\d+)$`));
  const sequence = match ? Number(match[1]) : 0;

  return Number.isFinite(sequence) && sequence > 1 ? sequence : null;
}

function planningSequenceFromSlug(slug: string | null | undefined, baseSlug: string) {
  const normalizedSlug = normalizeSlugComparison(slug || "");
  const normalizedBaseSlug = normalizeSlugComparison(baseSlug);

  if (!normalizedSlug || !normalizedBaseSlug) return null;
  if (normalizedSlug === normalizedBaseSlug) return 1;

  const match = normalizedSlug.match(new RegExp(`^${escapeRegExp(normalizedBaseSlug)}-(\\d+)$`));
  const sequence = match ? Number(match[1]) : 0;

  return Number.isFinite(sequence) && sequence > 1 ? sequence : null;
}

function planningMonthKey(value: string | null | undefined) {
  const formattedValue = formatDateInput(value || "");

  if (!isValidDayMonth(formattedValue)) return null;

  return formattedValue.split("/")[1] || null;
}

function nextPlanningSequenceForMonth(
  plannings: CopyPlanningWithPreview[],
  startDate: string,
  baseTitle: string,
  baseSlug: string,
) {
  const targetMonth = planningMonthKey(startDate);

  if (!targetMonth) return 1;

  const usedSequences = new Set<number>();

  plannings.forEach((planning) => {
    const titleSequence = planningSequenceFromTitle(planning.title, baseTitle);
    const slugSequence = planningSequenceFromSlug(planning.public_slug, baseSlug);
    const matchesMonthByDate = planningMonthKey(planning.start_display_date) === targetMonth;
    const matchesMonthByNaming = titleSequence !== null || slugSequence !== null;

    if (!matchesMonthByDate && !matchesMonthByNaming) return;

    usedSequences.add(1);

    if (titleSequence && titleSequence > 1) {
      usedSequences.add(titleSequence);
    }

    if (slugSequence && slugSequence > 1) {
      usedSequences.add(slugSequence);
    }
  });

  let sequenceNumber = 1;

  while (usedSequences.has(sequenceNumber)) {
    sequenceNumber += 1;
  }

  return sequenceNumber;
}

function buildPeriodLabel(startDate: string, endDate: string) {
  return `${startDate} a ${endDate}`;
}

function dayMonthDate(value: string, year = 2026) {
  const formattedValue = formatDateInput(value);

  if (!isValidDayMonth(formattedValue)) return null;

  const [dayText, monthText] = formattedValue.split("/");

  return new Date(year, Number(monthText) - 1, Number(dayText), 12, 0, 0, 0);
}

function formatDayMonthDate(date: Date) {
  return `${String(date.getDate()).padStart(2, "0")}/${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function addDaysToDayMonth(value: string, days: number) {
  const date = dayMonthDate(value);

  if (!date) return "";

  date.setDate(date.getDate() + days);
  return formatDayMonthDate(date);
}

function endOfMonthFromDayMonth(value: string) {
  const date = dayMonthDate(value);

  if (!date) return "";

  return formatDayMonthDate(new Date(date.getFullYear(), date.getMonth() + 1, 0, 12, 0, 0, 0));
}

function suggestedVisualEndDate(startDate: string, presentationType: string) {
  if (!isValidDayMonth(startDate)) return "";

  const normalizedType = normalizePresentationTypeForSave(presentationType);

  if (normalizedType === "quinzenal") {
    return addDaysToDayMonth(startDate, 13);
  }

  if (normalizedType === "mensal") {
    const startDateObject = dayMonthDate(startDate);
    const endOfMonth = dayMonthDate(endOfMonthFromDayMonth(startDate));
    const fourWeeksEnd = dayMonthDate(addDaysToDayMonth(startDate, 27));

    if (!startDateObject || !endOfMonth || !fourWeeksEnd) return "";

    return formatDayMonthDate(
      endOfMonth.getTime() - startDateObject.getTime() >= 27 * 24 * 60 * 60 * 1000
        ? endOfMonth
        : fourWeeksEnd,
    );
  }

  return addDaysToDayMonth(startDate, 6);
}

function withSuggestedVisualEndDate(
  currentForm: VisualPresentationForm,
  updates: Partial<VisualPresentationForm>,
) {
  const nextForm = { ...currentForm, ...updates };
  const suggestedEndDate = suggestedVisualEndDate(nextForm.startDate, nextForm.presentationType);

  return suggestedEndDate ? { ...nextForm, endDate: suggestedEndDate } : nextForm;
}

function getPresentationTypeLabel(type?: string | null) {
  if (!type) return "Semanal";

  return presentationTypeLabels[type] || presentationTypeLabels[normalizePresentationType(type)] || "Semanal";
}

function normalizePresentationType(type?: string | null): PresentationTypeFilter {
  const value = `${type ?? ""}`.toLowerCase();

  if (value.includes("quinzenal") || value.includes("biweekly")) return "quinzenal";
  if (value.includes("mensal") || value.includes("monthly")) return "mensal";
  if (value.includes("semanal") || value.includes("weekly")) return "semanal";

  return "semanal";
}

function normalizePresentationTypeForSave(type?: string | null) {
  const normalizedType = normalizePresentationType(type);

  return visualPresentationTypeOptions.some((option) => option.value === normalizedType)
    ? normalizedType
    : "semanal";
}

function visualPresentationTypeValue(presentation: VisualPresentation) {
  return presentation.presentation_type || null;
}

function monthTagFromDayMonth(value?: string | null) {
  if (!value || !isValidDayMonth(value)) return null;

  const month = Number(value.split("/")[1]);

  return monthAbbreviations[month - 1] || null;
}

function monthNameFromDayMonth(value?: string | null) {
  if (!value || !isValidDayMonth(value)) return null;

  const month = Number(value.split("/")[1]);

  return monthNames[month - 1] || null;
}

function normalizedSearch(value?: string | null) {
  return `${value ?? ""}`
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function planningContentScore(planning: CopyPlanningWithPreview) {
  return [
    planning.posts_content,
    planning.carousels_content,
    planning.stories_content,
    planning.videos_content,
    planning.document_content,
  ].reduce((score, content) => {
    const text = `${content ?? ""}`.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();

    return score + text.length;
  }, 0);
}

const compactControlClass =
  "border-input bg-background text-foreground transition-colors focus-visible:border-neutral-400 focus-visible:outline-none focus-visible:ring-0 dark:focus-visible:border-white/35";

const sectionIconButtonClass =
  "h-9 w-9 rounded-md border border-border bg-background p-0 text-muted-foreground hover:bg-foreground/[0.05] hover:text-foreground focus-visible:ring-0 focus-visible:border-neutral-400 dark:focus-visible:border-white/35 sm:h-10 sm:w-10 sm:rounded-lg";

const filterPopoverClass =
  "absolute right-0 top-[calc(100%+0.5rem)] z-30 hidden w-72 rounded-2xl border border-border bg-background p-4 shadow-none md:block";

function safeStorageFileName(fileName: string) {
  const name = fileName.split(/[/\\]/).pop() || "logo";
  const safeName = name.replace(/[^a-zA-Z0-9._-]/g, "-");

  return safeName || "logo";
}

function isImageFile(file: File) {
  return file.type.startsWith("image/");
}

function createdTime(item: { created_at: string | null }) {
  return item.created_at ? new Date(item.created_at).getTime() : 0;
}

function extractPreviewText(html?: string | null, clientName?: string | null) {
  if (!html) return "";

  let text = "";

  if (typeof window !== "undefined" && typeof DOMParser !== "undefined") {
    const parser = new DOMParser();
    const document = parser.parseFromString(html, "text/html");
    text = document.body.textContent || "";
  } else {
    text = html.replace(/<[^>]+>/g, " ");
  }

  const clientPattern = clientName
    ? new RegExp(clientName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi")
    : null;
  const cleanedText = text.replace(
    /PLANEJAMENTO DOS (POSTS|CARROSSEIS|CARROSSÉIS|STORIES|VIDEOS|VÍDEOS)/gi,
    " ",
  );

  return (clientPattern ? cleanedText.replace(clientPattern, " ") : cleanedText)
    .replace(/\s+/g, " ")
    .trim();
}

function stopCardClick(event: React.MouseEvent<HTMLElement>) {
  event.stopPropagation();
}

export function ClientAvatarDisplay({
  name,
  logoUrl,
  accentColor,
  className,
}: {
  name: string;
  logoUrl?: string | null;
  accentColor?: string | null;
  className?: string;
}) {
  const initial = (name.trim() || "C").slice(0, 1).toUpperCase();

  return (
    <div
      className={cn(
        "grid h-16 w-16 shrink-0 place-items-center overflow-hidden rounded-full border border-border bg-secondary text-xl font-medium text-foreground",
        className,
      )}
      style={{ color: accentColor || undefined }}
    >
      {logoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={logoUrl} alt="" className="h-full w-full object-cover" />
      ) : (
        <span>{initial}</span>
      )}
    </div>
  );
}

function LibraryCreateButton({
  label,
  onClick,
}: {
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="fixed bottom-5 right-5 z-[70] inline-flex h-14 w-14 items-center justify-center rounded-full bg-[var(--zacx-brand)] text-white shadow-none transition hover:opacity-90 dark:text-black md:bottom-8 md:right-8"
      aria-label={label}
      title={label}
    >
      <Plus className="h-6 w-6" />
    </button>
  );
}

function InfoTag({ children }: { children: string }) {
  return (
    <span className="shrink-0 rounded-md border border-border bg-secondary/45 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-normal text-muted-foreground sm:px-2.5 sm:py-1 sm:text-[10px]">
      {children}
    </span>
  );
}

function PresentationMonthTag({ children }: { children: string }) {
  return (
    <span className="shrink-0 rounded-md border border-border bg-background px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground sm:px-3 sm:py-1 sm:text-xs">
      {children}
    </span>
  );
}

function InlineSearchControl({
  isOpen,
  value,
  placeholder,
  label,
  onOpenChange,
  onValueChange,
}: {
  isOpen: boolean;
  value: string;
  placeholder: string;
  label: string;
  onOpenChange: (open: boolean) => void;
  onValueChange: (value: string) => void;
}) {
  return (
    <>
      <div
        className={cn(
          "relative hidden h-10 items-center overflow-hidden rounded-lg border border-border bg-background text-muted-foreground transition-all duration-200 ease-out focus-within:border-neutral-400 dark:focus-within:border-white/35 md:flex",
          isOpen || value ? "w-[min(58vw,260px)]" : "w-10",
        )}
      >
        <button
          type="button"
          className="grid h-10 w-10 shrink-0 place-items-center transition-colors hover:text-foreground"
          onClick={() => onOpenChange(true)}
          aria-label={label}
          title={label}
        >
          <Search className="h-4 w-4" />
        </button>
        {isOpen || value ? (
          <>
            <Input
              value={value}
              onChange={(event) => onValueChange(event.target.value)}
              onBlur={() => {
                if (!value.trim()) {
                  onOpenChange(false);
                }
              }}
              autoFocus
              placeholder={placeholder}
              className="h-10 min-w-0 flex-1 border-0 bg-transparent px-0 pr-8 text-sm text-foreground shadow-none focus-visible:ring-0"
            />
            <button
              type="button"
              className="absolute right-1.5 top-1/2 grid h-7 w-7 -translate-y-1/2 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-foreground/[0.06] hover:text-foreground"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => {
                onValueChange("");
                onOpenChange(false);
              }}
              aria-label="Fechar busca"
              title="Fechar busca"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </>
        ) : null}
      </div>

      <button
        type="button"
        className={cn(
          "grid h-10 w-10 place-items-center rounded-lg border border-border bg-background text-muted-foreground transition-colors hover:bg-foreground/[0.05] hover:text-foreground md:hidden",
          (isOpen || value) && "border-foreground/30 text-foreground",
        )}
        onClick={() => onOpenChange(true)}
        aria-label={label}
        title={label}
      >
        <Search className="h-4 w-4" />
      </button>

      {isOpen ? (
        <div
          className="fixed inset-0 z-[120] flex items-start justify-center bg-black/40 px-4 pt-20 md:hidden"
          onClick={() => {
            if (!value.trim()) {
              onOpenChange(false);
            }
          }}
        >
          <div
            className="w-full max-w-sm rounded-xl border border-border bg-background p-3 shadow-none"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex h-12 items-center gap-2 rounded-lg border border-border bg-background px-3 text-foreground">
              <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
              <Input
                value={value}
                onChange={(event) => onValueChange(event.target.value)}
                autoFocus
                placeholder={placeholder}
                className="h-11 min-w-0 flex-1 border-0 bg-transparent px-0 text-base shadow-none focus-visible:ring-0"
              />
              <button
                type="button"
                className="grid h-8 w-8 shrink-0 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-foreground/[0.06] hover:text-foreground"
                onClick={() => {
                  onValueChange("");
                  onOpenChange(false);
                }}
                aria-label="Fechar busca"
                title="Fechar busca"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

function DocumentThumbnail({
  preview,
  accentColor,
}: {
  preview: string;
  accentColor: string;
}) {
  return (
    <div className="h-28 overflow-hidden rounded-lg border border-black/10 bg-white p-2 text-neutral-950 sm:h-32 sm:p-2.5">
      <div className="mx-auto mb-1.5 h-0.5 w-8 rounded-full sm:mb-2 sm:h-1 sm:w-9" style={{ backgroundColor: accentColor }} />
      {preview ? (
        <p
          className="text-[7.5px] leading-3 text-neutral-500 sm:text-[9px] sm:leading-3.5"
          style={{
            display: "-webkit-box",
            WebkitLineClamp: 9,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
          }}
        >
          {preview}
        </p>
      ) : (
        <div className="mt-3 space-y-1.5">
          <span className="block h-2 rounded-full bg-neutral-200" />
          <span className="block h-2 w-5/6 rounded-full bg-neutral-200" />
          <span className="block h-2 w-3/4 rounded-full bg-neutral-200" />
          <span className="block h-2 w-4/5 rounded-full bg-neutral-100" />
        </div>
      )}
    </div>
  );
}

function PresentationThumbnail({
  title,
  imageUrl,
  detailColor,
}: {
  title: string;
  imageUrl?: string | null;
  detailColor?: string | null;
}) {
  return (
    <div className="relative h-24 overflow-hidden rounded-lg border border-border bg-secondary sm:h-48">
      {imageUrl ? (
        <Image
          src={imageUrl}
          alt={title}
          fill
          unoptimized
          sizes="(min-width: 1280px) 25vw, (min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
          className="object-cover transition duration-300 group-hover:scale-[1.03]"
        />
      ) : (
        <div className="flex h-full flex-col items-center justify-center gap-2 text-muted-foreground sm:gap-3">
          <div
            className="grid h-10 w-10 place-items-center rounded-xl border border-border bg-background sm:h-14 sm:w-14 sm:rounded-2xl"
            style={{ color: detailColor || "#A3E635" }}
          >
            <ImagePlus className="h-5 w-5 sm:h-6 sm:w-6" />
          </div>
          <span className="text-[10px] sm:text-xs">Sem arte enviada</span>
        </div>
      )}
      <span
        className="absolute left-3 top-3 h-2.5 w-2.5 rounded-full shadow"
        style={{ backgroundColor: detailColor || "#A3E635" }}
      />
    </div>
  );
}

function EmptyLibraryState({
  icon,
  title,
  description,
  actionLabel,
  onAction,
}: {
  icon: "copy" | "visual";
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  const Icon = icon === "copy" ? FileText : ImagePlus;

  return (
    <div className="rounded-2xl border border-dashed border-border bg-background p-10 text-center">
      <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl border border-border bg-background text-muted-foreground">
        <Icon className="h-5 w-5" />
      </div>
      <h3 className="sora-heading mt-4 text-base font-medium text-foreground">{title}</h3>
      <p className="mx-auto mt-2 max-w-sm text-sm text-muted-foreground">{description}</p>
      {actionLabel && onAction ? (
        <Button type="button" variant="ghostSecondary" size="sm" className="mt-5" onClick={onAction}>
          {actionLabel}
        </Button>
      ) : null}
    </div>
  );
}

export function ClientDetail({ clientId }: ClientDetailProps) {
  const router = useRouter();
  const { user: currentUser, loading: userLoading } = useCurrentUser();
  const isAdmin = isAdminUser(currentUser);
  const [client, setClient] = useState<Client | null>(null);
  const [copyPlannings, setCopyPlannings] = useState<CopyPlanningWithPreview[]>([]);
  const [visualPresentations, setVisualPresentations] = useState<VisualPresentation[]>([]);
  const [visualThumbnails, setVisualThumbnails] = useState<Record<string, string>>({});
  const [visualArtCounts, setVisualArtCounts] = useState<Record<string, number>>({});
  const [planningSearch, setPlanningSearch] = useState("");
  const [planningMonth, setPlanningMonth] = useState<MonthFilter>("all");
  const [planningSort, setPlanningSort] = useState<PlanningSort>("recent");
  const [presentationSearch, setPresentationSearch] = useState("");
  const [presentationMonth, setPresentationMonth] = useState<MonthFilter>("all");
  const [presentationType, setPresentationType] = useState<PresentationTypeFilter>("all");
  const [presentationSort, setPresentationSort] = useState<PresentationSort>("recent");
  const [isPlanningSearchOpen, setIsPlanningSearchOpen] = useState(false);
  const [isPlanningFilterSheetOpen, setIsPlanningFilterSheetOpen] = useState(false);
  const [isPresentationSearchOpen, setIsPresentationSearchOpen] = useState(false);
  const [isPresentationFilterSheetOpen, setIsPresentationFilterSheetOpen] = useState(false);
  const [showArchivedPlannings, setShowArchivedPlannings] = useState(false);
  const [showArchivedPresentations, setShowArchivedPresentations] = useState(false);
  const [planningSelectionMode, setPlanningSelectionMode] = useState(false);
  const [presentationSelectionMode, setPresentationSelectionMode] = useState(false);
  const [selectedPlanningIds, setSelectedPlanningIds] = useState<string[]>([]);
  const [selectedPresentationIds, setSelectedPresentationIds] = useState<string[]>([]);
  const [bulkActionLoading, setBulkActionLoading] = useState(false);
  const [libraryConfirmAction, setLibraryConfirmAction] = useState<LibraryConfirmAction>(null);
  const [clientProfileForm, setClientProfileForm] =
    useState<ClientProfileForm>(initialClientProfileForm);
  const [copyForm, setCopyForm] = useState<CopyPlanningForm>(initialCopyPlanningForm);
  const [visualForm, setVisualForm] =
    useState<VisualPresentationForm>(initialVisualPresentationForm);
  const [creationMode, setCreationMode] = useState<CreationMode>(null);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [origin, setOrigin] = useState("");
  const [loading, setLoading] = useState(true);
  const [savingCopy, setSavingCopy] = useState(false);
  const [savingVisual, setSavingVisual] = useState(false);
  const [savingClientProfile, setSavingClientProfile] = useState(false);
  const [uploadingClientLogo, setUploadingClientLogo] = useState(false);
  const [copiedLink, setCopiedLink] = useState<string | null>(null);
  const [copyPublicSlug, setCopyPublicSlug] = useState("");
  const [visualPublicSlug, setVisualPublicSlug] = useState("");
  const [copySlugLoading, setCopySlugLoading] = useState(false);
  const [visualSlugLoading, setVisualSlugLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [creationError, setCreationError] = useState<string | null>(null);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [profileMessage, setProfileMessage] = useState<string | null>(null);
  const [accessDenied, setAccessDenied] = useState(false);

  async function loadVisualThumbnails(presentations: VisualPresentation[], clientName?: string | null) {
    const presentationIds = presentations.map((presentation) => presentation.id);

    if (!presentationIds.length) {
      setVisualThumbnails({});
      setVisualArtCounts({});
      return presentations;
    }

    const { data: itemData } = await supabase
      .from("visual_items")
      .select("id, visual_presentation_id, image_url, display_date, format, weekday, notes, order_index, created_at")
      .in("visual_presentation_id", presentationIds)
      .order("order_index", { ascending: true })
      .order("created_at", { ascending: true });

    const itemRows = (itemData ?? []) as VisualItemThumbnailRow[];
    const thumbnailMap: Record<string, string> = {};
    const artCountMap = presentationIds.reduce<Record<string, number>>((counts, presentationId) => {
      counts[presentationId] = 0;
      return counts;
    }, {});
    const itemPresentationMap = new Map<string, string>();
    const imageCountByItem = new Map<string, number>();
    const itemsByPresentation = new Map<string, VisualItemWithImages[]>();
    const imagesByItem = new Map<string, VisualItemImageThumbnailRow[]>();

    itemRows.forEach((item) => {
      itemPresentationMap.set(item.id, item.visual_presentation_id);

      if (item.image_url && !thumbnailMap[item.visual_presentation_id]) {
        thumbnailMap[item.visual_presentation_id] = item.image_url;
      }
    });

    if (itemRows.length) {
      const { data: imageData } = await supabase
        .from("visual_item_images")
        .select("id, visual_item_id, image_url, order_index, created_at")
        .in(
          "visual_item_id",
          itemRows.map((item) => item.id),
        )
        .order("order_index", { ascending: true })
        .order("created_at", { ascending: true });

      ((imageData ?? []) as VisualItemImageThumbnailRow[]).forEach((image) => {
        const presentationId = itemPresentationMap.get(image.visual_item_id);

        imagesByItem.set(image.visual_item_id, [...(imagesByItem.get(image.visual_item_id) ?? []), image]);

        if (!image.image_url) {
          return;
        }

        imageCountByItem.set(
          image.visual_item_id,
          (imageCountByItem.get(image.visual_item_id) ?? 0) + 1,
        );

        if (presentationId && !thumbnailMap[presentationId]) {
          thumbnailMap[presentationId] = image.image_url;
        }
      });
    }

    itemRows.forEach((item) => {
      const presentationItems = itemsByPresentation.get(item.visual_presentation_id) ?? [];
      presentationItems.push({
        ...(item as unknown as VisualItem),
        images: (imagesByItem.get(item.id) ?? []) as unknown as VisualItemImage[],
      } as VisualItemWithImages);
      itemsByPresentation.set(item.visual_presentation_id, presentationItems);
    });

    itemRows.forEach((item) => {
      const imageCount = imageCountByItem.get(item.id);

      if (typeof imageCount === "number") {
        artCountMap[item.visual_presentation_id] += imageCount;
        return;
      }

      if (item.image_url) {
        artCountMap[item.visual_presentation_id] += 1;
      }
    });

    setVisualThumbnails(thumbnailMap);
    setVisualArtCounts(artCountMap);
    return Promise.all(
      presentations.map(async (presentation) => {
        const presentationItems = itemsByPresentation.get(presentation.id) ?? [];
        const range = getVisualPresentationDateRange(presentationItems);
        const effectiveClientName = clientName || client?.name || "Cliente";
        const localPresentation = applyAutomaticVisualPresentationRange(
          presentation,
          presentationItems,
          effectiveClientName,
        );

        if (!range) {
          return localPresentation;
        }

        const currentRange = visualPresentationDateRangeFromPresentation(presentation);
        const currentBaseSlug = buildVisualPresentationSlugBaseFromRange(effectiveClientName, currentRange);
        const nextBaseSlug = buildVisualPresentationSlugBaseFromRange(effectiveClientName, range);
        const preferredCandidate = visualPresentationPreferredSlug(
          presentation.public_slug,
          currentBaseSlug,
          nextBaseSlug,
        );
        const nextTitle = buildVisualPresentationTitleFromRange(effectiveClientName, range);

        try {
          const nextSlug = await resolveUniquePublicSlug("visual_presentations", nextBaseSlug, {
            excludeId: presentation.id,
            preferredCandidate,
          });
          const hasChanges =
            presentation.title !== nextTitle ||
            presentation.public_slug !== nextSlug ||
            presentation.period_label !== range.periodLabel ||
            presentation.start_display_date !== range.startLabel ||
            presentation.end_display_date !== range.endLabel;

          if (!hasChanges) {
            return localPresentation;
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
            .eq("id", presentation.id)
            .select("*")
            .maybeSingle();

          if (updateError) {
            setError(updateError.message);
            return localPresentation;
          }

          return applyAutomaticVisualPresentationRange(
            (data as VisualPresentation | null) ?? {
              ...presentation,
              title: nextTitle,
              public_slug: nextSlug,
              period_label: range.periodLabel,
              start_display_date: range.startLabel,
              end_display_date: range.endLabel,
            },
            presentationItems,
            effectiveClientName,
          );
        } catch (requestError) {
          setError(requestError instanceof Error ? requestError.message : "Erro ao atualizar link da apresentacao.");
          return localPresentation;
        }
      }),
    );
  }

  async function loadClient() {
    if (!currentUser) {
      if (!userLoading) setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    setAccessDenied(false);

    const [clientResult, copyResult, visualResult] = await Promise.all([
      supabase.from("clients").select("*").eq("id", clientId).is("deleted_at", null).maybeSingle(),
      supabase
        .from("copy_plannings")
        .select("*")
        .eq("client_id", clientId)
        .is("deleted_at", null)
        .order("created_at", { ascending: false }),
      supabase
        .from("visual_presentations")
        .select("*")
        .eq("client_id", clientId)
        .is("deleted_at", null)
        .order("created_at", { ascending: false }),
    ]);

    const firstError = clientResult.error || copyResult.error || visualResult.error;

    if (firstError) {
      setError(firstError.message);
    } else {
      if (clientResult.data && !canSeeClient(currentUser, clientResult.data)) {
        setClient(null);
        setCopyPlannings([]);
        setVisualPresentations([]);
        setAccessDenied(true);
        setLoading(false);
        return;
      }

      const visualData = ((visualResult.data ?? []) as VisualPresentation[]).sort((a, b) => createdTime(b) - createdTime(a));
      const enrichedVisualData = await loadVisualThumbnails(visualData, clientResult.data?.name);

      setClient(clientResult.data);
      setClientProfileForm({
        name: clientResult.data?.name || "",
        slug: clientResult.data?.slug || "",
        logoUrl: clientResult.data?.logo_url || null,
        primaryColor: clientResult.data?.primary_color || "#A3E635",
        secondaryColor:
          clientResult.data?.secondary_color ||
          clientResult.data?.primary_color ||
          "#A3E635",
        responsibleName: clientResult.data?.responsible_name || "",
      });
      setCopyPlannings(((copyResult.data ?? []) as CopyPlanningWithPreview[]).sort((a, b) => createdTime(b) - createdTime(a)));
      setVisualPresentations(enrichedVisualData);
    }

    setLoading(false);
  }

  useEffect(() => {
    setOrigin(window.location.origin);
    loadClient();
  }, [clientId, currentUser?.id, userLoading]);

  useEffect(() => {
    setPlanningSelectionMode(false);
    setSelectedPlanningIds([]);
  }, [showArchivedPlannings]);

  useEffect(() => {
    setPresentationSelectionMode(false);
    setSelectedPresentationIds([]);
  }, [showArchivedPresentations]);

  const copyPlanningMonthName = useMemo(
    () => getMonthNameFromDayMonth(copyForm.startDate) || "--",
    [copyForm.startDate],
  );
  const copyPlanningBaseTitle = useMemo(
    () => buildPlanningTitle(client?.name || "Cliente", copyForm.startDate),
    [client?.name, copyForm.startDate],
  );
  const copyBasePublicSlug = useMemo(
    () => buildPlanningSlug(client?.slug || client?.name || "cliente", copyPlanningMonthName),
    [client?.name, client?.slug, copyPlanningMonthName],
  );
  const copyPlanningSequence = useMemo(
    () =>
      nextPlanningSequenceForMonth(
        copyPlannings,
        copyForm.startDate,
        copyPlanningBaseTitle,
        copyBasePublicSlug,
      ),
    [copyBasePublicSlug, copyForm.startDate, copyPlanningBaseTitle, copyPlannings],
  );
  const copyPreferredPublicSlug = useMemo(
    () => buildPlanningSlug(client?.slug || client?.name || "cliente", copyPlanningMonthName, copyPlanningSequence),
    [client?.name, client?.slug, copyPlanningMonthName, copyPlanningSequence],
  );
  const copyPlanningTitle = useMemo(
    () =>
      buildPlanningTitle(
        client?.name || "Cliente",
        copyForm.startDate,
        planningSequenceFromSlug(copyPublicSlug || copyPreferredPublicSlug, copyBasePublicSlug) ??
          copyPlanningSequence,
      ),
    [client?.name, copyBasePublicSlug, copyForm.startDate, copyPlanningSequence, copyPreferredPublicSlug, copyPublicSlug],
  );
  const visualPresentationTitle = useMemo(
    () => buildPresentationTitle(client?.name || "Cliente", visualForm.startDate, visualForm.endDate),
    [client?.name, visualForm.startDate, visualForm.endDate],
  );
  const visualBasePublicSlug = useMemo(
    () => buildSlugFromTitle(visualPresentationTitle),
    [visualPresentationTitle],
  );

  useEffect(() => {
    let active = true;

    if (creationMode !== "copy" || !isValidDayMonth(copyForm.startDate)) {
      setCopyPublicSlug(copyPreferredPublicSlug);
      setCopySlugLoading(false);
      return () => {
        active = false;
      };
    }

    setCopySlugLoading(true);
    resolveUniquePublicSlug("copy_plannings", copyBasePublicSlug, {
      preferredCandidate: copyPreferredPublicSlug,
    })
      .then((slug) => {
        if (active) {
          setCopyPublicSlug(slug);
        }
      })
      .catch(() => {
        if (active) {
          setCopyPublicSlug(copyPreferredPublicSlug);
        }
      })
      .finally(() => {
        if (active) {
          setCopySlugLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [copyBasePublicSlug, copyForm.startDate, copyPreferredPublicSlug, creationMode]);

  useEffect(() => {
    let active = true;

    if (
      creationMode !== "visual" ||
      !isValidDayMonth(visualForm.startDate) ||
      !isValidDayMonth(visualForm.endDate)
    ) {
      setVisualPublicSlug(visualBasePublicSlug);
      setVisualSlugLoading(false);
      return () => {
        active = false;
      };
    }

    setVisualSlugLoading(true);
    resolveUniquePublicSlug("visual_presentations", visualBasePublicSlug)
      .then((slug) => {
        if (active) {
          setVisualPublicSlug(slug);
        }
      })
      .catch(() => {
        if (active) {
          setVisualPublicSlug(visualBasePublicSlug);
        }
      })
      .finally(() => {
        if (active) {
          setVisualSlugLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [creationMode, visualBasePublicSlug, visualForm.endDate, visualForm.startDate]);
  const isPlanningFilterActive =
    Boolean(planningSearch.trim()) || planningMonth !== "all" || planningSort !== "recent";
  const isPresentationFilterActive =
    Boolean(presentationSearch.trim()) ||
    presentationMonth !== "all" ||
    presentationType !== "all" ||
    presentationSort !== "recent";
  const scopedCopyPlannings = useMemo(
    () =>
      copyPlannings.filter((planning) =>
        showArchivedPlannings ? Boolean(planning.archived_at) : !planning.archived_at,
      ),
    [copyPlannings, showArchivedPlannings],
  );
  const scopedVisualPresentations = useMemo(
    () =>
      visualPresentations.filter((presentation) =>
        showArchivedPresentations ? Boolean(presentation.archived_at) : !presentation.archived_at,
      ),
    [showArchivedPresentations, visualPresentations],
  );
  const filteredCopyPlannings = useMemo(() => {
    const search = normalizedSearch(planningSearch);

    return [...scopedCopyPlannings]
      .filter((planning) => {
        const month = monthTagFromDayMonth(planning.start_display_date);
        const searchableText = normalizedSearch(`${planning.title} ${planning.public_slug}`);
        const matchesSearch = !search || searchableText.includes(search);
        const matchesMonth = planningMonth === "all" || month === planningMonth;

        return matchesSearch && matchesMonth;
      })
      .sort((firstPlanning, secondPlanning) => {
        if (planningSort === "oldest") {
          return createdTime(firstPlanning) - createdTime(secondPlanning);
        }

        if (planningSort === "az") {
          return firstPlanning.title.localeCompare(secondPlanning.title, "pt-BR");
        }

        if (planningSort === "za") {
          return secondPlanning.title.localeCompare(firstPlanning.title, "pt-BR");
        }

        if (planningSort === "more-content") {
          return planningContentScore(secondPlanning) - planningContentScore(firstPlanning);
        }

        if (planningSort === "less-content") {
          return planningContentScore(firstPlanning) - planningContentScore(secondPlanning);
        }

        return createdTime(secondPlanning) - createdTime(firstPlanning);
      });
  }, [planningMonth, planningSearch, planningSort, scopedCopyPlannings]);
  const filteredVisualPresentations = useMemo(() => {
    const search = normalizedSearch(presentationSearch);

    return [...scopedVisualPresentations]
      .filter((presentation) => {
        const month = monthTagFromDayMonth(presentation.start_display_date);
        const rawType = visualPresentationTypeValue(presentation);
        const type = normalizePresentationType(rawType);
        const typeLabel = getPresentationTypeLabel(rawType);
        const searchableText = normalizedSearch(
          `${presentation.title} ${presentation.public_slug} ${rawType ?? ""} ${typeLabel}`,
        );
        const matchesSearch = !search || searchableText.includes(search);
        const matchesMonth = presentationMonth === "all" || month === presentationMonth;
        const matchesType = presentationType === "all" || type === presentationType;

        return matchesSearch && matchesMonth && matchesType;
      })
      .sort((firstPresentation, secondPresentation) => {
        if (presentationSort === "oldest") {
          return createdTime(firstPresentation) - createdTime(secondPresentation);
        }

        if (presentationSort === "az") {
          return firstPresentation.title.localeCompare(secondPresentation.title, "pt-BR");
        }

        if (presentationSort === "za") {
          return secondPresentation.title.localeCompare(firstPresentation.title, "pt-BR");
        }

        if (presentationSort === "more-art") {
          return (visualArtCounts[secondPresentation.id] ?? 0) - (visualArtCounts[firstPresentation.id] ?? 0);
        }

        if (presentationSort === "less-art") {
          return (visualArtCounts[firstPresentation.id] ?? 0) - (visualArtCounts[secondPresentation.id] ?? 0);
        }

        return createdTime(secondPresentation) - createdTime(firstPresentation);
      });
  }, [
    presentationMonth,
    presentationSearch,
    presentationSort,
    presentationType,
    scopedVisualPresentations,
    visualArtCounts,
  ]);
  const planningCounterText = isPlanningFilterActive
    ? `${filteredCopyPlannings.length} de ${scopedCopyPlannings.length} documentos`
    : showArchivedPlannings
      ? `${scopedCopyPlannings.length} planejamento${scopedCopyPlannings.length === 1 ? "" : "s"} arquivado${scopedCopyPlannings.length === 1 ? "" : "s"}`
      : `${scopedCopyPlannings.length} documento${scopedCopyPlannings.length === 1 ? "" : "s"} criado${scopedCopyPlannings.length === 1 ? "" : "s"}`;
  const presentationCounterText = isPresentationFilterActive
    ? `${filteredVisualPresentations.length} de ${scopedVisualPresentations.length} pranchas`
    : showArchivedPresentations
      ? `${scopedVisualPresentations.length} apresentacao${scopedVisualPresentations.length === 1 ? "" : "s"} arquivada${scopedVisualPresentations.length === 1 ? "" : "s"}`
      : `${scopedVisualPresentations.length} prancha${scopedVisualPresentations.length === 1 ? "" : "s"} criada${scopedVisualPresentations.length === 1 ? "" : "s"}`;
  const activePresentationTypeTabIndex = Math.max(
    0,
    presentationTypeTabs.findIndex((tab) => tab.value === presentationType),
  );

  function resetPlanningFilters() {
    setPlanningSearch("");
    setPlanningMonth("all");
    setPlanningSort("recent");
    setIsPlanningSearchOpen(false);
    setIsPlanningFilterSheetOpen(false);
  }

  function resetPresentationFilters() {
    setPresentationSearch("");
    setPresentationMonth("all");
    setPresentationType("all");
    setPresentationSort("recent");
    setIsPresentationSearchOpen(false);
    setIsPresentationFilterSheetOpen(false);
  }

  function togglePlanningSelection(id: string) {
    setSelectedPlanningIds((current) =>
      current.includes(id)
        ? current.filter((selectedId) => selectedId !== id)
        : [...current, id],
    );
  }

  function togglePresentationSelection(id: string) {
    setSelectedPresentationIds((current) =>
      current.includes(id)
        ? current.filter((selectedId) => selectedId !== id)
        : [...current, id],
    );
  }

  function cancelPlanningSelection() {
    setPlanningSelectionMode(false);
    setSelectedPlanningIds([]);
  }

  function cancelPresentationSelection() {
    setPresentationSelectionMode(false);
    setSelectedPresentationIds([]);
  }

  async function updatePlanningArchive(ids: string[], archived: boolean) {
    if (!ids.length) return;

    setBulkActionLoading(true);
    setError(null);
    setProfileMessage(null);

    const { error: requestError } = await supabase
      .from("copy_plannings")
      .update({ archived_at: archived ? new Date().toISOString() : null } as never)
      .in("id", ids);

    if (requestError) {
      setError(requestError.message);
    } else {
      cancelPlanningSelection();
      await loadClient();
      setProfileMessage(
        archived
          ? ids.length === 1
            ? "Planejamento arquivado."
            : "Planejamentos arquivados."
          : ids.length === 1
            ? "Planejamento desarquivado."
            : "Planejamentos desarquivados.",
      );
    }

    setBulkActionLoading(false);
  }

  async function updatePresentationArchive(ids: string[], archived: boolean) {
    if (!ids.length) return;

    setBulkActionLoading(true);
    setError(null);
    setProfileMessage(null);

    const { error: requestError } = await supabase
      .from("visual_presentations")
      .update({ archived_at: archived ? new Date().toISOString() : null } as never)
      .in("id", ids);

    if (requestError) {
      setError(requestError.message);
    } else {
      cancelPresentationSelection();
      await loadClient();
      setProfileMessage(
        archived
          ? ids.length === 1
            ? "Apresentação arquivada."
            : "Apresentações arquivadas."
          : ids.length === 1
            ? "Apresentação desarquivada."
            : "Apresentações desarquivadas.",
      );
    }

    setBulkActionLoading(false);
  }

  async function deletePlannings(ids: string[]) {
    if (!ids.length) return;

    setBulkActionLoading(true);
    setError(null);
    setProfileMessage(null);

    const { error: requestError } = await supabase
      .from("copy_plannings")
      .update({ deleted_at: new Date().toISOString() } as never)
      .in("id", ids);

    if (requestError) {
      setError(requestError.message);
    } else {
      cancelPlanningSelection();
      await loadClient();
      setProfileMessage(ids.length === 1 ? "Planejamento excluído." : "Planejamentos excluídos.");
    }

    setBulkActionLoading(false);
  }

  async function deletePresentations(ids: string[]) {
    if (!ids.length) return;

    setBulkActionLoading(true);
    setError(null);
    setProfileMessage(null);

    const { error: requestError } = await supabase
      .from("visual_presentations")
      .update({ deleted_at: new Date().toISOString() } as never)
      .in("id", ids);

    if (requestError) {
      setError(requestError.message);
    } else {
      cancelPresentationSelection();
      await loadClient();
      setProfileMessage(ids.length === 1 ? "Apresentação excluída." : "Apresentações excluídas.");
    }

    setBulkActionLoading(false);
  }

  async function confirmLibraryAction() {
    if (!libraryConfirmAction) return;

    const action = libraryConfirmAction;

    if (action.kind === "archive-planning") await updatePlanningArchive(action.ids, true);
    if (action.kind === "unarchive-planning") await updatePlanningArchive(action.ids, false);
    if (action.kind === "delete-planning") await deletePlannings(action.ids);
    if (action.kind === "archive-presentation") await updatePresentationArchive(action.ids, true);
    if (action.kind === "unarchive-presentation") await updatePresentationArchive(action.ids, false);
    if (action.kind === "delete-presentation") await deletePresentations(action.ids);

    setLibraryConfirmAction(null);
  }

  const libraryConfirmConfig = libraryConfirmAction
    ? {
        title: libraryConfirmAction.kind.includes("delete")
          ? "Excluir item"
          : libraryConfirmAction.kind.includes("unarchive")
            ? "Desarquivar item"
            : "Arquivar item",
        message: libraryConfirmAction.kind.includes("delete")
          ? "Você tem certeza que quer excluir este item? Essa ação não poderá ser desfeita."
          : libraryConfirmAction.kind.includes("unarchive")
            ? "Você tem certeza que quer desarquivar este item? Ele voltará para a lista principal."
            : "Você tem certeza que quer arquivar este item? Ele sairá da lista principal e ficará disponível em Arquivados.",
        confirmLabel: libraryConfirmAction.kind.includes("delete")
          ? "Excluir"
          : libraryConfirmAction.kind.includes("unarchive")
            ? "Desarquivar"
            : "Arquivar",
      }
    : null;

  function openCreationModal(mode: Exclude<CreationMode, null>) {
    setError(null);
    setCreationError(null);

    if (mode === "visual") {
      void handleCreateVisualPresentation();
      return;
    }

    setCreationMode(mode);
  }

  function closeCreationModal() {
    setCreationMode(null);
    setCreationError(null);
    setCopyForm(initialCopyPlanningForm);
    setVisualForm(initialVisualPresentationForm);
  }

  function openProfileModal() {
    if (!client) return;

    setClientProfileForm({
      name: client.name,
      slug: client.slug,
      logoUrl: client.logo_url,
      primaryColor: client.primary_color || "#A3E635",
      secondaryColor: client.secondary_color || client.primary_color || "#A3E635",
      responsibleName: client.responsible_name || "",
    });
    setProfileError(null);
    setProfileMessage(null);
    setIsProfileModalOpen(true);
  }

  function closeProfileModal() {
    if (savingClientProfile || uploadingClientLogo) return;

    setIsProfileModalOpen(false);
    setProfileError(null);
  }

  async function handleCreateCopyPlanning(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (
      !isValidDayMonth(copyForm.startDate) ||
      !isValidDayMonth(copyForm.endDate)
    ) {
      setError("Preencha data inicial e data final do planejamento.");
      return;
    }

    setSavingCopy(true);
    setError(null);

    let uniquePublicSlug = copyPublicSlug || copyPreferredPublicSlug;

    try {
      uniquePublicSlug = await resolveUniquePublicSlug("copy_plannings", copyBasePublicSlug, {
        preferredCandidate: copyPreferredPublicSlug,
      });
    } catch (requestError) {
      setError(
        `Erro ao gerar link publico: ${
          requestError instanceof Error ? requestError.message : "tente novamente."
        }`,
      );
      setSavingCopy(false);
      return;
    }

    const finalSequence =
      planningSequenceFromSlug(uniquePublicSlug, copyBasePublicSlug) ?? copyPlanningSequence;
    const finalTitle = buildPlanningTitle(client?.name || "Cliente", copyForm.startDate, finalSequence);

    const newPlanning = {
      client_id: clientId,
      title: finalTitle,
      public_slug: uniquePublicSlug,
      period_label: buildPeriodLabel(copyForm.startDate, copyForm.endDate),
      start_display_date: copyForm.startDate,
      end_display_date: copyForm.endDate,
      document_content: "",
      status: "draft",
      is_public: true,
    };

    const { data, error: requestError } = await supabase
      .from("copy_plannings")
      .insert(newPlanning as never)
      .select("id")
      .maybeSingle();

    if (requestError) {
      setError(`Erro ao criar planejamento: ${requestError.message}`);
    } else {
      const newId = (data as { id?: string } | null)?.id;

      setCopyForm(initialCopyPlanningForm);
      setCreationMode(null);
      await loadClient();

      if (newId) {
        router.push(`/admin/planejamentos/${newId}`);
      }
    }

    setSavingCopy(false);
  }

  async function handleCreateVisualPresentation(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault();

    if (savingVisual) return;

    const presentationTypeValue = normalizePresentationTypeForSave(visualForm.presentationType);
    const presentationTitle = buildVisualPresentationTitleFromRange(client?.name || "Cliente");
    const basePublicSlug = buildVisualPresentationSlugBaseFromRange(client?.name || "Cliente");

    setSavingVisual(true);
    setCreationError(null);
    setError(null);

    let uniquePublicSlug = basePublicSlug;

    try {
      uniquePublicSlug = await resolveUniquePublicSlug("visual_presentations", basePublicSlug);
    } catch (requestError) {
      setError(
        `Erro ao gerar link publico: ${
          requestError instanceof Error ? requestError.message : "tente novamente."
        }`,
      );
      setSavingVisual(false);
      return;
    }

    const newPresentationBase = {
      client_id: clientId,
      title: presentationTitle,
      public_slug: uniquePublicSlug,
      period_label: null,
      start_display_date: null,
      end_display_date: null,
      detail_color: client?.primary_color || "#DFFF06",
      status: "draft",
      is_public: true,
    };

    const { data, error: requestError } = await supabase
      .from("visual_presentations")
      .insert({ ...newPresentationBase, presentation_type: presentationTypeValue } as never)
      .select("id")
      .maybeSingle();

    if (requestError) {
      setError(`Erro ao criar apresentacao: ${requestError.message}`);
    } else {
      const newId = (data as { id?: string } | null)?.id;

      setVisualForm(initialVisualPresentationForm);
      setCreationMode(null);
      await loadClient();

      if (newId) {
        router.push(`/admin/apresentacoes/${newId}`);
      }
    }

    setSavingVisual(false);
  }

  async function handleSaveClientProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!client) return;

    const nextName = clientProfileForm.name.trim();
    if (!nextName) {
      setProfileError("Informe o nome do cliente.");
      return;
    }

    setSavingClientProfile(true);
    setProfileError(null);

    const nextProfile = {
      name: nextName,
      logo_url: clientProfileForm.logoUrl || null,
      primary_color: clientProfileForm.primaryColor || "#A3E635",
      secondary_color:
        clientProfileForm.secondaryColor ||
        clientProfileForm.primaryColor ||
        "#A3E635",
      ...(isAdmin
        ? {
            responsible_name: clientProfileForm.responsibleName || null,
            assigned_user_name: clientProfileForm.responsibleName || null,
          }
        : {}),
      updated_at: new Date().toISOString(),
    };

    const { data, error: requestError } = await supabase
      .from("clients")
      .update(nextProfile as never)
      .eq("id", client.id)
      .select("*")
      .maybeSingle();

    if (requestError) {
      setProfileError(`Erro ao salvar perfil: ${requestError.message}`);
    } else {
      const updatedClient = ((data as Client | null) ?? {
        ...client,
        ...nextProfile,
      }) as Client;

      setClient(updatedClient);
      setClientProfileForm({
        name: updatedClient.name,
        slug: updatedClient.slug,
        logoUrl: updatedClient.logo_url,
        primaryColor: updatedClient.primary_color || "#A3E635",
        secondaryColor:
          updatedClient.secondary_color ||
          updatedClient.primary_color ||
          "#A3E635",
        responsibleName: updatedClient.responsible_name || "",
      });
      setIsProfileModalOpen(false);
      setProfileMessage("Perfil atualizado.");
    }

    setSavingClientProfile(false);
  }

  async function handleProfileLogoSelect(file: File) {
    if (!client) return;

    if (!isImageFile(file)) {
      setProfileError("Selecione um arquivo de imagem valido.");
      return;
    }

    setUploadingClientLogo(true);
    setProfileError(null);

    const optimizedLogoFile = await optimizeImage(file, "client-logo");
    const imagePath = `${client.id}/${Date.now()}-${safeStorageFileName(optimizedLogoFile.name)}`;
    const { error: uploadError } = await supabase.storage
      .from("client-logos")
      .upload(imagePath, optimizedLogoFile, {
        contentType: optimizedLogoFile.type || undefined,
        upsert: false,
      });

    if (uploadError) {
      setProfileError(`Erro ao subir logo: ${uploadError.message}`);
      setUploadingClientLogo(false);
      return;
    }

    const {
      data: { publicUrl },
    } = supabase.storage.from("client-logos").getPublicUrl(imagePath);

    setClientProfileForm((current) => ({ ...current, logoUrl: publicUrl }));

    setUploadingClientLogo(false);
  }

  async function copyLink(path: string) {
    const fullLink = `${origin}${path}`;

    await navigator.clipboard.writeText(fullLink);
    setCopiedLink(path);
    window.setTimeout(() => setCopiedLink(null), 1800);
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="pt-5 text-sm text-muted-foreground">
          Carregando cliente...
        </CardContent>
      </Card>
    );
  }

  if (!client) {
    return (
      <section className="space-y-4">
        <Button asChild variant="ghostSecondary">
          <Link href="/admin/clientes">
            <ArrowLeft className="h-4 w-4" />
            Voltar
          </Link>
        </Button>
        <Card>
          <CardContent className="pt-5 text-sm text-muted-foreground">
            {accessDenied ? "Você não tem acesso a este cliente." : "Cliente nao encontrado."}
          </CardContent>
        </Card>
      </section>
    );
  }

  const accentColor = client.primary_color || "#E5E7EB";

  return (
    <section className="space-y-4 md:space-y-8">
      <div className="relative flex flex-col gap-3 overflow-hidden rounded-xl border border-border bg-background p-3 pr-20 md:flex-row md:items-center md:justify-between md:rounded-2xl md:p-5 md:pr-28">
        <span className="absolute inset-x-0 top-0 h-1" style={{ backgroundColor: accentColor }} />
        <div className="absolute right-2 top-2 flex items-center gap-1 md:right-4 md:top-4">
          <Button asChild variant="ghostSecondary" size="icon" className="h-8 w-8 rounded-full md:h-9 md:w-9" title="Voltar para clientes">
            <Link href="/admin/clientes" aria-label="Voltar para clientes">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <Button
            type="button"
            variant="ghostSecondary"
            size="icon"
            className="h-8 w-8 rounded-full md:h-9 md:w-9"
            onClick={openProfileModal}
            aria-label="Editar perfil"
            title="Editar perfil"
          >
            <Pencil className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex min-w-0 items-center gap-3 md:gap-4">
          <ClientAvatarDisplay
            name={client.name}
            logoUrl={client.logo_url}
            accentColor={accentColor}
            className="h-12 w-12 text-base md:h-16 md:w-16 md:text-xl"
          />
          <div className="min-w-0">
            <div className="flex min-w-0 items-center gap-2">
              <h1 className="sora-heading mt-1 truncate text-xl font-medium text-foreground md:text-3xl">{client.name}</h1>
              <span className="mt-1 flex shrink-0 items-center gap-1.5" aria-label="Cores do cliente">
                <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: accentColor }} />
                <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: client.secondary_color || accentColor }} />
              </span>
            </div>
            <p className="mt-0.5 truncate text-[11px] text-muted-foreground md:mt-2 md:text-sm">
              /{client.slug} - criado em {formatDateBR(client.created_at)}
            </p>
            <p className="mt-0.5 text-[11px] text-muted-foreground md:mt-1 md:text-xs">
              Responsável: <span className="text-foreground">{client.responsible_name || "Sem responsável"}</span>
            </p>
          </div>
        </div>
      </div>

      <AutoDismissToast
        message={profileMessage}
        variant="success"
        onDismiss={() => setProfileMessage(null)}
      />
      <AutoDismissToast
        message={!creationMode ? error : null}
        variant="error"
        onDismiss={() => setError(null)}
      />

      <Tabs defaultValue="planejamentos" className="space-y-4 md:space-y-6">
        <TabsList className="grid h-auto w-full grid-cols-2 gap-2 border-0 bg-transparent p-0 md:gap-3">
          <TabsTrigger
            value="planejamentos"
            className="group h-auto justify-start gap-1.5 rounded-xl border border-border bg-background p-2.5 text-left text-muted-foreground shadow-none data-[state=active]:border-neutral-300 data-[state=active]:bg-background data-[state=active]:text-neutral-950 data-[state=active]:shadow-none dark:data-[state=active]:border-white/20 dark:data-[state=active]:bg-background dark:data-[state=active]:text-neutral-100 sm:gap-3 sm:p-4"
          >
            <span className="grid h-6 w-6 shrink-0 place-items-center text-muted-foreground transition-colors group-hover:text-foreground group-data-[state=active]:text-neutral-950 dark:group-data-[state=active]:text-neutral-100 sm:h-8 sm:w-8">
              <FileText className="h-4 w-4 sm:h-6 sm:w-6" />
            </span>
            <span className="flex flex-col items-start">
              <span className="text-sm font-medium leading-none sm:text-base">Planejamentos</span>
              <span className="mt-1 hidden text-xs font-normal opacity-75 sm:inline">
                Documentos mensais
              </span>
            </span>
          </TabsTrigger>
          <TabsTrigger
            value="apresentacoes"
            className="group h-auto justify-start gap-1.5 rounded-xl border border-border bg-background p-2.5 text-left text-muted-foreground shadow-none data-[state=active]:border-neutral-300 data-[state=active]:bg-background data-[state=active]:text-neutral-950 data-[state=active]:shadow-none dark:data-[state=active]:border-white/20 dark:data-[state=active]:bg-background dark:data-[state=active]:text-neutral-100 sm:gap-3 sm:p-4"
          >
            <span className="grid h-6 w-6 shrink-0 place-items-center text-muted-foreground transition-colors group-hover:text-foreground group-data-[state=active]:text-neutral-950 dark:group-data-[state=active]:text-neutral-100 sm:h-8 sm:w-8">
              <ImagePlus className="h-4 w-4 sm:h-6 sm:w-6" />
            </span>
            <span className="flex flex-col items-start">
              <span className="text-sm font-medium leading-none sm:text-base">Apresentações</span>
              <span className="mt-1 hidden text-xs font-normal opacity-75 sm:inline">
                Pranchas visuais
              </span>
            </span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="planejamentos" className="space-y-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <h2 className="sora-heading text-xl font-medium text-foreground">Planejamentos</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {planningCounterText}
              </p>
            </div>

            <div className="no-scrollbar flex max-w-full flex-nowrap items-center gap-1.5 overflow-x-auto sm:flex-wrap sm:justify-end sm:gap-2">
              <LibraryCreateButton
                label="Criar novo planejamento"
                onClick={() => openCreationModal("copy")}
              />

              <Button
                type="button"
                variant="ghostSecondary"
                className={cn(sectionIconButtonClass, planningSelectionMode && "border-foreground/30 text-foreground")}
                onClick={() => {
                  setPlanningSelectionMode((current) => !current);
                  setSelectedPlanningIds([]);
                }}
                aria-label="Selecionar planejamentos"
                title="Selecionar planejamentos"
              >
                <CheckSquare2 className="h-4 w-4" />
              </Button>

              <Button
                type="button"
                variant="ghostSecondary"
                className={cn(sectionIconButtonClass, showArchivedPlannings && "border-foreground/30 text-foreground")}
                onClick={() => setShowArchivedPlannings((current) => !current)}
                aria-label="Arquivados"
                title="Arquivados"
              >
                <Archive className="h-4 w-4" />
              </Button>

              <InlineSearchControl
                isOpen={isPlanningSearchOpen}
                value={planningSearch}
                placeholder="Buscar planejamento ou conteúdo..."
                label="Buscar planejamentos"
                onOpenChange={setIsPlanningSearchOpen}
                onValueChange={setPlanningSearch}
              />

              <div className="relative">
                <Button
                  type="button"
                  variant="ghostSecondary"
                  className={cn(sectionIconButtonClass, isPlanningFilterActive && "border-foreground/30 text-foreground")}
                  onClick={() => setIsPlanningFilterSheetOpen((current) => !current)}
                  aria-label="Filtrar planejamentos"
                  title="Filtrar planejamentos"
                >
                  <SlidersHorizontal className="h-4 w-4" />
                </Button>

                {isPlanningFilterSheetOpen ? (
                  <div className={filterPopoverClass}>
                    <div className="grid gap-3">
                      <select
                        value={planningMonth}
                        onChange={(event) => setPlanningMonth(event.target.value)}
                        className={cn("flex h-10 rounded-md border px-3 py-2 text-sm", compactControlClass)}
                      >
                        <option value="all">Todos os meses</option>
                        {monthAbbreviations.map((month) => (
                          <option key={month} value={month}>
                            {month}
                          </option>
                        ))}
                      </select>
                      <select
                        value={planningSort}
                        onChange={(event) => setPlanningSort(event.target.value as PlanningSort)}
                        className={cn("flex h-10 rounded-md border px-3 py-2 text-sm", compactControlClass)}
                      >
                        <option value="recent">Mais recentes</option>
                        <option value="oldest">Mais antigos</option>
                        <option value="az">A-Z</option>
                        <option value="za">Z-A</option>
                        <option value="more-content">Mais conteúdo</option>
                        <option value="less-content">Menos conteúdo</option>
                      </select>
                      {isPlanningFilterActive ? (
                        <Button
                          type="button"
                          variant="ghostSecondary"
                          className="h-9 justify-center focus-visible:ring-0"
                          onClick={resetPlanningFilters}
                        >
                          Limpar filtros
                        </Button>
                      ) : null}
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          </div>

          {planningSelectionMode ? (
            <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-background px-3 py-2 text-sm text-muted-foreground">
              <span className="mr-auto font-medium text-foreground">
                {selectedPlanningIds.length} selecionado{selectedPlanningIds.length === 1 ? "" : "s"}
              </span>
              {selectedPlanningIds.length ? (
                showArchivedPlannings ? (
                  <Button
                    type="button"
                    variant="ghostSecondary"
                    size="sm"
                    onClick={() =>
                      setLibraryConfirmAction({ kind: "unarchive-planning", ids: selectedPlanningIds })
                    }
                    disabled={bulkActionLoading}
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                    Desarquivar
                  </Button>
                ) : (
                  <Button
                    type="button"
                    variant="ghostSecondary"
                    size="sm"
                    onClick={() =>
                      setLibraryConfirmAction({ kind: "archive-planning", ids: selectedPlanningIds })
                    }
                    disabled={bulkActionLoading}
                  >
                    <Archive className="h-3.5 w-3.5" />
                    Arquivar
                  </Button>
                )
              ) : null}
              {selectedPlanningIds.length ? (
                <Button
                  type="button"
                  variant="ghostSecondary"
                  size="sm"
                  onClick={() => setLibraryConfirmAction({ kind: "delete-planning", ids: selectedPlanningIds })}
                  disabled={bulkActionLoading}
                  className="text-muted-foreground hover:bg-rose-500/10 hover:text-rose-500"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Excluir
                </Button>
              ) : null}
              <Button type="button" variant="ghostSecondary" size="sm" onClick={cancelPlanningSelection}>
                Cancelar seleção
              </Button>
            </div>
          ) : null}

          {filteredCopyPlannings.length ? (
            <div className="grid grid-cols-2 gap-2.5 sm:gap-5 lg:grid-cols-3 xl:grid-cols-4">
              {filteredCopyPlannings.map((planning) => {
                const publicPath = `/p/${planning.public_slug}`;
                const previewText = extractPreviewText(
                  planning.posts_content || planning.document_content,
                  client.name,
                );
                const planningMonthTag = monthTagFromDayMonth(planning.start_display_date);
                const isSelected = selectedPlanningIds.includes(planning.id);
                const isArchived = Boolean(planning.archived_at);

                return (
                  <article
                    key={planning.id}
                    role="link"
                    tabIndex={0}
                    onClick={() =>
                      planningSelectionMode
                        ? togglePlanningSelection(planning.id)
                        : router.push(`/admin/planejamentos/${planning.id}`)
                    }
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        if (planningSelectionMode) {
                          togglePlanningSelection(planning.id);
                        } else {
                          router.push(`/admin/planejamentos/${planning.id}`);
                        }
                      }
                    }}
                    className={cn(
                      "group relative flex min-w-0 cursor-pointer flex-col rounded-xl border bg-background p-2 transition hover:-translate-y-0.5 hover:border-foreground/25 sm:min-h-[374px] sm:rounded-2xl sm:p-3",
                      isSelected
                        ? "border-blue-400 bg-neutral-900/[0.045] dark:border-blue-400/60 dark:bg-white/[0.06]"
                        : "border-border",
                      isArchived && !isSelected && "border-dashed opacity-70",
                    )}
                  >
                    {planningSelectionMode ? (
                      <span
                        className="absolute left-3 top-3 z-10 grid h-7 w-7 place-items-center rounded-md border border-border bg-background text-foreground"
                        aria-hidden="true"
                      >
                        {isSelected ? <CheckSquare2 className="h-4 w-4" /> : <Square className="h-4 w-4" />}
                      </span>
                    ) : null}
                    <DocumentThumbnail
                      preview={previewText}
                      accentColor={isArchived ? "#D4D4D8" : accentColor}
                    />
                    <div className="flex flex-1 flex-col space-y-1.5 px-0.5 pb-0.5 pt-2 sm:space-y-3 sm:px-1 sm:pb-1 sm:pt-4">
                      <div className="flex items-start justify-between gap-1.5 sm:gap-2">
                        <h3 className="sora-heading line-clamp-2 min-w-0 text-xs font-medium leading-snug text-foreground sm:text-base">
                          {planning.title}
                        </h3>
                        <div className="flex shrink-0 flex-col items-end gap-1">
                          {planningMonthTag ? <InfoTag>{planningMonthTag}</InfoTag> : null}
                          {isArchived ? <InfoTag>Arquivado</InfoTag> : null}
                        </div>
                      </div>
                      <div className="space-y-0.5 text-[10px] leading-snug text-muted-foreground sm:space-y-1 sm:text-xs">
                        <p className="line-clamp-2">{planning.period_label || "Periodo nao definido"}</p>
                        <p className="hidden sm:block">Criado em {formatDateBR(planning.created_at)}</p>
                      </div>
                      <div className="mt-auto flex items-center justify-between gap-1 pt-1 sm:gap-1.5">
                        <div className="flex min-w-0 items-center gap-0.5 sm:gap-1.5">
                          <Button
                            type="button"
	                            variant="ghostSecondary"
	                            size="icon"
	                            className="h-7 w-7 bg-transparent hover:bg-neutral-900/5 dark:hover:bg-white/[0.08] sm:h-8 sm:w-8"
	                            onClick={(event) => {
	                              stopCardClick(event);
	                              copyLink(publicPath);
	                            }}
	                            aria-label="Copiar link"
	                            title={copiedLink === publicPath ? "Link copiado" : "Copiar link"}
	                          >
	                            <Clipboard className="h-3.5 w-3.5" />
	                          </Button>
	                          <Button
	                            asChild
	                            variant="ghostSecondary"
	                            size="icon"
	                            className="h-7 w-7 bg-transparent hover:bg-neutral-900/5 dark:hover:bg-white/[0.08] sm:h-8 sm:w-8"
	                          >
	                            <Link
	                              href={publicPath}
	                              target="_blank"
	                              rel="noreferrer"
	                              onClick={stopCardClick}
	                              aria-label="Abrir público"
	                              title="Abrir público"
	                            >
	                              <ExternalLink className="h-3.5 w-3.5" />
	                            </Link>
	                          </Button>
                        </div>
                        <div className="ml-auto flex shrink-0 items-center gap-0.5 sm:gap-1.5">
                          <Button
                            type="button"
                            variant="ghostSecondary"
                            size="icon"
                            className="h-7 w-7 bg-transparent hover:bg-neutral-900/5 dark:hover:bg-white/[0.08] sm:h-8 sm:w-8"
                            onClick={(event) => {
                              stopCardClick(event);
                              setLibraryConfirmAction({
                                kind: isArchived ? "unarchive-planning" : "archive-planning",
                                ids: [planning.id],
                              });
                            }}
                            aria-label={isArchived ? "Desarquivar planejamento" : "Arquivar planejamento"}
                            title={isArchived ? "Desarquivar" : "Arquivar"}
                          >
	                            {isArchived ? <RotateCcw className="h-3.5 w-3.5" /> : <Archive className="h-3.5 w-3.5" />}
	                          </Button>
	                          <Button
	                            type="button"
	                            variant="ghostSecondary"
	                            size="icon"
	                            className="h-7 w-7 bg-transparent text-muted-foreground hover:bg-rose-500/10 hover:text-rose-500 sm:h-8 sm:w-8"
	                            onClick={(event) => {
	                              stopCardClick(event);
	                              setLibraryConfirmAction({ kind: "delete-planning", ids: [planning.id] });
	                            }}
	                            aria-label="Excluir planejamento"
	                            title="Excluir"
	                          >
	                            <Trash2 className="h-3.5 w-3.5" />
	                          </Button>
                        </div>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          ) : (
            <EmptyLibraryState
              icon="copy"
              title={
                isPlanningFilterActive
                  ? "Nenhum planejamento encontrado com esses filtros."
                  : showArchivedPlannings
                    ? "Nenhum planejamento arquivado."
                  : "Nenhum planejamento criado"
              }
              description={
                isPlanningFilterActive
                  ? "Limpe os filtros ou ajuste a busca para ver outros documentos."
                  : showArchivedPlannings
                    ? "Planejamentos arquivados aparecem aqui quando forem movidos da lista ativa."
                  : "Use o botao de adicionar para criar o primeiro documento mensal deste cliente."
              }
              actionLabel={isPlanningFilterActive ? "Limpar filtros" : undefined}
              onAction={isPlanningFilterActive ? resetPlanningFilters : undefined}
            />
          )}
        </TabsContent>

        <TabsContent value="apresentacoes" className="space-y-5">
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="sora-heading text-xl font-medium text-foreground">Apresentações</h2>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                {presentationCounterText}
              </p>
            </div>

            <div className="no-scrollbar flex max-w-full flex-nowrap items-center gap-1.5 overflow-x-auto md:flex-wrap md:justify-end md:gap-2">
              <LibraryCreateButton
                label="Criar nova apresentacao"
                onClick={() => openCreationModal("visual")}
              />

              <Button
                type="button"
                variant="ghostSecondary"
                className={cn(sectionIconButtonClass, presentationSelectionMode && "border-foreground/30 text-foreground")}
                onClick={() => {
                  setPresentationSelectionMode((current) => !current);
                  setSelectedPresentationIds([]);
                }}
                aria-label="Selecionar apresentações"
                title="Selecionar apresentações"
              >
                <CheckSquare2 className="h-4 w-4" />
              </Button>

              <Button
                type="button"
                variant="ghostSecondary"
                className={cn(sectionIconButtonClass, showArchivedPresentations && "border-foreground/30 text-foreground")}
                onClick={() => setShowArchivedPresentations((current) => !current)}
                aria-label="Arquivadas"
                title="Arquivadas"
              >
                <Archive className="h-4 w-4" />
              </Button>

              <InlineSearchControl
                isOpen={isPresentationSearchOpen}
                value={presentationSearch}
                placeholder="Buscar apresentação..."
                label="Buscar apresentações"
                onOpenChange={setIsPresentationSearchOpen}
                onValueChange={setPresentationSearch}
              />

              <div className="relative">
                <Button
                  type="button"
                  variant="ghostSecondary"
                  className={cn(sectionIconButtonClass, isPresentationFilterActive && "border-foreground/30 text-foreground")}
                  onClick={() => setIsPresentationFilterSheetOpen((current) => !current)}
                  aria-label="Filtrar apresentações"
                  title="Filtrar apresentações"
                >
                  <SlidersHorizontal className="h-4 w-4" />
                </Button>

                {isPresentationFilterSheetOpen ? (
                  <div className={filterPopoverClass}>
                    <div className="grid gap-3">
                      <select
                        value={presentationMonth}
                        onChange={(event) => setPresentationMonth(event.target.value)}
                        className={cn("flex h-10 rounded-md border px-3 py-2 text-sm", compactControlClass)}
                      >
                        <option value="all">Todos os meses</option>
                        {monthAbbreviations.map((month) => (
                          <option key={month} value={month}>
                            {month}
                          </option>
                        ))}
                      </select>
                      <select
                        value={presentationSort}
                        onChange={(event) => setPresentationSort(event.target.value as PresentationSort)}
                        className={cn("flex h-10 rounded-md border px-3 py-2 text-sm", compactControlClass)}
                      >
                        <option value="recent">Mais recentes</option>
                        <option value="oldest">Mais antigas</option>
                        <option value="az">A-Z</option>
                        <option value="za">Z-A</option>
                        <option value="more-art">Mais artes</option>
                        <option value="less-art">Menos artes</option>
                      </select>
                      {isPresentationFilterActive ? (
                        <Button
                          type="button"
                          variant="ghostSecondary"
                          className="h-9 justify-center focus-visible:ring-0"
                          onClick={resetPresentationFilters}
                        >
                          Limpar filtros
                        </Button>
                      ) : null}
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          </div>

          <div className="no-scrollbar w-full max-w-full overflow-x-auto pb-1">
            <div className="relative grid h-9 min-w-[288px] max-w-full grid-cols-4 rounded-lg border border-border bg-background p-1 sm:w-[390px] md:h-10">
              <span
                className="absolute bottom-1 left-1 top-1 rounded-md bg-neutral-200/80 transition-transform duration-200 ease-out dark:bg-white/[0.08]"
                style={{
                  width: "calc((100% - 0.5rem) / 4)",
                  transform: `translateX(${activePresentationTypeTabIndex * 100}%)`,
                }}
                aria-hidden="true"
              />
              {presentationTypeTabs.map((tab) => {
                const isActive = presentationType === tab.value;

                return (
                  <button
                    key={tab.value}
                    type="button"
                    onClick={() => setPresentationType(tab.value)}
                    className={cn(
                      "relative z-10 h-7 rounded-md px-1.5 text-[10px] font-medium text-muted-foreground transition-colors hover:text-foreground sm:h-8 sm:px-2 sm:text-[11px]",
                      isActive && "text-foreground dark:text-foreground",
                    )}
                  >
                    {tab.label}
                  </button>
                );
              })}
            </div>
          </div>

          {presentationSelectionMode ? (
            <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-background px-3 py-2 text-sm text-muted-foreground">
              <span className="mr-auto font-medium text-foreground">
                {selectedPresentationIds.length} selecionada{selectedPresentationIds.length === 1 ? "" : "s"}
              </span>
              {selectedPresentationIds.length ? (
                showArchivedPresentations ? (
                  <Button
                    type="button"
                    variant="ghostSecondary"
                    size="sm"
                    onClick={() =>
                      setLibraryConfirmAction({ kind: "unarchive-presentation", ids: selectedPresentationIds })
                    }
                    disabled={bulkActionLoading}
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                    Desarquivar
                  </Button>
                ) : (
                  <Button
                    type="button"
                    variant="ghostSecondary"
                    size="sm"
                    onClick={() =>
                      setLibraryConfirmAction({ kind: "archive-presentation", ids: selectedPresentationIds })
                    }
                    disabled={bulkActionLoading}
                  >
                    <Archive className="h-3.5 w-3.5" />
                    Arquivar
                  </Button>
                )
              ) : null}
              {selectedPresentationIds.length ? (
                <Button
                  type="button"
                  variant="ghostSecondary"
                  size="sm"
                  onClick={() =>
                    setLibraryConfirmAction({ kind: "delete-presentation", ids: selectedPresentationIds })
                  }
                  disabled={bulkActionLoading}
                  className="text-muted-foreground hover:bg-rose-500/10 hover:text-rose-500"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Excluir
                </Button>
              ) : null}
              <Button type="button" variant="ghostSecondary" size="sm" onClick={cancelPresentationSelection}>
                Cancelar seleção
              </Button>
            </div>
          ) : null}

          {filteredVisualPresentations.length ? (
            <div className="grid grid-cols-2 gap-2.5 sm:gap-5 lg:grid-cols-2 2xl:grid-cols-3">
              {filteredVisualPresentations.map((presentation) => {
                const publicPath = `/a/${presentation.public_slug}`;
                const presentationMonthName = monthNameFromDayMonth(presentation.start_display_date);
                const presentationTypeTag = getPresentationTypeLabel(visualPresentationTypeValue(presentation)).toUpperCase();
                const isSelected = selectedPresentationIds.includes(presentation.id);
                const isArchived = Boolean(presentation.archived_at);
                const detailColor = isArchived ? "#D4D4D8" : accentColor;

                return (
                  <article
                    key={presentation.id}
                    role="link"
                    tabIndex={0}
                    onClick={() =>
                      presentationSelectionMode
                        ? togglePresentationSelection(presentation.id)
                        : router.push(`/admin/apresentacoes/${presentation.id}`)
                    }
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        if (presentationSelectionMode) {
                          togglePresentationSelection(presentation.id);
                        } else {
                          router.push(`/admin/apresentacoes/${presentation.id}`);
                        }
                      }
                    }}
                    className={cn(
                      "group relative min-w-0 cursor-pointer rounded-xl border bg-background p-2 transition hover:-translate-y-0.5 hover:border-foreground/25 sm:rounded-2xl sm:p-4",
                      isSelected
                        ? "border-blue-400 bg-neutral-900/[0.045] dark:border-blue-400/60 dark:bg-white/[0.06]"
                        : "border-border",
                      isArchived && !isSelected && "border-dashed opacity-70",
                    )}
                  >
                    {presentationSelectionMode ? (
                      <span
                        className="absolute left-3 top-3 z-10 grid h-7 w-7 place-items-center rounded-md border border-border bg-background text-foreground"
                        aria-hidden="true"
                      >
                        {isSelected ? <CheckSquare2 className="h-4 w-4" /> : <Square className="h-4 w-4" />}
                      </span>
                    ) : null}
                    <PresentationThumbnail
                      title={presentation.title}
                      imageUrl={visualThumbnails[presentation.id]}
                      detailColor={detailColor}
                    />
                    <div className="space-y-1.5 px-0.5 pb-0.5 pt-2 sm:space-y-3 sm:px-1 sm:pb-1 sm:pt-4">
	                      <div className="flex items-start justify-between gap-1.5 sm:gap-2">
	                        <div className="flex min-w-0 flex-1 flex-wrap items-start gap-1 sm:gap-2">
	                          <h3 className="sora-heading line-clamp-2 min-w-0 text-xs font-medium leading-snug text-foreground sm:text-base">
	                            {presentation.title}
	                          </h3>
	                          {presentationMonthName ? <PresentationMonthTag>{presentationMonthName}</PresentationMonthTag> : null}
                            <InfoTag>{presentationTypeTag}</InfoTag>
	                        </div>
	                        {isArchived ? <InfoTag>Arquivada</InfoTag> : null}
	                      </div>
                      <div className="space-y-0.5 text-[10px] leading-snug text-muted-foreground sm:space-y-1 sm:text-xs">
                        <p className="line-clamp-2">{presentation.period_label || "Periodo nao definido"}</p>
                        <p className="hidden sm:block">Criada em {formatDateBR(presentation.created_at)}</p>
                      </div>
                      <div className="flex items-center gap-1 pt-1 sm:gap-2">
                        <div className="flex min-w-0 items-center gap-0.5 sm:gap-1.5">
                          <Button
                            type="button"
	                            variant="ghostSecondary"
	                            size="icon"
	                            className="h-7 w-7 bg-transparent hover:bg-neutral-900/5 dark:hover:bg-white/[0.08] sm:h-8 sm:w-8"
	                            onClick={(event) => {
	                              stopCardClick(event);
	                              copyLink(publicPath);
	                            }}
	                            aria-label="Copiar link"
	                            title={copiedLink === publicPath ? "Link copiado" : "Copiar link"}
	                          >
	                            <Clipboard className="h-3.5 w-3.5" />
	                          </Button>
	                          <Button
	                            asChild
	                            variant="ghostSecondary"
	                            size="icon"
	                            className="h-7 w-7 bg-transparent hover:bg-neutral-900/5 dark:hover:bg-white/[0.08] sm:h-8 sm:w-8"
	                          >
	                            <Link
	                              href={publicPath}
	                              target="_blank"
	                              rel="noreferrer"
	                              onClick={stopCardClick}
	                              aria-label="Abrir público"
	                              title="Abrir público"
	                            >
	                              <ExternalLink className="h-3.5 w-3.5" />
	                            </Link>
	                          </Button>
                        </div>
                        <div className="ml-auto flex min-w-0 shrink-0 items-center justify-end gap-0.5 pl-1 sm:gap-1.5 sm:pl-3">
                          <Button
                            type="button"
                            variant="ghostSecondary"
                            size="icon"
                            className="h-7 w-7 bg-transparent hover:bg-neutral-900/5 dark:hover:bg-white/[0.08] sm:h-8 sm:w-8"
                            onClick={(event) => {
                              stopCardClick(event);
                              setLibraryConfirmAction({
                                kind: isArchived ? "unarchive-presentation" : "archive-presentation",
                                ids: [presentation.id],
                              });
                            }}
                            aria-label={isArchived ? "Desarquivar apresentação" : "Arquivar apresentação"}
                            title={isArchived ? "Desarquivar" : "Arquivar"}
                          >
	                            {isArchived ? <RotateCcw className="h-3.5 w-3.5" /> : <Archive className="h-3.5 w-3.5" />}
	                          </Button>
	                          <Button
	                            type="button"
	                            variant="ghostSecondary"
	                            size="icon"
	                            className="h-7 w-7 bg-transparent text-muted-foreground hover:bg-rose-500/10 hover:text-rose-500 sm:h-8 sm:w-8"
	                            onClick={(event) => {
	                              stopCardClick(event);
	                              setLibraryConfirmAction({ kind: "delete-presentation", ids: [presentation.id] });
	                            }}
	                            aria-label="Excluir apresentação"
	                            title="Excluir"
	                          >
	                            <Trash2 className="h-3.5 w-3.5" />
	                          </Button>
                        </div>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          ) : (
            <EmptyLibraryState
              icon="visual"
              title={
                isPresentationFilterActive
                  ? "Nenhuma apresentação encontrada com esses filtros."
                  : showArchivedPresentations
                    ? "Nenhuma apresentação arquivada."
                  : "Nenhuma apresentacao criada"
              }
              description={
                isPresentationFilterActive
                  ? "Limpe os filtros ou ajuste a busca para ver outras pranchas."
                  : showArchivedPresentations
                    ? "Apresentações arquivadas aparecem aqui quando forem movidas da lista ativa."
                  : "Use o botao de adicionar para criar a primeira prancha visual deste cliente."
              }
              actionLabel={isPresentationFilterActive ? "Limpar filtros" : undefined}
              onAction={isPresentationFilterActive ? resetPresentationFilters : undefined}
            />
          )}
        </TabsContent>
	      </Tabs>

	      {libraryConfirmConfig ? (
	        <div
	          className="fixed inset-0 z-[120] grid place-items-center bg-black/40 px-4"
	          onClick={() => {
	            if (!bulkActionLoading) setLibraryConfirmAction(null);
	          }}
	        >
	          <div
	            className="w-full max-w-md rounded-2xl border border-border bg-background p-5 shadow-none"
	            onClick={(event) => event.stopPropagation()}
	          >
	            <h2 className="sora-heading text-xl font-medium text-foreground">{libraryConfirmConfig.title}</h2>
	            <p className="mt-3 text-sm leading-6 text-muted-foreground">{libraryConfirmConfig.message}</p>
	            <div className="mt-6 flex justify-end gap-3">
	              <Button
	                type="button"
	                variant="ghostSecondary"
	                onClick={() => setLibraryConfirmAction(null)}
	                disabled={bulkActionLoading}
	              >
	                Cancelar
	              </Button>
	              <Button
	                type="button"
	                onClick={confirmLibraryAction}
	                disabled={bulkActionLoading}
	                className={
	                  libraryConfirmAction?.kind.includes("delete")
	                    ? "bg-rose-600 text-white hover:bg-rose-600/90"
	                    : "bg-[var(--zacx-brand)] text-white hover:opacity-90 dark:text-black"
	                }
	              >
	                {bulkActionLoading ? "Processando..." : libraryConfirmConfig.confirmLabel}
	              </Button>
	            </div>
	          </div>
	        </div>
	      ) : null}

	      {isPlanningFilterSheetOpen ? (
        <div
          className="fixed inset-0 z-[110] grid place-items-end bg-black/40 p-3 dark:bg-black/60 md:hidden"
          onClick={() => setIsPlanningFilterSheetOpen(false)}
        >
          <div
            className="w-full rounded-2xl border border-border bg-background p-4"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-base font-medium text-foreground">Filtros</h2>
              <Button type="button" variant="ghostSecondary" size="icon" onClick={() => setIsPlanningFilterSheetOpen(false)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="mt-4 grid gap-3">
              <select
                value={planningMonth}
                onChange={(event) => setPlanningMonth(event.target.value)}
                className={cn("flex h-11 rounded-md border px-3 py-2 text-sm", compactControlClass)}
              >
                <option value="all">Todos os meses</option>
                {monthAbbreviations.map((month) => (
                  <option key={month} value={month}>
                    {month}
                  </option>
                ))}
              </select>
              <select
                value={planningSort}
                onChange={(event) => setPlanningSort(event.target.value as PlanningSort)}
                className={cn("flex h-11 rounded-md border px-3 py-2 text-sm", compactControlClass)}
              >
                <option value="recent">Mais recentes</option>
                <option value="oldest">Mais antigos</option>
                <option value="az">A-Z</option>
                <option value="za">Z-A</option>
                <option value="more-content">Mais conteúdo</option>
                <option value="less-content">Menos conteúdo</option>
              </select>
              <div className="flex gap-2 pt-1">
                {isPlanningFilterActive ? (
                  <Button type="button" variant="ghostSecondary" className="flex-1 focus-visible:ring-0" onClick={resetPlanningFilters}>
                    Limpar filtros
                  </Button>
                ) : null}
                <Button type="button" className="flex-1 focus-visible:ring-0" onClick={() => setIsPlanningFilterSheetOpen(false)}>
                  Aplicar
                </Button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {isPresentationFilterSheetOpen ? (
        <div
          className="fixed inset-0 z-[110] grid place-items-end bg-black/40 p-3 dark:bg-black/60 md:hidden"
          onClick={() => setIsPresentationFilterSheetOpen(false)}
        >
          <div
            className="w-full rounded-2xl border border-border bg-background p-4"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-base font-medium text-foreground">Filtros</h2>
              <Button type="button" variant="ghostSecondary" size="icon" onClick={() => setIsPresentationFilterSheetOpen(false)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="mt-4 grid gap-3">
              <select
                value={presentationMonth}
                onChange={(event) => setPresentationMonth(event.target.value)}
                className={cn("flex h-11 rounded-md border px-3 py-2 text-sm", compactControlClass)}
              >
                <option value="all">Todos os meses</option>
                {monthAbbreviations.map((month) => (
                  <option key={month} value={month}>
                    {month}
                  </option>
                ))}
              </select>
              <select
                value={presentationSort}
                onChange={(event) => setPresentationSort(event.target.value as PresentationSort)}
                className={cn("flex h-11 rounded-md border px-3 py-2 text-sm", compactControlClass)}
              >
                <option value="recent">Mais recentes</option>
                <option value="oldest">Mais antigas</option>
                <option value="az">A-Z</option>
                <option value="za">Z-A</option>
                <option value="more-art">Mais artes</option>
                <option value="less-art">Menos artes</option>
              </select>
              <div className="flex gap-2 pt-1">
                {isPresentationFilterActive ? (
                  <Button type="button" variant="ghostSecondary" className="flex-1 focus-visible:ring-0" onClick={resetPresentationFilters}>
                    Limpar filtros
                  </Button>
                ) : null}
                <Button type="button" className="flex-1 focus-visible:ring-0" onClick={() => setIsPresentationFilterSheetOpen(false)}>
                  Aplicar
                </Button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {isProfileModalOpen ? (
        <div
          className="fixed inset-0 z-[110] grid place-items-end bg-black/35 px-3 py-3 dark:bg-black/55 sm:place-items-center sm:px-4 sm:py-6"
          onClick={closeProfileModal}
        >
          <div
            className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-2xl border border-border bg-background p-4 sm:p-5"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4">
              <h2 className="sora-heading text-2xl font-medium text-foreground">
                Editar perfil do cliente
              </h2>
              <Button
                type="button"
                variant="ghostSecondary"
                size="icon"
                onClick={closeProfileModal}
                disabled={savingClientProfile || uploadingClientLogo}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            <form className="mt-6 grid gap-5" onSubmit={handleSaveClientProfile}>
              <div className="flex flex-col items-center gap-3">
                <ClientAvatarInput
                  id="clientProfileLogo"
                  name={clientProfileForm.name || client.name}
                  logoUrl={client.logo_url}
                  previewUrl={clientProfileForm.logoUrl}
                  accentColor={clientProfileForm.primaryColor}
                  uploading={uploadingClientLogo}
                  onFileSelect={handleProfileLogoSelect}
                  className="h-24 w-24 text-3xl"
                />
                <p className="text-xs text-muted-foreground">Alterar foto</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="clientProfileName">Nome do cliente</Label>
                <Input
                  id="clientProfileName"
                  value={clientProfileForm.name}
                  onChange={(event) =>
                    setClientProfileForm((current) => ({
                      ...current,
                      name: event.target.value,
                    }))
                  }
                  placeholder="Nome do cliente"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="clientProfileResponsible">Responsável por esta empresa</Label>
                <select
                  id="clientProfileResponsible"
                  value={clientProfileForm.responsibleName}
                  onChange={(event) =>
                    setClientProfileForm((current) => ({
                      ...current,
                      responsibleName: event.target.value,
                    }))
                  }
                  disabled={!isAdmin}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground transition-colors focus-visible:outline-none focus-visible:ring-0 focus-visible:border-neutral-400 dark:focus-visible:border-white/35"
                >
                  <option value="">Sem responsável</option>
                  {responsibleOptions.map((responsible) => (
                    <option key={responsible} value={responsible}>
                      {responsible}
                    </option>
                  ))}
                </select>
              </div>

              <div className="rounded-xl border border-border bg-background p-4">
                <p className="text-sm text-muted-foreground">Cores do cliente</p>
                <div className="mt-4 flex items-center gap-4">
                  <div className="grid gap-2">
                    <span className="text-xs text-muted-foreground">Primaria</span>
                    <ColorDotInput
                      id="clientProfilePrimaryColor"
                      label="Cor primaria"
                      value={clientProfileForm.primaryColor}
                      onChange={(value) =>
                        setClientProfileForm((current) => ({
                          ...current,
                          primaryColor: value,
                        }))
                      }
                    />
                  </div>
                  <div className="grid gap-2">
                    <span className="text-xs text-muted-foreground">Secundaria</span>
                    <ColorDotInput
                      id="clientProfileSecondaryColor"
                      label="Cor secundaria"
                      value={clientProfileForm.secondaryColor}
                      onChange={(value) =>
                        setClientProfileForm((current) => ({
                          ...current,
                          secondaryColor: value,
                        }))
                      }
                    />
                  </div>
                </div>
              </div>

              {profileError ? (
                <p className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-700 dark:text-rose-200">
                  {profileError}
                </p>
              ) : null}

              <div className="flex justify-end gap-3 pt-1">
                <Button
                  type="button"
                  variant="ghostSecondary"
                  onClick={closeProfileModal}
                  disabled={savingClientProfile || uploadingClientLogo}
                >
                  Cancelar
                </Button>
                <Button type="submit" disabled={savingClientProfile || uploadingClientLogo}>
                  {savingClientProfile ? "Salvando..." : "Salvar perfil"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {creationMode ? (
        <div
          className="fixed inset-0 z-[110] grid place-items-end bg-black/35 px-3 py-3 dark:bg-black/55 sm:place-items-center sm:px-4 sm:py-6"
          onClick={closeCreationModal}
        >
          <div
            className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-2xl border border-border bg-background p-4 shadow-none sm:p-5"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="sora-heading text-2xl font-medium text-foreground">
                  {creationMode === "copy" ? "Criar planejamento" : "Criar apresentacao"}
                </h2>
              </div>
              <Button type="button" variant="ghostSecondary" size="icon" onClick={closeCreationModal}>
                <X className="h-4 w-4" />
              </Button>
            </div>

            {creationMode === "copy" ? (
              <form className="mt-6 grid gap-4" onSubmit={handleCreateCopyPlanning}>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="copyStartDate">Data inicial</Label>
                    <Input
                      id="copyStartDate"
                      inputMode="numeric"
                      maxLength={5}
                      value={copyForm.startDate}
                      onChange={(event) =>
                        setCopyForm((current) => ({
                          ...current,
                          startDate: formatDateInput(event.target.value),
                        }))
                      }
                      placeholder="15/05"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="copyEndDate">Data final</Label>
                    <Input
                      id="copyEndDate"
                      inputMode="numeric"
                      maxLength={5}
                      value={copyForm.endDate}
                      onChange={(event) =>
                        setCopyForm((current) => ({
                          ...current,
                          endDate: formatDateInput(event.target.value),
                        }))
                      }
                      placeholder="20/05"
                    />
                  </div>
                </div>
                <div className="rounded-md border border-border bg-background px-3 py-2">
                  <p className="text-xs text-muted-foreground">Titulo do planejamento</p>
                  <p className="mt-1 text-sm font-medium text-foreground">
                    {copyPlanningTitle}
                  </p>
                </div>
                <p className="rounded-md border border-border bg-background px-3 py-2 text-xs text-muted-foreground">
                  Link publico sera:{" "}
                  <span className="font-medium text-foreground">
                    {copySlugLoading ? "verificando..." : copyPublicSlug || copyPreferredPublicSlug}
                  </span>
                </p>
                {error ? (
                  <p className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-700 dark:text-rose-200">
                    {error}
                  </p>
                ) : null}
                <div className="flex justify-end gap-3 pt-2">
                  <Button type="button" variant="ghostSecondary" onClick={closeCreationModal}>
                    Cancelar
                  </Button>
                  <Button type="submit" disabled={savingCopy}>
                    <Plus className="h-4 w-4" />
                    {savingCopy ? "Criando..." : "Criar"}
                  </Button>
                </div>
              </form>
            ) : (
              <form className="mt-6 grid gap-4" onSubmit={handleCreateVisualPresentation}>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="visualStartDate">Data inicial</Label>
                    <Input
                      id="visualStartDate"
                      inputMode="numeric"
                      maxLength={5}
                      value={visualForm.startDate}
                      className={creationError?.startsWith("Data inicial") ? "border-rose-500 focus-visible:ring-rose-500" : undefined}
                      onChange={(event) =>
                        setVisualForm((current) =>
                          withSuggestedVisualEndDate(current, {
                            startDate: formatDateInput(event.target.value),
                          }),
                        )
                      }
                      placeholder="15/05"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="visualEndDate">Data final</Label>
                    <Input
                      id="visualEndDate"
                      inputMode="numeric"
                      maxLength={5}
                      value={visualForm.endDate}
                      className={creationError?.startsWith("Data final") ? "border-rose-500 focus-visible:ring-rose-500" : undefined}
                      onChange={(event) =>
                        setVisualForm((current) => ({
                          ...current,
                          endDate: formatDateInput(event.target.value),
                        }))
                      }
                      placeholder="20/05"
                    />
                  </div>
                </div>
                <div className="rounded-md border border-border bg-background px-3 py-2">
                  <p className="text-xs text-muted-foreground">Titulo da apresentacao</p>
                  <p className="mt-1 text-sm font-medium text-foreground">
                    {visualPresentationTitle}
                  </p>
                </div>
                <p className="rounded-md border border-border bg-background px-3 py-2 text-xs text-muted-foreground">
                  Link publico sera:{" "}
                  <span className="font-medium text-foreground">
                    {visualSlugLoading ? "verificando..." : visualPublicSlug || visualBasePublicSlug}
                  </span>
                </p>
                <div className="space-y-2">
                  <div className="space-y-2">
                    <Label htmlFor="visualType">Tipo</Label>
                    <select
                      id="visualType"
                      value={visualForm.presentationType}
                      onChange={(event) =>
                        setVisualForm((current) =>
                          withSuggestedVisualEndDate(current, {
                            presentationType: event.target.value,
                          }),
                        )
                      }
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground transition-colors focus-visible:border-neutral-400 focus-visible:outline-none focus-visible:ring-0 dark:focus-visible:border-white/35"
                    >
                      {visualPresentationTypeOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                {creationError ? (
                  <p className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-700 dark:text-rose-200">
                    {creationError}
                  </p>
                ) : null}
                <div className="flex justify-end gap-3 pt-2">
                  <Button type="button" variant="ghostSecondary" onClick={closeCreationModal}>
                    Cancelar
                  </Button>
                  <Button type="submit" disabled={savingVisual}>
                    <Plus className="h-4 w-4" />
                    {savingVisual ? "Criando..." : "Criar"}
                  </Button>
                </div>
              </form>
            )}
          </div>
        </div>
      ) : null}
    </section>
  );
}
