
CREATE TABLE IF NOT EXISTS public.financial_cost_centers (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id),
    name TEXT NOT NULL,
    code TEXT,
    description TEXT,
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- RLS for financial_cost_centers
ALTER TABLE public.financial_cost_centers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view cost centers of their workspace"
    ON public.financial_cost_centers
    FOR SELECT
    USING (
        workspace_id IN (
            SELECT workspace_id FROM public.workspace_members
            WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Users can insert cost centers to their workspace"
    ON public.financial_cost_centers
    FOR INSERT
    WITH CHECK (
        workspace_id IN (
            SELECT workspace_id FROM public.workspace_members
            WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Users can update cost centers of their workspace"
    ON public.financial_cost_centers
    FOR UPDATE
    USING (
        workspace_id IN (
            SELECT workspace_id FROM public.workspace_members
            WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Users can delete cost centers of their workspace"
    ON public.financial_cost_centers
    FOR DELETE
    USING (
        workspace_id IN (
            SELECT workspace_id FROM public.workspace_members
            WHERE user_id = auth.uid()
        )
    );

-- Add columns to financial_receivables
ALTER TABLE public.financial_receivables ADD COLUMN IF NOT EXISTS cost_center_id UUID REFERENCES public.financial_cost_centers(id);
ALTER TABLE public.financial_receivables ADD COLUMN IF NOT EXISTS reference_code TEXT;

-- Add columns to financial_payables
ALTER TABLE public.financial_payables ADD COLUMN IF NOT EXISTS cost_center_id UUID REFERENCES public.financial_cost_centers(id);
ALTER TABLE public.financial_payables ADD COLUMN IF NOT EXISTS reference_code TEXT;
