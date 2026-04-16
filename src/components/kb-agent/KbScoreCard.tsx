import { QUALITY_CRITERIA } from "@/lib/kb/quality-criteria";
import {
  Settings,
  Megaphone,
  Target,
  Wallet,
} from "lucide-react";

const ICONS: Record<string, React.ElementType> = {
  Settings,
  Megaphone,
  Target,
  Wallet,
};

function scoreColor(score: number): string {
  if (score >= 9) return "text-emerald-600";
  if (score >= 7) return "text-amber-500";
  if (score >= 4) return "text-orange-500";
  return "text-red-500";
}

function barColor(score: number): string {
  if (score >= 9) return "bg-emerald-500";
  if (score >= 7) return "bg-amber-400";
  if (score >= 4) return "bg-orange-400";
  return "bg-red-400";
}

interface KbScoreCardProps {
  categoryKey: string;
  score: number;
  onClick?: () => void;
}

export function KbScoreCard({ categoryKey, score, onClick }: KbScoreCardProps) {
  const category = QUALITY_CRITERIA[categoryKey];
  if (!category) return null;

  const Icon = ICONS[category.icon] || Settings;
  const pct = Math.min((score / 10) * 100, 100);

  return (
    <button
      onClick={onClick}
      className="flex flex-col gap-1.5 rounded-lg border bg-card p-3 text-left transition-shadow hover:shadow-md sm:gap-2 sm:p-4"
    >
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted sm:h-9 sm:w-9">
            <Icon className="h-3.5 w-3.5 text-muted-foreground sm:h-4 sm:w-4" />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-semibold sm:text-sm">
              {category.name}
            </p>
            <p className="hidden text-xs text-muted-foreground sm:block">
              {category.description}
            </p>
          </div>
        </div>
        <span
          className={`shrink-0 text-base font-bold sm:text-lg ${scoreColor(score)}`}
        >
          {score.toFixed(1)}
        </span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
        <div
          className={`h-full rounded-full transition-all duration-700 ease-out ${barColor(score)}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </button>
  );
}
