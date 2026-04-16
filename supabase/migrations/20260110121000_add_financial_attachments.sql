-- Create bucket for financial attachments
INSERT INTO storage.buckets (id, name, public) 
VALUES ('financial-attachments', 'financial-attachments', true)
ON CONFLICT (id) DO NOTHING;

-- Create financial_attachments table
CREATE TABLE IF NOT EXISTS public.financial_attachments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id),
    receivable_id UUID REFERENCES public.financial_receivables(id) ON DELETE CASCADE,
    payable_id UUID REFERENCES public.financial_payables(id) ON DELETE CASCADE,
    file_url TEXT NOT NULL,
    file_name TEXT NOT NULL,
    file_size INTEGER,
    file_type TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    uploaded_by UUID REFERENCES auth.users(id),
    
    CONSTRAINT financial_attachments_target_check CHECK (
        (receivable_id IS NOT NULL AND payable_id IS NULL) OR 
        (receivable_id IS NULL AND payable_id IS NOT NULL)
    )
);

-- Enable RLS
ALTER TABLE public.financial_attachments ENABLE ROW LEVEL SECURITY;

-- Create policies for financial_attachments
CREATE POLICY "Users can view financial attachments from their workspace"
    ON public.financial_attachments
    FOR SELECT
    USING (
        workspace_id IN (
            SELECT workspace_id 
            FROM public.workspace_members 
            WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Users can insert financial attachments to their workspace"
    ON public.financial_attachments
    FOR INSERT
    WITH CHECK (
        workspace_id IN (
            SELECT workspace_id 
            FROM public.workspace_members 
            WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Users can delete financial attachments from their workspace"
    ON public.financial_attachments
    FOR DELETE
    USING (
        workspace_id IN (
            SELECT workspace_id 
            FROM public.workspace_members 
            WHERE user_id = auth.uid()
        )
    );

-- Storage policies
CREATE POLICY "Workspace members can view financial attachments"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'financial-attachments' AND
  (storage.foldername(name))[1] IN (
    SELECT workspace_id::text 
    FROM public.workspace_members 
    WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Workspace members can upload financial attachments"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'financial-attachments' AND
  (storage.foldername(name))[1] IN (
    SELECT workspace_id::text 
    FROM public.workspace_members 
    WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Workspace members can delete financial attachments"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'financial-attachments' AND
  (storage.foldername(name))[1] IN (
    SELECT workspace_id::text 
    FROM public.workspace_members 
    WHERE user_id = auth.uid()
  )
);
