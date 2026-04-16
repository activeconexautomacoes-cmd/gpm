import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import {
  corsHeaders,
  jsonResponse,
  errorResponse,
  corsPreflightResponse,
} from "../_shared/cors.ts";

/**
 * KB Agent Analyze — Avaliador de Qualidade (GPM)
 *
 * Busca chunks por categoria, avalia contra critérios de qualidade via Claude,
 * upsert em kb_quality_scores, e recalcula overall_score na conversa.
 */

const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";

// Quality criteria — GPM (processos internos de agência)
const QUALITY_CRITERIA: Record<
  string,
  {
    name: string;
    criteria: Array<{
      key: string;
      label: string;
      description: string;
      weight: number;
      required: boolean;
    }>;
  }
> = {
  operacional: {
    name: "Operacional",
    criteria: [
      { key: "onboarding_clientes", label: "Onboarding de Clientes", description: "Checklist de dados/acessos, kickoff, setup plataformas, boas-vindas, cronograma primeiros 30 dias", weight: 2.0, required: true },
      { key: "rotinas_squad", label: "Rotinas de Squad", description: "Daily/weekly, pauta de reuniões, rituais do time, alinhamentos internos", weight: 1.5, required: true },
      { key: "gestao_demandas", label: "Gestão de Demandas e Entregas", description: "Fluxo de recebimento, priorização e entrega. SLA por tipo de tarefa. Aprovação do cliente. Ferramentas", weight: 2.0, required: true },
      { key: "ferramentas_acessos", label: "Ferramentas e Acessos Internos", description: "Lista de ferramentas, como solicitar/revogar acessos, procedimentos de segurança", weight: 1.0, required: false },
    ],
  },
  marketing: {
    name: "Marketing",
    criteria: [
      { key: "estrategia_marketing", label: "Estratégia de Marketing", description: "Planejamento de campanhas, calendário, metas e KPIs, análise de mercado, posicionamento", weight: 2.0, required: true },
      { key: "trafego_pago", label: "Tráfego Pago", description: "Estrutura de contas/campanhas, segmentação, otimização, naming conventions, rotinas", weight: 2.0, required: true },
      { key: "copy_ads", label: "Copy para Ads", description: "Frameworks (AIDA, PAS, BAB), templates de headlines/CTAs, tom de voz, compliance", weight: 2.0, required: true },
      { key: "copy_lp", label: "Copy para Landing Pages", description: "Estrutura de LP, blocos de copy, checklist de revisão, boas práticas de conversão", weight: 1.5, required: true },
      { key: "copy_conteudo", label: "Copy para Conteúdo Orgânico", description: "Roteiros reels/stories, legendas feed, carrosséis, tom por canal", weight: 1.5, required: true },
      { key: "disparos_whatsapp", label: "Disparos de WhatsApp", description: "Templates, segmentação, frequência, réguas de automação, boas práticas", weight: 1.5, required: true },
      { key: "social_media_design", label: "Social Media e Design", description: "Produção de carrosséis, stories, calendário editorial, padrões visuais, briefing designer", weight: 1.5, required: true },
      { key: "relatorios_performance", label: "Relatórios de Performance", description: "Métricas e dashboards, frequência e formato de reports, template de análise", weight: 1.0, required: false },
    ],
  },
  comercial: {
    name: "Comercial",
    criteria: [
      { key: "prospeccao_qualificacao", label: "Prospecção e Qualificação", description: "Prospecção ativa/inbound, critérios ICP, scoring, canais de captação, scripts", weight: 2.0, required: true },
      { key: "proposta_comercial", label: "Proposta Comercial", description: "Template, precificação, pacotes/combos, personalização, ferramentas de envio", weight: 1.5, required: true },
      { key: "followup_fechamento", label: "Followup e Fechamento", description: "Cadência, scripts por etapa do funil, objeções, técnicas de fechamento, SLA", weight: 2.0, required: true },
      { key: "pos_venda_upsell", label: "Pós-venda e Upsell", description: "Transição venda→operações, satisfação, upsell/cross-sell, retenção", weight: 1.5, required: true },
    ],
  },
  financeira: {
    name: "Financeira",
    criteria: [
      { key: "faturamento_cobranca", label: "Faturamento e Cobrança", description: "Emissão de NF, datas de faturamento, régua de cobrança, ferramentas de pagamento, reajuste", weight: 2.0, required: true },
      { key: "controle_inadimplencia", label: "Controle de Inadimplência", description: "Identificação de atrasos, régua de comunicação, negociação, critérios de suspensão", weight: 1.5, required: true },
      { key: "conciliacao_bancaria", label: "Conciliação Bancária", description: "Frequência, processo de conferência, divergências, ferramentas", weight: 1.0, required: false },
      { key: "gestao_custos", label: "Gestão de Custos", description: "Fornecedores/ferramentas, aprovação de despesas, orçamento por área, renegociação", weight: 1.5, required: true },
    ],
  },
};

interface AnalyzeRequest {
  workspace_id: string;
  categories?: string[];
  conversation_id?: string;
}

interface CriterionResult {
  status: "absent" | "superficial" | "complete";
}

function calculateCategoryScore(
  criteria: Array<{ key: string; weight: number }>,
  results: Record<string, CriterionResult>
): number {
  const statusPoints = { absent: 0, superficial: 0.5, complete: 1.0 };
  let weightedSum = 0;
  let totalWeight = 0;

  for (const criterion of criteria) {
    const status = results[criterion.key]?.status ?? "absent";
    weightedSum += statusPoints[status] * criterion.weight;
    totalWeight += criterion.weight;
  }

  if (totalWeight === 0) return 0;
  return Math.round((weightedSum / totalWeight) * 10 * 10) / 10;
}

async function analyzeCategory(
  supabase: ReturnType<typeof createClient>,
  anthropicKey: string,
  workspaceId: string,
  category: string
): Promise<{
  score: number;
  criteria: Record<string, string>;
  missing: string[];
  superficial: string[];
  summary: string;
}> {
  const categoryDef = QUALITY_CRITERIA[category];
  if (!categoryDef) {
    return { score: 0, criteria: {}, missing: [], superficial: [], summary: "Categoria não encontrada" };
  }

  // Fetch chunks for this category
  let allContent = "";

  const { data: chunks } = await supabase
    .from("kb_chunks")
    .select("content, category, chunk_type")
    .eq("workspace_id", workspaceId)
    .eq("category", category)
    .eq("chunk_type", "content")
    .order("created_at", { ascending: false })
    .limit(50);

  if (chunks?.length) {
    allContent = chunks.map((c: { content: string }) => c.content).join("\n\n---\n\n");
  }

  // Also fetch chunks tagged with kb_type matching this category
  const { data: kbTypeChunks } = await supabase
    .from("kb_documents")
    .select("id")
    .eq("workspace_id", workspaceId)
    .eq("kb_type", category);

  if (kbTypeChunks?.length) {
    const docIds = kbTypeChunks.map((d: { id: string }) => d.id);
    const { data: extraChunks } = await supabase
      .from("kb_chunks")
      .select("content")
      .in("document_id", docIds)
      .eq("chunk_type", "content")
      .limit(30);

    if (extraChunks?.length) {
      const extraContent = extraChunks.map((c: { content: string }) => c.content).join("\n\n---\n\n");
      allContent = allContent ? `${allContent}\n\n---\n\n${extraContent}` : extraContent;
    }
  }

  if (!allContent.trim()) {
    const criteria: Record<string, string> = {};
    const missing: string[] = [];
    for (const c of categoryDef.criteria) {
      criteria[c.key] = "absent";
      missing.push(c.key);
    }
    return {
      score: 0,
      criteria,
      missing,
      superficial: [],
      summary: `Nenhum conteúdo encontrado para a categoria ${categoryDef.name}. Todos os critérios estão ausentes.`,
    };
  }

  const maxChars = 32000;
  const truncatedContent = allContent.length > maxChars
    ? allContent.substring(0, maxChars) + "\n\n[... conteúdo truncado ...]"
    : allContent;

  const criteriaList = categoryDef.criteria
    .map((c) => `- **${c.key}** (${c.label}): ${c.description}`)
    .join("\n");

  const prompt = `Você é um avaliador de qualidade de base de conhecimento para processos internos de uma agência de marketing digital.

Analise o conteúdo fornecido e avalie cada critério da categoria "${categoryDef.name}".

## Critérios a avaliar:
${criteriaList}

## Conteúdo da base de conhecimento:
${truncatedContent}

## Instruções:
Para cada critério, avalie:
- "complete": informação rica, específica e utilizável como SOP pela equipe
- "superficial": informação existe mas é vaga, genérica ou insuficiente para ser um processo documentado
- "absent": nenhuma informação encontrada sobre este ponto

Retorne APENAS um JSON válido (sem markdown, sem explicação fora do JSON):
{
  "criteria": {
    "chave_criterio": "complete|superficial|absent"
  },
  "summary": "Resumo da avaliação em 2-3 frases em português"
}`;

  try {
    const res = await fetch(ANTHROPIC_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": anthropicKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 1024,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Claude API error ${res.status}: ${errText}`);
    }

    const data = await res.json();
    const text = data.content?.[0]?.text || "";
    const cleaned = text.replace(/```json\s*/gi, "").replace(/```/g, "").trim();
    const parsed = JSON.parse(cleaned);

    const criteriaResults = parsed.criteria || {};
    const missing: string[] = [];
    const superficial: string[] = [];

    for (const c of categoryDef.criteria) {
      if (!criteriaResults[c.key]) {
        criteriaResults[c.key] = "absent";
      }
      if (criteriaResults[c.key] === "absent") missing.push(c.key);
      if (criteriaResults[c.key] === "superficial") superficial.push(c.key);
    }

    const score = calculateCategoryScore(categoryDef.criteria,
      Object.fromEntries(Object.entries(criteriaResults).map(([k, v]) => [k, { status: v as "absent" | "superficial" | "complete" }]))
    );

    return {
      score,
      criteria: criteriaResults,
      missing,
      superficial,
      summary: parsed.summary || "",
    };
  } catch (err) {
    console.error(`Error analyzing category ${category}:`, err);
    const criteria: Record<string, string> = {};
    for (const c of categoryDef.criteria) {
      criteria[c.key] = "absent";
    }
    return {
      score: 0,
      criteria,
      missing: categoryDef.criteria.map((c) => c.key),
      superficial: [],
      summary: `Erro ao analisar: ${(err as Error).message}`,
    };
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return corsPreflightResponse();

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const anthropicKey = Deno.env.get("ANTHROPIC_API_KEY");
    if (!anthropicKey) {
      return errorResponse("ANTHROPIC_API_KEY not configured", 500);
    }

    const body: AnalyzeRequest = await req.json();
    const { workspace_id, conversation_id } = body;

    if (!workspace_id) {
      return errorResponse("workspace_id required");
    }

    const categoriesToAnalyze = body.categories?.length
      ? body.categories.filter((c) => c in QUALITY_CRITERIA)
      : Object.keys(QUALITY_CRITERIA);

    const results: Record<string, { score: number; criteria: Record<string, string>; missing: string[]; superficial: string[]; summary: string }> = {};

    for (const category of categoriesToAnalyze) {
      results[category] = await analyzeCategory(
        supabase,
        anthropicKey,
        workspace_id,
        category
      );

      const scoreData = {
        score: results[category].score,
        criteria: results[category].criteria,
        missing_items: results[category].missing,
        superficial_items: results[category].superficial,
        analysis_summary: results[category].summary,
        analyzed_at: new Date().toISOString(),
      };

      const { data: existing } = await supabase
        .from("kb_quality_scores")
        .select("id")
        .eq("workspace_id", workspace_id)
        .eq("category", category)
        .maybeSingle();

      if (existing) {
        await supabase
          .from("kb_quality_scores")
          .update(scoreData)
          .eq("id", existing.id);
      } else {
        await supabase
          .from("kb_quality_scores")
          .insert({
            workspace_id,
            category,
            ...scoreData,
          });
      }
    }

    const allCategories = Object.keys(QUALITY_CRITERIA);
    const categoryScores: Record<string, number> = {};

    if (categoriesToAnalyze.length < allCategories.length) {
      const { data: existingScores } = await supabase
        .from("kb_quality_scores")
        .select("category, score")
        .eq("workspace_id", workspace_id);

      if (existingScores) {
        for (const s of existingScores) {
          categoryScores[s.category] = Number(s.score);
        }
      }
    }

    for (const [cat, result] of Object.entries(results)) {
      categoryScores[cat] = result.score;
    }

    const overallScore =
      Math.round(
        (Object.values(categoryScores).reduce((a, b) => a + b, 0) /
          allCategories.length) *
          10
      ) / 10;

    if (conversation_id) {
      await supabase
        .from("kb_conversations")
        .update({
          overall_score: overallScore,
          category_scores: categoryScores,
        })
        .eq("id", conversation_id);
    }

    return jsonResponse({
      success: true,
      overall_score: overallScore,
      category_scores: categoryScores,
      details: results,
    });
  } catch (err) {
    console.error("kb-agent-analyze error:", err);
    return errorResponse((err as Error).message, 500);
  }
});
