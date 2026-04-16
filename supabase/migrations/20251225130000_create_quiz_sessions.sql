CREATE TABLE IF NOT EXISTS public.quiz_sessions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    quiz_id UUID REFERENCES public.quizzes(id) ON DELETE CASCADE,
    session_token UUID NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    last_interaction_at TIMESTAMPTZ DEFAULT now(),
    is_completed BOOLEAN DEFAULT false,
    current_step_index INTEGER DEFAULT 0,
    answers JSONB DEFAULT '{}'::jsonb,
    metadata JSONB DEFAULT '{}'::jsonb,
    score INTEGER DEFAULT 0,
    has_contact_info BOOLEAN DEFAULT false
);

CREATE INDEX IF NOT EXISTS idx_quiz_sessions_quiz_id ON public.quiz_sessions(quiz_id);
CREATE INDEX IF NOT EXISTS idx_quiz_sessions_created_at ON public.quiz_sessions(created_at);

ALTER TABLE public.quiz_sessions ENABLE ROW LEVEL SECURITY;

-- Allow public to create sessions (anonymous visitors)
CREATE POLICY "Allow public insert sessions" ON public.quiz_sessions 
    FOR INSERT WITH CHECK (true);

-- Allow public to update their session (conceptually we rely on RLS being open for public logic or matching ID, 
-- but since Supabase client in storage/anon key might use unrestricted, we'll allow update for now. 
-- In a stricter app, we'd verify the session_token matches).
CREATE POLICY "Allow public update sessions" ON public.quiz_sessions 
    FOR UPDATE USING (true);

-- Allow admins (authenticated) to view all sessions for dashboards
CREATE POLICY "Allow authenticated view sessions" ON public.quiz_sessions 
    FOR SELECT USING (auth.role() = 'authenticated');
