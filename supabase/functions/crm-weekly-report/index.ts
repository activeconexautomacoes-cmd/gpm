import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { jsonResponse, errorResponse, corsPreflightResponse } from "../_shared/cors.ts";

/**
 * CRM Weekly Report — Relatório semanal toda sexta às 7h BRT
 * Envia via WhatsApp o resumo da semana:
 * - Fechamentos + valor total
 * - Funil: Leads → MQL → SQL → Agendamento → Realizadas → Ganhos
 * - 8 taxas de conversão entre cada etapa
 * - Comparativo com semana anterior
 * - Ranking closers, motivos de perda, pipeline ativo
 */

const EVOLUTION_API_URL = "https://whatsappapi.winhub.com.br";
const EVOLUTION_API_KEY = "cda34a5c9f0702a581b0f6a03a1466a4";
const EVOLUTION_INSTANCE = "sdrai-whatsapp";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const WORKSPACE_ID = "8eaae987-1b56-43de-978c-c135beb30c7e";

// Stage names for funnel classification
const DESQUALIFICADO_STAGES = ["Desqualificado", "Fim de Cadência"];
const NO_SHOW_STAGE = "No Show";

// ── Saudações personalizadas ──

const GREETINGS_CEO: string[] = [
  "Fala, chefe! Sexta-feira chegou e o resumo também 🚀",
  "E aí, meu CEO! Olha a semana que a gente fez 💪",
  "Chefão, bora ver os números da semana? 📊",
  "CEO, sexta é dia de resultado! Olha só 🏆",
  "Salve, chefe! Fechamento semanal na área ☕",
  "Boss, segue o resumão da semana! Bora 📈",
];

const GREETINGS_MANAGER: string[] = [
  "Fala, meu gerente! Resumo da semana pra você 🚀",
  "E aí, gerente! Sexta é dia de balanço 💪",
  "Meu líder comercial, olha os números da semana 📊",
  "Gerente, bora conferir como foi a semana? 🏆",
  "Capitão do comercial, resumo semanal na área ⚡",
  "Salve, gerente! Fechamento da semana chegou 📈",
];

const GREETINGS_GROUP: string[] = [
  "Boa noite, time! Resumo da semana chegou 🚀",
  "Sexta-feira, squad! Bora ver como foi a semana 💪",
  "Boa noite, equipe! Fechamento semanal na área 📊",
  "Time comercial, olha os resultados da semana 🏆",
  "Boa noite, galera! Semana encerrada, bora conferir 📈",
  "Squad, sexta é dia de celebrar os números! ⚡",
];

function randomGreeting(list: string[]): string {
  return list[Math.floor(Math.random() * list.length)];
}

function getGreeting(phone: string, name: string): string {
  if (phone.includes("@g.us")) return randomGreeting(GREETINGS_GROUP);
  if (name === "Alex") return randomGreeting(GREETINGS_MANAGER);
  return randomGreeting(GREETINGS_CEO);
}

interface Subscriber {
  phone: string;
  name: string;
}

// ── Helpers ──

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
  const res = await fetch(`${EVOLUTION_API_URL}/message/sendText/${EVOLUTION_INSTANCE}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "apikey": EVOLUTION_API_KEY },
    body: JSON.stringify({ number: phone, text }),
  });
  if (!res.ok) console.error(`WhatsApp error for ${phone}:`, await res.text());
}

async function getSubscribers(): Promise<Subscriber[]> {
  const data = await supabaseFetch(
    `crm_notification_subscribers?workspace_id=eq.${WORKSPACE_ID}&is_active=eq.true&notify_weekly_report=eq.true&select=phone,name`
  );
  return Array.isArray(data) ? data : [];
}

function formatCurrency(value: number): string {
  return `R$ ${value.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;
}

function getWeekRange(weeksAgo: number): { start: string; end: string; label: string } {
  const now = new Date();
  const brt = new Date(now.getTime() - 3 * 60 * 60 * 1000);

  const dayOfWeek = brt.getDay();
  const monday = new Date(brt);
  monday.setDate(brt.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1) - weeksAgo * 7);
  monday.setHours(0, 0, 0, 0);

  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 7);

  const label = `${monday.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })} a ${new Date(sunday.getTime() - 1).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}`;

  return { start: monday.toISOString(), end: sunday.toISOString(), label };
}

function arrow(current: number, previous: number): string {
  if (current > previous) return `⬆️ +${current - previous}`;
  if (current < previous) return `⬇️ ${current - previous}`;
  return "➡️ =";
}

function pct(num: number, den: number): string {
  if (den === 0) return "0%";
  return `${((num / den) * 100).toFixed(1).replace(".", ",")}%`;
}

// ── Main Logic ──

async function generateWeeklyReport(): Promise<string> {
  const thisWeek = getWeekRange(0);
  const lastWeek = getWeekRange(1);

  // Fetch leads created this week with stage info
  const leadsThisRaw = await supabaseFetch(
    `opportunities?workspace_id=eq.${WORKSPACE_ID}&created_at=gte.${thisWeek.start}&created_at=lt.${thisWeek.end}&select=id,lead_name,lead_score,source,current_stage_id,session_scheduled_at,won_at,lost_at`
  );
  const leadsThis: Record<string, unknown>[] = Array.isArray(leadsThisRaw) ? leadsThisRaw : [];

  // Fetch leads prev week (just count)
  const leadsPrevRaw = await supabaseFetch(
    `opportunities?workspace_id=eq.${WORKSPACE_ID}&created_at=gte.${lastWeek.start}&created_at=lt.${lastWeek.end}&select=id`
  );
  const leadsPrevCount = Array.isArray(leadsPrevRaw) ? leadsPrevRaw.length : 0;

  // Fetch all stages for mapping
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

  // Classify leads through the funnel
  const totalLeads = leadsThis.length;
  let mql = 0;
  let desqualificados = 0;
  let sqlCount = 0;
  let agendamentos = 0;
  let realizadas = 0;
  let noShows = 0;
  let ganhos = 0;

  for (const lead of leadsThis) {
    const stageId = lead.current_stage_id as string;
    const stage = stages[stageId];
    if (!stage) continue;

    const stageName = stage.name;
    const stageOrder = stage.order;

    // Desqualificado
    if (DESQUALIFICADO_STAGES.includes(stageName)) {
      desqualificados++;
      continue;
    }

    // MQL: passed "Novo Lead" (order >= 2), excluding desqualificados
    if (stageOrder >= 2) {
      mql++;
    }

    // SQL: reached Agendado Automaticamente or beyond (order >= 3), excluding No Show
    if (stageOrder >= 3 && stageName !== NO_SHOW_STAGE) {
      sqlCount++;
    }

    // Agendamento: has session_scheduled_at
    if (lead.session_scheduled_at) {
      agendamentos++;
    }

    // No Show
    if (stageName === NO_SHOW_STAGE) {
      noShows++;
    }

    // Realizadas: had session AND moved past scheduling stage, not no-show
    if (lead.session_scheduled_at && !stage.is_scheduling && stageName !== NO_SHOW_STAGE) {
      realizadas++;
    }

    // Ganhos (from this week's cohort)
    if (lead.won_at) {
      ganhos++;
    }
  }

  // Won deals this week (ALL, not just this week's cohort) for fechamentos section
  const wonThisRaw = await supabaseFetch(
    `opportunities?workspace_id=eq.${WORKSPACE_ID}&won_at=gte.${thisWeek.start}&won_at=lt.${thisWeek.end}&select=id,lead_name,negotiated_value,estimated_value,assigned_closer`
  );
  const wonLastRaw = await supabaseFetch(
    `opportunities?workspace_id=eq.${WORKSPACE_ID}&won_at=gte.${lastWeek.start}&won_at=lt.${lastWeek.end}&select=id,negotiated_value,estimated_value`
  );
  const wonThisArr: Record<string, unknown>[] = Array.isArray(wonThisRaw) ? wonThisRaw : [];
  const wonLastArr: Record<string, unknown>[] = Array.isArray(wonLastRaw) ? wonLastRaw : [];

  const totalWonThis = wonThisArr.reduce((sum, o) => sum + (Number(o.negotiated_value || o.estimated_value || 0)), 0);
  const totalWonLast = wonLastArr.reduce((sum, o) => sum + (Number(o.negotiated_value || o.estimated_value || 0)), 0);

  // Lost this week (ALL)
  const lostThisRaw = await supabaseFetch(
    `opportunities?workspace_id=eq.${WORKSPACE_ID}&lost_at=gte.${thisWeek.start}&lost_at=lt.${thisWeek.end}&select=id,lead_name,loss_reason`
  );
  const lostThisArr: Record<string, unknown>[] = Array.isArray(lostThisRaw) ? lostThisRaw : [];

  // Closer ranking
  const closerMap: Record<string, { name: string; won: number; value: number }> = {};
  for (const w of wonThisArr) {
    const closerId = (w.assigned_closer || "unassigned") as string;
    if (!closerMap[closerId]) closerMap[closerId] = { name: closerId, won: 0, value: 0 };
    closerMap[closerId].won++;
    closerMap[closerId].value += Number(w.negotiated_value || w.estimated_value || 0);
  }

  const closerIds = Object.keys(closerMap).filter((id) => id !== "unassigned");
  if (closerIds.length > 0) {
    const profilesRes = await supabaseFetch(
      `profiles?id=in.(${closerIds.join(",")})&select=id,full_name`
    );
    if (Array.isArray(profilesRes)) {
      for (const p of profilesRes) {
        const prof = p as { id: string; full_name: string };
        if (closerMap[prof.id]) closerMap[prof.id].name = prof.full_name || prof.id;
      }
    }
  }

  const closerRanking = Object.values(closerMap)
    .sort((a, b) => b.value - a.value)
    .map((c, i) => `  ${i + 1}. ${c.name} — ${c.won} fechamento(s) — ${formatCurrency(c.value)}`)
    .join("\n");

  // Pipeline ativo
  const pipelineRaw = await supabaseFetch(
    `opportunities?workspace_id=eq.${WORKSPACE_ID}&won_at=is.null&lost_at=is.null&select=estimated_value,lead_score`
  );
  const pipelineArr: Record<string, unknown>[] = Array.isArray(pipelineRaw) ? pipelineRaw : [];
  const pipelineValue = pipelineArr.reduce((sum, o) => sum + Number(o.estimated_value || 0), 0);
  const hotLeads = pipelineArr.filter((o) => o.lead_score === "quente");

  // Use total won this week (all deals) for conversion rates involving "Ganho"
  const totalGanhos = wonThisArr.length;

  // ── Build Report ──

  let report = `📈 *Relatório Semanal CRM — ${thisWeek.label}*\n\n`;

  // Fechamentos
  report += `🏆 *FECHAMENTOS DA SEMANA*\n`;
  report += `Total: *${totalGanhos} Ganhos* ${arrow(totalGanhos, wonLastArr.length)} (sem. anterior: ${wonLastArr.length})\n`;
  report += `Valor: *${formatCurrency(totalWonThis)}* ${arrow(totalWonThis, totalWonLast)}\n`;
  for (const w of wonThisArr) {
    report += `  • ${w.lead_name} — ${formatCurrency(Number(w.negotiated_value || w.estimated_value || 0))}\n`;
  }

  // Funil
  report += `\n📊 *FUNIL DA SEMANA*\n`;
  report += `Leads novos: *${totalLeads}* ${arrow(totalLeads, leadsPrevCount)} (sem. anterior: ${leadsPrevCount})\n`;
  report += `MQL (qualificados): *${mql}*\n`;
  report += `Desqualificados: *${desqualificados}*\n`;
  report += `SQL: *${sqlCount}*\n`;
  report += `Agendamentos: *${agendamentos}*\n`;
  report += `Realizadas: *${realizadas}*\n`;
  report += `No-shows: *${noShows}* 🚫\n`;
  report += `Perdas: *${lostThisArr.length}*\n`;

  // Taxas de conversão
  report += `\n📐 *TAXAS DE CONVERSÃO*\n`;
  report += `Lead → MQL: *${pct(mql, totalLeads)}*\n`;
  report += `MQL → SQL: *${pct(sqlCount, mql)}*\n`;
  report += `SQL → Agendamento: *${pct(agendamentos, sqlCount)}*\n`;
  report += `Agendada → Realizada: *${pct(realizadas, agendamentos)}*\n`;
  report += `MQL → Ganho: *${pct(totalGanhos, mql)}*\n`;
  report += `SQL → Ganho: *${pct(totalGanhos, sqlCount)}*\n`;
  report += `Agendado → Ganho: *${pct(totalGanhos, agendamentos)}*\n`;
  report += `Realizado → Ganho: *${pct(totalGanhos, realizadas)}*\n`;

  // Ranking closers
  if (closerRanking) {
    report += `\n👤 *RANKING CLOSERS*\n${closerRanking}\n`;
  }

  // Loss reasons
  if (lostThisArr.length > 0) {
    const reasonCounts: Record<string, number> = {};
    for (const l of lostThisArr) {
      const reason = (l.loss_reason || "Sem motivo") as string;
      reasonCounts[reason] = (reasonCounts[reason] || 0) + 1;
    }
    report += `\n❌ *MOTIVOS DE PERDA*\n`;
    for (const [reason, count] of Object.entries(reasonCounts).sort((a, b) => b[1] - a[1])) {
      report += `  • ${reason}: ${count}\n`;
    }
  }

  // Pipeline
  report += `\n💼 *PIPELINE ATIVO*\n`;
  report += `${pipelineArr.length} leads em aberto — ${formatCurrency(pipelineValue)}\n`;
  if (hotLeads.length > 0) {
    report += `🔥 ${hotLeads.length} lead(s) quente(s) pendente(s)\n`;
  }

  return report;
}

// ── Handler ──

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return corsPreflightResponse();

  try {
    const report = await generateWeeklyReport();
    const phones = await getSubscribers();

    if (phones.length === 0) {
      return jsonResponse({ success: true, message: "No subscribers" });
    }

    await Promise.allSettled(
      phones.map((sub) => {
        const greeting = getGreeting(sub.phone, sub.name);
        const message = `${greeting}\n\n${report}`;
        return sendWhatsApp(sub.phone, message);
      })
    );

    console.log(`[crm-weekly-report] Sent to ${phones.length} subscribers`);
    return jsonResponse({ success: true, sent: phones.length });
  } catch (err) {
    console.error("[crm-weekly-report] Error:", err);
    return errorResponse(String(err), 500);
  }
});
