import { useParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Loader2 } from "lucide-react";
import { useContractForPanel } from "@/hooks/useClientPanelTimeline";
import { ClientPanelHeader } from "@/components/operations/client-panel/ClientPanelHeader";
import { ClientPanelTimeline } from "@/components/operations/client-panel/ClientPanelTimeline";

export default function ClientPanelDetalhe() {
  const { contractId } = useParams<{ contractId: string }>();
  const navigate = useNavigate();
  const { data: contract, isLoading } = useContractForPanel(contractId);

  if (isLoading || !contract) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6 max-w-5xl mx-auto">
      {/* Back */}
      <Button
        variant="ghost"
        size="sm"
        className="gap-2 text-muted-foreground hover:text-foreground"
        onClick={() => navigate("/dashboard/operations")}
      >
        <ArrowLeft className="h-4 w-4" />
        Voltar para Operacoes
      </Button>

      {/* Header */}
      <ClientPanelHeader contract={contract} />

      {/* Timeline */}
      <div>
        <h3 className="text-lg font-semibold mb-4">Timeline</h3>
        <ClientPanelTimeline contractId={contractId!} />
      </div>
    </div>
  );
}
