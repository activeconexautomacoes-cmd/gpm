import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Send } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { toast } from "sonner";

export default function SdrSugerirConhecimento() {
  const { currentWorkspace } = useWorkspace();
  const [content, setContent] = useState("");
  const [category, setCategory] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim() || !currentWorkspace?.id) return;

    setSubmitting(true);
    const { error } = await supabase
      .from("sdr_knowledge_entries" as any)
      .insert({
        workspace_id: currentWorkspace.id,
        content: content.trim(),
        category: category.trim() || null,
        source: "web",
        status: "pending",
      });

    if (!error) {
      setContent("");
      setCategory("");
      toast.success("Sugestão enviada! Aguardando aprovação do admin.");
    } else {
      toast.error("Erro ao enviar sugestão");
    }
    setSubmitting(false);
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Sugerir Conhecimento</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Ensine a SDR algo novo. Tudo que você enviar será analisado pelo admin antes de entrar na base.
        </p>
      </div>

      <Card>
        <CardContent className="pt-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label>O que a SDR deve aprender?</Label>
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="Ex: Quando o lead pergunta sobre contrato, a Maria deve dizer que tudo é personalizado na consultoria..."
                rows={5}
                className="w-full rounded-md border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-none"
              />
            </div>
            <div className="flex items-end gap-3">
              <div className="flex-1 space-y-2">
                <Label>Categoria (opcional)</Label>
                <Input
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  placeholder="objeções, tom-de-voz, fluxo, qualificação..."
                />
              </div>
              <Button type="submit" disabled={submitting || !content.trim()}>
                <Send className="mr-2 h-4 w-4" />
                {submitting ? "Enviando..." : "Enviar"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
