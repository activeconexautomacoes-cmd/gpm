-- Add KB permissions
INSERT INTO permissions (slug, description, category) VALUES
    ('kb.view', 'Visualizar Base de Conhecimento', 'kb'),
    ('kb.manage', 'Gerenciar Base de Conhecimento (Adicionar/Editar conteúdo)', 'kb')
ON CONFLICT (slug) DO UPDATE
SET description = EXCLUDED.description,
    category = EXCLUDED.category;

-- Grant KB permissions to Owner and Admin roles automatically
DO $$
DECLARE
    r RECORD;
    perm RECORD;
BEGIN
    FOR r IN SELECT id, name FROM roles WHERE name IN ('Dono', 'Admin', 'Owner', 'Administrador') LOOP
        FOR perm IN SELECT id FROM permissions WHERE category = 'kb' LOOP
            INSERT INTO role_permissions (role_id, permission_id)
            VALUES (r.id, perm.id)
            ON CONFLICT DO NOTHING;
        END LOOP;
    END LOOP;
END $$;
