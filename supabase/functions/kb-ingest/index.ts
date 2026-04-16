import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { corsHeaders, jsonResponse, errorResponse, corsPreflightResponse } from "../_shared/cors.ts";
import { computeHash, extractFrontmatter, extractCategoryFromPath, chunkContent, estimateTokens } from "../_shared/embedding-utils.ts";
import { generateBatchEmbeddings } from "../_shared/openai-client.ts";

interface IngestRequest {
  workspace_id: string;
  files: Array<{
    path: string;
    content: string;
    title?: string;
    category?: string;
    subcategory?: string | null;
    tags?: string[];
    metadata?: Record<string, unknown>;
    kb_type?: string;
    chunks?: Array<{
      content: string;
      chunk_type: "content" | "summary" | "frontmatter";
      token_count: number;
      char_start: number;
      char_end: number;
    }>;
    summary?: string;
  }>;
  skip_embedding?: boolean;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return corsPreflightResponse();

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const body: IngestRequest = await req.json();
    const { workspace_id, files, skip_embedding } = body;

    if (!workspace_id || !files?.length) {
      return errorResponse("workspace_id and files[] required");
    }

    const results = { processed: 0, skipped: 0, errors: [] as string[], chunks_created: 0 };

    for (const file of files) {
      try {
        const hash = await computeHash(file.content);
        const sizeBytes = new TextEncoder().encode(file.content).length;

        const { data: existing } = await supabase
          .from("kb_documents")
          .select("id, source_hash")
          .eq("workspace_id", workspace_id)
          .eq("source_path", file.path)
          .maybeSingle();

        if (existing?.source_hash === hash) {
          results.skipped++;
          continue;
        }

        if (existing) {
          await supabase.from("kb_chunks").delete().eq("document_id", existing.id);
          await supabase.from("kb_documents").delete().eq("id", existing.id);
        }

        const fm = extractFrontmatter(file.content);
        const pathInfo = extractCategoryFromPath(file.path);

        const title = file.title || fm.title;
        const category = file.category || pathInfo.category;
        const subcategory = file.subcategory !== undefined ? file.subcategory : pathInfo.subcategory;
        const tags = file.tags || [];
        const metadata = { ...fm.metadata, ...(file.metadata || {}) };

        let chunks: Array<{
          content: string;
          chunk_type: "content" | "summary" | "frontmatter";
          chunk_index: number;
          token_count: number;
          char_start: number;
          char_end: number;
        }>;

        if (file.chunks?.length) {
          chunks = file.chunks.map((c, i) => ({ ...c, chunk_index: i }));
        } else {
          chunks = chunkContent(fm.content, sizeBytes);
        }

        if (file.summary) {
          chunks.push({
            content: file.summary,
            chunk_type: "summary",
            chunk_index: chunks.length,
            token_count: estimateTokens(file.summary),
            char_start: 0,
            char_end: 0,
          });
        }

        const totalTokens = chunks.reduce((sum, c) => sum + c.token_count, 0);

        const { data: doc, error: docErr } = await supabase
          .from("kb_documents")
          .insert({
            workspace_id,
            source_type: "markdown",
            source_path: file.path,
            source_hash: hash,
            title,
            category,
            subcategory,
            tags,
            metadata,
            kb_type: file.kb_type || null,
            content_size_bytes: sizeBytes,
            chunk_count: chunks.length,
            token_count: totalTokens,
            status: skip_embedding ? "ready" : "processing",
          })
          .select("id")
          .single();

        if (docErr) throw new Error(`Doc insert: ${docErr.message}`);

        let embeddings: number[][] | null = null;
        if (!skip_embedding) {
          try {
            const embResults = await generateBatchEmbeddings(
              chunks.map((c) => c.content)
            );
            embeddings = embResults.map((r) => r.embedding);
          } catch (embErr) {
            console.error(`Embedding failed (non-blocking): ${(embErr as Error).message}`);
            // Continue without embeddings — chunks will be saved without vector search
          }
        }

        const chunkRows = chunks.map((c, i) => ({
          document_id: doc.id,
          workspace_id,
          content: c.content,
          chunk_index: c.chunk_index,
          chunk_type: c.chunk_type,
          embedding: embeddings ? JSON.stringify(embeddings[i]) : null,
          category,
          subcategory,
          tags,
          token_count: c.token_count,
          char_start: c.char_start,
          char_end: c.char_end,
        }));

        for (let i = 0; i < chunkRows.length; i += 50) {
          const batch = chunkRows.slice(i, i + 50);
          const { error: chunkErr } = await supabase
            .from("kb_chunks")
            .insert(batch);
          if (chunkErr) throw new Error(`Chunk insert: ${chunkErr.message}`);
        }

        await supabase
          .from("kb_documents")
          .update({ status: "ready" })
          .eq("id", doc.id);

        results.processed++;
        results.chunks_created += chunks.length;
      } catch (err) {
        results.errors.push(`${file.path}: ${(err as Error).message}`);
      }
    }

    return jsonResponse({
      success: true,
      ...results,
    });
  } catch (err) {
    return errorResponse((err as Error).message, 500);
  }
});
