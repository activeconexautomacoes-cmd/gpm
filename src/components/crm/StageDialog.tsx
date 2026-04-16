import { useState, useEffect } from "react";
import { useQueryClient, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { CalendarClock } from "lucide-react";

interface StageDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  stage?: any;
}

const presetColors = [
  { value: "#6366f1", label: "Indigo" },
  { value: "#8b5cf6", label: "Purple" },
  { value: "#ec4899", label: "Pink" },
  { value: "#f59e0b", label: "Amber" },
  { value: "#10b981", label: "Green" },
  { value: "#3b82f6", label: "Blue" },
  { value: "#22c55e", label: "Success" },
  { value: "#ef4444", label: "Red" },
];

export function StageDialog({ open, onOpenChange, stage }: StageDialogProps) {
  const { currentWorkspace } = useWorkspace();
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [color, setColor] = useState("#6366f1");
  const [isFinal, setIsFinal] = useState(false);
  const [isSql, setIsSql] = useState(false);
  const [isDisqualified, setIsDisqualified] = useState(false);
  const [isScheduling, setIsScheduling] = useState(false);
  const [requiresLeadScoreFeedback, setRequiresLeadScoreFeedback] = useState(false);

  useEffect(() => {
    if (stage) {
      setName(stage.name);
      setColor(stage.color);
      setIsFinal(stage.is_final);
      setIsSql(stage.is_sql || false);
      setIsDisqualified(stage.is_disqualified || false);
      setIsScheduling(stage.is_scheduling || false);
      setRequiresLeadScoreFeedback(stage.requires_lead_score_feedback || false);
    } else {
      setName("");
      setColor("#6366f1");
      setIsFinal(false);
      setIsSql(false);
      setIsDisqualified(false);
      setIsScheduling(false);
      setRequiresLeadScoreFeedback(false);
    }
  }, [stage, open]);

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!currentWorkspace?.id) throw new Error("Workspace não encontrado");

      const { data: stages } = await (supabase as any)
        .from("opportunity_stages")
        .select("order_position")
        .eq("workspace_id", currentWorkspace.id)
        .order("order_position", { ascending: false })
        .limit(1);

      const nextPosition = (stages?.[0]?.order_position || 0) + 1;

      const { data, error } = await (supabase as any)
        .from("opportunity_stages")
        .insert({
          workspace_id: currentWorkspace.id,
          name,
          color,
          is_final: isFinal,
          is_sql: isSql,
          is_disqualified: isDisqualified,
          is_scheduling: isScheduling,
          requires_lead_score_feedback: requiresLeadScoreFeedback,
          order_position: nextPosition,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["opportunity-stages"] });
      toast.success("Estágio criado com sucesso");
      onOpenChange(false);
    },
    onError: (error: any) => {
      if (error.message?.includes("duplicate")) {
        toast.error("Já existe um estágio com este nome");
      } else {
        toast.error("Erro ao criar estágio");
      }
    },
  });

  const updateMutation = useMutation({
    mutationFn: async () => {
      if (!stage?.id) throw new Error("Estágio não encontrado");

      const { error } = await (supabase as any)
        .from("opportunity_stages")
        .update({
          name,
          color,
          is_final: isFinal,
          is_sql: isSql,
          is_disqualified: isDisqualified,
          is_scheduling: isScheduling,
          requires_lead_score_feedback: requiresLeadScoreFeedback,
        })
        .eq("id", stage.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["opportunity-stages"] });
      queryClient.invalidateQueries({ queryKey: ["opportunities"] });
      toast.success("Estágio atualizado com sucesso");
      onOpenChange(false);
    },
    onError: (error: any) => {
      if (error.message?.includes("duplicate")) {
        toast.error("Já existe um estágio com este nome");
      } else {
        toast.error("Erro ao atualizar estágio");
      }
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      toast.error("Nome do estágio é obrigatório");
      return;
    }

    if (stage) {
      updateMutation.mutate();
    } else {
      createMutation.mutate();
    }
  };

  const isLoading = createMutation.isPending || updateMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>{stage ? "Editar Estágio" : "Novo Estágio"}</DialogTitle>
            <DialogDescription>
              Configure o nome, cor e tipo do estágio do pipeline.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nome do Estágio</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex: Qualificação"
                required
              />
            </div>

            <div className="space-y-2">
              <Label>Cor do Estágio</Label>
              <div className="grid grid-cols-4 gap-2">
                {presetColors.map((preset) => (
                  <button
                    key={preset.value}
                    type="button"
                    className="relative h-10 rounded-md border-2 transition-all hover:scale-105"
                    style={{
                      backgroundColor: preset.value,
                      borderColor: color === preset.value ? "hsl(var(--primary))" : "transparent",
                    }}
                    onClick={() => setColor(preset.value)}
                    title={preset.label}
                  >
                    {color === preset.value && (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="h-2 w-2 rounded-full bg-white" />
                      </div>
                    )}
                  </button>
                ))}
              </div>
              <Input
                type="color"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                className="w-full h-10 cursor-pointer"
              />
            </div>

            <div className="space-y-3">
              <div className="flex items-center space-x-2">
                <Checkbox id="requires_lead_score_feedback" checked={requiresLeadScoreFeedback} onCheckedChange={(checked) => setRequiresLeadScoreFeedback(checked === true)} />
                <Label htmlFor="requires_lead_score_feedback" className="cursor-pointer font-bold text-primary">
                  Exigir Lead Score e Feedback da Reunião
                </Label>
              </div>

              <div className="flex items-center space-x-2 pt-2">
                <Checkbox id="is_scheduling" checked={isScheduling} onCheckedChange={(checked) => setIsScheduling(checked === true)} />
                <Label htmlFor="is_scheduling" className="cursor-pointer font-medium flex items-center gap-2">
                  <CalendarClock className="h-4 w-4 text-blue-500" />
                  Estágio de Agendamento
                </Label>
              </div>
              <p className="text-[11px] text-muted-foreground ml-6 -mt-2">
                Oportunidades com agendamento do Quiz irão automaticamente para este estágio.
              </p>

              <div className="flex items-center space-x-2 pt-2">
                <Checkbox id="is_sql" checked={isSql} onCheckedChange={(checked) => setIsSql(checked === true)} />
                <Label htmlFor="is_sql" className="cursor-pointer">
                  Considerar como SQL (Lead Qualificado)
                </Label>
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox id="is_final" checked={isFinal} onCheckedChange={(checked) => setIsFinal(checked === true)} />
                <Label htmlFor="is_final" className="cursor-pointer">
                  Este é um estágio final (Ganho/Perdido)
                </Label>
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox id="is_disqualified" checked={isDisqualified} onCheckedChange={(checked) => setIsDisqualified(checked === true)} />
                <Label htmlFor="is_disqualified" className="cursor-pointer">
                  Considerar como Desqualificado (Lead não-perfil)
                </Label>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isLoading}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? "Salvando..." : stage ? "Salvar Alterações" : "Criar Estágio"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
