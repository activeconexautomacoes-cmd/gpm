-- ============================================================
-- KB (Base de Conhecimento) — Infraestrutura completa
-- Tabelas: kb_documents, kb_chunks, kb_conversations, kb_messages, kb_quality_scores, kb_search_log
-- Storage: bucket kb-uploads
-- Extensão: pgvector
-- ============================================================

-- ── 0. Extensão pgvector ────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA extensions;

-- ── 1. kb_documents — Documentos da base de conhecimento ────
CREATE TABLE IF NOT EXISTS public.kb_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  source_type text NOT NULL DEFAULT 'markdown',
  source_path text,
  source_hash text,
  title text NOT NULL DEFAULT 'Sem título',
  category text,
  subcategory text,
  tags text[] NOT NULL DEFAULT '{}',
  metadata jsonb NOT NULL DEFAULT '{}',
  kb_type text,
  content_size_bytes integer NOT NULL DEFAULT 0,
  chunk_count integer NOT NULL DEFAULT 0,
  token_count integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'processing'
    CHECK (status IN ('processing', 'ready', 'error')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_kb_documents_workspace ON public.kb_documents(workspace_id);
CREATE INDEX IF NOT EXISTS idx_kb_documents_kb_type ON public.kb_documents(kb_type);
CREATE INDEX IF NOT EXISTS idx_kb_documents_status ON public.kb_documents(status);

-- ── 2. kb_chunks — Chunks com embeddings ────────────────────
CREATE TABLE IF NOT EXISTS public.kb_chunks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id uuid NOT NULL REFERENCES public.kb_documents(id) ON DELETE CASCADE,
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  content text NOT NULL,
  chunk_index integer NOT NULL DEFAULT 0,
  chunk_type text NOT NULL DEFAULT 'content'
    CHECK (chunk_type IN ('content', 'summary', 'frontmatter')),
  embedding vector(512),
  category text,
  subcategory text,
  tags text[] NOT NULL DEFAULT '{}',
  token_count integer NOT NULL DEFAULT 0,
  char_start integer NOT NULL DEFAULT 0,
  char_end integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_kb_chunks_document ON public.kb_chunks(document_id);
CREATE INDEX IF NOT EXISTS idx_kb_chunks_workspace ON public.kb_chunks(workspace_id);
CREATE INDEX IF NOT EXISTS idx_kb_chunks_category ON public.kb_chunks(category);

-- HNSW index for vector search
CREATE INDEX IF NOT EXISTS idx_kb_chunks_embedding ON public.kb_chunks
  USING hnsw (embedding vector_cosine_ops) WITH (m = 16, ef_construction = 64);

-- ── 3. kb_conversations — Conversas com o agente KB ─────────
CREATE TABLE IF NOT EXISTS public.kb_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'paused', 'completed')),
  wizard_choice text
    CHECK (wizard_choice IN ('has_materials', 'from_scratch')),
  overall_score numeric NOT NULL DEFAULT 0
    CHECK (overall_score >= 0 AND overall_score <= 10),
  category_scores jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_kb_conversations_workspace ON public.kb_conversations(workspace_id);
CREATE INDEX IF NOT EXISTS idx_kb_conversations_status ON public.kb_conversations(status);

-- ── 4. kb_messages — Mensagens da conversa ──────────────────
CREATE TABLE IF NOT EXISTS public.kb_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.kb_conversations(id) ON DELETE CASCADE,
  role text NOT NULL
    CHECK (role IN ('user', 'assistant', 'system')),
  content text NOT NULL DEFAULT '',
  message_type text NOT NULL DEFAULT 'text'
    CHECK (message_type IN ('text', 'file')),
  attachments jsonb DEFAULT '[]',
  metadata jsonb DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_kb_messages_conversation ON public.kb_messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_kb_messages_created ON public.kb_messages(created_at);

-- ── 5. kb_quality_scores — Scores por categoria ─────────────
CREATE TABLE IF NOT EXISTS public.kb_quality_scores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  category text NOT NULL,
  score numeric NOT NULL DEFAULT 0
    CHECK (score >= 0 AND score <= 10),
  criteria jsonb NOT NULL DEFAULT '{}',
  missing_items text[] NOT NULL DEFAULT '{}',
  superficial_items text[] NOT NULL DEFAULT '{}',
  analysis_summary text,
  analyzed_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  UNIQUE(workspace_id, category)
);

CREATE INDEX IF NOT EXISTS idx_kb_quality_scores_workspace ON public.kb_quality_scores(workspace_id);

-- ── 6. kb_search_log — Log de buscas ────────────────────────
CREATE TABLE IF NOT EXISTS public.kb_search_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  query_text text NOT NULL,
  query_embedding text,
  filters jsonb DEFAULT '{}',
  top_k integer NOT NULL DEFAULT 10,
  result_count integer NOT NULL DEFAULT 0,
  result_chunk_ids uuid[] DEFAULT '{}',
  result_scores numeric[] DEFAULT '{}',
  latency_ms integer,
  caller text NOT NULL DEFAULT 'manual'
    CHECK (caller IN ('manual', 'kb_agent', 'api')),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ── 7. Hybrid search function ───────────────────────────────
CREATE OR REPLACE FUNCTION public.kb_hybrid_search(
  p_workspace_id uuid,
  p_query_embedding text,
  p_query_text text,
  p_category text DEFAULT NULL,
  p_tags text[] DEFAULT NULL,
  p_chunk_type text DEFAULT NULL,
  p_top_k integer DEFAULT 10,
  p_project_id uuid DEFAULT NULL
)
RETURNS TABLE (
  chunk_id uuid,
  document_id uuid,
  content text,
  category text,
  chunk_index integer,
  chunk_type text,
  vector_score double precision,
  text_score double precision,
  combined_score double precision
)
LANGUAGE plpgsql
AS $$
DECLARE
  query_vec vector(512);
BEGIN
  query_vec := p_query_embedding::vector(512);

  RETURN QUERY
  WITH vector_results AS (
    SELECT
      c.id AS chunk_id,
      c.document_id,
      c.content,
      c.category,
      c.chunk_index,
      c.chunk_type,
      1 - (c.embedding <=> query_vec) AS v_score,
      ROW_NUMBER() OVER (ORDER BY c.embedding <=> query_vec) AS v_rank
    FROM public.kb_chunks c
    WHERE c.workspace_id = p_workspace_id
      AND c.embedding IS NOT NULL
      AND (p_category IS NULL OR c.category = p_category)
      AND (p_chunk_type IS NULL OR c.chunk_type = p_chunk_type)
      AND (p_tags IS NULL OR c.tags && p_tags)
    LIMIT p_top_k * 2
  ),
  text_results AS (
    SELECT
      c.id AS chunk_id,
      ts_rank_cd(to_tsvector('portuguese', c.content), plainto_tsquery('portuguese', p_query_text)) AS t_score,
      ROW_NUMBER() OVER (ORDER BY ts_rank_cd(to_tsvector('portuguese', c.content), plainto_tsquery('portuguese', p_query_text)) DESC) AS t_rank
    FROM public.kb_chunks c
    WHERE c.workspace_id = p_workspace_id
      AND to_tsvector('portuguese', c.content) @@ plainto_tsquery('portuguese', p_query_text)
      AND (p_category IS NULL OR c.category = p_category)
      AND (p_chunk_type IS NULL OR c.chunk_type = p_chunk_type)
    LIMIT p_top_k * 2
  ),
  rrf AS (
    SELECT
      COALESCE(v.chunk_id, t.chunk_id) AS chunk_id,
      (1.0 / (60 + COALESCE(v.v_rank, 1000))) + (1.0 / (60 + COALESCE(t.t_rank, 1000))) AS rrf_score,
      COALESCE(v.v_score, 0) AS vector_score,
      COALESCE(t.t_score, 0) AS text_score
    FROM vector_results v
    FULL OUTER JOIN text_results t ON v.chunk_id = t.chunk_id
  )
  SELECT
    r.chunk_id,
    c.document_id,
    c.content,
    c.category,
    c.chunk_index,
    c.chunk_type,
    r.vector_score,
    r.text_score,
    r.rrf_score AS combined_score
  FROM rrf r
  JOIN public.kb_chunks c ON c.id = r.chunk_id
  ORDER BY r.rrf_score DESC
  LIMIT p_top_k;
END;
$$;

-- ── 8. RLS Policies ─────────────────────────────────────────

-- kb_documents
ALTER TABLE public.kb_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view kb_documents" ON public.kb_documents
  FOR SELECT USING (workspace_id IN (
    SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid()
  ));
CREATE POLICY "Members can insert kb_documents" ON public.kb_documents
  FOR INSERT WITH CHECK (workspace_id IN (
    SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid()
  ));
CREATE POLICY "Members can update kb_documents" ON public.kb_documents
  FOR UPDATE USING (workspace_id IN (
    SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid()
  ));
CREATE POLICY "Members can delete kb_documents" ON public.kb_documents
  FOR DELETE USING (workspace_id IN (
    SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid()
  ));
CREATE POLICY "Service role full access kb_documents" ON public.kb_documents
  FOR ALL USING (auth.role() = 'service_role');

-- kb_chunks
ALTER TABLE public.kb_chunks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view kb_chunks" ON public.kb_chunks
  FOR SELECT USING (workspace_id IN (
    SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid()
  ));
CREATE POLICY "Members can insert kb_chunks" ON public.kb_chunks
  FOR INSERT WITH CHECK (workspace_id IN (
    SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid()
  ));
CREATE POLICY "Members can delete kb_chunks" ON public.kb_chunks
  FOR DELETE USING (workspace_id IN (
    SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid()
  ));
CREATE POLICY "Service role full access kb_chunks" ON public.kb_chunks
  FOR ALL USING (auth.role() = 'service_role');

-- kb_conversations
ALTER TABLE public.kb_conversations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view kb_conversations" ON public.kb_conversations
  FOR SELECT USING (workspace_id IN (
    SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid()
  ));
CREATE POLICY "Members can insert kb_conversations" ON public.kb_conversations
  FOR INSERT WITH CHECK (workspace_id IN (
    SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid()
  ));
CREATE POLICY "Members can update kb_conversations" ON public.kb_conversations
  FOR UPDATE USING (workspace_id IN (
    SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid()
  ));
CREATE POLICY "Service role full access kb_conversations" ON public.kb_conversations
  FOR ALL USING (auth.role() = 'service_role');

-- kb_messages
ALTER TABLE public.kb_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view kb_messages" ON public.kb_messages
  FOR SELECT USING (
    conversation_id IN (
      SELECT id FROM public.kb_conversations
      WHERE workspace_id IN (SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid())
    )
  );
CREATE POLICY "Members can insert kb_messages" ON public.kb_messages
  FOR INSERT WITH CHECK (
    conversation_id IN (
      SELECT id FROM public.kb_conversations
      WHERE workspace_id IN (SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid())
    )
  );
CREATE POLICY "Service role full access kb_messages" ON public.kb_messages
  FOR ALL USING (auth.role() = 'service_role');

-- kb_quality_scores
ALTER TABLE public.kb_quality_scores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view kb_quality_scores" ON public.kb_quality_scores
  FOR SELECT USING (workspace_id IN (
    SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid()
  ));
CREATE POLICY "Members can insert kb_quality_scores" ON public.kb_quality_scores
  FOR INSERT WITH CHECK (workspace_id IN (
    SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid()
  ));
CREATE POLICY "Members can update kb_quality_scores" ON public.kb_quality_scores
  FOR UPDATE USING (workspace_id IN (
    SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid()
  ));
CREATE POLICY "Service role full access kb_quality_scores" ON public.kb_quality_scores
  FOR ALL USING (auth.role() = 'service_role');

-- kb_search_log
ALTER TABLE public.kb_search_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access kb_search_log" ON public.kb_search_log
  FOR ALL USING (auth.role() = 'service_role');

-- ── 9. updated_at trigger function ──────────────────────────
CREATE OR REPLACE FUNCTION public.kb_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER kb_documents_set_updated_at
  BEFORE UPDATE ON public.kb_documents
  FOR EACH ROW EXECUTE FUNCTION public.kb_set_updated_at();

CREATE TRIGGER kb_conversations_set_updated_at
  BEFORE UPDATE ON public.kb_conversations
  FOR EACH ROW EXECUTE FUNCTION public.kb_set_updated_at();

CREATE TRIGGER kb_quality_scores_set_updated_at
  BEFORE UPDATE ON public.kb_quality_scores
  FOR EACH ROW EXECUTE FUNCTION public.kb_set_updated_at();

-- ── 10. Realtime ────────────────────────────────────────────
ALTER PUBLICATION supabase_realtime ADD TABLE public.kb_quality_scores;
ALTER PUBLICATION supabase_realtime ADD TABLE public.kb_messages;

-- ── 11. Storage bucket (create via CLI or Dashboard) ────────
-- supabase storage create kb-uploads --public false
-- Max file size: 10MB (documents)
-- Policies: authenticated users, path starts with workspace_id
