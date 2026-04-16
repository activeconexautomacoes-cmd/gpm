
import { useState, useMemo } from "react";
import {
    DndContext,
    closestCorners,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
    DragOverlay,
    defaultDropAnimationSideEffects,
    DragStartEvent,
    DragOverEvent,
    DragEndEvent,
} from "@dnd-kit/core";
import { arrayMove, sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import { Task, TaskStatus } from "@/types/operations";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SortableContext, verticalListSortingStrategy, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import {
    LayoutGrid,
    List as ListIcon,
    Calendar,
    User2,
    AlertCircle,
    MoreHorizontal,
    CheckCircle2,
    Clock,
    CircleDashed,
    RefreshCcw,
    Inbox,
    Search,
    ListFilter,
    ArrowUpDown,
    ArrowUp,
    ArrowDown,
    X,
    Store
} from "lucide-react";
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue
} from "@/components/ui/select";
import {
    Popover,
    PopoverContent,
    PopoverTrigger
} from "@/components/ui/popover";
import { Label } from "@/components/ui/label";

interface TasksBoardProps {
    tasks: Task[];
    onEditTask: (task: Task) => void;
}

const columns: { id: TaskStatus; title: string; color: string; icon: any }[] = [
    { id: "backlog", title: "Backlog", color: "text-slate-500", icon: Inbox },
    { id: "todo", title: "A Fazer", color: "text-blue-500", icon: CircleDashed },
    { id: "in_progress", title: "Em Progresso", color: "text-amber-500", icon: Clock },
    { id: "review", title: "Revisão", color: "text-blue-500", icon: RefreshCcw },
    { id: "done", title: "Concluído", color: "text-green-500", icon: CheckCircle2 },
];

function TaskCard({ task, onClick }: { task: Task; onClick: () => void }) {
    const {
        setNodeRef,
        attributes,
        listeners,
        transform,
        transition,
        isDragging,
    } = useSortable({
        id: task.id,
        data: {
            type: "Task",
            task,
        },
    });

    const style = {
        transition,
        transform: CSS.Transform.toString(transform),
    };

    if (isDragging) {
        return (
            <div
                ref={setNodeRef}
                style={style}
                className="opacity-30 bg-accent rounded-md border p-3 h-[100px]"
            />
        );
    }

    const priorityColor = {
        low: "bg-slate-500",
        medium: "bg-blue-500",
        high: "bg-orange-500",
        urgent: "bg-red-500",
    }[task.priority];

    return (
        <div
            ref={setNodeRef}
            style={style}
            {...attributes}
            {...listeners}
            onClick={onClick}
            className="group relative bg-background/60 hover:bg-background backdrop-blur-sm p-4 rounded-xl border border-slate-200/50 dark:border-slate-800/50 shadow-sm hover:shadow-md transition-all duration-300 cursor-pointer space-y-3 touch-none active:scale-[0.98] active:rotate-1"
        >
            <div className="flex justify-between items-start gap-4">
                <span className="text-sm font-bold leading-tight line-clamp-2 text-slate-700 dark:text-slate-200 group-hover:text-primary transition-colors">
                    {task.title}
                </span>
                {task.priority === "urgent" ? (
                    <div className="p-1 rounded-full bg-red-500/10 text-red-500 animate-pulse">
                        <AlertCircle className="h-4 w-4" />
                    </div>
                ) : (
                    <div className={cn("w-2 h-2 rounded-full mt-1.5 shrink-0", priorityColor)} />
                )}
            </div>

            {/* Client/Contract Name */}
            {(task.clients?.name || task.contracts?.name) && (
                <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-500 dark:text-slate-400 bg-slate-100/50 dark:bg-slate-800/50 w-fit px-2 py-0.5 rounded-lg border border-slate-200/50 dark:border-slate-700/50">
                    <Store className="h-3 w-3 text-primary/60" />
                    <span className="truncate max-w-[180px]">
                        {task.contracts?.name || task.clients?.name}
                    </span>
                </div>
            )}

            <div className="flex flex-wrap gap-1.5">
                <Badge
                    variant="outline"
                    className="text-[10px] uppercase font-bold tracking-wider px-2 py-0 h-5 bg-background shadow-sm transition-transform group-hover:scale-105"
                    style={{ borderColor: task.squads?.color, color: task.squads?.color }}
                >
                    {task.squads?.name || "Geral"}
                </Badge>
                {task.priority === "urgent" && (
                    <Badge variant="destructive" className="text-[10px] uppercase font-black px-2 py-0 h-5">
                        Urgente
                    </Badge>
                )}
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-slate-100/50 dark:border-slate-800/50">
                <div className="flex items-center gap-2">
                    <TooltipProvider>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Avatar className="h-7 w-7 ring-2 ring-background shadow-sm hover:ring-primary/40 hover:scale-110 transition-all cursor-pointer">
                                    <AvatarImage src={task.assignee?.avatar_url} />
                                    <AvatarFallback className="text-[10px] font-bold bg-muted text-muted-foreground uppercase">
                                        {task.assignee?.full_name?.charAt(0) || <User2 className="h-3 w-3" />}
                                    </AvatarFallback>
                                </Avatar>
                            </TooltipTrigger>
                            <TooltipContent side="top" className="bg-primary text-primary-foreground font-bold">
                                {task.assignee?.full_name || "Sem atribuição"}
                            </TooltipContent>
                        </Tooltip>
                    </TooltipProvider>
                    {task.due_date && (
                        <div className="flex items-center text-[11px] font-semibold text-muted-foreground/80 bg-slate-100/50 dark:bg-slate-800/50 px-2 py-0.5 rounded-full">
                            <Calendar className="mr-1 h-3 w-3 text-primary/60" />
                            {format(new Date(task.due_date), "dd/MM")}
                        </div>
                    )}
                </div>

                <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                    <div className="p-1 rounded-lg bg-primary/5 text-primary">
                        <MoreHorizontal className="h-4 w-4" />
                    </div>
                </div>
            </div>
        </div>
    );
}

function Column({ id, title, tasks, onEditTask, color, icon: Icon }: { id: TaskStatus; title: string; tasks: Task[]; onEditTask: (task: Task) => void; color: string; icon: any }) {
    const { setNodeRef } = useSortable({
        id: id,
        data: {
            type: "Column",
            column: { id, title },
        },
        disabled: true,
    });

    return (
        <div ref={setNodeRef} className="flex flex-col bg-slate-50/50 dark:bg-slate-900/20 backdrop-blur-sm rounded-xl p-3 min-w-[300px] w-[300px] border border-slate-200/50 dark:border-slate-800/50 shadow-sm">
            <div className="flex items-center justify-between mb-4 px-1">
                <div className="flex items-center gap-2">
                    <div className={cn("p-1.5 rounded-lg bg-background border shadow-sm", color)}>
                        {Icon && <Icon className="h-4 w-4" />}
                    </div>
                    <h3 className="font-bold text-sm tracking-tight">{title}</h3>
                </div>
                <Badge variant="secondary" className="text-[10px] font-bold rounded-full h-5 px-2 bg-background border shadow-sm">
                    {tasks.length}
                </Badge>
            </div>
            <SortableContext items={tasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
                <div className="flex flex-col gap-3 flex-grow min-h-[400px]">
                    {tasks.map((task) => (
                        <TaskCard key={task.id} task={task} onClick={() => onEditTask(task)} />
                    ))}
                </div>
            </SortableContext>
        </div>
    );
}

function TasksList({
    tasks,
    onEditTask,
    sortField,
    sortDirection,
    onSort
}: {
    tasks: Task[];
    onEditTask: (task: Task) => void;
    sortField: string;
    sortDirection: 'asc' | 'desc';
    onSort: (field: string) => void;
}) {
    const priorityLabels: Record<string, { label: string, color: string }> = {
        low: { label: "Baixa", color: "bg-slate-500" },
        medium: { label: "Média", color: "bg-blue-500" },
        high: { label: "Alta", color: "bg-orange-500" },
        urgent: { label: "Urgente", color: "bg-red-500" },
    };

    const statusLabels: Record<TaskStatus, { label: string, color: string }> = {
        backlog: { label: "Backlog", color: "text-slate-500" },
        todo: { label: "A Fazer", color: "text-blue-500" },
        in_progress: { label: "Em Progresso", color: "text-amber-500" },
        review: { label: "Revisão", color: "text-blue-500" },
        done: { label: "Concluído", color: "text-green-500" },
    };

    return (
        <Card className="border-none shadow-none bg-transparent">
            <Table>
                <TableHeader>
                    <TableRow className="hover:bg-transparent border-slate-200 dark:border-slate-800">
                        <TableHead className="w-[30%] cursor-pointer hover:text-primary transition-colors" onClick={() => onSort('title')}>
                            <div className="flex items-center gap-1">
                                Demanda
                                {sortField === 'title' && (sortDirection === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />)}
                            </div>
                        </TableHead>
                        <TableHead className="cursor-pointer hover:text-primary transition-colors" onClick={() => onSort('client')}>
                            <div className="flex items-center gap-1">
                                Cliente
                                {sortField === 'client' && (sortDirection === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />)}
                            </div>
                        </TableHead>
                        <TableHead>Responsável</TableHead>
                        <TableHead className="cursor-pointer hover:text-primary transition-colors" onClick={() => onSort('status')}>
                            <div className="flex items-center gap-1">
                                Status
                                {sortField === 'status' && (sortDirection === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />)}
                            </div>
                        </TableHead>
                        <TableHead className="cursor-pointer hover:text-primary transition-colors" onClick={() => onSort('priority')}>
                            <div className="flex items-center gap-1">
                                Prioridade
                                {sortField === 'priority' && (sortDirection === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />)}
                            </div>
                        </TableHead>
                        <TableHead className="cursor-pointer hover:text-primary transition-colors" onClick={() => onSort('due_date')}>
                            <div className="flex items-center gap-1">
                                Prazo
                                {sortField === 'due_date' && (sortDirection === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />)}
                            </div>
                        </TableHead>
                        <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {tasks.length === 0 ? (
                        <TableRow>
                            <TableCell colSpan={7} className="h-32 text-center text-muted-foreground">
                                Nenhuma demanda encontrada para este cliente.
                            </TableCell>
                        </TableRow>
                    ) : (
                        tasks.map((task) => (
                            <TableRow key={task.id} className="hover:bg-muted/50 transition-colors border-slate-100 dark:border-slate-800/50">
                                <TableCell>
                                    <div className="flex flex-col">
                                        <span className="font-semibold text-sm">{task.title}</span>
                                        <div className="flex items-center gap-2 mt-1">
                                            <Badge variant="outline" className="text-[10px] leading-none h-4 px-1" style={{ borderColor: task.squads?.color }}>
                                                {task.squads?.name || "Geral"}
                                            </Badge>
                                        </div>
                                    </div>
                                </TableCell>
                                <TableCell>
                                    <div className="flex items-center gap-2">
                                        <div className="p-1.5 rounded-lg bg-primary/5 border border-primary/10">
                                            <Store className="h-4 w-4 text-primary" />
                                        </div>
                                        <span className="text-sm font-bold text-slate-700 dark:text-slate-200 truncate max-w-[150px]">
                                            {task.contracts?.name || task.clients?.name || "Sem cliente"}
                                        </span>
                                    </div>
                                </TableCell>
                                <TableCell>
                                    <div className="flex items-center gap-2">
                                        <TooltipProvider>
                                            <Tooltip>
                                                <TooltipTrigger asChild>
                                                    <Avatar className="h-7 w-7 border shadow-sm cursor-pointer hover:ring-2 hover:ring-primary/20 transition-all">
                                                        <AvatarImage src={task.assignee?.avatar_url} />
                                                        <AvatarFallback className="text-[10px]"><User2 className="h-3 w-3" /></AvatarFallback>
                                                    </Avatar>
                                                </TooltipTrigger>
                                                <TooltipContent side="top">
                                                    {task.assignee?.full_name || "Sem atribuição"}
                                                </TooltipContent>
                                            </Tooltip>
                                        </TooltipProvider>
                                        <span className="text-sm text-muted-foreground truncate max-w-[120px]">
                                            {task.assignee?.full_name || "Sem atribuição"}
                                        </span>
                                    </div>
                                </TableCell>
                                <TableCell>
                                    <div className={cn("flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider", (statusLabels[task.status] || statusLabels.backlog).color)}>
                                        <div className={cn("h-1.5 w-1.5 rounded-full", (statusLabels[task.status] || statusLabels.backlog).color.replace('text', 'bg'))} />
                                        {(statusLabels[task.status] || statusLabels.backlog).label}
                                    </div>
                                </TableCell>
                                <TableCell>
                                    <div className="flex items-center gap-2">
                                        <div className={cn("w-2 h-2 rounded-full", (priorityLabels[task.priority as keyof typeof priorityLabels] || priorityLabels.medium).color)} />
                                        <span className="text-xs">{(priorityLabels[task.priority as keyof typeof priorityLabels] || priorityLabels.medium).label}</span>
                                    </div>
                                </TableCell>
                                <TableCell>
                                    {task.due_date ? (
                                        <div className="flex items-center text-xs text-muted-foreground font-medium">
                                            <Calendar className="mr-1.5 h-3 w-3 text-primary/60" />
                                            {format(new Date(task.due_date), "dd/MM/yyyy")}
                                        </div>
                                    ) : (
                                        <span className="text-xs text-muted-foreground/50">-</span>
                                    )}
                                </TableCell>
                                <TableCell className="text-right">
                                    <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                            <Button variant="ghost" size="sm" className="h-8 w-8 p-0 hover:bg-muted rounded-full">
                                                <MoreHorizontal className="h-4 w-4" />
                                            </Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="end" className="w-[160px]">
                                            <DropdownMenuItem onClick={() => onEditTask(task)}>
                                                Editar Demanda
                                            </DropdownMenuItem>
                                        </DropdownMenuContent>
                                    </DropdownMenu>
                                </TableCell>
                            </TableRow>
                        ))
                    )}
                </TableBody>
            </Table>
        </Card >
    );
}

export function TasksBoard({ tasks, onEditTask }: TasksBoardProps) {
    const [viewMode, setViewMode] = useState<"kanban" | "list">("kanban");
    const [searchTerm, setSearchTerm] = useState("");
    const [squadFilter, setSquadFilter] = useState<string>("all");
    const [assigneeFilter, setAssigneeFilter] = useState<string>("all");
    const [statusFilter, setStatusFilter] = useState<string>("all");
    const [sortField, setSortField] = useState<string>("created_at");
    const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
    const [isMeMode, setIsMeMode] = useState(false);

    const [activeTask, setActiveTask] = useState<Task | null>(null);
    const queryClient = useQueryClient();
    const { toast } = useToast();
    const { user, currentWorkspace } = useWorkspace();

    const priorityOrder: Record<string, number> = { urgent: 0, high: 1, medium: 2, low: 3 };
    const statusOrder: Record<string, number> = { backlog: 0, todo: 1, in_progress: 2, review: 3, done: 4 };

    const uniqueSquads = useMemo(() => {
        const squads = new Map();
        tasks.forEach(t => {
            if (t.squads) squads.set(t.squads.id, t.squads.name);
        });
        return Array.from(squads.entries());
    }, [tasks]);

    const uniqueAssignees = useMemo(() => {
        const assignees = new Map();
        tasks.forEach(t => {
            if (t.assignee) assignees.set(t.assignee.id, t.assignee.full_name);
        });
        return Array.from(assignees.entries());
    }, [tasks]);

    const filteredAndSortedTasks = useMemo(() => {
        return tasks
            .filter(task => {
                const matchesSearch = task.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                    task.clients?.name?.toLowerCase().includes(searchTerm.toLowerCase());
                const matchesSquad = squadFilter === "all" || task.squad_id === squadFilter;
                const matchesAssignee = isMeMode ? task.assignee_id === user?.id : (assigneeFilter === "all" || task.assignee_id === assigneeFilter);
                const matchesStatus = statusFilter === "all" || task.status === statusFilter;
                return matchesSearch && matchesSquad && matchesAssignee && matchesStatus;
            })
            .sort((a, b) => {
                let comparison = 0;
                switch (sortField) {
                    case 'title':
                        comparison = (a.title || "").localeCompare(b.title || "");
                        break;
                    case 'client':
                        const clientA = a.contracts?.name || a.clients?.name || "";
                        const clientB = b.contracts?.name || b.clients?.name || "";
                        comparison = clientA.localeCompare(clientB);
                        break;
                    case 'due_date':
                        if (!a.due_date) return 1;
                        if (!b.due_date) return -1;
                        comparison = new Date(a.due_date).getTime() - new Date(b.due_date).getTime();
                        break;
                    case 'priority':
                        comparison = (priorityOrder[a.priority] ?? 99) - (priorityOrder[b.priority] ?? 99);
                        break;
                    case 'status':
                        comparison = (statusOrder[a.status] ?? 99) - (statusOrder[b.status] ?? 99);
                        break;
                    default:
                        comparison = new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime();
                        break;
                }
                return sortDirection === 'asc' ? comparison : -comparison;
            });
    }, [tasks, searchTerm, squadFilter, assigneeFilter, statusFilter, sortField, sortDirection, isMeMode, user]);

    const handleSort = (field: string) => {
        if (sortField === field) {
            setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
        } else {
            setSortField(field);
            setSortDirection('asc');
        }
    };
    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: {
                distance: 8, // Require movement of 8px to start drag, prevents accidental drags on clicks
            },
        }),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    );

    const mutation = useMutation({
        mutationFn: async ({ id, status }: { id: string; status: TaskStatus }) => {
            const { error } = await (supabase as any)
                .from("tasks")
                .update({ status })
                .eq("id", id);
            if (error) throw error;

            // Log activity if linked to a client
            const task = tasks.find(t => t.id === id);
            if (task?.client_id && user?.id && currentWorkspace?.id) {
                const statusLabels: Record<string, string> = {
                    backlog: "Backlog",
                    todo: "A Fazer",
                    in_progress: "Em Progresso",
                    review: "Revisão",
                    done: "Concluído"
                };

                await (supabase as any).from("client_activities").insert({
                    workspace_id: currentWorkspace.id,
                    client_id: task.client_id,
                    contract_id: task.contract_id,
                    user_id: user.id,
                    description: `Alterou status da tarefa "${task.title}" para "${statusLabels[status] || status}"`,
                    type: 'task'
                });
            }
        },
        onSuccess: () => {
            // Optimistic update handled by DnD visual state, but invalidate to ensure data consistency
            queryClient.invalidateQueries({ queryKey: ["tasks"] });
            queryClient.invalidateQueries({ queryKey: ["client-tasks"] });
            queryClient.invalidateQueries({ queryKey: ["ops-urgent-tasks"] });
            queryClient.invalidateQueries({ queryKey: ["client_activities"] });
        },
        onError: () => {
            queryClient.invalidateQueries({ queryKey: ["tasks"] }); // Revert on error
            queryClient.invalidateQueries({ queryKey: ["client-tasks"] });
            queryClient.invalidateQueries({ queryKey: ["ops-urgent-tasks"] });
            toast({
                variant: "destructive",
                title: "Erro ao mover tarefa",
                description: "Não foi possível atualizar o status da tarefa."
            })
        }
    });

    const onDragStart = (event: DragStartEvent) => {
        if (event.active.data.current?.type === "Task") {
            setActiveTask(event.active.data.current.task);
        }
    };

    const onDragOver = (event: DragOverEvent) => {
        // Handled by sortable context mostly, but can add smoother over animations here
    };

    const onDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;
        setActiveTask(null);

        if (!over) return;

        const activeId = active.id;
        // Find dropped column
        // The over.id might be a column ID or a task ID within that column
        const activeTaskData = active.data.current?.task as Task;

        // Determine the new status based on where it was dropped
        let newStatus: TaskStatus | undefined;

        // Check if dropped directly on a column container
        if (columns.some(c => c.id === over.id)) {
            newStatus = over.id as TaskStatus;
        } else {
            // Dropped on another task? Find that task's status
            const overTask = tasks.find(t => t.id === over.id);
            if (overTask) {
                newStatus = overTask.status;
            }
        }

        if (newStatus && activeTaskData.status !== newStatus) {
            // Trigger update
            // We can optimistically update the UI by local state if needed, but for now rely on mutation success/invalidate
            mutation.mutate({ id: activeTaskData.id, status: newStatus });
        }
    };

    return (
        <div className="flex flex-col h-full space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center bg-muted/30 p-1.5 rounded-xl w-fit border border-slate-200/50 dark:border-slate-800/50 backdrop-blur-md shadow-inner">
                    <Button
                        variant={viewMode === "kanban" ? "secondary" : "ghost"}
                        size="sm"
                        className={cn(
                            "rounded-lg px-4 transition-all duration-200",
                            viewMode === "kanban" ? "shadow-sm bg-background hover:bg-background" : "hover:bg-background/50"
                        )}
                        onClick={() => setViewMode("kanban")}
                    >
                        <LayoutGrid className="mr-2 h-4 w-4 text-primary" />
                        <span className="text-xs font-bold uppercase tracking-tight">Kanban</span>
                    </Button>
                    <Button
                        variant={viewMode === "list" ? "secondary" : "ghost"}
                        size="sm"
                        className={cn(
                            "rounded-lg px-4 transition-all duration-200",
                            viewMode === "list" ? "shadow-sm bg-background hover:bg-background" : "hover:bg-background/50"
                        )}
                        onClick={() => setViewMode("list")}
                    >
                        <ListIcon className="mr-2 h-4 w-4 text-primary" />
                        <span className="text-xs font-bold uppercase tracking-tight">Lista</span>
                    </Button>
                </div>

                <div className="flex flex-wrap items-center gap-2 flex-grow sm:flex-grow-0">
                    <div className="relative flex-grow sm:w-64">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Buscar demandas..."
                            className="pl-9 h-10 rounded-xl bg-background/50 border-slate-200/50 focus:ring-primary/20"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                        {searchTerm && (
                            <button
                                onClick={() => setSearchTerm("")}
                                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 hover:bg-slate-100 rounded-full transition-colors"
                            >
                                <X className="h-3 w-3 text-muted-foreground" />
                            </button>
                        )}
                    </div>

                    <Button
                        variant={isMeMode ? "secondary" : "outline"}
                        size="sm"
                        onClick={() => setIsMeMode(!isMeMode)}
                        className={cn(
                            "h-10 rounded-xl gap-2 transition-all duration-200 border-slate-200/50 backdrop-blur-sm",
                            isMeMode ? "bg-primary text-primary-foreground border-primary shadow-md" : "bg-background/50 hover:bg-background/80"
                        )}
                    >
                        <User2 className={cn("h-4 w-4", isMeMode ? "text-primary-foreground" : "text-primary")} />
                        <span className="text-xs font-bold uppercase tracking-tight">Modo Eu</span>
                    </Button>

                    <Popover>
                        <PopoverTrigger asChild>
                            <Button variant="outline" size="sm" className="h-10 rounded-xl border-slate-200/50 bg-background/50 gap-2">
                                <ListFilter className="h-4 w-4 text-primary" />
                                <span className="text-xs font-bold uppercase">Filtros</span>
                                {(squadFilter !== 'all' || assigneeFilter !== 'all' || statusFilter !== 'all') && (
                                    <Badge variant="default" className="ml-1 h-5 w-5 p-0 flex items-center justify-center rounded-full text-[10px]">
                                        {[squadFilter, assigneeFilter, statusFilter].filter(f => f !== 'all').length}
                                    </Badge>
                                )}
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-80 p-4 rounded-xl border-slate-200/50 shadow-2xl" align="end">
                            <div className="space-y-4">
                                <div className="space-y-2">
                                    <Label className="text-[10px] uppercase font-black text-muted-foreground tracking-widest">Equipe (Squad)</Label>
                                    <Select value={squadFilter} onValueChange={setSquadFilter}>
                                        <SelectTrigger className="h-9 rounded-lg border-slate-200">
                                            <SelectValue placeholder="Todas as equipes" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="all">Todas as equipes</SelectItem>
                                            {uniqueSquads.map(([id, name]) => (
                                                <SelectItem key={id} value={id}>{name}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div className="space-y-2">
                                    <Label className="text-[10px] uppercase font-black text-muted-foreground tracking-widest">Responsável</Label>
                                    <Select value={assigneeFilter} onValueChange={setAssigneeFilter}>
                                        <SelectTrigger className="h-9 rounded-lg border-slate-200">
                                            <SelectValue placeholder="Todos os responsáveis" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="all">Todos os responsáveis</SelectItem>
                                            {uniqueAssignees.map(([id, name]) => (
                                                <SelectItem key={id} value={id}>{name}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div className="space-y-2">
                                    <Label className="text-[10px] uppercase font-black text-muted-foreground tracking-widest">Status</Label>
                                    <Select value={statusFilter} onValueChange={setStatusFilter}>
                                        <SelectTrigger className="h-9 rounded-lg border-slate-200">
                                            <SelectValue placeholder="Todos os status" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="all">Todos os status</SelectItem>
                                            {columns.map(col => (
                                                <SelectItem key={col.id} value={col.id}>{col.title}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>

                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="w-full h-8 text-xs font-bold uppercase text-red-500 hover:text-red-600 hover:bg-red-50"
                                    onClick={() => {
                                        setSquadFilter('all');
                                        setAssigneeFilter('all');
                                        setStatusFilter('all');
                                        setSearchTerm("");
                                    }}
                                >
                                    Limpar Filtros
                                </Button>
                            </div>
                        </PopoverContent>
                    </Popover>
                </div>
            </div>

            {
                viewMode === "kanban" ? (
                    <DndContext
                        sensors={sensors}
                        collisionDetection={closestCorners}
                        onDragStart={onDragStart}
                        onDragOver={onDragOver}
                        onDragEnd={onDragEnd}
                    >
                        <div className="flex h-full gap-4 overflow-x-auto pb-4 custom-scrollbar">
                            {columns.map((col) => (
                                <Column
                                    key={col.id}
                                    id={col.id}
                                    title={col.title}
                                    color={col.color}
                                    icon={col.icon}
                                    tasks={filteredAndSortedTasks.filter((t) => t.status === col.id)}
                                    onEditTask={onEditTask}
                                />
                            ))}
                        </div>

                        <DragOverlay dropAnimation={{
                            sideEffects: defaultDropAnimationSideEffects({
                                styles: {
                                    active: {
                                        opacity: "0.5",
                                    },
                                },
                            }),
                        }}>
                            {activeTask ? (
                                <div className="bg-card/80 backdrop-blur-md p-4 rounded-xl border-2 border-primary/20 shadow-2xl w-[300px] scale-105 transition-transform">
                                    <span className="font-bold text-sm block mb-2">{activeTask.title}</span>
                                    <div className="flex items-center gap-2">
                                        <Badge variant="outline" className="text-[10px] h-4" style={{ borderColor: activeTask.squads?.color }}>
                                            {activeTask.squads?.name || "Geral"}
                                        </Badge>
                                    </div>
                                </div>
                            ) : null}
                        </DragOverlay>
                    </DndContext>
                ) : (
                    <div className="h-full overflow-y-auto bg-card/40 backdrop-blur-md rounded-2xl border border-slate-200/50 dark:border-slate-800/50 p-2 shadow-sm animate-in fade-in slide-in-from-bottom-2 duration-300">
                        <TasksList
                            tasks={filteredAndSortedTasks}
                            onEditTask={onEditTask}
                            sortField={sortField}
                            sortDirection={sortDirection}
                            onSort={handleSort}
                        />
                    </div>
                )
            }
        </div >
    );
}
