import { useState, useMemo } from "react";
import { DndContext, DragEndEvent, DragStartEvent, PointerSensor, TouchSensor, useSensor, useSensors, DragOverlay, closestCorners } from "@dnd-kit/core";
import { WebKanbanColumn } from "./WebKanbanColumn";
import { WebKanbanCard } from "./WebKanbanCard";
import { useUpdateWebRequestStatus } from "@/hooks/useWeb";
import { useToast } from "@/hooks/use-toast";
import type { WebRequest, WebStatus } from "@/types/web";

const COLUMNS: WebStatus[] = ["solicitada", "realizando", "ajustando", "concluida"];

export function WebKanbanBoard({ requests }: { requests: WebRequest[] }) {
  const { toast } = useToast();
  const updateStatus = useUpdateWebRequestStatus();
  const [activeId, setActiveId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } })
  );

  const columns = useMemo(() => {
    const map: Record<WebStatus, WebRequest[]> = { solicitada: [], realizando: [], ajustando: [], concluida: [] };
    requests.forEach((r) => { if (map[r.status]) map[r.status].push(r); });
    return map;
  }, [requests]);

  const activeRequest = activeId ? requests.find((r) => r.id === activeId) : null;

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={(e: DragStartEvent) => setActiveId(e.active.id as string)}
      onDragEnd={(e: DragEndEvent) => {
        setActiveId(null);
        const { active, over } = e;
        if (!over) return;
        const req = requests.find((r) => r.id === active.id);
        if (!req) return;
        const newStatus = over.id as WebStatus;
        if (newStatus === req.status) return;
        updateStatus.mutate({ id: req.id, status: newStatus });
        toast({ title: `Status atualizado para ${newStatus}` });
      }}
    >
      <div className="flex gap-4 overflow-x-auto pb-4 h-[calc(100vh-16rem)]">
        {COLUMNS.map((s) => (
          <WebKanbanColumn key={s} status={s} requests={columns[s]} isDraggable={true} />
        ))}
      </div>
      <DragOverlay>{activeRequest ? <WebKanbanCard request={activeRequest} /> : null}</DragOverlay>
    </DndContext>
  );
}
