
-- Add hierarchy support and custom ordering to financial_categories
ALTER TABLE public.financial_categories 
ADD COLUMN IF NOT EXISTS parent_id UUID REFERENCES public.financial_categories(id),
ADD COLUMN IF NOT EXISTS code TEXT, -- For "3.01", "3.01.01" etc ordering
ADD COLUMN IF NOT EXISTS is_system BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS "order" INTEGER DEFAULT 0;

-- Create an index for faster hierarchy traversal
CREATE INDEX IF NOT EXISTS financial_categories_parent_id_idx ON public.financial_categories(parent_id);

-- Optional: Drop the existing trigger if we want to batch insert without validation or update validation logic
-- (Assuming standard triggers are fine)
