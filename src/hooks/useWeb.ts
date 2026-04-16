import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { useToast } from "@/hooks/use-toast";
import type { WebRequest, WebComment, WebFile, WebStatus, NewWebRequestForm } from "@/types/web";

// ─── Requests ─────────────────────────────────────────────

export function useWebRequests() {
  const { currentWorkspace } = useWorkspace();
  return useQuery({
    queryKey: ["web-requests", currentWorkspace?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("web_requests")
        .select(`*, gestor:profiles!web_requests_gestor_id_fkey(id, full_name, email, avatar_url)`)
        .eq("workspace_id", currentWorkspace!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as WebRequest[];
    },
    enabled: !!currentWorkspace?.id,
    refetchInterval: 30000,
  });
}

export function useWebRequest(id: string) {
  return useQuery({
    queryKey: ["web-request", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("web_requests")
        .select(`*, gestor:profiles!web_requests_gestor_id_fkey(id, full_name, email, avatar_url)`)
        .eq("id", id)
        .single();
      if (error) throw error;
      return data as WebRequest;
    },
    enabled: !!id,
  });
}

export function useCreateWebRequest() {
  const qc = useQueryClient();
  const { currentWorkspace, user } = useWorkspace();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (form: NewWebRequestForm) => {
      const { data: request, error } = await supabase
        .from("web_requests")
        .insert({
          workspace_id: currentWorkspace!.id,
          gestor_id: user!.id,
          title: form.title,
          description: form.description,
          request_type: form.request_type,
          site_url: form.site_url || null,
          reference_urls: form.reference_urls?.filter(Boolean) || null,
          gestor_suggestion: form.gestor_suggestion || null,
          deadline: form.deadline || null,
          priority: form.priority,
          status: "solicitada" as const,
        })
        .select()
        .single();
      if (error) throw error;

      // Upload files
      if (form.files?.length) {
        for (const file of form.files) {
          const path = `${request.id}/${Date.now()}-${file.name}`;
          const { error: upErr } = await supabase.storage.from("web-files").upload(path, file);
          if (upErr) continue;
          const { data: { publicUrl } } = supabase.storage.from("web-files").getPublicUrl(path);
          await supabase.from("web_files").insert({
            request_id: request.id,
            file_url: publicUrl,
            file_name: file.name,
            uploaded_by: user!.id,
          });
        }
      }

      return request;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["web-requests"] });
      toast({ title: "Demanda web enviada com sucesso!" });
    },
    onError: (e: Error) => toast({ variant: "destructive", title: "Erro ao criar demanda", description: e.message }),
  });
}

export function useUpdateWebRequest() {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async ({ id, ...updates }: { id: string; title?: string; description?: string; site_url?: string; reference_urls?: string[]; gestor_suggestion?: string; deadline?: string | null; priority?: "normal" | "urgente" }) => {
      const { error } = await supabase.from("web_requests").update({ ...updates, updated_at: new Date().toISOString() }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["web-requests"] });
      qc.invalidateQueries({ queryKey: ["web-request"] });
      toast({ title: "Demanda atualizada" });
    },
    onError: (e: Error) => toast({ variant: "destructive", title: "Erro ao atualizar", description: e.message }),
  });
}

export function useUpdateWebRequestStatus() {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: WebStatus }) => {
      const { error } = await supabase
        .from("web_requests")
        .update({ status, updated_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["web-requests"] });
      qc.invalidateQueries({ queryKey: ["web-request"] });
    },
    onError: (e: Error) => toast({ variant: "destructive", title: "Erro ao atualizar status", description: e.message }),
  });
}

// ─── Comments ─────────────────────────────────────────────

export function useWebComments(requestId: string) {
  return useQuery({
    queryKey: ["web-comments", requestId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("web_comments")
        .select(`*, user:profiles!web_comments_user_id_fkey(id, full_name, avatar_url)`)
        .eq("request_id", requestId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data as WebComment[];
    },
    enabled: !!requestId,
  });
}

export function useCreateWebComment() {
  const qc = useQueryClient();
  const { user } = useWorkspace();
  return useMutation({
    mutationFn: async ({ request_id, content }: { request_id: string; content: string }) => {
      const { error } = await supabase.from("web_comments").insert({
        request_id,
        user_id: user!.id,
        content,
      });
      if (error) throw error;
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["web-comments", vars.request_id] });
    },
  });
}

// ─── Files ────────────────────────────────────────────────

export function useWebFiles(requestId: string) {
  return useQuery({
    queryKey: ["web-files", requestId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("web_files")
        .select(`*, uploader:profiles!web_files_uploaded_by_fkey(id, full_name)`)
        .eq("request_id", requestId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as WebFile[];
    },
    enabled: !!requestId,
  });
}

export function useUploadWebFile() {
  const qc = useQueryClient();
  const { user } = useWorkspace();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async ({ requestId, file }: { requestId: string; file: File }) => {
      const path = `${requestId}/${Date.now()}-${file.name}`;
      const { error: upErr } = await supabase.storage.from("web-files").upload(path, file);
      if (upErr) throw upErr;
      const { data: { publicUrl } } = supabase.storage.from("web-files").getPublicUrl(path);
      const { error } = await supabase.from("web_files").insert({
        request_id: requestId,
        file_url: publicUrl,
        file_name: file.name,
        uploaded_by: user!.id,
      });
      if (error) throw error;
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["web-files", vars.requestId] });
      toast({ title: "Arquivo enviado" });
    },
    onError: (e: Error) => toast({ variant: "destructive", title: "Erro no upload", description: e.message }),
  });
}

// ─── Metrics ──────────────────────────────────────────────

export function useWebMetrics(dateFrom?: string, dateTo?: string) {
  const { currentWorkspace } = useWorkspace();
  return useQuery({
    queryKey: ["web-metrics", currentWorkspace?.id, dateFrom, dateTo],
    queryFn: async () => {
      let query = supabase
        .from("web_requests")
        .select("id, status, gestor_id, created_at, updated_at, request_type")
        .eq("workspace_id", currentWorkspace!.id);
      if (dateFrom) query = query.gte("created_at", dateFrom);
      if (dateTo) query = query.lte("created_at", dateTo + "T23:59:59");
      const { data, error } = await query;
      if (error) throw error;

      const all = data || [];
      const concluidas = all.filter((r) => r.status === "concluida");
      const byStatus: Record<string, number> = {};
      const byType: Record<string, number> = {};
      const byMonth: Record<string, number> = {};
      all.forEach((r) => {
        byStatus[r.status] = (byStatus[r.status] || 0) + 1;
        byType[r.request_type] = (byType[r.request_type] || 0) + 1;
        byMonth[r.created_at.substring(0, 7)] = (byMonth[r.created_at.substring(0, 7)] || 0) + 1;
      });

      let totalHours = 0;
      concluidas.forEach((r) => {
        totalHours += (new Date(r.updated_at).getTime() - new Date(r.created_at).getTime()) / (1000 * 60 * 60);
      });

      return {
        total: all.length,
        concluidas: concluidas.length,
        byStatus,
        byType,
        byMonth,
        avgHours: concluidas.length > 0 ? totalHours / concluidas.length : 0,
      };
    },
    enabled: !!currentWorkspace?.id,
  });
}
