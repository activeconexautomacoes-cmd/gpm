import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    LineChart,
    Line,
    Cell,
    PieChart,
    Pie,
    Legend
} from "recharts";
import {
    TrendingUp,
    Calendar,
    UserCheck,
    AlertCircle,
    ArrowUpRight,
    Filter,
    Search,
    DollarSign,
    Target,
    Clock,
    TrendingDown
} from "lucide-react";
import { format, subDays } from "date-fns";
import { formatCurrency } from "@/utils/format";
import { Badge } from "@/components/ui/badge";

interface CRMAnalyticsProps {
    opportunities: any[];
    stages: any[];
    quizzes?: any[];
}

export function CRMAnalytics({ opportunities, stages }: CRMAnalyticsProps) {
    const stats = useMemo(() => {
        const totalLeads = opportunities.length;
        const wins = opportunities.filter(o => o.won_at).length;

        const pipelineValue = opportunities
            .filter(o => !o.won_at && !o.lost_at)
            .reduce((sum, o) => sum + (Number(o.negotiated_value || o.estimated_value) || 0), 0);

        const activeOpportunities = opportunities.filter(o => !o.won_at && !o.lost_at).length;

        // SQLs are leads in stages marked as is_sql or that have a qualified_product
        const sqls = opportunities.filter(o => {
            const stage = stages.find(s => s.id === o.current_stage_id);
            return stage?.is_sql || o.qualified_product;
        }).length;

        const disqualified = opportunities.filter(o => {
            const stage = stages.find(s => s.id === o.current_stage_id);
            return stage?.is_disqualified;
        }).length;

        const meetingsScheduled = opportunities.filter(o => o.session_scheduled_at).length;
        const meetingsAttended = opportunities.filter(o => o.session_status === 'attended').length;
        const meetingsNoShow = opportunities.filter(o => o.session_status === 'no_show').length;

        const showRate = meetingsScheduled > 0 ? (meetingsAttended / meetingsScheduled) * 100 : 0;
        const winRate = totalLeads > 0 ? (wins / totalLeads) * 100 : 0;
        const sqlRate = totalLeads > 0 ? (sqls / totalLeads) * 100 : 0;

        return {
            totalLeads,
            wins,
            pipelineValue,
            activeOpportunities,
            sqls,
            disqualified,
            meetingsScheduled,
            meetingsAttended,
            meetingsNoShow,
            showRate,
            winRate,
            sqlRate,
            disqualifiedRate: totalLeads > 0 ? (disqualified / totalLeads) * 100 : 0
        };
    }, [opportunities, stages]);

    // Lead sources data
    const sourcesData = useMemo(() => {
        const counts: Record<string, number> = {};
        opportunities.forEach(o => {
            const source = o.source || 'Desconhecido';
            counts[source] = (counts[source] || 0) + 1;
        });
        return Object.entries(counts).map(([name, value]) => ({ name, value }));
    }, [opportunities]);

    // Conversion Funnel data
    const funnelData = useMemo(() => {
        return [
            { name: 'Leads', value: stats.totalLeads, fill: '#8884d8' },
            { name: 'Qualificados (SQL)', value: stats.sqls, fill: '#83a6ed' },
            { name: 'Reuniões', value: stats.meetingsScheduled, fill: '#8dd1e1' },
            { name: 'Fechamentos', value: stats.wins, fill: '#82ca9d' },
            { name: 'Desqualificados', value: stats.disqualified, fill: '#cbd5e1' },
        ];
    }, [stats]);

    // Monthly leads trend
    const trendData = useMemo(() => {
        const last30Days = Array.from({ length: 30 }).map((_, i) => {
            const date = subDays(new Date(), i);
            const dateStr = format(date, 'yyyy-MM-dd');
            return {
                date: format(date, 'dd/MM'),
                leads: opportunities.filter(o => o.created_at && o.created_at.startsWith(dateStr)).length,
                wins: opportunities.filter(o => o.won_at && o.won_at.startsWith(dateStr)).length,
                disqualified: opportunities.filter(o => {
                    const isSameDay = o.stage_changed_at && o.stage_changed_at.startsWith(dateStr);
                    const stage = stages.find(s => s.id === o.current_stage_id);
                    return isSameDay && stage?.is_disqualified;
                }).length
            };
        }).reverse();
        return last30Days;
    }, [opportunities]);

    // Team performance
    const teamPerfs = useMemo(() => {
        const closers: Record<string, { name: string, leads: number, wins: number, value: number }> = {};
        const sdrs: Record<string, { name: string, leads: number, sqls: number }> = {};

        opportunities.forEach(o => {
            if (o.assigned_closer_profile) {
                const id = o.assigned_closer;
                if (!closers[id]) closers[id] = { name: o.assigned_closer_profile.full_name, leads: 0, wins: 0, value: 0 };
                closers[id].leads++;
                if (o.won_at) {
                    closers[id].wins++;
                    closers[id].value += Number(o.negotiated_value || o.estimated_value || 0);
                }
            }
            if (o.assigned_sdr_profile) {
                const id = o.assigned_sdr;
                if (!sdrs[id]) sdrs[id] = { name: o.assigned_sdr_profile.full_name, leads: 0, sqls: 0 };
                sdrs[id].leads++;
                const stage = stages.find(s => s.id === o.current_stage_id);
                if (stage?.is_sql || o.qualified_product) sdrs[id].sqls++;
            }
        });

        return {
            closers: Object.values(closers).sort((a, b) => b.value - a.value),
            sdrs: Object.values(sdrs).sort((a, b) => b.sqls - a.sqls)
        };
    }, [opportunities, stages]);

    // Funnel Performance by Category (Quiz, Webhook LP, Webhook Webinar)
    const funnelPerformance = useMemo(() => {
        const categories: Record<string, { name: string, leads: number, scheduled: number, wins: number, lost: number, disqualified: number }> = {
            'quizzes': { name: 'Quizzes (Funil Interno)', leads: 0, scheduled: 0, wins: 0, lost: 0, disqualified: 0 },
            'webhook_lp': { name: 'Webhook (Landing Pages)', leads: 0, scheduled: 0, wins: 0, lost: 0, disqualified: 0 },
            'webhook_webinar': { name: 'Webhook c/ Webnário', leads: 0, scheduled: 0, wins: 0, lost: 0, disqualified: 0 }
        };

        opportunities.forEach(o => {
            const isWebinar = o.opportunity_tag_assignments?.some((a: any) => a.crm_tags?.name === "Webnário") || o.is_held;
            const isQuiz = o.quiz_submissions && o.quiz_submissions.length > 0;
            const isWebhook = o.source === 'webhook';

            let categoryKey = '';
            if (isQuiz) {
                categoryKey = 'quizzes';
            } else if (isWebhook) {
                categoryKey = isWebinar ? 'webhook_webinar' : 'webhook_lp';
            }

            if (categoryKey && categories[categoryKey]) {
                // If a specific webhook is being filtered, we show its name in the analytics
                const webhookName = (o.custom_fields as any)?.webhook_name;
                if (webhookName && categoryKey === 'webhook_lp') {
                    categories[categoryKey].name = `Webhook (${webhookName})`;
                }

                const stage = stages.find(s => s.id === o.current_stage_id);

                categories[categoryKey].leads++;
                if (o.session_scheduled_at) categories[categoryKey].scheduled++;
                if (o.won_at) categories[categoryKey].wins++;
                if (stage?.is_disqualified) categories[categoryKey].disqualified++;
                if (stage?.is_lost) categories[categoryKey].lost++;
            }
        });

        return Object.values(categories).filter(c => c.leads > 0);
    }, [opportunities, stages]);

    const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8'];

    return (
        <div className="space-y-10 animate-in fade-in duration-700">

            {/* Top Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <Card className="bg-white/40 dark:bg-white/5 border-white/60 dark:border-white/10 shadow-xl rounded-[32px] overflow-hidden group hover:scale-[1.02] transition-transform duration-300 backdrop-blur-md">
                    <CardContent className="p-8">
                        <div className="flex items-center justify-between mb-4">
                            <p className="text-[9px] font-black text-[#1D4ED8]/50 dark:text-white/40 uppercase tracking-[0.2em]">Valor do Pipeline</p>
                            <DollarSign className="h-4 w-4 text-[#3B82F6]" />
                        </div>
                        <div className="space-y-1">
                            <div className="text-2xl font-black text-[#1D4ED8] dark:text-white font-fira-code">
                                {formatCurrency(stats.pipelineValue)}
                            </div>
                            <div className="text-[10px] text-emerald-500 font-black uppercase tracking-widest">
                                Potencial de Fechamento
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card className="bg-white/40 dark:bg-white/5 border-white/60 dark:border-white/10 shadow-xl rounded-[32px] overflow-hidden group hover:scale-[1.02] transition-transform duration-300 backdrop-blur-md">
                    <CardContent className="p-8">
                        <div className="flex items-center justify-between mb-4">
                            <p className="text-[9px] font-black text-[#1D4ED8]/50 dark:text-white/40 uppercase tracking-[0.2em]">Oportunidades Ativas</p>
                            <Target className="h-4 w-4 text-blue-500" />
                        </div>
                        <div className="space-y-1">
                            <div className="text-3xl font-black text-[#1D4ED8] dark:text-white font-fira-code">{stats.activeOpportunities}</div>
                            <div className="text-[10px] text-[#1D4ED8]/40 dark:text-white/30 font-black uppercase tracking-widest">
                                Em Negociação
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card className="bg-white/40 dark:bg-white/5 border-white/60 dark:border-white/10 shadow-xl rounded-[32px] overflow-hidden group hover:scale-[1.02] transition-transform duration-300 backdrop-blur-md">
                    <CardContent className="p-8">
                        <div className="flex items-center justify-between mb-4">
                            <p className="text-[9px] font-black text-[#1D4ED8]/50 dark:text-white/40 uppercase tracking-[0.2em]">Conversão Final</p>
                            <TrendingUp className="h-4 w-4 text-emerald-500" />
                        </div>
                        <div className="space-y-1">
                            <div className="text-3xl font-black text-[#1D4ED8] dark:text-white font-fira-code">{stats.winRate.toFixed(1)}%</div>
                            <div className="text-[10px] text-emerald-500 font-black uppercase tracking-widest">
                                {stats.wins} Ganhos de {stats.totalLeads}
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card className="bg-white/40 dark:bg-white/5 border-white/60 dark:border-white/10 shadow-xl rounded-[32px] overflow-hidden group hover:scale-[1.02] transition-transform duration-300 backdrop-blur-md">
                    <CardContent className="p-8">
                        <div className="flex items-center justify-between mb-4">
                            <p className="text-[9px] font-black text-[#1D4ED8]/50 dark:text-white/40 uppercase tracking-[0.2em]">Total de Leads</p>
                            <Clock className="h-4 w-4 text-orange-500" />
                        </div>
                        <div className="space-y-1">
                            <div className="text-3xl font-black text-[#1D4ED8] dark:text-white font-fira-code">{stats.totalLeads}</div>
                            <div className="text-[10px] text-[#1D4ED8]/40 dark:text-white/30 font-black uppercase tracking-widest">
                                Histórico do Período
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <Card className="bg-white/40 dark:bg-white/5 border-white/60 dark:border-white/10 shadow-xl rounded-[32px] overflow-hidden group hover:scale-[1.02] transition-transform duration-300 backdrop-blur-md">
                    <CardContent className="p-8">
                        <div className="flex items-center justify-between mb-4">
                            <p className="text-[9px] font-black text-[#1D4ED8]/50 dark:text-white/40 uppercase tracking-[0.2em]">Qualificados (SQL)</p>
                            <UserCheck className="h-4 w-4 text-[#3B82F6]" />
                        </div>
                        <div className="space-y-1">
                            <div className="text-3xl font-black text-[#1D4ED8] dark:text-white font-fira-code">{stats.sqls}</div>
                            <div className="text-[10px] text-emerald-500 font-black uppercase tracking-widest">
                                {stats.sqlRate.toFixed(1)}% Qualificação
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card className="bg-white/40 dark:bg-white/5 border-white/60 dark:border-white/10 shadow-xl rounded-[32px] overflow-hidden group hover:scale-[1.02] transition-transform duration-300 backdrop-blur-md">
                    <CardContent className="p-8">
                        <div className="flex items-center justify-between mb-4">
                            <p className="text-[9px] font-black text-[#1D4ED8]/50 dark:text-white/40 uppercase tracking-[0.2em]">Taxa de Show</p>
                            <Calendar className="h-4 w-4 text-blue-500" />
                        </div>
                        <div className="space-y-1">
                            <div className="text-3xl font-black text-[#1D4ED8] dark:text-white font-fira-code">{stats.showRate.toFixed(1)}%</div>
                            <div className="text-[10px] text-[#1D4ED8]/40 dark:text-white/30 font-black uppercase tracking-widest">
                                Reuniões Realizadas
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card className="bg-white/40 dark:bg-white/5 border-white/60 dark:border-white/10 shadow-xl rounded-[32px] overflow-hidden group hover:scale-[1.02] transition-transform duration-300 backdrop-blur-md">
                    <CardContent className="p-8">
                        <div className="flex items-center justify-between mb-4">
                            <p className="text-[9px] font-black text-[#1D4ED8]/50 dark:text-white/40 uppercase tracking-[0.2em]">No Show</p>
                            <AlertCircle className="h-4 w-4 text-rose-500" />
                        </div>
                        <div className="space-y-1">
                            <div className="text-3xl font-black text-[#1D4ED8] dark:text-white font-fira-code">{stats.meetingsNoShow}</div>
                            <div className="text-[10px] text-rose-500/80 font-black uppercase tracking-widest">
                                Ausências em Reuniões
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card className="bg-white/40 dark:bg-white/5 border-white/60 dark:border-white/10 shadow-xl rounded-[32px] overflow-hidden group hover:scale-[1.02] transition-transform duration-300 backdrop-blur-md">
                    <CardContent className="p-8">
                        <div className="flex items-center justify-between mb-4">
                            <p className="text-[9px] font-black text-[#1D4ED8]/50 dark:text-white/40 uppercase tracking-[0.2em]">Desqualificados</p>
                            <TrendingDown className="h-4 w-4 text-slate-400" />
                        </div>
                        <div className="space-y-1">
                            <div className="text-3xl font-black text-[#1D4ED8] dark:text-white font-fira-code">{stats.disqualified}</div>
                            <div className="text-[10px] text-[#1D4ED8]/40 dark:text-white/30 font-black uppercase tracking-widest">
                                {stats.disqualifiedRate.toFixed(1)}% Perda
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Main Charts Row */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                <Card className="lg:col-span-8 bg-white/40 dark:bg-white/5 border-white/60 dark:border-white/10 shadow-xl rounded-[40px] overflow-hidden backdrop-blur-xl">
                    <CardHeader className="p-8 pb-4">
                        <CardTitle className="text-[10px] font-black uppercase tracking-[0.3em] text-[#3B82F6] dark:text-[#60A5FA]">Trend Line Analysis</CardTitle>
                    </CardHeader>
                    <CardContent className="p-8">
                        <div className="h-[400px] w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <LineChart data={trendData}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(124, 58, 237, 0.1)" />
                                    <XAxis
                                        dataKey="date"
                                        fontSize={10}
                                        tickLine={false}
                                        axisLine={false}
                                        tick={{ fill: 'currentColor', opacity: 0.5, fontWeight: 900 }}
                                    />
                                    <YAxis
                                        fontSize={10}
                                        tickLine={false}
                                        axisLine={false}
                                        tick={{ fill: 'currentColor', opacity: 0.5, fontWeight: 900 }}
                                    />
                                    <Tooltip
                                        contentStyle={{
                                            backgroundColor: 'rgba(10, 5, 16, 0.9)',
                                            border: '1px solid rgba(255,255,255,0.1)',
                                            borderRadius: '20px',
                                            fontSize: '11px',
                                            backdropFilter: 'blur(10px)',
                                            fontWeight: 'bold',
                                            textTransform: 'uppercase',
                                            letterSpacing: '0.1em'
                                        }}
                                        itemStyle={{ color: '#fff' }}
                                    />
                                    <Line type="monotone" dataKey="leads" stroke="#3B82F6" name="Leads" strokeWidth={4} dot={false} animationDuration={1500} />
                                    <Line type="monotone" dataKey="wins" stroke="#10B981" name="Vendas" strokeWidth={4} dot={false} animationDuration={1500} />
                                </LineChart>
                            </ResponsiveContainer>
                        </div>
                    </CardContent>
                </Card>

                <Card className="lg:col-span-4 bg-white/40 dark:bg-white/5 border-white/60 dark:border-white/10 shadow-xl rounded-[40px] overflow-hidden backdrop-blur-xl">
                    <CardHeader className="p-8 pb-4">
                        <CardTitle className="text-[10px] font-black uppercase tracking-[0.3em] text-[#3B82F6] dark:text-[#60A5FA]">Channel Distribution</CardTitle>
                    </CardHeader>
                    <CardContent className="p-8">
                        <div className="h-[400px] w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie
                                        data={sourcesData}
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={80}
                                        outerRadius={110}
                                        paddingAngle={8}
                                        dataKey="value"
                                        animationDuration={1500}
                                    >
                                        {sourcesData.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                        ))}
                                    </Pie>
                                    <Tooltip />
                                    <Legend verticalAlign="bottom" height={36} wrapperStyle={{ fontSize: '9px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.1em' }} />
                                </PieChart>
                            </ResponsiveContainer>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Funnel Row */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <Card className="bg-white/40 dark:bg-white/5 border-white/60 dark:border-white/10 shadow-xl rounded-[40px] overflow-hidden backdrop-blur-xl">
                    <CardHeader className="p-8 pb-4">
                        <CardTitle className="text-[10px] font-black uppercase tracking-[0.3em] text-[#3B82F6] dark:text-[#60A5FA]">Sales Conversion Flow</CardTitle>
                    </CardHeader>
                    <CardContent className="p-8">
                        <div className="h-[350px] w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={funnelData} layout="vertical" barSize={40}>
                                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="rgba(124, 58, 237, 0.1)" />
                                    <XAxis type="number" hide />
                                    <YAxis
                                        dataKey="name"
                                        type="category"
                                        fontSize={10}
                                        width={140}
                                        tickLine={false}
                                        axisLine={false}
                                        tick={{ fill: 'currentColor', opacity: 0.7, fontWeight: 900 }}
                                    />
                                    <Tooltip cursor={{ fill: 'rgba(124, 58, 237, 0.05)' }} />
                                    <Bar dataKey="value" radius={[0, 10, 10, 0]} animationDuration={1500}>
                                        {funnelData.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={entry.fill} fillOpacity={0.8} />
                                        ))}
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </CardContent>
                </Card>

                <Card className="bg-white/40 dark:bg-white/5 border-white/60 dark:border-white/10 shadow-xl rounded-[40px] overflow-hidden backdrop-blur-xl">
                    <CardHeader className="p-8 pb-4">
                        <CardTitle className="text-[10px] font-black uppercase tracking-[0.3em] text-[#3B82F6] dark:text-[#60A5FA]">Strategic Insights</CardTitle>
                    </CardHeader>
                    <CardContent className="p-8 space-y-6">
                        <div className="p-6 rounded-[24px] bg-[#3B82F6]/5 border border-[#3B82F6]/10 hover:bg-[#3B82F6]/10 transition-colors group">
                            <div className="flex items-center gap-4 mb-3">
                                <div className="p-3 bg-[#3B82F6]/10 rounded-2xl group-hover:scale-110 transition-transform">
                                    <ArrowUpRight className="w-5 h-5 text-[#3B82F6]" />
                                </div>
                                <div className="space-y-1">
                                    <h4 className="text-[11px] font-black uppercase tracking-widest text-[#1D4ED8] dark:text-white">Taxa de SQL</h4>
                                    <p className="text-[9px] text-[#1D4ED8]/40 dark:text-white/30 font-bold uppercase">Eficiência de Qualificação Inicial</p>
                                </div>
                            </div>
                            <div className="text-4xl font-black text-[#3B82F6] dark:text-[#60A5FA] font-fira-code">{stats.sqlRate.toFixed(1)}%</div>
                        </div>

                        <div className="p-6 rounded-[24px] bg-blue-500/5 border border-blue-500/10 hover:bg-blue-500/10 transition-colors group">
                            <div className="flex items-center gap-4 mb-3">
                                <div className="p-3 bg-blue-500/10 rounded-2xl group-hover:scale-110 transition-transform">
                                    <Filter className="w-5 h-5 text-blue-500" />
                                </div>
                                <div className="space-y-1">
                                    <h4 className="text-[11px] font-black uppercase tracking-widest text-[#1D4ED8] dark:text-white">Eficiência de Agenda</h4>
                                    <p className="text-[9px] text-[#1D4ED8]/40 dark:text-white/30 font-bold uppercase">SQL para Agendamento Real</p>
                                </div>
                            </div>
                            <div className="text-4xl font-black text-blue-500 dark:text-blue-400 font-fira-code">
                                {stats.sqls > 0 ? ((stats.meetingsScheduled / stats.sqls) * 100).toFixed(1) : 0}%
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Funnel categories Performance */}
            <Card className="bg-white/40 dark:bg-white/5 border-white/60 dark:border-white/10 shadow-xl rounded-[40px] overflow-hidden backdrop-blur-xl">
                <CardHeader className="p-8 pb-4">
                    <CardTitle className="text-[10px] font-black uppercase tracking-[0.3em] text-[#3B82F6] dark:text-[#60A5FA]">Funnel Stream Analytics</CardTitle>
                </CardHeader>
                <CardContent className="p-8">
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
                        {funnelPerformance.length === 0 ? (
                            <div className="col-span-3 text-center py-24 opacity-30">
                                <Search className="h-12 w-12 mx-auto mb-4" />
                                <p className="text-[12px] font-black uppercase tracking-[0.2em]">Nenhum fluxo detectado no período</p>
                            </div>
                        ) : (
                            funnelPerformance.map((funnel, idx) => (
                                <div key={idx} className="flex flex-col space-y-8 group">
                                    <div className="text-center space-y-2">
                                        <h4 className="text-[12px] font-black uppercase text-[#3B82F6] dark:text-[#60A5FA] tracking-[0.2em]">{funnel.name}</h4>
                                        <div className="flex items-center justify-center gap-3">
                                            <Badge className="bg-[#10B981]/10 text-[#10B981] border-[#10B981]/20 text-[9px] font-black px-2 py-0 h-4 uppercase tracking-widest">WIN RATE</Badge>
                                            <span className="text-xl font-black text-[#10B981] font-fira-code">{funnel.leads > 0 ? ((funnel.wins / funnel.leads) * 100).toFixed(1) : 0}%</span>
                                        </div>
                                    </div>

                                    {/* Visual Funnel Representation - Executive Redesign */}
                                    <div className="relative flex flex-col items-center space-y-2 py-6">
                                        {/* Leads Level */}
                                        <div className="w-full bg-[#3B82F6]/10 border border-[#3B82F6]/20 rounded-[32px] p-6 flex flex-col items-center justify-center relative overflow-hidden group-hover:bg-[#3B82F6]/20 transition-all cursor-default text-center">
                                            <div className="absolute top-0 left-0 w-1.5 h-full bg-[#3B82F6]" />
                                            <p className="text-[10px] font-black text-[#3B82F6] uppercase tracking-[0.2em] mb-2 opacity-60">Entrada Total</p>
                                            <div className="flex items-baseline gap-3">
                                                <span className="text-4xl font-black text-[#1D4ED8] dark:text-white font-fira-code">{funnel.leads}</span>
                                                <span className="text-[10px] font-black text-[#1D4ED8]/40 dark:text-white/30 uppercase">100%</span>
                                            </div>
                                        </div>

                                        {/* Scheduled Level */}
                                        <div
                                            className="bg-blue-500/10 border border-blue-500/20 p-6 flex flex-col items-center justify-center relative overflow-hidden group-hover:bg-blue-500/20 transition-all cursor-default mx-auto text-center"
                                            style={{ width: '90%', clipPath: 'polygon(0% 0%, 100% 0%, 93% 100%, 7% 100%)' }}
                                        >
                                            <p className="text-[10px] font-black text-blue-500 uppercase tracking-[0.2em] mb-2 opacity-60">Agendamentos</p>
                                            <div className="flex items-baseline gap-3">
                                                <span className="text-3xl font-black text-[#1D4ED8] dark:text-white font-fira-code">{funnel.scheduled}</span>
                                                <span className="text-[10px] font-black text-blue-500/60 uppercase">
                                                    {funnel.leads > 0 ? ((funnel.scheduled / funnel.leads) * 100).toFixed(1) : 0}%
                                                </span>
                                            </div>
                                        </div>

                                        {/* Wins Level */}
                                        <div
                                            className="bg-[#10B981]/10 border border-[#10B981]/20 rounded-[32px] p-6 flex flex-col items-center justify-center relative overflow-hidden group-hover:bg-[#10B981]/20 transition-all cursor-default text-center"
                                            style={{ width: '75%' }}
                                        >
                                            <p className="text-[10px] font-black text-[#10B981] uppercase tracking-[0.2em] mb-2 opacity-60">Revenue</p>
                                            <div className="flex items-baseline gap-3">
                                                <span className="text-3xl font-black text-[#10B981] font-fira-code">{funnel.wins}</span>
                                                <span className="text-[10px] font-black text-[#10B981]/60 uppercase">
                                                    {funnel.scheduled > 0 ? ((funnel.wins / funnel.scheduled) * 100).toFixed(1) : 0}%
                                                </span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Leakage / Discard Stats */}
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="flex flex-col p-4 rounded-3xl bg-white/40 dark:bg-white/5 border border-white/40 dark:border-white/10 items-center justify-center text-center">
                                            <p className="text-[9px] font-black text-[#1D4ED8]/40 dark:text-white/30 uppercase tracking-widest mb-1">Qualificação Fail</p>
                                            <div className="flex items-baseline gap-2">
                                                <span className="text-xl font-black text-[#1D4ED8] dark:text-white/70 font-fira-code">{funnel.disqualified}</span>
                                                <span className="text-[9px] font-black text-[#1D4ED8]/30 dark:text-white/20">
                                                    {funnel.leads > 0 ? ((funnel.disqualified / funnel.leads) * 100).toFixed(0) : 0}%
                                                </span>
                                            </div>
                                        </div>
                                        <div className="flex flex-col p-4 rounded-3xl bg-white/40 dark:bg-white/5 border border-white/40 dark:border-white/10 items-center justify-center text-center">
                                            <p className="text-[9px] font-black text-rose-500/40 uppercase tracking-widest mb-1">Negociação Lost</p>
                                            <div className="flex items-baseline gap-2">
                                                <span className="text-xl font-black text-rose-500 font-fira-code">{funnel.lost}</span>
                                                <span className="text-[9px] font-black text-rose-500/30">
                                                    {funnel.leads > 0 ? ((funnel.lost / funnel.leads) * 100).toFixed(0) : 0}%
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </CardContent>
            </Card>

            {/* Team Performance Row */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 pb-10">
                <Card className="bg-white/40 dark:bg-white/5 border-white/60 dark:border-white/10 shadow-xl rounded-[40px] overflow-hidden backdrop-blur-xl">
                    <CardHeader className="p-8 pb-4">
                        <CardTitle className="text-[10px] font-black uppercase tracking-[0.3em] text-[#3B82F6] dark:text-[#60A5FA]">Closers Leaderboard</CardTitle>
                    </CardHeader>
                    <CardContent className="p-8 space-y-4">
                        {teamPerfs.closers.length === 0 ? (
                            <div className="text-center py-12 opacity-30 text-[11px] font-black uppercase tracking-widest">Aguardando dados</div>
                        ) : (
                            teamPerfs.closers.map((c, i) => (
                                <div key={i} className="flex items-center justify-between p-5 rounded-[24px] bg-white/50 dark:bg-black/20 border border-white/60 dark:border-white/10 hover:border-[#3B82F6]/40 transition-all group">
                                    <div className="flex items-center gap-4">
                                        <div className="w-10 h-10 rounded-2xl bg-[#3B82F6] text-white flex items-center justify-center text-[12px] font-black shadow-lg shadow-[#3B82F6]/20">
                                            {c.name.substring(0, 2).toUpperCase()}
                                        </div>
                                        <div>
                                            <p className="text-[13px] font-black text-[#1D4ED8] dark:text-white uppercase tracking-tight">{c.name}</p>
                                            <p className="text-[10px] font-bold text-[#1D4ED8]/40 dark:text-white/30 uppercase tracking-wide">{c.wins} sales / {c.leads} leads</p>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-sm font-black text-[#3B82F6] dark:text-[#60A5FA] font-fira-code">{formatCurrency(c.value)}</p>
                                        <p className="text-[10px] text-emerald-500 font-black uppercase tracking-widest">{c.leads > 0 ? ((c.wins / c.leads) * 100).toFixed(1) : 0}% conv.</p>
                                    </div>
                                </div>
                            ))
                        )}
                    </CardContent>
                </Card>

                <Card className="bg-white/40 dark:bg-white/5 border-white/60 dark:border-white/10 shadow-xl rounded-[40px] overflow-hidden backdrop-blur-xl">
                    <CardHeader className="p-8 pb-4">
                        <CardTitle className="text-[10px] font-black uppercase tracking-[0.3em] text-[#3B82F6] dark:text-[#60A5FA]">SDRs Output Analysis</CardTitle>
                    </CardHeader>
                    <CardContent className="p-8 space-y-4">
                        {teamPerfs.sdrs.length === 0 ? (
                            <div className="text-center py-12 opacity-30 text-[11px] font-black uppercase tracking-widest">Aguardando dados</div>
                        ) : (
                            teamPerfs.sdrs.map((s, i) => (
                                <div key={i} className="flex items-center justify-between p-5 rounded-[24px] bg-white/50 dark:bg-black/20 border border-white/60 dark:border-white/10 hover:border-blue-500/40 transition-all group">
                                    <div className="flex items-center gap-4">
                                        <div className="w-10 h-10 rounded-2xl bg-blue-500 text-white flex items-center justify-center text-[12px] font-black shadow-lg shadow-blue-500/20">
                                            {s.name.substring(0, 2).toUpperCase()}
                                        </div>
                                        <div>
                                            <p className="text-[13px] font-black text-[#1D4ED8] dark:text-white uppercase tracking-tight">{s.name}</p>
                                            <p className="text-[10px] font-bold text-[#1D4ED8]/40 dark:text-white/30 uppercase tracking-wide">{s.leads} processed</p>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-sm font-black text-blue-500 font-fira-code">{s.sqls} SQLs</p>
                                        <p className="text-[10px] text-blue-400 font-black uppercase tracking-widest">{s.leads > 0 ? ((s.sqls / s.leads) * 100).toFixed(1) : 0}% Qual.</p>
                                    </div>
                                </div>
                            ))
                        )}
                    </CardContent>
                </Card>
            </div>
        </div >
    );
}
