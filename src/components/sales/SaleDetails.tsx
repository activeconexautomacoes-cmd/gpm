import {
    Sheet,
    SheetContent,
    SheetHeader,
    SheetTitle,
    SheetDescription,
} from "@/components/ui/sheet";
import { Sale } from "./types";
import { formatCurrency } from "@/utils/format";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Calendar, User, Building2, Wallet, Users, ShoppingBag, FileText, CheckCircle2, Clock, CreditCard } from "lucide-react";

interface SaleDetailsProps {
    sale: Sale | null;
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export function SaleDetails({ sale, open, onOpenChange }: SaleDetailsProps) {
    if (!sale) return null;

    return (
        <Sheet open={open} onOpenChange={onOpenChange}>
            <SheetContent className="w-[400px] sm:w-[540px] overflow-y-auto">
                <SheetHeader className="pb-6 border-b">
                    <div className="flex items-start justify-between">
                        <div className="space-y-1">
                            <SheetTitle className="text-xl font-bold flex items-center gap-2">
                                Venda #{sale.opportunity_id.substring(0, 8)}
                            </SheetTitle>
                            <SheetDescription>
                                Realizada em {format(new Date(sale.won_at), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                            </SheetDescription>
                        </div>
                        <Badge variant={sale.payment_status === 'paid' ? 'default' : 'outline'} className={sale.payment_status === 'paid' ? 'bg-emerald-600' : ''}>
                            {sale.payment_status === 'paid' ? 'PAGO' : 'PENDENTE'}
                        </Badge>
                    </div>
                </SheetHeader>

                <div className="py-6 space-y-8">
                    {/* CLIENTE */}
                    <section className="space-y-4">
                        <h3 className="text-xs font-black uppercase tracking-widest text-slate-400 flex items-center gap-2">
                            <User className="h-4 w-4" /> Cliente & Empresa
                        </h3>
                        <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 flex items-center gap-4">
                            <Avatar className="h-12 w-12 border-2 border-white shadow-sm">
                                <AvatarFallback className="bg-indigo-100 text-indigo-700 text-lg font-bold">
                                    {(sale.company_name || sale.client_name).substring(0, 1).toUpperCase()}
                                </AvatarFallback>
                            </Avatar>
                            <div>
                                <h4 className="font-bold text-slate-900">{sale.company_name}</h4>
                                <p className="text-sm text-slate-500">{sale.client_name}</p>
                                <div className="flex items-center gap-2 mt-2">
                                    <Badge variant="secondary" className="text-[10px] h-5 bg-white border border-slate-200">
                                        ID: {sale.client_id?.substring(0, 8)}
                                    </Badge>
                                </div>
                            </div>
                        </div>
                    </section>

                    {/* EQUIPE */}
                    <section className="space-y-4">
                        <h3 className="text-xs font-black uppercase tracking-widest text-slate-400 flex items-center gap-2">
                            <Users className="h-4 w-4" /> Time de Vendas
                        </h3>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="p-3 bg-white border border-slate-100 rounded-lg">
                                <p className="text-[10px] text-slate-400 uppercase font-bold mb-1">SDR Responsável</p>
                                <p className="font-medium text-slate-800 text-sm">{sale.sdr_name || "Não informado"}</p>
                            </div>
                            <div className="p-3 bg-white border border-slate-100 rounded-lg">
                                <p className="text-[10px] text-slate-400 uppercase font-bold mb-1">Closer Responsável</p>
                                <p className="font-medium text-slate-800 text-sm">{sale.closer_name || "Não informado"}</p>
                            </div>
                        </div>
                    </section>

                    {/* PRODUTOS E VALORES */}
                    <section className="space-y-4">
                        <div className="flex items-center justify-between">
                            <h3 className="text-xs font-black uppercase tracking-widest text-slate-400 flex items-center gap-2">
                                <ShoppingBag className="h-4 w-4" /> Produtos Adquiridos
                            </h3>
                            <Badge variant="outline" className="text-indigo-600 border-indigo-100 bg-indigo-50">
                                {sale.sale_type}
                            </Badge>
                        </div>

                        <div className="border rounded-xl overflow-hidden">
                            <div className="bg-slate-50/50 p-3 border-b text-xs font-medium text-slate-500 flex justify-between">
                                <span>Item</span>
                                <span>Valor Negociado</span>
                            </div>
                            <div className="divide-y">
                                {sale.products.map((p, i) => (
                                    <div key={i} className="p-3 flex items-center justify-between text-sm bg-white">
                                        <div>
                                            <span className="font-semibold text-slate-800">{p.name}</span>
                                            <div className="flex gap-2 text-[10px] text-slate-400 mt-0.5">
                                                <span>{p.recurrence === 'one_time' ? 'Pagamento Único' : 'Recorrente'}</span>
                                                {Number(p.impl_fee) > 0 && <span className="text-emerald-600 font-bold">+ Setup {formatCurrency(p.impl_fee)}</span>}
                                            </div>
                                        </div>
                                        <span className="font-mono">{formatCurrency(p.value)}</span>
                                    </div>
                                ))}
                            </div>
                            <div className="bg-slate-50 p-3 border-t flex items-center justify-between">
                                <span className="font-bold text-sm text-slate-700">Total da Venda</span>
                                <span className="font-black text-lg text-indigo-700">{formatCurrency(sale.total_value)}</span>
                            </div>
                        </div>
                    </section>

                    {/* FINANCEIRO */}
                    <section className="space-y-4">
                        <h3 className="text-xs font-black uppercase tracking-widest text-slate-400 flex items-center gap-2">
                            <Wallet className="h-4 w-4" /> Detalhes Financeiros
                        </h3>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <p className="text-[10px] text-slate-500 uppercase font-bold mb-0.5">Método de Pagamento</p>
                                <div className="flex items-center gap-2">
                                    <CreditCard className="h-4 w-4 text-slate-400" />
                                    <span className="text-sm font-medium capitalize">{sale.payment_method?.replace("_", " ") || "Não informado"}</span>
                                </div>
                            </div>
                            <div>
                                <p className="text-[10px] text-slate-500 uppercase font-bold mb-0.5">Duração Contrato</p>
                                <div className="flex items-center gap-2">
                                    <Clock className="h-4 w-4 text-slate-400" />
                                    <span className="text-sm font-medium">{sale.contract_duration || "Indeterminado"}</span>
                                </div>
                            </div>
                            <div className="col-span-2 pt-2 border-t mt-2">
                                <div className="flex items-center gap-2">
                                    {sale.is_signed ? (
                                        <div className="flex items-center gap-2 text-emerald-600 text-xs font-bold bg-emerald-50 px-3 py-1.5 rounded-full border border-emerald-100">
                                            <CheckCircle2 className="h-4 w-4" /> Contrato Assinado
                                        </div>
                                    ) : (
                                        <div className="flex items-center gap-2 text-amber-600 text-xs font-bold bg-amber-50 px-3 py-1.5 rounded-full border border-amber-100">
                                            <Clock className="h-4 w-4" /> Aguardando Assinatura
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </section>
                </div>
            </SheetContent>
        </Sheet>
    );
}
