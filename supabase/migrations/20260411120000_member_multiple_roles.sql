-- Create member_roles junction table for multiple roles per member
CREATE TABLE IF NOT EXISTS member_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_member_id UUID NOT NULL REFERENCES workspace_members(id) ON DELETE CASCADE,
    role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (workspace_member_id, role_id)
);

-- Enable RLS
ALTER TABLE member_roles ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Member roles viewable by workspace members" ON member_roles
    FOR SELECT USING (
        workspace_member_id IN (
            SELECT wm2.id FROM workspace_members wm2
            WHERE wm2.workspace_id IN (
                SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
            )
        )
    );

CREATE POLICY "Member roles manageable by admins" ON member_roles
    FOR ALL USING (
        workspace_member_id IN (
            SELECT wm2.id FROM workspace_members wm2
            WHERE wm2.workspace_id IN (
                SELECT workspace_id FROM workspace_members
                WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
            )
        )
    );

-- Migrate existing role_id data from workspace_members to member_roles
INSERT INTO member_roles (workspace_member_id, role_id)
SELECT id, role_id FROM workspace_members WHERE role_id IS NOT NULL
ON CONFLICT (workspace_member_id, role_id) DO NOTHING;
