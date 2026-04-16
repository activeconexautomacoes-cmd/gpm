import { useMemo } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Loader2, Plus } from "lucide-react";
import { ArtKanbanBoard } from "@/components/artes/ArtKanbanBoard";
import { ArtRequestList } from "@/components/artes/ArtRequestList";
import { ArtMetricsDashboard } from "@/components/artes/ArtMetricsDashboard";
import { ArtFormatManager } from "@/components/artes/ArtFormatManager";
import { ArtPermissionManager } from "@/components/artes/ArtPermissionManager";
import { useArtRequests } from "@/hooks/useArtes";
import { useWorkspace } from "@/contexts/WorkspaceContext";

export default function ArtesHub() {
  const { can, user } = useWorkspace();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  // Temporarily show all tabs while permissions aren't configured
  const isAdmin = can("art.manage") || can("settings.view") || true;
  const isGestor = can("art.create") || true;
  const isDesigner = can("art.upload") || true;

  const { data: allRequests = [], isLoading } = useArtRequests();

  // Show all requests for now (no permission filtering)
  const myRequests = allRequests;

  const tabFromUrl = searchParams.get("tab");
  const defaultTab = tabFromUrl || "kanban";

  const handleTabChange = (tab: string) => {
    setSearchParams({ tab });
  };

  const tabs = [
    { value: "kanban", label: "Kanban" },
    { value: "solicitacoes", label: "Solicitações" },
    { value: "metricas", label: "Métricas" },
    { value: "formatos", label: "Formatos" },
    { value: "permissoes", label: "Permissões" },
  ];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Artes</h1>
          <p className="text-sm text-muted-foreground">
            Gerencie solicitações de artes promocionais
          </p>
        </div>
        <Button onClick={() => navigate("/dashboard/artes/nova")}>
          <Plus className="h-4 w-4 mr-2" />
          Nova Solicitação
        </Button>
      </div>

      <Tabs value={defaultTab} onValueChange={handleTabChange}>
        <TabsList>
          {tabs.map((tab) => (
            <TabsTrigger key={tab.value} value={tab.value}>
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="kanban" className="mt-4">
          <ArtKanbanBoard requests={myRequests} />
        </TabsContent>

        <TabsContent value="solicitacoes" className="mt-4">
          <ArtRequestList requests={myRequests} />
        </TabsContent>

        <TabsContent value="metricas" className="mt-4">
          <ArtMetricsDashboard />
        </TabsContent>

        <TabsContent value="formatos" className="mt-4">
          <ArtFormatManager />
        </TabsContent>

        <TabsContent value="permissoes" className="mt-4">
          <ArtPermissionManager />
        </TabsContent>
      </Tabs>
    </div>
  );
}
