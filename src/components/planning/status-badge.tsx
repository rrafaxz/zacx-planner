import { Badge } from "@/components/ui/badge";
import { cn, normalizeStatus, statusLabel, statusTone } from "@/lib/utils";

type StatusBadgeProps = {
  status?: string | null;
  className?: string;
};

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const normalizedStatus = normalizeStatus(status);

  return (
    <Badge className={cn(statusTone[normalizedStatus], className)}>
      {statusLabel[normalizedStatus]}
    </Badge>
  );
}
