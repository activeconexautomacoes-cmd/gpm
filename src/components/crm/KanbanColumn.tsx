import { Badge } from "@/components/ui/badge";
import { OpportunityCard } from "./OpportunityCard";
import { useDroppable } from "@dnd-kit/core";
import { cn } from "@/lib/utils";

interface KanbanColumnProps {
  stage: any;
  opportunities: any[];
  onCardClick: (opportunity: any) => void;
}

export function KanbanColumn({ stage, opportunities, onCardClick }: KanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: stage.id,
  });
  const totalValue = opportunities.reduce(
    (sum, opp) => sum + (Number(opp.negotiated_value || opp.estimated_value) || 0),
    0
  );

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex-shrink-0 w-[350px] bg-white/40 dark:bg-black/20 backdrop-blur-xl rounded-[32px] p-5 transition-all duration-300 border border-white/60 dark:border-white/5 shadow-xl",
        isOver && "ring-2 ring-[#3B82F6] bg-[#3B82F6]/5 scale-[1.02]"
      )}
    >
      <div className="flex items-center justify-between mb-6 px-1">
        <div className="flex items-center gap-3">
          <div
            className="w-2.5 h-2.5 rounded-full shadow-[0_0_10px_rgba(0,0,0,0.2)]"
            style={{ backgroundColor: stage.color }}
          />
          <h3 className="font-black text-[11px] uppercase tracking-[0.15em] text-[#1D4ED8] dark:text-white/90">
            {stage.name}
          </h3>
          <Badge className="bg-[#3B82F6]/10 dark:bg-white/5 text-[#3B82F6] dark:text-white/60 hover:bg-[#3B82F6]/20 border-none px-2 py-0 h-5 text-[9px] font-black">
            {opportunities.length}
          </Badge>
        </div>
        <span className="text-[11px] font-fira-code font-black text-[#3B82F6] dark:text-[#60A5FA]/80">
          {totalValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 0 })}
        </span>
      </div>

      <div className="space-y-8 max-h-[calc(100vh-320px)] overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-[#3B82F6]/20 scrollbar-track-transparent">
        {opportunities.map((opp) => (
          <OpportunityCard
            key={opp.id}
            opportunity={opp}
            onClick={() => onCardClick(opp)}
          />
        ))}
        {opportunities.length === 0 && (
          <div className="flex flex-col items-center justify-center py-10 opacity-20 group">
            <div className="w-12 h-12 rounded-2xl border-2 border-dashed border-[#3B82F6] mb-3 group-hover:scale-110 transition-transform" />
            <p className="text-[9px] font-black uppercase tracking-widest text-center">
              Vazio
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
