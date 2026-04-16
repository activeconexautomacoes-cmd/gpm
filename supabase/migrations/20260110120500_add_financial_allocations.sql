
-- Create table for financial allocations (rateio)
CREATE TABLE IF NOT EXISTS public.financial_allocations (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    payable_id UUID REFERENCES public.financial_payables(id) ON DELETE CASCADE,
    receivable_id UUID REFERENCES public.financial_receivables(id) ON DELETE CASCADE,
    category_id UUID NOT NULL REFERENCES public.financial_categories(id),
    cost_center_id UUID REFERENCES public.financial_cost_centers(id),
    amount NUMERIC(15, 2) NOT NULL DEFAULT 0,
    percentage NUMERIC(5, 2) NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    
    CONSTRAINT financial_allocations_source_check CHECK (
        (payable_id IS NOT NULL AND receivable_id IS NULL) OR 
        (payable_id IS NULL AND receivable_id IS NOT NULL)
    )
);

-- Add index for performance
CREATE INDEX IF NOT EXISTS financial_allocations_payable_id_idx ON public.financial_allocations(payable_id);
CREATE INDEX IF NOT EXISTS financial_allocations_receivable_id_idx ON public.financial_allocations(receivable_id);

-- Enable RLS
ALTER TABLE public.financial_allocations ENABLE ROW LEVEL SECURITY;

-- Add RLS policies
CREATE POLICY "Users can view allocations in their workspace" 
ON public.financial_allocations FOR SELECT 
USING (workspace_id IN (
    SELECT workspace_id FROM public.workspace_members 
    WHERE user_id = auth.uid()
));

CREATE POLICY "Users can insert allocations in their workspace" 
ON public.financial_allocations FOR INSERT 
WITH CHECK (workspace_id IN (
    SELECT workspace_id FROM public.workspace_members 
    WHERE user_id = auth.uid()
));

CREATE POLICY "Users can update allocations in their workspace" 
ON public.financial_allocations FOR UPDATE 
USING (workspace_id IN (
    SELECT workspace_id FROM public.workspace_members 
    WHERE user_id = auth.uid()
));

CREATE POLICY "Users can delete allocations in their workspace" 
ON public.financial_allocations FOR DELETE 
USING (workspace_id IN (
    SELECT workspace_id FROM public.workspace_members 
    WHERE user_id = auth.uid()
));
