import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { FunnelStep } from "./useCommercialDashboardData";

interface Props {
  steps: FunnelStep[];
}

const stepColors = [
  "bg-blue-500",
  "bg-cyan-500",
  "bg-teal-500",
  "bg-amber-500",
  "bg-orange-500",
  "bg-emerald-500",
];

const stepBgColors = [
  "bg-blue-500/10",
  "bg-cyan-500/10",
  "bg-teal-500/10",
  "bg-amber-500/10",
  "bg-orange-500/10",
  "bg-emerald-500/10",
];

export function SalesFunnel({ steps }: Props) {
  const maxCount = steps[0]?.count || 1;

  return (
    <Card className="overflow-hidden bg-white/40 dark:bg-black/40 backdrop-blur-md border-white/20 dark:border-white/10 shadow-sm">
      <CardContent className="p-6">
        <h3 className="text-[11px] font-black uppercase tracking-[0.15em] text-muted-foreground/70 mb-6">
          Funil de Conversao
        </h3>

        <div className="space-y-3">
          {steps.map((step, i) => {
            const widthPct = maxCount > 0 ? Math.max((step.count / maxCount) * 100, 8) : 8;
            const prevStep = i > 0 ? steps[i - 1] : null;

            return (
              <div key={step.name}>
                {/* Conversion rate between steps */}
                {i > 0 && prevStep && (
                  <div className="flex items-center gap-4 my-1">
                    <div className="w-20 shrink-0" />
                    <div className="flex-1 flex items-center justify-center">
                      <span className="text-[9px] font-bold text-muted-foreground/50">
                        {prevStep.name} → {step.name}: {step.rate.toFixed(1)}%
                      </span>
                    </div>
                    <div className="w-14 shrink-0" />
                  </div>
                )}

                <div className="flex items-center gap-4">
                  {/* Label */}
                  <div className="w-20 shrink-0 text-right">
                    <span className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">
                      {step.name}
                    </span>
                  </div>

                  {/* Bar */}
                  <div className="flex-1 relative">
                    <div className={cn("h-10 rounded-xl flex items-center justify-center transition-all duration-500", stepBgColors[i] || "bg-slate-500/10")}
                      style={{ width: "100%" }}
                    >
                      <div
                        className={cn("h-10 rounded-xl flex items-center transition-all duration-700", stepColors[i] || "bg-slate-500")}
                        style={{ width: `${widthPct}%`, minWidth: "60px" }}
                      >
                        <span className="text-white text-xs font-black px-3 whitespace-nowrap">
                          {step.count}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Percentage from total */}
                  <div className="w-14 shrink-0">
                    <span className="text-[10px] font-bold text-muted-foreground font-fira-code">
                      {maxCount > 0 ? ((step.count / maxCount) * 100).toFixed(1) : 0}%
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
