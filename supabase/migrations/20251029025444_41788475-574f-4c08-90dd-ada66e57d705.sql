-- ============================================
-- CRM KANBAN - INSERIR ETAPAS PARA WORKSPACES EXISTENTES
-- ============================================

-- Inserir etapas padrão apenas para workspaces que ainda não têm
DO $$
DECLARE
  workspace_record RECORD;
BEGIN
  FOR workspace_record IN 
    SELECT id FROM workspaces 
    WHERE NOT EXISTS (
      SELECT 1 FROM opportunity_stages 
      WHERE workspace_id = workspaces.id
    )
  LOOP
    INSERT INTO opportunity_stages (workspace_id, name, order_position, color, is_final) VALUES
      (workspace_record.id, 'Novo Lead', 1, '#6366f1', false),
      (workspace_record.id, 'Qualificação', 2, '#8b5cf6', false),
      (workspace_record.id, 'Sessão Agendada', 3, '#ec4899', false),
      (workspace_record.id, 'Em Negociação', 4, '#f59e0b', false),
      (workspace_record.id, 'Proposta Enviada', 5, '#10b981', false),
      (workspace_record.id, 'Fechamento', 6, '#3b82f6', false),
      (workspace_record.id, 'Ganho', 7, '#22c55e', true),
      (workspace_record.id, 'Perdido', 8, '#ef4444', true);
  END LOOP;
END $$;