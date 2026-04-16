import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  MessageSquare,
  RefreshCw,
  Settings,
  Calendar,
  CheckCircle2,
  Paperclip,
  Mail,
  Phone,
  Download,
  FileIcon,
  Pencil,
  X,
  Check,
  Pin,
  XCircle
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Textarea } from "@/components/ui/textarea";

interface OpportunityTimelineProps {
  opportunity: any;
}

const getEventIcon = (noteType: string) => {
  switch (noteType) {
    case "loss":
      return <XCircle className="h-4 w-4" />;
    case "note":
      return <MessageSquare className="h-4 w-4" />;
    case "stage_change":
      return <RefreshCw className="h-4 w-4" />;
    case "activity":
      return <CheckCircle2 className="h-4 w-4" />;
    case "attachment":
      return <Paperclip className="h-4 w-4" />;
    case "email":
      return <Mail className="h-4 w-4" />;
    case "whatsapp":
      return <Phone className="h-4 w-4" />;
    case "call":
      return <Phone className="h-4 w-4 rotate-90" />;
    case "meeting":
      return <Calendar className="h-4 w-4" />;
    case "follow_up":
      return <Calendar className="h-4 w-4" />;
    default:
      return <Settings className="h-4 w-4" />;
  }
};

const getEventStyling = (noteType: string) => {
  switch (noteType) {
    case "loss":
      return "bg-rose-500/10 text-rose-500 border-rose-500/20";
    case "note":
      return "bg-amber-500/10 text-amber-500 border-amber-500/20";
    case "stage_change":
      return "bg-blue-500/10 text-blue-500 border-blue-500/20";
    case "activity":
      return "bg-emerald-500/10 text-emerald-500 border-emerald-500/20";
    case "attachment":
      return "bg-primary/10 text-primary border-primary/20";
    case "email":
      return "bg-indigo-500/10 text-indigo-500 border-indigo-500/20";
    case "whatsapp":
      return "bg-emerald-500/10 text-emerald-600 border-emerald-500/20 dark:text-emerald-400";
    case "call":
      return "bg-cyan-500/10 text-cyan-500 border-cyan-500/20";
    case "meeting":
      return "bg-rose-500/10 text-rose-500 border-rose-500/20";
    case "follow_up":
      return "bg-blue-500/10 text-blue-500 border-blue-500/20";
    default:
      return "bg-muted text-muted-foreground border-border";
  }
};

const getEventLabel = (noteType: string) => {
  switch (noteType) {
    case "loss": return "Oportunidade Perdida";
    case "note": return "Nota adicionada";
    case "stage_change": return "Fase alterada";
    case "activity": return "Atividade concluída";
    case "attachment": return "Arquivo adicionado";
    case "system": return "Sistema";
    case "email": return "Email";
    case "whatsapp": return "WhatsApp";
    case "call": return "Ligação";
    case "meeting": return "Reunião";
    case "follow_up": return "Follow-up agendado";
    default: return "Evento";
  }
};

interface TimelineItem {
  id: string;
  opportunity_id?: string;
  created_at: string;
  note_type: string;
  content: string;
  type: 'note' | 'attachment';
  profiles?: any;
  file_name?: string;
  file_size?: number;
  file_url?: string;
  scheduled_at?: string;
  completed_at?: string;
  assigned_profile?: any;
  is_pinned?: boolean;
}

export function OpportunityTimeline({ opportunity }: OpportunityTimelineProps) {
  const [activeFilter, setActiveFilter] = useState("Todas");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState("");
  const [currentUser, setCurrentUser] = useState<any>(null);
  const queryClient = useQueryClient();

  // Fetch Current User
  React.useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      setCurrentUser(user);
    });
  }, []);

  const updateNoteMutation = useMutation({
    mutationFn: async ({ id, content }: { id: string, content: string }) => {
      const { error } = await supabase
        .from("opportunity_notes")
        .update({ content })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Atividade atualizada com sucesso");
      setEditingId(null);
      queryClient.invalidateQueries({ queryKey: ["opportunity-timeline", opportunity?.id] });
    },
    onError: () => {
      toast.error("Erro ao atualizar atividade");
    }
  });

  const togglePinMutation = useMutation({
    mutationFn: async ({ id, type, currentPin }: { id: string, type: 'note' | 'attachment', currentPin: boolean }) => {
      const table = type === 'note' ? 'opportunity_notes' : 'opportunity_attachments';
      const { error } = await supabase
        .from(table)
        .update({ is_pinned: !currentPin })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["opportunity-timeline", opportunity?.id] });
    },
    onError: () => {
      toast.error("Erro ao alterar fixação da atividade");
    }
  });

  const { data: timelineItems = [] } = useQuery({
    queryKey: ["opportunity-timeline", opportunity?.id],
    queryFn: async () => {
      if (!opportunity?.id) return [];

      // Fetch Notes
      const { data: notes, error: notesError } = await supabase
        .from("opportunity_notes")
        .select("*")
        .eq("opportunity_id", opportunity.id)
        .order("created_at", { ascending: false });

      if (notesError) throw notesError;

      // Fetch Attachments
      const { data: attachments, error: attachmentsError } = await supabase
        .from("opportunity_attachments")
        .select("*")
        .eq("opportunity_id", opportunity.id)
        .order("created_at", { ascending: false });

      if (attachmentsError) throw attachmentsError;

      // Fetch Profiles
      const userIds = Array.from(new Set([
        ...(notes || []).map(n => (n as any).author_id || n.created_by),
        ...(notes || []).map(n => (n as any).assigned_to),
        ...(attachments || []).map(a => a.uploaded_by)
      ])).filter(Boolean);

      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, full_name, avatar_url, email")
        .in("id", userIds);

      const profileMap = (profiles || []).reduce((acc, p) => ({ ...acc, [p.id]: p }), {} as any);

      // Combine and Tag
      const items: TimelineItem[] = [
        ...(notes || []).map(n => ({
          id: n.id,
          opportunity_id: n.opportunity_id,
          created_at: n.created_at || new Date().toISOString(),
          type: 'note' as const,
          content: n.content,
          note_type: (n as any).note_type || (n as any).type || 'note',
          profiles: profileMap[(n as any).author_id || n.created_by],
          scheduled_at: (n as any).scheduled_at,
          completed_at: (n as any).completed_at,
          assigned_profile: (n as any).assigned_to ? profileMap[(n as any).assigned_to] : null,
          is_pinned: (n as any).is_pinned || false
        })),
        ...(attachments || []).map(a => ({
          id: a.id,
          opportunity_id: a.opportunity_id,
          created_at: a.created_at || new Date().toISOString(),
          type: 'attachment' as const,
          content: `Arquivo: ${a.file_name}`,
          note_type: 'attachment',
          file_name: a.file_name,
          file_url: (a as any).file_path || (a as any).file_url,
          file_size: (a as any).size || (a as any).file_size || 0,
          profiles: profileMap[a.uploaded_by],
          is_pinned: (a as any).is_pinned || false
        }))
      ];

      // Insert Loss Reason as special timeline event
      if (opportunity.lost_at) {
        const lossReasonMap: Record<string, string> = {
          high_price: "Preço muito alto",
          competitor: "Escolheu concorrente",
          bad_timing: "Timing inadequado",
          no_budget: "Sem orçamento",
          no_authority: "Sem autoridade/decisão",
          no_need: "Sem necessidade",
          no_response: "Sem resposta",
          other: "Outro motivo",
        };
        const readableReason = opportunity.loss_reason ? (lossReasonMap[opportunity.loss_reason] || opportunity.loss_reason) : 'Não informado';

        items.push({
          id: `loss-${opportunity.id}`,
          opportunity_id: opportunity.id,
          created_at: opportunity.lost_at,
          type: 'note',
          note_type: 'loss',
          content: `MOTIVO DA PERDA: ${readableReason}\n\nDETALHES:\n${opportunity.loss_notes || 'Sem detalhes.'}`,
          is_pinned: false
        });
      }

      return items.sort((a, b) => {
        if (a.is_pinned && !b.is_pinned) return -1;
        if (!a.is_pinned && b.is_pinned) return 1;
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      });
    },
    enabled: !!opportunity?.id,
  });

  const filteredItems = timelineItems.filter(item => {
    if (activeFilter === "Todas") return true;
    if (activeFilter === "Anexos") return item.type === "attachment" || item.note_type === "attachment";
    if (activeFilter === "Notas") return item.note_type === "note";
    if (activeFilter === "Atividades") return ["call", "meeting", "whatsapp", "email", "activity"].includes(item.note_type);
    if (activeFilter === "WhatsApp") return item.note_type === "whatsapp";
    if (activeFilter === "Email") return item.note_type === "email";
    if (activeFilter === "Follow-up") return item.note_type === "follow_up";
    return true;
  });

  const getInitials = (name: string | null | undefined) => {
    if (!name) return "?";
    return name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 mb-4">
        <Calendar className="w-5 h-5 text-primary" />
        <h3 className="text-lg font-semibold tracking-tight text-foreground">Linha do Tempo</h3>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 mb-6">
        {["Todas", "Notas", "Atividades", "Follow-up", "Anexos", "WhatsApp", "Email"].map((filter) => (
          <button
            key={filter}
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setActiveFilter(filter);
            }}
            className={cn(
              "px-3 py-1.5 rounded-md text-xs font-medium transition-all",
              activeFilter === filter
                ? "bg-primary text-primary-foreground shadow-sm"
                : "bg-muted text-muted-foreground hover:bg-muted/80"
            )}
          >
            {filter}
          </button>
        ))}
      </div>

      <ScrollArea className="h-[600px] pr-4">
        <div className="relative space-y-8 before:absolute before:inset-0 before:ml-5 before:-translate-x-px before:h-full before:w-0.5 before:bg-gradient-to-b before:from-border before:via-border/50 before:to-transparent">
          {filteredItems.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground text-sm italic">
              Nenhuma atividade encontrada para este filtro.
            </div>
          ) : (
            filteredItems.map((item) => (
              <div key={item.id} className="relative flex items-start gap-4 group">
                <div className={cn(
                  "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border shadow-sm z-10 transition-transform group-hover:scale-110",
                  getEventStyling(item.note_type)
                )}>
                  {getEventIcon(item.note_type)}
                </div>

                <div className={cn("flex-1 min-w-0 bg-card rounded-xl border p-4 shadow-sm hover:shadow-md transition-shadow relative", item.is_pinned ? "border-primary/50 shadow-primary/5 bg-primary/5" : "border-border")}>
                  <div className="flex items-start justify-between gap-4 mb-2">
                    <div>
                      <h4 className="text-sm font-bold text-foreground leading-none">
                        {getEventLabel(item.note_type)}
                      </h4>
                      {item.profiles && (
                        <p className="text-[11px] text-muted-foreground mt-1">
                          por {item.profiles.full_name || item.profiles.email}
                        </p>
                      )}
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            togglePinMutation.mutate({ id: item.id, type: item.type, currentPin: !!item.is_pinned });
                          }}
                          className={cn("text-muted-foreground hover:text-primary transition-colors opacity-0 group-hover:opacity-100", item.is_pinned && "opacity-100 text-primary")}
                          title={item.is_pinned ? "Desafixar" : "Fixar"}
                        >
                          <Pin className={cn("w-3.5 h-3.5", item.is_pinned && "fill-current")} />
                        </button>
                        <span className="text-[11px] font-medium text-muted-foreground whitespace-nowrap">
                          {(item.created_at && !isNaN(new Date(item.created_at).getTime()))
                            ? format(new Date(item.created_at), "dd MMM, HH:mm", { locale: ptBR })
                            : "Data inválida"}
                        </span>
                      </div>
                      {item.profiles && (
                        <Avatar className="h-6 w-6 border border-border shadow-sm">
                          <AvatarImage src={item.profiles.avatar_url} />
                          <AvatarFallback className="text-[10px] bg-muted">
                            {getInitials(item.profiles.full_name)}
                          </AvatarFallback>
                        </Avatar>
                      )}
                    </div>
                  </div>

                  <div className="text-sm text-foreground/80 whitespace-pre-wrap leading-relaxed">
                    {editingId === item.id ? (
                      <div className="space-y-2">
                        <Textarea
                          value={editContent}
                          onChange={(e) => setEditContent(e.target.value)}
                          className="min-h-[100px]"
                        />
                        <div className="flex gap-2 justify-end">
                          <Button size="sm" variant="ghost" type="button" onClick={() => setEditingId(null)}><X className="w-4 h-4 mr-1" /> Cancelar</Button>
                          <Button size="sm" type="button" onClick={() => updateNoteMutation.mutate({ id: item.id, content: editContent })}><Check className="w-4 h-4 mr-1" /> Salvar</Button>
                        </div>
                      </div>
                    ) : (
                      item.content
                    )}
                  </div>

                  {/* Edit Button (Only for author) */}
                  {!editingId && item.type === 'note' && currentUser && item.profiles && currentUser.id === item.profiles.id && (
                    <button
                      onClick={() => { setEditingId(item.id); setEditContent(item.content); }}
                      className="absolute bottom-4 right-4 text-muted-foreground hover:text-primary opacity-0 group-hover:opacity-100 transition-opacity"
                      title="Editar"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                  )}

                  {item.note_type === 'follow_up' && (
                    <div className="mt-3 flex flex-col gap-2">
                      {item.scheduled_at && (
                        <div className="p-2 bg-blue-500/5 rounded-lg border border-blue-500/10 flex items-center gap-2 text-xs text-blue-600 font-medium">
                          <Calendar className="w-3.5 h-3.5" />
                          <span>Agendado para: {format(new Date(item.scheduled_at), "dd 'de' MMMM 'às' HH:mm", { locale: ptBR })}</span>
                          {item.completed_at && (
                            <div className="ml-auto flex items-center gap-1 text-emerald-600">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span>Concluído</span>
                            </div>
                          )}
                        </div>
                      )}
                      {item.assigned_profile && (
                        <div className="text-[11px] text-muted-foreground flex items-center gap-1 ml-1">
                          <span className="uppercase font-bold text-[10px] tracking-wide">Responsável:</span>
                          <div className="flex items-center gap-1.5 bg-muted/50 px-2 py-0.5 rounded-full border border-border/50">
                            <Avatar className="h-4 w-4">
                              <AvatarImage src={item.assigned_profile.avatar_url} />
                              <AvatarFallback className="text-[6px]">{getInitials(item.assigned_profile.full_name)}</AvatarFallback>
                            </Avatar>
                            <span className="font-medium text-foreground/80">{item.assigned_profile.full_name}</span>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {item.type === 'attachment' && (
                    <div className="mt-4 pt-3 border-t border-border flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded bg-muted flex items-center justify-center">
                          <FileIcon className="w-4 h-4 text-muted-foreground" />
                        </div>
                        <div className="flex flex-col">
                          <span className="text-xs font-medium text-foreground/90 max-w-[200px] truncate">
                            {item.file_name}
                          </span>
                          <span className="text-[10px] text-muted-foreground">
                            {item.file_size ? (item.file_size / 1024 / 1024).toFixed(2) : '0.00'} MB
                          </span>
                        </div>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0 hover:bg-muted"
                        onClick={async () => {
                          if (!item.file_url) return;
                          const { data, error } = await supabase.storage
                            .from("opportunity-attachments")
                            .download(item.file_url);
                          if (error) {
                            toast.error("Erro ao baixar arquivo");
                            return;
                          }
                          const url = URL.createObjectURL(data);
                          const a = document.createElement('a');
                          a.href = url;
                          a.download = item.file_name || 'arquivo';
                          a.click();
                        }}
                      >
                        <Download className="w-4 h-4 text-muted-foreground" />
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
