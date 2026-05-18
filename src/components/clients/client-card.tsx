import Link from "next/link";

import { Card, CardContent } from "@/components/ui/card";
import type { Client } from "@/lib/supabase/types";

type ClientCardProps = {
  client: Client;
};

export function ClientCard({ client }: ClientCardProps) {
  const accentColor = client.primary_color || "#E5E7EB";
  const secondaryColor = client.secondary_color || accentColor;

  return (
    <Link href={`/admin/clientes/${client.id}`} className="block h-full">
      <Card className="group h-full overflow-hidden bg-background shadow-none transition hover:-translate-y-0.5 hover:border-foreground/20">
        <div className="h-1.5" style={{ backgroundColor: accentColor }} />
        <CardContent className="flex min-h-[164px] flex-col items-center justify-center p-3 text-center sm:min-h-[220px] sm:p-5">
          <div
            className="grid h-14 w-14 shrink-0 place-items-center overflow-hidden rounded-full border border-border bg-secondary text-lg font-medium transition group-hover:scale-[1.03] sm:h-20 sm:w-20 sm:text-2xl"
            style={{ color: accentColor }}
          >
            {client.logo_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={client.logo_url} alt="" className="h-full w-full object-cover" />
            ) : (
              client.name.slice(0, 1).toUpperCase()
            )}
          </div>

          <h2 className="mt-3 line-clamp-2 text-sm font-medium leading-snug text-foreground sm:mt-4 sm:text-lg">
            {client.name}
          </h2>
          <p className="mt-1 max-w-full truncate text-xs text-muted-foreground sm:text-sm">/{client.slug}</p>

          <div className="mt-3 flex items-center gap-1.5 sm:mt-5 sm:gap-2">
            <span className="h-2.5 w-2.5 rounded-full sm:h-3 sm:w-3" style={{ backgroundColor: accentColor }} />
            <span className="h-2.5 w-2.5 rounded-full sm:h-3 sm:w-3" style={{ backgroundColor: secondaryColor }} />
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
