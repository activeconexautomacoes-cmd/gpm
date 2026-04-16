
-- Fix RLS policies by re-applying them ensuring they are correct
-- Sometimes old policies conflict or get stuck.

-- Financial Bank Accounts
DROP POLICY IF EXISTS "Users can view bank accounts from their workspace" ON public.financial_bank_accounts;
DROP POLICY IF EXISTS "Users can manage bank accounts from their workspace" ON public.financial_bank_accounts;

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

-- Financial Receivables
DROP POLICY IF EXISTS "Users can view receivables from their workspace" ON public.financial_receivables;
DROP POLICY IF EXISTS "Users can manage receivables from their workspace" ON public.financial_receivables;

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

-- Financial Payables
DROP POLICY IF EXISTS "Users can view payables from their workspace" ON public.financial_payables;
DROP POLICY IF EXISTS "Users can manage payables from their workspace" ON public.financial_payables;

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

-- Financial Categories
DROP POLICY IF EXISTS "Users can view financial categories from their workspace" ON public.financial_categories;
DROP POLICY IF EXISTS "Users can manage financial categories from their workspace" ON public.financial_categories;

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
