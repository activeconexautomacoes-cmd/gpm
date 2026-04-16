-- ============================================
-- Checklist Templates for CRM Pipeline
-- ============================================

-- 1. Create checklist_templates table
CREATE TABLE IF NOT EXISTS checklist_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  stage_id UUID NOT NULL REFERENCES opportunity_stages(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Create checklist_template_items table
CREATE TABLE IF NOT EXISTS checklist_template_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID NOT NULL REFERENCES checklist_templates(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  order_position INTEGER NOT NULL DEFAULT 0,
  default_assignee_role TEXT NOT NULL DEFAULT 'closer' CHECK (default_assignee_role IN ('sdr', 'closer', 'custom')),
  default_assignee_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  deadline_hours INTEGER NOT NULL DEFAULT 24,
  sla_hours INTEGER NOT NULL DEFAULT 48,
  is_required BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Add new columns to tasks table
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS opportunity_id UUID REFERENCES opportunities(id) ON DELETE SET NULL;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS template_item_id UUID REFERENCES checklist_template_items(id) ON DELETE SET NULL;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS deadline_at TIMESTAMPTZ;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS sla_deadline_at TIMESTAMPTZ;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS sla_status TEXT DEFAULT 'on_time' CHECK (sla_status IN ('on_time', 'warning', 'overdue'));
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;

-- 4. Add checklist cache columns to opportunities
ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS checklist_total INTEGER DEFAULT 0;
ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS checklist_done INTEGER DEFAULT 0;
ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS checklist_sla_status TEXT DEFAULT 'on_time' CHECK (checklist_sla_status IN ('on_time', 'warning', 'overdue'));

-- 5. Indexes
CREATE INDEX IF NOT EXISTS idx_tasks_opportunity_id ON tasks(opportunity_id) WHERE opportunity_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_checklist_templates_stage ON checklist_templates(stage_id, workspace_id) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_checklist_template_items_template ON checklist_template_items(template_id);

-- 6. RLS Policies for checklist_templates
ALTER TABLE checklist_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "checklist_templates_select" ON checklist_templates
  FOR SELECT USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "checklist_templates_insert" ON checklist_templates
  FOR INSERT WITH CHECK (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "checklist_templates_update" ON checklist_templates
  FOR UPDATE USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "checklist_templates_delete" ON checklist_templates
  FOR DELETE USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
    )
  );

-- 7. RLS Policies for checklist_template_items
ALTER TABLE checklist_template_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "checklist_template_items_select" ON checklist_template_items
  FOR SELECT USING (
    template_id IN (
      SELECT id FROM checklist_templates WHERE workspace_id IN (
        SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
      )
    )
  );

CREATE POLICY "checklist_template_items_insert" ON checklist_template_items
  FOR INSERT WITH CHECK (
    template_id IN (
      SELECT id FROM checklist_templates WHERE workspace_id IN (
        SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
      )
    )
  );

CREATE POLICY "checklist_template_items_update" ON checklist_template_items
  FOR UPDATE USING (
    template_id IN (
      SELECT id FROM checklist_templates WHERE workspace_id IN (
        SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
      )
    )
  );

CREATE POLICY "checklist_template_items_delete" ON checklist_template_items
  FOR DELETE USING (
    template_id IN (
      SELECT id FROM checklist_templates WHERE workspace_id IN (
        SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
      )
    )
  );

-- 8. Function to create checklist tasks from template
CREATE OR REPLACE FUNCTION rpc_create_checklist_tasks(
  p_opportunity_id UUID,
  p_stage_id UUID
) RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_template RECORD;
  v_item RECORD;
  v_opportunity RECORD;
  v_assignee_id UUID;
  v_count INTEGER := 0;
BEGIN
  -- Get opportunity data
  SELECT * INTO v_opportunity FROM opportunities WHERE id = p_opportunity_id;
  IF NOT FOUND THEN RETURN 0; END IF;

  -- Find active template for this stage
  SELECT * INTO v_template FROM checklist_templates
    WHERE stage_id = p_stage_id
    AND workspace_id = v_opportunity.workspace_id
    AND is_active = true
    LIMIT 1;
  IF NOT FOUND THEN RETURN 0; END IF;

  -- Create tasks from template items
  FOR v_item IN
    SELECT * FROM checklist_template_items
    WHERE template_id = v_template.id
    ORDER BY order_position
  LOOP
    -- Resolve assignee
    CASE v_item.default_assignee_role
      WHEN 'sdr' THEN v_assignee_id := v_opportunity.assigned_sdr;
      WHEN 'closer' THEN v_assignee_id := v_opportunity.assigned_closer;
      WHEN 'custom' THEN v_assignee_id := v_item.default_assignee_id;
      ELSE v_assignee_id := NULL;
    END CASE;

    INSERT INTO tasks (
      workspace_id, opportunity_id, template_item_id,
      title, description, status, priority, type,
      assignee_id, deadline_at, sla_deadline_at, sla_status
    ) VALUES (
      v_opportunity.workspace_id, p_opportunity_id, v_item.id,
      v_item.title, v_item.description, 'todo', 'medium', 'checklist',
      v_assignee_id,
      now() + (v_item.deadline_hours || ' hours')::interval,
      now() + (v_item.sla_hours || ' hours')::interval,
      'on_time'
    );

    v_count := v_count + 1;
  END LOOP;

  -- Update opportunity cache
  UPDATE opportunities SET
    checklist_total = v_count,
    checklist_done = 0,
    checklist_sla_status = 'on_time'
  WHERE id = p_opportunity_id;

  RETURN v_count;
END;
$$;

-- 9. Function to check pending checklist tasks
CREATE OR REPLACE FUNCTION rpc_check_pending_checklist_tasks(
  p_opportunity_id UUID
) RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_pending_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_pending_count
  FROM tasks
  WHERE opportunity_id = p_opportunity_id
    AND status NOT IN ('done')
    AND template_item_id IS NOT NULL;

  RETURN json_build_object(
    'has_pending', v_pending_count > 0,
    'pending_count', v_pending_count
  );
END;
$$;

-- 10. Function to handle stage change with checklist
CREATE OR REPLACE FUNCTION rpc_handle_stage_change_checklist(
  p_opportunity_id UUID,
  p_new_stage_id UUID,
  p_action TEXT DEFAULT 'keep_all'
) RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_count INTEGER;
BEGIN
  -- Cancel pending tasks if requested
  IF p_action = 'cancel_pending' THEN
    UPDATE tasks
    SET status = 'done', completed_at = now(), description = COALESCE(description, '') || ' [Cancelado - mudança de estágio]'
    WHERE opportunity_id = p_opportunity_id
      AND status NOT IN ('done')
      AND template_item_id IS NOT NULL;
  END IF;

  -- Update opportunity stage
  UPDATE opportunities SET
    current_stage_id = p_new_stage_id,
    stage_changed_at = now()
  WHERE id = p_opportunity_id;

  -- Create new checklist tasks
  SELECT rpc_create_checklist_tasks(p_opportunity_id, p_new_stage_id) INTO v_count;

  RETURN v_count;
END;
$$;

-- 11. Trigger function to update checklist progress when task status changes
CREATE OR REPLACE FUNCTION fn_update_checklist_progress()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_opp_id UUID;
  v_total INTEGER;
  v_done INTEGER;
  v_worst_sla TEXT;
BEGIN
  v_opp_id := COALESCE(NEW.opportunity_id, OLD.opportunity_id);
  IF v_opp_id IS NULL THEN RETURN NEW; END IF;

  -- Set completed_at when task is done
  IF NEW.status = 'done' AND (OLD.status IS NULL OR OLD.status != 'done') THEN
    NEW.completed_at := now();
  END IF;

  -- Count totals
  SELECT COUNT(*), COUNT(*) FILTER (WHERE status = 'done')
  INTO v_total, v_done
  FROM tasks
  WHERE opportunity_id = v_opp_id AND template_item_id IS NOT NULL;

  -- Get worst SLA status among pending tasks
  SELECT COALESCE(
    MAX(CASE
      WHEN sla_status = 'overdue' THEN 'overdue'
      WHEN sla_status = 'warning' THEN 'warning'
      ELSE 'on_time'
    END),
    'on_time'
  ) INTO v_worst_sla
  FROM tasks
  WHERE opportunity_id = v_opp_id
    AND template_item_id IS NOT NULL
    AND status != 'done';

  -- Update opportunity cache
  UPDATE opportunities SET
    checklist_total = v_total,
    checklist_done = v_done,
    checklist_sla_status = COALESCE(v_worst_sla, 'on_time')
  WHERE id = v_opp_id;

  RETURN NEW;
END;
$$;

-- Create trigger
DROP TRIGGER IF EXISTS trg_update_checklist_progress ON tasks;
CREATE TRIGGER trg_update_checklist_progress
  BEFORE UPDATE OF status ON tasks
  FOR EACH ROW
  WHEN (NEW.opportunity_id IS NOT NULL)
  EXECUTE FUNCTION fn_update_checklist_progress();

-- 12. Function to update SLA statuses (called by cron)
CREATE OR REPLACE FUNCTION fn_update_sla_statuses()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Update individual task SLA statuses
  UPDATE tasks SET
    sla_status = CASE
      WHEN now() >= sla_deadline_at THEN 'overdue'
      WHEN now() >= sla_deadline_at - (sla_deadline_at - created_at) * 0.25 THEN 'warning'
      ELSE 'on_time'
    END
  WHERE opportunity_id IS NOT NULL
    AND template_item_id IS NOT NULL
    AND status != 'done'
    AND sla_deadline_at IS NOT NULL;

  -- Update opportunity cache with worst SLA
  UPDATE opportunities o SET
    checklist_sla_status = COALESCE(
      (SELECT MAX(CASE
        WHEN t.sla_status = 'overdue' THEN 'overdue'
        WHEN t.sla_status = 'warning' THEN 'warning'
        ELSE 'on_time'
      END)
      FROM tasks t
      WHERE t.opportunity_id = o.id
        AND t.template_item_id IS NOT NULL
        AND t.status != 'done'),
      'on_time'
    )
  WHERE o.checklist_total > 0;
END;
$$;
