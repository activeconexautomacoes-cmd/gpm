import { createClient } from '@supabase/supabase-js';
import { addMonths, format } from 'date-fns';
import fs from 'fs';

// Manually load env
const env = fs.readFileSync('.env', 'utf8')
    .split('\n')
    .reduce((acc, line) => {
        const [key, val] = line.split('=');
        if (key && val) acc[key.trim()] = val.replace(/"/g, '').trim();
        return acc;
    }, {});

const supabaseUrl = env.VITE_SUPABASE_URL;
const supabaseKey = env.VITE_SUPABASE_PUBLISHABLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

const WORKSPACE_ID = '8eaae987-1b56-43de-978c-c135beb30c7e';

const generateBillingDates = (startDate, endDate, billingDay) => {
    const dates = [];
    const [startYear, startMonth, startDay] = startDate.split('-').map(Number);
    const [endYear, endMonth, endDay] = endDate.split('-').map(Number);

    const start = new Date(startYear, startMonth - 1, startDay);
    const end = new Date(endYear, endMonth - 1, endDay, 23, 59, 59);

    let currentDate = new Date(start);
    currentDate.setMonth(currentDate.getMonth() + 1);

    const adjustDay = (date, day) => {
        const lastDay = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
        date.setDate(Math.min(day, lastDay));
    };

    adjustDay(currentDate, billingDay);

    while (currentDate <= end) {
        dates.push(new Date(currentDate));
        currentDate.setMonth(currentDate.getMonth() + 1);
        adjustDay(currentDate, billingDay);
    }

    return dates;
};

async function fixMissingBillings() {
    console.log('--- Iniciando correção de cobranças faltantes ---');

    const { data: contracts, error: contractsError } = await supabase
        .from('contracts')
        .select('*')
        .eq('workspace_id', WORKSPACE_ID);

    if (contractsError) {
        console.error('Erro ao buscar contratos:', contractsError);
        return;
    }

    console.log(`Encontrados ${contracts.length} contratos.`);

    const { data: catData } = await supabase
        .from('financial_categories')
        .select('id')
        .eq('type', 'income')
        .limit(1)
        .maybeSingle();

    const defaultCategoryId = catData?.id || '77777777-7777-7777-7777-777777777777';

    let totalFixed = 0;

    for (const contract of contracts) {
        const { count, error: countError } = await supabase
            .from('contract_billings')
            .select('*', { count: 'exact', head: true })
            .eq('contract_id', contract.id);

        if (countError) {
            console.error(`Erro ao contar cobranças do contrato ${contract.id}:`, countError);
            continue;
        }

        if (count === 0 && contract.end_date) {
            console.log(`Contrato "${contract.name}" (${contract.id}) não tem cobranças. Gerando...`);

            const billingDates = generateBillingDates(
                contract.start_date,
                contract.end_date,
                contract.billing_day
            );

            if (billingDates.length > 0) {
                const billings = billingDates.map((date) => ({
                    workspace_id: WORKSPACE_ID,
                    contract_id: contract.id,
                    due_date: format(date, 'yyyy-MM-dd'),
                    amount: contract.value,
                    discount: 0,
                    final_amount: contract.value,
                    status: 'pending',
                }));

                const { data: insertedBillings, error: billingsError } = await supabase
                    .from('contract_billings')
                    .insert(billings)
                    .select();

                if (billingsError) {
                    console.error(`Erro ao inserir cobranças para o contrato ${contract.id}:`, billingsError);
                    continue;
                }

                console.log(`  - ${insertedBillings.length} cobranças geradas.`);

                const receivables = insertedBillings.map(billing => ({
                    workspace_id: WORKSPACE_ID,
                    description: `Mensalidade Contrato - ${contract.name}`,
                    amount: billing.final_amount,
                    total_amount: billing.final_amount,
                    due_date: billing.due_date,
                    category_id: defaultCategoryId,
                    client_id: contract.client_id,
                    status: 'pending',
                    contract_billing_id: billing.id,
                    contract_id: contract.id
                }));

                const { error: finError } = await supabase
                    .from('financial_receivables')
                    .insert(receivables);

                if (finError) {
                    console.error(`  - Erro ao gerar lançamentos financeiros:`, finError);
                } else {
                    console.log(`  - ${receivables.length} lançamentos financeiros criados.`);
                }

                totalFixed++;
            }
        }
    }

    console.log(`--- Processo concluído. ${totalFixed} contratos corrigidos. ---`);
}

fixMissingBillings();
