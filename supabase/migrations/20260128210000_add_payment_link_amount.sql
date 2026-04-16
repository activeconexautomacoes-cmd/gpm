-- Add payment_link_amount column to store the amount when payment link was generated
-- This allows detecting when values have changed and the link needs to be regenerated

ALTER TABLE public.opportunities
ADD COLUMN IF NOT EXISTS payment_link_amount numeric;

COMMENT ON COLUMN public.opportunities.payment_link_amount IS 'The negotiated_value at the time the payment link was generated. Used to detect when values change.';
