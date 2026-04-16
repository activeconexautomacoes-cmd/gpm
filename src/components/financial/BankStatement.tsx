import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useBankAccounts, useBankTransactions } from "@/hooks/useFinancialModules";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { formatCurrency } from "@/utils/format";
import { useMemo, useState, useEffect } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
    startOfMonth,
    endOfMonth,
    isWithinInterval,
    subMonths,
    format,
    startOfDay,
    endOfDay,
    subDays,
    startOfYear,
    endOfYear,
    subYears
} from "date-fns";
import { ptBR } from "date-fns/locale";
import { ArrowDownCircle, ArrowUpCircle, Wallet, Calendar as CalendarIcon, ArrowRightLeft } from "lucide-react";
import { ImportFinancialDialog } from "./ImportFinancialDialog";
import { NewTransactionDialog } from "./NewTransactionDialog";
import { NewTransferDialog } from "./NewTransferDialog";
import { PayInvoiceDialog } from "./PayInvoiceDialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";

export function BankStatement() {
    const { currentWorkspace } = useWorkspace();
    const { accounts } = useBankAccounts(currentWorkspace?.id);
    const [selectedAccountId, setSelectedAccountId] = useState<string>("");
    const { transactions } = useBankTransactions(currentWorkspace?.id, selectedAccountId);
    const [dateRange, setDateRange] = useState<{ from: Date; to: Date }>({
        from: startOfMonth(new Date()),
        to: endOfDay(new Date()),
    });
    const [showCustomRange, setShowCustomRange] = useState(false);

    // Auto-select account if only one exists or if one is marked as principal
    useEffect(() => {
        if (accounts && accounts.length > 0 && !selectedAccountId) {
            if (accounts.length === 1) {
                setSelectedAccountId(accounts[0].id);
            } else {
                const principal = accounts.find(a => a.is_principal);
                if (principal) {
                    setSelectedAccountId(principal.id);
                }
            }
        }
    }, [accounts, selectedAccountId]);

    const currentAccount = accounts?.find(a => a.id === selectedAccountId);

    // Calculate running balance from initial_balance + all transactions (single source of truth)
    const { statementData, calculatedBalance } = useMemo(() => {
        if (!transactions || !currentAccount) return { statementData: [], calculatedBalance: Number(currentAccount?.initial_balance || 0) };

        let runningBalance = Number(currentAccount.initial_balance || 0);

        // Sort chronological for calculation
        const sorted = [...transactions].sort((a, b) => new Date(a.transaction_date).getTime() - new Date(b.transaction_date).getTime());

        const withBalance = sorted.map(t => {
            runningBalance += Number(t.amount);
            return {
                ...t,
                balanceSnapshot: runningBalance
            };
        });

        // The final running balance IS the real current balance
        const finalBalance = runningBalance;

        // Now filter for display based on dateRange
        const interval = {
            start: startOfDay(dateRange.from),
            end: endOfDay(dateRange.to)
        };

        const filtered = withBalance.filter(t => {
            // Fix timezone issue: Add 3 hours to compensate for Brasilia Time (UTC-3)
            // This aligns the filter date with the display date (line 305)
            const tDate = new Date(t.transaction_date + 'T12:00:00');
            return isWithinInterval(tDate, interval);
        });

        // Return reversed (newest first) for statement view
        return { statementData: filtered.reverse(), calculatedBalance: finalBalance };

    }, [transactions, currentAccount, dateRange]);

    const periodStats = useMemo(() => {
        const income = statementData.filter(t => t.amount > 0).reduce((acc, t) => acc + t.amount, 0);
        const expense = statementData.filter(t => t.amount < 0).reduce((acc, t) => acc + t.amount, 0);
        return { income, expense };
    }, [statementData]);

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row gap-4 justify-between items-start md:items-center">
                <div className="w-[300px]">
                    <Select value={selectedAccountId} onValueChange={setSelectedAccountId}>
                        <SelectTrigger className="w-full h-11 border-border/50 bg-card/50 backdrop-blur-sm">
                            <SelectValue placeholder="Selecione a Conta Bancária" />
                        </SelectTrigger>
                        <SelectContent>
                            {accounts?.map(acc => (
                                <SelectItem key={acc.id} value={acc.id}>{acc.name}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>

                <div className="flex flex-wrap gap-2 items-center">
                    <Popover>
                        <PopoverTrigger asChild>
                            <Button
                                variant="outline"
                                className="h-11 px-4 justify-start text-left font-bold border-border/50 bg-card/50 backdrop-blur-sm hover:bg-primary/10 hover:border-primary/30 transition-all min-w-[240px]"
                            >
                                <CalendarIcon className="mr-2 h-4 w-4 text-primary" />
                                {format(dateRange.from, "dd/MM/yy")} - {format(dateRange.to, "dd/MM/yy")}
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-4 bg-card/95 backdrop-blur-xl border-border/50 shadow-2xl" align="end">
                            <div className="space-y-4">
                                <div className="grid grid-cols-2 gap-2">
                                    {[
                                        { label: "Hoje", range: { from: startOfDay(new Date()), to: endOfDay(new Date()) } },
                                        { label: "Ontem", range: { from: startOfDay(subDays(new Date(), 1)), to: endOfDay(subDays(new Date(), 1)) } },
                                        { label: "Últimos 7 dias", range: { from: startOfDay(subDays(new Date(), 7)), to: endOfDay(new Date()) } },
                                        { label: "Este Mês", range: { from: startOfMonth(new Date()), to: endOfDay(new Date()) } },
                                        { label: "Mês Passado", range: { from: startOfMonth(subMonths(new Date(), 1)), to: endOfMonth(subMonths(new Date(), 1)) } },
                                        { label: "Últimos 90 dias", range: { from: startOfDay(subDays(new Date(), 90)), to: endOfDay(new Date()) } },
                                        { label: "Este Ano", range: { from: startOfYear(new Date()), to: endOfDay(new Date()) } },
                                        { label: "Ano Passado", range: { from: startOfYear(subYears(new Date(), 1)), to: endOfYear(subYears(new Date(), 1)) } },
                                    ].map((period) => (
                                        <Button
                                            key={period.label}
                                            size="sm"
                                            variant="outline"
                                            className="font-bold text-[10px] uppercase tracking-wider hover:bg-primary hover:text-primary-foreground transition-all border-border/50 hover:border-primary shadow-sm hover:shadow-md hover:-translate-y-0.5"
                                            onClick={() => {
                                                setDateRange(period.range);
                                                setShowCustomRange(false);
                                            }}
                                        >
                                            {period.label}
                                        </Button>
                                    ))}
                                    <Button
                                        size="sm"
                                        variant={showCustomRange ? "default" : "outline"}
                                        className={cn(
                                            "font-bold text-[10px] uppercase tracking-wider col-span-2 transition-all shadow-sm hover:shadow-md",
                                            showCustomRange
                                                ? "bg-primary text-primary-foreground hover:bg-primary/90"
                                                : "hover:bg-primary hover:text-primary-foreground border-border/50 hover:border-primary hover:-translate-y-0.5"
                                        )}
                                        onClick={() => setShowCustomRange(!showCustomRange)}
                                    >
                                        Personalizado
                                    </Button>
                                </div>

                                {showCustomRange && (
                                    <div className="flex flex-col md:flex-row gap-4 border-t border-border pt-4 animate-in fade-in slide-in-from-top-2 duration-300">
                                        <div className="space-y-2">
                                            <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Início</p>
                                            <Calendar
                                                mode="single"
                                                selected={dateRange.from}
                                                onSelect={(date) => date && setDateRange({ ...dateRange, from: startOfDay(date) })}
                                                className="border border-border/50 rounded-xl bg-card/50"
                                                locale={ptBR}
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Fim</p>
                                            <Calendar
                                                mode="single"
                                                selected={dateRange.to}
                                                onSelect={(date) => date && setDateRange({ ...dateRange, to: endOfDay(date) })}
                                                className="border border-border/50 rounded-xl bg-card/50"
                                                locale={ptBR}
                                            />
                                        </div>
                                    </div>
                                )}
                            </div>
                        </PopoverContent>
                    </Popover>
                    <NewTransactionDialog defaultAccountId={selectedAccountId} />
                    <PayInvoiceDialog
                        targetAccountId={selectedAccountId}
                        isCreditCard={currentAccount?.type === 'credit_card'}
                    />
                    <NewTransferDialog />
                    <ImportFinancialDialog />
                </div>
            </div>

            {selectedAccountId && currentAccount ? (
                <>
                    {/* Bank Card Simulation */}
                    <div className="grid gap-4 md:grid-cols-3">
                        <div className={cn(
                            "p-6 rounded-xl text-white shadow-lg bg-gradient-to-br",
                            currentAccount.type === 'credit_card'
                                ? "from-blue-900 to-indigo-900"
                                : "from-slate-900 to-slate-800 dark:from-slate-950 dark:to-slate-900"
                        )}>
                            <div className="flex justify-between items-start mb-6">
                                <Wallet className="h-8 w-8 opacity-80" />
                                <span className="font-mono text-sm opacity-70">
                                    {currentAccount.type === 'credit_card' ? 'Cartão de Crédito' : 'Conta Financeira'}
                                </span>
                            </div>

                            {currentAccount.type === 'credit_card' ? (
                                <div className="space-y-4">
                                    <div>
                                        <p className="text-xs opacity-70 mb-1">Fatura Atual (Gasto)</p>
                                        <h2 className="text-2xl font-bold tracking-tight text-white">
                                            {formatCurrency(Math.abs(calculatedBalance))}
                                        </h2>
                                    </div>
                                    <div className="grid grid-cols-2 gap-2 border-t border-white/10 pt-4">
                                        <div>
                                            <p className="text-[10px] opacity-60 uppercase">Limite Disp.</p>
                                            <p className="font-bold text-sm">
                                                {formatCurrency((currentAccount.credit_limit || 0) + calculatedBalance)}
                                            </p>
                                        </div>
                                        <div>
                                            <p className="text-[10px] opacity-60 uppercase">Vencimento</p>
                                            <p className="font-bold text-sm">Todo dia {currentAccount.due_day || '-'}</p>
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div className="mb-2">
                                    <p className="text-xs opacity-70 mb-1">Saldo Atual</p>
                                    <h2 className="text-2xl font-bold tracking-tight">{formatCurrency(calculatedBalance)}</h2>
                                </div>
                            )}

                            <div className="mt-4 flex justify-between items-end">
                                <div>
                                    <p className="text-xs opacity-70">{currentAccount.name}</p>
                                    {currentAccount.type !== 'credit_card' && (
                                        <p className="font-mono text-[10px] mt-1 opacity-60">
                                            AG: {currentAccount.agency || '0000'} &nbsp; CC: {currentAccount.account_number || '000000-0'}
                                        </p>
                                    )}
                                </div>
                                <div className="text-[10px] opacity-40 font-mono">GPM NEXUS</div>
                            </div>
                        </div>

                        <Card>
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium">Entradas do Período</CardTitle>
                                <ArrowUpCircle className="h-4 w-4 text-green-500" />
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold text-green-600">{formatCurrency(periodStats.income)}</div>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium">Saídas do Período</CardTitle>
                                <ArrowDownCircle className="h-4 w-4 text-red-500" />
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold text-red-600">{formatCurrency(Math.abs(periodStats.expense))}</div>
                            </CardContent>
                        </Card>
                    </div>

                    <Card>
                        <CardHeader>
                            <CardTitle>Extrato Detalhado</CardTitle>
                        </CardHeader>
                        <CardContent className="overflow-x-auto">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Data</TableHead>
                                        <TableHead>Descrição</TableHead>
                                        <TableHead className="text-right">Valor</TableHead>
                                        <TableHead className="text-right text-muted-foreground w-[150px]">Saldo</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {statementData.length === 0 ? (
                                        <TableRow>
                                            <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                                                Nenhum lançamento neste período.
                                            </TableCell>
                                        </TableRow>
                                    ) : (
                                        statementData.map((transaction) => {
                                            const isPositive = transaction.amount > 0;
                                            return (
                                                <TableRow key={transaction.id}>
                                                    <TableCell>{format(new Date(transaction.transaction_date + 'T12:00:00'), "dd/MM/yyyy", { locale: ptBR })}</TableCell>
                                                    <TableCell className="font-medium">{transaction.description}</TableCell>
                                                    <TableCell className={`text-right font-bold ${isPositive ? 'text-green-600' : 'text-red-600'}`}>
                                                        {isPositive ? '+' : ''} {formatCurrency(transaction.amount)}
                                                    </TableCell>
                                                    <TableCell className="text-right text-muted-foreground font-mono">
                                                        {transaction.balanceSnapshot !== undefined ? formatCurrency(transaction.balanceSnapshot) : '-'}
                                                    </TableCell>
                                                </TableRow>
                                            );
                                        })
                                    )}
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>
                </>
            ) : (
                <div className="flex flex-col items-center justify-center p-12 text-center border-2 border-dashed rounded-lg bg-muted/20">
                    <Wallet className="h-12 w-12 text-muted-foreground mb-4" />
                    <h3 className="text-lg font-semibold mb-2">Selecione uma conta</h3>
                    <p className="text-muted-foreground max-w-sm">
                        Selecione a conta bancária acima para visualizar o extrato, saldo e fluxo financeiro detalhado.
                    </p>
                </div>
            )}
        </div>
    );
}
