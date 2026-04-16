
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
import { Textarea } from "@/components/ui/textarea";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    Accordion,
    AccordionContent,
    AccordionItem,
    AccordionTrigger,
} from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useBankAccounts, useReceivables, usePayables } from "@/hooks/useFinancialModules";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { useState, useMemo, useEffect } from "react";
import {
    Check,
    Loader2,
    Calendar as CalendarIcon,
    Wallet,
    CreditCard,
    FileText,
    Paperclip,
    Info,
    ArrowRight
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { getLocalDateString, formatCurrency, formatDate } from "@/utils/format";

interface MarkAsPaidProps {
    type: 'receivable' | 'payable';
    item: any;
    onSuccess?: () => void;
    trigger?: React.ReactNode;
}

export function MarkAsPaid({ type, item, onSuccess, trigger }: MarkAsPaidProps) {
    const [open, setOpen] = useState(false);
    const { toast } = useToast();
    const { currentWorkspace } = useWorkspace();
    const { updateReceivable } = useReceivables(currentWorkspace?.id);
    const { updatePayable } = usePayables(currentWorkspace?.id);
    const { accounts } = useBankAccounts(currentWorkspace?.id);

    const remainingBalance = useMemo(() => {
        return Number(item.total_amount) - (item.paid_amount || 0);
    }, [item]);

    const [selectedAccount, setSelectedAccount] = useState<string>(item.bank_account_id || "");
    const [paymentDate, setPaymentDate] = useState<string>(getLocalDateString());
    const [paymentMethod, setPaymentMethod] = useState<string>("pix");
    const [amountToPay, setAmountToPay] = useState<number>(remainingBalance);
    const [interest, setInterest] = useState<number>(0);
    const [fine, setFine] = useState<number>(0);
    const [discount, setDiscount] = useState<number>(0);
    const [notes, setNotes] = useState<string>("");

    const totalPaid = useMemo(() => {
        return Number(amountToPay) + Number(interest) + Number(fine) - Number(discount);
    }, [amountToPay, interest, fine, discount]);

    useEffect(() => {
        if (open) {
            setAmountToPay(remainingBalance);
            setSelectedAccount(item.bank_account_id || "");
            setPaymentDate(getLocalDateString());
        }
    }, [open, remainingBalance, item.bank_account_id]);

    const handleConfirm = async () => {
        try {
            if (!selectedAccount) {
                toast({ title: "Erro", description: "Selecione uma conta para o pagamento.", variant: "destructive" });
                return;
            }

            if (!paymentDate) {
                toast({ title: "Erro", description: "Selecione a data do pagamento.", variant: "destructive" });
                return;
            }

            const newTotalPaidAmount = (item.paid_amount || 0) + Number(amountToPay) + Number(interest) + Number(fine) - Number(discount);
            const isFullyPaid = newTotalPaidAmount >= Number(item.total_amount);

            const updateData = {
                status: (isFullyPaid ? 'paid' : 'partial') as 'paid' | 'partial',
                paid_amount: newTotalPaidAmount,
                id: item.id,
                workspace_id: item.workspace_id,
                bank_account_id: selectedAccount,
                interest,
                fine,
                discount,
                notes,
                payment_method: paymentMethod,
                payment_date: paymentDate
            };

            if (type === 'receivable') {
                await updateReceivable.mutateAsync({ item: updateData });
            } else {
                await updatePayable.mutateAsync({ item: updateData });
            }

            toast({
                title: "Sucesso",
                description: isFullyPaid ? "Lançamento baixado integralmente." : `Baixa parcial registrada. Restam ${formatCurrency(Number(item.total_amount) - newTotalPaidAmount)}.`
            });
            setOpen(false);
            onSuccess?.();

        } catch (err) {
            console.error(err);
            toast({ title: "Erro", description: "Erro ao baixar lançamento.", variant: "destructive" });
        }
    };

    const isPending = updateReceivable.isPending || updatePayable.isPending;

    if (item.status === 'paid') return null;

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                {trigger || (
                    <Button variant="ghost" size="sm" title="Baixar Lançamento" className="hover:text-green-600">
                        <Check className="h-4 w-4" />
                    </Button>
                )}
            </DialogTrigger>
            <DialogContent className="max-w-4xl p-0 overflow-hidden border-none shadow-2xl">
                <div className="bg-slate-50 flex flex-col max-h-[90vh]">
                    <DialogHeader className="p-6 bg-white border-b shrink-0">
                        <div className="flex justify-between items-center">
                            <DialogTitle className="text-xl font-bold text-slate-800">
                                Confirmar {type === 'receivable' ? 'Recebimento' : 'Pagamento'}
                            </DialogTitle>
                            <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                                {item.description}
                            </Badge>
                        </div>
                    </DialogHeader>

                    <div className="flex-1 overflow-y-auto p-6 space-y-6">
                        {/* SEÇÃO 1: INFORMAÇÕES DO LANÇAMENTO */}
                        <div className="bg-white rounded-xl border p-5 shadow-sm space-y-4">
                            <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-2">
                                <FileText className="h-4 w-4" /> Informações do lançamento
                            </h3>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                                <div>
                                    <Label className="text-xs text-muted-foreground uppercase">Fornecedor/Cliente</Label>
                                    <p className="font-medium text-slate-900">{item.clients?.name || item.description || '-'}</p>
                                </div>
                                <div>
                                    <Label className="text-xs text-muted-foreground uppercase">Categoria</Label>
                                    <p className="font-medium text-slate-900">{item.financial_categories?.name || '-'}</p>
                                </div>
                                <div>
                                    <Label className="text-xs text-muted-foreground uppercase">Vencimento</Label>
                                    <p className="font-medium text-slate-900">{formatDate(item.due_date)}</p>
                                </div>
                                <div className="text-right">
                                    <Label className="text-xs text-muted-foreground uppercase">Valor total</Label>
                                    <p className="font-bold text-lg text-slate-900">{formatCurrency(item.total_amount)}</p>
                                </div>
                            </div>
                        </div>

                        {/* SEÇÃO 2: INFORMAÇÕES DO PAGAMENTO */}
                        <div className="bg-white rounded-xl border p-5 shadow-sm space-y-6">
                            <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-2">
                                <Wallet className="h-4 w-4" /> Informações do {type === 'receivable' ? 'recebimento' : 'pagamento'}
                            </h3>

                            <p className="text-xs text-muted-foreground italic -mt-2">
                                Você pode fazer o pagamento total ou parcial do saldo da parcela. O valor restante ficará em aberto.
                            </p>

                            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                                <div className="space-y-1.5 focus-within:ring-1 ring-primary/20 transition-all rounded-lg">
                                    <Label className="text-xs font-semibold">Valor da parcela (Saldo)</Label>
                                    <div className="relative">
                                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">R$</span>
                                        <Input
                                            disabled
                                            value={remainingBalance.toFixed(2).replace('.', ',')}
                                            className="pl-9 bg-slate-50 border-slate-200"
                                        />
                                    </div>
                                </div>
                                <div className="space-y-1.5">
                                    <Label className="text-xs font-semibold">Data do {type === 'receivable' ? 'recebimento' : 'pagamento'} *</Label>
                                    <div className="relative">
                                        <Input
                                            type="date"
                                            value={paymentDate}
                                            onChange={(e) => setPaymentDate(e.target.value)}
                                            className="border-slate-200"
                                        />
                                    </div>
                                </div>
                                <div className="space-y-1.5">
                                    <Label className="text-xs font-semibold">Forma de pagamento</Label>
                                    <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                                        <SelectTrigger className="border-slate-200">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="pix">PIX</SelectItem>
                                            <SelectItem value="cartao_credito">Cartão de Crédito</SelectItem>
                                            <SelectItem value="cartao_debito">Cartão de Débito</SelectItem>
                                            <SelectItem value="dinheiro">Dinheiro</SelectItem>
                                            <SelectItem value="transferencia">Transferência</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-1.5">
                                    <Label className="text-xs font-semibold">Conta *</Label>
                                    <Select value={selectedAccount} onValueChange={setSelectedAccount}>
                                        <SelectTrigger className="border-slate-200">
                                            <SelectValue placeholder="Selecione..." />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {accounts?.map((acc) => (
                                                <SelectItem key={acc.id} value={acc.id}>{acc.name}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                                <div className="space-y-1.5">
                                    <Label className="text-xs font-semibold decoration-primary flex items-center gap-1">
                                        Valor {type === 'receivable' ? 'recebido' : 'pago'} * <Info className="h-3 w-3 text-muted-foreground" />
                                    </Label>
                                    <div className="relative">
                                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">R$</span>
                                        <Input
                                            type="number"
                                            step="0.01"
                                            value={amountToPay}
                                            onChange={(e) => setAmountToPay(Number(e.target.value))}
                                            className="pl-9 border-slate-200 focus:border-primary"
                                        />
                                    </div>
                                </div>
                                <div className="space-y-1.5">
                                    <Label className="text-xs font-semibold">Juros *</Label>
                                    <div className="relative">
                                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">R$</span>
                                        <Input
                                            type="number"
                                            step="0.01"
                                            value={interest}
                                            onChange={(e) => setInterest(Number(e.target.value))}
                                            className="pl-9 border-slate-200"
                                        />
                                    </div>
                                </div>
                                <div className="space-y-1.5">
                                    <Label className="text-xs font-semibold">Multa *</Label>
                                    <div className="relative">
                                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">R$</span>
                                        <Input
                                            type="number"
                                            step="0.01"
                                            value={fine}
                                            onChange={(e) => setFine(Number(e.target.value))}
                                            className="pl-9 border-slate-200"
                                        />
                                    </div>
                                </div>
                                <div className="space-y-1.5">
                                    <Label className="text-xs font-semibold">Desconto *</Label>
                                    <div className="relative">
                                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">R$</span>
                                        <Input
                                            type="number"
                                            step="0.01"
                                            value={discount}
                                            onChange={(e) => setDiscount(Number(e.target.value))}
                                            className="pl-9 border-slate-200"
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="flex justify-end pt-4 border-t border-dashed">
                                <div className="text-right">
                                    <span className="text-xs text-muted-foreground uppercase font-medium">Total {type === 'receivable' ? 'Recebido' : 'Pago'}</span>
                                    <p className="text-3xl font-black text-slate-800 tracking-tight">{formatCurrency(totalPaid)}</p>
                                </div>
                            </div>
                        </div>

                        {/* ACORDIONS: OBSERVAÇÕES E ANEXOS */}
                        <div className="space-y-4">
                            <Accordion type="single" collapsible className="w-full space-y-2">
                                <AccordionItem value="obs" className="border rounded-xl bg-white px-5 shadow-sm overflow-hidden">
                                    <AccordionTrigger className="hover:no-underline py-4 text-sm font-semibold text-slate-700">
                                        <div className="flex items-center gap-2">
                                            Observações
                                            <Button variant="ghost" size="sm" className="h-7 text-[10px] bg-primary/10 text-primary hover:bg-primary/20">Inserir observação</Button>
                                        </div>
                                    </AccordionTrigger>
                                    <AccordionContent className="pb-4">
                                        <Textarea
                                            placeholder="Detalhes adicionais sobre este pagamento..."
                                            className="min-h-[100px] border-slate-200 focus:ring-1 focus:ring-primary/20"
                                            value={notes}
                                            onChange={(e) => setNotes(e.target.value)}
                                        />
                                    </AccordionContent>
                                </AccordionItem>

                                <AccordionItem value="anexos" className="border rounded-xl bg-white px-5 shadow-sm overflow-hidden">
                                    <AccordionTrigger className="hover:no-underline py-4 text-sm font-semibold text-slate-700">
                                        <div className="flex items-center gap-2">
                                            Anexos
                                            <Button variant="ghost" size="sm" className="h-7 text-[10px] bg-primary/10 text-primary hover:bg-primary/20">Inserir anexos</Button>
                                        </div>
                                    </AccordionTrigger>
                                    <AccordionContent className="pb-4">
                                        <div className="border-2 border-dashed border-slate-200 rounded-lg p-8 flex flex-col items-center justify-center gap-2 hover:border-primary/40 transition-colors cursor-pointer group">
                                            <div className="h-10 w-10 rounded-full bg-slate-50 flex items-center justify-center group-hover:bg-primary/5">
                                                <Paperclip className="h-5 w-5 text-slate-400 group-hover:text-primary transition-colors" />
                                            </div>
                                            <p className="text-sm text-muted-foreground">Clique para selecionar ou arraste arquivos aqui</p>
                                            <p className="text-[10px] text-slate-400 uppercase">PDF, PNG, JPG (Máx 5MB)</p>
                                        </div>
                                    </AccordionContent>
                                </AccordionItem>
                            </Accordion>
                        </div>
                    </div>

                    <div className="p-6 bg-white border-t flex justify-between items-center shrink-0">
                        <Button variant="ghost" onClick={() => setOpen(false)} className="text-slate-500 hover:bg-slate-100">
                            Cancelar
                        </Button>
                        <Button
                            onClick={handleConfirm}
                            className="bg-green-600 hover:bg-green-700 text-white font-bold px-8 shadow-lg shadow-green-100 transition-all hover:scale-105"
                            disabled={isPending}
                        >
                            {isPending ? (
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            ) : (
                                <ArrowRight className="mr-2 h-4 w-4" />
                            )}
                            Confirmar Baixa
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
