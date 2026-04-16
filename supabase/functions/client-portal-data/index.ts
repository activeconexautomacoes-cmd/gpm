import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' } });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { token } = await req.json();

    if (!token) {
      return new Response(JSON.stringify({ error: 'Token is required' }), { status: 400 });
    }

    // 1. Fetch Client by Token
    const { data: client, error: clientError } = await supabaseClient
      .from('clients')
      .select('id, name, email, document, workspace_id, phone')
      .eq('portal_token', token)
      .single();

    if (clientError || !client) {
      return new Response(JSON.stringify({ error: 'Invalid token' }), { status: 404 });
    }

    // 2. Fetch Pagarme Public Key
    const { data: integration } = await supabaseClient
      .from('workspace_integrations')
      .select('config')
      .eq('workspace_id', client.workspace_id)
      .eq('provider', 'pagarme')
      .single();

    // 3. Fetch Contract Billings
    const { data: billings } = await supabaseClient
      .from('contract_billings')
      .select('*, contracts!inner(name, client_id, pagarme_subscription_id, recurrence_status)')
      .eq('contracts.client_id', client.id)
      .order('due_date', { ascending: false });

    // 4. Fetch One-Time Sales
    const { data: sales } = await supabaseClient
      .from('one_time_sales')
      .select('*')
      .eq('client_id', client.id)
      .order('due_date', { ascending: false });

    // 5. Fetch Invoices
    const { data: invoices } = await supabaseClient
      .from('billing_invoices')
      .select('*')
      .eq('client_id', client.id);

    return new Response(JSON.stringify({
      client,
      billings: billings || [],
      sales: sales || [],
      invoices: invoices || [],
      pagarme_public_key: integration?.config?.public_key
    }), {
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    });

  } catch (error: any) {
    console.error('Portal Data Error:', error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    });
  }
});
