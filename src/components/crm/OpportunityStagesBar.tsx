import React from "react";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface OpportunityStagesBarProps {
    stages: any[];
    currentStageId: string;
    onStageClick?: (stageId: string) => void;
    wonAt?: string;
    lostAt?: string;
}

export function OpportunityStagesBar({
    stages,
    currentStageId,
    onStageClick,
    wonAt,
    lostAt,
}: OpportunityStagesBarProps) {
    return (
        <div className="flex items-center w-full overflow-x-auto no-scrollbar bg-muted/50 p-2 rounded-lg border border-border shadow-sm">
            {stages.map((stage, index) => {
                const isCurrent = stage.id === currentStageId;
                const isPast = stages.findIndex(s => s.id === currentStageId) > index;
                const isWon = stage.name.toLowerCase().includes("ganhou");
                const isLost = stage.name.toLowerCase().includes("perdeu");

                return (
                    <div key={stage.id} className="flex items-center flex-shrink-0">
                        <button
                            type="button"
                            disabled={!onStageClick}
                            onClick={() => onStageClick?.(stage.id)}
                            className={cn(
                                "flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium transition-all",
                                isCurrent
                                    ? "bg-primary text-primary-foreground shadow-sm scale-105 z-10"
                                    : isPast
                                        ? "text-primary/70 hover:text-primary transition-colors"
                                        : "text-muted-foreground hover:text-foreground",
                                isWon && wonAt && "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20",
                                isLost && lostAt && "bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20"
                            )}
                        >
                            <div className={cn(
                                "w-1.5 h-1.5 rounded-full",
                                isCurrent ? "bg-background animate-pulse" : "bg-current opacity-40"
                            )} />
                            {stage.name}
                        </button>
                        {index < stages.length - 1 && (
                            <ChevronRight className="w-4 h-4 text-muted-foreground/30 mx-1" />
                        )}
                    </div>
                );
            })}
        </div>
    );
}
