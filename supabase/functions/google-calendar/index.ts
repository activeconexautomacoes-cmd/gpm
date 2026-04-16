
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const CALENDAR_ID = "comercial@plusmidiamkt.com";
const CALENDAR_ID_ENCODED = encodeURIComponent(CALENDAR_ID);

// Service Account authentication via Domain-Wide Delegation
function base64urlEncode(data: Uint8Array): string {
    return btoa(String.fromCharCode(...data)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function base64urlEncodeStr(str: string): string {
    return base64urlEncode(new TextEncoder().encode(str));
}
function pemToArrayBuffer(pem: string): ArrayBuffer {
    const b64 = pem.replace(/-----[A-Z ]+-----/g, "").replace(/[\s\r\n]/g, "");
    const binary = atob(b64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return bytes.buffer;
}

let cachedToken: { token: string; expiresAt: number } | null = null;

async function getCalendarToken(): Promise<string> {
    if (cachedToken && Date.now() < cachedToken.expiresAt) return cachedToken.token;

    const saJson = Deno.env.get("GOOGLE_SERVICE_ACCOUNT_JSON");
    if (!saJson) throw new Error("GOOGLE_SERVICE_ACCOUNT_JSON not set");
    const sa = JSON.parse(saJson);

    const now = Math.floor(Date.now() / 1000);
    const header = { alg: "RS256", typ: "JWT" };
    const payload = {
        iss: sa.client_email,
        sub: CALENDAR_ID, // Domain-wide delegation
        scope: "https://www.googleapis.com/auth/calendar",
        aud: "https://oauth2.googleapis.com/token",
        iat: now,
        exp: now + 3600,
    };

    const headerB64 = base64urlEncodeStr(JSON.stringify(header));
    const payloadB64 = base64urlEncodeStr(JSON.stringify(payload));
    const unsignedJWT = `${headerB64}.${payloadB64}`;

    const keyData = pemToArrayBuffer(sa.private_key);
    const cryptoKey = await crypto.subtle.importKey("pkcs8", keyData, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["sign"]);
    const signature = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", cryptoKey, new TextEncoder().encode(unsignedJWT));
    const jwt = `${unsignedJWT}.${base64urlEncode(new Uint8Array(signature))}`;

    const res = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: jwt }),
    });
    if (!res.ok) throw new Error(`Google token error: ${await res.text()}`);
    const data = await res.json();
    cachedToken = { token: data.access_token, expiresAt: Date.now() + (data.expires_in - 60) * 1000 };
    return cachedToken.token;
}

// Legacy helper kept for backward compatibility (now just returns service account token)
async function getCloserAccessToken(_supabase: any, _closerId: any, _clientId: any, _clientSecret: any) {
    return await getCalendarToken();
}

// Helper: Resolve dynamic summary template
async function resolveEventSummary(supabase: any, closerId: any, opportunityId: any, fallbackSummary: any, leadNameOverride: any = null, leadCompanyOverride: any = null) {
    // 1. Fetch template from integration
    const { data: integration } = await supabase
        .from("integrations")
        .select("*")
        .eq("user_id", closerId)
        .eq("provider", "google")
        .maybeSingle();

    const calendarSettings = (integration as any)?.calendar_settings;
    let template = fallbackSummary || calendarSettings?.event_title_template || "Reunião CRM: {lead_name}";

    // 2. Resolve opportunity details (Priority to overrides from frontend)
    let leadName = leadNameOverride;
    let leadCompany = leadCompanyOverride;

    if (opportunityId) {
        const { data: opp } = await supabase
            .from("opportunities")
            .select("lead_name, lead_company")
            .eq("id", opportunityId)
            .maybeSingle();

        if (opp) {
            leadName = leadName || opp.lead_name || "";
            leadCompany = leadCompany || opp.lead_company || "";
        }
    }

    // Safety check for empty values
    leadName = leadName || "Lead";
    leadCompany = leadCompany || "Empresa";

    // 3. Robust Replacement Logic
    let resolvedSummary = String(template);

    // Use a simple loop/split-join to avoid any regex issues with curly braces
    const replaceVar = (str: string, key: string, val: string) => {
        return str.split(key).join(val || "");
    };

    resolvedSummary = replaceVar(resolvedSummary, "{lead_name}", leadName || "Nome do Lead");
    resolvedSummary = replaceVar(resolvedSummary, "{lead_company}", leadCompany || "Nome da Empresa");
    resolvedSummary = replaceVar(resolvedSummary, "{company_name}", leadCompany || "Nome da Empresa");

    return resolvedSummary;
}

serve(async (req) => {
    if (req.method === "OPTIONS") {
        return new Response("ok", { headers: corsHeaders });
    }

    try {
        const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
        const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
        const supabase = createClient(supabaseUrl, supabaseKey);

        const GOOGLE_CLIENT_ID = Deno.env.get("GOOGLE_CLIENT_ID")!;
        const GOOGLE_CLIENT_SECRET = Deno.env.get("GOOGLE_CLIENT_SECRET")!;

        const { action, ...data } = await req.json();

        if (action === "get-slots") {
            const { closer_id, closer_ids, date, duration_minutes = 30, find_nearest = true } = data;
            const targetClosers = closer_ids || (closer_id ? [closer_id] : []);

            if (targetClosers.length === 0) {
                throw new Error("No closer specified");
            }

            let targetDateStr = date;
            let foundSlots = [];
            let attempts = 0;
            const maxAttempts = find_nearest ? 14 : 1;

            while (attempts < maxAttempts) {
                const targetDateObj = new Date(targetDateStr);
                const dayOfWeek = targetDateObj.getUTCDay();
                const daySlots = new Map(); // Use Map to avoid duplicate start times

                for (const cId of targetClosers) {
                    const accessToken = await getCloserAccessToken(supabase, cId, GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET);
                    if (!accessToken) continue;

                    const { data: schedule } = await supabase
                        .from("availability_schedules")
                        .select("*")
                        .eq("user_id", cId)
                        .eq("day_of_week", dayOfWeek)
                        .maybeSingle();

                    let activeSchedule = schedule;
                    if (!activeSchedule && dayOfWeek >= 1 && dayOfWeek <= 5) {
                        activeSchedule = { start_time: '09:00:00', end_time: '17:00:00', is_active: true };
                    }

                    if (activeSchedule && activeSchedule.is_active) {
                        const searchMin = new Date(`${targetDateStr}T00:00:00-03:00`).toISOString();
                        const searchMax = new Date(new Date(`${targetDateStr}T23:59:59-03:00`).getTime()).toISOString();

                        const freeBusyRes = await fetch("https://www.googleapis.com/calendar/v3/freeBusy", {
                            method: "POST",
                            headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
                            body: JSON.stringify({
                                timeMin: searchMin,
                                timeMax: searchMax,
                                items: [{ id: CALENDAR_ID }]
                            })
                        });

                        if (freeBusyRes.ok) {
                            const freeBusyData = await freeBusyRes.json();
                            const busySlots = freeBusyData.calendars[CALENDAR_ID].busy;

                            const workWindows = [];
                            if (activeSchedule.start_time && activeSchedule.end_time) {
                                workWindows.push({ start: activeSchedule.start_time, end: activeSchedule.end_time });
                            }
                            if (activeSchedule.start_time_2 && activeSchedule.end_time_2) {
                                workWindows.push({ start: activeSchedule.start_time_2, end: activeSchedule.end_time_2 });
                            }

                            for (const window of workWindows) {
                                const startWorkStr = `${targetDateStr}T${window.start}${window.start.length === 5 ? ':00' : ''}-03:00`;
                                const endWorkStr = `${targetDateStr}T${window.end}${window.end.length === 5 ? ':00' : ''}-03:00`;

                                const startWork = new Date(startWorkStr);
                                const endWork = new Date(endWorkStr);

                                let currentSlot = startWork.getTime();
                                const endWorkTime = endWork.getTime();
                                const durationMs = duration_minutes * 60 * 1000;

                                while (currentSlot + durationMs <= endWorkTime) {
                                    const slotStart = new Date(currentSlot);
                                    const slotEnd = new Date(currentSlot + durationMs);

                                    const isBusy = busySlots.some((busy: any) => {
                                        const busyStart = new Date(busy.start).getTime();
                                        const busyEnd = new Date(busy.end).getTime();
                                        return (slotStart.getTime() < busyEnd && slotEnd.getTime() > busyStart);
                                    });

                                    if (slotStart < new Date() || isBusy) {
                                        currentSlot += durationMs;
                                        continue;
                                    }

                                    const slotKey = slotStart.toISOString();
                                    if (!daySlots.has(slotKey)) {
                                        daySlots.set(slotKey, { start: slotKey, end: slotEnd.toISOString() });
                                    }
                                    currentSlot += durationMs;
                                }
                            }
                        }
                    }
                }

                if (daySlots.size > 0) {
                    foundSlots = Array.from(daySlots.values()).sort((a, b) => a.start.localeCompare(b.start));
                    break;
                }

                attempts++;
                const d = new Date(targetDateStr);
                d.setUTCDate(d.getUTCDate() + 1);
                targetDateStr = d.toISOString().split('T')[0];
            }

            return new Response(JSON.stringify({ slots: foundSlots, date: targetDateStr }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }

        if (action === "create-booking") {
            const { closer_id, closer_ids, opportunity_id, start_time, end_time, lead_email, summary } = data;

            // SAFETY: Clean up any existing or orphan bookings for this opportunity before creating a new one
            if (opportunity_id) {
                const { data: existing } = await supabase.from("bookings").select("*").eq("opportunity_id", opportunity_id);
                if (existing && existing.length > 0) {
                    for (const eb of existing) {
                        try {
                            const ebToken = await getCloserAccessToken(supabase, eb.closer_id, GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET);
                            if (ebToken && eb.google_event_id) {
                                await fetch(`https://www.googleapis.com/calendar/v3/calendars/comercial%40plusmidiamkt.com/events/${eb.google_event_id}?sendUpdates=none`, {
                                    method: "DELETE",
                                    headers: { Authorization: `Bearer ${ebToken}` }
                                });
                            }
                        } catch (e) {
                            console.error("Cleanup error for orphan google event:", e);
                        }
                    }
                    await supabase.from("bookings").delete().eq("opportunity_id", opportunity_id);
                }
            }

            const possibleClosers = closer_ids || (closer_id ? [closer_id] : []);
            if (possibleClosers.length === 0) throw new Error("No closer specified");

            // 1. Identify available closers for this specific timing
            const availableClosers = [];
            for (const cId of possibleClosers) {
                const accessToken = await getCloserAccessToken(supabase, cId, GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET);
                if (!accessToken) continue;

                // Simple busy check for the specific slot
                const freeBusyRes = await fetch("https://www.googleapis.com/calendar/v3/freeBusy", {
                    method: "POST",
                    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
                    body: JSON.stringify({
                        timeMin: start_time,
                        timeMax: end_time,
                        items: [{ id: CALENDAR_ID }]
                    })
                });

                if (freeBusyRes.ok) {
                    const freeBusyData = await freeBusyRes.json();
                    if (freeBusyData.calendars[CALENDAR_ID].busy.length === 0) {
                        availableClosers.push({ id: cId, token: accessToken });
                    }
                }
            }

            if (availableClosers.length === 0) {
                throw new Error("No available closers for this slot");
            }

            // 2. Randomly select an available closer
            const selectedCloser = availableClosers[Math.floor(Math.random() * availableClosers.length)];

            // 3. Resolve Dynamic Summary
            const eventSummary = await resolveEventSummary(supabase, selectedCloser.id, opportunity_id, summary, data.lead_name, data.lead_company);

            // 4. Create Event
            const eventBody = {
                summary: eventSummary,
                start: { dateTime: start_time },
                end: { dateTime: end_time },
                attendees: [
                    { email: "decioalmoplusmidia@gmail.com", displayName: "Closer" },
                    { email: "alex.plusmidia@gmail.com", displayName: "Gerente Comercial" },
                    ...(lead_email ? [{ email: lead_email }] : []),
                ],
                conferenceData: {
                    createRequest: { requestId: Math.random().toString(36).substring(7), conferenceSolutionKey: { type: "hangoutsMeet" } }
                }
            };

            const calendarId = "comercial@plusmidiamkt.com";
            const createRes = await fetch(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events?conferenceDataVersion=1&sendUpdates=all`, {
                method: "POST",
                headers: { Authorization: `Bearer ${selectedCloser.token}`, "Content-Type": "application/json" },
                body: JSON.stringify(eventBody)
            });

            const eventData = await createRes.json();
            if (eventData.error) throw new Error(JSON.stringify(eventData.error));

            const meetLink = eventData.conferenceData?.entryPoints?.find(e => e.entryPointType === "video")?.uri || "";

            // 4. Save Booking
            const { data: booking, error: bookingError } = await supabase.from("bookings").insert({
                opportunity_id,
                closer_id: selectedCloser.id,
                google_event_id: eventData.id,
                meeting_link: meetLink,
                start_time,
                end_time
            }).select().single();

            if (bookingError) throw bookingError;

            // 5. Update Opportunity
            if (opportunity_id) {
                await supabase.from("opportunities").update({
                    session_scheduled_at: start_time,
                    closer_id: selectedCloser.id, // Update responsible closer
                    status: "session_scheduled"
                }).eq("id", opportunity_id);
            }

            return new Response(JSON.stringify({ success: true, booking, meetLink, closer_id: selectedCloser.id }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }

        if (action === "list-events") {
            const { closer_id, start_time, end_time } = data;
            const accessToken = await getCloserAccessToken(supabase, closer_id, GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET);

            if (!accessToken) {
                return new Response(JSON.stringify({ events: [] }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
            }

            const params = new URLSearchParams({
                timeMin: start_time,
                timeMax: end_time,
                singleEvents: "true",
                orderBy: "startTime"
            });

            const calendarRes = await fetch(`https://www.googleapis.com/calendar/v3/calendars/comercial%40plusmidiamkt.com/events?${params.toString()}`, {
                method: "GET",
                headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" }
            });

            const calendarData = await calendarRes.json();
            if (calendarData.error) {
                return new Response(JSON.stringify({ events: [] }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
            }

            return new Response(JSON.stringify({ events: calendarData.items || [] }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }

        if (action === "update-booking") {
            const { booking_id, start_time, end_time, closer_id, lead_email, summary } = data;
            const { data: booking, error: fetchError } = await supabase
                .from("bookings")
                .select("*")
                .eq("id", booking_id)
                .single();

            if (fetchError || !booking) throw new Error("Booking not found");

            const oldCloserId = booking.closer_id;
            const newCloserId = closer_id || oldCloserId;

            if (oldCloserId !== newCloserId) {
                // MOVE: Delete from old closer, create on new closer
                const oldToken = await getCloserAccessToken(supabase, oldCloserId, GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET);
                if (oldToken && booking.google_event_id) {
                    await fetch(`https://www.googleapis.com/calendar/v3/calendars/comercial%40plusmidiamkt.com/events/${booking.google_event_id}?sendUpdates=all`, {
                        method: "DELETE",
                        headers: { Authorization: `Bearer ${oldToken}` }
                    });
                }

                // Create new on new closer
                const newToken = await getCloserAccessToken(supabase, newCloserId, GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET);
                if (!newToken) throw new Error("New closer has no Google integration");

                // Resolve Dynamic Summary for Move
                const eventSummary = await resolveEventSummary(supabase, newCloserId, booking.opportunity_id, summary, data.lead_name, data.lead_company);

                const eventBody = {
                    summary: eventSummary,
                    start: { dateTime: start_time },
                    end: { dateTime: end_time },
                    attendees: [
                        { email: "decioalmoplusmidia@gmail.com", displayName: "Closer" },
                        { email: "alex.plusmidia@gmail.com", displayName: "Gerente Comercial" },
                        ...(lead_email ? [{ email: lead_email }] : []),
                    ],
                    conferenceData: {
                        createRequest: { requestId: Math.random().toString(36).substring(7), conferenceSolutionKey: { type: "hangoutsMeet" } }
                    }
                };

                const updateCalId = "comercial@plusmidiamkt.com";
                const createRes = await fetch(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(updateCalId)}/events?conferenceDataVersion=1&sendUpdates=all`, {
                    method: "POST",
                    headers: { Authorization: `Bearer ${newToken}`, "Content-Type": "application/json" },
                    body: JSON.stringify(eventBody)
                });

                const eventData = await createRes.json();
                if (eventData.error) throw new Error(JSON.stringify(eventData.error));

                const meetLink = eventData.conferenceData?.entryPoints?.find(e => e.entryPointType === "video")?.uri || "";

                // Update database record
                await supabase.from("bookings").update({
                    closer_id: newCloserId,
                    google_event_id: eventData.id,
                    meeting_link: meetLink,
                    start_time,
                    end_time
                }).eq("id", booking.id);

                return new Response(JSON.stringify({ success: true, meetLink }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
            } else {
                // RESCHEDULE: Same closer, just PATCH
                const accessToken = await getCloserAccessToken(supabase, oldCloserId, GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET);
                if (!accessToken) throw new Error("Closer integration not found");

                if (booking.google_event_id) {
                    const eventSummary = await resolveEventSummary(supabase, oldCloserId, booking.opportunity_id, summary, data.lead_name, data.lead_company);

                    const patchBody = {
                        start: { dateTime: start_time },
                        end: { dateTime: end_time },
                        summary: eventSummary
                    };

                    const patchRes = await fetch(`https://www.googleapis.com/calendar/v3/calendars/comercial%40plusmidiamkt.com/events/${booking.google_event_id}?sendUpdates=all`, {
                        method: "PATCH",
                        headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
                        body: JSON.stringify(patchBody)
                    });

                    if (!patchRes.ok) {
                        const errData = await patchRes.json();
                        throw new Error(`Google Calendar error: ${errData.error?.message || patchRes.statusText}`);
                    }
                }

                await supabase.from("bookings").update({
                    start_time,
                    end_time
                }).eq("id", booking.id);

                return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
            }
        }

        if (action === "delete-booking") {
            const { booking_id, skip_opportunity_update = false } = data;
            const { data: booking, error: fetchError } = await supabase
                .from("bookings")
                .select("*")
                .eq("id", booking_id)
                .single();

            if (fetchError || !booking) throw new Error("Booking not found");

            if (booking.google_event_id) {
                const accessToken = await getCloserAccessToken(supabase, booking.closer_id, GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET);
                if (!accessToken) throw new Error("Could not get Google Calendar access token for closer. Event might still be in Google.");

                const delRes = await fetch(`https://www.googleapis.com/calendar/v3/calendars/comercial%40plusmidiamkt.com/events/${booking.google_event_id}?sendUpdates=all`, {
                    method: "DELETE",
                    headers: { Authorization: `Bearer ${accessToken}` }
                });

                if (!delRes.ok && delRes.status !== 404) {
                    const errData = await delRes.json();
                    console.error("Error deleting from Google:", errData);
                    throw new Error(`Google Calendar error: ${errData.error?.message || delRes.statusText}`);
                }
            }

            // Update opportunity if not skipping
            if (!skip_opportunity_update) {
                await supabase.from("opportunities").update({
                    session_scheduled_at: null,
                    session_meeting_link: null
                }).eq("id", booking.opportunity_id);
            }

            // Delete booking record
            await supabase.from("bookings").delete().eq("id", booking.id);

            return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }

        return new Response(JSON.stringify({ error: "Invalid action" }), { status: 400, headers: corsHeaders });
    } catch (error) {
        console.error(error);
        return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders });
    }
});
