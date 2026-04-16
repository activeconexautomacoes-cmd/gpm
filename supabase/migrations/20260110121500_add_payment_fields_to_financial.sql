-- Add payment details and notes to financial tables
ALTER TABLE financial_receivables 
ADD COLUMN interest numeric(12,2) DEFAULT 0,
ADD COLUMN fine numeric(12,2) DEFAULT 0,
ADD COLUMN discount numeric(12,2) DEFAULT 0,
ADD COLUMN notes text,
ADD COLUMN payment_method text;

ALTER TABLE financial_payables 
ADD COLUMN interest numeric(12,2) DEFAULT 0,
ADD COLUMN fine numeric(12,2) DEFAULT 0,
ADD COLUMN discount numeric(12,2) DEFAULT 0,
ADD COLUMN notes text,
ADD COLUMN payment_method text;
