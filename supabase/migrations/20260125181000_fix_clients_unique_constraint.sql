DO $$ 
BEGIN 
    -- Limpeza cirúrgica da duplicada encontrada (apaga uma das cópias idênticas)
    -- Só executa se a duplicata existir
    IF EXISTS (SELECT 1 FROM public.clients WHERE id = 'a13d593c-b990-4322-baec-88ecadcfe71f') THEN
        DELETE FROM public.clients WHERE id = 'a13d593c-b990-4322-baec-88ecadcfe71f';
    END IF;

    -- Adicionar Constraint UNIQUE (Se não existir)
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'clients_workspace_id_email_key'
    ) THEN
        ALTER TABLE public.clients ADD CONSTRAINT clients_workspace_id_email_key UNIQUE (workspace_id, email);
    END IF;
END $$;
