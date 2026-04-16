-- Create client_assets table
CREATE TABLE public.client_assets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
    contract_id UUID REFERENCES public.contracts(id) ON DELETE SET NULL,
    name TEXT NOT NULL,
    file_path TEXT NOT NULL,
    file_type TEXT,
    size BIGINT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL
);

-- Enable RLS
ALTER TABLE public.client_assets ENABLE ROW LEVEL SECURITY;

-- Policies for client_assets
CREATE POLICY "Users can view assets in their workspace" ON public.client_assets
    FOR SELECT USING (
        workspace_id IN (
            SELECT wm.workspace_id FROM public.workspace_members wm WHERE wm.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can manage assets in their workspace" ON public.client_assets
    FOR ALL USING (
        workspace_id IN (
            SELECT wm.workspace_id FROM public.workspace_members wm WHERE wm.user_id = auth.uid()
        )
    );

-- Create storage bucket for client assets if it doesn't exist
INSERT INTO storage.buckets (id, name, public) 
VALUES ('client-assets', 'client-assets', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies
CREATE POLICY "Public Access" ON storage.objects FOR SELECT USING ( bucket_id = 'client-assets' );
CREATE POLICY "Authenticated users can upload assets" ON storage.objects FOR INSERT WITH CHECK ( bucket_id = 'client-assets' AND auth.role() = 'authenticated' );
CREATE POLICY "Users can delete their own assets" ON storage.objects FOR DELETE USING ( bucket_id = 'client-assets' AND auth.uid() = owner );
