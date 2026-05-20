"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2 } from "lucide-react";

import {
  CopyDocument,
  type CopySectionKey,
  type CopyDocumentSections,
  cleanCopySectionHtml,
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
import { PublicClientHeading } from "@/components/public-view/public-client-heading";
import { PublicHeader } from "@/components/public-view/public-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/lib/supabase/client";
import type { Client, CopyPlanning } from "@/lib/supabase/types";
import { cn } from "@/lib/utils";

type PublicCopyPlanningViewProps = {
  slug: string;
};

type CopyPlanningWithSectionFields = CopyPlanning & {
  posts_content?: string | null;
  carousels_content?: string | null;
  stories_content?: string | null;
  videos_content?: string | null;
};

function sectionHtmlFromStoredContent(
  sectionKey: CopySectionKey,
  legacySections: CopyDocumentSections,
  fieldContent?: string | null,
) {
  const documentSectionContent = legacySections[sectionKey];

  return hasSectionContent(documentSectionContent) ? documentSectionContent : fieldContent ?? documentSectionContent;
}

function NotFoundState() {
  return (
    <main className="min-h-screen bg-background px-4 py-8 text-foreground">
      <div className="mx-auto flex min-h-[70vh] max-w-2xl items-center">
        <Card className="w-full">
          <CardHeader>
            <CardTitle>Planejamento nao encontrado</CardTitle>
            <CardDescription>
              O link pode ter sido alterado ou removido. Solicite um novo link para a equipe Zacx.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    </main>
  );
}

export function PublicCopyPlanningView({ slug }: PublicCopyPlanningViewProps) {
  const [planning, setPlanning] = useState<CopyPlanningWithSectionFields | null>(null);
  const [client, setClient] = useState<Client | null>(null);
  const [sections, setSections] = useState<CopyDocumentSections>({ ...emptyCopySections });
  const [activeSection, setActiveSection] = useState<CopySectionKey>("posts");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function loadPlanning() {
    setLoading(true);
    setError(null);

    const { data: planningData, error: planningError } = await supabase
      .from("copy_plannings")
      .select("*")
      .eq("public_slug", slug)
      .eq("is_public", true)
      .maybeSingle();

    if (planningError || !planningData) {
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

      setPlanning(planningWithSections);
      setClient(clientData);
      setSections({
        posts: cleanCopySectionHtml("posts", sectionHtmlFromStoredContent("posts", legacySections, planningWithSections.posts_content), clientData?.name),
        carousels: cleanCopySectionHtml("carousels", sectionHtmlFromStoredContent("carousels", legacySections, planningWithSections.carousels_content), clientData?.name),
        stories: cleanCopySectionHtml("stories", sectionHtmlFromStoredContent("stories", legacySections, planningWithSections.stories_content), clientData?.name),
        videos: cleanCopySectionHtml("videos", sectionHtmlFromStoredContent("videos", legacySections, planningWithSections.videos_content), clientData?.name),
        photos: cleanCopySectionHtml("photos", legacySections.photos, clientData?.name),
        paidTraffic: cleanCopySectionHtml("paidTraffic", legacySections.paidTraffic, clientData?.name),
      });
    }

    setLoading(false);
  }

  useEffect(() => {
    loadPlanning();
  }, [slug]);

  async function savePublicVisualSections(
    nextSections: PlanningVisualSections,
    changedSection: PlanningVisualSectionKey,
  ) {
    if (!planning) return;

    const nextContent = cleanCopySectionHtml(changedSection, nextSections[changedSection], client?.name);
    const mergedSections: CopyDocumentSections = {
      ...sections,
      ...nextSections,
      [changedSection]: nextContent,
    };
    const serializedSections = serializeCopyDocumentSections(mergedSections);
    const { error: requestError } = await supabase
      .from("copy_plannings")
      .update({ document_content: serializedSections } as never)
      .eq("id", planning.id)
      .eq("public_slug", slug)
      .eq("is_public", true);

    if (requestError) {
      throw new Error(requestError.message);
    }

    setSections(mergedSections);
    setPlanning({
      ...planning,
      document_content: serializedSections,
    });
  }

  const visibleSectionKeys = useMemo(
    () =>
      copySectionMeta
        .filter((section) => hasSectionContent(sections[section.key]))
        .map((section) => section.key),
    [sections],
  );
  const activeVisibleSection = visibleSectionKeys.includes(activeSection)
    ? activeSection
    : visibleSectionKeys[0];

  useEffect(() => {
    if (!visibleSectionKeys.length || visibleSectionKeys.includes(activeSection)) {
      return;
    }

    setActiveSection(visibleSectionKeys[0]);
  }, [activeSection, visibleSectionKeys]);

  if (loading) {
    return (
      <main className="grid min-h-screen place-items-center bg-background px-4 text-foreground">
        <div className="flex items-center gap-3 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Carregando planejamento...
        </div>
      </main>
    );
  }

  if (!planning) {
    return <NotFoundState />;
  }

  return (
    <main className="min-h-screen bg-background text-foreground">
      <PublicHeader type="planning" />

      <section className="mx-auto w-full max-w-5xl px-4 pb-8 pt-5 md:pb-10 md:pt-6">
        <PublicClientHeading
          client={client}
          title={planning.title}
          periodLabel={planning.period_label}
        />

        {error ? (
          <Card className="mt-5 border-rose-500/30 bg-rose-500/10">
            <CardContent className="pt-5 text-sm text-rose-100">{error}</CardContent>
          </Card>
        ) : null}

        <Tabs defaultValue="visual" className="mt-5 space-y-5 md:mt-6 md:space-y-6">
          <TabsList className="h-9 w-full justify-start overflow-x-auto sm:w-auto">
            <TabsTrigger value="visual" className="h-8 px-3 text-xs sm:text-sm">Visual</TabsTrigger>
            <TabsTrigger value="documento" className="h-8 px-3 text-xs sm:text-sm">Documento</TabsTrigger>
          </TabsList>

          <TabsContent value="visual">
            <PlanningVisualBoard
              sections={sections}
              clientColor={client?.primary_color}
              clientSecondaryColor={client?.secondary_color}
              editable
              onSectionsChange={savePublicVisualSections}
            />
          </TabsContent>

          <TabsContent value="documento" className="mt-0">
            <CopyDocument
              value={sections}
              editable={false}
              sectionKeys={activeVisibleSection ? [activeVisibleSection] : []}
              clientName={client?.name}
              workspaceLayout
              sectionNavigationClassName="lg:!top-6 lg:-ml-5"
              sectionNavigation={
                visibleSectionKeys.length ? (
                  <nav className="grid w-full max-w-full min-w-0 grid-cols-3 gap-1.5 overflow-hidden border-y border-border bg-background p-2 lg:w-[210px] lg:flex lg:flex-col lg:overflow-visible lg:rounded-xl lg:border lg:p-3.5">
                    {copySectionMeta
                      .filter((section) => visibleSectionKeys.includes(section.key))
                      .map((section) => {
                        const isActive = activeVisibleSection === section.key;

                        return (
                          <button
                            key={section.key}
                            type="button"
                            onClick={() => setActiveSection(section.key)}
                            className={cn(
                              "min-w-0 rounded-lg px-1.5 py-2 text-center text-[10px] font-medium leading-tight transition-colors sm:text-xs lg:px-4 lg:py-3.5 lg:text-left lg:text-sm",
                              isActive
                                ? "bg-foreground text-background"
                                : "text-muted-foreground hover:bg-secondary hover:text-foreground",
                            )}
                          >
                            {section.label}
                          </button>
                        );
                      })}
                  </nav>
                ) : undefined
              }
            />
          </TabsContent>
        </Tabs>

      </section>
    </main>
  );
}
