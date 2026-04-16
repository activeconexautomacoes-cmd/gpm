import { Card, CardContent } from "@/components/ui/card";
import { TrendingUp, Target, DollarSign, Users } from "lucide-react";
import { formatCurrency } from "@/utils/format";
import { cn } from "@/lib/utils";

interface Props {
  pipelineValue: number;
  pipelineCount: number;
  forecastValue: number;
  taxaConversao: number;
}

export function ForecastCard({ pipelineValue, pipelineCount, forecastValue, taxaConversao }: Props) {
  return (
    <Card className="overflow-hidden bg-white/40 dark:bg-black/40 backdrop-blur-md border-white/20 dark:border-white/10 shadow-sm">
      <CardContent className="p-6 space-y-5">
        <h3 className="text-[11px] font-black uppercase tracking-[0.15em] text-muted-foreground/70">
          Forecast
        </h3>

        {/* Forecast principal */}
        <div className="flex items-center gap-4 p-4 rounded-xl bg-emerald-500/5 border border-emerald-500/20">
          <div className="p-3 rounded-xl bg-emerald-500/10 text-emerald-600">
            <TrendingUp className="w-5 h-5" />
          </div>
          <div className="flex-1">
            <p className="text-[9px] font-bold text-muted-foreground uppercase">Receita prevista</p>
            <p className="text-2xl font-black font-fira-code text-emerald-600">{formatCurrency(forecastValue)}</p>
            <p className="text-[9px] text-muted-foreground">pipeline x taxa de conversao</p>
          </div>
        </div>

        {/* Detalhes */}
        <div className="grid grid-cols-3 gap-3">
          <div className="p-3 rounded-xl bg-muted/30 border border-muted text-center">
            <DollarSign className="w-4 h-4 mx-auto text-muted-foreground mb-1" />
            <p className="text-[9px] font-bold text-muted-foreground uppercase">Pipeline</p>
            <p className="text-sm font-black font-fira-code">{formatCurrency(pipelineValue)}</p>
          </div>
          <div className="p-3 rounded-xl bg-muted/30 border border-muted text-center">
            <Users className="w-4 h-4 mx-auto text-muted-foreground mb-1" />
            <p className="text-[9px] font-bold text-muted-foreground uppercase">Em aberto</p>
            <p className="text-sm font-black font-fira-code">{pipelineCount}</p>
          </div>
          <div className="p-3 rounded-xl bg-muted/30 border border-muted text-center">
            <Target className="w-4 h-4 mx-auto text-muted-foreground mb-1" />
            <p className="text-[9px] font-bold text-muted-foreground uppercase">Tx Conversao</p>
            <p className="text-sm font-black font-fira-code">{taxaConversao.toFixed(1)}%</p>
          </div>
        </div>

        <p className="text-[9px] text-muted-foreground italic text-center">
          Forecast = {formatCurrency(pipelineValue)} (pipeline) x {taxaConversao.toFixed(1)}% (conversao) = {formatCurrency(forecastValue)}
        </p>
      </CardContent>
    </Card>
  );
}
