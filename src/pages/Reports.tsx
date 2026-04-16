import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { format } from "date-fns";
import { CalendarIcon, Download, BarChart } from "lucide-react";
import { ReportCard } from "@/components/reports/ReportCard";
import { ExportDialog } from "@/components/reports/ExportDialog";
import { cn } from "@/lib/utils";

export default function Reports() {
  const { currentWorkspace, can } = useWorkspace();
  const [dateRange, setDateRange] = useState<{ from: Date; to: Date }>({
    from: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
    to: new Date(),
  });
  const [exportDialogOpen, setExportDialogOpen] = useState(false);

  const { data: reportData } = useQuery({
    queryKey: ["reports", currentWorkspace?.id, dateRange],
    queryFn: async () => {
      if (!currentWorkspace?.id) return null;

      const [contracts, billings, expenses, sales, churns, receivables] = await Promise.all([
        (supabase as any)
          .from("contracts")
          .select("*")
          .eq("workspace_id", currentWorkspace.id)
          .gte("created_at", dateRange.from.toISOString())
          .lte("created_at", dateRange.to.toISOString()),
        (supabase as any)
          .from("contract_billings")
          .select("*")
          .eq("workspace_id", currentWorkspace.id)
          .gte("payment_date", format(dateRange.from, "yyyy-MM-dd"))
          .lte("payment_date", format(dateRange.to, "yyyy-MM-dd"))
          .eq("status", "paid"),
        (supabase as any)
          .from("financial_payables")
          .select("*")
          .eq("workspace_id", currentWorkspace.id)
          .gte("due_date", format(dateRange.from, "yyyy-MM-dd"))
          .lte("due_date", format(dateRange.to, "yyyy-MM-dd")),
        (supabase as any)
          .from("one_time_sales")
          .select("*")
          .eq("workspace_id", currentWorkspace.id)
          .gte("payment_date", format(dateRange.from, "yyyy-MM-dd"))
          .lte("payment_date", format(dateRange.to, "yyyy-MM-dd"))
          .eq("status", "paid"),
        (supabase as any)
          .from("churns")
          .select("*")
          .eq("workspace_id", currentWorkspace.id)
          .gte("churn_date", format(dateRange.from, "yyyy-MM-dd"))
          .lte("churn_date", format(dateRange.to, "yyyy-MM-dd")),
        (supabase as any)
          .from("financial_receivables")
          .select("*")
          .eq("workspace_id", currentWorkspace.id)
          .is("contract_billing_id", null)
          .is("one_time_sale_id", null)
          .gte("payment_date", format(dateRange.from, "yyyy-MM-dd"))
          .lte("payment_date", format(dateRange.to, "yyyy-MM-dd"))
          .eq("status", "paid"),
      ]);

      const totalRevenue =
        (billings.data?.reduce((sum, b) => sum + Number(b.final_amount), 0) || 0) +
        (sales.data?.reduce((sum, s) => sum + Number(s.amount), 0) || 0) +
        (receivables.data?.reduce((sum, r) => sum + Number(r.total_amount), 0) || 0) +
        (churns.data?.reduce((sum, c) => sum + Number(c.penalty_amount || 0), 0) || 0);

      const totalExpenses = expenses.data?.reduce((sum, e) => sum + Number(e.total_amount), 0) || 0;

      const netProfit = totalRevenue - totalExpenses;

      return {
        contracts: contracts.data || [],
        billings: billings.data || [],
        expenses: expenses.data || [],
        sales: sales.data || [],
        churns: churns.data || [],
        totalRevenue,
        totalExpenses,
        netProfit,
      };
    },
    enabled: !!currentWorkspace?.id,
  });

  if (!can('reports.view')) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] text-center space-y-4">
        <div className="p-4 rounded-full bg-muted">
          <BarChart className="h-8 w-8 text-muted-foreground" />
        </div>
        <div>
          <h2 className="text-lg font-semibold">Acesso Restrito</h2>
          <p className="text-muted-foreground max-w-sm">
            Você não tem permissão para visualizar os relatórios.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 md:p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Relatórios</h1>
          <p className="text-muted-foreground">
            Análises financeiras e operacionais do workspace
          </p>
        </div>
        <div className="flex gap-2">
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline">
                <CalendarIcon className="mr-2 h-4 w-4" />
                {format(dateRange.from, "dd/MM/yyyy")} -{" "}
                {format(dateRange.to, "dd/MM/yyyy")}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="end">
              <Calendar
                mode="single"
                selected={dateRange.from}
                onSelect={(date) => date && setDateRange({ ...dateRange, from: date })}
              />
            </PopoverContent>
          </Popover>
          <Button onClick={() => setExportDialogOpen(true)}>
            <Download className="mr-2 h-4 w-4" />
            Exportar
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <ReportCard
          title="Receita Total"
          value={`R$ ${reportData?.totalRevenue.toFixed(2) || "0.00"}`}
          description="Receita do período"
          icon={BarChart}
          trend="up"
        />
        <ReportCard
          title="Despesas Totais"
          value={`R$ ${reportData?.totalExpenses.toFixed(2) || "0.00"}`}
          description="Despesas do período"
          icon={BarChart}
          trend="down"
        />
        <ReportCard
          title="Lucro Líquido"
          value={`R$ ${reportData?.netProfit.toFixed(2) || "0.00"}`}
          description="Receita - Despesas"
          icon={BarChart}
          trend={reportData && reportData.netProfit > 0 ? "up" : "down"}
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Resumo de Contratos</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Contratos Ativos:</span>
              <span className="font-medium">
                {reportData?.contracts.filter((c) => c.status === "active").length || 0}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Novos Contratos:</span>
              <span className="font-medium">{reportData?.contracts.length || 0}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Cancelamentos:</span>
              <span className="font-medium">{reportData?.churns.length || 0}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Resumo de Cobranças</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Pagas:</span>
              <span className="font-medium">
                {reportData?.billings.filter((b) => b.status === "paid").length || 0}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Pendentes:</span>
              <span className="font-medium">
                {reportData?.billings.filter((b) => b.status === "pending").length || 0}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Atrasadas:</span>
              <span className="font-medium">
                {reportData?.billings.filter((b) => b.status === "overdue").length || 0}
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      <ExportDialog
        open={exportDialogOpen}
        onOpenChange={setExportDialogOpen}
        dateRange={dateRange}
        reportData={reportData}
      />
    </div>
  );
}
