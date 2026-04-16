import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, CreditCard, CheckCircle, Clock, AlertCircle, ExternalLink, QrCode, FileText, Copy, RefreshCw, Wallet, ShieldCheck, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Checkbox } from "@/components/ui/checkbox";

// SDK Pagar.me V5
declare global { interface Window { PagarMe: any; } }

export default function ClientPortal() {
    const { token } = useParams();
    const [loading, setLoading] = useState(true);
    const [data, setData] = useState<any>(null);
    const [generating, setGenerating] = useState(false);
    const [paymentMode, setPaymentMode] = useState<'options' | 'card' | 'pix' | 'success'>('options');
    const [selectedItem, setSelectedItem] = useState<any>(null);
    const [lastSuccessData, setLastSuccessData] = useState<any>(null);

    // Form States
    const [cardData, setCardData] = useState({ number: "", holder: "", expiry: "", cvv: "", installments: "1" });
    const [isSubscription, setIsSubscription] = useState(false);

    // Data Collection State
    const [showDataCollection, setShowDataCollection] = useState(false);
    const [pendingMethod, setPendingMethod] = useState<'pix' | 'credit_card' | null>(null);
    const [extraFormData, setExtraFormData] = useState({
        document: "",
        zip_code: "",
        street: "",
        number: "",
        neighborhood: "",
        city: "",
        state: "",
        complement: ""
    });

    const fetchData = async () => {
        try {
            const { data: res, error } = await supabase.functions.invoke('client-portal-data', { body: { token } });
            if (error) throw error;
            setData(res);
        } catch (error) { toast.error("Erro ao carregar os dados."); } finally { setLoading(false); }
    };

    useEffect(() => {
        if (token) fetchData();
    }, [token]);

    const getInvoice = (id: string, type: string) => data?.invoices?.find((inv: any) => type === 'contract' ? inv.contract_billing_id === id : inv.one_time_sale_id === id);

    // Helper: Validates if we have necessary info. If not, prompts user.
    const validateAndProceed = (method: 'pix' | 'credit_card') => {
        const client = data?.client || {};
        const cleanDoc = (client.document || "").replace(/\D/g, "");
        const needsDoc = !cleanDoc || cleanDoc.length < 11;

        // Address is mandatory for Credit Card in Pagar.me V5 (and good practice for others)
        const hasAddress = client.zip_code && client.street && client.number && client.city && client.state;
        const needsAddress = method === 'credit_card' && !hasAddress;

        if (needsDoc || needsAddress) {
            setPendingMethod(method);

            // Pre-fill what we have
            setExtraFormData({
                document: client.document || "",
                zip_code: client.zip_code || "",
                street: client.street || "",
                number: client.number || "",
                neighborhood: client.neighborhood || "",
                city: client.city || "",
                state: client.state || "",
                complement: client.complement || ""
            });

            setShowDataCollection(true);
        } else {
            // All good, proceed directly
            if (method === 'credit_card') setPaymentMode('card');
            else processPayment(method);
        }
    };

    const handleDataCollectionSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!pendingMethod) return;

        // Basic validation
        if (!extraFormData.document) return toast.error("CPF/CNPJ é obrigatório.");
        if (pendingMethod === 'credit_card') {
            if (!extraFormData.zip_code || !extraFormData.street || !extraFormData.number || !extraFormData.city || !extraFormData.state) {
                return toast.error("Endereço completo é obrigatório para cartão.");
            }
        }

        setShowDataCollection(false);

        if (pendingMethod === 'credit_card') {
            setPaymentMode('card');
        } else {
            processPayment(pendingMethod, { customer_extra: extraFormData });
        }
    };

    const processPayment = async (method: 'pix' | 'credit_card', additionalPayload = {}) => {
        setGenerating(true);
        setLastSuccessData(null);
        try {
            const isSale = !selectedItem.contracts;
            const payload: any = {
                billing_id: selectedItem.id,
                type: isSale ? 'sale' : 'contract',
                payment_method: method,
                // Merge extra data if collected previously
                customer_extra: extraFormData,
                ...additionalPayload
            };

            const { data: res, error } = await supabase.functions.invoke('pagarme-billing', { body: payload });

            console.log("📦 Retorno do Backend:", res);

            if (error) throw error;

            if (!res.success) {
                let errorDetails = res.error || "Erro desconhecido no backend.";
                if (res.details) {
                    if (res.details.message) errorDetails = res.details.message;
                    if (res.details.errors) {
                        const validations = Object.entries(res.details.errors)
                            .map(([key, msgs]: any) => `${key}: ${msgs.join(', ')}`)
                            .join(' | ');
                        errorDetails += ` -> ${validations}`;
                    }
                }
                throw new Error(errorDetails);
            }

            // CRITICAL: Check if transaction FAILED
            if (res.order?.status === 'failed') {
                const charges = res.order.charges || [];
                const firstError = charges[0]?.last_transaction?.gateway_response?.errors?.[0]?.message;
                const failReason = firstError || "Pagamento recusado pela operadora ou dados inválidos.";
                throw new Error(`Falha no Pagamento: ${failReason}`);
            }

            setLastSuccessData(res.order);

            if (method === 'credit_card') {
                const charge = res.order?.charges?.[0];
                const lastTrans = charge?.last_transaction;
                if (lastTrans && !lastTrans.success) {
                    throw new Error(lastTrans.gateway_response?.message || "Pagamento recusado pela operadora.");
                }
            }

            if (res.status === 'paid' || res.order?.status === 'paid') {
                setPaymentMode('success');
                toast.success("Pagamento aprovado!");
                fetchData();
            } else {
                setPaymentMode(method === 'pix' ? 'pix' : 'options');
                fetchData();
            }
        } catch (error: any) {
            console.error("❌ Erro ProcessPayment:", error);
            let errorMsg = error.message || "Erro ao processar pagamento.";
            if (errorMsg.includes("action_forbidden") || errorMsg.includes("Sem ambiente configurado")) {
                errorMsg = "ERRO DE CONFIGURAÇÃO: O PIX não está ativado na sua conta Pagar.me (Dash > Configurações > Meios de Pagamento). Ative-o para receber.";
            }
            if (errorMsg.includes("Invalid CPF")) errorMsg = "O CPF informado é inválido.";
            toast.error(errorMsg, { duration: 8000 });
        } finally { setGenerating(false); }
    };

    const handleCardPayment = async () => {
        setGenerating(true);
        try {
            const [month, year] = cardData.expiry.replace(/\s/g, "").split("/");
            if (!month || !year) throw new Error("Validade inválida (MM/AA)");

            console.log("📤 Processando pagamento via Backend Segura...");

            await processPayment('credit_card', {
                card: {
                    number: cardData.number.replace(/\D/g, ""),
                    holder_name: cardData.holder,
                    exp_month: parseInt(month, 10),
                    exp_year: parseInt("20" + year, 10),
                    cvv: cardData.cvv
                },
                installments: parseInt(cardData.installments),
                customer_extra: extraFormData,
                is_subscription: isSubscription
            });

        } catch (e: any) {
            console.error("Erro Cartão:", e);
            toast.error(e.message || "Dados do cartão inválidos ou recusados.");
            setGenerating(false);
        }
    };

    if (loading) return <div className="min-h-screen flex items-center justify-center bg-slate-50"><Loader2 className="h-10 w-10 animate-spin text-primary" /></div>;

    // Combine billings and sales, sort by due date
    const pending = [...(data?.billings?.filter((b: any) => b.status !== 'paid') || []), ...(data?.sales?.filter((s: any) => s.status !== 'paid') || [])].sort((a, b) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime());
    const paid = [...(data?.billings?.filter((b: any) => b.status === 'paid') || []), ...(data?.sales?.filter((s: any) => s.status === 'paid') || [])].sort((a, b) => new Date(b.payment_date || b.updated_at).getTime() - new Date(a.payment_date || a.updated_at).getTime());
    const totalPending = pending.reduce((acc, curr) => acc + (curr.final_amount || curr.amount || 0), 0);
    const clientName = data?.client?.name || "Cliente";

    return (
        <div className="min-h-screen bg-slate-50 pb-20 selection:bg-primary selection:text-white">
            <header className="bg-white/80 backdrop-blur-md sticky top-0 z-20 border-b border-slate-200/60">
                <div className="max-w-5xl mx-auto px-6 py-4 flex justify-between items-center">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-gradient-to-br from-primary to-blue-600 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-primary/20"><ShieldCheck className="w-7 h-7" /></div>
                        <div>
                            <h1 className="text-xl font-black text-slate-900 tracking-tight">Portal Plus Mídia</h1>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{clientName}</p>
                        </div>
                    </div>
                </div>
            </header>

            <main className="max-w-5xl mx-auto px-6 mt-10 space-y-10">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <Card className="border-none shadow-xl shadow-slate-200/50 bg-white rounded-3xl p-2">
                        <CardHeader><CardDescription className="text-xs font-bold uppercase tracking-widest text-slate-400">Total em Aberto</CardDescription>
                            <CardTitle className="text-4xl font-black text-slate-900">{new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(totalPending)}</CardTitle></CardHeader>
                    </Card>
                    <Card className="border-none shadow-xl shadow-slate-200/50 bg-white rounded-3xl p-2">
                        <CardHeader><CardDescription className="text-xs font-bold uppercase tracking-widest text-orange-400">Faturas Pendentes</CardDescription>
                            <CardTitle className="text-4xl font-black text-slate-900">{pending.length}</CardTitle></CardHeader>
                    </Card>
                    <Card className="border-none shadow-xl shadow-slate-200/50 bg-emerald-500 rounded-3xl p-2 text-white">
                        <CardHeader><CardDescription className="text-xs font-bold uppercase tracking-widest text-emerald-100">Status da Conta</CardDescription>
                            <CardTitle className="text-4xl font-black">ATIVA</CardTitle></CardHeader>
                    </Card>
                </div>

                <Tabs defaultValue="pending">
                    <TabsList className="bg-slate-200/40 p-1.5 h-auto rounded-2xl mb-8">
                        <TabsTrigger value="pending" className="px-10 py-3 rounded-xl font-black text-sm data-[state=active]:bg-white data-[state=active]:shadow-lg">PENDENTES</TabsTrigger>
                        <TabsTrigger value="history" className="px-10 py-3 rounded-xl font-black text-sm">HISTÓRICO</TabsTrigger>
                    </TabsList>

                    <TabsContent value="pending" className="space-y-6">
                        {pending.length === 0 ? (
                            <div className="text-center py-24 bg-white rounded-[40px] shadow-sm border-2 border-dashed border-slate-200">
                                <CheckCircle className="w-20 h-20 text-emerald-400 mx-auto mb-6" />
                                <h3 className="text-2xl font-black text-slate-900">Parabéns! Suas contas estão em dia.</h3>
                            </div>
                        ) : pending.map((item: any) => {
                            const isSale = !item.contracts;
                            const invoice = getInvoice(item.id, isSale ? 'sale' : 'contract');
                            return (
                                <Card key={item.id} className="border-none shadow-xl shadow-slate-200/40 bg-white rounded-[32px] overflow-hidden group hover:scale-[1.01] transition-transform">
                                    <div className="p-8 flex flex-col md:flex-row md:items-center justify-between gap-8">
                                        <div className="space-y-3">
                                            <Badge className="bg-slate-100 text-slate-500 hover:bg-slate-100 font-black text-[10px] tracking-tighter px-3 border-none">{isSale ? 'PRODUTO/SERVIÇO' : 'MENSALIDADE'}</Badge>
                                            <h3 className="text-2xl font-black text-slate-900 leading-tight">{isSale ? item.description : `Fatura de ${format(new Date(item.due_date), "MMMM", { locale: ptBR })}`}</h3>
                                            <div className="flex items-center gap-6 text-slate-400 font-bold text-sm">
                                                <span className="flex items-center gap-2"><Clock className="w-4 h-4" /> Vence em {format(new Date(item.due_date), "dd/MM/yyyy")}</span>
                                                <span className="flex items-center gap-2"><FileText className="w-4 h-4" /> Ref: {item.id.substring(0, 8)}</span>
                                            </div>
                                        </div>
                                        <div className="flex flex-col md:items-end gap-3">
                                            <p className="text-4xl font-black text-slate-900 tracking-tighter">{new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(item.final_amount || item.amount)}</p>
                                            <Dialog onOpenChange={(o) => {
                                                if (!o) {
                                                    setPaymentMode('options');
                                                    setShowDataCollection(false);
                                                }
                                            }}>
                                                <DialogTrigger asChild><Button className="h-14 px-10 bg-primary hover:bg-primary/90 text-white font-black rounded-2xl shadow-xl shadow-primary/20" onClick={() => setSelectedItem(item)}>PAGAR AGORA</Button></DialogTrigger>
                                                <DialogContent className="sm:max-w-lg p-0 rounded-[32px] border-none overflow-hidden shadow-2xl max-h-[90vh] overflow-y-auto">
                                                    {!showDataCollection && paymentMode === 'options' && (
                                                        <div className="p-10 space-y-8 bg-white">
                                                            <div className="text-center space-y-2"><h2 className="text-3xl font-black text-slate-900">Checkout Seguro</h2><p className="text-slate-400 font-bold uppercase text-[10px] tracking-[0.2em]">Selecione o método de pagamento</p></div>
                                                            <div className="grid gap-4">
                                                                <button onClick={() => validateAndProceed('pix')} className="flex items-center gap-6 p-6 rounded-[24px] border-2 border-slate-50 hover:border-emerald-500/30 hover:bg-emerald-50/50 transition-all text-left">
                                                                    <div className="w-14 h-14 bg-emerald-500 rounded-2xl flex items-center justify-center text-white"><QrCode className="w-7 h-7" /></div>
                                                                    <div><p className="font-black text-slate-900 text-lg">PIX</p><p className="text-xs font-bold text-slate-400">Pagamento instantâneo com desconto</p></div>
                                                                </button>
                                                                <button onClick={() => validateAndProceed('credit_card')} className="flex items-center gap-6 p-6 rounded-[24px] border-2 border-slate-50 hover:border-blue-500/30 hover:bg-blue-50/50 transition-all text-left">
                                                                    <div className="w-14 h-14 bg-blue-500 rounded-2xl flex items-center justify-center text-white"><CreditCard className="w-7 h-7" /></div>
                                                                    <div><p className="font-black text-slate-900 text-lg">Cartão de Crédito</p><p className="text-xs font-bold text-slate-400">Aprovação imediata</p></div>
                                                                </button>

                                                            </div>
                                                        </div>
                                                    )}

                                                    {showDataCollection && (
                                                        <div className="p-10 space-y-6 bg-white animate-in slide-in-from-right duration-300">
                                                            <div className="flex items-center gap-4">
                                                                <Button variant="ghost" className="rounded-full h-10 w-10 p-0 hover:bg-slate-100" onClick={() => setShowDataCollection(false)}>←</Button>
                                                                <h2 className="text-2xl font-black text-slate-900">Complete seus Dados</h2>
                                                            </div>
                                                            <p className="text-sm text-slate-500">Para sua segurança e emissão da nota fiscal, precisamos confirmar algumas informações.</p>

                                                            <form onSubmit={handleDataCollectionSubmit} className="space-y-4">
                                                                <div className="space-y-2">
                                                                    <Label>CPF / CNPJ <span className="text-red-500">*</span></Label>
                                                                    <Input
                                                                        value={extraFormData.document}
                                                                        onChange={(e) => setExtraFormData({ ...extraFormData, document: e.target.value })}
                                                                        placeholder="000.000.000-00"
                                                                        className="h-12 rounded-xl"
                                                                    />
                                                                </div>

                                                                {pendingMethod === 'credit_card' && (
                                                                    <>
                                                                        <div className="grid grid-cols-2 gap-4">
                                                                            <div className="space-y-2">
                                                                                <Label>CEP <span className="text-red-500">*</span></Label>
                                                                                <Input value={extraFormData.zip_code} onChange={(e) => setExtraFormData({ ...extraFormData, zip_code: e.target.value })} placeholder="00000-000" className="h-12 rounded-xl" />
                                                                            </div>
                                                                            <div className="space-y-2">
                                                                                <Label>Número <span className="text-red-500">*</span></Label>
                                                                                <Input value={extraFormData.number} onChange={(e) => setExtraFormData({ ...extraFormData, number: e.target.value })} placeholder="123" className="h-12 rounded-xl" />
                                                                            </div>
                                                                        </div>
                                                                        <div className="space-y-2">
                                                                            <Label>Rua <span className="text-red-500">*</span></Label>
                                                                            <Input value={extraFormData.street} onChange={(e) => setExtraFormData({ ...extraFormData, street: e.target.value })} placeholder="Rua..." className="h-12 rounded-xl" />
                                                                        </div>
                                                                        <div className="grid grid-cols-2 gap-4">
                                                                            <div className="space-y-2">
                                                                                <Label>Cidade <span className="text-red-500">*</span></Label>
                                                                                <Input value={extraFormData.city} onChange={(e) => setExtraFormData({ ...extraFormData, city: e.target.value })} className="h-12 rounded-xl" />
                                                                            </div>
                                                                            <div className="space-y-2">
                                                                                <Label>Estado (UF) <span className="text-red-500">*</span></Label>
                                                                                <Input value={extraFormData.state} onChange={(e) => setExtraFormData({ ...extraFormData, state: e.target.value })} placeholder="SP" maxLength={2} className="h-12 rounded-xl" />
                                                                            </div>
                                                                        </div>
                                                                    </>
                                                                )}

                                                                <Button type="submit" className="w-full h-14 bg-primary text-white font-black rounded-xl mt-4">
                                                                    CONTINUAR PARA PAGAMENTO
                                                                </Button>
                                                            </form>
                                                        </div>
                                                    )}

                                                    {paymentMode === 'card' && (
                                                        <div className="p-10 space-y-6 bg-white animate-in slide-in-from-right duration-300">
                                                            <div className="flex items-center gap-4">
                                                                <Button variant="ghost" className="rounded-full h-10 w-10 p-0 hover:bg-slate-100" onClick={() => setPaymentMode('options')}>←</Button>
                                                                <h2 className="text-2xl font-black text-slate-900">Dados do Cartão</h2>
                                                            </div>
                                                            <div className="space-y-4">
                                                                <div className="space-y-2">
                                                                    <Label className="font-black text-[10px] text-slate-500 uppercase tracking-widest">Número do Cartão</Label>
                                                                    <Input
                                                                        type="text"
                                                                        name="cardnumber"
                                                                        id="cardnumber"
                                                                        autoComplete="cc-number"
                                                                        inputMode="numeric"
                                                                        placeholder="0000 0000 0000 0000"
                                                                        className="h-14 rounded-2xl border-2 border-slate-200 bg-white font-bold text-slate-900 placeholder:text-slate-300 focus:border-primary focus:ring-1 focus:ring-primary transition-all"
                                                                        value={cardData.number}
                                                                        onChange={(e) => setCardData({ ...cardData, number: e.target.value.replace(/\D/g, "").replace(/(.{4})/g, "$1 ").trim() })}
                                                                    />
                                                                </div>
                                                                <div className="space-y-2">
                                                                    <Label className="font-black text-[10px] text-slate-500 uppercase tracking-widest">Nome (como no cartão)</Label>
                                                                    <Input
                                                                        type="text"
                                                                        name="ccname"
                                                                        id="ccname"
                                                                        autoComplete="cc-name"
                                                                        placeholder="DIGITE O NOME"
                                                                        className="h-14 rounded-2xl border-2 border-slate-200 bg-white font-black text-slate-900 placeholder:text-slate-300 focus:border-primary focus:ring-1 focus:ring-primary transition-all"
                                                                        value={cardData.holder}
                                                                        onChange={(e) => setCardData({ ...cardData, holder: e.target.value.toUpperCase() })}
                                                                    />
                                                                </div>
                                                                <div className="grid grid-cols-2 gap-4">
                                                                    <div className="space-y-2">
                                                                        <Label className="font-black text-[10px] text-slate-500 uppercase tracking-widest">Validade</Label>
                                                                        <Input
                                                                            type="text"
                                                                            name="ccexp"
                                                                            id="ccexp"
                                                                            autoComplete="cc-exp"
                                                                            placeholder="MM/AA"
                                                                            className="h-14 rounded-2xl border-2 border-slate-200 bg-white font-bold text-slate-900 text-center placeholder:text-slate-300 focus:border-primary focus:ring-1 focus:ring-primary transition-all"
                                                                            value={cardData.expiry}
                                                                            onChange={(e) => setCardData({ ...cardData, expiry: e.target.value.replace(/\D/g, "").replace(/(\d{2})/, "$1/") })}
                                                                        />
                                                                    </div>
                                                                    <div className="space-y-2">
                                                                        <Label className="font-black text-[10px] text-slate-500 uppercase tracking-widest">CVV</Label>
                                                                        <Input
                                                                            type="password"
                                                                            name="cvc"
                                                                            id="cvc"
                                                                            autoComplete="cc-csc"
                                                                            inputMode="numeric"
                                                                            placeholder="123"
                                                                            className="h-14 rounded-2xl border-2 border-slate-200 bg-white font-bold text-slate-900 text-center placeholder:text-slate-300 focus:border-primary focus:ring-1 focus:ring-primary transition-all"
                                                                            value={cardData.cvv}
                                                                            maxLength={4}
                                                                            onChange={(e) => setCardData({ ...cardData, cvv: e.target.value.replace(/\D/g, "") })}
                                                                        />
                                                                    </div>
                                                                </div>
                                                                <div className="space-y-2">
                                                                    <Label className="font-black text-[10px] text-slate-500 uppercase tracking-widest">Parcelas</Label>
                                                                    <Select onValueChange={(v) => setCardData({ ...cardData, installments: v })} defaultValue="1">
                                                                        <SelectTrigger className="h-14 rounded-2xl border-2 border-slate-200 bg-white font-black text-slate-900 focus:border-primary focus:ring-1 focus:ring-primary transition-all">
                                                                            <SelectValue placeholder="Selecione as parcelas" />
                                                                        </SelectTrigger>
                                                                        <SelectContent className="rounded-2xl border-none shadow-2xl font-bold">
                                                                            <SelectItem value="1">1x à vista (Sem juros)</SelectItem>
                                                                        </SelectContent>
                                                                    </Select>
                                                                </div>

                                                                {selectedItem?.contracts && !selectedItem.contracts.pagarme_subscription_id && (
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

                                                                {selectedItem?.contracts?.pagarme_subscription_id && (
                                                                    <div className="flex items-center gap-3 p-4 bg-emerald-50 rounded-2xl border border-emerald-100">
                                                                        <ShieldCheck className="w-5 h-5 text-emerald-500" />
                                                                        <p className="text-sm font-bold text-emerald-800">Assinatura ativa vinculada a este contrato</p>
                                                                    </div>
                                                                )}

                                                                <Button
                                                                    className="w-full h-16 bg-primary hover:bg-primary/90 text-white font-black text-xl rounded-2xl mt-4 shadow-lg shadow-primary/30 transition-all hover:scale-[1.02] active:scale-[0.98]"
                                                                    onClick={handleCardPayment}
                                                                    disabled={generating}
                                                                >
                                                                    {generating ? <Loader2 className="animate-spin" /> : "FINALIZAR PAGAMENTO"}
                                                                </Button>
                                                            </div>
                                                        </div>
                                                    )}
                                                    {paymentMode === 'pix' && (
                                                        <div className="p-10 space-y-8 bg-white text-center animate-in zoom-in-95 duration-300">
                                                            <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mx-auto"><QrCode className="w-10 h-10 text-emerald-500" /></div>
                                                            <div className="space-y-2">
                                                                <h2 className="text-3xl font-black text-slate-900">Escaneie o QR Code</h2>
                                                                <p className="text-slate-500 font-bold">O pagamento cai na hora!</p>
                                                            </div>

                                                            {(() => {
                                                                const charges = lastSuccessData?.charges || [];
                                                                const charge = charges[0] || {};
                                                                const transaction = charge.last_transaction || {};

                                                                // DEBUG: Inspect FULL JSON to find where the data is hiding
                                                                console.log("🔍 FULL PAGAR.ME RESPONSE:", JSON.stringify(lastSuccessData, null, 2));

                                                                const immediateQr = transaction.qr_code_url || transaction.url || charge.qr_code_url;
                                                                const immediateCode = transaction.qr_code || charge.qr_code;

                                                                const finalQr = immediateQr || invoice?.pix_qr_code_url;
                                                                const finalCode = immediateCode || invoice?.pix_copy_paste;

                                                                if (generating) {
                                                                    return (
                                                                        <div className="flex flex-col items-center justify-center py-10 space-y-4">
                                                                            <Loader2 className="w-10 h-10 animate-spin text-primary" />
                                                                            <p className="text-sm font-bold text-slate-400">Gerando código PIX...</p>
                                                                        </div>
                                                                    );
                                                                }

                                                                if (!finalQr) {
                                                                    return (
                                                                        <div className="bg-red-50 p-6 rounded-2xl border-2 border-red-100 space-y-2">
                                                                            <p className="font-bold text-red-500">O QR Code não foi retornado pela Pagar.me.</p>
                                                                            <div className="text-xs text-left bg-white p-2 rounded border overflow-auto max-h-32">
                                                                                <p className="font-bold mb-1">Status da Cobrança: {charge.status || 'N/A'}</p>
                                                                                <p>Motivo Falha: {transaction.gateway_response?.message || 'N/A'}</p>
                                                                                <p className="font-mono mt-1 text-[10px] text-gray-500">Order ID: {lastSuccessData?.id}</p>
                                                                            </div>
                                                                            <Button variant="link" className="text-red-600 font-bold" onClick={() => processPayment('pix')}>Tentar Novamente</Button>
                                                                        </div>
                                                                    );
                                                                }

                                                                return (
                                                                    <>
                                                                        <div className="bg-slate-50 p-6 rounded-[32px] flex justify-center shadow-inner border border-slate-100 mt-4">
                                                                            <img src={finalQr} className="w-56 h-56 mix-blend-multiply opacity-90" alt="QR Code PIX" />
                                                                        </div>
                                                                        <div className="space-y-3">
                                                                            <div className="p-4 bg-slate-100 rounded-xl relative group">
                                                                                <p className="font-mono text-xs text-slate-500 break-all line-clamp-2 px-2">{finalCode}</p>
                                                                            </div>
                                                                            <Button className="w-full h-16 bg-emerald-500 hover:bg-emerald-600 text-white rounded-2xl font-black gap-3 shadow-lg shadow-emerald-200 transition-all hover:scale-[1.02]" onClick={() => { navigator.clipboard.writeText(finalCode || ""); toast.success("PIX Copiado!"); }}>
                                                                                <Copy className="w-5 h-5" /> COPIAR CÓDIGO PIX
                                                                            </Button>
                                                                        </div>
                                                                    </>
                                                                );
                                                            })()}
                                                        </div>
                                                    )}

                                                    {paymentMode === 'success' && (
                                                        <div className="p-10 space-y-6 bg-white text-center animate-in zoom-in-95 duration-500">
                                                            <div className="w-24 h-24 bg-emerald-500 rounded-full flex items-center justify-center mx-auto shadow-2xl shadow-emerald-200"><CheckCircle className="w-12 h-12 text-white" /></div>
                                                            <div className="space-y-2">
                                                                <h2 className="text-3xl font-black text-slate-900">Pagamento Confirmado!</h2>
                                                                <p className="text-slate-500">Sua fatura foi baixada com sucesso.</p>
                                                            </div>
                                                            <Button className="w-full h-16 bg-slate-100 text-slate-900 hover:bg-slate-200 rounded-2xl font-black" onClick={() => window.location.reload()}>VOLTAR AO HUB</Button>
                                                        </div>
                                                    )}
                                                </DialogContent>
                                            </Dialog>
                                        </div>
                                    </div>
                                </Card>
                            );
                        })}
                    </TabsContent>

                    <TabsContent value="history" className="space-y-6">
                        {paid.length === 0 ? (
                            <div className="text-center py-24 bg-white rounded-[40px] shadow-sm border-2 border-dashed border-slate-200">
                                <FileText className="w-20 h-20 text-slate-300 mx-auto mb-6" />
                                <h3 className="text-2xl font-black text-slate-900">Nenhum pagamento realizado ainda.</h3>
                                <p className="text-slate-400 font-bold mt-2">Seus pagamentos aparecerão aqui.</p>
                            </div>
                        ) : paid.map((item: any) => {
                            const isSale = !item.contracts;
                            const invoice = getInvoice(item.id, isSale ? 'sale' : 'contract');
                            const paymentMethodIcons: any = {
                                pix: QrCode,
                                credit_card: CreditCard,
                                boleto: FileText
                            };
                            const paymentMethodLabels: any = {
                                pix: 'PIX',
                                credit_card: 'Cartão de Crédito'
                            };
                            const PaymentIcon = paymentMethodIcons[invoice?.payment_method] || Wallet;
                            const paymentLabel = paymentMethodLabels[invoice?.payment_method] || 'Pagamento';

                            return (
                                <Card key={item.id} className="border-none shadow-xl shadow-slate-200/40 bg-white rounded-[32px] overflow-hidden">
                                    <div className="p-8">
                                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                                            <div className="space-y-3 flex-1">
                                                <div className="flex items-center gap-3">
                                                    <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100 font-black text-[10px] tracking-tighter px-3 border-none flex items-center gap-1">
                                                        <CheckCircle className="w-3 h-3" /> PAGO
                                                    </Badge>
                                                    <Badge className="bg-slate-100 text-slate-500 hover:bg-slate-100 font-black text-[10px] tracking-tighter px-3 border-none">
                                                        {isSale ? 'PRODUTO/SERVIÇO' : 'MENSALIDADE'}
                                                    </Badge>
                                                </div>
                                                <h3 className="text-2xl font-black text-slate-900 leading-tight">
                                                    {isSale ? item.description : `Fatura de ${format(new Date(item.due_date), "MMMM", { locale: ptBR })}`}
                                                </h3>
                                                <div className="flex flex-wrap items-center gap-4 text-slate-400 font-bold text-sm">
                                                    <span className="flex items-center gap-2">
                                                        <CheckCircle className="w-4 h-4 text-emerald-500" />
                                                        Pago em {format(new Date(item.payment_date || item.updated_at), "dd/MM/yyyy", { locale: ptBR })}
                                                    </span>
                                                    {invoice?.payment_method && (
                                                        <span className="flex items-center gap-2">
                                                            <PaymentIcon className="w-4 h-4" />
                                                            {paymentLabel}
                                                        </span>
                                                    )}
                                                    <span className="flex items-center gap-2">
                                                        <FileText className="w-4 h-4" />
                                                        Ref: {item.id.substring(0, 8)}
                                                    </span>
                                                </div>
                                            </div>
                                            <div className="flex flex-col items-end gap-2">
                                                <p className="text-3xl font-black text-emerald-600 tracking-tighter">
                                                    {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(item.final_amount || item.amount)}
                                                </p>
                                                {invoice?.pagarme_order_id && (
                                                    <p className="text-xs font-bold text-slate-400">
                                                        ID: {invoice.pagarme_order_id.substring(0, 12)}...
                                                    </p>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </Card>
                            );
                        })}
                    </TabsContent>
                </Tabs>
            </main>

            <footer className="bg-slate-900 py-12 mt-20 text-center space-y-6">
                <div className="flex justify-center gap-6 text-[10px] font-bold text-slate-500 tracking-widest">
                    <button className="hover:text-primary transition-colors">CENTRAL DE AJUDA</button>
                    <button className="hover:text-primary transition-colors">WHATSAPP SUPORTE</button>
                    <button className="hover:text-primary transition-colors">TERMOS E PRIVACIDADE</button>
                </div>
                <div className="space-y-2">
                    <p className="text-[10px] font-black text-slate-300 uppercase tracking-[0.4em]">Plataforma de Gestão Plus Mídia GPM Nexus</p>
                    <div className="flex items-center justify-center gap-2 text-slate-300 font-bold text-xs"><ShieldCheck className="w-3 h-3" /> Transações 100% Criptografadas via Pagar.me V5</div>
                </div>
            </footer>
        </div>
    );
}
