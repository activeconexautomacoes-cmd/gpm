-- ============================================================
-- SDR Leads — Campos de rastreio (UTM, fbclid, ctwa)
-- Captura dados de atribuição vindos do contextInfo da Evolution API
-- quando o lead chega via Click-to-WhatsApp Ads do Meta
-- ============================================================

ALTER TABLE public.sdr_leads
  ADD COLUMN IF NOT EXISTS ctwa_clid TEXT,
  ADD COLUMN IF NOT EXISTS ad_source_url TEXT,
  ADD COLUMN IF NOT EXISTS utm_source TEXT,
  ADD COLUMN IF NOT EXISTS utm_medium TEXT,
  ADD COLUMN IF NOT EXISTS utm_campaign TEXT;

COMMENT ON COLUMN public.sdr_leads.ctwa_clid IS 'Click-to-WhatsApp Ad Click ID (equivalente ao fbclid)';
COMMENT ON COLUMN public.sdr_leads.ad_source_url IS 'URL de origem do anúncio (referral sourceUrl)';
COMMENT ON COLUMN public.sdr_leads.utm_source IS 'UTM source extraído do referral';
COMMENT ON COLUMN public.sdr_leads.utm_medium IS 'UTM medium extraído do referral';
COMMENT ON COLUMN public.sdr_leads.utm_campaign IS 'UTM campaign extraído do referral';
