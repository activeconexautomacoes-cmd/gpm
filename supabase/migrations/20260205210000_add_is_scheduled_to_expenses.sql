ALTER TABLE financial_payables ADD COLUMN is_scheduled BOOLEAN DEFAULT FALSE;
ALTER TABLE financial_receivables ADD COLUMN is_scheduled BOOLEAN DEFAULT FALSE;
