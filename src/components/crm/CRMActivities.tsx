import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { format, isPast, isToday, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
    Calendar,
    Clock,
    User,
    CheckCircle2,
    Circle,
    AlertCircle,
    ChevronRight,
    Search,
    Filter,
    MessageSquare,
    Phone,
    Mail,
    Bell
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";

interface CRMActivitiesProps {
    onOpportunityClick: (opportunity: any) => void;
}

export function CRMActivities({ onOpportunityClick }: CRMActivitiesProps) {
    const { currentWorkspace, user } = useWorkspace();
    const queryClient = useQueryClient();
    const [searchTerm, setSearchTerm] = useState("");
    const [showCompleted, setShowCompleted] = useState(false);

    const { data: activities = [], isLoading } = useQuery({
        queryKey: ["crm-activities", currentWorkspace?.id],
        queryFn: async () => {
            if (!currentWorkspace?.id || !user?.id) return [];

            const { data, error } = await supabase
                .from("opportunity_notes")
                .select(`
                    *,
                    opportunity:opportunities!inner (
                        *,
                        assigned_sdr_profile:profiles!assigned_sdr (full_name),
                        assigned_closer_profile:profiles!assigned_closer (full_name)
                    ),
                    creator:profiles!created_by (
                        full_name,
                        avatar_url
                    ),
                    assignee:profiles!assigned_to (
                        full_name,
                        avatar_url
                    )
                `)
                .eq("opportunity.workspace_id", currentWorkspace.id)
                .eq("note_type", "follow_up")
                .or(`assigned_to.eq.${user.id},and(created_by.eq.${user.id},assigned_to.is.null)`)
                .order("scheduled_at", { ascending: true });

            if (error) throw error;
            return (data || []) as any[];
        },
        enabled: !!currentWorkspace?.id && !!user?.id,
    });

    const toggleCompleteMutation = useMutation({
        mutationFn: async ({ id, completed }: { id: string, completed: boolean }) => {
            const { error } = await (supabase as any)
                .from("opportunity_notes")
                .update({
                    completed_at: completed ? new Date().toISOString() : null
                })
                .eq("id", id);
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["crm-activities", currentWorkspace?.id] });
            toast.success("Atividade atualizada!");
        },
    });

    const filteredActivities = activities.filter(act => {
        const matchesSearch = !searchTerm ||
            act.opportunity.lead_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            act.content.toLowerCase().includes(searchTerm.toLowerCase());

        const matchesStatus = showCompleted ? !!act.completed_at : !act.completed_at;

        return matchesSearch && matchesStatus;
    });

    const getStatusInfo = (scheduledAt: string, completedAt: string | null) => {
        if (completedAt) return { label: "Concluído", color: "text-emerald-500 bg-emerald-500/10", icon: CheckCircle2 };
        const date = parseISO(scheduledAt);
        if (isPast(date)) return { label: "Atrasado", color: "text-rose-500 bg-rose-500/10", icon: AlertCircle };
        if (isToday(date)) return { label: "Hoje", color: "text-amber-500 bg-amber-500/10", icon: Clock };
        return { label: "Agendado", color: "text-blue-500 bg-blue-500/10", icon: Calendar };
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
        );
    }

    return (
        <div className="space-y-6 animate-in fade-in duration-700">
            {/* Search and Filters */}
            <div className="flex flex-col md:flex-row gap-4 justify-between items-start md:items-center bg-white/40 dark:bg-white/5 backdrop-blur-xl p-2 rounded-2xl border border-white/60 dark:border-white/10 shadow-xl">
                <div className="relative w-full md:w-[400px] group">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[#3B82F6] dark:text-[#60A5FA] transition-transform group-focus-within:scale-110" />
                    <Input
                        placeholder="Pesquisar leads ou follow-ups..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-11 h-10 bg-white/50 dark:bg-black/20 border-white/40 dark:border-white/5 rounded-xl text-[10px] font-black uppercase tracking-widest focus:ring-2 ring-[#3B82F6]/20 transition-all border-none"
                    />
                </div>
                <div className="flex items-center gap-1.5 bg-white/60 dark:bg-white/5 p-1 rounded-xl border border-white/40 dark:border-white/5 shadow-inner">
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setShowCompleted(false)}
                        className={cn(
                            "text-[8px] font-black uppercase tracking-widest h-8 px-5 rounded-lg transition-all",
                            !showCompleted ? "bg-[#3B82F6] text-white shadow-lg shadow-[#3B82F6]/20" : "text-[#1D4ED8]/40 dark:text-white/30 hover:bg-[#3B82F6]/10 dark:hover:bg-white/5"
                        )}
                    >
                        Pendentes
                    </Button>
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setShowCompleted(true)}
                        className={cn(
                            "text-[8px] font-black uppercase tracking-widest h-8 px-5 rounded-lg transition-all",
                            showCompleted ? "bg-[#3B82F6] text-white shadow-lg shadow-[#3B82F6]/20" : "text-[#1D4ED8]/40 dark:text-white/30 hover:bg-[#3B82F6]/10 dark:hover:bg-white/5"
                        )}
                    >
                        Concluídas
                    </Button>
                </div>
            </div>

            {/* Activities List */}
            <div className="grid gap-4">
                {filteredActivities.length === 0 ? (
                    <div className="text-center py-20 bg-white/20 dark:bg-white/[0.02] rounded-[32px] border-4 border-dashed border-white/40 dark:border-white/5 backdrop-blur-md">
                        <Bell className="h-12 w-12 text-[#3B82F6] dark:text-[#60A5FA] opacity-20 mx-auto mb-4" />
                        <h3 className="text-[11px] font-black text-[#1D4ED8] dark:text-white uppercase tracking-[0.3em]">Horizonte Limpo</h3>
                        <p className="text-[9px] text-[#1D4ED8]/40 dark:text-white/30 font-bold uppercase tracking-widest mt-1.5">Nenhuma atividade pendente para este filtro.</p>
                    </div>
                ) : (
                    filteredActivities.map((activity) => {
                        const status = getStatusInfo(activity.scheduled_at, activity.completed_at);
                        const scheduledDate = parseISO(activity.scheduled_at);

                        return (
                            <Card key={activity.id} className={cn(
                                "group bg-white/40 dark:bg-white/5 border border-white/60 dark:border-white/10 shadow-lg rounded-2xl overflow-hidden backdrop-blur-xl transition-all hover:scale-[1.01] hover:border-[#3B82F6]/30",
                                activity.completed_at && "opacity-60 grayscale-[0.5]"
                            )}>
                                <CardContent className="p-5">
                                    <div className="flex flex-col md:flex-row items-start gap-6">
                                        <button
                                            onClick={() => toggleCompleteMutation.mutate({ id: activity.id, completed: !activity.completed_at })}
                                            className="mt-0.5 transition-all active:scale-90 group/check"
                                        >
                                            {activity.completed_at ? (
                                                <div className="w-8 h-8 rounded-xl bg-emerald-500 flex items-center justify-center shadow-lg shadow-emerald-500/20">
                                                    <CheckCircle2 className="h-4 w-4 text-white" />
                                                </div>
                                            ) : (
                                                <div className="w-8 h-8 rounded-xl bg-white/60 dark:bg-white/10 border border-white/60 dark:border-white/10 flex items-center justify-center group-hover/check:border-[#3B82F6]/40 transition-colors">
                                                    <Circle className="h-5 w-5 text-[#1D4ED8]/20 dark:text-white/20 group-hover/check:text-[#3B82F6]/40" />
                                                </div>
                                            )}
                                        </button>

                                        <div className="flex-1 min-w-0 space-y-4">
                                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                                <div className="flex items-center gap-3">
                                                    <span
                                                        className="text-lg font-black text-[#1D4ED8] dark:text-white uppercase tracking-tight group-hover:text-[#3B82F6] transition-colors cursor-pointer"
                                                        onClick={() => onOpportunityClick(activity.opportunity)}
                                                    >
                                                        {activity.opportunity.lead_name}
                                                    </span>
                                                    <Badge className={cn("text-[8px] font-black uppercase tracking-[0.15em] px-2 py-0.5 rounded-lg shadow-sm border-none", status.color)}>
                                                        <status.icon className="w-3 h-3 mr-1.5" />
                                                        {status.label}
                                                    </Badge>
                                                </div>
                                                <div className="flex items-center gap-3 text-[9px] font-black text-[#1D4ED8]/40 dark:text-white/30 uppercase tracking-[0.2em] font-fira-code">
                                                    <div className="flex items-center gap-1.5">
                                                        <Calendar className="h-3 w-3 text-[#3B82F6]" />
                                                        {format(scheduledDate, "d 'de' MMM", { locale: ptBR })}
                                                    </div>
                                                    <div className="flex items-center gap-1.5">
                                                        <Clock className="h-3 w-3 text-blue-500" />
                                                        {format(scheduledDate, "HH:mm")}
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="bg-white/60 dark:bg-white/[0.03] border border-white/60 dark:border-white/5 rounded-xl p-4 text-[10.5px] font-bold text-[#1D4ED8]/80 dark:text-white/70 leading-relaxed tracking-wide shadow-inner">
                                                {activity.content}
                                            </div>

                                            <div className="flex items-center justify-between gap-3">
                                                <div className="flex items-center gap-4">
                                                    <div className="flex items-center gap-2 text-[9px] font-black uppercase tracking-widest text-[#1D4ED8]/40 dark:text-white/30">
                                                        <User className="h-3.5 w-3.5 text-[#3B82F6]" />
                                                        <span>{activity.assignee?.full_name || activity.opportunity.assigned_closer_profile?.full_name || "Sem Responsável"}</span>
                                                    </div>
                                                    {activity.opportunity.lead_company && (
                                                        <div className="text-[8px] font-black uppercase tracking-[0.1em] px-2 py-0.5 bg-[#3B82F6]/5 text-[#3B82F6] rounded-md border border-[#3B82F6]/10">
                                                            {activity.opportunity.lead_company}
                                                        </div>
                                                    )}
                                                </div>
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    className="h-8 px-4 text-[9px] font-black uppercase tracking-widest rounded-lg hover:bg-[#3B82F6]/10 group/btn transition-all"
                                                    onClick={() => onOpportunityClick(activity.opportunity)}
                                                >
                                                    Visualizar Pipeline
                                                    <ChevronRight className="h-3 w-3 ml-1.5 transition-transform group-hover/btn:translate-x-1" />
                                                </Button>
                                            </div>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        );
                    })
                )}
            </div>
        </div>
    );
}
