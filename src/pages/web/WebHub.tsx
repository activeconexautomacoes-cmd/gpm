import { useMemo, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Loader2, Plus, Search, Code, CheckCircle, Clock, AlertCircle, CalendarIcon, ChevronLeft, ChevronRight } from "lucide-react";
import { format, subDays, startOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { WebKanbanBoard } from "@/components/web/WebKanbanBoard";
import { WebStatusBadge } from "@/components/web/WebStatusBadge";
import { WebTypeBadge } from "@/components/web/WebTypeBadge";
import { useWebRequests, useWebMetrics } from "@/hooks/useWeb";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { WEB_STATUS_CONFIG } from "@/types/web";

function formatHours(h: number): string {
  if (h < 1) return `${Math.round(h * 60)}min`;
  if (h < 24) return `${Math.round(h)}h`;
  const d = Math.floor(h / 24);
  const r = Math.round(h % 24);
  return r > 0 ? `${d}d ${r}h` : `${d}d`;
}

const PAGE_SIZE = 15;

export default function WebHub() {
  const { can, user } = useWorkspace();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { data: allRequests = [], isLoading } = useWebRequests();

  const myRequests = allRequests;
  const defaultTab = searchParams.get("tab") || "kanban";

  // List state
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [page, setPage] = useState(0);

  // Metrics state
  const [dateFrom, setDateFrom] = useState<Date>(startOfMonth(new Date()));
  const [dateTo, setDateTo] = useState<Date>(new Date());
  const { data: metrics } = useWebMetrics(format(dateFrom, "yyyy-MM-dd"), format(dateTo, "yyyy-MM-dd"));

  const filtered = useMemo(() => {
    let list = [...myRequests];
    if (search) {
      const q = search.toLowerCase();
      list = list.filter((r) => r.title.toLowerCase().includes(q) || r.description.toLowerCase().includes(q) || r.gestor?.full_name?.toLowerCase().includes(q));
    }
    if (statusFilter !== "all") list = list.filter((r) => r.status === statusFilter);
    return list;
  }, [myRequests, search, statusFilter]);

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paginated = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  const tabs = [
    { value: "kanban", label: "Kanban" },
    { value: "lista", label: "Demandas" },
    { value: "metricas", label: "Métricas" },
  ];

  if (isLoading) return <div className="flex items-center justify-center py-24"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Web Designer</h1>
          <p className="text-sm text-muted-foreground">Demandas de desenvolvimento web</p>
        </div>
        <Button onClick={() => navigate("/dashboard/web/nova")}>
          <Plus className="h-4 w-4 mr-2" /> Nova Demanda Web
        </Button>
      </div>

      <Tabs value={defaultTab} onValueChange={(t) => setSearchParams({ tab: t })}>
        <TabsList>
          {tabs.map((t) => <TabsTrigger key={t.value} value={t.value}>{t.label}</TabsTrigger>)}
        </TabsList>

        <TabsContent value="kanban" className="mt-4">
          <WebKanbanBoard requests={myRequests} />
        </TabsContent>

        <TabsContent value="lista" className="mt-4 space-y-4">
          <div className="flex flex-wrap gap-3">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Buscar..." value={search} onChange={(e) => { setSearch(e.target.value); setPage(0); }} className="pl-9" />
            </div>
            <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(0); }}>
              <SelectTrigger className="w-[160px]"><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="solicitada">Solicitada</SelectItem>
                <SelectItem value="realizando">Realizando</SelectItem>
                <SelectItem value="ajustando">Ajustando</SelectItem>
                <SelectItem value="concluida">Concluída</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {paginated.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground"><p>Nenhuma demanda encontrada</p></div>
          ) : (
            <div className="rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Título</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Prioridade</TableHead>
                    <TableHead>Prazo</TableHead>
                    <TableHead>Data</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginated.map((r) => (
                    <TableRow key={r.id} className="cursor-pointer hover:bg-muted/50" onClick={() => navigate(`/dashboard/web/${r.id}`)}>
                      <TableCell className="font-medium max-w-[250px] truncate">{r.title}</TableCell>
                      <TableCell><WebTypeBadge type={r.request_type} /></TableCell>
                      <TableCell><WebStatusBadge status={r.status} /></TableCell>
                      <TableCell>{r.priority === "urgente" ? <Badge variant="destructive" className="text-xs">Urgente</Badge> : <span className="text-xs text-muted-foreground">Normal</span>}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{r.deadline ? format(new Date(r.deadline), "dd/MM/yy", { locale: ptBR }) : "-"}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{format(new Date(r.created_at), "dd/MM/yy", { locale: ptBR })}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
          {totalPages > 1 && (
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">{filtered.length} demanda(s)</p>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="icon" disabled={page === 0} onClick={() => setPage((p) => p - 1)}><ChevronLeft className="h-4 w-4" /></Button>
                <span className="text-sm">{page + 1} / {totalPages}</span>
                <Button variant="outline" size="icon" disabled={page >= totalPages - 1} onClick={() => setPage((p) => p + 1)}><ChevronRight className="h-4 w-4" /></Button>
              </div>
            </div>
          )}
        </TabsContent>

        <TabsContent value="metricas" className="mt-4 space-y-6">
          {/* Date filter */}
          <div className="flex flex-wrap items-center gap-3">
            <Popover>
              <PopoverTrigger asChild><Button variant="outline"><CalendarIcon className="mr-2 h-4 w-4" />{format(dateFrom, "dd/MM/yyyy", { locale: ptBR })}</Button></PopoverTrigger>
              <PopoverContent className="w-auto p-0"><Calendar mode="single" selected={dateFrom} onSelect={(d) => d && setDateFrom(d)} locale={ptBR} /></PopoverContent>
            </Popover>
            <span className="text-muted-foreground">até</span>
            <Popover>
              <PopoverTrigger asChild><Button variant="outline"><CalendarIcon className="mr-2 h-4 w-4" />{format(dateTo, "dd/MM/yyyy", { locale: ptBR })}</Button></PopoverTrigger>
              <PopoverContent className="w-auto p-0"><Calendar mode="single" selected={dateTo} onSelect={(d) => d && setDateTo(d)} locale={ptBR} /></PopoverContent>
            </Popover>
            <div className="flex gap-1">
              {[{ l: "Hoje", fn: () => { setDateFrom(new Date()); setDateTo(new Date()); } }, { l: "7d", fn: () => { setDateFrom(subDays(new Date(), 7)); setDateTo(new Date()); } }, { l: "30d", fn: () => { setDateFrom(subDays(new Date(), 30)); setDateTo(new Date()); } }, { l: "Mês", fn: () => { setDateFrom(startOfMonth(new Date())); setDateTo(new Date()); } }].map((p) => (
                <Button key={p.l} variant="ghost" size="sm" onClick={p.fn} className="text-xs">{p.l}</Button>
              ))}
            </div>
          </div>

          {metrics && (
            <>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Card><CardContent className="p-4 flex items-center gap-3"><div className="p-2 rounded-lg bg-primary/10"><Code className="h-5 w-5 text-primary" /></div><div><p className="text-2xl font-bold">{metrics.total}</p><p className="text-xs text-muted-foreground">Total</p></div></CardContent></Card>
                <Card><CardContent className="p-4 flex items-center gap-3"><div className="p-2 rounded-lg bg-green-500/10"><CheckCircle className="h-5 w-5 text-green-500" /></div><div><p className="text-2xl font-bold">{metrics.concluidas}</p><p className="text-xs text-muted-foreground">Concluídas</p></div></CardContent></Card>
                <Card><CardContent className="p-4 flex items-center gap-3"><div className="p-2 rounded-lg bg-blue-500/10"><AlertCircle className="h-5 w-5 text-blue-500" /></div><div><p className="text-2xl font-bold">{metrics.total - metrics.concluidas}</p><p className="text-xs text-muted-foreground">Em andamento</p></div></CardContent></Card>
                <Card><CardContent className="p-4 flex items-center gap-3"><div className="p-2 rounded-lg bg-yellow-500/10"><Clock className="h-5 w-5 text-yellow-500" /></div><div><p className="text-2xl font-bold">{formatHours(metrics.avgHours)}</p><p className="text-xs text-muted-foreground">Tempo médio</p></div></CardContent></Card>
              </div>

              <Card>
                <CardHeader><CardTitle className="text-sm">Por Status</CardTitle></CardHeader>
                <CardContent>
                  <div className="grid grid-cols-4 gap-3">
                    {Object.entries(WEB_STATUS_CONFIG).map(([s, cfg]) => (
                      <div key={s} className={`p-3 rounded-lg border text-center ${cfg.bgColor}`}>
                        <p className={`text-xl font-bold ${cfg.color}`}>{metrics.byStatus[s] || 0}</p>
                        <p className="text-xs text-muted-foreground">{cfg.label}</p>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {Object.keys(metrics.byMonth).length > 0 && (
                <Card>
                  <CardHeader><CardTitle className="text-sm">Por Mês</CardTitle></CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={220}>
                      <BarChart data={Object.entries(metrics.byMonth).sort(([a], [b]) => a.localeCompare(b)).map(([m, c]) => ({ month: m.substring(5), demandas: c }))}>
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
            </>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
