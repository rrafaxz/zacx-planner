"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";

import { PublicClientHeading } from "@/components/public-view/public-client-heading";
import { PublicHeader } from "@/components/public-view/public-header";
import { useTheme } from "@/components/theme/theme-provider";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  fullWeekday,
  VisualItemBoard,
  type VisualItemWithImages,
} from "@/components/visual-presentations/visual-item-board";
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
    "flex h-12 min-w-0 items-center justify-center rounded-lg px-2 text-center text-[11px] font-medium uppercase leading-tight tracking-normal sm:h-14 sm:px-3 sm:text-sm md:text-base";
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

export function PublicVisualPresentationView({ slug }: PublicVisualPresentationViewProps) {
  const [presentation, setPresentation] = useState<VisualPresentation | null>(null);
  const [client, setClient] = useState<Client | null>(null);
  const [items, setItems] = useState<VisualItemWithImages[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { theme, isLight } = useTheme();

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

  if (!presentation) {
    return <NotFoundState />;
  }

  const featuredItem = items[0];
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
          title={presentation.title}
          periodLabel={presentation.period_label}
        />

        {error ? (
          <Card className="mt-5 border-rose-500/30 bg-rose-500/10">
            <CardContent className="pt-5 text-sm text-rose-100">{error}</CardContent>
          </Card>
        ) : null}

        <section className="mt-5 md:mt-6">
          {items.length ? (
            <div className="space-y-10 md:space-y-24">
              {groupVisualItems(items).map((group) => {
                const firstItem = group.items[0] || featuredItem;

                return (
                  <section key={group.key} className="space-y-5 md:space-y-10">
                    <PresentationItemHeader
                      displayDate={firstItem?.display_date || presentation.period_label}
                      weekday={firstItem?.weekday}
                      dateColor={primaryColor}
                      dateTextColor={primaryTextColor}
                      weekdayColor={secondaryColor}
                      weekdayTextColor={secondaryTextColor}
                    />
                    <VisualItemBoard
                      items={group.items}
                      client={client}
                      variant="public"
                      theme={theme}
                    />
                  </section>
                );
              })}
            </div>
          ) : (
            <Card>
              <CardContent className="pt-5 text-sm text-muted-foreground">
                Nenhuma arte foi enviada para esta apresentacao ainda.
              </CardContent>
            </Card>
          )}
        </section>

      </section>
    </main>
  );
}
