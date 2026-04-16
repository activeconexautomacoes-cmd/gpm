import { useState } from "react";
import { DollarSign, TrendingUp, CreditCard, Wrench, Target, Percent, X } from "lucide-react";
import { formatCurrency } from "@/utils/format";
import { MetricsCard } from "@/components/dashboard/MetricsCard";
import { KPIData, WonDetail } from "./useCommercialDashboardData";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Props {
  kpis: {
    totalGanho: KPIData;
    ganhoMensalidade: KPIData;
    ganhoImplementacao: KPIData;
    txMrr: KPIData;
    ticketMedio: KPIData;
    taxaConversao: KPIData;
  };
  wonDetails?: WonDetail[];
}

function trend(delta: number): "up" | "down" | "neutral" {
  if (delta > 0) return "up";
  if (delta < 0) return "down";
  return "neutral";
}

function trendVal(delta: number): string {
  return `${delta >= 0 ? "+" : ""}${delta.toFixed(1)}%`;
}

type DrillType = "totalGanho" | "ganhoMensalidade" | "ganhoImplementacao" | null;

export function KPICardsGrid({ kpis, wonDetails = [] }: Props) {
  const [drill, setDrill] = useState<DrillType>(null);

  const drillTitle: Record<string, string> = {
    totalGanho: "Detalhes — Total Ganho",
    ganhoMensalidade: "Detalhes — Ganho Mensalidade (Assessoria)",
    ganhoImplementacao: "Detalhes — Ganho Implementacao",
  };

  const filteredDetails = drill === "ganhoMensalidade"
    ? wonDetails.filter(d => d.mensalidade > 0)
    : drill === "ganhoImplementacao"
    ? wonDetails.filter(d => d.implementacao > 0)
    : wonDetails;

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <div className="cursor-pointer" onClick={() => setDrill("totalGanho")}>
          <MetricsCard
            title="Total Ganho"
            value={formatCurrency(kpis.totalGanho.value)}
            icon={DollarSign}
            variant="success"
            trend={trend(kpis.totalGanho.delta)}
            trendValue={trendVal(kpis.totalGanho.delta)}
            description="vs periodo anterior"
          />
        </div>
        <div className="cursor-pointer" onClick={() => setDrill("ganhoMensalidade")}>
          <MetricsCard
            title="Ganho Mensalidade"
            value={formatCurrency(kpis.ganhoMensalidade.value)}
            icon={CreditCard}
            variant="primary"
            trend={trend(kpis.ganhoMensalidade.delta)}
            trendValue={trendVal(kpis.ganhoMensalidade.delta)}
            description="assessoria recorrente"
          />
        </div>
        <div className="cursor-pointer" onClick={() => setDrill("ganhoImplementacao")}>
          <MetricsCard
            title={`Ganho Implementa\u00e7\u00e3o`}
            value={formatCurrency(kpis.ganhoImplementacao.value)}
            icon={Wrench}
            variant="secondary"
            trend={trend(kpis.ganhoImplementacao.delta)}
            trendValue={trendVal(kpis.ganhoImplementacao.delta)}
            description="vs periodo anterior"
          />
        </div>
        <MetricsCard
          title="TX MRR"
          value={formatCurrency(kpis.txMrr.value)}
          icon={TrendingUp}
          variant="success"
          trend={trend(kpis.txMrr.delta)}
          trendValue={trendVal(kpis.txMrr.delta)}
          description="mensalidade media por venda"
        />
        <MetricsCard
          title={`Ticket M\u00e9dio`}
          value={formatCurrency(kpis.ticketMedio.value)}
          icon={Target}
          variant="warning"
          trend={trend(kpis.ticketMedio.delta)}
          trendValue={trendVal(kpis.ticketMedio.delta)}
          description="valor medio por venda"
        />
        <MetricsCard
          title={`Taxa de Convers\u00e3o`}
          value={`${kpis.taxaConversao.value.toFixed(1)}%`}
          icon={Percent}
          variant="primary"
          trend={trend(kpis.taxaConversao.delta)}
          trendValue={trendVal(kpis.taxaConversao.delta)}
          description="ganhos / realizadas"
        />
      </div>

      {/* Drill-down dialog */}
      <Dialog open={!!drill} onOpenChange={() => setDrill(null)}>
        <DialogContent className="max-w-lg max-h-[70vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-sm font-black uppercase tracking-wider">
              {drill && drillTitle[drill]}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-2 mt-2">
            {filteredDetails.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-4">Sem dados no periodo</p>
            ) : (
              filteredDetails.map(d => (
                <div key={d.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/30 border border-muted">
                  <div className="min-w-0">
                    <p className="text-xs font-bold truncate">{d.leadName}</p>
                    <p className="text-[9px] text-muted-foreground">
                      {d.product} — {format(new Date(d.wonAt), "dd/MM/yyyy", { locale: ptBR })}
                    </p>
                  </div>
                  <div className="text-right shrink-0 ml-4">
                    {drill === "ganhoMensalidade" ? (
                      <p className="text-sm font-black font-fira-code">{formatCurrency(d.mensalidade)}</p>
                    ) : drill === "ganhoImplementacao" ? (
                      <p className="text-sm font-black font-fira-code">{formatCurrency(d.implementacao)}</p>
                    ) : (
                      <p className="text-sm font-black font-fira-code">{formatCurrency(d.value)}</p>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
