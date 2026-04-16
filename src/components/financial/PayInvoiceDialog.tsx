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
import { CreditCard, Loader2 } from "lucide-react";

interface PayInvoiceDialogProps {
    targetAccountId: string;
    isCreditCard: boolean;
}

export function PayInvoiceDialog({ targetAccountId, isCreditCard }: PayInvoiceDialogProps) {
    const [open, setOpen] = useState(false);
    const [fromAccountId, setFromAccountId] = useState("");
    const [amount, setAmount] = useState("");
    const [loading, setLoading] = useState(false);

    const { currentWorkspace } = useWorkspace();
    const { accounts } = useBankAccounts(currentWorkspace?.id);
    const { categories } = useFinancialCategories(currentWorkspace?.id);
    const { toast } = useToast();
    const queryClient = useQueryClient();

    if (!isCreditCard) return null;

    const creditCardAccount = accounts?.find(a => a.id === targetAccountId);
    const otherAccounts = accounts?.filter(a => a.id !== targetAccountId && a.type !== 'credit_card') || [];

    const handlePay = async () => {
        if (!fromAccountId || !amount) {
            toast({ title: "Erro", description: "Preencha todos os campos.", variant: "destructive" });
            return;
        }

        setLoading(true);
        try {
            const numAmount = parseFloat(amount);

            // 1. Find category
            const paymentCategory = categories?.find(c => c.name.toLowerCase().includes("pagamento de fatura") || c.name.toLowerCase().includes("transferência"));
            const categoryId = paymentCategory?.id;

            if (!categoryId) {
                throw new Error("Categoria para pagamento não encontrada. Por favor, crie uma categoria 'Pagamento de Fatura' ou 'Transferência'.");
            }

            const groupId = crypto.randomUUID();

            // 2. Transaction OUT (Checking Account)
            const { error: errorOut } = await supabase.from("financial_bank_transactions").insert({
                workspace_id: creditCardAccount!.workspace_id,
                bank_account_id: fromAccountId,
                transaction_date: new Date().toISOString(),
                amount: -numAmount,
                description: `[Fatura] Pagamento Cartão: ${creditCardAccount!.name}`,
                status: 'reconciled',
                fitid: `PAY_OUT_${groupId.slice(0, 8)}`
            });
            if (errorOut) throw errorOut;

            // 3. Transaction IN (Credit Card Account)
            const { error: errorIn } = await supabase.from("financial_bank_transactions").insert({
                workspace_id: creditCardAccount!.workspace_id,
                bank_account_id: targetAccountId,
                transaction_date: new Date().toISOString(),
                amount: numAmount,
                description: `[Fatura] Pagamento/Antecipação recebida`,
                status: 'reconciled',
                fitid: `PAY_IN_${groupId.slice(0, 8)}`
            });
            if (errorIn) throw errorIn;

            // 4. Update Balances
            // Update Source
            const { data: fromAcc } = await supabase.from("financial_bank_accounts").select("current_balance").eq("id", fromAccountId).single();
            await supabase.from("financial_bank_accounts").update({
                current_balance: (Number(fromAcc?.current_balance) || 0) - numAmount
            }).eq("id", fromAccountId);

            // Update CC
            const { data: ccAcc } = await supabase.from("financial_bank_accounts").select("current_balance").eq("id", targetAccountId).single();
            await supabase.from("financial_bank_accounts").update({
                current_balance: (Number(ccAcc?.current_balance) || 0) + numAmount
            }).eq("id", targetAccountId);

            toast({ title: "Sucesso", description: "Pagamento de fatura registrado com sucesso." });
            queryClient.invalidateQueries({ queryKey: ["financial_bank_accounts"] });
            queryClient.invalidateQueries({ queryKey: ["financial_bank_transactions"] });
            setOpen(false);
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
                <Button variant="outline" className="h-11 border-blue-500/30 text-blue-600 hover:bg-blue-50">
                    <CreditCard className="mr-2 h-4 w-4" />
                    Pagar Fatura
                </Button>
            </DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Pagar Fatura: {creditCardAccount?.name}</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-4">
                    <div className="space-y-2">
                        <Label>Pagar de qual conta?</Label>
                        <Select value={fromAccountId} onValueChange={setFromAccountId}>
                            <SelectTrigger>
                                <SelectValue placeholder="Selecione a conta..." />
                            </SelectTrigger>
                            <SelectContent>
                                {otherAccounts.map(acc => (
                                    <SelectItem key={acc.id} value={acc.id}>{acc.name} (Saldo: R$ {acc.current_balance?.toFixed(2)})</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="space-y-2">
                        <Label>Valor do Pagamento (R$)</Label>
                        <Input
                            type="number"
                            step="0.01"
                            placeholder="0.00"
                            value={amount}
                            onChange={(e) => setAmount(e.target.value)}
                        />
                        <p className="text-[10px] text-muted-foreground">
                            Você pode pagar o valor total ou fazer antecipações parciais para liberar limite.
                        </p>
                    </div>

                    <Button className="w-full bg-blue-600 hover:bg-blue-700" onClick={handlePay} disabled={loading}>
                        {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CreditCard className="mr-2 h-4 w-4" />}
                        Confirmar Pagamento
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}
