export type ClientPanelStatus = "ativo" | "pausado" | "cancelado";
export type ClientPanelErrorCategory = "comunicacao" | "entrega" | "atraso" | "qualidade" | "processo" | "outro";
export type ClientPanelEventType = "nota" | "reuniao" | "reclamacao" | "feedback" | "conquista" | "mudanca_gestor" | "outro";

export interface ClientPanelClient {
  id: string;
  workspace_id: string;
  client_name: string;
  gestor_id: string | null;
  lider_id: string | null;
  cs_id: string | null;
  expectativa: string | null;
  criativos_drive_url: string | null;
  status: ClientPanelStatus;
  joined_at: string | null;
  left_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  // Joined
  gestor?: { id: string; full_name: string; avatar_url: string | null };
  lider?: { id: string; full_name: string; avatar_url: string | null };
  cs?: { id: string; full_name: string; avatar_url: string | null };
}

export interface ClientPanelError {
  id: string;
  workspace_id: string;
  client_id: string;
  description: string;
  responsible_id: string | null;
  category: ClientPanelErrorCategory;
  occurred_at: string;
  created_by: string | null;
  created_at: string;
  // Joined
  responsible?: { id: string; full_name: string; avatar_url: string | null };
  client?: { client_name: string };
}

export interface ClientPanelDifficulty {
  id: string;
  workspace_id: string;
  client_id: string;
  description: string;
  occurred_at: string;
  created_by: string | null;
  created_at: string;
}

export interface ClientPanelTimelineEvent {
  id: string;
  workspace_id: string;
  client_id: string;
  content: string;
  event_type: ClientPanelEventType;
  occurred_at: string;
  created_by: string | null;
  created_at: string;
  // Joined
  author?: { id: string; full_name: string; avatar_url: string | null };
}

// Form types
export interface NewClientForm {
  client_name: string;
  gestor_id?: string;
  lider_id?: string;
  cs_id?: string;
  expectativa?: string;
  criativos_drive_url?: string;
  status: ClientPanelStatus;
  joined_at?: string;
  left_at?: string;
}

export interface NewErrorForm {
  client_id: string;
  description: string;
  responsible_id?: string;
  category: ClientPanelErrorCategory;
  occurred_at: string;
}

export interface NewDifficultyForm {
  client_id: string;
  description: string;
  occurred_at: string;
}

export interface NewTimelineEventForm {
  client_id: string;
  content: string;
  event_type: ClientPanelEventType;
  occurred_at: string;
}

// Config
export const CLIENT_STATUS_CONFIG: Record<ClientPanelStatus, { label: string; color: string; bgColor: string }> = {
  ativo: { label: "Ativo", color: "text-green-400", bgColor: "bg-green-500/20 border-green-500/30" },
  pausado: { label: "Pausado", color: "text-yellow-400", bgColor: "bg-yellow-500/20 border-yellow-500/30" },
  cancelado: { label: "Cancelado", color: "text-red-400", bgColor: "bg-red-500/20 border-red-500/30" },
};

export const ERROR_CATEGORY_CONFIG: Record<ClientPanelErrorCategory, { label: string; color: string }> = {
  comunicacao: { label: "Comunicacao", color: "text-blue-400" },
  entrega: { label: "Entrega", color: "text-orange-400" },
  atraso: { label: "Atraso", color: "text-red-400" },
  qualidade: { label: "Qualidade", color: "text-purple-400" },
  processo: { label: "Processo", color: "text-yellow-400" },
  outro: { label: "Outro", color: "text-gray-400" },
};

export const EVENT_TYPE_CONFIG: Record<ClientPanelEventType, { label: string; icon: string; color: string }> = {
  nota: { label: "Nota", icon: "FileText", color: "text-blue-400" },
  reuniao: { label: "Reuniao", icon: "Users", color: "text-green-400" },
  reclamacao: { label: "Reclamacao", icon: "AlertTriangle", color: "text-red-400" },
  feedback: { label: "Feedback", icon: "MessageCircle", color: "text-purple-400" },
  conquista: { label: "Conquista", icon: "Trophy", color: "text-yellow-400" },
  mudanca_gestor: { label: "Mudanca de Gestor", icon: "UserRoundPen", color: "text-orange-400" },
  outro: { label: "Outro", icon: "Circle", color: "text-gray-400" },
};
