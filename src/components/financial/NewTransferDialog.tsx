import { useState } from "react";
import { useBankAccounts } from "@/hooks/useFinancialModules";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
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
import { ArrowRightLeft, Loader2 } from "lucide-react";

export function NewTransferDialog() {
    const { currentWorkspace } = useWorkspace();
    const { toast } = useToast();
    const queryClient = useQueryClient();
    const { accounts } = useBankAccounts(currentWorkspace?.id);
    const activeAccounts = accounts?.filter(a => a.is_active !== false);

    const [open, setOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const [fromAccountId, setFromAccountId] = useState("");
    const [toAccountId, setToAccountId] = useState("");
    const [amount, setAmount] = useState("");
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
    const [description, setDescription] = useState("Transferência entre Contas");

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!currentWorkspace || !fromAccountId || !toAccountId || !amount || !date) {
            toast({ title: "Erro", description: "Preencha todos os campos obrigatórios.", variant: "destructive" });
            return;
        }

        if (fromAccountId === toAccountId) {
            toast({ title: "Erro", description: "As contas de origem e destino devem ser diferentes.", variant: "destructive" });
            return;
        }

        const numAmount = parseFloat(amount.replace(',', '.'));
        if (isNaN(numAmount) || numAmount <= 0) {
            toast({ title: "Erro", description: "Valor inválido.", variant: "destructive" });
            return;
        }

        setLoading(true);
        try {
            const { data, error } = await supabase.rpc("perform_bank_transfer", {
                p_workspace_id: currentWorkspace.id,
                p_from_account_id: fromAccountId,
                p_to_account_id: toAccountId,
                p_amount: numAmount,
                p_date: date,
                p_description: description,
            });

            if (error) throw error;

            toast({ title: "Sucesso", description: "Transferência realizada com sucesso." });
            setOpen(false);

            // Reset form
            setAmount("");
            setFromAccountId("");
            setToAccountId("");

            // Invalidate all related queries
            queryClient.invalidateQueries({ queryKey: ["financial_bank_transactions"] });
            queryClient.invalidateQueries({ queryKey: ["financial_bank_accounts"] });

        } catch (error: any) {
            console.error(error);
            toast({ title: "Erro ao realizar transferência", description: error.message, variant: "destructive" });
        } finally {
            setLoading(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button variant="outline" className="h-11 border-primary/20 hover:border-primary/50 bg-primary/5 hover:bg-primary/10 transition-all font-bold">
                    <ArrowRightLeft className="mr-2 h-4 w-4 text-primary" />
                    Nova Transferência
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>Nova Transferência entre Contas</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4 py-4">
                    <div className="grid gap-2">
                        <Label>Conta de Origem (Sai o dinheiro)</Label>
                        <Select value={fromAccountId} onValueChange={setFromAccountId}>
                            <SelectTrigger>
                                <SelectValue placeholder="Selecione a conta..." />
                            </SelectTrigger>
                            <SelectContent>
                                {activeAccounts?.map(acc => (
                                    <SelectItem key={acc.id} value={acc.id}>{acc.name}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="grid gap-2">
                        <Label>Conta de Destino (Entra o dinheiro)</Label>
                        <Select value={toAccountId} onValueChange={setToAccountId}>
                            <SelectTrigger>
                                <SelectValue placeholder="Selecione a conta..." />
                            </SelectTrigger>
                            <SelectContent>
                                {activeAccounts?.map(acc => (
                                    <SelectItem key={acc.id} value={acc.id}>{acc.name}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="grid gap-2">
                            <Label>Valor</Label>
                            <Input
                                type="text"
                                value={amount}
                                onChange={(e) => setAmount(e.target.value)}
                                placeholder="0,00"
                            />
                        </div>
                        <div className="grid gap-2">
                            <Label>Data</Label>
                            <Input
                                type="date"
                                value={date}
                                onChange={(e) => setDate(e.target.value)}
                            />
                        </div>
                    </div>

                    <div className="grid gap-2">
                        <Label>Descrição</Label>
                        <Input
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            placeholder="Ex: Transferência entre Contas"
                        />
                    </div>

                    <Button type="submit" className="w-full" disabled={loading}>
                        {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ArrowRightLeft className="mr-2 h-4 w-4" />}
                        Confirmar Transferência
                    </Button>
                </form>
            </DialogContent>
        </Dialog>
    );
}
