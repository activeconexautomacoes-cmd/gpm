import { Card, CardContent } from "@/components/ui/card";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { ChannelData } from "./useCommercialDashboardData";

interface Props {
  channels: ChannelData[];
}

const COLORS = ["#3B82F6", "#06B6D4", "#10B981", "#F59E0B", "#EF4444", "#8B5CF6", "#EC4899", "#14B8A6", "#F97316", "#6366F1"];

export function LeadsByChannel({ channels }: Props) {
  const data = channels.slice(0, 10).map((c, i) => ({
    name: c.name,
    value: c.leads,
    wins: c.wins,
    color: COLORS[i % COLORS.length],
  }));

  const total = data.reduce((s, d) => s + d.value, 0);

  return (
    <Card className="overflow-hidden bg-white/40 dark:bg-black/40 backdrop-blur-md border-white/20 dark:border-white/10 shadow-sm">
      <CardContent className="p-6">
        <h3 className="text-[11px] font-black uppercase tracking-[0.15em] text-muted-foreground/70 mb-6">
          Leads por Canal
        </h3>

        {data.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-8">Sem dados no periodo</p>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Pie Chart */}
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie
                  data={data}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={3}
                  dataKey="value"
                >
                  {data.map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: "rgba(0,0,0,0.85)",
                    border: "none",
                    borderRadius: "12px",
                    fontSize: "11px",
                    color: "#fff",
                  }}
                  formatter={(value: number, name: string) => [`${value} leads (${((value / total) * 100).toFixed(1)}%)`, name]}
                />
              </PieChart>
            </ResponsiveContainer>

            {/* Legend with details */}
            <div className="space-y-2 flex flex-col justify-center">
              {data.map((d, i) => (
                <div key={i} className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/30 transition-colors">
                  <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: d.color }} />
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] font-bold truncate">{d.name}</p>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className="text-[10px] font-black font-fira-code">{d.value}</span>
                    <span className="text-[9px] text-muted-foreground">({((d.value / total) * 100).toFixed(1)}%)</span>
                    {d.wins > 0 && (
                      <span className="text-[9px] text-emerald-600 font-bold">{d.wins} ganhos</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
