import Link from "next/link";
import { Archive, CheckSquare2, RotateCcw, Square } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import type { Client } from "@/lib/supabase/types";
import { cn } from "@/lib/utils";

type ClientCardProps = {
  client: Client;
  selectionMode?: boolean;
  selected?: boolean;
  onToggleSelected?: () => void;
  onArchiveToggle?: () => void;
};

export function ClientCard({
  client,
  selectionMode = false,
  selected = false,
  onToggleSelected,
  onArchiveToggle,
}: ClientCardProps) {
  const accentColor = client.primary_color || "#E5E7EB";
  const secondaryColor = client.secondary_color || accentColor;
  const isArchived = Boolean(client.archived_at);
  const content = (
    <Card
      className={cn(
        "group h-full overflow-hidden bg-background shadow-none transition hover:-translate-y-0.5 hover:border-foreground/20",
        isArchived && !selected && "border-dashed opacity-70 hover:border-foreground/20",
        selected && "border-blue-400 bg-blue-500/[0.06] dark:border-blue-400/60 dark:bg-blue-400/10",
      )}
    >
      <CardContent className="relative flex min-h-[76px] items-center gap-3 p-3 sm:min-h-[92px] sm:p-4">
        <span
          className="absolute inset-x-0 top-0 h-1"
          style={{ backgroundColor: isArchived ? "hsl(var(--border))" : accentColor }}
        />
        {selectionMode ? (
          <span className="grid h-7 w-7 shrink-0 place-items-center rounded-md border border-border bg-background text-foreground">
            {selected ? <CheckSquare2 className="h-4 w-4" /> : <Square className="h-4 w-4" />}
          </span>
        ) : null}
        <div
          className="grid h-11 w-11 shrink-0 place-items-center overflow-hidden rounded-full border border-border bg-background text-base font-medium transition group-hover:scale-[1.03] sm:h-12 sm:w-12 sm:text-lg"
          style={{ color: accentColor }}
        >
          {client.logo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={client.logo_url} alt="" className="h-full w-full object-cover" />
          ) : (
            client.name.slice(0, 1).toUpperCase()
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-center gap-2">
            <h2 className="sora-heading line-clamp-2 text-sm font-medium leading-snug text-foreground sm:text-base">
              {client.name}
            </h2>
            {isArchived ? (
              <span className="shrink-0 rounded-full border border-border px-2 py-0.5 text-[10px] text-muted-foreground">
                Arquivado
              </span>
            ) : null}
          </div>
          <div className={cn("mt-2 flex items-center gap-1.5", isArchived && "opacity-45 grayscale")}>
            <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: accentColor }} />
            <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: secondaryColor }} />
          </div>
          {client.responsible_name ? (
            <p className="mt-1 text-[11px] text-muted-foreground">Responsável: {client.responsible_name}</p>
          ) : null}
        </div>
        {onArchiveToggle && !selectionMode ? (
          <button
            type="button"
            className="grid h-8 w-8 shrink-0 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-foreground/[0.06] hover:text-foreground"
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              onArchiveToggle();
            }}
            aria-label={isArchived ? "Desarquivar cliente" : "Arquivar cliente"}
            title={isArchived ? "Desarquivar" : "Arquivar"}
          >
            {isArchived ? <RotateCcw className="h-4 w-4" /> : <Archive className="h-4 w-4" />}
          </button>
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
