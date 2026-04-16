import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { useToast } from "@/hooks/use-toast";
import type { ClientPanelTimelineEvent, NewTimelineEventForm } from "@/types/clientPanel";

// ─── Timeline Events ─────────────────────────────────────

export function useTimelineEvents(contractId: string | undefined) {
  const { currentWorkspace } = useWorkspace();
  return useQuery({
    queryKey: ["client-panel-timeline", contractId],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("client_panel_timeline")
        .select(`
          *,
          creator:profiles!client_panel_timeline_created_by_fkey(id, full_name, avatar_url)
        `)
        .eq("contract_id", contractId)
        .eq("workspace_id", currentWorkspace!.id)
        .order("occurred_at", { ascending: false });
      if (error) throw error;
      return data as ClientPanelTimelineEvent[];
    },
    enabled: !!contractId && !!currentWorkspace?.id,
    refetchInterval: 30000,
  });
}

// ─── Create Event ────────────────────────────────────────

export function useCreateTimelineEvent(contractId: string | undefined) {
  const qc = useQueryClient();
  const { currentWorkspace, user } = useWorkspace();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (form: NewTimelineEventForm) => {
      const { data, error } = await (supabase as any)
        .from("client_panel_timeline")
        .insert({
          contract_id: contractId,
          workspace_id: currentWorkspace!.id,
          event_type: form.event_type,
          content: form.content,
          metadata: form.metadata || {},
          occurred_at: form.occurred_at,
          created_by: user!.id,
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["client-panel-timeline", contractId] });
      toast({ title: "Evento registrado com sucesso" });
    },
    onError: (e: Error) =>
      toast({ variant: "destructive", title: "Erro ao registrar evento", description: e.message }),
  });
}

// ─── Delete Event ────────────────────────────────────────

export function useDeleteTimelineEvent(contractId: string | undefined) {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (eventId: string) => {
      const { error } = await (supabase as any)
        .from("client_panel_timeline")
        .delete()
        .eq("id", eventId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["client-panel-timeline", contractId] });
      toast({ title: "Evento removido" });
    },
    onError: (e: Error) =>
      toast({ variant: "destructive", title: "Erro ao remover evento", description: e.message }),
  });
}

// ─── Contract Details (for header) ───────────────────────

export function useContractForPanel(contractId: string | undefined) {
  return useQuery({
    queryKey: ["client-panel-contract", contractId],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("contracts")
        .select(`
          *,
          clients (id, name, email),
          account_manager:account_manager_id (id, full_name, avatar_url),
          cs:cs_id (id, full_name, avatar_url)
        `)
        .eq("id", contractId)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!contractId,
  });
}
