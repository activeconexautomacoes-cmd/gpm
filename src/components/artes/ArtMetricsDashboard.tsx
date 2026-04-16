import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { Palette, Clock, CheckCircle, AlertCircle, Loader2, CalendarIcon, User, Users } from "lucide-react";
import { format, subDays, startOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useArtMetrics } from "@/hooks/useArtes";
import { ART_STATUS_CONFIG } from "@/types/artes";

function formatHours(hours: number): string {
  if (hours < 1) return `${Math.round(hours * 60)}min`;
  if (hours < 24) return `${Math.round(hours)}h`;
  const days = Math.floor(hours / 24);
  const remainHours = Math.round(hours % 24);
  return remainHours > 0 ? `${days}d ${remainHours}h` : `${days}d`;
}

export function ArtMetricsDashboard() {
  const [dateFrom, setDateFrom] = useState<Date>(startOfMonth(new Date()));
  const [dateTo, setDateTo] = useState<Date>(new Date());

  const fromStr = format(dateFrom, "yyyy-MM-dd");
  const toStr = format(dateTo, "yyyy-MM-dd");

  const { data: metrics, isLoading } = useArtMetrics(fromStr, toStr);

  const presets = [
    { label: "Hoje", fn: () => { setDateFrom(new Date()); setDateTo(new Date()); } },
    { label: "7 dias", fn: () => { setDateFrom(subDays(new Date(), 7)); setDateTo(new Date()); } },
    { label: "30 dias", fn: () => { setDateFrom(subDays(new Date(), 30)); setDateTo(new Date()); } },
    { label: "Este mês", fn: () => { setDateFrom(startOfMonth(new Date())); setDateTo(new Date()); } },
  ];

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!metrics) return null;

  const monthData = Object.entries(metrics.byMonth)
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-6)
    .map(([month, count]) => ({ month: month.substring(5), artes: count }));

  const gestorData = Object.entries(metrics.byGestor)
    .sort(([, a], [, b]) => b - a)
    .map(([name, count]) => ({ name: name.split(" ")[0], total: count }));

  const designerData = Object.entries(metrics.byDesigner)
    .sort(([, a], [, b]) => b - a)
    .map(([name, count]) => ({
      name: name.split(" ")[0],
      atribuidas: count,
      concluidas: metrics.completedByDesigner[name] || 0,
    }));

  const tempoDesignerData = Object.entries(metrics.avgHoursByDesigner)
    .sort(([, a], [, b]) => a - b)
    .map(([name, hours]) => ({ name: name.split(" ")[0], horas: Math.round(hours * 10) / 10 }));

  return (
    <div className="space-y-6">
      {/* Date Filter */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="justify-start text-left font-normal">
                <CalendarIcon className="mr-2 h-4 w-4" />
                {format(dateFrom, "dd/MM/yyyy", { locale: ptBR })}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0">
              <Calendar mode="single" selected={dateFrom} onSelect={(d) => d && setDateFrom(d)} locale={ptBR} />
            </PopoverContent>
          </Popover>
          <span className="text-muted-foreground">até</span>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="justify-start text-left font-normal">
                <CalendarIcon className="mr-2 h-4 w-4" />
                {format(dateTo, "dd/MM/yyyy", { locale: ptBR })}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0">
              <Calendar mode="single" selected={dateTo} onSelect={(d) => d && setDateTo(d)} locale={ptBR} />
            </PopoverContent>
          </Popover>
        </div>
        <div className="flex gap-1">
          {presets.map((p) => (
            <Button key={p.label} variant="ghost" size="sm" onClick={p.fn} className="text-xs">
              {p.label}
            </Button>
          ))}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <Palette className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold">{metrics.solicitadas}</p>
              <p className="text-xs text-muted-foreground">Solicitadas</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-green-500/10">
              <CheckCircle className="h-5 w-5 text-green-500" />
            </div>
            <div>
              <p className="text-2xl font-bold">{metrics.concluidas}</p>
              <p className="text-xs text-muted-foreground">Concluídas</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-blue-500/10">
              <AlertCircle className="h-5 w-5 text-blue-500" />
            </div>
            <div>
              <p className="text-2xl font-bold">{metrics.solicitadas - metrics.concluidas}</p>
              <p className="text-xs text-muted-foreground">Em andamento</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-yellow-500/10">
              <Clock className="h-5 w-5 text-yellow-500" />
            </div>
            <div>
              <p className="text-2xl font-bold">{formatHours(metrics.avgHoursGeral)}</p>
              <p className="text-xs text-muted-foreground">Tempo médio geral</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Status Breakdown */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Artes por Status</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-5 gap-3">
            {Object.entries(ART_STATUS_CONFIG).map(([status, config]) => (
              <div key={status} className={`p-3 rounded-lg border text-center ${config.bgColor}`}>
                <p className={`text-xl font-bold ${config.color}`}>
                  {metrics.byStatus[status] || 0}
                </p>
                <p className="text-xs text-muted-foreground">{config.label}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Artes por mês */}
        {monthData.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Artes por Mês</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={monthData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="month" className="text-xs" />
                  <YAxis className="text-xs" />
                  <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px" }} />
                  <Bar dataKey="artes" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}

        {/* Tempo médio por designer */}
        {tempoDesignerData.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2">
                <Clock className="h-4 w-4" />
                Tempo Médio por Designer
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={tempoDesignerData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis type="number" className="text-xs" />
                  <YAxis dataKey="name" type="category" className="text-xs" width={80} />
                  <Tooltip
                    contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px" }}
                    formatter={(value: number) => [formatHours(value), "Tempo médio"]}
                  />
                  <Bar dataKey="horas" fill="#fdcb6e" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Artes por gestor */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <User className="h-4 w-4" />
              Artes Solicitadas por Gestor
            </CardTitle>
          </CardHeader>
          <CardContent>
            {gestorData.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">Sem dados</p>
            ) : (
              <div className="space-y-3">
                {gestorData.map((g) => (
                  <div key={g.name} className="flex items-center justify-between">
                    <span className="text-sm font-medium">{g.name}</span>
                    <div className="flex items-center gap-2">
                      <div className="h-2 rounded-full bg-primary" style={{ width: `${Math.max(20, (g.total / Math.max(...gestorData.map(x => x.total))) * 150)}px` }} />
                      <span className="text-sm font-bold w-8 text-right">{g.total}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Artes por designer (atribuídas vs concluídas) */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <Users className="h-4 w-4" />
              Desempenho por Designer
            </CardTitle>
          </CardHeader>
          <CardContent>
            {designerData.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">Sem dados</p>
            ) : (
              <div className="space-y-4">
                {designerData.map((d) => {
                  const avgTime = metrics.avgHoursByDesigner[
                    Object.keys(metrics.avgHoursByDesigner).find(k => k.startsWith(d.name)) || ""
                  ];
                  return (
                    <div key={d.name} className="space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">{d.name}</span>
                        {avgTime !== undefined && (
                          <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {formatHours(avgTime)}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-xs">
                        <div className="flex items-center gap-1">
                          <div className="h-2 w-2 rounded-full bg-blue-500" />
                          <span>Atribuídas: {d.atribuidas}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <div className="h-2 w-2 rounded-full bg-green-500" />
                          <span>Concluídas: {d.concluidas}</span>
                        </div>
                      </div>
                      <div className="flex gap-1 h-2">
                        <div className="bg-blue-500 rounded-full" style={{ width: `${(d.atribuidas / Math.max(...designerData.map(x => x.atribuidas))) * 100}%` }} />
                      </div>
                      <div className="flex gap-1 h-2">
                        <div className="bg-green-500 rounded-full" style={{ width: `${d.atribuidas > 0 ? (d.concluidas / d.atribuidas) * 100 : 0}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
