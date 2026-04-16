import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useReceivables, usePayables, useFinancialCategories, useBankAccounts } from "@/hooks/useFinancialModules";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { useState, useEffect } from "react";
import { Check, Search, Link as LinkIcon, Plus, Loader2, ArrowRightLeft } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { formatCurrency } from "@/utils/format";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { useQueryClient } from "@tanstack/react-query";

interface ReconcileActionProps {
    transaction: any;
}

export function ReconcileAction({ transaction }: ReconcileActionProps) {
    const [open, setOpen] = useState(false);
    const { toast } = useToast();
    const queryClient = useQueryClient();
    const { currentWorkspace } = useWorkspace();
    const { receivables, updateReceivable, createReceivable } = useReceivables(currentWorkspace?.id);
    const { payables, updatePayable, createPayable } = usePayables(currentWorkspace?.id);
    const { categories } = useFinancialCategories(currentWorkspace?.id);

    // New Transaction Form State
    const [newDescription, setNewDescription] = useState(transaction.description);
    const [newCategoryId, setNewCategoryId] = useState("");
    const [isCreating, setIsCreating] = useState(false);

    // Discrepancy Handling
    const [view, setView] = useState<'default' | 'confirm_diff'>('default');
    const [pendingMatch, setPendingMatch] = useState<{ type: 'payable' | 'receivable', item: any } | null>(null);

    const isIncome = transaction.amount > 0;
    const absAmount = Math.abs(transaction.amount);

    useEffect(() => {
        if (open) {
            setNewDescription(transaction.description);
            setNewCategoryId("");
            setView('default');
            setPendingMatch(null);
        }
    }, [open, transaction]);

    const updateTransactionStatus = async (transactionId: string, type: 'payable' | 'receivable', itemId: string) => {
        const { error } = await supabase
            .from('financial_bank_transactions')
            .update({
                status: 'reconciled',
                matched_payable_id: type === 'payable' ? itemId : null,
                matched_receivable_id: type === 'receivable' ? itemId : null
            })
            .eq('id', transactionId);

        if (error) throw error;
    };

    const executeMatch = async (type: 'payable' | 'receivable', item: any, updateAmount: boolean = false) => {
        try {
            // Update amount if requested
            if (updateAmount) {
                if (type === 'receivable') {
                    await updateReceivable.mutateAsync({ item: { id: item.id, workspace_id: currentWorkspace!.id, total_amount: absAmount } });
                } else {
                    await updatePayable.mutateAsync({ item: { id: item.id, workspace_id: currentWorkspace!.id, total_amount: absAmount } });
                }
            }

            await updateTransactionStatus(transaction.id, type, item.id);

            // Mark as paid if not already
            if (item.status !== 'paid' || updateAmount) {
                const commonUpdate = {
                    id: item.id,
                    workspace_id: currentWorkspace!.id,
                    status: 'paid' as const,
                    payment_date: transaction.transaction_date,
                    bank_account_id: transaction.bank_account_id
                };

                if (type === 'receivable') {
                    await updateReceivable.mutateAsync({ item: commonUpdate });
                } else {
                    await updatePayable.mutateAsync({ item: commonUpdate });
                }
            }

            toast({ title: "Conciliado", description: "Transação vinculada com sucesso." });
            setOpen(false);

            // Invalidate queries to refresh data without full reload
            await queryClient.invalidateQueries({ queryKey: ['financial_bank_transactions'] });
            await queryClient.invalidateQueries({ queryKey: ['financial_receivables'] });
            await queryClient.invalidateQueries({ queryKey: ['financial_payables'] });
            await queryClient.invalidateQueries({ queryKey: ['financial_bank_accounts'] });

        } catch (err) {
            console.error(err);
            toast({ title: "Erro", description: "Erro ao conciliar.", variant: "destructive" });
        }
    };

    const handleMatchClick = (type: 'payable' | 'receivable', item: any) => {
        const diff = Math.abs(item.total_amount - absAmount);
        if (diff > 0.05) {
            setPendingMatch({ type, item });
            setView('confirm_diff');
        } else {
            executeMatch(type, item);
        }
    };

    const handleCreateAndMatch = async () => {
        if (!newDescription || !newCategoryId) {
            toast({ title: "Atenção", description: "Preencha a descrição e categoria.", variant: "destructive" });
            return;
        }

        setIsCreating(true);
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) return;

            // Get workspace
            const { data: member } = await supabase
                .from('workspace_members')
                .select('workspace_id')
                .eq('user_id', session.user.id)
                .single();

            if (!member) throw new Error("No workspace member found");

            let createdItem;

            if (isIncome) {
                // Create Receivable
                createdItem = await createReceivable.mutateAsync({
                    item: {
                        workspace_id: member.workspace_id,
                        title: newDescription,
                        description: newDescription,
                        amount: absAmount,
                        total_amount: absAmount,
                        due_date: transaction.transaction_date,
                        competence_date: transaction.transaction_date,
                        category_id: newCategoryId,
                        status: 'paid', // Already paid
                        payment_date: transaction.transaction_date,
                        bank_account_id: transaction.bank_account_id,
                        client_id: '00000000-0000-0000-0000-000000000000' // Using dummy as it's required in some versions but we want a general entry
                    }
                });

                await executeMatch('receivable', createdItem);
            } else {
                // Create Payable
                createdItem = await createPayable.mutateAsync({
                    item: {
                        workspace_id: member.workspace_id,
                        description: newDescription,
                        title: newDescription,
                        amount: absAmount,
                        total_amount: absAmount,
                        due_date: transaction.transaction_date,
                        competence_date: transaction.transaction_date,
                        category_id: newCategoryId,
                        status: 'paid',
                        payment_date: transaction.transaction_date,
                        bank_account_id: transaction.bank_account_id
                    }
                });

                await executeMatch('payable', createdItem);
            }

        } catch (error) {
            console.error(error);
            toast({ title: "Erro", description: "Erro ao criar lançamento.", variant: "destructive" });
            setIsCreating(false);
        }
    };

    // Filters for categories
    // Filters for categories
    const relevantCategories = categories?.filter(c => c.type === (isIncome ? 'income' : 'expense')) || [];

    const availableReceivables = receivables?.filter(r =>
        r.status !== 'paid' &&
        // @ts-ignore
        (!r.financial_bank_transactions || r.financial_bank_transactions.length === 0)
    );

    const availablePayables = payables?.filter(p =>
        p.status !== 'paid' &&
        // @ts-ignore
        (!p.financial_bank_transactions || p.financial_bank_transactions.length === 0)
    );

    const suggestedReceivables = availableReceivables?.filter(r =>
        Math.abs(r.total_amount - absAmount) < 0.05
    );
    const suggestedPayables = availablePayables?.filter(p =>
        Math.abs(p.total_amount - absAmount) < 0.05
    );

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2">
                    <LinkIcon className="h-4 w-4" />
                    Conciliar
                </Button>
            </DialogTrigger>
            <DialogContent className="max-w-xl">
                <DialogHeader>
                    <DialogTitle>Conciliar Transação</DialogTitle>
                </DialogHeader>

                <div className="bg-muted p-4 rounded-md mb-4 flex justify-between items-center">
                    <div>
                        <p className="text-sm font-medium">{transaction.description}</p>
                        <p className="text-xs text-muted-foreground">{format(new Date(transaction.transaction_date), "dd/MM/yyyy")}</p>
                    </div>
                    <div className={`text-lg font-bold ${isIncome ? 'text-green-600' : 'text-red-600'}`}>
                        {formatCurrency(transaction.amount)}
                    </div>
                </div>

                {view === 'confirm_diff' && pendingMatch ? (
                    <div className="space-y-4 border p-4 rounded-md bg-yellow-50 dark:bg-yellow-900/10 border-yellow-200">
                        <div className="flex items-center gap-2 text-yellow-800 dark:text-yellow-200">
                            <h3 className="font-semibold">Divergência de Valores</h3>
                        </div>
                        <p className="text-sm text-muted-foreground">
                            O valor da transação bancária <strong>({formatCurrency(absAmount)})</strong> é diferente do lançamento selecionado <strong>({formatCurrency(pendingMatch.item.total_amount)})</strong>.
                        </p>
                        <p className="text-sm text-muted-foreground">
                            O que deseja fazer?
                        </p>
                        <div className="flex flex-col gap-2 pt-2">
                            <Button
                                onClick={() => executeMatch(pendingMatch.type, pendingMatch.item, true)}
                                className="w-full"
                            >
                                Ajustar valor do lançamento para {formatCurrency(absAmount)}
                            </Button>
                            <Button
                                variant="secondary"
                                onClick={() => executeMatch(pendingMatch.type, pendingMatch.item, false)}
                                className="w-full"
                            >
                                Manter valor original (Baixar com diferença)
                            </Button>
                            <Button
                                variant="ghost"
                                onClick={() => { setView('default'); setPendingMatch(null); }}
                                className="w-full"
                            >
                                Cancelar
                            </Button>
                        </div>
                    </div>
                ) : (
                    <Tabs defaultValue="create_new" className="w-full">
                        <TabsList className="grid w-full grid-cols-3">
                            <TabsTrigger value="create_new">
                                <Plus className="h-4 w-4 mr-2" />
                                Criar Novo
                            </TabsTrigger>
                            <TabsTrigger value="existing">
                                <Search className="h-4 w-4 mr-2" />
                                Buscar
                            </TabsTrigger>
                            <TabsTrigger value="transfer">
                                <ArrowRightLeft className="h-4 w-4 mr-2" />
                                Transferência
                            </TabsTrigger>
                        </TabsList>

                        <TabsContent value="create_new" className="space-y-4 pt-4">
                            <div className="space-y-4 border p-4 rounded-md bg-slate-50 dark:bg-slate-900/50">
                                <div className="grid gap-2">
                                    <Label>Descrição</Label>
                                    <Input
                                        value={newDescription}
                                        onChange={(e) => setNewDescription(e.target.value)}
                                        placeholder="Descrição do lançamento"
                                    />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="grid gap-2">
                                        <Label>Data</Label>
                                        <Input
                                            type="date"
                                            value={transaction.transaction_date ? transaction.transaction_date.split('T')[0] : ''}
                                            disabled
                                        />
                                    </div>
                                    <div className="grid gap-2">
                                        <Label>Valor</Label>
                                        <Input
                                            value={formatCurrency(absAmount)}
                                            disabled
                                        />
                                    </div>
                                </div>
                                <div className="grid gap-2">
                                    <Label>Categoria ({isIncome ? "Receita" : "Despesa"})</Label>
                                    <Select value={newCategoryId} onValueChange={setNewCategoryId}>
                                        <SelectTrigger>
                                            <SelectValue placeholder="Selecione uma categoria..." />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {relevantCategories.map(cat => (
                                                <SelectItem key={cat.id} value={cat.id}>
                                                    {cat.name}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>

                                <Button
                                    className="w-full"
                                    onClick={handleCreateAndMatch}
                                    disabled={isCreating}
                                >
                                    {isCreating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Check className="mr-2 h-4 w-4" />}
                                    Criar e Conciliar
                                </Button>
                            </div>
                        </TabsContent>

                        <TabsContent value="existing" className="pt-4">
                            <Tabs defaultValue={isIncome ? "receivables" : "payables"}>
                                <TabsList className="grid w-full grid-cols-2 mb-4">
                                    <TabsTrigger value="receivables" disabled={!isIncome}>Recebíveis</TabsTrigger>
                                    <TabsTrigger value="payables" disabled={isIncome}>Pagamentos</TabsTrigger>
                                </TabsList>

                                <TabsContent value="receivables">
                                    <div className="space-y-4">
                                        {suggestedReceivables && suggestedReceivables.length > 0 && (
                                            <div>
                                                <h4 className="text-sm font-semibold text-green-600 mb-2 flex items-center gap-2">
                                                    <Check className="h-4 w-4" /> Sugestões Encontradas
                                                </h4>
                                                <div className="space-y-2">
                                                    {suggestedReceivables.map(item => (
                                                        <div key={item.id} className="flex items-center justify-between p-3 border rounded-md border-green-200 bg-green-50">
                                                            <div>
                                                                <p className="font-medium">{item.description}</p>
                                                                <p className="text-xs text-muted-foreground">Venc: {format(new Date(item.due_date), "dd/MM/yyyy")}</p>
                                                            </div>
                                                            <div className="flex items-center gap-4">
                                                                <span className="font-bold">{formatCurrency(item.total_amount)}</span>
                                                                <Button size="sm" onClick={() => handleMatchClick('receivable', item)}>Vincular</Button>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}

                                        <div className="mt-4">
                                            <h4 className="text-sm font-semibold mb-2">Todos Recebíveis em Aberto</h4>
                                            <ScrollArea className="h-[200px] border rounded-md p-2">
                                                {availableReceivables?.map(item => (
                                                    <div key={item.id} className="flex items-center justify-between p-2 hover:bg-muted rounded-md mb-1">
                                                        <div>
                                                            <p className="text-sm font-medium">{item.description}</p>
                                                            <p className="text-xs text-muted-foreground">Venc: {format(new Date(item.due_date), "dd/MM/yyyy")}</p>
                                                        </div>
                                                        <div className="flex items-center gap-2">
                                                            <span className="text-sm font-bold">{formatCurrency(item.total_amount)}</span>
                                                            <Button size="sm" variant="ghost" onClick={() => handleMatchClick('receivable', item)}>V</Button>
                                                        </div>
                                                    </div>
                                                ))}
                                            </ScrollArea>
                                        </div>
                                    </div>
                                </TabsContent>

                                <TabsContent value="payables">
                                    <div className="space-y-4">
                                        {suggestedPayables && suggestedPayables.length > 0 && (
                                            <div>
                                                <h4 className="text-sm font-semibold text-green-600 mb-2 flex items-center gap-2">
                                                    <Check className="h-4 w-4" /> Sugestões Encontradas
                                                </h4>
                                                <div className="space-y-2">
                                                    {suggestedPayables.map(item => (
                                                        <div key={item.id} className="flex items-center justify-between p-3 border rounded-md border-green-200 bg-green-50">
                                                            <div>
                                                                <p className="font-medium">{item.description}</p>
                                                                <p className="text-xs text-muted-foreground">Venc: {format(new Date(item.due_date), "dd/MM/yyyy")}</p>
                                                            </div>
                                                            <div className="flex items-center gap-4">
                                                                <span className="font-bold">{formatCurrency(item.total_amount)}</span>
                                                                <Button size="sm" onClick={() => handleMatchClick('payable', item)}>Vincular</Button>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}

                                        <div className="mt-4">
                                            <h4 className="text-sm font-semibold mb-2">Todos Pagamentos em Aberto</h4>
                                            <ScrollArea className="h-[200px] border rounded-md p-2">
                                                {availablePayables?.map(item => (
                                                    <div key={item.id} className="flex items-center justify-between p-2 hover:bg-muted rounded-md mb-1">
                                                        <div>
                                                            <p className="text-sm font-medium">{item.description}</p>
                                                            <p className="text-xs text-muted-foreground">Venc: {format(new Date(item.due_date), "dd/MM/yyyy")}</p>
                                                        </div>
                                                        <div className="flex items-center gap-2">
                                                            <span className="text-sm font-bold">{formatCurrency(item.total_amount)}</span>
                                                            <Button size="sm" variant="ghost" onClick={() => handleMatchClick('payable', item)}>V</Button>
                                                        </div>
                                                    </div>
                                                ))}
                                            </ScrollArea>
                                        </div>
                                    </div>
                                </TabsContent>
                            </Tabs>
                        </TabsContent>
                        <TabsContent value="transfer" className="pt-4">
                            <TransferTabContent transaction={transaction} onClose={() => setOpen(false)} />
                        </TabsContent>
                    </Tabs>
                )}
            </DialogContent>
        </Dialog>
    );
}

function TransferTabContent({ transaction, onClose }: { transaction: any, onClose: () => void }) {
    const { currentWorkspace } = useWorkspace();
    const { accounts } = useBankAccounts(currentWorkspace?.id);
    const { categories } = useFinancialCategories(currentWorkspace?.id);
    const { toast } = useToast();
    const queryClient = useQueryClient();
    const [loading, setLoading] = useState(false);
    const [targetAccountId, setTargetAccountId] = useState("");

    const isIncome = transaction.amount > 0;
    const absAmount = Math.abs(transaction.amount);

    const handleConfirm = async () => {
        if (!targetAccountId) {
            toast({ title: "Erro", description: "Selecione a conta de destino/origem.", variant: "destructive" });
            return;
        }

        setLoading(true);
        try {
            const transferCategory = categories?.find(c => c.name.toLowerCase().includes("transferência entre contas"));

            const transferGroupId = crypto.randomUUID();

            // 1. Mark current as reconciled
            const { error: errorCurrent } = await supabase
                .from('financial_bank_transactions')
                .update({ status: 'reconciled' })
                .eq('id', transaction.id);

            if (errorCurrent) throw errorCurrent;

            // 2. Create mirror transaction
            const { error: errorMirror } = await supabase.from("financial_bank_transactions").insert({
                workspace_id: transaction.workspace_id,
                bank_account_id: targetAccountId,
                transaction_date: transaction.transaction_date,
                amount: -transaction.amount, // Flip the sign
                description: `${isIncome ? '[Saída]' : '[Entrada]'} Transferência: ${transaction.description}`,
                status: 'reconciled',
                fitid: `TRF_RECON_${transferGroupId.slice(0, 8)}`
            });

            if (errorMirror) throw errorMirror;

            // 3. Update target account balance
            const { data: targetAcc } = await supabase.from("financial_bank_accounts").select("current_balance").eq("id", targetAccountId).single();
            await supabase.from("financial_bank_accounts").update({
                current_balance: (Number(targetAcc?.current_balance) || 0) + (-transaction.amount)
            }).eq("id", targetAccountId);

            toast({ title: "Conciliado", description: "Transferência registrada e conciliada." });

            // Invalidate queries
            await queryClient.invalidateQueries({ queryKey: ['financial_bank_transactions'] });
            await queryClient.invalidateQueries({ queryKey: ['financial_bank_accounts'] });

            onClose();
        } catch (error: any) {
            console.error(error);
            toast({ title: "Erro", description: error.message, variant: "destructive" });
        } finally {
            setLoading(false);
        }
    };

    const otherAccounts = accounts?.filter(a => a.id !== transaction.bank_account_id) || [];

    return (
        <div className="space-y-4 border p-4 rounded-md bg-blue-50 dark:bg-blue-900/10 border-blue-200">
            <div className="grid gap-2">
                <Label>{isIncome ? "De qual conta veio este valor?" : "Para qual conta foi este valor?"}</Label>
                <Select value={targetAccountId} onValueChange={setTargetAccountId}>
                    <SelectTrigger className="bg-background">
                        <SelectValue placeholder="Selecione a conta..." />
                    </SelectTrigger>
                    <SelectContent>
                        {otherAccounts.map(acc => (
                            <SelectItem key={acc.id} value={acc.id}>{acc.name}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>
            <p className="text-xs text-muted-foreground italic">
                {isIncome
                    ? `Ao confirmar, será criado um lançamento de SAÍDA no valor de ${formatCurrency(absAmount)} na conta selecionada.`
                    : `Ao confirmar, será criado um lançamento de ENTRADA no valor de ${formatCurrency(absAmount)} na conta selecionada.`
                }
            </p>
            <Button className="w-full" onClick={handleConfirm} disabled={loading || !targetAccountId}>
                {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ArrowRightLeft className="mr-2 h-4 w-4" />}
                Confirmar Transferência
            </Button>
        </div>
    );
}
