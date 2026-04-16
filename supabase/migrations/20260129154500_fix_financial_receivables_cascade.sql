-- Fix foreign key constraints on financial_receivables to allow CASCADE deletion
-- This prevents the "Key is still referenced from table financial_receivables" error when deleting opportunities/sales

-- 1. Drop existing constraint for one_time_sale_id
ALTER TABLE public.financial_receivables 
DROP CONSTRAINT IF EXISTS financial_receivables_one_time_sale_id_fkey;

-- 2. Recreate constraint with ON DELETE CASCADE
ALTER TABLE public.financial_receivables 
ADD CONSTRAINT financial_receivables_one_time_sale_id_fkey 
FOREIGN KEY (one_time_sale_id) 
REFERENCES public.one_time_sales(id) 
ON DELETE CASCADE;

-- 3. Also fix contract_id constraint (preventative)
ALTER TABLE public.financial_receivables 
DROP CONSTRAINT IF EXISTS financial_receivables_contract_id_fkey;

ALTER TABLE public.financial_receivables 
ADD CONSTRAINT financial_receivables_contract_id_fkey 
FOREIGN KEY (contract_id) 
REFERENCES public.contracts(id) 
ON DELETE CASCADE;

-- 4. Also fix client_id constraint (preventative - careful here, usually we want to keep client financials even if client is deleted, but if strict cascade is needed: )
-- Decided NOT to cascade client deletions automatically as that might delete historical financial data if a client is accidentally removed.
-- Keeping client_id RESTRICT or SET NULL is safer. But for Sales/Contracts, if the sale is gone, the receivable should be too.
