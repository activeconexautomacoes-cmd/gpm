-- Create clients table
CREATE TABLE public.clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  document TEXT,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Create contracts table
CREATE TABLE public.contracts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE NOT NULL,
  client_id UUID REFERENCES public.clients(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  value DECIMAL(10,2) NOT NULL,
  billing_day INTEGER CHECK (billing_day BETWEEN 1 AND 31),
  start_date DATE NOT NULL,
  end_date DATE,
  contract_period TEXT CHECK (contract_period IN ('monthly', 'quarterly', 'yearly', 'custom')),
  custom_period_months INTEGER,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'cancelled', 'paused')),
  cancellation_date DATE,
  cancellation_reason TEXT,
  cancellation_penalty DECIMAL(10,2),
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Create contract_billings table (Recorrências)
CREATE TABLE public.contract_billings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE NOT NULL,
  contract_id UUID REFERENCES public.contracts(id) ON DELETE CASCADE NOT NULL,
  due_date DATE NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  discount DECIMAL(10,2) DEFAULT 0,
  final_amount DECIMAL(10,2) NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'overdue', 'cancelled')),
  payment_date DATE,
  payment_method TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Create expense_categories table
CREATE TABLE public.expense_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  type TEXT CHECK (type IN ('operational', 'commercial', 'administrative')),
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Create expenses table
CREATE TABLE public.expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE NOT NULL,
  category_id UUID REFERENCES public.expense_categories(id) ON DELETE SET NULL,
  description TEXT NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  expense_date DATE NOT NULL,
  payment_date DATE,
  payment_method TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'paid')),
  is_recurring BOOLEAN DEFAULT false,
  recurrence_pattern TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Create one_time_sales table
CREATE TABLE public.one_time_sales (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE NOT NULL,
  client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
  type TEXT CHECK (type IN ('implementation', 'package', 'penalty', 'other')),
  description TEXT NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  sale_date DATE NOT NULL,
  payment_date DATE,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'paid')),
  payment_method TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Create churns table
CREATE TABLE public.churns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE NOT NULL,
  contract_id UUID REFERENCES public.contracts(id) ON DELETE CASCADE NOT NULL,
  client_id UUID REFERENCES public.clients(id) ON DELETE CASCADE NOT NULL,
  churn_date DATE NOT NULL,
  mrr_lost DECIMAL(10,2) NOT NULL,
  reason_type TEXT CHECK (reason_type IN ('operational', 'commercial')),
  reason_detail TEXT,
  penalty_amount DECIMAL(10,2),
  penalty_paid BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Enable RLS on all tables
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contract_billings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expense_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.one_time_sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.churns ENABLE ROW LEVEL SECURITY;

-- RLS Policies for clients
CREATE POLICY "Users can view clients in their workspace"
ON public.clients FOR SELECT
USING (public.is_workspace_member(auth.uid(), workspace_id));

CREATE POLICY "Users can create clients in their workspace"
ON public.clients FOR INSERT
WITH CHECK (public.is_workspace_member(auth.uid(), workspace_id));

CREATE POLICY "Users can update clients in their workspace"
ON public.clients FOR UPDATE
USING (public.is_workspace_member(auth.uid(), workspace_id));

CREATE POLICY "Users can delete clients in their workspace"
ON public.clients FOR DELETE
USING (public.is_workspace_member(auth.uid(), workspace_id));

-- RLS Policies for contracts
CREATE POLICY "Users can view contracts in their workspace"
ON public.contracts FOR SELECT
USING (public.is_workspace_member(auth.uid(), workspace_id));

CREATE POLICY "Users can create contracts in their workspace"
ON public.contracts FOR INSERT
WITH CHECK (public.is_workspace_member(auth.uid(), workspace_id));

CREATE POLICY "Users can update contracts in their workspace"
ON public.contracts FOR UPDATE
USING (public.is_workspace_member(auth.uid(), workspace_id));

CREATE POLICY "Users can delete contracts in their workspace"
ON public.contracts FOR DELETE
USING (public.is_workspace_member(auth.uid(), workspace_id));

-- RLS Policies for contract_billings
CREATE POLICY "Users can view billings in their workspace"
ON public.contract_billings FOR SELECT
USING (public.is_workspace_member(auth.uid(), workspace_id));

CREATE POLICY "Users can create billings in their workspace"
ON public.contract_billings FOR INSERT
WITH CHECK (public.is_workspace_member(auth.uid(), workspace_id));

CREATE POLICY "Users can update billings in their workspace"
ON public.contract_billings FOR UPDATE
USING (public.is_workspace_member(auth.uid(), workspace_id));

CREATE POLICY "Users can delete billings in their workspace"
ON public.contract_billings FOR DELETE
USING (public.is_workspace_member(auth.uid(), workspace_id));

-- RLS Policies for expense_categories
CREATE POLICY "Users can view expense categories in their workspace"
ON public.expense_categories FOR SELECT
USING (public.is_workspace_member(auth.uid(), workspace_id));

CREATE POLICY "Users can create expense categories in their workspace"
ON public.expense_categories FOR INSERT
WITH CHECK (public.is_workspace_member(auth.uid(), workspace_id));

CREATE POLICY "Users can update expense categories in their workspace"
ON public.expense_categories FOR UPDATE
USING (public.is_workspace_member(auth.uid(), workspace_id));

CREATE POLICY "Users can delete expense categories in their workspace"
ON public.expense_categories FOR DELETE
USING (public.is_workspace_member(auth.uid(), workspace_id));

-- RLS Policies for expenses
CREATE POLICY "Users can view expenses in their workspace"
ON public.expenses FOR SELECT
USING (public.is_workspace_member(auth.uid(), workspace_id));

CREATE POLICY "Users can create expenses in their workspace"
ON public.expenses FOR INSERT
WITH CHECK (public.is_workspace_member(auth.uid(), workspace_id));

CREATE POLICY "Users can update expenses in their workspace"
ON public.expenses FOR UPDATE
USING (public.is_workspace_member(auth.uid(), workspace_id));

CREATE POLICY "Users can delete expenses in their workspace"
ON public.expenses FOR DELETE
USING (public.is_workspace_member(auth.uid(), workspace_id));

-- RLS Policies for one_time_sales
CREATE POLICY "Users can view sales in their workspace"
ON public.one_time_sales FOR SELECT
USING (public.is_workspace_member(auth.uid(), workspace_id));

CREATE POLICY "Users can create sales in their workspace"
ON public.one_time_sales FOR INSERT
WITH CHECK (public.is_workspace_member(auth.uid(), workspace_id));

CREATE POLICY "Users can update sales in their workspace"
ON public.one_time_sales FOR UPDATE
USING (public.is_workspace_member(auth.uid(), workspace_id));

CREATE POLICY "Users can delete sales in their workspace"
ON public.one_time_sales FOR DELETE
USING (public.is_workspace_member(auth.uid(), workspace_id));

-- RLS Policies for churns
CREATE POLICY "Users can view churns in their workspace"
ON public.churns FOR SELECT
USING (public.is_workspace_member(auth.uid(), workspace_id));

CREATE POLICY "Users can create churns in their workspace"
ON public.churns FOR INSERT
WITH CHECK (public.is_workspace_member(auth.uid(), workspace_id));

CREATE POLICY "Users can update churns in their workspace"
ON public.churns FOR UPDATE
USING (public.is_workspace_member(auth.uid(), workspace_id));

CREATE POLICY "Users can delete churns in their workspace"
ON public.churns FOR DELETE
USING (public.is_workspace_member(auth.uid(), workspace_id));

-- Create triggers for updated_at
CREATE TRIGGER update_clients_updated_at
BEFORE UPDATE ON public.clients
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_contracts_updated_at
BEFORE UPDATE ON public.contracts
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_contract_billings_updated_at
BEFORE UPDATE ON public.contract_billings
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_expenses_updated_at
BEFORE UPDATE ON public.expenses
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Create indexes for better performance
CREATE INDEX idx_clients_workspace_id ON public.clients(workspace_id);
CREATE INDEX idx_clients_status ON public.clients(status);
CREATE INDEX idx_contracts_workspace_id ON public.contracts(workspace_id);
CREATE INDEX idx_contracts_client_id ON public.contracts(client_id);
CREATE INDEX idx_contracts_status ON public.contracts(status);
CREATE INDEX idx_contract_billings_workspace_id ON public.contract_billings(workspace_id);
CREATE INDEX idx_contract_billings_contract_id ON public.contract_billings(contract_id);
CREATE INDEX idx_contract_billings_status ON public.contract_billings(status);
CREATE INDEX idx_contract_billings_due_date ON public.contract_billings(due_date);
CREATE INDEX idx_expenses_workspace_id ON public.expenses(workspace_id);
CREATE INDEX idx_expenses_category_id ON public.expenses(category_id);
CREATE INDEX idx_one_time_sales_workspace_id ON public.one_time_sales(workspace_id);
CREATE INDEX idx_one_time_sales_client_id ON public.one_time_sales(client_id);
CREATE INDEX idx_churns_workspace_id ON public.churns(workspace_id);
CREATE INDEX idx_churns_contract_id ON public.churns(contract_id);
CREATE INDEX idx_churns_client_id ON public.churns(client_id);