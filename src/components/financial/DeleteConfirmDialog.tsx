import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { CheckCircle2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useState, useMemo } from "react";
import { AlertTriangle, Trash2, Calendar, DollarSign, FileText } from "lucide-react";
import { formatCurrency, formatDate } from "@/utils/format";

interface RelatedItem {
    id: string;
    description: string;
    due_date: string;
    total_amount: number;
    status: string;
}

interface DeleteConfirmDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    item: any;
    type: 'payable' | 'receivable';
    relatedItems: RelatedItem[];
    onConfirmSingle: (id: string) => void;
    onConfirmAll: (ids: string[]) => void;
    isDeleting?: boolean;
}

export function DeleteConfirmDialog({
    open,
    onOpenChange,
    item,
    type,
    relatedItems,
    onConfirmSingle,
    onConfirmAll,
    isDeleting = false
}: DeleteConfirmDialogProps) {
    const [deleteOption, setDeleteOption] = useState<'single' | 'all'>('single');

    const hasRelatedItems = relatedItems.length > 0;
    const isRecurring = type === 'payable' ? item?.is_recurring : (item?.contract_id || item?.contract_billing_id);

    const totalRelatedAmount = useMemo(() => {
        return relatedItems.reduce((acc, i) => acc + Number(i.total_amount), 0);
    }, [relatedItems]);


    const handleConfirm = () => {
        if (deleteOption === 'single' || !hasRelatedItems) {
            onConfirmSingle(item.id);
        } else {
            const allIds = [item.id, ...relatedItems.map(i => i.id)];
            onConfirmAll(allIds);
        }
    };

    const getStatusBadge = (status: string) => {
        const statusMap: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
            pending: { label: 'Em Aberto', variant: 'secondary' },
            paid: { label: 'Pago', variant: 'default' },
            overdue: { label: 'Vencido', variant: 'destructive' },
            partial: { label: 'Parcial', variant: 'outline' },
            cancelled: { label: 'Cancelado', variant: 'outline' },
        };
        const config = statusMap[status] || { label: status, variant: 'outline' as const };
        return <Badge variant={config.variant} className="text-[10px]">{config.label}</Badge>;
    };

    return (
        <AlertDialog open={open} onOpenChange={onOpenChange}>
            <AlertDialogContent className="max-w-lg">
                <AlertDialogHeader>
                    <div className="flex items-center gap-3">
                        <div className="h-12 w-12 rounded-full bg-red-100 flex items-center justify-center">
                            <AlertTriangle className="h-6 w-6 text-red-600" />
                        </div>
                        <div>
                            <AlertDialogTitle className="text-lg">
                                Excluir {type === 'payable' ? 'despesa' : 'receita'}
                            </AlertDialogTitle>
                            <p className="text-sm text-muted-foreground mt-1">
                                {item?.description}
                            </p>
                        </div>
                    </div>
                </AlertDialogHeader>

                <div className="space-y-4 py-4">
                    {/* Info do item atual */}
                    <div className="bg-slate-50 rounded-lg p-4 border">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <Calendar className="h-4 w-4 text-muted-foreground" />
                                <span className="text-sm">Vencimento: {formatDate(item?.due_date)}</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <DollarSign className="h-4 w-4 text-muted-foreground" />
                                <span className="text-sm font-semibold">{formatCurrency(item?.total_amount)}</span>
                            </div>
                        </div>
                    </div>

                    {/* Aviso irreversível */}
                    <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                        <p className="text-sm text-amber-800 flex items-start gap-2">
                            <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                            <span>
                                <strong>Atenção:</strong> Esta ação não pode ser desfeita. O lançamento será permanentemente excluído do sistema.
                            </span>
                        </p>
                    </div>

                    {/* Opções para lançamentos com parcelas/recorrência */}
                    {hasRelatedItems && (isRecurring || relatedItems.length > 0) && (
                        <div className="space-y-3">
                            <div className="flex items-center gap-2 text-sm font-medium text-slate-700">
                                <FileText className="h-4 w-4" />
                                Este lançamento possui {relatedItems.length} {relatedItems.length === 1 ? 'parcela vinculada' : 'parcelas vinculadas'}
                            </div>

                            <RadioGroup value={deleteOption} onValueChange={(v) => setDeleteOption(v as 'single' | 'all')}>
                                <div className="space-y-2">
                                    <div className="flex items-center space-x-3 rounded-lg border p-3 cursor-pointer hover:bg-slate-50" onClick={() => setDeleteOption('single')}>
                                        <RadioGroupItem value="single" id="single" />
                                        <Label htmlFor="single" className="flex-1 cursor-pointer">
                                            <span className="font-medium">Excluir apenas este lançamento</span>
                                            <p className="text-sm text-muted-foreground">
                                                Os demais lançamentos vinculados serão mantidos
                                            </p>
                                        </Label>
                                    </div>
                                    <div className="flex items-center space-x-3 rounded-lg border border-red-200 p-3 cursor-pointer hover:bg-red-50" onClick={() => setDeleteOption('all')}>
                                        <RadioGroupItem value="all" id="all" />
                                        <Label htmlFor="all" className="flex-1 cursor-pointer">
                                            <span className="font-medium text-red-700">Excluir lançamentos em aberto vinculados</span>
                                            <p className="text-sm text-red-600">
                                                {relatedItems.length + 1} lançamentos em aberto serão excluídos (Total: {formatCurrency(totalRelatedAmount + Number(item?.total_amount))})
                                            </p>
                                        </Label>
                                    </div>
                                </div>
                            </RadioGroup>

                            {/* Lista de lançamentos relacionados */}
                            {deleteOption === 'all' && (
                                <div className="space-y-2">
                                    <div className="border rounded-lg overflow-hidden">
                                        <div className="bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-600 uppercase">
                                            Lançamentos em aberto que serão excluídos
                                        </div>
                                        <div className="max-h-[240px] overflow-y-auto">
                                            <div className="divide-y">
                                                {/* Item atual */}
                                                <div className="px-3 py-2 flex items-center justify-between bg-red-50">
                                                    <div className="flex-1 min-w-0">
                                                        <p className="text-sm font-medium truncate">{item?.description}</p>
                                                        <p className="text-xs text-muted-foreground">{formatDate(item?.due_date)}</p>
                                                    </div>
                                                    <div className="flex items-center gap-2 shrink-0">
                                                        {getStatusBadge(item?.status)}
                                                        <span className="text-sm font-semibold">{formatCurrency(item?.total_amount)}</span>
                                                    </div>
                                                </div>
                                                {/* Lançamentos relacionados */}
                                                {relatedItems.map((relItem) => (
                                                    <div key={relItem.id} className="px-3 py-2 flex items-center justify-between hover:bg-slate-50">
                                                        <div className="flex-1 min-w-0">
                                                            <p className="text-sm font-medium truncate">{relItem.description}</p>
                                                            <p className="text-xs text-muted-foreground">{formatDate(relItem.due_date)}</p>
                                                        </div>
                                                        <div className="flex items-center gap-2 shrink-0">
                                                            {getStatusBadge(relItem.status)}
                                                            <span className="text-sm font-semibold">{formatCurrency(relItem.total_amount)}</span>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="bg-green-50 border border-green-200 rounded-lg p-2.5">
                                        <p className="text-xs text-green-700 flex items-center gap-1.5">
                                            <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                                            Lançamentos já pagos serão mantidos no sistema.
                                        </p>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                <AlertDialogFooter>
                    <AlertDialogCancel disabled={isDeleting}>Cancelar</AlertDialogCancel>
                    <Button
                        variant="destructive"
                        onClick={handleConfirm}
                        disabled={isDeleting}
                        className="gap-2"
                    >
                        <Trash2 className="h-4 w-4" />
                        {isDeleting ? 'Excluindo...' : (
                            deleteOption === 'all' && hasRelatedItems
                                ? `Excluir ${relatedItems.length + 1} lançamentos`
                                : 'Excluir lançamento'
                        )}
                    </Button>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );
}
