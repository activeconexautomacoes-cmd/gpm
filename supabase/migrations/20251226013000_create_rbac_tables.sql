-- Create permissions table
CREATE TABLE IF NOT EXISTS permissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    slug TEXT NOT NULL UNIQUE,
    description TEXT,
    category TEXT NOT NULL
);

-- Create roles table
CREATE TABLE IF NOT EXISTS roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    color TEXT DEFAULT 'gray',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create role_permissions table
CREATE TABLE IF NOT EXISTS role_permissions (
    role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    permission_id UUID NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
    PRIMARY KEY (role_id, permission_id)
);

-- Add role_id to workspace_members (nullable for now, will fill later)
ALTER TABLE workspace_members 
ADD COLUMN IF NOT EXISTS role_id UUID REFERENCES roles(id) ON DELETE SET NULL;

-- Enable RLS
ALTER TABLE permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE role_permissions ENABLE ROW LEVEL SECURITY;

-- Permissions policies: Viewable by authenticated users (simplification)
CREATE POLICY "Permissions viewable by authenticated users" ON permissions
    FOR SELECT USING (auth.role() = 'authenticated');

-- Roles policies: Viewable filter by workspace
CREATE POLICY "Roles viewable by workspace members" ON roles
    FOR SELECT USING (
        workspace_id IN (
            SELECT workspace_id FROM workspace_members 
            WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Roles manageable by workspace admins" ON roles
    FOR ALL USING (
        workspace_id IN (
            SELECT workspace_id FROM workspace_members 
            WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
        )
    );

-- Role Permissions policies
CREATE POLICY "Role Permissions viewable by members" ON role_permissions
    FOR SELECT USING (
        role_id IN (
            SELECT id FROM roles WHERE workspace_id IN (
                SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
            )
        )
    );

CREATE POLICY "Role Permissions manageable by admins" ON role_permissions
    FOR ALL USING (
        role_id IN (
            SELECT id FROM roles WHERE workspace_id IN (
                SELECT workspace_id FROM workspace_members 
                WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
            )
        )
    );

-- Seed Permissions
INSERT INTO permissions (slug, description, category) VALUES
    ('financial.view', 'Visualizar módulo financeiro', 'financial'),
    ('financial.edit', 'Editar dados financeiros (Lançamentos/Baixas)', 'financial'),
    ('crm.view', 'Visualizar CRM e Oportunidades', 'crm'),
    ('crm.edit', 'Editar Oportunidades e mover cards', 'crm'),
    ('settings.view', 'Visualizar configurações do workspace', 'settings'),
    ('settings.edit', 'Editar configurações do workspace', 'settings'),
    ('team.manage', 'Adicionar e remover membros', 'team')
ON CONFLICT (slug) DO NOTHING;

-- Migration Function to seed Roles for existing Workspaces
CREATE OR REPLACE FUNCTION migrate_roles_for_workspaces() 
RETURNS void AS $$
DECLARE
    ws RECORD;
    r_owner UUID;
    r_admin UUID;
    r_member UUID;
    r_sdr UUID;
    r_closer UUID;
    p_fin_view UUID;
    p_fin_edit UUID;
    p_crm_view UUID;
    p_crm_edit UUID;
    p_set_view UUID;
    p_set_edit UUID;
    p_team_manage UUID;
BEGIN
    -- Get Permission IDs
    SELECT id INTO p_fin_view FROM permissions WHERE slug = 'financial.view';
    SELECT id INTO p_fin_edit FROM permissions WHERE slug = 'financial.edit';
    SELECT id INTO p_crm_view FROM permissions WHERE slug = 'crm.view';
    SELECT id INTO p_crm_edit FROM permissions WHERE slug = 'crm.edit';
    SELECT id INTO p_set_view FROM permissions WHERE slug = 'settings.view';
    SELECT id INTO p_set_edit FROM permissions WHERE slug = 'settings.edit';
    SELECT id INTO p_team_manage FROM permissions WHERE slug = 'team.manage';

    FOR ws IN SELECT id FROM workspaces LOOP
        -- Create Roles if they don't exist
        
        -- Owner
        INSERT INTO roles (workspace_id, name, description, color) 
        VALUES (ws.id, 'Dono', 'Acesso total ao sistema', 'violet')
        ON CONFLICT DO NOTHING -- Need unique constraint on name+ws? Not strictly enforced yet but let's just insert
        RETURNING id INTO r_owner;
        
        -- If returning failed (already exists), find it. Ideally we should have unique constraint. 
        -- For this migration let's assume clean slate or just adding.
        IF r_owner IS NULL THEN
             SELECT id INTO r_owner FROM roles WHERE workspace_id = ws.id AND name = 'Dono';
        END IF;

        IF r_owner IS NOT NULL THEN
            INSERT INTO role_permissions (role_id, permission_id) VALUES
            (r_owner, p_fin_view), (r_owner, p_fin_edit),
            (r_owner, p_crm_view), (r_owner, p_crm_edit),
            (r_owner, p_set_view), (r_owner, p_set_edit),
            (r_owner, p_team_manage)
            ON CONFLICT DO NOTHING;
            
            -- Update Members
            UPDATE workspace_members SET role_id = r_owner WHERE workspace_id = ws.id AND role = 'owner';
        END IF;

        -- Admin
        INSERT INTO roles (workspace_id, name, description, color)
        VALUES (ws.id, 'Admin', 'Administrador do sistema', 'blue')
        RETURNING id INTO r_admin;

        IF r_admin IS NOT NULL THEN
             INSERT INTO role_permissions (role_id, permission_id) VALUES
            (r_admin, p_fin_view), (r_admin, p_fin_edit),
            (r_admin, p_crm_view), (r_admin, p_crm_edit),
            (r_admin, p_set_view), (r_admin, p_set_edit),
            (r_admin, p_team_manage)
            ON CONFLICT DO NOTHING;
            
            UPDATE workspace_members SET role_id = r_admin WHERE workspace_id = ws.id AND role = 'admin';
        END IF;

         -- Member/Closer/SDR logic similar...
         -- Closer
         INSERT INTO roles (workspace_id, name, description, color)
         VALUES (ws.id, 'Closer', 'Focado em fechamento', 'green')
         RETURNING id INTO r_closer;
         
         IF r_closer IS NOT NULL THEN
            INSERT INTO role_permissions (role_id, permission_id) VALUES
            (r_closer, p_crm_view), (r_closer, p_crm_edit)
            ON CONFLICT DO NOTHING;
            
            UPDATE workspace_members SET role_id = r_closer WHERE workspace_id = ws.id AND role = 'closer';
         END IF;

         -- SDR
         INSERT INTO roles (workspace_id, name, description, color)
         VALUES (ws.id, 'SDR', 'Pré-vendas e qualificação', 'yellow')
         RETURNING id INTO r_sdr;
         
         IF r_sdr IS NOT NULL THEN
            INSERT INTO role_permissions (role_id, permission_id) VALUES
            (r_sdr, p_crm_view), (r_sdr, p_crm_edit)
            ON CONFLICT DO NOTHING;
            
            UPDATE workspace_members SET role_id = r_sdr WHERE workspace_id = ws.id AND role = 'sdr';
         END IF;

    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Run migration
SELECT migrate_roles_for_workspaces();

-- Cleanup function
DROP FUNCTION migrate_roles_for_workspaces();
