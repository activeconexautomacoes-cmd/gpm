import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { useToast } from "@/hooks/use-toast";
import type { ArtFormat, ArtRequest, ArtRequestFormat, ArtComment, ArtFile, ArtStatus, NewArtRequestForm } from "@/types/artes";

// ─── Formats ──────────────────────────────────────────────

export function useArtFormats() {
  const { currentWorkspace } = useWorkspace();
  return useQuery({
    queryKey: ["art-formats", currentWorkspace?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("art_formats")
        .select("*")
        .eq("workspace_id", currentWorkspace!.id)
        .order("name");
      if (error) throw error;
      return data as ArtFormat[];
    },
    enabled: !!currentWorkspace?.id,
  });
}

export function useCreateArtFormat() {
  const qc = useQueryClient();
  const { currentWorkspace, user } = useWorkspace();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (format: { name: string; width: number; height: number }) => {
      const { data, error } = await supabase.from("art_formats").insert({
        ...format,
        workspace_id: currentWorkspace!.id,
        created_by: user!.id,
      }).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["art-formats"] });
      toast({ title: "Formato criado com sucesso" });
    },
    onError: (e: Error) => toast({ variant: "destructive", title: "Erro ao criar formato", description: e.message }),
  });
}

export function useUpdateArtFormat() {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async ({ id, ...updates }: { id: string; name?: string; width?: number; height?: number; active?: boolean }) => {
      const { error } = await supabase.from("art_formats").update(updates).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["art-formats"] });
      toast({ title: "Formato atualizado" });
    },
    onError: (e: Error) => toast({ variant: "destructive", title: "Erro", description: e.message }),
  });
}

// ─── Requests ─────────────────────────────────────────────

export function useArtRequests(filters?: { status?: ArtStatus; designer_id?: string; gestor_id?: string }) {
  const { currentWorkspace } = useWorkspace();
  return useQuery({
    queryKey: ["art-requests", currentWorkspace?.id, filters],
    queryFn: async () => {
      let query = supabase
        .from("art_requests")
        .select(`
          *,
          gestor:profiles!art_requests_gestor_id_fkey(id, full_name, email, avatar_url),
          designer:profiles!art_requests_designer_id_fkey(id, full_name, email, avatar_url),
          formats:art_request_formats(
            id, request_id, format_id, ai_brief, created_at,
            format:art_formats(id, name, width, height)
          )
        `)
        .eq("workspace_id", currentWorkspace!.id)
        .order("created_at", { ascending: false });

      if (filters?.status) query = query.eq("status", filters.status);
      if (filters?.designer_id) query = query.eq("designer_id", filters.designer_id);
      if (filters?.gestor_id) query = query.eq("gestor_id", filters.gestor_id);

      const { data, error } = await query;
      if (error) throw error;
      return data as ArtRequest[];
    },
    enabled: !!currentWorkspace?.id,
    refetchInterval: 30000,
  });
}

export function useArtRequest(id: string) {
  return useQuery({
    queryKey: ["art-request", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("art_requests")
        .select(`
          *,
          gestor:profiles!art_requests_gestor_id_fkey(id, full_name, email, avatar_url),
          designer:profiles!art_requests_designer_id_fkey(id, full_name, email, avatar_url),
          formats:art_request_formats(
            id, request_id, format_id, ai_brief, created_at,
            format:art_formats(id, name, width, height)
          )
        `)
        .eq("id", id)
        .single();
      if (error) throw error;
      return data as ArtRequest;
    },
    enabled: !!id,
  });
}

export function useCreateArtRequest() {
  const qc = useQueryClient();
  const { currentWorkspace, user } = useWorkspace();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (form: NewArtRequestForm) => {
      // 1. Create the request
      const { data: request, error: reqError } = await supabase
        .from("art_requests")
        .insert({
          workspace_id: currentWorkspace!.id,
          gestor_id: user!.id,
          designer_id: form.designer_id,
          site_url: form.site_url,
          promotion: form.promotion,
          additional_text: form.additional_text || null,
          deadline: form.deadline || null,
          priority: form.priority,
          status: "solicitada" as const,
        })
        .select()
        .single();
      if (reqError) throw reqError;

      // 2. Create request formats
      const formatInserts = form.format_ids.map((format_id) => ({
        request_id: request.id,
        format_id,
      }));
      const { error: fmtError } = await supabase.from("art_request_formats").insert(formatInserts);
      if (fmtError) throw fmtError;

      // 3. Call Edge Function to generate brief
      const { data: formats } = await supabase
        .from("art_formats")
        .select("id, name, width, height")
        .in("id", form.format_ids);

      const { data: briefResult, error: briefError } = await supabase.functions.invoke("generate-brief", {
        body: {
          siteUrl: form.site_url,
          promotion: form.promotion,
          formats: formats || [],
          additionalText: form.additional_text || "",
          requestId: request.id,
        },
      });

      if (briefError) {
        console.error("Brief generation error:", briefError);
        toast({ variant: "destructive", title: "Brief não gerado", description: "A solicitação foi criada mas o brief da IA falhou. Você pode regerar depois." });
      }

      return request;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["art-requests"] });
    },
    onError: (e: Error) => toast({ variant: "destructive", title: "Erro ao criar solicitação", description: e.message }),
  });
}

export function useUpdateArtRequestStatus() {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: ArtStatus }) => {
      const { error } = await supabase
        .from("art_requests")
        .update({ status, updated_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["art-requests"] });
      qc.invalidateQueries({ queryKey: ["art-request"] });
    },
    onError: (e: Error) => toast({ variant: "destructive", title: "Erro ao atualizar status", description: e.message }),
  });
}

export function useRegenerateBrief() {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async ({ requestId, siteUrl, promotion, formats, additionalText }: {
      requestId: string;
      siteUrl: string;
      promotion: string;
      formats: { id: string; name: string; width: number; height: number }[];
      additionalText: string;
    }) => {
      const { data, error } = await supabase.functions.invoke("generate-brief", {
        body: { siteUrl, promotion, formats, additionalText, requestId },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["art-request"] });
      toast({ title: "Brief regenerado com sucesso" });
    },
    onError: (e: Error) => toast({ variant: "destructive", title: "Erro ao regerar brief", description: e.message }),
  });
}

// ─── Comments ─────────────────────────────────────────────

export function useArtComments(requestId: string) {
  return useQuery({
    queryKey: ["art-comments", requestId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("art_comments")
        .select(`
          *,
          user:profiles!art_comments_user_id_fkey(id, full_name, avatar_url)
        `)
        .eq("request_id", requestId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data as ArtComment[];
    },
    enabled: !!requestId,
  });
}

export function useCreateArtComment() {
  const qc = useQueryClient();
  const { user } = useWorkspace();
  return useMutation({
    mutationFn: async ({ request_id, content }: { request_id: string; content: string }) => {
      const { error } = await supabase.from("art_comments").insert({
        request_id,
        user_id: user!.id,
        content,
      });
      if (error) throw error;
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["art-comments", vars.request_id] });
    },
  });
}

// ─── Files ────────────────────────────────────────────────

export function useArtFiles(requestId: string) {
  return useQuery({
    queryKey: ["art-files", requestId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("art_files")
        .select(`
          *,
          uploader:profiles!art_files_uploaded_by_fkey(id, full_name)
        `)
        .eq("request_id", requestId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as ArtFile[];
    },
    enabled: !!requestId,
  });
}

export function useUploadArtFile() {
  const qc = useQueryClient();
  const { user } = useWorkspace();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async ({ requestId, formatId, file }: { requestId: string; formatId?: string; file: File }) => {
      // Get current version count
      const { count } = await supabase
        .from("art_files")
        .select("*", { count: "exact", head: true })
        .eq("request_id", requestId)
        .eq("file_name", file.name);

      const version = (count || 0) + 1;
      const path = `${requestId}/${Date.now()}-${file.name}`;

      // Upload to storage
      const { error: uploadError } = await supabase.storage
        .from("art-files")
        .upload(path, file);
      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from("art-files")
        .getPublicUrl(path);

      // Save record
      const { error } = await supabase.from("art_files").insert({
        request_id: requestId,
        format_id: formatId || null,
        file_url: publicUrl,
        file_name: file.name,
        version,
        uploaded_by: user!.id,
      });
      if (error) throw error;
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["art-files", vars.requestId] });
      toast({ title: "Arquivo enviado com sucesso" });
    },
    onError: (e: Error) => toast({ variant: "destructive", title: "Erro no upload", description: e.message }),
  });
}

// ─── Designers (all workspace members for now) ───────────

export function useDesigners() {
  const { currentWorkspace } = useWorkspace();
  return useQuery({
    queryKey: ["art-designers", currentWorkspace?.id],
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

// ─── Metrics (Admin) ──────────────────────────────────────

export function useArtMetrics(dateFrom?: string, dateTo?: string) {
  const { currentWorkspace } = useWorkspace();
  return useQuery({
    queryKey: ["art-metrics", currentWorkspace?.id, dateFrom, dateTo],
    queryFn: async () => {
      let query = supabase
        .from("art_requests")
        .select("id, status, designer_id, gestor_id, created_at, updated_at")
        .eq("workspace_id", currentWorkspace!.id);

      if (dateFrom) query = query.gte("created_at", dateFrom);
      if (dateTo) query = query.lte("created_at", dateTo + "T23:59:59");

      const { data: requests, error } = await query;
      if (error) throw error;

      // Fetch profiles for names
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, full_name");
      const profileMap: Record<string, string> = {};
      (profiles || []).forEach((p: any) => { profileMap[p.id] = p.full_name || "Sem nome"; });

      const all = requests || [];
      const solicitadas = all.length;
      const concluidas = all.filter((r) => r.status === "concluida");

      // Artes por gestor
      const byGestor: Record<string, number> = {};
      all.forEach((r) => {
        const name = profileMap[r.gestor_id] || r.gestor_id;
        byGestor[name] = (byGestor[name] || 0) + 1;
      });

      // Artes por designer (total atribuídas)
      const byDesigner: Record<string, number> = {};
      all.forEach((r) => {
        const name = profileMap[r.designer_id] || r.designer_id;
        byDesigner[name] = (byDesigner[name] || 0) + 1;
      });

      // Artes concluídas por designer
      const completedByDesigner: Record<string, number> = {};
      concluidas.forEach((r) => {
        const name = profileMap[r.designer_id] || r.designer_id;
        completedByDesigner[name] = (completedByDesigner[name] || 0) + 1;
      });

      // Tempo médio geral (só concluídas)
      let totalHours = 0;
      concluidas.forEach((r) => {
        const hours = (new Date(r.updated_at).getTime() - new Date(r.created_at).getTime()) / (1000 * 60 * 60);
        totalHours += hours;
      });
      const avgHoursGeral = concluidas.length > 0 ? totalHours / concluidas.length : 0;

      // Tempo médio por designer (só concluídas)
      const designerHours: Record<string, { total: number; count: number }> = {};
      concluidas.forEach((r) => {
        const name = profileMap[r.designer_id] || r.designer_id;
        const hours = (new Date(r.updated_at).getTime() - new Date(r.created_at).getTime()) / (1000 * 60 * 60);
        if (!designerHours[name]) designerHours[name] = { total: 0, count: 0 };
        designerHours[name].total += hours;
        designerHours[name].count++;
      });
      const avgHoursByDesigner: Record<string, number> = {};
      Object.entries(designerHours).forEach(([name, data]) => {
        avgHoursByDesigner[name] = data.total / data.count;
      });

      // Por status
      const byStatus: Record<string, number> = {};
      all.forEach((r) => { byStatus[r.status] = (byStatus[r.status] || 0) + 1; });

      // Por mês
      const byMonth: Record<string, number> = {};
      all.forEach((r) => {
        const month = r.created_at.substring(0, 7);
        byMonth[month] = (byMonth[month] || 0) + 1;
      });

      return {
        solicitadas,
        concluidas: concluidas.length,
        byStatus,
        byMonth,
        byGestor,
        byDesigner,
        completedByDesigner,
        avgHoursGeral,
        avgHoursByDesigner,
      };
    },
    enabled: !!currentWorkspace?.id,
  });
}
