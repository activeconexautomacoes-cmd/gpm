-- Add new JSONB columns for advanced quiz settings
ALTER TABLE public.quizzes 
ADD COLUMN IF NOT EXISTS pixels JSONB DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS seo JSONB DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS webhook JSONB DEFAULT '{}'::jsonb;
