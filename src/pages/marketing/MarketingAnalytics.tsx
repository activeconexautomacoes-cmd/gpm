import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { useCommercialDashboardData } from "@/components/crm/commercial-dashboard/useCommercialDashboardData";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BarChart3, TrendingUp, Users, DollarSign, Target, Plus, Trash2, Calendar, ChevronRight, Wallet } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { format, subDays, startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval, parseISO, isWithinInterval } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useToast } from "@/hooks/use-toast";

type Opportunity = {
  id: string;
  lead_name: string;
  source: string | null;
  current_stage_id: string;
  created_at: string;
  won_at: string | null;
  lost_at: string | null;
  session_scheduled_at: string | null;
  negotiated_value: string | null;
  custom_fields: Record<string, string> | null;
  stage_name?: string;
  is_final?: boolean;
};

type AdSpend = {
  id: string;
  date: string;
  amount: number;
  notes: string | null;
};

type StageInfo = {
  id: string;
  name: string;
  is_final: boolean;
  is_sql?: boolean;
  is_disqualified?: boolean;
  order_position?: number;
};

const PERIOD_OPTIONS = [
  { value: "7d", label: "Últimos 7 dias" },
  { value: "30d", label: "Últimos 30 dias" },
  { value: "this_month", label: "Este mês" },
  { value: "last_month", label: "Mês passado" },
  { value: "90d", label: "Últimos 90 dias" },
];

function getDateRange(period: string): { start: Date; end: Date } {
  const now = new Date();
  switch (period) {
    case "7d": return { start: subDays(now, 7), end: now };
    case "30d": return { start: subDays(now, 30), end: now };
    case "this_month": return { start: startOfMonth(now), end: now };
    case "last_month": {
      const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      return { start: startOfMonth(lastMonth), end: endOfMonth(lastMonth) };
    }
    case "90d": return { start: subDays(now, 90), end: now };
    default: return { start: subDays(now, 30), end: now };
  }
}

function normalizeChannel(opp: Opportunity): string {
  // Prioriza webhook_name quando existe
  const webhookName = opp.custom_fields?.webhook_name;
  if (webhookName) {
    if (webhookName === "Funil VSL") return "VSL 01";
    return webhookName;
  }

  // Fallback pra source/utm quando não tem webhook
  const utm = opp.custom_fields?.utm_source;
  if (utm === "ig" || utm === "instagram") return "Instagram Orgânico";

  const source = opp.source;
  if (source === "website") return "Website";
  if (source === "manual") return "Manual";
  if (source === "instagram") return "Instagram";
  if (source === "ads") return "Ads";
  if (source === "prospection") return "Prospecção";
  if (source === "social_selling") return "Social Selling";
  if (source === "sdr_ai") return "SDR IA";
  return source || "Não informado";
}

function normalizeCreative(opp: Opportunity): string {
  const content = opp.custom_fields?.utm_content;
  if (!content || content === "{{ad.name}}") return "Sem criativo";
  return content;
}

function normalizeCampaign(opp: Opportunity): string {
  const campaign = opp.custom_fields?.utm_campaign;
  if (!campaign || campaign === "{{campaign.name}}") return "Sem campanha";
  const match = campaign.match(/\[([^\]]+)\]/);
  return match ? match[1] : campaign;
}

export default function MarketingAnalytics() {
  const { currentWorkspace } = useWorkspace();
  const [period, setPeriod] = useState("30d");
  const dateRange = getDateRange(period);

  const { data: stages = [] } = useQuery({
    queryKey: ["mkt-stages", currentWorkspace?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("opportunity_stages")
        .select("id, name, is_final, is_sql, is_disqualified, order_position")
        .eq("workspace_id", currentWorkspace!.id);
      return (data || []) as StageInfo[];
    },
    enabled: !!currentWorkspace?.id,
  });

  // Todas as oportunidades do workspace (com notes pra calcular agendamentos/realizados igual o comercial)
  const { data: allOppsRaw = [] } = useQuery({
    queryKey: ["mkt-opportunities-full", currentWorkspace?.id],
    queryFn: async () => {
      let allData: any[] = [];
      let page = 0;
      const pageSize = 1000;
      let hasMore = true;
      while (hasMore) {
        const { data, error } = await supabase
          .from("opportunities")
          .select(`*, opportunity_products (negotiated_price, negotiated_implementation_fee, products (name)), opportunity_stages (id, name, color), assigned_sdr_profile:profiles!assigned_sdr (full_name), assigned_closer_profile:profiles!assigned_closer (full_name)`)
          .eq("workspace_id", currentWorkspace!.id)
          .order("created_at", { ascending: false })
          .range(page * pageSize, (page + 1) * pageSize - 1);
        if (error) throw error;
        if (data && data.length > 0) { allData = [...allData, ...data]; hasMore = data.length === pageSize; page++; }
        else hasMore = false;
      }
      // Buscar notes de stage_change
      const oppIds = allData.map(o => o.id);
      const notesMap: Record<string, any[]> = {};
      for (let i = 0; i < oppIds.length; i += 200) {
        const batch = oppIds.slice(i, i + 200);
        const { data: notes } = await supabase
          .from("opportunity_notes")
          .select("id, opportunity_id, note_type, content, scheduled_at, completed_at, created_at")
          .in("opportunity_id", batch)
          .in("note_type", ["stage_change"]);
        (notes || []).forEach((n: any) => {
          if (!notesMap[n.opportunity_id]) notesMap[n.opportunity_id] = [];
          notesMap[n.opportunity_id].push(n);
        });
      }
      return allData.map(opp => ({ ...opp, opportunity_notes: notesMap[opp.id] || [] }));
    },
    enabled: !!currentWorkspace?.id,
  });

  // Filtrar por período pra KPIs de marketing
  const createdInPeriod = useMemo(() =>
    allOppsRaw.filter(o => new Date(o.created_at) >= dateRange.start && new Date(o.created_at) <= dateRange.end),
    [allOppsRaw, dateRange]
  );
  const wonInPeriod = useMemo(() =>
    allOppsRaw.filter(o => o.won_at && new Date(o.won_at) >= dateRange.start && new Date(o.won_at) <= dateRange.end),
    [allOppsRaw, dateRange]
  );
  const opportunities = useMemo(() => {
    const map = new Map<string, Opportunity>();
    createdInPeriod.forEach(o => map.set(o.id, o as any));
    wonInPeriod.forEach(o => map.set(o.id, o as any));
    return Array.from(map.values());
  }, [createdInPeriod, wonInPeriod]);

  // Ad spend filtrado por período (pra KPIs)
  const { data: adSpend = [] } = useQuery({
    queryKey: ["mkt-ad-spend", currentWorkspace?.id, period],
    queryFn: async () => {
      const { data } = await (supabase
        .from("marketing_ad_spend" as any)
        .select("*")
        .eq("workspace_id", currentWorkspace!.id)
        .gte("date", format(dateRange.start, "yyyy-MM-dd"))
        .lte("date", format(dateRange.end, "yyyy-MM-dd"))
        .order("date", { ascending: false }) as any);
      return (data || []) as AdSpend[];
    },
    enabled: !!currentWorkspace?.id,
  });

  // Opportunities e ad spend COMPLETOS (sem filtro de data, pra seção "por dia")
  const { data: allOpportunities = [] } = useQuery({
    queryKey: ["mkt-opportunities-all", currentWorkspace?.id],
    queryFn: async () => {
      const { data } = await (supabase
        .from("opportunities")
        .select("id, lead_name, source, current_stage_id, created_at, won_at, lost_at, session_scheduled_at, negotiated_value, custom_fields")
        .eq("workspace_id", currentWorkspace!.id)
        .order("created_at", { ascending: false }) as any);
      return (data || []) as Opportunity[];
    },
    enabled: !!currentWorkspace?.id,
  });

  const { data: allAdSpend = [] } = useQuery({
    queryKey: ["mkt-ad-spend-complete", currentWorkspace?.id],
    queryFn: async () => {
      const { data } = await (supabase
        .from("marketing_ad_spend" as any)
        .select("*")
        .eq("workspace_id", currentWorkspace!.id)
        .order("date", { ascending: false }) as any);
      return (data || []) as AdSpend[];
    },
    enabled: !!currentWorkspace?.id,
  });

  // Enriquecer opportunities com stage info
  const enrichedOpps = useMemo(() => {
    const stageMap = new Map(stages.map(s => [s.id, s]));
    return opportunities.map(o => ({
      ...o,
      stage_name: stageMap.get(o.current_stage_id)?.name || "Desconhecido",
      is_final: stageMap.get(o.current_stage_id)?.is_final || false,
    }));
  }, [opportunities, stages]);

  // Usar o MESMO hook do comercial — garante números idênticos
  const commercialDateRange = useMemo(() => ({
    from: dateRange.start,
    to: period === "this_month" ? endOfMonth(dateRange.start) : dateRange.end,
  }), [dateRange, period]);

  const commercialData = useCommercialDashboardData(allOppsRaw, stages, commercialDateRange, null);

  // Métricas espelhadas do comercial + ad spend do marketing
  const totalLeads = commercialData.funnel[0]?.count || 0;
  const sqlLeads = commercialData.funnel[2]?.count || 0;
  const scheduledLeads = commercialData.funnel[3]?.count || 0;
  const meetingsDone = commercialData.funnel[4]?.count || 0;
  const wonLeads = commercialData.funnel[5]?.count || 0;
  const totalRevenue = commercialData.kpis.totalGanho.value;
  const lostLeads = enrichedOpps.filter(o => o.lost_at).length;

  const totalSpend = adSpend.reduce((sum, s) => sum + Number(s.amount), 0);
  const costPerLead = totalLeads > 0 ? totalSpend / totalLeads : 0;
  const conversionRate = totalLeads > 0 ? (wonLeads / totalLeads) * 100 : 0;
  const schedulingRate = totalLeads > 0 ? (scheduledLeads / totalLeads) * 100 : 0;
  const cac = wonLeads > 0 ? totalSpend / wonLeads : 0;
  const roi = totalSpend > 0 ? ((totalRevenue - totalSpend) / totalSpend) * 100 : 0;

  const costPerSql = sqlLeads > 0 ? totalSpend / sqlLeads : 0;
  const costPerScheduled = scheduledLeads > 0 ? totalSpend / scheduledLeads : 0;
  const costPerMeeting = meetingsDone > 0 ? totalSpend / meetingsDone : 0;

  // Por canal
  const byChannel = useMemo(() => {
    const stageMap = new Map(stages.map(s => [s.id, s]));
    const disqualifiedStageIds = new Set(stages.filter(s => s.is_disqualified).map(s => s.id));
    const map = new Map<string, { total: number; mql: number; won: number; lost: number; scheduled: number; revenue: number }>();
    enrichedOpps.forEach(o => {
      const ch = normalizeChannel(o);
      const curr = map.get(ch) || { total: 0, mql: 0, won: 0, lost: 0, scheduled: 0, revenue: 0 };
      curr.total++;
      const pos = stageMap.get(o.current_stage_id)?.order_position || 0;
      const isDq = disqualifiedStageIds.has(o.current_stage_id) || !!(o as any).disqualified_at;
      if (!isDq && pos >= 2 && pos !== 9) curr.mql++;
      if (o.won_at) { curr.won++; curr.revenue += Number(o.negotiated_value || 0); }
      if (o.lost_at) curr.lost++;
      if (o.session_scheduled_at) curr.scheduled++;
      map.set(ch, curr);
    });
    return Array.from(map.entries())
      .map(([channel, stats]) => ({
        channel,
        ...stats,
        rate: stats.total > 0 ? (stats.won / stats.total * 100) : 0,
        mqlRate: stats.total > 0 ? (stats.mql / stats.total * 100) : 0,
        scheduleRate: stats.total > 0 ? (stats.scheduled / stats.total * 100) : 0,
      }))
      .sort((a, b) => b.total - a.total);
  }, [enrichedOpps, stages]);

  // Por criativo
  const byCreative = useMemo(() => {
    const map = new Map<string, { total: number; won: number }>();
    enrichedOpps.forEach(o => {
      const creative = normalizeCreative(o);
      const curr = map.get(creative) || { total: 0, won: 0 };
      curr.total++;
      if (o.won_at) curr.won++;
      map.set(creative, curr);
    });
    return Array.from(map.entries())
      .filter(([name]) => name !== "Sem criativo")
      .map(([creative, stats]) => ({ creative, ...stats, rate: stats.total > 0 ? (stats.won / stats.total * 100) : 0 }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 15);
  }, [enrichedOpps]);

  // Por dia (para gráfico simples)
  // byDay usa dados COMPLETOS (sem filtro de período)
  const byDay = useMemo(() => {
    // Encontrar range das datas que existem nos dados
    const allDates = new Set<string>();
    allOpportunities.forEach(o => allDates.add(format(new Date(o.created_at), "yyyy-MM-dd")));
    allAdSpend.forEach(s => allDates.add(s.date));
    if (allDates.size === 0) return [];

    const sortedDates = Array.from(allDates).sort();
    const start = parseISO(sortedDates[0]);
    const end = parseISO(sortedDates[sortedDates.length - 1]);
    const days = eachDayOfInterval({ start, end });

    return days.map(day => {
      const dayStr = format(day, "yyyy-MM-dd");
      const leads = allOpportunities.filter(o => format(new Date(o.created_at), "yyyy-MM-dd") === dayStr).length;
      const spend = allAdSpend.find(s => s.date === dayStr);
      const dayOfWeek = format(day, "EEE", { locale: ptBR });
      return {
        date: dayStr,
        label: format(day, "dd/MM", { locale: ptBR }),
        dayOfWeek,
        leads,
        spend: spend ? Number(spend.amount) : 0,
        cpl: leads > 0 && spend ? Number(spend.amount) / leads : 0,
      };
    });
  }, [allOpportunities, allAdSpend]);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Analytics de Marketing</h1>
          <p className="text-muted-foreground text-sm">Performance de aquisição e custo por lead</p>
        </div>
        <Select value={period} onValueChange={setPeriod}>
          <SelectTrigger className="w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PERIOD_OPTIONS.map(p => (
              <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Tabs defaultValue="dashboard">
        <TabsList>
          <TabsTrigger value="dashboard" className="gap-2">
            <BarChart3 className="h-4 w-4" /> Dashboard
          </TabsTrigger>
          <TabsTrigger value="spend" className="gap-2">
            <DollarSign className="h-4 w-4" /> Investimento
          </TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard" className="mt-4 space-y-6">
          {/* KPI Cards - Linha 1: Volume */}
          <div className="grid grid-cols-5 gap-4">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 text-muted-foreground text-xs font-medium mb-1">
                  <Users className="h-3.5 w-3.5" /> Total Leads
                </div>
                <div className="text-2xl font-bold">{totalLeads}</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 text-muted-foreground text-xs font-medium mb-1">
                  <Target className="h-3.5 w-3.5" /> SQLs
                </div>
                <div className="text-2xl font-bold">{sqlLeads}</div>
                <div className="text-xs text-muted-foreground">{totalLeads > 0 ? ((sqlLeads / totalLeads) * 100).toFixed(1) : 0}% dos leads</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 text-muted-foreground text-xs font-medium mb-1">
                  <Calendar className="h-3.5 w-3.5" /> Agendamentos
                </div>
                <div className="text-2xl font-bold">{scheduledLeads}</div>
                <div className="text-xs text-muted-foreground">{schedulingRate.toFixed(1)}% dos leads</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 text-muted-foreground text-xs font-medium mb-1">
                  <Users className="h-3.5 w-3.5" /> Reuniões Feitas
                </div>
                <div className="text-2xl font-bold">{meetingsDone}</div>
                <div className="text-xs text-muted-foreground">{scheduledLeads > 0 ? ((meetingsDone / scheduledLeads) * 100).toFixed(0) : 0}% dos agendados</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 text-muted-foreground text-xs font-medium mb-1">
                  <Target className="h-3.5 w-3.5" /> Ganhos
                </div>
                <div className="text-2xl font-bold text-green-500">{wonLeads}</div>
                <div className="text-xs text-muted-foreground">{conversionRate.toFixed(1)}% conversão</div>
              </CardContent>
            </Card>
          </div>

          {/* KPI Cards - Linha 2: Investimento e ROI */}
          <div className="grid grid-cols-3 gap-4">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 text-muted-foreground text-xs font-medium mb-1">
                  <DollarSign className="h-3.5 w-3.5" /> Investimento Total
                </div>
                <div className="text-2xl font-bold">R$ {totalSpend.toLocaleString("pt-BR", { minimumFractionDigits: 0 })}</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 text-muted-foreground text-xs font-medium mb-1">
                  <DollarSign className="h-3.5 w-3.5" /> Receita Gerada
                </div>
                <div className="text-2xl font-bold text-green-500">R$ {totalRevenue.toLocaleString("pt-BR", { minimumFractionDigits: 0 })}</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 text-muted-foreground text-xs font-medium mb-1">
                  <TrendingUp className="h-3.5 w-3.5" /> ROI
                </div>
                <div className={`text-2xl font-bold ${roi > 0 ? "text-green-500" : roi < 0 ? "text-red-500" : ""}`}>
                  {totalSpend > 0 ? `${roi.toFixed(0)}%` : "—"}
                </div>
                <div className="text-xs text-muted-foreground">{totalSpend > 0 ? `R$ ${(totalRevenue - totalSpend).toLocaleString("pt-BR", { minimumFractionDigits: 0 })} lucro` : "sem investimento"}</div>
              </CardContent>
            </Card>
          </div>

          {/* KPI Cards - Linha 3: Funil de custos */}
          <div className="grid grid-cols-5 gap-4">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 text-muted-foreground text-xs font-medium mb-1">
                  <DollarSign className="h-3.5 w-3.5" /> Custo por Lead
                </div>
                <div className="text-2xl font-bold">{costPerLead > 0 ? `R$ ${costPerLead.toFixed(2)}` : "—"}</div>
                <div className="text-xs text-muted-foreground">{totalLeads} leads</div>
              </CardContent>
            </Card>
            <Card className="border-primary/30 bg-primary/5">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 text-primary text-xs font-medium mb-1">
                  <Target className="h-3.5 w-3.5" /> Custo por SQL
                </div>
                <div className="text-2xl font-bold">{costPerSql > 0 ? `R$ ${costPerSql.toFixed(2)}` : "—"}</div>
                <div className="text-xs text-muted-foreground">{sqlLeads} SQLs</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 text-muted-foreground text-xs font-medium mb-1">
                  <Calendar className="h-3.5 w-3.5" /> Custo por Agend.
                </div>
                <div className="text-2xl font-bold">{costPerScheduled > 0 ? `R$ ${costPerScheduled.toFixed(2)}` : "—"}</div>
                <div className="text-xs text-muted-foreground">{scheduledLeads} agendados</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 text-muted-foreground text-xs font-medium mb-1">
                  <Users className="h-3.5 w-3.5" /> Custo por Reunião
                </div>
                <div className="text-2xl font-bold">{costPerMeeting > 0 ? `R$ ${costPerMeeting.toFixed(2)}` : "—"}</div>
                <div className="text-xs text-muted-foreground">{meetingsDone} realizadas</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 text-muted-foreground text-xs font-medium mb-1">
                  <DollarSign className="h-3.5 w-3.5" /> CAC
                </div>
                <div className="text-2xl font-bold">{cac > 0 ? `R$ ${cac.toFixed(2)}` : "—"}</div>
                <div className="text-xs text-muted-foreground">{wonLeads} clientes ganhos</div>
              </CardContent>
            </Card>
          </div>

          {/* Leads por período — agrupado por mês */}
          {(() => {
            const filteredDays = byDay.filter(d => d.leads > 0 || d.spend > 0).reverse();
            // Agrupar por mês
            const monthsMap = new Map<string, typeof filteredDays>();
            filteredDays.forEach(d => {
              const monthKey = d.date.substring(0, 7);
              const arr = monthsMap.get(monthKey) || [];
              arr.push(d);
              monthsMap.set(monthKey, arr);
            });
            const months = Array.from(monthsMap.entries())
              .map(([month, days]) => ({
                month,
                label: format(parseISO(month + "-01"), "MMMM yyyy", { locale: ptBR }),
                days,
                totalLeads: days.reduce((s, d) => s + d.leads, 0),
                totalSpend: days.reduce((s, d) => s + d.spend, 0),
              }))
              .sort((a, b) => b.month.localeCompare(a.month));

            return (
              <div className="space-y-3">
                <h3 className="text-base font-semibold">Leads x Investimento por Dia</h3>
                {months.map((m, idx) => {
                  const maxLeads = Math.max(...m.days.map(d => d.leads), 1);
                  const monthCpl = m.totalLeads > 0 ? m.totalSpend / m.totalLeads : 0;
                  return (
                    <Collapsible key={m.month} defaultOpen={idx === 0} className="group/daymonth">
                      <Card>
                        <CollapsibleTrigger asChild>
                          <CardHeader className="py-3 cursor-pointer hover:bg-muted/30 transition-colors">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <ChevronRight className="h-4 w-4 text-muted-foreground transition-transform duration-200 group-data-[state=open]/daymonth:rotate-90" />
                                <CardTitle className="text-base capitalize">{m.label}</CardTitle>
                                <Badge variant="secondary" className="text-xs">{m.days.length} dias</Badge>
                              </div>
                              <div className="flex items-center gap-6 text-sm">
                                <div className="text-right">
                                  <span className="font-bold">{m.totalLeads}</span>
                                  <span className="text-muted-foreground ml-1">leads</span>
                                </div>
                                <div className="text-right">
                                  <span className="font-bold">R$ {m.totalSpend.toLocaleString("pt-BR", { minimumFractionDigits: 0 })}</span>
                                  <span className="text-muted-foreground ml-1">investido</span>
                                </div>
                                {monthCpl > 0 && (
                                  <Badge variant="outline" className="text-xs font-mono">
                                    CPL R$ {monthCpl.toFixed(2)}
                                  </Badge>
                                )}
                              </div>
                            </div>
                          </CardHeader>
                        </CollapsibleTrigger>
                        <CollapsibleContent>
                          <CardContent className="pt-0">
                            <div className="rounded-lg border overflow-hidden">
                              <table className="w-full text-sm">
                                <thead>
                                  <tr className="border-b-2 bg-muted/30">
                                    <th className="text-left py-2.5 px-4 font-semibold text-xs uppercase tracking-wider text-muted-foreground">Dia</th>
                                    <th className="text-left py-2.5 px-4 font-semibold text-xs uppercase tracking-wider text-muted-foreground w-[180px]">Leads</th>
                                    <th className="text-right py-2.5 px-4 font-semibold text-xs uppercase tracking-wider text-muted-foreground">Investimento</th>
                                    <th className="text-right py-2.5 px-4 font-semibold text-xs uppercase tracking-wider text-muted-foreground">CPL</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {m.days.map((d, i) => (
                                    <tr key={d.date} className={`hover:bg-muted/40 transition-colors ${i % 2 === 0 ? "bg-muted/10" : ""}`}>
                                      <td className="py-2.5 px-4">
                                        <div className="flex items-center gap-2">
                                          <span className="font-medium">{format(parseISO(d.date), "dd")}</span>
                                          <span className="text-xs text-muted-foreground capitalize">{d.dayOfWeek}</span>
                                        </div>
                                      </td>
                                      <td className="py-2.5 px-4">
                                        <div className="flex items-center gap-3">
                                          <div className="flex-1 h-2.5 bg-muted rounded-full overflow-hidden">
                                            <div className="h-full bg-primary/70 rounded-full transition-all" style={{ width: `${(d.leads / maxLeads) * 100}%` }} />
                                          </div>
                                          <span className="font-semibold w-6 text-right text-xs">{d.leads}</span>
                                        </div>
                                      </td>
                                      <td className="py-2.5 px-4 text-right">
                                        {d.spend > 0 ? (
                                          <span className="font-medium text-xs">R$ {d.spend.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
                                        ) : (
                                          <span className="text-muted-foreground text-xs">—</span>
                                        )}
                                      </td>
                                      <td className="py-2.5 px-4 text-right">
                                        {d.cpl > 0 ? (
                                          <Badge variant={d.cpl < costPerLead ? "default" : "secondary"} className="text-[10px] font-mono">
                                            R$ {d.cpl.toFixed(2)}
                                          </Badge>
                                        ) : (
                                          <span className="text-muted-foreground text-xs">—</span>
                                        )}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </CardContent>
                        </CollapsibleContent>
                      </Card>
                    </Collapsible>
                  );
                })}
                {months.length === 0 && (
                  <Card><CardContent className="py-12 text-center text-muted-foreground">Sem dados no período</CardContent></Card>
                )}
              </div>
            );
          })()}

          <div className="grid grid-cols-2 gap-4">
            {/* Por Canal */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Performance por Canal</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {byChannel.map(ch => (
                    <div key={ch.channel} className="space-y-1.5">
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-medium">{ch.channel}</span>
                        <span className="text-muted-foreground">{ch.total} leads</span>
                      </div>
                      <div className="h-2 bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full bg-primary rounded-full transition-all"
                          style={{ width: `${byChannel[0] ? (ch.total / byChannel[0].total * 100) : 0}%` }}
                        />
                      </div>
                      <div className="flex items-center gap-3 text-xs">
                        <span className="text-blue-500">{ch.mql} MQL <span className="font-medium">({ch.mqlRate.toFixed(0)}%)</span></span>
                        <span className="text-muted-foreground">{ch.scheduled} agend. <span className="font-medium text-foreground">({ch.scheduleRate.toFixed(0)}%)</span></span>
                        <span className="text-green-500">{ch.won} ganhos <span className="font-medium">({ch.rate.toFixed(0)}%)</span></span>
                        {ch.revenue > 0 && <span className="text-muted-foreground">R$ {ch.revenue.toLocaleString("pt-BR", { minimumFractionDigits: 0 })}</span>}
                      </div>
                    </div>
                  ))}
                  {byChannel.length === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-4">Sem dados</p>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Por Criativo */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Top Criativos</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3 max-h-80 overflow-y-auto">
                  {byCreative.map((c, i) => (
                    <div key={c.creative} className="flex items-center justify-between text-sm gap-3">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-xs text-muted-foreground w-5 shrink-0">#{i + 1}</span>
                        <span className="font-medium truncate">{c.creative}</span>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <span className="text-muted-foreground">{c.total} leads</span>
                        <span className="text-green-500 font-medium">{c.won} ganhos</span>
                        <Badge variant="outline" className="text-xs">
                          {c.rate.toFixed(0)}%
                        </Badge>
                      </div>
                    </div>
                  ))}
                  {byCreative.length === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-4">Sem dados</p>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="spend" className="mt-4">
          <AdSpendTab workspaceId={currentWorkspace?.id} period={period} dateRange={dateRange} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// --- Aba de Investimento ---
function AdSpendTab({ workspaceId }: { workspaceId?: string; period: string; dateRange: { start: Date; end: Date } }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [newDate, setNewDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [newAmount, setNewAmount] = useState("");
  const [newNotes, setNewNotes] = useState("");

  const { data: spendEntries = [] } = useQuery({
    queryKey: ["mkt-ad-spend-all", workspaceId],
    queryFn: async () => {
      const { data } = await (supabase
        .from("marketing_ad_spend" as any)
        .select("*")
        .eq("workspace_id", workspaceId!)
        .order("date", { ascending: false })
        .limit(365) as any);
      return (data || []) as AdSpend[];
    },
    enabled: !!workspaceId,
  });

  const addSpend = useMutation({
    mutationFn: async () => {
      const res = await supabase.from("marketing_ad_spend" as any).upsert([{
        workspace_id: workspaceId,
        date: newDate,
        amount: parseFloat(newAmount),
        notes: newNotes || null,
      }] as any, { onConflict: "workspace_id,date" } as any);
      if (res.error) throw new Error(res.error.message);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["mkt-ad-spend"] });
      queryClient.invalidateQueries({ queryKey: ["mkt-ad-spend-all"] });
      toast({ title: "Investimento salvo" });
      setNewAmount("");
      setNewNotes("");
    },
    onError: (err: any) => {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    },
  });

  const deleteSpend = useMutation({
    mutationFn: async (id: string) => {
      const res = await (supabase.from("marketing_ad_spend" as any).delete().eq("id", id) as any);
      if (res.error) throw new Error(res.error.message);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["mkt-ad-spend"] });
      queryClient.invalidateQueries({ queryKey: ["mkt-ad-spend-all"] });
    },
  });

  // Agrupar por mês
  const byMonth = useMemo(() => {
    const map = new Map<string, AdSpend[]>();
    spendEntries.forEach(s => {
      const monthKey = s.date.substring(0, 7); // "2026-04"
      const arr = map.get(monthKey) || [];
      arr.push(s);
      map.set(monthKey, arr);
    });
    return Array.from(map.entries())
      .map(([month, entries]) => ({
        month,
        label: format(parseISO(month + "-01"), "MMMM yyyy", { locale: ptBR }),
        entries: entries.sort((a, b) => b.date.localeCompare(a.date)),
        total: entries.reduce((sum, e) => sum + Number(e.amount), 0),
        avgDaily: entries.reduce((sum, e) => sum + Number(e.amount), 0) / entries.length,
        days: entries.length,
      }))
      .sort((a, b) => b.month.localeCompare(a.month));
  }, [spendEntries]);

  const totalAll = spendEntries.reduce((sum, s) => sum + Number(s.amount), 0);
  const currentMonthData = byMonth.find(m => m.month === format(new Date(), "yyyy-MM"));

  return (
    <div className="space-y-6">
      {/* Resumo */}
      <div className="grid grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground text-xs font-medium mb-1">
              <Wallet className="h-3.5 w-3.5" /> Total Geral
            </div>
            <div className="text-2xl font-bold">R$ {totalAll.toLocaleString("pt-BR", { minimumFractionDigits: 0 })}</div>
            <div className="text-xs text-muted-foreground">{spendEntries.length} dias registrados</div>
          </CardContent>
        </Card>
        <Card className={currentMonthData ? "border-primary/30 bg-primary/5" : ""}>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-xs font-medium mb-1 text-primary">
              <Calendar className="h-3.5 w-3.5" /> Este Mês
            </div>
            <div className="text-2xl font-bold">R$ {(currentMonthData?.total || 0).toLocaleString("pt-BR", { minimumFractionDigits: 0 })}</div>
            <div className="text-xs text-muted-foreground">{currentMonthData?.days || 0} dias</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-xs font-medium text-muted-foreground mb-1">Média Diária (mês)</div>
            <div className="text-2xl font-bold">R$ {(currentMonthData?.avgDaily || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-xs font-medium text-muted-foreground mb-1">Meses Registrados</div>
            <div className="text-2xl font-bold">{byMonth.length}</div>
          </CardContent>
        </Card>
      </div>

      {/* Form de input */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Registrar Investimento</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-end gap-3">
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Data</label>
              <Input type="date" value={newDate} onChange={(e) => setNewDate(e.target.value)} className="w-40" />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Valor (R$)</label>
              <Input type="number" step="0.01" placeholder="0,00" value={newAmount} onChange={(e) => setNewAmount(e.target.value)} className="w-36" />
            </div>
            <div className="space-y-1 flex-1">
              <label className="text-xs font-medium text-muted-foreground">Observação (opcional)</label>
              <Input placeholder="Ex: Meta Ads, Google Ads..." value={newNotes} onChange={(e) => setNewNotes(e.target.value)} />
            </div>
            <Button onClick={() => addSpend.mutate()} disabled={!newAmount || parseFloat(newAmount) <= 0 || addSpend.isPending}>
              <Plus className="h-4 w-4 mr-1" />
              {addSpend.isPending ? "Salvando..." : "Adicionar"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Meses agrupados */}
      <div className="space-y-3">
        {byMonth.map((month, idx) => (
          <Collapsible key={month.month} defaultOpen={idx === 0} className="group/month">
            <Card>
              <CollapsibleTrigger asChild>
                <CardHeader className="pb-3 cursor-pointer hover:bg-muted/30 transition-colors">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <ChevronRight className="h-4 w-4 text-muted-foreground transition-transform duration-200 group-data-[state=open]/month:rotate-90" />
                      <CardTitle className="text-base capitalize">{month.label}</CardTitle>
                      <Badge variant="secondary" className="text-xs">{month.days} dias</Badge>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <div className="text-sm font-bold">R$ {month.total.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</div>
                        <div className="text-xs text-muted-foreground">média R$ {month.avgDaily.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}/dia</div>
                      </div>
                    </div>
                  </div>
                </CardHeader>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <CardContent className="pt-0">
                  <div className="rounded-lg border overflow-hidden">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b-2 bg-muted/30">
                          <th className="text-left py-2.5 px-4 font-semibold text-xs uppercase tracking-wider text-muted-foreground">Dia</th>
                          <th className="text-right py-2.5 px-4 font-semibold text-xs uppercase tracking-wider text-muted-foreground">Valor</th>
                          <th className="text-left py-2.5 px-4 font-semibold text-xs uppercase tracking-wider text-muted-foreground">Obs</th>
                          <th className="w-10"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {month.entries.map((s, i) => {
                          const dayDate = parseISO(s.date);
                          const dayOfWeek = format(dayDate, "EEE", { locale: ptBR });
                          return (
                            <tr key={s.id} className={`hover:bg-muted/40 transition-colors ${i % 2 === 0 ? "bg-muted/10" : ""}`}>
                              <td className="py-2.5 px-4">
                                <div className="flex items-center gap-2">
                                  <span className="font-medium">{format(dayDate, "dd", { locale: ptBR })}</span>
                                  <span className="text-xs text-muted-foreground capitalize">{dayOfWeek}</span>
                                </div>
                              </td>
                              <td className="py-2.5 px-4 text-right font-medium">
                                R$ {Number(s.amount).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                              </td>
                              <td className="py-2.5 px-4 text-muted-foreground text-xs">{s.notes || "—"}</td>
                              <td className="py-2.5 px-4">
                                <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-muted-foreground hover:text-red-500" onClick={() => deleteSpend.mutate(s.id)}>
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </CollapsibleContent>
            </Card>
          </Collapsible>
        ))}
        {byMonth.length === 0 && (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              Nenhum investimento registrado. Adicione acima.
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
