import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useKbStats(workspaceId?: string) {
  return useQuery({
    queryKey: ["kb-stats", workspaceId],
    queryFn: async () => {
      if (!workspaceId) return {};
      const { data, error } = await supabase
        .from("kb_documents" as any)
        .select("kb_type, id")
        .eq("workspace_id", workspaceId)
        .eq("status", "ready");
      if (error) throw error;
      const stats: Record<string, number> = {};
      for (const doc of (data as any[]) || []) {
        const type = doc.kb_type || "uncategorized";
        stats[type] = (stats[type] || 0) + 1;
      }
      return stats;
    },
    enabled: !!workspaceId,
  });
}
