import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar, Users } from "lucide-react";
import { startOfMonth, endOfMonth, subMonths, subDays, startOfYear, format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { DateRange } from "./useCommercialDashboardData";

interface Props {
  dateRange: DateRange;
  onDateRangeChange: (range: DateRange) => void;
  selectedCloserId: string | null;
  onCloserChange: (id: string | null) => void;
  closerOptions: { id: string; name: string }[];
}

function toDateString(d: Date): string {
  return format(d, "yyyy-MM-dd");
}

export function DashboardFilterBar({ dateRange, onDateRangeChange, selectedCloserId, onCloserChange, closerOptions }: Props) {
  const now = new Date();
  const presets = [
    { label: "Este Mes", from: startOfMonth(now), to: endOfMonth(now) },
    { label: "Mes Passado", from: startOfMonth(subMonths(now, 1)), to: endOfMonth(subMonths(now, 1)) },
    { label: "7 dias", from: subDays(now, 7), to: now },
    { label: "30 dias", from: subDays(now, 30), to: now },
    { label: "Este Ano", from: startOfYear(now), to: now },
  ];

  const activeIdx = presets.findIndex(p =>
    Math.abs(p.from.getTime() - dateRange.from.getTime()) < 86400000 &&
    Math.abs(p.to.getTime() - dateRange.to.getTime()) < 86400000
  );

  return (
    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white/40 dark:bg-white/5 backdrop-blur-xl rounded-2xl border border-white/20 dark:border-white/10 p-4 shadow-sm">
      <div className="flex items-center gap-2 flex-wrap">
        <Calendar className="w-4 h-4 text-muted-foreground shrink-0" />
        {presets.map((p, i) => (
          <Button
            key={i}
            variant={activeIdx === i ? "default" : "ghost"}
            size="sm"
            className="h-7 text-[10px] font-bold uppercase tracking-wider"
            onClick={() => onDateRangeChange({ from: p.from, to: p.to })}
          >
            {p.label}
          </Button>
        ))}
        <div className="flex items-center gap-1.5 ml-2">
          <Input
            type="date"
            value={toDateString(dateRange.from)}
            onChange={(e) => {
              if (e.target.value) onDateRangeChange({ from: new Date(e.target.value + "T00:00:00"), to: dateRange.to });
            }}
            className="h-7 w-[130px] text-[10px] font-mono bg-white/50 dark:bg-black/20 border-white/30 dark:border-white/10 rounded-lg"
          />
          <span className="text-[9px] text-muted-foreground font-bold">ate</span>
          <Input
            type="date"
            value={toDateString(dateRange.to)}
            onChange={(e) => {
              if (e.target.value) onDateRangeChange({ from: dateRange.from, to: new Date(e.target.value + "T23:59:59") });
            }}
            className="h-7 w-[130px] text-[10px] font-mono bg-white/50 dark:bg-black/20 border-white/30 dark:border-white/10 rounded-lg"
          />
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Users className="w-4 h-4 text-muted-foreground" />
        <Select value={selectedCloserId || "all"} onValueChange={v => onCloserChange(v === "all" ? null : v)}>
          <SelectTrigger className="h-8 w-[180px] text-xs">
            <SelectValue placeholder="Todos os Closers" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os Closers</SelectItem>
            {closerOptions.map(c => (
              <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
