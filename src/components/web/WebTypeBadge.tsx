import { Badge } from "@/components/ui/badge";
import { WEB_TYPE_CONFIG, type WebRequestType } from "@/types/web";

export function WebTypeBadge({ type }: { type: WebRequestType }) {
  const config = WEB_TYPE_CONFIG[type];
  return (
    <Badge variant="outline" className={`${config.color} border`}>
      {config.label}
    </Badge>
  );
}
