"use client";

import { type PointerEvent, useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, ImageIcon, Pencil, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
};

type ArtworkImage = {
  id: string;
  image_url: string | null;
  image_path: string | null;
  label: string | null;
};

const visualPresentationsBucket = "visual-presentations";
const legacyPresentationAssetsBucket = "presentation-assets";
const readablePresentationBuckets = [visualPresentationsBucket, legacyPresentationAssetsBucket];

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
    if (item.images?.length) {
      const normalizedImages = item.images
        .map((image) => {
          const normalizedSource = normalizeImageSource(image);

          return {
            id: image.id,
            image_url: normalizedSource.image_url,
            image_path: normalizedSource.image_path,
            label: item.label,
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
        },
      ];
    }

    return [
      {
        id: item.id,
        image_url: null,
        image_path: null,
        label: item.label,
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

function ImageFrame({ image, className }: { image: ArtworkImage; className?: string }) {
  const [hasImageError, setHasImageError] = useState(false);

  useEffect(() => {
    setHasImageError(false);
  }, [image.image_url]);

  const canRenderImage = Boolean(image.image_url && !hasImageError);

  return (
    <div
      className={cn(
        "overflow-hidden border border-black/5 bg-black/[0.035] shadow-sm select-none dark:border-white/10 dark:bg-white/[0.035]",
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
          onError={() => setHasImageError(true)}
          onDragStart={(event) => event.preventDefault()}
          className="pointer-events-none h-full w-full select-none object-contain object-center [-webkit-user-drag:none]"
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
}: {
  images: ArtworkImage[];
  mode: string;
  variant: "admin" | "public";
  theme: VisualTheme;
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
  const frameClass =
    mode === "stories"
      ? isPublic
        ? "mx-auto aspect-[9/16] h-[min(75vh,640px)] max-w-full rounded-xl"
        : "mx-auto aspect-[9/16] w-full max-w-[220px] rounded-lg"
      : mode === "carousel"
        ? isPublic
          ? "mx-auto aspect-[4/5] h-[min(75vh,620px)] max-w-full rounded-xl"
          : "mx-auto aspect-[4/5] w-full max-w-[320px] rounded-lg"
        : isPublic
          ? "mx-auto aspect-square h-[min(70vh,560px)] max-w-full rounded-xl"
          : "mx-auto aspect-[4/5] w-full max-w-[330px] rounded-lg";
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
        ref={viewportRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={stopDragging}
        onPointerCancel={stopDragging}
        onLostPointerCapture={stopDragging}
        className={cn(
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
            <div key={image.id} className="h-full min-w-full shrink-0 select-none">
              <ImageFrame
                image={image}
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
}: {
  images: ArtworkImage[];
  mode: string;
  theme: VisualTheme;
}) {
  return <ArtworkViewer images={images} mode={mode} theme={theme} variant="public" />;
}

function AdminArtwork({
  images,
  mode,
  theme,
}: {
  images: ArtworkImage[];
  mode: string;
  theme: VisualTheme;
}) {
  return <ArtworkViewer images={images} mode={mode} theme={theme} variant="admin" />;
}

export function VisualItemBoard({
  items,
  onEdit,
  onDelete,
  deletingItemId,
  variant = "admin",
  theme = "dark",
}: VisualItemBoardProps) {
  if (!items.length) return null;

  const firstItem = items[0];
  const mode = modeFromItem(firstItem);
  const images = imagesFromItems(items);

  if (variant === "public") {
    return (
      <article>
        <PublicArtwork images={images} mode={mode} theme={theme} />
      </article>
    );
  }

  return (
    <Card className="overflow-hidden border-border bg-card">
      <CardContent className="space-y-4 p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-md border border-border bg-secondary px-2.5 py-1 text-xs font-medium uppercase text-foreground">
                {formatLabel(mode)}
              </span>
              <span className="rounded-md border border-border bg-background px-2.5 py-1 text-xs font-semibold text-foreground">
                {firstItem.display_date || "--/--"}
              </span>
              <span className="text-xs uppercase text-muted-foreground">
                {firstItem.weekday || "--"}
              </span>
              <span className="text-xs text-muted-foreground">
                {images.length} {images.length === 1 ? "imagem" : "imagens"}
              </span>
            </div>
          </div>
          <div className="flex shrink-0 gap-1">
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
          <AdminArtwork images={images} mode={mode} theme={theme} />
        </div>
      </CardContent>
    </Card>
  );
}
