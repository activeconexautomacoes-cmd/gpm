import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis, Cell } from "recharts";
import { formatCurrency } from "@/utils/format";
import { Loader2 } from "lucide-react";
import { startOfDay, endOfDay } from "date-fns";
import { cn } from "@/lib/utils";
import { useTheme } from "@/components/theme-provider";

interface ProductRevenueChartProps {
    dateRange: { from: Date; to: Date };
}

interface ProductData {
    name: string;
    revenue: number;
    quantity: number;
    ids: Set<string>;
}

export function ProductRevenueChart({ dateRange }: ProductRevenueChartProps) {
    const { from, to } = dateRange;
    const { theme } = useTheme();
    const isDark = theme === "dark" || (theme === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);

    const { data: receivables, isLoading: isLoadingReceivables } = useQuery({
        queryKey: ["financial_receivables_products", from, to],
        queryFn: async () => {
            const { data, error } = await supabase
                .from("financial_receivables")
                .select("id, amount, contract_id, one_time_sale_id")
                .eq("status", "paid")
                .gte("payment_date", startOfDay(from).toISOString())
                .lte("payment_date", endOfDay(to).toISOString());

            if (error) throw error;
            return data;
        },
    });

    const { data: productMap, isLoading: isLoadingProducts } = useQuery({
        queryKey: ["product_display_map"],
        queryFn: async () => {
            const { data: contracts } = await supabase
                .from("contracts")
                .select("id, opportunity:opportunities(qualified_product:products(name))");

            const { data: sales } = await supabase
                .from("one_time_sales")
                .select("id, opportunity:opportunities(qualified_product:products(name))");

            const map = new Map<string, string>();
            contracts?.forEach((c: any) => {
                const productName = c.opportunity?.qualified_product?.name || "Sem Produto";
                map.set(`contract_${c.id}`, productName);
            });
            sales?.forEach((s: any) => {
                const productName = s.opportunity?.qualified_product?.name || "Sem Produto";
                map.set(`sale_${s.id}`, productName);
            });
            return map;
        },
        staleTime: 1000 * 60 * 5
    });

    const chartData = useMemo(() => {
        if (!receivables || !productMap) return [];
        const stats = new Map<string, ProductData>();
        receivables.forEach((r) => {
            let key = "";
            if (r.contract_id) key = `contract_${r.contract_id}`;
            else if (r.one_time_sale_id) key = `sale_${r.one_time_sale_id}`;
            else return;
            const productName = productMap.get(key) || "Outros";
            if (!stats.has(productName)) {
                stats.set(productName, { name: productName, revenue: 0, quantity: 0, ids: new Set() });
            }
            const entry = stats.get(productName)!;
            entry.revenue += Number(r.amount);
            const sourceId = r.contract_id || r.one_time_sale_id;
            if (sourceId && !entry.ids.has(sourceId)) {
                entry.ids.add(sourceId);
                entry.quantity += 1;
            }
        });
        return Array.from(stats.values()).sort((a, b) => b.revenue - a.revenue).slice(0, 5);
    }, [receivables, productMap]);

    if (isLoadingReceivables || isLoadingProducts) {
        return <div className="h-[300px] flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-[#3B82F6]" /></div>;
    }

    return (
        <div className="h-[300px] w-full pr-6 py-4">
            <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} layout="vertical" margin={{ top: 0, right: 30, left: 10, bottom: 0 }}>
                    <defs>
                        <linearGradient id="productGradient" x1="0" y1="0" x2="1" y2="0">
                            <stop offset="0%" stopColor="#3B82F6" stopOpacity={0.7} />
                            <stop offset="100%" stopColor="#3B82F6" stopOpacity={1} />
                        </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke={isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.05)"} />
                    <XAxis type="number" hide />
                    <YAxis
                        dataKey="name"
                        type="category"
                        width={90}
                        tick={{ fill: isDark ? "rgba(255,255,255,0.7)" : "#1D4ED8", fontSize: 10, fontWeight: 900, textTransform: 'uppercase' }}
                        axisLine={false}
                        tickLine={false}
                    />
                    <Tooltip
                        cursor={{ fill: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(124, 58, 237, 0.05)', radius: 8 }}
                        content={({ active, payload }) => {
                            if (active && payload && payload.length) {
                                const data = payload[0].payload;
                                return (
                                    <div className="p-4 bg-white/90 dark:bg-black/90 backdrop-blur-xl border border-[#3B82F6]/20 dark:border-white/10 rounded-2xl shadow-2xl">
                                        <p className="text-[11px] font-black text-[#1D4ED8] dark:text-white uppercase tracking-widest mb-3 border-b border-black/5 dark:border-white/5 pb-2">{data.name}</p>
                                        <div className="space-y-2">
                                            <div className="flex justify-between gap-8 text-[10px]">
                                                <span className="font-bold text-[#3B82F6] dark:text-[#60A5FA]">RECEITA</span>
                                                <span className="font-black text-[#1D4ED8] dark:text-white">{formatCurrency(data.revenue)}</span>
                                            </div>
                                            <div className="flex justify-between gap-8 text-[10px]">
                                                <span className="font-bold text-[#3B82F6]/60 dark:text-white/40">CONTRATOS</span>
                                                <span className="font-black text-[#1D4ED8]/70 dark:text-white/60">{data.quantity}</span>
                                            </div>
                                        </div>
                                    </div>
                                );
                            }
                            return null;
                        }}
                    />
                    <Bar dataKey="revenue" fill="url(#productGradient)" radius={[0, 8, 8, 0]} barSize={24} animationDuration={2000} />
                </BarChart>
            </ResponsiveContainer>
        </div>
    );
}
