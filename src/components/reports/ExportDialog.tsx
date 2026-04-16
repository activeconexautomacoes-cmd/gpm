import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Download } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";

interface ExportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  dateRange: { from: Date; to: Date };
  reportData: any;
}

export function ExportDialog({ open, onOpenChange, dateRange, reportData }: ExportDialogProps) {
  const [selectedReports, setSelectedReports] = useState({
    contracts: true,
    billings: true,
    expenses: true,
    sales: true,
    churns: true,
  });

  const handleExport = () => {
    let csvContent = "";

    // Header
    csvContent += `Relatório do Período: ${format(dateRange.from, "dd/MM/yyyy")} a ${format(dateRange.to, "dd/MM/yyyy")}\n\n`;

    // Summary
    csvContent += "RESUMO FINANCEIRO\n";
    csvContent += `Receita Total,R$ ${reportData?.totalRevenue.toFixed(2)}\n`;
    csvContent += `Despesas Totais,R$ ${reportData?.totalExpenses.toFixed(2)}\n`;
    csvContent += `Lucro Líquido,R$ ${reportData?.netProfit.toFixed(2)}\n\n`;

    // Export selected reports
    if (selectedReports.contracts && reportData?.contracts) {
      csvContent += "CONTRATOS\n";
      csvContent += "Nome,Cliente,Valor,Status,Data Início\n";
      reportData.contracts.forEach((c: any) => {
        csvContent += `${c.name},${c.client_id},R$ ${Number(c.value).toFixed(2)},${c.status},${format(new Date(c.start_date), "dd/MM/yyyy")}\n`;
      });
      csvContent += "\n";
    }

    if (selectedReports.billings && reportData?.billings) {
      csvContent += "COBRANÇAS\n";
      csvContent += "Contrato,Valor,Desconto,Valor Final,Status,Vencimento\n";
      reportData.billings.forEach((b: any) => {
        csvContent += `${b.contract_id},R$ ${Number(b.amount).toFixed(2)},R$ ${Number(b.discount).toFixed(2)},R$ ${Number(b.final_amount).toFixed(2)},${b.status},${format(new Date(b.due_date), "dd/MM/yyyy")}\n`;
      });
      csvContent += "\n";
    }

    if (selectedReports.expenses && reportData?.expenses) {
      csvContent += "DESPESAS\n";
      csvContent += "Descrição,Valor,Categoria,Status,Vencimento\n";
      reportData.expenses.forEach((e: any) => {
        csvContent += `${e.description},R$ ${Number(e.total_amount).toFixed(2)},${e.category_id || "Sem categoria"},${e.status},${format(new Date(e.due_date), "dd/MM/yyyy")}\n`;
      });
      csvContent += "\n";
    }

    if (selectedReports.sales && reportData?.sales) {
      csvContent += "VENDAS AVULSAS\n";
      csvContent += "Descrição,Valor,Cliente,Status,Data\n";
      reportData.sales.forEach((s: any) => {
        csvContent += `${s.description},R$ ${Number(s.amount).toFixed(2)},${s.client_id},${s.status},${format(new Date(s.sale_date), "dd/MM/yyyy")}\n`;
      });
      csvContent += "\n";
    }

    if (selectedReports.churns && reportData?.churns) {
      csvContent += "CHURNS\n";
      csvContent += "Cliente,Contrato,MRR Perdido,Motivo,Multa,Data\n";
      reportData.churns.forEach((c: any) => {
        csvContent += `${c.client_id},${c.contract_id},R$ ${Number(c.mrr_lost).toFixed(2)},${c.reason_type},${c.penalty_paid ? `R$ ${Number(c.penalty_amount).toFixed(2)}` : "Não"},${format(new Date(c.churn_date), "dd/MM/yyyy")}\n`;
      });
    }

    // Download
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `relatorio_${format(new Date(), "yyyyMMdd_HHmmss")}.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    toast.success("Relatório exportado com sucesso!");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Exportar Relatório</DialogTitle>
          <DialogDescription>
            Selecione os dados que deseja incluir no relatório CSV
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="flex items-center space-x-2">
            <Checkbox
              id="contracts"
              checked={selectedReports.contracts}
              onCheckedChange={(checked) =>
                setSelectedReports({ ...selectedReports, contracts: checked as boolean })
              }
            />
            <Label htmlFor="contracts">Contratos</Label>
          </div>
          <div className="flex items-center space-x-2">
            <Checkbox
              id="billings"
              checked={selectedReports.billings}
              onCheckedChange={(checked) =>
                setSelectedReports({ ...selectedReports, billings: checked as boolean })
              }
            />
            <Label htmlFor="billings">Cobranças</Label>
          </div>
          <div className="flex items-center space-x-2">
            <Checkbox
              id="expenses"
              checked={selectedReports.expenses}
              onCheckedChange={(checked) =>
                setSelectedReports({ ...selectedReports, expenses: checked as boolean })
              }
            />
            <Label htmlFor="expenses">Despesas</Label>
          </div>
          <div className="flex items-center space-x-2">
            <Checkbox
              id="sales"
              checked={selectedReports.sales}
              onCheckedChange={(checked) =>
                setSelectedReports({ ...selectedReports, sales: checked as boolean })
              }
            />
            <Label htmlFor="sales">Vendas Avulsas</Label>
          </div>
          <div className="flex items-center space-x-2">
            <Checkbox
              id="churns"
              checked={selectedReports.churns}
              onCheckedChange={(checked) =>
                setSelectedReports({ ...selectedReports, churns: checked as boolean })
              }
            />
            <Label htmlFor="churns">Churns</Label>
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleExport}>
            <Download className="mr-2 h-4 w-4" />
            Exportar CSV
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
