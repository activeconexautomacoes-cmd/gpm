import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/utils/format";
import { ChevronDown, ChevronRight, ShoppingBag, CreditCard, Banknote, Calendar } from "lucide-react";
import { useState } from "react";
import { Sale, SalesTableProps } from "./types";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

/**
 * Componente de Linha Expansível
 */
function SaleRow({ sale, onClick }: { sale: Sale; onClick: (s: Sale) => void }) {
    const [isExpanded, setIsExpanded] = useState(false);

    const toggleExpand = (e: React.MouseEvent) => {
        e.stopPropagation();
        setIsExpanded(!isExpanded);
    };

    const statusColors: Record<string, string> = {
        paid: "bg-emerald-100 text-emerald-700 border-emerald-200",
        pending: "bg-amber-100 text-amber-700 border-amber-200",
        overdue: "bg-red-100 text-red-700 border-red-200",
        canceled: "bg-slate-100 text-slate-700 border-slate-200",
    };

    const statusLabels: Record<string, string> = {
        paid: "Pago",
        pending: "Pendente",
        overdue: "Vencido",
        canceled: "Cancelado",
    };

    const typeColors: Record<string, string> = {
        Recorrente: "bg-indigo-100 text-indigo-700 border-indigo-200",
        Avulso: "bg-blue-100 text-blue-700 border-blue-200",
        Misto: "bg-purple-100 text-purple-700 border-purple-200",
    };

    return (
        <>
            <TableRow
                className="cursor-pointer hover:bg-slate-50 transition-colors group"
                onClick={() => onClick(sale)}
            >
                <TableCell className="w-[50px]">
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={toggleExpand}
                    >
                        {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                    </Button>
                </TableCell>

                <TableCell>
                    <Badge className={cn("text-[10px] uppercase font-bold border shadow-none", statusColors[sale.payment_status])}>
                        {statusLabels[sale.payment_status] || sale.payment_status}
                    </Badge>
                </TableCell>

                <TableCell>
                    <div className="flex items-center gap-3">
                        <Avatar className="h-8 w-8 rounded-lg border border-slate-200 bg-white">
                            <AvatarFallback className="bg-white text-indigo-600 font-bold text-xs rounded-lg">
                                {(sale.company_name || sale.client_name || "?").substring(0, 2).toUpperCase()}
                            </AvatarFallback>
                        </Avatar>
                        <div>
                            <div className="font-bold text-sm text-slate-800">{sale.company_name || sale.client_name}</div>
                            {sale.company_name && sale.client_name && sale.company_name !== sale.client_name && (
                                <div className="text-[10px] text-slate-500">{sale.client_name}</div>
                            )}
                        </div>
                    </div>
                </TableCell>

                <TableCell>
                    <div className="flex items-center gap-2">
                        <Badge variant="outline" className={cn("text-[10px] font-medium border", typeColors[sale.sale_type] || "bg-slate-50 text-slate-600")}>
                            {sale.sale_type}
                        </Badge>
                    </div>
                </TableCell>

                <TableCell>
                    <div className="flex flex-col">
                        <span className="text-xs font-medium text-slate-700 flex items-center gap-1.5">
                            {(sale.products || []).length > 1 ? `${sale.products.length} Produtos` : sale.products?.[0]?.name || "Sem Nome"}
                        </span>
                    </div>
                </TableCell>

                <TableCell className="font-mono font-bold text-slate-700">
                    {formatCurrency(sale.total_value)}
                </TableCell>

                <TableCell>
                    <div className="flex items-center gap-1 text-xs text-slate-600 capitalize">
                        {sale.payment_method?.includes("pix") ? <Banknote className="h-3.5 w-3.5 text-emerald-500" /> : <CreditCard className="h-3.5 w-3.5 text-slate-400" />}
                        {sale.payment_method?.replace("_", " ") || "-"}
                    </div>
                </TableCell>

                <TableCell className="text-right text-muted-foreground text-xs">
                    {format(new Date(sale.won_at), "dd/MM/yyyy", { locale: ptBR })}
                </TableCell>
            </TableRow>

            {/* Expanded Row */}
            {isExpanded && (
                <TableRow className="bg-slate-50/50 hover:bg-slate-50/50">
                    <TableCell colSpan={8} className="p-0">
                        <div className="p-4 pl-14 grid gap-2 animate-in slide-in-from-top-2 duration-200">
                            <p className="text-[10px] font-bold uppercase text-slate-400 tracking-wider mb-1">Detalhamento dos Produtos</p>
                            {(sale.products || []).map((prod, idx) => (
                                <div key={idx} className="flex items-center justify-between text-xs border-b border-slate-100 last:border-0 pb-2 last:pb-0">
                                    <div className="flex items-center gap-2">
                                        <ShoppingBag className="h-3.5 w-3.5 text-slate-400" />
                                        <span className="font-medium text-slate-700">{prod.name}</span>
                                        {Number(prod.impl_fee) > 0 && (
                                            <span className="text-[10px] text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded ml-2">+ Impl. {formatCurrency(prod.impl_fee)}</span>
                                        )}
                                    </div>
                                    <span className="font-mono text-slate-600">{formatCurrency(prod.value)}</span>
                                </div>
                            ))}

                            {/* Resumo extra se quiser */}
                            <div className="pt-2 mt-1 border-t border-slate-200 flex justify-end gap-6 text-xs text-slate-500">
                                <span>SDR: <strong className="text-slate-700">{sale.sdr_name || "N/A"}</strong></span>
                                <span>Closer: <strong className="text-slate-700">{sale.closer_name || "N/A"}</strong></span>
                            </div>
                        </div>
                    </TableCell>
                </TableRow>
            )}
        </>
    );
}

export function SalesTable({ sales, isLoading, onSaleClick }: SalesTableProps) {
    if (isLoading) {
        return <div className="p-8 text-center text-muted-foreground text-sm">Carregando vendas...</div>;
    }

    if (sales.length === 0) {
        return <div className="p-12 text-center text-muted-foreground text-sm border-2 border-dashed rounded-xl">Nenhuma venda encontrada.</div>;
    }

    return (
        <div className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-sm">
            <Table>
                <TableHeader className="bg-slate-50">
                    <TableRow>
                        <TableHead className="w-[50px]"></TableHead>
                        <TableHead className="w-[100px] text-xs font-bold uppercase tracking-wider text-slate-500">Status</TableHead>
                        <TableHead className="text-xs font-bold uppercase tracking-wider text-slate-500">Cliente / Empresa</TableHead>
                        <TableHead className="w-[120px] text-xs font-bold uppercase tracking-wider text-slate-500">Tipo</TableHead>
                        <TableHead className="text-xs font-bold uppercase tracking-wider text-slate-500">Produtos</TableHead>
                        <TableHead className="w-[120px] text-xs font-bold uppercase tracking-wider text-slate-500">Valor Total</TableHead>
                        <TableHead className="w-[120px] text-xs font-bold uppercase tracking-wider text-slate-500">Método</TableHead>
                        <TableHead className="w-[100px] text-right text-xs font-bold uppercase tracking-wider text-slate-500">Data</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {sales.map((sale) => (
                        <SaleRow key={sale.opportunity_id} sale={sale} onClick={onSaleClick} />
                    ))}
                </TableBody>
            </Table>
        </div>
    );
}
