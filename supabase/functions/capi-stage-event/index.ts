import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { sendMetaConversionEvent, buildFbcFromFbclid } from "../_shared/meta-capi.ts";
import { corsHeaders } from "../_shared/cors.ts";

Deno.serve(async (req: Request) => {
    if (req.method === "OPTIONS") {
        return new Response("ok", { headers: corsHeaders });
    }

    try {
        const { opportunity_id, workspace_id, new_stage_id, event_name } = await req.json();

        if (!opportunity_id || !workspace_id || !event_name) {
            return new Response(
                JSON.stringify({ error: "Missing required fields" }),
                { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        const supabase = createClient(
            Deno.env.get("SUPABASE_URL") ?? "",
            Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
        );

        // 1. Buscar dados da oportunidade
        const { data: opportunity, error: oppError } = await supabase
            .from("opportunities")
            .select("lead_name, lead_email, lead_phone, custom_fields")
            .eq("id", opportunity_id)
            .single();

        if (oppError || !opportunity) {
            console.error("Opportunity not found:", oppError?.message);
            return new Response(
                JSON.stringify({ error: "Opportunity not found" }),
                { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        // 2. Buscar credenciais Meta CAPI do workspace
        const { data: metaIntegration } = await supabase
            .from("workspace_integrations")
            .select("api_key, config")
            .eq("workspace_id", workspace_id)
            .eq("provider", "meta_capi")
            .eq("is_active", true)
            .maybeSingle();

        if (!metaIntegration || !metaIntegration.config?.pixel_id) {
            console.log("Meta CAPI not configured for workspace, skipping.");
            return new Response(
                JSON.stringify({ success: true, skipped: true, reason: "no_meta_capi_config" }),
                { headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        console.log(`[CAPI DEBUG] Config loaded — pixel_id: ${metaIntegration.config.pixel_id}, test_event_code: ${metaIntegration.config.test_event_code || '(none)'}, workspace: ${workspace_id}`);

        // 3. Extrair dados de tracking persistidos em custom_fields
        const cf = opportunity.custom_fields || {};
        const fbp = cf._meta_fbp || undefined;
        let fbc = cf._meta_fbc || undefined;
        const fbclid = cf._meta_fbclid || undefined;
        const userAgent = cf._meta_user_agent || undefined;
        const sourceUrl = cf._meta_source_url || undefined;

        // Se fbc não existe mas fbclid sim, construir fbc
        if (!fbc && fbclid) {
            fbc = buildFbcFromFbclid(fbclid);
        }

        // 4. Extrair nome e sobrenome
        const fullName = opportunity.lead_name || "";
        const nameParts = fullName.trim().split(/\s+/);
        const firstName = nameParts[0] || "";
        const lastName = nameParts.length > 1 ? nameParts.slice(1).join(" ") : "";

        // 5. Extrair UTMs para custom_data
        const customData: Record<string, any> = {};
        const utmFields = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content'];
        utmFields.forEach(utm => {
            if (cf[utm]) customData[utm] = cf[utm];
        });

        // 6. Gerar event_id determinístico
        const eventTime = Math.floor(Date.now() / 1000);
        const eventId = `${opportunity_id}_${new_stage_id}_${Date.now()}`;

        // 7. Enviar evento CAPI
        const result = await sendMetaConversionEvent({
            accessToken: metaIntegration.api_key,
            pixelId: metaIntegration.config.pixel_id,
            testEventCode: metaIntegration.config.test_event_code || undefined,
            eventName: event_name,
            eventId,
            eventTime,
            sourceUrl: sourceUrl || "",
            actionSource: "system_generated",
            userAgent: userAgent || "",
            email: opportunity.lead_email || undefined,
            phone: opportunity.lead_phone || undefined,
            firstName: firstName || undefined,
            lastName: lastName || undefined,
            fbp,
            fbc,
            customData
        });

        console.log(`[CAPI DEBUG] Facebook response: ${JSON.stringify(result)}`);
        console.log(`CAPI stage event dispatched: ${event_name} for opportunity ${opportunity_id}`);

        return new Response(
            JSON.stringify({ success: true, event_name, result }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );

    } catch (error: any) {
        console.error("capi-stage-event error:", error.message);
        return new Response(
            JSON.stringify({ error: error.message }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }
});
