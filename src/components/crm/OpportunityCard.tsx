import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { DollarSign, Building2, Briefcase, Lock, MailOpen, CreditCard, FileSignature, Clock, Snowflake, Sun, Flame, Megaphone } from "lucide-react";
import { formatDistanceToNow, parseISO, isPast, format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuTrigger } from "@/components/ui/context-menu";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { useMemo } from "react";

interface OpportunityCardProps {
  opportunity: any;
  onClick: () => void;
  isOverlay?: boolean;
}

export function OpportunityCard({ opportunity, onClick, isOverlay }: OpportunityCardProps) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: opportunity.id,
    disabled: isOverlay
  });
  const queryClient = useQueryClient();
  const { currentWorkspace } = useWorkspace();

  const style = {
    transform: transform ? CSS.Translate.toString(transform) : undefined,
    transition: isDragging ? "none" : "transform 200ms ease",
    position: 'relative' as const,
    zIndex: isDragging ? 50 : 1,
    opacity: isDragging && !isOverlay ? 0 : 1, // Torna o card original invisível enquanto arrasta
  };

  const markAsUnreadMutation = useMutation({
    mutationFn: async () => {
      const { error } = await (supabase as any)
        .from("opportunities")
        .update({ is_new_lead: true })
        .eq("id", opportunity.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["opportunities", currentWorkspace?.id] });
      toast.success("Marcado como não lido");
    },
    onError: () => {
      toast.error("Erro ao atualizar status");
    }
  });

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  const getDaysInStage = (date: string) => {
    if (!date) return "0";
    return formatDistanceToNow(new Date(date), {
      locale: ptBR,
    });
  };

  const formatCurrency = (val: number) => {
    return val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 0 });
  };

  const value = opportunity.negotiated_value || opportunity.estimated_value || 0;
  const oppProducts = opportunity.opportunity_products || [];

  const leadOrigin = useMemo(() => {
    const isWebinarTag = opportunity.opportunity_tag_assignments?.some((a: any) => a.crm_tags?.name === "Webnário");
    const isHeld = opportunity.is_held;
    const quizSubmission = opportunity.quiz_submissions?.[0];
    const webhookName = (opportunity.custom_fields as any)?.webhook_name;
    const utmSource = (opportunity.custom_fields as any)?.utm_source;

    if (quizSubmission?.quizzes?.title) {
      return { label: `Quiz: ${quizSubmission.quizzes.title}`, type: 'quiz' };
    }
    if (isHeld || isWebinarTag) {
      return { label: "Funil: Webnário", type: 'webinar' };
    }
    if (webhookName) {
      return { label: `Funil: ${webhookName}`, type: 'webhook' };
    }
    if (utmSource) {
      return { label: `Origem: ${utmSource}`, type: 'utm' };
    }
    if (opportunity.source && opportunity.source !== 'manual') {
      return { label: `Origem: ${opportunity.source}`, type: 'source' };
    }
    return null;
  }, [opportunity]);

  return (
    <ContextMenu>
      <ContextMenuTrigger>
        <TooltipProvider delayDuration={300}>
          <div ref={setNodeRef} style={style} {...listeners} {...attributes}>
            {/* New Lead Indicator */}
            {opportunity.is_new_lead && (
              <span className="absolute -top-1.5 -right-1.5 flex h-3 w-3 z-50 pointer-events-none">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-sky-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-sky-500 border-2 border-background"></span>
              </span>
            )}

            <Card
              className={cn(
                "cursor-grab active:cursor-grabbing hover:shadow-2xl transition-all duration-500 group overflow-hidden rounded-[24px]",
                "bg-white dark:bg-black/90 border-2 border-slate-100 dark:border-white/5 shadow-xl",
                "hover:border-[#3B82F6]/50 dark:hover:border-[#3B82F6]/50 hover:scale-[1.03] hover:shadow-[#3B82F6]/10",
                isDragging && "opacity-50 ring-2 ring-[#3B82F6] shadow-2xl scale-95",
                opportunity.is_held && "border-amber-500/40 bg-amber-500/[0.05]",
                opportunity.next_follow_up && isPast(parseISO(opportunity.next_follow_up.scheduled_at)) &&
                "border-rose-500/40 shadow-[0_12px_40px_rgba(244,63,94,0.2)]"
              )}
              onClick={(e) => {
                if (transform) return;
                onClick();
              }}
            >
              <CardContent className="p-0">
                {/* Follow-up Header (Sleek) */}
                {opportunity.next_follow_up && (() => {
                  const scheduledDate = parseISO(opportunity.next_follow_up.scheduled_at);
                  const isOverdue = isPast(scheduledDate);

                  return (
                    <div className={cn(
                      "px-4 py-1.5 flex items-center justify-between border-b transition-colors",
                      isOverdue
                        ? "bg-rose-500/10 border-rose-500/20 text-rose-500 animate-pulse"
                        : "bg-[#3B82F6]/10 border-[#3B82F6]/20 text-[#3B82F6] dark:text-[#60A5FA]"
                    )}>
                      <div className="flex items-center gap-2">
                        <Clock className="w-3 h-3" />
                        <span className="text-[9px] font-black uppercase tracking-widest">
                          {isOverdue ? "Atrasado" : "Agendado"}
                        </span>
                      </div>
                      <span className="text-[9px] font-fira-code font-black">
                        {format(scheduledDate, "dd/MM 'às' HH:mm", { locale: ptBR })}
                      </span>
                    </div>
                  );
                })()}

                <div className="p-5 space-y-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0 space-y-2">
                      {/* Lead Origin Indicator */}
                      {leadOrigin && (
                        <div className="flex items-center gap-2">
                          <div className={cn(
                            "w-1.5 h-1.5 rounded-full shadow-sm",
                            leadOrigin.type === 'quiz' ? "bg-indigo-500" :
                              leadOrigin.type === 'webinar' ? "bg-amber-500" : "bg-emerald-500"
                          )} />
                          <span className="text-[9px] font-black uppercase tracking-[0.2em] text-[#1D4ED8]/40 dark:text-white/30 truncate block">
                            {leadOrigin.label}
                          </span>
                        </div>
                      )}
                      {/* UTM Campaign & Ad Info */}
                      {((opportunity.custom_fields as any)?.utm_campaign || (opportunity.custom_fields as any)?.utm_content) && (
                        <div className="flex items-center gap-2">
                          <Megaphone className="w-3 h-3 text-violet-500/40 shrink-0" />
                          <span className="text-[9px] font-bold text-violet-500/60 dark:text-violet-400/50 truncate block">
                            {(opportunity.custom_fields as any)?.utm_campaign || ""}
                            {(opportunity.custom_fields as any)?.utm_content ? ` · ${(opportunity.custom_fields as any).utm_content}` : ""}
                          </span>
                        </div>
                      )}

                      <div className="flex items-center gap-2">
                        <h4 className="font-black text-sm text-[#1D4ED8] dark:text-white tracking-tight leading-tight group-hover:text-[#3B82F6] transition-colors uppercase">
                          {opportunity.lead_name}
                        </h4>
                        {opportunity.lead_score === 'frio' && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <div className="bg-sky-500/10 p-1 rounded-full border border-sky-500/20">
                                <Snowflake className="w-3 h-3 text-sky-500" />
                              </div>
                            </TooltipTrigger>
                            <TooltipContent side="top" className="text-[10px] font-black uppercase tracking-widest bg-black/90 dark:bg-white text-white dark:text-black p-2 border-none">
                              <p>Lead Frio</p>
                            </TooltipContent>
                          </Tooltip>
                        )}
                        {opportunity.lead_score === 'morno' && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <div className="bg-amber-500/10 p-1 rounded-full border border-amber-500/20">
                                <Sun className="w-3 h-3 text-amber-500" />
                              </div>
                            </TooltipTrigger>
                            <TooltipContent side="top" className="text-[10px] font-black uppercase tracking-widest bg-black/90 dark:bg-white text-white dark:text-black p-2 border-none">
                              <p>Lead Morno</p>
                            </TooltipContent>
                          </Tooltip>
                        )}
                        {opportunity.lead_score === 'quente' && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <div className="bg-rose-500/10 p-1 rounded-full border border-rose-500/20">
                                <Flame className="w-3 h-3 text-rose-500" />
                              </div>
                            </TooltipTrigger>
                            <TooltipContent side="top" className="text-[10px] font-black uppercase tracking-widest bg-black/90 dark:bg-white text-white dark:text-black p-2 border-none">
                              <p>Lead Quente</p>
                            </TooltipContent>
                          </Tooltip>
                        )}
                      </div>
                      {opportunity.lead_company && (
                        <div className="flex items-center gap-2">
                          <Building2 className="w-3 h-3 text-[#3B82F6]/30 dark:text-white/20" />
                          <p className="text-[10px] font-bold text-[#1D4ED8]/60 dark:text-white/40 uppercase tracking-wide truncate">
                            {opportunity.lead_company}
                          </p>
                        </div>
                      )}
                    </div>

                    <div className="flex flex-col gap-1.5 items-end">
                      {opportunity.won_at && (
                        <Badge className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 text-[8px] h-4 px-1.5 font-black uppercase tracking-widest">WON</Badge>
                      )}
                      {opportunity.lost_at && (
                        <Badge className="bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20 text-[8px] h-4 px-1.5 font-black uppercase tracking-widest">LOST</Badge>
                      )}
                      {opportunity.is_held && (
                        <Badge className="bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20 text-[8px] h-4 px-1.5 font-black uppercase tracking-widest flex items-center gap-1">
                          <Lock className="w-2.5 h-2.5" />
                          HELD
                        </Badge>
                      )}
                    </div>
                  </div>

                  {oppProducts.length > 0 && (
                    <div className="space-y-2 py-3 border-y border-[#3B82F6]/5 dark:border-white/5 bg-black/[0.02] dark:bg-white/[0.02] -mx-5 px-5">
                      {oppProducts.map((p: any, idx: number) => (
                        <div key={idx} className="flex flex-col gap-1">
                          <div className="flex items-center justify-between text-[11px] font-black group/prod">
                            <span className="flex items-center gap-2 truncate text-[#1D4ED8]/70 dark:text-white/60 group-hover/prod:text-[#3B82F6] transition-colors">
                              <Briefcase className="w-3 h-3 text-[#3B82F6]/30 shrink-0" />
                              {p.products?.name.toUpperCase()}
                            </span>
                            <span className="text-[#1D4ED8] dark:text-white font-fira-code">{formatCurrency(p.negotiated_price)}</span>
                          </div>
                          {Number(p.negotiated_implementation_fee) > 0 && (
                            <div className="flex items-center justify-between text-[9px] font-black ml-5">
                              <span className="text-[#1D4ED8]/40 dark:text-white/20 uppercase tracking-widest">Setup Fee</span>
                              <span className="text-emerald-500/80 font-fira-code">+{formatCurrency(Number(p.negotiated_implementation_fee))}</span>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Avatar className="h-7 w-7 border-2 border-white dark:border-[#0A0510] shadow-sm z-20">
                            <AvatarFallback className="text-[9px] bg-[#3B82F6] text-white font-black">
                              {opportunity.assigned_sdr_profile?.full_name
                                ? getInitials(opportunity.assigned_sdr_profile.full_name)
                                : "S"}
                            </AvatarFallback>
                          </Avatar>
                        </TooltipTrigger>
                        <TooltipContent side="top" className="text-[10px] font-black uppercase tracking-widest bg-black/90 dark:bg-white text-white dark:text-black p-2 border-none">
                          <p>SDR: {opportunity.assigned_sdr_profile?.full_name || "N/A"}</p>
                        </TooltipContent>
                      </Tooltip>

                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Avatar className="h-7 w-7 border-2 border-white dark:border-[#0A0510] shadow-sm ml-[-10px] z-10">
                            <AvatarFallback className="text-[9px] bg-[#F97316] text-white font-black">
                              {opportunity.assigned_closer_profile?.full_name
                                ? getInitials(opportunity.assigned_closer_profile.full_name)
                                : "C"}
                            </AvatarFallback>
                          </Avatar>
                        </TooltipTrigger>
                        <TooltipContent side="top" className="text-[10px] font-black uppercase tracking-widest bg-black/90 dark:bg-white text-white dark:text-black p-2 border-none">
                          <p>Closer: {opportunity.assigned_closer_profile?.full_name || "N/A"}</p>
                        </TooltipContent>
                      </Tooltip>
                    </div>

                    <div className="flex flex-col items-end gap-1">
                      <div className="flex items-center gap-2">
                        {opportunity.payment_status === 'paid' && (
                          <div title="Pago" className="bg-emerald-500/10 p-1 rounded-lg border border-emerald-500/20">
                            <CreditCard className="w-3 h-3 text-emerald-500" />
                          </div>
                        )}
                        {opportunity.contract_signature_status === 'signed' && (
                          <div title="Contrato Assinado" className="bg-indigo-500/10 p-1 rounded-lg border border-indigo-500/20">
                            <FileSignature className="w-3 h-3 text-indigo-500" />
                          </div>
                        )}
                        <Badge variant="secondary" className="text-[9px] h-5 px-2 font-black bg-[#3B82F6]/5 dark:bg-white/5 text-[#3B82F6] dark:text-white/40 border-none rounded-lg uppercase">
                          {getDaysInStage(opportunity.stage_changed_at)}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-1.5 text-lg font-black text-[#3B82F6] dark:text-[#60A5FA] tracking-tighter font-fira-code">
                        <span className="text-[10px] opacity-50 font-sans">R$</span>
                        <span>{Number(value).toLocaleString('pt-BR', { minimumFractionDigits: 0 })}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TooltipProvider>
      </ContextMenuTrigger>
      <ContextMenuContent>
        <ContextMenuItem onClick={() => markAsUnreadMutation.mutate()}>
          <MailOpen className="mr-2 h-4 w-4" />
          Marcar como não aberto
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}
