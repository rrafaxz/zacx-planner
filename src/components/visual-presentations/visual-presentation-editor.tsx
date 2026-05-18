"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Archive, ArrowLeft, Clipboard, ExternalLink, ImagePlus, Plus, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  VisualItemBoard,
  type VisualItemWithImages,
} from "@/components/visual-presentations/visual-item-board";
import { useTheme } from "@/components/theme/theme-provider";
import { formatDateInput, getDayMonthInputError } from "@/lib/date-mask";
import { optimizeImage } from "@/lib/image-optimizer";
import { supabase } from "@/lib/supabase/client";
import type { Client, VisualItemImage, VisualPresentation } from "@/lib/supabase/types";
import { cn } from "@/lib/utils";

type VisualPresentationEditorProps = {
  presentationId: string;
};

type VisualFormat = "post" | "carousel" | "stories";

type VisualPublicationForm = {
  format: VisualFormat;
  weekday: string;
  date: string;
  imageFiles: File[];
};

type EditPublicationForm = {
  itemId: string;
  format: VisualFormat;
  weekday: string;
  date: string;
};

const weekdays = ["SEG", "TER", "QUA", "QUI", "SEX", "SÁB", "DOM"];
const visualPresentationsBucket = "visual-presentations";
const legacyPresentationAssetsBucket = "presentation-assets";

const publicationTypes: Array<{
  format: VisualFormat;
  label: string;
}> = [
  { format: "post", label: "Post" },
  { format: "carousel", label: "Carrossel" },
  { format: "stories", label: "Stories" },
];

function initialPublicationForm(format: VisualFormat): VisualPublicationForm {
  return {
    format,
    weekday: "SEG",
    date: "",
    imageFiles: [],
  };
}

function nextOrderIndex(items: Array<{ order_index: number | null }>) {
  return items.reduce((max, item) => Math.max(max, item.order_index ?? -1), -1) + 1;
}

function safeStorageFileName(fileName: string) {
  const name = fileName.split(/[/\\]/).pop() || "image";
  const safeName = name.replace(/[^a-zA-Z0-9._-]/g, "-");

  return safeName || "image";
}

function visualPresentationStoragePath({
  clientId,
  presentationId,
  itemId,
  fileName,
  index,
}: {
  clientId: string;
  presentationId: string;
  itemId: string;
  fileName: string;
  index: number;
}) {
  return [
    "clients",
    clientId,
    "presentations",
    presentationId,
    itemId,
    `${Date.now()}-${index}-${safeStorageFileName(fileName)}`,
  ].join("/");
}

function publicationLabel(format: VisualFormat) {
  if (format === "carousel") return "Carrossel";
  if (format === "stories") return "Stories";

  return "Post";
}

function visualFormatFromValue(value?: string | null): VisualFormat {
  const format = `${value ?? ""}`.toLowerCase();

  if (format.includes("stories") || format.includes("story")) return "stories";
  if (format.includes("carousel") || format.includes("carrossel")) return "carousel";

  return "post";
}

function dateFromDisplayDate(value?: string | null) {
  return formatDateInput(value || "");
}

function WeekdayControl({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {weekdays.map((weekday) => {
        const isActive = value === weekday;

        return (
          <button
            key={weekday}
            type="button"
            onClick={() => onChange(weekday)}
            className={
              isActive
                ? "h-10 min-w-10 rounded-full border border-primary bg-primary px-3 text-xs font-semibold text-primary-foreground"
                : "h-10 min-w-10 rounded-full border border-border bg-background px-3 text-xs font-semibold text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
            }
          >
            {weekday}
          </button>
        );
      })}
    </div>
  );
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

export function VisualPresentationEditor({ presentationId }: VisualPresentationEditorProps) {
  const [presentation, setPresentation] = useState<VisualPresentation | null>(null);
  const [client, setClient] = useState<Client | null>(null);
  const [items, setItems] = useState<VisualItemWithImages[]>([]);
  const [activeFormat, setActiveFormat] = useState<VisualFormat | null>(null);
  const [form, setForm] = useState<VisualPublicationForm>(initialPublicationForm("post"));
  const [editForm, setEditForm] = useState<EditPublicationForm | null>(null);
  const [origin, setOrigin] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);
  const [deletingItemId, setDeletingItemId] = useState<string | null>(null);
  const [archiving, setArchiving] = useState(false);
  const [copied, setCopied] = useState(false);
  const [fileInputKey, setFileInputKey] = useState(0);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { theme } = useTheme();

  const surfaceClass = "bg-background text-foreground";
  const nestedSurfaceClass = "border-border bg-background text-foreground";
  const mutedTextClass = "text-muted-foreground";
  const selectedImagePreviews = useMemo(
    () =>
      form.imageFiles.map((file) => ({
        name: file.name,
        url: URL.createObjectURL(file),
      })),
    [form.imageFiles],
  );

  useEffect(() => {
    return () => {
      selectedImagePreviews.forEach((preview) => URL.revokeObjectURL(preview.url));
    };
  }, [selectedImagePreviews]);

  async function loadPresentation() {
    setLoading(true);
    setError(null);

    const { data: presentationData, error: presentationError } = await supabase
      .from("visual_presentations")
      .select("*")
      .eq("id", presentationId)
      .maybeSingle();

    if (presentationError || !presentationData) {
      setError(presentationError?.message || "Apresentacao nao encontrada.");
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
        .order("order_index", { ascending: true })
        .order("created_at", { ascending: true }),
    ]);

    const firstError = clientResult.error || itemResult.error;

    if (firstError) {
      setError(firstError.message);
      setLoading(false);
      return;
    }

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
    setLoading(false);
  }

  useEffect(() => {
    setOrigin(window.location.origin);
    loadPresentation();
  }, [presentationId]);

  function openForm(format: VisualFormat) {
    setActiveFormat(format);
    setForm(initialPublicationForm(format));
    setEditForm(null);
    setFileInputKey((current) => current + 1);
    setError(null);
    setNotice(null);
  }

  function openEditForm(item: VisualItemWithImages) {
    setEditForm({
      itemId: item.id,
      format: visualFormatFromValue(item.format),
      weekday: item.weekday || "SEG",
      date: dateFromDisplayDate(item.display_date),
    });
    setActiveFormat(null);
    setError(null);
    setNotice(null);
  }

  async function cleanupFailedPublication(itemId: string, imagePaths: string[]) {
    await supabase.from("visual_items").delete().eq("id", itemId);

    if (imagePaths.length) {
      await supabase.storage.from(visualPresentationsBucket).remove(imagePaths);
    }
  }

  async function handleAddPublication(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!presentation || !activeFormat) return;

    if (!form.weekday) {
      setError("Selecione um dia da semana antes de salvar.");
      return;
    }

    const dateError = getDayMonthInputError(form.date);

    if (dateError) {
      setError(dateError);
      return;
    }

    if (!form.imageFiles.length) {
      setError("Selecione pelo menos uma imagem.");
      return;
    }

    if (form.format === "post" && form.imageFiles.length !== 1) {
      setError("Post aceita apenas uma imagem.");
      return;
    }

    setSaving(true);
    setError(null);
    setNotice(null);

    const { data: itemData, error: itemError } = await supabase
      .from("visual_items")
      .insert({
        visual_presentation_id: presentation.id,
        format: form.format,
        label: null,
        weekday: form.weekday,
        display_date: form.date,
        order_index: nextOrderIndex(items),
        is_visible: true,
      })
      .select("*")
      .single();

    if (itemError || !itemData) {
      setError(itemError?.message || "Nao foi possivel criar a publicacao.");
      setSaving(false);
      return;
    }

    const uploadedRows: Array<{
      visual_item_id: string;
      image_url: string;
      image_path: string;
      order_index: number;
    }> = [];
    const uploadedPaths: string[] = [];

    for (let index = 0; index < form.imageFiles.length; index += 1) {
      const file = form.imageFiles[index];
      const optimizedFile = await optimizeImage(file, form.format);
      const imagePath = visualPresentationStoragePath({
        clientId: presentation.client_id,
        presentationId: presentation.id,
        itemId: itemData.id,
        fileName: optimizedFile.name,
        index,
      });

      const { error: uploadError } = await supabase.storage
        .from(visualPresentationsBucket)
        .upload(imagePath, optimizedFile, {
          contentType: optimizedFile.type || undefined,
          upsert: false,
        });

      if (uploadError) {
        await cleanupFailedPublication(itemData.id, uploadedPaths);
        setError(uploadError.message);
        setSaving(false);
        return;
      }

      uploadedPaths.push(imagePath);

      const {
        data: { publicUrl },
      } = supabase.storage.from(visualPresentationsBucket).getPublicUrl(imagePath);

      if (!publicUrl) {
        await cleanupFailedPublication(itemData.id, uploadedPaths);
        setError("Nao foi possivel gerar a URL publica da imagem.");
        setSaving(false);
        return;
      }

      uploadedRows.push({
        visual_item_id: itemData.id,
        image_url: publicUrl,
        image_path: imagePath,
        order_index: index,
      });
    }

    const { error: imageInsertError } = await supabase
      .from("visual_item_images")
      .insert(uploadedRows);

    if (imageInsertError) {
      await cleanupFailedPublication(itemData.id, uploadedPaths);
      setError(imageInsertError.message);
      setSaving(false);
      return;
    }

    const firstUploadedImage = uploadedRows[0];

    if (firstUploadedImage) {
      await supabase
        .from("visual_items")
        .update({
          image_url: firstUploadedImage.image_url,
          image_path: firstUploadedImage.image_path,
        })
        .eq("id", itemData.id);
    }

    setForm(initialPublicationForm(form.format));
    setFileInputKey((current) => current + 1);
    await loadPresentation();
    setNotice(`${publicationLabel(form.format)} adicionado.`);
    setActiveFormat(null);
    setSaving(false);
  }

  async function handleSaveEdit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!editForm) return;

    if (!editForm.weekday) {
      setError("Selecione um dia da semana para salvar a edicao.");
      return;
    }

    const dateError = getDayMonthInputError(editForm.date);

    if (dateError) {
      setError(dateError);
      return;
    }

    setSavingEdit(true);
    setError(null);
    setNotice(null);

    const { error: updateError } = await supabase
      .from("visual_items")
      .update({
        format: editForm.format,
        weekday: editForm.weekday,
        display_date: editForm.date,
      })
      .eq("id", editForm.itemId);

    if (updateError) {
      setError(updateError.message);
    } else {
      setEditForm(null);
      await loadPresentation();
      setNotice("Publicacao atualizada.");
    }

    setSavingEdit(false);
  }

  async function deleteItem(item: VisualItemWithImages) {
    const confirmed = window.confirm("Excluir esta publicacao visual?");

    if (!confirmed) return;

    setDeletingItemId(item.id);
    setError(null);
    setNotice(null);

    const storagePaths = [
      ...(item.images ?? []).map((image) => image.image_path).filter(Boolean),
      item.image_path,
    ].filter(Boolean) as string[];

    await supabase.from("visual_item_images").delete().eq("visual_item_id", item.id);

    const { error: deleteError } = await supabase.from("visual_items").delete().eq("id", item.id);

    if (deleteError) {
      setError(deleteError.message);
      setDeletingItemId(null);
      return;
    }

    if (storagePaths.length) {
      await Promise.all([
        supabase.storage.from(visualPresentationsBucket).remove(storagePaths),
        supabase.storage.from(legacyPresentationAssetsBucket).remove(storagePaths),
      ]);
    }

    await loadPresentation();
    setNotice("Publicacao excluida.");
    setDeletingItemId(null);
  }

  async function archivePresentation() {
    if (!presentation) return;

    const confirmed = window.confirm("Arquivar esta apresentacao?");

    if (!confirmed) return;

    setArchiving(true);
    setError(null);
    setNotice(null);

    const { error: requestError } = await supabase
      .from("visual_presentations")
      .update({
        archived_at: new Date().toISOString(),
      })
      .eq("id", presentation.id);

    if (requestError) {
      setError(requestError.message);
    } else {
      await loadPresentation();
      setNotice("Apresentacao arquivada.");
    }

    setArchiving(false);
  }

  async function copyPublicLink() {
    if (!presentation) return;

    await navigator.clipboard.writeText(`${origin}/a/${presentation.public_slug}`);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }

  function closePublicationModal() {
    if (saving) return;

    setActiveFormat(null);
    setForm(initialPublicationForm("post"));
    setFileInputKey((current) => current + 1);
  }

  if (loading) {
    return (
      <Card className={surfaceClass}>
        <CardContent className={cn("pt-5 text-sm", mutedTextClass)}>
          Carregando apresentacao...
        </CardContent>
      </Card>
    );
  }

  if (!presentation) {
    return (
      <Card className={surfaceClass}>
        <CardContent className={cn("pt-5 text-sm", mutedTextClass)}>
          {error || "Apresentacao nao encontrada."}
        </CardContent>
      </Card>
    );
  }

  const clientName = client?.name || "Cliente";
  const presentationPeriod = presentation.period_label || "Periodo nao definido";
  const presentationSubtitle = presentation.title?.includes(presentationPeriod)
    ? clientName
    : `${clientName} — ${presentationPeriod}`;

  return (
    <section className="space-y-6">
      <div className="sticky top-14 z-50 -mx-4 -mt-6 border-b border-border bg-background md:top-0 md:-mx-8 md:-mt-8">
        <div className="flex flex-col gap-2 px-3 py-4 md:px-5">
          <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex min-w-0 items-center gap-3 lg:flex-1">
              <Button
                asChild
                variant="ghostSecondary"
                size="icon"
                className="h-8 w-8 shrink-0 rounded-full"
                title="Voltar para cliente"
              >
                <Link href={`/admin/clientes/${presentation.client_id}`} aria-label="Voltar para cliente">
                  <ArrowLeft className="h-4 w-4" />
                  <span className="sr-only">Voltar para cliente</span>
                </Link>
              </Button>

              <div className="min-w-0 flex-1">
                <h1 className="truncate px-1 text-xl font-medium tracking-normal text-foreground md:text-2xl">
                  {presentation.title}
                </h1>
                <p className={cn("mt-0.5 truncate px-1 text-[11px]", mutedTextClass)}>
                  {presentationSubtitle}
                </p>
              </div>
            </div>

            <div className="flex w-full flex-wrap items-center justify-center gap-1.5 lg:w-auto lg:justify-end">
              <Button
                type="button"
                variant="ghostSecondary"
                size="sm"
                className="h-8 px-2.5 text-xs"
                onClick={copyPublicLink}
                aria-label="Copiar link publico"
                title="Copiar link publico"
              >
                <Clipboard className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">{copied ? "Copiado" : "Copiar link publico"}</span>
              </Button>
              <Button asChild variant="ghostSecondary" size="sm" className="h-8 px-2.5 text-xs">
                <Link href={`/a/${presentation.public_slug}`} target="_blank" rel="noreferrer" aria-label="Abrir publico" title="Abrir publico">
                  <ExternalLink className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Abrir publico</span>
                </Link>
              </Button>
              <Button
                type="button"
                variant="ghostSecondary"
                size="sm"
                className="h-8 px-2.5 text-xs"
                onClick={archivePresentation}
                disabled={archiving}
                aria-label="Arquivar"
                title="Arquivar"
              >
                <Archive className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">{archiving ? "Arquivando..." : "Arquivar"}</span>
              </Button>
            </div>
          </div>
        </div>
      </div>

      {error && !activeFormat ? (
        <Card className="border-rose-500/30 bg-rose-500/10">
          <CardContent className="pt-5 text-sm text-rose-100">{error}</CardContent>
        </Card>
      ) : null}

      {notice ? (
        <Card className="border-emerald-500/30 bg-emerald-500/10">
          <CardContent className="pt-5 text-sm text-emerald-100">{notice}</CardContent>
        </Card>
      ) : null}

      <div className="no-scrollbar flex gap-2 overflow-x-auto pb-1 md:flex-wrap md:overflow-visible">
        {publicationTypes.map((type) => {
          const isActive = activeFormat === type.format;

          return (
            <Button
              key={type.format}
              type="button"
              variant="default"
              className={cn(
                "h-9 shrink-0 gap-2 rounded-lg bg-[var(--zacx-brand)] px-3 text-xs font-medium text-white hover:opacity-90 dark:text-black sm:h-10 sm:px-4 sm:text-sm",
                isActive && "ring-2 ring-[var(--zacx-brand)] ring-offset-2 ring-offset-background",
              )}
              onClick={() => openForm(type.format)}
            >
              <Plus className="h-4 w-4" />
              {type.label}
            </Button>
          );
        })}
      </div>

      {activeFormat ? (
        <div
          className="fixed inset-0 z-[110] grid place-items-end bg-black/35 px-3 py-3 dark:bg-black/55 sm:place-items-center sm:px-4 sm:py-6"
          onClick={closePublicationModal}
        >
          <div
            className={cn("max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-2xl border p-4 sm:p-5", surfaceClass)}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-2xl font-medium text-foreground">
                  Criar {publicationLabel(activeFormat)}
                </h2>
              </div>
              <Button
                type="button"
                variant="ghostSecondary"
                size="icon"
                onClick={closePublicationModal}
                disabled={saving}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            <form className="mt-6 grid gap-5" onSubmit={handleAddPublication}>
              <div className="space-y-2">
                <Label>Dia da semana</Label>
                <WeekdayControl
                  value={form.weekday}
                  onChange={(weekday) => setForm((current) => ({ ...current, weekday }))}
                />
              </div>

              <div className="max-w-[160px] space-y-2">
                <div className="space-y-2">
                  <Label htmlFor="publicationDate">Data</Label>
                  <Input
                    id="publicationDate"
                    inputMode="numeric"
                    maxLength={5}
                    value={form.date}
                    className={error && getDayMonthInputError(form.date) ? "border-rose-500 focus-visible:ring-rose-500" : undefined}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        date: formatDateInput(event.target.value),
                      }))
                    }
                    placeholder="15/06"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <input
                  key={fileInputKey}
                  id="publicationImages"
                  type="file"
                  accept="image/*"
                  multiple={activeFormat !== "post"}
                  className="sr-only"
                  onChange={(event) => {
                    const files = Array.from(event.target.files ?? []);

                    setForm((current) => ({
                      ...current,
                      imageFiles: activeFormat === "post" ? files.slice(0, 1) : files,
                    }));
                  }}
                />
                <label
                  htmlFor="publicationImages"
                  className="inline-flex h-10 cursor-pointer items-center justify-center gap-2 rounded-md border border-border bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-secondary"
                >
                  <ImagePlus className="h-4 w-4" />
                  Subir imagens
                </label>
                <p className={cn("text-xs", mutedTextClass)}>
                  {activeFormat === "post"
                    ? "Post aceita apenas 1 imagem."
                    : "Selecione as imagens na ordem em que devem aparecer."}
                </p>
                {selectedImagePreviews.length ? (
                  <div className={cn("rounded-lg border p-3", nestedSurfaceClass)}>
                    <p className="mb-3 text-sm font-medium text-foreground">
                      {selectedImagePreviews.length} arquivo
                      {selectedImagePreviews.length > 1 ? "s" : ""} selecionado
                      {selectedImagePreviews.length > 1 ? "s" : ""}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {selectedImagePreviews.map((preview, index) => (
                        <div
                          key={preview.url}
                          className="group relative h-24 w-24 overflow-hidden rounded-md border border-border bg-card"
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={preview.url}
                            alt={preview.name}
                            className="h-full w-full object-cover"
                          />
                          <span className="absolute left-1.5 top-1.5 grid h-6 w-6 place-items-center rounded-md bg-black/70 text-xs font-medium text-white">
                            {index + 1}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>

              {error ? (
                <p className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-700 dark:text-rose-200">
                  {error}
                </p>
              ) : null}

              <div className="flex flex-wrap gap-3">
                <Button type="submit" disabled={saving}>
                  <ImagePlus className="h-4 w-4" />
                  {saving ? "Enviando..." : `Criar ${publicationLabel(activeFormat)}`}
                </Button>
                <Button
                  type="button"
                  variant="ghostSecondary"
                  onClick={closePublicationModal}
                  disabled={saving}
                >
                  Cancelar
                </Button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {editForm ? (
        <Card className={surfaceClass}>
          <CardHeader>
            <CardTitle>Editar publicacao</CardTitle>
            <CardDescription className={mutedTextClass}>
              Ajuste formato, dia da semana e data. As imagens atuais serao mantidas.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form className="grid gap-4" onSubmit={handleSaveEdit}>
              <div className="grid gap-4 md:grid-cols-[1fr_140px]">
                <div className="space-y-2">
                  <Label htmlFor="editFormat">Formato</Label>
                  <select
                    id="editFormat"
                    value={editForm.format}
                    onChange={(event) =>
                      setEditForm((current) =>
                        current
                          ? {
                              ...current,
                              format: event.target.value as VisualFormat,
                            }
                          : current,
                      )
                    }
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <option value="post">Post</option>
                    <option value="carousel">Carrossel</option>
                    <option value="stories">Stories</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="editDate">Data</Label>
                  <Input
                    id="editDate"
                    inputMode="numeric"
                    maxLength={5}
                    value={editForm.date}
                    className={error && getDayMonthInputError(editForm.date) ? "border-rose-500 focus-visible:ring-rose-500" : undefined}
                    onChange={(event) =>
                      setEditForm((current) =>
                        current
                          ? {
                              ...current,
                              date: formatDateInput(event.target.value),
                            }
                          : current,
                      )
                    }
                    placeholder="15/06"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Dia da semana</Label>
                <WeekdayControl
                  value={editForm.weekday}
                  onChange={(weekday) =>
                    setEditForm((current) =>
                      current
                        ? {
                            ...current,
                            weekday,
                          }
                        : current,
                    )
                  }
                />
              </div>
              <div className="flex flex-wrap gap-3">
                <Button type="submit" disabled={savingEdit}>
                  {savingEdit ? "Salvando..." : "Salvar edicao"}
                </Button>
                <Button type="button" variant="ghostSecondary" onClick={() => setEditForm(null)}>
                  Cancelar
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      ) : null}

      {items.length ? (
        <div className="grid gap-5 lg:grid-cols-2 2xl:grid-cols-3">
          {items.map((item) => (
            <VisualItemBoard
              key={item.id}
              items={[item]}
              client={client}
              onEdit={openEditForm}
              onDelete={deleteItem}
              deletingItemId={deletingItemId}
              theme={theme}
            />
          ))}
        </div>
      ) : (
        <Card className={surfaceClass}>
          <CardContent className={cn("pt-5 text-sm", mutedTextClass)}>
            Nenhuma publicacao visual criada ainda.
          </CardContent>
        </Card>
      )}
    </section>
  );
}
