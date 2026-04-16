import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ArtKanbanCard } from "./ArtKanbanCard";
import type { ArtRequest, ArtStatus } from "@/types/artes";
import { ART_STATUS_CONFIG } from "@/types/artes";

interface ArtKanbanColumnProps {
  status: ArtStatus;
  requests: ArtRequest[];
  isDraggable?: boolean;
}

const COLUMN_COLORS: Record<ArtStatus, string> = {
  solicitada: "bg-blue-500",
  realizando: "bg-yellow-500",
  ajustando: "bg-orange-500",
  aprovacao: "bg-purple-500",
  concluida: "bg-green-500",
};

export function ArtKanbanColumn({ status, requests, isDraggable = false }: ArtKanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id: status });
  const config = ART_STATUS_CONFIG[status];

  return (
    <div
      ref={setNodeRef}
      className={`flex flex-col min-w-[280px] max-w-[320px] flex-1 rounded-lg border bg-muted/30 transition-colors ${
        isOver ? "ring-2 ring-primary bg-muted/50" : ""
      }`}
    >
      <div className="flex items-center gap-2 p-3 border-b">
        <div className={`h-3 w-3 rounded-full ${COLUMN_COLORS[status]}`} />
        <h3 className="font-semibold text-sm">{config.label}</h3>
        <span className="ml-auto text-xs text-muted-foreground bg-muted rounded-full px-2 py-0.5">
          {requests.length}
        </span>
      </div>
      <ScrollArea className="flex-1 p-2">
        <SortableContext items={requests.map((r) => r.id)} strategy={verticalListSortingStrategy}>
          <div className="space-y-2 min-h-[100px]">
            {requests.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-8">
                Nenhuma arte
              </p>
            ) : (
              requests.map((request) => (
                <ArtKanbanCard key={request.id} request={request} isDraggable={isDraggable} />
              ))
            )}
          </div>
        </SortableContext>
      </ScrollArea>
    </div>
  );
}
