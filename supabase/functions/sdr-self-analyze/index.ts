import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { corsHeaders, jsonResponse, errorResponse, corsPreflightResponse } from "../_shared/cors.ts";

/**
 * SDR Self-Analyze — A SDR analisa suas próprias conversas recentes
 * Identifica onde perdeu leads, erros de abordagem e gera sugestões de melhoria
 * Roda automaticamente a cada 3 dias
 */

const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY") || "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

async function supabaseFetch(path: string, options?: RequestInit) {
  return fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...options,
    headers: {
      "apikey": SUPABASE_SERVICE_KEY,
      "Authorization": `Bearer ${SUPABASE_SERVICE_KEY}`,
      "Content-Type": "application/json",
      "Prefer": "return=representation",
      ...options?.headers,
    },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return corsPreflightResponse();

  try {
    // Buscar a última data de auto-análise
    const lastAnalysisRes = await supabaseFetch(
      `sdr_knowledge_entries?category=eq.sdrai-last-self-analyzed&select=content&order=created_at.desc&limit=1`
    );
    const lastAnalysisData = await lastAnalysisRes.json();
    const lastAnalyzedAt = lastAnalysisData?.[0]?.content || "2000-01-01T00:00:00Z";

    // Buscar leads que encerraram ou ficaram parados desde a última análise
    // (leads com status 'encerrado' ou 'em_conversa' sem atividade há 48h+)
    const cutoff48h = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();

    const lostLeadsRes = await supabaseFetch(
      `sdr_leads?or=(status.eq.encerrado,and(status.eq.em_conversa,updated_at.lt.${cutoff48h}))&updated_at=gt.${lastAnalyzedAt}&select=phone,name,status,faturamento,instagram,site&limit=20`
    );
    const lostLeads = await lostLeadsRes.json();

    if (!Array.isArray(lostLeads) || lostLeads.length === 0) {
      return jsonResponse({ success: true, message: "Sem conversas novas para analisar" });
    }

    // Para cada lead perdido, buscar o histórico da conversa
    const conversationsToAnalyze: string[] = [];

    for (const lead of lostLeads.slice(0, 10)) {
      const histRes = await supabaseFetch(
        `sdr_conversations?phone=eq.${encodeURIComponent(lead.phone)}&order=created_at.asc&limit=30`
      );
      const history = await histRes.json();

      if (Array.isArray(history) && history.length >= 2) {
        const messages = history.map((m: { role: string; content: string }) => {
          // Limpar contexto de sistema das mensagens
          const clean = m.content.split("\n\n[SISTEMA:")[0].trim();
          return `${m.role === "user" ? "LEAD" : "MARIA EDUARDA"}: ${clean}`;
        }).join("\n");

        conversationsToAnalyze.push(
          `=== Lead: ${lead.name || lead.phone} | Status: ${lead.status} | Faturamento: ${lead.faturamento || "?"} ===\n${messages}`
        );
      }
    }

    if (conversationsToAnalyze.length === 0) {
      return jsonResponse({ success: true, message: "Conversas sem histórico suficiente" });
    }

    // Enviar para Claude analisar
    const claudeRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "x-api-key": ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 4096,
        messages: [{ role: "user", content: `Você é um analista de vendas revisando conversas de uma SDR IA chamada Maria Eduarda que atende leads por WhatsApp para a Plus Mídia (agência de marketing para e-commerce).

Analise as conversas abaixo onde os leads foram PERDIDOS (encerraram ou sumiram) e identifique:

1. ONDE A MARIA ERROU: Em qual momento da conversa ela perdeu o lead? Foi tom errado? Pergunta no momento errado? Forçou demais?
2. O QUE DEVERIA TER FEITO: Como deveria ter respondido naquele ponto específico?
3. PADRÕES DE PERDA: Existem erros repetidos entre as conversas? (Ex: sempre perde quando pergunta faturamento cedo demais)
4. OBJEÇÕES NÃO TRATADAS: O lead levantou algo que a Maria não soube contornar?
5. OPORTUNIDADES PERDIDAS: Momentos onde ela poderia ter gerado mais valor ou interesse
6. TIMING: Respondeu rápido demais? Lento demais? Mensagens muito longas?

${conversationsToAnalyze.join("\n\n---\n\n")}

Retorne APENAS JSON puro (sem markdown):
{
  "content": "Lista de melhorias práticas e acionáveis para a Maria Eduarda. Cada melhoria deve ser uma regra clara que ela pode seguir. Foque em mudanças específicas de comportamento, não em conselhos genéricos.",
  "category": "analise-sdrai-autoanalise",
  "tem_dados": true,
  "leads_analisados": ${conversationsToAnalyze.length},
  "principais_erros": ["erro1", "erro2", "erro3"]
}

Se não tiver dados úteis: {"tem_dados": false}` }],
      }),
    });

    if (!claudeRes.ok) {
      return errorResponse(await claudeRes.text(), 500);
    }

    const responseText = (await claudeRes.json()).content?.[0]?.text?.trim();
    let analysis;
    try {
      let clean = responseText || "";
      if (clean.startsWith("```")) clean = clean.replace(/^```json?\n?/, "").replace(/\n?```$/, "");
      analysis = JSON.parse(clean);
    } catch {
      return errorResponse(`Parse error: ${responseText?.substring(0, 500)}`, 500);
    }

    if (!analysis.tem_dados) {
      return jsonResponse({ success: true, message: "Sem insights úteis" });
    }

    // Inserir sugestão pendente para aprovação
    if (analysis.content) {
      await supabaseFetch("sdr_knowledge_entries", {
        method: "POST",
        headers: { "apikey": SUPABASE_SERVICE_KEY, "Authorization": `Bearer ${SUPABASE_SERVICE_KEY}`, "Content-Type": "application/json", "Prefer": "return=minimal" },
        body: JSON.stringify({
          content: analysis.content,
          category: "analise-sdrai-autoanalise",
          source: "ai-suggestion",
          status: "pending",
        }),
      });
    }

    // Marcar timestamp da última análise
    await supabaseFetch("sdr_knowledge_entries", {
      method: "POST",
      headers: { "apikey": SUPABASE_SERVICE_KEY, "Authorization": `Bearer ${SUPABASE_SERVICE_KEY}`, "Content-Type": "application/json", "Prefer": "return=minimal" },
      body: JSON.stringify({
        content: new Date().toISOString(),
        category: "sdrai-last-self-analyzed",
        source: "terminal",
        status: "approved",
      }),
    });

    return jsonResponse({
      success: true,
      message: `${conversationsToAnalyze.length} conversas analisadas`,
      principais_erros: analysis.principais_erros || [],
    });
  } catch (err) {
    console.error("sdr-self-analyze error:", err);
    return errorResponse(String(err), 500);
  }
});
