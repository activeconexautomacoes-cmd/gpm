-- ============================================================
-- RLS para workspace_integrations
-- Garante que cada workspace só acessa suas próprias integrações
-- ============================================================

-- 1. Tornar workspace_id NOT NULL (toda integração deve pertencer a um workspace)
ALTER TABLE public.workspace_integrations
    ALTER COLUMN workspace_id SET NOT NULL;

-- 2. Habilitar RLS
ALTER TABLE public.workspace_integrations ENABLE ROW LEVEL SECURITY;

-- 3. SELECT — membros do workspace podem visualizar
CREATE POLICY "workspace_members_can_view_integrations"
ON public.workspace_integrations
FOR SELECT
USING (
    workspace_id IN (
        SELECT wm.workspace_id FROM public.workspace_members wm
        WHERE wm.user_id = auth.uid()
    )
);

-- 4. INSERT — membros do workspace podem criar
CREATE POLICY "workspace_members_can_insert_integrations"
ON public.workspace_integrations
FOR INSERT
WITH CHECK (
    workspace_id IN (
        SELECT wm.workspace_id FROM public.workspace_members wm
        WHERE wm.user_id = auth.uid()
    )
);

-- 5. UPDATE — membros do workspace podem atualizar
CREATE POLICY "workspace_members_can_update_integrations"
ON public.workspace_integrations
FOR UPDATE
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

-- 6. DELETE — membros do workspace podem remover
CREATE POLICY "workspace_members_can_delete_integrations"
ON public.workspace_integrations
FOR DELETE
USING (
    workspace_id IN (
        SELECT wm.workspace_id FROM public.workspace_members wm
        WHERE wm.user_id = auth.uid()
    )
);
