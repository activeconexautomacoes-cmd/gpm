-- Create Squads Table
CREATE TABLE public.squads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    color TEXT DEFAULT '#000000',
    leader_id UUID REFERENCES public.profiles(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS for Squads
ALTER TABLE public.squads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view squads in their workspace" ON public.squads
    FOR SELECT USING (
        workspace_id IN (
            SELECT wm.workspace_id FROM public.workspace_members wm WHERE wm.user_id = auth.uid()
        )
    );

CREATE POLICY "Admins and Managers can manage squads" ON public.squads
    FOR ALL USING (
        workspace_id IN (
            SELECT wm.workspace_id 
            FROM public.workspace_members wm
            JOIN public.roles r ON wm.role_id = r.id
            JOIN public.role_permissions rp ON r.id = rp.role_id
            JOIN public.permissions p ON rp.permission_id = p.id
            WHERE wm.user_id = auth.uid() AND p.slug = 'ops.manage'
        )
    );

-- Create Squad Members Table
CREATE TABLE public.squad_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    squad_id UUID NOT NULL REFERENCES public.squads(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    role TEXT DEFAULT 'member', -- 'member', 'leader'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(squad_id, user_id)
);

-- Enable RLS for Squad Members
ALTER TABLE public.squad_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view squad members in their workspace" ON public.squad_members
    FOR SELECT USING (
        squad_id IN (
            SELECT s.id FROM public.squads s WHERE s.workspace_id IN (
                SELECT wm.workspace_id FROM public.workspace_members wm WHERE wm.user_id = auth.uid()
            )
        )
    );

CREATE POLICY "Admins and Managers can manage squad members" ON public.squad_members
    FOR ALL USING (
        squad_id IN (
            SELECT s.id FROM public.squads s WHERE s.workspace_id IN (
                SELECT wm.workspace_id 
                FROM public.workspace_members wm
                JOIN public.roles r ON wm.role_id = r.id
                JOIN public.role_permissions rp ON r.id = rp.role_id
                JOIN public.permissions p ON rp.permission_id = p.id
                WHERE wm.user_id = auth.uid() AND p.slug = 'ops.manage'
            )
        )
    );

-- Create Tasks Table
CREATE TABLE public.tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
    squad_id UUID REFERENCES public.squads(id) ON DELETE SET NULL,
    title TEXT NOT NULL,
    description TEXT,
    status TEXT NOT NULL DEFAULT 'backlog', -- backlog, todo, in_progress, review, done
    priority TEXT NOT NULL DEFAULT 'medium', -- low, medium, high, urgent
    type TEXT NOT NULL DEFAULT 'other', -- traffic, design, copy, strategy, other
    assignee_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    reporter_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    due_date TIMESTAMP WITH TIME ZONE,
    parent_task_id UUID REFERENCES public.tasks(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS for Tasks
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view tasks in their workspace" ON public.tasks
    FOR SELECT USING (
        workspace_id IN (
            SELECT wm.workspace_id FROM public.workspace_members wm WHERE wm.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can create tasks" ON public.tasks
    FOR INSERT WITH CHECK (
        workspace_id IN (
            SELECT wm.workspace_id FROM public.workspace_members wm WHERE wm.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can update tasks" ON public.tasks
    FOR UPDATE USING (
        workspace_id IN (
            SELECT wm.workspace_id FROM public.workspace_members wm WHERE wm.user_id = auth.uid()
        )
    );

CREATE POLICY "Admins and Managers can delete tasks" ON public.tasks
    FOR DELETE USING (
        workspace_id IN (
            SELECT wm.workspace_id 
            FROM public.workspace_members wm
            JOIN public.roles r ON wm.role_id = r.id
            JOIN public.role_permissions rp ON r.id = rp.role_id
            JOIN public.permissions p ON rp.permission_id = p.id
            WHERE wm.user_id = auth.uid() AND (p.slug = 'ops.manage' OR p.slug = 'tasks.manage')
        )
    );

-- Create Task Comments Table
CREATE TABLE public.task_comments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS for Task Comments
ALTER TABLE public.task_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view comments on visible tasks" ON public.task_comments
    FOR SELECT USING (
        task_id IN (
            SELECT t.id FROM public.tasks t WHERE t.workspace_id IN (
                SELECT wm.workspace_id FROM public.workspace_members wm WHERE wm.user_id = auth.uid()
            )
        )
    );

CREATE POLICY "Users can create comments" ON public.task_comments
    FOR INSERT WITH CHECK (
        task_id IN (
            SELECT t.id FROM public.tasks t WHERE t.workspace_id IN (
                SELECT wm.workspace_id FROM public.workspace_members wm WHERE wm.user_id = auth.uid()
            )
        )
    );

-- Create Client Performance Metrics Table
CREATE TABLE public.client_performance_metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    spend NUMERIC(15, 2) DEFAULT 0,
    revenue NUMERIC(15, 2) DEFAULT 0,
    roas NUMERIC(10, 2) DEFAULT 0,
    leads INTEGER DEFAULT 0,
    cpl NUMERIC(10, 2) DEFAULT 0,
    clicks INTEGER DEFAULT 0,
    ctr NUMERIC(5, 2) DEFAULT 0,
    impressions INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS for Client Performance Metrics
ALTER TABLE public.client_performance_metrics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view metrics in their workspace" ON public.client_performance_metrics
    FOR SELECT USING (
        workspace_id IN (
            SELECT wm.workspace_id FROM public.workspace_members wm WHERE wm.user_id = auth.uid()
        )
    );

CREATE POLICY "Users with permission can manage metrics" ON public.client_performance_metrics
    FOR ALL USING (
        workspace_id IN (
            SELECT wm.workspace_id 
            FROM public.workspace_members wm
            JOIN public.roles r ON wm.role_id = r.id
            JOIN public.role_permissions rp ON r.id = rp.role_id
            JOIN public.permissions p ON rp.permission_id = p.id
            WHERE wm.user_id = auth.uid() AND (p.slug = 'ops.manage' OR p.slug = 'metrics.manage')
        )
    );

-- Add New Permissions
INSERT INTO public.permissions (slug, description, category) VALUES
    ('ops.view', 'Visualizar área de operações', 'operations'),
    ('ops.manage', 'Gerenciar toda área de operações (Squads, Configurações)', 'operations'),
    ('tasks.view_all', 'Visualizar todas as tarefas', 'tasks'),
    ('tasks.manage', 'Gerenciar tarefas de terceiros', 'tasks'),
    ('metrics.manage', 'Gerenciar indicadores de performance', 'metrics')
ON CONFLICT (slug) DO NOTHING;

-- Grant permissions to Owner/Admin roles automatically (best effort)
-- This assumes standard roles exist. Users can manually assign later.
DO $$
DECLARE
    role_record RECORD;
    perm_record RECORD;
BEGIN
    FOR role_record IN SELECT id FROM public.roles WHERE name IN ('Dono', 'Admin', 'Gestor')
    LOOP
        FOR perm_record IN SELECT id FROM public.permissions WHERE slug IN ('ops.view', 'ops.manage', 'tasks.view_all', 'tasks.manage', 'metrics.manage')
        LOOP
            INSERT INTO public.role_permissions (role_id, permission_id)
            VALUES (role_record.id, perm_record.id)
            ON CONFLICT DO NOTHING;
        END LOOP;
    END LOOP;
END $$;
