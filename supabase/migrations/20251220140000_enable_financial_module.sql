-- Migration: Enable Financial Module
-- Description: Creates tables for Financial Module and migrates existing data from expenses/categories

-- 1. Enums
-- Check if types exist before creating to make it idempotent-ish or just CREATE TYPE (will fail if exists, but this is a new migration)
CREATE TYPE public.financial_status AS ENUM ('pending', 'paid', 'overdue', 'cancelled', 'scheduled');
CREATE TYPE public.financial_movement_type AS ENUM ('income', 'expense');
CREATE TYPE public.reconciliation_status AS ENUM ('pending', 'reconciled', 'ignored');

-- 2. Financial Categories (Unified Chart of Accounts)
CREATE TABLE public.financial_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id),
    name TEXT NOT NULL,
    type public.financial_movement_type NOT NULL,
    parent_id UUID REFERENCES public.financial_categories(id),
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS
ALTER TABLE public.financial_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view financial categories from their workspace" 
    ON public.financial_categories FOR SELECT 
    USING (workspace_id IN (
        SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid()
    ));

CREATE POLICY "Users can manage financial categories from their workspace" 
    ON public.financial_categories FOR ALL 
    USING (workspace_id IN (
        SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid()
    ));

-- Migrate existing expense categories
INSERT INTO public.financial_categories (id, workspace_id, name, type, created_at)
SELECT id, workspace_id, name, 'expense'::public.financial_movement_type, created_at
FROM public.expense_categories;

-- 3. Financial Bank Accounts
CREATE TABLE public.financial_bank_accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id),
    name TEXT NOT NULL,
    bank_code TEXT,
    agency TEXT,
    account_number TEXT,
    initial_balance NUMERIC(15,2) DEFAULT 0,
    current_balance NUMERIC(15,2) DEFAULT 0,
    color TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS
ALTER TABLE public.financial_bank_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view bank accounts from their workspace" 
    ON public.financial_bank_accounts FOR SELECT 
    USING (workspace_id IN (
        SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid()
    ));

CREATE POLICY "Users can manage bank accounts from their workspace" 
    ON public.financial_bank_accounts FOR ALL 
    USING (workspace_id IN (
        SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid()
    ));

-- 4. Financial Receivables (Accounts Receivable)
CREATE TABLE public.financial_receivables (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id),
    description TEXT NOT NULL,
    
    amount NUMERIC(15,2) NOT NULL,
    fine_amount NUMERIC(15,2) DEFAULT 0,
    interest_amount NUMERIC(15,2) DEFAULT 0,
    discount_amount NUMERIC(15,2) DEFAULT 0,
    total_amount NUMERIC(15,2) NOT NULL,

    due_date DATE NOT NULL,
    competence_date DATE NOT NULL DEFAULT CURRENT_DATE,
    payment_date DATE,

    status public.financial_status DEFAULT 'pending',
    category_id UUID REFERENCES public.financial_categories(id),
    client_id UUID REFERENCES public.clients(id),
    
    -- Origin Links
    contract_id UUID REFERENCES public.contracts(id), 
    one_time_sale_id UUID REFERENCES public.one_time_sales(id),
    contract_billing_id UUID REFERENCES public.contract_billings(id),

    bank_account_id UUID REFERENCES public.financial_bank_accounts(id),

    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS
ALTER TABLE public.financial_receivables ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view receivables from their workspace" 
    ON public.financial_receivables FOR SELECT 
    USING (workspace_id IN (
        SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid()
    ));

CREATE POLICY "Users can manage receivables from their workspace" 
    ON public.financial_receivables FOR ALL 
    USING (workspace_id IN (
        SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid()
    ));

-- 5. Financial Payables (Accounts Payable)
CREATE TABLE public.financial_payables (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id),
    description TEXT NOT NULL,
    
    amount NUMERIC(15,2) NOT NULL,
    fine_amount NUMERIC(15,2) DEFAULT 0,
    interest_amount NUMERIC(15,2) DEFAULT 0,
    discount_amount NUMERIC(15,2) DEFAULT 0,
    total_amount NUMERIC(15,2) NOT NULL,

    due_date DATE NOT NULL,
    competence_date DATE NOT NULL DEFAULT CURRENT_DATE,
    payment_date DATE,

    status public.financial_status DEFAULT 'pending',
    category_id UUID REFERENCES public.financial_categories(id),
    supplier_id UUID,

    bank_account_id UUID REFERENCES public.financial_bank_accounts(id),
    
    is_recurring BOOLEAN DEFAULT false,
    recurrence_pattern TEXT,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS
ALTER TABLE public.financial_payables ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view payables from their workspace" 
    ON public.financial_payables FOR SELECT 
    USING (workspace_id IN (
        SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid()
    ));

CREATE POLICY "Users can manage payables from their workspace" 
    ON public.financial_payables FOR ALL 
    USING (workspace_id IN (
        SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid()
    ));

-- Migrate existing expenses
INSERT INTO public.financial_payables (
  id, workspace_id, description, amount, total_amount, due_date, competence_date, payment_date, status, category_id, is_recurring, recurrence_pattern, created_at, updated_at
)
SELECT 
  id, 
  workspace_id, 
  description, 
  amount, 
  amount, -- total_amount starts as amount
  expense_date, -- due_date mapped to expense_date
  expense_date, -- competence mapped to expense_date
  payment_date,
  CASE 
    WHEN status = 'paid' THEN 'paid'::public.financial_status 
    WHEN status = 'late' OR status = 'overdue' THEN 'overdue'::public.financial_status
    ELSE 'pending'::public.financial_status 
  END,
  category_id,
  is_recurring,
  recurrence_pattern,
  created_at, 
  updated_at
FROM public.expenses;

-- 6. Financial Bank Transactions (OFX Staging)
CREATE TABLE public.financial_bank_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id),
    bank_account_id UUID NOT NULL REFERENCES public.financial_bank_accounts(id),
    
    transaction_date DATE NOT NULL,
    amount NUMERIC(15,2) NOT NULL,
    description TEXT NOT NULL,
    fitid TEXT NOT NULL,
    
    status public.reconciliation_status DEFAULT 'pending',
    
    matched_payable_id UUID REFERENCES public.financial_payables(id),
    matched_receivable_id UUID REFERENCES public.financial_receivables(id),
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    
    UNIQUE(bank_account_id, fitid)
);

-- Enable RLS
ALTER TABLE public.financial_bank_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view bank transactions from their workspace" 
    ON public.financial_bank_transactions FOR SELECT 
    USING (workspace_id IN (
        SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid()
    ));

CREATE POLICY "Users can manage bank transactions from their workspace" 
    ON public.financial_bank_transactions FOR ALL 
    USING (workspace_id IN (
        SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid()
    ));

-- Triggers for updatedAt using the CORRECT function name
CREATE TRIGGER update_financial_receivables_updated_at
    BEFORE UPDATE ON public.financial_receivables
    FOR EACH ROW
    EXECUTE PROCEDURE public.update_updated_at_column();

CREATE TRIGGER update_financial_payables_updated_at
    BEFORE UPDATE ON public.financial_payables
    FOR EACH ROW
    EXECUTE PROCEDURE public.update_updated_at_column();
