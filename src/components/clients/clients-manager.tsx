"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { Loader2, Plus, X } from "lucide-react";

import { ClientAvatarInput } from "@/components/clients/client-avatar-input";
import { ClientCard } from "@/components/clients/client-card";
import { ColorDotInput } from "@/components/clients/color-dot-input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { optimizeImage } from "@/lib/image-optimizer";
import { supabase } from "@/lib/supabase/client";
import type { Client } from "@/lib/supabase/types";

const initialForm = {
  name: "",
  primaryColor: "#A3E635",
  secondaryColor: "#60A5FA",
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

export function ClientsManager() {
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

  async function loadClients() {
    setLoading(true);
    setError(null);

    const { data, error: requestError } = await supabase
      .from("clients")
      .select("*")
      .order("created_at", { ascending: false });

    if (requestError) {
      setError(requestError.message);
    } else {
      setClients(data ?? []);
    }

    setLoading(false);
  }

  useEffect(() => {
    loadClients();
  }, []);

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

  function openModal() {
    setForm(initialForm);
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
      const { error: requestError } = await supabase.from("clients").insert({
        name: form.name.trim(),
        slug,
        logo_url: logoUrl,
        primary_color: form.primaryColor || "#E5E7EB",
        secondary_color: form.secondaryColor || form.primaryColor || "#E5E7EB",
      });

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

  return (
    <section className="space-y-6 md:space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm text-muted-foreground">Clientes</p>
          <h1 className="mt-2 text-2xl font-medium text-foreground md:text-4xl">
            Biblioteca de clientes
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground md:mt-3">
            Perfis de clientes com planejamentos mensais e apresentacoes visuais separados.
          </p>
        </div>
        <Button
          id="novo-cliente"
          type="button"
          onClick={openModal}
          className="hidden h-11 rounded-lg bg-[var(--zacx-brand)] px-5 text-sm font-medium text-white hover:opacity-90 dark:text-black md:inline-flex"
        >
          <Plus className="h-4 w-4" />
          Adicionar cliente
        </Button>
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

      {success ? (
        <Card className="border-emerald-500/30 bg-emerald-500/10">
          <CardContent className="pt-5 text-sm text-emerald-100">{success}</CardContent>
        </Card>
      ) : null}

      {!modalOpen && error ? (
        <Card className="border-rose-500/30 bg-rose-500/10">
          <CardContent className="pt-5 text-sm text-rose-100">{error}</CardContent>
        </Card>
      ) : null}

      {loading ? (
        <Card>
          <CardContent className="flex items-center gap-3 pt-5 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Carregando clientes...
          </CardContent>
        </Card>
      ) : clients.length ? (
        <div className="grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-3 xl:grid-cols-4">
          {clients.map((client) => (
            <ClientCard key={client.id} client={client} />
          ))}
        </div>
      ) : (
        <Card className="border-dashed">
          <CardContent className="pt-5 text-sm text-muted-foreground">
            Nenhum cliente cadastrado ainda. Crie o primeiro perfil para comecar.
          </CardContent>
        </Card>
      )}

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
                <h2 className="mt-1 text-2xl font-medium text-foreground">Criar cliente</h2>
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
