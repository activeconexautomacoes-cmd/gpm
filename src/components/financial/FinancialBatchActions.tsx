
import { useState } from "react";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import {
    ChevronDown,
    CheckCircle2,
    RotateCcw,
    Trash2,
    Calendar,
    DollarSign,
    CreditCard,
    Clock
} from "lucide-react";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";

interface FinancialBatchActionsProps {
    selectedItems: any[];
    onAction: (action: string, data?: any) => Promise<void>;
    bankAccounts?: any[];
    type: 'payable' | 'receivable';
}

export function FinancialBatchActions({ selectedItems, onAction, bankAccounts, type }: FinancialBatchActionsProps) {
    const { toast } = useToast();
    const [dateDialogOpen, setDateDialogOpen] = useState(false);
    const [amountDialogOpen, setAmountDialogOpen] = useState(false);
    const [accountDialogOpen, setAccountDialogOpen] = useState(false);

    const [newDate, setNewDate] = useState("");
    const [newValue, setNewValue] = useState("");
    const [newAccount, setNewAccount] = useState("");

    // Analysis of selection
    const hasPaid = selectedItems.some(i => i.status === 'paid');
    const hasOpen = selectedItems.some(i => i.status !== 'paid');
    const isMixed = hasPaid && hasOpen;
    const onlyPaid = hasPaid && !hasOpen;
    const onlyOpen = !hasPaid && hasOpen;
    const hasScheduled = selectedItems.some(i => i.is_scheduled);

    // Permission Logic
    const canMarkPaid = onlyOpen;
    const canMarkOpen = onlyPaid; // Redundant check for open items not needed, logic says disable if open.
    const canEdit = onlyOpen; // Disable value/date/account changes for paid items
    const canUnmarkScheduled = onlyOpen && hasScheduled;

    const handleBatchEdit = async (action: string, data: any) => {
        try {
            await onAction(action, data);
            setDateDialogOpen(false);
            setAmountDialogOpen(false);
            setAccountDialogOpen(false);
            setNewDate("");
            setNewValue("");
            setNewAccount("");
        } catch (error) {
            console.error(error);
        }
    };

    return (
        <>
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button variant="secondary" size="sm" className="font-bold flex gap-2">
                        Ações em lote <ChevronDown className="h-4 w-4" />
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                    <DropdownMenuItem
                        onClick={() => onAction('mark_paid')}
                        disabled={!canMarkPaid}
                        className={!canMarkPaid ? "opacity-50 cursor-not-allowed" : ""}
                    >
                        <CheckCircle2 className="h-4 w-4 mr-2" />
                        Definir como {type === 'payable' ? 'pago' : 'recebido'}
                    </DropdownMenuItem>

                    <DropdownMenuItem
                        onClick={() => onAction('mark_pending')}
                        disabled={!canMarkOpen}
                        className={!canMarkOpen ? "opacity-50 cursor-not-allowed" : ""}
                    >
                        <RotateCcw className="h-4 w-4 mr-2" />
                        Definir como em aberto
                    </DropdownMenuItem>

                    <DropdownMenuSeparator />

                    <DropdownMenuItem
                        onClick={() => setDateDialogOpen(true)}
                        disabled={!canEdit}
                        className={!canEdit ? "opacity-50 cursor-not-allowed" : ""}
                    >
                        <Calendar className="h-4 w-4 mr-2" /> Alterar data de vencimento
                    </DropdownMenuItem>

                    <DropdownMenuItem
                        onClick={() => setAmountDialogOpen(true)}
                        disabled={!canEdit}
                        className={!canEdit ? "opacity-50 cursor-not-allowed" : ""}
                    >
                        <DollarSign className="h-4 w-4 mr-2" /> Alterar valor
                    </DropdownMenuItem>

                    <DropdownMenuItem
                        onClick={() => setAccountDialogOpen(true)}
                        disabled={!canEdit}
                        className={!canEdit ? "opacity-50 cursor-not-allowed" : ""}
                    >
                        <CreditCard className="h-4 w-4 mr-2" /> Alterar conta bancária
                    </DropdownMenuItem>

                    {canUnmarkScheduled && (
                        <DropdownMenuItem onClick={() => onAction('unmark_scheduled')}>
                            <Clock className="h-4 w-4 mr-2" /> Desmarcar agendamento
                        </DropdownMenuItem>
                    )}

                    <DropdownMenuSeparator />

                    <DropdownMenuItem onClick={() => onAction('delete')} className="text-destructive">
                        <Trash2 className="h-4 w-4 mr-2" /> Excluir selecionados
                    </DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>

            {/* Dialogs */}
            <Dialog open={dateDialogOpen} onOpenChange={setDateDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Alterar Data de Vencimento</DialogTitle>
                        <DialogDescription>
                            Isso alterará a data de vencimento de {selectedItems.length} registros selecionados.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="py-4">
                        <Label>Nova Data de Vencimento</Label>
                        <Input type="date" value={newDate} onChange={(e) => setNewDate(e.target.value)} />
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setDateDialogOpen(false)}>Cancelar</Button>
                        <Button onClick={() => handleBatchEdit('batch_edit_date', { newDate })} disabled={!newDate}>Confirmar</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={amountDialogOpen} onOpenChange={setAmountDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Alterar Valor</DialogTitle>
                        <DialogDescription>
                            Isso alterará o valor de {selectedItems.length} registros selecionados.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="py-4">
                        <Label>Novo Valor (R$)</Label>
                        <Input type="number" step="0.01" value={newValue} onChange={(e) => setNewValue(e.target.value)} />
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setAmountDialogOpen(false)}>Cancelar</Button>
                        <Button onClick={() => handleBatchEdit('batch_edit_amount', { newValue })} disabled={!newValue}>Confirmar</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={accountDialogOpen} onOpenChange={setAccountDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Alterar Conta Bancária</DialogTitle>
                        <DialogDescription>
                            Isso alterará a conta bancária de {selectedItems.length} registros selecionados.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="py-4">
                        <Label>Nova Conta</Label>
                        <Select value={newAccount} onValueChange={setNewAccount}>
                            <SelectTrigger>
                                <SelectValue placeholder="Selecione a conta" />
                            </SelectTrigger>
                            <SelectContent>
                                {bankAccounts?.map(acc => (
                                    <SelectItem key={acc.id} value={acc.id}>{acc.name}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setAccountDialogOpen(false)}>Cancelar</Button>
                        <Button onClick={() => handleBatchEdit('batch_edit_account', { newAccount })} disabled={!newAccount}>Confirmar</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}
