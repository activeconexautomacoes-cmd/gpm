
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { useToast } from "@/hooks/use-toast";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Upload, Download, AlertCircle, CheckCircle2, Loader2 } from "lucide-react";
import * as XLSX from "xlsx";
import { format } from "date-fns";
import { useBankAccounts, useFinancialCategories } from "@/hooks/useFinancialModules";

export function ImportFinancialDialog() {
    const { currentWorkspace } = useWorkspace();
    const { toast } = useToast();
    const queryClient = useQueryClient();
    const { accounts } = useBankAccounts(currentWorkspace?.id);
    const { categories } = useFinancialCategories(currentWorkspace?.id);

    const [open, setOpen] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [results, setResults] = useState<{ success: number; errors: string[] } | null>(null);

    const downloadTemplate = () => {
        const template = [
            {
                "Data Vencimento": format(new Date(), "dd/MM/yyyy"),
                "Descrição": "Exemplo de Receita",
                "Valor": 1500.00,
                "Tipo": "Receita",
                "Categoria": "Vendas",
                "Conta Bancária": accounts?.[0]?.name || "Cora",
                "Status": "Pago",
                "Data Pagamento": format(new Date(), "dd/MM/yyyy"),
                "Cliente/Fornecedor": "Cliente Exemplo"
            },
            {
                "Data Vencimento": format(new Date(), "dd/MM/yyyy"),
                "Descrição": "Exemplo de Despesa",
                "Valor": 500.00,
                "Tipo": "Despesa",
                "Categoria": "Aluguel",
                "Conta Bancária": accounts?.[0]?.name || "Cora",
                "Status": "Pendente",
                "Data Pagamento": "",
                "Cliente/Fornecedor": "Fornecedor Exemplo"
            }
        ];

        const ws = XLSX.utils.json_to_sheet(template);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Modelo_Importacao");
        XLSX.writeFile(wb, "modelo_gpm_financeiro.xlsx");
    };

    const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file || !currentWorkspace) return;

        setUploading(true);
        setResults(null);
        const reader = new FileReader();

        reader.onload = async (e) => {
            try {
                const data = new Uint8Array(e.target?.result as ArrayBuffer);
                const workbook = XLSX.read(data, { type: "array" });
                const sheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[sheetName];
                const jsonData = XLSX.utils.sheet_to_json(worksheet) as any[];

                let successCount = 0;
                let skippedCount = 0;
                const errorLog: string[] = [];

                // Pre-map entities for faster lookup
                const accountMap = new Map(accounts?.map(a => [a.name.toLowerCase().trim(), a.id]));
                const categoryMap = new Map(categories?.map(c => [c.name.toLowerCase().trim(), c.id]));

                // Fetch existing records to check for duplicates
                const { data: existingReceivables } = await supabase
                    .from("financial_receivables")
                    .select("description, amount, due_date, category_id")
                    .eq("workspace_id", currentWorkspace.id);

                const { data: existingPayables } = await supabase
                    .from("financial_payables")
                    .select("description, amount, due_date, category_id")
                    .eq("workspace_id", currentWorkspace.id);

                const createDuplicateKey = (desc: string, amt: number, date: string, catId: string) =>
                    `${desc.toLowerCase().trim()}|${amt}|${date}|${catId}`;

                const duplicateSet = new Set([
                    ...(existingReceivables || []).map(r => createDuplicateKey(r.description, Number(r.amount), r.due_date, r.category_id)),
                    ...(existingPayables || []).map(p => createDuplicateKey(p.description, Number(p.amount), p.due_date, p.category_id))
                ]);

                for (const row of jsonData) {
                    try {
                        const dueDateRaw = row["Data Vencimento"];
                        const description = row["Descrição"]?.toString() || "";
                        const amount = parseFloat(row["Valor"]);
                        const type = row["Tipo"]?.toString().trim();
                        const categoryName = row["Categoria"]?.toString().trim().toLowerCase();
                        const accountName = row["Conta Bancária"]?.toString().trim().toLowerCase();
                        const status = row["Status"]?.toString().trim().toLowerCase();
                        const paymentDateRaw = row["Data Pagamento"];

                        if (!dueDateRaw || !description || isNaN(amount) || !type || !categoryName || !accountName) {
                            errorLog.push(`Linha com dados incompletos: ${description || 'Sem descrição'}`);
                            continue;
                        }

                        const accountId = accountMap.get(accountName);
                        const categoryId = categoryMap.get(categoryName);

                        if (!accountId) {
                            errorLog.push(`Conta Bancária não encontrada: ${row["Conta Bancária"]}`);
                            continue;
                        }

                        if (!categoryId) {
                            errorLog.push(`Categoria não encontrada: ${row["Categoria"]}`);
                            continue;
                        }

                        const isIncome = type.toLowerCase() === "receita";
                        const table = isIncome ? "financial_receivables" : "financial_payables";
                        const isPaid = status === "pago";

                        // Parse date (Excel can give numbers or strings)
                        const parseDate = (val: any) => {
                            if (typeof val === 'number') {
                                return new Date((val - 25569) * 86400 * 1000).toISOString().split('T')[0];
                            }
                            if (typeof val === 'string') {
                                const parts = val.split('/');
                                if (parts.length === 3) return `${parts[2]}-${parts[1]}-${parts[0]}`;
                                return val; // Assume YYYY-MM-DD
                            }
                            return new Date().toISOString().split('T')[0];
                        };

                        const formattedDueDate = parseDate(dueDateRaw);
                        const formattedPaymentDate = isPaid ? parseDate(paymentDateRaw || dueDateRaw) : null;

                        // Check for duplicate
                        const rowKey = createDuplicateKey(description, amount, formattedDueDate, categoryId);
                        if (duplicateSet.has(rowKey)) {
                            skippedCount++;
                            continue;
                        }

                        // Insert into Receivables or Payables
                        const { data: inserted, error: insertError } = await (supabase as any)
                            .from(table)
                            .insert({
                                workspace_id: currentWorkspace.id,
                                title: description,
                                description,
                                amount,
                                total_amount: amount,
                                due_date: formattedDueDate,
                                competence_date: formattedDueDate,
                                payment_date: formattedPaymentDate,
                                status: isPaid ? 'paid' : 'pending',
                                category_id: categoryId,
                                bank_account_id: accountId,
                            })
                            .select()
                            .single();

                        if (insertError) {
                            errorLog.push(`Erro ao inserir ${description}: ${insertError.message}`);
                            continue;
                        }

                        // If paid, create a bank transaction
                        if (isPaid && inserted) {
                            const { error: transError } = await supabase
                                .from("financial_bank_transactions")
                                .insert({
                                    workspace_id: currentWorkspace.id,
                                    bank_account_id: accountId,
                                    transaction_date: formattedPaymentDate || formattedDueDate,
                                    amount: isIncome ? amount : -amount,
                                    description: `[Import] ${description}`,
                                    status: 'reconciled',
                                    fitid: `import_${inserted.id.slice(0, 8)}`,
                                    [isIncome ? 'matched_receivable_id' : 'matched_payable_id']: inserted.id
                                } as any);

                            if (transError) {
                                errorLog.push(`Erro ao criar transação para ${description}: ${transError.message}`);
                            } else {
                                // Update bank account balance
                                const { data: account } = await supabase
                                    .from("financial_bank_accounts")
                                    .select("current_balance")
                                    .eq("id", accountId)
                                    .single();

                                const newBalance = (Number(account?.current_balance) || 0) + (isIncome ? amount : -amount);

                                await supabase
                                    .from("financial_bank_accounts")
                                    .update({ current_balance: newBalance })
                                    .eq("id", accountId);
                            }
                        }

                        successCount++;
                        // Add to set to avoid duplicates within the same file if any
                        duplicateSet.add(rowKey);
                    } catch (err: any) {
                        errorLog.push(`Erro processando linha: ${err.message}`);
                    }
                }

                setResults({ success: successCount, errors: errorLog });
                queryClient.invalidateQueries({ queryKey: ["financial_receivables"] });
                queryClient.invalidateQueries({ queryKey: ["financial_payables"] });
                queryClient.invalidateQueries({ queryKey: ["financial_bank_transactions"] });
                queryClient.invalidateQueries({ queryKey: ["financial_bank_accounts"] });

                if (errorLog.length === 0) {
                    toast({
                        title: "Importação concluída!",
                        description: `${successCount} registros novos importados. ${skippedCount} duplicados ignorados.`,
                    });
                } else {
                    toast({
                        title: "Importação finalizada com alertas",
                        description: `${successCount} registros novos importados. ${skippedCount} duplicados ignorados. Verifique os erros abaixo.`,
                        variant: "destructive",
                    });
                }

            } catch (err: any) {
                console.error(err);
                toast({
                    title: "Erro ao ler arquivo",
                    description: "Verifique o formato do arquivo e tente novamente.",
                    variant: "destructive",
                });
            } finally {
                setUploading(false);
            }
        };

        reader.readAsArrayBuffer(file);
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button variant="outline">
                    <Upload className="mr-2 h-4 w-4" />
                    Importar Movimentações
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                    <DialogTitle>Importar Dados Financeiros</DialogTitle>
                    <DialogDescription>
                        Suba sua planilha de migração seguindo o modelo padrão do GPM.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-6 py-4">
                    <div className="flex items-center justify-between p-4 border rounded-lg bg-muted/50">
                        <div className="space-y-1">
                            <p className="text-sm font-medium">Modelo de Importação</p>
                            <p className="text-xs text-muted-foreground">Baixe o Excel com as colunas corretas.</p>
                        </div>
                        <Button variant="ghost" size="sm" onClick={downloadTemplate}>
                            <Download className="mr-2 h-4 w-4" />
                            Baixar
                        </Button>
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-medium">Selecione o arquivo (XLSX ou CSV)</label>
                        <Input
                            type="file"
                            accept=".xlsx, .xls, .csv"
                            onChange={handleFileUpload}
                            disabled={uploading}
                        />
                    </div>

                    {uploading && (
                        <div className="flex flex-col items-center justify-center py-4 space-y-2">
                            <Loader2 className="h-8 w-8 animate-spin text-primary" />
                            <p className="text-sm text-muted-foreground">Processando registros... por favor aguarde.</p>
                        </div>
                    )}

                    {results && (
                        <div className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="flex items-center p-3 border rounded-lg bg-green-50 dark:bg-green-900/10">
                                    <CheckCircle2 className="h-5 w-5 text-green-600 mr-2" />
                                    <div>
                                        <p className="text-xs text-muted-foreground">Sucesso</p>
                                        <p className="text-lg font-bold text-green-600">{results.success}</p>
                                    </div>
                                </div>
                                <div className="flex items-center p-3 border rounded-lg bg-red-50 dark:bg-red-900/10">
                                    <AlertCircle className="h-5 w-5 text-red-600 mr-2" />
                                    <div>
                                        <p className="text-xs text-muted-foreground">Erros</p>
                                        <p className="text-lg font-bold text-red-600">{results.errors.length}</p>
                                    </div>
                                </div>
                            </div>

                            {results.errors.length > 0 && (
                                <div className="max-h-[150px] overflow-auto p-3 border rounded bg-muted/30 text-xs space-y-1">
                                    <p className="font-bold mb-2">Log de Erros:</p>
                                    {results.errors.map((err, i) => (
                                        <p key={i} className="text-red-500">• {err}</p>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}
