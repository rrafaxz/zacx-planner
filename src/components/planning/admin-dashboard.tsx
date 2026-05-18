"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Activity,
  Archive,
  Clock3,
  FileText,
  Image,
  Images,
  Layers3,
  Plus,
  UsersRound,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/lib/supabase/client";

type DashboardClient = {
  id: string;
  name: string;
  created_at: string | null;
};

type DashboardDeliverable = {
  id: string;
  client_id: string | null;
  created_at: string | null;
  archived_at?: string | null;
  deleted_at?: string | null;
};

type DashboardVisualItem = {
  id: string;
  visual_presentation_id: string | null;
  format: string | null;
  created_at: string | null;
};

type DashboardVisualImage = {
  id: string;
  visual_item_id: string | null;
  created_at: string | null;
};

type DashboardData = {
  clients: DashboardClient[];
  copyPlannings: DashboardDeliverable[];
  visualPresentations: DashboardDeliverable[];
  visualItems: DashboardVisualItem[];
  visualImages: DashboardVisualImage[];
};

type DashboardFilters = {
  clientId: string;
  month: string;
  type: "all" | "planning" | "presentation";
  status: "all" | "active" | "archived";
};

const monthOptions = [
  { value: "all", label: "Todos os meses" },
  { value: "01", label: "JAN" },
  { value: "02", label: "FEV" },
  { value: "03", label: "MAR" },
  { value: "04", label: "ABR" },
  { value: "05", label: "MAI" },
  { value: "06", label: "JUN" },
  { value: "07", label: "JUL" },
  { value: "08", label: "AGO" },
  { value: "09", label: "SET" },
  { value: "10", label: "OUT" },
  { value: "11", label: "NOV" },
  { value: "12", label: "DEZ" },
];

const compactSelectClass =
  "h-10 rounded-md border border-border bg-background px-3 text-sm text-foreground outline-none transition-colors focus:border-neutral-400 dark:focus:border-white/35";

function createdMonth(value?: string | null) {
  if (!value) return "";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "";

  return String(date.getMonth() + 1).padStart(2, "0");
}

function normalizeFormat(format?: string | null) {
  const value = `${format ?? ""}`.toLowerCase();

  if (value.includes("stories") || value.includes("story")) return "stories";
  if (value.includes("carousel") || value.includes("carrossel")) return "carousel";

  return "post";
}

function sparklinePoints(values: number[]) {
  if (!values.length) return "";

  const width = 120;
  const height = 36;
  const max = Math.max(...values, 1);

  return values
    .map((value, index) => {
      const x = values.length === 1 ? width : (index / (values.length - 1)) * width;
      const y = height - (value / max) * (height - 4) - 2;

      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
}

function Sparkline({ values }: { values: number[] }) {
  const points = sparklinePoints(values);

  return (
    <svg viewBox="0 0 120 36" className="h-9 w-24 overflow-visible" aria-hidden="true">
      <polyline
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2.5"
        points={points}
        className="text-[var(--zacx-brand)]"
      />
    </svg>
  );
}

function buildMonthlySeries(items: Array<{ created_at: string | null }>) {
  const counts = Array.from({ length: 6 }, () => 0);
  const now = new Date();

  items.forEach((item) => {
    if (!item.created_at) return;

    const date = new Date(item.created_at);

    if (Number.isNaN(date.getTime())) return;

    const diff =
      (now.getFullYear() - date.getFullYear()) * 12 + (now.getMonth() - date.getMonth());

    if (diff >= 0 && diff < 6) {
      counts[5 - diff] += 1;
    }
  });

  return counts;
}

export function AdminDashboard() {
  const [data, setData] = useState<DashboardData>({
    clients: [],
    copyPlannings: [],
    visualPresentations: [],
    visualItems: [],
    visualImages: [],
  });
  const [filters, setFilters] = useState<DashboardFilters>({
    clientId: "all",
    month: "all",
    type: "all",
    status: "all",
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadMetrics() {
      setLoading(true);
      setError(null);

      const [clients, copyPlannings, visualPresentations, visualItems, visualImages] =
        await Promise.all([
          supabase.from("clients").select("id, name, created_at").order("name", { ascending: true }),
          supabase
            .from("copy_plannings")
            .select("id, client_id, created_at, archived_at, deleted_at"),
          supabase
            .from("visual_presentations")
            .select("id, client_id, created_at, archived_at, deleted_at"),
          supabase.from("visual_items").select("id, visual_presentation_id, format, created_at"),
          supabase.from("visual_item_images").select("id, visual_item_id, created_at"),
        ]);

      const firstError =
        clients.error ||
        copyPlannings.error ||
        visualPresentations.error ||
        visualItems.error ||
        visualImages.error;

      if (firstError) {
        setError(firstError.message);
      } else {
        setData({
          clients: (clients.data ?? []) as DashboardClient[],
          copyPlannings: (copyPlannings.data ?? []) as DashboardDeliverable[],
          visualPresentations: (visualPresentations.data ?? []) as DashboardDeliverable[],
          visualItems: (visualItems.data ?? []) as DashboardVisualItem[],
          visualImages: (visualImages.data ?? []) as DashboardVisualImage[],
        });
      }

      setLoading(false);
    }

    loadMetrics();
  }, []);

  const filtered = useMemo(() => {
    const presentationIds = new Set(
      data.visualPresentations
        .filter((presentation) => {
          const matchesClient =
            filters.clientId === "all" || presentation.client_id === filters.clientId;
          const matchesMonth =
            filters.month === "all" || createdMonth(presentation.created_at) === filters.month;
          const matchesStatus =
            filters.status === "all" ||
            (filters.status === "archived"
              ? Boolean(presentation.archived_at)
              : !presentation.archived_at && !presentation.deleted_at);

          return matchesClient && matchesMonth && matchesStatus && !presentation.deleted_at;
        })
        .map((presentation) => presentation.id),
    );
    const visualItemIds = new Set<string>();

    const copyPlannings = data.copyPlannings.filter((planning) => {
      const matchesClient = filters.clientId === "all" || planning.client_id === filters.clientId;
      const matchesMonth = filters.month === "all" || createdMonth(planning.created_at) === filters.month;
      const matchesStatus =
        filters.status === "all" ||
        (filters.status === "archived"
          ? Boolean(planning.archived_at)
          : !planning.archived_at && !planning.deleted_at);

      return matchesClient && matchesMonth && matchesStatus && !planning.deleted_at;
    });
    const visualPresentations = data.visualPresentations.filter((presentation) =>
      presentationIds.has(presentation.id),
    );
    const visualItems = data.visualItems.filter((item) => {
      const matches = Boolean(item.visual_presentation_id && presentationIds.has(item.visual_presentation_id));

      if (matches) {
        visualItemIds.add(item.id);
      }

      return matches;
    });
    const visualImages = data.visualImages.filter(
      (image) => Boolean(image.visual_item_id && visualItemIds.has(image.visual_item_id)),
    );

    return {
      copyPlannings: filters.type === "presentation" ? [] : copyPlannings,
      visualPresentations: filters.type === "planning" ? [] : visualPresentations,
      visualItems: filters.type === "planning" ? [] : visualItems,
      visualImages: filters.type === "planning" ? [] : visualImages,
    };
  }, [data, filters]);

  const activePlannings = filtered.copyPlannings.filter((planning) => !planning.archived_at).length;
  const activePresentations = filtered.visualPresentations.filter((presentation) => !presentation.archived_at).length;
  const archivedItems =
    filtered.copyPlannings.filter((planning) => Boolean(planning.archived_at)).length +
    filtered.visualPresentations.filter((presentation) => Boolean(presentation.archived_at)).length;
  const posts = filtered.visualItems.filter((item) => normalizeFormat(item.format) === "post").length;
  const carousels = filtered.visualItems.filter((item) => normalizeFormat(item.format) === "carousel").length;
  const stories = filtered.visualItems.filter((item) => normalizeFormat(item.format) === "stories").length;
  const visualItemCount = filtered.visualItems.length;
  const visualImageCount = filtered.visualImages.length;
  const recentActivity = [
    ...filtered.copyPlannings,
    ...filtered.visualPresentations,
    ...filtered.visualItems,
  ].filter((item) => item.created_at);
  const recentCutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const recentActivityCount = recentActivity.filter((item) => {
    const createdAt = item.created_at ? new Date(item.created_at).getTime() : 0;

    return createdAt >= recentCutoff;
  }).length;
  const deliverables = [...filtered.copyPlannings, ...filtered.visualPresentations];

  const cards = [
    {
      label: "Total de clientes",
      value: filters.clientId === "all" ? data.clients.length : 1,
      description: "Perfis na biblioteca",
      icon: UsersRound,
      series: buildMonthlySeries(data.clients),
    },
    {
      label: "Planejamentos ativos",
      value: activePlannings,
      description: "Documentos fora dos arquivados",
      icon: FileText,
      series: buildMonthlySeries(filtered.copyPlannings),
    },
    {
      label: "Apresentações ativas",
      value: activePresentations,
      description: "Pranchas fora dos arquivados",
      icon: Images,
      series: buildMonthlySeries(filtered.visualPresentations),
    },
    {
      label: "Itens arquivados",
      value: archivedItems,
      description: "Planejamentos e apresentações",
      icon: Archive,
      series: buildMonthlySeries(deliverables.filter((item) => Boolean(item.archived_at))),
    },
    {
      label: "Publicações visuais",
      value: visualItemCount,
      description: "Posts, carrosséis e stories",
      icon: Layers3,
      series: buildMonthlySeries(filtered.visualItems),
    },
    {
      label: "Posts",
      value: posts,
      description: "Itens de feed únicos",
      icon: Image,
      series: buildMonthlySeries(filtered.visualItems.filter((item) => normalizeFormat(item.format) === "post")),
    },
    {
      label: "Carrosséis",
      value: carousels,
      description: "Itens com múltiplas artes",
      icon: Images,
      series: buildMonthlySeries(filtered.visualItems.filter((item) => normalizeFormat(item.format) === "carousel")),
    },
    {
      label: "Stories e imagens",
      value: `${stories}/${visualImageCount}`,
      description: "Stories / imagens enviadas",
      icon: Clock3,
      series: buildMonthlySeries(filtered.visualImages),
    },
    {
      label: "Atividade recente",
      value: recentActivityCount,
      description: "Criados nos últimos 7 dias",
      icon: Activity,
      series: buildMonthlySeries(recentActivity),
    },
  ];

  return (
    <section className="space-y-6 md:space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="sora-heading mt-2 text-2xl font-medium tracking-normal text-foreground md:text-4xl">
            Controle de conteudo e apresentacoes
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground md:mt-3">
            Acompanhe clientes, documentos de copy e apresentacoes visuais.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Button asChild variant="ghostSecondary">
            <Link href="/admin/clientes">Ver clientes</Link>
          </Button>
          <Button asChild>
            <Link href="/admin/clientes#novo-cliente">
              <Plus className="h-4 w-4" />
              Novo cliente
            </Link>
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <select
          value={filters.clientId}
          onChange={(event) => setFilters((current) => ({ ...current, clientId: event.target.value }))}
          className={compactSelectClass}
        >
          <option value="all">Todos os clientes</option>
          {data.clients.map((client) => (
            <option key={client.id} value={client.id}>
              {client.name}
            </option>
          ))}
        </select>
        <select
          value={filters.month}
          onChange={(event) => setFilters((current) => ({ ...current, month: event.target.value }))}
          className={compactSelectClass}
        >
          {monthOptions.map((month) => (
            <option key={month.value} value={month.value}>
              {month.label}
            </option>
          ))}
        </select>
        <select
          value={filters.type}
          onChange={(event) =>
            setFilters((current) => ({
              ...current,
              type: event.target.value as DashboardFilters["type"],
            }))
          }
          className={compactSelectClass}
        >
          <option value="all">Tudo</option>
          <option value="planning">Planejamentos</option>
          <option value="presentation">Apresentações</option>
        </select>
        <select
          value={filters.status}
          onChange={(event) =>
            setFilters((current) => ({
              ...current,
              status: event.target.value as DashboardFilters["status"],
            }))
          }
          className={compactSelectClass}
        >
          <option value="all">Ativos e arquivados</option>
          <option value="active">Ativos</option>
          <option value="archived">Arquivados</option>
        </select>
      </div>

      {error ? (
        <Card className="border-rose-600 bg-rose-600 text-white">
          <CardContent className="pt-5 text-sm font-medium">{error}</CardContent>
        </Card>
      ) : null}

      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        {cards.map((card) => {
          const Icon = card.icon;

          return (
            <Card key={card.label} className="border-border/70 bg-background shadow-none">
              <CardHeader className="flex-row items-start justify-between gap-3 p-4 pb-2 md:p-5 md:pb-3">
                <div>
                  <CardDescription className="text-xs md:text-sm">{card.label}</CardDescription>
                  <CardTitle className="mt-2 text-2xl md:mt-3 md:text-3xl">
                    {loading ? "--" : card.value}
                  </CardTitle>
                </div>
                <Icon className="h-5 w-5 text-muted-foreground" />
              </CardHeader>
              <CardContent className="px-4 pb-4 md:px-5 md:pb-5">
                <div className="mb-2 text-muted-foreground">
                  <Sparkline values={card.series} />
                </div>
                <p className="hidden text-sm text-muted-foreground md:block">{card.description}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </section>
  );
}
