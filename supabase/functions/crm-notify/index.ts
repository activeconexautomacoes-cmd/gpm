import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { jsonResponse, errorResponse, corsPreflightResponse } from "../_shared/cors.ts";

/**
 * CRM Notify — Notificações em tempo real via WhatsApp
 * Chamado por triggers do banco quando há eventos no CRM:
 * - new_lead: novo lead criado
 * - stage_change: card moveu de stage
 * - session_scheduled: sessão agendada
 * - won: fechamento
 * - lost: perda
 * - hot_lead: lead ficou quente
 */

const EVOLUTION_API_URL = "https://whatsappapi.winhub.com.br";
const EVOLUTION_API_KEY = "cda34a5c9f0702a581b0f6a03a1466a4";
const EVOLUTION_INSTANCE = "sdrai-whatsapp";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// ── Helpers ──

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
  const res = await fetch(`${EVOLUTION_API_URL}/message/sendText/${EVOLUTION_INSTANCE}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "apikey": EVOLUTION_API_KEY },
    body: JSON.stringify({ number: phone, text }),
  });
  if (!res.ok) {
    console.error(`WhatsApp send error for ${phone}:`, await res.text());
  }
}

interface Subscriber {
  phone: string;
  name: string;
}

async function getSubscribers(workspaceId: string, eventType: string): Promise<Subscriber[]> {
  const columnMap: Record<string, string> = {
    new_lead: "notify_new_lead",
    stage_change: "notify_stage_change",
    session_scheduled: "notify_session_scheduled",
    won: "notify_won",
    lost: "notify_lost",
    hot_lead: "notify_hot_lead",
  };

  const col = columnMap[eventType] || "notify_new_lead";
  const res = await supabaseFetch(
    `crm_notification_subscribers?workspace_id=eq.${workspaceId}&is_active=eq.true&${col}=eq.true&select=phone,name`
  );
  if (!res.ok) return [];
  return res.json();
}

function formatCurrency(value: number | null | undefined): string {
  if (!value) return "N/I";
  return `R$ ${value.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;
}

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "N/I";
  const d = new Date(dateStr);
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" });
}

function extractUtm(customFields: Record<string, unknown> | null): string {
  if (!customFields) return "";
  const utmSource = customFields.utm_source || customFields._utm_source || "";
  const utmMedium = customFields.utm_medium || customFields._utm_medium || "";
  const utmCampaign = customFields.utm_campaign || customFields._utm_campaign || "";
  const parts = [utmSource, utmMedium, utmCampaign].filter(Boolean);
  return parts.length > 0 ? parts.join(" / ") : "";
}

// ── Group new lead alerts ──

const GROUP_NEW_LEAD_ALERTS: string[] = [
  "🚨 *Novo lead no CRM, time! Bora abordar!*",
  "📥 *Lead novo na área! Quem pega?* 💪",
  "🔥 *Caiu lead novo, squad! Partiu abordagem!*",
  "⚡ *Novo lead! Bora pra cima, time!*",
  "🚀 *Lead fresquinho! Quem vai fazer acontecer?*",
  "💰 *Novo lead chegou! Bora converter, galera!*",
  "📢 *Atenção time! Lead novo no pipeline!*",
  "🎯 *Mais um lead! Bora fechar esse aí!*",
];

function randomAlert(): string {
  return GROUP_NEW_LEAD_ALERTS[Math.floor(Math.random() * GROUP_NEW_LEAD_ALERTS.length)];
}

// ── Message Formatters ──

function formatNewLeadPV(data: Record<string, unknown>): string {
  const utm = extractUtm(data.custom_fields as Record<string, unknown> | null);
  const utmLine = utm ? `\n📊 UTM: ${utm}` : "";
  const revenue = data.company_revenue ? `\n💰 Faturamento: ${formatCurrency(data.company_revenue as number)}` : "";
  const instagram = data.company_instagram ? `\n📸 Instagram: ${data.company_instagram}` : "";
  const website = data.company_website ? `\n🌐 Site: ${data.company_website}` : "";

  return `📥 *Novo Lead no CRM*

*${data.lead_name || "Sem nome"}*
📞 ${data.lead_phone || "N/I"}
📧 ${data.lead_email || "N/I"}
📌 Origem: ${data.source || "N/I"}${utmLine}${revenue}${instagram}${website}`;
}

function formatNewLeadGroup(data: Record<string, unknown>): string {
  return `${randomAlert()}

*${data.lead_name || "Sem nome"}*`;
}

function formatStageChange(data: Record<string, unknown>): string {
  return `🔄 *Movimentação no CRM*

*${data.lead_name}*
${data.old_stage} ➡️ *${data.new_stage}*`;
}

function formatSessionScheduled(data: Record<string, unknown>): string {
  return `📅 *Sessão Agendada*

*${data.lead_name}*
🕐 ${formatDate(data.session_date as string)}
🔗 ${data.meeting_link || "Link pendente"}`;
}

function formatWon(data: Record<string, unknown>): string {
  const value = (data.negotiated_value || data.estimated_value) as number;
  return `🏆 *FECHAMENTO!*

*${data.lead_name}*
💰 Valor: ${formatCurrency(value)}`;
}

function formatLost(data: Record<string, unknown>): string {
  const reason = data.loss_reason ? `\n📋 Motivo: ${data.loss_reason}` : "";
  const notes = data.loss_notes ? `\n💬 ${data.loss_notes}` : "";
  return `❌ *Lead Perdido*

*${data.lead_name}*${reason}${notes}`;
}

function formatHotLead(data: Record<string, unknown>): string {
  return `🔥 *Lead Quente!*

*${data.lead_name}*
📞 ${data.lead_phone || "N/I"}
💰 Valor estimado: ${formatCurrency(data.estimated_value as number)}

⚡ Priorize o atendimento desse lead!`;
}

// ── Main Handler ──

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return corsPreflightResponse();

  try {
    const payload = await req.json();
    const event = payload.event as string;
    const workspaceId = payload.workspace_id as string;

    if (!event || !workspaceId) {
      return errorResponse("Missing event or workspace_id");
    }

    // Get subscribers for this event type
    const subscribers = await getSubscribers(workspaceId, event);
    if (subscribers.length === 0) {
      return jsonResponse({ success: true, message: "No subscribers for this event" });
    }

    // Format message based on event type (with group/PV variants for new_lead)
    function getMessage(sub: Subscriber): string {
      const isGroup = sub.phone.includes("@g.us");
      switch (event) {
        case "new_lead":
          return isGroup ? formatNewLeadGroup(payload) : formatNewLeadPV(payload);
        case "stage_change":
          return formatStageChange(payload);
        case "session_scheduled":
          return formatSessionScheduled(payload);
        case "won":
          return formatWon(payload);
        case "lost":
          return formatLost(payload);
        case "hot_lead":
          return formatHotLead(payload);
        default:
          return "";
      }
    }

    // Send to all subscribers
    const results = await Promise.allSettled(
      subscribers.map((sub) => {
        const msg = getMessage(sub);
        return msg ? sendWhatsApp(sub.phone, msg) : Promise.resolve();
      })
    );

    const sent = results.filter((r) => r.status === "fulfilled").length;
    const failed = results.filter((r) => r.status === "rejected").length;

    console.log(`[crm-notify] event=${event} lead=${payload.lead_name} sent=${sent} failed=${failed}`);

    return jsonResponse({ success: true, event, sent, failed });
  } catch (err) {
    console.error("[crm-notify] Error:", err);
    return errorResponse(String(err), 500);
  }
});
