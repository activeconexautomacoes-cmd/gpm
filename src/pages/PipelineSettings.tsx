import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, Settings } from "lucide-react";
import { toast } from "sonner";
import { StageCard } from "@/components/crm/StageCard";
import { StageDialog } from "@/components/crm/StageDialog";
import { CRMSchedulingSettings } from "@/components/crm/CRMSchedulingSettings";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";

export default function PipelineSettings() {
  const { currentWorkspace, can } = useWorkspace();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingStage, setEditingStage] = useState<any>(null);



  const { data: stages = [], isLoading } = useQuery({
    queryKey: ["opportunity-stages", currentWorkspace?.id],
    queryFn: async () => {
      if (!currentWorkspace?.id) return [];

      const { data, error } = await supabase
        .from("opportunity_stages")
        .select("*")
        .eq("workspace_id", currentWorkspace.id)
        .order("order_position");

      if (error) throw error;
      return data;
    },
    enabled: !!currentWorkspace?.id,
  });

  const reorderMutation = useMutation({
    mutationFn: async (newOrder: { id: string; order_position: number }[]) => {
      const updates = newOrder.map(({ id, order_position }) =>
        supabase
          .from("opportunity_stages")
          .update({ order_position })
          .eq("id", id)
      );

      await Promise.all(updates);
    },
    onMutate: async (newOrder) => {
      await queryClient.cancelQueries({ queryKey: ["opportunity-stages"] });
      const previous = queryClient.getQueryData(["opportunity-stages", currentWorkspace?.id]);

      queryClient.setQueryData(["opportunity-stages", currentWorkspace?.id], (old: any[]) => {
        if (!old) return old;
        const reordered = [...old];
        newOrder.forEach(({ id, order_position }) => {
          const stage = reordered.find((s) => s.id === id);
          if (stage) stage.order_position = order_position;
        });
        return reordered.sort((a, b) => a.order_position - b.order_position);
      });

      return { previous };
    },
    onError: (err, variables, context: any) => {
      if (context?.previous) {
        queryClient.setQueryData(["opportunity-stages", currentWorkspace?.id], context.previous);
      }
      toast.error("Erro ao reordenar estágios");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["opportunity-stages"] });
      queryClient.invalidateQueries({ queryKey: ["opportunities"] });
      toast.success("Ordem atualizada");
    },
  });

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (!over || active.id === over.id) return;

    const oldIndex = stages.findIndex((s) => s.id === active.id);
    const newIndex = stages.findIndex((s) => s.id === over.id);

    const reordered = arrayMove(stages, oldIndex, newIndex);
    const newOrder = reordered.map((stage, index) => ({
      id: stage.id,
      order_position: index + 1,
    }));

    reorderMutation.mutate(newOrder);
  };

  const handleEdit = (stage: any) => {
    setEditingStage(stage);
    setDialogOpen(true);
  };

  const handleCreate = () => {
    setEditingStage(null);
    setDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setEditingStage(null);
  };

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  if (!can('pipeline.config')) {
    return (
      <div className="p-8">
        <Card>
          <CardHeader>
            <CardTitle>Acesso Negado</CardTitle>
            <CardDescription>
              Você não tem permissão para configurar o pipeline.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold">Estágios do Pipeline</h2>
          <p className="text-muted-foreground">
            Personalize os estágios do seu funil de vendas. Arraste para reordenar.
          </p>
        </div>
        <Button onClick={handleCreate}>
          <Plus className="mr-2 h-4 w-4" />
          Novo Estágio
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Estágios do Pipeline</CardTitle>
          <CardDescription>
            Arraste os estágios para reorganizar. Estágios finais não podem ser reordenados por drag & drop.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">Carregando estágios...</div>
          ) : stages.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Nenhum estágio configurado. Clique em "Novo Estágio" para começar.
            </div>
          ) : (
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <SortableContext items={stages.map((s) => s.id)} strategy={verticalListSortingStrategy}>
                <div className="space-y-2">
                  {stages.map((stage) => (
                    <StageCard key={stage.id} stage={stage} onEdit={handleEdit} />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          )}
        </CardContent>
      </Card>

      <CRMSchedulingSettings />

      <StageDialog open={dialogOpen} onOpenChange={handleCloseDialog} stage={editingStage} />
    </div>
  );
}
