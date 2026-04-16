import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://rkngilknpcibcwalropj.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJrbmdpbGtucGNpYmN3YWxyb3BqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE2NTEzOTUsImV4cCI6MjA3NzIyNzM5NX0.b_TCn2hsU8UPFvqGnXzzKhJApm9NVMxqxxNAOHyNsdQ';
const supabase = createClient(supabaseUrl, supabaseKey);

const WORKSPACE_ID = '8eaae987-1b56-43de-978c-c135beb30c7e'; // Plus Mídia

const clients = [
    {
        "Nome do Cliente": "30.723.990 VINICIUS ZANDONADI NUNES",
        "Email": "zandonadi_@hotmail.com",
        "Telefone": "+55 49 9972-0962",
        "Documento": "30723990000157",
        "Status": "Ativo",
        "Notas": "Assessoria completa de marketing (desde 21/08/2025)"
    },
    {
        "Nome do Cliente": "44.855.464 LEILANE CRISTIANE DE MELLO ROCHA",
        "Email": "filipe-sribeiro@hotmail.com",
        "Telefone": "+55 22 99251-2539",
        "Documento": "44855464000155",
        "Status": "Ativo",
        "Notas": "Assessoria completa de marketing (desde 26/08/2025)"
    },
    {
        "Nome do Cliente": "51.429.999 EDWIN GESSE DE SOUSA SILVA",
        "Email": "rayanthiagosantana20@gmail.com",
        "Telefone": "+55 93 9194-9889",
        "Documento": "51429999000120",
        "Status": "Ativo",
        "Notas": "Assessoria completa de marketing (desde 15/08/2025)"
    },
    {
        "Nome do Cliente": "53.563.423 LEONARDO JOSE WIEDERKEHR SBARDELOTTO",
        "Email": "leosba07@gmail.com",
        "Telefone": "+55 49 99841-0695",
        "Documento": "53563423000186",
        "Status": "Ativo",
        "Notas": "Assessoria completa de marketing (desde 17/09/2025)"
    },
    {
        "Nome do Cliente": "53.628.841 MARCELLO HENRIQUE MARTINS CAMPERLINGO PEREIRA",
        "Email": "lollyskin01@gmail.com",
        "Telefone": "(11) 96642-8840",
        "Documento": "53628841000104",
        "Status": "Ativo",
        "Notas": "Assessoria completa de marketing (desde 10/09/2025)"
    }
    // Adicione o resto dos clientes aqui conforme necessário
];

async function importClients() {
    console.log('🚀 Iniciando importação de clientes...\n');

    const clientsToInsert = clients.map(client => ({
        workspace_id: WORKSPACE_ID,
        name: client["Nome do Cliente"],
        email: client.Email || null,
        phone: client.Telefone || null,
        document: client.Documento || null,
        status: client.Status?.toLowerCase() === "inativo" ? "inactive" : "active",
        notes: client.Notas || null
    }));

    console.log(`📊 Total de clientes a importar: ${clientsToInsert.length}\n`);

    // Importar em lotes de 50 para evitar timeout
    const batchSize = 50;
    let successCount = 0;
    let errorCount = 0;

    for (let i = 0; i < clientsToInsert.length; i += batchSize) {
        const batch = clientsToInsert.slice(i, i + batchSize);
        console.log(`📦 Importando lote ${Math.floor(i / batchSize) + 1} (${batch.length} clientes)...`);

        const { data, error } = await supabase
            .from('clients')
            .insert(batch);

        if (error) {
            console.error(`❌ Erro no lote ${Math.floor(i / batchSize) + 1}:`, error.message);
            errorCount += batch.length;
        } else {
            console.log(`✅ Lote ${Math.floor(i / batchSize) + 1} importado com sucesso!`);
            successCount += batch.length;
        }
    }

    console.log('\n📊 Resultado da importação:');
    console.log(`  ✅ Sucesso: ${successCount} clientes`);
    console.log(`  ❌ Erros: ${errorCount} clientes`);
    console.log('\n✨ Importação concluída!');
}

importClients().catch(console.error);
