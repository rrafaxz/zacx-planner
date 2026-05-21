"use client";

import { type KeyboardEvent, type MouseEvent, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Copy,
  Download,
  ImageIcon,
  Loader2,
  Search,
  X,
} from "lucide-react";

import {
  cleanCopySectionHtml,
  type CopyDocumentSections,
  hasSectionContent,
  parseCopyDocumentContent,
} from "@/components/copy-plannings/copy-document";
import {
  parsePlanningSections,
  weekdayForDisplayDate,
  type PlanningVisualItem,
  type PlanningVisualSections,
  type PlanningVisualType,
} from "@/components/copy-plannings/planning-visual-parser";
import { storyImageMetadata } from "@/components/visual-presentations/story-image-notes";
import { AutoDismissToast } from "@/components/ui/auto-dismiss-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { canSeeClient } from "@/lib/auth/types";
import { useCurrentUser } from "@/lib/auth/current-user";
import { formatDateInput } from "@/lib/date-mask";
import { supabase } from "@/lib/supabase/client";
import type { Client, CopyPlanning, VisualItem, VisualItemImage, VisualPresentation } from "@/lib/supabase/types";
import { cn } from "@/lib/utils";

type CopyPlanningWithSectionFields = CopyPlanning & {
  posts_content?: string | null;
  carousels_content?: string | null;
  stories_content?: string | null;
  videos_content?: string | null;
};

type PostingImage = {
  id: string;
  url: string | null;
  orderIndex?: number | null;
};

type PlanningMatch = {
  planning: CopyPlanning;
  item: PlanningVisualItem;
};

type PostingCard = {
  id: string;
  client: Client | null;
  presentation: VisualPresentation;
  visualItem: VisualItem;
  type: Extract<PlanningVisualType, "post" | "carousel" | "stories">;
  typeLabel: string;
  date: string;
  weekday: string;
  images: PostingImage[];
  imageCount: number;
  match: PlanningMatch | null;
};

type FilterMode = "today" | "tomorrow" | "week" | "all" | "manual";
type DownloadToast = {
  message: string;
  variant: "success" | "warning" | "error";
} | null;

const filterOptions: Array<{ value: FilterMode; label: string }> = [
  { value: "today", label: "Hoje" },
  { value: "tomorrow", label: "Amanhã" },
  { value: "week", label: "Esta semana" },
  { value: "all", label: "Todas" },
  { value: "manual", label: "Escolher data" },
];

function sectionHtmlFromStoredContent(
  sectionKey: keyof CopyDocumentSections,
  legacySections: CopyDocumentSections,
  fieldContent?: string | null,
) {
  const documentSectionContent = legacySections[sectionKey];

  return hasSectionContent(documentSectionContent) ? documentSectionContent : fieldContent ?? documentSectionContent;
}

function buildPlanningSections(planning: CopyPlanningWithSectionFields, clientName?: string | null): PlanningVisualSections {
  const legacySections = parseCopyDocumentContent(planning.document_content);

  return {
    posts: cleanCopySectionHtml("posts", sectionHtmlFromStoredContent("posts", legacySections, planning.posts_content), clientName || undefined),
    carousels: cleanCopySectionHtml("carousels", sectionHtmlFromStoredContent("carousels", legacySections, planning.carousels_content), clientName || undefined),
    stories: cleanCopySectionHtml("stories", sectionHtmlFromStoredContent("stories", legacySections, planning.stories_content), clientName || undefined),
    videos: cleanCopySectionHtml("videos", sectionHtmlFromStoredContent("videos", legacySections, planning.videos_content), clientName || undefined),
    photos: cleanCopySectionHtml("photos", legacySections.photos, clientName || undefined),
    paidTraffic: cleanCopySectionHtml("paidTraffic", legacySections.paidTraffic, clientName || undefined),
  };
}

function normalizeDateLabel(value?: string | null) {
  return formatDateInput(value || "");
}

function slugifyFilePart(value?: string | null, fallback = "imagem") {
  return (value?.trim() || fallback)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-") || fallback;
}

function fileExtensionFromUrl(url?: string | null) {
  if (!url) return "";

  try {
    const pathname = new URL(url).pathname;
    const extension = pathname.match(/\.(png|jpe?g|webp)$/i)?.[0]?.toLowerCase();

    return extension || "";
  } catch {
    const extension = url.split("?")[0]?.match(/\.(png|jpe?g|webp)$/i)?.[0]?.toLowerCase();

    return extension || "";
  }
}

function extensionFromContentType(contentType?: string | null) {
  const normalizedType = `${contentType ?? ""}`.toLowerCase();

  if (normalizedType.includes("png")) return ".png";
  if (normalizedType.includes("webp")) return ".webp";
  if (normalizedType.includes("jpeg") || normalizedType.includes("jpg")) return ".jpg";

  return "";
}

function ensureFileExtension(filename: string, url?: string | null, contentType?: string | null) {
  if (/\.(png|jpe?g|webp)$/i.test(filename)) return filename;

  return `${filename}${extensionFromContentType(contentType) || fileExtensionFromUrl(url) || ".jpg"}`;
}

function buildImageFilename(posting: PostingCard, imageIndex = 0, contentType?: string | null) {
  const image = posting.images[imageIndex] ?? posting.images[0];
  const client = slugifyFilePart(posting.client?.name, "cliente");
  const date = normalizeDateLabel(posting.date).replace("/", "-") || "sem-data";
  const type = posting.type === "carousel" ? "carrossel" : posting.type === "stories" ? "story" : "post";
  const indexSource = posting.type === "stories" ? image?.orderIndex ?? imageIndex : imageIndex;
  const indexLabel = String(Math.max(1, Number(indexSource) + 1)).padStart(2, "0");
  const baseName = posting.type === "post" ? `${client}-${date}-${type}` : `${client}-${date}-${type}-${indexLabel}`;

  return ensureFileExtension(baseName, image?.url, contentType);
}

async function downloadImage(url: string, filename: string) {
  try {
    const response = await fetch(url, { mode: "cors" });

    if (!response.ok) throw new Error("download-failed");

    const blob = await response.blob();
    const objectUrl = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = objectUrl;
    link.download = ensureFileExtension(filename, url, blob.type || response.headers.get("content-type"));
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1500);

    return "downloaded" as const;
  } catch {
    window.open(url, "_blank", "noopener,noreferrer");
    return "opened" as const;
  }
}

function localDateLabel(date: Date) {
  return `${String(date.getDate()).padStart(2, "0")}/${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function tomorrowLabel() {
  const date = new Date();

  date.setDate(date.getDate() + 1);
  return localDateLabel(date);
}

function dateKey(value?: string | null, fallbackYear = new Date().getFullYear()) {
  const normalizedDate = normalizeDateLabel(value);

  if (!normalizedDate) return null;

  const [dayText, monthText] = normalizedDate.split("/");
  const day = Number(dayText);
  const month = Number(monthText);

  if (!Number.isFinite(day) || !Number.isFinite(month)) return null;

  return fallbackYear * 10000 + month * 100 + day;
}

function currentWeekRange() {
  const now = new Date();
  const day = now.getDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;
  const start = new Date(now);
  const end = new Date(now);

  start.setDate(now.getDate() + mondayOffset);
  end.setDate(start.getDate() + 6);

  return {
    start: dateKey(localDateLabel(start)) ?? 0,
    end: dateKey(localDateLabel(end)) ?? 99999999,
  };
}

function visualTypeFromFormat(format?: string | null): PostingCard["type"] {
  const normalizedFormat = `${format ?? ""}`
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

  if (normalizedFormat.includes("carrossel") || normalizedFormat.includes("carousel")) return "carousel";
  if (normalizedFormat.includes("story") || normalizedFormat.includes("stories")) return "stories";

  return "post";
}

function typeLabel(type: PostingCard["type"]) {
  if (type === "carousel") return "Carrossel";
  if (type === "stories") return "Story";

  return "Post";
}

function sortedImages(images?: VisualItemImage[]) {
  return [...(images ?? [])].sort(
    (left, right) =>
      (left.order_index ?? 0) - (right.order_index ?? 0) ||
      `${left.created_at ?? ""}`.localeCompare(`${right.created_at ?? ""}`),
  );
}

function imageRowsForItem(item: VisualItem, imagesByItem: Map<string, VisualItemImage[]>) {
  const rows = sortedImages(imagesByItem.get(item.id));

  if (rows.length) {
    return rows.map((image) => ({
      id: image.id,
      url: image.image_url,
      orderIndex: image.order_index,
    }));
  }

  return item.image_url ? [{ id: item.id, url: item.image_url, orderIndex: 0 }] : [];
}

function itemLabelForStories(item: VisualItem, image: { id: string; orderIndex?: number | null }, imageIndex: number) {
  return storyImageMetadata({
    notes: item.notes,
    imageId: image.id,
    orderIndex: image.orderIndex ?? imageIndex,
    fallbackDate: item.display_date,
    fallbackWeekday: item.weekday,
  });
}

function createPlanningMatches(
  plannings: CopyPlanningWithSectionFields[],
  clientsById: Map<string, Client>,
) {
  const matchesByClient = new Map<string, PlanningMatch[]>();

  plannings
    .filter((planning) => !planning.archived_at && !planning.deleted_at && clientsById.has(planning.client_id))
    .sort((left, right) => `${right.updated_at ?? right.created_at ?? ""}`.localeCompare(`${left.updated_at ?? left.created_at ?? ""}`))
    .forEach((planning) => {
      const client = clientsById.get(planning.client_id);
      const sections = buildPlanningSections(planning, client?.name);
      const matches = parsePlanningSections(sections).map((item) => ({ planning, item }));

      matchesByClient.set(planning.client_id, [...(matchesByClient.get(planning.client_id) ?? []), ...matches]);
    });

  return matchesByClient;
}

function findPlanningMatch(posting: Pick<PostingCard, "client" | "date" | "type">, matchesByClient: Map<string, PlanningMatch[]>) {
  if (!posting.client?.id) return null;

  const normalizedDate = normalizeDateLabel(posting.date);

  if (!normalizedDate) return null;

  return (
    matchesByClient
      .get(posting.client.id)
      ?.find((match) => normalizeDateLabel(match.item.displayDate || match.item.date) === normalizedDate && match.item.type === posting.type) ?? null
  );
}

function createPostingCards({
  clients,
  presentations,
  items,
  images,
  matchesByClient,
}: {
  clients: Client[];
  presentations: VisualPresentation[];
  items: VisualItem[];
  images: VisualItemImage[];
  matchesByClient: Map<string, PlanningMatch[]>;
}) {
  const clientsById = new Map(clients.map((client) => [client.id, client]));
  const presentationsById = new Map(presentations.map((presentation) => [presentation.id, presentation]));
  const imagesByItem = new Map<string, VisualItemImage[]>();

  images.forEach((image) => {
    imagesByItem.set(image.visual_item_id, [...(imagesByItem.get(image.visual_item_id) ?? []), image]);
  });

  const postings = items
    .filter((item) => item.is_visible !== false)
    .flatMap((item) => {
      const presentation = presentationsById.get(item.visual_presentation_id);

      if (!presentation || presentation.archived_at || presentation.deleted_at) return [];

      const client = clientsById.get(presentation.client_id) ?? null;

      if (!client) return [];

      const type = visualTypeFromFormat(item.format);
      const itemImages = imageRowsForItem(item, imagesByItem);

      if (!itemImages.length) return [];

      if (type === "stories") {
        return itemImages.map((image, imageIndex) => {
          const metadata = itemLabelForStories(item, image, imageIndex);
          const date = normalizeDateLabel(metadata.displayDate || item.display_date);
          const weekday = metadata.weekday || item.weekday || weekdayForDisplayDate(date);
          const posting: PostingCard = {
            id: `${item.id}-${image.id}`,
            client,
            presentation,
            visualItem: item,
            type,
            typeLabel: typeLabel(type),
            date,
            weekday,
            images: [{ id: image.id, url: image.url, orderIndex: image.orderIndex ?? imageIndex }],
            imageCount: 1,
            match: null,
          };

          return {
            ...posting,
            match: findPlanningMatch(posting, matchesByClient),
          };
        });
      }

      const date = normalizeDateLabel(item.display_date);
      const weekday = item.weekday || weekdayForDisplayDate(date);
      const posting: PostingCard = {
        id: item.id,
        client,
        presentation,
        visualItem: item,
        type,
        typeLabel: typeLabel(type),
        date,
        weekday,
        images: itemImages.map((image) => ({ id: image.id, url: image.url, orderIndex: image.orderIndex })),
        imageCount: itemImages.length,
        match: null,
      };

      return {
        ...posting,
        match: findPlanningMatch(posting, matchesByClient),
      };
    })
    .filter((posting) => posting.date)
    .sort((left, right) => {
      const leftKey = dateKey(left.date) ?? 99999999;
      const rightKey = dateKey(right.date) ?? 99999999;

      if (leftKey !== rightKey) return leftKey - rightKey;

      return `${left.client?.name ?? ""}`.localeCompare(`${right.client?.name ?? ""}`);
    });

  return postings;
}

function PostingImage({ posting, imageIndex = 0, className }: { posting: PostingCard; imageIndex?: number; className?: string }) {
  const image = posting.images[imageIndex] ?? posting.images[0];

  return (
    <div className={cn("grid place-items-center overflow-hidden rounded-lg border border-border bg-secondary/40", className)}>
      {image?.url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={image.url} alt={posting.typeLabel} className="h-full w-full object-contain" />
      ) : (
        <div className="grid h-full w-full place-items-center text-muted-foreground">
          <ImageIcon className="h-8 w-8" />
        </div>
      )}
    </div>
  );
}

function PostingModalImage({ posting, imageIndex = 0 }: { posting: PostingCard; imageIndex?: number }) {
  const image = posting.images[imageIndex] ?? posting.images[0];

  return (
    <div className="grid min-h-[280px] place-items-center rounded-xl border border-border bg-black/5 p-3 dark:bg-white/5 sm:min-h-[420px]">
      {image?.url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={image.url}
          alt={posting.typeLabel}
          className="h-auto max-h-[72vh] w-auto max-w-full object-contain"
        />
      ) : (
        <div className="grid min-h-[280px] w-full place-items-center text-muted-foreground">
          <ImageIcon className="h-8 w-8" />
        </div>
      )}
    </div>
  );
}

function MultilineText({ value, fallback = "Não informado." }: { value?: string | null; fallback?: string }) {
  const text = value?.trim() || fallback;
  const paragraphs = text.split(/\n{2,}/).map((paragraph) => paragraph.trim()).filter(Boolean);

  return (
    <div className="space-y-3 text-sm leading-7 text-foreground">
      {(paragraphs.length ? paragraphs : [text]).map((paragraph, index) => (
        <p key={`${paragraph}-${index}`} className="whitespace-pre-wrap">
          {paragraph}
        </p>
      ))}
    </div>
  );
}

function DetailBlock({
  title,
  children,
  copyValue,
  copied,
  onCopy,
}: {
  title: string;
  children: React.ReactNode;
  copyValue?: string | null;
  copied?: boolean;
  onCopy?: (value: string) => void;
}) {
  const canCopy = Boolean(copyValue?.trim() && onCopy);

  return (
    <section className="rounded-xl border border-border bg-background p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h3 className="text-xs font-semibold uppercase tracking-normal text-muted-foreground">{title}</h3>
        {canCopy ? (
          <button
            type="button"
            onClick={() => onCopy?.(copyValue || "")}
            className="inline-flex h-7 items-center gap-1.5 rounded-md border border-border px-2 text-[11px] font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
            aria-label={`Copiar ${title.toLowerCase()}`}
            title={`Copiar ${title.toLowerCase()}`}
          >
            <Copy className="h-3.5 w-3.5" />
            {copied ? "Copiado" : "Copiar"}
          </button>
        ) : null}
      </div>
      {children}
    </section>
  );
}

function DownloadIconButton({
  onClick,
  loading,
  className,
  label = "Baixar imagem",
}: {
  onClick: (event: MouseEvent<HTMLButtonElement>) => void;
  loading?: boolean;
  className?: string;
  label?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "grid h-10 w-10 shrink-0 place-items-center rounded-full border border-white/60 bg-white/90 text-neutral-900 transition-colors hover:bg-white dark:border-white/15 dark:bg-black/70 dark:text-white dark:hover:bg-black/85",
        className,
      )}
      aria-label={label}
      title={label}
    >
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
    </button>
  );
}

export function PostingsDashboard() {
  const { user: currentUser, loading: userLoading } = useCurrentUser();
  const [postings, setPostings] = useState<PostingCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterMode, setFilterMode] = useState<FilterMode>("today");
  const [manualDate, setManualDate] = useState(localDateLabel(new Date()));
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<"all" | PostingCard["type"]>("all");
  const [activePosting, setActivePosting] = useState<PostingCard | null>(null);
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [copied, setCopied] = useState<string | null>(null);
  const [downloadToast, setDownloadToast] = useState<DownloadToast>(null);
  const [downloadingKey, setDownloadingKey] = useState<string | null>(null);

  useEffect(() => {
    async function loadPostings() {
      if (!currentUser) {
        if (!userLoading) setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);

      const [clientsResponse, presentationsResponse, planningsResponse] = await Promise.all([
        supabase.from("clients").select("*").is("deleted_at", null),
        supabase.from("visual_presentations").select("*").is("deleted_at", null),
        supabase.from("copy_plannings").select("*").is("deleted_at", null),
      ]);

      if (clientsResponse.error || presentationsResponse.error || planningsResponse.error) {
        setError(clientsResponse.error?.message || presentationsResponse.error?.message || planningsResponse.error?.message || "Não foi possível carregar postagens.");
        setLoading(false);
        return;
      }

      const loadedClients = ((clientsResponse.data ?? []) as Client[]).filter((client) => canSeeClient(currentUser, client));
      const loadedPresentations = ((presentationsResponse.data ?? []) as VisualPresentation[]).filter(
        (presentation) => !presentation.archived_at && !presentation.deleted_at,
      );
      const loadedPlannings = ((planningsResponse.data ?? []) as CopyPlanningWithSectionFields[]).filter(
        (planning) => !planning.archived_at && !planning.deleted_at,
      );
      const presentationIds = loadedPresentations.map((presentation) => presentation.id);
      let loadedItems: VisualItem[] = [];
      let loadedImages: VisualItemImage[] = [];

      if (presentationIds.length) {
        const { data: itemData, error: itemError } = await supabase
          .from("visual_items")
          .select("*")
          .in("visual_presentation_id", presentationIds);

        if (itemError) {
          setError(itemError.message);
          setLoading(false);
          return;
        }

        loadedItems = ((itemData ?? []) as VisualItem[]).filter((item) => item.is_visible !== false);
        const itemIds = loadedItems.map((item) => item.id);

        if (itemIds.length) {
          const { data: imageData, error: imageError } = await supabase
            .from("visual_item_images")
            .select("*")
            .in("visual_item_id", itemIds);

          if (imageError) {
            setError(imageError.message);
            setLoading(false);
            return;
          }

          loadedImages = (imageData ?? []) as VisualItemImage[];
        }
      }

      const clientsById = new Map(loadedClients.map((client) => [client.id, client]));
      const matchesByClient = createPlanningMatches(loadedPlannings, clientsById);

      setPostings(
        createPostingCards({
          clients: loadedClients,
          presentations: loadedPresentations,
          items: loadedItems,
          images: loadedImages,
          matchesByClient,
        }),
      );
      setLoading(false);
    }

    loadPostings();
  }, [currentUser, userLoading]);

  useEffect(() => {
    setActiveImageIndex(0);
  }, [activePosting?.id]);

  useEffect(() => {
    if (!activePosting) return;

    const previousOverflow = document.body.style.overflow;
    const previousPosition = document.body.style.position;
    const previousTop = document.body.style.top;
    const previousWidth = document.body.style.width;
    const previousPaddingRight = document.body.style.paddingRight;
    const scrollY = window.scrollY;
    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;

    document.body.style.overflow = "hidden";
    document.body.style.position = "fixed";
    document.body.style.top = `-${scrollY}px`;
    document.body.style.width = "100%";

    if (scrollbarWidth > 0) {
      document.body.style.paddingRight = `${scrollbarWidth}px`;
    }

    return () => {
      document.body.style.overflow = previousOverflow;
      document.body.style.position = previousPosition;
      document.body.style.top = previousTop;
      document.body.style.width = previousWidth;
      document.body.style.paddingRight = previousPaddingRight;
      window.scrollTo(0, scrollY);
    };
  }, [activePosting]);

  const today = localDateLabel(new Date());
  const shownDateLabel =
    filterMode === "today"
      ? today
      : filterMode === "tomorrow"
        ? tomorrowLabel()
        : filterMode === "manual"
          ? normalizeDateLabel(manualDate)
          : null;
  const filteredPostings = useMemo(() => {
    const weekRange = currentWeekRange();
    const normalizedSearch = search.trim().toLowerCase();
    const normalizedManualDate = normalizeDateLabel(manualDate);

    return postings.filter((posting) => {
      const postingDate = normalizeDateLabel(posting.date);
      const postingDateKey = dateKey(postingDate);
      const dateMatches =
        filterMode === "all"
          ? true
          : filterMode === "today"
            ? postingDate === today
            : filterMode === "tomorrow"
              ? postingDate === tomorrowLabel()
              : filterMode === "manual"
                ? postingDate === normalizedManualDate
                : postingDateKey !== null && postingDateKey >= weekRange.start && postingDateKey <= weekRange.end;
      const typeMatches = typeFilter === "all" || posting.type === typeFilter;
      const searchText = [
        posting.client?.name,
        posting.typeLabel,
        posting.date,
        posting.weekday,
        posting.match?.item.theme,
        posting.match?.item.caption,
        posting.match?.item.objective,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return dateMatches && typeMatches && (!normalizedSearch || searchText.includes(normalizedSearch));
    });
  }, [filterMode, manualDate, postings, search, today, typeFilter]);

  async function copyText(key: string, text: string) {
    if (!text.trim()) return;

    await navigator.clipboard.writeText(text);
    setCopied(key);
    window.setTimeout(() => setCopied((current) => (current === key ? null : current)), 1800);
  }

  async function handleDownload(posting: PostingCard, imageIndex = 0, event?: MouseEvent<HTMLButtonElement>) {
    event?.preventDefault();
    event?.stopPropagation();

    const image = posting.images[imageIndex] ?? posting.images[0];

    if (!image?.url) {
      setDownloadToast({
        message: "Imagem indisponível para download.",
        variant: "error",
      });
      return;
    }

    const key = `${posting.id}-${image.id}-${imageIndex}`;

    setDownloadingKey(key);

    const result = await downloadImage(image.url, buildImageFilename(posting, imageIndex));

    setDownloadToast(
      result === "downloaded"
        ? {
            message: "Download iniciado.",
            variant: "success",
          }
        : {
            message: "Não foi possível baixar. Abrindo imagem...",
            variant: "warning",
          },
    );
    setDownloadingKey((current) => (current === key ? null : current));
  }

  function openPosting(posting: PostingCard) {
    setActivePosting(posting);
  }

  function openPostingWithKeyboard(event: KeyboardEvent<HTMLElement>, posting: PostingCard) {
    if (event.key !== "Enter" && event.key !== " ") return;

    event.preventDefault();
    openPosting(posting);
  }

  const activeMatch = activePosting?.match?.item ?? null;
  const slidesCopyText = activeMatch?.slides.map((slide) => `${slide.label}\n${slide.text}`).join("\n\n") || "";
  const activeImage = activePosting?.images[activeImageIndex] ?? activePosting?.images[0];
  const activeDownloadKey = activePosting && activeImage ? `${activePosting.id}-${activeImage.id}-${activeImageIndex}` : "";

  return (
    <section className="space-y-5">
      <AutoDismissToast
        message={downloadToast?.message}
        variant={downloadToast?.variant}
        onDismiss={() => setDownloadToast(null)}
      />
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-normal text-muted-foreground">Agenda diária</p>
          <h1 className="sora-heading mt-1 text-2xl font-semibold tracking-normal text-foreground sm:text-3xl">
            Postagens
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {filterMode === "today" ? `Postagens de hoje · ${today}` : "Imagens das Apresentações conectadas ao Planejamento."}
          </p>
        </div>
        <div className="inline-flex items-center gap-2 rounded-xl border border-border bg-background px-3 py-2 text-sm text-muted-foreground">
          <CalendarDays className="h-4 w-4" />
          {filteredPostings.length} {filteredPostings.length === 1 ? "postagem" : "postagens"}
        </div>
      </div>

      <Card>
        <CardContent className="space-y-3 p-3 sm:p-4">
          <div className="no-scrollbar flex gap-2 overflow-x-auto">
            {filterOptions.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setFilterMode(option.value)}
                className={cn(
                  "h-9 shrink-0 rounded-lg border px-3 text-sm font-medium transition-colors",
                  filterMode === option.value
                    ? "border-foreground/20 bg-foreground text-background"
                    : "border-border bg-background text-muted-foreground hover:text-foreground",
                )}
              >
                {option.label}
              </button>
            ))}
          </div>

          <div className="grid gap-2 md:grid-cols-[160px_160px_1fr]">
            <Input
              value={manualDate}
              onChange={(event) => {
                setManualDate(formatDateInput(event.target.value));
                setFilterMode("manual");
              }}
              inputMode="numeric"
              maxLength={5}
              placeholder="DD/MM"
            />
            <select
              value={typeFilter}
              onChange={(event) => setTypeFilter(event.target.value as typeof typeFilter)}
              className="h-10 rounded-md border border-input bg-background px-3 text-sm text-foreground outline-none"
            >
              <option value="all">Todos os tipos</option>
              <option value="post">Post</option>
              <option value="carousel">Carrossel</option>
              <option value="stories">Stories</option>
            </select>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                className="pl-9"
                placeholder="Buscar por cliente, tema ou legenda"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {loading ? (
        <Card>
          <CardContent className="flex items-center gap-3 p-5 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Carregando postagens...
          </CardContent>
        </Card>
      ) : error ? (
        <Card className="border-rose-500/30 bg-rose-500/10">
          <CardContent className="p-5 text-sm text-rose-100">{error}</CardContent>
        </Card>
      ) : filteredPostings.length ? (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
          {filteredPostings.map((posting) => (
            <article
              key={posting.id}
              role="button"
              tabIndex={0}
              onClick={() => openPosting(posting)}
              onKeyDown={(event) => openPostingWithKeyboard(event, posting)}
              className="group overflow-hidden rounded-xl border border-border bg-background text-left transition hover:-translate-y-0.5 hover:border-foreground/30"
            >
              <div className="flex items-center gap-2 border-b border-border p-2.5">
                <div className="grid h-7 w-7 shrink-0 place-items-center overflow-hidden rounded-full border border-border bg-secondary">
                  {posting.client?.logo_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={posting.client.logo_url} alt={posting.client.name} className="h-full w-full object-cover" />
                  ) : (
                    <span className="text-[10px] font-semibold">{posting.client?.name?.slice(0, 1) ?? "?"}</span>
                  )}
                </div>
                <div className="min-w-0">
                  <p className="truncate text-xs font-semibold text-foreground">{posting.client?.name ?? "Cliente"}</p>
                  <p className="text-[10px] text-muted-foreground">{posting.typeLabel} · {posting.date}</p>
                </div>
              </div>
              <div className="relative">
                <PostingImage posting={posting} className={cn("aspect-square rounded-none border-0", posting.type === "stories" && "aspect-[9/16]")} />
                <DownloadIconButton
                  onClick={(event) => handleDownload(posting, 0, event)}
                  loading={downloadingKey === `${posting.id}-${posting.images[0]?.id}-0`}
                  className="absolute right-2 top-2 h-9 w-9"
                  label={posting.type === "carousel" ? "Baixar primeira imagem" : "Baixar imagem"}
                />
              </div>
              <div className="space-y-2 p-2.5">
                <div className="flex flex-wrap items-center gap-1.5 text-[10px] font-medium uppercase text-muted-foreground">
                  <span>{posting.typeLabel}</span>
                  <span>·</span>
                  <span>{posting.date}</span>
                  <span>·</span>
                  <span>{posting.weekday || weekdayForDisplayDate(posting.date) || "Sem dia"}</span>
                  {posting.type === "carousel" && posting.imageCount > 1 ? <span>· {posting.imageCount} imagens</span> : null}
                </div>
                <div
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-[10px] font-medium",
                    posting.match
                      ? "bg-emerald-500/10 text-emerald-500"
                      : "bg-amber-500/12 text-amber-500",
                  )}
                >
                  {posting.match ? <CheckCircle2 className="h-3 w-3" /> : <AlertTriangle className="h-3 w-3" />}
                  {posting.match ? "Conteúdo encontrado" : "Sem correspondência"}
                </div>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="p-6 text-sm text-muted-foreground">
            Nenhuma postagem encontrada{shownDateLabel ? ` para ${shownDateLabel}` : ""}.
          </CardContent>
        </Card>
      )}

      {activePosting ? (
        <div className="fixed inset-0 z-[120] flex items-end justify-center overflow-hidden bg-black/70 p-3 backdrop-blur-[1px] sm:items-center sm:p-6" onClick={() => setActivePosting(null)}>
          <div
            className="max-h-[92vh] w-full max-w-5xl overflow-y-auto overscroll-contain rounded-2xl border border-border bg-background shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3 border-b border-border p-4 sm:p-5">
              <div>
                <p className="text-xs font-medium uppercase tracking-normal text-muted-foreground">
                  {activePosting.client?.name ?? "Cliente"} · {activePosting.typeLabel} · {activePosting.date} · {activePosting.weekday || "Sem dia"}
                </p>
                <h2 className="sora-heading mt-1 text-xl font-semibold tracking-normal text-foreground">
                  {activeMatch?.theme || activePosting.presentation.title}
                </h2>
              </div>
              <Button type="button" variant="ghostSecondary" size="icon" onClick={() => setActivePosting(null)}>
                <X className="h-4 w-4" />
              </Button>
            </div>

            <div className="grid gap-4 p-4 lg:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)] lg:p-5">
              <div className="space-y-3">
                <div className="relative">
                  <PostingModalImage posting={activePosting} imageIndex={activeImageIndex} />
                  <DownloadIconButton
                    onClick={(event) => handleDownload(activePosting, activeImageIndex, event)}
                    loading={downloadingKey === activeDownloadKey}
                    className="absolute right-3 top-3"
                    label="Baixar imagem atual"
                  />
                  {activePosting.images.length > 1 ? (
                    <>
                      <button
                        type="button"
                        className="absolute left-2 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-full bg-black/70 text-white"
                        onClick={() => setActiveImageIndex((current) => Math.max(0, current - 1))}
                        aria-label="Imagem anterior"
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        className="absolute right-2 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-full bg-black/70 text-white"
                        onClick={() => setActiveImageIndex((current) => Math.min(activePosting.images.length - 1, current + 1))}
                        aria-label="Próxima imagem"
                      >
                        <ChevronRight className="h-4 w-4" />
                      </button>
                      <span className="absolute right-14 top-3 rounded-full bg-black/75 px-2.5 py-1 text-xs font-medium text-white">
                        {activeImageIndex + 1}/{activePosting.images.length}
                      </span>
                    </>
                  ) : null}
                </div>
              </div>

              <div className="space-y-3">
                {!activePosting.match ? (
                  <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-500">
                    Não encontramos conteúdo correspondente no planejamento para esta data e tipo.
                  </div>
                ) : null}

                <DetailBlock
                  title="Objetivo"
                  copyValue={activeMatch?.objective}
                  copied={copied === "objective"}
                  onCopy={(value) => copyText("objective", value)}
                >
                  <MultilineText value={activeMatch?.objective} />
                </DetailBlock>
                <DetailBlock
                  title="Tema"
                  copyValue={activeMatch?.theme}
                  copied={copied === "theme"}
                  onCopy={(value) => copyText("theme", value)}
                >
                  <MultilineText value={activeMatch?.theme} />
                </DetailBlock>
                {activePosting.type === "carousel" && activeMatch?.slides.length ? (
                  <DetailBlock
                    title="Slides"
                    copyValue={slidesCopyText}
                    copied={copied === "slides"}
                    onCopy={(value) => copyText("slides", value)}
                  >
                    <div className="space-y-3">
                      {activeMatch.slides.map((slide) => (
                        <div key={slide.index}>
                          <p className="mb-1 text-xs font-semibold uppercase text-muted-foreground">{slide.label}</p>
                          <MultilineText value={slide.text} />
                        </div>
                      ))}
                    </div>
                  </DetailBlock>
                ) : null}
                <DetailBlock
                  title="Legenda"
                  copyValue={activeMatch?.caption}
                  copied={copied === "caption"}
                  onCopy={(value) => copyText("caption", value)}
                >
                  <MultilineText value={activeMatch?.caption} />
                </DetailBlock>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
