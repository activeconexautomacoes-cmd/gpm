import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { useToast } from "@/hooks/use-toast";
import type {
  ClientPanelClient,
  ClientPanelError,
  ClientPanelDifficulty,
  ClientPanelTimelineEvent,
  ClientPanelStatus,
  NewClientForm,
  NewErrorForm,
  NewDifficultyForm,
  NewTimelineEventForm,
} from "@/types/clientPanel";

// ─── Clients ─────────────────────────────────────────────

export function useClientPanelClients(filters?: { status?: ClientPanelStatus; search?: string }) {
  const { currentWorkspace } = useWorkspace();
  return useQuery({
    queryKey: ["cp-clients", currentWorkspace?.id, filters],
    queryFn: async () => {
      let query = supabase
        .from("client_panel_clients")
        .select(`
          *,
          gestor:profiles!client_panel_clients_gestor_id_fkey(id, full_name, avatar_url),
          lider:profiles!client_panel_clients_lider_id_fkey(id, full_name, avatar_url),
          cs:profiles!client_panel_clients_cs_id_fkey(id, full_name, avatar_url)
        `)
        .eq("workspace_id", currentWorkspace!.id)
        .order("client_name");

      if (filters?.status) query = query.eq("status", filters.status);
      if (filters?.search) query = query.ilike("client_name", `%${filters.search}%`);

      const { data, error } = await query;
      if (error) throw error;
      return data as ClientPanelClient[];
    },
    enabled: !!currentWorkspace?.id,
  });
}

export function useClientPanelClient(id: string) {
  return useQuery({
    queryKey: ["cp-client", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("client_panel_clients")
        .select(`
          *,
          gestor:profiles!client_panel_clients_gestor_id_fkey(id, full_name, avatar_url),
          lider:profiles!client_panel_clients_lider_id_fkey(id, full_name, avatar_url),
          cs:profiles!client_panel_clients_cs_id_fkey(id, full_name, avatar_url)
        `)
        .eq("id", id)
        .single();
      if (error) throw error;
      return data as ClientPanelClient;
    },
    enabled: !!id,
  });
}

export function useCreateClient() {
  const qc = useQueryClient();
  const { currentWorkspace, user } = useWorkspace();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (form: NewClientForm) => {
      const { data, error } = await supabase
        .from("client_panel_clients")
        .insert({
          workspace_id: currentWorkspace!.id,
          client_name: form.client_name,
          gestor_id: form.gestor_id || null,
          lider_id: form.lider_id || null,
          cs_id: form.cs_id || null,
          expectativa: form.expectativa || null,
          criativos_drive_url: form.criativos_drive_url || null,
          status: form.status,
          joined_at: form.joined_at || null,
          left_at: form.left_at || null,
          created_by: user!.id,
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["cp-clients"] });
      toast({ title: "Cliente cadastrado com sucesso" });
    },
    onError: (e: Error) => toast({ variant: "destructive", title: "Erro ao cadastrar cliente", description: e.message }),
  });
}

export function useUpdateClient() {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<NewClientForm> & { id: string }) => {
      const { error } = await supabase
        .from("client_panel_clients")
        .update(updates)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["cp-clients"] });
      qc.invalidateQueries({ queryKey: ["cp-client"] });
      toast({ title: "Cliente atualizado" });
    },
    onError: (e: Error) => toast({ variant: "destructive", title: "Erro ao atualizar", description: e.message }),
  });
}

export function useDeleteClient() {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("client_panel_clients")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["cp-clients"] });
      toast({ title: "Cliente removido" });
    },
    onError: (e: Error) => toast({ variant: "destructive", title: "Erro ao remover", description: e.message }),
  });
}

// ─── Errors ──────────────────────────────────────────────

export function useClientErrors(clientId?: string) {
  const { currentWorkspace } = useWorkspace();
  return useQuery({
    queryKey: ["cp-errors", currentWorkspace?.id, clientId],
    queryFn: async () => {
      let query = supabase
        .from("client_panel_errors")
        .select(`
          *,
          responsible:profiles!client_panel_errors_responsible_id_fkey(id, full_name, avatar_url),
          client:client_panel_clients!client_panel_errors_client_id_fkey(client_name)
        `)
        .eq("workspace_id", currentWorkspace!.id)
        .order("occurred_at", { ascending: false });

      if (clientId) query = query.eq("client_id", clientId);

      const { data, error } = await query;
      if (error) throw error;
      return data as ClientPanelError[];
    },
    enabled: !!currentWorkspace?.id,
  });
}

export function useAllErrors(dateFrom?: string, dateTo?: string) {
  const { currentWorkspace } = useWorkspace();
  return useQuery({
    queryKey: ["cp-all-errors", currentWorkspace?.id, dateFrom, dateTo],
    queryFn: async () => {
      let query = supabase
        .from("client_panel_errors")
        .select(`
          *,
          responsible:profiles!client_panel_errors_responsible_id_fkey(id, full_name, avatar_url),
          client:client_panel_clients!client_panel_errors_client_id_fkey(client_name)
        `)
        .eq("workspace_id", currentWorkspace!.id)
        .order("occurred_at", { ascending: false });

      if (dateFrom) query = query.gte("occurred_at", dateFrom);
      if (dateTo) query = query.lte("occurred_at", dateTo);

      const { data, error } = await query;
      if (error) throw error;
      return data as ClientPanelError[];
    },
    enabled: !!currentWorkspace?.id,
  });
}

export function useCreateError() {
  const qc = useQueryClient();
  const { currentWorkspace, user } = useWorkspace();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (form: NewErrorForm) => {
      const { error } = await supabase.from("client_panel_errors").insert({
        workspace_id: currentWorkspace!.id,
        client_id: form.client_id,
        description: form.description,
        responsible_id: form.responsible_id || null,
        category: form.category,
        occurred_at: form.occurred_at,
        created_by: user!.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["cp-errors"] });
      qc.invalidateQueries({ queryKey: ["cp-all-errors"] });
      toast({ title: "Erro registrado" });
    },
    onError: (e: Error) => toast({ variant: "destructive", title: "Erro ao registrar", description: e.message }),
  });
}

export function useDeleteError() {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("client_panel_errors").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["cp-errors"] });
      qc.invalidateQueries({ queryKey: ["cp-all-errors"] });
      toast({ title: "Erro removido" });
    },
    onError: (e: Error) => toast({ variant: "destructive", title: "Erro", description: e.message }),
  });
}

// ─── Difficulties ────────────────────────────────────────

export function useClientDifficulties(clientId: string) {
  return useQuery({
    queryKey: ["cp-difficulties", clientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("client_panel_difficulties")
        .select("*")
        .eq("client_id", clientId)
        .order("occurred_at", { ascending: false });
      if (error) throw error;
      return data as ClientPanelDifficulty[];
    },
    enabled: !!clientId,
  });
}

export function useCreateDifficulty() {
  const qc = useQueryClient();
  const { currentWorkspace, user } = useWorkspace();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (form: NewDifficultyForm) => {
      const { error } = await supabase.from("client_panel_difficulties").insert({
        workspace_id: currentWorkspace!.id,
        client_id: form.client_id,
        description: form.description,
        occurred_at: form.occurred_at,
        created_by: user!.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["cp-difficulties"] });
      toast({ title: "Dificuldade registrada" });
    },
    onError: (e: Error) => toast({ variant: "destructive", title: "Erro ao registrar", description: e.message }),
  });
}

export function useDeleteDifficulty() {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("client_panel_difficulties").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["cp-difficulties"] });
      toast({ title: "Dificuldade removida" });
    },
    onError: (e: Error) => toast({ variant: "destructive", title: "Erro", description: e.message }),
  });
}

// ─── Timeline ────────────────────────────────────────────

export function useClientTimeline(clientId: string) {
  return useQuery({
    queryKey: ["cp-timeline", clientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("client_panel_timeline")
        .select(`
          *,
          author:profiles!client_panel_timeline_created_by_fkey(id, full_name, avatar_url)
        `)
        .eq("client_id", clientId)
        .order("occurred_at", { ascending: false });
      if (error) throw error;
      return data as ClientPanelTimelineEvent[];
    },
    enabled: !!clientId,
  });
}

export function useCreateTimelineEvent() {
  const qc = useQueryClient();
  const { currentWorkspace, user } = useWorkspace();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (form: NewTimelineEventForm) => {
      const { error } = await supabase.from("client_panel_timeline").insert({
        workspace_id: currentWorkspace!.id,
        client_id: form.client_id,
        content: form.content,
        event_type: form.event_type,
        occurred_at: form.occurred_at,
        created_by: user!.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["cp-timeline"] });
      toast({ title: "Evento adicionado a timeline" });
    },
    onError: (e: Error) => toast({ variant: "destructive", title: "Erro ao adicionar", description: e.message }),
  });
}

export function useDeleteTimelineEvent() {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("client_panel_timeline").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["cp-timeline"] });
      toast({ title: "Evento removido" });
    },
    onError: (e: Error) => toast({ variant: "destructive", title: "Erro", description: e.message }),
  });
}

// ─── Members (reuse pattern from artes) ──────────────────

export function useWorkspaceMembers() {
  const { currentWorkspace } = useWorkspace();
  return useQuery({
    queryKey: ["cp-members", currentWorkspace?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("workspace_members")
        .select(`
          user_id,
          profiles!workspace_members_user_id_fkey(id, full_name, email, avatar_url)
        `)
        .eq("workspace_id", currentWorkspace!.id);
      if (error) throw error;
      return (data || [])
        .filter((m: any) => m.profiles)
        .map((m: any) => ({
          id: m.profiles.id,
          full_name: m.profiles.full_name || m.profiles.email || "Membro",
          email: m.profiles.email,
          avatar_url: m.profiles.avatar_url,
        }));
    },
    enabled: !!currentWorkspace?.id,
  });
}
