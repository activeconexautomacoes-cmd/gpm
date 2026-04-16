import { useState, useCallback } from "react";
import {
  Database,
  MessageSquare,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { useKbStats } from "@/hooks/useKnowledgeBase";
import {
  useKbActiveConversation,
  useKbSendMessage,
} from "@/hooks/useKbConversation";
import { useKbScores, useKbScoresRealtime } from "@/hooks/useKbScores";
import { getCategoryKeys } from "@/lib/kb/quality-criteria";
import { KbOverallScore } from "@/components/kb-agent/KbOverallScore";
import { KbScoreCard } from "@/components/kb-agent/KbScoreCard";
import { KbChat } from "@/components/kb-agent/KbChat";
import { KbWizard } from "@/components/kb-agent/KbWizard";

export default function KnowledgeBase() {
  const { currentWorkspace, loading: workspaceLoading } = useWorkspace();
  const workspaceId = currentWorkspace?.id;

  const { data: stats = {} } = useKbStats(workspaceId);
  const { data: conversation, isLoading: convLoading, error: convError } =
    useKbActiveConversation(workspaceId);
  const { data: scoresData } = useKbScores(workspaceId);
  useKbScoresRealtime(workspaceId);
  const sendMessage = useKbSendMessage();

  const [chatOpen, setChatOpen] = useState(true);

  const overallScore = scoresData?.overall ?? 0;
  const categoryScores = scoresData?.categories ?? {};
  const totalDocs = Object.values(stats as Record<string, number>).reduce(
    (s, n) => s + n,
    0
  );

  // Wait for workspace to load before showing anything
  const isLoading = workspaceLoading || (!!workspaceId && convLoading);

  // Show wizard only when data is loaded and no conversation exists
  const shouldShowWizard =
    !isLoading && !conversation && !convError && !!workspaceId;

  // Don't show chat overlay on mobile until conversation exists
  const hasConversation = !!conversation;

  const handleWizardChoice = useCallback(
    async (choice: "has_materials" | "from_scratch") => {
      if (!workspaceId) return;

      await sendMessage.mutateAsync({
        workspace_id: workspaceId,
        wizard_choice: choice,
      });
      setChatOpen(true);
    },
    [workspaceId, sendMessage]
  );

  const dashboardContent = (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="flex items-center gap-2 text-xl font-bold sm:text-2xl">
            <Database className="h-5 w-5 shrink-0 sm:h-6 sm:w-6" />
            <span className="truncate">Base de Conhecimento</span>
          </h1>
          <p className="mt-1 hidden text-sm text-muted-foreground sm:block">
            Documente os processos da agência para padronizar a operação
          </p>
        </div>
        {!chatOpen && (
          <Button
            onClick={() => setChatOpen(true)}
            className="hidden gap-2 lg:flex"
          >
            <MessageSquare className="h-4 w-4" />
            Abrir Chat
          </Button>
        )}
      </div>

      {/* Overall score */}
      <KbOverallScore score={overallScore} documentCount={totalDocs} />

      {/* Category score cards */}
      <div>
        <h2 className="mb-3 text-base font-semibold sm:text-lg">
          Categorias
        </h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {getCategoryKeys().map((key) => (
            <KbScoreCard
              key={key}
              categoryKey={key}
              score={Number(categoryScores[key]?.score ?? 0)}
            />
          ))}
        </div>
      </div>
    </div>
  );

  // Loading state
  if (isLoading) {
    return (
      <div className="flex h-[calc(100vh-64px)] items-center justify-center">
        <div className="text-muted-foreground">Carregando...</div>
      </div>
    );
  }

  // Error state
  if (convError) {
    return (
      <div className="flex h-[calc(100vh-64px)] flex-col items-center justify-center gap-2">
        <div className="text-destructive">Erro ao carregar Base de Conhecimento</div>
        <div className="text-sm text-muted-foreground">{(convError as Error).message}</div>
      </div>
    );
  }

  return (
    <>
      {/* Wizard overlay */}
      {shouldShowWizard && <KbWizard onChoice={handleWizardChoice} />}

      {/* Desktop layout (lg+): side-by-side 60/40 */}
      <div className="hidden h-[calc(100vh-64px)] lg:flex">
        <div
          className={`overflow-y-auto p-6 ${chatOpen && hasConversation ? "w-[60%]" : "w-full"} transition-all duration-300`}
        >
          {dashboardContent}
        </div>

        {chatOpen && hasConversation && (
          <div className="w-[40%] transition-all duration-300">
            <KbChat
              conversationId={conversation?.id}
              workspaceId={workspaceId}
              onMinimize={() => setChatOpen(false)}
            />
          </div>
        )}
      </div>

      {/* Mobile layout (<lg): stacked with fullscreen chat drawer */}
      <div className="lg:hidden">
        <div className="min-h-screen p-4 pb-24">
          {dashboardContent}
        </div>

        {hasConversation && !chatOpen && (
          <button
            onClick={() => setChatOpen(true)}
            className="fixed bottom-6 right-6 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition-transform hover:scale-105 active:scale-95"
          >
            <MessageSquare className="h-6 w-6" />
          </button>
        )}

        {hasConversation && chatOpen && (
          <div className="fixed inset-0 z-50 flex flex-col bg-background">
            <div className="flex items-center justify-between border-b px-4 py-3">
              <div className="flex items-center gap-2">
                <MessageSquare className="h-4 w-4 text-primary" />
                <h3 className="text-sm font-semibold">
                  Agente de Processos
                </h3>
                {overallScore > 0 && (
                  <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                    {overallScore.toFixed(1)}/10
                  </span>
                )}
              </div>
              <button
                onClick={() => setChatOpen(false)}
                className="rounded-lg p-2 text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex-1 overflow-hidden">
              <KbChat
                conversationId={conversation?.id}
                workspaceId={workspaceId}
                hideHeader
              />
            </div>
          </div>
        )}
      </div>
    </>
  );
}
