export type WebRequestType = "landing_page" | "alteracao_pagina" | "formulario" | "integracao" | "correcao_bug" | "outro";
export type WebStatus = "solicitada" | "realizando" | "ajustando" | "concluida";

export interface WebRequest {
  id: string;
  workspace_id: string;
  gestor_id: string;
  title: string;
  description: string;
  request_type: WebRequestType;
  site_url: string | null;
  reference_urls: string[] | null;
  deadline: string | null;
  priority: "normal" | "urgente";
  status: WebStatus;
  gestor_suggestion: string | null;
  created_at: string;
  updated_at: string;
  gestor?: { id: string; full_name: string; email: string; avatar_url: string | null };
}

export interface WebComment {
  id: string;
  request_id: string;
  user_id: string;
  content: string;
  created_at: string;
  user?: { id: string; full_name: string; avatar_url: string | null };
}

export interface WebFile {
  id: string;
  request_id: string;
  file_url: string;
  file_name: string;
  uploaded_by: string;
  created_at: string;
  uploader?: { id: string; full_name: string };
}

export interface NewWebRequestForm {
  title: string;
  description: string;
  request_type: WebRequestType;
  site_url?: string;
  reference_urls?: string[];
  gestor_suggestion?: string;
  deadline?: string;
  priority: "normal" | "urgente";
  files?: File[];
}

export const WEB_STATUS_CONFIG: Record<WebStatus, { label: string; color: string; bgColor: string }> = {
  solicitada: { label: "Solicitada", color: "text-blue-400", bgColor: "bg-blue-500/20 border-blue-500/30" },
  realizando: { label: "Realizando", color: "text-yellow-400", bgColor: "bg-yellow-500/20 border-yellow-500/30" },
  ajustando: { label: "Ajustando", color: "text-orange-400", bgColor: "bg-orange-500/20 border-orange-500/30" },
  concluida: { label: "Concluída", color: "text-green-400", bgColor: "bg-green-500/20 border-green-500/30" },
};

export const WEB_TYPE_CONFIG: Record<WebRequestType, { label: string; color: string }> = {
  landing_page: { label: "Landing Page", color: "bg-purple-500/20 text-purple-400 border-purple-500/30" },
  alteracao_pagina: { label: "Alteração de Página", color: "bg-blue-500/20 text-blue-400 border-blue-500/30" },
  formulario: { label: "Formulário", color: "bg-cyan-500/20 text-cyan-400 border-cyan-500/30" },
  integracao: { label: "Integração", color: "bg-indigo-500/20 text-indigo-400 border-indigo-500/30" },
  correcao_bug: { label: "Correção de Bug", color: "bg-red-500/20 text-red-400 border-red-500/30" },
  outro: { label: "Outro", color: "bg-gray-500/20 text-gray-400 border-gray-500/30" },
};
