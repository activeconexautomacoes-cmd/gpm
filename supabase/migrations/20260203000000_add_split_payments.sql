-- Add financial_receivable_id to billing_invoices to support split payments
ALTER TABLE public.billing_invoices
ADD COLUMN financial_receivable_id UUID REFERENCES public.financial_receivables(id);

-- 1. Create Unique Index for Split Payments (where financial_receivable_id exists)
CREATE UNIQUE INDEX idx_billing_invoices_financial_receivable_id 
ON public.billing_invoices(financial_receivable_id) 
WHERE financial_receivable_id IS NOT NULL;

-- 2. Handle Legacy Unique Constraint
-- We need to allow multiple invoices per contract_billing_id (because of splits)
-- BUT we want to preserve uniqueness for legacy rows (where financial_receivable_id is NULL)

-- Drop the standard unique constraint if it exists (guess name based on Supabase defaults)
ALTER TABLE public.billing_invoices DROP CONSTRAINT IF EXISTS billing_invoices_contract_billing_id_key;
DROP INDEX IF EXISTS billing_invoices_contract_billing_id_key;

-- Create partial index for legacy rows to maintain 1:1 behavior when no split is involved
CREATE UNIQUE INDEX idx_billing_invoices_contract_billing_id_legacy
ON public.billing_invoices(contract_billing_id)
WHERE financial_receivable_id IS NULL AND contract_billing_id IS NOT NULL;

-- Same for one_time_sale_id just in case
ALTER TABLE public.billing_invoices DROP CONSTRAINT IF EXISTS billing_invoices_one_time_sale_id_key;
DROP INDEX IF EXISTS billing_invoices_one_time_sale_id_key;

CREATE UNIQUE INDEX idx_billing_invoices_one_time_sale_id_legacy
ON public.billing_invoices(one_time_sale_id)
WHERE financial_receivable_id IS NULL AND one_time_sale_id IS NOT NULL;
