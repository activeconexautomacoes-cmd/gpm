import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { toast } from "sonner";

interface Feedback {
  id: string;
  category: string;
  description: string;
  priority: string;
  status: string;
  created_at: string;
}

const CATEGORIES = [
  { value: "erro", label: "Erro" },
  { value: "melhoria", label: "Melhoria" },
  { value: "tom", label: "Tom/Personalidade" },
  { value: "fluxo", label: "Fluxo da conversa" },
  { value: "outro", label: "Outro" },
];

const PRIORITIES = [
  { value: "baixa", label: "Baixa" },
  { value: "media", label: "Média" },
  { value: "alta", label: "Alta" },
];

const STATUS_COLORS: Record<string, string> = {
  pendente: "bg-amber-500/10 text-amber-500 border-amber-500/20",
  aplicado: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20",
  descartado: "bg-muted text-muted-foreground border-border",
};

const CATEGORY_COLORS: Record<string, string> = {
  erro: "bg-red-500/10 text-red-500 border-red-500/20",
  melhoria: "bg-blue-500/10 text-blue-500 border-blue-500/20",
  tom: "bg-violet-500/10 text-violet-500 border-violet-500/20",
  fluxo: "bg-orange-500/10 text-orange-500 border-orange-500/20",
  outro: "bg-muted text-muted-foreground border-border",
};

export default function SdrFeedbacks() {
  const { currentWorkspace, user } = useWorkspace();
  const [feedbacks, setFeedbacks] = useState<Feedback[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [category, setCategory] = useState("melhoria");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState("media");

  const fetchFeedbacks = async () => {
    if (!currentWorkspace?.id) return;
    const { data } = await supabase
      .from("sdr_feedbacks" as any)
      .select("*")
      .eq("workspace_id", currentWorkspace.id)
      .order("created_at", { ascending: false });
    if (data) setFeedbacks(data as unknown as Feedback[]);
    setLoading(false);
  };

  useEffect(() => {
    fetchFeedbacks();
  }, [currentWorkspace?.id]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !currentWorkspace?.id) return;
    setSubmitting(true);

    const { error } = await supabase.from("sdr_feedbacks" as any).insert({
      workspace_id: currentWorkspace.id,
      user_id: user.id,
      category,
      description,
      priority,
    });

    if (!error) {
      setDescription("");
      setShowForm(false);
      fetchFeedbacks();
      toast.success("Feedback enviado!");
    } else {
      toast.error("Erro ao enviar feedback");
    }
    setSubmitting(false);
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Feedbacks da SDR</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Sugestões de melhoria para a SDR AI
          </p>
        </div>
        <Button onClick={() => setShowForm(!showForm)}>
          <Plus className="mr-2 h-4 w-4" />
          {showForm ? "Cancelar" : "Novo Feedback"}
        </Button>
      </div>

      {showForm && (
        <Card>
          <CardContent className="pt-6">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Categoria</Label>
                  <Select value={category} onValueChange={setCategory}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {CATEGORIES.map((c) => (
                        <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Prioridade</Label>
                  <Select value={priority} onValueChange={setPriority}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {PRIORITIES.map((p) => (
                        <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Descrição</Label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  required
                  rows={3}
                  placeholder="Descreva o que a SDR está errando ou o que pode melhorar..."
                  className="w-full rounded-md border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-none"
                />
              </div>
              <Button type="submit" disabled={submitting}>
                {submitting ? "Enviando..." : "Enviar Feedback"}
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      {loading ? (
        <div className="text-center py-12 text-muted-foreground">Carregando...</div>
      ) : feedbacks.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <p>Nenhum feedback ainda</p>
          <p className="text-xs mt-1">Clique em "Novo Feedback" para começar</p>
        </div>
      ) : (
        <div className="space-y-3">
          {feedbacks.map((fb) => (
            <Card key={fb.id}>
              <CardContent className="pt-4">
                <div className="flex items-center gap-2 mb-2">
                  <Badge variant="outline" className={CATEGORY_COLORS[fb.category] || ""}>
                    {CATEGORIES.find((c) => c.value === fb.category)?.label}
                  </Badge>
                  <Badge variant="outline" className={STATUS_COLORS[fb.status] || ""}>
                    {fb.status}
                  </Badge>
                  {fb.priority === "alta" && (
                    <Badge variant="outline" className="bg-red-500/10 text-red-500 border-red-500/20">
                      prioridade alta
                    </Badge>
                  )}
                </div>
                <p className="text-sm">{fb.description}</p>
                <p className="text-xs text-muted-foreground mt-2">
                  {new Date(fb.created_at).toLocaleDateString("pt-BR", {
                    day: "2-digit", month: "2-digit", year: "numeric",
                    hour: "2-digit", minute: "2-digit",
                  })}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
