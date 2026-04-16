import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';

// Helper function to get current date in Brazil timezone (UTC-3)
function getBrazilDateString(): string {
    const now = new Date();
    // Brazil is UTC-3
    const brazilOffset = -3 * 60; // -180 minutes
    const utcOffset = now.getTimezoneOffset(); // in minutes
    const brazilTime = new Date(now.getTime() + (utcOffset + brazilOffset) * 60 * 1000);

    const year = brazilTime.getFullYear();
    const month = String(brazilTime.getMonth() + 1).padStart(2, '0');
    const day = String(brazilTime.getDate()).padStart(2, '0');

    return `${year}-${month}-${day}`;
}

Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' } });
    }

    try {
        const supabaseClient = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        );

        // Extract and validate webhook token from query string
        const url = new URL(req.url);
        const token = url.searchParams.get('token');

        if (token) {
            const { data: ws } = await supabaseClient
                .from('workspaces')
                .select('id, name')
                .eq('pagarme_webhook_token', token)
                .single();

            if (!ws) {
                console.error('❌ Invalid webhook token:', token);
                return new Response(JSON.stringify({ error: 'Invalid token' }), {
                    status: 401,
                    headers: { 'Content-Type': 'application/json' }
                });
            }
            console.log(`✅ Webhook validated for workspace: ${ws.name} (${ws.id})`);
        } else {
            console.log('ℹ️ No token provided, using legacy mode (order-based identification)');
        }

        const body = await req.json();

        // Pagar.me API v5 uses "type" field, not "event"
        const event = body.type || body.event;
        const data = body.data;

        console.log('📥 Webhook received:', event);
        console.log('📦 Order ID:', data?.id);

        if (event === 'charge.paid' || event === 'order.paid' || event === 'invoice.paid') {
            // Handle different payload structures for different events
            // charge.paid: data.id = charge_id, data.order.id = order_id
            // order.paid: data.id = order_id, data.charges[0].id = charge_id
            let orderId: string | null = null;
            let chargeId: string | null = null;

            if (event === 'charge.paid') {
                chargeId = data?.id;
                orderId = data?.order?.id;
            } else {
                orderId = data?.id;
                chargeId = data?.charges?.[0]?.id;
            }

            const subscriptionId = data?.subscription?.id;

            console.log(`🔄 Processing ${event} for Order: ${orderId}, Charge: ${chargeId}, Subscription: ${subscriptionId}`);

            let billingId: string | null = null;
            let type: 'contract' | 'sale' = 'contract';
            let workspaceId: string | null = null;
            let invoiceFound = false;

            // 0. Handle Opportunity Closing Payment (from metadata)
            const metadata = data?.metadata;
            if (metadata?.type === 'opportunity_closing' && metadata?.opportunity_id) {
                console.log(`✅ Processing Opportunity Payment for Opportunity: ${metadata.opportunity_id}`);
                await supabaseClient
                    .from('opportunities')
                    .update({ payment_status: 'paid' })
                    .eq('id', metadata.opportunity_id);

                return new Response(JSON.stringify({ received: true, type: 'opportunity_update' }), {
                    headers: { 'Content-Type': 'application/json' }
                });
            }

            // 1. Handle Subscription Invoice
            if (event === 'invoice.paid' && subscriptionId) {
                const { data: contract, error: cError } = await supabaseClient
                    .from('contracts')
                    .select('id, workspace_id, client_id')
                    .eq('pagarme_subscription_id', subscriptionId)
                    .single();

                if (contract) workspaceId = contract.workspace_id;

                if (cError || !contract) {
                    console.error('❌ Contract not found for subscription:', subscriptionId);
                    return new Response(JSON.stringify({ error: 'Contract not found' }), { status: 404 });
                }

                const { data: billing } = await supabaseClient
                    .from('contract_billings')
                    .select('id, final_amount')
                    .eq('contract_id', contract.id)
                    .eq('status', 'pending')
                    .order('due_date', { ascending: true })
                    .limit(1)
                    .maybeSingle();

                if (!billing) {
                    console.log('⚠️ No pending billing found for subscription:', subscriptionId);
                    return new Response(JSON.stringify({ received: true, message: 'No pending billing' }));
                }

                billingId = billing.id;
                invoiceFound = true;

                await supabaseClient.from('billing_invoices').upsert({
                    workspace_id: contract.workspace_id,
                    client_id: contract.client_id,
                    contract_billing_id: billingId,
                    pagarme_order_id: data.id,
                    pagarme_charge_id: data.charge?.id || data.id,
                    status: 'paid',
                    amount: billing.final_amount,
                    due_date: new Date().toISOString(),
                    payment_method: 'credit_card'
                }, { onConflict: 'contract_billing_id' });

            } else {
                // 2. Handle Regular Order/Charge (order.paid or charge.paid)
                console.log(`🔍 Looking for invoice with pagarme_order_id: ${orderId}`);

                // Strategy 1: Find by pagarme_order_id
                const { data: invoice, error: invError } = await supabaseClient
                    .from('billing_invoices')
                    .select('*')
                    .eq('pagarme_order_id', orderId)
                    .maybeSingle();

                if (invoice) {
                    console.log('✅ Found invoice by order_id');
                    workspaceId = invoice.workspace_id;
                    billingId = invoice.contract_billing_id || invoice.one_time_sale_id;
                    type = invoice.contract_billing_id ? 'contract' : 'sale';
                    invoiceFound = true;

                    await supabaseClient
                        .from('billing_invoices')
                        .update({ status: 'paid', updated_at: new Date().toISOString() })
                        .eq('id', invoice.id);

                    console.log(`✅ Updated billing_invoice ${invoice.id} to paid`);
                }

                // Strategy 2: Find by charge_id
                if (!invoiceFound && chargeId) {
                    console.log(`🔍 Trying to find by charge_id: ${chargeId}`);
                    const { data: invoiceByCharge } = await supabaseClient
                        .from('billing_invoices')
                        .select('*')
                        .eq('pagarme_charge_id', chargeId)
                        .maybeSingle();

                    if (invoiceByCharge) {
                        console.log('✅ Found invoice by charge_id');
                        billingId = invoiceByCharge.contract_billing_id || invoiceByCharge.one_time_sale_id;
                        type = invoiceByCharge.contract_billing_id ? 'contract' : 'sale';
                        workspaceId = invoiceByCharge.workspace_id;
                        invoiceFound = true;

                        await supabaseClient
                            .from('billing_invoices')
                            .update({
                                status: 'paid',
                                pagarme_order_id: orderId,
                                updated_at: new Date().toISOString()
                            })
                            .eq('id', invoiceByCharge.id);
                    }
                }

                // Strategy 3: Find pending invoice by item code (billing_id)
                // Extract billing info from order items or metadata
                if (!invoiceFound) {
                    // Try to find items in data.items or data.order.items
                    const orderItems = data?.items || data?.order?.items || [];
                    const itemCode = orderItems[0]?.code;

                    // Fallback to metadata
                    const metadataBillingId = data?.metadata?.initial_billing_id ||
                        data?.order?.metadata?.initial_billing_id ||
                        data?.metadata?.billing_id;

                    const effectiveBillingId = itemCode || metadataBillingId;

                    if (effectiveBillingId) {
                        console.log(`🔍 Trying to find pending invoice by billing code/metadata: ${effectiveBillingId}`);

                        // Try to find by one_time_sale_id
                        const { data: invoiceByCode } = await supabaseClient
                            .from('billing_invoices')
                            .select('*')
                            .eq('one_time_sale_id', effectiveBillingId)
                            .maybeSingle();

                        if (invoiceByCode) {
                            console.log('✅ Found invoice by item code/metadata (one_time_sale_id)');
                            billingId = invoiceByCode.one_time_sale_id;
                            type = 'sale';
                            workspaceId = invoiceByCode.workspace_id;
                            invoiceFound = true;

                            await supabaseClient
                                .from('billing_invoices')
                                .update({
                                    status: 'paid',
                                    pagarme_order_id: orderId,
                                    pagarme_charge_id: chargeId,
                                    updated_at: new Date().toISOString()
                                })
                                .eq('id', invoiceByCode.id);
                        } else {
                            // Try contract_billing_id
                            const { data: invoiceByContractCode } = await supabaseClient
                                .from('billing_invoices')
                                .select('*')
                                .eq('contract_billing_id', effectiveBillingId)
                                .maybeSingle();

                            if (invoiceByContractCode) {
                                console.log('✅ Found invoice by item code/metadata (contract_billing_id)');
                                billingId = invoiceByContractCode.contract_billing_id;
                                type = 'contract';
                                workspaceId = invoiceByContractCode.workspace_id;
                                invoiceFound = true;

                                await supabaseClient
                                    .from('billing_invoices')
                                    .update({
                                        status: 'paid',
                                        pagarme_order_id: orderId,
                                        pagarme_charge_id: chargeId,
                                        updated_at: new Date().toISOString()
                                    })
                                    .eq('id', invoiceByContractCode.id);
                            }
                        }
                    }
                }

                if (!invoiceFound) {
                    console.error('❌ Invoice not found by any strategy for order:', orderId);
                    // Return 200 to avoid retries - we'll log but won't block
                    return new Response(JSON.stringify({
                        received: true,
                        warning: 'Invoice not found, payment may have been processed by pagarme-billing directly',
                        orderId,
                        chargeId
                    }), {
                        status: 200,
                        headers: { 'Content-Type': 'application/json' }
                    });
                }
            }

            // 3. Common Update Logic for Source Tables
            if (billingId && invoiceFound) {
                const today = getBrazilDateString();
                const amountInReais = (data.amount || data.charges?.[0]?.amount || 0) / 100;

                // Fetch Pagar.me Bank Account ID
                const { data: pAccount } = await supabaseClient
                    .from('financial_bank_accounts')
                    .select('id')
                    .eq('workspace_id', workspaceId)
                    .eq('name', 'Pagar.me')
                    .limit(1)
                    .maybeSingle();

                const updateProps: any = {
                    status: 'paid',
                    payment_date: today
                };

                if (pAccount) {
                    updateProps.bank_account_id = pAccount.id;
                }

                // Update original billing records
                let receivableId: string | null = null;

                if (type === 'contract') {
                    await supabaseClient.from('contract_billings').update(updateProps).eq('id', billingId);
                    console.log(`✅ Updated contract_billings ${billingId} to paid`);

                    // Find the receivable ID for contract billing
                    const { data: rec } = await supabaseClient
                        .from('financial_receivables')
                        .select('id')
                        .eq('contract_billing_id', billingId)
                        .maybeSingle();
                    receivableId = rec?.id;
                } else {
                    await supabaseClient.from('one_time_sales').update(updateProps).eq('id', billingId);
                    console.log(`✅ Updated one_time_sales ${billingId} to paid`);

                    // Get opportunity_id from metadata (if available) or fetch from database
                    let opportunityId = data?.metadata?.opportunity_id || data?.order?.metadata?.opportunity_id;

                    if (!opportunityId) {
                        const { data: sale } = await supabaseClient
                            .from('one_time_sales')
                            .select('opportunity_id')
                            .eq('id', billingId)
                            .maybeSingle();
                        opportunityId = sale?.opportunity_id;
                    }

                    if (opportunityId) {
                        const { error: oppError } = await supabaseClient
                            .from('opportunities')
                            .update({
                                payment_status: 'paid',
                                updated_at: new Date().toISOString()
                            })
                            .eq('id', opportunityId);

                        if (oppError) {
                            console.error(`❌ Error updating opportunity ${opportunityId}:`, oppError);
                        } else {
                            console.log(`✅ Updated opportunity ${opportunityId} payment_status to paid`);
                        }
                    } else {
                        console.warn(`⚠️ Opportunity ID not found for billing ${billingId}`);
                    }

                    // Find the receivable ID for one time sale
                    const { data: rec } = await supabaseClient
                        .from('financial_receivables')
                        .select('id')
                        .eq('one_time_sale_id', billingId)
                        .maybeSingle();
                    receivableId = rec?.id;
                }

                // Update financial_receivables table (Universal Update)
                const recUpdate = await supabaseClient
                    .from('financial_receivables')
                    .update(updateProps)
                    .eq(type === 'contract' ? 'contract_billing_id' : 'one_time_sale_id', billingId);

                if (!recUpdate.error) {
                    console.log(`✅ Updated financial_receivables for ${type} ${billingId}`);
                }

                // CREATE BANK TRANSACTION (STATUTORY RECORD / EXTRATO)
                if (pAccount && receivableId && amountInReais > 0) {
                    const desc = type === 'contract' ? `Recebimento Contrato - Ref: ${billingId}` : `Recebimento Venda - Ref: ${billingId}`;
                    const fitid = chargeId || orderId || `tr_${Date.now()}`;

                    const { error: transError } = await supabaseClient
                        .from('financial_bank_transactions')
                        .upsert({
                            workspace_id: workspaceId,
                            bank_account_id: pAccount.id,
                            transaction_date: today,
                            amount: amountInReais,
                            description: desc,
                            fitid: fitid,
                            status: 'reconciled',
                            matched_receivable_id: receivableId
                        }, { onConflict: 'bank_account_id, fitid' });

                    if (transError) {
                        console.error('❌ Error creating bank transaction:', transError.message);
                    } else {
                        console.log(`\ud83d\udcb0 Bank transaction (extract) created and reconciled for account: Pagar.me`);
                    }
                }

                console.log('✅ Payment synchronized successfully for billing:', billingId);
            }
        } else {
            console.log('ℹ️ Event not handled:', event);
        }

        return new Response(JSON.stringify({ received: true }), {
            headers: { 'Content-Type': 'application/json' }
        });

    } catch (error: any) {
        console.error('❌ Webhook Error:', error.message);
        console.error('Stack:', error.stack);
        return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
});
