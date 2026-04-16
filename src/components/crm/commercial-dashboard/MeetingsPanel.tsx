import { Card, CardContent } from "@/components/ui/card";
import { CalendarCheck, UserCheck, UserX, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import { MeetingsData } from "./useCommercialDashboardData";

interface Props {
  meetings: MeetingsData;
  lossReasons: MeetingsData["perdidasPorMotivo"];
}

const lossReasonLabels: Record<string, string> = {
  high_price: "Preco muito alto",
  competitor: "Escolheu concorrente",
  bad_timing: "Timing inadequado",
  no_budget: "Sem orcamento",
  no_authority: "Sem autoridade/decisao",
  no_response: "Sem resposta",
  other: "Outro",
};

function MiniKPI({ label, value, icon: Icon, accent }: { label: string; value: string; icon: any; accent: string }) {
  return (
    <div className="flex items-center gap-3 p-3 rounded-xl bg-muted/30 border border-muted">
      <div className={cn("p-2 rounded-lg", accent)}>
        <Icon className="w-4 h-4" />
      </div>
      <div>
        <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider">{label}</p>
        <p className="text-lg font-black font-fira-code">{value}</p>
      </div>
    </div>
  );
}

export function MeetingsPanel({ meetings, lossReasons }: Props) {
  const maxLoss = lossReasons[0]?.count || 1;

  return (
    <Card className="overflow-hidden bg-white/40 dark:bg-black/40 backdrop-blur-md border-white/20 dark:border-white/10 shadow-sm">
      <CardContent className="p-6 space-y-5">
        <h3 className="text-[11px] font-black uppercase tracking-[0.15em] text-muted-foreground/70">
          Reunioes
        </h3>

        <div className="grid grid-cols-3 gap-3">
          <MiniKPI label="Agendadas" value={String(meetings.agendadas.value)} icon={CalendarCheck} accent="bg-blue-500/10 text-blue-600" />
          <MiniKPI label="Realizadas" value={String(meetings.realizadas.value)} icon={UserCheck} accent="bg-emerald-500/10 text-emerald-600" />
          <MiniKPI label="No Show" value={String(meetings.noShow.value)} icon={UserX} accent="bg-rose-500/10 text-rose-600" />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="p-3 rounded-xl bg-muted/30 border border-muted text-center">
            <p className="text-[9px] font-bold text-muted-foreground uppercase">Taxa No Show</p>
            <p className={cn("text-lg font-black font-fira-code", meetings.taxaNoShow.value > 30 ? "text-rose-500" : "text-foreground")}>
              {meetings.taxaNoShow.value.toFixed(1)}%
            </p>
          </div>
          <div className="p-3 rounded-xl bg-muted/30 border border-muted text-center">
            <p className="text-[9px] font-bold text-muted-foreground uppercase">Taxa Agendamento</p>
            <p className="text-lg font-black font-fira-code">{meetings.taxaAgendamento.value.toFixed(1)}%</p>
          </div>
        </div>

        {lossReasons.length > 0 && (
          <div className="space-y-2 pt-3 border-t">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-3 h-3 text-amber-500" />
              <span className="text-[9px] font-black text-muted-foreground uppercase tracking-wider">Motivos de Perda</span>
            </div>
            {lossReasons.slice(0, 7).map(lr => (
              <div key={lr.motivo} className="space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-medium text-muted-foreground truncate max-w-[70%]">
                    {lossReasonLabels[lr.motivo] || lr.motivo}
                  </span>
                  <span className="text-[10px] font-black font-fira-code">{lr.count}</span>
                </div>
                <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
                  <div className="h-full bg-rose-500/60 rounded-full" style={{ width: `${(lr.count / maxLoss) * 100}%` }} />
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
