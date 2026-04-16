import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Calendar, Globe, Clock } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { ArtRequest } from "@/types/artes";
import { useNavigate } from "react-router-dom";

interface ArtKanbanCardProps {
  request: ArtRequest;
  isDraggable?: boolean;
}

export function ArtKanbanCard({ request, isDraggable = false }: ArtKanbanCardProps) {
  const navigate = useNavigate();
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: request.id,
    disabled: !isDraggable,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const isUrgent = request.priority === "urgente";

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <Card
        className={`cursor-pointer hover:shadow-md transition-all ${
          isUrgent ? "border-red-500/50 animate-pulse" : ""
        } ${isDragging ? "shadow-lg ring-2 ring-primary" : ""}`}
        onClick={() => navigate(`/dashboard/artes/${request.id}`)}
      >
        <CardContent className="p-3 space-y-2">
          <div className="flex items-start justify-between gap-2">
            <p className="font-medium text-sm leading-tight line-clamp-2">
              {request.promotion}
            </p>
            {isUrgent && (
              <Badge variant="destructive" className="text-[10px] px-1.5 py-0 shrink-0">
                URGENTE
              </Badge>
            )}
          </div>

          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Globe className="h-3 w-3 shrink-0" />
            <span className="truncate">{request.site_url.replace(/^https?:\/\//, "")}</span>
          </div>

          <div className="flex flex-wrap gap-1">
            {request.formats?.map((rf) => (
              <Badge key={rf.id} variant="secondary" className="text-[10px] px-1.5 py-0">
                {rf.format?.name || "Formato"}
              </Badge>
            ))}
          </div>

          <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-1 border-t">
            <div className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {format(new Date(request.created_at), "dd/MM", { locale: ptBR })}
            </div>
            {request.deadline && (
              <div className="flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                {format(new Date(request.deadline), "dd/MM", { locale: ptBR })}
              </div>
            )}
            {request.designer && (
              <span className="truncate max-w-[80px]">
                {request.designer.full_name?.split(" ")[0]}
              </span>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
