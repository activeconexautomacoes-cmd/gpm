-- Add session_status and other analytics-relevant fields to opportunities
ALTER TABLE public.opportunities ADD COLUMN IF NOT EXISTS session_status TEXT;
COMMENT ON COLUMN public.opportunities.session_status IS 'Status of the scheduled session: attended, no_show, or null if not yet determined';

-- Ensure we have a way to track when a lead was qualified (passed to an SQL stage)
ALTER TABLE public.opportunities ADD COLUMN IF NOT EXISTS sql_at TIMESTAMPTZ;
