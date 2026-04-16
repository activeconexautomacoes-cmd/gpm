import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { Skeleton } from "@/components/ui/skeleton";
import { format, eachMonthOfInterval, startOfMonth, endOfMonth } from "date-fns";
import { formatCurrency } from "@/utils/format";
import { useTheme } from "@/components/theme-provider";

interface ChurnChartProps {
  dateRange: { from: Date; to: Date };
}

export function ChurnChart({ dateRange }: ChurnChartProps) {
  const { currentWorkspace } = useWorkspace();
  const { theme } = useTheme();
  const isDark = theme === "dark" || (theme === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);

  const { data: chartData, isLoading } = useQuery({
    queryKey: ["churn-chart", currentWorkspace?.id, dateRange],
    queryFn: async () => {
      if (!currentWorkspace) return [];

      const months = eachMonthOfInterval({ start: dateRange.from, end: dateRange.to });
      const results = [];

      for (const month of months) {
        const monthStart = format(startOfMonth(month), "yyyy-MM-dd");
        const monthEnd = format(endOfMonth(month), "yyyy-MM-dd");

        const { data: churns } = await supabase
          .from("churns")
          .select("mrr_lost")
          .eq("workspace_id", currentWorkspace.id)
          .gte("churn_date", monthStart)
          .lte("churn_date", monthEnd);

        const churnCount = churns?.length || 0;
        const mrrLost = churns?.reduce((sum, c) => sum + Number(c.mrr_lost), 0) || 0;

        results.push({
          month: format(month, "MMM/yy"),
          churns: churnCount,
          mrrPerdido: mrrLost,
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
                yAxisId="left"
                fontSize={10}
                tickLine={false}
                axisLine={false}
                tick={{ fill: isDark ? "rgba(255,255,255,0.5)" : "#1D4ED8", opacity: 0.6, fontWeight: 700 }}
              />
              <YAxis
                yAxisId="right"
                orientation="right"
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
                itemStyle={{ fontWeight: 700, padding: '2px 0', color: isDark ? '#fff' : undefined }}
                formatter={(value: number, name: string) => {
                  if (name === "mrrPerdido") return [formatCurrency(value), "MRR Perdido"];
                  return [value, "Qtde Churns"];
                }}
              />
              <Legend
                verticalAlign="top"
                align="right"
                height={36}
                iconType="circle"
                wrapperStyle={{ fontSize: '10px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.1em', paddingBottom: '20px', color: isDark ? 'rgba(255,255,255,0.6)' : undefined }}
              />
              <Bar
                yAxisId="left"
                dataKey="churns"
                fill="#3B82F6"
                name="churns"
                radius={[6, 6, 0, 0]}
                barSize={12}
                animationDuration={1500}
              />
              <Bar
                yAxisId="right"
                dataKey="mrrPerdido"
                fill="#F97316"
                name="mrrPerdido"
                radius={[6, 6, 0, 0]}
                barSize={12}
                animationDuration={1500}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
