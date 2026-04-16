import { supabase } from "@/integrations/supabase/client";

export interface WorkspaceData {
  id: string;
  name: string;
  slug: string;
  created_at: string;
  updated_at: string;
}

export async function createWorkspaceAndMembership(name: string, userId: string): Promise<WorkspaceData> {
  const { data, error } = await supabase.rpc("create_workspace", {
    _name: name,
    _user_id: userId,
  });

  if (error) throw error;

  return data as unknown as WorkspaceData;
}
