import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { formatCurrency } from "@/utils/format";
import { Loader2, Users, Target, TrendingUp, DollarSign } from "lucide-react";
import { cn } from "@/lib/utils";

export function QuizPerformanceTable() {
    const { currentWorkspace } = useWorkspace();

    const { data: performance, isLoading } = useQuery({
        queryKey: ["quiz-performance", currentWorkspace?.id],
        queryFn: async () => {
            if (!currentWorkspace) return [];

            // 1. Fetch Quizzes
            const { data: quizzesData } = await supabase
                .from('quizzes')
                .select('id, title')
                .eq('workspace_id', currentWorkspace.id);

            if (!quizzesData) return [];

            const quizIds = quizzesData.map(q => q.id);

            // 2. Fetch Sessions for Visitors/Leads (filter by quiz_id, not workspace_id)
            const { data: sessionStats } = quizIds.length > 0
                ? await supabase
                    .from('quiz_sessions' as any)
                    .select('quiz_id, has_contact_info')
                    .in('quiz_id', quizIds) as any
                : { data: [] };

            // 3. Fetch Submissions with Op IDs for Sales/Revenue (filter by quiz_id, not workspace_id)
            const { data: submissionStats } = quizIds.length > 0
                ? await supabase
                    .from('quiz_submissions' as any)
                    .select('quiz_id, opportunity_id')
                    .in('quiz_id', quizIds)
                    .not('opportunity_id', 'is', null) as any
                : { data: [] };

            const quizStats: Record<string, { visitors: number, leads: number, sales: number, revenue: number }> = {};
            quizzesData.forEach(q => {
                quizStats[q.id] = { visitors: 0, leads: 0, sales: 0, revenue: 0 };
            });

            // Count Visitors & Leads
            sessionStats?.forEach((s: any) => {
                if (quizStats[s.quiz_id]) {
                    quizStats[s.quiz_id].visitors++;
                    if (s.has_contact_info) quizStats[s.quiz_id].leads++;
                }
            });

            // Calculate Sales & Revenue
            if (submissionStats && submissionStats.length > 0) {
                const opIds = submissionStats.map((s: any) => s.opportunity_id);
                const quizByOpId: Record<string, string> = {};
                submissionStats.forEach((s: any) => quizByOpId[s.opportunity_id] = s.quiz_id);

                // Fetch Won Ops
                const { data: wonOps } = await supabase
                    .from('opportunities')
                    .select('id')
                    .in('id', opIds)
                    .not('won_at', 'is', null);

                wonOps?.forEach(op => {
                    const qid = quizByOpId[op.id];
                    if (quizStats[qid]) quizStats[qid].sales++;
                });

                // Fetch Revenue
                const { data: opContracts } = await supabase
                    .from('contracts')
                    .select('value, opportunity_id')
                    .in('opportunity_id', opIds) as any;

                opContracts?.forEach((c: any) => {
                    const qid = quizByOpId[c.opportunity_id];
                    if (quizStats[qid]) quizStats[qid].revenue += (Number(c.value) || 0);
                });

                const { data: opSales } = await supabase
                    .from('one_time_sales')
                    .select('amount, opportunity_id')
                    .in('opportunity_id', opIds) as any;

                opSales?.forEach((s: any) => {
                    const qid = quizByOpId[s.opportunity_id];
                    if (quizStats[qid]) quizStats[qid].revenue += (Number(s.amount) || 0);
                });
            }

            return quizzesData.map(q => ({
                id: q.id,
                title: q.title,
                visitors: quizStats[q.id]?.visitors || 0,
                leads: quizStats[q.id]?.leads || 0,
                sales: quizStats[q.id]?.sales || 0,
                revenue: quizStats[q.id]?.revenue || 0
            }));
        },
        enabled: !!currentWorkspace,
    });

    if (isLoading) return <div className="h-[300px] flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-[#3B82F6]" /></div>;

    return (
        <div className="overflow-x-auto">
            <table className="w-full text-[11px] text-left border-separate border-spacing-y-2">
                <thead>
                    <tr className="text-[#1D4ED8]/40 dark:text-white/30 uppercase tracking-[0.2em] font-black">
                        <th className="px-6 py-2">Marketing Funnel (Quiz)</th>
                        <th className="px-6 py-2 text-center">Visitors</th>
                        <th className="px-6 py-2 text-center">Leads</th>
                        <th className="px-6 py-2 text-center">Sales</th>
                        <th className="px-6 py-2 text-right">Revenue</th>
                    </tr>
                </thead>
                <tbody className="space-y-4">
                    {performance?.map((quiz) => (
                        <tr key={quiz.id} className="bg-white/40 dark:bg-white/5 backdrop-blur-md rounded-2xl overflow-hidden group hover:scale-[1.01] transition-all duration-300 shadow-sm border border-white/20 dark:border-white/5">
                            <td className="px-6 py-4 rounded-l-2xl">
                                <span className="font-black text-[#1D4ED8] dark:text-white uppercase tracking-tight">{quiz.title}</span>
                            </td>
                            <td className="px-6 py-4 text-center">
                                <div className="flex flex-col items-center">
                                    <span className="font-fira-code font-black text-[#1D4ED8]/80 dark:text-white/80">{quiz.visitors}</span>
                                    <span className="text-[8px] uppercase tracking-widest text-[#3B82F6]/60 font-bold">Acessos</span>
                                </div>
                            </td>
                            <td className="px-6 py-4 text-center">
                                <div className="flex flex-col items-center">
                                    <span className="font-fira-code font-black text-[#3B82F6] dark:text-[#60A5FA]">{quiz.leads}</span>
                                    <span className="text-[8px] uppercase tracking-widest text-[#3B82F6]/60 font-bold">
                                        {quiz.visitors > 0 ? ((quiz.leads / quiz.visitors) * 100).toFixed(0) : 0}% CR
                                    </span>
                                </div>
                            </td>
                            <td className="px-6 py-4 text-center">
                                <div className="flex flex-col items-center">
                                    <span className="font-fira-code font-black text-[#F97316]">{quiz.sales}</span>
                                    <span className="text-[8px] uppercase tracking-widest text-[#F97316]/60 font-bold">Win Rate</span>
                                </div>
                            </td>
                            <td className="px-6 py-4 text-right rounded-r-2xl font-fira-code font-black text-[#3B82F6] dark:text-[#60A5FA]">
                                {formatCurrency(quiz.revenue)}
                            </td>
                        </tr>
                    ))}
                    {performance?.length === 0 && (
                        <tr>
                            <td colSpan={5} className="px-6 py-10 text-center text-[10px] font-black uppercase tracking-[0.2em] text-[#1D4ED8]/40 dark:text-white/20">
                                Nenhum funil ativo detectado no momento.
                            </td>
                        </tr>
                    )}
                </tbody>
            </table>
        </div>
    );
}
