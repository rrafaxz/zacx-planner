"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Archive, ArrowLeft, Clipboard, ExternalLink, Save } from "lucide-react";

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
} from "@/components/copy-plannings/copy-document";
import { PlanningVisualBoard } from "@/components/copy-plannings/planning-visual-board";
import type {
  PlanningVisualSectionKey,
  PlanningVisualSections,
} from "@/components/copy-plannings/planning-visual-parser";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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

export function CopyPlanningEditor({ planningId }: CopyPlanningEditorProps) {
  const [planning, setPlanning] = useState<CopyPlanning | null>(null);
  const [client, setClient] = useState<Client | null>(null);
  const [sections, setSections] = useState<CopyDocumentSections>({ ...emptyCopySections });
  const [activeSection, setActiveSection] = useState<CopySectionKey>("posts");
  const [titleDraft, setTitleDraft] = useState("");
  const [origin, setOrigin] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingTitle, setSavingTitle] = useState(false);
  const [archiving, setArchiving] = useState(false);
  const [confirmArchiveOpen, setConfirmArchiveOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

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

      setPlanning(planningData);
      setTitleDraft(planningData.title || "");
      setClient(clientData);
      setSections({
        posts: cleanCopySectionHtml("posts", planningWithSections.posts_content ?? legacySections.posts, clientData?.name),
        carousels: cleanCopySectionHtml("carousels", planningWithSections.carousels_content ?? legacySections.carousels, clientData?.name),
        stories: cleanCopySectionHtml("stories", planningWithSections.stories_content ?? legacySections.stories, clientData?.name),
        videos: cleanCopySectionHtml("videos", planningWithSections.videos_content ?? legacySections.videos, clientData?.name),
      });
    }

    setLoading(false);
  }

  useEffect(() => {
    setOrigin(window.location.origin);
    loadPlanning();
  }, [planningId]);

  async function saveContent() {
    if (!planning) return;

    setSaving(true);
    setError(null);
    setNotice(null);

    const activeField = copySectionFieldMap[activeSection];
    const activeContent = cleanCopySectionHtml(activeSection, sections[activeSection], client?.name);
    const { error: requestError } = await supabase
      .from("copy_plannings")
      .update({
        [activeField]: activeContent,
      } as never)
      .eq("id", planning.id);

    if (requestError) {
      setError(requestError.message);
    } else {
      setPlanning({
        ...planning,
        [activeField]: activeContent,
      } as CopyPlanningWithSectionFields);
      setSections((currentSections) => ({
        ...currentSections,
        [activeSection]: activeContent,
      }));
      const activeLabel =
        copySectionMeta.find((section) => section.key === activeSection)?.label || "Seção";
      setNotice(`${activeLabel} salvo.`);
    }

    setSaving(false);
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

    const sectionField = copySectionFieldMap[changedSection];
    const nextContent = cleanCopySectionHtml(changedSection, nextSections[changedSection], client?.name);

    setSaving(true);
    setError(null);
    setNotice(null);

    const { error: requestError } = await supabase
      .from("copy_plannings")
      .update({
        [sectionField]: nextContent,
      } as never)
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
    setPlanning({
      ...planning,
      [sectionField]: nextContent,
    } as CopyPlanningWithSectionFields);
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
    <section className="planning-editor-shell relative -my-6 min-h-screen [--planning-header-height:126px] [--planning-header-offset:3.5rem] [--planning-side-nav-top:calc(var(--planning-header-offset)_+_var(--planning-header-height)_+_var(--planning-toolbar-height)_+_12px)] [--planning-toolbar-height:58px] md:-my-8 lg:[--planning-header-height:77px] lg:[--planning-header-offset:0px]">
      <Tabs defaultValue="visual" className="min-h-screen">
        <div className="sticky top-14 z-50 border-b border-border bg-background md:top-0">
          <div className="flex min-h-[var(--planning-header-height)] flex-col justify-center gap-2 px-3 py-3 md:px-5 lg:py-0">
            <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex min-w-0 items-center gap-3 lg:flex-1">
                <Button
                  asChild
                  variant="ghostSecondary"
                  size="icon"
                  className="h-8 w-8 shrink-0 rounded-full"
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
                    className="sora-heading block w-full max-w-[560px] truncate rounded-md border border-transparent bg-transparent px-1 py-0.5 text-xl font-medium tracking-normal text-foreground outline-none transition hover:border-border focus:border-foreground/30 md:text-2xl"
                  />
                  <p className="mt-0.5 truncate px-1 text-[11px] text-muted-foreground">
                    {client?.name || "Cliente"} — {planning.period_label || "Periodo nao definido"}
                  </p>
                </div>
              </div>

              <div className="flex w-full flex-wrap items-center justify-center gap-1.5 lg:w-auto lg:justify-end">
                <TabsList className="h-9 shrink-0 rounded-md border border-border bg-background p-0.5 lg:h-8">
                  <TabsTrigger value="visual" className="h-8 px-3 py-1 text-xs lg:h-7 lg:px-2.5">
                    Visual
                  </TabsTrigger>
                  <TabsTrigger value="documento" className="h-8 px-3 py-1 text-xs lg:h-7 lg:px-2.5">
                    Documento
                  </TabsTrigger>
                </TabsList>
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
                  <Link href={`/p/${planning.public_slug}`} target="_blank" rel="noreferrer" aria-label="Abrir publico" title="Abrir publico">
                    <ExternalLink className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">Abrir publico</span>
                  </Link>
                </Button>
                <Button
                  type="button"
                  variant="ghostSecondary"
                  size="sm"
                  className="h-8 px-2.5 text-xs"
                  onClick={() => setConfirmArchiveOpen(true)}
                  disabled={archiving}
                  aria-label="Arquivar"
                  title="Arquivar"
                >
                  <Archive className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">{archiving ? "Arquivando..." : "Arquivar"}</span>
                </Button>
                <Button onClick={saveContent} disabled={saving} size="sm" className="h-8 px-3 text-xs" aria-label="Salvar" title="Salvar">
                  <Save className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">{saving ? "Salvando..." : "Salvar"}</span>
                </Button>
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
            toolbarClassName="!top-[calc(var(--planning-header-offset)_+_var(--planning-header-height))] z-40 mb-0 rounded-none border-x-0 border-t-0 border-b border-border px-3 py-2 shadow-none md:px-5"
            sectionNavigationClassName="lg:!top-[var(--planning-side-nav-top)]"
            sectionNavigation={
              <nav className="no-scrollbar flex gap-1 overflow-x-auto border-y border-border bg-background p-2 lg:min-h-[calc(68vh+5rem)] lg:flex-col lg:overflow-visible lg:rounded-xl lg:border lg:p-3.5">
                {copySectionMeta.map((section) => {
                  const isActive = activeSection === section.key;

                  return (
                    <button
                      key={section.key}
                      type="button"
                      onClick={() => setActiveSection(section.key)}
                      className={cn(
                        "min-w-max rounded-lg px-3 py-2.5 text-left text-sm font-medium transition-colors lg:min-w-0 lg:px-4 lg:py-3.5",
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
          width: 100vw;
          margin-left: calc(50% - 50vw);
          margin-right: calc(50% - 50vw);
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
