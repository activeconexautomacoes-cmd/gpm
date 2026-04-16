import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, Key, Check, Eye, EyeOff, CreditCard, Puzzle, Globe, Megaphone } from "lucide-react";
import { WebhookIntegrations } from "./WebhookIntegrations";

export function IntegrationsSettings() {
    const [apiKey, setApiKey] = useState("");
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [worskpaceId, setWorkspaceId] = useState<string | null>(null);
    const [showKey, setShowKey] = useState(false);
    const [existingId, setExistingId] = useState<string | null>(null);

    const [pagarmeKey, setPagarmeKey] = useState("");
    const [pagarmePublicKey, setPagarmePublicKey] = useState("");
    const [pagarmeAccountId, setPagarmeAccountId] = useState("");
    const [showPagarmeKey, setShowPagarmeKey] = useState(false);
    const [existingPagarmeId, setExistingPagarmeId] = useState<string | null>(null);

    const [d4signToken, setD4signToken] = useState("");
    const [d4signCryptKey, setD4signCryptKey] = useState("");
    const [d4signSafe, setD4signSafe] = useState("");
    const [showD4signKey, setShowD4signKey] = useState(false);
    const [existingD4signId, setExistingD4signId] = useState<string | null>(null);

    const [metaAccessToken, setMetaAccessToken] = useState("");
    const [metaPixelId, setMetaPixelId] = useState("");
    const [metaTestEventCode, setMetaTestEventCode] = useState("");
    const [showMetaKey, setShowMetaKey] = useState(false);
    const [existingMetaId, setExistingMetaId] = useState<string | null>(null);

    // Fetch current workspace and keys
    useEffect(() => {
        const fetchSettings = async () => {
            setLoading(true);
            try {
                // Get first workspace for now (MVP)
                const { data: workspaces, error: wsError } = await supabase.from("workspaces").select("id").limit(1).single();
                if (wsError) throw wsError;

                if (workspaces) {
                    setWorkspaceId(workspaces.id);

                    const { data: integrations, error: intError } = await (supabase as any)
                        .from("workspace_integrations")
                        .select("*")
                        .eq("workspace_id", workspaces.id);

                    if (intError) throw intError;

                    const gemini = integrations.find((i: any) => i.provider === "gemini");
                    if (gemini) {
                        setApiKey(gemini.api_key || "");
                        setExistingId(gemini.id);
                    }

                    const pagarme = integrations.find((i: any) => i.provider === "pagarme");
                    if (pagarme) {
                        setPagarmeKey(pagarme.api_key || "");
                        setPagarmePublicKey(pagarme.config?.public_key || "");
                        setPagarmeAccountId(pagarme.config?.account_id || "");
                        setExistingPagarmeId(pagarme.id);
                    }

                    const d4sign = integrations.find((i: any) => i.provider === "d4sign");
                    if (d4sign) {
                        setD4signToken(d4sign.api_key || "");
                        setD4signCryptKey(d4sign.config?.crypt_key || "");
                        setD4signSafe(d4sign.config?.uuid_safe || "");
                        setExistingD4signId(d4sign.id);
                    }

                    const metaCapi = integrations.find((i: any) => i.provider === "meta_capi");
                    if (metaCapi) {
                        setMetaAccessToken(metaCapi.api_key || "");
                        setMetaPixelId(metaCapi.config?.pixel_id || "");
                        setMetaTestEventCode(metaCapi.config?.test_event_code || "");
                        setExistingMetaId(metaCapi.id);
                    }
                }
            } catch (error) {
                console.error(error);
                toast.error("Erro ao carregar configurações");
            } finally {
                setLoading(false);
            }
        };

        fetchSettings();
    }, []);

    const handleSaveGemini = async () => {
        if (!worskpaceId) return;
        setSaving(true);
        try {
            const payload = {
                workspace_id: worskpaceId,
                provider: "gemini",
                api_key: apiKey,
                is_active: true
            };

            if (existingId) {
                const { error } = await (supabase as any).from("workspace_integrations").update(payload).eq("id", existingId);
                if (error) throw error;
            } else {
                const { data, error } = await (supabase as any).from("workspace_integrations").insert(payload).select().single();
                if (error) throw error;
                if (data) setExistingId(data.id);
            }

            toast.success("Chave Gemini salva com sucesso!");
        } catch (error) {
            console.error(error);
            toast.error("Erro ao salvar chave Gemini");
        } finally {
            setSaving(false);
        }
    };

    const handleSavePagarme = async () => {
        if (!worskpaceId) return;
        setSaving(true);
        try {
            const payload = {
                workspace_id: worskpaceId,
                provider: "pagarme",
                api_key: pagarmeKey,
                is_active: true,
                config: {
                    public_key: pagarmePublicKey,
                    account_id: pagarmeAccountId
                }
            };

            if (existingPagarmeId) {
                const { error } = await (supabase as any).from("workspace_integrations").update(payload).eq("id", existingPagarmeId);
                if (error) throw error;
            } else {
                const { data, error } = await (supabase as any).from("workspace_integrations").insert(payload).select().single();
                if (error) throw error;
                if (data) setExistingPagarmeId(data.id);
            }

            toast.success("Configurações Pagar.me salvas com sucesso!");
        } catch (error) {
            console.error(error);
            toast.error("Erro ao salvar configurações Pagar.me");
        } finally {
            setSaving(false);
        }
    };

    const handleSaveD4Sign = async () => {
        if (!worskpaceId) return;
        setSaving(true);
        try {
            const payload = {
                workspace_id: worskpaceId,
                provider: "d4sign",
                api_key: d4signToken,
                is_active: true,
                config: {
                    crypt_key: d4signCryptKey,
                    uuid_safe: d4signSafe
                }
            };

            if (existingD4signId) {
                const { error } = await (supabase as any).from("workspace_integrations").update(payload).eq("id", existingD4signId);
                if (error) throw error;
            } else {
                const { data, error } = await (supabase as any).from("workspace_integrations").insert(payload).select().single();
                if (error) throw error;
                if (data) setExistingD4signId(data.id);
            }

            toast.success("Configurações D4Sign salvas com sucesso!");
        } catch (error) {
            console.error(error);
            toast.error("Erro ao salvar configurações D4Sign");
        } finally {
            setSaving(false);
        }
    };

    const handleSaveMetaCapi = async () => {
        if (!worskpaceId) return;
        setSaving(true);
        try {
            const payload = {
                workspace_id: worskpaceId,
                provider: "meta_capi",
                api_key: metaAccessToken,
                is_active: true,
                config: {
                    pixel_id: metaPixelId,
                    ...(metaTestEventCode ? { test_event_code: metaTestEventCode } : {})
                }
            };

            if (existingMetaId) {
                const { error } = await (supabase as any).from("workspace_integrations").update(payload).eq("id", existingMetaId);
                if (error) throw error;
            } else {
                const { data, error } = await (supabase as any).from("workspace_integrations").insert(payload).select().single();
                if (error) throw error;
                if (data) setExistingMetaId(data.id);
            }

            toast.success("Configurações Meta CAPI salvas com sucesso!");
        } catch (error) {
            console.error(error);
            toast.error("Erro ao salvar configurações Meta CAPI");
        } finally {
            setSaving(false);
        }
    };

    if (loading) return <div className="p-8 text-center text-muted-foreground">Carregando integrações...</div>;

    return (
        <div className="space-y-6">
            <WebhookIntegrations />

            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Key className="h-5 w-5 text-blue-600" />
                        Integração Gemini AI
                    </CardTitle>
                    <CardDescription>
                        Configure sua chave de API do Google Gemini para habilitar recursos de Inteligência Artificial no Quiz Builder.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="gemini-key">Chave de API (Gemini API Key)</Label>
                        <div className="flex gap-2">
                            <div className="relative flex-1">
                                <Input
                                    id="gemini-key"
                                    type={showKey ? "text" : "password"}
                                    placeholder="AIzaSy..."
                                    value={apiKey}
                                    onChange={(e) => setApiKey(e.target.value)}
                                />
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    className="absolute right-0 top-0 h-full px-3 text-slate-400 hover:text-slate-600"
                                    onClick={() => setShowKey(!showKey)}
                                >
                                    {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                </Button>
                            </div>
                            <Button onClick={handleSaveGemini} disabled={saving || !apiKey} className="bg-blue-600 hover:bg-blue-700">
                                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4 mr-2" />}
                                Salvar
                            </Button>
                        </div>
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <CreditCard className="h-5 w-5 text-blue-600" />
                        Integração Pagar.me (V5)
                    </CardTitle>
                    <CardDescription>
                        Configure as chaves da Pagar.me para habilitar cobranças automáticas.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="pagarme-account-id">ID da conta (acc_...)</Label>
                            <Input
                                id="pagarme-account-id"
                                placeholder="acc_..."
                                value={pagarmeAccountId}
                                onChange={(e) => setPagarmeAccountId(e.target.value)}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="pagarme-public-key">Chave pública (pk_...)</Label>
                            <Input
                                id="pagarme-public-key"
                                placeholder="pk_..."
                                value={pagarmePublicKey}
                                onChange={(e) => setPagarmePublicKey(e.target.value)}
                            />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="pagarme-key">Secret Key (sk_...)</Label>
                        <div className="flex gap-2">
                            <div className="relative flex-1">
                                <Input
                                    id="pagarme-key"
                                    type={showPagarmeKey ? "text" : "password"}
                                    placeholder="sk_test_... ou sk_..."
                                    value={pagarmeKey}
                                    onChange={(e) => setPagarmeKey(e.target.value)}
                                />
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    className="absolute right-0 top-0 h-full px-3 text-slate-400 hover:text-slate-600"
                                    onClick={() => setShowPagarmeKey(!showPagarmeKey)}
                                >
                                    {showPagarmeKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                </Button>
                            </div>
                            <Button onClick={handleSavePagarme} disabled={saving} className="bg-blue-600 hover:bg-blue-700">
                                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4 mr-2" />}
                                Salvar Configurações
                            </Button>
                        </div>
                        <p className="text-xs text-slate-500">
                            Acesse o painel da Pagar.me em <a href="https://dash.pagar.me/" target="_blank" className="text-blue-600 hover:underline">Configurações &gt; Chaves</a>.
                        </p>
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Puzzle className="h-5 w-5 text-orange-600" />
                        Integração D4Sign
                    </CardTitle>
                    <CardDescription>
                        Configure as credenciais da D4Sign para automação de assinaturas de contratos.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="d4sign-safe">UUID do Cofre (Safe)</Label>
                            <Input
                                id="d4sign-safe"
                                placeholder="..."
                                value={d4signSafe}
                                onChange={(e) => setD4signSafe(e.target.value)}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="d4sign-crypt">Crypt Key</Label>
                            <Input
                                id="d4sign-crypt"
                                placeholder="..."
                                value={d4signCryptKey}
                                onChange={(e) => setD4signCryptKey(e.target.value)}
                            />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="d4sign-token">Token API</Label>
                        <div className="flex gap-2">
                            <div className="relative flex-1">
                                <Input
                                    id="d4sign-token"
                                    type={showD4signKey ? "text" : "password"}
                                    placeholder="Token API..."
                                    value={d4signToken}
                                    onChange={(e) => setD4signToken(e.target.value)}
                                />
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    className="absolute right-0 top-0 h-full px-3 text-slate-400 hover:text-slate-600"
                                    onClick={() => setShowD4signKey(!showD4signKey)}
                                >
                                    {showD4signKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                </Button>
                            </div>
                            <Button onClick={handleSaveD4Sign} disabled={saving} className="bg-orange-600 hover:bg-orange-700">
                                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4 mr-2" />}
                                Salvar Configurações
                            </Button>
                        </div>
                        <p className="text-xs text-slate-500">
                            Obtenha essas chaves no menu <span className="font-bold">API / Dev</span> do seu painel D4Sign.
                        </p>
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Megaphone className="h-5 w-5 text-blue-500" />
                        Meta Conversions API (CAPI)
                    </CardTitle>
                    <CardDescription>
                        Configure a API de Conversões do Meta para enviar eventos server-side (Lead, Purchase, etc.) com maior precisão de atribuição.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="meta-pixel-id">Pixel ID</Label>
                            <Input
                                id="meta-pixel-id"
                                placeholder="289183857235038"
                                value={metaPixelId}
                                onChange={(e) => setMetaPixelId(e.target.value)}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="meta-test-event">Test Event Code (opcional)</Label>
                            <Input
                                id="meta-test-event"
                                placeholder="TEST12345"
                                value={metaTestEventCode}
                                onChange={(e) => setMetaTestEventCode(e.target.value)}
                            />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="meta-access-token">Access Token</Label>
                        <div className="flex gap-2">
                            <div className="relative flex-1">
                                <Input
                                    id="meta-access-token"
                                    type={showMetaKey ? "text" : "password"}
                                    placeholder="EAAxxxxxxx..."
                                    value={metaAccessToken}
                                    onChange={(e) => setMetaAccessToken(e.target.value)}
                                />
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    className="absolute right-0 top-0 h-full px-3 text-slate-400 hover:text-slate-600"
                                    onClick={() => setShowMetaKey(!showMetaKey)}
                                >
                                    {showMetaKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                </Button>
                            </div>
                            <Button onClick={handleSaveMetaCapi} disabled={saving || !metaAccessToken || !metaPixelId} className="bg-blue-500 hover:bg-blue-600">
                                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4 mr-2" />}
                                Salvar Configurações
                            </Button>
                        </div>
                        <p className="text-xs text-slate-500">
                            Use um token de Sistema do <a href="https://business.facebook.com/settings/system-users" target="_blank" className="text-blue-600 hover:underline">Meta Business Manager</a> com permissão <code className="text-xs bg-slate-100 px-1 rounded">ads_management</code>.
                        </p>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
