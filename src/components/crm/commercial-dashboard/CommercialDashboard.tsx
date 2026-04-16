import { useState, useMemo } from "react";
import { startOfMonth, endOfMonth } from "date-fns";
import { useCommercialDashboardData, DateRange } from "./useCommercialDashboardData";
import { DashboardFilterBar } from "./DashboardFilterBar";
import { KPICardsGrid } from "./KPICardsGrid";
import { ProductCards } from "./ProductCards";
import { SalesFunnel } from "./SalesFunnel";
import { MeetingsPanel } from "./MeetingsPanel";
import { CloserPerformance } from "./CloserPerformance";
import { SDRPerformance } from "./SDRPerformance";
import { LeadsByChannel } from "./LeadsByChannel";
import { SegmentChart } from "./SegmentChart";
import { SalesCycleCard } from "./SalesCycleCard";
import { ForecastCard } from "./ForecastCard";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tag } from "lucide-react";

interface Props {
  opportunities: any[];
  stages: any[];
}

export function CommercialDashboard({ opportunities, stages }: Props) {
  const [dateRange, setDateRange] = useState<DateRange>({
    from: startOfMonth(new Date()),
    to: endOfMonth(new Date()),
  });
  const [selectedCloserId, setSelectedCloserId] = useState<string | null>(null);
  const [selectedSegment, setSelectedSegment] = useState<string | null>(null);

  const closerOptions = useMemo(() => {
    const map = new Map<string, string>();
    opportunities.forEach(o => {
      if (o.assigned_closer && o.assigned_closer_profile?.full_name) {
        map.set(o.assigned_closer, o.assigned_closer_profile.full_name);
      }
    });
    return Array.from(map.entries())
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [opportunities]);

  const segmentOptions = ["Esportivo", "Moda Masculina", "Moda Feminina", "Calçados", "Moda Fitness", "Outros"];

  // Filter by segment before passing to hook
  const filteredOpps = useMemo(() => {
    if (!selectedSegment) return opportunities;
    return opportunities.filter(o => o.company_segment === selectedSegment);
  }, [opportunities, selectedSegment]);

  const data = useCommercialDashboardData(filteredOpps, stages, dateRange, selectedCloserId);

  return (
    <div className="space-y-8">
      <DashboardFilterBar
        dateRange={dateRange}
        onDateRangeChange={setDateRange}
        selectedCloserId={selectedCloserId}
        onCloserChange={setSelectedCloserId}
        closerOptions={closerOptions}
      />

      {/* Segment filter */}
      {segmentOptions.length > 0 && (
        <div className="flex items-center gap-2">
          <Tag className="w-4 h-4 text-muted-foreground" />
          <Select value={selectedSegment || "all"} onValueChange={v => setSelectedSegment(v === "all" ? null : v)}>
            <SelectTrigger className="h-8 w-[220px] text-xs">
              <SelectValue placeholder="Todos os Segmentos" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os Segmentos</SelectItem>
              {segmentOptions.map(s => (
                <SelectItem key={s} value={s}>{s}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      <KPICardsGrid kpis={data.kpis} wonDetails={data.wonDetails} />

      {data.products.length > 0 && <ProductCards products={data.products} />}

      <SalesFunnel steps={data.funnel} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <MeetingsPanel meetings={data.meetings} lossReasons={data.meetings.perdidasPorMotivo} />
        <CloserPerformance closers={data.closers} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <SalesCycleCard
          avgDays={data.salesCycle.avgDays}
          byCloser={data.salesCycle.byCloser}
          byProduct={data.salesCycle.byProduct}
        />
        <ForecastCard
          pipelineValue={data.forecast.pipelineValue}
          pipelineCount={data.forecast.pipelineCount}
          forecastValue={data.forecast.forecastValue}
          taxaConversao={data.forecast.taxaConversao}
        />
      </div>

      <SDRPerformance sdrs={data.sdrs} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <LeadsByChannel channels={data.channels} />
        <SegmentChart segments={data.segments} />
      </div>
    </div>
  );
}
