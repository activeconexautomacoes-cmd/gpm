// Google Calendar API module - REST puro, sem npm
// Usa service account JWT para autenticação

const GOOGLE_CALENDAR_SCOPE = "https://www.googleapis.com/auth/calendar";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";

let cachedToken: { token: string; expiresAt: number } | null = null;

function base64urlEncode(data: Uint8Array): string {
  return btoa(String.fromCharCode(...data))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function base64urlEncodeStr(str: string): string {
  return base64urlEncode(new TextEncoder().encode(str));
}

function pemToArrayBuffer(pem: string): ArrayBuffer {
  const b64 = pem
    .replace(/-----[A-Z ]+-----/g, "")
    .replace(/[\s\r\n]/g, "");
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

async function createSignedJWT(serviceAccountEmail: string, privateKeyPem: string): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "RS256", typ: "JWT" };
  const payload = {
    iss: serviceAccountEmail,
    scope: GOOGLE_CALENDAR_SCOPE,
    aud: GOOGLE_TOKEN_URL,
    iat: now,
    exp: now + 3600,
  };

  const headerB64 = base64urlEncodeStr(JSON.stringify(header));
  const payloadB64 = base64urlEncodeStr(JSON.stringify(payload));
  const unsignedJWT = `${headerB64}.${payloadB64}`;

  const keyData = pemToArrayBuffer(privateKeyPem);
  const cryptoKey = await crypto.subtle.importKey(
    "pkcs8",
    keyData,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );

  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    cryptoKey,
    new TextEncoder().encode(unsignedJWT),
  );

  const signatureB64 = base64urlEncode(new Uint8Array(signature));
  return `${unsignedJWT}.${signatureB64}`;
}

export async function getAccessToken(): Promise<string> {
  if (cachedToken && Date.now() < cachedToken.expiresAt) {
    return cachedToken.token;
  }

  const saJson = Deno.env.get("GOOGLE_SERVICE_ACCOUNT_JSON");
  if (!saJson) throw new Error("GOOGLE_SERVICE_ACCOUNT_JSON not set");

  const sa = JSON.parse(saJson);
  const jwt = await createSignedJWT(sa.client_email, sa.private_key);

  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Google token error: ${err}`);
  }

  const data = await res.json();
  cachedToken = {
    token: data.access_token,
    expiresAt: Date.now() + (data.expires_in - 60) * 1000,
  };
  return cachedToken.token;
}

// Retorna horários livres nos próximos N dias úteis (seg-sex, 9h-18h BRT)
export async function getAvailableSlots(calendarId: string, days: number = 5): Promise<string[]> {
  const token = await getAccessToken();
  const now = new Date();
  const tz = "America/Sao_Paulo";

  // Calcular range: próximos N dias úteis
  const startDates: Date[] = [];
  const d = new Date(now);
  while (startDates.length < days) {
    d.setDate(d.getDate() + 1);
    const dow = d.getDay();
    if (dow >= 1 && dow <= 5) startDates.push(new Date(d));
  }

  const timeMin = startDates[0];
  timeMin.setHours(0, 0, 0, 0);
  const timeMax = new Date(startDates[startDates.length - 1]);
  timeMax.setHours(23, 59, 59, 999);

  // Ajustar para UTC (BRT = UTC-3)
  const timeMinUTC = new Date(timeMin.getTime() + 3 * 60 * 60 * 1000);
  const timeMaxUTC = new Date(timeMax.getTime() + 3 * 60 * 60 * 1000);

  const res = await fetch("https://www.googleapis.com/calendar/v3/freeBusy", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      timeMin: timeMinUTC.toISOString(),
      timeMax: timeMaxUTC.toISOString(),
      timeZone: tz,
      items: [{ id: calendarId }],
    }),
  });

  if (!res.ok) {
    console.error("FreeBusy error:", await res.text());
    return [];
  }

  const data = await res.json();
  const busyPeriods: { start: string; end: string }[] = data.calendars?.[calendarId]?.busy || [];

  // Gerar slots de 1h entre 9h-18h BRT nos dias úteis
  const slots: string[] = [];
  const dayNames = ["domingo", "segunda-feira", "terça-feira", "quarta-feira", "quinta-feira", "sexta-feira", "sábado"];

  for (const date of startDates) {
    for (let hour = 9; hour <= 17; hour++) {
      const slotStart = new Date(date);
      slotStart.setHours(hour, 0, 0, 0);
      const slotEnd = new Date(date);
      slotEnd.setHours(hour + 1, 0, 0, 0);

      // Converter para UTC para comparar com busy periods
      const slotStartUTC = new Date(slotStart.getTime() + 3 * 60 * 60 * 1000);
      const slotEndUTC = new Date(slotEnd.getTime() + 3 * 60 * 60 * 1000);

      const isBusy = busyPeriods.some((busy) => {
        const busyStart = new Date(busy.start).getTime();
        const busyEnd = new Date(busy.end).getTime();
        return slotStartUTC.getTime() < busyEnd && slotEndUTC.getTime() > busyStart;
      });

      if (!isBusy) {
        const dayName = dayNames[date.getDay()];
        const day = date.getDate().toString().padStart(2, "0");
        const month = (date.getMonth() + 1).toString().padStart(2, "0");
        slots.push(`${dayName} ${day}/${month} às ${hour}h`);
      }
    }
  }

  return slots;
}

// Cria evento no Google Calendar com link do Google Meet
export async function createMeetingEvent(
  calendarId: string,
  startTime: string, // ISO format: 2026-03-28T14:00
  leadName: string,
  leadPhone: string,
  leadEmail?: string,
): Promise<{ eventId: string; meetLink: string }> {
  const token = await getAccessToken();

  const start = new Date(startTime + ":00-03:00"); // BRT
  const end = new Date(start.getTime() + 40 * 60 * 1000); // 40 minutos

  const requestId = crypto.randomUUID();

  const res = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events?conferenceDataVersion=1`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        summary: `Consultoria Plus Mídia - ${leadName || leadPhone}`,
        description: `Consultoria gratuita com lead ${leadName || ""}.\nTelefone: ${leadPhone}\nAgendado pela SDR IA Maria Eduarda.`,
        start: { dateTime: start.toISOString(), timeZone: "America/Sao_Paulo" },
        end: { dateTime: end.toISOString(), timeZone: "America/Sao_Paulo" },
        attendees: [
          { email: "decioalmoplusmidia@gmail.com", displayName: "Closer" },
          { email: "alex.plusmidia@gmail.com", displayName: "Gerente Comercial" },
          ...(leadEmail ? [{ email: leadEmail, displayName: leadName || "Lead" }] : []),
        ],
        conferenceData: {
          createRequest: {
            requestId,
            conferenceSolutionKey: { type: "hangoutsMeet" },
          },
        },
        guestsCanModify: false,
        guestsCanInviteOthers: false,
        sendUpdates: "all",
        reminders: {
          useDefault: false,
          overrides: [
            { method: "popup", minutes: 30 },
            { method: "popup", minutes: 5 },
          ],
        },
      }),
    },
  );

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Google Calendar create error: ${err}`);
  }

  const event = await res.json();
  const meetLink = event.conferenceData?.entryPoints?.find(
    (ep: { entryPointType: string }) => ep.entryPointType === "video",
  )?.uri || event.hangoutLink || "";

  return { eventId: event.id, meetLink };
}
