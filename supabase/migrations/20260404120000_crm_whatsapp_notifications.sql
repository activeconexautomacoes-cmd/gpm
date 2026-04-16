-- ============================================================
-- CRM WhatsApp Notifications
-- Tabela de subscribers + triggers para eventos do CRM
-- ============================================================

-- 1. Tabela de subscribers (preparada para múltiplos destinatários)
CREATE TABLE IF NOT EXISTS public.crm_notification_subscribers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  phone TEXT NOT NULL,
  name TEXT,
  notify_new_lead BOOLEAN DEFAULT true,
  notify_stage_change BOOLEAN DEFAULT true,
  notify_session_scheduled BOOLEAN DEFAULT true,
  notify_won BOOLEAN DEFAULT true,
  notify_lost BOOLEAN DEFAULT true,
  notify_hot_lead BOOLEAN DEFAULT true,
  notify_daily_report BOOLEAN DEFAULT true,
  notify_weekly_report BOOLEAN DEFAULT true,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.crm_notification_subscribers ENABLE ROW LEVEL SECURITY;

-- RLS: apenas membros do workspace podem ver
CREATE POLICY "crm_notif_subs_select" ON public.crm_notification_subscribers
  FOR SELECT USING (
    workspace_id IN (
      SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "crm_notif_subs_manage" ON public.crm_notification_subscribers
  FOR ALL USING (
    workspace_id IN (
      SELECT wm.workspace_id FROM public.workspace_members wm
      JOIN public.roles r ON r.id = wm.role_id
      WHERE wm.user_id = auth.uid() AND r.name IN ('Dono', 'Admin', 'Gerente de Vendas')
    )
  );

-- Seed: 2 números iniciais
INSERT INTO public.crm_notification_subscribers (workspace_id, phone, name)
VALUES
  ('8eaae987-1b56-43de-978c-c135beb30c7e', '556296449901', 'Yago'),
  ('8eaae987-1b56-43de-978c-c135beb30c7e', '554792817316', 'Gestor 2');

-- 2. Habilitar pg_net (se ainda não estiver)
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- 3. Função genérica para disparar notificação via edge function
CREATE OR REPLACE FUNCTION public.fn_crm_notify()
RETURNS TRIGGER AS $$
DECLARE
  _event_type TEXT;
  _payload JSONB;
  _old_stage_name TEXT;
  _new_stage_name TEXT;
  _supabase_url TEXT;
  _service_key TEXT;
BEGIN
  -- Pegar configs
  _supabase_url := current_setting('app.settings.supabase_url', true);
  _service_key := current_setting('app.settings.service_role_key', true);

  -- Se não tiver as configs, tentar via vault ou fallback
  IF _supabase_url IS NULL OR _supabase_url = '' THEN
    _supabase_url := 'https://rkngilknpcibcwalropj.supabase.co';
  END IF;

  -- Determinar tipo de evento
  IF TG_OP = 'INSERT' THEN
    _event_type := 'new_lead';
    _payload := jsonb_build_object(
      'event', 'new_lead',
      'opportunity_id', NEW.id,
      'workspace_id', NEW.workspace_id,
      'lead_name', NEW.lead_name,
      'lead_phone', NEW.lead_phone,
      'lead_email', NEW.lead_email,
      'source', NEW.source,
      'estimated_value', NEW.estimated_value,
      'lead_score', NEW.lead_score,
      'custom_fields', NEW.custom_fields,
      'created_at', NEW.created_at
    );

  ELSIF TG_OP = 'UPDATE' THEN

    -- Stage changed
    IF OLD.current_stage_id IS DISTINCT FROM NEW.current_stage_id THEN
      SELECT name INTO _old_stage_name FROM public.opportunity_stages WHERE id = OLD.current_stage_id;
      SELECT name INTO _new_stage_name FROM public.opportunity_stages WHERE id = NEW.current_stage_id;

      _event_type := 'stage_change';
      _payload := jsonb_build_object(
        'event', 'stage_change',
        'opportunity_id', NEW.id,
        'workspace_id', NEW.workspace_id,
        'lead_name', NEW.lead_name,
        'old_stage', _old_stage_name,
        'new_stage', _new_stage_name,
        'lead_score', NEW.lead_score
      );
    END IF;

    -- Session scheduled
    IF OLD.session_scheduled_at IS DISTINCT FROM NEW.session_scheduled_at AND NEW.session_scheduled_at IS NOT NULL THEN
      _event_type := 'session_scheduled';
      _payload := jsonb_build_object(
        'event', 'session_scheduled',
        'opportunity_id', NEW.id,
        'workspace_id', NEW.workspace_id,
        'lead_name', NEW.lead_name,
        'session_date', NEW.session_scheduled_at,
        'meeting_link', NEW.session_meeting_link,
        'assigned_closer', NEW.assigned_closer
      );
    END IF;

    -- Won
    IF OLD.won_at IS NULL AND NEW.won_at IS NOT NULL THEN
      _event_type := 'won';
      _payload := jsonb_build_object(
        'event', 'won',
        'opportunity_id', NEW.id,
        'workspace_id', NEW.workspace_id,
        'lead_name', NEW.lead_name,
        'negotiated_value', NEW.negotiated_value,
        'estimated_value', NEW.estimated_value
      );
    END IF;

    -- Lost
    IF OLD.lost_at IS NULL AND NEW.lost_at IS NOT NULL THEN
      _event_type := 'lost';
      _payload := jsonb_build_object(
        'event', 'lost',
        'opportunity_id', NEW.id,
        'workspace_id', NEW.workspace_id,
        'lead_name', NEW.lead_name,
        'loss_reason', NEW.loss_reason,
        'loss_notes', NEW.loss_notes
      );
    END IF;

    -- Lead score changed to hot
    IF (OLD.lead_score IS DISTINCT FROM NEW.lead_score) AND NEW.lead_score = 'quente' THEN
      _event_type := 'hot_lead';
      _payload := jsonb_build_object(
        'event', 'hot_lead',
        'opportunity_id', NEW.id,
        'workspace_id', NEW.workspace_id,
        'lead_name', NEW.lead_name,
        'lead_phone', NEW.lead_phone,
        'estimated_value', NEW.estimated_value,
        'lead_score', 'quente'
      );
    END IF;

  END IF;

  -- Disparar se tiver evento
  IF _event_type IS NOT NULL AND _payload IS NOT NULL THEN
    PERFORM extensions.http_post(
      url := 'https://rkngilknpcibcwalropj.supabase.co/functions/v1/crm-notify',
      body := _payload::text,
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || _service_key
      )::jsonb
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Triggers
CREATE TRIGGER trg_crm_notify_new_lead
  AFTER INSERT ON public.opportunities
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_crm_notify();

CREATE TRIGGER trg_crm_notify_update
  AFTER UPDATE ON public.opportunities
  FOR EACH ROW
  WHEN (
    OLD.current_stage_id IS DISTINCT FROM NEW.current_stage_id
    OR (OLD.session_scheduled_at IS DISTINCT FROM NEW.session_scheduled_at AND NEW.session_scheduled_at IS NOT NULL)
    OR (OLD.won_at IS NULL AND NEW.won_at IS NOT NULL)
    OR (OLD.lost_at IS NULL AND NEW.lost_at IS NOT NULL)
    OR (OLD.lead_score IS DISTINCT FROM NEW.lead_score AND NEW.lead_score = 'quente')
  )
  EXECUTE FUNCTION public.fn_crm_notify();

-- 5. pg_cron: relatório diário às 7h (horário de Brasília = 10h UTC)
SELECT cron.schedule(
  'crm-daily-report',
  '0 10 * * *',
  $$SELECT extensions.http_post(
    url := 'https://rkngilknpcibcwalropj.supabase.co/functions/v1/crm-daily-report',
    body := '{"type":"daily"}',
    headers := '{"Content-Type":"application/json"}'::jsonb
  )$$
);

-- 6. pg_cron: relatório semanal toda sexta às 7h BRT (10h UTC)
SELECT cron.schedule(
  'crm-weekly-report',
  '0 10 * * 5',
  $$SELECT extensions.http_post(
    url := 'https://rkngilknpcibcwalropj.supabase.co/functions/v1/crm-weekly-report',
    body := '{"type":"weekly"}',
    headers := '{"Content-Type":"application/json"}'::jsonb
  )$$
);
