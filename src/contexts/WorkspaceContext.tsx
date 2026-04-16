import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { User } from "@supabase/supabase-js";
import { createWorkspaceAndMembership } from "@/lib/workspace";
import { useToast } from "@/hooks/use-toast";

interface Permission {
  slug: string;
}

interface Role {
  id: string;
  name: string;
  color: string;
  role_permissions: { permissions: Permission }[];
}

interface Workspace {
  id: string;
  name: string;
  slug: string;
  role: string; // Keep for backward compatibility
  role_details: Role | null;
  installment_interest_rate?: number;
  pagarme_webhook_token?: string;
  has_pagarme_key?: boolean;
  crm_meeting_template?: string;
  crm_meeting_duration?: number;
}

interface WorkspaceContextType {
  workspaces: Workspace[];
  currentWorkspace: Workspace | null;
  setCurrentWorkspace: (workspace: Workspace | null) => void;
  loadWorkspaces: () => Promise<void>;
  loading: boolean;
  can: (permissionSlug: string) => boolean;
  user: User | null;
}

const WorkspaceContext = createContext<WorkspaceContextType | undefined>(undefined);

export function WorkspaceProvider({ children, user }: { children: ReactNode; user: User | null }) {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [currentWorkspace, setCurrentWorkspace] = useState<Workspace | null>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const loadWorkspaces = async () => {
    if (!user) {
      setWorkspaces([]);
      setCurrentWorkspace(null);
      setLoading(false);
      return;
    }

    try {
      const { data: memberships, error } = await supabase
        .from("workspace_members")
        .select(`
          role,
          role_id,
          workspaces (
            id,
            name,
            slug,
            installment_interest_rate,
            pagarme_webhook_token,
            crm_meeting_template,
            crm_meeting_duration
          ),
          roles (
            id,
            name,
            color,
            role_permissions (
              permissions (
                slug
              )
            )
          )
        `)
        .eq("user_id", user.id);

      if (error) throw error;

      const workspaceList: Workspace[] = memberships?.filter((m: any) => m.workspaces).map((m: any) => ({
        id: m.workspaces.id,
        name: m.workspaces.name,
        slug: m.workspaces.slug,
        installment_interest_rate: m.workspaces.installment_interest_rate,
        pagarme_webhook_token: m.workspaces.pagarme_webhook_token,
        crm_meeting_template: m.workspaces.crm_meeting_template,
        crm_meeting_duration: m.workspaces.crm_meeting_duration,
        has_pagarme_key: false, // Will be updated async if needed
        role: m.role, // Legacy enum
        role_details: m.roles ? {
          id: m.roles.id,
          name: m.roles.name,
          color: m.roles.color,
          role_permissions: m.roles.role_permissions
        } : null
      })) || [];

      setWorkspaces(workspaceList);

      // Set current workspace from localStorage or first available
      const savedWorkspaceId = localStorage.getItem("currentWorkspaceId");
      const savedWorkspace = workspaceList.find((w) => w.id === savedWorkspaceId);

      if (savedWorkspace) {
        setCurrentWorkspace(savedWorkspace);
      } else if (workspaceList.length > 0) {
        setCurrentWorkspace(workspaceList[0]);
        localStorage.setItem("currentWorkspaceId", workspaceList[0].id);
      }
    } catch (error) {
      console.error("Error loading workspaces:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const provisionWorkspace = async () => {
      await loadWorkspaces();

      // Auto-provision workspace if needed
      if (user && workspaces.length === 0) {
        const pendingName = localStorage.getItem("pendingWorkspaceName");
        const attempted = localStorage.getItem("pendingWorkspaceAttempted");

        if (pendingName && !attempted) {
          localStorage.setItem("pendingWorkspaceAttempted", "true");

          try {
            const workspace = await createWorkspaceAndMembership(pendingName, user.id);
            localStorage.removeItem("pendingWorkspaceName");
            localStorage.removeItem("pendingWorkspaceAttempted");

            // Reload workspaces and select the new one
            await loadWorkspaces();

            toast({
              title: "Workspace criado!",
              description: `Seu workspace "${workspace.name}" foi configurado com sucesso.`,
            });
          } catch (error: any) {
            console.error("Error auto-provisioning workspace:", error);
            localStorage.removeItem("pendingWorkspaceAttempted");

            toast({
              variant: "destructive",
              title: "Erro ao criar workspace",
              description: "Você pode criar um workspace manualmente no dashboard.",
            });
          }
        }
      }
    };

    provisionWorkspace();
  }, [user]);

  useEffect(() => {
    if (currentWorkspace) {
      localStorage.setItem("currentWorkspaceId", currentWorkspace.id);
    }
  }, [currentWorkspace]);

  // Permission check function
  const can = useCallback((permissionSlug: string) => {
    if (!currentWorkspace?.role_details) {
      // Fallback to legacy specific logic or deny
      // For now, if no RBAC role, rely on legacy 'owner' check or deny
      if (currentWorkspace?.role === 'owner') return true;
      return false;
    }

    // Owner role usually has all permissions, but explicit check is better.
    // However, if we migrated correctly, Owner role has all permissions.

    return currentWorkspace.role_details.role_permissions?.filter(rp => rp && rp.permissions).some(
      (rp) => rp.permissions.slug === permissionSlug
    ) || false;
  }, [currentWorkspace]);

  return (
    <WorkspaceContext.Provider
      value={{
        workspaces,
        currentWorkspace,
        setCurrentWorkspace,
        loadWorkspaces,
        loading,
        can,
        user,
      }}
    >
      {children}
    </WorkspaceContext.Provider>
  );
}

export function useWorkspace() {
  const context = useContext(WorkspaceContext);
  if (context === undefined) {
    throw new Error("useWorkspace must be used within a WorkspaceProvider");
  }
  return context;
}
