import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { ListTodo, Clock, CheckCircle, AlertCircle, CalendarIcon, User, Loader2 } from "lucide-react";
import { format, subDays, startOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/contexts/WorkspaceContext";

function formatHours(h: number): string {
  if (h < 1) return `${Math.round(h * 60)}min`;
  if (h < 24) return `${Math.round(h)}h`;
  const d = Math.floor(h / 24);
  const r = Math.round(h % 24);
  return r > 0 ? `${d}d ${r}h` : `${d}d`;
}

export function TaskMetrics() {
  const { currentWorkspace } = useWorkspace();
  const [dateFrom, setDateFrom] = useState<Date>(startOfMonth(new Date()));
  const [dateTo, setDateTo] = useState<Date>(new Date());

  const fromStr = format(dateFrom, "yyyy-MM-dd");
  const toStr = format(dateTo, "yyyy-MM-dd");

  const { data: metrics, isLoading } = useQuery({
    queryKey: ["task-metrics", currentWorkspace?.id, fromStr, toStr],
    queryFn: async () => {
      let query = (supabase as any)
        .from("tasks")
        .select("id, status, assignee_id, reporter_id, created_at, updated_at, assignee:assignee_id(id, full_name)")
        .eq("workspace_id", currentWorkspace!.id);

      query = query.gte("created_at", fromStr);
      query = query.lte("created_at", toStr + "T23:59:59");

      const { data, error } = await query;
      if (error) throw error;

      const all = (data || []) as any[];
      const concluidas = all.filter((t) => t.status === "done");

      // Total
      const total = all.length;

      // Por status
      const byStatus: Record<string, number> = {};
      all.forEach((t) => { byStatus[t.status] = (byStatus[t.status] || 0) + 1; });

      // Por assignee (gestor)
      const byAssignee: Record<string, { name: string; total: number; done: number; totalHours: number; doneCount: number }> = {};
      all.forEach((t) => {
        const name = t.assignee?.full_name || "Sem responsável";
        const key = t.assignee_id || "none";
        if (!byAssignee[key]) byAssignee[key] = { name, total: 0, done: 0, totalHours: 0, doneCount: 0 };
        byAssignee[key].total++;
        if (t.status === "done") {
          byAssignee[key].done++;
          const hours = (new Date(t.updated_at).getTime() - new Date(t.created_at).getTime()) / (1000 * 60 * 60);
          byAssignee[key].totalHours += hours;
          byAssignee[key].doneCount++;
        }
      });

      // Tempo médio geral
      let totalHoursGeral = 0;
      concluidas.forEach((t) => {
        totalHoursGeral += (new Date(t.updated_at).getTime() - new Date(t.created_at).getTime()) / (1000 * 60 * 60);
      });
      const avgHoursGeral = concluidas.length > 0 ? totalHoursGeral / concluidas.length : 0;

      // Por mês
      const byMonth: Record<string, number> = {};
      all.forEach((t) => {
        const month = t.created_at.substring(0, 7);
        byMonth[month] = (byMonth[month] || 0) + 1;
      });

      return {
        total,
        concluidas: concluidas.length,
        emAndamento: total - concluidas.length,
        avgHoursGeral,
        byStatus,
        byAssignee: Object.values(byAssignee).sort((a, b) => b.total - a.total),
        byMonth,
      };
    },
    enabled: !!currentWorkspace?.id,
  });

  const presets = [
    { label: "Hoje", fn: () => { setDateFrom(new Date()); setDateTo(new Date()); } },
    { label: "7 dias", fn: () => { setDateFrom(subDays(new Date(), 7)); setDateTo(new Date()); } },
    { label: "30 dias", fn: () => { setDateFrom(subDays(new Date(), 30)); setDateTo(new Date()); } },
    { label: "Este mês", fn: () => { setDateFrom(startOfMonth(new Date())); setDateTo(new Date()); } },
  ];

  if (isLoading) return <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;
  if (!metrics) return null;

  const monthData = Object.entries(metrics.byMonth)
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-6)
    .map(([m, c]) => ({ month: m.substring(5), demandas: c }));

  const assigneeTimeData = metrics.byAssignee
    .filter((a) => a.doneCount > 0)
    .map((a) => ({ name: a.name.split(" ")[0], horas: Math.round((a.totalHours / a.doneCount) * 10) / 10 }));

  return (
    <div className="space-y-6">
      {/* Date Filter */}
      <div className="flex flex-wrap items-center gap-3">
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline"><CalendarIcon className="mr-2 h-4 w-4" />{format(dateFrom, "dd/MM/yyyy", { locale: ptBR })}</Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0"><Calendar mode="single" selected={dateFrom} onSelect={(d) => d && setDateFrom(d)} locale={ptBR} /></PopoverContent>
        </Popover>
        <span className="text-muted-foreground">até</span>
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline"><CalendarIcon className="mr-2 h-4 w-4" />{format(dateTo, "dd/MM/yyyy", { locale: ptBR })}</Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0"><Calendar mode="single" selected={dateTo} onSelect={(d) => d && setDateTo(d)} locale={ptBR} /></PopoverContent>
        </Popover>
        <div className="flex gap-1">
          {presets.map((p) => (
            <Button key={p.label} variant="ghost" size="sm" onClick={p.fn} className="text-xs">{p.label}</Button>
          ))}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10"><ListTodo className="h-5 w-5 text-primary" /></div>
            <div><p className="text-2xl font-bold">{metrics.total}</p><p className="text-xs text-muted-foreground">Total Solicitadas</p></div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-green-500/10"><CheckCircle className="h-5 w-5 text-green-500" /></div>
            <div><p className="text-2xl font-bold">{metrics.concluidas}</p><p className="text-xs text-muted-foreground">Concluídas</p></div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-blue-500/10"><AlertCircle className="h-5 w-5 text-blue-500" /></div>
            <div><p className="text-2xl font-bold">{metrics.emAndamento}</p><p className="text-xs text-muted-foreground">Em andamento</p></div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-yellow-500/10"><Clock className="h-5 w-5 text-yellow-500" /></div>
            <div><p className="text-2xl font-bold">{formatHours(metrics.avgHoursGeral)}</p><p className="text-xs text-muted-foreground">Tempo médio geral</p></div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Demandas por mês */}
        {monthData.length > 0 && (
          <Card>
            <CardHeader><CardTitle className="text-sm">Demandas por Mês</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={monthData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="month" className="text-xs" />
                  <YAxis className="text-xs" />
                  <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px" }} />
                  <Bar dataKey="demandas" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}

        {/* Tempo médio por gestor */}
        {assigneeTimeData.length > 0 && (
          <Card>
            <CardHeader><CardTitle className="text-sm flex items-center gap-2"><Clock className="h-4 w-4" />Tempo Médio por Gestor</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={assigneeTimeData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis type="number" className="text-xs" />
                  <YAxis dataKey="name" type="category" className="text-xs" width={80} />
                  <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px" }} formatter={(value: number) => [formatHours(value), "Tempo médio"]} />
                  <Bar dataKey="horas" fill="#fdcb6e" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Demandas por Gestor */}
      <Card>
        <CardHeader><CardTitle className="text-sm flex items-center gap-2"><User className="h-4 w-4" />Demandas por Gestor</CardTitle></CardHeader>
        <CardContent>
          {metrics.byAssignee.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">Sem dados</p>
          ) : (
            <div className="space-y-4">
              {metrics.byAssignee.map((a, i) => {
                const avgTime = a.doneCount > 0 ? a.totalHours / a.doneCount : 0;
                return (
                  <div key={i} className="space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">{a.name}</span>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        {a.doneCount > 0 && (
                          <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{formatHours(avgTime)}</span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 text-xs">
                      <div className="flex items-center gap-1"><div className="h-2 w-2 rounded-full bg-blue-500" /><span>Total: {a.total}</span></div>
                      <div className="flex items-center gap-1"><div className="h-2 w-2 rounded-full bg-green-500" /><span>Concluídas: {a.done}</span></div>
                    </div>
                    <div className="flex gap-1 h-2">
                      <div className="bg-blue-500 rounded-full" style={{ width: `${(a.total / Math.max(...metrics.byAssignee.map(x => x.total))) * 100}%` }} />
                    </div>
                    <div className="flex gap-1 h-2">
                      <div className="bg-green-500 rounded-full" style={{ width: `${a.total > 0 ? (a.done / a.total) * 100 : 0}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
