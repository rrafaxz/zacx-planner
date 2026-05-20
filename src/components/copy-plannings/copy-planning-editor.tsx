"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Archive, ArrowLeft, CheckCircle2, Clipboard, ExternalLink, Loader2 } from "lucide-react";

import {
  CopyDocument,
  type CopySectionKey,
  type CopyDocumentSections,
  cleanCopySectionHtml,
  copySectionFieldMap,
  copySectionMeta,
  emptyCopySections,
  hasSectionContent,
  parseCopyDocumentContent,
  serializeCopyDocumentSections,
} from "@/components/copy-plannings/copy-document";
import { PlanningVisualBoard } from "@/components/copy-plannings/planning-visual-board";
import type {
  PlanningVisualSectionKey,
  PlanningVisualSections,
} from "@/components/copy-plannings/planning-visual-parser";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { optimizeImage } from "@/lib/image-optimizer";
import { supabase } from "@/lib/supabase/client";
import type { Client, CopyPlanning } from "@/lib/supabase/types";
import { cn } from "@/lib/utils";

type CopyPlanningEditorProps = {
  planningId: string;
};

type CopyPlanningWithSectionFields = CopyPlanning & {
  posts_content?: string | null;
  carousels_content?: string | null;
  stories_content?: string | null;
  videos_content?: string | null;
};

type AutosaveStatus = "idle" | "pending" | "saving" | "saved" | "error";

function safeStorageFileName(fileName: string) {
  const name = fileName.split(/[/\\]/).pop() || "asset";

  return name.replace(/[^a-zA-Z0-9._-]/g, "-") || "asset";
}

function sectionHtmlFromStoredContent(
  sectionKey: CopySectionKey,
  legacySections: CopyDocumentSections,
  fieldContent?: string | null,
) {
  const documentSectionContent = legacySections[sectionKey];

  return hasSectionContent(documentSectionContent) ? documentSectionContent : fieldContent ?? documentSectionContent;
}

function normalizeSectionsForSave(sections: CopyDocumentSections, clientName?: string | null) {
  return copySectionMeta.reduce<CopyDocumentSections>((currentSections, section) => {
    currentSections[section.key] = cleanCopySectionHtml(section.key, sections[section.key], clientName || undefined);
    return currentSections;
  }, { ...emptyCopySections });
}

export function CopyPlanningEditor({ planningId }: CopyPlanningEditorProps) {
  const [planning, setPlanning] = useState<CopyPlanning | null>(null);
  const [client, setClient] = useState<Client | null>(null);
  const [sections, setSections] = useState<CopyDocumentSections>({ ...emptyCopySections });
  const [activeSection, setActiveSection] = useState<CopySectionKey>("posts");
  const [titleDraft, setTitleDraft] = useState("");
  const [origin, setOrigin] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [autosaveStatus, setAutosaveStatus] = useState<AutosaveStatus>("idle");
  const [savingTitle, setSavingTitle] = useState(false);
  const [archiving, setArchiving] = useState(false);
  const [confirmArchiveOpen, setConfirmArchiveOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const initialLoadCompleteRef = useRef(false);
  const lastSavedSectionsRef = useRef<CopyDocumentSections>({ ...emptyCopySections });

  async function loadPlanning() {
    setLoading(true);
    setError(null);

    const { data: planningData, error: planningError } = await supabase
      .from("copy_plannings")
      .select("*")
      .eq("id", planningId)
      .maybeSingle();

    if (planningError || !planningData) {
      setError(planningError?.message || "Planejamento nao encontrado.");
      setPlanning(null);
      setLoading(false);
      return;
    }

    const { data: clientData, error: clientError } = await supabase
      .from("clients")
      .select("*")
      .eq("id", planningData.client_id)
      .maybeSingle();

    if (clientError) {
      setError(clientError.message);
    } else {
      const planningWithSections = planningData as CopyPlanningWithSectionFields;
      const legacySections = parseCopyDocumentContent(planningWithSections.document_content);

      const nextSections = {
        posts: cleanCopySectionHtml("posts", sectionHtmlFromStoredContent("posts", legacySections, planningWithSections.posts_content), clientData?.name),
        carousels: cleanCopySectionHtml("carousels", sectionHtmlFromStoredContent("carousels", legacySections, planningWithSections.carousels_content), clientData?.name),
        stories: cleanCopySectionHtml("stories", sectionHtmlFromStoredContent("stories", legacySections, planningWithSections.stories_content), clientData?.name),
        videos: cleanCopySectionHtml("videos", sectionHtmlFromStoredContent("videos", legacySections, planningWithSections.videos_content), clientData?.name),
        photos: cleanCopySectionHtml("photos", legacySections.photos, clientData?.name),
        paidTraffic: cleanCopySectionHtml("paidTraffic", legacySections.paidTraffic, clientData?.name),
      };

      setPlanning(planningData);
      setTitleDraft(planningData.title || "");
      setClient(clientData);
      setSections(nextSections);
      lastSavedSectionsRef.current = nextSections;
      initialLoadCompleteRef.current = true;
      setAutosaveStatus("saved");
    }

    setLoading(false);
  }

  useEffect(() => {
    setOrigin(window.location.origin);
    loadPlanning();
  }, [planningId]);

  useEffect(() => {
    if (!confirmArchiveOpen || typeof window === "undefined") {
      return;
    }

    const scrollY = window.scrollY;
    const { style } = document.body;
    const originalPosition = style.position;
    const originalTop = style.top;
    const originalLeft = style.left;
    const originalRight = style.right;
    const originalWidth = style.width;
    const originalOverflow = style.overflow;

    style.position = "fixed";
    style.top = `-${scrollY}px`;
    style.left = "0";
    style.right = "0";
    style.width = "100%";
    style.overflow = "hidden";

    return () => {
      style.position = originalPosition;
      style.top = originalTop;
      style.left = originalLeft;
      style.right = originalRight;
      style.width = originalWidth;
      style.overflow = originalOverflow;
      window.scrollTo(0, scrollY);
    };
  }, [confirmArchiveOpen]);

  const saveDocumentSections = useCallback(async (
    nextSections: CopyDocumentSections,
    showNotice = false,
    noticeMessage = "Documento salvo.",
  ) => {
    if (!planning) return;

    setSaving(true);
    setAutosaveStatus("saving");
    setError(null);
    if (showNotice) setNotice(null);

    const requestedSectionsSnapshot = serializeCopyDocumentSections(nextSections);
    const nextSavedSections = normalizeSectionsForSave(nextSections, client?.name);
    const serializedSections = serializeCopyDocumentSections(nextSavedSections);
    const { error: requestError } = await supabase
      .from("copy_plannings")
      .update({ document_content: serializedSections } as never)
      .eq("id", planning.id);

    if (requestError) {
      setError(requestError.message);
      setAutosaveStatus("error");
    } else {
      setPlanning({
        ...planning,
        document_content: serializedSections,
      } as CopyPlanningWithSectionFields);
      setSections((currentSections) =>
        serializeCopyDocumentSections(currentSections) === requestedSectionsSnapshot ? nextSavedSections : currentSections,
      );
      lastSavedSectionsRef.current = nextSavedSections;
      if (showNotice) setNotice(noticeMessage);
      setAutosaveStatus("saved");
    }

    setSaving(false);
  }, [client?.name, planning]);

  useEffect(() => {
    if (!planning || !initialLoadCompleteRef.current) return;

    const hasUnsavedSections = copySectionMeta.some(
      (section) => (sections[section.key] || "") !== (lastSavedSectionsRef.current[section.key] || ""),
    );

    if (!hasUnsavedSections) {
      return;
    }

    setAutosaveStatus("pending");
    const timeout = window.setTimeout(() => {
      void saveDocumentSections(sections);
    }, 1100);

    return () => window.clearTimeout(timeout);
  }, [planning, saveDocumentSections, sections]);

  async function uploadPlanningAsset(file: File) {
    if (!planning) return null;

    const optimizedFile = await optimizeImage(file, "post");
    const storagePath = `plannings/${planning.id}/${Date.now()}-${safeStorageFileName(optimizedFile.name)}`;
    const { error: uploadError } = await supabase.storage
      .from("planning-assets")
      .upload(storagePath, optimizedFile, {
        contentType: optimizedFile.type || undefined,
        upsert: false,
      });

    if (uploadError) {
      setError(uploadError.message);
      return null;
    }

    const {
      data: { publicUrl },
    } = supabase.storage.from("planning-assets").getPublicUrl(storagePath);

    return publicUrl;
  }

  async function saveTitle() {
    if (!planning) return;

    const nextTitle = titleDraft.trim();

    if (!nextTitle) {
      setTitleDraft(planning.title);
      return;
    }

    if (nextTitle === planning.title) {
      return;
    }

    setSavingTitle(true);
    setError(null);

    const { error: requestError } = await supabase
      .from("copy_plannings")
      .update({ title: nextTitle })
      .eq("id", planning.id);

    if (requestError) {
      setError(requestError.message);
      setTitleDraft(planning.title);
    } else {
      setPlanning({ ...planning, title: nextTitle });
    }

    setSavingTitle(false);
  }

  async function saveVisualSections(
    nextSections: PlanningVisualSections,
    changedSection: PlanningVisualSectionKey,
  ) {
    if (!planning) return;

    const nextContent = cleanCopySectionHtml(changedSection, nextSections[changedSection], client?.name);
    const sectionField = copySectionFieldMap[changedSection];
    const nextSavedSections = {
      ...lastSavedSectionsRef.current,
      [changedSection]: nextContent,
    };
    const updatePayload = sectionField
      ? { [sectionField]: nextContent }
      : { document_content: serializeCopyDocumentSections(nextSavedSections) };

    setSaving(true);
    setAutosaveStatus("saving");
    setError(null);
    setNotice(null);

    const { error: requestError } = await supabase
      .from("copy_plannings")
      .update(updatePayload as never)
      .eq("id", planning.id);

    setSaving(false);

    if (requestError) {
      setError(requestError.message);
      throw new Error(requestError.message);
    }

    setSections({
      ...nextSections,
      [changedSection]: nextContent,
    });
    setPlanning(
      (sectionField
        ? { ...planning, [sectionField]: nextContent }
        : { ...planning, document_content: serializeCopyDocumentSections(nextSavedSections) }) as CopyPlanningWithSectionFields,
    );
    lastSavedSectionsRef.current = nextSavedSections;
    setAutosaveStatus("saved");
    setNotice("Card salvo no documento original.");
  }

  async function archivePlanning() {
    if (!planning) return;

    setArchiving(true);
    setError(null);
    setNotice(null);

    const { error: requestError } = await supabase
      .from("copy_plannings")
      .update({
        archived_at: new Date().toISOString(),
      })
      .eq("id", planning.id);

    if (requestError) {
      setError(requestError.message);
    } else {
      setNotice("Planejamento arquivado.");
      await loadPlanning();
    }

    setArchiving(false);
  }

  async function copyPublicLink() {
    if (!planning) return;

    await navigator.clipboard.writeText(`${origin}/p/${planning.public_slug}`);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="pt-5 text-sm text-muted-foreground">
          Carregando planejamento...
        </CardContent>
      </Card>
    );
  }

  if (!planning) {
    return (
      <section className="space-y-4">
        <Button asChild variant="ghostSecondary">
          <Link href="/admin/clientes">
            <ArrowLeft className="h-4 w-4" />
            Voltar
          </Link>
        </Button>
        <Card>
          <CardContent className="pt-5 text-sm text-muted-foreground">
            {error || "Planejamento nao encontrado."}
          </CardContent>
        </Card>
      </section>
    );
  }

  return (
    <section className="planning-editor-shell relative -my-4 min-h-screen [--planning-header-height:70px] [--planning-header-offset:3.5rem] [--planning-side-nav-top:calc(var(--planning-header-offset)_+_var(--planning-header-height)_+_var(--planning-toolbar-height)_+_12px)] [--planning-sticky-header-height:96px] [--planning-toolbar-height:52px] sm:-my-6 md:-my-8 md:[--planning-header-height:110px] md:[--planning-toolbar-height:58px] lg:[--planning-header-height:77px] lg:[--planning-header-offset:0px]">
      <Tabs defaultValue="visual" className="min-h-screen">
        <div className="sticky top-14 z-[90] border-b border-border bg-background md:top-0 md:z-50">
          <div className="flex min-h-[var(--planning-header-height)] flex-col justify-center gap-1 px-0 py-2 md:gap-2 md:px-5 md:py-3 lg:py-0">
            <div className="flex min-w-0 flex-col gap-1.5 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex min-w-0 items-center gap-2 lg:flex-1">
                <Button
                  asChild
                  variant="ghostSecondary"
                  size="icon"
                  className="h-7 w-7 shrink-0 rounded-full md:h-8 md:w-8"
                  title="Voltar para cliente"
                >
                  <Link href={`/admin/clientes/${planning.client_id}`} aria-label="Voltar para cliente">
                    <ArrowLeft className="h-4 w-4" />
                    <span className="sr-only">Voltar para cliente</span>
                  </Link>
                </Button>

                <div className="min-w-0 flex-1">
                  <input
                    aria-label="Titulo do planejamento"
                    value={titleDraft}
                    disabled={savingTitle}
                    onChange={(event) => setTitleDraft(event.target.value)}
                    onBlur={saveTitle}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault();
                        event.currentTarget.blur();
                      }

                      if (event.key === "Escape") {
                        setTitleDraft(planning.title);
                        event.currentTarget.blur();
                      }
                    }}
                    className="sora-heading block w-full max-w-[560px] truncate rounded-md border border-transparent bg-transparent px-1 py-0 text-base font-medium tracking-normal text-foreground outline-none transition hover:border-border focus:border-foreground/30 md:py-0.5 md:text-2xl"
                  />
                  <p className="truncate px-1 text-[10px] leading-4 text-muted-foreground md:mt-0.5 md:text-[11px]">
                    {client?.name || "Cliente"} — {planning.period_label || "Periodo nao definido"}
                  </p>
                </div>
              </div>

              <div className="no-scrollbar flex w-full min-w-0 flex-nowrap items-center justify-start gap-1 overflow-x-auto lg:w-auto lg:justify-end">
                <TabsList className="h-8 shrink-0 rounded-md border border-border bg-background p-0.5 lg:h-8">
                  <TabsTrigger value="visual" className="h-7 px-2.5 py-1 text-[11px] lg:h-7 lg:text-xs">
                    Visual
                  </TabsTrigger>
                  <TabsTrigger value="documento" className="h-7 px-2.5 py-1 text-[11px] lg:h-7 lg:text-xs">
                    Documento
                  </TabsTrigger>
                </TabsList>
                <Button
                  type="button"
                  variant="ghostSecondary"
                  size="sm"
                  className="h-8 shrink-0 px-2 text-xs md:px-2.5"
                  onClick={copyPublicLink}
                  aria-label="Copiar link publico"
                  title="Copiar link publico"
                >
                  <Clipboard className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">{copied ? "Copiado" : "Copiar link publico"}</span>
                </Button>
                <Button asChild variant="ghostSecondary" size="sm" className="h-8 shrink-0 px-2 text-xs md:px-2.5">
                  <Link href={`/p/${planning.public_slug}`} target="_blank" rel="noreferrer" aria-label="Abrir publico" title="Abrir publico">
                    <ExternalLink className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">Abrir publico</span>
                  </Link>
                </Button>
                <Button
                  type="button"
                  variant="ghostSecondary"
                  size="sm"
                  className="h-8 shrink-0 px-2 text-xs md:px-2.5"
                  onClick={() => setConfirmArchiveOpen(true)}
                  disabled={archiving}
                  aria-label="Arquivar"
                  title="Arquivar"
                >
                  <Archive className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">{archiving ? "Arquivando..." : "Arquivar"}</span>
                </Button>
                <div className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-md border border-border bg-background px-2 text-[11px] text-muted-foreground md:px-2.5 md:text-xs">
                  {autosaveStatus === "saving" || autosaveStatus === "pending" ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : autosaveStatus === "saved" ? (
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                  ) : null}
                  <span className="hidden sm:inline">
                    {autosaveStatus === "saving" || autosaveStatus === "pending"
                      ? "Salvando..."
                      : autosaveStatus === "error"
                        ? "Erro ao salvar"
                        : "Salvo"}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {error || notice ? (
          <div className="space-y-2 px-4 py-3 md:px-6">
            {error ? (
              <Card className="border-rose-600 bg-rose-600 text-white">
                <CardContent className="pt-5 text-sm font-medium">{error}</CardContent>
              </Card>
            ) : null}

            {notice ? (
              <Card className="border-emerald-600 bg-emerald-600 text-white">
                <CardContent className="pt-5 text-sm font-medium">{notice}</CardContent>
              </Card>
            ) : null}
          </div>
        ) : null}

        <TabsContent value="visual" className="mt-0 px-4 py-4 md:px-5">
          <PlanningVisualBoard
            sections={sections}
            clientColor={client?.primary_color}
            clientSecondaryColor={client?.secondary_color}
            editable
            onSectionsChange={saveVisualSections}
          />
        </TabsContent>

        <TabsContent value="documento" className="mt-0">
          <CopyDocument
            value={sections}
            onChange={setSections}
            editable
            activeSection={activeSection}
            clientName={client?.name}
            emptyText="Cole ou escreva o conteudo desta secao."
            workspaceLayout
            toolbarClassName="z-[80] !top-[calc(3.5rem+var(--planning-sticky-header-height))] mb-0 min-h-[var(--planning-toolbar-height)] rounded-none border-x-0 border-t-0 border-b border-border px-2 py-1.5 shadow-none md:z-40 md:!top-[calc(var(--planning-header-offset)_+_var(--planning-header-height))] md:px-5 md:py-2"
            sectionNavigationClassName="lg:!top-[var(--planning-side-nav-top)]"
            onImageUpload={uploadPlanningAsset}
            sectionNavigation={
              <nav className="grid w-full max-w-full min-w-0 grid-cols-3 gap-1.5 overflow-hidden border-y border-border bg-background p-2 lg:min-h-[calc(68vh+5rem)] lg:flex lg:flex-col lg:overflow-visible lg:rounded-xl lg:border lg:p-3.5">
                {copySectionMeta.map((section) => {
                  const isActive = activeSection === section.key;

                  return (
                    <button
                      key={section.key}
                      type="button"
                      onClick={() => setActiveSection(section.key)}
                      className={cn(
                        "min-w-0 rounded-lg px-1.5 py-2 text-center text-[10px] font-medium leading-tight transition-colors sm:text-xs lg:px-4 lg:py-3.5 lg:text-left lg:text-sm",
                        isActive
                          ? "bg-foreground text-background"
                          : "text-muted-foreground hover:bg-foreground/[0.06] hover:text-foreground",
                      )}
                    >
                      {section.label}
                    </button>
                  );
                })}
              </nav>
            }
          />
        </TabsContent>
	      </Tabs>
	      {confirmArchiveOpen ? (
	        <div
	          className="fixed inset-0 z-[120] grid place-items-center bg-black/40 px-4"
	          onClick={() => {
	            if (!archiving) setConfirmArchiveOpen(false);
	          }}
	        >
	          <div
	            className="w-full max-w-md rounded-2xl border border-border bg-background p-5 shadow-none"
	            onClick={(event) => event.stopPropagation()}
	          >
	            <h2 className="sora-heading text-xl font-medium text-foreground">Arquivar planejamento</h2>
	            <p className="mt-3 text-sm leading-6 text-muted-foreground">
	              Você tem certeza que quer arquivar este item? Ele sairá da lista principal e ficará disponível em Arquivados.
	            </p>
	            <div className="mt-6 flex justify-end gap-3">
	              <Button
	                type="button"
	                variant="ghostSecondary"
	                onClick={() => setConfirmArchiveOpen(false)}
	                disabled={archiving}
	              >
	                Cancelar
	              </Button>
	              <Button
	                type="button"
	                onClick={async () => {
	                  await archivePlanning();
	                  setConfirmArchiveOpen(false);
	                }}
	                disabled={archiving}
	                className="bg-[var(--zacx-brand)] text-white hover:opacity-90 dark:text-black"
	              >
	                {archiving ? "Arquivando..." : "Arquivar"}
	              </Button>
	            </div>
	          </div>
	        </div>
	      ) : null}
	      <style jsx global>{`
          .planning-editor-shell {
            width: 100%;
            max-width: 100%;
            margin-left: 0;
            margin-right: 0;
            box-sizing: border-box;
          }

        @media (min-width: 768px) {
          .planning-editor-shell {
            width: calc(100vw - 18rem);
            margin-left: calc(50% - ((100vw - 18rem) / 2));
            margin-right: calc(50% - ((100vw - 18rem) / 2));
          }
        }

      `}</style>
    </section>
  );
}
