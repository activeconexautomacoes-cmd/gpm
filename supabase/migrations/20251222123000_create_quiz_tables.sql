-- Create Quizzes table
CREATE TABLE IF NOT EXISTS public.quizzes (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT,
    slug TEXT NOT NULL UNIQUE,
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create Quiz Questions table
CREATE TABLE IF NOT EXISTS public.quiz_questions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    quiz_id UUID REFERENCES public.quizzes(id) ON DELETE CASCADE,
    text TEXT NOT NULL,
    question_type TEXT DEFAULT 'single_choice', -- 'single_choice', 'multiple_choice', 'text'
    "order" INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Create Quiz Options table
CREATE TABLE IF NOT EXISTS public.quiz_options (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    question_id UUID REFERENCES public.quiz_questions(id) ON DELETE CASCADE,
    text TEXT NOT NULL,
    score_assessoria INTEGER DEFAULT 0,
    score_mentoria INTEGER DEFAULT 0,
    "order" INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Create Quiz Submissions table
CREATE TABLE IF NOT EXISTS public.quiz_submissions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    quiz_id UUID REFERENCES public.quizzes(id) ON DELETE SET NULL,
    lead_name TEXT NOT NULL,
    lead_email TEXT,
    lead_phone TEXT,
    score_assessoria_total INTEGER DEFAULT 0,
    score_mentoria_total INTEGER DEFAULT 0,
    result_product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
    opportunity_id UUID REFERENCES public.opportunities(id) ON DELETE SET NULL,
    answers JSONB, -- Stores the full state of answers for record
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.quizzes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quiz_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quiz_options ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quiz_submissions ENABLE ROW LEVEL SECURITY;

-- Policies (Adjust as needed for public access vs admin access)
-- For now, allowing public read for quizzes to let users take them
CREATE POLICY "Allow public read access to quizzes" ON public.quizzes FOR SELECT USING (true);
CREATE POLICY "Allow public read access to questions" ON public.quiz_questions FOR SELECT USING (true);
CREATE POLICY "Allow public read access to options" ON public.quiz_options FOR SELECT USING (true);

-- Allow public insert to submissions (for lead capture)
CREATE POLICY "Allow public insert to submissions" ON public.quiz_submissions FOR INSERT WITH CHECK (true);

-- Allow authenticated users (admins) to manage everything
CREATE POLICY "Allow admin all on quizzes" ON public.quizzes USING (auth.role() = 'authenticated');
CREATE POLICY "Allow admin all on questions" ON public.quiz_questions USING (auth.role() = 'authenticated');
CREATE POLICY "Allow admin all on options" ON public.quiz_options USING (auth.role() = 'authenticated');
CREATE POLICY "Allow admin all on submissions" ON public.quiz_submissions USING (auth.role() = 'authenticated');
