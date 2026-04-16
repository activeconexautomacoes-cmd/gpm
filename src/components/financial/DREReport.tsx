
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useReceivables, usePayables } from "@/hooks/useFinancialModules";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { formatCurrency } from "@/utils/format";
import { useMemo, useState } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { startOfMonth, endOfMonth, isWithinInterval, subMonths, format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2 } from "lucide-react";

export function DREReport() {
    const { currentWorkspace } = useWorkspace();
    const { receivables, isLoading: isLoadingReceivables } = useReceivables(currentWorkspace?.id);
    const { payables, isLoading: isLoadingPayables } = usePayables(currentWorkspace?.id);
    const [selectedPeriod, setSelectedPeriod] = useState<string>("0"); // 0 = Current month

    const periodData = useMemo(() => {
        if (!receivables || !payables) return null;

        const now = new Date();
        const offset = parseInt(selectedPeriod);
        const targetDate = subMonths(now, offset);

        const start = startOfMonth(targetDate);
        const end = endOfMonth(targetDate);
        const interval = { start, end };

        // Filter transactions by competence (due_date) for the DRE
        const periodReceivables = receivables.filter(r => isWithinInterval(new Date(r.due_date), interval));
        const periodPayables = payables.filter(p => isWithinInterval(new Date(p.due_date), interval));

        // Grouping
        // Grouping
        const incomeByCategory: Record<string, number> = {};
        let grossRevenue = 0;

        periodReceivables.forEach(r => {
            const catName = r.financial_categories?.name || "Sem categoria";
            incomeByCategory[catName] = (incomeByCategory[catName] || 0) + r.total_amount;
            grossRevenue += r.total_amount;
        });

        const expensesByCategory: Record<string, number> = {};
        let totalExpenses = 0;

        periodPayables.forEach(p => {
            const catName = p.financial_categories?.name || "Sem categoria";
            expensesByCategory[catName] = (expensesByCategory[catName] || 0) + p.total_amount;
            totalExpenses += p.total_amount;
        });

        const netResult = grossRevenue - totalExpenses;
        const margin = grossRevenue > 0 ? (netResult / grossRevenue) * 100 : 0;

        return {
            grossRevenue,
            incomeByCategory,
            expensesByCategory,
            totalExpenses,
            netResult,
            margin,
            monthName: format(targetDate, 'MMMM yyyy', { locale: ptBR })
        };
    }, [receivables, payables, selectedPeriod]);

    if (isLoadingReceivables || isLoadingPayables) {
        return <div className="flex justify-center p-8"><Loader2 className="animate-spin" /></div>;
    }

    if (!periodData) return null;

    return (
        <Card className="w-full">
            <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Demonstrativo de Resultados (DRE)</CardTitle>
                <div className="w-[200px]">
                    <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
                        <SelectTrigger>
                            <SelectValue placeholder="Selecione o período" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="0">Este Mês</SelectItem>
                            <SelectItem value="1">Mês Passado</SelectItem>
                            <SelectItem value="2">2 Meses Atrás</SelectItem>
                            <SelectItem value="3">3 Meses Atrás</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
            </CardHeader>
            <CardContent>
                <div className="mb-6">
                    <h3 className="text-lg font-semibold text-center capitalized first-letter:uppercase">{periodData.monthName}</h3>
                </div>

                <div className="overflow-x-auto">
                    <Table>
                        <TableHeader>
                            <TableRow className="bg-muted/50">
                                <TableHead className="w-[50%]">Conta</TableHead>
                                <TableHead className="text-right">Valor</TableHead>
                                <TableHead className="text-right">%</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {/* Receitas Breakdown */}
                            <TableRow>
                                <TableCell colSpan={3} className="font-semibold text-muted-foreground pt-4">RECEITAS OPERACIONAIS</TableCell>
                            </TableRow>
                            {Object.entries(periodData.incomeByCategory).sort((a, b) => b[1] - a[1]).map(([category, amount]) => (
                                <TableRow key={category}>
                                    <TableCell className="pl-8 text-muted-foreground">{category}</TableCell>
                                    <TableCell className="text-right text-green-600 font-medium">+ {formatCurrency(amount)}</TableCell>
                                    <TableCell className="text-right text-muted-foreground">
                                        {periodData.grossRevenue > 0 ? ((amount / periodData.grossRevenue) * 100).toFixed(1) : "0.0"}%
                                    </TableCell>
                                </TableRow>
                            ))}

                            {/* Receita Bruta Subtotal */}
                            <TableRow className="bg-green-50 dark:bg-green-900/10">
                                <TableCell className="font-bold text-green-700">(=) RECEITA OPERACIONAL BRUTA</TableCell>
                                <TableCell className="text-right font-bold text-green-700">{formatCurrency(periodData.grossRevenue)}</TableCell>
                                <TableCell className="text-right font-medium">100%</TableCell>
                            </TableRow>

                            {/* Despesas Header */}
                            <TableRow>
                                <TableCell colSpan={3} className="font-semibold text-muted-foreground pt-6">DESPESAS OPERACIONAIS</TableCell>
                            </TableRow>

                            {/* Despesas Breakdown */}
                            {Object.entries(periodData.expensesByCategory).sort((a, b) => b[1] - a[1]).map(([category, amount]) => (
                                <TableRow key={category}>
                                    <TableCell className="pl-8 text-muted-foreground">{category}</TableCell>
                                    <TableCell className="text-right text-red-600">- {formatCurrency(amount)}</TableCell>
                                    <TableCell className="text-right text-muted-foreground">
                                        {periodData.grossRevenue > 0 ? ((amount / periodData.grossRevenue) * 100).toFixed(1) : "0.0"}%
                                    </TableCell>
                                </TableRow>
                            ))}

                            {/* Total Despesas */}
                            <TableRow className="bg-red-50 dark:bg-red-900/10">
                                <TableCell className="font-semibold text-red-700">(-) TOTAL DESPESAS</TableCell>
                                <TableCell className="text-right font-semibold text-red-700">- {formatCurrency(periodData.totalExpenses)}</TableCell>
                                <TableCell className="text-right font-medium">
                                    {periodData.grossRevenue > 0 ? ((periodData.totalExpenses / periodData.grossRevenue) * 100).toFixed(1) : "0.0"}%
                                </TableCell>
                            </TableRow>

                            {/* Resultado Líquido */}
                            <TableRow className={periodData.netResult >= 0 ? "bg-green-100 dark:bg-green-900/20" : "bg-red-100 dark:bg-red-900/20"}>
                                <TableCell className="font-bold text-lg pt-6">(=) RESULTADO LÍQUIDO</TableCell>
                                <TableCell className={`text-right font-bold text-lg pt-6 ${periodData.netResult >= 0 ? "text-green-700" : "text-red-700"}`}>
                                    {formatCurrency(periodData.netResult)}
                                </TableCell>
                                <TableCell className={`text-right font-bold text-lg pt-6 ${periodData.netResult >= 0 ? "text-green-700" : "text-red-700"}`}>
                                    {periodData.margin.toFixed(1)}%
                                </TableCell>
                            </TableRow>
                        </TableBody>
                    </Table>
                </div>
            </CardContent>
        </Card>
    );
}
