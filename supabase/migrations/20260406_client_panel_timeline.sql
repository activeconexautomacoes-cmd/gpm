-- ============================================
-- Painel do Cliente - Timeline de Eventos
-- ============================================

-- Enum para tipos de evento
CREATE TYPE client_panel_event_type AS ENUM (
  'mudanca_gestor',
  'mudanca_cs',
  'alinhamento',
  'resultado',
  'insatisfacao',
  'conquista',
  'erro_time',
  'dificuldade_externa',
  'nota'
);

-- ─── Tabela ──────────────────────────────────────────────

CREATE TABLE client_panel_timeline (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id uuid NOT NULL REFERENCES contracts(id) ON DELETE CASCADE,
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  event_type client_panel_event_type NOT NULL,
  content text NOT NULL,
  metadata jsonb DEFAULT '{}',
  occurred_at date NOT NULL DEFAULT CURRENT_DATE,
  created_by uuid NOT NULL REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now()
);

-- ─── Indexes ─────────────────────────────────────────────

CREATE INDEX idx_client_panel_timeline_contract ON client_panel_timeline(contract_id);
CREATE INDEX idx_client_panel_timeline_workspace ON client_panel_timeline(workspace_id);
CREATE INDEX idx_client_panel_timeline_type ON client_panel_timeline(event_type);
CREATE INDEX idx_client_panel_timeline_date ON client_panel_timeline(occurred_at DESC);

-- ─── RLS Policies ────────────────────────────────────────

ALTER TABLE client_panel_timeline ENABLE ROW LEVEL SECURITY;

CREATE POLICY "client_panel_timeline_select" ON client_panel_timeline FOR SELECT
  USING (workspace_id IN (
    SELECT w.id FROM workspaces w
    JOIN workspace_members wm ON wm.workspace_id = w.id
    WHERE wm.user_id = auth.uid()
  ));

CREATE POLICY "client_panel_timeline_insert" ON client_panel_timeline FOR INSERT
  WITH CHECK (
    workspace_id IN (
      SELECT w.id FROM workspaces w
      JOIN workspace_members wm ON wm.workspace_id = w.id
      WHERE wm.user_id = auth.uid()
    )
    AND created_by = auth.uid()
  );

CREATE POLICY "client_panel_timeline_delete" ON client_panel_timeline FOR DELETE
  USING (
    workspace_id IN (
      SELECT w.id FROM workspaces w
      JOIN workspace_members wm ON wm.workspace_id = w.id
      WHERE wm.user_id = auth.uid()
      AND (wm.role = 'owner' OR wm.role = 'admin')
    )
  );

-- ─── Realtime ────────────────────────────────────────────

ALTER PUBLICATION supabase_realtime ADD TABLE client_panel_timeline;
