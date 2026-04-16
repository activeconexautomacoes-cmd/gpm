-- ============================================================
-- SDR AI Module — Tabelas para SDR automatizada com IA
-- Conversas, Leads, Follow-ups, Reuniões, Feedbacks
-- ============================================================

-- ── 1. sdr_conversations — Histórico de mensagens ───────────
CREATE TABLE IF NOT EXISTS public.sdr_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  phone text NOT NULL,
  role text NOT NULL CHECK (role IN ('user', 'assistant')),
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sdr_conversations_phone ON public.sdr_conversations(phone, created_at ASC);
CREATE INDEX IF NOT EXISTS idx_sdr_conversations_workspace ON public.sdr_conversations(workspace_id);

-- ── 2. sdr_leads — Leads capturados pela SDR ────────────────
CREATE TABLE IF NOT EXISTS public.sdr_leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  phone text NOT NULL,
  name text,
  instagram text,
  site text,
  email text,
  faturamento text,
  status text NOT NULL DEFAULT 'em_conversa'
    CHECK (status IN ('em_conversa', 'qualificado', 'agendado', 'downsell', 'encerrado')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(workspace_id, phone)
);

CREATE INDEX IF NOT EXISTS idx_sdr_leads_workspace ON public.sdr_leads(workspace_id);
CREATE INDEX IF NOT EXISTS idx_sdr_leads_phone ON public.sdr_leads(phone);
CREATE INDEX IF NOT EXISTS idx_sdr_leads_status ON public.sdr_leads(status);

-- ── 3. sdr_follow_ups — Follow-ups automáticos ──────────────
CREATE TABLE IF NOT EXISTS public.sdr_follow_ups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  phone text NOT NULL,
  step integer NOT NULL DEFAULT 1,
  scheduled_at timestamptz NOT NULL,
  sent_at timestamptz,
  cancelled boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sdr_follow_ups_pending ON public.sdr_follow_ups(scheduled_at)
  WHERE sent_at IS NULL AND cancelled = false;
CREATE INDEX IF NOT EXISTS idx_sdr_follow_ups_phone ON public.sdr_follow_ups(phone);

-- ── 4. sdr_meetings — Reuniões agendadas ────────────────────
CREATE TABLE IF NOT EXISTS public.sdr_meetings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  phone text NOT NULL,
  lead_name text,
  group_jid text,
  meet_link text,
  calendar_event_id text,
  scheduled_at timestamptz NOT NULL,
  reminder_morning_sent boolean NOT NULL DEFAULT false,
  reminder_30min_sent boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'scheduled'
    CHECK (status IN ('scheduled', 'confirmed', 'cancelled', 'completed')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sdr_meetings_workspace ON public.sdr_meetings(workspace_id);
CREATE INDEX IF NOT EXISTS idx_sdr_meetings_phone ON public.sdr_meetings(phone);
CREATE INDEX IF NOT EXISTS idx_sdr_meetings_scheduled ON public.sdr_meetings(scheduled_at)
  WHERE status = 'scheduled';

-- ── 5. sdr_feedbacks — Feedbacks dos closers ────────────────
CREATE TABLE IF NOT EXISTS public.sdr_feedbacks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id),
  category text NOT NULL CHECK (category IN ('erro', 'melhoria', 'tom', 'fluxo', 'outro')),
  description text NOT NULL,
  priority text NOT NULL DEFAULT 'media' CHECK (priority IN ('baixa', 'media', 'alta')),
  status text NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'aplicado', 'descartado')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sdr_feedbacks_workspace ON public.sdr_feedbacks(workspace_id);
CREATE INDEX IF NOT EXISTS idx_sdr_feedbacks_status ON public.sdr_feedbacks(status);

-- ── 6. RLS Policies ─────────────────────────────────────────

ALTER TABLE public.sdr_conversations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members can view sdr_conversations" ON public.sdr_conversations
  FOR SELECT USING (workspace_id IN (SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid()));
CREATE POLICY "Service role full access sdr_conversations" ON public.sdr_conversations
  FOR ALL USING (auth.role() = 'service_role');

ALTER TABLE public.sdr_leads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members can view sdr_leads" ON public.sdr_leads
  FOR SELECT USING (workspace_id IN (SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid()));
CREATE POLICY "Service role full access sdr_leads" ON public.sdr_leads
  FOR ALL USING (auth.role() = 'service_role');

ALTER TABLE public.sdr_follow_ups ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role full access sdr_follow_ups" ON public.sdr_follow_ups
  FOR ALL USING (auth.role() = 'service_role');

ALTER TABLE public.sdr_meetings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members can view sdr_meetings" ON public.sdr_meetings
  FOR SELECT USING (workspace_id IN (SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid()));
CREATE POLICY "Service role full access sdr_meetings" ON public.sdr_meetings
  FOR ALL USING (auth.role() = 'service_role');

ALTER TABLE public.sdr_feedbacks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members can view sdr_feedbacks" ON public.sdr_feedbacks
  FOR SELECT USING (workspace_id IN (SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid()));
CREATE POLICY "Members can insert sdr_feedbacks" ON public.sdr_feedbacks
  FOR INSERT WITH CHECK (workspace_id IN (SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid()));
CREATE POLICY "Service role full access sdr_feedbacks" ON public.sdr_feedbacks
  FOR ALL USING (auth.role() = 'service_role');

-- ── 7. updated_at trigger ───────────────────────────────────
CREATE TRIGGER sdr_leads_set_updated_at
  BEFORE UPDATE ON public.sdr_leads
  FOR EACH ROW EXECUTE FUNCTION public.kb_set_updated_at();

-- ── 8. Permissões RBAC ──────────────────────────────────────
INSERT INTO permissions (slug, description, category) VALUES
    ('sdr.view', 'Visualizar módulo SDR AI', 'sdr'),
    ('sdr.manage', 'Gerenciar SDR AI (configurar, feedbacks)', 'sdr')
ON CONFLICT (slug) DO UPDATE
SET description = EXCLUDED.description,
    category = EXCLUDED.category;

-- Dar permissão a todos os perfis existentes
DO $$
DECLARE
    r RECORD;
    perm RECORD;
BEGIN
    FOR r IN SELECT id FROM roles LOOP
        FOR perm IN SELECT id FROM permissions WHERE category = 'sdr' LOOP
            INSERT INTO role_permissions (role_id, permission_id)
            VALUES (r.id, perm.id)
            ON CONFLICT DO NOTHING;
        END LOOP;
    END LOOP;
END $$;
