import { useState, useEffect, useRef } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, CreditCard, CheckCircle, QrCode, Copy, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Checkbox } from "@/components/ui/checkbox";

export default function InvoicePayment() {
    const { id } = useParams();
    const [searchParams] = useSearchParams();
    const [loading, setLoading] = useState(true);
    const [data, setData] = useState<any>(null);
    const [generating, setGenerating] = useState(false);
    const [paymentMode, setPaymentMode] = useState<'options' | 'card' | 'pix' | 'success'>('options');
    const [lastSuccessData, setLastSuccessData] = useState<any>(null);
    const [isPaymentOpen, setIsPaymentOpen] = useState(false);
    const [cardData, setCardData] = useState({ number: "", holder: "", expiry: "", cvv: "", installments: "1" });
    const [isSubscription, setIsSubscription] = useState(false);
    const [showDataCollection, setShowDataCollection] = useState(false);
    const [pendingMethod, setPendingMethod] = useState<'pix' | 'credit_card' | null>(null);
    const [extraFormData, setExtraFormData] = useState({
        document: "", zip_code: "", street: "", number: "", neighborhood: "", city: "", state: "", complement: ""
    });
    const pollingRef = useRef<NodeJS.Timeout | null>(null);

    const fetchData = async (silent = false) => {
        try {
            if (!silent) setLoading(true);
            const { data: res, error } = await supabase.functions.invoke('invoice-payment-data', { body: { billing_id: id } });
            if (error) throw error;

            // Check if status changed to paid
            if (res?.billing?.status === 'paid' && data?.billing?.status !== 'paid') {
                setPaymentMode('success');
                toast.success("Pagamento confirmado!");
                stopPolling();
            }

            setData(res);
        } catch (error) {
            if (!silent) toast.error("Erro ao carregar a fatura.");
        } finally {
            if (!silent) setLoading(false);
        }
    };

    const startPolling = () => {
        // Stop any existing polling
        stopPolling();
        // Start new polling every 5 seconds
        pollingRef.current = setInterval(() => {
            console.log("🔄 Polling for payment status...");
            fetchData(true);
        }, 5000);
    };

    const stopPolling = () => {
        if (pollingRef.current) {
            clearInterval(pollingRef.current);
            pollingRef.current = null;
        }
    };

    useEffect(() => {
        if (id) fetchData();

        // Cleanup polling on unmount
        return () => stopPolling();
    }, [id]);

    // Start polling when in PIX mode
    useEffect(() => {
        if (paymentMode === 'pix' && data?.billing?.status !== 'paid') {
            startPolling();
        } else {
            stopPolling();
        }

        return () => stopPolling();
    }, [paymentMode, data?.billing?.status]);

    const validateAndProceed = (method: 'pix' | 'credit_card') => {
        const client = data?.client || {};
        const cleanDoc = (client.document || "").replace(/\D/g, "");
        const needsDoc = !cleanDoc || cleanDoc.length < 11;

        const hasAddress = client.zip_code && client.street && client.number && client.neighborhood && client.city && client.state;
        const needsAddress = method === 'credit_card' && !hasAddress;

        if (needsDoc || needsAddress) {
            setPendingMethod(method);
            setExtraFormData({
                document: client.document || "", zip_code: client.zip_code || "", street: client.street || "",
                number: client.number || "", neighborhood: client.neighborhood || "", city: client.city || "",
                state: client.state || "", complement: client.complement || ""
            });
            setShowDataCollection(true);
        } else {
            if (method === 'credit_card') setPaymentMode('card');
            else processPayment(method);
        }
    };

    const handleDataCollectionSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!pendingMethod) return;
        if (!extraFormData.document) return toast.error("CPF/CNPJ é obrigatório.");
        if (pendingMethod === 'credit_card') {
            if (!extraFormData.zip_code || !extraFormData.street || !extraFormData.number || !extraFormData.neighborhood || !extraFormData.city || !extraFormData.state) {
                return toast.error("Endereço completo é obrigatório para cartão.");
            }
        }
        setShowDataCollection(false);
        if (pendingMethod === 'credit_card') setPaymentMode('card');
        else processPayment(pendingMethod, { customer_extra: extraFormData });
    };

    const processPayment = async (method: 'pix' | 'credit_card', additionalPayload = {}) => {
        setGenerating(true);
        setLastSuccessData(null);
        try {
            const isSale = data.billing.type === 'sale';
            const payload: any = {
                billing_id: data.billing.id, type: isSale ? 'sale' : 'contract',
                payment_method: method, customer_extra: extraFormData, ...additionalPayload
            };
            const { data: res, error } = await supabase.functions.invoke('pagarme-billing', { body: payload });
            if (error) throw error;
            if (!res.success) {
                let errorDetails = res.error || "Erro desconhecido no backend.";
                if (res.details?.message) errorDetails = res.details.message;
                throw new Error(errorDetails);
            }
            if (res.order?.status === 'failed') {
                const failReason = res.order.charges?.[0]?.last_transaction?.gateway_response?.errors?.[0]?.message || "Pagamento recusado.";
                throw new Error(`Falha no Pagamento: ${failReason}`);
            }
            setLastSuccessData(res.order);
            if (res.status === 'paid' || res.order?.status === 'paid') {
                setPaymentMode('success');
                toast.success("Pagamento aprovado!");
                fetchData();
            } else {
                setPaymentMode(method === 'pix' ? 'pix' : 'options');
                // Refresh data to get the PIX info stored in invoice
                fetchData(true);
            }
        } catch (error: any) {
            toast.error(error.message || "Erro ao processar pagamento.", { duration: 8000 });
        } finally { setGenerating(false); }
    };

    const handleCardPayment = async () => {
        setGenerating(true);
        try {
            const [month, year] = cardData.expiry.replace(/\s/g, "").split("/");
            if (!month || !year) throw new Error("Validade inválida (MM/AA)");
            await processPayment('credit_card', {
                card: {
                    number: cardData.number.replace(/\D/g, ""), holder_name: cardData.holder,
                    exp_month: parseInt(month, 10), exp_year: parseInt("20" + year, 10), cvv: cardData.cvv
                },
                installments: parseInt(cardData.installments),
                customer_extra: extraFormData,
                is_subscription: isSubscription
            });
        } catch (e: any) {
            toast.error(e.message || "Dados do cartão inválidos.");
            setGenerating(false);
        }
    };

    if (loading) return <div className="min-h-screen flex items-center justify-center bg-slate-50"><Loader2 className="h-10 w-10 animate-spin text-primary" /></div>;
    if (!data) return <div className="min-h-screen flex items-center justify-center bg-slate-50"><Card className="p-8 text-center"><h2 className="text-2xl font-bold">Fatura não encontrada</h2></Card></div>;

    const billing = data.billing;
    const client = data.client;
    const invoice = data.invoice;
    // Consider as paid if either the source billing is paid OR the specific invoice is paid
    const isPaid = billing.status === 'paid' || invoice?.status === 'paid';

    const calculateOptions = () => {
        if (billing.type === 'contract' || billing.has_recurring_products) {
            return [{ installments: 1, amount: billing.final_amount, total: billing.final_amount, hasInterest: false }];
        }

        const options = [];
        const rate = Number(billing.installment_interest_rate) || 0;

        // 1x always exists
        options.push({ installments: 1, amount: billing.final_amount, total: billing.final_amount, hasInterest: false });

        if (billing.final_amount >= 10) { // Minimum threshold to allow installments
            for (let i = 2; i <= 12; i++) {
                let total = billing.final_amount;
                if (rate > 0) {
                    const rateDecimal = rate / 100;
                    total = billing.final_amount * Math.pow(1 + rateDecimal, i);
                }
                options.push({
                    installments: i,
                    amount: total / i,
                    total: total,
                    hasInterest: rate > 0
                });
            }
        }
        return options;
    };
    const installmentOptions = calculateOptions();

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
            <header className="bg-white/80 backdrop-blur-md sticky top-0 z-20 border-b border-slate-200/60">
                <div className="max-w-3xl mx-auto px-6 py-6 flex items-center gap-4">
                    <div className="w-14 h-14 bg-gradient-to-br from-primary to-blue-600 rounded-2xl flex items-center justify-center text-white shadow-lg">
                        <ShieldCheck className="w-8 h-8" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-black text-slate-900">Fatura {data.billing.workspace_name || "Plus Mídia"}</h1>
                        <p className="text-sm font-bold text-slate-400">{client?.name || "Cliente"}</p>
                    </div>
                </div>
            </header>

            <main className="max-w-3xl mx-auto px-6 py-12">
                <Card className="border-none shadow-2xl shadow-slate-200/50 bg-white rounded-[40px] overflow-hidden">
                    <CardHeader className="bg-gradient-to-br from-primary/5 to-blue-50 border-b p-8">
                        <div className="flex justify-between items-start">
                            <div>
                                <CardTitle className="text-3xl font-black text-slate-900 mb-2">
                                    {billing.description || `Fatura de ${format(new Date(billing.due_date + 'T12:00:00'), "MMMM/yyyy", { locale: ptBR })}`}
                                </CardTitle>
                                <CardDescription className="text-base font-bold text-slate-600">
                                    Vencimento: {format(new Date(billing.due_date + 'T12:00:00'), "dd/MM/yyyy")}
                                </CardDescription>
                            </div>
                            <Badge className={isPaid ? "bg-emerald-100 text-emerald-700 border-emerald-200" : "bg-amber-100 text-amber-700 border-amber-200"}>
                                {isPaid ? "PAGO" : "PENDENTE"}
                            </Badge>
                        </div>
                    </CardHeader>

                    <CardContent className="p-8">
                        <div className="mb-8">
                            <p className="text-sm font-bold text-slate-500 uppercase tracking-widest mb-2">Valor Total</p>
                            <p className="text-5xl font-black text-slate-900">
                                {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(billing.final_amount)}
                            </p>
                        </div>

                        {isPaid ? (
                            <div className="bg-emerald-50 border-2 border-emerald-200 rounded-2xl p-6 text-center">
                                <CheckCircle className="w-16 h-16 text-emerald-500 mx-auto mb-3" />
                                <h3 className="text-2xl font-black text-emerald-900">Pagamento Confirmado</h3>
                                <p className="text-emerald-700 font-bold mt-2">
                                    Pago em {(() => {
                                        if (!billing.payment_date) return "Confirmado";
                                        const date = new Date(billing.payment_date);
                                        return isNaN(date.getTime()) ? "Confirmado" : format(date, "dd/MM/yyyy");
                                    })()}
                                </p>
                            </div>
                        ) : (
                            <Dialog open={isPaymentOpen} onOpenChange={(open) => {
                                setIsPaymentOpen(open);
                                if (!open) {
                                    setPaymentMode('options');
                                    setShowDataCollection(false);
                                    stopPolling();
                                }
                            }}>
                                <DialogTrigger asChild>
                                    <Button className="w-full h-16 bg-primary hover:bg-primary/90 text-white font-black text-xl rounded-2xl shadow-xl shadow-primary/30">
                                        PAGAR AGORA
                                    </Button>
                                </DialogTrigger>
                                <DialogContent className="sm:max-w-lg p-0 rounded-[32px] border-none overflow-hidden shadow-2xl max-h-[90vh] overflow-y-auto">
                                    {!showDataCollection && paymentMode === 'options' && (
                                        <div className="p-10 space-y-8 bg-white">
                                            <div className="text-center space-y-2"><h2 className="text-3xl font-black text-slate-900">Checkout Seguro</h2><p className="text-slate-400 font-bold uppercase text-[10px] tracking-[0.2em]">Selecione o método de pagamento</p></div>
                                            <div className="grid gap-4">
                                                {(() => {
                                                    const methodsParam = searchParams.get("methods");
                                                    const allowed = methodsParam ? methodsParam.split(",") : ["pix", "card"];

                                                    return (
                                                        <>
                                                            {allowed.includes('pix') && (
                                                                <button onClick={() => validateAndProceed('pix')} className="flex items-center gap-6 p-6 rounded-[24px] border-2 border-slate-50 hover:border-emerald-500/30 hover:bg-emerald-50/50 transition-all text-left">
                                                                    <div className="w-14 h-14 bg-emerald-500 rounded-2xl flex items-center justify-center text-white"><QrCode className="w-7 h-7" /></div>
                                                                    <div><p className="font-black text-slate-900 text-lg">PIX</p><p className="text-xs font-bold text-slate-400">Pagamento instantâneo</p></div>
                                                                </button>
                                                            )}
                                                            {allowed.includes('card') && (
                                                                <button onClick={() => validateAndProceed('credit_card')} className="flex items-center gap-6 p-6 rounded-[24px] border-2 border-slate-50 hover:border-blue-500/30 hover:bg-blue-50/50 transition-all text-left">
                                                                    <div className="w-14 h-14 bg-blue-500 rounded-2xl flex items-center justify-center text-white"><CreditCard className="w-7 h-7" /></div>
                                                                    <div><p className="font-black text-slate-900 text-lg">Cartão de Crédito</p><p className="text-xs font-bold text-slate-400">Aprovação imediata</p></div>
                                                                </button>
                                                            )}

                                                        </>
                                                    );
                                                })()}
                                            </div>
                                        </div>
                                    )}
                                    {showDataCollection && (
                                        <div className="p-10 space-y-6 bg-white">
                                            <div className="flex items-center gap-4">
                                                <Button variant="ghost" className="rounded-full h-10 w-10 p-0 text-slate-600 hover:bg-slate-100" onClick={() => setShowDataCollection(false)}>←</Button>
                                                <h2 className="text-2xl font-black text-slate-900">Complete seus Dados</h2>
                                            </div>
                                            <form onSubmit={handleDataCollectionSubmit} className="space-y-4">
                                                <div>
                                                    <Label className="text-slate-700 font-semibold">CPF/CNPJ*</Label>
                                                    <Input value={extraFormData.document} onChange={(e) => setExtraFormData({ ...extraFormData, document: e.target.value })} placeholder="000.000.000-00" className="h-12 rounded-xl bg-white border-slate-200 text-slate-900 placeholder:text-slate-400" />
                                                </div>
                                                {pendingMethod === 'credit_card' && (
                                                    <>
                                                        <div className="grid grid-cols-2 gap-4">
                                                            <div>
                                                                <Label className="text-slate-700 font-semibold">CEP*</Label>
                                                                <Input value={extraFormData.zip_code} onChange={(e) => setExtraFormData({ ...extraFormData, zip_code: e.target.value })} className="h-12 rounded-xl bg-white border-slate-200 text-slate-900 placeholder:text-slate-400" />
                                                            </div>
                                                            <div>
                                                                <Label className="text-slate-700 font-semibold">Número*</Label>
                                                                <Input value={extraFormData.number} onChange={(e) => setExtraFormData({ ...extraFormData, number: e.target.value })} className="h-12 rounded-xl bg-white border-slate-200 text-slate-900 placeholder:text-slate-400" />
                                                            </div>
                                                        </div>
                                                        <div>
                                                            <Label className="text-slate-700 font-semibold">Rua*</Label>
                                                            <Input value={extraFormData.street} onChange={(e) => setExtraFormData({ ...extraFormData, street: e.target.value })} className="h-12 rounded-xl bg-white border-slate-200 text-slate-900 placeholder:text-slate-400" />
                                                        </div>
                                                        <div>
                                                            <Label className="text-slate-700 font-semibold">Bairro*</Label>
                                                            <Input value={extraFormData.neighborhood} onChange={(e) => setExtraFormData({ ...extraFormData, neighborhood: e.target.value })} className="h-12 rounded-xl bg-white border-slate-200 text-slate-900 placeholder:text-slate-400" />
                                                        </div>
                                                        <div className="grid grid-cols-2 gap-4">
                                                            <div>
                                                                <Label className="text-slate-700 font-semibold">Cidade*</Label>
                                                                <Input value={extraFormData.city} onChange={(e) => setExtraFormData({ ...extraFormData, city: e.target.value })} className="h-12 rounded-xl bg-white border-slate-200 text-slate-900 placeholder:text-slate-400" />
                                                            </div>
                                                            <div>
                                                                <Label className="text-slate-700 font-semibold">Estado*</Label>
                                                                <Input value={extraFormData.state} onChange={(e) => setExtraFormData({ ...extraFormData, state: e.target.value })} maxLength={2} className="h-12 rounded-xl bg-white border-slate-200 text-slate-900 placeholder:text-slate-400" />
                                                            </div>
                                                        </div>
                                                    </>
                                                )}
                                                <Button type="submit" className="w-full h-14 bg-primary text-white font-black rounded-xl">CONTINUAR</Button>
                                            </form>
                                        </div>
                                    )}
                                    {paymentMode === 'card' && (
                                        <div className="p-10 space-y-6 bg-white">
                                            <div className="flex items-center gap-4">
                                                <Button variant="ghost" className="rounded-full h-10 w-10 p-0 text-slate-600 hover:bg-slate-100" onClick={() => setPaymentMode('options')}>←</Button>
                                                <h2 className="text-2xl font-black text-slate-900">Dados do Cartão</h2>
                                            </div>
                                            <div className="space-y-4">
                                                <div>
                                                    <Label className="text-xs uppercase font-bold text-slate-600 tracking-wider">Número do Cartão</Label>
                                                    <Input placeholder="0000 0000 0000 0000" className="h-14 rounded-2xl bg-white border-slate-200 text-slate-900 placeholder:text-slate-400 text-lg tracking-wider" value={cardData.number} onChange={(e) => setCardData({ ...cardData, number: e.target.value.replace(/\D/g, "").replace(/(.{4})/g, "$1 ").trim() })} />
                                                </div>
                                                <div>
                                                    <Label className="text-xs uppercase font-bold text-slate-600 tracking-wider">Nome no Cartão</Label>
                                                    <Input placeholder="NOME COMPLETO" className="h-14 rounded-2xl bg-white border-slate-200 text-slate-900 placeholder:text-slate-400 font-bold uppercase" value={cardData.holder} onChange={(e) => setCardData({ ...cardData, holder: e.target.value.toUpperCase() })} />
                                                </div>
                                                <div className="grid grid-cols-2 gap-4">
                                                    <div>
                                                        <Label className="text-xs uppercase font-bold text-slate-600 tracking-wider">Validade</Label>
                                                        <Input placeholder="MM/AA" className="h-14 rounded-2xl bg-white border-slate-200 text-slate-900 placeholder:text-slate-400 text-center text-lg" value={cardData.expiry} onChange={(e) => setCardData({ ...cardData, expiry: e.target.value.replace(/\D/g, "").replace(/(\d{2})/, "$1/") })} />
                                                    </div>
                                                    <div>
                                                        <Label className="text-xs uppercase font-bold text-slate-600 tracking-wider">CVV</Label>
                                                        <Input type="password" placeholder="123" maxLength={4} className="h-14 rounded-2xl bg-white border-slate-200 text-slate-900 placeholder:text-slate-400 text-center text-lg" value={cardData.cvv} onChange={(e) => setCardData({ ...cardData, cvv: e.target.value.replace(/\D/g, "") })} />
                                                    </div>
                                                </div>
                                                <div>
                                                    <Label className="text-xs uppercase font-bold text-slate-600 tracking-wider">Parcelas</Label>
                                                    <Select value={cardData.installments} onValueChange={(v) => setCardData({ ...cardData, installments: v })}>
                                                        <SelectTrigger className="h-14 rounded-2xl bg-white border-slate-200 text-slate-900"><SelectValue /></SelectTrigger>
                                                        <SelectContent className="bg-white border-slate-200 max-h-[300px]">
                                                            {installmentOptions.map((opt) => (
                                                                <SelectItem key={opt.installments} value={String(opt.installments)} className="text-slate-900 py-3 block">
                                                                    <span className="font-bold text-base block">{opt.installments}x de {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(opt.amount)}</span>
                                                                    {opt.hasInterest ? (
                                                                        <span className="text-xs text-slate-500 font-semibold block">Total: {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(opt.total)}</span>
                                                                    ) : (
                                                                        <span className="text-xs text-emerald-600 font-bold block">Sem juros</span>
                                                                    )}
                                                                </SelectItem>
                                                            ))}
                                                        </SelectContent>
                                                    </Select>
                                                </div>

                                                {billing.type === 'contract' && !billing.pagarme_subscription_id && (
                                                    <div className="flex items-center space-x-3 p-4 bg-blue-50 rounded-2xl border border-blue-100 select-none cursor-pointer" onClick={() => setIsSubscription(!isSubscription)}>
                                                        <Checkbox
                                                            id="recurrence"
                                                            checked={isSubscription}
                                                            onCheckedChange={(checked) => setIsSubscription(!!checked)}
                                                            className="border-blue-300 data-[state=checked]:bg-blue-600 data-[state=checked]:border-blue-600"
                                                        />
                                                        <div className="space-y-0.5">
                                                            <Label htmlFor="recurrence" className="text-sm font-black text-blue-900 cursor-pointer">
                                                                Ativar cobrança automática
                                                            </Label>
                                                            <p className="text-[10px] font-bold text-blue-600 uppercase tracking-tighter">Próximas mensalidades serão cobradas neste cartão</p>
                                                        </div>
                                                    </div>
                                                )}

                                                {billing.pagarme_subscription_id && (
                                                    <div className="flex items-center gap-3 p-4 bg-emerald-50 rounded-2xl border border-emerald-100">
                                                        <ShieldCheck className="w-5 h-5 text-emerald-500" />
                                                        <p className="text-sm font-bold text-emerald-800">Assinatura ativa vinculada a este contrato</p>
                                                    </div>
                                                )}

                                                <Button onClick={handleCardPayment} disabled={generating} className="w-full h-16 bg-primary hover:bg-primary/90 text-white font-black text-xl rounded-2xl shadow-lg shadow-primary/30">
                                                    {generating ? <Loader2 className="animate-spin" /> : "FINALIZAR PAGAMENTO"}
                                                </Button>
                                            </div>
                                        </div>
                                    )}
                                    {paymentMode === 'pix' && (
                                        <div className="p-10 space-y-8 bg-white text-center">
                                            <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mx-auto"><QrCode className="w-10 h-10 text-emerald-500" /></div>
                                            <div>
                                                <h2 className="text-3xl font-black">Escaneie o QR Code</h2>
                                                <p className="text-slate-500 font-bold">Pagamento na hora!</p>
                                                <p className="text-xs text-slate-400 mt-2 animate-pulse">🔄 Verificando pagamento automaticamente...</p>
                                            </div>
                                            {(() => {
                                                const qrUrl = lastSuccessData?.charges?.[0]?.last_transaction?.qr_code_url || invoice?.pix_qr_code_url;
                                                const qrCode = lastSuccessData?.charges?.[0]?.last_transaction?.qr_code || invoice?.pix_copy_paste;
                                                if (generating) return <div className="py-10"><Loader2 className="w-10 h-10 animate-spin mx-auto text-primary" /><p className="text-sm font-bold text-slate-400 mt-4">Gerando QR Code...</p></div>;
                                                if (!qrUrl) return <div className="bg-red-50 p-6 rounded-2xl"><p className="font-bold text-red-500">Erro ao gerar PIX</p><Button variant="link" onClick={() => processPayment('pix')}>Tentar Novamente</Button></div>;
                                                return (
                                                    <>
                                                        <div className="bg-slate-50 p-6 rounded-[32px] border">
                                                            <img src={qrUrl} className="w-56 h-56 mx-auto" alt="QR Code" />
                                                        </div>
                                                        <div className="space-y-3">
                                                            <div className="p-4 bg-slate-100 rounded-xl">
                                                                <p className="font-mono text-xs text-slate-500 break-all line-clamp-2">{qrCode}</p>
                                                            </div>
                                                            <Button className="w-full h-16 bg-emerald-500 hover:bg-emerald-600 font-black rounded-2xl gap-3" onClick={() => { navigator.clipboard.writeText(qrCode || ""); toast.success("Copiado!"); }}>
                                                                <Copy className="w-5 h-5" />COPIAR CÓDIGO
                                                            </Button>
                                                        </div>
                                                    </>
                                                );
                                            })()}
                                        </div>
                                    )}

                                    {paymentMode === 'success' && (
                                        <div className="p-10 space-y-6 bg-white text-center">
                                            <div className="w-24 h-24 bg-emerald-500 rounded-full flex items-center justify-center mx-auto shadow-2xl"><CheckCircle className="w-12 h-12 text-white" /></div>
                                            <div><h2 className="text-3xl font-black">Pagamento Confirmado!</h2><p className="text-slate-500">Sua fatura foi baixada com sucesso.</p></div>
                                            <Button className="w-full h-16 bg-slate-100 hover:bg-slate-200 rounded-2xl font-black" onClick={() => window.location.reload()}>VOLTAR</Button>
                                        </div>
                                    )}
                                </DialogContent>
                            </Dialog>
                        )}
                    </CardContent>
                </Card>
            </main>

            <footer className="bg-slate-900 py-8 mt-20 text-center">
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Plataforma de Gestão Plus Mídia GPM Nexus</p>
                <div className="flex items-center justify-center gap-2 text-slate-400 font-bold text-xs mt-2">
                    <ShieldCheck className="w-3 h-3" /> Transações 100% Criptografadas
                </div>
            </footer>
        </div>
    );
}
