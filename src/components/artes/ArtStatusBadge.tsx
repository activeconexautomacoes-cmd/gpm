import { Badge } from "@/components/ui/badge";
import { ART_STATUS_CONFIG, type ArtStatus } from "@/types/artes";

interface ArtStatusBadgeProps {
  status: ArtStatus;
  className?: string;
}

export function ArtStatusBadge({ status, className }: ArtStatusBadgeProps) {
  const config = ART_STATUS_CONFIG[status];
  return (
    <Badge variant="outline" className={`${config.bgColor} ${config.color} border ${className || ""}`}>
      {config.label}
    </Badge>
  );
}
