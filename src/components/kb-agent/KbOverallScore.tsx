interface KbOverallScoreProps {
  score: number;
  documentCount?: number;
}

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

export function KbOverallScore({ score: rawScore, documentCount }: KbOverallScoreProps) {
  const score = Number.isFinite(rawScore) ? rawScore : 0;
  const pct = Math.max(0, Math.min((score / 10) * 100, 100));

  return (
    <div className="rounded-lg border bg-card p-5">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold">
            Qualidade Geral
          </h3>
          {documentCount !== undefined && (
            <p className="text-sm text-muted-foreground">
              {documentCount} documento{documentCount !== 1 ? "s" : ""} indexado
              {documentCount !== 1 ? "s" : ""}
            </p>
          )}
        </div>
        <span className={`text-3xl font-bold ${scoreColor(score)}`}>
          {score.toFixed(1)}
          <span className="text-lg text-muted-foreground">/10</span>
        </span>
      </div>
      <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-muted">
        <div
          className={`h-full rounded-full transition-all duration-700 ease-out ${barColor(score)}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      {score < 9 && (
        <p className="mt-2 text-xs text-muted-foreground">
          Meta: 9.0+ para SOPs completos e consultáveis
        </p>
      )}
    </div>
  );
}
