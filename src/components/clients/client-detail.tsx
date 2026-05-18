"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Clipboard,
  ExternalLink,
  FileText,
  ImagePlus,
  Pencil,
  Plus,
  Search,
  SlidersHorizontal,
  X,
} from "lucide-react";

import { ClientAvatarInput } from "@/components/clients/client-avatar-input";
import { ColorDotInput } from "@/components/clients/color-dot-input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  dateWithDots,
  formatDateInput,
  getDayMonthInputError,
  getMonthNameFromDayMonth,
  isValidDayMonth,
} from "@/lib/date-mask";
import { optimizeImage } from "@/lib/image-optimizer";
import { supabase } from "@/lib/supabase/client";
import type { Client, CopyPlanning, VisualPresentation } from "@/lib/supabase/types";
import { cn, formatDateBR } from "@/lib/utils";

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
};

type CreationMode = "copy" | "visual" | null;
type MonthFilter = "all" | string;
type PlanningSort = "recent" | "oldest" | "az" | "za" | "more-content" | "less-content";
type PresentationSort = "recent" | "oldest" | "az" | "za" | "more-art" | "less-art";
type PresentationTypeFilter = "all" | "weekly" | "biweekly" | "custom";

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
  order_index: number | null;
  created_at: string | null;
};

type VisualItemImageThumbnailRow = {
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
  presentationType: "weekly",
};

const initialClientProfileForm: ClientProfileForm = {
  name: "",
  slug: "",
  logoUrl: null,
  primaryColor: "#A3E635",
  secondaryColor: "#60A5FA",
};

const presentationTypeLabels: Record<string, string> = {
  weekly: "Semanal",
  biweekly: "Quinzenal",
  custom: "Personalizada",
  semanal: "Semanal",
  quinzenal: "Quinzenal",
  personalizada: "Personalizada",
};

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

function buildPresentationTitle(clientName: string, startDate: string, endDate: string) {
  const startDateLabel = dateWithDots(startDate);
  const endDateLabel = dateWithDots(endDate);
  const dateRange =
    isValidDayMonth(startDate) && isValidDayMonth(endDate)
      ? `${startDateLabel}-${endDateLabel}`
      : `${startDateLabel} - ${endDateLabel}`;

  return `AP ${clientNameForTitle(clientName)} ${dateRange}`;
}

function buildPlanningTitle(clientName: string, startDate: string) {
  return `${clientNameForTitle(clientName)} PLANEJAMENTO ${getMonthNameFromDayMonth(startDate) || "--"}`;
}

function buildSlugFromTitle(title: string) {
  return slugify(title);
}

function buildPeriodLabel(startDate: string, endDate: string) {
  return `${startDate} a ${endDate}`;
}

function getPresentationTypeLabel(type?: string | null) {
  if (!type) return "Personalizada";

  return presentationTypeLabels[type] || type;
}

function normalizePresentationType(type?: string | null): PresentationTypeFilter {
  const value = `${type ?? ""}`.toLowerCase();

  if (value.includes("quinzenal") || value.includes("biweekly")) return "biweekly";
  if (value.includes("personalizada") || value.includes("custom")) return "custom";
  if (value.includes("semanal") || value.includes("weekly")) return "weekly";

  return "custom";
}

function monthTagFromDayMonth(value?: string | null) {
  if (!value || !isValidDayMonth(value)) return null;

  const month = Number(value.split("/")[1]);

  return monthAbbreviations[month - 1] || null;
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
  "h-10 w-10 rounded-lg border border-border bg-background p-0 text-muted-foreground hover:bg-foreground/[0.05] hover:text-foreground focus-visible:ring-0 focus-visible:border-neutral-400 dark:focus-visible:border-white/35";

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

function ClientAvatarDisplay({
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
    <span className="rounded-full border border-border bg-secondary/45 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-normal text-muted-foreground sm:px-2.5 sm:py-1 sm:text-[10px]">
      {children}
    </span>
  );
}

function DocumentThumbnail({
  title,
  preview,
  accentColor,
}: {
  title: string;
  preview: string;
  accentColor: string;
}) {
  return (
    <div className="h-32 overflow-hidden rounded-lg border border-black/10 bg-white p-3 text-neutral-950 sm:h-48 sm:p-4">
      <div className="mx-auto mb-4 h-1 w-12 rounded-full" style={{ backgroundColor: accentColor }} />
      <h3 className="line-clamp-2 text-center font-[Sora,Poppins,Arial,sans-serif] text-xs font-semibold uppercase leading-snug text-neutral-950 sm:text-sm">
        {title}
      </h3>
      {preview ? (
        <p
          className="mt-3 text-[10px] leading-4 text-neutral-500 sm:mt-4 sm:text-xs sm:leading-5"
          style={{
            display: "-webkit-box",
            WebkitLineClamp: 5,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
          }}
        >
          {preview}
        </p>
      ) : (
        <div className="mt-5 space-y-2">
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
    <div className="relative h-32 overflow-hidden rounded-lg border border-border bg-secondary sm:h-48">
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
        <div className="flex h-full flex-col items-center justify-center gap-3 text-muted-foreground">
          <div
            className="grid h-14 w-14 place-items-center rounded-2xl border border-border bg-background"
            style={{ color: detailColor || "#A3E635" }}
          >
            <ImagePlus className="h-6 w-6" />
          </div>
          <span className="text-xs">Sem arte enviada</span>
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
      <h3 className="mt-4 text-base font-medium text-foreground">{title}</h3>
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
  const [error, setError] = useState<string | null>(null);
  const [creationError, setCreationError] = useState<string | null>(null);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [profileMessage, setProfileMessage] = useState<string | null>(null);

  async function loadVisualThumbnails(presentations: VisualPresentation[]) {
    const presentationIds = presentations.map((presentation) => presentation.id);

    if (!presentationIds.length) {
      setVisualThumbnails({});
      setVisualArtCounts({});
      return;
    }

    const { data: itemData } = await supabase
      .from("visual_items")
      .select("id, visual_presentation_id, image_url, order_index, created_at")
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

    itemRows.forEach((item) => {
      itemPresentationMap.set(item.id, item.visual_presentation_id);

      if (item.image_url && !thumbnailMap[item.visual_presentation_id]) {
        thumbnailMap[item.visual_presentation_id] = item.image_url;
      }
    });

    if (itemRows.length) {
      const { data: imageData } = await supabase
        .from("visual_item_images")
        .select("visual_item_id, image_url, order_index, created_at")
        .in(
          "visual_item_id",
          itemRows.map((item) => item.id),
        )
        .order("order_index", { ascending: true })
        .order("created_at", { ascending: true });

      ((imageData ?? []) as VisualItemImageThumbnailRow[]).forEach((image) => {
        const presentationId = itemPresentationMap.get(image.visual_item_id);

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
  }

  async function loadClient() {
    setLoading(true);
    setError(null);

    const [clientResult, copyResult, visualResult] = await Promise.all([
      supabase.from("clients").select("*").eq("id", clientId).maybeSingle(),
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
      const visualData = visualResult.data ?? [];

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
      });
      setCopyPlannings(((copyResult.data ?? []) as CopyPlanningWithPreview[]).sort((a, b) => createdTime(b) - createdTime(a)));
      setVisualPresentations(visualData.sort((a, b) => createdTime(b) - createdTime(a)));
      await loadVisualThumbnails(visualData);
    }

    setLoading(false);
  }

  useEffect(() => {
    setOrigin(window.location.origin);
    loadClient();
  }, [clientId]);

  const copyPlanningTitle = useMemo(
    () => buildPlanningTitle(client?.name || "Cliente", copyForm.startDate),
    [client?.name, copyForm.startDate],
  );
  const copyPublicSlug = useMemo(
    () => buildSlugFromTitle(copyPlanningTitle),
    [copyPlanningTitle],
  );
  const visualPresentationTitle = useMemo(
    () => buildPresentationTitle(client?.name || "Cliente", visualForm.startDate, visualForm.endDate),
    [client?.name, visualForm.startDate, visualForm.endDate],
  );
  const visualPublicSlug = useMemo(
    () => buildSlugFromTitle(visualPresentationTitle),
    [visualPresentationTitle],
  );
  const isPlanningFilterActive =
    Boolean(planningSearch.trim()) || planningMonth !== "all" || planningSort !== "recent";
  const isPresentationFilterActive =
    Boolean(presentationSearch.trim()) ||
    presentationMonth !== "all" ||
    presentationType !== "all" ||
    presentationSort !== "recent";
  const filteredCopyPlannings = useMemo(() => {
    const search = normalizedSearch(planningSearch);

    return [...copyPlannings]
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
  }, [copyPlannings, planningMonth, planningSearch, planningSort]);
  const filteredVisualPresentations = useMemo(() => {
    const search = normalizedSearch(presentationSearch);

    return [...visualPresentations]
      .filter((presentation) => {
        const month = monthTagFromDayMonth(presentation.start_display_date);
        const type = normalizePresentationType(presentation.presentation_type);
        const typeLabel = getPresentationTypeLabel(presentation.presentation_type);
        const searchableText = normalizedSearch(
          `${presentation.title} ${presentation.public_slug} ${presentation.presentation_type ?? ""} ${typeLabel}`,
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
    visualArtCounts,
    visualPresentations,
  ]);
  const planningCounterText = isPlanningFilterActive
    ? `${filteredCopyPlannings.length} de ${copyPlannings.length} documentos`
    : `${copyPlannings.length} documento${copyPlannings.length === 1 ? "" : "s"} criado${copyPlannings.length === 1 ? "" : "s"}`;
  const presentationCounterText = isPresentationFilterActive
    ? `${filteredVisualPresentations.length} de ${visualPresentations.length} pranchas`
    : `${visualPresentations.length} prancha${visualPresentations.length === 1 ? "" : "s"} criada${visualPresentations.length === 1 ? "" : "s"}`;

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

  function openCreationModal(mode: Exclude<CreationMode, null>) {
    setError(null);
    setCreationError(null);
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

    const newPlanning = {
      client_id: clientId,
      title: copyPlanningTitle,
      public_slug: copyPublicSlug,
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

  async function handleCreateVisualPresentation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const startDateError = getDayMonthInputError(visualForm.startDate);
    const endDateError = getDayMonthInputError(visualForm.endDate);

    if (startDateError) {
      setCreationError(`Data inicial: ${startDateError}`);
      return;
    }

    if (endDateError) {
      setCreationError(`Data final: ${endDateError}`);
      return;
    }

    if (!visualForm.presentationType) {
      setCreationError("Selecione o tipo da apresentacao.");
      return;
    }

    setSavingVisual(true);
    setCreationError(null);

    const newPresentation = {
      client_id: clientId,
      title: visualPresentationTitle,
      public_slug: visualPublicSlug,
      period_label: buildPeriodLabel(visualForm.startDate, visualForm.endDate),
      start_display_date: visualForm.startDate,
      end_display_date: visualForm.endDate,
      presentation_type: visualForm.presentationType || "weekly",
      detail_color: client?.primary_color || "#DFFF06",
      status: "draft",
      is_public: true,
    };

    const { data, error: requestError } = await supabase
      .from("visual_presentations")
      .insert(newPresentation as never)
      .select("id")
      .maybeSingle();

    if (requestError) {
      setCreationError(`Erro ao criar apresentacao: ${requestError.message}`);
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
      });
      setIsProfileModalOpen(false);
      setProfileMessage("Perfil atualizado.");
      window.setTimeout(() => setProfileMessage(null), 2200);
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
            Cliente nao encontrado.
          </CardContent>
        </Card>
      </section>
    );
  }

  const accentColor = client.primary_color || "#E5E7EB";

  return (
    <section className="space-y-6 md:space-y-8">
      <div className="relative flex flex-col gap-4 rounded-2xl border border-border bg-background p-4 pr-24 md:flex-row md:items-center md:justify-between md:p-5 md:pr-28">
        <div className="absolute right-3 top-3 flex items-center gap-1 md:right-4 md:top-4">
          <Button asChild variant="ghostSecondary" size="icon" className="h-9 w-9 rounded-full" title="Voltar para clientes">
            <Link href="/admin/clientes" aria-label="Voltar para clientes">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <Button
            type="button"
            variant="ghostSecondary"
            size="icon"
            className="h-9 w-9 rounded-full"
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
            className="h-14 w-14 text-lg md:h-16 md:w-16 md:text-xl"
          />
          <div className="min-w-0">
            <h1 className="mt-1 truncate text-2xl font-medium text-foreground md:text-3xl">{client.name}</h1>
            <p className="mt-1 truncate text-xs text-muted-foreground md:mt-2 md:text-sm">
              /{client.slug} - criado em {formatDateBR(client.created_at)}
            </p>
          </div>
        </div>
      </div>

      {profileMessage ? (
        <p className="rounded-lg border border-border bg-background px-4 py-3 text-sm text-muted-foreground">
          {profileMessage}
        </p>
      ) : null}

      {error && !creationMode ? (
        <Card className="border-rose-500/30 bg-rose-500/10">
          <CardContent className="pt-5 text-sm text-rose-100">{error}</CardContent>
        </Card>
      ) : null}

      <Tabs defaultValue="planejamentos" className="space-y-5 md:space-y-6">
        <TabsList className="grid h-auto w-full grid-cols-2 gap-3 border-0 bg-transparent p-0">
          <TabsTrigger
            value="planejamentos"
            className="group h-auto justify-start gap-2 rounded-2xl border border-border bg-background p-3 text-left text-muted-foreground shadow-none data-[state=active]:border-neutral-300 data-[state=active]:bg-background data-[state=active]:text-neutral-950 data-[state=active]:shadow-none dark:data-[state=active]:border-white/20 dark:data-[state=active]:bg-background dark:data-[state=active]:text-neutral-100 sm:gap-3 sm:p-4"
          >
            <span className="grid h-7 w-7 shrink-0 place-items-center text-muted-foreground transition-colors group-hover:text-foreground group-data-[state=active]:text-neutral-950 dark:group-data-[state=active]:text-neutral-100 sm:h-8 sm:w-8">
              <FileText className="h-5 w-5 sm:h-6 sm:w-6" />
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
            className="group h-auto justify-start gap-2 rounded-2xl border border-border bg-background p-3 text-left text-muted-foreground shadow-none data-[state=active]:border-neutral-300 data-[state=active]:bg-background data-[state=active]:text-neutral-950 data-[state=active]:shadow-none dark:data-[state=active]:border-white/20 dark:data-[state=active]:bg-background dark:data-[state=active]:text-neutral-100 sm:gap-3 sm:p-4"
          >
            <span className="grid h-7 w-7 shrink-0 place-items-center text-muted-foreground transition-colors group-hover:text-foreground group-data-[state=active]:text-neutral-950 dark:group-data-[state=active]:text-neutral-100 sm:h-8 sm:w-8">
              <ImagePlus className="h-5 w-5 sm:h-6 sm:w-6" />
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
          <div className="flex items-start justify-between gap-3">
            <div className="shrink-0">
              <h2 className="text-xl font-medium text-foreground">Planejamentos</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {planningCounterText}
              </p>
            </div>

            <div className="flex items-center gap-2">
              <LibraryCreateButton
                label="Criar novo planejamento"
                onClick={() => openCreationModal("copy")}
              />

              <div className="relative">
                <Button
                  type="button"
                  variant="ghostSecondary"
                  className={cn(sectionIconButtonClass, planningSearch && "border-foreground/30 text-foreground")}
                  onClick={() => setIsPlanningSearchOpen((current) => !current)}
                  aria-label="Buscar planejamentos"
                  title="Buscar planejamentos"
                >
                  <Search className="h-4 w-4" />
                </Button>

              </div>

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

          {isPlanningSearchOpen ? (
            <div
              className="fixed inset-0 z-[110] grid place-items-center bg-black/40 p-4 dark:bg-black/60"
              onClick={() => setIsPlanningSearchOpen(false)}
            >
              <div
                className="w-full max-w-md rounded-2xl border border-border bg-background p-4"
                onClick={(event) => event.stopPropagation()}
              >
                <div className="flex items-center justify-between gap-3">
                  <h2 className="text-base font-medium text-foreground">Buscar</h2>
                  <Button type="button" variant="ghostSecondary" size="icon" onClick={() => setIsPlanningSearchOpen(false)}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
                <div className="relative mt-4">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={planningSearch}
                    onChange={(event) => setPlanningSearch(event.target.value)}
                    placeholder="Buscar planejamento ou conteúdo..."
                    autoFocus
                    className={cn("h-11 pl-9 pr-9", compactControlClass)}
                  />
                  {planningSearch ? (
                    <button
                      type="button"
                      onClick={() => setPlanningSearch("")}
                      className="absolute right-2 top-1/2 grid h-7 w-7 -translate-y-1/2 place-items-center rounded-md text-muted-foreground hover:bg-foreground/[0.06] hover:text-foreground"
                      aria-label="Limpar busca"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  ) : null}
                </div>
              </div>
            </div>
          ) : null}

          {filteredCopyPlannings.length ? (
            <div className="grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-3 xl:grid-cols-4">
              {filteredCopyPlannings.map((planning) => {
                const publicPath = `/p/${planning.public_slug}`;
                const previewText = extractPreviewText(
                  planning.posts_content || planning.document_content,
                  client.name,
                );
                const planningMonthTag = monthTagFromDayMonth(planning.start_display_date);

                return (
                  <article
                    key={planning.id}
                    role="link"
                    tabIndex={0}
                    onClick={() => router.push(`/admin/planejamentos/${planning.id}`)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        router.push(`/admin/planejamentos/${planning.id}`);
                      }
                    }}
                    className="group cursor-pointer rounded-2xl border border-border bg-background p-2 transition hover:-translate-y-0.5 hover:border-foreground/25 sm:p-3"
                  >
                    <DocumentThumbnail title={planning.title} preview={previewText} accentColor={accentColor} />
                    <div className="space-y-2 px-1 pb-1 pt-3 sm:space-y-3 sm:pt-4">
                      <div className="flex items-start justify-between gap-2">
                        <h3 className="line-clamp-2 text-sm font-medium leading-snug text-foreground sm:text-base">
                          {planning.title}
                        </h3>
                      </div>
                      <div className="space-y-1 text-[11px] text-muted-foreground sm:text-xs">
                        <p>{planning.period_label || "Periodo nao definido"}</p>
                        <p className="hidden sm:block">Criado em {formatDateBR(planning.created_at)}</p>
                      </div>
                      <div className="flex flex-wrap items-center justify-between gap-1.5 pt-1">
                        <div className="flex min-w-0 items-center gap-1.5">
                          <Button
                            type="button"
                            variant="ghostSecondary"
                            size="sm"
                            className="bg-transparent px-2 hover:bg-neutral-900/5 dark:hover:bg-white/[0.08]"
                            onClick={(event) => {
                              stopCardClick(event);
                              copyLink(publicPath);
                            }}
                          >
                            <Clipboard className="h-3.5 w-3.5" />
                            <span className="hidden sm:inline">
                              {copiedLink === publicPath ? "Copiado" : "Link"}
                            </span>
                          </Button>
                          <Button
                            asChild
                            variant="ghostSecondary"
                            size="sm"
                            className="bg-transparent px-2 hover:bg-neutral-900/5 dark:hover:bg-white/[0.08]"
                          >
                            <Link
                              href={publicPath}
                              target="_blank"
                              rel="noreferrer"
                              onClick={stopCardClick}
                            >
                              <ExternalLink className="h-3.5 w-3.5" />
                              <span className="hidden sm:inline">Publico</span>
                            </Link>
                          </Button>
                        </div>
                        {planningMonthTag ? (
                          <div className="flex shrink-0 items-center gap-1.5">
                            <InfoTag>{planningMonthTag}</InfoTag>
                          </div>
                        ) : null}
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
                  : "Nenhum planejamento criado"
              }
              description={
                isPlanningFilterActive
                  ? "Limpe os filtros ou ajuste a busca para ver outros documentos."
                  : "Use o botao de adicionar para criar o primeiro documento mensal deste cliente."
              }
              actionLabel={isPlanningFilterActive ? "Limpar filtros" : undefined}
              onAction={isPlanningFilterActive ? resetPlanningFilters : undefined}
            />
          )}
        </TabsContent>

        <TabsContent value="apresentacoes" className="space-y-5">
          <div className="flex items-start justify-between gap-3">
            <div className="shrink-0">
              <h2 className="text-xl font-medium text-foreground">Apresentacoes</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {presentationCounterText}
              </p>
            </div>

            <div className="flex items-center gap-2">
              <LibraryCreateButton
                label="Criar nova apresentacao"
                onClick={() => openCreationModal("visual")}
              />

              <div className="relative">
                <Button
                  type="button"
                  variant="ghostSecondary"
                  className={cn(sectionIconButtonClass, presentationSearch && "border-foreground/30 text-foreground")}
                  onClick={() => setIsPresentationSearchOpen((current) => !current)}
                  aria-label="Buscar apresentações"
                  title="Buscar apresentações"
                >
                  <Search className="h-4 w-4" />
                </Button>

              </div>

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
                        value={presentationType}
                        onChange={(event) => setPresentationType(event.target.value as PresentationTypeFilter)}
                        className={cn("flex h-10 rounded-md border px-3 py-2 text-sm", compactControlClass)}
                      >
                        <option value="all">Todos os tipos</option>
                        <option value="weekly">Semanal</option>
                        <option value="biweekly">Quinzenal</option>
                        <option value="custom">Personalizada</option>
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

          {isPresentationSearchOpen ? (
            <div
              className="fixed inset-0 z-[110] grid place-items-center bg-black/40 p-4 dark:bg-black/60"
              onClick={() => setIsPresentationSearchOpen(false)}
            >
              <div
                className="w-full max-w-md rounded-2xl border border-border bg-background p-4"
                onClick={(event) => event.stopPropagation()}
              >
                <div className="flex items-center justify-between gap-3">
                  <h2 className="text-base font-medium text-foreground">Buscar</h2>
                  <Button type="button" variant="ghostSecondary" size="icon" onClick={() => setIsPresentationSearchOpen(false)}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
                <div className="relative mt-4">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={presentationSearch}
                    onChange={(event) => setPresentationSearch(event.target.value)}
                    placeholder="Buscar apresentação..."
                    autoFocus
                    className={cn("h-11 pl-9 pr-9", compactControlClass)}
                  />
                  {presentationSearch ? (
                    <button
                      type="button"
                      onClick={() => setPresentationSearch("")}
                      className="absolute right-2 top-1/2 grid h-7 w-7 -translate-y-1/2 place-items-center rounded-md text-muted-foreground hover:bg-foreground/[0.06] hover:text-foreground"
                      aria-label="Limpar busca"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  ) : null}
                </div>
              </div>
            </div>
          ) : null}

          {filteredVisualPresentations.length ? (
            <div className="grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-2 2xl:grid-cols-3">
              {filteredVisualPresentations.map((presentation) => {
                const publicPath = `/a/${presentation.public_slug}`;
                const detailColor = accentColor;
                const presentationMonthTag = monthTagFromDayMonth(presentation.start_display_date);
                const presentationTypeTag = getPresentationTypeLabel(presentation.presentation_type).toUpperCase();

                return (
                  <article
                    key={presentation.id}
                    role="link"
                    tabIndex={0}
                    onClick={() => router.push(`/admin/apresentacoes/${presentation.id}`)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        router.push(`/admin/apresentacoes/${presentation.id}`);
                      }
                    }}
                    className="group cursor-pointer rounded-2xl border border-border bg-background p-2 transition hover:-translate-y-0.5 hover:border-foreground/25 sm:p-4"
                  >
                    <PresentationThumbnail
                      title={presentation.title}
                      imageUrl={visualThumbnails[presentation.id]}
                      detailColor={detailColor}
                    />
                    <div className="space-y-2 px-1 pb-1 pt-3 sm:space-y-3 sm:pt-4">
                      <div className="flex items-start justify-between gap-2">
                        <h3 className="line-clamp-2 text-sm font-medium leading-snug text-foreground sm:text-base">
                          {presentation.title}
                        </h3>
                      </div>
                      <div className="space-y-1 text-[11px] text-muted-foreground sm:text-xs">
                        <p>{presentation.period_label || "Periodo nao definido"}</p>
                        <p className="hidden sm:block">Criada em {formatDateBR(presentation.created_at)}</p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2 pt-1 sm:flex-nowrap">
                        <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                          <Button
                            type="button"
                            variant="ghostSecondary"
                            size="sm"
                            className="bg-transparent px-2 hover:bg-neutral-900/5 dark:hover:bg-white/[0.08]"
                            onClick={(event) => {
                              stopCardClick(event);
                              copyLink(publicPath);
                            }}
                          >
                            <Clipboard className="h-3.5 w-3.5" />
                            <span className="hidden sm:inline">
                              {copiedLink === publicPath ? "Copiado" : "Link"}
                            </span>
                          </Button>
                          <Button
                            asChild
                            variant="ghostSecondary"
                            size="sm"
                            className="bg-transparent px-2 hover:bg-neutral-900/5 dark:hover:bg-white/[0.08]"
                          >
                            <Link
                              href={publicPath}
                              target="_blank"
                              rel="noreferrer"
                              onClick={stopCardClick}
                            >
                              <ExternalLink className="h-3.5 w-3.5" />
                              <span className="hidden sm:inline">Publico</span>
                            </Link>
                          </Button>
                        </div>
                        <div className="ml-auto flex shrink-0 items-center gap-2 pl-3">
                          {presentationMonthTag ? <InfoTag>{presentationMonthTag}</InfoTag> : null}
                          <InfoTag>{presentationTypeTag}</InfoTag>
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
                  : "Nenhuma apresentacao criada"
              }
              description={
                isPresentationFilterActive
                  ? "Limpe os filtros ou ajuste a busca para ver outras pranchas."
                  : "Use o botao de adicionar para criar a primeira prancha visual deste cliente."
              }
              actionLabel={isPresentationFilterActive ? "Limpar filtros" : undefined}
              onAction={isPresentationFilterActive ? resetPresentationFilters : undefined}
            />
          )}
        </TabsContent>
      </Tabs>

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
                value={presentationType}
                onChange={(event) => setPresentationType(event.target.value as PresentationTypeFilter)}
                className={cn("flex h-11 rounded-md border px-3 py-2 text-sm", compactControlClass)}
              >
                <option value="all">Todos os tipos</option>
                <option value="weekly">Semanal</option>
                <option value="biweekly">Quinzenal</option>
                <option value="custom">Personalizada</option>
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
              <h2 className="text-2xl font-medium text-foreground">
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
                <h2 className="text-2xl font-medium text-foreground">
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
                  <span className="font-medium text-foreground">{copyPublicSlug}</span>
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
                        setVisualForm((current) => ({
                          ...current,
                          startDate: formatDateInput(event.target.value),
                        }))
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
                  <span className="font-medium text-foreground">{visualPublicSlug}</span>
                </p>
                <div className="space-y-2">
                  <div className="space-y-2">
                    <Label htmlFor="visualType">Tipo</Label>
                    <select
                      id="visualType"
                      value={visualForm.presentationType}
                      onChange={(event) =>
                        setVisualForm((current) => ({
                          ...current,
                          presentationType: event.target.value,
                        }))
                      }
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground transition-colors focus-visible:border-neutral-400 focus-visible:outline-none focus-visible:ring-0 dark:focus-visible:border-white/35"
                    >
                      <option value="weekly">Semanal</option>
                      <option value="biweekly">Quinzenal</option>
                      <option value="custom">Personalizada</option>
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
