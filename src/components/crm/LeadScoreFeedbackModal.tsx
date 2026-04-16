import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { cn } from "@/lib/utils";
import { Snowflake, Sun, Flame } from "lucide-react";

interface LeadScoreFeedbackModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    opportunityId: string | null;
    targetStageId: string | null;
    onSuccess?: (newScore: "frio" | "morno" | "quente") => void;
}

const scoreOptions = [
    { value: "frio", label: "Frio", icon: Snowflake, description: "Baixa possibilidade de fechamento", color: "text-sky-500", bgActive: "bg-sky-500/10 border-sky-500", bgHover: "hover:bg-sky-50" },
    { value: "morno", label: "Morno", icon: Sun, description: "Tem intenção, mas não sentiu firmeza", color: "text-amber-500", bgActive: "bg-amber-500/10 border-amber-500", bgHover: "hover:bg-amber-50" },
    { value: "quente", label: "Quente", icon: Flame, description: "Alta probabilidade de fechamento", color: "text-rose-500", bgActive: "bg-rose-500/10 border-rose-500", bgHover: "hover:bg-rose-50" },
] as const;

export function LeadScoreFeedbackModal({ open, onOpenChange, opportunityId, targetStageId, onSuccess }: LeadScoreFeedbackModalProps) {
    const { currentWorkspace } = useWorkspace();
    const queryClient = useQueryClient();
    const [score, setScore] = useState<"frio" | "morno" | "quente" | null>(null);
    const [feedback, setFeedback] = useState("");

    useEffect(() => {
        if (open) {
            setScore(null);
            setFeedback("");
        }
    }, [open]);

    const submitMutation = useMutation({
        mutationFn: async () => {
            if (!opportunityId || !targetStageId) throw new Error("Dados da oportunidade faltando");
            if (!score) throw new Error("Selecione o Lead Score");
            if (!feedback.trim()) throw new Error("Preencha o feedback da reunião");

            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error("Usuário não autenticado");

            // 1. Atualiza a oportunidade com o novo estágio e o lead score
            const { error: updateError } = await supabase
                .from("opportunities")
                .update({
                    current_stage_id: targetStageId,
                    stage_changed_at: new Date().toISOString(),
                    lead_score: score,
                })
                .eq("id", opportunityId);

            if (updateError) throw updateError;

            // 2. Insere a atividade (feedback) na linha do tempo
            const { error: noteError } = await supabase
                .from("opportunity_notes")
                .insert({
                    opportunity_id: opportunityId,
                    created_by: user.id,
                    note_type: "meeting", // Usando o tipo de reunião
                    content: `**Feedback de Reunião e Avaliação (Score: ${score.toUpperCase()})**\n\n${feedback}`,
                });

            if (noteError) throw noteError;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["opportunities", currentWorkspace?.id] });
            queryClient.invalidateQueries({ queryKey: ["opportunity-notes", opportunityId] });
            queryClient.invalidateQueries({ queryKey: ["opportunity-timeline", opportunityId] });
            toast.success("Lead atualizado e feedback registrado!");
            if (score) onSuccess?.(score);
            onOpenChange(false);
        },
        onError: (error: any) => {
            toast.error(error.message || "Erro ao registrar avaliação");
        }
    });

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        submitMutation.mutate();
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[500px] z-[9999]" overlayClassName="z-[9998]">
                <form onSubmit={handleSubmit}>
                    <DialogHeader>
                        <DialogTitle>Avaliação do Lead e Feedback</DialogTitle>
                        <DialogDescription>
                            Este estágio exige que você avalie a temperatura do lead e registre o feedback da reunião.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-6 py-4">
                        <div className="space-y-3">
                            <label className="text-sm font-semibold leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                                1. Qual a temperatura do lead?
                            </label>
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                {scoreOptions.map((option) => (
                                    <label
                                        key={option.value}
                                        className={cn(
                                            "flex flex-col items-center justify-center gap-2 rounded-xl border-2 p-3 cursor-pointer transition-all",
                                            "hover:-translate-y-0.5",
                                            score === option.value ? option.bgActive : "border-muted bg-transparent " + option.bgHover
                                        )}
                                    >
                                        <input
                                            type="radio"
                                            name="leadScore"
                                            value={option.value}
                                            className="sr-only"
                                            checked={score === option.value}
                                            onChange={() => setScore(option.value)}
                                        />
                                        <option.icon className={cn("w-6 h-6", score === option.value ? option.color : "text-muted-foreground")} />
                                        <span className={cn("font-bold text-sm", score === option.value ? option.color : "text-card-foreground")}>
                                            {option.label}
                                        </span>
                                        <span className="text-[9px] text-center text-muted-foreground leading-tight px-1">
                                            {option.description}
                                        </span>
                                    </label>
                                ))}
                            </div>
                        </div>

                        <div className="space-y-3">
                            <label className="text-sm font-semibold leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                                2. Como foi a reunião? (Feedback)
                            </label>
                            <Textarea
                                placeholder="Descreva os pontos principais da reunião, objeções, próximos passos..."
                                value={feedback}
                                onChange={(e) => setFeedback(e.target.value)}
                                className="min-h-[120px] resize-none"
                                required
                            />
                        </div>
                    </div>

                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={submitMutation.isPending}>
                            Cancelar Movimentação
                        </Button>
                        <Button type="submit" disabled={submitMutation.isPending || !score || !feedback.trim()}>
                            {submitMutation.isPending ? "Salvando..." : "Salvar e Mover"}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
