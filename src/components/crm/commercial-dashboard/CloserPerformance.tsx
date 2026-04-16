import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { formatCurrency } from "@/utils/format";
import { cn } from "@/lib/utils";
import { Target } from "lucide-react";
import { CloserData } from "./useCommercialDashboardData";

interface Props {
  closers: CloserData[];
}

function getInitials(name: string) {
  return name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);
}

const medals = ["bg-amber-500", "bg-slate-400", "bg-orange-600"];

export function CloserPerformance({ closers }: Props) {
  const [meta, setMeta] = useState<string>("");
  const metaValue = parseFloat(meta) || 0;
  const totalGanho = closers.reduce((s, c) => s + c.totalGanho, 0);
  const metaPct = metaValue > 0 ? (totalGanho / metaValue) * 100 : 0;

  return (
    <Card className="overflow-hidden bg-white/40 dark:bg-black/40 backdrop-blur-md border-white/20 dark:border-white/10 shadow-sm">
      <CardContent className="p-6 space-y-5">
        <h3 className="text-[11px] font-black uppercase tracking-[0.15em] text-muted-foreground/70">
          Performance por Closer
        </h3>

        {/* Meta do mes */}
        <div className="flex items-center gap-3 p-3 rounded-xl bg-muted/30 border border-muted">
          <Target className="w-4 h-4 text-primary shrink-0" />
          <div className="flex-1">
            <p className="text-[9px] font-bold text-muted-foreground uppercase mb-1">Meta do Mes (R$)</p>
            <Input
              type="number"
              placeholder="Ex: 50000"
              value={meta}
              onChange={e => setMeta(e.target.value)}
              className="h-7 text-xs bg-background/50"
            />
          </div>
          {metaValue > 0 && (
            <div className="text-right shrink-0">
              <p className={cn("text-lg font-black font-fira-code", metaPct >= 100 ? "text-emerald-500" : metaPct >= 70 ? "text-amber-500" : "text-rose-500")}>
                {metaPct.toFixed(1)}%
              </p>
              <p className="text-[9px] text-muted-foreground">da meta</p>
            </div>
          )}
        </div>

        {/* Meta progress bar */}
        {metaValue > 0 && (
          <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
            <div
              className={cn("h-full rounded-full transition-all", metaPct >= 100 ? "bg-emerald-500" : metaPct >= 70 ? "bg-amber-500" : "bg-rose-500")}
              style={{ width: `${Math.min(metaPct, 100)}%` }}
            />
          </div>
        )}

        {closers.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-8">Sem dados no periodo</p>
        ) : (
          <div className="space-y-3">
            {closers.map((closer, i) => {
              const contribPct = metaValue > 0 ? (closer.totalGanho / metaValue) * 100 : 0;
              return (
                <div key={closer.id} className="flex items-center gap-3 p-3 rounded-xl bg-muted/30 border border-muted hover:bg-muted/50 transition-colors">
                  <div className={cn(
                    "w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black text-white shrink-0",
                    i < 3 ? medals[i] : "bg-muted-foreground/30"
                  )}>
                    {i + 1}
                  </div>

                  <Avatar className="h-8 w-8 border-2 border-background">
                    <AvatarFallback className="text-[9px] bg-primary/20 text-primary font-black">
                      {getInitials(closer.name)}
                    </AvatarFallback>
                  </Avatar>

                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-black truncate">{closer.name}</p>
                    <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                      <span className="text-[9px] text-muted-foreground">
                        <span className="font-black text-emerald-600">{closer.wins}</span> ganhos
                      </span>
                      <span className="text-[9px] text-muted-foreground">
                        {closer.leads} leads
                      </span>
                      <span className="text-[9px] text-muted-foreground">
                        {closer.reunioesRealizadas} realizadas
                      </span>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <p className="text-sm font-black font-fira-code">{closer.taxaConversao.toFixed(1)}%</p>
                    <p className="text-[9px] text-muted-foreground font-bold">{formatCurrency(closer.totalGanho)}</p>
                    {metaValue > 0 && (
                      <p className="text-[8px] text-primary font-bold">{contribPct.toFixed(1)}% da meta</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
