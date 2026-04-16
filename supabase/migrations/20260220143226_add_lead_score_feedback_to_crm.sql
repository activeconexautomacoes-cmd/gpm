-- Adiciona configuração de exigência de lead score em um estágio
ALTER TABLE public.opportunity_stages
ADD COLUMN IF NOT EXISTS requires_lead_score_feedback boolean DEFAULT false;

-- Adiciona o score a oportunidade
ALTER TABLE public.opportunities
ADD COLUMN IF NOT EXISTS lead_score text;

-- Restringe aos valores permitidos (frio, morno, quente)
ALTER TABLE public.opportunities
ADD CONSTRAINT opportunities_lead_score_check
CHECK (lead_score IN ('frio', 'morno', 'quente'));
