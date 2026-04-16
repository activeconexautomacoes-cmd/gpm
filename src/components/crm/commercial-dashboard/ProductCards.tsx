import { Card, CardContent } from "@/components/ui/card";
import { formatCurrency } from "@/utils/format";
import { cn } from "@/lib/utils";
import { ProductData } from "./useCommercialDashboardData";

interface Props {
  products: ProductData[];
}

const productColors: Record<string, string> = {
  "Assessoria": "from-blue-500/10 to-blue-500/5 border-blue-500/20",
  "Plus Academy": "from-emerald-500/10 to-emerald-500/5 border-emerald-500/20",
  "Aplicativo": "from-violet-500/10 to-violet-500/5 border-violet-500/20",
};

const productAccents: Record<string, string> = {
  "Assessoria": "text-blue-600 dark:text-blue-400",
  "Plus Academy": "text-emerald-600 dark:text-emerald-400",
  "Aplicativo": "text-violet-600 dark:text-violet-400",
};

function DeltaBadge({ delta }: { delta: number }) {
  if (delta === 0) return null;
  const isUp = delta > 0;
  return (
    <span className={cn(
      "text-[9px] font-black px-1.5 py-0.5 rounded-md",
      isUp ? "text-emerald-600 bg-emerald-500/10" : "text-rose-600 bg-rose-500/10"
    )}>
      {isUp ? "+" : ""}{delta.toFixed(1)}%
    </span>
  );
}

export function ProductCards({ products }: Props) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      {products.map(p => (
        <Card key={p.name} className={cn(
          "overflow-hidden border bg-gradient-to-br backdrop-blur-md",
          productColors[p.name] || "from-slate-500/10 to-slate-500/5 border-slate-500/20"
        )}>
          <CardContent className="p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className={cn("text-xs font-black uppercase tracking-widest", productAccents[p.name] || "text-foreground")}>
                {p.name}
              </h3>
              <span className="text-[9px] text-muted-foreground font-bold">{p.wins} vendas / {p.leads} leads</span>
            </div>

            <div className="space-y-3">
              <div className="flex items-end justify-between">
                <div>
                  <p className="text-[9px] text-muted-foreground font-bold uppercase tracking-wider">Ganho</p>
                  <p className="text-xl font-black font-fira-code">{formatCurrency(p.ganho.value)}</p>
                </div>
                <DeltaBadge delta={p.ganho.delta} />
              </div>

              <div className="grid grid-cols-2 gap-3 pt-2 border-t border-current/5">
                <div>
                  <p className="text-[9px] text-muted-foreground font-bold uppercase">Ticket Medio</p>
                  <p className="text-sm font-black font-fira-code">{formatCurrency(p.ticketMedio.value)}</p>
                  <DeltaBadge delta={p.ticketMedio.delta} />
                </div>
                <div>
                  <p className="text-[9px] text-muted-foreground font-bold uppercase">Conversao</p>
                  <p className="text-sm font-black font-fira-code">{p.taxaConversao.value.toFixed(1)}%</p>
                  <DeltaBadge delta={p.taxaConversao.delta} />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
