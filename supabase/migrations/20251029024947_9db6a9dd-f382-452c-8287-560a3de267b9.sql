-- ============================================
-- CRM KANBAN - PARTE 2: TABELAS, FUNÇÕES E POLICIES
-- ============================================

-- 1. CRIAR TABELAS
-- ============================================

-- Tabela de Produtos
CREATE TABLE products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  type product_type NOT NULL DEFAULT 'recurring',
  
  base_price NUMERIC(10, 2),
  default_period TEXT,
  default_implementation_fee NUMERIC(10, 2) DEFAULT 0,
  default_cancellation_penalty NUMERIC(10, 2) DEFAULT 0,
  
  default_assigned_closer UUID,
  
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_products_workspace ON products(workspace_id);
CREATE INDEX idx_products_type ON products(type);

-- Tabela de Etapas Customizáveis
CREATE TABLE opportunity_stages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  order_position INTEGER NOT NULL,
  color TEXT DEFAULT '#6366f1',
  is_final BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_opportunity_stages_workspace ON opportunity_stages(workspace_id);

-- Tabela de Oportunidades
CREATE TABLE opportunities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  
  lead_name TEXT NOT NULL,
  lead_phone TEXT NOT NULL,
  lead_email TEXT,
  lead_company TEXT,
  lead_position TEXT,
  lead_document TEXT,
  
  company_size TEXT,
  company_segment TEXT,
  company_revenue NUMERIC(12, 2),
  
  source lead_source DEFAULT 'website',
  qualified_product UUID REFERENCES products(id),
  
  created_by UUID,
  assigned_sdr UUID,
  assigned_closer UUID,
  
  current_stage_id UUID REFERENCES opportunity_stages(id),
  stage_changed_at TIMESTAMPTZ DEFAULT NOW(),
  
  session_scheduled_at TIMESTAMPTZ,
  session_meeting_link TEXT,
  
  estimated_value NUMERIC(10, 2),
  negotiated_value NUMERIC(10, 2),
  negotiated_implementation_fee NUMERIC(10, 2),
  negotiated_cancellation_penalty NUMERIC(10, 2),
  negotiated_period TEXT,
  negotiated_custom_period_months INTEGER,
  negotiated_discount NUMERIC(10, 2) DEFAULT 0,
  negotiated_billing_day INTEGER,
  negotiated_payment_method TEXT,
  expected_close_date DATE,
  
  proposal_sent_at TIMESTAMPTZ,
  
  won_at TIMESTAMPTZ,
  lost_at TIMESTAMPTZ,
  loss_reason loss_reason,
  loss_notes TEXT,
  follow_up_date DATE,
  
  converted_client_id UUID REFERENCES clients(id),
  converted_contract_id UUID REFERENCES contracts(id),
  converted_sale_id UUID REFERENCES one_time_sales(id),
  
  custom_fields JSONB DEFAULT '{}',
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_opportunities_workspace ON opportunities(workspace_id);
CREATE INDEX idx_opportunities_current_stage ON opportunities(current_stage_id);
CREATE INDEX idx_opportunities_assigned_sdr ON opportunities(assigned_sdr);
CREATE INDEX idx_opportunities_assigned_closer ON opportunities(assigned_closer);
CREATE INDEX idx_opportunities_qualified_product ON opportunities(qualified_product);
CREATE INDEX idx_opportunities_source ON opportunities(source);
CREATE INDEX idx_opportunities_custom_fields ON opportunities USING GIN(custom_fields);

-- Tabela de Produtos da Oportunidade
CREATE TABLE opportunity_products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  opportunity_id UUID NOT NULL REFERENCES opportunities(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id),
  
  negotiated_price NUMERIC(10, 2),
  negotiated_implementation_fee NUMERIC(10, 2),
  negotiated_period TEXT,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_opportunity_products_opportunity ON opportunity_products(opportunity_id);
CREATE INDEX idx_opportunity_products_product ON opportunity_products(product_id);

-- Tabela de Notas/Histórico
CREATE TABLE opportunity_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  opportunity_id UUID NOT NULL REFERENCES opportunities(id) ON DELETE CASCADE,
  created_by UUID NOT NULL,
  
  note_type TEXT DEFAULT 'note',
  content TEXT NOT NULL,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_opportunity_notes_opportunity ON opportunity_notes(opportunity_id);
CREATE INDEX idx_opportunity_notes_created_at ON opportunity_notes(created_at DESC);

-- Tabela de Anexos
CREATE TABLE opportunity_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  opportunity_id UUID NOT NULL REFERENCES opportunities(id) ON DELETE CASCADE,
  uploaded_by UUID NOT NULL,
  
  file_name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_size INTEGER,
  file_type TEXT,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_opportunity_attachments_opportunity ON opportunity_attachments(opportunity_id);

-- 2. ADICIONAR COLUNAS NAS TABELAS EXISTENTES
-- ============================================

ALTER TABLE contracts ADD COLUMN IF NOT EXISTS opportunity_id UUID REFERENCES opportunities(id);
CREATE INDEX IF NOT EXISTS idx_contracts_opportunity ON contracts(opportunity_id);

ALTER TABLE one_time_sales ADD COLUMN IF NOT EXISTS opportunity_id UUID REFERENCES opportunities(id);
CREATE INDEX IF NOT EXISTS idx_one_time_sales_opportunity ON one_time_sales(opportunity_id);

ALTER TABLE clients ADD COLUMN IF NOT EXISTS opportunity_id UUID REFERENCES opportunities(id);
CREATE INDEX IF NOT EXISTS idx_clients_opportunity ON clients(opportunity_id);

-- 3. CRIAR FUNCTIONS
-- ============================================

CREATE OR REPLACE FUNCTION is_sales_role(_user_id UUID, _workspace_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM workspace_members
    WHERE user_id = _user_id
      AND workspace_id = _workspace_id
      AND role IN ('sdr', 'closer', 'sales_manager', 'owner', 'admin')
  );
$$;

CREATE OR REPLACE FUNCTION get_user_role(_user_id UUID, _workspace_id UUID)
RETURNS workspace_role
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role
  FROM workspace_members
  WHERE user_id = _user_id
    AND workspace_id = _workspace_id
  LIMIT 1;
$$;

-- 4. CRIAR TRIGGERS
-- ============================================

CREATE TRIGGER update_products_updated_at
  BEFORE UPDATE ON products
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_opportunities_updated_at
  BEFORE UPDATE ON opportunities
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE OR REPLACE FUNCTION log_stage_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.current_stage_id IS DISTINCT FROM NEW.current_stage_id THEN
    INSERT INTO opportunity_notes (
      opportunity_id,
      created_by,
      note_type,
      content
    ) VALUES (
      NEW.id,
      auth.uid(),
      'stage_change',
      'Etapa alterada'
    );
    
    NEW.stage_changed_at = NOW();
  END IF;
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_log_stage_change
  BEFORE UPDATE ON opportunities
  FOR EACH ROW
  EXECUTE FUNCTION log_stage_change();

CREATE OR REPLACE FUNCTION assign_closer_based_on_product()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _default_closer UUID;
BEGIN
  IF NEW.qualified_product IS NOT NULL AND OLD.qualified_product IS DISTINCT FROM NEW.qualified_product THEN
    SELECT default_assigned_closer INTO _default_closer
    FROM products
    WHERE id = NEW.qualified_product;
    
    IF _default_closer IS NOT NULL THEN
      NEW.assigned_closer = _default_closer;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_assign_closer
  BEFORE UPDATE ON opportunities
  FOR EACH ROW
  EXECUTE FUNCTION assign_closer_based_on_product();

CREATE OR REPLACE FUNCTION notify_closer_assignment()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.assigned_closer IS DISTINCT FROM NEW.assigned_closer AND NEW.assigned_closer IS NOT NULL THEN
    INSERT INTO notifications (
      workspace_id,
      user_id,
      type,
      title,
      message,
      link
    ) VALUES (
      NEW.workspace_id,
      NEW.assigned_closer,
      'opportunity_assigned',
      'Nova Oportunidade Atribuída',
      'Você recebeu a oportunidade: ' || NEW.lead_name,
      '/dashboard/crm?opportunity=' || NEW.id
    );
  END IF;
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_notify_closer_assignment
  AFTER UPDATE ON opportunities
  FOR EACH ROW
  EXECUTE FUNCTION notify_closer_assignment();

-- 5. HABILITAR RLS
-- ============================================

ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE opportunity_stages ENABLE ROW LEVEL SECURITY;
ALTER TABLE opportunities ENABLE ROW LEVEL SECURITY;
ALTER TABLE opportunity_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE opportunity_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE opportunity_attachments ENABLE ROW LEVEL SECURITY;

-- 6. CRIAR POLICIES
-- ============================================

CREATE POLICY "Users can view products in their workspace"
  ON products FOR SELECT
  USING (is_workspace_member(auth.uid(), workspace_id));

CREATE POLICY "Managers can manage products"
  ON products FOR ALL
  USING (
    get_user_role(auth.uid(), workspace_id) IN ('owner', 'admin', 'sales_manager')
  );

CREATE POLICY "Users can view stages"
  ON opportunity_stages FOR SELECT
  USING (is_workspace_member(auth.uid(), workspace_id));

CREATE POLICY "Managers can manage stages"
  ON opportunity_stages FOR ALL
  USING (
    get_user_role(auth.uid(), workspace_id) IN ('owner', 'admin', 'sales_manager')
  );

CREATE POLICY "Sales team can view opportunities"
  ON opportunities FOR SELECT
  USING (is_sales_role(auth.uid(), workspace_id));

CREATE POLICY "Sales can create opportunities"
  ON opportunities FOR INSERT
  WITH CHECK (is_sales_role(auth.uid(), workspace_id));

CREATE POLICY "Assigned or managers can update opportunities"
  ON opportunities FOR UPDATE
  USING (
    get_user_role(auth.uid(), workspace_id) IN ('owner', 'admin', 'sales_manager')
    OR assigned_sdr = auth.uid()
    OR assigned_closer = auth.uid()
  );

CREATE POLICY "Managers can delete opportunities"
  ON opportunities FOR DELETE
  USING (
    get_user_role(auth.uid(), workspace_id) IN ('owner', 'admin', 'sales_manager')
  );

CREATE POLICY "Users can view opportunity products"
  ON opportunity_products FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM opportunities o
      WHERE o.id = opportunity_products.opportunity_id
        AND is_sales_role(auth.uid(), o.workspace_id)
    )
  );

CREATE POLICY "Users can manage opportunity products"
  ON opportunity_products FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM opportunities o
      WHERE o.id = opportunity_products.opportunity_id
        AND (
          get_user_role(auth.uid(), o.workspace_id) IN ('owner', 'admin', 'sales_manager')
          OR o.assigned_sdr = auth.uid()
          OR o.assigned_closer = auth.uid()
        )
    )
  );

CREATE POLICY "Users can view opportunity notes"
  ON opportunity_notes FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM opportunities o
      WHERE o.id = opportunity_notes.opportunity_id
        AND is_sales_role(auth.uid(), o.workspace_id)
    )
  );

CREATE POLICY "Users can create opportunity notes"
  ON opportunity_notes FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM opportunities o
      WHERE o.id = opportunity_notes.opportunity_id
        AND is_sales_role(auth.uid(), o.workspace_id)
    )
  );

CREATE POLICY "Users can view opportunity attachments"
  ON opportunity_attachments FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM opportunities o
      WHERE o.id = opportunity_attachments.opportunity_id
        AND is_sales_role(auth.uid(), o.workspace_id)
    )
  );

CREATE POLICY "Users can manage opportunity attachments"
  ON opportunity_attachments FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM opportunities o
      WHERE o.id = opportunity_attachments.opportunity_id
        AND (
          get_user_role(auth.uid(), o.workspace_id) IN ('owner', 'admin', 'sales_manager')
          OR o.assigned_sdr = auth.uid()
          OR o.assigned_closer = auth.uid()
        )
    )
  );