-- Add CS responsible and Traffic Manager columns to contracts
ALTER TABLE public.contracts ADD COLUMN IF NOT EXISTS cs_id UUID REFERENCES public.profiles(id);
ALTER TABLE public.contracts ADD COLUMN IF NOT EXISTS account_manager_id UUID REFERENCES public.profiles(id);
ALTER TABLE public.contracts ADD COLUMN IF NOT EXISTS squad_id UUID REFERENCES public.squads(id);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_contracts_cs_id ON public.contracts(cs_id);
CREATE INDEX IF NOT EXISTS idx_contracts_account_manager_id ON public.contracts(account_manager_id);
CREATE INDEX IF NOT EXISTS idx_contracts_squad_id ON public.contracts(squad_id);
