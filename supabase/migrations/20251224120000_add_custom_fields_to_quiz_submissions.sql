-- Add custom_fields column to quiz_submissions table
ALTER TABLE public.quiz_submissions 
ADD COLUMN IF NOT EXISTS custom_fields JSONB DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.quiz_submissions.custom_fields IS 'Stores custom CRM fields mapped from quiz elements (company_segment, company_website, etc)';
