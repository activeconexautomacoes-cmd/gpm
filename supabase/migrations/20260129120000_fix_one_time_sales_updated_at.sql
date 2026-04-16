ALTER TABLE public.one_time_sales 
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Check extension moddatetime (usually in extensions schema)
CREATE EXTENSION IF NOT EXISTS moddatetime SCHEMA extensions;

-- Create trigger if not exists
DROP TRIGGER IF EXISTS handle_updated_at ON public.one_time_sales;
CREATE TRIGGER handle_updated_at 
BEFORE UPDATE ON public.one_time_sales 
FOR EACH ROW EXECUTE PROCEDURE extensions.moddatetime (updated_at);
