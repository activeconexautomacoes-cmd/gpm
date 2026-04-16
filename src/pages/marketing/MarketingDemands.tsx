import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { isPast, isToday } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MarketingDemandKanban } from "@/components/marketing/MarketingDemandKanban";
import { MarketingDemandDialog } from "@/components/marketing/MarketingDemandDialog";

export type MarketingDemand = {
  id: string;
  title: string;
  type: "image" | "video";
  description: string | null;
  deadline: string | null;
  current_stage: "copy" | "designer" | "editor" | "web_designer" | "traffic_manager" | "done";
  current_status: "requested" | "in_progress" | "in_review" | "done";
  completed_stages: string[];
  stage_deliverables: Record<string, string>;
  priority: "low" | "normal" | "urgent";
  created_by: string | null;
  created_at: string;
};

const STAGES = [
  { key: "copy", label: "Copy", icon: "✍️" },
  { key: "designer", label: "Designer", icon: "🎨" },
  { key: "editor", label: "Editor de Vídeo", icon: "🎬" },
  { key: "web_designer", label: "Web Designer", icon: "💻" },
  { key: "traffic_manager", label: "Gestor de Tráfego", icon: "📢" },
  { key: "done", label: "Concluídos", icon: "✅" },
] as const;

export default function MarketingDemands() {
  const { currentWorkspace } = useWorkspace();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingDemand, setEditingDemand] = useState<MarketingDemand | null>(null);

  const { data: demands = [], isLoading } = useQuery({
    queryKey: ["marketing-demands", currentWorkspace?.id],
    queryFn: async () => {
      const { data, error } = await (supabase
        .from("marketing_demands" as any)
        .select("*")
        .eq("workspace_id", currentWorkspace!.id)
        .order("created_at", { ascending: false }) as any);
      if (error) throw error;
      return data as MarketingDemand[];
    },
    enabled: !!currentWorkspace?.id,
  });

  const updateDemand = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<MarketingDemand> }) => {
      const { error } = await (supabase
        .from("marketing_demands" as any)
        .update({ ...updates, updated_at: new Date().toISOString() } as any)
        .eq("id", id) as any);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["marketing-demands"] }),
  });

  const deleteDemand = useMutation({
    mutationFn: async (id: string) => {
      const res = await (supabase.from("marketing_demands" as any).delete().eq("id", id) as any);
      if (res.error) throw res.error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["marketing-demands"] }),
  });

  const handleDeleteDemand = (demand: MarketingDemand) => {
    deleteDemand.mutate(demand.id);
  };

  const handleStatusChange = (demand: MarketingDemand, newStatus: string) => {
    updateDemand.mutate({ id: demand.id, updates: { current_status: newStatus as MarketingDemand["current_status"] } });
  };

  const handleSaveDeliverable = (demand: MarketingDemand, stage: string, content: string) => {
    const newDeliverables = { ...(demand.stage_deliverables || {}), [stage]: content };
    updateDemand.mutate({ id: demand.id, updates: { stage_deliverables: newDeliverables } as any });
  };

  const handleSendToStage = (demand: MarketingDemand, nextStage: string) => {
    const newCompleted = [...(demand.completed_stages || []), demand.current_stage];

    let newDeadline = demand.deadline;
    if (nextStage !== "done" && demand.deadline) {
      const d = new Date(demand.deadline);
      d.setDate(d.getDate() + 2);
      newDeadline = d.toISOString().split("T")[0];
    }

    updateDemand.mutate({
      id: demand.id,
      updates: {
        current_stage: nextStage as MarketingDemand["current_stage"],
        current_status: nextStage === "done" ? "done" : "requested",
        completed_stages: newCompleted,
        deadline: newDeadline,
      } as any,
    });
  };

  const handleEditDemand = (demand: MarketingDemand) => {
    setEditingDemand(demand);
    setDialogOpen(true);
  };

  // Contadores
  const overdueCount = demands.filter((d) =>
    d.current_stage !== "done" && d.deadline && isPastDeadline(d.deadline)
  ).length;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Demandas de Marketing</h1>
          <p className="text-muted-foreground text-sm">
            Fluxo: Copy → Revisão → Designer/Editor → Revisão → Gestor de Tráfego → Concluído
          </p>
        </div>
        <Button onClick={() => { setEditingDemand(null); setDialogOpen(true); }}>
          <Plus className="h-4 w-4 mr-2" />
          Nova Demanda
        </Button>
      </div>

      <Tabs defaultValue="copy">
        <TabsList>
          {STAGES.map((stage) => {
            let count: number;
            if (stage.key === "done") {
              count = demands.filter((d) => d.current_stage === "done").length;
            } else {
              count = demands.filter((d) => d.current_stage === stage.key && d.current_status !== "done").length;
            }
            return (
              <TabsTrigger key={stage.key} value={stage.key} className="gap-2">
                <span>{stage.icon}</span>
                <span>{stage.label}</span>
                {count > 0 && (
                  <span className="ml-1 bg-primary/10 text-primary text-xs font-semibold px-1.5 py-0.5 rounded-full">
                    {count}
                  </span>
                )}
              </TabsTrigger>
            );
          })}
        </TabsList>

        {STAGES.map((stage) => {
          const isDoneTab = stage.key === "done";
          const activeDemands = demands.filter((d) => d.current_stage === stage.key);
          const completedDemands = isDoneTab ? [] : demands.filter((d) =>
            d.current_stage !== stage.key && d.completed_stages?.includes(stage.key)
          );
          return (
            <TabsContent key={stage.key} value={stage.key} className="mt-4">
              <MarketingDemandKanban
                demands={isDoneTab ? demands : activeDemands}
                completedDemands={completedDemands}
                stageName={stage.label}
                isDoneTab={isDoneTab}
                onStatusChange={handleStatusChange}
                onSendToStage={handleSendToStage}
                onSaveDeliverable={handleSaveDeliverable}
                onEditDemand={handleEditDemand}
                onDeleteDemand={handleDeleteDemand}
                isLoading={isLoading}
              />
            </TabsContent>
          );
        })}
      </Tabs>

      <MarketingDemandDialog
        open={dialogOpen}
        onOpenChange={(open) => { setDialogOpen(open); if (!open) setEditingDemand(null); }}
        editDemand={editingDemand}
      />
    </div>
  );
}

function isPastDeadline(deadline: string): boolean {
  return isPast(new Date(deadline + "T23:59:59")) && !isToday(new Date(deadline));
}
