import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { Skeleton } from "@/components/ui/skeleton";
import { format, eachMonthOfInterval, startOfMonth, endOfMonth } from "date-fns";
import { formatCurrency } from "@/utils/format";
import { useTheme } from "@/components/theme-provider";

interface RevenueChartProps {
  dateRange: { from: Date; to: Date };
}

export function RevenueChart({ dateRange }: RevenueChartProps) {
  const { currentWorkspace } = useWorkspace();
  const { theme } = useTheme();
  const isDark = theme === "dark" || (theme === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);

  const { data: chartData, isLoading } = useQuery({
    queryKey: ["revenue-chart", currentWorkspace?.id, dateRange],
    queryFn: async () => {
      if (!currentWorkspace) return [];

      const months = eachMonthOfInterval({ start: dateRange.from, end: dateRange.to });
      const results = [];

      for (const month of months) {
        const monthStart = format(startOfMonth(month), "yyyy-MM-dd");
        const monthEnd = format(endOfMonth(month), "yyyy-MM-dd");

        const { data: billings } = await supabase
          .from("contract_billings")
          .select("final_amount")
          .eq("workspace_id", currentWorkspace.id)
          .eq("status", "paid")
          .gte("payment_date", monthStart)
          .lte("payment_date", monthEnd);

        const billingsTotal = billings?.reduce((sum, b) => sum + Number(b.final_amount), 0) || 0;

        const { data: sales } = await supabase
          .from("one_time_sales")
          .select("amount")
          .eq("workspace_id", currentWorkspace.id)
          .eq("status", "paid")
          .gte("payment_date", monthStart)
          .lte("payment_date", monthEnd);

        const salesRevenue = sales?.reduce((sum, s) => sum + Number(s.amount), 0) || 0;

        const { data: receivables } = await supabase
          .from("financial_receivables")
          .select("total_amount")
          .eq("workspace_id", currentWorkspace.id)
          .eq("status", "paid")
          .is("contract_billing_id", null)
          .is("one_time_sale_id", null)
          .gte("payment_date", monthStart)
          .lte("payment_date", monthEnd);

        const receivablesRevenue = receivables?.reduce((sum, r) => sum + Number(r.total_amount), 0) || 0;

        const { data: expenses } = await supabase
          .from("financial_payables")
          .select("total_amount")
          .eq("workspace_id", currentWorkspace.id)
          .gte("due_date", monthStart)
          .lte("due_date", monthEnd);

        const expensesTotal = expenses?.reduce((sum, e) => sum + Number(e.total_amount), 0) || 0;

        results.push({
          month: format(month, "MMM/yy"),
          receita: billingsTotal + salesRevenue + receivablesRevenue,
          despesas: expensesTotal,
        });
      }

      return results;
    },
    enabled: !!currentWorkspace,
  });

  if (!currentWorkspace) return null;

  return (
    <div className="p-6">
      {isLoading ? (
        <Skeleton className="h-[350px] w-full bg-black/5 dark:bg-white/5" />
      ) : (
        <div className="h-[350px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="colorReceita" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="#3B82F6" stopOpacity={0.01} />
                </linearGradient>
                <linearGradient id="colorDespesas" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#F97316" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#F97316" stopOpacity={0.01} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.05)"} />
              <XAxis
                dataKey="month"
                fontSize={10}
                tickLine={false}
                axisLine={false}
                tick={{ fill: isDark ? "rgba(255,255,255,0.5)" : "#1D4ED8", opacity: 0.6, fontWeight: 700 }}
                dy={10}
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
                  backgroundColor: isDark ? 'rgba(15, 10, 25, 0.95)' : 'rgba(255, 255, 255, 0.9)',
                  backdropFilter: 'blur(12px)',
                  border: isDark ? '1px solid rgba(255, 255, 255, 0.1)' : '1px solid rgba(124, 58, 237, 0.1)',
                  borderRadius: '16px',
                  fontSize: '11px',
                  boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
                  padding: '12px',
                  color: isDark ? '#fff' : '#1D4ED8'
                }}
                itemStyle={{ color: isDark ? '#fff' : '#1D4ED8', fontWeight: 700 }}
                cursor={{ stroke: '#3B82F6', strokeWidth: 2, strokeDasharray: '5 5' }}
                formatter={(value: number) => [formatCurrency(value), ""]}
              />
              <Legend
                verticalAlign="top"
                align="right"
                height={40}
                iconType="circle"
                wrapperStyle={{ fontSize: '10px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.1em', color: isDark ? 'rgba(255,255,255,0.6)' : '#1D4ED8' }}
              />
              <Area
                type="monotone"
                dataKey="receita"
                stroke="#3B82F6"
                strokeWidth={4}
                fillOpacity={1}
                fill="url(#colorReceita)"
                name="Receita Bruta"
                animationDuration={2000}
                activeDot={{ r: 6, strokeWidth: 0 }}
              />
              <Area
                type="monotone"
                dataKey="despesas"
                stroke="#F97316"
                strokeWidth={4}
                fillOpacity={1}
                fill="url(#colorDespesas)"
                name="Despesas Médias"
                animationDuration={2000}
                activeDot={{ r: 6, strokeWidth: 0 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
