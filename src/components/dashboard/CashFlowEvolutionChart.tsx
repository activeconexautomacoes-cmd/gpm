import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { format, endOfMonth, parseISO, startOfMonth, eachMonthOfInterval, min } from "date-fns";
import { ptBR } from "date-fns/locale";
import { formatCurrency } from "@/utils/format";
import { useBankAccounts } from "@/hooks/useFinancialModules";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { Loader2 } from "lucide-react";
import { useTheme } from "@/components/theme-provider";

interface Transaction {
    id: string;
    bank_account_id: string;
    amount: number;
    transaction_date: string;
}

interface BankAccount {
    id: string;
    name: string;
    initial_balance: number;
}

export function CashFlowEvolutionChart() {
    const { currentWorkspace } = useWorkspace();
    const [selectedAccountId, setSelectedAccountId] = useState<string>("all");
    const { accounts } = useBankAccounts(currentWorkspace?.id);
    const { theme } = useTheme();
    const isDark = theme === "dark" || (theme === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);

    const { data: transactions, isLoading } = useQuery({
        queryKey: ["financial_bank_transactions_all", currentWorkspace?.id],
        queryFn: async () => {
            if (!currentWorkspace?.id) return [];
            const { data, error } = await supabase
                .from("financial_bank_transactions")
                .select("*")
                .eq("workspace_id", currentWorkspace.id)
                .order("transaction_date", { ascending: true });

            if (error) throw error;
            return data as any as Transaction[];
        },
        enabled: !!currentWorkspace?.id
    });

    const chartData = useMemo(() => {
        if (!transactions || !accounts) return [];
        const typedAccounts = (accounts || []) as any as BankAccount[];
        const filteredTransactions = selectedAccountId === "all"
            ? transactions
            : transactions.filter(t => t.bank_account_id === selectedAccountId);

        if (filteredTransactions.length === 0) return [];
        const dates = filteredTransactions.map(t => parseISO(t.transaction_date));
        if (dates.length === 0) return [];
        const startDate = startOfMonth(min(dates));
        const endDate = endOfMonth(new Date());
        const months = eachMonthOfInterval({ start: startDate, end: endDate });

        let currentBalance = 0;
        const relevantAccounts = selectedAccountId === "all"
            ? typedAccounts
            : typedAccounts.filter(a => a.id === selectedAccountId);
        currentBalance = relevantAccounts.reduce((acc, curr) => acc + (Number(curr.initial_balance) || 0), 0);

        const transactionsByMonth = filteredTransactions.reduce((acc, t) => {
            const monthKey = format(parseISO(t.transaction_date), "yyyy-MM");
            acc[monthKey] = (acc[monthKey] || 0) + Number(t.amount);
            return acc;
        }, {} as Record<string, number>);

        const data = months.map(month => {
            const monthKey = format(month, "yyyy-MM");
            const monthlyNet = transactionsByMonth[monthKey] || 0;
            currentBalance += monthlyNet;
            return {
                month: format(month, "MMM/yy", { locale: ptBR }),
                rawDate: month,
                balance: currentBalance,
                monthlyNet
            };
        });
        return data;
    }, [transactions, accounts, selectedAccountId]);

    if (isLoading) return <div className="h-[300px] flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-[#3B82F6]" /></div>;

    const typedAccounts = (accounts || []) as any as BankAccount[];

    return (
        <div className="w-full relative">
            <div className="absolute top-[-55px] right-0 z-20">
                <Select value={selectedAccountId} onValueChange={setSelectedAccountId}>
                    <SelectTrigger className="w-[160px] h-8 text-[9px] font-black uppercase tracking-widest bg-white/50 dark:bg-black/50 backdrop-blur-md border-[#3B82F6]/20 dark:border-white/10 hover:bg-[#3B82F6]/5 dark:hover:bg-white/5 transition-all">
                        <SelectValue placeholder="FILTRAR CONTA" />
                    </SelectTrigger>
                    <SelectContent className="backdrop-blur-xl bg-white/90 dark:bg-black/90 border-[#3B82F6]/20 dark:border-white/10">
                        <SelectItem value="all" className="text-[10px] font-black uppercase tracking-widest">TODAS AS CONTAS</SelectItem>
                        {typedAccounts.map((account) => (
                            <SelectItem key={account.id} value={account.id} className="text-[10px] font-bold">
                                {account.name.toUpperCase()}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>

            <div className="h-[300px] w-full mt-4">
                <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                        <defs>
                            <linearGradient id="colorCashFlow" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.4} />
                                <stop offset="95%" stopColor="#3B82F6" stopOpacity={0.01} />
                            </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.05)"} />
                        <XAxis
                            dataKey="month"
                            tickLine={false}
                            axisLine={false}
                            tickMargin={10}
                            tick={{ fill: isDark ? "rgba(255,255,255,0.5)" : "#1D4ED8", fontSize: 10, opacity: 0.6, fontWeight: 700 }}
                        />
                        <YAxis
                            tickFormatter={(value) => `R$ ${(value / 1000).toLocaleString('pt-BR')}k`}
                            tickLine={false}
                            axisLine={false}
                            tick={{ fill: isDark ? "rgba(255,255,255,0.5)" : "#1D4ED8", opacity: 0.6, fontWeight: 700 }}
                        />
                        <Tooltip
                            contentStyle={{
                                backgroundColor: isDark ? 'rgba(15, 10, 25, 0.95)' : 'rgba(255, 255, 255, 0.95)',
                                backdropFilter: 'blur(12px)',
                                border: isDark ? '1px solid rgba(255, 255, 255, 0.1)' : '1px solid rgba(124, 58, 237, 0.1)',
                                borderRadius: '16px',
                                fontSize: '11px',
                                boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
                                padding: '12px',
                                color: isDark ? '#fff' : '#1D4ED8'
                            }}
                            formatter={(value: number) => [<span className="font-black text-[#3B82F6] dark:text-[#60A5FA]">{formatCurrency(value)}</span>, "SALDO CONSOLIDADO"]}
                        />
                        <Area
                            type="monotone"
                            dataKey="balance"
                            stroke="#3B82F6"
                            strokeWidth={4}
                            fillOpacity={1}
                            fill="url(#colorCashFlow)"
                            animationDuration={2000}
                        />
                    </AreaChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
}
