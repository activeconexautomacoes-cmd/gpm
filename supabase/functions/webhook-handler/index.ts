import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// --- META CAPI HELPERS ---
async function sha256Hash(value: string): Promise<string> {
    const data = new TextEncoder().encode(value.trim().toLowerCase());
    const hashBuffer = await crypto.subtle.digest("SHA-256", data);
    return Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, "0")).join("");
}

function normalizePhone(phone: string): string {
    const digits = phone.replace(/\D/g, "");
    // Adiciona código do Brasil se não tiver
    if (digits.length === 10 || digits.length === 11) return "55" + digits;
    return digits;
}

async function sendMetaConversionEvent(options: {
    accessToken: string;
    pixelId: string;
    testEventCode?: string;
    eventName: string;
    eventId: string;
    eventTime: number;
    sourceUrl: string;
    userAgent: string;
    email?: string;
    phone?: string;
    firstName?: string;
    lastName?: string;
    fbp?: string;
    fbc?: string;
    customData?: Record<string, any>;
}) {
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
            action_source: "website",
            event_source_url: options.sourceUrl,
            user_data: userData,
            ...(options.customData && Object.keys(options.customData).length > 0 ? { custom_data: options.customData } : {})
        }]
    };

    if (options.testEventCode) {
        payload.test_event_code = options.testEventCode;
    }

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

Deno.serve(async (req: Request) => {
    if (req.method === "OPTIONS") {
        return new Response("ok", { headers: corsHeaders });
    }

    try {
        const url = new URL(req.url);
        const slug = url.searchParams.get("slug");

        if (!slug) {
            throw new Error("Webhook slug is required in the query parameters");
        }

        const supabase = createClient(
            Deno.env.get("SUPABASE_URL") ?? "",
            Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
        );

        // 1. Localizar integração
        const { data: integration, error: intError } = await supabase
            .from("webhook_integrations")
            .select("*")
            .eq("slug", slug)
            .eq("is_active", true)
            .single();

        if (intError || !integration) {
            return new Response(JSON.stringify({ error: "Webhook not found or inactive" }), {
                headers: { ...corsHeaders, "Content-Type": "application/json" },
                status: 404
            });
        }

        const body = await req.json();
        console.log(`Payload received for webhook "${integration.name}"`);

        // 2. SEMPRE atualizar o last_payload (isso permite que o usuário veja os campos na UI)
        await supabase
            .from("webhook_integrations")
            .update({
                last_payload: body,
                updated_at: new Date().toISOString()
            })
            .eq("id", integration.id);

        // 3. Verificar se há mapeamento configurado
        const mapping = integration.mapping || {};
        const hasMapping = Object.keys(mapping).length > 0;

        // Se não houver mapeamento ou o nome não estiver mapeado, paramos aqui com sucesso (modo teste)
        if (!hasMapping || !mapping.lead_name || mapping.lead_name === "none") {
            return new Response(JSON.stringify({
                success: true,
                message: "Test payload received and saved. Please configure field mapping in GPM."
            }), {
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
        }

        // 4. Processar mapeamento e preparar dados da Oportunidade
        const opportunityData: any = {
            workspace_id: integration.workspace_id,
            source: 'webhook',
            is_held: integration.auto_hold || false,
            custom_fields: {
                webhook_id: integration.id,
                webhook_name: integration.name
            }
        };

        const getValue = (obj: any, path: string) => {
            if (!path || path === "none") return undefined;
            return path.split('.').reduce((acc, part) => acc && acc[part], obj);
        };

        const standardFields = [
            'lead_name', 'lead_phone', 'lead_email', 'lead_company',
            'lead_position', 'lead_document', 'company_size',
            'company_segment', 'company_revenue', 'estimated_value',
            'company_instagram', 'company_website', 'company_ads_budget',
            'company_investment', 'source',
            'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content'
        ];

        standardFields.forEach(field => {
            const mappedPath = mapping[field];
            if (mappedPath && mappedPath !== "none") {
                const val = getValue(body, mappedPath);
                if (val !== undefined && val !== null) {
                    if (field === 'estimated_value') {
                        opportunityData[field] = parseFloat(String(val).replace(/[^\d.-]/g, '')) || 0;
                    } else if (field.startsWith('utm_')) {
                        opportunityData.custom_fields[field] = String(val);
                    } else {
                        opportunityData[field] = String(val);
                    }
                }
            }
        });

        // 5. Garantir estágio inicial
        const { data: firstStage } = await supabase
            .from("opportunity_stages")
            .select("id")
            .eq("workspace_id", integration.workspace_id)
            .order("order_position", { ascending: true })
            .limit(1)
            .single();

        if (firstStage) {
            opportunityData.current_stage_id = firstStage.id;
        }

        // 6. Criar Oportunidade APENAS se tivermos pelo menos o nome mapeado e presente
        if (opportunityData.lead_name) {
            const { data: newOpp, error: oppError } = await supabase
                .from("opportunities")
                .insert(opportunityData)
                .select()
                .single();

            if (oppError) {
                console.error("Error creating opportunity:", oppError);
                throw oppError;
            }
            console.log(`Opportunity created: ${newOpp.id}, is_held: ${opportunityData.is_held}`);

            // 7. Atribuição Automática de Tags (Webnário)
            if (opportunityData.is_held) {
                try {
                    // Garantir que a tag "Webnário" existe neste workspace
                    const { data: tag, error: tagError } = await supabase
                        .from("crm_tags")
                        .select("id")
                        .eq("workspace_id", integration.workspace_id)
                        .eq("name", "Webnário")
                        .maybeSingle();

                    let tagId = tag?.id;

                    if (!tagId && !tagError) {
                        const { data: newTag, error: createTagError } = await supabase
                            .from("crm_tags")
                            .insert({
                                workspace_id: integration.workspace_id,
                                name: "Webnário",
                                color: "#F59E0B" // Amber-500
                            })
                            .select("id")
                            .single();

                        if (!createTagError) tagId = newTag.id;
                    }

                    // Atribuir a tag
                    if (tagId) {
                        await supabase
                            .from("opportunity_tag_assignments")
                            .insert({
                                opportunity_id: newOpp.id,
                                tag_id: tagId
                            });
                    }
                } catch (tagErr) {
                    console.error("Error auto-assigning tag:", tagErr);
                    // Não falhar o webhook por erro na tag
                }
            }
        }

        // 8. META CAPI — Enviar evento server-side para API de Conversões
        try {
            const { data: metaIntegration } = await supabase
                .from("workspace_integrations")
                .select("api_key, config")
                .eq("workspace_id", integration.workspace_id)
                .eq("provider", "meta_capi")
                .eq("is_active", true)
                .maybeSingle();

            if (metaIntegration && metaIntegration.config?.pixel_id) {
                const metadata = body?.submission?.metadata || {};
                const fields = body?.submission?.fields || {};

                // Só dispara CAPI se eventName for enviado explicitamente no payload
                const eventName = metadata.eventName || body?.event_name;

                if (!eventName) {
                    console.log("Meta CAPI skipped: no eventName in payload (lead desqualificado)");
                } else {
                    // Extrair nome e sobrenome
                    const fullName = opportunityData.lead_name || "";
                    const nameParts = fullName.trim().split(/\s+/);
                    const firstName = nameParts[0] || "";
                    const lastName = nameParts.length > 1 ? nameParts.slice(1).join(" ") : "";

                    // Extrair UTMs para custom_data
                    const customData: Record<string, any> = {};
                    const utmFields = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content'];
                    utmFields.forEach(utm => {
                        const val = fields[utm] || opportunityData.custom_fields?.[utm];
                        if (val) customData[utm] = val;
                    });

                    // Event time (unix seconds)
                    const submittedAt = body?.submission?.submittedAt;
                    const eventTime = submittedAt
                        ? Math.floor(new Date(submittedAt).getTime() / 1000)
                        : Math.floor(Date.now() / 1000);

                    await sendMetaConversionEvent({
                        accessToken: metaIntegration.api_key,
                        pixelId: metaIntegration.config.pixel_id,
                        testEventCode: metaIntegration.config.test_event_code || undefined,
                        eventName,
                        eventId: body?.id || crypto.randomUUID(),
                        eventTime,
                        sourceUrl: metadata.page?.url || "",
                        userAgent: metadata.userAgent || "",
                        email: opportunityData.lead_email,
                        phone: opportunityData.lead_phone,
                        firstName,
                        lastName,
                        fbp: metadata.fbp || undefined,
                        fbc: metadata.fbc || undefined,
                        customData
                    });
                }
            }
        } catch (capiErr) {
            console.error("Meta CAPI dispatch error:", capiErr);
            // Não falhar o webhook por erro na CAPI
        }

        return new Response(JSON.stringify({
            success: true,
            message: "Data processed successfully"
        }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });

    } catch (error: any) {
        console.error("Webhook error:", error.message);
        return new Response(JSON.stringify({ error: error.message }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 400
        });
    }
});
