import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface D4SignPayload {
    contractId: string;
    templateId: string;
    workspaceId: string;
    signers: Array<{
        name: string;
        email: string;
        document: string;
    }>;
}

Deno.serve(async (req) => {
    if (req.method === "OPTIONS") {
        return new Response("ok", { headers: corsHeaders });
    }

    try {
        console.log("D4Sign Integration invoked");
        const supabase = createClient(
            Deno.env.get("SUPABASE_URL") ?? "",
            Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
        );

        const body = await req.json();
        const { action, workspaceId } = body;

        // Webhook check
        if (body.uuid && !body.contractId && !action) {
            console.log("Webhook received:", body);
            const isSigned = body.type === "1" || body.message?.toLowerCase().includes("assinatura finalizada");
            if (isSigned) {
                // Update contracts table
                await supabase.from("contracts").update({ signature_status: "signed" }).eq("d4sign_id", body.uuid);
                // Also update opportunities table (when sent from opportunity flow)
                await supabase.from("opportunities").update({ contract_signature_status: "signed", signed_at: new Date().toISOString() }).eq("d4sign_document_uuid", body.uuid);
            }
            return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }

        if (!workspaceId) throw new Error("workspaceId is required");

        // Get Credentials
        const { data: integration, error: intError } = await supabase
            .from("workspace_integrations")
            .select("*")
            .eq("workspace_id", workspaceId)
            .eq("provider", "d4sign")
            .single();

        if (intError || !integration) throw new Error("D4Sign configuration not found for this workspace.");

        const tokenAPI = (integration.api_key || "").trim();
        const cryptKey = (integration.config?.crypt_key || "").trim();

        if (!tokenAPI || !cryptKey) throw new Error("API Key or Crypt Key missing in configuration.");

        const d4signBaseUrl = "https://secure.d4sign.com.br/api/v1";

        if (action === "list-templates") {
            const url = `${d4signBaseUrl}/templates?tokenAPI=${tokenAPI}&cryptKey=${cryptKey}`;
            console.log("Listing templates...");
            const response = await fetch(url);
            const data = await response.json();

            if (!response.ok) {
                console.error("D4Sign API Error:", data);
                return new Response(JSON.stringify({
                    error: `D4Sign API error (${response.status})`,
                    details: data
                }), {
                    headers: { ...corsHeaders, "Content-Type": "application/json" },
                    status: 400
                });
            }

            return new Response(JSON.stringify(data), {
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
        }

        // Send for signature flow
        const { contractId, opportunityId, templateId, signers } = body as any;
        const uuidSafe = (integration.config?.uuid_safe || "").trim();

        if ((!contractId && !opportunityId) || !templateId || !signers || !uuidSafe) {
            throw new Error("Missing required fields (contractId OR opportunityId) for signature request.");
        }

        // 1. Create document
        let variables: any = {};
        let docName = "";

        if (contractId) {
            const { data: contract } = await supabase.from("contracts").select("*, clients(*)").eq("id", contractId).single();
            if (!contract) throw new Error("Contract not found.");
            docName = `Contrato - ${contract.name}`;
            variables = {
                NOME_CLIENTE: contract.clients.name,
                DOCUMENTO_CLIENTE: contract.clients.document,
                VALOR_CONTRATO: new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(contract.value),
                DATA_INICIO: contract.start_date.split('-').reverse().join('/'),
                OBJETO_CONTRATO: contract.name,
            };
        } else if (opportunityId) {
            const { data: opp } = await supabase.from("opportunities").select("*, opportunity_products(products(name))").eq("id", opportunityId).single();
            if (!opp) throw new Error("Opportunity not found.");
            const clientName = opp.lead_company || opp.lead_name;
            docName = `Contrato - ${clientName}`;
            const productsNames = opp.opportunity_products?.map((op: any) => op.products?.name).join(", ") || "Serviços";

            variables = {
                NOME_CLIENTE: clientName,
                DOCUMENTO_CLIENTE: opp.lead_document,
                VALOR_CONTRATO: new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(opp.negotiated_value || 0),
                DATA_INICIO: new Date().toLocaleDateString("pt-BR"),
                OBJETO_CONTRATO: productsNames,
            };
        }

        const makeDocRes = await fetch(`${d4signBaseUrl}/documents/${uuidSafe}/makedocumentbytemplateword?tokenAPI=${tokenAPI}&cryptKey=${cryptKey}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                name_document: docName,
                id_template: templateId,
                variables: variables,
            }),
        });
        const docData = await makeDocRes.json();
        if (!docData.uuid) throw new Error(`Document creation failed: ${JSON.stringify(docData)}`);

        // 2. Add signers
        const addRes = await fetch(`${d4signBaseUrl}/documents/${docData.uuid}/createlist?tokenAPI=${tokenAPI}&cryptKey=${cryptKey}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                signers: signers.map((s: any) => ({ email: s.email, act: "1", foreign: "0", cert_type: "0", name: s.name })),
            }),
        });
        const signData = await addRes.json();
        if (signData.status !== "1") throw new Error(`Adding signers failed: ${JSON.stringify(signData)}`);

        // 3. Send
        const sendRes = await fetch(`${d4signBaseUrl}/documents/${docData.uuid}/sendtosign?tokenAPI=${tokenAPI}&cryptKey=${cryptKey}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ message: "Por favor, assine o contrato." }),
        });
        const sendData = await sendRes.json();
        if (!sendRes.ok) throw new Error(`Sending document failed: ${JSON.stringify(sendData)}`);

        // 4. Webhook
        const supabaseUrl = Deno.env.get("SUPABASE_URL")?.split("//")[1]?.split(".")[0];
        const webhookUrl = `https://${supabaseUrl}.supabase.co/functions/v1/d4sign-integration`;
        await fetch(`${d4signBaseUrl}/documents/${docData.uuid}/webhooks?tokenAPI=${tokenAPI}&cryptKey=${cryptKey}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ url: webhookUrl }),
        });

        // 5. Update DB
        if (contractId) {
            await supabase.from("contracts").update({ d4sign_id: docData.uuid, signature_status: "sent" }).eq("id", contractId);
        } else if (opportunityId) {
            await supabase.from("opportunities").update({ d4sign_document_uuid: docData.uuid, contract_signature_status: "sent" }).eq("id", opportunityId);
        }

        return new Response(JSON.stringify({ success: true, uuidDoc: docData.uuid }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });

    } catch (error: any) {
        console.error("Critical error:", error.message);
        return new Response(JSON.stringify({ error: error.message }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 400,
        });
    }
});
