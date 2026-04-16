CREATE OR REPLACE FUNCTION public.process_quiz_submission()
RETURNS TRIGGER AS $$
DECLARE
    v_workspace_id UUID;
    v_client_id UUID;
    v_product_id UUID;
    v_quiz_title TEXT;
    v_winner_product_name TEXT;
    v_opportunity_id UUID;
    
    -- Variables for Scheduler Logic
    v_key TEXT;
    v_value JSONB;
    v_booking_data JSONB;
    v_booking_id UUID;
    v_start_time TIMESTAMPTZ;
    v_meet_link TEXT;
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

    -- Handle Client (Upsert based on Email)
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
    END IF;

    -- Create Opportunity
    INSERT INTO public.opportunities (
        workspace_id,
        lead_name,
        lead_email,
        lead_phone,
        source, -- CORRECTED COLUMN NAME
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
        'website',
        (SELECT id FROM public.opportunity_stages WHERE workspace_id = v_workspace_id ORDER BY order_position ASC LIMIT 1), 
        v_product_id,
        now(),
        now(),
        jsonb_build_object(
            'quiz_id', NEW.quiz_id,
            'quiz_title', v_quiz_title,
            'quiz_score_assessoria', NEW.score_assessoria_total,
            'quiz_score_mentoria', NEW.score_mentoria_total,
            'quiz_result', v_winner_product_name,
            'pk_client_id', v_client_id -- Link client if created
        )
    )
    RETURNING id INTO v_opportunity_id;

    -- SEARCH FOR BOOKING IN ANSWERS
    IF NEW.answers IS NOT NULL THEN
        FOR v_key, v_value IN SELECT * FROM jsonb_each(NEW.answers) LOOP
            -- Check if value has 'booking' key
            IF v_value IS NOT NULL AND jsonb_typeof(v_value) = 'object' AND v_value ? 'booking' THEN
                
                v_booking_data := v_value->'booking';
                
                -- Extract ID (handle nested booking object structure: data.booking.id)
                BEGIN
                    IF v_booking_data ? 'booking' AND (v_booking_data->'booking') ? 'id' THEN
                         v_booking_id := (v_booking_data->'booking'->>'id')::UUID;
                    ELSIF v_booking_data ? 'id' THEN
                         v_booking_id := (v_booking_data->>'id')::UUID;
                    END IF;
                EXCEPTION WHEN OTHERS THEN
                    v_booking_id := NULL;
                END;

                v_meet_link := v_booking_data->>'meetLink';
                
                -- Get start time from slot
                IF v_value ? 'slot' AND (v_value->'slot') ? 'start' THEN
                     v_start_time := (v_value->'slot'->>'start')::TIMESTAMPTZ;
                END IF;

                -- If we found a valid ID, Exit
                IF v_booking_id IS NOT NULL THEN
                    EXIT;
                END IF;
            END IF;
        END LOOP;
    END IF;

    -- LINK BOOKING AND UPDATE OPPORTUNITY
    IF v_opportunity_id IS NOT NULL AND v_booking_id IS NOT NULL THEN
        -- 1. Link Booking to Opportunity
        UPDATE public.bookings 
        SET opportunity_id = v_opportunity_id 
        WHERE id = v_booking_id;

        -- 2. Update Opportunity with Schedule Info
        UPDATE public.opportunities
        SET 
            session_scheduled_at = v_start_time,
            session_meeting_link = v_meet_link,
            session_status = 'session_scheduled'
        WHERE id = v_opportunity_id;
    END IF;

    -- Update Submission with result product
    IF v_product_id IS NOT NULL THEN
        UPDATE public.quiz_submissions 
        SET result_product_id = v_product_id 
        WHERE id = NEW.id;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
