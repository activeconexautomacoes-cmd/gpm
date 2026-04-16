import { useState, useEffect, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Check, X, ChevronDown, ChevronUp, Pencil, Save } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { toast } from "sonner";

interface KnowledgeEntry {
  id: string;
  content: string;
  category: string | null;
  source: "web" | "terminal" | "ai-suggestion";
  status: "pending" | "approved" | "rejected";
  created_at: string;
}

function isMarker(entry: KnowledgeEntry) {
  const cat = entry.category || "";
  return cat === "sdrai-last-analyzed" || cat.startsWith("sdr-call-1") || cat.startsWith("call-analysis-1");
}

function getOrigin(entry: KnowledgeEntry) {
  const cat = entry.category || "";
  if (cat.startsWith("call-analysis"))
    return { label: "Call do Closer", color: "bg-orange-500/10 text-orange-500 border-orange-500/20" };
  if (cat.startsWith("analise-sdrai") || cat.startsWith("sdrai-"))
    return { label: "SDR IA", color: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20" };
  if (entry.source === "ai-suggestion")
    return { label: "IA", color: "bg-violet-500/10 text-violet-500 border-violet-500/20" };
  return { label: "Colaborador", color: "bg-blue-500/10 text-blue-500 border-blue-500/20" };
}

export default function SdrSugestoes() {
  const { currentWorkspace } = useWorkspace();
  const [allEntries, setAllEntries] = useState<KnowledgeEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [showHistory, setShowHistory] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState("");

  const load = useCallback(async () => {
    if (!currentWorkspace?.id) return;
    setLoading(true);
    const { data } = await supabase
      .from("sdr_knowledge_entries" as any)
      .select("*")
      .eq("workspace_id", currentWorkspace.id)
      .order("created_at", { ascending: false });
    setAllEntries((data as unknown as KnowledgeEntry[]) ?? []);
    setLoading(false);
  }, [currentWorkspace?.id]);

  useEffect(() => { load(); }, [load]);

  // Poll a cada 10s para novas sugestões
  useEffect(() => {
    if (!currentWorkspace?.id) return;
    const interval = setInterval(load, 10000);
    return () => clearInterval(interval);
  }, [currentWorkspace?.id, load]);

  const startEditing = (entry: KnowledgeEntry) => {
    setEditingId(entry.id);
    setEditContent(entry.content);
  };

  const cancelEditing = () => {
    setEditingId(null);
    setEditContent("");
  };

  const saveEdit = async (id: string) => {
    if (!editContent.trim()) return;
    const { error } = await supabase
      .from("sdr_knowledge_entries" as any)
      .update({ content: editContent.trim() })
      .eq("id", id);
    if (error) { toast.error("Erro ao salvar edição"); return; }
    setAllEntries((prev) => prev.map((e) => (e.id === id ? { ...e, content: editContent.trim() } : e)));
    setEditingId(null);
    setEditContent("");
    toast.success("Sugestão editada!");
  };

  const approve = async (id: string) => {
    const { error } = await supabase
      .from("sdr_knowledge_entries" as any)
      .update({ status: "approved" })
      .eq("id", id);
    if (error) { toast.error("Erro ao aprovar"); return; }
    setAllEntries((prev) => prev.map((e) => (e.id === id ? { ...e, status: "approved" as const } : e)));
    toast.success("Sugestão aprovada! A SDR vai aprender com isso.");
  };

  const reject = async (id: string) => {
    const { error } = await supabase
      .from("sdr_knowledge_entries" as any)
      .update({ status: "rejected" })
      .eq("id", id);
    if (error) { toast.error("Erro ao rejeitar"); return; }
    setAllEntries((prev) => prev.map((e) => (e.id === id ? { ...e, status: "rejected" as const } : e)));
    toast.success("Sugestão rejeitada");
  };

  const entries = allEntries.filter((e) => !isMarker(e));
  const pending = entries.filter((e) => e.status === "pending");
  const approved = entries.filter((e) => e.status === "approved");
  const rejected = entries.filter((e) => e.status === "rejected");

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Sugestões de Conhecimento</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Aprove ou rejeite sugestões. Ao aprovar, a SDR aprende e melhora os atendimentos.
        </p>
      </div>

      {loading ? (
        <div className="text-center py-16 text-muted-foreground">Carregando...</div>
      ) : (
        <>
          {pending.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-lg font-medium mb-1">Tudo aprovado!</p>
              <p className="text-sm text-muted-foreground">
                Novas sugestões dos colaboradores e da IA aparecerão aqui automaticamente.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
                Pendentes ({pending.length})
              </p>
              {pending.map((entry) => {
                const origin = getOrigin(entry);
                return (
                  <Card key={entry.id}>
                    <CardContent className="pt-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-2 flex-wrap">
                            <Badge variant="outline" className={origin.color}>
                              {origin.label}
                            </Badge>
                            {entry.category && !entry.category.startsWith("call-") && !entry.category.startsWith("sdr-") && (
                              <Badge variant="outline">{entry.category}</Badge>
                            )}
                          </div>
                          {editingId === entry.id ? (
                            <div className="space-y-2">
                              <textarea
                                value={editContent}
                                onChange={(e) => setEditContent(e.target.value)}
                                rows={8}
                                className="w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-y"
                              />
                              <div className="flex gap-2">
                                <Button size="sm" onClick={() => saveEdit(entry.id)}>
                                  <Save className="h-3 w-3 mr-1" /> Salvar
                                </Button>
                                <Button size="sm" variant="ghost" onClick={cancelEditing}>
                                  Cancelar
                                </Button>
                              </div>
                            </div>
                          ) : (
                            <p className="text-sm whitespace-pre-wrap leading-relaxed">{entry.content}</p>
                          )}
                          <p className="text-xs text-muted-foreground mt-2">
                            {new Date(entry.created_at).toLocaleString("pt-BR")}
                          </p>
                        </div>
                        {editingId !== entry.id && (
                          <div className="flex flex-col gap-1.5 shrink-0">
                            <Button size="sm" onClick={() => approve(entry.id)} className="bg-emerald-600 hover:bg-emerald-700">
                              <Check className="h-3 w-3 mr-1" /> Aprovar
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => startEditing(entry)}>
                              <Pencil className="h-3 w-3 mr-1" /> Editar
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => reject(entry.id)} className="text-destructive border-destructive/30 hover:bg-destructive/10">
                              <X className="h-3 w-3 mr-1" /> Rejeitar
                            </Button>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}

          {(approved.length > 0 || rejected.length > 0) && (
            <div className="border-t pt-6">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowHistory(!showHistory)}
                className="mb-4"
              >
                {showHistory ? <ChevronUp className="h-4 w-4 mr-1" /> : <ChevronDown className="h-4 w-4 mr-1" />}
                Histórico ({approved.length + rejected.length})
              </Button>

              {showHistory && (
                <div className="space-y-3">
                  {[...approved, ...rejected]
                    .sort((a, b) => b.created_at.localeCompare(a.created_at))
                    .map((entry) => {
                      const origin = getOrigin(entry);
                      const isAppr = entry.status === "approved";
                      return (
                        <Card key={entry.id} className={isAppr ? "border-emerald-500/20" : "border-destructive/20"}>
                          <CardContent className="pt-4">
                            <div className="flex items-center gap-2 mb-2 flex-wrap">
                              <Badge variant="outline" className={isAppr ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20" : "bg-destructive/10 text-destructive border-destructive/20"}>
                                {isAppr ? "Aprovado" : "Rejeitado"}
                              </Badge>
                              <Badge variant="outline" className={`${origin.color} opacity-70`}>
                                {origin.label}
                              </Badge>
                            </div>
                            <p className="text-sm whitespace-pre-wrap">{entry.content}</p>
                            <p className="text-xs text-muted-foreground mt-2">
                              {new Date(entry.created_at).toLocaleString("pt-BR")}
                            </p>
                          </CardContent>
                        </Card>
                      );
                    })}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
