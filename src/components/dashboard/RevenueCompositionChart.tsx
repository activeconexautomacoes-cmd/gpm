import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { Skeleton } from "@/components/ui/skeleton";
import { format, eachMonthOfInterval, startOfMonth, endOfMonth, subMonths } from "date-fns";
import { formatCurrency } from "@/utils/format";
import { useTheme } from "@/components/theme-provider";

export function RevenueCompositionChart() {
    const { currentWorkspace } = useWorkspace();
    const { theme } = useTheme();
    const isDark = theme === "dark" || (theme === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);

    const { data: chartData, isLoading } = useQuery({
        queryKey: ["revenue-composition", currentWorkspace?.id],
        queryFn: async () => {
            if (!currentWorkspace) return [];

            const end = new Date();
            const start = subMonths(end, 5);
            const months = eachMonthOfInterval({ start, end });
            const results = [];

            for (const month of months) {
                const monthStart = format(startOfMonth(month), "yyyy-MM-dd");
                const monthEnd = format(endOfMonth(month), "yyyy-MM-dd");

                // Recurring revenue from billings
                const { data: billings } = await supabase
                    .from("contract_billings")
                    .select("final_amount")
                    .eq("workspace_id", currentWorkspace.id)
                    .eq("status", "paid")
                    .gte("payment_date", monthStart)
                    .lte("payment_date", monthEnd);

                const mrrRevenue = billings?.reduce((sum, b) => sum + Number(b.final_amount), 0) || 0;

                // One-time revenue
                const { data: sales } = await supabase
                    .from("one_time_sales")
                    .select("amount")
                    .eq("workspace_id", currentWorkspace.id)
                    .eq("status", "paid")
                    .gte("payment_date", monthStart)
                    .lte("payment_date", monthEnd);

                const oneTimeRevenue = sales?.reduce((sum, s) => sum + Number(s.amount), 0) || 0;

                results.push({
                    month: format(month, "MMM/yy"),
                    recorrente: mrrRevenue,
                    pontual: oneTimeRevenue,
                });
            }

            return results;
        },
        enabled: !!currentWorkspace,
    });

    if (!currentWorkspace) return null;

    return (
        <div className="w-full">
            {isLoading ? (
                <Skeleton className="h-[300px] w-full bg-black/5 dark:bg-white/5 rounded-2xl" />
            ) : (
                <div className="h-[300px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.05)"} />
                            <XAxis
                                dataKey="month"
                                fontSize={10}
                                tickLine={false}
                                axisLine={false}
                                tick={{ fill: isDark ? "rgba(255,255,255,0.5)" : "#1D4ED8", opacity: 0.6, fontWeight: 700 }}
                            />
                            <YAxis
                                fontSize={10}
                                tickLine={false}
                                axisLine={false}
                                tick={{ fill: isDark ? "rgba(255,255,255,0.5)" : "#1D4ED8", opacity: 0.6, fontWeight: 700 }}
                                tickFormatter={(value) => `R$ ${value >= 1000 ? (value / 1000).toFixed(0) + 'k' : value}`}
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
                                itemStyle={{ fontWeight: 700, padding: '2px 0' }}
                                formatter={(value: number) => [formatCurrency(value), ""]}
                            />
                            <Legend
                                verticalAlign="top"
                                align="right"
                                height={36}
                                iconType="circle"
                                wrapperStyle={{ fontSize: '10px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.1em', paddingBottom: '20px', color: isDark ? 'rgba(255,255,255,0.6)' : undefined }}
                            />
                            <Bar
                                dataKey="recorrente"
                                stackId="a"
                                fill="#3B82F6"
                                name="MRR / Recorrente"
                                radius={[0, 0, 0, 0]}
                                barSize={20}
                                animationDuration={1500}
                            />
                            <Bar
                                dataKey="pontual"
                                stackId="a"
                                fill="#F97316"
                                name="Vendas Pontuais"
                                radius={[6, 6, 0, 0]}
                                barSize={20}
                                animationDuration={1500}
                            />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            )}
        </div>
    );
}
