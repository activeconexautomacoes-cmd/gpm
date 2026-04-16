-- Function to process new quiz submissions
CREATE OR REPLACE FUNCTION public.process_quiz_submission()
RETURNS TRIGGER AS $$
DECLARE
    v_workspace_id UUID;
    v_client_id UUID;
    v_product_id UUID;
    v_quiz_title TEXT;
    v_winner_product_name TEXT;
BEGIN
    -- Get Workspace ID from the Quiz
    SELECT workspace_id, title INTO v_workspace_id, v_quiz_title
    FROM public.quizzes
    WHERE id = NEW.quiz_id;

    -- Determine Winner Product Name (Based on scores)
    IF NEW.score_assessoria_total > NEW.score_mentoria_total THEN
        v_winner_product_name := 'Assessoria';
    ELSE
        v_winner_product_name := 'Mentoria';
    END IF;

    -- Try to find a matching product in the workspace to link
    -- This looks for a product that contains the winner name (case insensitive)
    SELECT id INTO v_product_id
    FROM public.products
    WHERE workspace_id = v_workspace_id
    AND name ILIKE '%' || v_winner_product_name || '%'
    LIMIT 1;

    -- 1. Upsert Client (Identify by Email)
    IF NEW.lead_email IS NOT NULL THEN
        INSERT INTO public.clients (workspace_id, name, email, phone, status)
        VALUES (v_workspace_id, NEW.lead_name, NEW.lead_email, NEW.lead_phone, 'active')
        ON CONFLICT (workspace_id, email) 
        -- Update phone and name if they changed, mainly to ensure we have fresh data
        DO UPDATE SET 
            name = EXCLUDED.name,
            phone = COALESCE(EXCLUDED.phone, clients.phone),
            updated_at = now()
        RETURNING id INTO v_client_id;
    ELSE
        -- Fallback if no email (should be required by UI but good for safety)
        -- Identify by Phone? Or just create new? For now require email.
        RETURN NEW;
    END IF;

    -- 2. Create Opportunity
    INSERT INTO public.opportunities (
        workspace_id,
        lead_name,
        lead_email,
        lead_phone,
        lead_source,
        current_stage_id, -- Will be null initially, or we could fetch the first stage
        qualified_product,
        created_at,
        updated_at,
        custom_fields
    )
    VALUES (
        v_workspace_id,
        NEW.lead_name,
        NEW.lead_email,
        NEW.lead_phone,
        'website', -- approximating 'quiz' as website source
        (SELECT id FROM public.opportunity_stages WHERE workspace_id = v_workspace_id ORDER BY order_position ASC LIMIT 1), -- First stage
        v_product_id,
        now(),
        now(),
        jsonb_build_object(
            'quiz_id', NEW.quiz_id,
            'quiz_title', v_quiz_title,
            'quiz_score_assessoria', NEW.score_assessoria_total,
            'quiz_score_mentoria', NEW.score_mentoria_total,
            'quiz_result', v_winner_product_name
        )
    );

    -- Update the submission with the result product id optionally if we found one
    IF v_product_id IS NOT NULL THEN
        UPDATE public.quiz_submissions 
        SET result_product_id = v_product_id 
        WHERE id = NEW.id;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger
DROP TRIGGER IF EXISTS on_quiz_submission_created ON public.quiz_submissions;
CREATE TRIGGER on_quiz_submission_created
    AFTER INSERT ON public.quiz_submissions
    FOR EACH ROW
    EXECUTE FUNCTION public.process_quiz_submission();
