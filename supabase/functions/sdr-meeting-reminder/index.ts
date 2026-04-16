import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const EVOLUTION_API_URL = "https://whatsappapi.winhub.com.br";
const EVOLUTION_API_KEY = "cda34a5c9f0702a581b0f6a03a1466a4";
const EVOLUTION_INSTANCE = "sdrai-whatsapp";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// Timezone: America/Sao_Paulo = UTC-3
const BRT_OFFSET_MS = -3 * 60 * 60 * 1000;

function getNowBRT(): Date {
  const now = new Date();
  return new Date(now.getTime() + BRT_OFFSET_MS);
}

function toBRT(date: Date): Date {
  return new Date(date.getTime() + BRT_OFFSET_MS);
}

async function supabaseFetch(path: string, options?: RequestInit) {
  return fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...options,
    headers: {
      "apikey": SUPABASE_SERVICE_KEY,
      "Authorization": `Bearer ${SUPABASE_SERVICE_KEY}`,
      "Content-Type": "application/json",
      "Prefer": "return=minimal",
      ...options?.headers,
    },
  });
}

async function getScheduledMeetings() {
  const res = await supabaseFetch(
    `sdr_meetings?status=eq.scheduled&select=*&order=scheduled_at.asc`,
    { headers: { "apikey": SUPABASE_SERVICE_KEY, "Authorization": `Bearer ${SUPABASE_SERVICE_KEY}`, "Content-Type": "application/json", "Prefer": "return=representation" } },
  );
  if (!res.ok) return [];
  return res.json();
}

async function updateMeeting(id: string, updates: Record<string, unknown>) {
  await supabaseFetch(`sdr_meetings?id=eq.${id}`, {
    method: "PATCH",
    body: JSON.stringify(updates),
  });
}

async function sendWhatsApp(number: string, text: string) {
  await fetch(`${EVOLUTION_API_URL}/message/sendText/${EVOLUTION_INSTANCE}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "apikey": EVOLUTION_API_KEY },
    body: JSON.stringify({ number, text }),
  });
}

interface Meeting {
  id: string;
  phone: string;
  lead_name: string;
  group_jid: string;
  meet_link: string;
  scheduled_at: string;
  reminder_morning_sent: boolean;
  reminder_30min_sent: boolean;
  status: string;
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST" && req.method !== "GET") {
    return new Response("OK", { status: 200 });
  }

  try {
    const meetings: Meeting[] = await getScheduledMeetings();
    let morningReminders = 0;
    let thirtyMinReminders = 0;

    const nowUTC = new Date();
    const nowBRT = getNowBRT();
    const nowBRTHour = nowBRT.getUTCHours();

    for (const meeting of meetings) {
      if (!meeting.group_jid) continue;

      const meetingUTC = new Date(meeting.scheduled_at);
      const meetingBRT = toBRT(meetingUTC);
      const leadName = meeting.lead_name || "";

      // Formatar horário da reunião
      const meetHour = meetingBRT.getUTCHours();
      const dayNames = ["domingo", "segunda-feira", "terça-feira", "quarta-feira", "quinta-feira", "sexta-feira", "sábado"];
      const dayName = dayNames[meetingBRT.getUTCDay()];

      // LEMBRETE DA MANHÃ: enviado a partir das 8h BRT no dia da reunião
      if (!meeting.reminder_morning_sent) {
        const meetingDay = meetingBRT.toISOString().slice(0, 10);
        const todayBRT = nowBRT.toISOString().slice(0, 10);

        if (meetingDay === todayBRT && nowBRTHour >= 8) {
          const morningMsg = `Bom dia${leadName ? `, ${leadName}` : ""}! Só passando pra lembrar que a nossa consultoria de hoje é às ${meetHour}h.\n\nLink da reunião: ${meeting.meet_link}\n\nAté mais tarde!`;
          // Enviar no grupo E no PV do lead
          if (meeting.group_jid) await sendWhatsApp(meeting.group_jid, morningMsg);
          if (meeting.phone) await sendWhatsApp(meeting.phone, morningMsg);
          await updateMeeting(meeting.id, { reminder_morning_sent: true });
          morningReminders++;
        }
      }

      // LEMBRETE DE 30 MINUTOS: enviado quando faltam 30min ou menos
      if (!meeting.reminder_30min_sent) {
        const msUntilMeeting = meetingUTC.getTime() - nowUTC.getTime();
        const minutesUntil = msUntilMeeting / (60 * 1000);

        if (minutesUntil <= 30 && minutesUntil > -5) {
          const thirtyMinMsgGroup = `Gente, faltam 30 minutinhos pra nossa reunião!\n\nLink: ${meeting.meet_link}\n\nAté já!`;
          const thirtyMinMsgPv = `${leadName ? leadName + ", " : ""}faltam 30 minutinhos pra nossa reunião!\n\nLink: ${meeting.meet_link}\n\nTe espero lá!`;
          // Enviar no grupo E no PV do lead
          if (meeting.group_jid) await sendWhatsApp(meeting.group_jid, thirtyMinMsgGroup);
          if (meeting.phone) await sendWhatsApp(meeting.phone, thirtyMinMsgPv);
          await updateMeeting(meeting.id, { reminder_30min_sent: true });
          thirtyMinReminders++;
        }
      }

      // Marcar como completed se já passou 2h da reunião
      const msAfterMeeting = nowUTC.getTime() - meetingUTC.getTime();
      if (msAfterMeeting > 2 * 60 * 60 * 1000) {
        await updateMeeting(meeting.id, { status: "completed" });
      }
    }

    return new Response(JSON.stringify({
      success: true,
      meetings_checked: meetings.length,
      morning_reminders: morningReminders,
      thirty_min_reminders: thirtyMinReminders,
    }), { status: 200, headers: { "Content-Type": "application/json" } });
  } catch (err) {
    console.error("Meeting reminder error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { "Content-Type": "application/json" },
    });
  }
});
