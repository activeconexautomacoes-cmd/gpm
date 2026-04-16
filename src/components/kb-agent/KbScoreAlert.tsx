import { useState } from "react";
import { AlertTriangle, X, ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import { useKbOverallScore } from "@/hooks/useKbScores";

interface KbScoreAlertProps {
  workspaceId?: string;
}

/**
 * Non-blocking alert shown on other pages when KB score < 9.
 * Dismissible per session.
 */
export function KbScoreAlert({ workspaceId }: KbScoreAlertProps) {
  const [dismissed, setDismissed] = useState(false);
  const overallScore = useKbOverallScore(workspaceId);

  if (dismissed || overallScore >= 9 || !workspaceId) return null;

  return (
    <div className="mb-4 flex items-center justify-between rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 dark:border-amber-800 dark:bg-amber-950">
      <div className="flex items-center gap-3">
        <AlertTriangle className="h-4 w-4 text-amber-500" />
        <p className="text-sm text-amber-800 dark:text-amber-200">
          Sua Base de Conhecimento está em{" "}
          <span className="font-semibold">{overallScore.toFixed(1)}/10</span>.
          Documente seus processos para padronizar a operação.
        </p>
      </div>
      <div className="flex items-center gap-2">
        <Link
          to="/dashboard/knowledge-base"
          className="flex items-center gap-1 rounded-md bg-amber-100 px-3 py-1.5 text-xs font-medium text-amber-700 transition-colors hover:bg-amber-200 dark:bg-amber-900 dark:text-amber-300 dark:hover:bg-amber-800"
        >
          Ir para KB <ArrowRight className="h-3 w-3" />
        </Link>
        <button
          onClick={() => setDismissed(true)}
          className="rounded p-1 text-amber-400 hover:text-amber-600"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
