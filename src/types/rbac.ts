export interface Permission {
    id: string;
    slug: string;
    description: string;
    category: string;
}

export interface Role {
    id: string;
    workspace_id: string;
    name: string;
    description: string | null;
    color: string;
    permissions: Permission[];
}

export interface WorkspaceMember {
    id: string;
    user_id: string;
    workspace_id: string;
    role: string; // Deprecated enum
    role_details?: Role; // New RBAC role
}
