export type RequestType = 'suggestion' | 'doubt' | 'bug' | 'auto_bug' | 'other';
export type RequestStatus = 'pending' | 'analyzing' | 'waiting_response' | 'done' | 'rejected' | 'approved' | 'developed';

export interface SystemRequest {
    id: string;
    user_id: string;
    type: RequestType;
    title: string;
    description: string;
    status: RequestStatus;
    admin_notes?: string;
    source?: 'manual' | 'auto';
    workspace_id?: string;
    error_metadata?: Record<string, any>;
    created_at: string;
    updated_at: string;
}

export interface SystemRequestAttachment {
    id: string;
    request_id: string;
    file_url: string;
    file_type: 'image' | 'video' | 'audio';
    created_at: string;
}
