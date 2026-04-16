import "jsr:@supabase/functions-js/edge-runtime.d.ts";

/**
 * SDR Conversation Audit — Auditoria de conversas a cada 4h
 * Analisa problemas operacionais: mensagens duplicadas, tag vazando,
 * qualificação errada, follow-up insistente, lead irritado
 * Envia relatório via WhatsApp
 */

const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY") || "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const EVOLUTION_API_URL = "https://whatsappapi.winhub.com.br";
const EVOLUTION_API_KEY = "cda34a5c9f0702a581b0f6a03a1466a4";
const EVOLUTION_INSTANCE = "sdrai-whatsapp";
const REPORT_PHONE = "556296449901"; // Yago
const WORKSPACE_ID = "8eaae987-1b56-43de-978c-c135beb30c7e";

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

async function sendWhatsApp(phone: string, text: string) {
  await fetch(`${EVOLUTION_API_URL}/message/sendText/${EVOLUTION_INSTANCE}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "apikey": EVOLUTION_API_KEY },
    body: JSON.stringify({ number: phone, text }),
  });
}

Deno.serve(async (req) => {
  if (req.method !== "POST" && req.method !== "GET") {
    return new Response("OK", { status: 200 });
  }

  try {
    // Buscar conversas das últimas 4h
    const since = new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString();

    // Buscar phones únicos que tiveram atividade nas últimas 4h
    const phonesRes = await supabaseFetch(
      `sdr_conversations?created_at=gte.${since}&workspace_id=eq.${WORKSPACE_ID}&select=phone&order=phone`
    );
    const phonesData = await phonesRes.json();
    if (!Array.isArray(phonesData) || phonesData.length === 0) {
      return new Response(JSON.stringify({ success: true, message: "Sem conversas nas últimas 4h" }), {
        status: 200, headers: { "Content-Type": "application/json" },
      });
    }

    const uniquePhones = [...new Set(phonesData.map((p: { phone: string }) => p.phone))];

    // Para cada phone, buscar conversa completa e dados do lead
    const conversations: string[] = [];

    for (const phone of uniquePhones.slice(0, 15)) {
      const [histRes, leadRes] = await Promise.all([
        supabaseFetch(
          `sdr_conversations?phone=eq.${encodeURIComponent(phone as string)}&order=created_at.asc&limit=50`
        ),
        supabaseFetch(
          `sdr_leads?phone=eq.${encodeURIComponent(phone as string)}&select=name,status,faturamento,instagram,site&limit=1`
        ),
      ]);

      const history = await histRes.json();
      const leadData = (await leadRes.json())?.[0] || {};

      if (!Array.isArray(history) || history.length < 2) continue;

      const messages = history.map((m: { role: string; content: string; created_at: string }) => {
        const clean = m.content.split("\n\n[SISTEMA:")[0].trim();
        const time = new Date(m.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" });
        return `[${time}] ${m.role === "user" ? "LEAD" : "MARIA"}: ${clean}`;
      }).join("\n");

      conversations.push(
        `=== ${leadData.name || phone} | Status: ${leadData.status || "?"} | Fat: ${leadData.faturamento || "não coletado"} | IG: ${leadData.instagram || "?"} | Site: ${leadData.site || "?"} ===\n${messages}`
      );
    }

    if (conversations.length === 0) {
      return new Response(JSON.stringify({ success: true, message: "Conversas sem histórico" }), {
        status: 200, headers: { "Content-Type": "application/json" },
      });
    }

    // Analisar com Claude
    const claudeRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "x-api-key": ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 2000,
        messages: [{ role: "user", content: `Você é um auditor de qualidade analisando conversas de uma SDR IA (Maria Eduarda) que atende leads por WhatsApp para a Plus Mídia (agência de e-commerce).

REGRAS DE QUALIFICAÇÃO:
- Com site ativo + fatura R$ 10k+/mês = QUALIFICADO → consultoria gratuita
- Sem site (inclui "site quase pronto") + fatura R$ 20k+/mês = QUALIFICADO → consultoria gratuita
- Abaixo = DESQUALIFICADO → downsell R$ 497
- Loja parada/zerada = DESQUALIFICADO

ANALISE ESTAS CONVERSAS E IDENTIFIQUE APENAS PROBLEMAS:

${conversations.join("\n\n---\n\n")}

Procure ESPECIFICAMENTE:
1. QUALIFICAÇÃO ERRADA — agendou consultoria gratuita pra lead desqualificado, ou mandou downsell pra qualificado
2. MENSAGENS DUPLICADAS — Maria mandou a mesma coisa 2+ vezes seguidas
3. TAG VAZANDO — [LEAD_DATA], [AGENDAR], [SISTEMA] ou qualquer tag apareceu na mensagem pro lead
4. DADOS NÃO COLETADOS — se o campo "Fat" ou "IG" ou "Site" está como "não coletado" ou "?" mas o lead informou na conversa
5. LEAD IRRITADO — lead demonstrou irritação, reclamou, ou ficou desconfortável
6. INSISTÊNCIA — Maria insistiu demais após recusa (mais de 1 tentativa de downsell ou agendamento)
7. MENSAGEM LONGA — Maria mandou blocos com mais de 3 linhas

Responda em texto puro (SEM markdown, SEM formatação, SEM asteriscos, SEM bullets). Use apenas texto simples com quebras de linha.

Formato:
AUDITORIA SDR - [quantidade] conversas analisadas

PROBLEMAS ENCONTRADOS:
[número]. [nome do lead] - [tipo do problema]: [descrição breve em 1 linha]

Se NÃO encontrou nenhum problema, responda APENAS:
AUDITORIA SDR - [quantidade] conversas analisadas
Nenhum problema encontrado.` }],
      }),
    });

    if (!claudeRes.ok) {
      console.error("Claude error:", await claudeRes.text());
      return new Response(JSON.stringify({ error: "Claude API error" }), { status: 500, headers: { "Content-Type": "application/json" } });
    }

    const report = (await claudeRes.json()).content?.[0]?.text?.trim() || "Erro ao gerar relatório";

    // Enviar relatório via WhatsApp
    await sendWhatsApp(REPORT_PHONE, report);

    return new Response(JSON.stringify({
      success: true,
      conversations_analyzed: conversations.length,
      report_sent_to: REPORT_PHONE,
    }), { status: 200, headers: { "Content-Type": "application/json" } });
  } catch (err) {
    console.error("sdr-conversation-audit error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { "Content-Type": "application/json" },
    });
  }
});
