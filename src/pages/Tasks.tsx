
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { Button } from "@/components/ui/button";
import { Plus, ListTodo } from "lucide-react";
import { TasksBoard } from "@/components/operations/TasksBoard";
import { TaskDialog } from "@/components/operations/TaskDialog";
import { Task } from "@/types/operations";

export default function Tasks() {
    const { currentWorkspace, can } = useWorkspace();
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [taskToEdit, setTaskToEdit] = useState<Task | null>(null);

    const { data: tasks, isLoading } = useQuery({
        queryKey: ["tasks", currentWorkspace?.id],
        queryFn: async () => {
            if (!currentWorkspace?.id) return [];
            const { data, error } = await (supabase as any)
                .from("tasks")
                .select(`
          *,
          clients (id, name),
          contracts (id, name),
          squads (id, name, color),
          assignee:assignee_id (id, full_name, avatar_url),
          reporter:reporter_id (id, full_name, avatar_url)
        `)
                .eq("workspace_id", currentWorkspace.id)
                .order("priority", { ascending: false }) // Sort by priority implicitly? Or updated_at?
                .order("created_at", { ascending: false });

            if (error) throw error;
            return data as Task[];
        },
        enabled: !!currentWorkspace?.id,
    });

    const { data: squads } = useQuery({
        queryKey: ["squads-list", currentWorkspace?.id],
        queryFn: async () => {
            if (!currentWorkspace?.id) return [];
            const { data, error } = await (supabase as any)
                .from("squads")
                .select("id, name")
                .eq("workspace_id", currentWorkspace.id);
            if (error) throw error;
            return data as { id: string, name: string }[];
        },
        enabled: !!currentWorkspace?.id,
    });

    const { data: members } = useQuery({
        queryKey: ["members-list", currentWorkspace?.id],
        queryFn: async () => {
            if (!currentWorkspace?.id) return [];
            const { data, error } = await supabase.from("workspace_members").select("profiles(id, full_name)").eq("workspace_id", currentWorkspace.id);
            if (error) throw error;
            // Cast to any to handle type
            return (data as any[]).map(m => m.profiles).filter(Boolean) as { id: string, full_name: string }[];
        },
        enabled: !!currentWorkspace?.id,
    });



    const handleEdit = (task: Task) => {
        setTaskToEdit(task);
        setIsDialogOpen(true);
    };

    const handleCreate = () => {
        setTaskToEdit(null);
        setIsDialogOpen(true);
    };

    if (!can("ops.view")) {
        return (
            <div className="container mx-auto p-4 md:p-6 flex flex-col items-center justify-center h-[50vh]">
                <ListTodo className="h-16 w-16 text-muted-foreground mb-4" />
                <h2 className="text-xl font-semibold mb-2">Acesso Restrito</h2>
                <p className="text-muted-foreground">Você não tem permissão para visualizar as demandas.</p>
            </div>
        );
    }

    return (
        <div className="container mx-auto p-4 md:p-6 h-[calc(100vh-60px)] flex flex-col">
            <div className="flex justify-between items-center mb-6 shrink-0">
                <div>
                    <h1 className="text-3xl font-bold">Quadro de Demandas</h1>
                    <p className="text-muted-foreground">Gerencie as tarefas do seu time.</p>
                </div>
                <div className="flex items-center gap-2">
                    {can("tasks.manage") && (
                        <Button onClick={handleCreate}>
                            <Plus className="mr-2 h-4 w-4" />
                            Nova Demanda
                        </Button>
                    )}
                </div>
            </div>

            <div className="flex-1 overflow-hidden">
                {isLoading ? (
                    <div className="h-full flex items-center justify-center">Carregando...</div>
                ) : (
                    <TasksBoard tasks={tasks || []} onEditTask={handleEdit} />
                )}
            </div>

            <TaskDialog
                open={isDialogOpen}
                onOpenChange={setIsDialogOpen}
                taskToEdit={taskToEdit}
            />
        </div>
    );
}
