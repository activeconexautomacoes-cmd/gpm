import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useState, useEffect, useRef } from "react";
import { Globe, Code2, Search, Webhook, Plus, Trash2, Users, Upload, Image as ImageIcon, Link as LinkIcon } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";

// Types for our new JSON columns
export type PixelConfig = {
    googleAnalyticsId?: string;
    googleTagManagerId?: string;
    metaPixelId?: string;
    customScripts?: {
        head?: string;
        body?: string;
        footer?: string;
    };
};

export type SeoConfig = {
    title?: string;
    description?: string;
    faviconUrl?: string;
};

export type WebhookConfig = {
    url?: string;
    token?: string;
    method?: 'POST' | 'GET';
    trigger?: 'completion' | 'step';
    headers?: { [key: string]: string };
};

export type ScoringRule = {
    min: number;
    max: number;
    product_id?: string;
    sdr_id?: string;
    closer_id?: string;
};

export type QuizGeneralSettings = {
    showStepIndicator?: boolean;
};

type QuizSettings = {
    title: string;
    description: string | null;
    slug: string;
    active: boolean | null;
    pixels: PixelConfig | null;
    seo: SeoConfig | null;
    webhook: WebhookConfig | null;
    scoring_rules: ScoringRule[] | null;
    settings: QuizGeneralSettings | null;
};

interface QuizSettingsDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    quiz: any; // Using any for now to facilitate the transition, ideally proper type
    onSave: (settings: QuizSettings) => void;
}

export function QuizSettingsDialog({ open, onOpenChange, quiz, onSave }: QuizSettingsDialogProps) {
    // Initialize form with safe defaults for JSON objects
    const [form, setForm] = useState<QuizSettings>({
        title: quiz.title || "",
        description: quiz.description || "",
        slug: quiz.slug || "",
        active: quiz.active,
        pixels: (quiz.pixels as PixelConfig) || {},
        seo: (quiz.seo as SeoConfig) || {},
        webhook: (quiz.webhook as WebhookConfig) || {},
        scoring_rules: (quiz.scoring_rules as ScoringRule[]) || [],
        settings: (quiz.settings as QuizGeneralSettings) || { showStepIndicator: true }
    });

    // Fetch Products and Members for Distribution
    const [products, setProducts] = useState<any[]>([]);
    const [members, setMembers] = useState<any[]>([]);

    useEffect(() => {
        const fetchData = async () => {
            if (!quiz.workspace_id) return;

            // Fetch Products
            const { data: prds } = await supabase
                .from("products")
                .select("*")
                .eq("workspace_id", quiz.workspace_id)
                .eq("is_active", true)
                .order("name");
            if (prds) setProducts(prds);

            // Fetch Members
            const { data: mems } = await supabase
                .from("workspace_members")
                .select("*, profiles(id, full_name, email, has_google_calendar)")
                .eq("workspace_id", quiz.workspace_id);
            if (mems) setMembers(mems);
        };

        if (open) fetchData();
    }, [quiz.workspace_id, open]);

    const sdrMembers = members.filter(m => ['sdr', 'sales_manager', 'admin', 'owner'].includes(m.role));
    const closerMembers = members.filter(m => {
        const profile = Array.isArray(m.profiles) ? m.profiles[0] : m.profiles;
        const hasGoogle = (profile as any)?.has_google_calendar;
        return hasGoogle;
    });

    useEffect(() => {
        setForm({
            title: quiz.title || "",
            description: quiz.description || "",
            slug: quiz.slug || "",
            active: quiz.active,
            pixels: (quiz.pixels as PixelConfig) || {},
            seo: (quiz.seo as SeoConfig) || {},
            webhook: (quiz.webhook as WebhookConfig) || {},
            scoring_rules: (quiz.scoring_rules as ScoringRule[]) || [],
            settings: (quiz.settings as QuizGeneralSettings) || { showStepIndicator: true }
        });
    }, [quiz]);

    const handleSave = () => {
        onSave(form);
        onOpenChange(false);
    };

    const [faviconTab, setFaviconTab] = useState<'image' | 'url'>('image');
    const faviconInputRef = useRef<HTMLInputElement>(null);

    async function handleFaviconUpload(event: React.ChangeEvent<HTMLInputElement>) {
        const file = event.target.files?.[0];
        if (!file) return;

        try {
            const fileExt = file.name.split('.').pop();
            const fileName = `favicon-${Math.random().toString(36).substring(7)}.${fileExt}`;
            const filePath = `${fileName}`;

            toast.info("Enviando favicon...");

            const { error: uploadError } = await supabase.storage
                .from('quiz-assets')
                .upload(filePath, file);

            if (uploadError) {
                throw uploadError;
            }

            const { data } = supabase.storage.from('quiz-assets').getPublicUrl(filePath);

            setForm(prev => ({
                ...prev,
                seo: { ...prev.seo, faviconUrl: data.publicUrl }
            }));

            toast.success("Favicon enviado com sucesso!");
        } catch (error) {
            console.error('Error uploading favicon:', error);
            toast.error("Erro ao enviar favicon.");
        }
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
                <DialogHeader>
                    <DialogTitle>Configurações do Quiz</DialogTitle>
                    <DialogDescription>
                        Gerencie as configurações gerais, rastreamento, SEO e integrações.
                    </DialogDescription>
                </DialogHeader>

                <div className="flex-1 overflow-y-auto py-4">
                    <Tabs defaultValue="general" className="w-full flex h-full gap-6">
                        <TabsList className="flex flex-col h-full w-48 justify-start bg-slate-50 p-2 gap-1">
                            <TabsTrigger value="general" className="w-full justify-start gap-2">
                                <Globe className="w-4 h-4" /> Geral
                            </TabsTrigger>
                            <TabsTrigger value="pixels" className="w-full justify-start gap-2">
                                <Code2 className="w-4 h-4" /> Pixel & Scripts
                            </TabsTrigger>
                            <TabsTrigger value="seo" className="w-full justify-start gap-2">
                                <Search className="w-4 h-4" /> SEO & Favicon
                            </TabsTrigger>
                            <TabsTrigger value="webhooks" className="w-full justify-start gap-2">
                                <Webhook className="w-4 h-4" /> Webhooks
                            </TabsTrigger>
                            <TabsTrigger value="distribution" className="w-full justify-start gap-2">
                                <Users className="w-4 h-4" /> Distribuição
                            </TabsTrigger>
                        </TabsList>

                        <div className="flex-1 pr-1">
                            {/* GENERAL TAB */}
                            <TabsContent value="general" className="space-y-4 m-0">
                                <div className="space-y-4">
                                    <div className="space-y-2">
                                        <Label htmlFor="title">Título do Quiz</Label>
                                        <Input
                                            id="title"
                                            value={form.title}
                                            onChange={e => setForm({ ...form, title: e.target.value })}
                                            placeholder="Ex: Quiz de Personalidade"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="slug">URL do Quiz (Slug)</Label>
                                        <div className="flex items-center gap-2">
                                            <span className="text-muted-foreground text-sm bg-slate-100 px-3 py-2 rounded-md">/quiz/</span>
                                            <Input
                                                id="slug"
                                                value={form.slug}
                                                onChange={e => setForm({ ...form, slug: e.target.value })}
                                                placeholder="meu-quiz-incrivel"
                                            />
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="desc">Descrição Interna</Label>
                                        <Textarea
                                            id="desc"
                                            value={form.description || ""}
                                            onChange={e => setForm({ ...form, description: e.target.value })}
                                            placeholder="Descrição para uso interno..."
                                        />
                                    </div>
                                    <div className="flex items-center justify-between border p-4 rounded-lg bg-slate-50/50">
                                        <div className="space-y-0.5">
                                            <Label htmlFor="active" className="text-base">Quiz Ativo</Label>
                                            <p className="text-xs text-muted-foreground">Se desativado, o quiz não será acessível publicamente.</p>
                                        </div>
                                        <Switch
                                            id="active"
                                            checked={!!form.active}
                                            onCheckedChange={c => setForm({ ...form, active: c })}
                                        />
                                    </div>

                                    <div className="flex items-center justify-between border p-4 rounded-lg bg-slate-50/50">
                                        <div className="space-y-0.5">
                                            <Label htmlFor="showStepIndicator" className="text-base">Mostrar Indicador de Etapas</Label>
                                            <p className="text-xs text-muted-foreground">Exibe "Etapa X de Y" no topo do quiz.</p>
                                        </div>
                                        <Switch
                                            id="showStepIndicator"
                                            checked={form.settings?.showStepIndicator !== false}
                                            onCheckedChange={c => setForm({
                                                ...form,
                                                settings: { ...form.settings, showStepIndicator: c }
                                            })}
                                        />
                                    </div>
                                </div>
                            </TabsContent>

                            {/* PIXELS TAB */}
                            <TabsContent value="pixels" className="space-y-6 m-0">
                                <div className="space-y-4">
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <Label>Google Analytics ID</Label>
                                            <Input
                                                value={form.pixels?.googleAnalyticsId || ""}
                                                onChange={e => setForm({
                                                    ...form,
                                                    pixels: { ...form.pixels, googleAnalyticsId: e.target.value }
                                                })}
                                                placeholder="G-XXXXXXXXXX"
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label>Google Tag Manager ID</Label>
                                            <Input
                                                value={form.pixels?.googleTagManagerId || ""}
                                                onChange={e => setForm({
                                                    ...form,
                                                    pixels: { ...form.pixels, googleTagManagerId: e.target.value }
                                                })}
                                                placeholder="GTM-XXXXXX"
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label>Meta Pixel ID (Facebook)</Label>
                                            <Input
                                                value={form.pixels?.metaPixelId || ""}
                                                onChange={e => setForm({
                                                    ...form,
                                                    pixels: { ...form.pixels, metaPixelId: e.target.value }
                                                })}
                                                placeholder="1234567890"
                                            />
                                        </div>
                                    </div>

                                    <div className="space-y-4 pt-4 border-t">
                                        <div className="space-y-2">
                                            <Label>Scripts no Header (Head)</Label>
                                            <Textarea
                                                className="font-mono text-xs h-32"
                                                value={form.pixels?.customScripts?.head || ""}
                                                onChange={e => setForm({
                                                    ...form,
                                                    pixels: {
                                                        ...form.pixels,
                                                        customScripts: { ...form.pixels?.customScripts, head: e.target.value }
                                                    }
                                                })}
                                                placeholder="<script>...</script>"
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label>Scripts no Início do Body (Body Start)</Label>
                                            <Textarea
                                                className="font-mono text-xs h-32"
                                                value={form.pixels?.customScripts?.body || ""}
                                                onChange={e => setForm({
                                                    ...form,
                                                    pixels: {
                                                        ...form.pixels,
                                                        customScripts: { ...form.pixels?.customScripts, body: e.target.value }
                                                    }
                                                })}
                                                placeholder="<noscript>...</noscript>"
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label>Scripts no Rodapé (Footer)</Label>
                                            <Textarea
                                                className="font-mono text-xs h-32"
                                                value={form.pixels?.customScripts?.footer || ""}
                                                onChange={e => setForm({
                                                    ...form,
                                                    pixels: {
                                                        ...form.pixels,
                                                        customScripts: { ...form.pixels?.customScripts, footer: e.target.value }
                                                    }
                                                })}
                                                placeholder="<script>...</script>"
                                            />
                                            <p className="text-xs text-muted-foreground">O código será carregado logo antes do fechamento da tag &lt;/body&gt;</p>
                                        </div>
                                    </div>
                                </div>
                            </TabsContent>

                            {/* SEO TAB */}
                            <TabsContent value="seo" className="space-y-6 m-0">
                                <div className="space-y-4">
                                    <div className="space-y-2">
                                        <Label>Título da Página (SEO)</Label>
                                        <Input
                                            value={form.seo?.title || ""}
                                            onChange={e => setForm({
                                                ...form,
                                                seo: { ...form.seo, title: e.target.value }
                                            })}
                                            placeholder={form.title || "Título que aparecerá na aba do navegador"}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Descrição da Página</Label>
                                        <Textarea
                                            value={form.seo?.description || ""}
                                            onChange={e => setForm({
                                                ...form,
                                                seo: { ...form.seo, description: e.target.value }
                                            })}
                                            placeholder="Breve descrição que aparece nos resultados do Google..."
                                        />
                                    </div>
                                    <div className="space-y-3">
                                        <Label>Favicon</Label>
                                        <div className="flex gap-6 items-start">
                                            {/* Preview Box */}
                                            <div className="h-28 w-28 rounded-xl border-2 border-dashed bg-slate-50 flex flex-col items-center justify-center overflow-hidden shrink-0 relative group">
                                                {form.seo?.faviconUrl ? (
                                                    <img src={form.seo.faviconUrl} alt="Favicon" className="w-12 h-12 object-contain mb-2" />
                                                ) : (
                                                    <Globe className="w-8 h-8 text-slate-300 mb-2" />
                                                )}
                                                <span className="text-[10px] text-slate-400 font-medium bg-slate-100 px-2 py-0.5 rounded-full">Preview</span>
                                            </div>

                                            <div className="flex-1 space-y-3">
                                                {/* Toggle */}
                                                <div className="flex bg-slate-100 p-1 rounded-lg w-fit">
                                                    <button
                                                        onClick={() => setFaviconTab('image')}
                                                        className={cn(
                                                            "px-4 py-1.5 text-xs font-semibold rounded-md transition-all flex items-center gap-2",
                                                            faviconTab === 'image' ? "bg-white shadow-sm text-slate-900" : "text-slate-500 hover:text-slate-700"
                                                        )}
                                                    >
                                                        <ImageIcon className="w-3.5 h-3.5" /> Imagem
                                                    </button>
                                                    <button
                                                        onClick={() => setFaviconTab('url')}
                                                        className={cn(
                                                            "px-4 py-1.5 text-xs font-semibold rounded-md transition-all flex items-center gap-2",
                                                            faviconTab === 'url' ? "bg-white shadow-sm text-slate-900" : "text-slate-500 hover:text-slate-700"
                                                        )}
                                                    >
                                                        <LinkIcon className="w-3.5 h-3.5" /> URL
                                                    </button>
                                                </div>

                                                {/* Content */}
                                                {faviconTab === 'image' ? (
                                                    <div
                                                        onClick={() => faviconInputRef.current?.click()}
                                                        className="border-2 border-dashed border-slate-200 rounded-xl p-6 flex flex-col items-center justify-center cursor-pointer hover:bg-slate-50 hover:border-slate-300 transition-all text-center gap-3 h-28"
                                                    >
                                                        <div className="h-10 w-10 bg-slate-100 rounded-full flex items-center justify-center group-hover:bg-white group-hover:shadow-sm transition-all">
                                                            <Upload className="h-5 w-5 text-slate-500" />
                                                        </div>
                                                        <div>
                                                            <p className="text-sm font-semibold text-slate-700">Clique para selecionar</p>
                                                            <p className="text-[10px] text-slate-400 mt-0.5">Recomendado: 32x32px (PNG ou ICO)</p>
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <div className="h-28 flex flex-col justify-center">
                                                        <Label className="mb-2 text-xs">Cole o link da imagem</Label>
                                                        <Input
                                                            value={form.seo?.faviconUrl || ""}
                                                            onChange={e => setForm({
                                                                ...form,
                                                                seo: { ...form.seo, faviconUrl: e.target.value }
                                                            })}
                                                            placeholder="https://exemplo.com/favicon.png"
                                                            className="bg-white"
                                                        />
                                                    </div>
                                                )}
                                                {/* Hidden Input (Always present) */}
                                                <input
                                                    type="file"
                                                    ref={faviconInputRef}
                                                    className="hidden"
                                                    accept="image/png,image/jpeg,image/svg+xml,image/x-icon"
                                                    onChange={handleFaviconUpload}
                                                />
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </TabsContent>

                            {/* WEBHOOKS TAB */}
                            <TabsContent value="webhooks" className="space-y-6 m-0">
                                {/* ... existing webhook content ... */}
                                <div className="space-y-4">
                                    <div className="space-y-2">
                                        <Label>URL do Webhook</Label>
                                        <Input
                                            value={form.webhook?.url || ""}
                                            onChange={e => setForm({
                                                ...form,
                                                webhook: { ...form.webhook, url: e.target.value }
                                            })}
                                            placeholder="https://n8n.exemplo.com/webhook/..."
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Token de Autenticação (Bearer)</Label>
                                        <Input
                                            value={form.webhook?.token || ""}
                                            onChange={e => setForm({
                                                ...form,
                                                webhook: { ...form.webhook, token: e.target.value }
                                            })}
                                            type="password"
                                            placeholder="Opcional"
                                        />
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <Label>Método</Label>
                                            <Select
                                                value={form.webhook?.method || "POST"}
                                                onValueChange={(val: any) => setForm({
                                                    ...form,
                                                    webhook: { ...form.webhook, method: val }
                                                })}
                                            >
                                                <SelectTrigger>
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="POST">POST</SelectItem>
                                                    <SelectItem value="GET">GET</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        <div className="space-y-2">
                                            <Label>Gatilho de Envio</Label>
                                            <Select
                                                value={form.webhook?.trigger || "completion"}
                                                onValueChange={(val: any) => setForm({
                                                    ...form,
                                                    webhook: { ...form.webhook, trigger: val }
                                                })}
                                            >
                                                <SelectTrigger>
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="completion">Ao finalizar o Quiz</SelectItem>
                                                    <SelectItem value="step">A cada etapa (Step-by-step)</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    </div>

                                    <div className="bg-slate-50 p-4 rounded-lg border text-sm text-slate-600">
                                        <p className="font-semibold mb-2">Exemplo de Payload:</p>
                                        <pre className="text-xs bg-slate-100 p-2 rounded overflow-x-auto">
                                            {`{
  "code": "XYZ-123",
  "lead": {
    "name": "João",
    "email": "joao@email.com"
  },
  "answers": { ... }
}`}
                                        </pre>
                                    </div>
                                </div>
                            </TabsContent>

                            {/* DISTRIBUTION & SCORING TAB */}
                            <TabsContent value="distribution" className="space-y-6 m-0">
                                <div className="space-y-4">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <Label className="text-base font-bold">Regras de Score e Distribuição</Label>
                                            <p className="text-xs text-muted-foreground">Defina qual produto e responsáveis o lead receberá com base na sua pontuação.</p>
                                        </div>
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            onClick={() => {
                                                const newRules = [...(form.scoring_rules || []), { min: 0, max: 100 }];
                                                setForm({ ...form, scoring_rules: newRules });
                                            }}
                                        >
                                            <Plus className="w-4 h-4 mr-2" /> Nova Regra
                                        </Button>
                                    </div>

                                    <div className="space-y-4">
                                        {(form.scoring_rules || []).map((rule, idx) => (
                                            <div key={idx} className="p-4 border rounded-xl bg-slate-50 relative group space-y-4">
                                                <div className="grid grid-cols-2 gap-4">
                                                    <div className="space-y-2">
                                                        <Label className="text-xs font-bold uppercase text-slate-400">Faixa de Pontuação</Label>
                                                        <div className="flex items-center gap-2">
                                                            <Input
                                                                type="number"
                                                                placeholder="Min"
                                                                className="bg-white h-9"
                                                                value={rule.min}
                                                                onChange={e => {
                                                                    const rules = [...(form.scoring_rules || [])];
                                                                    rules[idx].min = parseInt(e.target.value) || 0;
                                                                    setForm({ ...form, scoring_rules: rules });
                                                                }}
                                                            />
                                                            <span className="text-slate-400">até</span>
                                                            <Input
                                                                type="number"
                                                                placeholder="Max"
                                                                className="bg-white h-9"
                                                                value={rule.max}
                                                                onChange={e => {
                                                                    const rules = [...(form.scoring_rules || [])];
                                                                    rules[idx].max = parseInt(e.target.value) || 0;
                                                                    setForm({ ...form, scoring_rules: rules });
                                                                }}
                                                            />
                                                        </div>
                                                    </div>
                                                    <div className="space-y-2">
                                                        <Label className="text-xs font-bold uppercase text-slate-400">Produto Qualificado</Label>
                                                        <Select
                                                            value={rule.product_id || "none"}
                                                            onValueChange={(val) => {
                                                                const rules = [...(form.scoring_rules || [])];
                                                                rules[idx].product_id = val === "none" ? undefined : val;
                                                                setForm({ ...form, scoring_rules: rules });
                                                            }}
                                                        >
                                                            <SelectTrigger className="bg-white h-9">
                                                                <SelectValue placeholder="Selecione o produto..." />
                                                            </SelectTrigger>
                                                            <SelectContent>
                                                                <SelectItem value="none">Nenhum</SelectItem>
                                                                {products.map(p => (
                                                                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                                                                ))}
                                                            </SelectContent>
                                                        </Select>
                                                    </div>
                                                </div>

                                                <div className="grid grid-cols-2 gap-4">
                                                    <div className="space-y-2">
                                                        <Label className="text-xs font-bold uppercase text-slate-400">SDR Responsável</Label>
                                                        <Select
                                                            value={rule.sdr_id || "none"}
                                                            onValueChange={(val) => {
                                                                const rules = [...(form.scoring_rules || [])];
                                                                rules[idx].sdr_id = val === "none" ? undefined : val;
                                                                setForm({ ...form, scoring_rules: rules });
                                                            }}
                                                        >
                                                            <SelectTrigger className="bg-white h-9">
                                                                <SelectValue placeholder="Selecione o SDR..." />
                                                            </SelectTrigger>
                                                            <SelectContent>
                                                                <SelectItem value="none">Nenhum</SelectItem>
                                                                {sdrMembers.map(m => (
                                                                    <SelectItem key={m.profiles?.id} value={m.profiles?.id}>
                                                                        {m.profiles?.full_name || m.profiles?.email}
                                                                    </SelectItem>
                                                                ))}
                                                            </SelectContent>
                                                        </Select>
                                                    </div>
                                                    <div className="space-y-2">
                                                        <Label className="text-xs font-bold uppercase text-slate-400">Closer Responsável</Label>
                                                        <Select
                                                            value={rule.closer_id || "none"}
                                                            onValueChange={(val) => {
                                                                const rules = [...(form.scoring_rules || [])];
                                                                rules[idx].closer_id = val === "none" ? undefined : val;
                                                                setForm({ ...form, scoring_rules: rules });
                                                            }}
                                                        >
                                                            <SelectTrigger className="bg-white h-9">
                                                                <SelectValue placeholder="Selecione o Closer..." />
                                                            </SelectTrigger>
                                                            <SelectContent>
                                                                <SelectItem value="none">Nenhum</SelectItem>
                                                                {closerMembers.map(m => (
                                                                    <SelectItem key={m.profiles?.id} value={m.profiles?.id}>
                                                                        {m.profiles?.full_name || m.profiles?.email}
                                                                    </SelectItem>
                                                                ))}
                                                            </SelectContent>
                                                        </Select>
                                                    </div>
                                                </div>

                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="absolute top-2 right-2 h-7 w-7 text-red-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity"
                                                    onClick={() => {
                                                        const rules = (form.scoring_rules || []).filter((_, i) => i !== idx);
                                                        setForm({ ...form, scoring_rules: rules });
                                                    }}
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </Button>
                                            </div>
                                        ))}

                                        {form.scoring_rules?.length === 0 && (
                                            <div className="p-8 text-center border-2 border-dashed rounded-2xl text-slate-400 space-y-2">
                                                <Users className="w-8 h-8 mx-auto opacity-20" />
                                                <p className="text-sm">Nenhuma regra de distribuição configurada.</p>
                                                <Button
                                                    variant="link"
                                                    className="text-primary text-xs"
                                                    onClick={() => {
                                                        const newRules = [{ min: 0, max: 100 }];
                                                        setForm({ ...form, scoring_rules: newRules });
                                                    }}
                                                >
                                                    Clique aqui para adicionar a primeira regra.
                                                </Button>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </TabsContent>
                        </div>
                    </Tabs>
                </div>

                <DialogFooter className="bg-slate-50 border-t p-4 -mx-6 -mb-6 mt-4">
                    <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
                    <Button onClick={handleSave}>Salvar Alterações</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
