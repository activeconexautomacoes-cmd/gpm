import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  UserRoundPen,
  Handshake,
  TrendingUp,
  AlertCircle,
  Trophy,
  XCircle,
  ShieldAlert,
  StickyNote,
  Trash2,
  User,
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import type { ClientPanelTimelineEvent, ClientPanelEventType } from "@/types/clientPanel";
import { EVENT_TYPE_CONFIG } from "@/types/clientPanel";

const ICON_MAP: Record<string, React.ElementType> = {
  UserRoundPen,
  Handshake,
  TrendingUp,
  AlertCircle,
  Trophy,
  XCircle,
  ShieldAlert,
  StickyNote,
};

interface ClientPanelEventCardProps {
  event: ClientPanelTimelineEvent;
  canDelete: boolean;
  onDelete: (id: string) => void;
}

export function ClientPanelEventCard({ event, canDelete, onDelete }: ClientPanelEventCardProps) {
  const config = EVENT_TYPE_CONFIG[event.event_type] || EVENT_TYPE_CONFIG.outro;
  const IconComponent = ICON_MAP[config.icon] || StickyNote;

  return (
    <div className="flex gap-4 group">
      {/* Timeline line + icon */}
      <div className="flex flex-col items-center">
        <div className={cn(
          "flex items-center justify-center h-10 w-10 rounded-full border-2 shrink-0",
          config.bgColor
        )}>
          <IconComponent className={cn("h-5 w-5", config.color)} />
        </div>
        <div className="w-px flex-1 bg-border/50 mt-2" />
      </div>

      {/* Content */}
      <div className="flex-1 pb-8 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="outline" className={cn("text-xs font-medium", config.bgColor, config.color)}>
              {config.label}
            </Badge>
            <span className="text-xs text-muted-foreground">
              {format(new Date(event.occurred_at), "dd MMM yyyy", { locale: ptBR })}
            </span>
          </div>
          {canDelete && (
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
              onClick={() => onDelete(event.id)}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>

        <p className="mt-2 text-sm leading-relaxed whitespace-pre-wrap">{event.content}</p>

        {/* Metadata for gestor/cs changes */}
        {event.metadata && (event.event_type === "mudanca_gestor" || event.event_type === "mudanca_cs") && (
          <div className="mt-2 text-xs text-muted-foreground bg-muted/30 rounded-md px-3 py-2">
            {(event.metadata as any).previous_name && (
              <span>De <strong>{(event.metadata as any).previous_name}</strong></span>
            )}
            {(event.metadata as any).new_name && (
              <span> para <strong>{(event.metadata as any).new_name}</strong></span>
            )}
          </div>
        )}

        {/* Creator */}
        <div className="flex items-center gap-1.5 mt-3">
          <Avatar className="h-5 w-5">
            <AvatarImage src={event.creator?.avatar_url || undefined} />
            <AvatarFallback><User className="h-3 w-3" /></AvatarFallback>
          </Avatar>
          <span className="text-[11px] text-muted-foreground">
            {event.creator?.full_name || "Desconhecido"}
          </span>
        </div>
      </div>
    </div>
  );
}
