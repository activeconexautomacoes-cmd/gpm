import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// Helper function to get current date in Brazil timezone (UTC-3)
function getBrazilDateString(): string {
    const now = new Date();
    const brazilOffset = -3 * 60; // -180 minutes
    const utcOffset = now.getTimezoneOffset();
    const brazilTime = new Date(now.getTime() + (utcOffset + brazilOffset) * 60 * 1000);

    const year = brazilTime.getFullYear();
    const month = String(brazilTime.getMonth() + 1).padStart(2, '0');
    const day = String(brazilTime.getDate()).padStart(2, '0');

    return `${year}-${month}-${day}`;
}

interface PaymentLinkPayload {
    opportunity_id: string;
    amount: number; // Value in BRL (float)
    description: string;
    items: Array<{
        code: string;
        description: string;
        amount: number; // Unit price in cents (integer)
        quantity: number;
    }>;
    customer_data?: {
        name: string;
        email: string;
        document: string;
        type: string;
        phones: any;
    };
    force_regenerate?: boolean; // Force regeneration even if link exists
}

Deno.serve(async (req) => {
    if (req.method === "OPTIONS") {
        return new Response("ok", { headers: corsHeaders });
    }

    try {
        const supabase = createClient(
            Deno.env.get("SUPABASE_URL") ?? "",
            Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
        );

        const body = await req.json().catch(() => ({}));
        const { opportunity_id, amount, description, items, payment_methods, force_regenerate } = body as any;

        if (!opportunity_id) {
            throw new Error("Missing opportunity_id.");
        }

        // Allowed methods from request (filter out boleto as requested)
        const allowedMethods = (payment_methods || ["credit_card", "pix"]).filter((m: string) => m !== "boleto");

        // 1. Fetch Opportunity
        const { data: opp, error: oppError } = await supabase
            .from("opportunities")
            .select("*")
            .eq("id", opportunity_id)
            .single();

        if (oppError || !opp) throw new Error("Opportunity not found.");

        // 2. Check if there's an existing sale that needs to be updated
        const { data: existingSale } = await supabase
            .from("one_time_sales")
            .select("id, amount")
            .eq("opportunity_id", opportunity_id)
            .single();

        const saleDate = getBrazilDateString();
        let saleId: string;

        // Build detailed description from items if available
        const itemsDescription = items && items.length > 0
            ? items.map((i: any) => `${i.description}: R$ ${(i.amount / 100).toFixed(2)}`).join(" | ")
            : null;
        const saleDescription = itemsDescription
            ? `${description || `Fechamento: ${opp.lead_company || opp.lead_name}`} — ${itemsDescription}`
            : description || `Fechamento: ${opp.lead_company || opp.lead_name}`;

        if (existingSale) {
            // Update existing sale with new amount
            const { data: updatedSale, error: updateError } = await supabase
                .from("one_time_sales")
                .update({
                    description: saleDescription,
                    amount: amount,
                    final_amount: amount,
                    status: 'pending' // Reset to pending
                })
                .eq("id", existingSale.id)
                .select()
                .single();

            if (updateError) throw new Error(`Error updating sale: ${updateError.message}`);
            saleId = updatedSale.id;

            // Update existing invoice
            await supabase
                .from("billing_invoices")
                .update({
                    amount: amount,
                    status: 'pending'
                })
                .eq("one_time_sale_id", existingSale.id);

            console.log(`Updated existing sale ${saleId} with new amount: ${amount}`);
        } else {
            // 3. Create new sale
            const { data: sale, error: saleError } = await supabase
                .from("one_time_sales")
                .insert({
                    opportunity_id: opportunity_id,
                    workspace_id: opp.workspace_id,
                    client_id: null,
                    description: saleDescription,
                    amount: amount,
                    discount: 0,
                    final_amount: amount,
                    sale_date: saleDate,
                    due_date: saleDate,
                    status: 'pending'
                })
                .select()
                .single();

            if (saleError) throw new Error(`Error creating sale: ${saleError.message}`);
            saleId = sale.id;

            // 4. Create Billing Invoice
            const { error: invError } = await supabase
                .from("billing_invoices")
                .insert({
                    workspace_id: opp.workspace_id,
                    client_id: null,
                    one_time_sale_id: saleId,
                    status: 'pending',
                    amount: amount,
                    due_date: saleDate,
                });

            if (invError) throw new Error(`Error creating invoice: ${invError.message}`);
        }

        // 5. Generate Internal URL
        const origin = req.headers.get("origin") || "https://gpm.plusmidia.com.br";
        const methodsQuery = allowedMethods.map((m: string) => m === 'credit_card' ? 'card' : m).join(",");
        const paymentUrl = `${origin}/invoice/${saleId}?methods=${methodsQuery}`;

        // 6. Update Opportunity with the new link
        // Try to update with payment_link_amount, fallback to basic update if column doesn't exist
        const updateData: Record<string, any> = {
            payment_link_url: paymentUrl,
            payment_status: "pending"
        };

        // Try with payment_link_amount first
        let updateResult = await supabase
            .from("opportunities")
            .update({
                ...updateData,
                payment_link_amount: amount
            })
            .eq("id", opportunity_id);

        // If failed (possibly due to missing column), try without payment_link_amount
        if (updateResult.error && updateResult.error.message.includes("payment_link_amount")) {
            console.log("payment_link_amount column not found, updating without it");
            updateResult = await supabase
                .from("opportunities")
                .update(updateData)
                .eq("id", opportunity_id);
        }

        if (updateResult.error) {
            console.error("Error updating opportunity:", updateResult.error);
        }

        return new Response(JSON.stringify({
            success: true,
            payment_url: paymentUrl,
            sale_id: saleId,
            updated_existing: !!existingSale
        }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" }
        });

    } catch (error: any) {
        console.error("Error generating payment link:", error.message);
        return new Response(JSON.stringify({
            success: false,
            error: error.message
        }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
    }
});
