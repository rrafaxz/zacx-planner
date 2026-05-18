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
      <Card className="group h-full bg-background shadow-none transition hover:-translate-y-0.5 hover:border-foreground/20">
        <CardContent className="flex min-h-[86px] items-center gap-3 p-3 sm:min-h-[104px] sm:p-4">
          <div
            className="grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-full border border-border bg-background text-base font-medium transition group-hover:scale-[1.03] sm:h-14 sm:w-14 sm:text-lg"
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
            <h2 className="sora-heading line-clamp-2 text-sm font-medium leading-snug text-foreground sm:text-base">
              {client.name}
            </h2>
            <div className="mt-2 flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: accentColor }} />
              <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: secondaryColor }} />
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
