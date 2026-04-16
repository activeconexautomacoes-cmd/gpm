-- Migration to add essential fields to clients table for better integration and mass import
ALTER TABLE public.clients 
ADD COLUMN IF NOT EXISTS trade_name TEXT,
ADD COLUMN IF NOT EXISTS revenue_bracket TEXT,
ADD COLUMN IF NOT EXISTS state_registration TEXT,
ADD COLUMN IF NOT EXISTS municipal_registration TEXT,
ADD COLUMN IF NOT EXISTS email_billing TEXT,
ADD COLUMN IF NOT EXISTS mobile TEXT,
ADD COLUMN IF NOT EXISTS zip_code TEXT,
ADD COLUMN IF NOT EXISTS street TEXT,
ADD COLUMN IF NOT EXISTS number TEXT,
ADD COLUMN IF NOT EXISTS complement TEXT,
ADD COLUMN IF NOT EXISTS neighborhood TEXT,
ADD COLUMN IF NOT EXISTS city TEXT,
ADD COLUMN IF NOT EXISTS state TEXT,
ADD COLUMN IF NOT EXISTS profession TEXT,
ADD COLUMN IF NOT EXISTS activity_segment TEXT,
ADD COLUMN IF NOT EXISTS source TEXT,
ADD COLUMN IF NOT EXISTS registration_date DATE;

-- Remove fields that belong to contracts (User request)
ALTER TABLE public.clients DROP COLUMN IF EXISTS billing_day;
ALTER TABLE public.clients DROP COLUMN IF EXISTS billing_method;

-- Add comments for documentation
COMMENT ON COLUMN public.clients.trade_name IS 'Nome Fantasia do cliente';
COMMENT ON COLUMN public.clients.revenue_bracket IS 'Faixa de faturamento ou valor informado';
COMMENT ON COLUMN public.clients.email_billing IS 'Emails para envio de avisos financeiros';
COMMENT ON COLUMN public.clients.source IS 'Origem do cliente (ex: indicação, instagram, etc)';
COMMENT ON COLUMN public.clients.neighborhood IS 'Bairro do cliente';
COMMENT ON COLUMN public.clients.street IS 'Rua/Logradouro do cliente';
COMMENT ON COLUMN public.clients.number IS 'Número do endereço';
COMMENT ON COLUMN public.clients.complement IS 'Complemento do endereço';
COMMENT ON COLUMN public.clients.zip_code IS 'CEP do cliente';
