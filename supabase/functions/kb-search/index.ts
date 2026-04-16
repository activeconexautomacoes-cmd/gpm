import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { corsHeaders, jsonResponse, errorResponse, corsPreflightResponse } from "../_shared/cors.ts";
import { generateEmbedding } from "../_shared/openai-client.ts";

interface SearchRequest {
  workspace_id: string;
  query: string;
  category?: string;
  tags?: string[];
  chunk_type?: string;
  top_k?: number;
  caller?: string;
  expand_context?: boolean;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return corsPreflightResponse();

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const body: SearchRequest = await req.json();
    const {
      workspace_id,
      query,
      category,
      tags,
      chunk_type,
      top_k = 10,
      caller = "manual",
      expand_context = false,
    } = body;

    if (!workspace_id || !query) {
      return errorResponse("workspace_id and query required");
    }

    const startTime = Date.now();

    const { embedding } = await generateEmbedding(query);

    const { data: results, error } = await supabase.rpc("kb_hybrid_search", {
      p_workspace_id: workspace_id,
      p_query_embedding: JSON.stringify(embedding),
      p_query_text: query,
      p_category: category || null,
      p_tags: tags || null,
      p_chunk_type: chunk_type || null,
      p_top_k: top_k,
    });

    if (error) throw new Error(`Search error: ${error.message}`);

    let finalResults = results || [];

    if (expand_context && finalResults.length > 0) {
      const expandedResults = [];
      for (const result of finalResults) {
        const { data: adjacent } = await supabase
          .from("kb_chunks")
          .select("content, chunk_index, chunk_type")
          .eq("document_id", result.document_id)
          .gte("chunk_index", Math.max(0, result.chunk_index - 1))
          .lte("chunk_index", result.chunk_index + 1)
          .order("chunk_index");

        expandedResults.push({
          ...result,
          adjacent_chunks: adjacent || [],
        });
      }
      finalResults = expandedResults;
    }

    const latencyMs = Date.now() - startTime;

    await supabase.from("kb_search_log").insert({
      workspace_id,
      query_text: query,
      query_embedding: JSON.stringify(embedding),
      filters: { category, tags, chunk_type },
      top_k,
      result_count: finalResults.length,
      result_chunk_ids: finalResults.map((r: { chunk_id: string }) => r.chunk_id),
      result_scores: finalResults.map((r: { combined_score: number }) => r.combined_score),
      latency_ms: latencyMs,
      caller,
    });

    return jsonResponse({
      success: true,
      query,
      results: finalResults,
      result_count: finalResults.length,
      latency_ms: latencyMs,
    });
  } catch (err) {
    return errorResponse((err as Error).message, 500);
  }
});
