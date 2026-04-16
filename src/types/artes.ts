export type ArtPriority = "normal" | "urgente";
export type ArtStatus = "solicitada" | "realizando" | "ajustando" | "aprovacao" | "concluida";

export interface ArtFormat {
  id: string;
  workspace_id: string;
  name: string;
  width: number;
  height: number;
  active: boolean;
  created_by: string | null;
  created_at: string;
}

export interface ArtRequest {
  id: string;
  workspace_id: string;
  gestor_id: string;
  designer_id: string;
  site_url: string;
  promotion: string;
  additional_text: string | null;
  deadline: string | null;
  priority: ArtPriority;
  status: ArtStatus;
  created_at: string;
  updated_at: string;
  // Joined fields
  gestor?: { id: string; full_name: string; email: string; avatar_url: string | null };
  designer?: { id: string; full_name: string; email: string; avatar_url: string | null };
  formats?: ArtRequestFormat[];
}

export interface ArtRequestFormat {
  id: string;
  request_id: string;
  format_id: string;
  ai_brief: ArtBrief | null;
  created_at: string;
  // Joined
  format?: ArtFormat;
}

export interface ArtComment {
  id: string;
  request_id: string;
  user_id: string;
  content: string;
  created_at: string;
  // Joined
  user?: { id: string; full_name: string; avatar_url: string | null };
}

export interface ArtFile {
  id: string;
  request_id: string;
  format_id: string | null;
  file_url: string;
  file_name: string;
  version: number;
  uploaded_by: string;
  created_at: string;
  // Joined
  uploader?: { id: string; full_name: string };
}

export interface ArtHistory {
  id: string;
  request_id: string;
  site_url: string;
  promotion: string;
  format_name: string;
  format_width: number;
  format_height: number;
  ai_brief: ArtBrief | null;
  final_file_url: string | null;
  approved_at: string;
  approved_by: string | null;
}

export interface SiteBrand {
  id: string;
  site_url: string;
  brand_data: Record<string, unknown>;
  scraped_at: string;
  updated_at: string;
}

// AI Brief structure
export interface ArtBriefColor {
  hex: string;
  nome: string;
  uso: string;
}

export interface ArtBriefLayoutElement {
  nome: string;
  posicao: string;
  tamanho: string;
}

export interface ArtBrief {
  conceito_visual: string;
  paleta_cores: ArtBriefColor[];
  tipografia: {
    titulo: string;
    subtitulo: string;
    corpo: string;
  };
  layout: {
    formato: string;
    grid: string;
    elementos: ArtBriefLayoutElement[];
  };
  elementos_visuais: string;
  textos: {
    headline: string;
    subtitulo: string;
    cta: string;
    legal: string;
  };
  passo_a_passo: string[];
  referencias_estilo: string;
  observacoes: string;
}

// Form types
export interface NewArtRequestForm {
  site_url: string;
  promotion: string;
  format_ids: string[];
  designer_id: string;
  additional_text?: string;
  deadline?: string;
  priority: ArtPriority;
}

// Status configuration
export const ART_STATUS_CONFIG: Record<ArtStatus, { label: string; color: string; bgColor: string }> = {
  solicitada: { label: "Solicitada", color: "text-blue-400", bgColor: "bg-blue-500/20 border-blue-500/30" },
  realizando: { label: "Realizando", color: "text-yellow-400", bgColor: "bg-yellow-500/20 border-yellow-500/30" },
  ajustando: { label: "Ajustando", color: "text-orange-400", bgColor: "bg-orange-500/20 border-orange-500/30" },
  aprovacao: { label: "Aprovação", color: "text-purple-400", bgColor: "bg-purple-500/20 border-purple-500/30" },
  concluida: { label: "Concluída", color: "text-green-400", bgColor: "bg-green-500/20 border-green-500/30" },
};

// Allowed status transitions for designer drag-and-drop
export const ALLOWED_TRANSITIONS: Record<ArtStatus, ArtStatus[]> = {
  solicitada: ["realizando"],
  realizando: ["aprovacao"],
  ajustando: ["aprovacao"],
  aprovacao: [],
  concluida: [],
};
