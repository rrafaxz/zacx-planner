import { ZacxLogo } from "@/components/zacx-logo";

type PublicHeaderProps = {
  type: "planning" | "presentation";
};

const labelByType: Record<PublicHeaderProps["type"], string> = {
  planning: "PLANEJAMENTO PÚBLICO",
  presentation: "APRESENTAÇÃO PÚBLICA",
};

export function PublicHeader({ type }: PublicHeaderProps) {
  return (
    <header className="w-full border-b border-border bg-background">
      <div className="grid grid-cols-[auto_1fr] items-center gap-3 px-4 py-4 sm:px-6">
        <ZacxLogo className="h-4 w-auto text-[var(--zacx-brand)]" />
        <span className="min-w-0 justify-self-end truncate text-right text-xs font-medium uppercase tracking-normal text-muted-foreground sm:text-sm">
          {labelByType[type]}
        </span>
      </div>
    </header>
  );
}
