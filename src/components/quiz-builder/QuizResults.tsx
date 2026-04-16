import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Switch } from "@/components/ui/switch";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Loader2, Eye, UserPlus, MousePointerClick, CheckCircle2, Search, Filter, DollarSign, TrendingUp, Percent, Clock, Download } from "lucide-react";
import {
    Pagination,
    PaginationContent,
    PaginationEllipsis,
    PaginationItem,
    PaginationLink,
    PaginationNext,
    PaginationPrevious,
} from "@/components/ui/pagination";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis, Tooltip as RechartsTooltip, ResponsiveContainer, Cell, LabelList } from 'recharts';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

type QuizResultsProps = {
    quizId: string;
    questions?: any[];
};

export function QuizResults({ quizId, questions = [] }: QuizResultsProps) {
    const [stats, setStats] = useState({
        visitors: 0,
        leads: 0,
        interactions: 0,
        completed: 0,
        sales: 0,
        revenue: 0
    });

    const [dateRange, setDateRange] = useState<{ from: Date | undefined; to: Date | undefined }>({
        from: undefined,
        to: undefined,
    });
    const [onlyCompleted, setOnlyCompleted] = useState(false);
    const [isExporting, setIsExporting] = useState(false);

    const [sessions, setSessions] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [page, setPage] = useState(1);
    const [search, setSearch] = useState("");
    const limit = 20;
    const [funnelData, setFunnelData] = useState<any[]>([]);
    const [questionsWithElements, setQuestionsWithElements] = useState<any[]>([]);
    const buildFilterQuery = (baseQuery: any) => {
        let q = baseQuery.eq('quiz_id', quizId);

        if (onlyCompleted) {
            q = q.eq('is_completed', true);
        }

        if (dateRange.from) {
            q = q.gte('created_at', dateRange.from.toISOString());
        }
        if (dateRange.to) {
            // Set end of day for 'to' date
            const toDate = new Date(dateRange.to);
            toDate.setHours(23, 59, 59, 999);
            q = q.lte('created_at', toDate.toISOString());
        }

        if (search) {
            // Search logic is limited for now
        }

        return q;
    };

    useEffect(() => {
        const fetchStructure = async () => {
            // Fetch questions with elements for proper mapping
            const { data: fullQuestions } = await supabase
                .from('quiz_questions')
                .select(`
                    *,
                    elements:quiz_elements(*)
                `)
                .eq('quiz_id', quizId)
                .order('order', { ascending: true });

            let questionsList: any[] = [];
            if (fullQuestions) {
                // Sort elements by order_index to match UI order
                const sorted = fullQuestions.map(q => ({
                    ...q,
                    elements: q.elements?.sort((a: any, b: any) => (a.order_index || 0) - (b.order_index || 0))
                }));
                questionsList = sorted;
                setQuestionsWithElements(sorted);
            }

            // Funnel stats calculation
            if (quizId && questionsList.length > 0) {
                // We need to fetch all sessions for the given filters to calculate the funnel
                // We need to fetch all sessions, handling pagination for >1000 records
                let allSessions: any[] = [];
                let hasMore = true;
                let page = 0;
                const pageSize = 1000;

                while (hasMore) {
                    let query = supabase.from('quiz_sessions').select('current_step_index, is_completed');
                    query = buildFilterQuery(query); // Function to apply filters

                    const { data, error } = await query.range(page * pageSize, (page + 1) * pageSize - 1);

                    if (error) {
                        console.error('Error fetching sessions funnel:', error);
                        break;
                    }

                    if (data && data.length > 0) {
                        allSessions = [...allSessions, ...data];
                        if (data.length < pageSize) {
                            hasMore = false;
                        } else {
                            page++;
                        }
                    } else {
                        hasMore = false;
                    }
                }

                if (allSessions.length > 0) {
                    const stepCounts: number[] = new Array(questionsList.length).fill(0);

                    allSessions.forEach(session => {
                        // If completed, they visited all steps
                        const maxIndex = session.is_completed ? questionsList.length - 1 : session.current_step_index;

                        // Increment count for all steps up to the max index they reached
                        for (let i = 0; i <= maxIndex; i++) {
                            if (i < stepCounts.length) {
                                stepCounts[i]++;
                            }
                        }
                    });

                    const chartData = questionsList.map((q, i) => {
                        const visitors = stepCounts[i];
                        const previousVisitors = i > 0 ? stepCounts[i - 1] : visitors;
                        const dropOff = previousVisitors > 0 ? ((previousVisitors - visitors) / previousVisitors * 100).toFixed(1) : '0';
                        const retention = previousVisitors > 0 ? ((visitors / previousVisitors) * 100).toFixed(1) : '100';

                        return {
                            name: `Etapa ${i + 1}: ${q.text}`,
                            shortName: `Etapa ${i + 1}`,
                            value: visitors,
                            dropOffProb: i === 0 ? 0 : Number(dropOff),
                            retentionProb: Number(retention),
                            fill: '#3b82f6'
                        };
                    });

                    setFunnelData(chartData);
                }
            }
        };
        fetchStructure();
    }, [quizId, dateRange, onlyCompleted]);

    const fetchStats = async () => {
        // We reuse the filter logic for counts where applicable
        // Note: For complex stats like 'sales' linked to multiple tables, distinct queries are needed.
        // Simplified approach: Stats reflect global (or currently filtered? User requested filtering the TABLE mainly, but consistent dashboards usually filter everything).
        // Let's filter KPIs too for consistency.

        // Helpers
        const getCount = async (params: any = {}) => {
            let query = supabase.from('quiz_sessions').select('id', { count: 'exact', head: true });
            query = buildFilterQuery(query);
            if (params.completed) query = query.eq('is_completed', true);
            if (params.hasContact) query = query.eq('has_contact_info', true);
            if (params.interaction) query = query.gt('current_step_index', 0);

            const { count } = await query;
            return count || 0;
        };

        const visitors = await getCount();
        const leads = await getCount({ hasContact: true });
        const completed = await getCount({ completed: true });
        const interactions = await getCount({ interaction: true });

        // Revenue is harder with filters because it joins other tables. 
        // For MVP, we might keep Revenue global OR try to filter submissions by date.
        // Let's keep Revenue Global for now to avoid complexity explosion, OR filter by date if opportunity creation matches.
        // User focused on "Table" customization. Let's filter KPIs that are direct from sessions.

        // ... (Revenue logic kept global or simple for now) ...
        // Re-implementing simplified Revenue for now (Global) or filtered by session IDs?
        // Filtering revenue is complex: Session -> Submission -> Opportunity -> Contract/Sale.
        // If we filter sessions by date, we should filter revenue from those sessions.
        // Step 1: Get session IDs from filtered query
        const { data: sessionIds } = await buildFilterQuery(supabase.from('quiz_sessions').select('id'));
        const ids = sessionIds?.map(s => s.id) || [];

        let totalSales = 0;
        let totalRevenue = 0;

        if (ids.length > 0) {
            const { data: submissions } = await supabase
                .from('quiz_submissions')
                .select('opportunity_id')
                .in('session_id', ids)
                .not('opportunity_id', 'is', null);

            if (submissions && submissions.length > 0) {
                const oppIds = submissions.map(s => s.opportunity_id);

                const { count: salesCount } = await supabase
                    .from('opportunities')
                    .select('*', { count: 'exact', head: true })
                    .in('id', oppIds)
                    .not('won_at', 'is', null);
                totalSales = salesCount || 0;

                // Revenue calcs...
                const { data: contracts } = await supabase.from('contracts').select('mrr').in('opportunity_id', oppIds);
                const { data: oneTime } = await supabase.from('one_time_sales').select('value').in('opportunity_id', oppIds);

                const cRev = contracts?.reduce((a, b) => a + (Number(b.mrr) || 0), 0) || 0;
                const oRev = oneTime?.reduce((a, b) => a + (Number(b.value) || 0), 0) || 0;
                totalRevenue = cRev + oRev;
            }
        }

        setStats({ visitors, leads, interactions, completed, sales: totalSales, revenue: totalRevenue });
    };

    const fetchSessions = async () => {
        setIsLoading(true);
        let query = supabase
            .from('quiz_sessions')
            .select('*');

        query = buildFilterQuery(query);

        query = query
            .order('created_at', { ascending: false })
            .range((page - 1) * limit, page * limit - 1);

        const { data, error } = await query;
        if (!error && data) {
            setSessions(data);
        }
        setIsLoading(false);
    };


    const resolveAnswerDisplay = (session: any, q: any) => {
        let answerValue = session.answers?.[q.id];

        // Try to find nested element values if main answer is missing
        if (!answerValue && !q.elements?.some((el: any) => session.answers?.[el.id])) {
            return '-';
        }

        // If no direct answer, aggregate nested elements
        if (!answerValue) {
            const elementValues = q.elements?.map((el: any) => {
                const val = session.answers?.[el.id];
                // Handle complex objects (like Phone)
                if (val && typeof val === 'object') {
                    if (val.countryCode && val.number) return `${val.countryCode} ${val.number}`;
                    return JSON.stringify(val);
                }
                return val;
            }).filter(Boolean);

            if (elementValues && elementValues.length > 0) {
                answerValue = elementValues.join(', ');
            }
        } else if (typeof answerValue === 'object') {
            // Handle if the main answer itself is an object
            if (answerValue.countryCode && answerValue.number) {
                answerValue = `${answerValue.countryCode} ${answerValue.number}`;
            } else {
                answerValue = JSON.stringify(answerValue);
            }
        }

        // Resolve Options IDs to Labels
        if (answerValue && typeof answerValue === 'string') {
            // Check direct question options
            const opt = q.options?.find((o: any) => o.id === answerValue);
            if (opt) answerValue = opt.text;

            // Check nested element options (e.g. single choice inside a step)
            if (!opt) {
                q.elements?.forEach((el: any) => {
                    // Check if this value matches an option in this element
                    const elOpt = el.content?.options?.find((o: any) => o.value === answerValue);
                    if (elOpt) answerValue = elOpt.label;
                });
            }
        }

        return String(answerValue || '-');
    };

    const handleExport = async (type: 'all' | 'filtered') => {
        setIsExporting(true);
        try {
            // Reuse current filter query but fetch CSV friendly data
            let query = supabase.from('quiz_sessions').select('*');

            if (type === 'filtered') {
                query = buildFilterQuery(query);
            } else {
                query = query.eq('quiz_id', quizId);
            }

            // Fetch in chunks if needed, but for export we might just grab a large batch 
            // depending on limits. For now, assume < 5000 fit in one go or pagination loop needed.
            // Simplified: fetch up to 2000 for export
            const { data: exportData, error } = await query.limit(2000).order('created_at', { ascending: false });

            if (error || !exportData) throw error;

            // Generate CSV
            // Headers: Date + Questions
            const headers = ['Data', ...questionsWithElements.map(q => q.text)];
            const csvRows = [headers.join(',')];

            exportData.forEach(session => {
                const row: any[] = [];
                // Metadata
                row.push(format(new Date(session.created_at), 'dd/MM/yyyy HH:mm'));

                // Questions
                questionsWithElements.forEach(q => {
                    const val = resolveAnswerDisplay(session, q);
                    row.push(`"${val.replace(/"/g, '""')}"`);
                });

                csvRows.push(row.join(','));
            });

            // Download
            const blob = new Blob([csvRows.join('\n')], { type: 'text/csv' });
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `quiz-export-${type}-${format(new Date(), 'yyyyMMddHHmm')}.csv`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);

        } catch (err) {
            console.error(err);
        } finally {
            setIsExporting(false);
        }
    };

    useEffect(() => {
        fetchStats();
        fetchSessions();
    }, [quizId, page, search, dateRange, onlyCompleted]);

    useEffect(() => {
        const channel = supabase
            .channel('schema-db-changes')
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'quiz_sessions',
                    filter: `quiz_id=eq.${quizId}`
                },
                (payload) => {
                    fetchStats();
                    fetchSessions();
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [quizId]);

    const conversionRate = stats.visitors > 0 ? ((stats.leads / stats.visitors) * 100).toFixed(1) : '0.0';
    const salesConversionRate = stats.leads > 0 ? ((stats.sales / stats.leads) * 100).toFixed(1) : '0.0';

    const formatCurrency = (value: number) => {
        return new Intl.NumberFormat('pt-BR', {
            style: 'currency',
            currency: 'BRL'
        }).format(value);
    };
    // ... (other constants)

    return (
        <div className="space-y-6">
            {/* KPI Cards (Same as before) */}
            <div className="grid grid-cols-4 gap-4">
                {/* ... (Keep existing cards but they now reflect stats) */}
                {/* Re-render existing cards code ... */}
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">Visitantes</CardTitle>
                        <Eye className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{stats.visitors}</div>
                        <p className="text-xs text-muted-foreground">Acessaram o funil</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">Leads Adquiridos</CardTitle>
                        <UserPlus className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{stats.leads}</div>
                        <p className="text-xs text-muted-foreground">Conv: {conversionRate}%</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">Vendas Geradas</CardTitle>
                        <TrendingUp className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{stats.sales}</div>
                        <p className="text-xs text-muted-foreground">Conv Lead: {salesConversionRate}%</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">Receita Total</CardTitle>
                        <DollarSign className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{formatCurrency(stats.revenue)}</div>
                        <p className="text-xs text-muted-foreground">Atribuída ao Quiz</p>
                    </CardContent>
                </Card>
            </div>

            <Card className="col-span-4">
                <CardHeader>
                    <CardTitle>Funil de Etapas (Drop-off)</CardTitle>
                    <CardDescription>Visualização de visitantes por etapa e taxa de retenção</CardDescription>
                </CardHeader>
                <CardContent className="h-[400px]">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={funnelData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                            <XAxis
                                dataKey="shortName"
                                tick={{ fontSize: 12, fill: '#64748B' }}
                                axisLine={false}
                                tickLine={false}
                            />
                            <YAxis
                                tick={{ fontSize: 12, fill: '#64748B' }}
                                axisLine={false}
                                tickLine={false}
                            />
                            <RechartsTooltip // UPDATED ALIAS
                                cursor={{ fill: '#F1F5F9' }}
                                content={({ active, payload }) => {
                                    if (active && payload && payload.length) {
                                        const data = payload[0].payload;
                                        return (
                                            <div className="bg-white p-4 border border-slate-100 rounded-xl shadow-xl text-sm min-w-[200px]">
                                                <div className="flex items-center justify-between mb-2 pb-2 border-b border-slate-100">
                                                    <p className="font-bold text-slate-800">{data.shortName}</p>
                                                    <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">{data.name.split(': ')[1]}</span>
                                                </div>

                                                <div className="space-y-2">
                                                    <div className="flex justify-between items-center">
                                                        <span className="text-slate-500">Visitantes</span>
                                                        <span className="font-bold text-slate-900 text-base">{data.value}</span>
                                                    </div>

                                                    {!data.name.includes('Etapa 1') && (
                                                        <>
                                                            <div className="flex justify-between items-center text-xs">
                                                                <span className="text-slate-500">Retenção (vs anterior)</span>
                                                                <span className={`font-semibold ${data.retentionProb >= 50 ? 'text-emerald-600' : 'text-amber-600'}`}>
                                                                    {data.retentionProb}%
                                                                </span>
                                                            </div>
                                                            <div className="flex justify-between items-center text-xs">
                                                                <span className="text-slate-500">Perda (vs anterior)</span>
                                                                <span className="font-semibold text-rose-500">
                                                                    {data.dropOffProb}%
                                                                </span>
                                                            </div>
                                                        </>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    }
                                    return null;
                                }}
                            />
                            <Bar
                                dataKey="value"
                                radius={[8, 8, 0, 0]}
                                barSize={48}
                            >
                                {funnelData.map((entry, index) => (
                                    <Cell
                                        key={`cell-${index}`}
                                        fill={index === 0 ? '#3B82F6' : '#60A5FA'}
                                        fillOpacity={0.8 + (index * 0.05)}
                                    />
                                ))}
                                <LabelList
                                    dataKey="value"
                                    position="top"
                                    fill="#64748B"
                                    fontSize={12}
                                    formatter={(val: number) => val > 0 ? val : ''}
                                />
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                </CardContent>
            </Card>

            {/* Filters Toolbar */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-white p-4 rounded-lg border shadow-sm">
                <div className="flex items-center gap-4 flex-1">
                    {/* Date Filter */}
                    <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-slate-500">Período:</span>
                        <Popover>
                            <PopoverTrigger asChild>
                                <Button variant="outline" size="sm" className="justify-start text-left font-normal w-[240px]">
                                    <Clock className="mr-2 h-4 w-4" />
                                    {dateRange.from ? (
                                        dateRange.to ? (
                                            <>
                                                {format(dateRange.from, "dd/MM/y", { locale: ptBR })} -{" "}
                                                {format(dateRange.to, "dd/MM/y", { locale: ptBR })}
                                            </>
                                        ) : (
                                            format(dateRange.from, "dd/MM/y", { locale: ptBR })
                                        )
                                    ) : (
                                        <span>Selecione uma data</span>
                                    )}
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="start">
                                <Calendar
                                    initialFocus
                                    mode="range"
                                    defaultMonth={dateRange.from}
                                    selected={dateRange as any}
                                    onSelect={(range: any) => setDateRange(range || { from: undefined, to: undefined })}
                                    numberOfMonths={2}
                                    locale={ptBR}
                                />
                            </PopoverContent>
                        </Popover>
                    </div>

                    {/* Completed Filter */}
                    <div className="flex items-center gap-2 border-l pl-4">
                        <div className="flex items-center space-x-2">
                            <Switch
                                id="completed-filter"
                                checked={onlyCompleted}
                                onCheckedChange={setOnlyCompleted}
                            />
                            <label htmlFor="completed-filter" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 text-slate-600">
                                Apenas concluídos
                            </label>
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="outline" size="sm" className="gap-2">
                                <Download className="h-4 w-4" />
                                Exportar
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => handleExport('filtered')} disabled={isExporting}>
                                Exportar dados filtrados (.csv)
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleExport('all')} disabled={isExporting}>
                                Exportar base completa (.csv)
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
            </div>

            {/* Data Table */}
            <div className="rounded-md border bg-white overflow-hidden shadow-sm">
                <div className="overflow-x-auto">
                    <Table>
                        <TableHeader>
                            <TableRow className="bg-slate-50 hover:bg-slate-50 border-b border-slate-200">
                                <TableHead className="w-[180px] font-bold text-slate-700 uppercase text-xs tracking-wider">Entrada</TableHead>
                                {questionsWithElements.map((q) => (
                                    <TableHead key={q.id} className="min-w-[200px] font-bold text-slate-700 whitespace-nowrap uppercase text-xs tracking-wider">
                                        {q.text}  {/* CHANGED TO USE QUESTION TEXT ONLY */}
                                    </TableHead>
                                ))}
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {isLoading ? (
                                <TableRow>
                                    <TableCell colSpan={questionsWithElements.length + 1} className="h-32 text-center">
                                        <div className="flex flex-col items-center justify-center text-muted-foreground gap-2">
                                            <Loader2 className="h-8 w-8 animate-spin text-primary" />
                                            <span className="text-xs">Carregando dados...</span>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ) : sessions.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={questionsWithElements.length + 1} className="h-32 text-center text-muted-foreground">
                                        <div className="flex flex-col items-center justify-center gap-2">
                                            <Filter className="h-8 w-8 text-slate-300" />
                                            <p>Nenhum registro encontrado para os filtros selecionados.</p>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ) : (
                                sessions.map((session) => (
                                    <TableRow key={session.id} className="hover:bg-slate-50/50 transition-colors">
                                        <TableCell className="font-medium text-slate-600">
                                            <div className="flex flex-col">
                                                <span className="font-bold">{format(new Date(session.created_at), "dd/MM/yyyy")}</span>
                                                <span className="text-xs text-muted-foreground">{format(new Date(session.created_at), "HH:mm")}</span>
                                            </div>
                                            {session.is_completed && (
                                                <Badge variant="secondary" className="mt-1 text-[10px] h-4 bg-green-50 text-green-700 border-green-200 w-fit">
                                                    Completo
                                                </Badge>
                                            )}
                                        </TableCell>
                                        {questionsWithElements.map((q) => {
                                            const resolvedValue = resolveAnswerDisplay(session, q);

                                            // Tooltip content logic
                                            return (
                                                <TableCell key={q.id} className="text-slate-600 max-w-[200px] text-sm">
                                                    <TooltipProvider>
                                                        <Tooltip delayDuration={0}>
                                                            <TooltipTrigger asChild>
                                                                <div className="truncate cursor-pointer hover:text-slate-900 transition-colors">
                                                                    {resolvedValue !== '-' ? resolvedValue : <span className="text-slate-300">-</span>}
                                                                </div>
                                                            </TooltipTrigger>
                                                            <TooltipContent className="max-w-[400px] break-words">
                                                                <p>{resolvedValue}</p>
                                                            </TooltipContent>
                                                        </Tooltip>
                                                    </TooltipProvider>
                                                </TableCell>
                                            );
                                        })}
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </div>
            </div>

            {/* Pagination */}
            <div className="flex items-center justify-between">
                <p className="text-xs text-muted-foreground">
                    Mostrando {(page - 1) * limit + 1} até {Math.min(page * limit, stats.visitors)} registros
                </p>
                <div className="flex space-x-2">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setPage(p => Math.max(1, p - 1))}
                        disabled={page === 1 || isLoading}
                    >
                        Anterior
                    </Button>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setPage(p => p + 1)}
                        disabled={sessions.length < limit || isLoading}
                    >
                        Próxima
                    </Button>
                </div>
            </div>
        </div>
    );
}
