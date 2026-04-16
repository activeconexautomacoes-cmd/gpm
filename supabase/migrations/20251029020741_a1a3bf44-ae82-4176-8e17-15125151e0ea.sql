-- Drop the old constraint
ALTER TABLE public.churns 
DROP CONSTRAINT IF EXISTS churns_reason_type_check;

-- Add the new constraint with the correct values
ALTER TABLE public.churns 
ADD CONSTRAINT churns_reason_type_check 
CHECK (reason_type IN (
  'price',
  'service_quality',
  'competitor',
  'business_closure',
  'financial_difficulty',
  'other'
));