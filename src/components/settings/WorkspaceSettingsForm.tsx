import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Copy, Eye, EyeOff, Check } from "lucide-react";
import { useState } from "react";

export function WorkspaceSettingsForm() {
  const { currentWorkspace, loadWorkspaces } = useWorkspace();
  const queryClient = useQueryClient();
  const [showApiKey, setShowApiKey] = useState(false);
  const [copied, setCopied] = useState(false);
  const [hasKeyChanged, setHasKeyChanged] = useState(false);

  // Generate webhook URL
  const webhookUrl = currentWorkspace?.pagarme_webhook_token
    ? `https://rkngilknpcibcwalropj.supabase.co/functions/v1/pagarme-webhook?token=${currentWorkspace.pagarme_webhook_token}`
    : "";

  const updateWorkspaceMutation = useMutation({
    mutationFn: async (updates: { name?: string; slug?: string; installment_interest_rate?: number }) => {
      if (!currentWorkspace?.id) throw new Error("No workspace selected");

      const { error } = await supabase
        .from("workspaces")
        .update(updates)
        .eq("id", currentWorkspace.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["workspaces"] });
      loadWorkspaces();
      toast.success("Workspace atualizado com sucesso!");
    },
    onError: () => {
      toast.error("Erro ao atualizar workspace");
    },
  });

  const saveApiKeyMutation = useMutation({
    mutationFn: async (apiKey: string) => {
      if (!currentWorkspace?.id) throw new Error("No workspace selected");

      const { error } = await supabase.rpc("save_workspace_pagarme_key", {
        p_workspace_id: currentWorkspace.id,
        p_api_key: apiKey || null,
      });

      if (error) throw error;
    },
    onSuccess: () => {
      loadWorkspaces();
      setHasKeyChanged(false);
      toast.success("Chave API Pagar.me salva com sucesso!");
    },
    onError: (error: any) => {
      toast.error("Erro ao salvar chave API: " + error.message);
    },
  });

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const name = formData.get("name") as string;
    const slug = formData.get("slug") as string;
    const installment_interest_rate = Number(formData.get("installment_interest_rate"));
    updateWorkspaceMutation.mutate({ name, slug, installment_interest_rate });
  };

  const handleSaveApiKey = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const apiKey = formData.get("pagarme_api_key") as string;
    saveApiKeyMutation.mutate(apiKey);
  };

  const copyWebhookUrl = async () => {
    await navigator.clipboard.writeText(webhookUrl);
    setCopied(true);
    toast.success("URL copiada para a área de transferência!");
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-8">
      {/* Workspace Settings */}
      <form key={currentWorkspace?.id || 'loading'} onSubmit={handleSubmit} className="space-y-4">
        <h3 className="text-lg font-semibold">Configurações Gerais</h3>

        <div className="space-y-2">
          <Label htmlFor="name">Nome do Workspace</Label>
          <Input
            id="name"
            name="name"
            defaultValue={currentWorkspace?.name || ""}
            required
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="slug">Slug (identificador único)</Label>
          <Input
            id="slug"
            name="slug"
            defaultValue={currentWorkspace?.slug || ""}
            required
            pattern="[a-z0-9-]+"
            title="Apenas letras minúsculas, números e hífens"
          />
          <p className="text-sm text-muted-foreground">
            O slug é usado na URL do seu workspace
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="installment_interest_rate">Taxa de Juros Mensal (%)</Label>
          <Input
            id="installment_interest_rate"
            name="installment_interest_rate"
            type="number"
            step="0.01"
            min="0"
            defaultValue={currentWorkspace?.installment_interest_rate || 0}
          />
          <p className="text-sm text-muted-foreground">
            Taxa de juros ao mês para parcelamento (Juros do comprador). Deixe 0 para sem juros.
          </p>
        </div>

        {currentWorkspace && "created_at" in currentWorkspace && (
          <div className="space-y-2">
            <Label htmlFor="created_at">Criado em</Label>
            <Input
              id="created_at"
              value={new Date((currentWorkspace as any).created_at).toLocaleDateString("pt-BR")}
              disabled
            />
          </div>
        )}

        <Button type="submit" disabled={updateWorkspaceMutation.isPending}>
          {updateWorkspaceMutation.isPending ? "Salvando..." : "Salvar Alterações"}
        </Button>
      </form>

      {/* Pagar.me Integration */}
      <div className="border-t pt-6">
        <h3 className="text-lg font-semibold mb-4">Integração Pagar.me</h3>

        <form onSubmit={handleSaveApiKey} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="pagarme_api_key">Chave API Pagar.me (Secret Key)</Label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Input
                  id="pagarme_api_key"
                  name="pagarme_api_key"
                  type={showApiKey ? "text" : "password"}
                  placeholder="sk_xxxx... ou ak_xxxx..."
                  onChange={() => setHasKeyChanged(true)}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-2 top-1/2 -translate-y-1/2 h-8 w-8"
                  onClick={() => setShowApiKey(!showApiKey)}
                >
                  {showApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
              <Button type="submit" disabled={saveApiKeyMutation.isPending || !hasKeyChanged}>
                {saveApiKeyMutation.isPending ? "Salvando..." : "Salvar Chave"}
              </Button>
            </div>
            <p className="text-sm text-muted-foreground">
              Sua chave secreta da Pagar.me. Obtenha em: Pagar.me Dashboard → Configurações → Chaves de API
            </p>
          </div>
        </form>

        <div className="space-y-2 mt-4">
          <Label>URL do Webhook</Label>
          <div className="flex gap-2">
            <Input
              value={webhookUrl}
              readOnly
              className="font-mono text-xs"
            />
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={copyWebhookUrl}
              disabled={!webhookUrl}
            >
              {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
            </Button>
          </div>
          <p className="text-sm text-muted-foreground">
            Configure esta URL no painel da Pagar.me → Webhooks para receber notificações de pagamento.
          </p>
        </div>
      </div>
    </div>
  );
}
