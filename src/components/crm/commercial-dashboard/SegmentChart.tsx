import { Card, CardContent } from "@/components/ui/card";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";
import { formatCurrency } from "@/utils/format";

export interface SegmentData {
  name: string;
  leads: number;
  wins: number;
  ganho: number;
}

interface Props {
  segments: SegmentData[];
}

const COLORS = ["#3B82F6", "#10B981", "#F59E0B", "#EF4444", "#8B5CF6", "#06B6D4", "#EC4899", "#14B8A6", "#F97316", "#6366F1"];

export function SegmentChart({ segments }: Props) {
  const data = segments.filter(s => s.wins > 0).slice(0, 10);
  const total = data.reduce((s, d) => s + d.ganho, 0);

  return (
    <Card className="overflow-hidden bg-white/40 dark:bg-black/40 backdrop-blur-md border-white/20 dark:border-white/10 shadow-sm">
      <CardContent className="p-6">
        <h3 className="text-[11px] font-black uppercase tracking-[0.15em] text-muted-foreground/70 mb-6">
          Ganhos por Segmento
        </h3>

        {data.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-8">Sem dados no periodo</p>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie
                  data={data}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={3}
                  dataKey="ganho"
                  nameKey="name"
                >
                  {data.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
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
                  formatter={(value: number) => [formatCurrency(value), "Ganho"]}
                />
              </PieChart>
            </ResponsiveContainer>

            <div className="space-y-2 flex flex-col justify-center">
              {data.map((d, i) => (
                <div key={i} className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/30 transition-colors">
                  <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] font-bold truncate">{d.name}</p>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className="text-[10px] font-black font-fira-code">{formatCurrency(d.ganho)}</span>
                    <span className="text-[9px] text-muted-foreground">{d.wins} vendas</span>
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
