import { ImageIcon, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { Client, PresentationItem } from "@/lib/supabase/types";
import { cn } from "@/lib/utils";

type PresentationCardProps = {
  item: PresentationItem;
  items?: PresentationItem[];
  client?: Client | null;
  deletingItemId?: string | null;
  onDelete?: (item: PresentationItem) => void;
};

function shortDateFromIso(date?: string | null) {
  if (!date) return "--/--";

  const normalizedDate = date.includes("T") ? date : `${date}T12:00:00`;
  const parsedDate = new Date(normalizedDate);
  const day = String(parsedDate.getDate()).padStart(2, "0");
  const month = String(parsedDate.getMonth() + 1).padStart(2, "0");

  return `${day}/${month}`;
}

function visualMode(item: PresentationItem) {
  const source = `${item.format ?? ""} ${item.label ?? ""}`.toLowerCase();

  if (source.includes("story") || source.includes("stories")) return "stories";
  if (source.includes("carrossel") || source.includes("carousel")) return "carousel";

  return "post";
}

function ClientMark({ client }: { client?: Client | null }) {
  if (client?.logo_url) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={client.logo_url}
        alt=""
        className="h-8 w-8 rounded-full border border-neutral-200 object-cover"
      />
    );
  }

  return (
    <div className="grid h-8 w-8 place-items-center rounded-full bg-neutral-950 text-xs font-bold text-white">
      {(client?.name || "Z").slice(0, 1).toUpperCase()}
    </div>
  );
}

function ImageFrame({ item, className }: { item: PresentationItem; className?: string }) {
  return (
    <div className={cn("overflow-hidden bg-white", className)}>
      {item.image_url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={item.image_url} alt={item.label ?? ""} className="h-full w-full object-contain" />
      ) : (
        <div className="flex h-full items-center justify-center text-neutral-400">
          <ImageIcon className="h-10 w-10" />
        </div>
      )}
    </div>
  );
}

function Artwork({ items, mode }: { items: PresentationItem[]; mode: string }) {
  if (mode === "stories") {
    return (
      <div className="flex gap-3 overflow-x-auto">
        {items.map((item) => (
          <ImageFrame
            key={item.id}
            item={item}
            className="aspect-[9/16] h-[320px] shrink-0 rounded-[22px] shadow-sm ring-1 ring-neutral-200"
          />
        ))}
      </div>
    );
  }

  if (mode === "carousel") {
    return (
      <div className="flex gap-0 overflow-hidden rounded-[18px] bg-white shadow-sm ring-1 ring-neutral-200">
        {items.map((item) => (
          <ImageFrame key={item.id} item={item} className="aspect-[4/5] min-w-0 flex-1" />
        ))}
      </div>
    );
  }

  return (
    <ImageFrame
      item={items[0]}
      className="mx-auto aspect-[4/5] w-full max-w-[360px] rounded-[20px] shadow-sm ring-1 ring-neutral-200"
    />
  );
}

export function PresentationCard({
  item,
  items,
  client,
  deletingItemId,
  onDelete,
}: PresentationCardProps) {
  const cardItems = items?.length ? items : [item];
  const mode = visualMode(item);

  return (
    <Card className="overflow-hidden bg-[#17171A]">
      <CardContent className="p-3">
        <div className="rounded-lg bg-[#ECECEF] p-4 text-neutral-950">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-2">
              <ClientMark client={client} />
              <div className="min-w-0">
                <p className="truncate text-xs font-semibold uppercase text-neutral-500">
                  {client?.name || "Cliente"}
                </p>
                <p className="truncate text-sm font-semibold text-neutral-950">
                  {item.label || "Peca visual"}
                </p>
              </div>
            </div>
            <div className="flex shrink-0 gap-2">
              <span className="rounded-full bg-white px-3 py-1 text-xs font-bold text-neutral-950 shadow-sm">
                {item.weekday || "--"}
              </span>
              <span className="rounded-full bg-neutral-950 px-3 py-1 text-xs font-bold text-white shadow-sm">
                {shortDateFromIso(item.content_date)}
              </span>
            </div>
          </div>

          <div
            className={cn(
              "rounded-[26px] bg-[#F7F7F8] p-4 ring-1 ring-neutral-200",
              mode === "carousel" ? "min-h-[330px]" : "min-h-[380px]",
            )}
          >
            <Artwork items={cardItems} mode={mode} />
          </div>

          <div className="mt-4 flex items-center justify-between gap-3">
            <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold uppercase text-neutral-600 shadow-sm">
              {mode === "carousel" ? "Carrossel" : mode === "stories" ? "Stories" : "Post"}
            </span>
            <span className="truncate text-xs font-medium text-neutral-500">
              {item.format || "Formato livre"}
            </span>
          </div>
        </div>

        {onDelete ? (
          <div className="mt-3 flex flex-wrap gap-2">
            {cardItems.map((cardItem, index) => (
              <Button
                key={cardItem.id}
                type="button"
                variant="outline"
                size="sm"
                onClick={() => onDelete(cardItem)}
                disabled={deletingItemId === cardItem.id}
              >
                <Trash2 className="h-4 w-4" />
                {cardItems.length > 1 ? `Excluir ${index + 1}` : "Excluir visual"}
              </Button>
            ))}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
