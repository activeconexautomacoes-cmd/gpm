import { useState, useMemo } from "react";
import {
  DndContext,
  DragEndEvent,
  DragStartEvent,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  DragOverlay,
  closestCorners,
} from "@dnd-kit/core";
import { ArtKanbanColumn } from "./ArtKanbanColumn";
import { ArtKanbanCard } from "./ArtKanbanCard";
import { useUpdateArtRequestStatus } from "@/hooks/useArtes";
import { useToast } from "@/hooks/use-toast";
import type { ArtRequest, ArtStatus } from "@/types/artes";

const COLUMNS: ArtStatus[] = ["solicitada", "realizando", "ajustando", "aprovacao", "concluida"];

interface ArtKanbanBoardProps {
  requests: ArtRequest[];
}

export function ArtKanbanBoard({ requests }: ArtKanbanBoardProps) {
  const { toast } = useToast();
  const updateStatus = useUpdateArtRequestStatus();
  const [activeId, setActiveId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } })
  );

  const columns = useMemo(() => {
    const map: Record<ArtStatus, ArtRequest[]> = {
      solicitada: [],
      realizando: [],
      ajustando: [],
      aprovacao: [],
      concluida: [],
    };
    requests.forEach((r) => {
      if (map[r.status]) map[r.status].push(r);
    });
    return map;
  }, [requests]);

  const activeRequest = activeId ? requests.find((r) => r.id === activeId) : null;

  function handleDragStart(event: DragStartEvent) {
    setActiveId(event.active.id as string);
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveId(null);
    const { active, over } = event;
    if (!over) return;

    const request = requests.find((r) => r.id === active.id);
    if (!request) return;

    const newStatus = over.id as ArtStatus;
    if (newStatus === request.status) return;

    // Allow any movement — 100% free drag
    updateStatus.mutate({ id: request.id, status: newStatus });
    toast({ title: `Status atualizado para ${newStatus}` });
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="flex gap-4 overflow-x-auto pb-4 h-[calc(100vh-16rem)]">
        {COLUMNS.map((status) => (
          <ArtKanbanColumn
            key={status}
            status={status}
            requests={columns[status]}
            isDraggable={true}
          />
        ))}
      </div>
      <DragOverlay>
        {activeRequest ? <ArtKanbanCard request={activeRequest} /> : null}
      </DragOverlay>
    </DndContext>
  );
}
