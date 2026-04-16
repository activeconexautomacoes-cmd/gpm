import { useState } from "react";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Edit2, Trash2, GripVertical } from "lucide-react";
import { toast } from "sonner";
import { StageDeleteDialog } from "./StageDeleteDialog";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { cn } from "@/lib/utils";

interface StageCardProps {
  stage: any;
  onEdit: (stage: any) => void;
}

export function StageCard({ stage, onEdit }: StageCardProps) {
  const { currentWorkspace } = useWorkspace();
  const queryClient = useQueryClient();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: stage.id,
    disabled: stage.is_final,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const { data: opportunityCount = 0 } = useQuery({
    queryKey: ["stage-opportunity-count", stage.id],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("opportunities")
        .select("*", { count: "exact", head: true })
        .eq("current_stage_id", stage.id);

      if (error) throw error;
      return count || 0;
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      if (opportunityCount > 0) {
        throw new Error("Não é possível deletar um estágio que contém oportunidades");
      }

      const { error } = await supabase.from("opportunity_stages").delete().eq("id", stage.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["opportunity-stages"] });
      toast.success("Estágio deletado com sucesso");
      setDeleteDialogOpen(false);
    },
    onError: (error: any) => {
      toast.error(error.message || "Erro ao deletar estágio");
    },
  });

  const handleDelete = () => {
    deleteMutation.mutate();
  };

  return (
    <>
      <Card
        ref={setNodeRef}
        style={style}
        className={cn(
          "p-4 transition-all",
          isDragging && "opacity-50 scale-105 shadow-lg",
          !stage.is_final && "cursor-move"
        )}
      >
        <div className="flex items-center gap-4">
          {!stage.is_final && (
            <div {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing">
              <GripVertical className="h-5 w-5 text-muted-foreground" />
            </div>
          )}

          <div className="flex items-center gap-3 flex-1">
            <div className="w-4 h-4 rounded-full" style={{ backgroundColor: stage.color }} />
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className="font-semibold">{stage.name}</span>
                {stage.is_final && <Badge variant="secondary">Final</Badge>}
                {stage.is_sql && <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100 border-blue-200" variant="outline">SQL</Badge>}
              </div>
              <div className="text-sm text-muted-foreground">
                Posição: {stage.order_position} • {opportunityCount} oportunidade(s)
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={() => onEdit(stage)}>
              <Edit2 className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setDeleteDialogOpen(true)}
              disabled={opportunityCount > 0}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </Card>

      <StageDeleteDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        stage={stage}
        opportunityCount={opportunityCount}
        onConfirm={handleDelete}
        isLoading={deleteMutation.isPending}
      />
    </>
  );
}
