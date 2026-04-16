-- Function to process new quiz submissions with custom fields support
CREATE OR REPLACE FUNCTION public.process_quiz_submission()
RETURNS TRIGGER AS $$
DECLARE
    v_workspace_id UUID;
    v_client_id UUID;
    v_product_id UUID;
    v_quiz_title TEXT;
    v_winner_product_name TEXT;
    v_custom_fields JSONB;
BEGIN
    SELECT workspace_id, title INTO v_workspace_id, v_quiz_title
    FROM public.quizzes
    WHERE id = NEW.quiz_id;

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

    IF NEW.lead_email IS NOT NULL THEN
        SELECT id INTO v_client_id
        FROM public.clients
        WHERE workspace_id = v_workspace_id
        AND email = NEW.lead_email
        LIMIT 1;

        IF v_client_id IS NOT NULL THEN
            UPDATE public.clients
            SET 
                name = NEW.lead_name,
                phone = COALESCE(NEW.lead_phone, phone),
                updated_at = now()
            WHERE id = v_client_id;
        ELSE
            INSERT INTO public.clients (workspace_id, name, email, phone, status)
            VALUES (v_workspace_id, NEW.lead_name, NEW.lead_email, NEW.lead_phone, 'active')
            RETURNING id INTO v_client_id;
        END IF;

    ELSE
        RETURN NEW;
    END IF;

    -- Extrair custom fields do answers (onde estão salvos os campos customizados do CRM)
    v_custom_fields := COALESCE(NEW.answers->'_crm_custom_fields', '{}'::jsonb);
    
    -- Adicionar informações do quiz aos custom fields
    v_custom_fields := v_custom_fields || jsonb_build_object(
        'quiz_id', NEW.quiz_id,
        'quiz_title', v_quiz_title,
        'quiz_score_assessoria', NEW.score_assessoria_total,
        'quiz_score_mentoria', NEW.score_mentoria_total,
        'quiz_result', v_winner_product_name
    );

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
        'website',
        (SELECT id FROM public.opportunity_stages WHERE workspace_id = v_workspace_id ORDER BY order_position ASC LIMIT 1), 
        v_product_id,
        now(),
        now(),
        v_custom_fields
    );

    IF v_product_id IS NOT NULL THEN
        UPDATE public.quiz_submissions 
        SET result_product_id = v_product_id 
        WHERE id = NEW.id;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recreate trigger
DROP TRIGGER IF EXISTS on_quiz_submission_created ON public.quiz_submissions;

CREATE TRIGGER on_quiz_submission_created
    AFTER INSERT ON public.quiz_submissions
    FOR EACH ROW
    EXECUTE FUNCTION public.process_quiz_submission();
