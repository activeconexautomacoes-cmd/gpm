
export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent';
export type TaskStatus = 'backlog' | 'todo' | 'in_progress' | 'review' | 'done';
export type TaskType = 'traffic' | 'design' | 'copy' | 'strategy' | 'other';
export type SquadRole = 'member' | 'leader';

export interface Squad {
    id: string;
    workspace_id: string;
    name: string;
    color: string;
    leader_id?: string;
    created_at: string;
    updated_at: string;
}

export interface SquadMember {
    id: string;
    squad_id: string;
    user_id: string;
    role: SquadRole;
    created_at: string;
    // Joins
    profiles?: {
        id: string;
        full_name: string;
        avatar_url: string;
        email: string;
    };
}

export interface Task {
    id: string;
    workspace_id: string;
    client_id: string;
    squad_id?: string;
    title: string;
    description?: string;
    status: TaskStatus;
    priority: TaskPriority;
    type: TaskType;
    assignee_id?: string;
    reporter_id?: string;
    due_date?: string;
    parent_task_id?: string;
    contract_id?: string;
    created_at: string;
    updated_at: string;
    // Joins
    clients?: {
        id: string;
        name: string;
    };
    squads?: {
        id: string;
        name: string;
        color: string;
    };
    assignee?: {
        id: string;
        full_name: string;
        avatar_url: string;
    };
    reporter?: {
        id: string;
        full_name: string;
        avatar_url: string;
    };
    contracts?: {
        id: string;
        name: string;
    };
}

export interface TaskComment {
    id: string;
    task_id: string;
    user_id: string;
    content: string;
    created_at: string;
    updated_at: string;
    // Joins
    profiles?: {
        id: string;
        full_name: string;
        avatar_url: string;
    };
}

export interface ClientPerformanceMetric {
    id: string;
    workspace_id: string;
    client_id: string;
    period_start: string;
    period_end: string;
    spend: number;
    revenue: number;
    roas: number;
    leads: number;
    cpl: number;
    clicks: number;
    ctr: number;
    impressions: number;
    created_at: string;
    updated_at: string;
}

export interface ClientAsset {
    id: string;
    workspace_id: string;
    client_id: string;
    contract_id?: string;
    name: string;
    file_path: string;
    file_type: string;
    size: number;
    created_at: string;
    created_by?: string;
    // Joins
    profiles?: {
        full_name: string;
        avatar_url: string;
    };
}
