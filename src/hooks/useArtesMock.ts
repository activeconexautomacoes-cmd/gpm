import { useState, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import type {
  ArtFormat,
  ArtRequest,
  ArtComment,
  ArtFile,
  ArtStatus,
  NewArtRequestForm,
  ArtBrief,
} from "@/types/artes";

// ─── Mock Data ────────────────────────────────────────────

const MOCK_FORMATS: ArtFormat[] = [
  { id: "fmt-1", workspace_id: "ws-1", name: "Feed", width: 1080, height: 1080, active: true, created_by: null, created_at: "2026-03-01" },
  { id: "fmt-2", workspace_id: "ws-1", name: "Story", width: 1080, height: 1920, active: true, created_by: null, created_at: "2026-03-01" },
  { id: "fmt-3", workspace_id: "ws-1", name: "Banner", width: 1200, height: 628, active: true, created_by: null, created_at: "2026-03-01" },
  { id: "fmt-4", workspace_id: "ws-1", name: "Capa Facebook", width: 820, height: 312, active: true, created_by: null, created_at: "2026-03-01" },
  { id: "fmt-5", workspace_id: "ws-1", name: "Post Carrossel", width: 1080, height: 1350, active: true, created_by: null, created_at: "2026-03-01" },
  { id: "fmt-6", workspace_id: "ws-1", name: "Thumbnail YouTube", width: 1280, height: 720, active: true, created_by: null, created_at: "2026-03-01" },
];

const MOCK_BRIEF: ArtBrief = {
  conceito_visual: "Arte promocional moderna e vibrante para e-commerce de moda. O design utiliza a identidade visual do site com adaptações para destacar a oferta de 20% OFF. A composição é limpa, com foco no produto e no desconto, usando cores que remetem à marca e criam urgência na compra.",
  paleta_cores: [
    { hex: "#FF5733", nome: "Laranja Vibrante", uso: "CTA e badges de desconto" },
    { hex: "#1A1A2E", nome: "Azul Escuro", uso: "Fundo principal e textos" },
    { hex: "#E94560", nome: "Rosa Intenso", uso: "Destaque e acentos" },
    { hex: "#FFFFFF", nome: "Branco Puro", uso: "Textos sobre fundo escuro" },
    { hex: "#0F3460", nome: "Azul Royal", uso: "Elementos secundários" },
  ],
  tipografia: {
    titulo: "Sans-serif bold (Montserrat ou similar), caixa alta, tamanho dominante ocupando 30% da arte. Peso 800. Cor branca sobre fundo escuro.",
    subtitulo: "Mesma família, peso 500, 60% do tamanho do título. Cor branca com opacidade 90%.",
    corpo: "Sans-serif regular (Open Sans ou similar), peso 400, alta legibilidade. Tamanho 14-16px equivalente.",
  },
  layout: {
    formato: "Feed 1080x1080",
    grid: "Composição em terços: produto central ocupando 40% da área, headline no terço superior, CTA no terço inferior. Margem segura de 60px em todas as bordas.",
    elementos: [
      { nome: "Logo da Marca", posicao: "Topo esquerdo, 60px de margem", tamanho: "120x40px" },
      { nome: "Imagem do Produto", posicao: "Centro, levemente acima do meio", tamanho: "500x500px" },
      { nome: "Badge de Desconto", posicao: "Topo direito, sobrepondo produto", tamanho: "150x150px circular" },
      { nome: "Headline", posicao: "Abaixo do produto, centralizado", tamanho: "Largura total menos margens" },
      { nome: "CTA Button", posicao: "Inferior centro, 80px da borda", tamanho: "300x60px" },
    ],
  },
  elementos_visuais: "Gradiente radial sutil do centro (azul escuro para azul royal). Sombra drop shadow no produto para profundidade (10px blur, 30% opacidade). Badge de desconto com borda 3px branca e fundo laranja vibrante. Textura sutil de pattern geométrico no fundo com 5% de opacidade.",
  textos: {
    headline: "ATÉ 20% OFF",
    subtitulo: "Em todos os produtos da coleção",
    cta: "COMPRE AGORA",
    legal: "Promoção válida até 30/04. Consulte condições.",
  },
  passo_a_passo: [
    "Criar canvas 1080x1080px com fundo #1A1A2E",
    "Aplicar gradiente radial sutil do centro: #0F3460 para #1A1A2E",
    "Adicionar textura geométrica sutil no fundo (opacidade 5%)",
    "Posicionar logo da marca no topo esquerdo com 60px de margem",
    "Inserir imagem do produto centralizada, levemente acima do meio (500x500px)",
    "Aplicar drop shadow no produto: offset-y 10px, blur 20px, cor #000 30%",
    "Criar badge circular de desconto (150x150px) no topo direito sobrepondo o produto",
    "Preencher badge com #FF5733, borda 3px #FFFFFF, texto '20% OFF' em bold branco",
    "Adicionar headline 'ATÉ 20% OFF' centralizado abaixo do produto, font-size 48px, bold, branco",
    "Adicionar subtítulo abaixo: font-size 24px, peso 500, branco 90% opacidade",
    "Criar botão CTA: 300x60px, fundo #E94560, border-radius 30px, texto 'COMPRE AGORA' em bold branco",
    "Posicionar CTA centralizado na parte inferior, 80px da borda",
    "Adicionar texto legal no rodapé: font-size 10px, branco 60% opacidade",
    "Revisar alinhamentos, espaçamentos e hierarquia visual",
  ],
  referencias_estilo: "Tom moderno e premium, inspiração em grandes e-commerces como Zara e Nike. Visual limpo mas impactante, com foco na oferta e no produto. Estética dark mode elegante que transmite sofisticação.",
  observacoes: "Manter consistência com a identidade visual do site. Priorizar legibilidade em dispositivos móveis. O badge de desconto deve ser o primeiro elemento que chama atenção. Garantir contraste mínimo WCAG AA em todos os textos.",
};

const MOCK_DESIGNERS = [
  { id: "user-1", full_name: "Designer Teste", email: "designer@teste.com", avatar_url: null },
  { id: "user-2", full_name: "Ana Designer", email: "ana@teste.com", avatar_url: null },
  { id: "user-3", full_name: "Carlos Arte", email: "carlos@teste.com", avatar_url: null },
];

// In-memory store for mock data
let mockRequests: ArtRequest[] = [
  {
    id: "req-demo-1",
    workspace_id: "ws-1",
    gestor_id: "current-user",
    designer_id: "user-1",
    site_url: "https://www.nike.com.br",
    promotion: "30% OFF em tênis selecionados",
    additional_text: "Focar nos modelos Air Max",
    deadline: "2026-04-15",
    priority: "urgente",
    status: "realizando",
    created_at: "2026-03-28T10:00:00Z",
    updated_at: "2026-03-29T14:00:00Z",
    gestor: { id: "current-user", full_name: "Marcelo Gestor", email: "marcelo@teste.com", avatar_url: null },
    designer: { id: "user-1", full_name: "Designer Teste", email: "designer@teste.com", avatar_url: null },
    formats: [
      { id: "rf-1", request_id: "req-demo-1", format_id: "fmt-1", ai_brief: MOCK_BRIEF, created_at: "2026-03-28", format: MOCK_FORMATS[0] },
      { id: "rf-2", request_id: "req-demo-1", format_id: "fmt-2", ai_brief: { ...MOCK_BRIEF, layout: { ...MOCK_BRIEF.layout, formato: "Story 1080x1920" } }, created_at: "2026-03-28", format: MOCK_FORMATS[1] },
    ],
  },
  {
    id: "req-demo-2",
    workspace_id: "ws-1",
    gestor_id: "current-user",
    designer_id: "user-2",
    site_url: "https://www.magazineluiza.com.br",
    promotion: "Frete Grátis em eletrônicos",
    additional_text: null,
    deadline: null,
    priority: "normal",
    status: "solicitada",
    created_at: "2026-04-01T08:00:00Z",
    updated_at: "2026-04-01T08:00:00Z",
    gestor: { id: "current-user", full_name: "Marcelo Gestor", email: "marcelo@teste.com", avatar_url: null },
    designer: { id: "user-2", full_name: "Ana Designer", email: "ana@teste.com", avatar_url: null },
    formats: [
      { id: "rf-3", request_id: "req-demo-2", format_id: "fmt-1", ai_brief: MOCK_BRIEF, created_at: "2026-04-01", format: MOCK_FORMATS[0] },
    ],
  },
  {
    id: "req-demo-3",
    workspace_id: "ws-1",
    gestor_id: "current-user",
    designer_id: "user-1",
    site_url: "https://www.amazon.com.br",
    promotion: "Black Friday antecipada - até 50% OFF",
    additional_text: "Usar cores mais escuras, tema premium",
    deadline: "2026-04-10",
    priority: "urgente",
    status: "aprovacao",
    created_at: "2026-03-25T09:00:00Z",
    updated_at: "2026-04-01T16:00:00Z",
    gestor: { id: "current-user", full_name: "Marcelo Gestor", email: "marcelo@teste.com", avatar_url: null },
    designer: { id: "user-1", full_name: "Designer Teste", email: "designer@teste.com", avatar_url: null },
    formats: [
      { id: "rf-4", request_id: "req-demo-3", format_id: "fmt-1", ai_brief: MOCK_BRIEF, created_at: "2026-03-25", format: MOCK_FORMATS[0] },
      { id: "rf-5", request_id: "req-demo-3", format_id: "fmt-3", ai_brief: { ...MOCK_BRIEF, layout: { ...MOCK_BRIEF.layout, formato: "Banner 1200x628" } }, created_at: "2026-03-25", format: MOCK_FORMATS[2] },
      { id: "rf-6", request_id: "req-demo-3", format_id: "fmt-6", ai_brief: { ...MOCK_BRIEF, layout: { ...MOCK_BRIEF.layout, formato: "Thumbnail YouTube 1280x720" } }, created_at: "2026-03-25", format: MOCK_FORMATS[5] },
    ],
  },
  {
    id: "req-demo-4",
    workspace_id: "ws-1",
    gestor_id: "current-user",
    designer_id: "user-3",
    site_url: "https://www.mercadolivre.com.br",
    promotion: "Cupom de R$50 na primeira compra",
    additional_text: null,
    deadline: "2026-04-20",
    priority: "normal",
    status: "concluida",
    created_at: "2026-03-15T11:00:00Z",
    updated_at: "2026-03-22T17:00:00Z",
    gestor: { id: "current-user", full_name: "Marcelo Gestor", email: "marcelo@teste.com", avatar_url: null },
    designer: { id: "user-3", full_name: "Carlos Arte", email: "carlos@teste.com", avatar_url: null },
    formats: [
      { id: "rf-7", request_id: "req-demo-4", format_id: "fmt-2", ai_brief: MOCK_BRIEF, created_at: "2026-03-15", format: MOCK_FORMATS[1] },
    ],
  },
  {
    id: "req-demo-5",
    workspace_id: "ws-1",
    gestor_id: "current-user",
    designer_id: "user-2",
    site_url: "https://www.shopee.com.br",
    promotion: "Moedas Shopee em dobro",
    additional_text: "Seguir cores laranja da marca",
    deadline: null,
    priority: "normal",
    status: "ajustando",
    created_at: "2026-03-20T14:00:00Z",
    updated_at: "2026-04-01T10:00:00Z",
    gestor: { id: "current-user", full_name: "Marcelo Gestor", email: "marcelo@teste.com", avatar_url: null },
    designer: { id: "user-2", full_name: "Ana Designer", email: "ana@teste.com", avatar_url: null },
    formats: [
      { id: "rf-8", request_id: "req-demo-5", format_id: "fmt-1", ai_brief: MOCK_BRIEF, created_at: "2026-03-20", format: MOCK_FORMATS[0] },
      { id: "rf-9", request_id: "req-demo-5", format_id: "fmt-5", ai_brief: { ...MOCK_BRIEF, layout: { ...MOCK_BRIEF.layout, formato: "Post Carrossel 1080x1350" } }, created_at: "2026-03-20", format: MOCK_FORMATS[4] },
    ],
  },
];

let mockComments: ArtComment[] = [
  {
    id: "com-1",
    request_id: "req-demo-1",
    user_id: "current-user",
    content: "Preciso dessa arte até sexta, pode priorizar?",
    created_at: "2026-03-28T10:30:00Z",
    user: { id: "current-user", full_name: "Marcelo Gestor", avatar_url: null },
  },
  {
    id: "com-2",
    request_id: "req-demo-1",
    user_id: "user-1",
    content: "Já estou trabalhando nela! Fico pronto amanhã.",
    created_at: "2026-03-28T11:00:00Z",
    user: { id: "user-1", full_name: "Designer Teste", avatar_url: null },
  },
  {
    id: "com-3",
    request_id: "req-demo-5",
    user_id: "current-user",
    content: "O laranja ficou muito forte, pode suavizar um pouco?",
    created_at: "2026-04-01T10:00:00Z",
    user: { id: "current-user", full_name: "Marcelo Gestor", avatar_url: null },
  },
];

let mockFiles: ArtFile[] = [
  {
    id: "file-1",
    request_id: "req-demo-1",
    format_id: "fmt-1",
    file_url: "https://placehold.co/1080x1080/1A1A2E/FFFFFF?text=Feed+Nike+30%25+OFF",
    file_name: "nike-feed-v1.png",
    version: 1,
    uploaded_by: "user-1",
    created_at: "2026-03-29T14:00:00Z",
    uploader: { id: "user-1", full_name: "Designer Teste" },
  },
  {
    id: "file-2",
    request_id: "req-demo-3",
    format_id: "fmt-1",
    file_url: "https://placehold.co/1080x1080/1A1A2E/E94560?text=Amazon+Black+Friday",
    file_name: "amazon-feed-v1.png",
    version: 1,
    uploaded_by: "user-1",
    created_at: "2026-04-01T15:00:00Z",
    uploader: { id: "user-1", full_name: "Designer Teste" },
  },
];

let nextId = 100;
const genId = () => `mock-${nextId++}`;

// ─── DEMO MODE FLAG ───────────────────────────────────────
export const DEMO_MODE = true;

// ─── Mock Hooks ───────────────────────────────────────────

export function useArtFormats() {
  return useQuery({
    queryKey: ["art-formats-mock"],
    queryFn: async () => MOCK_FORMATS,
  });
}

export function useCreateArtFormat() {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (format: { name: string; width: number; height: number }) => {
      const newFormat: ArtFormat = {
        id: genId(),
        workspace_id: "ws-1",
        ...format,
        active: true,
        created_by: null,
        created_at: new Date().toISOString(),
      };
      MOCK_FORMATS.push(newFormat);
      return newFormat;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["art-formats-mock"] });
      toast({ title: "Formato criado com sucesso" });
    },
  });
}

export function useUpdateArtFormat() {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async ({ id, ...updates }: { id: string; name?: string; width?: number; height?: number; active?: boolean }) => {
      const fmt = MOCK_FORMATS.find((f) => f.id === id);
      if (fmt) Object.assign(fmt, updates);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["art-formats-mock"] });
      toast({ title: "Formato atualizado" });
    },
  });
}

export function useArtRequests() {
  return useQuery({
    queryKey: ["art-requests-mock"],
    queryFn: async () => [...mockRequests],
    refetchInterval: 30000,
  });
}

export function useArtRequest(id: string) {
  return useQuery({
    queryKey: ["art-request-mock", id],
    queryFn: async () => {
      const req = mockRequests.find((r) => r.id === id);
      if (!req) throw new Error("Not found");
      return { ...req };
    },
    enabled: !!id,
  });
}

export function useCreateArtRequest() {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (form: NewArtRequestForm): Promise<ArtRequest> => {
      // Simulate AI loading
      await new Promise((r) => setTimeout(r, 3000));

      const id = genId();
      const designer = MOCK_DESIGNERS.find((d) => d.id === form.designer_id) || MOCK_DESIGNERS[0];
      const formats = form.format_ids.map((fid) => {
        const fmt = MOCK_FORMATS.find((f) => f.id === fid);
        return {
          id: genId(),
          request_id: id,
          format_id: fid,
          ai_brief: { ...MOCK_BRIEF, layout: { ...MOCK_BRIEF.layout, formato: fmt ? `${fmt.name} ${fmt.width}x${fmt.height}` : "Feed 1080x1080" } },
          created_at: new Date().toISOString(),
          format: fmt || MOCK_FORMATS[0],
        };
      });

      const newReq: ArtRequest = {
        id,
        workspace_id: "ws-1",
        gestor_id: "current-user",
        designer_id: form.designer_id,
        site_url: form.site_url,
        promotion: form.promotion,
        additional_text: form.additional_text || null,
        deadline: form.deadline || null,
        priority: form.priority,
        status: "solicitada",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        gestor: { id: "current-user", full_name: "Marcelo Gestor", email: "marcelo@teste.com", avatar_url: null },
        designer: { id: designer.id, full_name: designer.full_name, email: designer.email, avatar_url: null },
        formats,
      };

      mockRequests.unshift(newReq);
      return newReq;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["art-requests-mock"] });
      toast({ title: "Solicitação criada com sucesso!" });
    },
    onError: (e: Error) => toast({ variant: "destructive", title: "Erro", description: e.message }),
  });
}

export function useUpdateArtRequestStatus() {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: ArtStatus }) => {
      const req = mockRequests.find((r) => r.id === id);
      if (req) {
        req.status = status;
        req.updated_at = new Date().toISOString();
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["art-requests-mock"] });
      qc.invalidateQueries({ queryKey: ["art-request-mock"] });
      toast({ title: "Status atualizado" });
    },
  });
}

export function useRegenerateBrief() {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async ({ requestId }: { requestId: string; siteUrl: string; promotion: string; formats: any[]; additionalText: string }) => {
      await new Promise((r) => setTimeout(r, 2000));
      return { success: true };
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["art-request-mock"] });
      toast({ title: "Brief regenerado com sucesso" });
    },
  });
}

export function useArtComments(requestId: string) {
  return useQuery({
    queryKey: ["art-comments-mock", requestId],
    queryFn: async () => mockComments.filter((c) => c.request_id === requestId),
    enabled: !!requestId,
  });
}

export function useCreateArtComment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ request_id, content }: { request_id: string; content: string }) => {
      mockComments.push({
        id: genId(),
        request_id,
        user_id: "current-user",
        content,
        created_at: new Date().toISOString(),
        user: { id: "current-user", full_name: "Marcelo Gestor", avatar_url: null },
      });
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["art-comments-mock", vars.request_id] });
    },
  });
}

export function useArtFiles(requestId: string) {
  return useQuery({
    queryKey: ["art-files-mock", requestId],
    queryFn: async () => mockFiles.filter((f) => f.request_id === requestId),
    enabled: !!requestId,
  });
}

export function useUploadArtFile() {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async ({ requestId, formatId, file }: { requestId: string; formatId?: string; file: File }) => {
      const url = URL.createObjectURL(file);
      mockFiles.push({
        id: genId(),
        request_id: requestId,
        format_id: formatId || null,
        file_url: url,
        file_name: file.name,
        version: 1,
        uploaded_by: "current-user",
        created_at: new Date().toISOString(),
        uploader: { id: "current-user", full_name: "Marcelo Gestor" },
      });
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["art-files-mock", vars.requestId] });
      toast({ title: "Arquivo enviado com sucesso" });
    },
  });
}

export function useDesigners() {
  return useQuery({
    queryKey: ["art-designers-mock"],
    queryFn: async () => MOCK_DESIGNERS,
  });
}

export function useArtMetrics() {
  return useQuery({
    queryKey: ["art-metrics-mock"],
    queryFn: async () => ({
      total: mockRequests.length,
      byStatus: {
        solicitada: mockRequests.filter((r) => r.status === "solicitada").length,
        realizando: mockRequests.filter((r) => r.status === "realizando").length,
        ajustando: mockRequests.filter((r) => r.status === "ajustando").length,
        aprovacao: mockRequests.filter((r) => r.status === "aprovacao").length,
        concluida: mockRequests.filter((r) => r.status === "concluida").length,
      },
      byMonth: { "2026-01": 3, "2026-02": 5, "2026-03": 8, "2026-04": 2 },
      byDesigner: { "user-1": 4, "user-2": 3, "user-3": 1 },
      byGestor: { "current-user": 5 },
      avgDays: 5,
    }),
  });
}
