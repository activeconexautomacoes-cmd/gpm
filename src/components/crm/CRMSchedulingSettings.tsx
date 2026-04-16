import { useState } from "react";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2, Calendar, Clock } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";

export function CRMSchedulingSettings() {
    const { currentWorkspace, loadWorkspaces } = useWorkspace();
    const queryClient = useQueryClient();
    const [template, setTemplate] = useState(currentWorkspace?.crm_meeting_template || "[GPM] Reunião: {lead_name}");
    const [duration, setDuration] = useState(currentWorkspace?.crm_meeting_duration?.toString() || "30");

    const mutation = useMutation({
        mutationFn: async () => {
            if (!currentWorkspace?.id) return;
            const { error } = await supabase
                .from("workspaces")
                .update({
                    crm_meeting_template: template,
                    crm_meeting_duration: parseInt(duration),
                })
                .eq("id", currentWorkspace.id);

            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["workspace"] });
            loadWorkspaces();
            toast.success("Configurações de agendamento atualizadas!");
        },
        onError: (error) => {
            console.error(error);
            toast.error("Erro ao atualizar configurações");
        },
    });

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <Calendar className="h-5 w-5 text-primary" />
                    Configurações de Agendamento
                </CardTitle>
                <CardDescription>
                    Configure como os eventos serão criados no Google Calendar através do CRM.
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
                <div className="space-y-2">
                    <Label htmlFor="template">Template do Título da Reunião</Label>
                    <Input
                        id="template"
                        value={template}
                        onChange={(e) => setTemplate(e.target.value)}
                        placeholder="Ex: Reunião: {lead_name}"
                    />
                    <p className="text-xs text-muted-foreground">
                        Variáveis disponíveis: <code className="bg-muted px-1 rounded">{`{lead_name}`}</code>, <code className="bg-muted px-1 rounded">{`{lead_company}`}</code>
                    </p>
                </div>

                <div className="space-y-2">
                    <Label htmlFor="duration" className="flex items-center gap-2">
                        <Clock className="h-4 w-4" />
                        Duração Padrão (minutos)
                    </Label>
                    <Input
                        id="duration"
                        type="number"
                        value={duration}
                        onChange={(e) => setDuration(e.target.value)}
                        min="5"
                        max="480"
                    />
                </div>

                <Button
                    onClick={() => mutation.mutate()}
                    disabled={mutation.isPending}
                    className="w-full sm:w-auto"
                >
                    {mutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Salvar Configurações
                </Button>
            </CardContent>
        </Card>
    );
}
