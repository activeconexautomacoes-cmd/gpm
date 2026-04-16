-- Fix contract_period constraint to match application values
ALTER TABLE public.contracts 
DROP CONSTRAINT IF EXISTS contracts_contract_period_check;

ALTER TABLE public.contracts 
ADD CONSTRAINT contracts_contract_period_check 
CHECK (contract_period IN ('6_months', '12_months', '18_months', '24_months', 'custom'));