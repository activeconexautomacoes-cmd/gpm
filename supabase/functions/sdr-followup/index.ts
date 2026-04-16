import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { jsonResponse, errorResponse, corsPreflightResponse } from "../_shared/cors.ts";

/**
 * SDR Follow-up — Sequência automática de follow-up
 * Roda a cada 5 minutos via pg_cron
 *
 * Sequência:
 * - Step 1: 25min — Cutucada leve
 * - Step 2: 1h — Retomar conversa
 * - Step 3: 4h — Gancho de valor
 * - Step 4: 24h — Oferta direta
 * - Step 5: 48h — Despedida com porta aberta
 *
 * Para quando:
 * - Lead responde (webhook cancela follow-ups pendentes)
 * - Lead status = qualificado/agendado/downsell/encerrado
 */

const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY") || "";
const WORKSPACE_ID = "8eaae987-1b56-43de-978c-c135beb30c7e";
const EVOLUTION_API_URL = "https://whatsappapi.winhub.com.br";
const EVOLUTION_API_KEY = "cda34a5c9f0702a581b0f6a03a1466a4";
const EVOLUTION_INSTANCE = "sdrai-whatsapp";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// Intervalos entre steps
const STEP_DELAYS_MS: Record<number, number> = {
  2: 1 * 60 * 60 * 1000,       // 1 hora
  3: 4 * 60 * 60 * 1000,       // 4 horas
  4: 24 * 60 * 60 * 1000,      // 24 horas
  5: 48 * 60 * 60 * 1000,      // 48 horas
};

const STEP_INSTRUCTIONS: Record<number, string> = {
  1: "Cutucada leve e simpática. Algo como 'Oi, tudo bem? Vi que a gente não terminou de conversar'. Curta, 1-2 linhas.",
  2: "Retome a conversa de onde parou. Relembre o que estavam falando e faça uma pergunta. 2-3 linhas máximo.",
  3: "Gancho de valor. Mencione um resultado ou case relevante para gerar interesse. Ex: 'Ah, lembrei de você porque acabei de ver os resultados de uma loja parecida com a sua'. 2-3 linhas.",
  4: "Oferta mais direta. Sugira agendar a consultoria. 'Olha, ainda tenho um horário essa semana se quiser aproveitar'. 2-3 linhas.",
  5: "Despedida com porta aberta. 'Entendo que agora não é o melhor momento. Se precisar no futuro é só me chamar aqui!'. Curta e gentil.",
};

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

// Remove qualquer tag [TAG] ou [TAG:valor] antes de enviar
function stripAllTags(text: string): string {
  return text.replace(/\[(?:LEAD_DATA|SISTEMA|AGENDAR|REMARCAR|CONFIRMAR_HORARIO|QUALIFICADO|DOWNSELL|HUMANO)(?::[^\]]*?)?\]/g, "").replace(/\s{2,}/g, " ").trim();
}

async function sendWhatsApp(phone: string, text: string) {
  const cleanText = stripAllTags(text);
  await fetch(`${EVOLUTION_API_URL}/message/sendText/${EVOLUTION_INSTANCE}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "apikey": EVOLUTION_API_KEY },
    body: JSON.stringify({ number: phone, text: cleanText }),
  });
}

async function getHistory(phone: string) {
  const res = await supabaseFetch(
    `sdr_conversations?phone=eq.${encodeURIComponent(phone)}&order=created_at.desc&limit=10`
  );
  if (!res.ok) return [];
  const data = await res.json();
  return data.reverse();
}

async function getLeadStatus(phone: string): Promise<string | null> {
  const res = await supabaseFetch(
    `sdr_leads?phone=eq.${encodeURIComponent(phone)}&select=status&limit=1`
  );
  if (!res.ok) return null;
  const data = await res.json();
  return data[0]?.status || null;
}

async function generateFollowUp(phone: string, step: number): Promise<string> {
  const history = await getHistory(phone);
  const messages = history.map((m: { role: string; content: string }) => ({
    role: m.role,
    content: m.content.split("\n\n[SISTEMA:")[0].trim(),
  }));

  const instruction = STEP_INSTRUCTIONS[step] || STEP_INSTRUCTIONS[5];

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 200,
      system: `Você é a Maria Eduarda, SDR da Plus Mídia. Está fazendo follow-up com um lead que parou de responder. Seja natural, simpática e breve. NUNCA pareça robô. Máximo 3 linhas. Sem emoji excessivo. Sem listas. Sem formatação.

Instrução para este follow-up: ${instruction}

REGRAS:
- Use o nome do lead se souber (veja no histórico)
- NÃO repita mensagens anteriores
- NÃO pergunte coisas que já perguntou
- Se é o step 5 (despedida), encerre de forma gentil`,
      messages: [
        ...messages,
        { role: "user", content: `[SISTEMA: Gere a mensagem de follow-up step ${step}. O lead não respondeu desde a última mensagem.]` },
      ],
    }),
  });

  const text = (await res.json()).content?.[0]?.text || "";
  // Limpar qualquer tag que vaze
  return text.replace(/\[LEAD_DATA:[^\]]*\]/g, "").replace(/\[SISTEMA:[^\]]*\]/g, "").replace(/\[AGENDAR\]/g, "").replace(/\[DOWNSELL\]/g, "").trim();
}

// Retorna horário de Brasília (UTC-3)
function getBrtNow(): Date {
  const now = new Date();
  return new Date(now.getTime() - 3 * 60 * 60 * 1000);
}

// Verifica se estamos em horário permitido pra follow-up (7h-20h BRT, todos os dias)
function isFollowUpHours(): boolean {
  const brt = getBrtNow();
  const hour = brt.getUTCHours();
  return hour >= 7 && hour < 20;
}

// Calcula próximo horário permitido (7h BRT do dia seguinte)
function nextFollowUpOpen(): Date {
  const brt = getBrtNow();
  const next = new Date(brt);
  next.setUTCHours(7, 0, 0, 0);
  next.setUTCDate(next.getUTCDate() + 1);
  // Converter de volta pra UTC (+3h)
  return new Date(next.getTime() + 3 * 60 * 60 * 1000);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return corsPreflightResponse();

  try {
    // Só processa follow-ups entre 7h-20h BRT
    if (!isFollowUpHours()) {
      return jsonResponse({ success: true, message: "Fora do horário de follow-up (7h-20h BRT) — adiados", processed: 0 });
    }

    // Buscar follow-ups pendentes que já passaram do horário
    const now = new Date().toISOString();
    const res = await supabaseFetch(
      `sdr_follow_ups?sent_at=is.null&cancelled=eq.false&scheduled_at=lte.${now}&order=scheduled_at.asc&limit=20`
    );
    const pendingFollowUps = await res.json();

    if (!Array.isArray(pendingFollowUps) || pendingFollowUps.length === 0) {
      return jsonResponse({ success: true, message: "Sem follow-ups pendentes", processed: 0 });
    }

    let sent = 0;
    let skipped = 0;
    let cancelled = 0;

    for (const followUp of pendingFollowUps) {
      const { id, phone, step } = followUp;

      // Verificar se o lead já foi qualificado/agendado/encerrado
      const status = await getLeadStatus(phone);
      if (status && ["qualificado", "agendado", "downsell", "encerrado"].includes(status)) {
        // Cancelar — lead já avançou no funil
        await supabaseFetch(`sdr_follow_ups?id=eq.${id}`, {
          method: "PATCH",
          headers: { "Prefer": "return=minimal" },
          body: JSON.stringify({ cancelled: true }),
        });
        cancelled++;
        continue;
      }

      // Gerar mensagem personalizada com Claude
      const message = await generateFollowUp(phone, step);
      if (!message) {
        skipped++;
        continue;
      }

      // Enviar via WhatsApp
      await sendWhatsApp(phone, message);

      // Salvar na conversa
      await supabaseFetch("sdr_conversations", {
        method: "POST",
        headers: { "Prefer": "return=minimal" },
        body: JSON.stringify([{ phone, role: "assistant", content: message, workspace_id: WORKSPACE_ID }]),
      });

      // Marcar como enviado
      await supabaseFetch(`sdr_follow_ups?id=eq.${id}`, {
        method: "PATCH",
        headers: { "Prefer": "return=minimal" },
        body: JSON.stringify({ sent_at: new Date().toISOString() }),
      });

      // Agendar próximo step (se não é o último)
      if (step < 5) {
        const nextStep = step + 1;
        const nextDelay = STEP_DELAYS_MS[nextStep] || 24 * 60 * 60 * 1000;
        let nextTime = new Date(Date.now() + nextDelay);
        // Se cair fora do horário comercial, adia pro próximo dia útil 8h BRT
        const brtNext = new Date(nextTime.getTime() - 3 * 60 * 60 * 1000);
        const nextHour = brtNext.getUTCHours();
        const nextDay = brtNext.getUTCDay();
        const outsideHours = nextHour < 7 || nextHour >= 20;
        if (outsideHours) {
          nextTime = nextFollowUpOpen();
        }
        const nextScheduledAt = nextTime.toISOString();

        await supabaseFetch("sdr_follow_ups", {
          method: "POST",
          headers: { "Prefer": "return=minimal" },
          body: JSON.stringify({
            phone,
            step: nextStep,
            scheduled_at: nextScheduledAt,
            workspace_id: WORKSPACE_ID,
          }),
        });
      } else {
        // Step 5 (último) — marcar lead como encerrado
        await supabaseFetch(`sdr_leads?phone=eq.${encodeURIComponent(phone)}`, {
          method: "PATCH",
          headers: { "Prefer": "return=minimal" },
          body: JSON.stringify({ status: "encerrado", updated_at: new Date().toISOString() }),
        });
      }

      sent++;
    }

    return jsonResponse({
      success: true,
      processed: pendingFollowUps.length,
      sent,
      skipped,
      cancelled,
    });
  } catch (err) {
    console.error("sdr-followup error:", err);
    return errorResponse(String(err), 500);
  }
});
