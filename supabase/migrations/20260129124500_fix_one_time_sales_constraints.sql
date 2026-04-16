-- 1. Create extension if not exists (required for moddatetime)
CREATE EXTENSION IF NOT EXISTS moddatetime SCHEMA extensions;

-- 2. Add updated_at column if not exists
ALTER TABLE public.one_time_sales 
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- 3. Set default value for sale_date to prevent null violation errors
-- This fixes the "null value in column sale_date of relation one_time_sales violates not-null constraint" error
ALTER TABLE public.one_time_sales 
ALTER COLUMN sale_date SET DEFAULT CURRENT_DATE;

-- 4. Create trigger for updated_at (drop first to allow idempotency)
DROP TRIGGER IF EXISTS handle_updated_at ON public.one_time_sales;

CREATE TRIGGER handle_updated_at 
BEFORE UPDATE ON public.one_time_sales 
FOR EACH ROW EXECUTE PROCEDURE extensions.moddatetime (updated_at);
