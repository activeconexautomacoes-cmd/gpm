-- 1. Update process_quiz_submission to ONLY create an opportunity (Lead)
-- and NOT create or update a client. A client should only be created
-- when the opportunity is marked as 'Won'.

CREATE OR REPLACE FUNCTION public.process_quiz_submission()
RETURNS TRIGGER AS $$
DECLARE
    v_workspace_id UUID;
    v_product_id UUID;
    v_quiz_title TEXT;
    v_winner_product_name TEXT;
    v_custom_fields JSONB;
BEGIN
    -- 1. Get Quiz and Workspace Info
    SELECT workspace_id, title INTO v_workspace_id, v_quiz_title
    FROM public.quizzes
    WHERE id = NEW.quiz_id;

    -- 2. Determine Qualified Product based on score
    -- Heurística baseada nos nomes dos produtos do GPM
    IF NEW.score_assessoria_total > NEW.score_mentoria_total THEN
        v_winner_product_name := 'Assessoria';
    ELSE
        v_winner_product_name := 'Mentoria';
    END IF;

    SELECT id INTO v_product_id
    FROM public.products
    WHERE workspace_id = v_workspace_id
    AND name ILIKE '%' || v_winner_product_name || '%'
    LIMIT 1;

    -- 3. Prepare Custom Fields
    v_custom_fields := COALESCE(NEW.answers->'_crm_custom_fields', '{}'::jsonb);
    
    -- Add Quiz context to custom fields for better visibility in CRM
    v_custom_fields := v_custom_fields || jsonb_build_object(
        'quiz_id', NEW.quiz_id,
        'quiz_title', v_quiz_title,
        'quiz_score_assessoria', NEW.score_assessoria_total,
        'quiz_score_mentoria', NEW.score_mentoria_total,
        'quiz_result', v_winner_product_name,
        'source_type', 'quiz'
    );

    -- 4. Create Opportunity (Lead)
    -- This ensures the person stays as a Lead in the CRM Funnel
    INSERT INTO public.opportunities (
        workspace_id,
        lead_name,
        lead_email,
        lead_phone,
        lead_company,
        company_segment,
        source,
        current_stage_id, 
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
        v_custom_fields->>'lead_company',
        v_custom_fields->>'company_segment',
        'quiz', -- Changed from 'website' to 'quiz' for better clarity
        (SELECT id FROM public.opportunity_stages WHERE workspace_id = v_workspace_id ORDER BY order_position ASC LIMIT 1), 
        v_product_id,
        now(),
        now(),
        v_custom_fields
    );

    -- 5. Update Submission with the result product (internal tracking)
    IF v_product_id IS NOT NULL THEN
        UPDATE public.quiz_submissions 
        SET result_product_id = v_product_id 
        WHERE id = NEW.id;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Ensure the trigger is properly set up
DROP TRIGGER IF EXISTS on_quiz_submission_created ON public.quiz_submissions;

CREATE TRIGGER on_quiz_submission_created
    AFTER INSERT ON public.quiz_submissions
    FOR EACH ROW
    EXECUTE FUNCTION public.process_quiz_submission();

-- 3. OPTIONAL CLEANUP: Run this manually if you want to remove leads that were incorrectly registered as clients
-- IMPORTANT: This will delete clients who do NOT have any contracts, one-time sales, or tasks, 
-- and were likely created as leads from the quiz before this fix.
/*
DELETE FROM public.clients
WHERE id IN (
    SELECT c.id FROM public.clients c
    LEFT JOIN public.contracts con ON con.client_id = c.id
    LEFT JOIN public.one_time_sales ots ON ots.client_id = c.id
    LEFT JOIN public.tasks t ON t.client_id = c.id
    WHERE con.id IS NULL 
    AND ots.id IS NULL 
    AND t.id IS NULL
    AND c.opportunity_id IS NOT NULL -- Originated from an opportunity/quiz
);
*/
