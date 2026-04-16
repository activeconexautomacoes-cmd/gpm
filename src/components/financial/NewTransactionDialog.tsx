import { useState } from "react";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { useBankAccounts, useFinancialCategories } from "@/hooks/useFinancialModules";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { Plus, Loader2 } from "lucide-react";

interface NewTransactionDialogProps {
    defaultAccountId?: string;
}

export function NewTransactionDialog({ defaultAccountId }: NewTransactionDialogProps) {
    const [open, setOpen] = useState(false);
    const [accountId, setAccountId] = useState(defaultAccountId || "");
    const [description, setDescription] = useState("");
    const [amount, setAmount] = useState("");
    const [type, setType] = useState<"income" | "expense">("expense");
    const [categoryId, setCategoryId] = useState("");
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
    const [loading, setLoading] = useState(false);

    const { currentWorkspace } = useWorkspace();
    const { accounts } = useBankAccounts(currentWorkspace?.id);
    const { categories } = useFinancialCategories(currentWorkspace?.id);
    const { toast } = useToast();
    const queryClient = useQueryClient();

    const filteredCategories = categories?.filter(c => c.type === type) || [];

    const handleSave = async () => {
        if (!accountId || !amount || !description || !categoryId) {
            toast({ title: "Erro", description: "Preencha todos os campos obrigatórios.", variant: "destructive" });
            return;
        }

        setLoading(true);
        try {
            const numAmount = parseFloat(amount);
            const finalAmount = type === 'income' ? numAmount : -numAmount;

            // 1. Create Transaction
            const { error: transError } = await supabase.from("financial_bank_transactions").insert({
                workspace_id: accounts?.find(a => a.id === accountId)?.workspace_id!,
                bank_account_id: accountId,
                transaction_date: date,
                amount: finalAmount,
                description: description,
                status: 'reconciled',
                fitid: `MANUAL_${crypto.randomUUID().slice(0, 8)}`
            });
            if (transError) throw transError;

            // 2. Update Balance
            const { data: account } = await supabase.from("financial_bank_accounts").select("current_balance").eq("id", accountId).single();
            await supabase.from("financial_bank_accounts").update({
                current_balance: (Number(account?.current_balance) || 0) + finalAmount
            }).eq("id", accountId);

            toast({ title: "Sucesso", description: "Lançamento realizado com sucesso." });
            queryClient.invalidateQueries({ queryKey: ["financial_bank_accounts"] });
            queryClient.invalidateQueries({ queryKey: ["financial_bank_transactions"] });
            setOpen(false);

            // Reset fields
            setDescription("");
            setAmount("");
        } catch (error: any) {
            console.error(error);
            toast({ title: "Erro", description: error.message, variant: "destructive" });
        } finally {
            setLoading(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button className="h-11 bg-primary hover:bg-primary/90">
                    <Plus className="mr-2 h-4 w-4" />
                    Novo Lançamento
                </Button>
            </DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Novo Lançamento Manual</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>Tipo</Label>
                            <Select value={type} onValueChange={(v: any) => setType(v)}>
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="income">Receita (Entrada)</SelectItem>
                                    <SelectItem value="expense">Despesa (Saída)</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label>Data</Label>
                            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label>Conta Bancária / Cartão</Label>
                        <Select value={accountId} onValueChange={setAccountId}>
                            <SelectTrigger>
                                <SelectValue placeholder="Selecione a conta..." />
                            </SelectTrigger>
                            <SelectContent>
                                {accounts?.map(acc => (
                                    <SelectItem key={acc.id} value={acc.id}>
                                        {acc.name} {acc.type === 'credit_card' ? '(Cartão)' : ''}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="space-y-2">
                        <Label>Descrição</Label>
                        <Input
                            placeholder="Ex: Compra de material, Almoço..."
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>Categoria</Label>
                            <Select value={categoryId} onValueChange={setCategoryId}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Selecione..." />
                                </SelectTrigger>
                                <SelectContent>
                                    {filteredCategories.map(cat => (
                                        <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label>Valor (R$)</Label>
                            <Input
                                type="number"
                                step="0.01"
                                placeholder="0.00"
                                value={amount}
                                onChange={(e) => setAmount(e.target.value)}
                            />
                        </div>
                    </div>

                    <Button className="w-full mt-4" onClick={handleSave} disabled={loading}>
                        {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
                        Salvar Lançamento
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}
