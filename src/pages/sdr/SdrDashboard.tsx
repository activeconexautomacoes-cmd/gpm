import { useState, useEffect, useMemo, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import {
  MessageSquare, UserCheck, Calendar, TrendingDown, TrendingUp, Users, Bot,
  Clock, AlertTriangle, Send, Loader2, ArrowUp, ArrowDown,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { cn } from "@/lib/utils";
import { format, differenceInHours, differenceInMinutes, subDays, startOfDay, eachDayOfInterval } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Lead {
  id: string;
  phone: string;
  name: string | null;
  instagram: string | null;
  site: string | null;
  faturamento: string | null;
  status: string;
  created_at: string;
  updated_at: string;
}

interface Conversation {
  phone: string;
  role: string;
  content: string;
  created_at: string;
}

interface Meeting {
  id: string;
  phone: string;
  lead_name: string | null;
  scheduled_at: string;
  status: string;
}

const STATUS_COLORS: Record<string, string> = {
  em_conversa: "bg-blue-500/10 text-blue-500 border-blue-500/20",
  qualificado: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20",
  agendado: "bg-violet-500/10 text-violet-500 border-violet-500/20",
  downsell: "bg-amber-500/10 text-amber-500 border-amber-500/20",
  encerrado: "bg-muted text-muted-foreground border-border",
};

const STATUS_LABELS: Record<string, string> = {
  em_conversa: "Em conversa",
  qualificado: "Qualificado",
  agendado: "Agendado",
  downsell: "Downsell",
  encerrado: "Encerrado",
};

function TrendBadge({ current, previous }: { current: number; previous: number }) {
  if (previous === 0 && current === 0) return null;
  const delta = previous > 0 ? ((current - previous) / previous) * 100 : current > 0 ? 100 : 0;
  const isUp = delta > 0;
  return (
    <span className={cn("text-[9px] font-black px-1.5 py-0.5 rounded-md inline-flex items-center gap-0.5",
      isUp ? "text-emerald-600 bg-emerald-500/10" : delta < 0 ? "text-rose-600 bg-rose-500/10" : "text-muted-foreground bg-muted"
    )}>
      {isUp ? <ArrowUp className="w-2.5 h-2.5" /> : <ArrowDown className="w-2.5 h-2.5" />}
      {Math.abs(delta).toFixed(0)}%
    </span>
  );
}

function getPeriodDates(period: string) {
  const now = new Date();
  let since: Date;
  if (period === "today") since = startOfDay(now);
  else if (period === "7d") since = subDays(now, 7);
  else since = subDays(now, 30);
  const days = Math.ceil((now.getTime() - since.getTime()) / (1000 * 60 * 60 * 24)) || 1;
  const prevSince = subDays(since, days);
  return { since, prevSince, now, days };
}

export default function SdrDashboard() {
  const { currentWorkspace } = useWorkspace();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState("30d");
  const [activeTab, setActiveTab] = useState("overview");
  const [statusFilter, setStatusFilter] = useState("all");

  // Chat state
  const [chatMessages, setChatMessages] = useState<{ role: string; content: string }[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const { since, prevSince, now, days } = useMemo(() => getPeriodDates(period), [period]);

  useEffect(() => {
    if (!currentWorkspace?.id) return;
    const fetchData = async () => {
      setLoading(true);
      const allSince = prevSince.toISOString();
      const [leadsRes, convsRes, meetingsRes] = await Promise.all([
        supabase.from("sdr_leads" as any).select("*").eq("workspace_id", currentWorkspace.id).gte("created_at", allSince).order("created_at", { ascending: false }),
        supabase.from("sdr_conversations" as any).select("phone, role, content, created_at").eq("workspace_id", currentWorkspace.id).gte("created_at", allSince).order("created_at", { ascending: true }),
        supabase.from("sdr_meetings" as any).select("*").eq("workspace_id", currentWorkspace.id).gte("created_at", allSince).order("scheduled_at", { ascending: false }),
      ]);
      setLeads((leadsRes.data as unknown as Lead[]) || []);
      setConversations((convsRes.data as unknown as Conversation[]) || []);
      setMeetings((meetingsRes.data as unknown as Meeting[]) || []);
      setLoading(false);
    };
    fetchData();
  }, [currentWorkspace?.id, period]);

  // Split data into current and previous period
  const currentLeads = useMemo(() => leads.filter(l => new Date(l.created_at) >= since), [leads, since]);
  const prevLeads = useMemo(() => leads.filter(l => { const d = new Date(l.created_at); return d >= prevSince && d < since; }), [leads, since, prevSince]);
  const currentConvs = useMemo(() => conversations.filter(c => new Date(c.created_at) >= since), [conversations, since]);
  const prevConvs = useMemo(() => conversations.filter(c => { const d = new Date(c.created_at); return d >= prevSince && d < since; }), [conversations, since, prevSince]);
  const currentMeetings = useMemo(() => meetings.filter(m => new Date(m.created_at) >= since), [meetings, since]);
  const prevMeetings = useMemo(() => meetings.filter(m => { const d = new Date(m.created_at); return d >= prevSince && d < since; }), [meetings, since, prevSince]);

  // ===== STATS =====
  const stats = useMemo(() => {
    const calcStats = (lds: Lead[], convs: Conversation[], mtgs: Meeting[]) => {
      const phones = new Set(convs.map(c => c.phone));
      const conversasIniciadas = phones.size;
      const phonesResponderam = new Set(convs.filter(c => c.role === "user").map(c => c.phone));
      const taxaResposta = conversasIniciadas > 0 ? (phonesResponderam.size / conversasIniciadas) * 100 : 0;
      const qualificados = lds.filter(l => l.status === "qualificado" || l.status === "agendado").length;
      const agendados = lds.filter(l => l.status === "agendado").length;
      const noShow = mtgs.filter(m => m.status === "scheduled" && new Date(m.scheduled_at) < new Date()).length;
      const downsell = lds.filter(l => l.status === "downsell").length;
      const encerrados = lds.filter(l => l.status === "encerrado").length;
      const dadosColetados = lds.filter(l => l.name && (l.instagram || l.site || l.faturamento)).length;
      const reunioesRealizadas = mtgs.filter(m => m.status === "completed" || m.status === "confirmed").length;
      return { conversasIniciadas, taxaResposta, qualificados, agendados, noShow, downsell, encerrados, dadosColetados, reunioesRealizadas, phonesResponderam: phonesResponderam.size };
    };
    return { current: calcStats(currentLeads, currentConvs, currentMeetings), prev: calcStats(prevLeads, prevConvs, prevMeetings) };
  }, [currentLeads, prevLeads, currentConvs, prevConvs, currentMeetings, prevMeetings]);

  // ===== FUNNEL =====
  const funnel = useMemo(() => {
    const s = stats.current;
    const steps = [
      { name: "Conversas iniciadas", count: s.conversasIniciadas },
      { name: "Responderam", count: s.phonesResponderam },
      { name: "Dados coletados", count: s.dadosColetados },
      { name: "Qualificados", count: s.qualificados },
      { name: "Agendados", count: s.agendados },
      { name: "Reuniao realizada", count: s.reunioesRealizadas },
      { name: "Downsell / Perdido", count: s.downsell + s.encerrados },
    ];
    return steps;
  }, [stats]);

  // ===== DAILY CHART =====
  const dailyChart = useMemo(() => {
    const interval = eachDayOfInterval({ start: since, end: now });
    return interval.map(day => {
      const dayStr = format(day, "dd/MM");
      const dayStart = startOfDay(day);
      const dayEnd = new Date(dayStart.getTime() + 86400000);
      const convs = currentConvs.filter(c => { const d = new Date(c.created_at); return d >= dayStart && d < dayEnd; });
      const phones = new Set(convs.map(c => c.phone));
      const dayLeads = currentLeads.filter(l => { const d = new Date(l.created_at); return d >= dayStart && d < dayEnd; });
      return {
        date: dayStr,
        Conversas: phones.size,
        Qualificados: dayLeads.filter(l => l.status === "qualificado" || l.status === "agendado").length,
        Agendados: dayLeads.filter(l => l.status === "agendado").length,
      };
    });
  }, [currentConvs, currentLeads, since, now]);

  // ===== BEST HOUR =====
  const hourChart = useMemo(() => {
    const hours: Record<string, number> = {};
    for (let h = 6; h < 22; h += 2) hours[`${h}-${h + 2}h`] = 0;
    currentConvs.filter(c => c.role === "user").forEach(c => {
      const h = new Date(c.created_at).getHours();
      const bucket = Math.floor(h / 2) * 2;
      if (bucket >= 6 && bucket < 22) hours[`${bucket}-${bucket + 2}h`] = (hours[`${bucket}-${bucket + 2}h`] || 0) + 1;
    });
    return Object.entries(hours).map(([faixa, msgs]) => ({ faixa, msgs }));
  }, [currentConvs]);

  // ===== RESPONSE TIME =====
  const avgResponseTime = useMemo(() => {
    const phoneFirstBot = new Map<string, Date>();
    const phoneFirstUser = new Map<string, Date>();
    currentConvs.forEach(c => {
      const d = new Date(c.created_at);
      if (c.role === "assistant" && !phoneFirstBot.has(c.phone)) phoneFirstBot.set(c.phone, d);
      if (c.role === "user" && phoneFirstBot.has(c.phone) && !phoneFirstUser.has(c.phone)) phoneFirstUser.set(c.phone, d);
    });
    let totalMin = 0, count = 0;
    phoneFirstUser.forEach((userDate, phone) => {
      const botDate = phoneFirstBot.get(phone);
      if (botDate) { totalMin += differenceInMinutes(userDate, botDate); count++; }
    });
    return count > 0 ? totalMin / count : 0;
  }, [currentConvs]);

  // ===== ABANDONMENT =====
  const abandonment = useMemo(() => {
    const stages: Record<string, number> = { "Saudacao": 0, "Nome": 0, "Instagram": 0, "Site": 0, "Faturamento": 0, "Agendamento": 0 };
    currentLeads.filter(l => l.status === "em_conversa").forEach(l => {
      const lastMsg = currentConvs.filter(c => c.phone === l.phone && c.role === "user").pop();
      if (!lastMsg || differenceInHours(new Date(), new Date(lastMsg.created_at)) < 24) return;
      if (!l.name) { stages["Saudacao"]++; return; }
      if (!l.instagram) { stages["Nome"]++; return; }
      if (!l.site) { stages["Instagram"]++; return; }
      if (!l.faturamento) { stages["Site"]++; return; }
      stages["Agendamento"]++;
    });
    const sorted = Object.entries(stages).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]);
    const total = sorted.reduce((s, [, v]) => s + v, 0);
    return { sorted, total };
  }, [currentLeads, currentConvs]);

  // ===== LOSS REASONS =====
  const lossReasons = useMemo(() => {
    const reasons: Record<string, number> = { "Fora do ICP": 0, "Sem resposta": 0, "Faturamento baixo": 0 };
    currentLeads.forEach(l => {
      if (l.status === "downsell") {
        const fat = parseFloat(l.faturamento?.replace(/[^\d]/g, "") || "0");
        if (fat > 0 && fat < 10000) reasons["Faturamento baixo"]++;
        else reasons["Fora do ICP"]++;
      }
      if (l.status === "encerrado") reasons["Sem resposta"]++;
    });
    return Object.entries(reasons).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]);
  }, [currentLeads]);

  // ===== HEATMAP =====
  const heatmap = useMemo(() => {
    const grid: number[][] = Array.from({ length: 7 }, () => Array(8).fill(0));
    currentConvs.filter(c => c.role === "user").forEach(c => {
      const d = new Date(c.created_at);
      const dow = d.getDay(); // 0=dom
      const h = d.getHours();
      const bucket = Math.floor((h - 6) / 2);
      if (bucket >= 0 && bucket < 8) grid[dow][bucket]++;
    });
    return grid;
  }, [currentConvs]);
  const heatmapMax = useMemo(() => Math.max(...heatmap.flat(), 1), [heatmap]);
  const dayLabels = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sab"];
  const hourLabels = ["6-8h", "8-10h", "10-12h", "12-14h", "14-16h", "16-18h", "18-20h", "20-22h"];

  // ===== FILTERED LEADS FOR TABLE =====
  const filteredLeads = useMemo(() => {
    let list = currentLeads;
    if (statusFilter === "sem_resposta") {
      list = list.filter(l => {
        if (l.status !== "em_conversa") return false;
        const lastMsg = currentConvs.filter(c => c.phone === l.phone && c.role === "user").pop();
        return !lastMsg || differenceInHours(new Date(), new Date(lastMsg.created_at)) > 24;
      });
    } else if (statusFilter !== "all") {
      list = list.filter(l => l.status === statusFilter);
    }
    return list;
  }, [currentLeads, currentConvs, statusFilter]);

  // ===== CHAT =====
  const handleChat = async () => {
    if (!chatInput.trim() || chatLoading) return;
    const userMsg = chatInput.trim();
    setChatInput("");
    setChatMessages(prev => [...prev, { role: "user", content: userMsg }]);
    setChatLoading(true);

    try {
      const messages = [
        ...chatMessages.map(m => ({ role: m.role, content: m.content })),
        { role: "user", content: userMsg },
      ];

      const res = await supabase.functions.invoke("sdr-chat", {
        body: { messages, workspace_id: currentWorkspace?.id },
      });

      if (res.data?.response) {
        setChatMessages(prev => [...prev, { role: "assistant", content: res.data.response }]);
      } else {
        setChatMessages(prev => [...prev, { role: "assistant", content: "Desculpa, nao consegui processar. Tenta de novo!" }]);
      }
    } catch {
      setChatMessages(prev => [...prev, { role: "assistant", content: "Erro ao processar. Tenta novamente!" }]);
    } finally {
      setChatLoading(false);
      setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
    }
  };

  const funnelColors = ["bg-violet-500", "bg-violet-400", "bg-blue-500", "bg-blue-400", "bg-emerald-500", "bg-emerald-400", "bg-amber-500"];

  if (loading) return <div className="p-6 text-center text-muted-foreground">Carregando...</div>;

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><Bot className="h-6 w-6" /> SDR AI — Maria Eduarda</h1>
          <p className="text-sm text-muted-foreground mt-1">Monitoramento completo</p>
        </div>
        <Select value={period} onValueChange={setPeriod}>
          <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="today">Hoje</SelectItem>
            <SelectItem value="7d">7 dias</SelectItem>
            <SelectItem value="30d">30 dias</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="overview">Visao Geral</TabsTrigger>
          <TabsTrigger value="leads">Leads</TabsTrigger>
          <TabsTrigger value="chat">Chat com Maria</TabsTrigger>
        </TabsList>

        {/* ==================== VISÃO GERAL ==================== */}
        <TabsContent value="overview" className="space-y-6 mt-4">
          {/* KPI Cards */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {[
              { label: "Conversas Iniciadas", value: stats.current.conversasIniciadas, prev: stats.prev.conversasIniciadas, icon: MessageSquare, color: "text-blue-500", border: "border-l-blue-500" },
              { label: "Taxa de Resposta", value: stats.current.taxaResposta, prev: stats.prev.taxaResposta, icon: Users, color: "text-blue-500", border: "border-l-blue-500", suffix: "%" },
              { label: "Qualificados", value: stats.current.qualificados, prev: stats.prev.qualificados, icon: UserCheck, color: "text-emerald-500", border: "border-l-emerald-500", sub: `${stats.current.conversasIniciadas > 0 ? ((stats.current.qualificados / stats.current.conversasIniciadas) * 100).toFixed(0) : 0}% conversao` },
              { label: "Agendados", value: stats.current.agendados, prev: stats.prev.agendados, icon: Calendar, color: "text-emerald-500", border: "border-l-emerald-500", sub: `${stats.current.qualificados > 0 ? ((stats.current.agendados / stats.current.qualificados) * 100).toFixed(0) : 0}% dos qualif.` },
              { label: "No-show", value: stats.current.noShow, prev: stats.prev.noShow, icon: AlertTriangle, color: "text-rose-500", border: "border-l-rose-500" },
              { label: "Downsell", value: stats.current.downsell, prev: stats.prev.downsell, icon: TrendingDown, color: "text-rose-500", border: "border-l-rose-500" },
            ].map((kpi) => (
              <Card key={kpi.label} className={cn("border-l-4", kpi.border)}>
                <CardContent className="pt-4 pb-3">
                  <div className="flex items-center gap-2 mb-1">
                    <kpi.icon className={cn("h-4 w-4", kpi.color)} />
                    <span className="text-[9px] text-muted-foreground font-bold uppercase tracking-wider">{kpi.label}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <p className="text-2xl font-black font-fira-code">{typeof kpi.value === "number" && kpi.suffix ? kpi.value.toFixed(1) + kpi.suffix : kpi.value}</p>
                    <TrendBadge current={kpi.value} previous={kpi.prev} />
                  </div>
                  {kpi.sub && <p className="text-[9px] text-muted-foreground mt-0.5">{kpi.sub}</p>}
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Funnel */}
          <Card>
            <CardHeader><CardTitle className="text-sm">Funil de Conversao</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {funnel.map((step, i) => {
                const maxCount = funnel[0].count || 1;
                const pct = maxCount > 0 ? (step.count / maxCount) * 100 : 0;
                const prevStep = i > 0 ? funnel[i - 1] : null;
                const convRate = prevStep && prevStep.count > 0 ? ((step.count / prevStep.count) * 100).toFixed(1) : null;
                return (
                  <div key={step.name}>
                    {i > 0 && convRate && (
                      <div className="text-center my-0.5">
                        <span className="text-[9px] text-muted-foreground/50">{convRate}%</span>
                      </div>
                    )}
                    <div className="flex items-center gap-3">
                      <span className="w-32 text-[10px] font-bold text-muted-foreground text-right shrink-0 uppercase">{step.name}</span>
                      <div className="flex-1 bg-muted/30 rounded-lg h-8 overflow-hidden">
                        <div className={cn("h-8 rounded-lg flex items-center px-3 transition-all", funnelColors[i])} style={{ width: `${Math.max(pct, 5)}%` }}>
                          <span className="text-white text-xs font-black">{step.count}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>

          {/* Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader><CardTitle className="text-sm">Evolucao Diaria</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={250}>
                  <LineChart data={dailyChart}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.1} />
                    <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 10 }} />
                    <Tooltip contentStyle={{ backgroundColor: "rgba(0,0,0,0.85)", border: "none", borderRadius: "12px", fontSize: "11px", color: "#fff" }} />
                    <Line type="monotone" dataKey="Conversas" stroke="#8B5CF6" strokeWidth={2} dot={false} />
                    <Line type="monotone" dataKey="Qualificados" stroke="#3B82F6" strokeWidth={2} dot={false} />
                    <Line type="monotone" dataKey="Agendados" stroke="#10B981" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="text-sm">Melhor Horario de Resposta</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={hourChart}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.1} />
                    <XAxis dataKey="faixa" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 10 }} />
                    <Tooltip contentStyle={{ backgroundColor: "rgba(0,0,0,0.85)", border: "none", borderRadius: "12px", fontSize: "11px", color: "#fff" }} />
                    <Bar dataKey="msgs" fill="#8B5CF6" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          {/* Small Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card>
              <CardContent className="pt-5 space-y-2">
                <div className="flex items-center gap-2"><Clock className="w-4 h-4 text-primary" /><span className="text-[10px] font-bold uppercase text-muted-foreground">Tempo Medio de Resposta</span></div>
                <p className="text-2xl font-black font-fira-code">
                  {avgResponseTime < 60 ? `${Math.round(avgResponseTime)}min` : `${(avgResponseTime / 60).toFixed(1)}h`}
                </p>
                <p className="text-[9px] text-muted-foreground">entre 1a msg do bot e resposta do lead</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-5 space-y-2">
                <div className="flex items-center gap-2"><AlertTriangle className="w-4 h-4 text-amber-500" /><span className="text-[10px] font-bold uppercase text-muted-foreground">Ponto de Abandono</span></div>
                {abandonment.sorted.length > 0 ? (
                  <div className="space-y-1.5">
                    {abandonment.sorted.slice(0, 3).map(([etapa, count]) => (
                      <div key={etapa} className="flex items-center justify-between">
                        <span className="text-xs font-medium">{etapa}</span>
                        <div className="flex items-center gap-2">
                          <div className="w-16 h-1.5 bg-muted rounded-full overflow-hidden">
                            <div className="h-full bg-amber-500 rounded-full" style={{ width: `${abandonment.total > 0 ? (count / abandonment.total) * 100 : 0}%` }} />
                          </div>
                          <span className="text-[10px] font-bold">{count}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : <p className="text-xs text-muted-foreground">Sem abandonos no periodo</p>}
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-5 space-y-2">
                <div className="flex items-center gap-2"><TrendingDown className="w-4 h-4 text-rose-500" /><span className="text-[10px] font-bold uppercase text-muted-foreground">Top Motivos de Perda</span></div>
                {lossReasons.length > 0 ? (
                  <div className="space-y-1.5">
                    {lossReasons.map(([motivo, count]) => {
                      const max = lossReasons[0][1] as number;
                      return (
                        <div key={motivo} className="flex items-center justify-between">
                          <span className="text-xs font-medium">{motivo}</span>
                          <div className="flex items-center gap-2">
                            <div className="w-16 h-1.5 bg-muted rounded-full overflow-hidden">
                              <div className="h-full bg-rose-500 rounded-full" style={{ width: `${(count / max) * 100}%` }} />
                            </div>
                            <span className="text-[10px] font-bold">{count}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : <p className="text-xs text-muted-foreground">Sem perdas no periodo</p>}
              </CardContent>
            </Card>
          </div>

          {/* Heatmap */}
          <Card>
            <CardHeader><CardTitle className="text-sm">Engajamento Semanal</CardTitle></CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr>
                      <th className="text-[9px] text-muted-foreground font-bold w-12"></th>
                      {hourLabels.map(h => <th key={h} className="text-[9px] text-muted-foreground font-bold text-center px-1">{h}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {dayLabels.map((day, di) => (
                      <tr key={day}>
                        <td className="text-[10px] font-bold text-muted-foreground pr-2">{day}</td>
                        {heatmap[di].map((val, hi) => (
                          <td key={hi} className="p-0.5">
                            <div className={cn("rounded-md h-8 flex items-center justify-center text-[9px] font-bold transition-colors",
                              val === 0 ? "bg-muted/20 text-muted-foreground/30" : "text-white"
                            )} style={val > 0 ? { backgroundColor: `rgba(139, 92, 246, ${Math.max(val / heatmapMax, 0.2)})` } : undefined}>
                              {val > 0 ? val : ""}
                            </div>
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ==================== LEADS ==================== */}
        <TabsContent value="leads" className="space-y-4 mt-4">
          <div className="flex items-center gap-2 flex-wrap">
            {[
              { value: "all", label: "Todos" },
              { value: "em_conversa", label: "Em conversa" },
              { value: "qualificado", label: "Qualificado" },
              { value: "agendado", label: "Agendado" },
              { value: "downsell", label: "Downsell" },
              { value: "sem_resposta", label: "Sem resposta" },
              { value: "encerrado", label: "Perdido" },
            ].map(f => (
              <Button key={f.value} variant={statusFilter === f.value ? "default" : "ghost"} size="sm" className="h-7 text-[10px] font-bold uppercase" onClick={() => setStatusFilter(f.value)}>
                {f.label}
              </Button>
            ))}
          </div>

          <Card>
            <CardContent className="pt-4">
              {filteredLeads.length === 0 ? (
                <p className="text-center py-8 text-muted-foreground text-sm">Nenhum lead encontrado</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-left text-muted-foreground">
                        <th className="pb-2 font-medium text-[10px] uppercase">Telefone</th>
                        <th className="pb-2 font-medium text-[10px] uppercase">Nome</th>
                        <th className="pb-2 font-medium text-[10px] uppercase">Instagram</th>
                        <th className="pb-2 font-medium text-[10px] uppercase">Faturamento</th>
                        <th className="pb-2 font-medium text-[10px] uppercase">Msgs</th>
                        <th className="pb-2 font-medium text-[10px] uppercase">Ultima</th>
                        <th className="pb-2 font-medium text-[10px] uppercase">Status</th>
                        <th className="pb-2 font-medium text-[10px] uppercase">Data</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredLeads.map(lead => {
                        const leadConvs = currentConvs.filter(c => c.phone === lead.phone);
                        const totalMsgs = leadConvs.length;
                        const lastUserMsg = leadConvs.filter(c => c.role === "user").pop();
                        const lastDate = lastUserMsg ? new Date(lastUserMsg.created_at) : null;
                        const isNoResponse = lead.status === "em_conversa" && lastDate && differenceInHours(new Date(), lastDate) > 24;

                        return (
                          <tr key={lead.id} className="border-b last:border-0 hover:bg-muted/30">
                            <td className="py-2.5 font-mono text-[10px]">{lead.phone}</td>
                            <td className="py-2.5 text-xs font-medium">{lead.name || "—"}</td>
                            <td className="py-2.5 text-xs">{lead.instagram || "—"}</td>
                            <td className="py-2.5 text-xs">{lead.faturamento || "—"}</td>
                            <td className="py-2.5 text-xs font-mono">{totalMsgs}</td>
                            <td className="py-2.5 text-[10px] text-muted-foreground">
                              {lastDate ? format(lastDate, "dd/MM HH:mm", { locale: ptBR }) : "—"}
                            </td>
                            <td className="py-2.5">
                              <Badge variant="outline" className={cn("text-[9px]",
                                isNoResponse ? "bg-muted text-muted-foreground border-border" : STATUS_COLORS[lead.status] || ""
                              )}>
                                {isNoResponse ? "Sem resposta" : STATUS_LABELS[lead.status] || lead.status}
                              </Badge>
                            </td>
                            <td className="py-2.5 text-[10px] text-muted-foreground">
                              {format(new Date(lead.created_at), "dd/MM HH:mm", { locale: ptBR })}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ==================== CHAT ==================== */}
        <TabsContent value="chat" className="mt-4">
          <Card className="h-[600px] flex flex-col">
            <CardHeader className="pb-2 border-b">
              <CardTitle className="text-sm flex items-center gap-2">
                <Bot className="w-4 h-4 text-violet-500" />
                Chat com Maria Eduarda
              </CardTitle>
              <p className="text-[10px] text-muted-foreground">Pergunte sobre leads, resultados, conversas...</p>
            </CardHeader>
            <CardContent className="flex-1 overflow-y-auto p-4 space-y-3">
              {chatMessages.length === 0 && (
                <div className="text-center py-12 text-muted-foreground">
                  <Bot className="w-10 h-10 mx-auto mb-3 text-violet-500/30" />
                  <p className="text-sm font-medium">Oi! Sou a Maria Eduarda.</p>
                  <p className="text-xs mt-1">Me pergunta qualquer coisa sobre os leads, conversas ou resultados.</p>
                </div>
              )}
              {chatMessages.map((msg, i) => (
                <div key={i} className={cn("flex", msg.role === "user" ? "justify-end" : "justify-start")}>
                  <div className={cn("max-w-[80%] rounded-2xl px-4 py-2.5 text-sm",
                    msg.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted"
                  )}>
                    <p className="whitespace-pre-wrap">{msg.content}</p>
                  </div>
                </div>
              ))}
              {chatLoading && (
                <div className="flex justify-start">
                  <div className="bg-muted rounded-2xl px-4 py-2.5"><Loader2 className="w-4 h-4 animate-spin" /></div>
                </div>
              )}
              <div ref={chatEndRef} />
            </CardContent>
            <div className="p-4 border-t flex gap-2">
              <Input
                placeholder="Pergunte sobre os leads..."
                value={chatInput}
                onChange={e => setChatInput(e.target.value)}
                onKeyDown={e => e.key === "Enter" && !e.shiftKey && handleChat()}
                className="flex-1"
              />
              <Button onClick={handleChat} disabled={chatLoading || !chatInput.trim()} size="icon">
                <Send className="w-4 h-4" />
              </Button>
            </div>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
