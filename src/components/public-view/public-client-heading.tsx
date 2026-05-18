import type { Client } from "@/lib/supabase/types";

type PublicClientHeadingProps = {
  client: Client | null;
  title: string;
  periodLabel?: string | null;
};

export function PublicClientHeading({ client, title, periodLabel }: PublicClientHeadingProps) {
  const clientName = client?.name?.trim() || "Cliente";
  const initial = clientName.slice(0, 1).toUpperCase();

  return (
    <div className="flex items-center justify-between gap-4 border-b border-border pb-4 md:gap-5 md:pb-5">
      <div className="flex min-w-0 items-center gap-3 sm:gap-4">
        <div className="grid h-[68px] w-[68px] shrink-0 place-items-center overflow-hidden rounded-full border border-border bg-secondary text-lg font-medium text-foreground md:h-20 md:w-20">
          {client?.logo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={client.logo_url} alt="" className="h-full w-full object-cover" />
          ) : (
            <span>{initial}</span>
          )}
        </div>
        <span className="max-w-[160px] truncate text-sm font-medium text-foreground md:max-w-[240px] md:text-base">
          {clientName}
        </span>
      </div>

      <div className="ml-auto min-w-0 max-w-[52%] text-right sm:max-w-[62%]">
        <h1 className="sora-heading truncate text-xl font-medium tracking-normal text-foreground sm:text-3xl md:text-5xl">
          {title}
        </h1>
        <p className="mt-1 truncate text-xs text-muted-foreground sm:mt-2 sm:text-sm">
          {clientName} — {periodLabel || "Periodo nao definido"}
        </p>
      </div>
    </div>
  );
}
