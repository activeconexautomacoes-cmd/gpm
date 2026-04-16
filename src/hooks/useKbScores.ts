import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEffect } from "react";
import { getCategoryKeys } from "@/lib/kb/quality-criteria";

export interface KbCategoryScore {
  category: string;
  score: number;
  criteria: Record<string, "absent" | "superficial" | "complete">;
  missing_items: string[];
  superficial_items: string[];
  analysis_summary: string | null;
  analyzed_at: string;
}

/** Load quality scores for all categories */
export function useKbScores(workspaceId?: string) {
  return useQuery({
    queryKey: ["kb-scores", workspaceId],
    queryFn: async () => {
      if (!workspaceId) return { categories: {}, overall: 0 };

      const { data, error } = await supabase
        .from("kb_quality_scores" as any)
        .select("*")
        .eq("workspace_id", workspaceId)
        .order("category");

      if (error) throw error;

      const categories: Record<string, KbCategoryScore> = {};
      let totalScore = 0;
      const categoryCount = getCategoryKeys().length;

      for (const row of (data as unknown as KbCategoryScore[]) || []) {
        categories[row.category] = row;
        totalScore += Number(row.score);
      }

      const overall = Math.round((totalScore / categoryCount) * 10) / 10;

      return { categories, overall };
    },
    enabled: !!workspaceId,
  });
}

/** Poll for score changes instead of realtime (avoids Supabase channel race condition) */
export function useKbScoresRealtime(workspaceId?: string) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!workspaceId) return;

    const interval = setInterval(() => {
      queryClient.invalidateQueries({ queryKey: ["kb-scores"] });
    }, 5000);

    return () => clearInterval(interval);
  }, [workspaceId, queryClient]);
}

/** Get overall score only (for alerts in other pages) */
export function useKbOverallScore(workspaceId?: string) {
  const { data } = useKbScores(workspaceId);
  return data?.overall ?? 0;
}
