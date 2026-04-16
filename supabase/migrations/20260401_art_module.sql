-- ============================================
-- Módulo de Solicitação de Artes - GPM Nexus
-- ============================================

-- Enums
CREATE TYPE art_priority AS ENUM ('normal', 'urgente');
CREATE TYPE art_status AS ENUM ('solicitada', 'realizando', 'ajustando', 'aprovacao', 'concluida');

-- ─── Tabelas ──────────────────────────────────────────────

CREATE TABLE art_formats (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name text NOT NULL,
  width int NOT NULL,
  height int NOT NULL,
  active boolean DEFAULT true,
  created_by uuid REFERENCES profiles(id),
  created_at timestamptz DEFAULT now()
);

CREATE TABLE art_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  gestor_id uuid NOT NULL REFERENCES profiles(id),
  designer_id uuid NOT NULL REFERENCES profiles(id),
  site_url text NOT NULL,
  promotion text NOT NULL,
  additional_text text,
  deadline date,
  priority art_priority DEFAULT 'normal',
  status art_status DEFAULT 'solicitada',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE art_request_formats (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid NOT NULL REFERENCES art_requests(id) ON DELETE CASCADE,
  format_id uuid NOT NULL REFERENCES art_formats(id),
  ai_brief jsonb,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE art_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid NOT NULL REFERENCES art_requests(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES profiles(id),
  content text NOT NULL,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE art_files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid NOT NULL REFERENCES art_requests(id) ON DELETE CASCADE,
  format_id uuid REFERENCES art_formats(id),
  file_url text NOT NULL,
  file_name text NOT NULL,
  version int DEFAULT 1,
  uploaded_by uuid NOT NULL REFERENCES profiles(id),
  created_at timestamptz DEFAULT now()
);

CREATE TABLE art_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid NOT NULL REFERENCES art_requests(id),
  site_url text NOT NULL,
  promotion text NOT NULL,
  format_name text NOT NULL,
  format_width int NOT NULL,
  format_height int NOT NULL,
  ai_brief jsonb,
  final_file_url text,
  approved_at timestamptz DEFAULT now(),
  approved_by uuid REFERENCES profiles(id)
);

CREATE TABLE site_brands (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_url text NOT NULL UNIQUE,
  brand_data jsonb NOT NULL,
  scraped_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- ─── Índices ──────────────────────────────────────────────

CREATE INDEX idx_art_requests_workspace ON art_requests(workspace_id);
CREATE INDEX idx_art_requests_gestor ON art_requests(gestor_id);
CREATE INDEX idx_art_requests_designer ON art_requests(designer_id);
CREATE INDEX idx_art_requests_status ON art_requests(status);
CREATE INDEX idx_art_request_formats_request ON art_request_formats(request_id);
CREATE INDEX idx_art_comments_request ON art_comments(request_id);
CREATE INDEX idx_art_files_request ON art_files(request_id);
CREATE INDEX idx_art_formats_workspace ON art_formats(workspace_id);

-- ─── Trigger: auto-update updated_at ─────────────────────

CREATE OR REPLACE FUNCTION update_art_request_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_art_request_updated_at
  BEFORE UPDATE ON art_requests
  FOR EACH ROW
  EXECUTE FUNCTION update_art_request_updated_at();

-- ─── Trigger: on art approved → save to history ──────────

CREATE OR REPLACE FUNCTION on_art_approved()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'concluida' AND OLD.status != 'concluida' THEN
    INSERT INTO art_history (request_id, site_url, promotion, format_name, format_width, format_height, ai_brief, final_file_url, approved_by)
    SELECT
      NEW.id,
      NEW.site_url,
      NEW.promotion,
      af.name,
      af.width,
      af.height,
      arf.ai_brief,
      (SELECT file_url FROM art_files WHERE request_id = NEW.id AND format_id = af.id ORDER BY version DESC LIMIT 1),
      (SELECT auth.uid())
    FROM art_request_formats arf
    JOIN art_formats af ON af.id = arf.format_id
    WHERE arf.request_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_art_approved
  AFTER UPDATE ON art_requests
  FOR EACH ROW
  EXECUTE FUNCTION on_art_approved();

-- ─── RLS Policies ─────────────────────────────────────────

ALTER TABLE art_formats ENABLE ROW LEVEL SECURITY;
ALTER TABLE art_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE art_request_formats ENABLE ROW LEVEL SECURITY;
ALTER TABLE art_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE art_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE art_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE site_brands ENABLE ROW LEVEL SECURITY;

-- art_formats: anyone in the workspace can read, managed by those with the role
CREATE POLICY "art_formats_select" ON art_formats FOR SELECT
  USING (workspace_id IN (SELECT w.id FROM workspaces w JOIN workspace_members wm ON wm.workspace_id = w.id WHERE wm.user_id = auth.uid()));

CREATE POLICY "art_formats_insert" ON art_formats FOR INSERT
  WITH CHECK (workspace_id IN (SELECT w.id FROM workspaces w JOIN workspace_members wm ON wm.workspace_id = w.id WHERE wm.user_id = auth.uid()));

CREATE POLICY "art_formats_update" ON art_formats FOR UPDATE
  USING (workspace_id IN (SELECT w.id FROM workspaces w JOIN workspace_members wm ON wm.workspace_id = w.id WHERE wm.user_id = auth.uid()));

-- art_requests: gestor sees their own, designer sees assigned, workspace members with manage see all
CREATE POLICY "art_requests_select" ON art_requests FOR SELECT
  USING (
    gestor_id = auth.uid()
    OR designer_id = auth.uid()
    OR workspace_id IN (SELECT w.id FROM workspaces w JOIN workspace_members wm ON wm.workspace_id = w.id WHERE wm.user_id = auth.uid())
  );

CREATE POLICY "art_requests_insert" ON art_requests FOR INSERT
  WITH CHECK (workspace_id IN (SELECT w.id FROM workspaces w JOIN workspace_members wm ON wm.workspace_id = w.id WHERE wm.user_id = auth.uid()));

CREATE POLICY "art_requests_update" ON art_requests FOR UPDATE
  USING (
    gestor_id = auth.uid()
    OR designer_id = auth.uid()
    OR workspace_id IN (SELECT w.id FROM workspaces w JOIN workspace_members wm ON wm.workspace_id = w.id WHERE wm.user_id = auth.uid())
  );

-- art_request_formats: inherit from art_requests
CREATE POLICY "art_request_formats_select" ON art_request_formats FOR SELECT
  USING (request_id IN (SELECT id FROM art_requests));

CREATE POLICY "art_request_formats_insert" ON art_request_formats FOR INSERT
  WITH CHECK (request_id IN (SELECT id FROM art_requests));

CREATE POLICY "art_request_formats_update" ON art_request_formats FOR UPDATE
  USING (request_id IN (SELECT id FROM art_requests));

-- art_comments: inherit from art_requests
CREATE POLICY "art_comments_select" ON art_comments FOR SELECT
  USING (request_id IN (SELECT id FROM art_requests));

CREATE POLICY "art_comments_insert" ON art_comments FOR INSERT
  WITH CHECK (request_id IN (SELECT id FROM art_requests) AND user_id = auth.uid());

-- art_files: inherit from art_requests
CREATE POLICY "art_files_select" ON art_files FOR SELECT
  USING (request_id IN (SELECT id FROM art_requests));

CREATE POLICY "art_files_insert" ON art_files FOR INSERT
  WITH CHECK (request_id IN (SELECT id FROM art_requests) AND uploaded_by = auth.uid());

-- art_history: inherit from art_requests
CREATE POLICY "art_history_select" ON art_history FOR SELECT
  USING (request_id IN (SELECT id FROM art_requests));

-- site_brands: anyone authenticated can read, edge function handles writes
CREATE POLICY "site_brands_select" ON site_brands FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- ─── Permissões RBAC ─────────────────────────────────────

INSERT INTO permissions (slug, description, category) VALUES
  ('art.view', 'Ver kanban e solicitações de artes', 'artes'),
  ('art.create', 'Criar novas solicitações de arte', 'artes'),
  ('art.manage', 'Gerenciar artes, formatos e métricas', 'artes'),
  ('art.upload', 'Upload de arquivos em solicitações', 'artes'),
  ('art.approve', 'Aprovar ou solicitar ajuste em artes', 'artes')
ON CONFLICT (slug) DO NOTHING;

-- ─── Storage Bucket ──────────────────────────────────────

INSERT INTO storage.buckets (id, name, public) VALUES ('art-files', 'art-files', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "art_files_upload" ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'art-files' AND auth.uid() IS NOT NULL);

CREATE POLICY "art_files_read" ON storage.objects FOR SELECT
  USING (bucket_id = 'art-files');

-- ─── Realtime ────────────────────────────────────────────

ALTER PUBLICATION supabase_realtime ADD TABLE art_comments;
ALTER PUBLICATION supabase_realtime ADD TABLE art_requests;
