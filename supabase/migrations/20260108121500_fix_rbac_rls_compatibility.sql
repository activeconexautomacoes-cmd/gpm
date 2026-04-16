-- Migration to fix RLS compatibility between legacy role enum and new RBAC system
-- This specifically addresses the issue where users with the "Dono" role in the RBAC system
-- cannot see leads if their legacy 'role' column is set to 'member'.

-- 1. Helper function to check granular permission in SQL (RLS-friendly)
CREATE OR REPLACE FUNCTION public.check_user_permission(_user_id UUID, _workspace_id UUID, _permission_slug TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM workspace_members wm
    JOIN roles r ON wm.role_id = r.id
    JOIN role_permissions rp ON r.id = rp.role_id
    JOIN permissions p ON rp.permission_id = p.id
    WHERE wm.user_id = _user_id
      AND wm.workspace_id = _workspace_id
      AND p.slug = _permission_slug
  );
$$;

-- 2. Update is_sales_role to be multi-system aware
CREATE OR REPLACE FUNCTION public.is_sales_role(_user_id UUID, _workspace_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM workspace_members wm
    WHERE wm.user_id = _user_id
      AND wm.workspace_id = _workspace_id
      AND (
        wm.role IN ('sdr', 'closer', 'sales_manager', 'owner', 'admin')
        OR public.check_user_permission(_user_id, _workspace_id, 'crm.view')
      )
  );
$$;

-- 3. Update get_user_role to be multi-system aware (returns legacy role mapping)
-- This allows legacy policies that check for 'owner' or 'admin' to work for new RBAC users.
CREATE OR REPLACE FUNCTION public.get_user_role(_user_id UUID, _workspace_id UUID)
RETURNS workspace_role
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_enum_role workspace_role;
    v_is_rbac_admin BOOLEAN;
BEGIN
    -- Get legacy role
    SELECT role INTO v_enum_role
    FROM workspace_members
    WHERE user_id = _user_id
      AND workspace_id = _workspace_id;

    -- Check if RBAC gives admin/owner privileges 
    -- (checking for 'crm.edit' and 'team.manage' as a proxy for manager/admin)
    SELECT EXISTS (
        SELECT 1
        FROM workspace_members wm
        JOIN roles r ON wm.role_id = r.id
        JOIN role_permissions rp ON r.id = rp.role_id
        JOIN permissions p ON rp.permission_id = p.id
        WHERE wm.user_id = _user_id
          AND wm.workspace_id = _workspace_id
          AND p.slug IN ('team.manage', 'settings.edit')
    ) INTO v_is_rbac_admin;

    IF v_is_rbac_admin THEN
        RETURN 'admin'::workspace_role;
    END IF;

    -- Fallback to the original enum role
    RETURN COALESCE(v_enum_role, 'member'::workspace_role);
END;
$$;

-- 4. Re-apply opportunities policies to ensure they use the updated functions correctly
-- (Technically not needed since they use the functions by name, but good for clarity)

DROP POLICY IF EXISTS "Sales team can view opportunities" ON public.opportunities;
CREATE POLICY "Sales team can view opportunities"
  ON public.opportunities FOR SELECT
  USING (public.is_sales_role(auth.uid(), workspace_id));

DROP POLICY IF EXISTS "Sales can create opportunities" ON public.opportunities;
CREATE POLICY "Sales can create opportunities"
  ON public.opportunities FOR INSERT
  WITH CHECK (public.is_sales_role(auth.uid(), workspace_id));

DROP POLICY IF EXISTS "Assigned or managers can update opportunities" ON public.opportunities;
CREATE POLICY "Assigned or managers can update opportunities"
  ON public.opportunities FOR UPDATE
  USING (
    public.get_user_role(auth.uid(), workspace_id) IN ('owner', 'admin', 'sales_manager')
    OR assigned_sdr = auth.uid()
    OR assigned_closer = auth.uid()
  );

DROP POLICY IF EXISTS "Managers can delete opportunities" ON public.opportunities;
CREATE POLICY "Managers can delete opportunities"
  ON public.opportunities FOR DELETE
  USING (
    public.get_user_role(auth.uid(), workspace_id) IN ('owner', 'admin', 'sales_manager')
  );
