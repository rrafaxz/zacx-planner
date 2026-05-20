"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2 } from "lucide-react";

import { PublicClientHeading } from "@/components/public-view/public-client-heading";
import { PublicHeader } from "@/components/public-view/public-header";
import { useTheme } from "@/components/theme/theme-provider";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  fullWeekday,
  VisualItemBoard,
  type VisualArtworkImage,
  type VisualItemWithImages,
} from "@/components/visual-presentations/visual-item-board";
import {
  applyAutomaticVisualPresentationRange,
  buildVisualPresentationWeeks,
  filterVisualItemsForWeek,
  type VisualPresentationWeek,
} from "@/components/visual-presentations/visual-presentation-weeks";
import { supabase } from "@/lib/supabase/client";
import type { Client, VisualItemImage, VisualPresentation } from "@/lib/supabase/types";
import { cn } from "@/lib/utils";

type PublicVisualPresentationViewProps = {
  slug: string;
};

function groupVisualItems(items: VisualItemWithImages[]) {
  const groups = new Map<string, VisualItemWithImages[]>();

  items.forEach((item) => {
    const format = `${item.format ?? "post"}`.toLowerCase();
    const key =
      format === "post" || item.images?.length
        ? item.id
        : [format, item.weekday || "sem-dia", item.display_date || "sem-data"].join("|");

    groups.set(key, [...(groups.get(key) ?? []), item]);
  });

  return Array.from(groups.entries()).map(([key, groupItems]) => ({ key, items: groupItems }));
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

function visualItemMode(item?: VisualItemWithImages | null) {
  const format = `${item?.format ?? ""}`.toLowerCase();

  if (format.includes("stories") || format.includes("story")) return "stories";
  if (format.includes("carousel") || format.includes("carrossel")) return "carousel";

  return "post";
}

function NotFoundState() {
  return (
    <main className="min-h-screen bg-background px-4 py-8 text-foreground">
      <div className="mx-auto flex min-h-[70vh] max-w-2xl items-center">
        <Card className="w-full">
          <CardHeader>
            <CardTitle>Apresentacao nao encontrada</CardTitle>
            <CardDescription>
              O link pode ter sido alterado ou removido. Solicite um novo link para a equipe Zacx.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    </main>
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

function PresentationItemHeader({
  displayDate,
  weekday,
  dateColor,
  dateTextColor,
  weekdayColor,
  weekdayTextColor,
}: {
  displayDate?: string | null;
  weekday?: string | null;
  dateColor: string;
  dateTextColor: string;
  weekdayColor: string;
  weekdayTextColor: string;
}) {
  const blockClass =
    "flex h-10 min-w-0 items-center justify-center rounded-md px-2 text-center text-[11px] font-medium uppercase leading-tight tracking-normal sm:h-14 sm:rounded-lg sm:px-3 sm:text-sm md:text-base";
  const [dateDay, dateMonth] = (displayDate || "--/--").split("/");

  return (
    <div className="mx-auto grid w-full max-w-xl grid-cols-2 gap-2">
      <div
        className={blockClass}
        style={{ backgroundColor: dateColor, color: dateTextColor }}
      >
        <span className="font-semibold">{dateDay || "--"}</span>
        <span className="font-normal opacity-75">/{dateMonth || "--"}</span>
      </div>
      <div
        className={blockClass}
        style={{ backgroundColor: weekdayColor, color: weekdayTextColor }}
      >
        {fullWeekday(weekday).toUpperCase()}
      </div>
    </div>
  );
}

function PublicVisualItemSection({
  groupKey,
  groupItems,
  featuredItem,
  client,
  theme,
  presentation,
  primaryColor,
  primaryTextColor,
  secondaryColor,
  secondaryTextColor,
}: {
  groupKey: string;
  groupItems: VisualItemWithImages[];
  featuredItem?: VisualItemWithImages;
  client: Client | null;
  theme: "dark" | "light";
  presentation: VisualPresentation;
  primaryColor: string;
  primaryTextColor: string;
  secondaryColor: string;
  secondaryTextColor: string;
}) {
  const [activeImage, setActiveImage] = useState<VisualArtworkImage | null>(null);
  const firstItem = groupItems[0] || featuredItem;
  const isStories = visualItemMode(firstItem) === "stories";
  const displayDate = isStories
    ? activeImage?.display_date || firstItem?.display_date || presentation.period_label
    : firstItem?.display_date || presentation.period_label;
  const weekday = isStories ? activeImage?.weekday || firstItem?.weekday : firstItem?.weekday;

  return (
    <section key={groupKey} className="space-y-3 md:space-y-10">
      <PresentationItemHeader
        displayDate={displayDate}
        weekday={weekday}
        dateColor={primaryColor}
        dateTextColor={primaryTextColor}
        weekdayColor={secondaryColor}
        weekdayTextColor={secondaryTextColor}
      />
      <VisualItemBoard
        items={groupItems}
        client={client}
        variant="public"
        theme={theme}
        onActiveImageChange={setActiveImage}
      />
    </section>
  );
}

function PublicWeekSelection({
  weeks,
  items,
  selectedWeekId,
  onSelectWeek,
}: {
  weeks: VisualPresentationWeek[];
  items: VisualItemWithImages[];
  selectedWeekId: string | null;
  onSelectWeek: (weekId: string) => void;
}) {
  return (
    <section className="no-scrollbar mt-4 flex max-w-full snap-x snap-mandatory gap-2 overflow-x-auto pb-1 sm:grid sm:grid-cols-2 sm:overflow-visible sm:pb-0 lg:grid-cols-4">
      {weeks.map((week) => {
        const itemCount = filterVisualItemsForWeek(items, week).length;

        return (
          <button
            key={week.id}
            type="button"
            onClick={() => onSelectWeek(week.id)}
            className={cn(
              "min-w-[138px] flex-none snap-start rounded-lg border border-dashed bg-background px-3 py-3.5 text-left transition-colors hover:border-foreground/35 hover:bg-foreground/[0.02] sm:min-w-0 sm:rounded-xl sm:px-4 sm:py-5",
              selectedWeekId === week.id
                ? "border-[#1D10D7] bg-neutral-900/[0.045] dark:border-[#DFFF06] dark:bg-[#DFFF06]/[0.07]"
                : "border-border",
            )}
          >
            <span className="sora-heading block text-xs font-semibold uppercase text-foreground sm:text-sm">{week.actionLabel}</span>
            <span className="mt-1 block text-[11px] text-muted-foreground sm:text-xs">{week.periodLabel}</span>
            <span className="mt-2 inline-flex rounded-md border border-border px-2 py-0.5 text-[10px] text-muted-foreground sm:mt-3 sm:rounded-full sm:px-2.5 sm:py-1 sm:text-[11px]">
              {itemCount} {itemCount === 1 ? "item" : "itens"}
            </span>
          </button>
        );
      })}
    </section>
  );
}

export function PublicVisualPresentationView({ slug }: PublicVisualPresentationViewProps) {
  const [presentation, setPresentation] = useState<VisualPresentation | null>(null);
  const [client, setClient] = useState<Client | null>(null);
  const [items, setItems] = useState<VisualItemWithImages[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedWeekId, setSelectedWeekId] = useState<string | null>(null);
  const { theme, isLight } = useTheme();
  const effectivePresentation = useMemo(
    () => (presentation ? applyAutomaticVisualPresentationRange(presentation, items, client?.name || "Cliente") : null),
    [client?.name, items, presentation],
  );
  const presentationWeeks = useMemo(
    () => (effectivePresentation ? buildVisualPresentationWeeks(effectivePresentation) : []),
    [effectivePresentation],
  );
  const shouldShowWeekSelection = presentationWeeks.length > 1;
  const selectedWeek = shouldShowWeekSelection
    ? presentationWeeks.find((week) => week.id === selectedWeekId) ?? presentationWeeks[0] ?? null
    : presentationWeeks[0] ?? null;
  const visibleItems = selectedWeek ? filterVisualItemsForWeek(items, selectedWeek) : items;

  async function loadPresentation() {
    setLoading(true);
    setError(null);

    const { data: presentationData, error: presentationError } = await supabase
      .from("visual_presentations")
      .select("*")
      .eq("public_slug", slug)
      .eq("is_public", true)
      .maybeSingle();

    if (presentationError || !presentationData) {
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
        .eq("is_visible", true)
        .order("order_index", { ascending: true })
        .order("created_at", { ascending: true }),
    ]);

    const firstError = clientResult.error || itemResult.error;

    if (firstError) {
      setError(firstError.message);
    } else {
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

      setPresentation(presentationData);
      setClient(clientResult.data);
      setItems(mapImagesToItems(itemData, itemImages));
    }

    setLoading(false);
  }

  useEffect(() => {
    loadPresentation();
  }, [slug]);

  useEffect(() => {
    setSelectedWeekId(null);
  }, [slug]);

  useEffect(() => {
    if (!shouldShowWeekSelection || !presentationWeeks.length) return;

    setSelectedWeekId((currentWeekId) =>
      currentWeekId && presentationWeeks.some((week) => week.id === currentWeekId)
        ? currentWeekId
        : presentationWeeks[0].id,
    );
  }, [presentationWeeks, shouldShowWeekSelection]);

  if (loading) {
    return (
      <main
        className={cn(
          "grid min-h-screen place-items-center px-4",
          isLight ? "bg-background text-foreground" : "bg-background text-foreground",
        )}
      >
        <div
          className={cn(
            "flex items-center gap-3 text-sm",
            "text-muted-foreground",
          )}
        >
          <Loader2 className="h-4 w-4 animate-spin" />
          Carregando apresentacao...
        </div>
      </main>
    );
  }

  if (!effectivePresentation) {
    return <NotFoundState />;
  }

  const featuredItem = visibleItems[0] ?? items[0];
  const primaryColor = client?.primary_color || "#DFFF06";
  const secondaryColor = client?.secondary_color || primaryColor;
  const primaryTextColor = textColorForBackground(primaryColor);
  const secondaryTextColor = textColorForBackground(secondaryColor);

  return (
    <main className="min-h-screen bg-background text-foreground transition-colors">
      <PublicHeader type="presentation" />

      <section className="mx-auto w-full max-w-6xl px-4 pb-10 pt-5 md:pb-12 md:pt-6">
        <PublicClientHeading
          client={client}
          title={effectivePresentation.title}
          periodLabel={effectivePresentation.period_label}
        />

        {error ? (
          <Card className="mt-5 border-rose-500/30 bg-rose-500/10">
            <CardContent className="pt-5 text-sm text-rose-100">{error}</CardContent>
          </Card>
        ) : null}

        {shouldShowWeekSelection ? (
          <PublicWeekSelection
            weeks={presentationWeeks}
            items={items}
            selectedWeekId={selectedWeek?.id ?? null}
            onSelectWeek={setSelectedWeekId}
          />
        ) : null}

        <section className="mt-4 md:mt-6">
          {shouldShowWeekSelection && selectedWeek ? (
            <div className="mb-4 md:mb-5">
              <div>
                <h2 className="sora-heading text-base font-semibold text-foreground">{selectedWeek.label}</h2>
                <p className="text-xs text-muted-foreground">{selectedWeek.periodLabel}</p>
              </div>
            </div>
          ) : null}

          {visibleItems.length ? (
            <div className="space-y-6 md:space-y-24">
              {groupVisualItems(visibleItems).map((group) => {
                return (
                  <PublicVisualItemSection
                    key={group.key}
                    groupKey={group.key}
                    groupItems={group.items}
                    featuredItem={featuredItem}
                    client={client}
                    theme={theme}
                    presentation={effectivePresentation}
                    primaryColor={primaryColor}
                    primaryTextColor={primaryTextColor}
                    secondaryColor={secondaryColor}
                    secondaryTextColor={secondaryTextColor}
                  />
                );
              })}
            </div>
          ) : (
            <Card>
              <CardContent className="pt-5 text-sm text-muted-foreground">
                Nenhuma arte foi enviada para esta semana ainda.
              </CardContent>
            </Card>
          )}
        </section>

      </section>
    </main>
  );
}
