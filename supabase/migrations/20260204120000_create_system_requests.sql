-- Add super admin flag to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_super_admin BOOLEAN DEFAULT false;

-- Create Types Enums (Wrapped in DO block to avoid errors if they exist)
DO $$ BEGIN
    CREATE TYPE public.request_type AS ENUM ('suggestion', 'doubt', 'bug', 'other');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE public.request_status AS ENUM ('pending', 'analyzing', 'done', 'rejected');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Create Requests Table
CREATE TABLE IF NOT EXISTS public.system_requests (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES public.profiles(id) NOT NULL,
    type public.request_type NOT NULL,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    status public.request_status DEFAULT 'pending',
    admin_notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Create Attachments Table
CREATE TABLE IF NOT EXISTS public.system_request_attachments (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    request_id UUID REFERENCES public.system_requests(id) ON DELETE CASCADE,
    file_url TEXT NOT NULL,
    file_type TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS
ALTER TABLE public.system_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_request_attachments ENABLE ROW LEVEL SECURITY;

-- Policies for Requests

-- Users can view own requests
DROP POLICY IF EXISTS "Users can view own requests" ON public.system_requests;
CREATE POLICY "Users can view own requests" ON public.system_requests
    FOR SELECT USING (auth.uid() = user_id);

-- Users can create requests
DROP POLICY IF EXISTS "Users can create requests" ON public.system_requests;
CREATE POLICY "Users can create requests" ON public.system_requests
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Super Admins can view all requests
DROP POLICY IF EXISTS "Super Admins can view all requests" ON public.system_requests;
CREATE POLICY "Super Admins can view all requests" ON public.system_requests
    FOR SELECT USING (
        EXISTS ( SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_super_admin = true )
    );

-- Super Admins can update requests (status, notes)
DROP POLICY IF EXISTS "Super Admins can update requests" ON public.system_requests;
CREATE POLICY "Super Admins can update requests" ON public.system_requests
    FOR UPDATE USING (
        EXISTS ( SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_super_admin = true )
    );

-- Policies for Attachments

-- Users can view attachments of own requests
DROP POLICY IF EXISTS "Users can view attachments of own requests" ON public.system_request_attachments;
CREATE POLICY "Users can view attachments of own requests" ON public.system_request_attachments
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.system_requests
            WHERE id = request_id AND user_id = auth.uid()
        )
    );

-- Users can insert attachments to own requests
DROP POLICY IF EXISTS "Users can insert attachments to own requests" ON public.system_request_attachments;
CREATE POLICY "Users can insert attachments to own requests" ON public.system_request_attachments
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.system_requests
            WHERE id = request_id AND user_id = auth.uid()
        )
    );

-- Super Admins can view all attachments
DROP POLICY IF EXISTS "Super Admins can view all attachments" ON public.system_request_attachments;
CREATE POLICY "Super Admins can view all attachments" ON public.system_request_attachments
    FOR SELECT USING (
        EXISTS ( SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_super_admin = true )
    );

-- Storage Bucket Creation
INSERT INTO storage.buckets (id, name, public)
VALUES ('system-requests', 'system-requests', true)
ON CONFLICT (id) DO NOTHING;

-- Storage Policies
-- Authenticated users can upload
DROP POLICY IF EXISTS "Authenticated users can upload system-requests" ON storage.objects;
CREATE POLICY "Authenticated users can upload system-requests" ON storage.objects
  FOR INSERT WITH CHECK ( bucket_id = 'system-requests' AND auth.role() = 'authenticated' );

-- Everyone can read (public bucket)
DROP POLICY IF EXISTS "Anyone can read system-requests" ON storage.objects;
CREATE POLICY "Anyone can read system-requests" ON storage.objects
  FOR SELECT USING ( bucket_id = 'system-requests' );
