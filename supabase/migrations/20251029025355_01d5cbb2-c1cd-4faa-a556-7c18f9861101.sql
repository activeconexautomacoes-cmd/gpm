-- ============================================
-- CRM KANBAN - PARTE 3: INSERIR ETAPAS PADRÃO
-- ============================================

-- Function para inserir etapas padrão ao criar workspace
CREATE OR REPLACE FUNCTION insert_default_opportunity_stages()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Inserir etapas padrão para o novo workspace
  INSERT INTO opportunity_stages (workspace_id, name, order_position, color, is_final) VALUES
    (NEW.id, 'Novo Lead', 1, '#6366f1', false),
    (NEW.id, 'Qualificação', 2, '#8b5cf6', false),
    (NEW.id, 'Sessão Agendada', 3, '#ec4899', false),
    (NEW.id, 'Em Negociação', 4, '#f59e0b', false),
    (NEW.id, 'Proposta Enviada', 5, '#10b981', false),
    (NEW.id, 'Fechamento', 6, '#3b82f6', false),
    (NEW.id, 'Ganho', 7, '#22c55e', true),
    (NEW.id, 'Perdido', 8, '#ef4444', true);
  
  RETURN NEW;
END;
$$;

-- Trigger para inserir etapas ao criar workspace
CREATE TRIGGER trigger_insert_default_stages
  AFTER INSERT ON workspaces
  FOR EACH ROW
  EXECUTE FUNCTION insert_default_opportunity_stages();

-- Inserir etapas padrão para workspaces existentes (se houver)
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