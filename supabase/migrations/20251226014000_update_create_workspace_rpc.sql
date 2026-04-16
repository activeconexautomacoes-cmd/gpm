-- Redefine create_workspace to include RBAC logic
CREATE OR REPLACE FUNCTION public.create_workspace(_name text, _user_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _slug text;
  _workspace_id uuid;
  _workspace json;
  _r_owner uuid;
  _r_admin uuid;
  _r_member uuid;
  _r_sdr uuid;
  _r_closer uuid;
  
  -- Permissions
  _p_fin_view uuid;
  _p_fin_edit uuid;
  _p_crm_view uuid;
  _p_crm_edit uuid;
  _p_set_view uuid;
  _p_set_edit uuid;
  _p_team_manage uuid;
BEGIN
  -- Validate that the caller is the user
  IF _user_id != auth.uid() THEN
    RAISE EXCEPTION 'Unauthorized: user_id must match authenticated user';
  END IF;

  -- Generate slug
  _slug := lower(regexp_replace(_name, '[^a-zA-Z0-9]+', '-', 'g'));
  _slug := trim(both '-' from _slug);
  _slug := left(_slug, 60);

  -- Insert workspace
  INSERT INTO public.workspaces (name, slug, created_by)
  VALUES (_name, _slug, _user_id)
  RETURNING id INTO _workspace_id;

  --------------------------
  -- RBAC SETUP
  --------------------------
  
  -- Get Permission IDs (Optimize by selecting all at once if possible, or individual queries)
  SELECT id INTO _p_fin_view FROM permissions WHERE slug = 'financial.view';
  SELECT id INTO _p_fin_edit FROM permissions WHERE slug = 'financial.edit';
  SELECT id INTO _p_crm_view FROM permissions WHERE slug = 'crm.view';
  SELECT id INTO _p_crm_edit FROM permissions WHERE slug = 'crm.edit';
  SELECT id INTO _p_set_view FROM permissions WHERE slug = 'settings.view';
  SELECT id INTO _p_set_edit FROM permissions WHERE slug = 'settings.edit';
  SELECT id INTO _p_team_manage FROM permissions WHERE slug = 'team.manage';

  -- Create Roles
  
  -- Owner
  INSERT INTO roles (workspace_id, name, description, color) 
  VALUES (_workspace_id, 'Dono', 'Acesso total ao sistema', 'violet')
  RETURNING id INTO _r_owner;
  
  INSERT INTO role_permissions (role_id, permission_id) VALUES
  (_r_owner, _p_fin_view), (_r_owner, _p_fin_edit),
  (_r_owner, _p_crm_view), (_r_owner, _p_crm_edit),
  (_r_owner, _p_set_view), (_r_owner, _p_set_edit),
  (_r_owner, _p_team_manage);

  -- Admin
  INSERT INTO roles (workspace_id, name, description, color)
  VALUES (_workspace_id, 'Admin', 'Administrador do sistema', 'blue')
  RETURNING id INTO _r_admin;
  
  INSERT INTO role_permissions (role_id, permission_id) VALUES
  (_r_admin, _p_fin_view), (_r_admin, _p_fin_edit),
  (_r_admin, _p_crm_view), (_r_admin, _p_crm_edit),
  (_r_admin, _p_set_view), (_r_admin, _p_set_edit),
  (_r_admin, _p_team_manage);

  -- Closer
  INSERT INTO roles (workspace_id, name, description, color)
  VALUES (_workspace_id, 'Closer', 'Focado em fechamento', 'green')
  RETURNING id INTO _r_closer;
  
  INSERT INTO role_permissions (role_id, permission_id) VALUES (_r_closer, _p_crm_view), (_r_closer, _p_crm_edit);

  -- SDR
  INSERT INTO roles (workspace_id, name, description, color)
  VALUES (_workspace_id, 'SDR', 'Pré-vendas e qualificação', 'yellow')
  RETURNING id INTO _r_sdr;

  INSERT INTO role_permissions (role_id, permission_id) VALUES (_r_sdr, _p_crm_view), (_r_sdr, _p_crm_edit);

  --------------------------
  -- MEMBER CREATION
  --------------------------

  -- Insert workspace member as owner
  INSERT INTO public.workspace_members (workspace_id, user_id, role, role_id)
  VALUES (_workspace_id, _user_id, 'owner', _r_owner);

  -- Return workspace data
  SELECT json_build_object(
    'id', id,
    'name', name,
    'slug', slug,
    'created_at', created_at,
    'updated_at', updated_at
  )
  INTO _workspace
  FROM public.workspaces
  WHERE id = _workspace_id;

  RETURN _workspace;
END;
$$;
