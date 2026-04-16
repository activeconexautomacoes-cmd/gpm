import React from "react";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
    DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { CheckCircle2, AlertTriangle, XCircle, ArrowRight, ShoppingCart } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface WinValidationDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    opportunity: any;
    onContinue: () => void;
}

export function WinValidationDialog({
    open,
    onOpenChange,
    opportunity,
    onContinue,
}: WinValidationDialogProps) {
    const isPaymentPaid = opportunity?.payment_status === "paid";
    const isContractSigned = opportunity?.contract_signature_status === "signed";

    // Check for products - CRITICAL validation
    const products = opportunity?.opportunity_products || [];
    const hasProducts = products.length > 0;
    const negotiatedValue = parseFloat(opportunity?.negotiated_value || "0");
    const hasValue = negotiatedValue > 0;

    // Missing products is a blocking issue
    const hasBlockingIssues = !hasProducts || !hasValue;
    const hasWarningIssues = !isPaymentPaid || !isContractSigned;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        Verificação de Fechamento
                    </DialogTitle>
                    <DialogDescription>
                        Verifique os requisitos abaixo antes de finalizar o contrato.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-4">
                    {/* Product Check - BLOCKING */}
                    <div className="flex items-start gap-3 p-3 rounded-lg border bg-card">
                        <div className="mt-0.5">
                            {hasProducts && hasValue ? (
                                <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                            ) : (
                                <XCircle className="w-5 h-5 text-rose-500" />
                            )}
                        </div>
                        <div className="flex-1 space-y-1">
                            <div className="flex items-center justify-between">
                                <span className="text-sm font-semibold">Produtos Negociados</span>
                                {hasProducts && hasValue ? (
                                    <Badge variant="outline" className="border-emerald-200 text-emerald-700 bg-emerald-50 text-[10px]">
                                        {products.length} produto(s) - R$ {negotiatedValue.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                                    </Badge>
                                ) : (
                                    <Badge variant="outline" className="border-rose-200 text-rose-700 bg-rose-50 text-[10px]">Obrigatório</Badge>
                                )}
                            </div>
                            <p className="text-xs text-muted-foreground">
                                {hasProducts && hasValue
                                    ? "Produtos configurados corretamente."
                                    : !hasProducts
                                        ? "Nenhum produto vinculado. Adicione produtos na aba Negociação."
                                        : "Valor negociado deve ser maior que zero."}
                            </p>
                        </div>
                    </div>

                    {/* Payment Status Check */}
                    <div className="flex items-start gap-3 p-3 rounded-lg border bg-card">
                        <div className="mt-0.5">
                            {isPaymentPaid ? (
                                <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                            ) : (
                                <AlertTriangle className="w-5 h-5 text-amber-500" />
                            )}
                        </div>
                        <div className="flex-1 space-y-1">
                            <div className="flex items-center justify-between">
                                <span className="text-sm font-semibold">Pagamento da 1ª Parcela</span>
                                {isPaymentPaid ? (
                                    <Badge variant="outline" className="border-emerald-200 text-emerald-700 bg-emerald-50 text-[10px]">Pago</Badge>
                                ) : (
                                    <Badge variant="outline" className="border-amber-200 text-amber-700 bg-amber-50 text-[10px]">Pendente</Badge>
                                )}
                            </div>
                            <p className="text-xs text-muted-foreground">
                                {isPaymentPaid
                                    ? "O pagamento foi confirmado via Link Pagar.me."
                                    : "Nenhum pagamento confirmado pelo link gerado."}
                            </p>
                        </div>
                    </div>

                    {/* Contract Status Check */}
                    <div className="flex items-start gap-3 p-3 rounded-lg border bg-card">
                        <div className="mt-0.5">
                            {isContractSigned ? (
                                <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                            ) : (
                                <AlertTriangle className="w-5 h-5 text-amber-500" />
                            )}
                        </div>
                        <div className="flex-1 space-y-1">
                            <div className="flex items-center justify-between">
                                <span className="text-sm font-semibold">Assinatura do Contrato</span>
                                {isContractSigned ? (
                                    <Badge variant="outline" className="border-emerald-200 text-emerald-700 bg-emerald-50 text-[10px]">Assinado</Badge>
                                ) : (
                                    <Badge variant="outline" className="border-amber-200 text-amber-700 bg-amber-50 text-[10px]">Pendente</Badge>
                                )}
                            </div>
                            <p className="text-xs text-muted-foreground">
                                {isContractSigned
                                    ? "O documento foi assinado via D4Sign."
                                    : "Aguardando assinatura do cliente."}
                            </p>
                        </div>
                    </div>

                    {/* Blocking Issues Alert */}
                    {hasBlockingIssues && (
                        <div className="bg-rose-50 border border-rose-200 rounded-lg p-3 text-xs text-rose-800 flex gap-2">
                            <XCircle className="w-4 h-4 shrink-0" />
                            <p>
                                <strong>Não é possível dar ganho sem produtos vinculados.</strong>
                                Volte e adicione pelo menos um produto na aba Negociação com valor maior que zero.
                            </p>
                        </div>
                    )}

                    {/* Warning Issues Alert */}
                    {!hasBlockingIssues && hasWarningIssues && (
                        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-800 flex gap-2">
                            <AlertTriangle className="w-4 h-4 shrink-0" />
                            <p>Existem pendências no processo de fechamento. Você pode prosseguir, mas certifique-se de que está ciente do estado atual.</p>
                        </div>
                    )}

                </div>

                <DialogFooter className="gap-2 sm:gap-0">
                    <Button variant="outline" onClick={() => onOpenChange(false)}>
                        Voltar
                    </Button>
                    <Button
                        onClick={() => {
                            onOpenChange(false);
                            onContinue();
                        }}
                        disabled={hasBlockingIssues}
                        variant={hasWarningIssues ? "secondary" : "default"}
                        className={hasWarningIssues && !hasBlockingIssues ? "bg-amber-100 text-amber-900 hover:bg-amber-200" : ""}
                    >
                        {hasBlockingIssues
                            ? "Adicione Produtos"
                            : hasWarningIssues
                                ? "Prosseguir Excepcionalmente"
                                : "Confirmar e Criar Contrato"}
                        {!hasBlockingIssues && <ArrowRight className="w-4 h-4 ml-2" />}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

