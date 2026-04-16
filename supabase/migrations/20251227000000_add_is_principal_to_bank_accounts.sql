-- Add is_principal column to financial_bank_accounts
ALTER TABLE financial_bank_accounts ADD COLUMN IF NOT EXISTS is_principal BOOLEAN DEFAULT false;

-- Create a comment to explain the field
COMMENT ON COLUMN financial_bank_accounts.is_principal IS 'Indicates if this is the primary bank account for the workspace.';
