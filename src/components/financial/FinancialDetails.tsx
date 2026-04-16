
import { Database } from "@/integrations/supabase/types";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
    Accordion,
    AccordionContent,
    AccordionItem,
    AccordionTrigger,
} from "@/components/ui/accordion";
import {
    Eye,
    Calendar,
    Wallet,
    CreditCard,
    FileText,
    Paperclip,
    ArrowLeft,
    Edit2,
    RotateCcw,
    DollarSign,
    User,
    Tag,
    Clock,
    CheckCircle2,
    AlertCircle,
    Building2,
    Target,
    Hash
} from "lucide-react";
import { formatCurrency, formatDate } from "@/utils/format";
import { useReceivables, usePayables } from "@/hooks/useFinancialModules";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";
import { ReceivableForm } from "./ReceivableForm";
import { PayableForm } from "./PayableForm";


type ExtendedFinancialItem = (Database["public"]["Tables"]["financial_receivables"]["Row"] | Database["public"]["Tables"]["financial_payables"]["Row"]) & {
    clients?: { name: string };
    financial_categories?: { name: string };
    financial_bank_accounts?: { name: string };
    financial_cost_centers?: any;
    financial_allocations?: any[];
    supplier_name?: string | null;
};

interface FinancialDetailsProps {
    type: 'receivable' | 'payable';
    item: ExtendedFinancialItem;
    trigger?: React.ReactNode;
}

export function FinancialDetails({ type, item, trigger }: FinancialDetailsProps) {
    const [open, setOpen] = useState(false);
    const [editOpen, setEditOpen] = useState(false);
    const { currentWorkspace } = useWorkspace();
    const { updateReceivable } = useReceivables(currentWorkspace?.id);
    const { updatePayable } = usePayables(currentWorkspace?.id);
    const { toast } = useToast();

    const handleRevertToPending = async () => {
        try {
            const updateData = {
                id: item.id,
                workspace_id: item.workspace_id,
                status: 'pending' as Database["public"]["Enums"]["financial_status"],
                payment_date: null,
                paid_amount: 0,
                interest: 0,
                fine: 0,
                discount: 0,
                payment_method: null
            };

            if (type === 'receivable') {
                await updateReceivable.mutateAsync({ item: updateData });
            } else {
                await updatePayable.mutateAsync({ item: updateData });
            }

            toast({
                title: "Sucesso",
                description: "Lançamento alterado para 'Em Aberto'.",
            });
            setOpen(false);
        } catch (err) {
            console.error(err);
            toast({
                title: "Erro",
                description: "Erro ao alterar status do lançamento.",
                variant: "destructive"
            });
        }
    };

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'paid':
                return <Badge className="bg-green-100 text-green-700 border-green-200 hover:bg-green-100"><CheckCircle2 className="w-3 h-3 mr-1" /> Recebido</Badge>;
            case 'partial':
                return <Badge className="bg-blue-100 text-blue-700 border-blue-200 hover:bg-blue-100"><Clock className="w-3 h-3 mr-1" /> Parcial</Badge>;
            case 'overdue':
                return <Badge className="bg-red-100 text-red-700 border-red-200 hover:bg-red-100"><AlertCircle className="w-3 h-3 mr-1" /> Atrasado</Badge>;
            default:
                return <Badge className="bg-yellow-100 text-yellow-700 border-yellow-200 hover:bg-yellow-100"><Clock className="w-3 h-3 mr-1" /> Em Aberto</Badge>;
        }
    };

    return (
        <>
            <Dialog open={open} onOpenChange={setOpen}>
                <DialogTrigger asChild>
                    {trigger || (
                        <Button variant="ghost" size="sm" className="gap-2">
                            <Eye className="h-4 w-4" />
                            Ver detalhes
                        </Button>
                    )}
                </DialogTrigger>
                <DialogContent className="max-w-4xl p-0 overflow-hidden border-none shadow-2xl">
                    <div className="bg-slate-50 flex flex-col max-h-[90vh]">
                        {/* Header Premium */}
                        <DialogHeader className="p-6 bg-white border-b shrink-0">
                            <div className="flex justify-between items-start">
                                <div className="space-y-1">
                                    <div className="flex items-center gap-3">
                                        <DialogTitle className="text-xl font-bold text-slate-800">
                                            Detalhes do {type === 'receivable' ? 'Recebimento' : 'Pagamento'}
                                        </DialogTitle>
                                        {getStatusBadge(item.status)}
                                    </div>
                                    <p className="text-sm text-slate-500 font-medium flex items-center gap-1">
                                        <FileText className="h-3.5 w-3.5" /> {item.description || 'Sem descrição'}
                                    </p>
                                </div>
                                <div className="text-right space-y-1">
                                    <span className="text-[10px] text-slate-400 uppercase font-bold tracking-widest">Valor Total</span>
                                    <p className="text-2xl font-black text-slate-900 leading-none">
                                        {formatCurrency(item.total_amount)}
                                    </p>
                                </div>
                            </div>
                        </DialogHeader>

                        <div className="flex-1 overflow-y-auto p-6 space-y-6">
                            {/* Grid Principal */}
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                {/* Informações Básicas */}
                                <div className="bg-white rounded-xl border p-5 shadow-sm space-y-4 md:col-span-2">
                                    <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                                        <Building2 className="h-3.5 w-3.5" /> Dados do Lançamento
                                    </h3>
                                    <div className="grid grid-cols-2 gap-y-6 gap-x-4">
                                        <div>
                                            <label className="text-[10px] text-slate-400 uppercase font-bold">Fornecedor / Cliente</label>
                                            <p className="text-sm font-semibold text-slate-700 flex items-center gap-1.5 mt-0.5">
                                                <User className="h-3.5 w-3.5 text-slate-400" />
                                                {type === 'receivable' ? (item.clients?.name || 'Não informado') : (item.supplier_name || 'Não informado')}
                                            </p>
                                        </div>
                                        <div>
                                            <label className="text-[10px] text-slate-400 uppercase font-bold">Categoria</label>
                                            <div className="mt-0.5 space-y-1">
                                                {item.financial_allocations && item.financial_allocations.length > 0 ? (
                                                    item.financial_allocations.map((alloc, idx) => (
                                                        <div key={idx} className="flex flex-col gap-0.5 bg-slate-50 p-2 rounded-lg border border-slate-100">
                                                            <p className="text-sm font-semibold text-slate-700 flex items-center gap-1.5">
                                                                <Tag className="h-3.5 w-3.5 text-slate-400" />
                                                                {alloc.financial_categories?.name || 'Não categorizado'}
                                                                <span className="text-[10px] px-1.5 py-0.5 bg-slate-200 rounded text-slate-600 font-bold ml-auto">
                                                                    {alloc.percentage}%
                                                                </span>
                                                            </p>
                                                            {alloc.financial_cost_centers?.name && (
                                                                <p className="text-[10px] text-slate-500 flex items-center gap-1 ml-5">
                                                                    <Target className="h-3 w-3" />
                                                                    {alloc.financial_cost_centers.name}
                                                                </p>
                                                            )}
                                                        </div>
                                                    ))
                                                ) : (
                                                    <p className="text-sm font-semibold text-slate-700 flex items-center gap-1.5" style={{ marginTop: '0.125rem' }}>
                                                        <Tag className="h-3.5 w-3.5 text-slate-400" />
                                                        {item.financial_categories?.name || 'Não categorizado'}
                                                    </p>
                                                )}
                                            </div>
                                        </div>
                                        <div>
                                            <label className="text-[10px] text-slate-400 uppercase font-bold">Data de Emissão</label>
                                            <p className="text-sm font-semibold text-slate-700 flex items-center gap-1.5 mt-0.5">
                                                <Calendar className="h-3.5 w-3.5 text-slate-400" />
                                                {formatDate(item.created_at)}
                                            </p>
                                        </div>
                                        <div>
                                            <label className="text-[10px] text-slate-400 uppercase font-bold">Data de Competência</label>
                                            <p className="text-sm font-semibold text-slate-700 flex items-center gap-1.5 mt-0.5">
                                                <Calendar className="h-3.5 w-3.5 text-slate-400" />
                                                {formatDate(item.competence_date)}
                                            </p>
                                        </div>
                                        {(!item.financial_allocations || item.financial_allocations.length === 0) && (
                                            <div>
                                                <label className="text-[10px] text-slate-400 uppercase font-bold">Centro de Custo</label>
                                                <p className="text-sm font-semibold text-slate-700 flex items-center gap-1.5 mt-0.5">
                                                    <Target className="h-3.5 w-3.5 text-slate-400" />
                                                    {item.financial_cost_centers?.name || 'Não informado'}
                                                </p>
                                            </div>
                                        )}
                                        <div>
                                            <label className="text-[10px] text-slate-400 uppercase font-bold">Referência</label>
                                            <p className="text-sm font-semibold text-slate-700 flex items-center gap-1.5 mt-0.5">
                                                <Hash className="h-3.5 w-3.5 text-slate-400" />
                                                {item.reference_code || '---'}
                                            </p>
                                        </div>
                                    </div>
                                </div>

                                {/* Resumo de Valores */}
                                <div className="bg-white rounded-xl border p-5 shadow-sm space-y-4">
                                    <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                                        <DollarSign className="h-3.5 w-3.5" /> Resumo Financeiro
                                    </h3>
                                    <div className="space-y-3">
                                        <div className="flex justify-between items-center text-sm">
                                            <span className="text-slate-500">Valor Nominal</span>
                                            <span className="font-medium text-slate-700">{formatCurrency(item.amount || (item.total_amount - (item.interest || 0) - (item.fine || 0) + (item.discount || 0)))}</span>
                                        </div>
                                        {item.interest > 0 && (
                                            <div className="flex justify-between items-center text-sm">
                                                <span className="text-slate-500">Juros</span>
                                                <span className="font-medium text-green-600">+{formatCurrency(item.interest)}</span>
                                            </div>
                                        )}
                                        {item.fine > 0 && (
                                            <div className="flex justify-between items-center text-sm">
                                                <span className="text-slate-500">Multa</span>
                                                <span className="font-medium text-green-600">+{formatCurrency(item.fine)}</span>
                                            </div>
                                        )}
                                        {item.discount > 0 && (
                                            <div className="flex justify-between items-center text-sm">
                                                <span className="text-slate-500">Desconto</span>
                                                <span className="font-medium text-red-600">-{formatCurrency(item.discount)}</span>
                                            </div>
                                        )}
                                        <Separator className="my-2" />
                                        <div className="flex justify-between items-center">
                                            <span className="text-xs font-bold text-slate-800 uppercase">Total Final</span>
                                            <span className="text-lg font-black text-slate-900">{formatCurrency(item.total_amount)}</span>
                                        </div>
                                        {(item.paid_amount > 0 && item.status !== 'paid') && (
                                            <>
                                                <div className="flex justify-between items-center text-sm pt-2">
                                                    <span className="text-blue-600 font-medium italic">Valor já pago</span>
                                                    <span className="font-bold text-blue-700">{formatCurrency(item.paid_amount)}</span>
                                                </div>
                                                <div className="flex justify-between items-center text-sm border-t border-dashed mt-1 pt-1">
                                                    <span className="text-slate-400 font-medium italic">Saldo restante</span>
                                                    <span className="font-bold text-slate-900">{formatCurrency(item.total_amount - item.paid_amount)}</span>
                                                </div>
                                            </>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Detalhes do Pagamento (se efetuado) */}
                            {item.status === 'paid' && (
                                <div className="bg-blue-50/50 rounded-xl border border-blue-100 p-5 shadow-sm space-y-4">
                                    <h3 className="text-xs font-bold text-blue-600 uppercase tracking-wider flex items-center gap-2">
                                        <Wallet className="h-3.5 w-3.5" /> Detalhes da Liquidação
                                    </h3>
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                                        <div>
                                            <label className="text-[10px] text-blue-400 uppercase font-bold">Data do Pagamento</label>
                                            <p className="text-sm font-bold text-blue-900 mt-0.5">{formatDate(item.payment_date)}</p>
                                        </div>
                                        <div>
                                            <label className="text-[10px] text-blue-400 uppercase font-bold">Meio de Pagamento</label>
                                            <p className="text-sm font-bold text-blue-900 mt-0.5 flex items-center gap-1.5 capitalize">
                                                <CreditCard className="h-3.5 w-3.5" />
                                                {item.payment_method?.replace('_', ' ') || 'Não informado'}
                                            </p>
                                        </div>
                                        <div className="col-span-2">
                                            <label className="text-[10px] text-blue-400 uppercase font-bold">Conta Bancária</label>
                                            <p className="text-sm font-bold text-blue-900 mt-0.5 flex items-center gap-1.5">
                                                <Wallet className="h-3.5 w-3.5" />
                                                {item.financial_bank_accounts?.name || 'Não informada'}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Accordions: Observações e Outros */}
                            <Accordion type="single" collapsible className="space-y-3">
                                <AccordionItem value="notes" className="bg-white border rounded-xl px-5 shadow-sm overflow-hidden border-slate-200">
                                    <AccordionTrigger className="hover:no-underline py-4">
                                        <div className="flex items-center gap-2 text-sm font-semibold text-slate-700 uppercase tracking-tight">
                                            <FileText className="h-4 w-4 text-slate-400" /> Observações
                                        </div>
                                    </AccordionTrigger>
                                    <AccordionContent className="pb-4 pt-1">
                                        <p className="text-sm text-slate-600 leading-relaxed italic bg-slate-50 p-4 rounded-lg border border-slate-100">
                                            {item.notes || 'Nenhuma observação registrada para este lançamento.'}
                                        </p>
                                    </AccordionContent>
                                </AccordionItem>

                                <AccordionItem value="attachments" className="bg-white border rounded-xl px-5 shadow-sm overflow-hidden border-slate-200">
                                    <AccordionTrigger className="hover:no-underline py-4">
                                        <div className="flex items-center gap-2 text-sm font-semibold text-slate-700 uppercase tracking-tight">
                                            <Paperclip className="h-4 w-4 text-slate-400" /> Anexos
                                        </div>
                                    </AccordionTrigger>
                                    <AccordionContent className="pb-4 pt-1">
                                        <div className="flex flex-col items-center justify-center p-8 border-2 border-dashed border-slate-100 rounded-xl bg-slate-50/50">
                                            <Paperclip className="h-8 w-8 text-slate-200 mb-2" />
                                            <p className="text-xs text-slate-400 font-medium italic">Nenhum anexo disponível.</p>
                                        </div>
                                    </AccordionContent>
                                </AccordionItem>
                            </Accordion>
                        </div>

                        {/* Footer com Ações */}
                        <div className="p-6 bg-white border-t flex justify-between items-center shrink-0">
                            <Button variant="outline" onClick={() => setOpen(false)} className="text-slate-500 border-slate-200 hover:bg-slate-50 hover:text-slate-700">
                                <ArrowLeft className="h-4 w-4 mr-2" /> Fechar
                            </Button>

                            <div className="flex items-center gap-3">
                                {item.status === 'paid' && (
                                    <Button
                                        variant="outline"
                                        className="text-yellow-600 border-yellow-200 hover:bg-yellow-50 hover:text-yellow-700 font-semibold"
                                        onClick={handleRevertToPending}
                                    >
                                        <RotateCcw className="h-4 w-4 mr-2" /> Voltar para em Aberto
                                    </Button>
                                )}

                                <Button
                                    className="bg-primary hover:bg-primary/90 text-white font-bold px-6 shadow-lg shadow-primary/10 transition-all hover:scale-105"
                                    onClick={() => {
                                        setOpen(false);
                                        setEditOpen(true);
                                    }}
                                >
                                    <Edit2 className="h-4 w-4 mr-2" /> Editar Lançamento
                                </Button>
                            </div>
                        </div>
                    </div>
                </DialogContent>
            </Dialog >

            {/* Dialog de Edição Separado para evitar aninhamento de DialogContent */}
            {
                type === 'receivable' ? (
                    <ReceivableForm
                        open={editOpen}
                        onOpenChange={setEditOpen}
                        initialData={item as Database["public"]["Tables"]["financial_receivables"]["Row"]}
                    />
                ) : (
                    <PayableForm
                        open={editOpen}
                        onOpenChange={setEditOpen}
                        initialData={item as Database["public"]["Tables"]["financial_payables"]["Row"]}
                    />
                )
            }
        </>
    );
}
