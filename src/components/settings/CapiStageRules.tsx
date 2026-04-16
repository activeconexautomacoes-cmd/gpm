import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, Check, Zap } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";

interface CapiStageRulesProps {
    workspaceId: string;
}

interface Stage {
    id: string;
    name: string;
    color: string;
    order_position: number;
}

interface Rule {
    id?: string;
    stage_id: string;
    event_name: string;
    is_active: boolean;
}

export function CapiStageRules({ workspaceId }: CapiStageRulesProps) {
    const [stages, setStages] = useState<Stage[]>([]);
    const [rules, setRules] = useState<Record<string, Rule>>({});
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (workspaceId) fetchData();
    }, [workspaceId]);

    const fetchData = async () => {
        setLoading(true);
        try {
            // Buscar etapas do pipeline
            const { data: stagesData, error: stagesError } = await (supabase as any)
                .from("opportunity_stages")
                .select("id, name, color, order_position")
                .eq("workspace_id", workspaceId)
                .order("order_position", { ascending: true });

            if (stagesError) throw stagesError;
            setStages(stagesData || []);

            // Buscar regras existentes
            const { data: rulesData, error: rulesError } = await (supabase as any)
                .from("capi_stage_rules")
                .select("id, stage_id, event_name, is_active")
                .eq("workspace_id", workspaceId);

            if (rulesError) throw rulesError;

            const rulesMap: Record<string, Rule> = {};
            (rulesData || []).forEach((r: any) => {
                rulesMap[r.stage_id] = {
                    id: r.id,
                    stage_id: r.stage_id,
                    event_name: r.event_name,
                    is_active: r.is_active,
                };
            });
            setRules(rulesMap);
        } catch (error: any) {
            console.error(error);
            toast.error("Erro ao carregar regras CAPI");
        } finally {
            setLoading(false);
        }
    };

    const updateRule = (stageId: string, field: keyof Rule, value: any) => {
        setRules(prev => ({
            ...prev,
            [stageId]: {
                ...prev[stageId],
                stage_id: stageId,
                event_name: prev[stageId]?.event_name || "",
                is_active: prev[stageId]?.is_active ?? false,
                [field]: value,
            }
        }));
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            for (const [stageId, rule] of Object.entries(rules)) {
                if (!rule.event_name.trim()) {
                    // Se não tem event_name e existe no banco, deletar
                    if (rule.id) {
                        await (supabase as any)
                            .from("capi_stage_rules")
                            .delete()
                            .eq("id", rule.id);
                    }
                    continue;
                }

                const payload = {
                    workspace_id: workspaceId,
                    stage_id: stageId,
                    event_name: rule.event_name.trim(),
                    is_active: rule.is_active,
                };

                if (rule.id) {
                    const { error } = await (supabase as any)
                        .from("capi_stage_rules")
                        .update(payload)
                        .eq("id", rule.id);
                    if (error) throw error;
                } else {
                    const { error } = await (supabase as any)
                        .from("capi_stage_rules")
                        .insert(payload);
                    if (error) throw error;
                }
            }

            toast.success("Regras CAPI salvas com sucesso!");
            fetchData();
        } catch (error: any) {
            console.error(error);
            toast.error("Erro ao salvar regras: " + error.message);
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <Card>
                <CardContent className="py-8 text-center text-muted-foreground">
                    <Loader2 className="h-6 w-6 animate-spin mx-auto" />
                </CardContent>
            </Card>
        );
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <Zap className="h-5 w-5 text-amber-500" />
                    Eventos CAPI por Etapa do CRM
                </CardTitle>
                <CardDescription>
                    Configure quais eventos personalizados da Meta Conversions API devem ser disparados quando uma oportunidade entra em cada etapa do pipeline.
                    Deixe o campo vazio para não disparar evento naquela etapa.
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                {stages.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-6">
                        Nenhuma etapa de pipeline encontrada. Configure as etapas do CRM primeiro.
                    </p>
                ) : (
                    <>
                        <div className="space-y-3">
                            {stages.map((stage) => {
                                const rule = rules[stage.id];
                                return (
                                    <div
                                        key={stage.id}
                                        className="flex flex-col sm:flex-row sm:items-center gap-3 p-4 bg-muted/20 rounded-xl border border-border"
                                    >
                                        <div className="flex items-center gap-2 sm:w-48 shrink-0">
                                            <div
                                                className="w-3 h-3 rounded-full shrink-0"
                                                style={{ backgroundColor: stage.color || "#6366f1" }}
                                            />
                                            <span className="text-sm font-semibold truncate">{stage.name}</span>
                                        </div>
                                        <div className="flex-1">
                                            <Input
                                                placeholder="Nome do evento (ex: LEAD, LEAD_QUALIFICADO)"
                                                value={rule?.event_name || ""}
                                                onChange={(e) => updateRule(stage.id, "event_name", e.target.value)}
                                                className="h-9 text-sm"
                                            />
                                        </div>
                                        <div className="flex items-center gap-2 shrink-0">
                                            <span className="text-[10px] text-muted-foreground uppercase font-bold">
                                                {rule?.is_active ? "Ativo" : "Inativo"}
                                            </span>
                                            <Switch
                                                checked={rule?.is_active || false}
                                                onCheckedChange={(checked) => updateRule(stage.id, "is_active", checked)}
                                                disabled={!rule?.event_name?.trim()}
                                            />
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                        <div className="flex justify-end pt-2">
                            <Button
                                onClick={handleSave}
                                disabled={saving}
                                className="bg-amber-500 hover:bg-amber-600"
                            >
                                {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Check className="h-4 w-4 mr-2" />}
                                Salvar Regras
                            </Button>
                        </div>

                        <div className="mt-4 p-3 bg-muted/30 rounded-lg border border-border/50">
                            <p className="text-[11px] text-muted-foreground">
                                <strong>Como funciona:</strong> Quando uma oportunidade entra em uma etapa com regra ativa, o evento configurado
                                é enviado automaticamente para a Meta via Conversions API. Isso inclui leads novos (primeira etapa) e mudanças
                                de etapa no Kanban. Leads sem dados do Facebook (fbclid) ainda serão enviados com matching por e-mail/telefone.
                            </p>
                        </div>
                    </>
                )}
            </CardContent>
        </Card>
    );
}
