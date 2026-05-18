"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Check,
  Clipboard,
  ExternalLink,
  ImagePlus,
  PenLine,
  Plus,
  Trash2,
} from "lucide-react";

import { PresentationCard } from "@/components/presentation/presentation-card";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { formatDateInput, isValidDayMonth } from "@/lib/date-mask";
import { supabase } from "@/lib/supabase/client";
import type { Client, ContentItem, PlanningWeek, PresentationItem } from "@/lib/supabase/types";
import { cn, periodLabel } from "@/lib/utils";

type WeekEditorProps = {
  weekId: string;
};

type QuickContentForm = {
  type: string;
  title: string;
  copyText: string;
  caption: string;
  notes: string;
};

type ContentDetailsForm = {
  type: string;
  title: string;
  copyText: string;
  caption: string;
  notes: string;
};

type PresentationForm = {
  imageFile: File | null;
  format: string;
  label: string;
  shortDate: string;
  weekday: string;
};

const contentTypes = [
  { value: "post", label: "Post" },
  { value: "carrossel", label: "Carrossel" },
  { value: "stories", label: "Stories" },
  { value: "reels", label: "Reels" },
];

const presentationFormats = [
  { value: "post", label: "Post" },
  { value: "carrossel", label: "Carrossel" },
  { value: "stories", label: "Stories" },
];

const weekdays = ["SEG", "TER", "QUA", "QUI", "SEX", "SÁB", "DOM"];

const initialContentForm: QuickContentForm = {
  type: "post",
  title: "",
  copyText: "",
  caption: "",
  notes: "",
};

const initialPresentationForm: PresentationForm = {
  imageFile: null,
  format: "post",
  label: "",
  shortDate: "",
  weekday: "SEG",
};

const initialDetailsForm: ContentDetailsForm = {
  type: "post",
  title: "",
  copyText: "",
  caption: "",
  notes: "",
};

function nullable(value: string) {
  return value.trim() || null;
}

function nextOrderIndex(items: Array<{ order_index: number | null }>) {
  return items.reduce((max, item) => Math.max(max, item.order_index ?? -1), -1) + 1;
}

function safeStorageFileName(fileName: string) {
  const name = fileName.split(/[/\\]/).pop() || "image";
  const safeName = name.replace(/[^a-zA-Z0-9._-]/g, "-");

  return safeName || "image";
}

function shortDateToIso(shortDate: string, week?: PlanningWeek | null) {
  if (!isValidDayMonth(shortDate)) return null;

  const match = shortDate.trim().match(/^(\d{2})\/(\d{2})$/);

  if (!match) return null;

  const day = Number(match[1]);
  const month = Number(match[2]);

  const fallbackYear = new Date().getFullYear();
  const year = week?.start_date
    ? new Date(`${week.start_date}T12:00:00`).getFullYear()
    : fallbackYear;

  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function detailsFromItem(item: ContentItem): ContentDetailsForm {
  return {
    type: item.type || "post",
    title: item.title ?? "",
    copyText: item.content_text ?? "",
    caption: item.caption ?? "",
    notes: item.notes ?? "",
  };
}

function WeekdayControl({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="grid grid-cols-7 gap-1">
      {weekdays.map((weekday) => {
        const isActive = value === weekday;

        return (
          <button
            key={weekday}
            type="button"
            onClick={() => onChange(weekday)}
            className={cn(
              "h-9 rounded-md border text-xs font-semibold transition-colors",
              isActive
                ? "border-white bg-white text-black"
                : "border-border bg-[#101012] text-muted-foreground hover:bg-[#202024] hover:text-white",
            )}
          >
            {weekday}
          </button>
        );
      })}
    </div>
  );
}

function summaryText(value?: string | null) {
  const text = value?.trim();

  if (!text) return "Nao preenchido";
  if (text.length <= 160) return text;

  return `${text.slice(0, 157)}...`;
}

function presentationMode(item: PresentationItem) {
  const source = `${item.format ?? ""}`.toLowerCase();

  if (source.includes("stories") || source.includes("story")) return "stories";
  if (source.includes("carrossel") || source.includes("carousel")) return "carrossel";

  return "post";
}

function groupedPresentationItems(items: PresentationItem[]) {
  const groups = new Map<string, PresentationItem[]>();

  items.forEach((item) => {
    const mode = presentationMode(item);
    const key =
      mode === "post"
        ? item.id
        : [mode, item.content_date || "sem-data", item.weekday || "sem-dia"].join("|");

    groups.set(key, [...(groups.get(key) ?? []), item]);
  });

  return Array.from(groups.entries()).map(([key, groupItems]) => ({
    key,
    items: groupItems,
  }));
}

function storagePathFromPublicUrl(publicUrl?: string | null) {
  if (!publicUrl) return null;

  const marker = "/storage/v1/object/public/presentation-assets/";
  const markerIndex = publicUrl.indexOf(marker);

  if (markerIndex === -1) return null;

  return decodeURIComponent(publicUrl.slice(markerIndex + marker.length));
}

export function WeekEditor({ weekId }: WeekEditorProps) {
  const [week, setWeek] = useState<PlanningWeek | null>(null);
  const [client, setClient] = useState<Client | null>(null);
  const [contentItems, setContentItems] = useState<ContentItem[]>([]);
  const [presentationItems, setPresentationItems] = useState<PresentationItem[]>([]);
  const [contentForm, setContentForm] = useState<QuickContentForm>(initialContentForm);
  const [presentationForm, setPresentationForm] =
    useState<PresentationForm>(initialPresentationForm);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [detailsForm, setDetailsForm] = useState<ContentDetailsForm>(initialDetailsForm);
  const [activeTab, setActiveTab] = useState("planning");
  const [origin, setOrigin] = useState("");
  const [loading, setLoading] = useState(true);
  const [savingContent, setSavingContent] = useState(false);
  const [savingDetails, setSavingDetails] = useState(false);
  const [deletingItemId, setDeletingItemId] = useState<string | null>(null);
  const [savingPresentation, setSavingPresentation] = useState(false);
  const [deletingPresentationId, setDeletingPresentationId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [fileInputKey, setFileInputKey] = useState(0);
  const [error, setError] = useState<string | null>(null);

  async function loadWeek() {
    setLoading(true);
    setError(null);

    const { data: weekData, error: weekError } = await supabase
      .from("planning_weeks")
      .select("*")
      .eq("id", weekId)
      .maybeSingle();

    if (weekError || !weekData) {
      setError(weekError?.message || "Semana nao encontrada.");
      setWeek(null);
      setLoading(false);
      return;
    }

    const [clientResult, contentResult, presentationResult] = await Promise.all([
      supabase.from("clients").select("*").eq("id", weekData.client_id).maybeSingle(),
      supabase
        .from("content_items")
        .select("*")
        .eq("planning_week_id", weekData.id)
        .order("order_index", { ascending: true })
        .order("content_date", { ascending: true }),
      supabase
        .from("presentation_items")
        .select("*")
        .eq("planning_week_id", weekData.id)
        .order("order_index", { ascending: true })
        .order("content_date", { ascending: true }),
    ]);

    const firstError = clientResult.error || contentResult.error || presentationResult.error;

    if (firstError) {
      setError(firstError.message);
    } else {
      setWeek(weekData);
      setClient(clientResult.data);
      setContentItems(contentResult.data ?? []);
      setPresentationItems(presentationResult.data ?? []);
    }

    setLoading(false);
  }

  useEffect(() => {
    setOrigin(window.location.origin);
    loadWeek();
  }, [weekId]);

  async function handleCreateContent(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!week) {
      setError("Semana nao carregada.");
      return;
    }

    setSavingContent(true);
    setError(null);
    setNotice(null);

    const { error: requestError } = await supabase.from("content_items").insert({
      planning_week_id: week.id,
      type: contentForm.type || "post",
      title: nullable(contentForm.title),
      content_text: nullable(contentForm.copyText),
      caption: nullable(contentForm.caption),
      notes: nullable(contentForm.notes),
      order_index: nextOrderIndex(contentItems),
    });

    if (requestError) {
      setError(requestError.message);
    } else {
      setContentForm(initialContentForm);
      await loadWeek();
      setNotice("Item criado.");
    }

    setSavingContent(false);
  }

  function openDetails(item: ContentItem) {
    setEditingItemId(item.id);
    setDetailsForm(detailsFromItem(item));
    setError(null);
    setNotice(null);
  }

  async function saveDetails(item: ContentItem) {
    setSavingDetails(true);
    setError(null);
    setNotice(null);

    const { error: requestError } = await supabase
      .from("content_items")
      .update({
        type: detailsForm.type || "post",
        title: nullable(detailsForm.title),
        content_text: nullable(detailsForm.copyText),
        caption: nullable(detailsForm.caption),
        notes: nullable(detailsForm.notes),
      })
      .eq("id", item.id);

    if (requestError) {
      setError(requestError.message);
    } else {
      setEditingItemId(null);
      await loadWeek();
      setNotice("Detalhes salvos.");
    }

    setSavingDetails(false);
  }

  async function deleteContentItem(item: ContentItem) {
    const confirmed = window.confirm("Excluir este item de planejamento?");

    if (!confirmed) return;

    setDeletingItemId(item.id);
    setError(null);
    setNotice(null);

    const { error: requestError } = await supabase.from("content_items").delete().eq("id", item.id);

    if (requestError) {
      setError(requestError.message);
    } else {
      await loadWeek();
      setNotice("Item excluido.");
    }

    setDeletingItemId(null);
  }

  async function handleCreatePresentation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!week) {
      setError("Semana nao carregada.");
      return;
    }

    if (!presentationForm.imageFile) {
      setError("Selecione uma imagem antes de adicionar o visual.");
      return;
    }

    const contentDate = shortDateToIso(presentationForm.shortDate, week);

    if (!contentDate) {
      setError("Informe a data no formato DD/MM.");
      return;
    }

    setSavingPresentation(true);
    setError(null);
    setNotice(null);

    const file = presentationForm.imageFile;
    const storagePath = `${week.id}/${Date.now()}-${safeStorageFileName(file.name)}`;

    const { error: uploadError } = await supabase.storage
      .from("presentation-assets")
      .upload(storagePath, file, {
        contentType: file.type || undefined,
        upsert: false,
      });

    if (uploadError) {
      setError(uploadError.message);
      setSavingPresentation(false);
      return;
    }

    const {
      data: { publicUrl },
    } = supabase.storage.from("presentation-assets").getPublicUrl(storagePath);

    if (!publicUrl) {
      setError("Nao foi possivel gerar a URL publica da imagem.");
      setSavingPresentation(false);
      return;
    }

    const { error: requestError } = await supabase.from("presentation_items").insert({
      planning_week_id: week.id,
      image_url: publicUrl,
      format: presentationForm.format || "post",
      label: nullable(presentationForm.label),
      content_date: contentDate,
      weekday: presentationForm.weekday || null,
      order_index: nextOrderIndex(presentationItems),
    });

    if (requestError) {
      setError(requestError.message);
    } else {
      setPresentationForm(initialPresentationForm);
      setFileInputKey((current) => current + 1);
      await loadWeek();
      setNotice("Visual enviado.");
    }

    setSavingPresentation(false);
  }

  async function deletePresentationItem(item: PresentationItem) {
    const confirmed = window.confirm("Excluir este visual enviado?");

    if (!confirmed) return;

    setDeletingPresentationId(item.id);
    setError(null);
    setNotice(null);

    const { error: requestError } = await supabase
      .from("presentation_items")
      .delete()
      .eq("id", item.id);

    if (requestError) {
      setError(requestError.message);
      setDeletingPresentationId(null);
      return;
    }

    const storagePath = storagePathFromPublicUrl(item.image_url);

    if (storagePath) {
      await supabase.storage.from("presentation-assets").remove([storagePath]);
    }

    await loadWeek();
    setNotice("Visual excluido.");
    setDeletingPresentationId(null);
  }

  async function copyPublicLink() {
    if (!week) return;

    await navigator.clipboard.writeText(`${origin}/s/${week.public_slug}`);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }

  if (loading) {
    return (
      <Card className="bg-[#17171A]">
        <CardContent className="pt-5 text-sm text-muted-foreground">
          Carregando semana...
        </CardContent>
      </Card>
    );
  }

  if (!week) {
    return (
      <section className="space-y-4">
        <Button asChild variant="ghostSecondary">
          <Link href="/admin/clientes">
            <ArrowLeft className="h-4 w-4" />
            Voltar
          </Link>
        </Button>
        <Card className="bg-[#17171A]">
          <CardContent className="pt-5 text-sm text-muted-foreground">
            {error || "Semana nao encontrada."}
          </CardContent>
        </Card>
      </section>
    );
  }

  const publicLink = `${origin}/s/${week.public_slug}`;

  return (
    <section className="space-y-6">
      <Button asChild variant="ghostSecondary">
        <Link href={client ? `/admin/clientes/${client.id}` : "/admin/clientes"}>
          <ArrowLeft className="h-4 w-4" />
          Voltar
        </Link>
      </Button>

      <div className="rounded-lg border border-border bg-[#17171A] p-5 md:p-6">
        <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
              <span>{client?.name || "Cliente"}</span>
              <span className="text-neutral-700">/</span>
              <span>{periodLabel(week.start_date, week.end_date)}</span>
            </div>
            <h1 className="sora-heading mt-2 text-2xl font-semibold text-white md:text-4xl">{week.title}</h1>
          </div>
        </div>
      </div>

      <Tabs
        value={activeTab}
        onValueChange={(value) => {
          setActiveTab(value);
          setError(null);
          setNotice(null);
        }}
        className="w-full"
      >
        <TabsList className="w-full justify-start overflow-x-auto sm:w-auto">
          <TabsTrigger value="planning">Planejamento</TabsTrigger>
          <TabsTrigger value="presentation">Apresentacao</TabsTrigger>
          <TabsTrigger value="client-link">Link do cliente</TabsTrigger>
        </TabsList>

        <TabsContent value="planning" className="space-y-5">
          {error ? (
            <Card className="border-rose-500/30 bg-rose-500/10">
              <CardContent className="pt-5 text-sm text-rose-100">{error}</CardContent>
            </Card>
          ) : null}

          {notice ? (
            <Card className="border-emerald-500/30 bg-emerald-500/10">
              <CardContent className="pt-5 text-sm text-emerald-100">{notice}</CardContent>
            </Card>
          ) : null}

          <Card className="bg-[#17171A]">
            <CardHeader>
              <CardTitle>Novo item</CardTitle>
              <CardDescription>Cadastre o texto, a legenda e as observacoes do conteudo.</CardDescription>
            </CardHeader>
            <CardContent>
              <form className="space-y-5" onSubmit={handleCreateContent}>
                <div className="grid gap-4 md:grid-cols-[180px_1fr]">
                  <div className="space-y-2">
                    <Label htmlFor="contentType">Tipo</Label>
                    <select
                      id="contentType"
                      value={contentForm.type}
                      onChange={(event) =>
                        setContentForm((current) => ({ ...current, type: event.target.value }))
                      }
                      className="flex h-10 w-full rounded-md border border-input bg-[#101012] px-3 py-2 text-sm text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      {contentTypes.map((type) => (
                        <option key={type.value} value={type.value}>
                          {type.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="contentTitle">Titulo/Tema</Label>
                    <Input
                      id="contentTitle"
                      value={contentForm.title}
                      onChange={(event) =>
                        setContentForm((current) => ({
                          ...current,
                          title: event.target.value,
                        }))
                      }
                      placeholder="Tema do conteudo"
                    />
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="contentText">Texto/copy</Label>
                    <Textarea
                      id="contentText"
                      value={contentForm.copyText}
                      onChange={(event) =>
                        setContentForm((current) => ({
                          ...current,
                          copyText: event.target.value,
                        }))
                      }
                      placeholder="Copy principal do conteudo"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="contentCaption">Legenda</Label>
                    <Textarea
                      id="contentCaption"
                      value={contentForm.caption}
                      onChange={(event) =>
                        setContentForm((current) => ({
                          ...current,
                          caption: event.target.value,
                        }))
                      }
                      placeholder="Legenda para publicacao"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="contentNotes">Observacoes</Label>
                    <Textarea
                      id="contentNotes"
                      value={contentForm.notes}
                      onChange={(event) =>
                        setContentForm((current) => ({
                          ...current,
                          notes: event.target.value,
                        }))
                      }
                      placeholder="Referencias, ajustes ou cuidados"
                    />
                  </div>
                  <Button type="submit" disabled={savingContent} className="w-full md:col-span-2">
                    <Plus className="h-4 w-4" />
                    {savingContent ? "Criando..." : "Criar item"}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>

          <div className="grid gap-3">
            {contentItems.length ? (
              contentItems.map((item) => {
                const isEditing = editingItemId === item.id;

                return (
                  <Card key={item.id} className="bg-[#17171A]">
                    <CardContent className="space-y-4 pt-5">
                      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="rounded-full border border-border bg-[#101012] px-2.5 py-1 text-xs font-semibold uppercase text-neutral-200">
                              {item.type || "post"}
                            </span>
                          </div>
                          <h3 className="sora-heading mt-3 text-lg font-semibold leading-6 text-white">
                            {item.title || "Sem titulo"}
                          </h3>
                          <div className="mt-4 grid gap-3 text-sm leading-6 text-muted-foreground md:grid-cols-3">
                            <div className="rounded-md border border-border bg-[#101012] p-3">
                              <p className="mb-1 text-xs font-semibold uppercase text-neutral-400">
                                Texto/copy
                              </p>
                              <p>{summaryText(item.content_text)}</p>
                            </div>
                            <div className="rounded-md border border-border bg-[#101012] p-3">
                              <p className="mb-1 text-xs font-semibold uppercase text-neutral-400">
                                Legenda
                              </p>
                              <p>{summaryText(item.caption)}</p>
                            </div>
                            <div className="rounded-md border border-border bg-[#101012] p-3">
                              <p className="mb-1 text-xs font-semibold uppercase text-neutral-400">
                                Observacoes
                              </p>
                              <p>{summaryText(item.notes)}</p>
                            </div>
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <Button type="button" variant="secondary" onClick={() => openDetails(item)}>
                            <PenLine className="h-4 w-4" />
                            Editar
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => deleteContentItem(item)}
                            disabled={deletingItemId === item.id}
                          >
                            <Trash2 className="h-4 w-4" />
                            Excluir
                          </Button>
                        </div>
                      </div>

                      {isEditing ? (
                        <div className="grid gap-4 rounded-lg border border-border bg-[#101012] p-4 md:grid-cols-2">
                          <div className="space-y-2">
                            <Label htmlFor={`type-${item.id}`}>Tipo</Label>
                            <select
                              id={`type-${item.id}`}
                              value={detailsForm.type}
                              onChange={(event) =>
                                setDetailsForm((current) => ({
                                  ...current,
                                  type: event.target.value,
                                }))
                              }
                              className="flex h-10 w-full rounded-md border border-input bg-[#101012] px-3 py-2 text-sm text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                            >
                              {contentTypes.map((type) => (
                                <option key={type.value} value={type.value}>
                                  {type.label}
                                </option>
                              ))}
                            </select>
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor={`title-${item.id}`}>Titulo/Tema</Label>
                            <Input
                              id={`title-${item.id}`}
                              value={detailsForm.title}
                              onChange={(event) =>
                                setDetailsForm((current) => ({
                                  ...current,
                                  title: event.target.value,
                                }))
                              }
                              placeholder="Tema do conteudo"
                            />
                          </div>
                          <div className="space-y-2 md:col-span-2">
                            <Label htmlFor={`copy-${item.id}`}>Texto/copy</Label>
                            <Textarea
                              id={`copy-${item.id}`}
                              value={detailsForm.copyText}
                              onChange={(event) =>
                                setDetailsForm((current) => ({
                                  ...current,
                                  copyText: event.target.value,
                                }))
                              }
                              placeholder="Copy principal do conteudo"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor={`caption-${item.id}`}>Legenda</Label>
                            <Textarea
                              id={`caption-${item.id}`}
                              value={detailsForm.caption}
                              onChange={(event) =>
                                setDetailsForm((current) => ({
                                  ...current,
                                  caption: event.target.value,
                                }))
                              }
                              placeholder="Legenda para publicacao"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor={`notes-${item.id}`}>Observacoes</Label>
                            <Textarea
                              id={`notes-${item.id}`}
                              value={detailsForm.notes}
                              onChange={(event) =>
                                setDetailsForm((current) => ({
                                  ...current,
                                  notes: event.target.value,
                                }))
                              }
                              placeholder="Direcionamentos, referencias ou cuidados"
                            />
                          </div>
                          <div className="flex flex-wrap gap-2 md:col-span-2">
                            <Button
                              type="button"
                              onClick={() => saveDetails(item)}
                              disabled={savingDetails}
                            >
                              {savingDetails ? "Salvando..." : "Salvar detalhes"}
                            </Button>
                            <Button
                              type="button"
                              variant="ghostSecondary"
                              onClick={() => setEditingItemId(null)}
                            >
                              Cancelar
                            </Button>
                          </div>
                        </div>
                      ) : null}
                    </CardContent>
                  </Card>
                );
              })
            ) : (
              <Card className="bg-[#17171A]">
                <CardContent className="pt-5 text-sm text-muted-foreground">
                  Nenhum item de planejamento ainda.
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        <TabsContent value="presentation" className="space-y-6">
          {error ? (
            <Card className="border-rose-500/30 bg-rose-500/10">
              <CardContent className="pt-5 text-sm text-rose-100">{error}</CardContent>
            </Card>
          ) : null}

          {notice ? (
            <Card className="border-emerald-500/30 bg-emerald-500/10">
              <CardContent className="pt-5 text-sm text-emerald-100">{notice}</CardContent>
            </Card>
          ) : null}

          <Card className="bg-[#17171A]">
            <CardHeader>
              <CardTitle>Adicionar arte</CardTitle>
              <CardDescription>Envie a imagem e preencha apenas os dados que entram no preview.</CardDescription>
            </CardHeader>
            <CardContent>
              <form className="space-y-5" onSubmit={handleCreatePresentation}>
                <div className="grid gap-4 md:grid-cols-[1.2fr_1fr_110px]">
                  <div className="space-y-2 md:col-span-3">
                    <Label htmlFor="visualFile">Arquivo</Label>
                    <Input
                      key={fileInputKey}
                      id="visualFile"
                      type="file"
                      accept="image/*"
                      onChange={(event) =>
                        setPresentationForm((current) => ({
                          ...current,
                          imageFile: event.target.files?.[0] ?? null,
                        }))
                      }
                    />
                    {presentationForm.imageFile ? (
                      <p className="text-xs text-muted-foreground">
                        {presentationForm.imageFile.name}
                      </p>
                    ) : null}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="visualLabel">Label</Label>
                    <Input
                      id="visualLabel"
                      value={presentationForm.label}
                      onChange={(event) =>
                        setPresentationForm((current) => ({
                          ...current,
                          label: event.target.value,
                        }))
                      }
                      placeholder="Capa da campanha"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="visualFormat">Formato</Label>
                    <select
                      id="visualFormat"
                      value={presentationForm.format}
                      onChange={(event) =>
                        setPresentationForm((current) => ({
                          ...current,
                          format: event.target.value,
                        }))
                      }
                      required
                      className="flex h-10 w-full rounded-md border border-input bg-[#101012] px-3 py-2 text-sm text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      {presentationFormats.map((format) => (
                        <option key={format.value} value={format.value}>
                          {format.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="visualDate">Data</Label>
                    <Input
                      id="visualDate"
                      inputMode="numeric"
                      maxLength={5}
                      value={presentationForm.shortDate}
                      onChange={(event) =>
                        setPresentationForm((current) => ({
                          ...current,
                          shortDate: formatDateInput(event.target.value),
                        }))
                      }
                      placeholder="15/05"
                    />
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <Label>Dia</Label>
                    <WeekdayControl
                      value={presentationForm.weekday}
                      onChange={(weekday) =>
                        setPresentationForm((current) => ({ ...current, weekday }))
                      }
                    />
                  </div>
                  <div className="flex items-end">
                    <Button type="submit" disabled={savingPresentation} className="w-full">
                      <ImagePlus className="h-4 w-4" />
                      {savingPresentation ? "Enviando..." : "Adicionar visual"}
                    </Button>
                  </div>
                </div>
              </form>
            </CardContent>
          </Card>

          {presentationItems.length ? (
            <div className="grid gap-5 lg:grid-cols-2 2xl:grid-cols-3">
              {groupedPresentationItems(presentationItems).map((group) => (
                <PresentationCard
                  key={group.key}
                  item={group.items[0]}
                  items={group.items}
                  client={client}
                  onDelete={deletePresentationItem}
                  deletingItemId={deletingPresentationId}
                />
              ))}
            </div>
          ) : (
            <Card className="bg-[#17171A]">
              <CardContent className="pt-5 text-sm text-muted-foreground">
                Nenhum item visual ainda.
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="client-link">
          <Card className="bg-[#17171A]">
            <CardHeader>
              <CardTitle>Link do cliente</CardTitle>
              <CardDescription>Envie este link para revisao sem login.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="rounded-lg border border-border bg-[#101012] p-4">
                <p className="text-xs uppercase text-muted-foreground">Link publico</p>
                <p className="mt-2 break-all text-sm text-white">{publicLink}</p>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <Button onClick={copyPublicLink} type="button" variant="ghostSecondary">
                  {copied ? <Check className="h-4 w-4" /> : <Clipboard className="h-4 w-4" />}
                  {copied ? "Copiado" : "Copiar"}
                </Button>
                <Button asChild variant="ghostSecondary">
                  <Link href={`/s/${week.public_slug}`} target="_blank" rel="noreferrer">
                    <ExternalLink className="h-4 w-4" />
                    Abrir
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </section>
  );
}
