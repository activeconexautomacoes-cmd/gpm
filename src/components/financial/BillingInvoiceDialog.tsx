import { useState, useEffect } from "react";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, QrCode, FileText, Copy, ExternalLink, RefreshCw, CreditCard, CheckCircle } from "lucide-react";
import { toast } from "sonner";

interface BillingInvoiceDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    billingId: string;
    type: 'contract' | 'sale';
    financialReceivableId?: string;
}

export function BillingInvoiceDialog({ open, onOpenChange, billingId, type, financialReceivableId }: BillingInvoiceDialogProps) {
    const [loading, setLoading] = useState(false);
    const [invoice, setInvoice] = useState<any>(null);
    const [generating, setGenerating] = useState(false);

    const fetchInvoice = async () => {
        if (!billingId) return;
        setLoading(true);
        try {
            let query = (supabase as any)
                .from("billing_invoices")
                .select("*");

            if (financialReceivableId) {
                query = query.eq("financial_receivable_id", financialReceivableId);
            } else if (type === 'contract') {
                query = query.eq("contract_billing_id", billingId);
            } else {
                query = query.eq("one_time_sale_id", billingId);
            }

            const { data, error } = await query.maybeSingle();
            if (error) throw error;
            setInvoice(data);
        } catch (error) {
            console.error(error);
            toast.error("Erro ao carregar dados da fatura");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (open && billingId) {
            fetchInvoice();
        }
    }, [open, billingId, financialReceivableId]);

    const handleGenerate = async () => {
        setGenerating(true);
        try {
            const { data, error } = await supabase.functions.invoke('pagarme-billing', {
                body: {
                    billing_id: billingId,
                    type,
                    financial_receivable_id: financialReceivableId
                }
            });

            if (error) throw error;

            toast.success("Fatura gerada com sucesso!");
            fetchInvoice();
        } catch (error: any) {
            console.error(error);
            toast.error(error.message || "Erro ao gerar fatura");
        } finally {
            setGenerating(false);
        }
    };

    const copyPix = () => {
        if (invoice?.pix_copy_paste) {
            navigator.clipboard.writeText(invoice.pix_copy_paste);
            toast.success("Código PIX copiado!");
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>Fatura de Pagamento</DialogTitle>
                </DialogHeader>

                {loading ? (
                    <div className="flex justify-center py-8">
                        <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    </div>
                ) : invoice ? (
                    <div className="space-y-6">
                        <div className="flex justify-between items-center">
                            <div>
                                <p className="text-sm text-muted-foreground">Valor</p>
                                <p className="text-xl font-bold">
                                    {new Intl.NumberFormat("pt-BR", {
                                        style: "currency",
                                        currency: "BRL",
                                    }).format(invoice.amount)}
                                </p>
                            </div>
                            <Badge variant={invoice.status === 'paid' ? 'default' : 'secondary'}>
                                {invoice.status === 'paid' ? 'PAGO' : 'PENDENTE'}
                            </Badge>
                        </div>

                        {invoice.status !== 'paid' && (
                            <div className="space-y-4">
                                {/* Primary Checkout Link */}
                                {invoice.payment_link && (
                                    <div className="bg-primary/5 border border-primary/20 rounded-lg p-4 space-y-3">
                                        <div className="flex items-center gap-2 font-semibold text-primary">
                                            <CreditCard className="h-5 w-5" />
                                            Pagamento Online
                                        </div>
                                        <p className="text-sm text-muted-foreground">
                                            Selecione entre PIX ou Cartão de Crédito na página de pagamento segura.
                                        </p>
                                        <Button className="w-full gap-2 text-white" asChild>
                                            <a href={invoice.payment_link} target="_blank" rel="noreferrer">
                                                <ExternalLink className="h-4 w-4" />
                                                Abrir Página de Pagamento
                                            </a>
                                        </Button>
                                    </div>
                                )}

                                {/* PIX QR Code (if available from previous generation) */}
                                {invoice.pix_qr_code_url && (
                                    <div className="border rounded-lg p-4 space-y-3">
                                        <div className="flex items-center gap-2 font-semibold">
                                            <QrCode className="h-4 w-4 text-emerald-500" />
                                            Pagamento via PIX
                                        </div>
                                        <div className="flex justify-center bg-white p-2 rounded">
                                            <img src={invoice.pix_qr_code_url} alt="PIX QR Code" className="h-48 w-48" />
                                        </div>
                                        <Button variant="outline" className="w-full gap-2" onClick={copyPix}>
                                            <Copy className="h-4 w-4" />
                                            Copiar Código PIX
                                        </Button>
                                    </div>
                                )}


                            </div>
                        )}

                        {invoice.status === 'paid' && (
                            <div className="bg-green-50 text-green-700 p-4 rounded-lg flex items-center gap-3">
                                <CheckCircle className="h-5 w-5" />
                                Esta fatura já foi paga.
                            </div>
                        )}

                        <Button variant="ghost" className="w-full text-xs text-muted-foreground gap-1" onClick={fetchInvoice}>
                            <RefreshCw className="h-3 w-3" />
                            Atualizar status
                        </Button>
                    </div>
                ) : (
                    <div className="text-center py-6 space-y-4">
                        <p className="text-muted-foreground">Nenhuma fatura Pagar.me encontrada para esta cobrança.</p>
                        <Button onClick={handleGenerate} disabled={generating} className="w-full">
                            {generating ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Gerando...
                                </>
                            ) : (
                                "Gerar Fatura Pagar.me"
                            )}
                        </Button>
                    </div>
                )}
            </DialogContent>
        </Dialog>
    );
}

