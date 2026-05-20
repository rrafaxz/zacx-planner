"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ImagePlus, Search, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { supabase } from "@/lib/supabase/client";
import { cn, formatDateBR } from "@/lib/utils";

type FeedFilter = "all" | "plannings" | "presentations";

type FeedItem = {
  id: string;
  type: Exclude<FeedFilter, "all">;
  title: string;
  clientName?: string;
  href: string;
  date: string | null;
  periodLabel?: string | null;
  startDisplayDate?: string | null;
  previewText?: string | null;
  imageUrl?: string | null;
};

type FeedClient = {
  id: string;
  name: string;
  created_at: string | null;
  updated_at: string | null;
};

type FeedDeliverable = {
  id: string;
  client_id: string | null;
  title: string | null;
  public_slug: string | null;
  period_label?: string | null;
  start_display_date?: string | null;
  document_content?: string | null;
  created_at: string | null;
  updated_at: string | null;
  archived_at?: string | null;
  deleted_at?: string | null;
};

type FeedVisualThumbnail = {
  visual_presentation_id: string | null;
  image_url: string | null;
  order_index: number | null;
  created_at: string | null;
};

function normalizedSearch(value?: string | null) {
  return `${value ?? ""}`
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function itemTypeLabel(type: FeedItem["type"]) {
  if (type === "presentations") return "Apresentação";

  return "Planejamento";
}

function extractPreviewText(...contents: Array<string | null | undefined>) {
  return contents
    .map((content) => `${content ?? ""}`.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim())
    .find(Boolean) || "";
}

function monthLabel(value?: string | null) {
  const match = `${value ?? ""}`.match(/(\d{1,2})\/(\d{1,2})/);

  if (!match) return "";

  const month = Number(match[2]);
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

  return monthNames[month - 1] || "";
}

export function ActivityFeed() {
  const [items, setItems] = useState<FeedItem[]>([]);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<FeedFilter>("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadFeed() {
      setLoading(true);
      setError(null);

      const [clientsResult, planningsResult, presentationsResult, thumbnailResult] = await Promise.all([
        supabase.from("clients").select("id, name, created_at, updated_at").is("deleted_at", null),
        supabase
          .from("copy_plannings")
          .select("id, client_id, title, public_slug, period_label, start_display_date, document_content, created_at, updated_at, archived_at, deleted_at")
          .is("deleted_at", null),
        supabase
          .from("visual_presentations")
          .select("id, client_id, title, public_slug, period_label, start_display_date, created_at, updated_at, archived_at, deleted_at")
          .is("deleted_at", null),
        supabase
          .from("visual_items")
          .select("visual_presentation_id, image_url, order_index, created_at")
          .not("image_url", "is", null),
      ]);

      const firstError = clientsResult.error || planningsResult.error || presentationsResult.error || thumbnailResult.error;

      if (firstError) {
        setError(firstError.message);
        setLoading(false);
        return;
      }

      const clients = (clientsResult.data ?? []) as FeedClient[];
      const clientsById = new Map(clients.map((client) => [client.id, client]));
      const plannings = (planningsResult.data ?? []) as FeedDeliverable[];
      const presentations = (presentationsResult.data ?? []) as FeedDeliverable[];
      const thumbnails = ((thumbnailResult.data ?? []) as FeedVisualThumbnail[])
        .slice()
        .sort(
          (left, right) =>
            (left.order_index ?? 0) - (right.order_index ?? 0) ||
            `${left.created_at ?? ""}`.localeCompare(`${right.created_at ?? ""}`),
        )
        .reduce<Record<string, string>>((map, item) => {
          if (item.visual_presentation_id && item.image_url && !map[item.visual_presentation_id]) {
            map[item.visual_presentation_id] = item.image_url;
          }

          return map;
        }, {});

      const nextItems: FeedItem[] = [
        ...plannings.map((planning) => ({
          id: planning.id,
          type: "plannings" as const,
          title: planning.title || "Planejamento",
          clientName: planning.client_id ? clientsById.get(planning.client_id)?.name : undefined,
          href: `/admin/planejamentos/${planning.id}`,
          date: planning.updated_at || planning.created_at,
          periodLabel: planning.period_label,
          startDisplayDate: planning.start_display_date,
          previewText: extractPreviewText(planning.document_content),
        })),
        ...presentations.map((presentation) => ({
          id: presentation.id,
          type: "presentations" as const,
          title: presentation.title || "Apresentação",
          clientName: presentation.client_id ? clientsById.get(presentation.client_id)?.name : undefined,
          href: `/admin/apresentacoes/${presentation.id}`,
          date: presentation.updated_at || presentation.created_at,
          periodLabel: presentation.period_label,
          startDisplayDate: presentation.start_display_date,
          imageUrl: thumbnails[presentation.id],
        })),
      ];

      setItems(
        nextItems.sort(
          (left, right) => new Date(right.date ?? "").getTime() - new Date(left.date ?? "").getTime(),
        ),
      );
      setLoading(false);
    }

    loadFeed();
  }, []);

  const visibleItems = useMemo(() => {
    const query = normalizedSearch(search);

    return items.filter((item) => {
      const matchesFilter = filter === "all" || item.type === filter;
      const matchesSearch =
        !query || normalizedSearch(`${item.title} ${item.clientName ?? ""} ${itemTypeLabel(item.type)}`).includes(query);

      return matchesFilter && matchesSearch;
    });
  }, [filter, items, search]);

  return (
    <section className="space-y-6 md:space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="sora-heading text-2xl font-medium text-foreground md:text-4xl">Geral</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground md:mt-3">
            Planejamentos e apresentações recentes em um feed único.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex h-10 min-w-[240px] items-center rounded-lg border border-border bg-background px-3 text-muted-foreground">
            <Search className="h-4 w-4 shrink-0" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar no feed..."
              className="h-9 min-w-0 border-0 bg-transparent text-sm text-foreground shadow-none focus-visible:ring-0"
            />
            {search ? (
              <button type="button" onClick={() => setSearch("")} aria-label="Limpar busca">
                <X className="h-4 w-4" />
              </button>
            ) : null}
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {[
          { value: "all", label: "Tudo" },
          { value: "plannings", label: "Planejamentos" },
          { value: "presentations", label: "Apresentações" },
        ].map((option) => (
          <Button
            key={option.value}
            type="button"
            variant="ghostSecondary"
            size="sm"
            onClick={() => setFilter(option.value as FeedFilter)}
            className={cn(
              "rounded-md border border-border bg-background",
              filter === option.value && "border-foreground/30 bg-foreground/[0.06] text-foreground",
            )}
          >
            {option.label}
          </Button>
        ))}
      </div>

      {error ? (
        <Card className="border-rose-600 bg-rose-600 text-white">
          <CardContent className="pt-5 text-sm font-medium">{error}</CardContent>
        </Card>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {loading ? (
          <Card className="sm:col-span-2 xl:col-span-3">
            <CardContent className="pt-5 text-sm text-muted-foreground">Carregando feed...</CardContent>
          </Card>
        ) : visibleItems.length ? (
          visibleItems.map((item) => (
            <Link key={`${item.type}-${item.id}`} href={item.href} className="block h-full">
              <Card className="group h-full overflow-hidden bg-background shadow-none transition hover:-translate-y-0.5 hover:border-foreground/20">
                <CardContent className="flex h-full flex-col p-3">
                  {item.type === "presentations" ? (
                    <div className="relative h-40 overflow-hidden rounded-lg border border-border bg-secondary">
                      {item.imageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={item.imageUrl} alt="" className="h-full w-full object-cover transition group-hover:scale-[1.03]" />
                      ) : (
                        <div className="grid h-full place-items-center text-muted-foreground">
                          <ImagePlus className="h-8 w-8" />
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="h-40 overflow-hidden rounded-lg border border-black/10 bg-white p-3 text-neutral-950">
                      <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-[var(--zacx-brand)]" />
                      <p className="text-[9px] leading-4 text-neutral-500">
                        {item.previewText || "Prévia do planejamento"}
                      </p>
                    </div>
                  )}
                  <div className="flex flex-1 flex-col px-1 pb-1 pt-3">
                    <div className="mb-2 flex flex-wrap items-center gap-1.5">
                      <span className="rounded-full border border-border px-2 py-0.5 text-[10px] font-medium uppercase text-muted-foreground">
                        {itemTypeLabel(item.type)}
                      </span>
                      {monthLabel(item.startDisplayDate) ? (
                        <span className="rounded-full border border-border px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                          {monthLabel(item.startDisplayDate)}
                        </span>
                      ) : null}
                    </div>
                    <h2 className="sora-heading line-clamp-2 text-base font-medium leading-snug text-foreground">
                      {item.title}
                    </h2>
                    <p className="mt-2 line-clamp-2 text-xs text-muted-foreground">
                      {item.clientName ? `${item.clientName} · ` : ""}
                      {item.periodLabel || "Período não definido"}
                    </p>
                    <p className="mt-auto pt-3 text-[11px] text-muted-foreground">
                      {item.date ? formatDateBR(item.date) : "Sem data"}
                    </p>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))
        ) : (
          <Card className="border-dashed bg-background shadow-none sm:col-span-2 xl:col-span-3">
            <CardContent className="pt-5 text-sm text-muted-foreground">
              Nenhum item encontrado.
            </CardContent>
          </Card>
        )}
      </div>
    </section>
  );
}
