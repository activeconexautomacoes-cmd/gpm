-- ============================================================
-- CAPI Stage Rules: Eventos personalizados da Meta CAPI
-- disparados automaticamente por mudanças de etapa no CRM
-- ============================================================

-- 1. Tabela de regras: mapeia etapa do CRM → evento CAPI
CREATE TABLE IF NOT EXISTS public.capi_stage_rules (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    stage_id UUID NOT NULL REFERENCES public.opportunity_stages(id) ON DELETE CASCADE,
    event_name TEXT NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(workspace_id, stage_id)
);

-- 2. RLS
ALTER TABLE public.capi_stage_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "workspace_members_can_view_capi_rules"
ON public.capi_stage_rules
FOR SELECT
USING (
    workspace_id IN (
        SELECT workspace_id FROM public.workspace_members
        WHERE user_id = auth.uid()
    )
);

CREATE POLICY "workspace_members_can_manage_capi_rules"
ON public.capi_stage_rules
FOR ALL
USING (
    workspace_id IN (
        SELECT wm.workspace_id FROM public.workspace_members wm
        WHERE wm.user_id = auth.uid()
    )
)
WITH CHECK (
    workspace_id IN (
        SELECT wm.workspace_id FROM public.workspace_members wm
        WHERE wm.user_id = auth.uid()
    )
);

-- 3. Updated_at trigger
CREATE TRIGGER update_capi_stage_rules_updated_at
    BEFORE UPDATE ON public.capi_stage_rules
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- 4. Enable pg_net para chamadas HTTP a partir de triggers
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- 5. Trigger function: dispara edge function via pg_net quando etapa muda
CREATE OR REPLACE FUNCTION public.dispatch_capi_stage_event()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_rule RECORD;
    v_service_key TEXT;
    v_stage_id UUID;
BEGIN
    -- Determinar o stage_id relevante
    IF TG_OP = 'INSERT' THEN
        v_stage_id := NEW.current_stage_id;
    ELSIF TG_OP = 'UPDATE' THEN
        -- Só dispara se current_stage_id realmente mudou
        IF OLD.current_stage_id IS NOT DISTINCT FROM NEW.current_stage_id THEN
            RETURN NEW;
        END IF;
        v_stage_id := NEW.current_stage_id;
    ELSE
        RETURN NEW;
    END IF;

    -- Se não tem stage_id, nada a fazer
    IF v_stage_id IS NULL THEN
        RETURN NEW;
    END IF;

    -- Verifica se existe regra ativa para esta etapa + workspace
    SELECT event_name INTO v_rule
    FROM public.capi_stage_rules
    WHERE stage_id = v_stage_id
      AND workspace_id = NEW.workspace_id
      AND is_active = true;

    IF NOT FOUND THEN
        RETURN NEW;
    END IF;

    -- Buscar service_role_key do Supabase Vault
    SELECT decrypted_secret INTO v_service_key
    FROM vault.decrypted_secrets
    WHERE name = 'service_role_key'
    LIMIT 1;

    -- Se não tiver service key no vault, não pode chamar a edge function
    IF v_service_key IS NULL OR v_service_key = '' THEN
        RAISE WARNING 'dispatch_capi_stage_event: service_role_key not found in vault.secrets';
        RETURN NEW;
    END IF;

    -- Chamar edge function via pg_net (assíncrono, não bloqueia)
    PERFORM net.http_post(
        url := 'https://rkngilknpcibcwalropj.supabase.co/functions/v1/capi-stage-event',
        headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'Authorization', 'Bearer ' || v_service_key
        ),
        body := jsonb_build_object(
            'opportunity_id', NEW.id,
            'workspace_id', NEW.workspace_id,
            'new_stage_id', v_stage_id,
            'event_name', v_rule.event_name
        )
    );

    RETURN NEW;
END;
$$;

-- 6. Trigger AFTER UPDATE — dispara quando etapa muda
CREATE TRIGGER trigger_capi_stage_on_update
    AFTER UPDATE ON public.opportunities
    FOR EACH ROW
    WHEN (OLD.current_stage_id IS DISTINCT FROM NEW.current_stage_id)
    EXECUTE FUNCTION public.dispatch_capi_stage_event();

-- 7. Trigger AFTER INSERT — dispara quando oportunidade é criada (lead novo)
CREATE TRIGGER trigger_capi_stage_on_insert
    AFTER INSERT ON public.opportunities
    FOR EACH ROW
    EXECUTE FUNCTION public.dispatch_capi_stage_event();
