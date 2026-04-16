import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';

interface BillingPayload {
    billing_id: string;
    type: 'contract' | 'sale';
    payment_method?: 'pix' | 'credit_card';
    is_subscription?: boolean;
    card?: {
        number: string;
        holder_name: string;
        exp_month: number;
        exp_year: number;
        cvv: string;
    };
    installments?: number;
    customer_extra?: {
        document?: string;
        zip_code?: string;
        street?: string;
        number?: string;
        neighborhood?: string;
        city?: string;
        state?: string;
    };
    financial_receivable_id?: string;
}

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    try {
        const supabaseClient = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        );

        const body = await req.json().catch(() => ({}));
        let { billing_id, type, payment_method, is_subscription, card, installments = 1, customer_extra, financial_receivable_id } = body as BillingPayload;

        console.log("🚀 Payment V14 (Auto-Detect Parcel):", { billing_id, type, payment_method, is_subscription, financial_receivable_id });

        if (!billing_id) {
            return new Response(JSON.stringify({ success: false, error: 'Missing billing_id' }), {
                status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
        }

        // 0. Auto-detect if billing_id is actually a financial_receivable_id
        if (!financial_receivable_id) {
            const { data: frCheck } = await supabaseClient
                .from('financial_receivables')
                .select('id, contract_billing_id, one_time_sale_id')
                .eq('id', billing_id)
                .maybeSingle();

            if (frCheck) {
                console.log("🔄 Detected billing_id as financial_receivable_id:", frCheck.id);
                financial_receivable_id = frCheck.id;
                if (frCheck.contract_billing_id) {
                    billing_id = frCheck.contract_billing_id;
                    type = 'contract';
                } else if (frCheck.one_time_sale_id) {
                    billing_id = frCheck.one_time_sale_id;
                    type = 'sale';
                }
            }
        }

        if (!billing_id || !type) {
            return new Response(JSON.stringify({ success: false, error: 'Missing billing_id or type' }), {
                status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
        }

        // 1. Fetch Billing Data
        let billingData: any;
        let workspaceId: string;
        let clientId: string | null;
        let amount: number;
        let opportunityId: string | null = null;

        if (type === 'contract') {
            const { data, error } = await supabaseClient
                .from('contract_billings')
                .select('*, contracts(id, client_id, name, workspace_id)')
                .eq('id', billing_id)
                .single();
            if (error) throw error;
            billingData = data;
            workspaceId = data.contracts.workspace_id;
            clientId = data.contracts.client_id;
            amount = data.final_amount;
        } else {
            const { data, error } = await supabaseClient
                .from('one_time_sales')
                .select('*')
                .eq('id', billing_id)
                .single();
            if (error) throw error;
            billingData = data;
            workspaceId = data.workspace_id;
            clientId = data.client_id;
            opportunityId = data.opportunity_id;
            amount = data.final_amount;

            // Check if any product is recurring (separate query to avoid ambiguous relationship)
            billingData.has_recurring_products = false;
            if (opportunityId) {
                const { data: products } = await supabaseClient
                    .from('opportunity_products')
                    .select('products(type)')
                    .eq('opportunity_id', opportunityId);

                if (products) {
                    billingData.has_recurring_products = products.some((op: any) => op.products?.type === 'recurring');
                }
            }
        }


        // 1.5 Fetch Receivable Data (Override Amount if Split Payment)
        if (financial_receivable_id) {
            const { data: receivable, error: recError } = await supabaseClient
                .from('financial_receivables')
                .select('amount')
                .eq('id', financial_receivable_id)
                .maybeSingle();

            if (!recError && receivable) {
                console.log(`💰 Using split payment amount from receivable: ${receivable.amount} (Original Billing: ${amount})`);
                amount = receivable.amount;
            } else {
                console.warn("⚠️ Provided financial_receivable_id not found or error, using original billing amount.");
            }
        }


        // 2. Fetch Client Data OR Opportunity Lead Data
        let customerSource: any = null;

        if (clientId) {
            // Try to fetch from clients table
            const { data: client, error: clientError } = await supabaseClient
                .from('clients')
                .select('*')
                .eq('id', clientId)
                .single();

            if (!clientError && client) {
                customerSource = client;
                console.log("📋 Using client data:", client.name);
            }
        }

        // If no client, try to get from opportunity
        if (!customerSource && opportunityId) {
            const { data: opportunity, error: oppError } = await supabaseClient
                .from('opportunities')
                .select('*')
                .eq('id', opportunityId)
                .single();

            if (!oppError && opportunity) {
                customerSource = {
                    name: opportunity.lead_company || opportunity.lead_name || 'Cliente',
                    email: opportunity.lead_email,
                    document: opportunity.lead_document,
                    phone: opportunity.lead_phone,
                    // Address fields might not exist on opportunities table
                    zip_code: null,
                    street: null,
                    number: null,
                    neighborhood: null,
                    city: null,
                    state: null
                };
                console.log("📋 Using opportunity lead data:", customerSource.name);
            }
        }

        // Fallback if nothing found
        if (!customerSource) {
            customerSource = {
                name: 'Cliente',
                email: 'contato@plusmidia.com.br',
                document: null,
                phone: null
            };
            console.log("⚠️ Using fallback customer data");
        }

        // Fetch Pagar.me Bank Account ID
        const { data: pagarmeAccount } = await supabaseClient
            .from('financial_bank_accounts')
            .select('id')
            .eq('workspace_id', workspaceId)
            .eq('name', 'Pagar.me')
            .limit(1)
            .maybeSingle();

        const pagarmeAccountId = pagarmeAccount?.id;

        // Fetch Workspace Interest Rate
        const { data: workspaceSettings } = await supabaseClient
            .from('workspaces')
            .select('installment_interest_rate')
            .eq('id', workspaceId)
            .single();
        const interestRate = Number(workspaceSettings?.installment_interest_rate || 0);

        // 3. Pagar.me Integration - Fetch workspace-specific key or fallback to global
        let PAGARME_API_KEY = Deno.env.get('PAGARME_SECRET_KEY');

        // Try to get workspace-specific key
        const { data: workspaceKey } = await supabaseClient.rpc('get_workspace_pagarme_key', {
            p_workspace_id: workspaceId
        });

        if (workspaceKey) {
            PAGARME_API_KEY = workspaceKey;
            console.log(`🔑 Using workspace-specific Pagar.me key for workspace ${workspaceId}`);
        } else {
            console.log(`🔑 Using global Pagar.me key (no workspace key configured)`);
        }

        if (!PAGARME_API_KEY) throw new Error('Missing PAGARME_SECRET_KEY');

        // Build customer data with proper fallbacks
        const finalDocument = customer_extra?.document || customerSource.document || "00000000000";
        // Sanitize phone number (digits only, remove 55 country code if present)
        const rawPhone = (customerSource.phone || '').replace(/\D/g, '');
        const cleanPhone = (rawPhone.startsWith('55') && rawPhone.length > 10) ? rawPhone.substring(2) : rawPhone;

        const customerData = {
            name: customerSource.name || 'Cliente',
            email: customerSource.email || "contato@plusmidia.com.br",
            document: finalDocument.replace(/\D/g, ''),
            type: finalDocument.replace(/\D/g, '').length > 11 ? 'company' : 'individual',
            phones: {
                mobile_phone: {
                    country_code: '55',
                    area_code: cleanPhone.substring(0, 2) || '11',
                    number: cleanPhone.substring(2) || '999999999'
                }
            }
        };

        console.log("📦 Customer data for Pagar.me:", customerData);

        // Apply Installment Interest (Compound) - Only for One-Time Sales (non-recurring)
        if (installments > 1 && type !== 'contract' && !billingData.has_recurring_products && interestRate > 0 && payment_method === 'credit_card') {
            const originalAmount = amount;
            // Formula: M = C * (1 + i)^n
            // i = rate / 100
            const rateDecimal = interestRate / 100;
            amount = originalAmount * Math.pow(1 + rateDecimal, installments);
            console.log(`💸 Applied installment interest: ${interestRate}% over ${installments}x. Base: ${originalAmount} -> Total: ${amount}`);
        }

        let result: any;
        let response: Response;

        if (is_subscription && payment_method === 'credit_card' && type === 'contract') {
            // SUBSCRIPTION LOGIC
            const subscriptionPayload = {
                customer: customerData,
                payment_method: 'credit_card',
                interval: 'month',
                interval_count: 1,
                billing_type: 'prepaid',
                card: {
                    number: card?.number,
                    holder_name: card?.holder_name,
                    exp_month: card?.exp_month,
                    exp_year: card?.exp_year,
                    cvv: card?.cvv,
                    billing_address: {
                        street: customer_extra?.street || customerSource.street || 'Rua',
                        number: customer_extra?.number || customerSource.number || 'S/N',
                        neighborhood: customer_extra?.neighborhood || customerSource.neighborhood || 'Bairro',
                        zip_code: (customer_extra?.zip_code || customerSource.zip_code || '00000000').replace(/\D/g, ''),
                        city: customer_extra?.city || customerSource.city || 'Cidade',
                        state: customer_extra?.state || customerSource.state || 'SP',
                        country: 'BR',
                        line_1: `${customer_extra?.number || customerSource.number || 'S/N'}, ${customer_extra?.street || customerSource.street || 'Rua'}, ${customer_extra?.neighborhood || customerSource.neighborhood || 'Bairro'}`
                    }
                },
                installments: 1,
                statement_descriptor: 'PLUS MIDIA',
                items: [
                    {
                        description: `Assinatura: ${billingData.contracts.name}`,
                        quantity: 1,
                        code: billing_id,
                        pricing_scheme: {
                            scheme_type: 'unit',
                            price: Math.round(amount * 100)
                        }
                    }
                ],
                metadata: {
                    contract_id: billingData.contracts.id,
                    initial_billing_id: billing_id
                }
            };

            response = await fetch('https://api.pagar.me/core/v5/subscriptions', {
                method: 'POST',
                headers: {
                    'Authorization': `Basic ${btoa(PAGARME_API_KEY + ':')}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(subscriptionPayload)
            });

            result = await response.json();
            console.log("📦 Pagar.me Subscription Response:", JSON.stringify(result, null, 2));

            if (response.ok && result.status === 'active') {
                await supabaseClient.from('contracts').update({
                    pagarme_subscription_id: result.id,
                    recurrence_status: 'active',
                    payment_method: 'credit_card'
                }).eq('id', billingData.contracts.id);
            }

        } else {
            // REGULAR ORDER LOGIC (PIX or Credit Card)
            const paymentPayload: any = {
                items: [
                    {
                        amount: Math.round(amount * 100),
                        description: type === 'contract' ? `Mensalidade: ${billingData.contracts.name}` : `Venda: ${billingData.description}`,
                        quantity: 1,
                        code: billing_id
                    }
                ],
                customer: customerData,
                metadata: {
                    billing_id: billing_id,
                    opportunity_id: opportunityId, // Pass opportunityId explicitly
                    workspace_id: workspaceId
                },
                payments: []
            };

            if (payment_method === 'credit_card') {
                paymentPayload.payments.push({
                    payment_method: 'credit_card',
                    credit_card: {
                        card: {
                            number: card?.number,
                            holder_name: card?.holder_name,
                            exp_month: card?.exp_month,
                            exp_year: card?.exp_year,
                            cvv: card?.cvv,
                            billing_address: {
                                street: customer_extra?.street || customerSource.street || 'Rua',
                                number: customer_extra?.number || customerSource.number || 'S/N',
                                neighborhood: customer_extra?.neighborhood || customerSource.neighborhood || 'Bairro',
                                zip_code: (customer_extra?.zip_code || customerSource.zip_code || '00000000').replace(/\D/g, ''),
                                city: customer_extra?.city || customerSource.city || 'Cidade',
                                state: customer_extra?.state || customerSource.state || 'SP',
                                country: 'BR'
                            }
                        },
                        installments: installments,
                        statement_descriptor: 'PLUS MIDIA'
                    }
                });
            } else if (payment_method === 'pix') {
                paymentPayload.payments.push({
                    payment_method: 'pix',
                    pix: {
                        expires_in: 3600 // 1 hour
                    }
                });
            }

            console.log("📤 Sending to Pagar.me:", JSON.stringify(paymentPayload, null, 2));

            response = await fetch('https://api.pagar.me/core/v5/orders', {
                method: 'POST',
                headers: {
                    'Authorization': `Basic ${btoa(PAGARME_API_KEY + ':')}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(paymentPayload)
            });

            result = await response.json();
            console.log("📦 Pagar.me Order Response:", JSON.stringify(result, null, 2));
        }

        if (!response.ok || result.status === 'failed') {
            const errorMessage = result.status === 'failed' ? "Pagamento recusado pela operadora" : "Erro ao processar pagamento";
            console.error("❌ Payment failed:", result);
            return new Response(JSON.stringify({
                success: false,
                error: errorMessage,
                status: result.status,
                details: result
            }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }

        const isPaid = result.status === 'paid' || result.status === 'active';
        const orderId = is_subscription ? result.current_invoice?.id || result.id : result.id;
        const chargeId = is_subscription ? result.current_invoice?.charge?.id || orderId : result.charges?.[0]?.id || result.id;

        // Get PIX data if payment is pending (PIX transaction)
        let pixData = null;
        if (payment_method === 'pix' && result.charges && result.charges[0]?.last_transaction) {
            const transaction = result.charges[0].last_transaction;
            pixData = {
                qr_code: transaction.qr_code,
                qr_code_url: transaction.qr_code_url,
                expires_at: transaction.expires_at
            };
            console.log("🔲 PIX QR Code generated:", pixData.qr_code_url);
        }

        // Create/Update local invoice record (only if clientId is valid or null for opportunity-based sales)
        const invoiceData: any = {
            workspace_id: workspaceId,
            pagarme_order_id: orderId,
            pagarme_charge_id: chargeId,
            status: isPaid ? 'paid' : 'pending',
            amount: amount,
            due_date: new Date().toISOString(),
            payment_method: payment_method
        };

        // Only set client_id if it's not null
        if (clientId) {
            invoiceData.client_id = clientId;
        }

        if (type === 'contract') {
            invoiceData.contract_billing_id = billing_id;
        } else {
            invoiceData.one_time_sale_id = billing_id;
        }

        // Add PIX data to invoice
        if (pixData) {
            invoiceData.pix_qr_code_url = pixData.qr_code_url;
            invoiceData.pix_copy_paste = pixData.qr_code;
        }

        if (financial_receivable_id) {
            invoiceData.financial_receivable_id = financial_receivable_id;
        }

        const conflictTarget = financial_receivable_id
            ? 'financial_receivable_id'
            : (type === 'contract' ? 'contract_billing_id' : 'one_time_sale_id');

        await supabaseClient.from('billing_invoices').upsert(
            invoiceData,
            { onConflict: conflictTarget }
        );

        if (isPaid) {
            const updateProps: any = { status: 'paid', payment_date: new Date() };
            if (pagarmeAccountId) {
                updateProps.bank_account_id = pagarmeAccountId;
            }

            if (type === 'contract') {
                await supabaseClient.from('contract_billings').update(updateProps).eq('id', billing_id);
            } else {
                await supabaseClient.from('one_time_sales').update(updateProps).eq('id', billing_id);
            }
            // Update receivables
            if (financial_receivable_id) {
                await supabaseClient.from('financial_receivables').update(updateProps).eq('id', financial_receivable_id);
            } else {
                await supabaseClient.from('financial_receivables').update(updateProps)
                    .eq(type === 'contract' ? 'contract_billing_id' : 'one_time_sale_id', billing_id);
            }
        }

        // Build response with correct charge structure
        const responseOrder = is_subscription ? {
            id: result.id,
            status: result.status,
            amount: amount,
            charges: result.current_invoice ? [{
                id: result.current_invoice.charge?.id,
                status: result.current_invoice.status,
                last_transaction: result.current_invoice.charge?.last_transaction
            }] : []
        } : {
            id: result.id,
            status: result.status,
            amount: result.amount,
            charges: result.charges?.map((c: any) => ({
                id: c.id,
                status: c.status,
                last_transaction: c.last_transaction
            })) || []
        };

        return new Response(JSON.stringify({
            success: true,
            status: result.status,
            order: responseOrder
        }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });

    } catch (err: any) {
        console.error("❌ Error:", err.message);
        console.error("Stack:", err.stack);
        return new Response(JSON.stringify({ success: false, error: err.message }), {
            status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }
});
