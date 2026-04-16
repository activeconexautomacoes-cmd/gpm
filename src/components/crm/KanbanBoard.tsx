import { useState } from "react";
import { KanbanColumn } from "./KanbanColumn";
import { DndContext, DragOverlay, closestCorners, PointerSensor, useSensor, useSensors, DragStartEvent, DragEndEvent } from "@dnd-kit/core";
import { OpportunityCard } from "./OpportunityCard";
import { LeadScoreFeedbackModal } from "./LeadScoreFeedbackModal";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface KanbanBoardProps {
  stages: any[];
  opportunities: any[];
  workspaceId?: string;
  onCardClick: (opportunity: any) => void;
}

export function KanbanBoard({ stages, opportunities, workspaceId, onCardClick }: KanbanBoardProps) {
  const [activeOpportunity, setActiveOpportunity] = useState<any>(null);
  const [scoreModalOpen, setScoreModalOpen] = useState(false);
  const [pendingOpportunityId, setPendingOpportunityId] = useState<string | null>(null);
  const [pendingStageId, setPendingStageId] = useState<string | null>(null);

  const queryClient = useQueryClient();

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  const updateStageMutation = useMutation({
    mutationFn: async ({ opportunityId, newStageId }: { opportunityId: string; newStageId: string }) => {
      const { data, error } = await supabase
        .from("opportunities")
        .update({
          current_stage_id: newStageId,
          stage_changed_at: new Date().toISOString(),
        })
        .eq("id", opportunityId)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onMutate: async ({ opportunityId, newStageId }) => {
      await queryClient.cancelQueries({ queryKey: ["opportunities", workspaceId] });

      const previousOpportunities = queryClient.getQueryData(["opportunities", workspaceId]);

      queryClient.setQueryData(["opportunities", workspaceId], (old: any) => {
        if (!old) return old;
        return old.map((opp: any) =>
          opp.id === opportunityId
            ? { ...opp, current_stage_id: newStageId, stage_changed_at: new Date().toISOString() }
            : opp
        );
      });

      return { previousOpportunities };
    },
    onError: (err, variables, context) => {
      if (context?.previousOpportunities) {
        queryClient.setQueryData(["opportunities", workspaceId], context.previousOpportunities);
      }
      toast.error(err.message || "Erro ao mover oportunidade");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["opportunities", workspaceId] });
      toast.success("Oportunidade movida com sucesso");
    },
  });

  const handleDragStart = (event: DragStartEvent) => {
    const opportunity = opportunities.find((opp) => opp.id === event.active.id);
    setActiveOpportunity(opportunity);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveOpportunity(null);

    if (!over) return;

    const opportunityId = active.id as string;
    const newStageId = over.id as string;

    const opportunity = opportunities.find((opp) => opp.id === opportunityId);
    if (opportunity?.current_stage_id === newStageId) return;

    const newStage = stages.find((s) => s.id === newStageId);

    if (newStage?.is_final) {
      toast.warning("Use o diálogo da oportunidade para marcar como Ganho/Perdido");
      return;
    }

    if (newStage?.requires_lead_score_feedback) {
      setPendingOpportunityId(opportunityId);
      setPendingStageId(newStageId);
      setScoreModalOpen(true);
      return;
    }

    updateStageMutation.mutate({ opportunityId, newStageId });
  };

  const firstNonFinalStageId = [...stages]
    .filter(s => !s.is_final)
    .sort((a, b) => a.order_position - b.order_position)?.[0]?.id;

  const getOpportunitiesByStage = (stageId: string) => {
    return opportunities.filter((opp) => (opp.current_stage_id || firstNonFinalStageId) === stageId);
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="flex gap-4 overflow-x-auto pb-4">
        {stages.map((stage) => (
          <KanbanColumn
            key={stage.id}
            stage={stage}
            opportunities={getOpportunitiesByStage(stage.id)}
            onCardClick={onCardClick}
          />
        ))}
      </div>

      <DragOverlay>
        {activeOpportunity ? (
          <OpportunityCard opportunity={activeOpportunity} onClick={() => { }} isOverlay />
        ) : null}
      </DragOverlay>

      <LeadScoreFeedbackModal
        open={scoreModalOpen}
        onOpenChange={setScoreModalOpen}
        opportunityId={pendingOpportunityId}
        targetStageId={pendingStageId}
        onSuccess={() => {
          setPendingOpportunityId(null);
          setPendingStageId(null);
        }}
      />
    </DndContext>
  );
}
