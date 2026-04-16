import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Loader2, TrendingUp, Users, FileText, Wallet, DollarSign, Rocket, Tag, CalendarIcon, Target, TrendingDown, Infinity as InfinityIcon, Briefcase, GraduationCap, AlertCircle, Handshake, Trophy, ClipboardCheck, UsersRound, AlertTriangle, ShoppingBag } from "lucide-react";
import { startOfMonth, endOfMonth, subMonths, startOfYear, subYears, subDays, startOfDay, endOfDay, format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/utils/format";
import { MetricsCard } from "@/components/dashboard/MetricsCard";
import { RevenueChart } from "@/components/dashboard/RevenueChart";
import { ChurnChart } from "@/components/dashboard/ChurnChart";
import { CashFlowEvolutionChart } from "@/components/dashboard/CashFlowEvolutionChart";
import { RevenueCompositionChart } from "@/components/dashboard/RevenueCompositionChart";
import { QuizPerformanceTable } from "@/components/dashboard/QuizPerformanceTable";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { createWorkspaceAndMembership } from "@/lib/workspace";
import { useToast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";
import { BarChart3, PieChart, Activity } from "lucide-react";

export default function Dashboard() {
  const { currentWorkspace, loading, loadWorkspaces, setCurrentWorkspace, can } = useWorkspace();
  const { toast } = useToast();
  const [creatingWorkspace, setCreatingWorkspace] = useState(false);
  const [newWorkspaceName, setNewWorkspaceName] = useState("");
  const [dateRange, setDateRange] = useState<{ from: Date; to: Date }>({
    from: startOfMonth(new Date()),
    to: new Date(),
  });
  const [showCustomRange, setShowCustomRange] = useState(false);

  // Queries
  const { data: mrrData } = useQuery({
    queryKey: ["current-mrr", currentWorkspace?.id],
    queryFn: async () => {
      if (!currentWorkspace) return 0;

      const { data, error } = await supabase
        .from("contracts")
        .select("value")
        .eq("workspace_id", currentWorkspace.id)
        .eq("status", "active");

      if (error) throw error;
      return data?.reduce((sum, c) => sum + Number(c.value), 0) || 0;
    },
    enabled: !!currentWorkspace,
  });

  const { data: clientsCount } = useQuery({
    queryKey: ["clients-count", currentWorkspace?.id],
    queryFn: async () => {
      if (!currentWorkspace) return 0;

      const { data, error } = await supabase
        .from("contracts")
        .select("client_id")
        .eq("workspace_id", currentWorkspace.id)
        .eq("status", "active");

      if (error) throw error;
      const uniqueClients = new Set(data?.map(c => c.client_id));
      return uniqueClients.size;
    },
    enabled: !!currentWorkspace,
  });

  const { data: contractsCount } = useQuery({
    queryKey: ["contracts-count", currentWorkspace?.id],
    queryFn: async () => {
      if (!currentWorkspace) return 0;

      const { count } = await supabase
        .from("contracts")
        .select("*", { count: "exact", head: true })
        .eq("workspace_id", currentWorkspace.id)
        .eq("status", "active");

      return count || 0;
    },
    enabled: !!currentWorkspace,
  });

  const { data: expensesPeriod } = useQuery({
    queryKey: ["expenses-period", currentWorkspace?.id, dateRange],
    queryFn: async () => {
      if (!currentWorkspace) return 0;
      const fromDate = format(dateRange.from, "yyyy-MM-dd");
      const toDate = format(dateRange.to, "yyyy-MM-dd");

      let allData: any[] = [];
      let page = 0;
      const pageSize = 1000;
      let hasMore = true;

      while (hasMore) {
        const { data, error } = await supabase
          .from("financial_payables")
          .select("total_amount")
          .eq("workspace_id", currentWorkspace.id)
          .gte("due_date", fromDate)
          .lte("due_date", toDate)
          .range(page * pageSize, (page + 1) * pageSize - 1) as any;

        if (error) throw error;
        if (data && data.length > 0) {
          allData = [...allData, ...data];
          hasMore = data.length === pageSize;
          page++;
        } else {
          hasMore = false;
        }
      }

      return allData.reduce((sum, e) => sum + Number(e.total_amount), 0) || 0;
    },
    enabled: !!currentWorkspace,
  });

  const { data: implementationFeesTotal } = useQuery({
    queryKey: ["implementation-fees-period", currentWorkspace?.id, dateRange],
    queryFn: async () => {
      if (!currentWorkspace) return 0;
      const fromDate = format(dateRange.from, "yyyy-MM-dd");
      const toDate = format(dateRange.to, "yyyy-MM-dd");

      const { data: contracts } = await supabase
        .from("contracts")
        .select("id, implementation_fee")
        .eq("workspace_id", currentWorkspace.id)
        .gt("implementation_fee", 0) as any;

      if (!contracts) return 0;

      let total = 0;
      for (const contract of contracts) {
        const { data: billings } = await supabase
          .from("contract_billings")
          .select("final_amount, amount")
          .eq("contract_id", contract.id)
          .eq("status", "paid")
          .gte("payment_date", fromDate)
          .lte("payment_date", toDate)
          .order("due_date", { ascending: true })
          .limit(1) as any;

        if (billings && billings.length > 0) {
          const implementationPaid = billings[0].final_amount - billings[0].amount;
          total += implementationPaid;
        }
      }

      return total;
    },
    enabled: !!currentWorkspace,
  });

  const { data: discountsPeriod } = useQuery({
    queryKey: ["discounts-period", currentWorkspace?.id, dateRange],
    queryFn: async () => {
      if (!currentWorkspace) return 0;
      const fromDate = format(dateRange.from, "yyyy-MM-dd");
      const toDate = format(dateRange.to, "yyyy-MM-dd");

      const { data } = await supabase
        .from("contract_billings")
        .select("discount")
        .eq("workspace_id", currentWorkspace.id)
        .gte("created_at", fromDate)
        .lte("created_at", toDate) as any;

      return data?.reduce((sum, b: any) => sum + Number(b.discount || 0), 0) || 0;
    },
    enabled: !!currentWorkspace,
  });

  const { data: revenuePeriod } = useQuery({
    queryKey: ["revenue-period", currentWorkspace?.id, dateRange],
    queryFn: async () => {
      if (!currentWorkspace) return 0;
      const fromDate = format(dateRange.from, "yyyy-MM-dd");
      const toDate = format(dateRange.to, "yyyy-MM-dd");

      const { data: billings } = await (supabase as any)
        .from("contract_billings")
        .select("final_amount")
        .eq("workspace_id", currentWorkspace.id)
        .eq("status", "paid")
        .gte("payment_date", fromDate)
        .lte("payment_date", toDate) as any;

      const billingsTotal = billings?.reduce((sum: number, b: any) => sum + Number(b.final_amount), 0) || 0;

      const { data: sales } = await (supabase as any)
        .from("one_time_sales")
        .select("amount")
        .eq("workspace_id", currentWorkspace.id)
        .eq("status", "paid")
        .gte("payment_date", fromDate)
        .lte("payment_date", toDate) as any;

      const salesTotal = sales?.reduce((sum: number, s: any) => sum + Number(s.amount), 0) || 0;

      const { data: receivables } = await (supabase as any)
        .from("financial_receivables")
        .select("total_amount")
        .eq("workspace_id", currentWorkspace.id)
        .eq("status", "paid")
        .is("contract_billing_id", null)
        .is("one_time_sale_id", null)
        .gte("payment_date", fromDate)
        .lte("payment_date", toDate) as any;

      const receivablesTotal = receivables?.reduce((sum: number, r: any) => sum + Number(r.total_amount), 0) || 0;

      return billingsTotal + salesTotal + receivablesTotal;
    },
    enabled: !!currentWorkspace,
  });

  const { data: ticketMedioData } = useQuery({
    queryKey: ["ticket-medio", currentWorkspace?.id, dateRange],
    queryFn: async () => {
      if (!currentWorkspace) return { products: [], overallAvg: 0 };

      const { data: products } = await (supabase as any)
        .from("products")
        .select("id, name, type")
        .eq("workspace_id", currentWorkspace.id)
        .eq("is_active", true);

      if (!products) return { products: [], overallAvg: 0 };

      const { data: contracts } = await (supabase as any)
        .from("contracts")
        .select("value, name, opportunity_id")
        .eq("workspace_id", currentWorkspace.id);

      const { data: sales } = await (supabase as any)
        .from("one_time_sales")
        .select("amount, description, opportunity_id")
        .eq("workspace_id", currentWorkspace.id);

      const { data: oppProducts } = await supabase
        .from("opportunity_products")
        .select("opportunity_id, product_id");

      const results = products.map((product) => {
        const productOppIds = oppProducts
          ?.filter((op) => op.product_id === product.id)
          .map((op) => op.opportunity_id) || [];

        let total = 0;
        let count = 0;

        if (product.type === "recurring") {
          const matchingContracts = contracts?.filter((c: any) =>
            (c.opportunity_id && productOppIds.includes(c.opportunity_id)) ||
            (!c.opportunity_id && c.name?.toLowerCase().includes(product.name.toLowerCase()))
          ) || [];
          total = matchingContracts.reduce((sum: number, c: any) => sum + Number(c.value), 0);
          count = matchingContracts.length;
        } else {
          const matchingSales = sales?.filter((s: any) =>
            (s.opportunity_id && productOppIds.includes(s.opportunity_id)) ||
            (!s.opportunity_id && (s.description?.toLowerCase().includes(product.name.toLowerCase()) || s.type?.toLowerCase().includes(product.name.toLowerCase())))
          ) || [];
          total = matchingSales.reduce((sum: number, s: any) => sum + Number(s.amount), 0);
          count = matchingSales.length;
        }

        return {
          id: product.id,
          name: product.name,
          type: product.type,
          avg: count > 0 ? total / count : 0
        };
      });

      const activeResults = results.filter(r => r.avg > 0);
      const totalAvgs = activeResults.reduce((sum, r) => sum + r.avg, 0);
      const overallAvg = activeResults.length > 0 ? totalAvgs / activeResults.length : 0;

      return { products: results, overallAvg };
    },
    enabled: !!currentWorkspace,
  });

  const { data: cacData } = useQuery({
    queryKey: ["cac", currentWorkspace?.id, dateRange],
    queryFn: async () => {
      if (!currentWorkspace) return 0;
      const fromDate = format(dateRange.from, "yyyy-MM-dd");
      const toDate = format(dateRange.to, "yyyy-MM-dd");

      const { data: categories } = await supabase
        .from("financial_categories")
        .select("id")
        .eq("workspace_id", currentWorkspace.id)
        .or("name.ilike.%marketing%,name.ilike.%anúncios%,name.ilike.%ads%,name.ilike.%tráfego%");

      const catIds = categories?.map(c => c.id) || [];
      if (catIds.length === 0) return 0;

      const { data: spend } = await supabase
        .from("financial_payables")
        .select("total_amount")
        .eq("workspace_id", currentWorkspace.id)
        .in("category_id", catIds)
        .gte("due_date", fromDate)
        .lte("due_date", toDate) as any;

      const totalSpend = spend?.reduce((sum: number, s: any) => sum + Number(s.total_amount), 0) || 0;

      const { count: newCustomers } = await supabase
        .from("contracts")
        .select("*", { count: "exact", head: true })
        .eq("workspace_id", currentWorkspace.id)
        .gte("start_date", fromDate)
        .lte("start_date", toDate);

      return newCustomers ? totalSpend / newCustomers : 0;
    },
    enabled: !!currentWorkspace,
  });

  const { data: delinquencyRate } = useQuery({
    queryKey: ["delinquency", currentWorkspace?.id, dateRange],
    queryFn: async () => {
      if (!currentWorkspace) return 0;
      const toDate = format(dateRange.to, "yyyy-MM-dd");

      const { data: overdue } = await supabase
        .from("financial_receivables")
        .select("total_amount")
        .eq("workspace_id", currentWorkspace.id)
        .eq("status", "pending")
        .lt("due_date", toDate) as any;

      const totalOverdue = overdue?.reduce((sum: number, r: any) => sum + Number(r.total_amount), 0) || 0;

      const { data: total } = await supabase
        .from("financial_receivables")
        .select("total_amount")
        .eq("workspace_id", currentWorkspace.id) as any;

      const totalReceivables = total?.reduce((sum: number, r: any) => sum + Number(r.total_amount), 0) || 0;

      return totalReceivables ? (totalOverdue / totalReceivables) * 100 : 0;
    },
    enabled: !!currentWorkspace,
  });

  const { data: mrrChurnData } = useQuery({
    queryKey: ["mrr-churn", currentWorkspace?.id, dateRange],
    queryFn: async () => {
      if (!currentWorkspace) return { newMRR: 0, churnMRR: 0, churnRate: 0, ltv: 0 };
      const fromDate = format(dateRange.from, "yyyy-MM-dd");
      const toDate = format(dateRange.to, "yyyy-MM-dd");

      const { data: newContracts } = await supabase
        .from("contracts")
        .select("value")
        .eq("workspace_id", currentWorkspace.id)
        .gte("start_date", fromDate)
        .lte("start_date", toDate) as any;

      const newMRR = newContracts?.reduce((sum: number, c: any) => sum + Number(c.value), 0) || 0;

      const { data: cancelledContracts } = await supabase
        .from("contracts")
        .select("value")
        .eq("workspace_id", currentWorkspace.id)
        .gte("cancellation_date", fromDate)
        .lte("cancellation_date", toDate) as any;

      const churnMRR = cancelledContracts?.reduce((sum: number, c: any) => sum + Number(c.value), 0) || 0;

      const { count: startActiveCount } = await supabase
        .from("contracts")
        .select("*", { count: "exact", head: true })
        .eq("workspace_id", currentWorkspace.id)
        .lte("start_date", fromDate)
        .or(`cancellation_date.is.null,cancellation_date.gt.${fromDate}`);

      const churnRate = startActiveCount ? (cancelledContracts?.length || 0) / startActiveCount : 0;

      const avgMRR = mrrData ? mrrData / (contractsCount || 1) : 0;
      const ltv = churnRate > 0 ? avgMRR / churnRate : avgMRR * 12;

      return {
        newMRR,
        churnMRR,
        churnRate: churnRate * 100,
        ltv
      };
    },
    enabled: !!currentWorkspace && !!mrrData,
  });

  const { data: leadStats } = useQuery({
    queryKey: ["lead-stats", currentWorkspace?.id, dateRange],
    queryFn: async () => {
      if (!currentWorkspace) return { leads: 0, sales: 0, rate: 0 };
      const fromDate = format(dateRange.from, "yyyy-MM-dd");
      const toDate = format(dateRange.to, "yyyy-MM-dd");

      const { count: leads } = await supabase
        .from('opportunities')
        .select('*', { count: 'exact', head: true })
        .eq('workspace_id', currentWorkspace.id)
        .gte('created_at', fromDate)
        .lte('created_at', toDate);

      const { count: sales } = await supabase
        .from('opportunities')
        .select('*', { count: 'exact', head: true })
        .eq('workspace_id', currentWorkspace.id)
        .not('won_at', 'is', null)
        .gte('won_at', fromDate)
        .lte('won_at', toDate);

      return {
        leads: leads || 0,
        sales: sales || 0,
        rate: leads ? ((sales || 0) / leads * 100) : 0
      };
    },
    enabled: !!currentWorkspace,
  });

  // Pipeline Ativo (oportunidades abertas)
  const { data: pipelineData } = useQuery({
    queryKey: ["pipeline-active", currentWorkspace?.id],
    queryFn: async () => {
      if (!currentWorkspace) return { count: 0, value: 0 };
      const { data, error } = await supabase
        .from("opportunities")
        .select("expected_value")
        .eq("workspace_id", currentWorkspace.id)
        .is("won_at", null)
        .is("lost_at", null) as any;
      if (error) throw error;
      return {
        count: data?.length || 0,
        value: data?.reduce((sum: number, o: any) => sum + Number(o.expected_value || 0), 0) || 0,
      };
    },
    enabled: !!currentWorkspace,
  });

  // Fechamentos do mês
  const { data: closedDeals } = useQuery({
    queryKey: ["closed-deals", currentWorkspace?.id, dateRange],
    queryFn: async () => {
      if (!currentWorkspace) return { count: 0, value: 0 };
      const fromDate = format(dateRange.from, "yyyy-MM-dd");
      const toDate = format(dateRange.to, "yyyy-MM-dd");
      const { data, error } = await supabase
        .from("opportunities")
        .select("expected_value")
        .eq("workspace_id", currentWorkspace.id)
        .not("won_at", "is", null)
        .gte("won_at", fromDate)
        .lte("won_at", toDate) as any;
      if (error) throw error;
      return {
        count: data?.length || 0,
        value: data?.reduce((sum: number, o: any) => sum + Number(o.expected_value || 0), 0) || 0,
      };
    },
    enabled: !!currentWorkspace,
  });

  // Inadimplência em R$
  const { data: delinquencyAmount } = useQuery({
    queryKey: ["delinquency-amount", currentWorkspace?.id],
    queryFn: async () => {
      if (!currentWorkspace) return 0;
      const today = format(new Date(), "yyyy-MM-dd");
      const { data } = await supabase
        .from("financial_receivables")
        .select("total_amount")
        .eq("workspace_id", currentWorkspace.id)
        .eq("status", "pending")
        .lt("due_date", today) as any;
      return data?.reduce((sum: number, r: any) => sum + Number(r.total_amount), 0) || 0;
    },
    enabled: !!currentWorkspace,
  });

  const handleCreateWorkspace = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newWorkspaceName.trim()) return;
    setCreatingWorkspace(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");
      const workspace = await createWorkspaceAndMembership(newWorkspaceName.trim(), user.id);
      await loadWorkspaces();
      setCurrentWorkspace({
        id: workspace.id,
        name: workspace.name,
        slug: workspace.slug,
        role: "owner",
        role_details: { id: "", name: "Owner", color: "#000000", role_permissions: [] }
      });
      setNewWorkspaceName("");
      toast({ title: "Workspace criado!", description: `Seu workspace "${workspace.name}" foi criado com sucesso.` });
    } catch (error: any) {
      toast({ variant: "destructive", title: "Erro ao criar workspace", description: error.message });
    } finally {
      setCreatingWorkspace(false);
    }
  };

  if (loading) return <div className="flex items-center justify-center h-full"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

  if (!currentWorkspace) {
    return (
      <div className="p-8">
        <Card>
          <CardHeader>
            <CardTitle>Nenhum Workspace</CardTitle>
            <CardDescription>Crie um workspace para começar a usar o sistema.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCreateWorkspace} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="workspace-name">Nome do Workspace</Label>
                <Input id="workspace-name" placeholder="Minha Empresa" value={newWorkspaceName} onChange={(e) => setNewWorkspaceName(e.target.value)} disabled={creatingWorkspace} required />
              </div>
              <Button type="submit" disabled={creatingWorkspace || !newWorkspaceName.trim()}>
                {creatingWorkspace && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Criar Workspace
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  const profit = (revenuePeriod || 0) - (expensesPeriod || 0);

  return (
    <div className="min-h-screen bg-white dark:bg-[#0A0510] relative overflow-hidden font-fira-sans text-[#1D4ED8] dark:text-white/90 antialiased transition-colors duration-500">
      {/* Premium Gradient Backgrounds */}
      <div className="absolute top-[-5%] right-[-5%] w-[600px] h-[600px] bg-[#3B82F6]/10 dark:bg-[#3B82F6]/20 rounded-full blur-[120px] -z-10 animate-pulse" />
      <div className="absolute bottom-[-5%] left-[-5%] w-[500px] h-[500px] bg-[#F97316]/5 dark:bg-[#F97316]/10 rounded-full blur-[100px] -z-10" />

      <div className="p-4 md:p-8 space-y-10 max-w-[1600px] mx-auto relative z-10">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 border-b border-[#3B82F6]/10 dark:border-white/10 pb-8">
          <div />

          <div className="flex items-center gap-4 bg-white/60 dark:bg-black/60 backdrop-blur-xl p-1.5 rounded-2xl border border-white/60 dark:border-white/10 shadow-xl ring-1 ring-black/5 dark:ring-white/5">
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="ghost" className="h-11 px-6 justify-start text-left font-black text-[10px] uppercase tracking-widest hover:bg-[#3B82F6]/10 dark:hover:bg-white/5 transition-all rounded-xl">
                  <CalendarIcon className="mr-3 h-4 w-4 text-[#3B82F6] dark:text-[#60A5FA]" />
                  {format(dateRange.from, "dd MMM yy")} - {format(dateRange.to, "dd MMM yy")}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-4 border-[#3B82F6]/20 dark:border-white/10 shadow-2xl rounded-2xl backdrop-blur-xl bg-white/90 dark:bg-black/90" align="end">
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-2">
                    {["Hoje", "Ontem", "Este Mês", "Mês Passado", "Últimos 30 dias", "Este Ano"].map((label) => (
                      <Button key={label} size="sm" variant="outline" className="font-black text-[9px] uppercase tracking-widest hover:bg-[#3B82F6] dark:hover:bg-white/10 hover:text-white transition-all border-[#3B82F6]/10 dark:border-white/10" onClick={() => {
                        const now = new Date();
                        if (label === "Hoje") setDateRange({ from: startOfDay(now), to: endOfDay(now) });
                        else if (label === "Ontem") { const y = subDays(now, 1); setDateRange({ from: startOfDay(y), to: endOfDay(y) }); }
                        else if (label === "Este Mês") setDateRange({ from: startOfMonth(now), to: endOfDay(now) });
                        else if (label === "Mês Passado") { const lm = subMonths(now, 1); setDateRange({ from: startOfMonth(lm), to: endOfMonth(lm) }); }
                        else if (label === "Últimos 30 dias") setDateRange({ from: subDays(now, 30), to: now });
                        else if (label === "Este Ano") setDateRange({ from: startOfYear(now), to: now });
                        setShowCustomRange(false);
                      }}>{label}</Button>
                    ))}
                    <Button size="sm" variant={showCustomRange ? "default" : "outline"} className="font-black text-[9px] uppercase tracking-widest col-span-2 bg-[#3B82F6] text-white border-transparent" onClick={() => setShowCustomRange(!showCustomRange)}>Personalizado</Button>
                  </div>
                  {showCustomRange && (
                    <div className="flex flex-col md:flex-row gap-4 border-t border-[#3B82F6]/10 dark:border-white/10 pt-4">
                      <Calendar mode="single" selected={dateRange.from} onSelect={(date) => date && setDateRange({ ...dateRange, from: date })} className="rounded-xl border border-[#3B82F6]/5 dark:border-white/5 bg-transparent" />
                      <Calendar mode="single" selected={dateRange.to} onSelect={(date) => date && setDateRange({ ...dateRange, to: date })} className="rounded-xl border border-[#3B82F6]/5 dark:border-white/5 bg-transparent" />
                    </div>
                  )}
                </div>
              </PopoverContent>
            </Popover>
          </div>
        </div>

        {/* Receita */}
        <div className="space-y-6">
          <div className="flex items-center gap-4">
            <h2 className="text-[11px] font-black uppercase tracking-[0.3em] text-[#1D4ED8]/40 dark:text-white/30 flex items-center gap-2">
              <DollarSign className="w-3.5 h-3.5 text-[#3B82F6]" /> Receita
            </h2>
            <div className="h-px flex-1 bg-gradient-to-r from-[#3B82F6]/10 dark:from-white/10 to-transparent" />
          </div>

          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            <MetricsCard title="MRR Atual" value={formatCurrency(mrrData || 0)} icon={TrendingUp} trend={mrrChurnData?.newMRR && mrrChurnData.newMRR > 0 ? "up" : "neutral"} trendValue={mrrChurnData?.newMRR ? `+${formatCurrency(mrrChurnData.newMRR)}` : ""} variant="primary" description="Monthly Recurring Revenue" />
            <MetricsCard title="Faturamento Total" value={formatCurrency(revenuePeriod || 0)} icon={Wallet} variant="secondary" description="Receita bruta no período" />
            <MetricsCard title="Despesas" value={formatCurrency(expensesPeriod || 0)} icon={TrendingDown} variant="warning" description="Total de despesas no período" />
          </div>
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            <MetricsCard title="Receita Líquida" value={formatCurrency(profit)} icon={DollarSign} variant={profit >= 0 ? "success" : "destructive"} description="Faturamento - Despesas" />
            <MetricsCard title="Inadimplência" value={`${formatCurrency(delinquencyAmount || 0)} (${delinquencyRate?.toFixed(1)}%)`} icon={AlertTriangle} variant={delinquencyRate && delinquencyRate > 10 ? "destructive" : "warning"} description="Valores vencidos em aberto" />
            <MetricsCard title="Clientes Ativos" value={clientsCount?.toString() || "0"} icon={Users} trend={clientsCount && clientsCount > 0 ? "up" : "neutral"} trendValue={`${contractsCount || 0} contratos`} variant="default" description="Base ativa de clientes" />
          </div>
        </div>

        {/* Pipeline Comercial */}
        <div className="space-y-6">
          <div className="flex items-center gap-4">
            <h2 className="text-[11px] font-black uppercase tracking-[0.3em] text-[#1D4ED8]/40 dark:text-white/30 flex items-center gap-2">
              <Handshake className="w-3.5 h-3.5 text-emerald-500" /> Pipeline Comercial
            </h2>
            <div className="h-px flex-1 bg-gradient-to-r from-emerald-500/10 dark:from-white/10 to-transparent" />
          </div>

          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            <MetricsCard title="Pipeline Ativo" value={formatCurrency(pipelineData?.value || 0)} icon={ShoppingBag} trend="neutral" trendValue={`${pipelineData?.count || 0} oportunidades`} variant="primary" description="Valor total em negociação" />
            <MetricsCard title="Fechamentos" value={`${closedDeals?.count || 0} vendas`} icon={Trophy} trend={closedDeals && closedDeals.count > 0 ? "up" : "neutral"} trendValue={formatCurrency(closedDeals?.value || 0)} variant="success" description="No período selecionado" />
            <MetricsCard title="Conversão Lead → Venda" value={`${leadStats?.rate.toFixed(1)}%`} icon={Target} trend={leadStats && leadStats.rate > 20 ? "up" : "neutral"} trendValue={`${leadStats?.sales || 0} de ${leadStats?.leads || 0}`} variant="default" description="Taxa de conversão do funil" />
          </div>
        </div>

        {/* Charts Grid */}
        <div className="grid gap-8 lg:grid-cols-12">
          <div className="lg:col-span-8 space-y-6">
            <div className="bg-white/50 dark:bg-black/40 backdrop-blur-xl rounded-3xl border border-white dark:border-white/10 shadow-2xl overflow-hidden hover:border-[#3B82F6]/20 dark:hover:border-white/20 transition-all duration-500">
              <div className="p-6 border-b border-black/5 dark:border-white/5 flex items-center justify-between">
                <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-[#1D4ED8]/50 dark:text-white/40 flex items-center gap-2">
                  <TrendingUp className="w-3.5 h-3.5 text-[#3B82F6]" /> Receita vs Despesa
                </h3>
              </div>
              <RevenueChart dateRange={dateRange} />
            </div>
          </div>

          <div className="lg:col-span-4 space-y-6">
            <div className="bg-white/50 dark:bg-black/40 backdrop-blur-xl rounded-2xl border border-white dark:border-white/10 shadow-2xl p-6 h-full hover:border-[#3B82F6]/20 dark:hover:border-white/20 transition-all duration-500">
              <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-[#1D4ED8]/50 dark:text-white/40 flex items-center gap-2 mb-6">
                <Tag className="w-3.5 h-3.5 text-[#3B82F6]" /> Ticket Médio / Produto
              </h3>
              <div className="space-y-5">
                {(ticketMedioData as any)?.products?.map((prod: any) => (
                  <div key={prod.id} className="flex items-center justify-between group">
                    <div className="flex items-center gap-3">
                      <div className={cn("p-2 rounded-lg bg-white dark:bg-white/5 border border-black/5 dark:border-white/5 shadow-sm group-hover:scale-110 transition-transform", prod.type === "recurring" ? "text-indigo-500" : "text-emerald-500")}>
                        {prod.type === "recurring" ? <Briefcase className="h-3.5 w-3.5" /> : <GraduationCap className="h-3.5 w-3.5" />}
                      </div>
                      <span className="text-[11px] font-black uppercase tracking-tight text-[#1D4ED8]/80 dark:text-white/70">{prod.name}</span>
                    </div>
                    <span className="text-xs font-black text-[#3B82F6] dark:text-[#60A5FA]">{formatCurrency(prod.avg)}</span>
                  </div>
                ))}
                <div className="pt-4 mt-6 border-t border-black/5 dark:border-white/5 flex items-center justify-between">
                  <span className="text-[9px] font-black uppercase tracking-widest text-[#3B82F6]/60 dark:text-white/30">Consolidado</span>
                  <span className="text-lg font-black text-[#3B82F6] dark:text-[#60A5FA] font-fira-code">{formatCurrency((ticketMedioData as any)?.overallAvg || 0)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Secondary Charts Section */}
        <div className="grid gap-8 md:grid-cols-2">
          <div className="bg-white/50 dark:bg-black/40 backdrop-blur-xl rounded-3xl border border-white dark:border-white/10 shadow-2xl p-6 hover:border-[#3B82F6]/20 dark:hover:border-white/20 transition-all duration-500">
            <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-[#1D4ED8]/50 dark:text-white/40 mb-8 flex items-center gap-2">
              <TrendingDown className="w-3.5 h-3.5 text-[#F97316]" /> Análise de Churn
            </h3>
            <ChurnChart dateRange={dateRange} />
          </div>
          <div className="bg-white/50 dark:bg-black/40 backdrop-blur-xl rounded-3xl border border-white dark:border-white/10 shadow-2xl p-6 hover:border-[#3B82F6]/20 dark:hover:border-white/20 transition-all duration-500">
            <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-[#1D4ED8]/50 dark:text-white/40 mb-8 flex items-center gap-2">
              <DollarSign className="w-3.5 h-3.5 text-[#3B82F6]" /> Evolução de Caixa
            </h3>
            <CashFlowEvolutionChart />
          </div>
        </div>

        {/* Marketing Intelligence Section */}
        {can('reports.view') && (
          <div className="space-y-10 pt-10 border-t border-[#3B82F6]/10 dark:border-white/10">
            <div className="flex items-center gap-4">
              <h2 className="text-[11px] font-black uppercase tracking-[0.3em] text-[#1D4ED8]/40 dark:text-white/30 flex items-center gap-2">
                <BarChart3 className="w-3.5 h-3.5 text-[#F97316]" />
                Marketing Intelligence & Funnels
              </h2>
              <div className="h-px flex-1 bg-gradient-to-r from-[#3B82F6]/10 dark:from-white/10 to-transparent" />
            </div>

            <div className="grid gap-8 lg:grid-cols-12">
              <div className="lg:col-span-4 bg-white/50 dark:bg-black/40 backdrop-blur-xl rounded-3xl border border-white dark:border-white/10 shadow-2xl p-6 hover:border-[#3B82F6]/20 dark:hover:border-white/20 transition-all duration-500">
                <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-[#1D4ED8]/50 dark:text-white/40 mb-8 flex items-center gap-2">
                  <PieChart className="w-3.5 h-3.5 text-[#3B82F6]" /> Mix de Receita (MRR vs Pontual)
                </h3>
                <RevenueCompositionChart />
              </div>
              <div className="lg:col-span-8 bg-white/50 dark:bg-black/40 backdrop-blur-xl rounded-3xl border border-white dark:border-white/10 shadow-2xl p-6 hover:border-[#3B82F6]/20 dark:hover:border-white/20 transition-all duration-500">
                <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-[#1D4ED8]/50 dark:text-white/40 mb-8 flex items-center gap-2">
                  <Activity className="w-3.5 h-3.5 text-[#F97316]" /> Desempenho de Funis & Quizzes
                </h3>
                <QuizPerformanceTable />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
