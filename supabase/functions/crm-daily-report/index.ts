import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { jsonResponse, errorResponse, corsPreflightResponse } from "../_shared/cors.ts";

/**
 * CRM Daily Report — Relatório diário às 8h BRT
 * Envia via WhatsApp para PVs e grupo "PM | Squad Comercial"
 * - Saudações personalizadas por destinatário
 * - Leads novos + UTMs + MQL/SQL
 * - Reuniões agendadas/realizadas vs dia anterior
 * - No-shows, fechamentos, perdas
 */

const EVOLUTION_API_URL = "https://whatsappapi.winhub.com.br";
const EVOLUTION_API_KEY = "cda34a5c9f0702a581b0f6a03a1466a4";
const EVOLUTION_INSTANCE = "sdrai-whatsapp";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const WORKSPACE_ID = "8eaae987-1b56-43de-978c-c135beb30c7e";

const DESQUALIFICADO_STAGES = ["Desqualificado", "Fim de Cadência"];
const NO_SHOW_STAGE = "No Show";

// ── Saudações personalizadas ──

const GREETINGS_CEO: string[] = [
  "Bom dia, chefe! ☀️",
  "Bom dia, meu CEO! 🚀",
  "Salve, chefão! Bom dia! 💪",
  "Bom dia, boss! Segue o relatório do dia 📊",
  "Dia, chefe! Bora pra mais um dia de conquistas! 🏆",
  "Bom dia, CEO! Os números de ontem chegaram 📈",
  "E aí, chefe! Bom dia! Olha os dados de ontem 👇",
  "Bom dia, meu patrão! Relatório fresquinho pra você ☕",
];

const GREETINGS_MANAGER: string[] = [
  "Bom dia, meu gerente! ☀️",
  "Salve, gerente! Bom dia! 💪",
  "Bom dia, meu líder comercial! 🚀",
  "Dia, gerente! Segue o resumo de ontem 📊",
  "Bom dia, meu capitão do comercial! ⚡",
  "E aí, gerente! Bom dia! Olha os números 👇",
  "Bom dia, meu craque! Relatório do dia pra você 📈",
  "Bom dia, comandante! Bora conferir os resultados ☕",
];

const GREETINGS_GROUP: string[] = [
  "Bom dia, time! ☀️",
  "Salve, squad! Bom dia! 💪",
  "Bom dia, equipe! Bora conferir os números de ontem 📊",
  "Dia, time comercial! Segue o relatório 🚀",
  "Bom dia, galera! Os resultados de ontem chegaram 📈",
  "E aí, time! Bom dia! Olha como foi ontem 👇",
  "Bom dia, squad comercial! Partiu resultado ⚡",
  "Bom dia, time! Café e números, como deve ser ☕",
];

function randomGreeting(list: string[]): string {
  return list[Math.floor(Math.random() * list.length)];
}

function getGreeting(phone: string, name: string): string {
  if (phone.includes("@g.us")) return randomGreeting(GREETINGS_GROUP);
  if (name === "Alex") return randomGreeting(GREETINGS_MANAGER);
  // Yago + qualquer "Chefe" recebe saudação de CEO
  return randomGreeting(GREETINGS_CEO);
}

// ── Helpers ──

interface Subscriber {
  phone: string;
  name: string;
}

async function supabaseFetch(path: string) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: {
      "apikey": SUPABASE_SERVICE_KEY,
      "Authorization": `Bearer ${SUPABASE_SERVICE_KEY}`,
      "Content-Type": "application/json",
    },
  });
  if (!res.ok) {
    console.error(`Supabase fetch error: ${path}`, await res.text());
    return [];
  }
  return res.json();
}

async function sendWhatsApp(phone: string, text: string) {
  // Groups use a different endpoint
  const isGroup = phone.includes("@g.us");
  const url = `${EVOLUTION_API_URL}/message/sendText/${EVOLUTION_INSTANCE}`;
  const body = isGroup
    ? { number: phone, text }
    : { number: phone, text };

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", "apikey": EVOLUTION_API_KEY },
    body: JSON.stringify(body),
  });
  if (!res.ok) console.error(`WhatsApp error for ${phone}:`, await res.text());
}

async function getSubscribers(): Promise<Subscriber[]> {
  const data = await supabaseFetch(
    `crm_notification_subscribers?workspace_id=eq.${WORKSPACE_ID}&is_active=eq.true&notify_daily_report=eq.true&select=phone,name`
  );
  return Array.isArray(data) ? data : [];
}

function formatCurrency(value: number): string {
  return `R$ ${value.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;
}

function getDateRange(daysAgo: number): { start: string; end: string } {
  const now = new Date();
  const brt = new Date(now.getTime() - 3 * 60 * 60 * 1000);
  const target = new Date(brt);
  target.setDate(target.getDate() - daysAgo);
  const start = target.toISOString().split("T")[0] + "T00:00:00-03:00";
  const endDate = new Date(target);
  endDate.setDate(endDate.getDate() + 1);
  const end = endDate.toISOString().split("T")[0] + "T00:00:00-03:00";
  return { start, end };
}

function arrow(current: number, previous: number): string {
  if (current > previous) return `⬆️ +${current - previous}`;
  if (current < previous) return `⬇️ ${current - previous}`;
  return "➡️ =";
}

// ── Main Logic ──

async function generateDailyReport(): Promise<string> {
  const yesterday = getDateRange(1);
  const dayBefore = getDateRange(2);

  // Fetch stages
  const stagesRaw = await supabaseFetch(
    `opportunity_stages?workspace_id=eq.${WORKSPACE_ID}&select=id,name,order_position,is_scheduling`
  );
  const stages: Record<string, { name: string; order: number; is_scheduling: boolean }> = {};
  if (Array.isArray(stagesRaw)) {
    for (const s of stagesRaw) {
      const st = s as { id: string; name: string; order_position: number; is_scheduling: boolean };
      stages[st.id] = { name: st.name, order: st.order_position, is_scheduling: st.is_scheduling };
    }
  }

  // Leads yesterday
  const leadsYesterdayRaw = await supabaseFetch(
    `opportunities?workspace_id=eq.${WORKSPACE_ID}&created_at=gte.${yesterday.start}&created_at=lt.${yesterday.end}&select=id,lead_name,lead_score,source,custom_fields,estimated_value,current_stage_id,session_scheduled_at,won_at,lost_at`
  );
  const leadsYesterday: Record<string, unknown>[] = Array.isArray(leadsYesterdayRaw) ? leadsYesterdayRaw : [];

  const leadsDayBeforeRaw = await supabaseFetch(
    `opportunities?workspace_id=eq.${WORKSPACE_ID}&created_at=gte.${dayBefore.start}&created_at=lt.${dayBefore.end}&select=id`
  );
  const leadsDayBeforeCount = Array.isArray(leadsDayBeforeRaw) ? leadsDayBeforeRaw.length : 0;

  // Funnel
  let mql = 0, desqualificados = 0, sqlCount = 0;
  for (const lead of leadsYesterday) {
    const stage = stages[lead.current_stage_id as string];
    if (!stage) continue;
    if (DESQUALIFICADO_STAGES.includes(stage.name)) { desqualificados++; continue; }
    if (stage.order >= 2) mql++;
    if (stage.order >= 3 && stage.name !== NO_SHOW_STAGE) sqlCount++;
  }

  // UTMs
  const utmCounts: Record<string, number> = {};
  for (const lead of leadsYesterday) {
    const cf = lead.custom_fields as Record<string, unknown> | null;
    const src = (cf?.utm_source || cf?._utm_source || lead.source || "direto") as string;
    utmCounts[src] = (utmCounts[src] || 0) + 1;
  }
  const utmLines = Object.entries(utmCounts)
    .sort((a, b) => b[1] - a[1])
    .map(([src, count]) => `  • ${src}: ${count}`)
    .join("\n");

  // Sessions
  const sessArr: Record<string, unknown>[] = await supabaseFetch(
    `opportunities?workspace_id=eq.${WORKSPACE_ID}&session_scheduled_at=gte.${yesterday.start}&session_scheduled_at=lt.${yesterday.end}&select=id,lead_name,current_stage_id,won_at,lost_at`
  ).then((d: unknown) => Array.isArray(d) ? d : []);

  const sessDayBeforeRaw = await supabaseFetch(
    `opportunities?workspace_id=eq.${WORKSPACE_ID}&session_scheduled_at=gte.${dayBefore.start}&session_scheduled_at=lt.${dayBefore.end}&select=id,current_stage_id,won_at,lost_at`
  );
  const sessDayBeforeCount = Array.isArray(sessDayBeforeRaw) ? sessDayBeforeRaw.length : 0;

  let realizedCount = 0;
  const noShowList: string[] = [];
  for (const s of sessArr) {
    const stage = stages[s.current_stage_id as string];
    if (!stage) continue;
    if (stage.name === NO_SHOW_STAGE) {
      noShowList.push(s.lead_name as string);
    } else if (!stage.is_scheduling || s.won_at || s.lost_at) {
      realizedCount++;
    }
  }

  let realizedDayBefore = 0;
  const sessDayBeforeArr: Record<string, unknown>[] = Array.isArray(sessDayBeforeRaw) ? sessDayBeforeRaw : [];
  for (const s of sessDayBeforeArr) {
    const stage = stages[s.current_stage_id as string];
    if (!stage) continue;
    if (stage.name !== NO_SHOW_STAGE && (!stage.is_scheduling || s.won_at || s.lost_at)) {
      realizedDayBefore++;
    }
  }

  // Won
  const wonArr: Record<string, unknown>[] = await supabaseFetch(
    `opportunities?workspace_id=eq.${WORKSPACE_ID}&won_at=gte.${yesterday.start}&won_at=lt.${yesterday.end}&select=id,lead_name,negotiated_value,estimated_value`
  ).then((d: unknown) => Array.isArray(d) ? d : []);
  const totalWonValue = wonArr.reduce((sum, o) => sum + Number(o.negotiated_value || o.estimated_value || 0), 0);

  // Lost
  const lostArr: Record<string, unknown>[] = await supabaseFetch(
    `opportunities?workspace_id=eq.${WORKSPACE_ID}&lost_at=gte.${yesterday.start}&lost_at=lt.${yesterday.end}&select=id,lead_name,loss_reason`
  ).then((d: unknown) => Array.isArray(d) ? d : []);

  // Pipeline
  const pipelineArr: Record<string, unknown>[] = await supabaseFetch(
    `opportunities?workspace_id=eq.${WORKSPACE_ID}&won_at=is.null&lost_at=is.null&select=estimated_value`
  ).then((d: unknown) => Array.isArray(d) ? d : []);
  const pipelineValue = pipelineArr.reduce((sum, o) => sum + Number(o.estimated_value || 0), 0);

  // Build report (sem saudação - será adicionada por destinatário)
  const dateStr = new Date(yesterday.start).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "America/Sao_Paulo" });

  let report = `📊 *Relatório CRM — ${dateStr}*\n\n`;

  report += `*Leads Novos:* ${leadsYesterday.length} ${arrow(leadsYesterday.length, leadsDayBeforeCount)}\n`;
  report += `  ✅ MQL (qualificados): ${mql}\n`;
  report += `  ❌ Desqualificados: ${desqualificados}\n`;
  report += `  📋 SQL: ${sqlCount}\n`;
  if (utmLines) report += `\n*Origens:*\n${utmLines}\n`;

  report += `\n*Reuniões Agendadas:* ${sessArr.length} ${arrow(sessArr.length, sessDayBeforeCount)}\n`;
  report += `*Reuniões Realizadas:* ${realizedCount} ${arrow(realizedCount, realizedDayBefore)}\n`;
  if (noShowList.length > 0) {
    report += `*No-Shows:* ${noShowList.length} 🚫\n`;
    for (const name of noShowList) report += `  • ${name}\n`;
  }

  report += `\n*Fechamentos:* ${wonArr.length} 🏆\n`;
  if (wonArr.length > 0) {
    report += `*Valor Total:* ${formatCurrency(totalWonValue)}\n`;
    for (const w of wonArr) report += `  • ${w.lead_name} — ${formatCurrency(Number(w.negotiated_value || w.estimated_value || 0))}\n`;
  }

  if (lostArr.length > 0) {
    report += `\n*Perdas:* ${lostArr.length} ❌\n`;
    for (const l of lostArr) report += `  • ${l.lead_name} — ${l.loss_reason || "Sem motivo"}\n`;
  }

  report += `\n💼 *Pipeline Ativo:* ${pipelineArr.length} leads — ${formatCurrency(pipelineValue)}`;

  return report;
}

// ── Handler ──

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return corsPreflightResponse();

  try {
    const report = await generateDailyReport();
    const subscribers = await getSubscribers();

    if (subscribers.length === 0) {
      return jsonResponse({ success: true, message: "No subscribers" });
    }

    // Send with personalized greeting per subscriber
    const results = await Promise.allSettled(
      subscribers.map((sub) => {
        const greeting = getGreeting(sub.phone, sub.name);
        const message = `${greeting}\n\n${report}`;
        return sendWhatsApp(sub.phone, message);
      })
    );

    const sent = results.filter((r) => r.status === "fulfilled").length;
    console.log(`[crm-daily-report] Sent to ${sent}/${subscribers.length} subscribers`);
    return jsonResponse({ success: true, sent });
  } catch (err) {
    console.error("[crm-daily-report] Error:", err);
    return errorResponse(String(err), 500);
  }
});
