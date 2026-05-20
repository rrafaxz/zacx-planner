import Link from "next/link";
import { CheckSquare2, FileText, Square } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import type { Client } from "@/lib/supabase/types";
import { cn } from "@/lib/utils";

type ClientCardProps = {
  client: Client;
  selectionMode?: boolean;
  selected?: boolean;
  onToggleSelected?: () => void;
  endingPlanningLabel?: string | null;
};

export function ClientCard({
  client,
  selectionMode = false,
  selected = false,
  onToggleSelected,
  endingPlanningLabel,
}: ClientCardProps) {
  const accentColor = client.primary_color || "#E5E7EB";
  const secondaryColor = client.secondary_color || accentColor;
  const isArchived = Boolean(client.archived_at);
  const content = (
    <Card
      className={cn(
        "group h-full overflow-hidden bg-background shadow-none transition hover:-translate-y-0.5 hover:border-foreground/20",
        isArchived && !selected && "border-dashed opacity-70 hover:border-foreground/20",
        selected && "border-blue-400 bg-neutral-900/[0.045] dark:border-blue-400/60 dark:bg-white/[0.06]",
      )}
    >
      <CardContent className="relative flex min-h-[130px] flex-col items-center justify-center gap-2 p-3 text-center sm:min-h-[92px] sm:flex-row sm:justify-start sm:gap-3 sm:p-4 sm:text-left">
        <span
          className="absolute inset-x-0 top-0 h-1"
          style={{ backgroundColor: isArchived ? "hsl(var(--border))" : accentColor }}
        />
        {selectionMode ? (
          <span className="absolute left-2 top-2 grid h-7 w-7 shrink-0 place-items-center rounded-md border border-border bg-background text-foreground sm:static">
            {selected ? <CheckSquare2 className="h-4 w-4" /> : <Square className="h-4 w-4" />}
          </span>
        ) : null}
        {endingPlanningLabel ? (
          <span
            className="absolute right-2 top-2 grid h-7 w-7 place-items-center rounded-md text-red-500"
            title={`Planejamento próximo do fim: ${endingPlanningLabel}`}
            aria-label={`Planejamento próximo do fim: ${endingPlanningLabel}`}
          >
            <FileText className="h-4 w-4" />
          </span>
        ) : null}
        <div className="order-2 flex items-center justify-center gap-2 sm:order-none">
          <div
            className="grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-full border border-border bg-background text-base font-medium transition group-hover:scale-[1.03] sm:h-12 sm:w-12 sm:text-lg"
            style={{ color: accentColor }}
          >
            {client.logo_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={client.logo_url} alt="" className="h-full w-full object-cover" />
            ) : (
              client.name.slice(0, 1).toUpperCase()
            )}
          </div>
          <div className={cn("flex items-center gap-1.5 sm:hidden", isArchived && "opacity-45 grayscale")}>
            <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: accentColor }} />
            <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: secondaryColor }} />
          </div>
        </div>

        <div className="order-1 min-w-0 flex-1 sm:order-none">
          <div className="flex min-w-0 flex-wrap items-center justify-center gap-1.5 sm:justify-start sm:gap-2">
            <h2 className="sora-heading w-full min-w-0 max-w-full text-sm font-medium leading-snug text-foreground [overflow-wrap:anywhere] sm:line-clamp-2 sm:w-auto sm:text-base">
              {client.name}
            </h2>
            {isArchived ? (
              <span className="shrink-0 rounded-full border border-border px-2 py-0.5 text-[10px] text-muted-foreground">
                Arquivado
              </span>
            ) : null}
          </div>
          <div className={cn("mt-2 hidden items-center gap-1.5 sm:flex", isArchived && "opacity-45 grayscale")}>
            <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: accentColor }} />
            <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: secondaryColor }} />
          </div>
          {client.responsible_name ? (
            <p className="mt-1 hidden text-[11px] text-muted-foreground sm:block">Responsável: {client.responsible_name}</p>
          ) : null}
        </div>
        {client.responsible_name ? (
          <p className="order-3 max-w-full text-center text-[11px] text-muted-foreground [overflow-wrap:anywhere] sm:hidden">
            Responsável: {client.responsible_name}
          </p>
        ) : null}
      </CardContent>
    </Card>
  );

  if (selectionMode) {
    return (
      <button type="button" onClick={onToggleSelected} className="block h-full w-full text-left">
        {content}
      </button>
    );
  }

  return (
    <Link href={`/admin/clientes/${client.id}`} className="block h-full">
      {content}
    </Link>
  );
}
