/**
 * KB Quality Criteria — GPM (Processos Internos de Agência)
 *
 * 4 macro categorias: Operacional, Marketing, Comercial, Financeira
 * Cada uma com tópicos e critérios específicos para SOPs de agência.
 */

export interface QualityCriterion {
  key: string;
  label: string;
  description: string;
  weight: number;
  required: boolean;
  usedBy: string[];
}

export interface CategoryCriteria {
  name: string;
  description: string;
  icon: string;
  criteria: QualityCriterion[];
}

export type CriterionStatus = "absent" | "superficial" | "complete";

export interface CategoryScore {
  category: string;
  score: number;
  criteria: Record<string, CriterionStatus>;
  missingItems: string[];
  superficialItems: string[];
}

export const QUALITY_CRITERIA: Record<string, CategoryCriteria> = {
  operacional: {
    name: "Operacional",
    description: "Processos de operação e entrega da agência",
    icon: "Settings",
    criteria: [
      {
        key: "onboarding_clientes",
        label: "Onboarding de Clientes",
        description:
          "Checklist de dados/acessos a coletar, roteiro de reunião de kickoff, setup nas plataformas, templates de boas-vindas, cronograma dos primeiros 30 dias",
        weight: 2.0,
        required: true,
        usedBy: ["operacoes", "squads"],
      },
      {
        key: "rotinas_squad",
        label: "Rotinas de Squad",
        description:
          "Estrutura de daily/weekly, pauta de reuniões, rituais do time, frequência e formato dos alinhamentos internos",
        weight: 1.5,
        required: true,
        usedBy: ["operacoes", "squads"],
      },
      {
        key: "gestao_demandas",
        label: "Gestão de Demandas e Entregas",
        description:
          "Fluxo de recebimento, priorização e entrega de demandas. SLA por tipo de tarefa. Processo de aprovação do cliente. Ferramentas utilizadas",
        weight: 2.0,
        required: true,
        usedBy: ["operacoes", "tarefas"],
      },
      {
        key: "ferramentas_acessos",
        label: "Ferramentas e Acessos Internos",
        description:
          "Lista de ferramentas da agência, como solicitar/revogar acessos, credenciais compartilhadas, procedimentos de segurança",
        weight: 1.0,
        required: false,
        usedBy: ["operacoes"],
      },
    ],
  },

  marketing: {
    name: "Marketing",
    description: "Processos de marketing e entrega criativa",
    icon: "Megaphone",
    criteria: [
      {
        key: "estrategia_marketing",
        label: "Estratégia de Marketing",
        description:
          "Planejamento de campanhas e calendário, definição de metas e KPIs, análise de mercado e concorrência, posicionamento e branding do cliente",
        weight: 2.0,
        required: true,
        usedBy: ["operacoes", "crm"],
      },
      {
        key: "trafego_pago",
        label: "Tráfego Pago",
        description:
          "Estrutura de contas e campanhas (Meta, Google, TikTok), segmentação e públicos, otimização e escala, naming conventions, rotinas de otimização",
        weight: 2.0,
        required: true,
        usedBy: ["operacoes", "relatorios"],
      },
      {
        key: "copy_ads",
        label: "Copy para Ads",
        description:
          "Frameworks de copy (AIDA, PAS, BAB), templates de headlines e CTAs, tom de voz por tipo de cliente/nicho, regras de compliance",
        weight: 2.0,
        required: true,
        usedBy: ["operacoes", "squads"],
      },
      {
        key: "copy_lp",
        label: "Copy para Landing Pages",
        description:
          "Estrutura de landing pages, blocos de copy (hero, benefícios, prova social, CTA), checklist de revisão, boas práticas de conversão",
        weight: 1.5,
        required: true,
        usedBy: ["operacoes"],
      },
      {
        key: "copy_conteudo",
        label: "Copy para Conteúdo Orgânico",
        description:
          "Roteiros para reels/stories, legendas para feed, estrutura de carrosséis, tom e linguagem por canal",
        weight: 1.5,
        required: true,
        usedBy: ["operacoes", "squads"],
      },
      {
        key: "disparos_whatsapp",
        label: "Disparos de WhatsApp",
        description:
          "Templates de mensagens, segmentação de listas, frequência de envio, réguas de automação, boas práticas anti-ban",
        weight: 1.5,
        required: true,
        usedBy: ["operacoes", "crm"],
      },
      {
        key: "social_media_design",
        label: "Social Media e Design",
        description:
          "Produção de carrosséis, conteúdo para stories, calendário editorial, padrões visuais, briefing para designer",
        weight: 1.5,
        required: true,
        usedBy: ["operacoes", "squads"],
      },
      {
        key: "relatorios_performance",
        label: "Relatórios de Performance",
        description:
          "Métricas e dashboards padrão, frequência e formato de reports, template de análise de resultados e próximos passos",
        weight: 1.0,
        required: false,
        usedBy: ["operacoes", "relatorios"],
      },
    ],
  },

  comercial: {
    name: "Comercial",
    description: "Processos de vendas e relacionamento",
    icon: "Target",
    criteria: [
      {
        key: "prospeccao_qualificacao",
        label: "Prospecção e Qualificação",
        description:
          "Processo de prospecção ativa e inbound, critérios de qualificação (ICP, scoring), canais de captação, scripts de abordagem",
        weight: 2.0,
        required: true,
        usedBy: ["crm"],
      },
      {
        key: "proposta_comercial",
        label: "Proposta Comercial",
        description:
          "Template de proposta, precificação de serviços, pacotes e combos, processo de personalização, ferramentas de envio",
        weight: 1.5,
        required: true,
        usedBy: ["crm", "contratos"],
      },
      {
        key: "followup_fechamento",
        label: "Followup e Fechamento",
        description:
          "Cadência de followup, scripts por etapa do funil, tratamento de objeções, técnicas de fechamento, SLA de resposta",
        weight: 2.0,
        required: true,
        usedBy: ["crm"],
      },
      {
        key: "pos_venda_upsell",
        label: "Pós-venda e Upsell",
        description:
          "Processo de transição venda → operações, pesquisa de satisfação, identificação de oportunidades de upsell/cross-sell, estratégia de retenção",
        weight: 1.5,
        required: true,
        usedBy: ["crm", "operacoes"],
      },
    ],
  },

  financeira: {
    name: "Financeira",
    description: "Processos financeiros e administrativos",
    icon: "Wallet",
    criteria: [
      {
        key: "faturamento_cobranca",
        label: "Faturamento e Cobrança",
        description:
          "Processo de emissão de NF, datas de faturamento por tipo de contrato, régua de cobrança, ferramentas de pagamento, processo de reajuste",
        weight: 2.0,
        required: true,
        usedBy: ["financeiro"],
      },
      {
        key: "controle_inadimplencia",
        label: "Controle de Inadimplência",
        description:
          "Identificação de atrasos, régua de comunicação (lembretes, cobranças), processo de negociação, critérios para suspensão de serviço",
        weight: 1.5,
        required: true,
        usedBy: ["financeiro"],
      },
      {
        key: "conciliacao_bancaria",
        label: "Conciliação Bancária",
        description:
          "Frequência de conciliação, processo de conferência, tratamento de divergências, ferramentas utilizadas",
        weight: 1.0,
        required: false,
        usedBy: ["financeiro"],
      },
      {
        key: "gestao_custos",
        label: "Gestão de Custos",
        description:
          "Controle de fornecedores e ferramentas, aprovação de despesas, orçamento por área, processo de renegociação de contratos",
        weight: 1.5,
        required: true,
        usedBy: ["financeiro"],
      },
    ],
  },
};

/**
 * Calculate score for a category given criterion statuses
 */
export function calculateCategoryScore(
  category: string,
  criteriaStatus: Record<string, CriterionStatus>
): number {
  const categoryDef = QUALITY_CRITERIA[category];
  if (!categoryDef) return 0;

  const statusPoints: Record<CriterionStatus, number> = {
    absent: 0,
    superficial: 0.5,
    complete: 1.0,
  };

  let weightedSum = 0;
  let totalWeight = 0;

  for (const criterion of categoryDef.criteria) {
    const status = criteriaStatus[criterion.key] ?? "absent";
    weightedSum += statusPoints[status] * criterion.weight;
    totalWeight += criterion.weight;
  }

  if (totalWeight === 0) return 0;

  return Math.round((weightedSum / totalWeight) * 10 * 10) / 10;
}

/**
 * Calculate overall KB score (average of all categories)
 */
export function calculateOverallScore(
  categoryScores: Record<string, number>
): number {
  const categories = Object.keys(QUALITY_CRITERIA);
  const scores = categories.map((cat) => categoryScores[cat] ?? 0);
  const sum = scores.reduce((a, b) => a + b, 0);
  return Math.round((sum / categories.length) * 10) / 10;
}

/**
 * Get all category keys
 */
export function getCategoryKeys(): string[] {
  return Object.keys(QUALITY_CRITERIA);
}

/**
 * Get criteria for a specific category
 */
export function getCategoryCriteria(
  category: string
): QualityCriterion[] | null {
  return QUALITY_CRITERIA[category]?.criteria ?? null;
}

/**
 * Get missing (absent) criteria for a category, sorted by weight descending
 */
export function getMissingCriteria(
  category: string,
  criteriaStatus: Record<string, CriterionStatus>
): QualityCriterion[] {
  const categoryDef = QUALITY_CRITERIA[category];
  if (!categoryDef) return [];

  return categoryDef.criteria
    .filter((c) => (criteriaStatus[c.key] ?? "absent") === "absent")
    .sort((a, b) => {
      if (a.required !== b.required) return a.required ? -1 : 1;
      return b.weight - a.weight;
    });
}

/**
 * Get the category with the lowest score (priority for agent questions)
 */
export function getLowestScoreCategory(
  categoryScores: Record<string, number>
): string {
  const categories = Object.keys(QUALITY_CRITERIA);
  let lowest = categories[0];
  let lowestScore = categoryScores[lowest] ?? 0;

  for (const cat of categories) {
    const score = categoryScores[cat] ?? 0;
    if (score < lowestScore) {
      lowest = cat;
      lowestScore = score;
    }
  }

  return lowest;
}

/**
 * Build the criteria JSON for the kb-agent-analyze prompt
 */
export function buildAnalysisPrompt(category: string): string {
  const categoryDef = QUALITY_CRITERIA[category];
  if (!categoryDef) return "";

  const criteriaList = categoryDef.criteria
    .map(
      (c) =>
        `- **${c.label}** (peso: ${c.weight}, ${c.required ? "obrigatório" : "opcional"}): ${c.description}`
    )
    .join("\n");

  return `## Categoria: ${categoryDef.name}
${categoryDef.description}

### Critérios de Avaliação:
${criteriaList}

### Instruções:
Para cada critério, avalie o conteúdo disponível e classifique como:
- "complete": informação rica, específica e utilizável
- "superficial": informação existe mas é vaga ou genérica
- "absent": nenhuma informação sobre este ponto

Retorne um JSON com o formato:
{
  "criteria": { "chave_criterio": "complete|superficial|absent", ... },
  "summary": "Resumo da avaliação em 2-3 frases"
}`;
}
