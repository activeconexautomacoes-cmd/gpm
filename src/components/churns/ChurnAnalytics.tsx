import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from "recharts";
import { format } from "date-fns";

interface ChurnAnalyticsProps {
  churns: any[];
}

const COLORS = ["#ef4444", "#f97316", "#eab308", "#22c55e", "#3b82f6"];

export function ChurnAnalytics({ churns }: ChurnAnalyticsProps) {
  // Group churns by month
  const churnsByMonth = churns.reduce((acc, churn) => {
    const month = format(new Date(churn.churn_date), "MMM/yy");
    if (!acc[month]) {
      acc[month] = { month, count: 0, mrr: 0 };
    }
    acc[month].count += 1;
    acc[month].mrr += Number(churn.mrr_lost);
    return acc;
  }, {} as Record<string, { month: string; count: number; mrr: number }>);

  const monthlyData = Object.values(churnsByMonth);

  // Group churns by reason
  const churnsByReason = churns.reduce((acc, churn) => {
    const reason = churn.reason_type || "Não especificado";
    if (!acc[reason]) {
      acc[reason] = { name: reason, value: 0 };
    }
    acc[reason].value += 1;
    return acc;
  }, {} as Record<string, { name: string; value: number }>);

  const reasonData = Object.values(churnsByReason);

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Churns por Mês</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={monthlyData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis />
              <Tooltip
                formatter={(value: number, name: string) => {
                  if (name === "mrr") {
                    return [`R$ ${value.toFixed(2)}`, "MRR Perdido"];
                  }
                  return [value, "Churns"];
                }}
              />
              <Legend />
              <Bar dataKey="count" fill="#ef4444" name="Churns" />
              <Bar dataKey="mrr" fill="#f97316" name="MRR Perdido" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Motivos de Cancelamento</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={reasonData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, percent }) =>
                  `${name}: ${(percent * 100).toFixed(0)}%`
                }
                outerRadius={80}
                fill="#8884d8"
                dataKey="value"
              >
                {reasonData.map((entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={COLORS[index % COLORS.length]}
                  />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}
