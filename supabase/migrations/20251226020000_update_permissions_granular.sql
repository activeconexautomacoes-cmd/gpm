-- Add new granular permissions
INSERT INTO permissions (slug, description, category) VALUES
    -- Dashboard
    ('dashboard.view', 'Visualizar Dashboard Geral', 'dashboard'),
    ('dashboard.financial', 'Visualizar Métricas Financeiras no Dashboard', 'dashboard'),
    
    -- Relatórios
    ('reports.view', 'Acessar Relatórios e Analytics', 'reports'),
    
    -- CRM & Pipeline
    ('pipeline.config', 'Configurar Etapas do Pipeline e Funis', 'crm'),
    
    -- Cadastros Gerais
    ('products.manage', 'Gerenciar Produtos (Criar/Editar/Excluir)', 'registries'),
    ('clients.manage', 'Gerenciar Clientes (Criar/Editar/Excluir)', 'registries'),
    
    -- Contratos
    ('contracts.view', 'Visualizar Contratos', 'contracts'),
    ('contracts.manage', 'Gerenciar Contratos (Criar/Editar/Excluir)', 'contracts'),
    
    -- Vendas Avulsas
    ('sales.manage', 'Gerenciar Vendas Avulsas', 'sales')
ON CONFLICT (slug) DO UPDATE 
SET description = EXCLUDED.description, 
    category = EXCLUDED.category;

-- Update existing descriptions for better clarity
UPDATE permissions SET description = 'Visualizar módulo financeiro, extratos e contas' WHERE slug = 'financial.view';
UPDATE permissions SET description = 'Gerenciar lançamentos (Criar/Editar/Baixar/Excluir)' WHERE slug = 'financial.edit';
UPDATE permissions SET description = 'Acessar Kanban e lista de oportunidades' WHERE slug = 'crm.view';
UPDATE permissions SET description = 'Gerenciar oportunidades (Criar/Editar/Mover)' WHERE slug = 'crm.edit';
UPDATE permissions SET description = 'Gerenciar membros da equipe e atribuir funções' WHERE slug = 'team.manage';

-- Grant new permissions to Owner and Admin roles automatically
-- We use a DO block to iterate over existing roles
DO $$
DECLARE
    r RECORD;
    perm RECORD;
BEGIN
    FOR r IN SELECT id, name FROM roles WHERE name IN ('Dono', 'Admin', 'Owner', 'Administrador') LOOP
        FOR perm IN SELECT id FROM permissions LOOP
            INSERT INTO role_permissions (role_id, permission_id)
            VALUES (r.id, perm.id)
            ON CONFLICT DO NOTHING;
        END LOOP;
    END LOOP;
END $$;
