import { Card, CardContent } from "@/components/ui/card";
import { Clock, TrendingDown, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { KPIData } from "./useCommercialDashboardData";

interface CycleEntry {
  name: string;
  avgDays: number;
  count: number;
}

interface Props {
  avgDays: KPIData;
  byCloser: CycleEntry[];
  byProduct: CycleEntry[];
}

function DeltaBadge({ delta }: { delta: number }) {
  if (delta === 0) return null;
  // Para ciclo de vendas, menor é melhor — então delta negativo é bom
  const isGood = delta < 0;
  return (
    <span className={cn(
      "text-[9px] font-black px-1.5 py-0.5 rounded-md inline-flex items-center gap-0.5",
      isGood ? "text-emerald-600 bg-emerald-500/10" : "text-rose-600 bg-rose-500/10"
    )}>
      {isGood ? <TrendingDown className="w-3 h-3" /> : <TrendingUp className="w-3 h-3" />}
      {delta >= 0 ? "+" : ""}{delta.toFixed(1)}%
    </span>
  );
}

export function SalesCycleCard({ avgDays, byCloser, byProduct }: Props) {
  return (
    <Card className="overflow-hidden bg-white/40 dark:bg-black/40 backdrop-blur-md border-white/20 dark:border-white/10 shadow-sm">
      <CardContent className="p-6 space-y-5">
        <h3 className="text-[11px] font-black uppercase tracking-[0.15em] text-muted-foreground/70">
          Ciclo de Vendas
        </h3>

        {/* KPI principal */}
        <div className="flex items-center gap-4 p-4 rounded-xl bg-muted/30 border border-muted">
          <div className="p-3 rounded-xl bg-primary/10 text-primary">
            <Clock className="w-5 h-5" />
          </div>
          <div className="flex-1">
            <p className="text-[9px] font-bold text-muted-foreground uppercase">Tempo medio Lead → Ganho</p>
            <div className="flex items-center gap-3">
              <p className="text-2xl font-black font-fira-code">{Math.round(avgDays.value)} dias</p>
              <DeltaBadge delta={avgDays.delta} />
            </div>
          </div>
        </div>

        {/* Por Closer */}
        {byCloser.length > 0 && (
          <div className="space-y-2">
            <p className="text-[9px] font-black text-muted-foreground uppercase tracking-wider">Por Closer</p>
            {byCloser.map(c => (
              <div key={c.name} className="flex items-center justify-between p-2 rounded-lg bg-muted/20">
                <span className="text-[10px] font-bold truncate max-w-[60%]">{c.name}</span>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-black font-fira-code">{c.avgDays} dias</span>
                  <span className="text-[9px] text-muted-foreground">({c.count} vendas)</span>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Por Produto */}
        {byProduct.length > 0 && (
          <div className="space-y-2 pt-3 border-t">
            <p className="text-[9px] font-black text-muted-foreground uppercase tracking-wider">Por Produto</p>
            {byProduct.map(p => (
              <div key={p.name} className="flex items-center justify-between p-2 rounded-lg bg-muted/20">
                <span className="text-[10px] font-bold truncate max-w-[60%]">{p.name}</span>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-black font-fira-code">{p.avgDays} dias</span>
                  <span className="text-[9px] text-muted-foreground">({p.count} vendas)</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
