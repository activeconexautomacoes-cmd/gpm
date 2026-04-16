
-- Function to duplicate a quiz with all its questions, options and elements
CREATE OR REPLACE FUNCTION public.duplicate_quiz(target_quiz_id UUID)
RETURNS UUID AS $$
DECLARE
    new_quiz_id UUID;
    old_question_record RECORD;
    new_question_id UUID;
BEGIN
    -- 1. Duplicate the Quiz
    INSERT INTO public.quizzes (
        title, 
        description, 
        slug, 
        active, 
        workspace_id, 
        pixels, 
        seo, 
        webhook, 
        settings, 
        scoring_rules
    )
    SELECT 
        title || ' (Cópia)', 
        description, 
        slug || '-copy-' || floor(random() * 10000), 
        false, -- Default to inactive
        workspace_id, 
        pixels, 
        seo, 
        webhook, 
        settings, 
        scoring_rules
    FROM public.quizzes
    WHERE id = target_quiz_id
    RETURNING id INTO new_quiz_id;

    -- 2. Duplicate Questions
    FOR old_question_record IN 
        SELECT * FROM public.quiz_questions WHERE quiz_id = target_quiz_id
    LOOP
        INSERT INTO public.quiz_questions (
            quiz_id, 
            text, 
            question_type, 
            "order"
        )
        VALUES (
            new_quiz_id, 
            old_question_record.text, 
            old_question_record.question_type, 
            old_question_record."order"
        )
        RETURNING id INTO new_question_id;

        -- 3. Duplicate Options for this question
        INSERT INTO public.quiz_options (
            question_id, 
            text, 
            score_assessoria, 
            score_mentoria, 
            "order", 
            points
        )
        SELECT 
            new_question_id, 
            text, 
            score_assessoria, 
            score_mentoria, 
            "order", 
            points
        FROM public.quiz_options
        WHERE question_id = old_question_record.id;

        -- 4. Duplicate Elements for this question
        INSERT INTO public.quiz_elements (
            question_id, 
            type, 
            content, 
            order_index
        )
        SELECT 
            new_question_id, 
            type, 
            content, 
            order_index
        FROM public.quiz_elements
        WHERE question_id = old_question_record.id;
    END LOOP;

    RETURN new_quiz_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
