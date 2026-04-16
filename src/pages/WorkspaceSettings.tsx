import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { WorkspaceSettingsForm } from "@/components/settings/WorkspaceSettingsForm";
import { IntegrationsSettings } from "@/components/settings/IntegrationsSettings";
import { Settings, Layout, Users, Puzzle } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useSearchParams } from "react-router-dom";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import PipelineSettings from "./PipelineSettings";
import Squads from "./Squads";

export default function WorkspaceSettings() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { can } = useWorkspace();
  const currentTab = searchParams.get("tab") || "workspace";

  const handleTabChange = (value: string) => {
    setSearchParams({ tab: value });
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center gap-3">
        <Settings className="h-8 w-8 text-primary" />
        <div>
          <h1 className="text-3xl font-bold">Configurações do Workspace</h1>
          <p className="text-muted-foreground">
            Gerencie as configurações, preferências e integrações do seu workspace
          </p>
        </div>
      </div>

      <Tabs value={currentTab} onValueChange={handleTabChange} className="space-y-6">
        <TabsList className="bg-muted/50 p-1">
          <TabsTrigger value="workspace" className="gap-2">
            <Settings className="h-4 w-4" />
            Workspace
          </TabsTrigger>
          {can('pipeline.config') && (
            <TabsTrigger value="pipeline" className="gap-2">
              <Layout className="h-4 w-4" />
              Pipeline CRM
            </TabsTrigger>
          )}
          {can('ops.view') && (
            <TabsTrigger value="squads" className="gap-2">
              <Users className="h-4 w-4" />
              Squads
            </TabsTrigger>
          )}
          <TabsTrigger value="integrations" className="gap-2">
            <Puzzle className="h-4 w-4" />
            Integrações & IA
          </TabsTrigger>
        </TabsList>

        <TabsContent value="workspace" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Informações do Workspace</CardTitle>
            </CardHeader>
            <CardContent>
              <WorkspaceSettingsForm />
            </CardContent>
          </Card>
        </TabsContent>

        {can('pipeline.config') && (
          <TabsContent value="pipeline" className="space-y-6">
            <div className="pt-2">
              <PipelineSettings />
            </div>
          </TabsContent>
        )}

        {can('ops.view') && (
          <TabsContent value="squads" className="space-y-6">
            <div className="pt-2">
              <Squads />
            </div>
          </TabsContent>
        )}

        <TabsContent value="integrations" className="space-y-6">
          <div className="pt-4">
            <IntegrationsSettings />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
