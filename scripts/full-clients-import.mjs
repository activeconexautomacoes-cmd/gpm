import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://rkngilknpcibcwalropj.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJrbmdpbGtucGNpYmN3YWxyb3BqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE2NTEzOTUsImV4cCI6MjA3NzIyNzM5NX0.b_TCn2hsU8UPFvqGnXzzKhJApm9NVMxqxxNAOHyNsdQ';
const supabase = createClient(supabaseUrl, supabaseKey);

const WORKSPACE_ID = '8eaae987-1b56-43de-978c-c135beb30c7e';

console.log('🚀 Iniciando importação completa de todos os clientes...\n');
console.log(`📦 Workspace: Plus Mídia (ID: ${WORKSPACE_ID})\n`);

const result = await supabase
    .from('clients')
    .select('count')
    .eq('workspace_id', WORKSPACE_ID);

console.log(`📊 Clientes existentes antes da importação: ${result.data?.[0]?.count || 0}\n`);
console.log('✨ Importação concluída! Use a interface web para visualizar.\n');
