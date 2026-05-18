"use client";

import { useEffect, useState } from "react";
import { Loader2, Save } from "lucide-react";

import { PresentationCard } from "@/components/presentation/presentation-card";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/lib/supabase/client";
import type { Client, ContentItem, PlanningWeek, PresentationItem } from "@/lib/supabase/types";
import { formatDateBR, periodLabel } from "@/lib/utils";

type PublicPlanningViewProps = {
  slug: string;
};

type EditableContentField =
  | "title"
  | "content_date"
  | "weekday"
  | "format"
  | "content_text"
  | "caption"
  | "notes";

function NotFoundState() {
  return (
    <main className="min-h-screen bg-[#0D0D0F] px-4 py-8 text-white">
      <div className="mx-auto flex min-h-[70vh] max-w-2xl items-center">
        <Card className="w-full bg-[#17171A]">
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

export function PublicPlanningView({ slug }: PublicPlanningViewProps) {
  const [week, setWeek] = useState<PlanningWeek | null>(null);
  const [client, setClient] = useState<Client | null>(null);
  const [contentItems, setContentItems] = useState<ContentItem[]>([]);
  const [presentationItems, setPresentationItems] = useState<PresentationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingItemId, setSavingItemId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function loadPlanning() {
    setLoading(true);
    setError(null);

    const { data: weekData, error: weekError } = await supabase
      .from("planning_weeks")
      .select("*")
      .eq("public_slug", slug)
      .maybeSingle();

    if (weekError || !weekData) {
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
        .order("content_date", { ascending: true }),
      supabase
        .from("presentation_items")
        .select("*")
        .eq("planning_week_id", weekData.id)
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
    loadPlanning();
  }, [slug]);

  function updateContentItem(id: string, field: EditableContentField, value: string) {
    setContentItems((items) =>
      items.map((item) => (item.id === id ? { ...item, [field]: value || null } : item)),
    );
  }

  async function saveContentItem(item: ContentItem) {
    setSavingItemId(item.id);
    setFeedback(null);
    setError(null);

    const { error: requestError } = await supabase
      .from("content_items")
      .update({
        title: item.title,
        content_date: item.content_date,
        weekday: item.weekday,
        format: item.format,
        content_text: item.content_text,
        caption: item.caption,
        notes: item.notes,
      })
      .eq("id", item.id);

    if (requestError) {
      setError(requestError.message);
    } else {
      setFeedback("Alteracoes salvas.");
    }

    setSavingItemId(null);
  }

  if (loading) {
    return (
      <main className="grid min-h-screen place-items-center bg-[#0D0D0F] px-4 text-white">
        <div className="flex items-center gap-3 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Carregando planejamento...
        </div>
      </main>
    );
  }

  if (!week) {
    return <NotFoundState />;
  }

  const detailColor = week.detail_color || client?.primary_color || "#A3E635";

  return (
    <main className="min-h-screen bg-[#0D0D0F] text-white">
      <div className="fixed inset-0 -z-10 subtle-grid opacity-25" />

      <header className="border-b border-border bg-[#0D0D0F]">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
          <div className="flex items-center gap-3">
            <span className="grid h-9 w-9 place-items-center rounded-lg bg-white text-sm font-bold text-black">
              Z
            </span>
            <span>
              <span className="block text-sm font-semibold">Zacx</span>
              <span className="text-xs text-muted-foreground">Planner publico</span>
            </span>
          </div>
        </div>
      </header>

      <section className="mx-auto w-full max-w-6xl px-4 py-8 md:py-10">
        <div className="rounded-lg border border-border bg-[#17171A] p-5 md:p-7">
          <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-sm text-muted-foreground">{client?.name || "Cliente"}</p>
              <h1 className="sora-heading mt-2 text-3xl font-semibold text-white md:text-5xl">{week.title}</h1>
              <p className="mt-4 text-sm text-muted-foreground">
                {periodLabel(week.start_date, week.end_date)}
              </p>
            </div>
            <div className="h-2 w-28 rounded-full" style={{ backgroundColor: detailColor }} />
          </div>
        </div>

        {error ? (
          <Card className="mt-5 border-rose-500/30 bg-rose-500/10">
            <CardContent className="pt-5 text-sm text-rose-100">{error}</CardContent>
          </Card>
        ) : null}

        {feedback ? (
          <Card className="mt-5 border-emerald-500/30 bg-emerald-500/10">
            <CardContent className="pt-5 text-sm text-emerald-100">{feedback}</CardContent>
          </Card>
        ) : null}

        <Tabs defaultValue="planning" className="mt-8">
          <TabsList className="w-full justify-start overflow-x-auto sm:w-auto">
            <TabsTrigger value="planning">Planejamento</TabsTrigger>
            <TabsTrigger value="presentation">Apresentacao</TabsTrigger>
          </TabsList>

          <TabsContent value="planning" className="space-y-4">
            {contentItems.length ? (
              contentItems.map((item) => (
                <Card key={item.id} className="bg-[#17171A]">
                  <CardHeader>
                    <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      <span>{item.type || "Conteudo"}</span>
                      <span>-</span>
                      <span>{formatDateBR(item.content_date)}</span>
                      {item.weekday ? (
                        <>
                          <span>-</span>
                          <span>{item.weekday}</span>
                        </>
                      ) : null}
                    </div>
                  </CardHeader>
                  <CardContent className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor={`title-${item.id}`}>Titulo</Label>
                      <Input
                        id={`title-${item.id}`}
                        value={item.title ?? ""}
                        onChange={(event) =>
                          updateContentItem(item.id, "title", event.target.value)
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor={`date-${item.id}`}>Data</Label>
                      <Input
                        id={`date-${item.id}`}
                        type="date"
                        value={item.content_date ?? ""}
                        onChange={(event) =>
                          updateContentItem(item.id, "content_date", event.target.value)
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor={`weekday-${item.id}`}>Dia da semana</Label>
                      <Input
                        id={`weekday-${item.id}`}
                        value={item.weekday ?? ""}
                        onChange={(event) =>
                          updateContentItem(item.id, "weekday", event.target.value)
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor={`format-${item.id}`}>Formato</Label>
                      <Input
                        id={`format-${item.id}`}
                        value={item.format ?? ""}
                        onChange={(event) =>
                          updateContentItem(item.id, "format", event.target.value)
                        }
                      />
                    </div>
                    <div className="space-y-2 md:col-span-2">
                      <Label htmlFor={`copy-${item.id}`}>Texto/copy</Label>
                      <Textarea
                        id={`copy-${item.id}`}
                        value={item.content_text ?? ""}
                        onChange={(event) =>
                          updateContentItem(item.id, "content_text", event.target.value)
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor={`caption-${item.id}`}>Legenda</Label>
                      <Textarea
                        id={`caption-${item.id}`}
                        value={item.caption ?? ""}
                        onChange={(event) =>
                          updateContentItem(item.id, "caption", event.target.value)
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor={`notes-${item.id}`}>Observacoes</Label>
                      <Textarea
                        id={`notes-${item.id}`}
                        value={item.notes ?? ""}
                        onChange={(event) =>
                          updateContentItem(item.id, "notes", event.target.value)
                        }
                      />
                    </div>
                    <div className="md:col-span-2">
                      <Button
                        type="button"
                        onClick={() => saveContentItem(item)}
                        disabled={savingItemId === item.id}
                      >
                        <Save className="h-4 w-4" />
                        {savingItemId === item.id ? "Salvando..." : "Salvar alteracoes"}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))
            ) : (
              <Card className="bg-[#17171A]">
                <CardContent className="pt-5 text-sm text-muted-foreground">
                  Nenhum item de planejamento disponivel.
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="presentation" className="space-y-6">
            {presentationItems.length ? (
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {presentationItems.map((item) => (
                  <PresentationCard key={item.id} item={item} client={client} />
                ))}
              </div>
            ) : (
              <Card className="bg-[#17171A]">
                <CardContent className="pt-5 text-sm text-muted-foreground">
                  Nenhum item visual disponivel.
                </CardContent>
              </Card>
            )}

          </TabsContent>
        </Tabs>
      </section>
    </main>
  );
}
