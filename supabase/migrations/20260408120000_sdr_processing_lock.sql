-- Lock atômico para evitar respostas duplicadas no SDR webhook
ALTER TABLE sdr_leads ADD COLUMN IF NOT EXISTS processing_since timestamptz DEFAULT NULL;

-- Index para performance do lock query
CREATE INDEX IF NOT EXISTS idx_sdr_leads_processing ON sdr_leads (phone, processing_since);

-- Função atômica de lock para evitar race conditions
CREATE OR REPLACE FUNCTION sdr_acquire_lock(p_phone text)
RETURNS boolean
LANGUAGE plpgsql
AS $$
DECLARE
  rows_affected integer;
BEGIN
  -- Cria o lead se não existe (primeiro contato)
  INSERT INTO sdr_leads (phone, status, workspace_id, updated_at)
  VALUES (p_phone, 'em_conversa', '8eaae987-1b56-43de-978c-c135beb30c7e', now())
  ON CONFLICT (phone, workspace_id) DO NOTHING;

  -- Tenta adquirir o lock atomicamente
  UPDATE sdr_leads
  SET processing_since = now()
  WHERE phone = p_phone
    AND (processing_since IS NULL OR processing_since < now() - interval '120 seconds');
  GET DIAGNOSTICS rows_affected = ROW_COUNT;
  RETURN rows_affected > 0;
END;
$$;
