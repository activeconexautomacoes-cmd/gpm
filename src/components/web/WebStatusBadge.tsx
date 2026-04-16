import { Badge } from "@/components/ui/badge";
import { WEB_STATUS_CONFIG, type WebStatus } from "@/types/web";

export function WebStatusBadge({ status }: { status: WebStatus }) {
  const config = WEB_STATUS_CONFIG[status];
  return (
    <Badge variant="outline" className={`${config.bgColor} ${config.color} border`}>
      {config.label}
    </Badge>
  );
}
