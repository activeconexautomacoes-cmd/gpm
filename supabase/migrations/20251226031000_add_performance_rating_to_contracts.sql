-- Add performance_rating column to contracts
ALTER TABLE public.contracts ADD COLUMN IF NOT EXISTS performance_rating TEXT CHECK (performance_rating IN ('good', 'medium', 'bad')) DEFAULT 'medium';

-- Add index for performance_rating
CREATE INDEX IF NOT EXISTS idx_contracts_performance_rating ON public.contracts(performance_rating);
