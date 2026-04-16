import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { toast } from "sonner";
import {
    Loader2,
    Plus,
    Trash2,
    Copy,
    Settings2,
    ExternalLink,
    Check,
    Globe,
    ArrowRightLeft,
    RefreshCw,
    Activity
} from "lucide-react";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
    DialogFooter,
} from "@/components/ui/dialog";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";

export function WebhookIntegrations() {
    const { currentWorkspace } = useWorkspace();
    const [integrations, setIntegrations] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [creating, setCreating] = useState(false);
    const [selectedIntegration, setSelectedIntegration] = useState<any>(null);
    const [isMappingOpen, setIsMappingOpen] = useState(false);
    const [isCreatingOpen, setIsCreatingOpen] = useState(false);
    const [newName, setNewName] = useState("");
    const [mapping, setMapping] = useState<Record<string, string>>({});
    const [lastPayloadFields, setLastPayloadFields] = useState<string[]>([]);

    useEffect(() => {
        if (currentWorkspace?.id) {
            fetchIntegrations();
        }
    }, [currentWorkspace?.id]);

    const fetchIntegrations = async () => {
        if (!currentWorkspace?.id) return;
        setLoading(true);
        try {
            const { data, error } = await (supabase as any)
                .from("webhook_integrations")
                .select("*")
                .eq("workspace_id", currentWorkspace.id)
                .order("created_at", { ascending: false });

            if (error) throw error;
            setIntegrations(data || []);
        } catch (error: any) {
            toast.error("Erro ao carregar webhooks: " + error.message);
        } finally {
            setLoading(false);
        }
    };

    const handleCreate = async () => {
        if (!newName || !currentWorkspace?.id) return;
        setCreating(true);
        try {
            const { data, error } = await (supabase as any)
                .from("webhook_integrations")
                .insert({
                    name: newName,
                    workspace_id: currentWorkspace.id,
                    mapping: {}
                })
                .select()
                .single();

            if (error) throw error;

            toast.success("Webhook criado com sucesso!");
            setNewName("");
            setIsCreatingOpen(false);
            fetchIntegrations();
        } catch (error: any) {
            toast.error("Erro ao criar: " + error.message);
        } finally {
            setCreating(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm("Tem certeza que deseja excluir este webhook?")) return;
        try {
            const { error } = await (supabase as any)
                .from("webhook_integrations")
                .delete()
                .eq("id", id);

            if (error) throw error;
            toast.success("Webhook excluído");
            fetchIntegrations();
        } catch (error: any) {
            toast.error("Erro ao excluir: " + error.message);
        }
    };

    const handleToggleActive = async (id: string, active: boolean) => {
        try {
            const { error } = await (supabase as any)
                .from("webhook_integrations")
                .update({ is_active: active })
                .eq("id", id);

            if (error) throw error;
            fetchIntegrations();
        } catch (error: any) {
            toast.error("Erro ao atualizar status");
        }
    };

    const handleToggleAutoHold = async (id: string, autoHold: boolean) => {
        try {
            const { error } = await (supabase as any)
                .from("webhook_integrations")
                .update({ auto_hold: autoHold })
                .eq("id", id);

            if (error) throw error;
            toast.success(autoHold ? "Retenção automática ativada" : "Retenção automática desativada");
            fetchIntegrations();
        } catch (error: any) {
            toast.error("Erro ao atualizar retenção");
        }
    };

    const openMapping = (int: any) => {
        setSelectedIntegration(int);
        setMapping(int.mapping || {});

        // Extract fields from last payload
        if (int.last_payload) {
            const fields: string[] = [];
            const extract = (obj: any, prefix = "") => {
                Object.keys(obj).forEach(key => {
                    const fullPath = prefix ? `${prefix}.${key}` : key;
                    if (typeof obj[key] === "object" && obj[key] !== null && !Array.isArray(obj[key])) {
                        extract(obj[key], fullPath);
                    } else {
                        fields.push(fullPath);
                    }
                });
            };
            extract(int.last_payload);
            setLastPayloadFields(fields);
        } else {
            setLastPayloadFields([]);
        }

        setIsMappingOpen(true);
    };

    const saveMapping = async () => {
        try {
            const { error } = await (supabase as any)
                .from("webhook_integrations")
                .update({ mapping })
                .eq("id", selectedIntegration.id);

            if (error) throw error;
            toast.success("Mapeamento salvo com sucesso!");
            setIsMappingOpen(false);
            fetchIntegrations();
        } catch (error: any) {
            toast.error("Erro ao salvar mapeamento");
        }
    };

    const copyUrl = (slug: string) => {
        const url = `https://rkngilknpcibcwalropj.supabase.co/functions/v1/webhook-handler?slug=${slug}`;
        navigator.clipboard.writeText(url);
        toast.success("URL copiada!");
    };

    const crmFields = [
        { label: "Nome do Lead", key: "lead_name" },
        { label: "WhatsApp/Telefone", key: "lead_phone" },
        { label: "E-mail", key: "lead_email" },
        { label: "Empresa", key: "lead_company" },
        { label: "Cargo", key: "lead_position" },
        { label: "Faturamento (do Lead)", key: "company_revenue" },
        { label: "Documento (CPF/CNPJ)", key: "lead_document" },
        { label: "Website", key: "company_website" },
        { label: "Instagram", key: "company_instagram" },
        { label: "Investimento Ads", key: "company_investment" },
        { label: "Origem (Source)", key: "source" },
        { label: "UTM Source", key: "utm_source" },
        { label: "UTM Medium", key: "utm_medium" },
        { label: "UTM Campaign", key: "utm_campaign" },
        { label: "UTM Term", key: "utm_term" },
        { label: "UTM Content", key: "utm_content" },
    ];

    if (loading && integrations.length === 0) {
        return <div className="flex justify-center p-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
    }

    return (
        <div className="space-y-6">
            <Card className="border-border shadow-sm bg-card/40">
                <CardHeader className="flex flex-row items-center justify-between space-y-0">
                    <div>
                        <CardTitle className="flex items-center gap-2">
                            <Globe className="h-5 w-5 text-emerald-600" />
                            Webhooks Entrada (Leads Externos)
                        </CardTitle>
                        <CardDescription>
                            Receba leads do Elementor, Typeform, WordPress, etc., diretamente no seu CRM.
                        </CardDescription>
                    </div>
                    <Dialog open={isCreatingOpen} onOpenChange={setIsCreatingOpen}>
                        <DialogTrigger asChild>
                            <Button className="bg-emerald-600 hover:bg-emerald-700">
                                <Plus className="h-4 w-4 mr-2" />
                                Novo Webhook
                            </Button>
                        </DialogTrigger>
                        <DialogContent>
                            <DialogHeader>
                                <DialogTitle>Criar Novo Webhook</DialogTitle>
                                <DialogDescription>
                                    Dê um nome para identificar a origem (ex: Landing Page Black Friday).
                                </DialogDescription>
                            </DialogHeader>
                            <div className="space-y-4 py-4">
                                <div className="space-y-2">
                                    <Label>Nome da Integração</Label>
                                    <Input
                                        placeholder="Ex: Leads Elementor Site"
                                        value={newName}
                                        onChange={(e) => setNewName(e.target.value)}
                                    />
                                </div>
                            </div>
                            <DialogFooter>
                                <Button variant="outline" onClick={() => setIsCreatingOpen(false)}>Cancelar</Button>
                                <Button onClick={handleCreate} disabled={creating || !newName}>
                                    {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : "Criar Webhook"}
                                </Button>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>
                </CardHeader>
                <CardContent>
                    <div className="space-y-4">
                        {integrations.length === 0 ? (
                            <div className="text-center py-12 border-2 border-dashed rounded-xl border-border bg-card/20">
                                <Activity className="h-12 w-12 text-muted-foreground/20 mx-auto mb-4" />
                                <p className="text-muted-foreground font-medium">Nenhum webhook configurado.</p>
                                <p className="text-sm text-muted-foreground/60">Crie um para começar a receber leads externos.</p>
                            </div>
                        ) : (
                            integrations.map((int) => (
                                <div key={int.id} className="bg-card p-5 rounded-2xl border border-border shadow-sm group hover:border-emerald-500/30 transition-all">
                                    <div className="flex items-center justify-between mb-4">
                                        <div className="flex items-center gap-3">
                                            <div className="h-10 w-10 bg-emerald-500/10 rounded-xl flex items-center justify-center text-emerald-500">
                                                <Globe className="h-5 w-5" />
                                            </div>
                                            <div>
                                                <h3 className="font-bold text-foreground">{int.name}</h3>
                                                <div className="flex items-center gap-2 mt-0.5">
                                                    <Badge variant={int.is_active ? "success" : "secondary"} className="text-[10px] h-5">
                                                        {int.is_active ? "Ativo" : "Inativo"}
                                                    </Badge>
                                                    <span className="text-[10px] text-muted-foreground uppercase font-black tracking-widest">
                                                        Criado em {new Date(int.created_at).toLocaleDateString()}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <div className="flex flex-col items-end mr-2">
                                                <span className="text-[9px] text-muted-foreground uppercase font-bold mb-1">Status Webhook</span>
                                                <Switch
                                                    checked={int.is_active}
                                                    onCheckedChange={(checked) => handleToggleActive(int.id, checked)}
                                                />
                                            </div>
                                            <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-red-500" onClick={() => handleDelete(int.id)}>
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    </div>

                                    <div className="bg-muted/50 p-3 rounded-xl flex items-center justify-between gap-3 border border-border/50">
                                        <code className="text-[11px] text-muted-foreground truncate flex-1 font-mono">
                                            {`https://rkngilknpcibcwalropj.supabase.co/functions/v1/webhook-handler?slug=${int.slug}`}
                                        </code>
                                        <Button variant="secondary" size="sm" className="h-8 px-3" onClick={() => copyUrl(int.slug)}>
                                            <Copy className="h-3.5 w-3.5 mr-2" />
                                            Copiar URL
                                        </Button>
                                    </div>

                                    <div className="mt-4 flex flex-wrap items-center justify-between gap-4 py-3 border-t border-border/50">
                                        <div className="flex items-center gap-3">
                                            <Button
                                                variant="secondary"
                                                size="sm"
                                                className="bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20 border-emerald-500/20"
                                                onClick={() => openMapping(int)}
                                            >
                                                <ArrowRightLeft className="h-3.5 w-3.5 mr-2" />
                                                Mapear Campos (De-Para)
                                            </Button>
                                            {int.last_payload && (
                                                <span className="text-[10px] text-muted-foreground font-medium">
                                                    Último envio: {new Date(int.updated_at).toLocaleString()}
                                                </span>
                                            )}
                                            {!int.last_payload && (
                                                <span className="text-[10px] text-amber-500 font-bold flex items-center gap-1">
                                                    <Activity className="h-3 w-3 animate-pulse" />
                                                    Aguardando primeiro envio de teste...
                                                </span>
                                            )}
                                        </div>

                                        <div className="flex items-center gap-4 bg-muted/30 px-3 py-1.5 rounded-lg border border-border/50">
                                            <div className="flex flex-col">
                                                <span className="text-[10px] font-bold text-foreground">Retenção de Webnário</span>
                                                <span className="text-[9px] text-muted-foreground">Segura o lead até o evento</span>
                                            </div>
                                            <Switch
                                                checked={int.auto_hold}
                                                onCheckedChange={(checked) => handleToggleAutoHold(int.id, checked)}
                                            />
                                        </div>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </CardContent>
            </Card>

            {/* MAPPING DIALOG */}
            <Dialog open={isMappingOpen} onOpenChange={setIsMappingOpen}>
                <DialogContent className="w-[95vw] sm:max-w-3xl max-h-[90vh] overflow-y-auto p-4 sm:p-6">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <Settings2 className="h-5 w-5" />
                            Mapeamento de Campos
                        </DialogTitle>
                        <DialogDescription>
                            Selecione qual campo do seu JSON externo corresponde a cada campo do CRM.
                        </DialogDescription>
                    </DialogHeader>

                    {!selectedIntegration?.last_payload ? (
                        <div className="py-12 text-center bg-muted/30 rounded-2xl border-2 border-dashed border-border">
                            <RefreshCw className="h-10 w-10 text-muted-foreground/30 mx-auto mb-4 animate-spin-slow" />
                            <p className="text-muted-foreground font-bold">Nenhum dado recebido ainda.</p>
                            <p className="text-xs text-muted-foreground/50 max-w-xs mx-auto mt-2">
                                Envie um teste do seu sistema externo para esta URL primeiro para que possamos identificar os campos disponíveis.
                            </p>
                        </div>
                    ) : (
                        <div className="space-y-6 py-4">
                            <div className="p-4 bg-background rounded-xl border border-border">
                                <p className="text-[10px] text-muted-foreground uppercase font-black mb-2">Exemplo do JSON Recebido:</p>
                                <pre className="text-[11px] text-emerald-500 overflow-x-hidden whitespace-pre-wrap break-all font-mono">
                                    {JSON.stringify(selectedIntegration?.last_payload, null, 2)}
                                </pre>
                            </div>

                            <div className="space-y-4">
                                <h4 className="font-bold text-foreground border-b border-border pb-2">Configurar De-Para</h4>
                                <div className="grid gap-4">
                                    {crmFields.map((field) => (
                                        <div key={field.key} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 bg-muted/20 rounded-xl border border-border">
                                            <div className="flex-1 min-w-0">
                                                <Label className="text-sm font-bold text-foreground block truncate">{field.label}</Label>
                                                <p className="text-[10px] text-muted-foreground italic">No GPM CRM</p>
                                            </div>
                                            <div className="hidden sm:flex items-center">
                                                <ArrowRightLeft className="h-4 w-4 text-muted-foreground/30" />
                                            </div>
                                            <div className="w-full sm:flex-1">
                                                <Select
                                                    value={mapping[field.key] || ""}
                                                    onValueChange={(val) => setMapping(prev => ({ ...prev, [field.key]: val }))}
                                                >
                                                    <SelectTrigger className="w-full bg-card h-10">
                                                        <SelectValue placeholder="Selecione o campo..." />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="none">Pular este campo</SelectItem>
                                                        {lastPayloadFields.map(f => (
                                                            <SelectItem key={f} value={f}>{f}</SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}

                    <DialogFooter className="mt-6">
                        <Button variant="outline" onClick={() => setIsMappingOpen(false)}>Cancelar</Button>
                        <Button onClick={saveMapping} className="bg-emerald-600 hover:bg-emerald-700">
                            Salvar Mapeamento
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
