// --- META CAPI HELPERS ---
// Módulo compartilhado para envio de eventos server-side via Facebook Conversions API

export async function sha256Hash(value: string): Promise<string> {
    const data = new TextEncoder().encode(value.trim().toLowerCase());
    const hashBuffer = await crypto.subtle.digest("SHA-256", data);
    return Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, "0")).join("");
}

export function normalizePhone(phone: string): string {
    const digits = phone.replace(/\D/g, "");
    // Adiciona código do Brasil se não tiver
    if (digits.length === 10 || digits.length === 11) return "55" + digits;
    return digits;
}

/**
 * Constrói o parâmetro fbc a partir do fbclid quando fbc não está disponível.
 * Formato: fb.1.{timestamp_ms}.{fbclid}
 */
export function buildFbcFromFbclid(fbclid: string, timestampMs?: number): string {
    const ts = timestampMs || Date.now();
    return `fb.1.${ts}.${fbclid}`;
}

export interface MetaConversionEventOptions {
    accessToken: string;
    pixelId: string;
    testEventCode?: string;
    eventName: string;
    eventId: string;
    eventTime: number;
    sourceUrl?: string;
    actionSource?: string;
    userAgent?: string;
    email?: string;
    phone?: string;
    firstName?: string;
    lastName?: string;
    fbp?: string;
    fbc?: string;
    customData?: Record<string, any>;
}

export async function sendMetaConversionEvent(options: MetaConversionEventOptions) {
    const userData: Record<string, any> = {};

    if (options.email) userData.em = [await sha256Hash(options.email)];
    if (options.phone) userData.ph = [await sha256Hash(normalizePhone(options.phone))];
    if (options.firstName) userData.fn = [await sha256Hash(options.firstName)];
    if (options.lastName) userData.ln = [await sha256Hash(options.lastName)];
    if (options.fbp) userData.fbp = options.fbp;
    if (options.fbc) userData.fbc = options.fbc;
    if (options.userAgent) userData.client_user_agent = options.userAgent;

    const payload: Record<string, any> = {
        data: [{
            event_name: options.eventName,
            event_time: options.eventTime,
            event_id: options.eventId,
            action_source: options.actionSource || "website",
            ...(options.sourceUrl ? { event_source_url: options.sourceUrl } : {}),
            user_data: userData,
            ...(options.customData && Object.keys(options.customData).length > 0 ? { custom_data: options.customData } : {})
        }]
    };

    if (options.testEventCode) {
        payload.test_event_code = options.testEventCode;
    }

    console.log(`[META CAPI DEBUG] Payload: ${JSON.stringify(payload, null, 2)}`);

    const url = `https://graph.facebook.com/v21.0/${options.pixelId}/events?access_token=${options.accessToken}`;

    const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
    });

    const result = await response.json();

    if (!response.ok) {
        console.error("Meta CAPI error:", JSON.stringify(result));
    } else {
        console.log(`Meta CAPI success: event '${options.eventName}' sent (event_id: ${options.eventId})`);
    }

    return result;
}
