-- Add assigned_to column to opportunity_notes to support task delegation
ALTER TABLE public.opportunity_notes
ADD COLUMN IF NOT EXISTS assigned_to UUID REFERENCES public.profiles(id);

-- Add index for better performance
CREATE INDEX IF NOT EXISTS idx_opportunity_notes_assigned_to ON public.opportunity_notes(assigned_to);
