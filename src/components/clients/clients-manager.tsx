"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  Archive,
  CheckSquare2,
  Loader2,
  Plus,
  RotateCcw,
  Search,
  SlidersHorizontal,
  Trash2,
  X,
} from "lucide-react";

import { ClientAvatarInput } from "@/components/clients/client-avatar-input";
import { ClientCard } from "@/components/clients/client-card";
import { ColorDotInput } from "@/components/clients/color-dot-input";
import { AutoDismissToast } from "@/components/ui/auto-dismiss-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { canSeeClient, isAdminUser, responsibleNameForUser } from "@/lib/auth/types";
import { useCurrentUser } from "@/lib/auth/current-user";
import { optimizeImage } from "@/lib/image-optimizer";
import { planningEndStatus } from "@/lib/planning-end-status";
import { supabase } from "@/lib/supabase/client";
import type { Client } from "@/lib/supabase/types";
import { cn } from "@/lib/utils";

const initialForm = {
  name: "",
  primaryColor: "#A3E635",
  secondaryColor: "#60A5FA",
  responsibleName: "",
};

const defaultResponsibleOptions = ["Rafael", "Matheus"] as const;
type ClientSort = "az" | "za" | "more-demand" | "less-demand" | "newest" | "oldest";
type ClientConfirmAction = {
  kind: "archive" | "unarchive" | "delete";
  ids: string[];
} | null;
type ClientDemand = {
  plannings: number;
  presentations: number;
  visualItems: number;
  total: number;
};
type EndingPlanningAlert = {
  label: string;
  daysLeft: number;
};

function slugify(value: string) {
  return (value.trim() || "cliente")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
}

function uniqueSlug(baseSlug: string, clients: Client[]) {
  const fallbackSlug = baseSlug || "cliente";
  const usedSlugs = new Set(clients.map((client) => client.slug));

  if (!usedSlugs.has(fallbackSlug)) {
    return fallbackSlug;
  }

  let index = 2;
  let nextSlug = `${fallbackSlug}-${index}`;

  while (usedSlugs.has(nextSlug)) {
    index += 1;
    nextSlug = `${fallbackSlug}-${index}`;
  }

  return nextSlug;
}

function safeStorageFileName(fileName: string) {
  const name = fileName.split(/[/\\]/).pop() || "logo";
  const safeName = name.replace(/[^a-zA-Z0-9._-]/g, "-");

  return safeName || "logo";
}

function isImageFile(file: File) {
  return file.type.startsWith("image/");
}

function normalizedSearch(value?: string | null) {
  return `${value ?? ""}`
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function demandFor(demandMap: Record<string, ClientDemand>, clientId: string) {
  return demandMap[clientId] ?? { plannings: 0, presentations: 0, visualItems: 0, total: 0 };
}

function InlineSearchControl({
  isOpen,
  value,
  onOpenChange,
  onValueChange,
}: {
  isOpen: boolean;
  value: string;
  onOpenChange: (open: boolean) => void;
  onValueChange: (value: string) => void;
}) {
  return (
    <>
      <div
        className={cn(
          "relative hidden h-10 items-center overflow-hidden rounded-lg border border-border bg-background text-muted-foreground transition-all duration-200 ease-out focus-within:border-neutral-400 dark:focus-within:border-white/35 md:flex",
          isOpen || value ? "w-[min(64vw,280px)]" : "w-10",
        )}
      >
        <button
          type="button"
          className="grid h-10 w-10 shrink-0 place-items-center transition-colors hover:text-foreground"
          onClick={() => onOpenChange(true)}
          aria-label="Buscar clientes"
          title="Buscar clientes"
        >
          <Search className="h-4 w-4" />
        </button>
        {isOpen || value ? (
          <>
            <Input
              value={value}
              onChange={(event) => onValueChange(event.target.value)}
              onBlur={() => {
                if (!value.trim()) onOpenChange(false);
              }}
              autoFocus
              placeholder="Buscar cliente..."
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
        aria-label="Buscar clientes"
        title="Buscar clientes"
      >
        <Search className="h-4 w-4" />
      </button>

      {isOpen ? (
        <div
          className="fixed inset-0 z-[120] flex items-start justify-center bg-black/40 px-4 pt-20 md:hidden"
          onClick={() => {
            if (!value.trim()) onOpenChange(false);
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
                placeholder="Buscar cliente..."
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

export function ClientsManager() {
  const { user: currentUser, loading: userLoading } = useCurrentUser();
  const isAdmin = isAdminUser(currentUser);
  const [clients, setClients] = useState<Client[]>([]);
  const [form, setForm] = useState(initialForm);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreviewUrl, setLogoPreviewUrl] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [clientSearch, setClientSearch] = useState("");
  const [isClientSearchOpen, setIsClientSearchOpen] = useState(false);
  const [isClientFilterOpen, setIsClientFilterOpen] = useState(false);
  const [responsibleFilter, setResponsibleFilter] = useState("all");
  const [clientSort, setClientSort] = useState<ClientSort>("newest");
  const [showArchivedClients, setShowArchivedClients] = useState(false);
  const [clientSelectionMode, setClientSelectionMode] = useState(false);
  const [selectedClientIds, setSelectedClientIds] = useState<string[]>([]);
  const [bulkActionLoading, setBulkActionLoading] = useState(false);
  const [clientConfirmAction, setClientConfirmAction] = useState<ClientConfirmAction>(null);
  const [clientDemand, setClientDemand] = useState<Record<string, ClientDemand>>({});
  const [endingPlanningAlerts, setEndingPlanningAlerts] = useState<Record<string, EndingPlanningAlert>>({});

  async function loadClients() {
    if (!currentUser) {
      if (!userLoading) setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    const { data, error: requestError } = await supabase
      .from("clients")
      .select("*")
      .is("deleted_at", null)
      .order("created_at", { ascending: false });

    if (requestError) {
      setError(requestError.message);
    } else {
      setClients(((data ?? []) as Client[]).filter((client) => canSeeClient(currentUser, client)));
    }

    setLoading(false);

    const [planningResult, presentationResult] = await Promise.all([
      supabase
        .from("copy_plannings")
        .select("client_id, end_display_date, period_label, archived_at")
        .is("deleted_at", null),
      supabase.from("visual_presentations").select("id, client_id").is("deleted_at", null),
    ]);

    const planningRows = (planningResult.data ?? []) as Array<{
      client_id: string | null;
      end_display_date?: string | null;
      period_label?: string | null;
      archived_at?: string | null;
    }>;
    const presentationRows = (presentationResult.data ?? []) as Array<{ id: string; client_id: string | null }>;
    const presentationClientMap = new Map(
      presentationRows
        .filter((presentation) => presentation.id && presentation.client_id)
        .map((presentation) => [presentation.id, presentation.client_id as string]),
    );
    const nextDemand: Record<string, ClientDemand> = {};
    const ensureDemand = (clientId: string) => {
      if (!nextDemand[clientId]) {
        nextDemand[clientId] = { plannings: 0, presentations: 0, visualItems: 0, total: 0 };
      }

      return nextDemand[clientId];
    };

    planningRows.forEach((planning) => {
      if (!planning.client_id) return;

      const demand = ensureDemand(planning.client_id);
      demand.plannings += 1;
      demand.total += 1;
    });

    const nextEndingAlerts: Record<string, EndingPlanningAlert> = {};

    planningRows.forEach((planning) => {
      if (!planning.client_id || planning.archived_at) return;

      const status = planningEndStatus(planning.end_display_date, planning.period_label);

      if (!status) return;

      const current = nextEndingAlerts[planning.client_id];

      if (!current || status.daysLeft < current.daysLeft) {
        nextEndingAlerts[planning.client_id] = {
          label: status.label,
          daysLeft: status.daysLeft,
        };
      }
    });

    presentationRows.forEach((presentation) => {
      if (!presentation.client_id) return;

      const demand = ensureDemand(presentation.client_id);
      demand.presentations += 1;
      demand.total += 1;
    });

    if (presentationRows.length) {
      const { data: visualItemRows } = await supabase
        .from("visual_items")
        .select("visual_presentation_id")
        .in(
          "visual_presentation_id",
          presentationRows.map((presentation) => presentation.id),
        );

      ((visualItemRows ?? []) as Array<{ visual_presentation_id: string | null }>).forEach((item) => {
        if (!item.visual_presentation_id) return;

        const clientId = presentationClientMap.get(item.visual_presentation_id);
        if (!clientId) return;

        const demand = ensureDemand(clientId);
        demand.visualItems += 1;
        demand.total += 1;
      });
    }

    setClientDemand(nextDemand);
    setEndingPlanningAlerts(nextEndingAlerts);
  }

  useEffect(() => {
    loadClients();
  }, [currentUser?.id, userLoading]);

  useEffect(() => {
    return () => {
      if (logoPreviewUrl) {
        URL.revokeObjectURL(logoPreviewUrl);
      }
    };
  }, [logoPreviewUrl]);

  const generatedSlug = useMemo(
    () => uniqueSlug(slugify(form.name), clients),
    [clients, form.name],
  );
  const clientResponsibleOptions = useMemo(() => {
    const responsibleNames = clients
      .map((client) => client.responsible_name?.trim())
      .filter((responsible): responsible is string => Boolean(responsible));
    const futureResponsibleNames = Array.from(
      new Set(
        responsibleNames.filter(
          (responsible) => !defaultResponsibleOptions.some((defaultName) => defaultName === responsible),
        ),
      ),
    ).sort((left, right) => left.localeCompare(right, "pt-BR"));

    return isAdmin ? [...defaultResponsibleOptions, ...futureResponsibleNames] : [responsibleNameForUser(currentUser)].filter(Boolean);
  }, [clients, currentUser, isAdmin]);
  const filteredClients = useMemo(() => {
    const search = normalizedSearch(clientSearch);

    const visibleClients = clients.filter((client) => {
      const matchesArchive = showArchivedClients ? Boolean(client.archived_at) : !client.archived_at;
      const matchesSearch =
        !search ||
        normalizedSearch(`${client.name} ${client.slug} ${client.responsible_name ?? ""}`).includes(search);
      const matchesResponsible =
        responsibleFilter === "all" ||
        client.responsible_name === responsibleFilter;

      return matchesArchive && matchesSearch && matchesResponsible;
    });

    return visibleClients.sort((first, second) => {
      if (clientSort === "az") return first.name.localeCompare(second.name, "pt-BR");
      if (clientSort === "za") return second.name.localeCompare(first.name, "pt-BR");
      if (clientSort === "oldest") {
        return new Date(first.created_at ?? "").getTime() - new Date(second.created_at ?? "").getTime();
      }
      if (clientSort === "more-demand") {
        return demandFor(clientDemand, second.id).total - demandFor(clientDemand, first.id).total;
      }
      if (clientSort === "less-demand") {
        return demandFor(clientDemand, first.id).total - demandFor(clientDemand, second.id).total;
      }

      return new Date(second.created_at ?? "").getTime() - new Date(first.created_at ?? "").getTime();
    });
  }, [clientDemand, clientSearch, clientSort, clients, responsibleFilter, showArchivedClients]);
  const hasActiveClientFilters =
    Boolean(clientSearch.trim()) ||
    responsibleFilter !== "all" ||
    clientSort !== "newest" ||
    showArchivedClients;

  useEffect(() => {
    setClientSelectionMode(false);
    setSelectedClientIds([]);
  }, [responsibleFilter, showArchivedClients]);

  function openModal() {
    setForm({
      ...initialForm,
      responsibleName: isAdmin ? "" : responsibleNameForUser(currentUser),
    });
    setLogoFile(null);
    setLogoPreviewUrl(null);
    setError(null);
    setSuccess(null);
    setModalOpen(true);
  }

  function closeModal() {
    if (saving || uploadingLogo) return;

    setModalOpen(false);
    setForm(initialForm);
    setLogoFile(null);
    setLogoPreviewUrl(null);
    setError(null);
  }

  function selectLogo(file: File) {
    if (!isImageFile(file)) {
      setError("Selecione um arquivo de imagem valido.");
      return;
    }

    if (logoPreviewUrl) {
      URL.revokeObjectURL(logoPreviewUrl);
    }

    setLogoFile(file);
    setLogoPreviewUrl(URL.createObjectURL(file));
    setError(null);
  }

  async function uploadLogo(slug: string) {
    if (!logoFile) return null;

    setUploadingLogo(true);

    const optimizedLogoFile = await optimizeImage(logoFile, "client-logo");
    const imagePath = `${slug}/${Date.now()}-${safeStorageFileName(optimizedLogoFile.name)}`;
    const { error: uploadError } = await supabase.storage
      .from("client-logos")
      .upload(imagePath, optimizedLogoFile, {
        contentType: optimizedLogoFile.type || undefined,
        upsert: false,
      });

    if (uploadError) {
      setUploadingLogo(false);
      throw new Error(uploadError.message);
    }

    const {
      data: { publicUrl },
    } = supabase.storage.from("client-logos").getPublicUrl(imagePath);

    setUploadingLogo(false);
    return publicUrl;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!form.name.trim()) {
      setError("Preencha o nome do cliente.");
      return;
    }

    setSaving(true);
    setSuccess(null);
    setError(null);

    try {
      const slug = generatedSlug;
      const logoUrl = await uploadLogo(slug);
      const responsibleName = isAdmin ? form.responsibleName : responsibleNameForUser(currentUser);
      const { error: requestError } = await supabase.from("clients").insert({
        name: form.name.trim(),
        slug,
        logo_url: logoUrl,
        primary_color: form.primaryColor || "#E5E7EB",
        secondary_color: form.secondaryColor || form.primaryColor || "#E5E7EB",
        responsible_name: responsibleName || null,
        assigned_user_id: !isAdmin && currentUser ? currentUser.id : null,
        assigned_user_name: responsibleName || null,
      } as never);

      if (requestError) {
        throw new Error(requestError.message);
      }

      setSuccess("Cliente criado com sucesso.");
      setForm(initialForm);
      setLogoFile(null);
      setLogoPreviewUrl(null);
      setModalOpen(false);
      await loadClients();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Nao foi possivel criar o cliente.");
    } finally {
      setSaving(false);
      setUploadingLogo(false);
    }
  }

  function toggleClientSelection(id: string) {
    setSelectedClientIds((current) =>
      current.includes(id)
        ? current.filter((selectedId) => selectedId !== id)
        : [...current, id],
    );
  }

  function cancelClientSelection() {
    setClientSelectionMode(false);
    setSelectedClientIds([]);
  }

  async function updateClientArchive(ids: string[], archived: boolean) {
    if (!ids.length) return;

    setBulkActionLoading(true);
    setError(null);
    setSuccess(null);

    const { error: requestError } = await supabase
      .from("clients")
      .update({ archived_at: archived ? new Date().toISOString() : null } as never)
      .in("id", ids);

    if (requestError) {
      setError(requestError.message);
    } else {
      cancelClientSelection();
      await loadClients();
      setSuccess(
        archived
          ? ids.length === 1
            ? "Cliente arquivado."
            : "Clientes arquivados."
          : ids.length === 1
            ? "Cliente desarquivado."
            : "Clientes desarquivados.",
      );
    }

    setBulkActionLoading(false);
  }

  async function deleteClients(ids: string[]) {
    if (!ids.length) return;

    setBulkActionLoading(true);
    setError(null);
    setSuccess(null);

    const { error: requestError } = await supabase
      .from("clients")
      .update({ deleted_at: new Date().toISOString() } as never)
      .in("id", ids);

    if (requestError) {
      setError(requestError.message);
    } else {
      cancelClientSelection();
      await loadClients();
      setSuccess(ids.length === 1 ? "Cliente excluído." : "Clientes excluídos.");
    }

    setBulkActionLoading(false);
  }

  function resetClientFilters() {
    setClientSearch("");
    setResponsibleFilter("all");
    setClientSort("newest");
    setShowArchivedClients(false);
    setIsClientSearchOpen(false);
    setIsClientFilterOpen(false);
  }

  async function confirmClientAction() {
    if (!clientConfirmAction) return;

    const action = clientConfirmAction;

    if (action.kind === "delete") {
      await deleteClients(action.ids);
    } else {
      await updateClientArchive(action.ids, action.kind === "archive");
    }

    setClientConfirmAction(null);
  }

  const clientConfirmConfig = clientConfirmAction
    ? {
        title:
          clientConfirmAction.kind === "delete"
            ? "Excluir cliente"
            : clientConfirmAction.kind === "archive"
              ? "Arquivar cliente"
              : "Desarquivar cliente",
        message:
          clientConfirmAction.kind === "delete"
            ? "Você tem certeza que quer excluir este item? Essa ação não poderá ser desfeita."
            : clientConfirmAction.kind === "archive"
              ? "Você tem certeza que quer arquivar este item? Ele sairá da lista principal e ficará disponível em Arquivados."
              : "Você tem certeza que quer desarquivar este item? Ele voltará para a lista principal.",
        confirmLabel:
          clientConfirmAction.kind === "delete"
            ? "Excluir"
            : clientConfirmAction.kind === "archive"
              ? "Arquivar"
              : "Desarquivar",
      }
    : null;

  return (
    <section className="space-y-6 md:space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="sora-heading text-2xl font-medium text-foreground md:text-4xl">
            Biblioteca de clientes
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground md:mt-3">
            Perfis de clientes com planejamentos mensais e apresentacoes visuais separados.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 sm:justify-end">
          <Button
            id="novo-cliente"
            type="button"
            onClick={openModal}
            className="hidden h-10 rounded-lg bg-[var(--zacx-brand)] px-4 text-sm font-medium text-white hover:opacity-90 dark:text-black md:inline-flex"
          >
            <Plus className="h-4 w-4" />
            Adicionar cliente
          </Button>
          <InlineSearchControl
            isOpen={isClientSearchOpen}
            value={clientSearch}
            onOpenChange={setIsClientSearchOpen}
            onValueChange={setClientSearch}
          />
          <div className="relative">
            <Button
              type="button"
              variant="ghostSecondary"
              className={cn(
                "h-10 w-10 rounded-lg border border-border bg-background p-0 text-muted-foreground hover:bg-foreground/[0.05] hover:text-foreground focus-visible:ring-0",
                hasActiveClientFilters && "border-foreground/30 text-foreground",
              )}
              onClick={() => setIsClientFilterOpen((current) => !current)}
              aria-label="Filtrar clientes"
              title="Filtrar clientes"
            >
              <SlidersHorizontal className="h-4 w-4" />
            </Button>
            {isClientFilterOpen ? (
              <div className="fixed inset-x-3 bottom-3 z-[120] rounded-2xl border border-border bg-background p-4 shadow-none md:absolute md:inset-x-auto md:bottom-auto md:right-0 md:top-[calc(100%+0.5rem)] md:z-30 md:w-72">
                <div className="grid gap-3">
                  <select
                    value={clientSort}
                    onChange={(event) => setClientSort(event.target.value as ClientSort)}
                    className="h-10 rounded-md border border-border bg-background px-3 text-sm text-foreground outline-none focus:border-neutral-400 dark:focus:border-white/35"
                  >
                    <option value="newest">Mais novos</option>
                    <option value="oldest">Mais antigos</option>
                    <option value="az">Ordem alfabética A-Z</option>
                    <option value="za">Ordem alfabética Z-A</option>
                    <option value="more-demand">Mais demandas</option>
                    <option value="less-demand">Menos demandas</option>
                  </select>
                  <select
                    value={showArchivedClients ? "archived" : "active"}
                    onChange={(event) => setShowArchivedClients(event.target.value === "archived")}
                    className="h-10 rounded-md border border-border bg-background px-3 text-sm text-foreground outline-none focus:border-neutral-400 dark:focus:border-white/35"
                  >
                    <option value="active">Ativos</option>
                    <option value="archived">Arquivados</option>
                  </select>
                  {hasActiveClientFilters ? (
                    <Button type="button" variant="ghostSecondary" size="sm" onClick={resetClientFilters}>
                      Limpar filtros
                    </Button>
                  ) : null}
                </div>
              </div>
            ) : null}
          </div>
          <Button
            type="button"
            variant="ghostSecondary"
            className={cn(
              "h-10 w-10 rounded-lg border border-border bg-background p-0 text-muted-foreground hover:bg-foreground/[0.05] hover:text-foreground focus-visible:ring-0",
              clientSelectionMode && "border-foreground/30 text-foreground",
            )}
            onClick={() => {
              setClientSelectionMode((current) => !current);
              setSelectedClientIds([]);
            }}
            aria-label="Selecionar clientes"
            title="Selecionar clientes"
          >
            <CheckSquare2 className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="ghostSecondary"
            className={cn(
              "h-10 w-10 rounded-lg border border-border bg-background p-0 text-muted-foreground hover:bg-foreground/[0.05] hover:text-foreground focus-visible:ring-0",
              showArchivedClients && "border-foreground/30 text-foreground",
            )}
            onClick={() => setShowArchivedClients((current) => !current)}
            aria-label="Arquivados"
            title="Arquivados"
          >
            <Archive className="h-4 w-4" />
          </Button>
        </div>
        <button
          type="button"
          onClick={openModal}
          className="fixed bottom-5 right-5 z-40 grid h-14 w-14 place-items-center rounded-full bg-[var(--zacx-brand)] text-white shadow-none transition hover:opacity-90 dark:text-black md:hidden"
          aria-label="Adicionar cliente"
          title="Adicionar cliente"
        >
          <Plus className="h-6 w-6" />
        </button>
      </div>

      <AutoDismissToast
        message={success}
        variant="success"
        onDismiss={() => setSuccess(null)}
      />
      <AutoDismissToast
        message={!modalOpen ? error : null}
        variant="error"
        onDismiss={() => setError(null)}
      />

      <div className="space-y-4">
        <div className="no-scrollbar flex max-w-full flex-nowrap items-center gap-2 overflow-x-auto pb-1 md:flex-wrap md:overflow-visible md:pb-0">
          {isAdmin ? (
            <>
              <button
                type="button"
                onClick={() => setResponsibleFilter("all")}
                className={cn(
                  "h-9 shrink-0 rounded-md border border-border bg-secondary/45 px-3 text-xs font-medium text-muted-foreground transition-colors hover:border-neutral-300 hover:bg-secondary hover:text-foreground sm:h-10 sm:px-4 sm:text-sm",
                  responsibleFilter === "all" &&
                    "border-neutral-300 bg-neutral-200/70 text-foreground dark:border-white/15 dark:bg-white/[0.10] dark:text-foreground",
                )}
              >
                Todos
              </button>
              {clientResponsibleOptions.map((responsible) => (
                <button
                  key={responsible}
                  type="button"
                  onClick={() => setResponsibleFilter(responsible)}
                  className={cn(
                    "h-9 shrink-0 rounded-md border border-border bg-secondary/45 px-3 text-xs font-medium text-muted-foreground transition-colors hover:border-neutral-300 hover:bg-secondary hover:text-foreground sm:h-10 sm:px-4 sm:text-sm",
                    responsibleFilter === responsible &&
                      "border-neutral-300 bg-neutral-200/70 text-foreground dark:border-white/15 dark:bg-white/[0.10] dark:text-foreground",
                  )}
                >
                  {responsible}
                </button>
              ))}
            </>
          ) : (
            <span className="h-9 shrink-0 rounded-md border border-neutral-300 bg-neutral-200/70 px-3 py-2 text-xs font-medium text-foreground dark:border-white/15 dark:bg-white/[0.10] sm:h-10 sm:px-4 sm:text-sm">
              {responsibleNameForUser(currentUser) || "Meus clientes"}
            </span>
          )}
        </div>

        <div className="min-w-0 space-y-4">
          {clientSelectionMode ? (
            <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-background px-3 py-2 text-sm text-muted-foreground">
              <span className="mr-auto font-medium text-foreground">
                {selectedClientIds.length} selecionado{selectedClientIds.length === 1 ? "" : "s"}
              </span>
              {selectedClientIds.length ? (
                showArchivedClients ? (
                  <Button
                    type="button"
                    variant="ghostSecondary"
                    size="sm"
                    onClick={() => setClientConfirmAction({ kind: "unarchive", ids: selectedClientIds })}
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
                    onClick={() => setClientConfirmAction({ kind: "archive", ids: selectedClientIds })}
                    disabled={bulkActionLoading}
                  >
                    <Archive className="h-3.5 w-3.5" />
                    Arquivar
                  </Button>
                )
              ) : null}
              {selectedClientIds.length ? (
                <Button
                  type="button"
                  variant="ghostSecondary"
                  size="sm"
                  onClick={() => setClientConfirmAction({ kind: "delete", ids: selectedClientIds })}
                  disabled={bulkActionLoading}
                  className="text-rose-500 hover:text-rose-500"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Excluir
                </Button>
              ) : null}
              <Button type="button" variant="ghostSecondary" size="sm" onClick={cancelClientSelection}>
                Cancelar seleção
              </Button>
            </div>
          ) : null}

          {loading ? (
            <Card>
              <CardContent className="flex items-center gap-3 pt-5 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Carregando clientes...
              </CardContent>
            </Card>
          ) : filteredClients.length ? (
            <div className="grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
              {filteredClients.map((client) => (
                <ClientCard
                  key={client.id}
                  client={client}
                  selectionMode={clientSelectionMode}
                  selected={selectedClientIds.includes(client.id)}
                  onToggleSelected={() => toggleClientSelection(client.id)}
                  endingPlanningLabel={endingPlanningAlerts[client.id]?.label}
                />
              ))}
            </div>
          ) : (
            <Card className="border-dashed">
              <CardContent className="pt-5 text-sm text-muted-foreground">
                {clientSearch
                  ? "Nenhum cliente encontrado com essa busca."
                  : showArchivedClients
                    ? "Nenhum cliente arquivado."
                    : "Nenhum cliente cadastrado ainda. Crie o primeiro perfil para comecar."}
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {clientConfirmConfig ? (
        <div
          className="fixed inset-0 z-[120] grid place-items-center bg-black/40 px-4"
          onClick={() => {
            if (!bulkActionLoading) setClientConfirmAction(null);
          }}
        >
          <div
            className="w-full max-w-md rounded-2xl border border-border bg-background p-5 shadow-none"
            onClick={(event) => event.stopPropagation()}
          >
            <h2 className="sora-heading text-xl font-medium text-foreground">{clientConfirmConfig.title}</h2>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">{clientConfirmConfig.message}</p>
            <div className="mt-6 flex justify-end gap-3">
              <Button
                type="button"
                variant="ghostSecondary"
                onClick={() => setClientConfirmAction(null)}
                disabled={bulkActionLoading}
              >
                Cancelar
              </Button>
              <Button
                type="button"
                onClick={confirmClientAction}
                disabled={bulkActionLoading}
                className={cn(
                  clientConfirmAction?.kind === "delete"
                    ? "bg-rose-600 text-white hover:bg-rose-600/90"
                    : "bg-[var(--zacx-brand)] text-white hover:opacity-90 dark:text-black",
                )}
              >
                {bulkActionLoading ? "Processando..." : clientConfirmConfig.confirmLabel}
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      {modalOpen ? (
        <div
          className="fixed inset-0 z-[110] grid place-items-end bg-black/35 px-3 py-3 dark:bg-black/55 sm:place-items-center sm:px-4 sm:py-6"
          onClick={closeModal}
        >
          <div
            className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-border bg-background p-4 shadow-none sm:p-5"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Novo perfil</p>
                <h2 className="sora-heading mt-1 text-2xl font-medium text-foreground">Criar cliente</h2>
              </div>
              <Button type="button" variant="ghostSecondary" size="icon" onClick={closeModal} disabled={saving || uploadingLogo}>
                <X className="h-4 w-4" />
              </Button>
            </div>

            <form className="mt-6 space-y-5" onSubmit={handleSubmit}>
              <div className="flex justify-center">
                <ClientAvatarInput
                  id="newClientLogo"
                  name={form.name}
                  previewUrl={logoPreviewUrl}
                  accentColor={form.primaryColor}
                  uploading={uploadingLogo}
                  onFileSelect={selectLogo}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="clientName">Nome do cliente</Label>
                <Input
                  id="clientName"
                  value={form.name}
                  onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                  placeholder="Ex: AP Jales"
                />
              </div>

              <div className="rounded-lg border border-border bg-background px-3 py-2 text-xs text-muted-foreground">
                Link: <span className="font-medium text-foreground">/cliente/{generatedSlug}</span>
              </div>

              <div className="space-y-2">
                <Label htmlFor="clientResponsible">Responsável por esta empresa</Label>
                <select
                  id="clientResponsible"
                  value={form.responsibleName}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, responsibleName: event.target.value }))
                  }
                  disabled={!isAdmin}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground transition-colors focus-visible:outline-none focus-visible:ring-0 focus-visible:border-neutral-400 dark:focus-visible:border-white/35"
                >
                  {isAdmin ? <option value="">Sem responsável</option> : null}
                  {clientResponsibleOptions.map((responsible) => (
                    <option key={responsible} value={responsible}>
                      {responsible}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-3">
                <ColorDotInput
                  id="newClientPrimaryColor"
                  label="Cor primária"
                  value={form.primaryColor}
                  onChange={(value) => setForm((current) => ({ ...current, primaryColor: value }))}
                />
                <ColorDotInput
                  id="newClientSecondaryColor"
                  label="Cor secundária"
                  value={form.secondaryColor}
                  onChange={(value) => setForm((current) => ({ ...current, secondaryColor: value }))}
                />
              </div>

              {error ? <p className="text-sm text-rose-300">{error}</p> : null}

              <div className="flex justify-end gap-3 pt-2">
                <Button type="button" variant="ghostSecondary" onClick={closeModal} disabled={saving || uploadingLogo}>
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  disabled={saving || uploadingLogo}
                  className="bg-[var(--zacx-brand)] text-white hover:opacity-90 dark:text-black"
                >
                  {saving || uploadingLogo ? "Criando..." : "Criar cliente"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </section>
  );
}
