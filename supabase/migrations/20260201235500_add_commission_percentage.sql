-- Add commission_percentage to opportunities and contracts

ALTER TABLE public.opportunities 
ADD COLUMN IF NOT EXISTS negotiated_commission_percentage NUMERIC DEFAULT 0;

ALTER TABLE public.contracts 
ADD COLUMN IF NOT EXISTS commission_percentage NUMERIC DEFAULT 0;

-- Comment on columns
COMMENT ON COLUMN public.opportunities.negotiated_commission_percentage IS 'Percentage of commission on revenue (user input only)';
COMMENT ON COLUMN public.contracts.commission_percentage IS 'Percentage of commission on revenue (copied from opportunity)';
