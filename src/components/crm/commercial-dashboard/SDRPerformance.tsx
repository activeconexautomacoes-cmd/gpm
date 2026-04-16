import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { Target } from "lucide-react";

export interface SDRData {
  id: string;
  name: string;
  leads: number;
  agendados: number;
  taxaAgendamento: number;
}

interface Props {
  sdrs: SDRData[];
}

function getInitials(name: string) {
  return name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);
}

export function SDRPerformance({ sdrs }: Props) {
  const [meta, setMeta] = useState<string>("");
  const metaValue = parseFloat(meta) || 0;
  const totalAgendados = sdrs.reduce((s, c) => s + c.agendados, 0);
  const metaPct = metaValue > 0 ? (totalAgendados / metaValue) * 100 : 0;

  return (
    <Card className="overflow-hidden bg-white/40 dark:bg-black/40 backdrop-blur-md border-white/20 dark:border-white/10 shadow-sm">
      <CardContent className="p-6 space-y-5">
        <h3 className="text-[11px] font-black uppercase tracking-[0.15em] text-muted-foreground/70">
          Performance por SDR
        </h3>

        {/* Meta de agendamento */}
        <div className="flex items-center gap-3 p-3 rounded-xl bg-muted/30 border border-muted">
          <Target className="w-4 h-4 text-indigo-500 shrink-0" />
          <div className="flex-1">
            <p className="text-[9px] font-bold text-muted-foreground uppercase mb-1">Meta Agendamentos</p>
            <Input
              type="number"
              placeholder="Ex: 30"
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
              <p className="text-[9px] text-muted-foreground">{totalAgendados} / {metaValue}</p>
            </div>
          )}
        </div>

        {metaValue > 0 && (
          <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
            <div
              className={cn("h-full rounded-full transition-all", metaPct >= 100 ? "bg-emerald-500" : metaPct >= 70 ? "bg-amber-500" : "bg-rose-500")}
              style={{ width: `${Math.min(metaPct, 100)}%` }}
            />
          </div>
        )}

        {sdrs.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-8">Sem dados no periodo</p>
        ) : (
          <div className="space-y-3">
            {sdrs.map((sdr, i) => {
              const contribPct = metaValue > 0 ? (sdr.agendados / metaValue) * 100 : 0;
              return (
                <div key={sdr.id} className="flex items-center gap-3 p-3 rounded-xl bg-muted/30 border border-muted hover:bg-muted/50 transition-colors">
                  <Avatar className="h-8 w-8 border-2 border-background">
                    <AvatarFallback className="text-[9px] bg-indigo-500/20 text-indigo-600 font-black">
                      {getInitials(sdr.name)}
                    </AvatarFallback>
                  </Avatar>

                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-black truncate">{sdr.name}</p>
                    <div className="flex items-center gap-3 mt-0.5">
                      <span className="text-[9px] text-muted-foreground">
                        {sdr.leads} leads
                      </span>
                      <span className="text-[9px] text-muted-foreground">
                        <span className="font-black text-indigo-600">{sdr.agendados}</span> agendados
                      </span>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <p className="text-sm font-black font-fira-code">{sdr.taxaAgendamento.toFixed(1)}%</p>
                    <p className="text-[9px] text-muted-foreground">tx agendamento</p>
                    {metaValue > 0 && (
                      <p className="text-[8px] text-indigo-500 font-bold">{contribPct.toFixed(1)}% da meta</p>
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
