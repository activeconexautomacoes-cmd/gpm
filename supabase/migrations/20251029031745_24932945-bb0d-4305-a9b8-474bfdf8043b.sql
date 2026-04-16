-- Melhorar o trigger log_stage_change para incluir os nomes dos estágios
CREATE OR REPLACE FUNCTION public.log_stage_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  old_stage_name TEXT;
  new_stage_name TEXT;
BEGIN
  IF OLD.current_stage_id IS DISTINCT FROM NEW.current_stage_id THEN
    -- Buscar nomes dos estágios
    IF OLD.current_stage_id IS NOT NULL THEN
      SELECT name INTO old_stage_name 
      FROM opportunity_stages 
      WHERE id = OLD.current_stage_id;
    END IF;
    
    SELECT name INTO new_stage_name 
    FROM opportunity_stages 
    WHERE id = NEW.current_stage_id;
    
    INSERT INTO opportunity_notes (
      opportunity_id,
      created_by,
      note_type,
      content
    ) VALUES (
      NEW.id,
      auth.uid(),
      'stage_change',
      CASE 
        WHEN old_stage_name IS NULL THEN 'Movido para: ' || new_stage_name
        ELSE 'Mudou de "' || old_stage_name || '" para "' || new_stage_name || '"'
      END
    );
    
    NEW.stage_changed_at = NOW();
  END IF;
  
  RETURN NEW;
END;
$function$;