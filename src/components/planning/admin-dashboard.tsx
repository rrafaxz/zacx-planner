"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Archive,
  BarChart3,
  Crown,
  FileText,
  Images,
  Layers3,
  Loader2,
  Plus,
  Settings2,
  Trophy,
  Upload,
  UsersRound,
} from "lucide-react";

import { ClientAvatarDisplay } from "@/components/clients/client-detail";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { optimizeImage } from "@/lib/image-optimizer";
import { extractEndDisplayDate, planningEndStatus } from "@/lib/planning-end-status";
import { supabase } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

type DashboardClient = {
  id: string;
  name: string;
  logo_url: string | null;
  primary_color: string | null;
  responsible_name: string | null;
  archived_at: string | null;
  deleted_at: string | null;
  created_at: string | null;
};

type DashboardDeliverable = {
  id: string;
  client_id: string | null;
  title?: string | null;
  period_label?: string | null;
  start_display_date?: string | null;
  end_display_date?: string | null;
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
  responsible: "all" | "none" | "Rafael" | "Matheus";
  status: "all" | "active" | "archived";
};

const responsibleOptions = ["Rafael", "Matheus"] as const;
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

  return Number.isNaN(date.getTime()) ? "" : String(date.getMonth() + 1).padStart(2, "0");
}

function normalizeFormat(format?: string | null) {
  const value = `${format ?? ""}`.toLowerCase();

  if (value.includes("stories") || value.includes("story")) return "stories";
  if (value.includes("carousel") || value.includes("carrossel")) return "carousel";

  return "post";
}

function safeStorageFileName(fileName: string) {
  const name = fileName.split(/[/\\]/).pop() || "logo";

  return name.replace(/[^a-zA-Z0-9._-]/g, "-") || "logo";
}

function isImageFile(file: File) {
  return file.type.startsWith("image/");
}

function lastSixMonthLabels() {
  const now = new Date();

  return Array.from({ length: 6 }, (_, index) => {
    const date = new Date(now.getFullYear(), now.getMonth() - (5 - index), 1);

    return {
      key: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`,
      label: date.toLocaleDateString("pt-BR", { month: "short" }).replace(".", "").toUpperCase(),
    };
  });
}

function monthKey(value?: string | null) {
  if (!value) return "";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "";

  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function monthlySeries(items: Array<{ created_at: string | null }>) {
  const labels = lastSixMonthLabels();
  const counts = new Map(labels.map((label) => [label.key, 0]));

  items.forEach((item) => {
    const key = monthKey(item.created_at);

    if (counts.has(key)) {
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
  });

  return labels.map((label) => ({
    label: label.label,
    value: counts.get(label.key) ?? 0,
  }));
}

function BarChart({
  title,
  data,
  emptyLabel,
}: {
  title: string;
  data: Array<{ label: string; value: number }>;
  emptyLabel: string;
}) {
  const maxValue = Math.max(...data.map((item) => item.value), 0);

  return (
    <Card className="bg-background shadow-none">
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        {maxValue ? (
          <div className="grid gap-3">
            {data.map((item) => (
              <div key={item.label} className="grid grid-cols-[76px_1fr_36px] items-center gap-3 text-sm">
                <span className="text-xs text-muted-foreground">{item.label}</span>
                <span className="h-2.5 overflow-hidden rounded-full bg-foreground/[0.08]">
                  <span
                    className="block h-full rounded-full bg-[var(--zacx-brand)]"
                    style={{ width: `${Math.max(8, (item.value / maxValue) * 100)}%` }}
                  />
                </span>
                <span className="text-right text-xs font-medium text-foreground">{item.value}</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">{emptyLabel}</p>
        )}
      </CardContent>
    </Card>
  );
}

function metricCard(label: string, value: number | string, description: string, Icon: typeof UsersRound) {
  return (
    <Card key={label} className="border-border/70 bg-background shadow-none">
      <CardHeader className="flex-row items-start justify-between gap-3 p-4 pb-2 md:p-5 md:pb-3">
        <div>
          <CardDescription className="text-xs md:text-sm">{label}</CardDescription>
          <CardTitle className="mt-2 text-2xl md:mt-3 md:text-3xl">{value}</CardTitle>
        </div>
        <Icon className="h-5 w-5 text-muted-foreground" />
      </CardHeader>
      <CardContent className="hidden px-4 pb-4 md:block md:px-5 md:pb-5">
        <p className="text-sm text-muted-foreground">{description}</p>
      </CardContent>
    </Card>
  );
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
    responsible: "all",
    status: "all",
  });
  const [savingResponsibleId, setSavingResponsibleId] = useState<string | null>(null);
  const [savingClientNameId, setSavingClientNameId] = useState<string | null>(null);
  const [uploadingLogoId, setUploadingLogoId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function loadMetrics() {
    setLoading(true);
    setError(null);

    const [clients, copyPlannings, visualPresentations, visualItems, visualImages] =
      await Promise.all([
        supabase
          .from("clients")
          .select("id, name, logo_url, primary_color, responsible_name, archived_at, deleted_at, created_at")
          .is("deleted_at", null)
          .order("name", { ascending: true }),
        supabase
          .from("copy_plannings")
          .select("id, client_id, title, period_label, start_display_date, end_display_date, created_at, archived_at, deleted_at"),
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

  useEffect(() => {
    loadMetrics();
  }, []);

  const maps = useMemo(() => {
    const clientsById = new Map(data.clients.map((client) => [client.id, client]));
    const presentationsById = new Map(data.visualPresentations.map((presentation) => [presentation.id, presentation]));
    const itemPresentationMap = new Map(
      data.visualItems.map((item) => [item.id, item.visual_presentation_id]),
    );

    return { clientsById, presentationsById, itemPresentationMap };
  }, [data]);

  const visibleClients = useMemo(
    () =>
      data.clients.filter((client) => {
        const matchesClient = filters.clientId === "all" || client.id === filters.clientId;
        const matchesResponsible =
          filters.responsible === "all" ||
          (filters.responsible === "none"
            ? !client.responsible_name
            : client.responsible_name === filters.responsible);
        const matchesStatus =
          filters.status === "all" ||
          (filters.status === "archived" ? Boolean(client.archived_at) : !client.archived_at);

        return matchesClient && matchesResponsible && matchesStatus;
      }),
    [data.clients, filters.clientId, filters.responsible, filters.status],
  );
  const visibleClientIds = useMemo(() => new Set(visibleClients.map((client) => client.id)), [visibleClients]);
  const filtered = useMemo(() => {
    const copyPlannings = data.copyPlannings.filter((planning) => {
      const matchesClient = Boolean(planning.client_id && visibleClientIds.has(planning.client_id));
      const matchesMonth = filters.month === "all" || createdMonth(planning.created_at) === filters.month;
      const matchesStatus =
        filters.status === "all" ||
        (filters.status === "archived" ? Boolean(planning.archived_at) : !planning.archived_at);

      return matchesClient && matchesMonth && matchesStatus && !planning.deleted_at;
    });
    const visualPresentations = data.visualPresentations.filter((presentation) => {
      const matchesClient = Boolean(presentation.client_id && visibleClientIds.has(presentation.client_id));
      const matchesMonth = filters.month === "all" || createdMonth(presentation.created_at) === filters.month;
      const matchesStatus =
        filters.status === "all" ||
        (filters.status === "archived" ? Boolean(presentation.archived_at) : !presentation.archived_at);

      return matchesClient && matchesMonth && matchesStatus && !presentation.deleted_at;
    });
    const presentationIds = new Set(visualPresentations.map((presentation) => presentation.id));
    const visualItems = data.visualItems.filter((item) =>
      Boolean(item.visual_presentation_id && presentationIds.has(item.visual_presentation_id)),
    );
    const visualItemIds = new Set(visualItems.map((item) => item.id));
    const visualImages = data.visualImages.filter((image) =>
      Boolean(image.visual_item_id && visualItemIds.has(image.visual_item_id)),
    );

    return { copyPlannings, visualPresentations, visualItems, visualImages };
  }, [data, filters.month, filters.status, visibleClientIds]);

  const demandByClient = useMemo(() => {
    return data.clients
      .filter((client) => !client.archived_at && !client.deleted_at)
      .map((client) => {
        const plannings = data.copyPlannings.filter(
          (planning) => planning.client_id === client.id && !planning.deleted_at,
        ).length;
        const presentations = data.visualPresentations.filter(
          (presentation) => presentation.client_id === client.id && !presentation.deleted_at,
        );
        const presentationIds = new Set(presentations.map((presentation) => presentation.id));
        const visualItems = data.visualItems.filter((item) =>
          Boolean(item.visual_presentation_id && presentationIds.has(item.visual_presentation_id)),
        ).length;

        return {
          client,
          plannings,
          presentations: presentations.length,
          visualItems,
          total: plannings + presentations.length + visualItems,
        };
      })
      .sort((left, right) => right.total - left.total || left.client.name.localeCompare(right.client.name, "pt-BR"));
  }, [data]);

  const responsibleGroups = useMemo(() => {
    return [
      { label: "Clientes do Rafael", value: "Rafael" },
      { label: "Clientes do Matheus", value: "Matheus" },
      { label: "Sem responsável", value: "" },
    ].map((group) => {
      const clients = data.clients.filter((client) =>
        group.value ? client.responsible_name === group.value : !client.responsible_name,
      ).filter((client) => !client.archived_at && !client.deleted_at);
      const clientIds = new Set(clients.map((client) => client.id));
      const plannings = data.copyPlannings.filter((planning) =>
        Boolean(planning.client_id && clientIds.has(planning.client_id) && !planning.deleted_at),
      );
      const presentations = data.visualPresentations.filter((presentation) =>
        Boolean(presentation.client_id && clientIds.has(presentation.client_id) && !presentation.deleted_at),
      );
      const presentationIds = new Set(presentations.map((presentation) => presentation.id));
      const visualItems = data.visualItems.filter((item) =>
        Boolean(item.visual_presentation_id && presentationIds.has(item.visual_presentation_id)),
      );

      return {
        ...group,
        clients,
        plannings: plannings.length,
        presentations: presentations.length,
        visualItems: visualItems.length,
      };
    });
  }, [data]);

  const endingPlannings = useMemo(() => {
    return data.copyPlannings
      .filter((planning) => !planning.archived_at && !planning.deleted_at)
      .map((planning) => ({
        planning,
        client: planning.client_id ? maps.clientsById.get(planning.client_id) : null,
        status: planningEndStatus(planning.end_display_date, planning.period_label),
      }))
      .filter((item): item is {
        planning: DashboardDeliverable;
        client: DashboardClient | null;
        status: NonNullable<ReturnType<typeof planningEndStatus>>;
      } => Boolean(item.status))
      .sort((left, right) => left.status.daysLeft - right.status.daysLeft);
  }, [data.copyPlannings, maps.clientsById]);

  async function updateClientResponsible(clientId: string, responsibleName: string) {
    setSavingResponsibleId(clientId);
    setError(null);

    const { error: requestError } = await supabase
      .from("clients")
      .update({ responsible_name: responsibleName || null } as never)
      .eq("id", clientId);

    if (requestError) {
      setError(requestError.message);
    } else {
      setData((current) => ({
        ...current,
        clients: current.clients.map((client) =>
          client.id === clientId ? { ...client, responsible_name: responsibleName || null } : client,
        ),
      }));
      setMessage("Responsável atualizado.");
      window.setTimeout(() => setMessage(null), 1800);
    }

    setSavingResponsibleId(null);
  }

  async function updateClientName(clientId: string, nextName: string) {
    const cleanName = nextName.trim();
    const currentClient = data.clients.find((client) => client.id === clientId);

    if (!currentClient || !cleanName || cleanName === currentClient.name) return;

    setSavingClientNameId(clientId);
    setError(null);

    const { error: requestError } = await supabase
      .from("clients")
      .update({ name: cleanName } as never)
      .eq("id", clientId);

    if (requestError) {
      setError(requestError.message);
    } else {
      setData((current) => ({
        ...current,
        clients: current.clients.map((client) =>
          client.id === clientId ? { ...client, name: cleanName } : client,
        ),
      }));
      setMessage("Cliente atualizado.");
      window.setTimeout(() => setMessage(null), 1800);
    }

    setSavingClientNameId(null);
  }

  async function uploadClientLogo(client: DashboardClient, file: File) {
    if (!isImageFile(file)) {
      setError("Selecione uma imagem valida.");
      return;
    }

    setUploadingLogoId(client.id);
    setError(null);

    try {
      const optimizedLogo = await optimizeImage(file, "client-logo");
      const storagePath = `${client.id}/${Date.now()}-${safeStorageFileName(optimizedLogo.name)}`;
      const { error: uploadError } = await supabase.storage
        .from("client-logos")
        .upload(storagePath, optimizedLogo, {
          contentType: optimizedLogo.type || undefined,
          upsert: false,
        });

      if (uploadError) throw new Error(uploadError.message);

      const {
        data: { publicUrl },
      } = supabase.storage.from("client-logos").getPublicUrl(storagePath);

      const { error: updateError } = await supabase
        .from("clients")
        .update({ logo_url: publicUrl } as never)
        .eq("id", client.id);

      if (updateError) throw new Error(updateError.message);

      setData((current) => ({
        ...current,
        clients: current.clients.map((currentClient) =>
          currentClient.id === client.id ? { ...currentClient, logo_url: publicUrl } : currentClient,
        ),
      }));
      setMessage("Foto do cliente atualizada.");
      window.setTimeout(() => setMessage(null), 1800);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Nao foi possivel atualizar a foto.");
    } finally {
      setUploadingLogoId(null);
    }
  }

  const activePlannings = filtered.copyPlannings.filter((planning) => !planning.archived_at).length;
  const activePresentations = filtered.visualPresentations.filter((presentation) => !presentation.archived_at).length;
  const archivedItems =
    filtered.copyPlannings.filter((planning) => Boolean(planning.archived_at)).length +
    filtered.visualPresentations.filter((presentation) => Boolean(presentation.archived_at)).length;
  const posts = filtered.visualItems.filter((item) => normalizeFormat(item.format) === "post").length;
  const carousels = filtered.visualItems.filter((item) => normalizeFormat(item.format) === "carousel").length;
  const stories = filtered.visualItems.filter((item) => normalizeFormat(item.format) === "stories").length;
  const deliverableSeries = monthlySeries([...filtered.copyPlannings, ...filtered.visualPresentations]);
  const responsibleSeries = responsibleOptions.map((responsible) => {
    const clientIds = new Set(
      data.clients.filter((client) => client.responsible_name === responsible).map((client) => client.id),
    );
    const plannings = data.copyPlannings.filter((planning) =>
      Boolean(planning.client_id && clientIds.has(planning.client_id) && !planning.deleted_at),
    ).length;
    const presentations = data.visualPresentations.filter((presentation) =>
      Boolean(presentation.client_id && clientIds.has(presentation.client_id) && !presentation.deleted_at),
    ).length;

    return { label: responsible, value: plannings + presentations };
  });
  const filteredTopClients = demandByClient.slice(0, 6).map((item) => ({
    label: item.client.name,
    value: item.total,
  }));
  const metrics = [
    metricCard("Clientes ativos", visibleClients.filter((client) => !client.archived_at).length, "Perfis ativos na seleção", UsersRound),
    metricCard("Planejamentos ativos", activePlannings, "Documentos fora dos arquivados", FileText),
    metricCard("Apresentações ativas", activePresentations, "Pranchas fora dos arquivados", Images),
    metricCard("Itens arquivados", archivedItems, "Planejamentos e apresentações", Archive),
    metricCard("Publicações visuais", filtered.visualItems.length, "Posts, carrosséis e stories", Layers3),
    metricCard("Posts", posts, "Itens únicos de feed", FileText),
    metricCard("Carrosséis", carousels, "Itens de múltiplas artes", Images),
    metricCard("Stories", stories, "Itens de stories", Layers3),
  ];

  return (
    <section className="space-y-6 md:space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="sora-heading mt-2 text-2xl font-medium tracking-normal text-foreground md:text-4xl">
            Controle de clientes
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground md:mt-3">
            Acompanhe demanda, responsáveis, planejamentos e apresentações visuais.
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

      {error ? (
        <Card className="border-rose-600 bg-rose-600 text-white">
          <CardContent className="pt-5 text-sm font-medium">{error}</CardContent>
        </Card>
      ) : null}
      {message ? (
        <Card className="border-emerald-600 bg-emerald-600 text-white">
          <CardContent className="pt-5 text-sm font-medium">{message}</CardContent>
        </Card>
      ) : null}

      <Tabs defaultValue="graficos" className="space-y-5">
        <TabsList className="grid h-auto w-full grid-cols-2 gap-2 border-0 bg-transparent p-0 sm:w-auto sm:grid-cols-4 sm:inline-grid">
          {[
            { value: "graficos", label: "Gráficos", icon: BarChart3 },
            { value: "configuracoes", label: "Configurações", icon: Settings2 },
            { value: "ranking", label: "Ranking", icon: Trophy },
            { value: "planejamentos-no-fim", label: "Planejamentos no fim", icon: FileText },
          ].map((tab) => {
            const Icon = tab.icon;

            return (
              <TabsTrigger
                key={tab.value}
                value={tab.value}
                className="h-10 gap-2 rounded-md border border-border bg-background px-3 text-sm text-muted-foreground data-[state=active]:border-foreground/30 data-[state=active]:bg-background data-[state=active]:text-foreground"
              >
                <Icon className="h-4 w-4" />
                {tab.label}
              </TabsTrigger>
            );
          })}
        </TabsList>

        <TabsContent value="graficos" className="space-y-5">
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
              value={filters.responsible}
              onChange={(event) =>
                setFilters((current) => ({
                  ...current,
                  responsible: event.target.value as DashboardFilters["responsible"],
                }))
              }
              className={compactSelectClass}
            >
              <option value="all">Todos responsáveis</option>
              {responsibleOptions.map((responsible) => (
                <option key={responsible} value={responsible}>
                  {responsible}
                </option>
              ))}
              <option value="none">Sem responsável</option>
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

          <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
            {metrics.map((card) => card)}
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <BarChart
              title="Evolução de entregas por mês"
              data={deliverableSeries}
              emptyLabel={loading ? "Carregando dados..." : "Nenhuma entrega encontrada no período."}
            />
            <BarChart
              title="Demanda por responsável"
              data={responsibleSeries}
              emptyLabel={loading ? "Carregando dados..." : "Nenhum responsável com entregas ainda."}
            />
          </div>
        </TabsContent>

        <TabsContent value="planejamentos-no-fim" className="space-y-5">
          <Card className="border-border/70 bg-background shadow-none">
            <CardHeader>
              <CardTitle className="sora-heading text-lg">Planejamentos próximos do fim</CardTitle>
              <CardDescription>
                Entram aqui planejamentos com 10 dias ou menos até a data final.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {endingPlannings.length ? (
                endingPlannings.map(({ planning, client, status }) => {
                  const toneClass =
                    status.tone === "expired"
                      ? "border-neutral-400 bg-neutral-500/10 text-neutral-700 dark:text-neutral-200"
                      : status.tone === "today"
                        ? "border-red-500 bg-red-500/10 text-red-600 dark:text-red-300"
                        : status.tone === "critical"
                          ? "border-orange-500 bg-orange-500/10 text-orange-600 dark:text-orange-300"
                          : "border-amber-400 bg-amber-400/10 text-amber-700 dark:text-amber-200";

                  return (
                    <Link
                      key={planning.id}
                      href={`/admin/planejamentos/${planning.id}`}
                      className="block rounded-xl border border-border bg-background p-4 transition hover:-translate-y-0.5 hover:border-foreground/25"
                    >
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                        <div className="flex min-w-0 flex-1 items-center gap-3">
                          <ClientAvatarDisplay
                            name={client?.name || "Cliente"}
                            logoUrl={client?.logo_url || null}
                            accentColor={client?.primary_color || "#E5E7EB"}
                            className="h-11 w-11 text-base"
                          />
                          <div className="min-w-0">
                            <p className="sora-heading truncate text-sm font-medium text-foreground">
                              {planning.title || "Planejamento"}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {client?.name || "Cliente"} · {planning.period_label || "Período não definido"}
                            </p>
                          </div>
                        </div>
                        <span className={cn("inline-flex w-fit rounded-full border px-3 py-1 text-xs font-medium", toneClass)}>
                          {status.label}
                        </span>
                      </div>
                      <p className="mt-3 text-xs text-muted-foreground">
                        Data final: {extractEndDisplayDate(planning.end_display_date, planning.period_label) || "não definida"}
                      </p>
                      <div className="mt-4 h-2 overflow-hidden rounded-full bg-foreground/[0.08]">
                        <span
                          className="block h-full rounded-full bg-red-500"
                          style={{ width: `${status.tone === "expired" ? 100 : Math.max(8, status.progress)}%` }}
                        />
                      </div>
                    </Link>
                  );
                })
              ) : (
                <p className="text-sm text-muted-foreground">
                  Nenhum planejamento acabando nos próximos 10 dias.
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="configuracoes" className="space-y-5">
          <div className="grid gap-4 lg:grid-cols-3">
            {responsibleGroups.map((group) => (
              <Card key={group.label} className="bg-background shadow-none">
                <CardHeader>
                  <CardTitle className="text-base">{group.label}</CardTitle>
                  <CardDescription>{group.clients.length} cliente{group.clients.length === 1 ? "" : "s"}</CardDescription>
                </CardHeader>
                <CardContent className="grid grid-cols-3 gap-2 text-center text-xs text-muted-foreground">
                  <span><strong className="block text-base text-foreground">{group.plannings}</strong>Planej.</span>
                  <span><strong className="block text-base text-foreground">{group.presentations}</strong>APs</span>
                  <span><strong className="block text-base text-foreground">{group.visualItems}</strong>Itens</span>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="grid gap-3">
            {data.clients.filter((client) => !client.archived_at && !client.deleted_at).map((client) => (
              <Card key={client.id} className="bg-background shadow-none">
                <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
                  <div className="flex min-w-0 flex-1 items-center gap-3">
                    <label
                      className="group relative block shrink-0 cursor-pointer"
                      aria-label={`Trocar foto de ${client.name}`}
                      title="Trocar foto"
                    >
                      <input
                        type="file"
                        accept="image/*"
                        className="sr-only"
                        onChange={(event) => {
                          const file = event.target.files?.[0];
                          event.currentTarget.value = "";
                          if (file) uploadClientLogo(client, file);
                        }}
                      />
                      <ClientAvatarDisplay
                        name={client.name}
                        logoUrl={client.logo_url}
                        accentColor={client.primary_color || "#E5E7EB"}
                        className="h-11 w-11 text-base"
                      />
                      <span className="absolute inset-0 grid place-items-center rounded-full bg-black/0 text-white opacity-0 transition group-hover:bg-black/35 group-hover:opacity-100">
                        {uploadingLogoId === client.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Upload className="h-4 w-4" />
                        )}
                      </span>
                    </label>
                    <div className="min-w-0">
                      <input
                        defaultValue={client.name}
                        disabled={savingClientNameId === client.id}
                        onBlur={(event) => updateClientName(client.id, event.target.value)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter") {
                            event.preventDefault();
                            event.currentTarget.blur();
                          }
                          if (event.key === "Escape") {
                            event.currentTarget.value = client.name;
                            event.currentTarget.blur();
                          }
                        }}
                        className="sora-heading block w-full rounded-md border border-transparent bg-transparent px-1 py-0.5 text-sm font-medium text-foreground outline-none transition hover:border-border focus:border-foreground/30"
                      />
                      <p className="text-xs text-muted-foreground">
                        {client.responsible_name ? `Responsável: ${client.responsible_name}` : "Sem responsável"}
                      </p>
                    </div>
                  </div>
                  <select
                    value={client.responsible_name || ""}
                    onChange={(event) => updateClientResponsible(client.id, event.target.value)}
                    disabled={savingResponsibleId === client.id}
                    className={cn(compactSelectClass, "w-full sm:w-48")}
                  >
                    <option value="">Sem responsável</option>
                    {responsibleOptions.map((responsible) => (
                      <option key={responsible} value={responsible}>
                        {responsible}
                      </option>
                    ))}
                  </select>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="ranking" className="space-y-4">
          {demandByClient.length ? (
            demandByClient.map((item, index) => (
              <Card
                key={item.client.id}
                className={cn(
                  "bg-background shadow-none",
                  index < 5 && "border-amber-300/70 dark:border-amber-400/40",
                )}
              >
                <CardContent className="grid grid-cols-[42px_minmax(0,1fr)] items-center gap-2 p-3 sm:flex sm:gap-3 sm:p-4">
                  <div className="relative shrink-0">
                    <ClientAvatarDisplay
                      name={item.client.name}
                      logoUrl={item.client.logo_url}
                      accentColor={item.client.primary_color}
                      className="h-10 w-10 text-sm sm:h-12 sm:w-12 sm:text-base"
                    />
                    {index < 5 ? (
                      <span className="absolute -left-1.5 -top-1.5 grid h-5 w-5 place-items-center rounded-full border border-amber-300/80 bg-background text-amber-500 sm:-left-2 sm:-top-2 sm:h-7 sm:w-7">
                        <Crown className="h-3 w-3 fill-amber-400 text-amber-500 sm:h-4 sm:w-4" />
                      </span>
                    ) : null}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex min-w-0 items-center gap-2">
                      <span className="shrink-0 text-xs font-semibold text-muted-foreground">{index + 1}º</span>
                      <h3 className="sora-heading truncate text-sm font-medium text-foreground sm:text-base">{item.client.name}</h3>
                    </div>
                    <p className="truncate text-[11px] text-muted-foreground sm:text-xs">
                      Responsável: {item.client.responsible_name || "Sem responsável"}
                    </p>
                  </div>
                  <div className="col-span-2 grid grid-cols-3 gap-1 rounded-md bg-foreground/[0.035] px-2 py-1.5 text-center text-[10px] text-muted-foreground sm:ml-auto sm:min-w-[320px] sm:gap-3 sm:bg-transparent sm:px-0 sm:py-0 sm:text-right sm:text-xs">
                    <span><strong className="block text-sm leading-4 text-foreground sm:text-base sm:leading-normal">{item.plannings}</strong>Planej.</span>
                    <span><strong className="block text-sm leading-4 text-foreground sm:text-base sm:leading-normal">{item.presentations}</strong>APs</span>
                    <span><strong className="block text-sm leading-4 text-foreground sm:text-base sm:leading-normal">{item.total}</strong>Total</span>
                  </div>
                </CardContent>
              </Card>
            ))
          ) : (
            <Card className="border-dashed bg-background shadow-none">
              <CardContent className="pt-5 text-sm text-muted-foreground">
                Nenhum cliente com demanda registrada ainda.
              </CardContent>
            </Card>
          )}

          <BarChart
            title="Clientes com mais demanda"
            data={filteredTopClients}
            emptyLabel="Nenhum dado suficiente para ranking."
          />
        </TabsContent>
      </Tabs>
    </section>
  );
}
