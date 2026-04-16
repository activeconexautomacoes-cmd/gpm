import { useMemo, useState, useEffect } from "react";
import { useBankAccounts, useBankTransactions } from "@/hooks/useFinancialModules";
import { parseOFX, OFXTransaction } from "@/utils/ofxParser";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ReconcileAction } from "./ReconcileAction";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatCurrency } from "@/utils/format";
import { useToast } from "@/hooks/use-toast";
import { useWorkspace } from "@/contexts/WorkspaceContext";

export function BankReconciliation() {
    const { currentWorkspace } = useWorkspace();
    const { accounts } = useBankAccounts(currentWorkspace?.id);
    const [selectedAccountId, setSelectedAccountId] = useState<string>("");
    const { transactions: existingTransactions, importTransactions } = useBankTransactions(currentWorkspace?.id, selectedAccountId);
    const [parsedTransactions, setParsedTransactions] = useState<OFXTransaction[]>([]);
    const { toast } = useToast();
    const [selectedPeriod, setSelectedPeriod] = useState<string>("0");

    // Auto-select account if only one exists or if one is marked as principal
    useEffect(() => {
        if (accounts && accounts.length > 0 && !selectedAccountId) {
            if (accounts.length === 1) {
                setSelectedAccountId(accounts[0].id);
            } else {
                const principal = accounts.find(a => a.is_principal);
                if (principal) {
                    setSelectedAccountId(principal.id);
                }
            }
        }
    }, [accounts, selectedAccountId]);

    const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        const text = await file.text();
        const transactions = parseOFX(text);
        setParsedTransactions(transactions);
        toast({
            title: "Arquivo lido com sucesso",
            description: `${transactions.length} transações encontradas.`,
        });
    };

    const handleImport = async () => {
        if (!selectedAccountId) {
            toast({
                title: "Erro",
                description: "Selecione uma conta bancária para importar.",
                variant: "destructive",
            });
            return;
        }

        // Map OFX to DB structure
        const dbTransactions = parsedTransactions.map(t => ({
            workspace_id: accounts?.find(a => a.id === selectedAccountId)?.workspace_id || "",
            bank_account_id: selectedAccountId,
            transaction_date: t.date.toISOString(),
            amount: t.amount,
            description: t.description,
            fitid: t.id,
            status: "pending" as const
        }));

        try {
            const result = await importTransactions.mutateAsync(dbTransactions);
            const importedCount = result?.length || 0;
            const totalCount = dbTransactions.length;
            const duplicateCount = totalCount - importedCount;

            if (importedCount === 0) {
                toast({
                    title: "Nenhuma novidade",
                    description: "Todas as transações deste arquivo já foram importadas anteriormente.",
                });
            } else if (duplicateCount > 0) {
                toast({
                    title: "Importação Parcial",
                    description: `${importedCount} novas transações importadas. ${duplicateCount} já existiam e foram ignoradas.`,
                });
            } else {
                toast({
                    title: "Sucesso",
                    description: "Todas as transações importadas com sucesso.",
                });
            }

            setParsedTransactions([]); // Clear preview
        } catch (error) {
            console.error(error);
            toast({
                title: "Erro ao importar",
                description: "Ocorreu um erro ao processar o arquivo.",
                variant: "destructive",
            });
        }
    };

    return (
        <div className="space-y-6">
            <Card>
                <CardHeader>
                    <CardTitle>Importação de Extrato (OFX)</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="flex flex-col md:flex-row gap-4 md:items-end">
                        <div className="space-y-2 w-full md:w-[300px]">
                            <label className="text-sm font-medium">Conta Bancária</label>
                            <Select value={selectedAccountId} onValueChange={setSelectedAccountId}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Selecione a conta..." />
                                </SelectTrigger>
                                <SelectContent>
                                    {accounts?.map((acc) => (
                                        <SelectItem key={acc.id} value={acc.id}>
                                            {acc.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2 flex-1">
                            <label className="text-sm font-medium">Arquivo OFX</label>
                            <Input type="file" accept=".ofx" onChange={handleFileUpload} />
                        </div>
                    </div>

                    {parsedTransactions.length > 0 && (
                        <div className="mt-4">
                            <h3 className="font-semibold mb-2">Pré-visualização</h3>
                            <div className="max-h-[300px] overflow-auto border rounded-md">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Data</TableHead>
                                            <TableHead>Descrição</TableHead>
                                            <TableHead className="text-right">Valor</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {parsedTransactions.map((t) => (
                                            <TableRow key={t.id}>
                                                <TableCell className="whitespace-nowrap">{t.date.toLocaleDateString()}</TableCell>
                                                <TableCell>{t.description}</TableCell>
                                                <TableCell className={t.amount < 0 ? "text-red-500 text-right whitespace-nowrap" : "text-green-500 text-right whitespace-nowrap"}>
                                                    {formatCurrency(t.amount)}
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>
                            <div className="mt-4 flex justify-end">
                                <Button onClick={handleImport} className="w-full md:w-auto">Confirmar Importação de {parsedTransactions.length} itens</Button>
                            </div>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Reconciliation Matcher */}
            {selectedAccountId && existingTransactions && existingTransactions.length > 0 && (
                <div className="space-y-4">
                    {existingTransactions.filter(t => t.status === 'pending').length > 0 && (
                        <div className="bg-yellow-50 dark:bg-yellow-900/10 p-4 border border-yellow-200 dark:border-yellow-900 rounded-md">
                            <h3 className="font-semibold text-yellow-800 dark:text-yellow-200 mb-2">
                                {existingTransactions.filter(t => t.status === 'pending').length} transações pendentes de conciliação
                            </h3>
                            <p className="text-sm text-yellow-700 dark:text-yellow-300">
                                Verifique os itens abaixo e vincule aos lançamentos correspondentes.
                            </p>
                        </div>
                    )}
                </div>
            )}

            <Card>
                <CardHeader>
                    <CardTitle>Conciliação</CardTitle>
                </CardHeader>
                <CardContent>
                    {!selectedAccountId ? (
                        <div className="text-center py-8 text-muted-foreground">Selecione uma conta acima para ver a conciliação.</div>
                    ) : (
                        <div className="rounded-md border overflow-x-auto">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead className="whitespace-nowrap">Data</TableHead>
                                        <TableHead className="min-w-[200px]">Descrição (Banco)</TableHead>
                                        <TableHead className="text-right">Valor</TableHead>
                                        <TableHead>Status</TableHead>
                                        <TableHead>Ação</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {existingTransactions?.map((t) => (
                                        <TableRow key={t.id}>
                                            <TableCell className="whitespace-nowrap">{new Date(t.transaction_date).toLocaleDateString()}</TableCell>
                                            <TableCell>{t.description}</TableCell>
                                            <TableCell className={t.amount < 0 ? "text-red-500 text-right whitespace-nowrap" : "text-green-500 text-right whitespace-nowrap"}>
                                                {formatCurrency(t.amount)}
                                            </TableCell>
                                            <TableCell>
                                                <Badge variant={t.status === 'reconciled' ? "success" : "secondary"}>
                                                    {t.status === 'reconciled' ? 'Conciliado' : 'Pendente'}
                                                </Badge>
                                            </TableCell>
                                            <TableCell>
                                                {t.status === 'pending' && (
                                                    <ReconcileAction transaction={t} />
                                                )}
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                    {!existingTransactions?.length && (
                                        <TableRow>
                                            <TableCell colSpan={5} className="text-center py-4 text-muted-foreground">Nenhuma transação importada.</TableCell>
                                        </TableRow>
                                    )}
                                </TableBody>
                            </Table>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
