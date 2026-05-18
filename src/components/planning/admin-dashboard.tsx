"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Clock3, FileText, Images, Plus, UsersRound } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/lib/supabase/client";

type Metrics = {
  clients: number;
  copyPlannings: number;
  visualPresentations: number;
  activeDeliverables: number;
};

export function AdminDashboard() {
  const [metrics, setMetrics] = useState<Metrics>({
    clients: 0,
    copyPlannings: 0,
    visualPresentations: 0,
    activeDeliverables: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadMetrics() {
      setLoading(true);
      setError(null);

      const [clients, copyPlannings, visualPresentations] = await Promise.all([
        supabase.from("clients").select("*", { count: "exact", head: true }),
        supabase.from("copy_plannings").select("*", { count: "exact", head: true }),
        supabase.from("visual_presentations").select("*", { count: "exact", head: true }),
      ]);

      const firstError =
        clients.error ||
        copyPlannings.error ||
        visualPresentations.error;

      if (firstError) {
        setError(firstError.message);
      } else {
        setMetrics({
          clients: clients.count ?? 0,
          copyPlannings: copyPlannings.count ?? 0,
          visualPresentations: visualPresentations.count ?? 0,
          activeDeliverables: (copyPlannings.count ?? 0) + (visualPresentations.count ?? 0),
        });
      }

      setLoading(false);
    }

    loadMetrics();
  }, []);

  const cards = useMemo(
    () => [
      {
        label: "Total de clientes",
        value: metrics.clients,
        description: "Marcas cadastradas na base",
        icon: UsersRound,
      },
      {
        label: "Planejamentos",
        value: metrics.copyPlannings,
        description: "Documentos de copy criados",
        icon: FileText,
      },
      {
        label: "Apresentacoes",
        value: metrics.visualPresentations,
        description: "Pranchas visuais criadas",
        icon: Images,
      },
      {
        label: "Entregas",
        value: metrics.activeDeliverables,
        description: "Planejamentos e apresentacoes",
        icon: Clock3,
      },
    ],
    [metrics],
  );

  return (
    <section className="space-y-6 md:space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="mt-2 text-2xl font-medium tracking-normal text-foreground md:text-4xl">
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

      {error ? (
        <Card className="border-rose-500/30 bg-rose-500/10">
          <CardContent className="pt-5 text-sm text-rose-100">{error}</CardContent>
        </Card>
      ) : null}

      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        {cards.map((card) => {
          const Icon = card.icon;

          return (
            <Card key={card.label} className="border-border/70 bg-background shadow-none">
              <CardHeader className="flex-row items-center justify-between gap-3 p-4 pb-2 md:p-6 md:pb-3">
                <div>
                  <CardDescription className="text-xs md:text-sm">{card.label}</CardDescription>
                  <CardTitle className="mt-2 text-2xl md:mt-3 md:text-3xl">{loading ? "--" : card.value}</CardTitle>
                </div>
                <Icon className="h-5 w-5 text-muted-foreground" />
              </CardHeader>
              <CardContent className="hidden px-4 pb-4 md:block md:px-6 md:pb-6">
                <p className="text-sm text-muted-foreground">{card.description}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </section>
  );
}
