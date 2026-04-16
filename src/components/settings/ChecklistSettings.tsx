import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Plus, ListChecks, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { ChecklistTemplate } from "@/types/operations";
import { ChecklistTemplateDialog } from "./ChecklistTemplateDialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export function ChecklistSettings() {
  const { currentWorkspace } = useWorkspace();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<ChecklistTemplate | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const { data: stages = [] } = useQuery({
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

  const { data: templates = [], isLoading } = useQuery({
    queryKey: ["checklist-templates", currentWorkspace?.id],
    queryFn: async () => {
      if (!currentWorkspace?.id) return [];
      const { data, error } = await (supabase as any)
        .from("checklist_templates")
        .select(`
          *,
          opportunity_stages (id, name, color),
          checklist_template_items (*)
        `)
        .eq("workspace_id", currentWorkspace.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []).map((t: any) => ({
        ...t,
        items: t.checklist_template_items || [],
      })) as ChecklistTemplate[];
    },
    enabled: !!currentWorkspace?.id,
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await (supabase as any)
        .from("checklist_templates")
        .update({ is_active })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["checklist-templates"] });
      toast.success("Template atualizado");
    },
    onError: () => toast.error("Erro ao atualizar template"),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any)
        .from("checklist_templates")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["checklist-templates"] });
      toast.success("Template removido");
      setDeleteId(null);
    },
    onError: () => toast.error("Erro ao remover template"),
  });

  const handleEdit = (template: ChecklistTemplate) => {
    setEditingTemplate(template);
    setDialogOpen(true);
  };

  const handleCreate = () => {
    setEditingTemplate(null);
    setDialogOpen(true);
  };

  // Group templates by stage
  const templatesByStage = stages.map((stage: any) => ({
    stage,
    templates: templates.filter((t) => t.stage_id === stage.id),
  }));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold">Checklist por Estágio</h2>
          <p className="text-muted-foreground">
            Configure templates de checklist que serão criados automaticamente quando uma oportunidade mudar de estágio.
          </p>
        </div>
        <Button onClick={handleCreate}>
          <Plus className="mr-2 h-4 w-4" />
          Novo Template
        </Button>
      </div>

      {isLoading ? (
        <div className="text-center py-8 text-muted-foreground">Carregando templates...</div>
      ) : stages.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            Configure os estágios do pipeline primeiro na aba "Pipeline CRM".
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {templatesByStage.map(({ stage, templates: stageTemplates }) => (
            <Card key={stage.id}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: stage.color || "#6B7280" }}
                    />
                    <CardTitle className="text-base">{stage.name}</CardTitle>
                    {stage.is_final && (
                      <Badge variant="outline" className="text-[10px]">Final</Badge>
                    )}
                  </div>
                  {stageTemplates.length === 0 && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setEditingTemplate({ stage_id: stage.id } as any);
                        setDialogOpen(true);
                      }}
                    >
                      <Plus className="mr-1 h-3 w-3" />
                      Criar Template
                    </Button>
                  )}
                </div>
              </CardHeader>
              {stageTemplates.length > 0 && (
                <CardContent className="pt-0">
                  <div className="space-y-3">
                    {stageTemplates.map((template) => (
                      <div
                        key={template.id}
                        className="flex items-center justify-between p-4 rounded-xl border bg-muted/30"
                      >
                        <div className="flex items-center gap-3">
                          <ListChecks className="h-5 w-5 text-primary" />
                          <div>
                            <p className="font-semibold text-sm">{template.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {template.items?.length || 0} tarefa(s)
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <Switch
                            checked={template.is_active}
                            onCheckedChange={(checked) =>
                              toggleMutation.mutate({ id: template.id, is_active: checked })
                            }
                          />
                          <Button variant="ghost" size="icon" onClick={() => handleEdit(template)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-destructive hover:text-destructive"
                            onClick={() => setDeleteId(template.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              )}
            </Card>
          ))}
        </div>
      )}

      <ChecklistTemplateDialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) setEditingTemplate(null);
        }}
        template={editingTemplate}
        stages={stages}
      />

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover template?</AlertDialogTitle>
            <AlertDialogDescription>
              Essa ação não pode ser desfeita. As tarefas já criadas a partir deste template não serão afetadas.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteId && deleteMutation.mutate(deleteId)}
            >
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
