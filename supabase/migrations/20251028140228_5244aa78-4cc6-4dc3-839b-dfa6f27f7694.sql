-- Create security definer function to check workspace ownership (avoids recursion)
CREATE OR REPLACE FUNCTION public.is_workspace_owner(_user_id uuid, _workspace_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.workspace_members
    WHERE user_id = _user_id
      AND workspace_id = _workspace_id
      AND role = 'owner'
  );
$$;

-- Create transactional RPC for workspace creation
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

  -- Insert workspace member as owner
  INSERT INTO public.workspace_members (workspace_id, user_id, role)
  VALUES (_workspace_id, _user_id, 'owner');

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

-- Drop existing problematic policies
DROP POLICY IF EXISTS "Workspace owners can manage members" ON public.workspace_members;
DROP POLICY IF EXISTS "Users can be added to workspaces" ON public.workspace_members;

-- Create proper policies for workspace_members
CREATE POLICY "Owners can update members"
ON public.workspace_members
FOR UPDATE
USING (public.is_workspace_owner(auth.uid(), workspace_id));

CREATE POLICY "Owners can delete members"
ON public.workspace_members
FOR DELETE
USING (public.is_workspace_owner(auth.uid(), workspace_id));

CREATE POLICY "Users can add themselves or owners can add others"
ON public.workspace_members
FOR INSERT
WITH CHECK (
  user_id = auth.uid() OR public.is_workspace_owner(auth.uid(), workspace_id)
);

-- Fix UPDATE policy on workspaces (correct the join condition)
DROP POLICY IF EXISTS "Owners and admins can update their workspaces" ON public.workspaces;

CREATE POLICY "Owners and admins can update their workspaces"
ON public.workspaces
FOR UPDATE
USING (
  EXISTS (
    SELECT 1
    FROM public.workspace_members
    WHERE workspace_members.workspace_id = workspaces.id
      AND workspace_members.user_id = auth.uid()
      AND workspace_members.role IN ('owner', 'admin')
  )
);

-- Add SELECT policy for creators (allows immediate read after insert)
CREATE POLICY "Creators can view their created workspaces"
ON public.workspaces
FOR SELECT
USING (created_by = auth.uid());