import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { corsHeaders, jsonResponse, errorResponse, corsPreflightResponse } from "../_shared/cors.ts";

const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY") || "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

async function supabaseFetch(path: string) {
  return fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: {
      "apikey": SUPABASE_SERVICE_KEY,
      "Authorization": `Bearer ${SUPABASE_SERVICE_KEY}`,
      "Content-Type": "application/json",
      "Prefer": "return=representation",
    },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return corsPreflightResponse();

  try {
    const { messages, workspace_id } = await req.json();
    if (!messages || !workspace_id) return errorResponse("messages and workspace_id required");

    // Fetch leads and conversations for context
    const [leadsRes, convsRes, meetingsRes] = await Promise.all([
      supabaseFetch(`sdr_leads?workspace_id=eq.${workspace_id}&order=created_at.desc&limit=100`),
      supabaseFetch(`sdr_conversations?workspace_id=eq.${workspace_id}&order=created_at.desc&limit=500`),
      supabaseFetch(`sdr_meetings?workspace_id=eq.${workspace_id}&order=created_at.desc&limit=50`),
    ]);

    const leads = await leadsRes.json();
    const convs = await convsRes.json();
    const meetings = await meetingsRes.json();

    // Build context
    const leadsContext = (Array.isArray(leads) ? leads : []).map((l: any) =>
      `${l.name || "Sem nome"} | ${l.phone} | IG: ${l.instagram || "-"} | Fat: ${l.faturamento || "-"} | Status: ${l.status} | Criado: ${l.created_at?.slice(0, 10)}`
    ).join("\n");

    const totalLeads = Array.isArray(leads) ? leads.length : 0;
    const qualificados = Array.isArray(leads) ? leads.filter((l: any) => l.status === "qualificado" || l.status === "agendado").length : 0;
    const agendados = Array.isArray(leads) ? leads.filter((l: any) => l.status === "agendado").length : 0;
    const downsell = Array.isArray(leads) ? leads.filter((l: any) => l.status === "downsell").length : 0;
    const emConversa = Array.isArray(leads) ? leads.filter((l: any) => l.status === "em_conversa").length : 0;
    const totalMeetings = Array.isArray(meetings) ? meetings.length : 0;

    // Build conversation snippets per lead (last 5 msgs each)
    const phoneConvs: Record<string, string[]> = {};
    if (Array.isArray(convs)) {
      convs.reverse().forEach((c: any) => {
        if (!phoneConvs[c.phone]) phoneConvs[c.phone] = [];
        if (phoneConvs[c.phone].length < 5) {
          phoneConvs[c.phone].push(`${c.role === "user" ? "Lead" : "Maria"}: ${c.content?.slice(0, 150)}`);
        }
      });
    }

    const convsContext = Object.entries(phoneConvs).slice(0, 20).map(([phone, msgs]) => {
      const lead = Array.isArray(leads) ? leads.find((l: any) => l.phone === phone) : null;
      return `--- ${lead?.name || phone} ---\n${msgs.join("\n")}`;
    }).join("\n\n");

    const systemPrompt = `Voce e a Maria Eduarda, SDR IA da Plus Midia. O gerente da agencia esta te perguntando sobre os leads e resultados das suas conversas. Responda com base nos dados reais abaixo. Seja direta, objetiva e util.

RESUMO:
- Total de leads: ${totalLeads}
- Em conversa: ${emConversa}
- Qualificados: ${qualificados}
- Agendados: ${agendados}
- Downsell: ${downsell}
- Reunioes: ${totalMeetings}

LEADS (nome | telefone | instagram | faturamento | status | data):
${leadsContext}

ULTIMAS CONVERSAS:
${convsContext}

REGRAS:
- Responda em portugues
- Se perguntar de um lead especifico, busque pelo nome ou telefone nos dados acima
- Se perguntar "quantos leads", conte dos dados acima
- Seja precisa com numeros, nao invente
- Se nao souber, diga que nao tem essa informacao`;

    const claudeRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "x-api-key": ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 500,
        system: systemPrompt,
        messages,
      }),
    });

    if (!claudeRes.ok) return errorResponse(await claudeRes.text(), 500);
    const response = (await claudeRes.json()).content?.[0]?.text || "Nao consegui processar.";

    return jsonResponse({ success: true, response });
  } catch (err) {
    console.error("sdr-chat error:", err);
    return errorResponse(String(err), 500);
  }
});
