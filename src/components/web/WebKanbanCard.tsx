import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Calendar, Globe, Clock, User, MessageSquare, AlertTriangle } from "lucide-react";
import { format, isPast } from "date-fns";
import { ptBR } from "date-fns/locale";
import { WebTypeBadge } from "./WebTypeBadge";
import type { WebRequest } from "@/types/web";
import { useNavigate } from "react-router-dom";

interface WebKanbanCardProps {
  request: WebRequest;
  isDraggable?: boolean;
}

export function WebKanbanCard({ request, isDraggable = false }: WebKanbanCardProps) {
  const navigate = useNavigate();
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: request.id,
    disabled: !isDraggable,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const isUrgent = request.priority === "urgente";
  const isOverdue = request.deadline && isPast(new Date(request.deadline)) && request.status !== "concluida";

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <Card
        className={`cursor-pointer hover:shadow-md transition-all ${
          isUrgent ? "border-red-500/50 animate-pulse" : ""
        } ${isDragging ? "shadow-lg ring-2 ring-primary" : ""}`}
        onClick={() => navigate(`/dashboard/web/${request.id}`)}
      >
        <CardContent className="p-3 space-y-2">
          <div className="flex items-start justify-between gap-2">
            <p className="font-medium text-sm leading-tight line-clamp-2">{request.title}</p>
            {isUrgent && (
              <Badge variant="destructive" className="text-[10px] px-1.5 py-0 shrink-0">URGENTE</Badge>
            )}
          </div>

          <div className="flex flex-wrap gap-1">
            <WebTypeBadge type={request.request_type} />
          </div>

          {request.site_url && (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Globe className="h-3 w-3 shrink-0" />
              <span className="truncate">{request.site_url.replace(/^https?:\/\//, "")}</span>
            </div>
          )}

          <div className="space-y-1 pt-1 border-t">
            {request.gestor && (
              <div className="flex items-center gap-1.5 text-[11px]">
                <User className="h-3 w-3 text-green-400 shrink-0" />
                <span className="text-green-400 font-medium">Gestor:</span>
                <span className="text-muted-foreground truncate">{request.gestor.full_name}</span>
              </div>
            )}
          </div>

          <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-1 border-t">
            <div className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {format(new Date(request.created_at), "dd/MM", { locale: ptBR })}
            </div>
            {request.deadline && (
              <div className={`flex items-center gap-1 ${isOverdue ? "text-red-400 font-medium" : ""}`}>
                {isOverdue && <AlertTriangle className="h-3 w-3" />}
                <Calendar className="h-3 w-3" />
                {format(new Date(request.deadline), "dd/MM", { locale: ptBR })}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
