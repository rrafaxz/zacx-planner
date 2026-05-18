"use client";

import {
  type CSSProperties,
  type HTMLAttributes,
  type PointerEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ChevronLeft,
  ChevronRight,
  GripVertical,
  ImageIcon,
  Pencil,
  Trash2,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { storyImageMetadata } from "@/components/visual-presentations/story-image-notes";
import { formatDateInput } from "@/lib/date-mask";
import { supabase } from "@/lib/supabase/client";
import type { Client, VisualItem, VisualItemImage } from "@/lib/supabase/types";
import { cn } from "@/lib/utils";

export type VisualItemWithImages = VisualItem & {
  images?: VisualItemImage[];
};

type VisualTheme = "dark" | "light";

type VisualItemBoardProps = {
  items: VisualItemWithImages[];
  client?: Client | null;
  onEdit?: (item: VisualItemWithImages) => void;
  onDelete?: (item: VisualItemWithImages) => void;
  deletingItemId?: string | null;
  presentationTitle?: string;
  variant?: "admin" | "public";
  theme?: VisualTheme;
  onActiveImageChange?: (image: VisualArtworkImage | null, index: number) => void;
  onQuickUpdate?: (
    item: VisualItemWithImages,
    values: {
      displayDate?: string;
      weekday?: string;
      imageId?: string | null;
      imageIndex?: number;
    },
  ) => void;
  showDragHandle?: boolean;
  dragHandleProps?: HTMLAttributes<HTMLSpanElement>;
};

export type VisualArtworkImage = {
  id: string;
  image_url: string | null;
  image_path: string | null;
  label: string | null;
  display_date?: string | null;
  weekday?: string | null;
};

const visualPresentationsBucket = "visual-presentations";
const legacyPresentationAssetsBucket = "presentation-assets";
const readablePresentationBuckets = [visualPresentationsBucket, legacyPresentationAssetsBucket];
const compactWeekdays = ["SEG", "TER", "QUA", "QUI", "SEX", "SÁB", "DOM"];

function readStringValue(source: unknown, key: string) {
  if (!source || typeof source !== "object") return null;

  const value = (source as Record<string, unknown>)[key];

  return typeof value === "string" ? value.trim() : null;
}

function publicUrlFromStoragePath(path: string | null, bucket = visualPresentationsBucket) {
  if (!path) return null;

  const {
    data: { publicUrl },
  } = supabase.storage.from(bucket).getPublicUrl(path);

  return publicUrl || null;
}

function stripStoragePath(value: string | null) {
  if (!value) return null;

  const trimmedValue = value.trim();

  if (!trimmedValue || /^(blob:|file:|data:)/i.test(trimmedValue)) {
    return null;
  }

  try {
    const parsedUrl = new URL(trimmedValue);
    const storageMatch = readablePresentationBuckets
      .map((bucket) => ({
        bucket,
        marker: [
          `/storage/v1/object/public/${bucket}/`,
          `/storage/v1/object/sign/${bucket}/`,
          `/storage/v1/object/authenticated/${bucket}/`,
        ].find((currentMarker) => parsedUrl.pathname.includes(currentMarker)),
      }))
      .find((entry) => entry.marker);

    if (!storageMatch?.marker) return null;

    const [, rawPath = ""] = parsedUrl.pathname.split(storageMatch.marker);
    const path = decodeURIComponent(rawPath).replace(/^\/+/, "");

    return path ? { bucket: storageMatch.bucket, path } : null;
  } catch {
    let normalizedPath = trimmedValue.replace(/^\/+/, "").split("?")[0];
    let bucket = normalizedPath.startsWith(`${legacyPresentationAssetsBucket}/`)
      ? legacyPresentationAssetsBucket
      : visualPresentationsBucket;

    readablePresentationBuckets.forEach((currentBucket) => {
      [
        `storage/v1/object/public/${currentBucket}/`,
        `storage/v1/object/sign/${currentBucket}/`,
        `storage/v1/object/authenticated/${currentBucket}/`,
        `object/public/${currentBucket}/`,
        `object/sign/${currentBucket}/`,
        `object/authenticated/${currentBucket}/`,
        `public/${currentBucket}/`,
        `${currentBucket}/`,
      ].forEach((prefix) => {
        if (normalizedPath.startsWith(prefix)) {
          normalizedPath = normalizedPath.slice(prefix.length);
          bucket = currentBucket;
        }
      });
    });

    if (!normalizedPath.startsWith("clients/") && !normalizedPath.startsWith("temp/")) {
      bucket = legacyPresentationAssetsBucket;
    }

    if (!normalizedPath || normalizedPath.includes("://")) return null;

    return { bucket, path: normalizedPath };
  }
}

function normalizeImageSource(source: unknown) {
  const urlValue =
    readStringValue(source, "image_url") ||
    readStringValue(source, "imageUrl") ||
    readStringValue(source, "url") ||
    readStringValue(source, "src");
  const pathValue =
    readStringValue(source, "image_path") ||
    readStringValue(source, "imagePath") ||
    readStringValue(source, "storage_path") ||
    readStringValue(source, "path");
  const storagePath = stripStoragePath(pathValue) || stripStoragePath(urlValue);

  if (storagePath) {
    return {
      image_url: publicUrlFromStoragePath(storagePath.path, storagePath.bucket),
      image_path: storagePath.path,
    };
  }

  if (!urlValue || /^(blob:|file:|data:)/i.test(urlValue)) {
    return {
      image_url: null,
      image_path: null,
    };
  }

  if (/^https?:\/\//i.test(urlValue)) {
    return {
      image_url: urlValue,
      image_path: null,
    };
  }

  return {
    image_url: null,
    image_path: null,
  };
}

function modeFromItem(item: VisualItem) {
  const format = `${item.format ?? ""}`.toLowerCase();

  if (format.includes("stories") || format.includes("story")) return "stories";
  if (format.includes("carrossel") || format.includes("carousel")) return "carousel";

  return "post";
}

function imagesFromItems(items: VisualItemWithImages[]) {
  return items.flatMap((item) => {
    const mode = modeFromItem(item);

    if (item.images?.length) {
      const normalizedImages = item.images
        .map((image, index) => {
          const normalizedSource = normalizeImageSource(image);
          const metadata =
            mode === "stories"
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
            id: image.id,
            image_url: normalizedSource.image_url,
            image_path: normalizedSource.image_path,
            label: item.label,
            display_date: metadata.displayDate,
            weekday: metadata.weekday,
          };
        })
        .filter((image) => Boolean(image.image_url));

      if (normalizedImages.length) {
        return normalizedImages;
      }
    }

    const normalizedSource = normalizeImageSource(item);

    if (normalizedSource.image_url) {
      return [
        {
          id: item.id,
          image_url: normalizedSource.image_url,
          image_path: normalizedSource.image_path,
          label: item.label,
          display_date: item.display_date,
          weekday: item.weekday,
        },
      ];
    }

    return [
      {
        id: item.id,
        image_url: null,
        image_path: null,
        label: item.label,
        display_date: item.display_date,
        weekday: item.weekday,
      },
    ];
  });
}

export function fullWeekday(value?: string | null) {
  const normalizedValue = `${value ?? ""}`.trim().toUpperCase();

  const weekdays: Record<string, string> = {
    SEG: "Segunda-feira",
    TER: "Terça-feira",
    QUA: "Quarta-feira",
    QUI: "Quinta-feira",
    SEX: "Sexta-feira",
    SÁB: "Sábado",
    SAB: "Sábado",
    DOM: "Domingo",
  };

  return weekdays[normalizedValue] || value || "Dia nao definido";
}

function ImageFallback() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-2 px-4 text-center text-xs font-medium text-muted-foreground">
      <ImageIcon className="h-8 w-8 opacity-70" />
      <span>Imagem não carregada</span>
    </div>
  );
}

function ImageFrame({
  image,
  className,
  priority = false,
}: {
  image: VisualArtworkImage;
  className?: string;
  priority?: boolean;
}) {
  const [hasImageError, setHasImageError] = useState(false);

  useEffect(() => {
    setHasImageError(false);
  }, [image.image_url]);

  const canRenderImage = Boolean(image.image_url && !hasImageError);

  return (
    <div
      className={cn(
        "relative grid h-full w-full place-items-center overflow-hidden border border-black/5 bg-black/[0.035] shadow-sm select-none dark:border-white/10 dark:bg-white/[0.035]",
        className,
      )}
    >
      {canRenderImage ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={image.image_url ?? ""}
          alt={image.label ?? ""}
          draggable={false}
          decoding="async"
          loading={priority ? "eager" : "lazy"}
          fetchPriority={priority ? "high" : "auto"}
          onError={() => {
            if (process.env.NODE_ENV !== "production") {
              console.warn("Erro ao carregar imagem da apresentação visual", image.image_url);
            }
            setHasImageError(true);
          }}
          onDragStart={(event) => event.preventDefault()}
          className="pointer-events-none absolute inset-0 block h-full w-full select-none object-contain object-center [-webkit-user-drag:none]"
        />
      ) : (
        <ImageFallback />
      )}
    </div>
  );
}

function formatLabel(mode: string) {
  if (mode === "carousel") return "Carrossel";
  if (mode === "stories") return "Stories";

  return "Post";
}

function ArtworkViewer({
  images,
  mode,
  variant,
  theme,
  onActiveImageChange,
}: {
  images: VisualArtworkImage[];
  mode: string;
  variant: "admin" | "public";
  theme: VisualTheme;
  onActiveImageChange?: (image: VisualArtworkImage | null, index: number) => void;
}) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState(0);
  const imageKey = useMemo(() => images.map((image) => image.id).join("|"), [images]);
  const viewportRef = useRef<HTMLDivElement>(null);
  const dragState = useRef({
    isDragging: false,
    startX: 0,
    deltaX: 0,
    pointerId: -1,
  });

  useEffect(() => {
    setActiveIndex(0);
    setDragOffset(0);
  }, [imageKey]);

  useEffect(() => {
    setActiveIndex((currentIndex) => Math.min(currentIndex, Math.max(images.length - 1, 0)));
  }, [images.length]);

  useEffect(() => {
    onActiveImageChange?.(images[activeIndex] ?? null, activeIndex);
  }, [activeIndex, imageKey, onActiveImageChange]);

  function goToIndex(index: number) {
    setActiveIndex(Math.min(Math.max(index, 0), images.length - 1));
    setDragOffset(0);
  }

  function goToImage(direction: -1 | 1) {
    if (images.length <= 1) return;

    goToIndex(activeIndex + direction);
  }

  function handlePointerDown(event: PointerEvent<HTMLDivElement>) {
    if (images.length <= 1 || (event.pointerType === "mouse" && event.button !== 0)) return;

    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    dragState.current = {
      isDragging: true,
      startX: event.clientX,
      deltaX: 0,
      pointerId: event.pointerId,
    };
    setIsDragging(true);
  }

  function handlePointerMove(event: PointerEvent<HTMLDivElement>) {
    if (!dragState.current.isDragging) return;

    event.preventDefault();

    const rawDeltaX = event.clientX - dragState.current.startX;
    const isPullingBeforeFirst = activeIndex === 0 && rawDeltaX > 0;
    const isPullingAfterLast = activeIndex === images.length - 1 && rawDeltaX < 0;
    const deltaX = isPullingBeforeFirst || isPullingAfterLast ? rawDeltaX * 0.35 : rawDeltaX;

    dragState.current.deltaX = deltaX;
    setDragOffset(deltaX);
  }

  function stopDragging(event?: PointerEvent<HTMLDivElement>) {
    if (!dragState.current.isDragging) return;

    const deltaX = dragState.current.deltaX;
    const viewportWidth = viewportRef.current?.clientWidth ?? 360;
    const snapThreshold = Math.min(120, Math.max(48, viewportWidth * 0.18));
    const pointerId = dragState.current.pointerId;
    let nextIndex = activeIndex;

    if (deltaX <= -snapThreshold) {
      nextIndex = Math.min(activeIndex + 1, images.length - 1);
    } else if (deltaX >= snapThreshold) {
      nextIndex = Math.max(activeIndex - 1, 0);
    }

    dragState.current = {
      isDragging: false,
      startX: 0,
      deltaX: 0,
      pointerId: -1,
    };
    setIsDragging(false);
    goToIndex(nextIndex);

    if (event && pointerId >= 0 && event.currentTarget.hasPointerCapture(pointerId)) {
      event.currentTarget.releasePointerCapture(pointerId);
    }
  }

  const isPublic = variant === "public";
  const frameShapeClass = mode === "stories" ? "aspect-[9/16]" : "aspect-[4/5]";
  const frameStyle: CSSProperties = {
    width:
      mode === "stories"
        ? isPublic
          ? "min(100%, 42.1875vh, 420px)"
          : "min(100%, 220px)"
        : isPublic
          ? "min(100%, 60vh, 520px)"
          : mode === "carousel"
            ? "min(100%, 320px)"
            : "min(100%, 330px)",
  };
  const frameClass =
    mode === "stories"
      ? isPublic
        ? "mx-auto rounded-xl"
        : "mx-auto rounded-lg"
      : mode === "carousel"
        ? isPublic
          ? "mx-auto rounded-xl"
          : "mx-auto rounded-lg"
        : isPublic
          ? "mx-auto rounded-xl"
          : "mx-auto rounded-lg";
  const trackTransform = `translate3d(calc(${-activeIndex * 100}% + ${dragOffset}px), 0, 0)`;

  return (
    <div
      className={cn(
        "relative mx-auto w-full",
        isPublic ? "max-w-4xl" : "max-w-full",
        theme === "light" ? "text-neutral-950" : "text-white",
      )}
    >
      <div
        data-artwork-frame
        ref={viewportRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={stopDragging}
        onPointerCancel={stopDragging}
        onLostPointerCapture={stopDragging}
        style={frameStyle}
        className={cn(
          frameShapeClass,
          frameClass,
          isPublic
            ? "overflow-hidden border border-transparent bg-transparent touch-pan-y select-none"
            : "overflow-hidden border border-black/5 bg-black/[0.035] shadow-sm touch-pan-y select-none dark:border-white/10 dark:bg-white/[0.035]",
          images.length > 1 && (isDragging ? "cursor-grabbing" : "cursor-grab"),
        )}
      >
        <div
          className={cn(
            "flex h-full w-full",
            !isDragging && "transition-transform duration-300 ease-out",
          )}
          style={{ transform: trackTransform }}
        >
          {images.map((image) => (
            <div key={image.id} className="h-full min-w-0 basis-full flex-none select-none">
              <ImageFrame
                image={image}
                priority={image.id === images[activeIndex]?.id}
                className="h-full w-full rounded-none border-0 bg-transparent shadow-none"
              />
            </div>
          ))}
        </div>
      </div>

      {images.length > 1 ? (
        <>
          <button
            type="button"
            onClick={() => goToImage(-1)}
            className={cn(
              "absolute left-2 top-1/2 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-full bg-black/70 text-white shadow-sm transition-colors hover:bg-black",
              isPublic ? "md:left-8" : "",
            )}
            aria-label="Imagem anterior"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <button
            type="button"
            onClick={() => goToImage(1)}
            className={cn(
              "absolute right-2 top-1/2 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-full bg-black/70 text-white shadow-sm transition-colors hover:bg-black",
              isPublic ? "md:right-8" : "",
            )}
            aria-label="Proxima imagem"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
          <span className="absolute right-3 top-3 rounded-full bg-black/75 px-2.5 py-1 text-xs font-medium text-white">
            {activeIndex + 1}/{images.length}
          </span>
        </>
      ) : null}
    </div>
  );
}

function PublicArtwork({
  images,
  mode,
  theme,
  onActiveImageChange,
}: {
  images: VisualArtworkImage[];
  mode: string;
  theme: VisualTheme;
  onActiveImageChange?: (image: VisualArtworkImage | null, index: number) => void;
}) {
  return (
    <ArtworkViewer
      images={images}
      mode={mode}
      theme={theme}
      variant="public"
      onActiveImageChange={onActiveImageChange}
    />
  );
}

function AdminArtwork({
  images,
  mode,
  theme,
  onActiveImageChange,
}: {
  images: VisualArtworkImage[];
  mode: string;
  theme: VisualTheme;
  onActiveImageChange?: (image: VisualArtworkImage | null, index: number) => void;
}) {
  return (
    <ArtworkViewer
      images={images}
      mode={mode}
      theme={theme}
      variant="admin"
      onActiveImageChange={onActiveImageChange}
    />
  );
}

function AdminVisualItemCard({
  firstItem,
  mode,
  images,
  onEdit,
  onDelete,
  deletingItemId,
  theme,
  onQuickUpdate,
  showDragHandle = false,
  dragHandleProps,
}: {
  firstItem: VisualItemWithImages;
  mode: string;
  images: VisualArtworkImage[];
  onEdit?: (item: VisualItemWithImages) => void;
  onDelete?: (item: VisualItemWithImages) => void;
  deletingItemId?: string | null;
  theme: VisualTheme;
  onQuickUpdate?: VisualItemBoardProps["onQuickUpdate"];
  showDragHandle?: boolean;
  dragHandleProps?: HTMLAttributes<HTMLSpanElement>;
}) {
  const [activeAdminImage, setActiveAdminImage] = useState<VisualArtworkImage | null>(null);
  const [activeAdminImageIndex, setActiveAdminImageIndex] = useState(0);
  const headerImage = mode === "stories" ? activeAdminImage || images[0] : images[0];
  const [quickDate, setQuickDate] = useState(headerImage?.display_date || firstItem.display_date || "");
  const [quickWeekday, setQuickWeekday] = useState(headerImage?.weekday || firstItem.weekday || "SEG");

  useEffect(() => {
    setQuickDate(headerImage?.display_date || firstItem.display_date || "");
    setQuickWeekday(headerImage?.weekday || firstItem.weekday || "SEG");
  }, [firstItem.display_date, firstItem.weekday, headerImage?.display_date, headerImage?.id, headerImage?.weekday]);

  function quickUpdatePayload(values: { displayDate?: string; weekday?: string }) {
    return {
      ...values,
      imageId: mode === "stories" ? headerImage?.id ?? null : null,
      imageIndex: mode === "stories" ? activeAdminImageIndex : undefined,
    };
  }

  function commitQuickDate() {
    const normalizedDate = formatDateInput(quickDate);

    setQuickDate(normalizedDate);
    onQuickUpdate?.(firstItem, quickUpdatePayload({ displayDate: normalizedDate }));
  }

  function commitQuickWeekday(nextWeekday: string) {
    setQuickWeekday(nextWeekday);
    onQuickUpdate?.(firstItem, quickUpdatePayload({ weekday: nextWeekday }));
  }

  function handleActiveImageChange(image: VisualArtworkImage | null, index: number) {
    setActiveAdminImage(image);
    setActiveAdminImageIndex(index);
  }

  return (
    <Card className="overflow-hidden border-border bg-background">
      <CardContent className="space-y-4 p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="sora-heading rounded-md border border-border bg-secondary px-2.5 py-1 text-xs font-medium uppercase text-foreground">
                {formatLabel(mode)}
              </span>
              {onQuickUpdate ? (
                <>
                  <input
                    value={quickDate}
                    inputMode="numeric"
                    maxLength={5}
                    onChange={(event) => setQuickDate(formatDateInput(event.target.value))}
                    onBlur={commitQuickDate}
                    className="h-8 w-[72px] rounded-md border border-border bg-background px-2 text-center text-xs font-semibold text-foreground outline-none transition-colors focus:border-foreground/40"
                    aria-label="Editar data"
                    title="Editar data"
                  />
                  <select
                    value={quickWeekday}
                    onChange={(event) => commitQuickWeekday(event.target.value)}
                    className="h-8 rounded-md border border-border bg-background px-2 text-xs font-semibold uppercase text-foreground outline-none transition-colors focus:border-foreground/40"
                    aria-label="Editar dia da semana"
                    title="Editar dia da semana"
                  >
                    {compactWeekdays.map((weekday) => (
                      <option key={weekday} value={weekday}>
                        {weekday}
                      </option>
                    ))}
                  </select>
                </>
              ) : (
                <>
                  <span className="rounded-md border border-border bg-background px-2.5 py-1 text-xs font-semibold text-foreground">
                    {headerImage?.display_date || firstItem.display_date || "--/--"}
                  </span>
                  <span className="text-xs uppercase text-muted-foreground">
                    {headerImage?.weekday || firstItem.weekday || "--"}
                  </span>
                </>
              )}
              <span className="text-xs text-muted-foreground">
                {images.length} {images.length === 1 ? "imagem" : "imagens"}
              </span>
            </div>
            {mode === "stories" && images.length > 1 ? (
              <p className="mt-2 text-[11px] text-muted-foreground">
                Editando a data do Story {activeAdminImageIndex + 1}/{images.length}
              </p>
            ) : null}
          </div>
          <div className="flex shrink-0 gap-1">
            {showDragHandle ? (
              <span
                {...dragHandleProps}
                className={cn(
                  "grid h-8 w-8 cursor-grab place-items-center rounded-md text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground active:cursor-grabbing",
                  dragHandleProps?.className,
                )}
                aria-hidden={dragHandleProps?.["aria-label"] ? undefined : true}
                title="Arrastar para reorganizar"
              >
                <GripVertical className="h-4 w-4" />
              </span>
            ) : null}
            {onEdit ? (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-muted-foreground hover:text-foreground"
                onClick={() => onEdit(firstItem)}
                aria-label="Editar publicacao"
                title="Editar publicacao"
              >
                <Pencil className="h-4 w-4" />
              </Button>
            ) : null}
            {onDelete ? (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-muted-foreground hover:text-rose-400"
                onClick={() => onDelete(firstItem)}
                disabled={deletingItemId === firstItem.id}
                aria-label="Excluir publicacao"
                title="Excluir publicacao"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            ) : null}
          </div>
        </div>

        <div className="border-t border-border/70 pt-4">
          <AdminArtwork
            images={images}
            mode={mode}
            theme={theme}
            onActiveImageChange={handleActiveImageChange}
          />
        </div>
      </CardContent>
    </Card>
  );
}

export function VisualItemBoard({
  items,
  onEdit,
  onDelete,
  deletingItemId,
  variant = "admin",
  theme = "dark",
  onActiveImageChange,
  onQuickUpdate,
  showDragHandle,
  dragHandleProps,
}: VisualItemBoardProps) {
  if (!items.length) return null;

  const firstItem = items[0];
  const mode = modeFromItem(firstItem);
  const images = imagesFromItems(items);

  if (variant === "public") {
    return (
      <article>
        <PublicArtwork
          images={images}
          mode={mode}
          theme={theme}
          onActiveImageChange={onActiveImageChange}
        />
      </article>
    );
  }

  return (
    <AdminVisualItemCard
      firstItem={firstItem}
      mode={mode}
      images={images}
      onEdit={onEdit}
      onDelete={onDelete}
      deletingItemId={deletingItemId}
      theme={theme}
      onQuickUpdate={onQuickUpdate}
      showDragHandle={showDragHandle}
      dragHandleProps={dragHandleProps}
    />
  );
}
