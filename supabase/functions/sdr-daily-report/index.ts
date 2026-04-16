import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { jsonResponse, errorResponse, corsPreflightResponse } from "../_shared/cors.ts";

const EVOLUTION_API_URL = "https://whatsappapi.winhub.com.br";
const EVOLUTION_API_KEY = "cda34a5c9f0702a581b0f6a03a1466a4";
const EVOLUTION_INSTANCE = "sdrai-whatsapp";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const WORKSPACE_ID = "8eaae987-1b56-43de-978c-c135beb30c7e";

const RECIPIENTS = [
  "556296449901",  // Yago
  "554792817316",  // Alex
];

async function supabaseFetch(path: string) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: {
      "apikey": SUPABASE_SERVICE_KEY,
      "Authorization": `Bearer ${SUPABASE_SERVICE_KEY}`,
      "Content-Type": "application/json",
    },
  });
  return res.json();
}

async function execSql(query: string) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/exec_sql`, {
    method: "POST",
    headers: {
      "apikey": SUPABASE_SERVICE_KEY,
      "Authorization": `Bearer ${SUPABASE_SERVICE_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query }),
  });
  return res.json();
}

async function sendWhatsApp(phone: string, text: string) {
  await fetch(`${EVOLUTION_API_URL}/message/sendText/${EVOLUTION_INSTANCE}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "apikey": EVOLUTION_API_KEY },
    body: JSON.stringify({ number: phone, text }),
  });
}

function getBrtNow(): Date {
  const now = new Date();
  return new Date(now.getTime() - 3 * 60 * 60 * 1000);
}

function formatCurrency(value: number): string {
  return `R$ ${value.toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

function getGreeting(): string {
  const variations = [
    "bom dia chefe!",
    "bom dia!",
    "oi, bom dia!",
    "bom dia pessoal!",
    "dia!",
  ];
  return variations[Math.floor(Math.random() * variations.length)];
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return corsPreflightResponse();

  try {
    const brt = getBrtNow();
    const today = brt.toISOString().slice(0, 10);
    const yesterday = new Date(brt.getTime() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const monthStart = today.slice(0, 7) + "-01";

    // 1. Leads novos ontem
    const leadsYesterday = await execSql(`
      SELECT COUNT(*) as total FROM opportunities
      WHERE workspace_id = '${WORKSPACE_ID}'
        AND created_at::date = '${yesterday}'
    `);
    const newLeads = leadsYesterday?.[0]?.total || 0;

    // 2. Qualificados ontem (nota de stage_change pra Qualificação)
    const qualYesterday = await execSql(`
      SELECT COUNT(DISTINCT n.opportunity_id) as total
      FROM opportunity_notes n
      JOIN opportunities o ON o.id = n.opportunity_id
      WHERE o.workspace_id = '${WORKSPACE_ID}'
        AND n.note_type = 'stage_change'
        AND n.created_at::date = '${yesterday}'
        AND split_part(n.content, 'para', 2) ILIKE '%Qualificação%'
    `);
    const qualified = qualYesterday?.[0]?.total || 0;

    // 3. Reuniões realizadas ontem (saiu de Sessão Agendada pra algo que não é No Show)
    const meetingsYesterday = await execSql(`
      SELECT COUNT(DISTINCT n.opportunity_id) as total
      FROM opportunity_notes n
      JOIN opportunities o ON o.id = n.opportunity_id
      WHERE o.workspace_id = '${WORKSPACE_ID}'
        AND n.note_type = 'stage_change'
        AND n.created_at::date = '${yesterday}'
        AND (split_part(n.content, 'para', 1) ILIKE '%Sessão Agendada%'
             OR split_part(n.content, 'para', 1) ILIKE '%Agendado Automaticamente%')
        AND split_part(n.content, 'para', 2) NOT ILIKE '%No Show%'
        AND split_part(n.content, 'para', 2) NOT ILIKE '%Sessão Agendada%'
    `);
    const meetingsDone = meetingsYesterday?.[0]?.total || 0;

    // 4. Fechamentos ontem
    const winsYesterday = await execSql(`
      SELECT COUNT(*) as total, COALESCE(SUM(negotiated_value), 0) as valor
      FROM opportunities
      WHERE workspace_id = '${WORKSPACE_ID}'
        AND won_at::date = '${yesterday}'
    `);
    const winsCount = winsYesterday?.[0]?.total || 0;
    const winsValue = Number(winsYesterday?.[0]?.valor || 0);

    // 5. Acumulado do mês
    const monthWins = await execSql(`
      SELECT COUNT(*) as total, COALESCE(SUM(negotiated_value), 0) as valor
      FROM opportunities
      WHERE workspace_id = '${WORKSPACE_ID}'
        AND won_at >= '${monthStart}'
        AND won_at < '${today}'::date + 1
    `);
    const monthWinsCount = monthWins?.[0]?.total || 0;
    const monthWinsValue = Number(monthWins?.[0]?.valor || 0);

    // 6. Meta
    const workspace = await supabaseFetch(
      `workspaces?id=eq.${WORKSPACE_ID}&select=sales_goal`
    );
    const salesGoal = Number(workspace?.[0]?.sales_goal || 0);
    const goalPct = salesGoal > 0 ? ((monthWinsValue / salesGoal) * 100).toFixed(1) : "—";

    // 7. Leads parados (sem stage_change há mais de 3 dias, exceto stages finais)
    const stuckLeads = await execSql(`
      WITH last_move AS (
        SELECT n.opportunity_id, MAX(n.created_at) as last_change
        FROM opportunity_notes n
        JOIN opportunities o ON o.id = n.opportunity_id
        WHERE o.workspace_id = '${WORKSPACE_ID}'
          AND n.note_type = 'stage_change'
        GROUP BY n.opportunity_id
      )
      SELECT o.lead_name, s.name as stage_name,
        EXTRACT(DAY FROM NOW() - COALESCE(lm.last_change, o.created_at))::int as dias_parado
      FROM opportunities o
      JOIN opportunity_stages s ON s.id = o.current_stage_id
      LEFT JOIN last_move lm ON lm.opportunity_id = o.id
      WHERE o.workspace_id = '${WORKSPACE_ID}'
        AND o.won_at IS NULL
        AND o.lost_at IS NULL
        AND s.name NOT IN ('Ganho', 'Perdido', 'Desqualificado', 'Fim de Cadência')
        AND EXTRACT(DAY FROM NOW() - COALESCE(lm.last_change, o.created_at)) > 3
      ORDER BY dias_parado DESC
      LIMIT 5
    `);

    // 8. Reuniões de hoje
    const meetingsToday = await execSql(`
      SELECT o.lead_name,
        TO_CHAR(m.scheduled_at AT TIME ZONE 'America/Sao_Paulo', 'HH24:MI') as horario
      FROM sdr_meetings m
      JOIN sdr_leads sl ON sl.phone = m.phone AND sl.workspace_id = m.workspace_id
      JOIN opportunities o ON o.lead_phone = m.phone AND o.workspace_id = m.workspace_id
      WHERE m.workspace_id = '${WORKSPACE_ID}'
        AND m.status = 'scheduled'
        AND (m.scheduled_at AT TIME ZONE 'America/Sao_Paulo')::date = '${today}'
      ORDER BY m.scheduled_at
    `);

    // Fallback: buscar reuniões do CRM (bookings/calendar)
    const crmMeetingsToday = await execSql(`
      SELECT o.lead_name,
        TO_CHAR(o.session_scheduled_at AT TIME ZONE 'America/Sao_Paulo', 'HH24:MI') as horario
      FROM opportunities o
      WHERE o.workspace_id = '${WORKSPACE_ID}'
        AND o.session_scheduled_at IS NOT NULL
        AND (o.session_scheduled_at AT TIME ZONE 'America/Sao_Paulo')::date = '${today}'
        AND o.won_at IS NULL
        AND o.lost_at IS NULL
      ORDER BY o.session_scheduled_at
    `);

    // Merge meetings (sem duplicar)
    const allMeetings = new Map<string, { lead_name: string; horario: string }>();
    (meetingsToday || []).forEach((m: any) => allMeetings.set(m.horario + m.lead_name, m));
    (crmMeetingsToday || []).forEach((m: any) => allMeetings.set(m.horario + m.lead_name, m));
    const todayMeetings = Array.from(allMeetings.values()).sort((a, b) => a.horario.localeCompare(b.horario));

    // Montar mensagem
    const dayNames: Record<number, string> = { 0: "domingo", 1: "segunda", 2: "terça", 3: "quarta", 4: "quinta", 5: "sexta", 6: "sábado" };
    const brtDay = new Date(brt.getTime());
    const dayName = dayNames[brtDay.getUTCDay()] || "";

    let msg = `${getGreeting()} resumo de ontem:\n\n`;

    // Ontem
    msg += `📊 *ontem:*\n`;
    msg += `• ${newLeads} leads novos\n`;
    msg += `• ${qualified} qualificados\n`;
    msg += `• ${meetingsDone} reuniões realizadas\n`;
    if (winsCount > 0) {
      msg += `• ${winsCount} fechamento${winsCount > 1 ? "s" : ""} — ${formatCurrency(winsValue)}\n`;
    } else {
      msg += `• nenhum fechamento\n`;
    }

    // Mês
    msg += `\n📈 *abril até agora:*\n`;
    msg += `• ${monthWinsCount} vendas — ${formatCurrency(monthWinsValue)}\n`;
    if (salesGoal > 0) {
      msg += `• meta: ${formatCurrency(salesGoal)} → ${goalPct}%\n`;
    }

    // Leads parados
    if (stuckLeads && stuckLeads.length > 0) {
      msg += `\n⚠️ *leads parados:*\n`;
      stuckLeads.forEach((l: any) => {
        msg += `• ${l.lead_name} — ${l.stage_name} há ${l.dias_parado} dias\n`;
      });
    }

    // Reuniões de hoje
    if (todayMeetings.length > 0) {
      msg += `\n📅 *reuniões hoje (${dayName}):*\n`;
      todayMeetings.forEach((m: any) => {
        msg += `• ${m.horario} — ${m.lead_name}\n`;
      });
    } else {
      msg += `\n📅 *nenhuma reunião hoje (${dayName})*\n`;
    }

    // Enviar pra cada destinatario
    for (const phone of RECIPIENTS) {
      await sendWhatsApp(phone, msg.trim());
    }

    return jsonResponse({
      success: true,
      sent_to: RECIPIENTS.length,
      message_preview: msg.trim().slice(0, 200),
    });
  } catch (err) {
    console.error("sdr-daily-report error:", err);
    return errorResponse(String(err), 500);
  }
});
