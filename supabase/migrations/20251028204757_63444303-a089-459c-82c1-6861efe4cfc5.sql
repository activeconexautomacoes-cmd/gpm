-- Add implementation_fee column to contracts table
ALTER TABLE contracts 
ADD COLUMN implementation_fee NUMERIC DEFAULT 0;

COMMENT ON COLUMN contracts.implementation_fee IS 'Valor único de implementação que será adicionado à primeira cobrança do contrato';