
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Users, AlertTriangle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { TasksBoard } from "@/components/operations/TasksBoard";
import { TaskDialog } from "@/components/operations/TaskDialog";
import { Task } from "@/types/operations";
import { ClientPerformanceMetric } from "@/types/operations";
import { useState } from "react";
import { Plus } from "lucide-react";
import { ClientHistory } from "@/components/clients/ClientHistory";
import { ClientAssets } from "@/components/clients/ClientAssets";

export default function ClientOperations() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const { currentWorkspace, can } = useWorkspace();
    const [searchParams] = useSearchParams();
    const contractId = searchParams.get("contract_id");
    const [isTaskDialogOpen, setIsTaskDialogOpen] = useState(false);
    const [taskToEdit, setTaskToEdit] = useState<Task | null>(null);

    const { data: contract } = useQuery({
        queryKey: ["contract-details", contractId],
        queryFn: async () => {
            if (!contractId) return null;
            const { data, error } = await supabase
                .from("contracts")
                .select("*")
                .eq("id", contractId)
                .single();
            if (error) throw error;
            return data as any;
        },
        enabled: !!contractId,
    });

    const { data: client, isLoading } = useQuery({
        queryKey: ["client-details", id],
        queryFn: async () => {
            if (!id) return null;
            const { data, error } = await supabase
                .from("clients")
                .select("*")
                .eq("id", id)
                .single();
            if (error) throw error;
            return data as any;
        },
        enabled: !!id,
    });

    const { data: tasks, isLoading: isTasksLoading } = useQuery({
        queryKey: ["client-tasks", id, contractId],
        queryFn: async () => {
            if (!id) return [];
            const q = (supabase as any)
                .from("tasks")
                .select(`
          *,
          clients (id, name),
          contracts (id, name),
          squads (id, name, color),
          assignee:assignee_id (id, full_name, avatar_url)
        `)
                .eq("client_id", id)
                .order("priority", { ascending: false })
                .order("created_at", { ascending: false });

            if (contractId) {
                q.eq("contract_id", contractId);
            }

            const { data, error } = await q;

            if (error) throw error;
            return data as Task[];
        },
        enabled: !!id,
    });



    const handleEditTask = (task: Task) => {
        setTaskToEdit(task);
        setIsTaskDialogOpen(true);
    };

    const handleCreateTask = () => {
        setTaskToEdit(null);
        setIsTaskDialogOpen(true);
    };

    if (!can("ops.view")) {
        return (
            <div className="container mx-auto p-6 flex flex-col items-center justify-center h-[50vh]">
                <Users className="h-16 w-16 text-muted-foreground mb-4" />
                <h2 className="text-xl font-semibold mb-2">Acesso Restrito</h2>
                <p className="text-muted-foreground">Você não tem permissão para visualizar a área de operações do cliente.</p>
            </div>
        );
    }

    if (isLoading) return <div className="p-6">Carregando...</div>;
    if (!client) return <div className="p-6">Cliente não encontrado.</div>;

    return (
        <div className="container mx-auto p-6 space-y-6">
            <div className="flex items-center gap-4">
                <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard/clients")}>
                    <ArrowLeft className="h-4 w-4" />
                </Button>
                <div>
                    <h1 className="text-3xl font-bold flex items-center gap-2">
                        Salão de Guerra: {contract ? contract.name : client.name}
                        {contract && <span className="text-xl font-normal text-muted-foreground">({client.name})</span>}
                    </h1>
                    <p className="text-muted-foreground">Visão 360º das operações e performance.</p>
                </div>
            </div>



            <Tabs defaultValue="tasks" className="space-y-4">
                <div className="flex justify-between items-center">
                    <TabsList>
                        <TabsTrigger value="tasks">Demandas</TabsTrigger>
                        <TabsTrigger value="files">Arquivos & Criativos</TabsTrigger>
                        <TabsTrigger value="history">Histórico</TabsTrigger>
                    </TabsList>
                    {can("tasks.manage") && (
                        <Button size="sm" onClick={handleCreateTask}>
                            <Plus className="mr-2 h-4 w-4" />
                            Nova Tarefa
                        </Button>
                    )}
                </div>

                <TabsContent value="tasks" className="min-h-[600px] overflow-visible">
                    {isTasksLoading ? (
                        <div className="flex items-center justify-center min-h-[400px]">Carregando demandas...</div>
                    ) : (
                        <TasksBoard tasks={tasks || []} onEditTask={handleEditTask} />
                    )}
                </TabsContent>

                <TabsContent value="files" className="min-h-[400px]">
                    <ClientAssets clientId={id!} contractId={contractId || undefined} />
                </TabsContent>

                <TabsContent value="history" className="p-4 border rounded-md min-h-[500px] bg-card">
                    <ClientHistory clientId={id!} contractId={contractId || undefined} />
                </TabsContent>
            </Tabs>

            <TaskDialog
                open={isTaskDialogOpen}
                onOpenChange={setIsTaskDialogOpen}
                taskToEdit={taskToEdit}
                defaultClientId={id}
                defaultContractId={contractId || undefined}
            />
        </div>
    );
}

