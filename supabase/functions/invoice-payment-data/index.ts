import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';

Deno.serve(async (req) => {
    const corsHeaders = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    };

    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    try {
        const supabaseClient = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
            {
                auth: {
                    autoRefreshToken: false,
                    persistSession: false
                },
                db: {
                    schema: 'public'
                }
            }
        );

        const body = await req.json().catch(() => ({}));
        const { billing_id } = body;

        console.log('📥 Invoice Payment Data Request:', billing_id);

        if (!billing_id) {
            console.error('❌ Missing billing_id');
            return new Response(JSON.stringify({ error: 'Missing billing_id' }), {
                status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
        }

        // Validate billing_id is a valid UUID to prevent SQL injection
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        if (!uuidRegex.test(billing_id)) {
            console.error('❌ Invalid billing_id format:', billing_id);
            return new Response(JSON.stringify({ error: 'Invalid billing_id format' }), {
                status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
        }

        // 0. Try to find in financial_receivables (Step 0) - For Split/Partial Payments
        const { data: frData, error: frError } = await supabaseClient.rpc('exec_sql', {
            query: `
                SELECT 
                    fr.id as billing_id,
                    fr.amount,
                    fr.amount as final_amount,
                    0 as discount,
                    fr.due_date,
                    fr.payment_date,
                    fr.status,
                    fr.description,
                    fr.contract_billing_id,
                    c.name as contract_name,
                    c.pagarme_subscription_id,
                    cl.id as client_id,
                    cl.name as client_name,
                    cl.email as client_email,
                    cl.document as client_document,
                    cl.zip_code,
                    cl.street,
                    cl.number,
                    cl.neighborhood,
                    cl.city,
                    cl.state,
                    cl.complement
                FROM financial_receivables fr
                JOIN contract_billings cb ON fr.contract_billing_id = cb.id
                JOIN contracts c ON cb.contract_id = c.id
                JOIN clients cl ON c.client_id = cl.id
                WHERE fr.id = '${billing_id}'
            `
        });

        if (!frError && frData && frData.length > 0) {
            console.log('✅ Found in financial_receivables');
            const row = frData[0];
            // Get invoice
            const { data: invoiceData } = await supabaseClient.rpc('exec_sql', {
                query: `SELECT * FROM billing_invoices WHERE financial_receivable_id = '${billing_id}' LIMIT 1`
            });
            const invoice = invoiceData && invoiceData.length > 0 ? invoiceData[0] : null;

            return new Response(JSON.stringify({
                billing: {
                    id: row.billing_id,
                    description: row.description || `Parcela - ${row.contract_name}`,
                    amount: row.amount,
                    discount: 0,
                    final_amount: row.final_amount,
                    due_date: row.due_date,
                    payment_date: row.payment_date,
                    status: row.status,
                    pagarme_subscription_id: row.pagarme_subscription_id,
                    type: 'contract'
                },
                client: {
                    id: row.client_id,
                    name: row.client_name,
                    email: row.client_email,
                    document: row.client_document,
                    zip_code: row.zip_code,
                    street: row.street,
                    number: row.number,
                    neighborhood: row.neighborhood,
                    city: row.city,
                    state: row.state,
                    complement: row.complement
                },
                invoice: invoice || null
            }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
        }

        // 1. First try to find in contract_billings using SQL (bypasses RLS)
        const { data: contractData, error: contractError } = await supabaseClient.rpc('exec_sql', {
            query: `
                SELECT 
                    cb.id as billing_id,
                    cb.amount,
                    cb.discount,
                    cb.final_amount,
                    cb.due_date,
                    cb.payment_date,
                    cb.status,
                    c.name as contract_name,
                    c.pagarme_subscription_id,
                    c.recurrence_status,
                    cl.id as client_id,
                    cl.name as client_name,
                    cl.email as client_email,
                    cl.document as client_document,
                    cl.zip_code,
                    cl.street,
                    cl.number,
                    cl.neighborhood,
                    cl.city,
                    cl.state,
                    cl.complement
                FROM contract_billings cb
                JOIN contracts c ON cb.contract_id = c.id
                JOIN clients cl ON c.client_id = cl.id
                WHERE cb.id = '${billing_id}'
            `
        });

        if (!contractError && contractData && contractData.length > 0) {
            console.log('✅ Found in contract_billings');
            const row = contractData[0];

            // Get invoice for contract billing
            const { data: invoiceData } = await supabaseClient.rpc('exec_sql', {
                query: `SELECT * FROM billing_invoices WHERE contract_billing_id = '${billing_id}' LIMIT 1`
            });
            const invoice = invoiceData && invoiceData.length > 0 ? invoiceData[0] : null;

            return new Response(JSON.stringify({
                billing: {
                    id: row.billing_id,
                    description: `Fatura de Mensalidade - ${row.contract_name}`,
                    amount: row.amount,
                    discount: row.discount || 0,
                    final_amount: row.final_amount,
                    due_date: row.due_date,
                    payment_date: row.payment_date,
                    status: row.status,
                    pagarme_subscription_id: row.pagarme_subscription_id,
                    type: 'contract'
                },
                client: {
                    id: row.client_id,
                    name: row.client_name,
                    email: row.client_email,
                    document: row.client_document,
                    zip_code: row.zip_code,
                    street: row.street,
                    number: row.number,
                    neighborhood: row.neighborhood,
                    city: row.city,
                    state: row.state,
                    complement: row.complement
                },
                invoice: invoice || null
            }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
        }

        console.log('⚠️ Not found in contract_billings, trying one_time_sales...');

        // 2. Try to find in one_time_sales using SQL (bypasses RLS)
        const { data: saleData, error: saleError } = await supabaseClient.rpc('exec_sql', {
            query: `
                SELECT 
                    s.id,
                    s.description,
                    s.amount,
                    s.discount,
                    s.final_amount,
                    s.due_date,
                    s.sale_date,
                    s.payment_date,
                    s.status,
                    s.client_id,
                    s.opportunity_id,
                    c.name as client_name,
                    c.email as client_email,
                    c.document as client_document,
                    c.zip_code,
                    c.street,
                    c.number,
                    c.neighborhood,
                    c.city,
                    c.state,
                    c.complement,
                    o.lead_name,
                    o.lead_company,
                    o.lead_email,
                    o.lead_document,
                    o.lead_phone,
                    w.installment_interest_rate,
                    w.name as workspace_name,
                    EXISTS (
                        SELECT 1 
                        FROM opportunity_products op 
                        JOIN products p ON op.product_id = p.id 
                        WHERE op.opportunity_id = s.opportunity_id AND p.type = 'recurring'
                    ) as has_recurring_products
                FROM one_time_sales s
                LEFT JOIN clients c ON s.client_id = c.id
                LEFT JOIN opportunities o ON s.opportunity_id = o.id
                LEFT JOIN workspaces w ON s.workspace_id = w.id
                WHERE s.id = '${billing_id}'
            `
        });

        if (saleError) {
            console.error('❌ Error querying one_time_sales:', saleError.message);
        }

        if (!saleError && saleData && saleData.length > 0) {
            console.log('✅ Found in one_time_sales');
            const sale = saleData[0];

            // Get invoice for one-time sale
            const { data: invoiceData } = await supabaseClient.rpc('exec_sql', {
                query: `SELECT * FROM billing_invoices WHERE one_time_sale_id = '${billing_id}' LIMIT 1`
            });
            const invoice = invoiceData && invoiceData.length > 0 ? invoiceData[0] : null;

            // Build client info - prefer client data, fallback to opportunity lead data
            const clientInfo = {
                id: sale.client_id || sale.opportunity_id,
                name: sale.client_name || sale.lead_company || sale.lead_name || 'Cliente',
                email: sale.client_email || sale.lead_email || '',
                document: sale.client_document || sale.lead_document || '',
                phone: sale.lead_phone || '',
                zip_code: sale.zip_code || '',
                street: sale.street || '',
                number: sale.number || '',
                neighborhood: sale.neighborhood || '',
                city: sale.city || '',
                state: sale.state || '',
                complement: sale.complement || ''
            };

            return new Response(JSON.stringify({
                billing: {
                    id: sale.id,
                    description: sale.description || 'Venda Avulsa',
                    amount: sale.amount,
                    discount: sale.discount || 0,
                    final_amount: sale.final_amount || sale.amount,
                    due_date: sale.due_date || sale.sale_date,
                    payment_date: sale.payment_date,
                    status: sale.status,
                    type: 'sale',
                    installment_interest_rate: sale.installment_interest_rate,
                    workspace_name: sale.workspace_name,
                    has_recurring_products: sale.has_recurring_products
                },
                client: clientInfo,
                invoice: invoice || null
            }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
        }

        console.error('❌ Billing not found in contract_billings or one_time_sales');
        return new Response(JSON.stringify({ error: 'Billing not found' }), {
            status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });

    } catch (err: any) {
        console.error('❌ Unexpected Error:', err.message);
        console.error('Stack:', err.stack);
        return new Response(JSON.stringify({ error: err.message, details: err.toString() }), {
            status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }
});
