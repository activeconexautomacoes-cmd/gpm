
import { useEffect, useState, useRef } from "react";
import { useForm } from "react-hook-form";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Task, TaskPriority, TaskType, TaskStatus } from "@/types/operations";
import { TaskComments } from "@/components/operations/TaskComments";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
    CalendarIcon,
    Clock,
    Tag,
    Flag,
    User,
    CheckCircle2,
    Circle,
    AlertCircle,
    MessageSquare,
    Zap,
    Target,
    MoreHorizontal,
    Image as ImageIcon,
    FileText,
    Building2,
    Briefcase,
    Strikethrough,
    Code,
    Type,
    List,
    ListOrdered,
    CheckSquare,
    Quote,
    Link2,
    AlignLeft,
    AlignCenter,
    AlignRight,
    AlignJustify,
    Palette,
    Paperclip,
    Smile,
    Table as TableIcon,
    Maximize2,
    Minimize2
} from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
} from "@/components/ui/command";

interface TaskDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    taskToEdit?: Task | null;
    defaultStatus?: TaskStatus;
    defaultClientId?: string;
    defaultContractId?: string;
}

interface TaskFormData {
    title: string;
    description: string;
    client_id: string;
    squad_id: string;
    assignee_id: string;
    priority: TaskPriority;
    type: TaskType;
    due_date: Date | undefined;
    contract_id?: string;
}

export function TaskDialog({ open, onOpenChange, taskToEdit, defaultStatus = "backlog", defaultClientId, defaultContractId }: TaskDialogProps) {
    const { currentWorkspace, user } = useWorkspace();
    const { toast } = useToast();
    const queryClient = useQueryClient();
    const { register, handleSubmit, reset, setValue, watch, control } = useForm<TaskFormData>();
    const [date, setDate] = useState<Date | undefined>(undefined);
    const [isDescriptionExpanded, setIsDescriptionExpanded] = useState(false);

    // Watch for squad changes to filter assignees if needed (optional enhancement)
    const watchedSquadId = watch("squad_id");

    const { data: contractDetails, isLoading: isLoadingContract } = useQuery({
        queryKey: ["contract-for-task", defaultContractId],
        queryFn: async () => {
            if (!defaultContractId) return null;
            const { data, error } = await (supabase as any)
                .from("contracts")
                .select("id, name, account_manager_id, squad_id, clients:client_id(id, name)")
                .eq("id", defaultContractId)
                .single();
            if (error) throw error;
            return data as any;
        },
        enabled: !!defaultContractId && open && !taskToEdit,
    });

    const { data: clientNameOnly } = useQuery({
        queryKey: ["client-name", defaultClientId],
        queryFn: async () => {
            if (!defaultClientId) return null;
            const { data, error } = await supabase
                .from("clients")
                .select("name")
                .eq("id", defaultClientId)
                .single();
            if (error) throw error;
            return (data as any)?.name;
        },
        enabled: !!defaultClientId && open && !taskToEdit && !contractDetails,
    });

    const [hasBeenReset, setHasBeenReset] = useState(false);

    useEffect(() => {
        if (!open) {
            setHasBeenReset(false);
            return;
        }

        if (taskToEdit) {
            setValue("title", taskToEdit.title);
            setValue("description", taskToEdit.description || "");
            setValue("client_id", taskToEdit.client_id);
            setValue("squad_id", taskToEdit.squad_id || "none");
            setValue("assignee_id", taskToEdit.assignee_id || "none");
            setValue("priority", taskToEdit.priority);
            setValue("type", taskToEdit.type);
            setValue("contract_id", taskToEdit.contract_id || "none");
            setDate(taskToEdit.due_date ? new Date(taskToEdit.due_date) : undefined);
            setHasBeenReset(true);
        } else if (!hasBeenReset) {
            // Initial reset when opening for a new task
            reset({
                title: "",
                description: "",
                client_id: defaultClientId || "",
                squad_id: "none",
                assignee_id: "none",
                priority: "medium",
                type: "other",
                contract_id: defaultContractId || "none",
            });
            setDate(undefined);
            setHasBeenReset(true);
        }
    }, [taskToEdit, open, reset, setValue, defaultClientId, defaultContractId, hasBeenReset]);

    // Update defaults once contract details are loaded
    useEffect(() => {
        if (!taskToEdit && contractDetails && hasBeenReset) {
            if (watch("assignee_id") === "none") {
                setValue("assignee_id", contractDetails.account_manager_id || "none");
            }
            if (watch("squad_id") === "none") {
                setValue("squad_id", contractDetails.squad_id || "none");
            }
        }
    }, [contractDetails, taskToEdit, hasBeenReset, setValue, watch]);

    useEffect(() => {
        setValue("due_date", date);
    }, [date, setValue]);

    // Fetch Clients
    const { data: clients } = useQuery({
        queryKey: ["clients", currentWorkspace?.id],
        queryFn: async () => {
            if (!currentWorkspace?.id) return [];
            const { data, error } = await supabase
                .from("clients")
                .select("id, name")
                .eq("workspace_id", currentWorkspace.id)
                .eq("status", "active")
                .order("name");
            if (error) throw error;
            return data as any;
        },
        enabled: !!currentWorkspace?.id && open,
    });

    // Fetch Squads
    const { data: squads } = useQuery({
        queryKey: ["squads", currentWorkspace?.id],
        queryFn: async () => {
            if (!currentWorkspace?.id) return [];
            const { data, error } = await (supabase as any)
                .from("squads")
                .select("id, name")
                .eq("workspace_id", currentWorkspace.id)
                .order("name");
            if (error) throw error;
            return data as { id: string, name: string }[];
        },
        enabled: !!currentWorkspace?.id && open,
    });

    // Fetch Members (Assignees)
    const { data: members } = useQuery({
        queryKey: ["workspace-members-profiles", currentWorkspace?.id],
        queryFn: async () => {
            if (!currentWorkspace?.id) return [];
            const { data, error } = await supabase
                .from("workspace_members")
                .select(`
            user_id,
            profiles (
              id,
              full_name
            )
          `)
                .eq("workspace_id", currentWorkspace.id);

            if (error) throw error;
            // Cast to any to handle deep type instantiation issues if necessary
            return (data as any[]).map(m => m.profiles).filter(p => p !== null) as { id: string, full_name: string }[];
        },
        enabled: !!currentWorkspace?.id && open,
    });

    const mutation = useMutation({
        mutationFn: async (data: TaskFormData) => {
            if (!currentWorkspace?.id) throw new Error("No workspace selected");

            const payload = {
                title: data.title,
                description: data.description,
                client_id: data.client_id,
                squad_id: data.squad_id === "none" ? null : data.squad_id,
                assignee_id: data.assignee_id === "none" ? null : data.assignee_id,
                priority: data.priority,
                type: data.type,
                due_date: date ? date.toISOString() : null,
                workspace_id: currentWorkspace.id,
                status: taskToEdit ? taskToEdit.status : defaultStatus,
                contract_id: data.contract_id === "none" ? null : data.contract_id,
            };

            if (taskToEdit) {
                const { error } = await (supabase as any)
                    .from("tasks")
                    .update(payload)
                    .eq("id", taskToEdit.id);
                if (error) throw error;
            } else {
                const { error } = await (supabase as any)
                    .from("tasks")
                    .insert(payload);
                if (error) throw error;

                // Log activity
                if (payload.client_id && user?.id) {
                    await (supabase as any).from("client_activities").insert({
                        workspace_id: currentWorkspace.id,
                        client_id: payload.client_id,
                        user_id: user.id,
                        description: `Criou a tarefa: ${payload.title}`,
                        type: 'task',
                        contract_id: payload.contract_id
                    });
                }
            }
        },
        onSuccess: () => {
            // Invalidate all task-related queries
            queryClient.invalidateQueries({ queryKey: ["tasks"] });
            queryClient.invalidateQueries({ queryKey: ["client-tasks"] });
            queryClient.invalidateQueries({ queryKey: ["ops-urgent-tasks"] });
            queryClient.invalidateQueries({ queryKey: ["client_activities"] });

            toast({
                title: taskToEdit ? "Tarefa atualizada" : "Tarefa criada",
                description: `A tarefa foi ${taskToEdit ? "atualizada" : "criada"} com sucesso.`,
            });
            onOpenChange(false);
            reset();
        },
        onError: (error) => {
            console.error("Error saving task:", error);
            toast({
                variant: "destructive",
                title: "Erro ao salvar tarefa",
                description: "Ocorreu um erro ao tentar salvar a tarefa.",
            });
        },
    });
    const watchedClientId = watch("client_id");

    const { data: contracts } = useQuery({
        queryKey: ["contracts-list", currentWorkspace?.id, watchedClientId],
        queryFn: async () => {
            if (!currentWorkspace?.id || !watchedClientId || watchedClientId === "none") return [];
            const { data, error } = await (supabase as any)
                .from("contracts")
                .select("id, name")
                .eq("workspace_id", currentWorkspace.id)
                .eq("client_id", watchedClientId)
                .eq("status", "active");
            if (error) throw error;
            return data as { id: string, name: string }[];
        },
        enabled: !!currentWorkspace?.id && !!watchedClientId && watchedClientId !== "none",
    });

    const onSubmit = async (data: TaskFormData) => {
        // Ensure values from watch/setValue are used if not registered
        const finalData = {
            ...data,
            assignee_id: watch("assignee_id"),
            squad_id: watch("squad_id"),
            priority: watch("priority"),
            type: watch("type"),
            client_id: watch("client_id"),
            contract_id: watch("contract_id"),
        };
        mutation.mutate(finalData as TaskFormData);
    };

    const priorityIcons = {
        low: <Flag className="h-4 w-4 text-slate-400" />,
        medium: <Flag className="h-4 w-4 text-blue-400" />,
        high: <Flag className="h-4 w-4 text-orange-400" />,
        urgent: <Flag className="h-4 w-4 text-red-500 animate-pulse" />,
    };

    const statusOptions: { value: TaskStatus; label: string; color: string }[] = [
        { value: "backlog", label: "Inbox", color: "bg-slate-500" },
        { value: "todo", label: "A Fazer", color: "bg-blue-500" },
        { value: "in_progress", label: "Fazendo", color: "bg-amber-500" },
        { value: "review", label: "Revisão", color: "bg-blue-500" },
        { value: "done", label: "Finalizado", color: "bg-emerald-500" },
    ];

    const typeIcons = {
        traffic: <Zap className="h-4 w-4 text-blue-500" />,
        design: <ImageIcon className="h-4 w-4 text-blue-500" />,
        copy: <FileText className="h-4 w-4 text-amber-500" />,
        strategy: <Target className="h-4 w-4 text-emerald-500" />,
        other: <MoreHorizontal className="h-4 w-4 text-slate-500" />,
    };

    const currentStatus = statusOptions.find(s => s.value === (taskToEdit ? taskToEdit.status : defaultStatus)) || statusOptions[0];

    const descriptionRef = useRef<HTMLDivElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [slashMenuOpen, setSlashMenuOpen] = useState(false);
    const [slashMenuPosition, setSlashMenuPosition] = useState({ top: 0, left: 0 });
    const [currentFontSize, setCurrentFontSize] = useState('3');

    const executeCommand = (command: string, value?: string) => {
        if (!descriptionRef.current) return;

        descriptionRef.current.focus();
        document.execCommand(command, false, value);

        setTimeout(() => {
            if (descriptionRef.current) {
                setValue("description", descriptionRef.current.innerHTML);
            }
        }, 10);
    };

    const handleFormat = (command: string, value?: string) => {
        executeCommand(command, value);
    };

    const handleInput = (e: React.FormEvent<HTMLDivElement>) => {
        const target = e.target as HTMLDivElement;
        setValue("description", target.innerHTML);

        const selection = window.getSelection();
        if (!selection || selection.rangeCount === 0) return;

        const range = selection.getRangeAt(0);
        const text = range.startContainer.textContent || '';
        const offset = range.startOffset;

        if (text[offset - 1] === '/' && (offset === 1 || text[offset - 2] === ' ' || text[offset - 2] === '\n')) {
            const rect = range.getBoundingClientRect();
            const editorRect = target.getBoundingClientRect();
            setSlashMenuPosition({
                top: rect.bottom - editorRect.top + 10,
                left: rect.left - editorRect.left
            });
            setSlashMenuOpen(true);
        } else if (text[offset - 1] === ' ') {
            setSlashMenuOpen(false);
        }
    };

    const insertImage = async (file: File) => {
        if (!currentWorkspace?.id) return;

        const fileExt = file.name.split('.').pop();
        const fileName = `${Math.random()}.${fileExt}`;
        const filePath = `task-images/${fileName}`;

        const { error: uploadError } = await supabase.storage
            .from('client-assets')
            .upload(filePath, file);

        if (uploadError) {
            toast({ variant: "destructive", title: "Erro no upload", description: uploadError.message });
            return;
        }

        const { data: { publicUrl } } = supabase.storage
            .from('client-assets')
            .getPublicUrl(filePath);

        const imgHtml = `<img src="${publicUrl}" alt="image" style="max-width: 100%; width: 50%; height: auto; border-radius: 12px; margin: 16px 0; cursor: pointer; display: block; margin-left: auto; margin-right: auto; transition: all 0.3s ease;" class="task-image" data-size="50" data-align="center" draggable="true" />`;
        handleFormat('insertHTML', imgHtml);
    };

    const handlePaste = (e: React.ClipboardEvent) => {
        const items = e.clipboardData.items;
        for (let i = 0; i < items.length; i++) {
            if (items[i].type.indexOf('image') !== -1) {
                const file = items[i].getAsFile();
                if (file) {
                    e.preventDefault();
                    insertImage(file);
                    return;
                }
            }
        }
    };

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) insertImage(file);
    };

    const insertTable = () => {
        const tableHtml = `
            <table style="border-collapse: collapse; width: 100%; margin: 16px 0; border: 1px solid #e2e8f0;">
                <tr>
                    <td style="border: 1px solid #e2e8f0; padding: 8px;">Célula 1</td>
                    <td style="border: 1px solid #e2e8f0; padding: 8px;">Célula 2</td>
                </tr>
                <tr>
                    <td style="border: 1px solid #e2e8f0; padding: 8px;">Célula 3</td>
                    <td style="border: 1px solid #e2e8f0; padding: 8px;">Célula 4</td>
                </tr>
            </table>
        `;
        handleFormat('insertHTML', tableHtml);
    };

    const executeSlashCommand = (command: string) => {
        if (!descriptionRef.current) return;

        const selection = window.getSelection();
        if (selection && selection.rangeCount > 0) {
            const range = selection.getRangeAt(0);
            range.setStart(range.startContainer, Math.max(0, range.startOffset - 1));
            range.deleteContents();
        }

        setTimeout(() => {
            switch (command) {
                case 'h1':
                    handleFormat('formatBlock', '<h1>');
                    break;
                case 'h2':
                    handleFormat('formatBlock', '<h2>');
                    break;
                case 'h3':
                    handleFormat('formatBlock', '<h3>');
                    break;
                case 'bullet':
                    handleFormat('insertUnorderedList');
                    break;
                case 'number':
                    handleFormat('insertOrderedList');
                    break;
                case 'image':
                    fileInputRef.current?.click();
                    break;
                case 'table':
                    insertTable();
                    break;
            }
        }, 10);

        setSlashMenuOpen(false);
    };

    // Update editor content when taskToEdit changes
    useEffect(() => {
        if (open && taskToEdit && descriptionRef.current) {
            descriptionRef.current.innerHTML = taskToEdit.description || "";
        } else if (open && !taskToEdit && descriptionRef.current && !hasBeenReset) {
            descriptionRef.current.innerHTML = "";
        }
    }, [open, taskToEdit, hasBeenReset]);

    // Interactive Image Controls
    useEffect(() => {
        const editor = descriptionRef.current;
        if (!editor) return;

        const handleImageClick = (e: MouseEvent) => {
            const target = e.target as HTMLElement;
            if (target.tagName === 'IMG' && target.classList.contains('task-image')) {
                const img = target as HTMLImageElement;

                // Cycle sizes: 25% -> 50% -> 100%
                let currentSize = img.dataset.size || "50";
                let nextSize = "100";
                if (currentSize === "100") nextSize = "25";
                else if (currentSize === "25") nextSize = "50";

                img.dataset.size = nextSize;
                img.style.width = nextSize + "%";

                // Update data-align cycle: center -> left -> right
                let currentAlign = img.dataset.align || "center";
                let nextAlign = "left";
                if (currentAlign === "left") nextAlign = "right";
                else if (currentAlign === "right") nextAlign = "center";

                img.dataset.align = nextAlign;

                if (nextAlign === "center") {
                    img.style.display = "block";
                    img.style.marginLeft = "auto";
                    img.style.marginRight = "auto";
                    img.style.float = "none";
                } else {
                    img.style.display = "inline-block";
                    img.style.float = nextAlign;
                    img.style.margin = "16px";
                }

                // Notify form of changes
                setValue("description", editor.innerHTML);
            }
        };

        editor.addEventListener('click', handleImageClick);
        return () => editor.removeEventListener('click', handleImageClick);
    }, [setValue]);

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-[95vw] w-full h-[95vh] max-h-[95vh] p-0 overflow-hidden flex flex-col gap-0 border-none shadow-2xl bg-background rounded-2xl">
                <div className="flex h-full flex-1 overflow-hidden">
                    {/* Main Content Area */}
                    <div className="flex-1 flex flex-col overflow-hidden bg-background">
                        <div className={cn(
                            "flex-1 flex flex-col p-8 space-y-6 overflow-y-auto custom-scrollbar transition-all duration-300",
                            isDescriptionExpanded ? "hidden" : "block"
                        )}>

                            <div className="flex items-center justify-between mb-8">
                                <div className="flex items-center gap-4">
                                    <Select
                                        value={taskToEdit ? taskToEdit.status : defaultStatus}
                                        onValueChange={(val) => { }}
                                        disabled={!taskToEdit}
                                    >
                                        <SelectTrigger className={cn("w-auto h-8 px-4 border-none text-white text-[11px] font-black uppercase tracking-widest rounded-lg shadow-sm", currentStatus.color)}>
                                            <SelectValue placeholder="Status" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {statusOptions.map((opt) => (
                                                <SelectItem key={opt.value} value={opt.value} className="text-[11px] font-bold uppercase py-2">
                                                    {opt.label}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    <div className="h-6 w-[1px] bg-slate-200 dark:bg-slate-800" />
                                    <Badge variant="secondary" className="bg-primary/5 text-primary/70 border-primary/10 transition-colors uppercase tracking-[0.2em] text-[10px] font-black px-3 py-1 rounded-lg">
                                        Demandas
                                    </Badge>
                                </div>
                                <span className="text-xs text-muted-foreground font-mono font-bold uppercase bg-muted/30 px-3 py-1 rounded-full border border-slate-100 dark:border-slate-800">
                                    #{taskToEdit?.id?.substring(0, 8) || 'novo-registro'}
                                </span>
                            </div>

                            {/* Hidden Inputs for Form Data */}
                            <input type="hidden" {...register("client_id")} />
                            <input type="hidden" {...register("contract_id")} />
                            <input type="hidden" {...register("squad_id")} />
                            <input type="hidden" {...register("assignee_id")} />
                            <input type="hidden" {...register("priority")} />
                            <input type="hidden" {...register("type")} />

                            <div className="space-y-3 p-6 bg-primary/5 rounded-[2rem] border border-primary/10 shadow-sm transition-all hover:bg-primary/[0.07]">
                                <Label className="text-[10px] uppercase font-black text-primary/70 tracking-[0.2em] flex items-center gap-2 mb-1 pl-1">
                                    <CheckCircle2 className="h-4 w-4" /> Título da Tarefa
                                </Label>
                                <Input
                                    id="title"
                                    {...register("title", { required: true })}
                                    className="text-3xl font-black border-none bg-transparent p-0 focus-visible:ring-0 focus-visible:ring-offset-0 placeholder:text-primary/20 h-auto text-foreground"
                                    placeholder="Descreva o objetivo principal desta tarefa..."
                                />
                            </div>

                            {/* Improved Metadata Grid */}
                            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-5 p-6 bg-slate-50/50 dark:bg-slate-900/20 rounded-3xl border border-slate-100 dark:border-slate-800/50 shadow-sm">
                                <div className="space-y-2.5">
                                    <Label className="text-[10px] uppercase font-black text-muted-foreground/60 tracking-[0.15em] flex items-center gap-2 mb-1 pl-1">
                                        <Building2 className="h-3.5 w-3.5" /> Cliente
                                    </Label>
                                    <div className="flex items-center gap-2 px-4 h-11 bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm cursor-not-allowed">
                                        <span className="text-[12px] font-bold truncate text-muted-foreground">
                                            {taskToEdit?.clients?.name || (contractDetails as any)?.clients?.name || clientNameOnly || "Sem Cliente"}
                                        </span>
                                    </div>
                                </div>

                                <div className="space-y-2.5">
                                    <Label className="text-[10px] uppercase font-black text-muted-foreground/60 tracking-[0.15em] flex items-center gap-2 mb-1 pl-1">
                                        <Briefcase className="h-3.5 w-3.5" /> Contrato
                                    </Label>
                                    <div className="flex items-center gap-2 px-4 h-11 bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm cursor-not-allowed">
                                        <span className="text-[12px] font-bold truncate text-muted-foreground">
                                            {taskToEdit?.contracts?.name || (contractDetails as any)?.name || "Geral"}
                                        </span>
                                    </div>
                                </div>

                                <div className="space-y-2.5">
                                    <Label className="text-[10px] uppercase font-black text-muted-foreground/60 tracking-[0.15em] flex items-center gap-2 mb-1 pl-1">
                                        <User className="h-3.5 w-3.5" /> Responsável
                                    </Label>
                                    <Select value={watch("assignee_id")} onValueChange={(val) => setValue("assignee_id", val)}>
                                        <SelectTrigger className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 hover:border-primary/20 transition-all rounded-2xl h-11 px-4 shadow-sm">
                                            <SelectValue placeholder="Atribuir..." className="font-bold text-xs" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="none" className="font-bold">Ninguém</SelectItem>
                                            {members?.map((member) => (
                                                <SelectItem key={member.id} value={member.id} className="font-bold py-2.5">{member.full_name}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div className="space-y-2.5">
                                    <Label className="text-[10px] uppercase font-black text-muted-foreground/60 tracking-[0.15em] flex items-center gap-2 mb-1 pl-1">
                                        <CalendarIcon className="h-3.5 w-3.5" /> Vencimento
                                    </Label>
                                    <Popover>
                                        <PopoverTrigger asChild>
                                            <Button
                                                variant="outline"
                                                className={cn(
                                                    "w-full justify-start text-left font-bold bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 hover:border-primary/20 transition-all rounded-2xl h-11 px-4 shadow-sm",
                                                    !date && "text-muted-foreground/40"
                                                )}
                                            >
                                                {date ? format(date, "dd MMM, yyyy") : <span className="text-xs">Definir data</span>}
                                            </Button>
                                        </PopoverTrigger>
                                        <PopoverContent className="w-auto p-0 border-none shadow-2xl rounded-3xl" align="start">
                                            <Calendar
                                                mode="single"
                                                selected={date}
                                                onSelect={setDate}
                                                initialFocus
                                            />
                                        </PopoverContent>
                                    </Popover>
                                </div>

                                <div className="space-y-2.5">
                                    <Label className="text-[10px] uppercase font-black text-muted-foreground/60 tracking-[0.15em] flex items-center gap-2 mb-1 pl-1">
                                        <Flag className="h-3.5 w-3.5" /> Prioridade
                                    </Label>
                                    <Select value={watch("priority")} onValueChange={(val) => setValue("priority", val as TaskPriority)}>
                                        <SelectTrigger className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 hover:border-primary/20 transition-all rounded-2xl h-11 px-4 capitalize font-bold">
                                            <div className="flex items-center gap-2">
                                                {priorityIcons[watch("priority") || 'medium']}
                                                <SelectValue />
                                            </div>
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="low" className="font-bold py-2.5">Baixa</SelectItem>
                                            <SelectItem value="medium" className="font-bold py-2.5">Média</SelectItem>
                                            <SelectItem value="high" className="font-bold py-2.5">Alta</SelectItem>
                                            <SelectItem value="urgent" className="font-bold py-2.5 text-red-500">Urgente</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div className="space-y-2.5">
                                    <Label className="text-[10px] uppercase font-black text-muted-foreground/60 tracking-[0.15em] flex items-center gap-2 mb-1 pl-1">
                                        <Tag className="h-3.5 w-3.5" /> Tipo
                                    </Label>
                                    <Select value={watch("type")} onValueChange={(val) => setValue("type", val as TaskType)}>
                                        <SelectTrigger className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 hover:border-primary/20 transition-all rounded-2xl h-11 px-4 capitalize font-bold">
                                            <div className="flex items-center gap-2">
                                                {typeIcons[watch("type") || 'other']}
                                                <SelectValue />
                                            </div>
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="traffic" className="font-bold py-2.5">Tráfego</SelectItem>
                                            <SelectItem value="design" className="font-bold py-2.5">Design</SelectItem>
                                            <SelectItem value="copy" className="font-bold py-2.5">Copy</SelectItem>
                                            <SelectItem value="strategy" className="font-bold py-2.5">Estratégia</SelectItem>
                                            <SelectItem value="other" className="font-bold py-2.5">Outro</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                        </div>

                        {/* Rich Document Description Section (ClickUp Style) */}
                        <div className={cn(
                            "px-8 py-4 transition-all duration-300 flex-1 flex flex-col overflow-hidden",
                            isDescriptionExpanded ? "pt-8" : ""
                        )}>
                            <div className="flex-1 flex flex-col bg-white dark:bg-slate-950 rounded-[2.5rem] border border-slate-100 dark:border-slate-800 overflow-hidden shadow-2xl transition-all focus-within:ring-2 focus-within:ring-primary/10">
                                {/* Pro Toolbar (ClickUp/Notion Style) */}
                                <div className="px-4 py-2 border-b border-slate-50 dark:border-900 bg-slate-50/50 dark:bg-slate-900/50 flex flex-wrap items-center gap-1">
                                    <div className="flex items-center gap-1 flex-1">
                                        {/* Group: Text Styles */}
                                        <div className="flex items-center bg-white dark:bg-slate-900 rounded-xl p-1 border border-slate-100 dark:border-slate-800 mr-2 shadow-sm">
                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                    <Button
                                                        type="button"
                                                        variant="ghost" size="sm" className="h-7 px-2 gap-1.5 text-[10px] font-black uppercase tracking-wider hover:bg-slate-100"
                                                    >
                                                        <Type className="h-3 w-3 text-primary" />
                                                        Corpo
                                                        <MoreHorizontal className="h-2 w-2 opacity-30" />
                                                    </Button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent align="start" className="w-48 rounded-xl">
                                                    <DropdownMenuItem onClick={() => handleFormat('formatBlock', '<p>')} className="font-bold">Texto Normal</DropdownMenuItem>
                                                    <DropdownMenuItem onClick={() => handleFormat('formatBlock', '<h1>')} className="text-xl font-black">Título 1</DropdownMenuItem>
                                                    <DropdownMenuItem onClick={() => handleFormat('formatBlock', '<h2>')} className="text-lg font-black">Título 2</DropdownMenuItem>
                                                    <DropdownMenuItem onClick={() => handleFormat('formatBlock', '<h3>')} className="font-black">Título 3</DropdownMenuItem>
                                                </DropdownMenuContent>
                                            </DropdownMenu>

                                            <div className="h-3 w-[1px] bg-slate-100 dark:border-slate-800 mx-1" />

                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                    <Button type="button" variant="ghost" size="sm" className="h-7 px-2 gap-1 text-[10px] font-bold hover:bg-slate-100">
                                                        A<span className="text-[8px]">▼</span>
                                                    </Button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent align="start" className="w-32 rounded-xl">
                                                    <DropdownMenuItem onClick={() => { handleFormat('fontSize', '1'); setCurrentFontSize('1'); }}>Pequeno</DropdownMenuItem>
                                                    <DropdownMenuItem onClick={() => { handleFormat('fontSize', '3'); setCurrentFontSize('3'); }}>Normal</DropdownMenuItem>
                                                    <DropdownMenuItem onClick={() => { handleFormat('fontSize', '5'); setCurrentFontSize('5'); }}>Grande</DropdownMenuItem>
                                                    <DropdownMenuItem onClick={() => { handleFormat('fontSize', '7'); setCurrentFontSize('7'); }}>Enorme</DropdownMenuItem>
                                                </DropdownMenuContent>
                                            </DropdownMenu>

                                            <div className="h-3 w-[1px] bg-slate-100 dark:bg-slate-800 mx-1" />

                                            <Popover>
                                                <PopoverTrigger asChild>
                                                    <Button
                                                        type="button"
                                                        variant="ghost" size="icon" className="h-7 w-7 rounded-lg hover:bg-primary/10 hover:text-primary transition-all"
                                                    >
                                                        <Palette className="h-3.5 w-3.5" />
                                                    </Button>
                                                </PopoverTrigger>
                                                <PopoverContent className="w-48 p-2 rounded-xl border-none shadow-2xl">
                                                    <div className="grid grid-cols-4 gap-1">
                                                        {['#000000', '#ef4444', '#f97316', '#eab308', '#22c55e', '#3b82f6', '#8b5cf6', '#ec4899', '#64748b', '#ffffff'].map(c => (
                                                            <button
                                                                key={c}
                                                                className="w-8 h-8 rounded-lg border border-slate-100 dark:border-slate-800 hover:scale-110 transition-transform"
                                                                style={{ backgroundColor: c }}
                                                                onClick={() => handleFormat('foreColor', c)}
                                                            />
                                                        ))}
                                                    </div>
                                                </PopoverContent>
                                            </Popover>
                                        </div>

                                        {/* Group: Basic Formatting */}
                                        <div className="flex items-center bg-white dark:bg-slate-900 rounded-xl p-1 border border-slate-100 dark:border-slate-800 mr-2 shadow-sm">
                                            <Button type="button" variant="ghost" size="icon" className="h-7 w-7 rounded-lg hover:bg-primary/10 hover:text-primary font-black uppercase tracking-tight" onClick={() => handleFormat('bold')}>B</Button>
                                            <Button type="button" variant="ghost" size="icon" className="h-7 w-7 rounded-lg hover:bg-primary/10 hover:text-primary italic" onClick={() => handleFormat('italic')}>I</Button>
                                            <Button type="button" variant="ghost" size="icon" className="h-7 w-7 rounded-lg hover:bg-primary/10 hover:text-primary underline" onClick={() => handleFormat('underline')}>U</Button>
                                            <Button type="button" variant="ghost" size="icon" className="h-7 w-7 rounded-lg hover:bg-primary/10 hover:text-primary line-through" onClick={() => handleFormat('strikeThrough')}><Strikethrough className="h-3.5 w-3.5" /></Button>
                                            <Button type="button" variant="ghost" size="icon" className="h-7 w-7 rounded-lg hover:bg-primary/10 hover:text-primary" onClick={() => {
                                                const selection = window.getSelection()?.toString();
                                                handleFormat('insertHTML', `<code class="bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded text-pink-500 font-mono text-sm">${selection || 'code'}</code>`);
                                            }}><Code className="h-3.5 w-3.5" /></Button>
                                        </div>

                                        {/* Group: Alignment */}
                                        <div className="flex items-center bg-white dark:bg-slate-900 rounded-xl p-1 border border-slate-100 dark:border-slate-800 mr-2 shadow-sm">
                                            <Button type="button" variant="ghost" size="icon" className="h-7 w-7 rounded-lg hover:bg-primary/10 hover:text-primary" onClick={() => handleFormat('justifyLeft')}><AlignLeft className="h-3.5 w-3.5" /></Button>
                                            <Button type="button" variant="ghost" size="icon" className="h-7 w-7 rounded-lg hover:bg-primary/10 hover:text-primary" onClick={() => handleFormat('justifyCenter')}><AlignCenter className="h-3.5 w-3.5" /></Button>
                                            <Button type="button" variant="ghost" size="icon" className="h-7 w-7 rounded-lg hover:bg-primary/10 hover:text-primary" onClick={() => handleFormat('justifyRight')}><AlignRight className="h-3.5 w-3.5" /></Button>
                                            <Button type="button" variant="ghost" size="icon" className="h-7 w-7 rounded-lg hover:bg-primary/10 hover:text-primary" onClick={() => handleFormat('justifyFull')}><AlignJustify className="h-3.5 w-3.5" /></Button>
                                        </div>

                                        {/* Group: Lists */}
                                        <div className="flex items-center bg-white dark:bg-slate-900 rounded-xl p-1 border border-slate-100 dark:border-slate-800 mr-2 shadow-sm">
                                            <Button type="button" variant="ghost" size="icon" className="h-7 w-7 rounded-lg hover:bg-primary/10 hover:text-primary" onClick={() => handleFormat('insertUnorderedList')}><List className="h-3.5 w-3.5" /></Button>
                                            <Button type="button" variant="ghost" size="icon" className="h-7 w-7 rounded-lg hover:bg-primary/10 hover:text-primary" onClick={() => handleFormat('insertOrderedList')}><ListOrdered className="h-3.5 w-3.5" /></Button>
                                            <Button type="button" variant="ghost" size="icon" className="h-7 w-7 rounded-lg hover:bg-primary/10 hover:text-primary" onClick={() => handleFormat('insertHTML', '<input type="checkbox" style="width: 1rem; height: 1rem; margin-right: 0.5rem;" /> ')}><CheckSquare className="h-3.5 w-3.5" /></Button>
                                            <Button type="button" variant="ghost" size="icon" className="h-7 w-7 rounded-lg hover:bg-primary/10 hover:text-primary" onClick={() => handleFormat('formatBlock', 'blockquote')}><Quote className="h-3.5 w-3.5" /></Button>
                                        </div>

                                        {/* Group: Inserables */}
                                        <div className="flex items-center bg-white dark:bg-slate-900 rounded-xl p-1 border border-slate-100 dark:border-slate-800 shadow-sm">
                                            <Popover>
                                                <PopoverTrigger asChild>
                                                    <Button
                                                        type="button"
                                                        variant="ghost" size="icon" className="h-7 w-7 rounded-lg hover:bg-primary/10 hover:text-primary"
                                                    >
                                                        <Link2 className="h-3.5 w-3.5" />
                                                    </Button>
                                                </PopoverTrigger>
                                                <PopoverContent className="w-64 p-3 rounded-xl border-none shadow-2xl">
                                                    <div className="flex flex-col gap-2">
                                                        <label className="text-xs font-bold text-muted-foreground">URL</label>
                                                        <Input
                                                            placeholder="https://exemplo.com"
                                                            className="h-8 rounded-lg text-xs"
                                                            onKeyDown={(e) => {
                                                                if (e.key === 'Enter') {
                                                                    e.preventDefault();
                                                                    const url = (e.currentTarget as HTMLInputElement).value;
                                                                    if (url) {
                                                                        const selection = window.getSelection();
                                                                        const selectedText = selection?.toString();
                                                                        if (selectedText) {
                                                                            handleFormat('createLink', url);
                                                                        } else {
                                                                            handleFormat('insertHTML', `<a href="${url}" target="_blank" style="color: #3b82f6; text-decoration: underline;">${url}</a>`);
                                                                        }
                                                                    }
                                                                }
                                                            }}
                                                        />
                                                        <p className="text-[10px] text-muted-foreground">Selecione texto antes de clicar no ícone para transformar em link</p>
                                                    </div>
                                                </PopoverContent>
                                            </Popover>

                                            <Button type="button" variant="ghost" size="icon" className="h-7 w-7 rounded-lg hover:bg-primary/10 hover:text-primary" onClick={() => fileInputRef.current?.click()}><ImageIcon className="h-3.5 w-3.5" /></Button>
                                            <input type="file" ref={fileInputRef} className="hidden" onChange={handleFileSelect} accept="image/*" />



                                            <Button type="button" variant="ghost" size="icon" className="h-7 w-7 rounded-lg hover:bg-primary/10 hover:text-primary" onClick={insertTable}><TableIcon className="h-3.5 w-3.5" /></Button>

                                            <Popover>
                                                <PopoverTrigger asChild>
                                                    <Button type="button" variant="ghost" size="icon" className="h-7 w-7 rounded-lg hover:bg-primary/10 hover:text-primary">
                                                        <Smile className="h-3.5 w-3.5" />
                                                    </Button>
                                                </PopoverTrigger>
                                                <PopoverContent className="w-auto p-2 rounded-xl border-none shadow-2xl">
                                                    <div className="grid grid-cols-6 gap-1">
                                                        {['😊', '🚀', '🔥', '✅', '❌', '📅', '💡', '🔔', '💬', '🛠️', '📎', '📊'].map(e => (
                                                            <button key={e} className="text-xl p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors" onClick={() => handleFormat('insertHTML', e)}>{e}</button>
                                                        ))}
                                                    </div>
                                                </PopoverContent>
                                            </Popover>
                                        </div>

                                        <div className="flex items-center gap-1 ml-auto">
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="icon"
                                                className="h-8 w-8 rounded-xl hover:bg-primary/10 hover:text-primary"
                                                onClick={() => setIsDescriptionExpanded(!isDescriptionExpanded)}
                                                title={isDescriptionExpanded ? "Reduzir Detalhes" : "Expandir Detalhes"}
                                            >
                                                {isDescriptionExpanded ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
                                            </Button>
                                        </div>
                                    </div>
                                </div>

                                <div className="p-10 flex-1 flex flex-col relative group/editor overflow-y-auto">
                                    {slashMenuOpen && (
                                        <div
                                            className="absolute z-50 w-72 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl shadow-2xl overflow-hidden"
                                            style={{ top: slashMenuPosition.top, left: slashMenuPosition.left }}
                                        >
                                            <Command className="bg-transparent">
                                                <CommandInput placeholder="Buscar comando..." />
                                                <CommandList>
                                                    <CommandGroup heading="Títulos">
                                                        <CommandItem onSelect={() => executeSlashCommand('h1')} className="cursor-pointer">
                                                            <Type className="mr-2 h-4 w-4" /> <span className="text-xl font-black">Título 1</span>
                                                        </CommandItem>
                                                        <CommandItem onSelect={() => executeSlashCommand('h2')} className="cursor-pointer">
                                                            <Type className="mr-2 h-4 w-4" /> <span className="text-lg font-black">Título 2</span>
                                                        </CommandItem>
                                                        <CommandItem onSelect={() => executeSlashCommand('h3')} className="cursor-pointer">
                                                            <Type className="mr-2 h-4 w-4" /> <span className="font-black">Título 3</span>
                                                        </CommandItem>
                                                    </CommandGroup>
                                                    <CommandGroup heading="Listas">
                                                        <CommandItem onSelect={() => executeSlashCommand('bullet')} className="cursor-pointer">
                                                            <List className="mr-2 h-4 w-4" /> Lista com marcadores
                                                        </CommandItem>
                                                        <CommandItem onSelect={() => executeSlashCommand('number')} className="cursor-pointer">
                                                            <ListOrdered className="mr-2 h-4 w-4" /> Lista numerada
                                                        </CommandItem>
                                                    </CommandGroup>
                                                    <CommandGroup heading="Mídia">
                                                        <CommandItem onSelect={() => executeSlashCommand('image')} className="cursor-pointer">
                                                            <ImageIcon className="mr-2 h-4 w-4" /> Imagem
                                                        </CommandItem>
                                                        <CommandItem onSelect={() => executeSlashCommand('table')} className="cursor-pointer">
                                                            <TableIcon className="mr-2 h-4 w-4" /> Tabela
                                                        </CommandItem>
                                                    </CommandGroup>
                                                </CommandList>
                                            </Command>
                                        </div>
                                    )}

                                    <Label className="text-[10px] uppercase font-black text-primary/30 tracking-[0.3em] flex items-center gap-2 mb-8 pl-1">
                                        <FileText className="h-4 w-4" /> Detalhes da Demanda
                                    </Label>
                                    <div
                                        ref={descriptionRef}
                                        contentEditable
                                        onInput={handleInput}
                                        onPaste={handlePaste}
                                        className="flex-1 text-base font-medium leading-[1.8] border-none bg-transparent outline-none min-h-[300px] max-h-[500px] overflow-y-auto text-slate-800 dark:text-slate-200 empty:before:content-[attr(data-placeholder)] empty:before:text-slate-300 dark:empty:before:text-slate-700 before:pointer-events-none prose dark:prose-invert max-w-none"
                                        data-placeholder="Comece a descrever aqui... use '/' para comandos rápidos."
                                        style={{
                                            wordBreak: 'break-word',
                                            overflowWrap: 'break-word'
                                        }}
                                    />
                                    <input type="hidden" {...register("description")} />

                                    <style dangerouslySetInnerHTML={{
                                        __html: `
                                        [contenteditable="true"] img.task-image {
                                            max-width: 100%;
                                            height: auto;
                                            border-radius: 12px;
                                            margin: 16px 0;
                                            cursor: pointer;
                                            transition: all 0.3s ease;
                                            outline: 2px solid transparent;
                                        }
                                        [contenteditable="true"] img.task-image:hover {
                                            outline: 2px solid #3b82f6;
                                            box-shadow: 0 4px 12px rgba(0,0,0,0.1);
                                        }
                                        [contenteditable="true"] img.task-image.selected {
                                            outline: 2px solid #3b82f6;
                                            outline-offset: 4px;
                                        }
                                        [contenteditable="true"] blockquote {
                                            border-left: 4px solid #3b82f6;
                                            padding-left: 16px;
                                            margin: 16px 0;
                                            font-style: italic;
                                            color: #64748b;
                                        }
                                        [contenteditable="true"] ul, [contenteditable="true"] ol {
                                            padding-left: 24px;
                                            margin: 12px 0;
                                        }
                                        [contenteditable="true"] li {
                                            margin: 4px 0;
                                        }
                                        [contenteditable="true"] h1 {
                                            font-size: 2em;
                                            font-weight: 900;
                                            margin: 16px 0;
                                        }
                                        [contenteditable="true"] h2 {
                                            font-size: 1.5em;
                                            font-weight: 800;
                                            margin: 14px 0;
                                        }
                                        [contenteditable="true"] h3 {
                                            font-size: 1.2em;
                                            font-weight: 700;
                                            margin: 12px 0;
                                        }
                                        [contenteditable="true"] a {
                                            color: #3b82f6;
                                            text-decoration: underline;
                                        }
                                        [contenteditable="true"] code {
                                            background: #f1f5f9;
                                            padding: 2px 6px;
                                            border-radius: 4px;
                                            color: #ec4899;
                                            font-family: 'Courier New', monospace;
                                            font-size: 0.9em;
                                        }
                                    `
                                    }} />

                                    {/* Bottom Hint & Metadata */}
                                    <div className="absolute bottom-6 left-10 right-10 flex items-center justify-between opacity-0 group-focus-within/editor:opacity-100 transition-opacity pointer-events-none">
                                        <div className="flex items-center gap-2 text-[10px] font-bold text-muted-foreground/40 italic">
                                            <span>Dica: Digite <Badge variant="secondary" className="h-4 px-1 text-[8px] bg-slate-100"> / </Badge> para comandos</span>
                                        </div>
                                        <div className="flex items-center gap-4">
                                            <div className="flex items-center gap-1 text-[9px] font-black uppercase tracking-widest text-emerald-500/60">
                                                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                                Autosave ON
                                            </div>
                                            <span className="text-[9px] font-black text-muted-foreground/30 uppercase tracking-widest">
                                                {watch("description")?.length || 0} Caracteres
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                        </div>

                        {/* Improved Footer Actions - Now Sticky */}
                        <div className="p-8 pt-4 border-t border-slate-100 dark:border-slate-800 bg-background/80 backdrop-blur-sm flex items-center justify-between z-10">
                            <div className="flex items-center gap-6">
                                <div className="flex items-center gap-2 text-muted-foreground/40">
                                    <Clock className="h-4 w-4" />
                                    <span className="text-[10px] font-black uppercase tracking-widest">
                                        {taskToEdit ? `Atualizado em: ${format(new Date(taskToEdit.updated_at || taskToEdit.created_at), "dd MMM, HH:mm")}` : `Criado em: ${format(new Date(), "dd MMM, HH:mm")}`}
                                    </span>
                                </div>
                            </div>
                            <div className="flex items-center gap-4">
                                <Button type="button" variant="ghost" className="font-bold text-xs uppercase tracking-widest px-6 hover:bg-slate-100 h-10 rounded-xl" onClick={() => onOpenChange(false)}>
                                    Cancelar
                                </Button>
                                <Button
                                    onClick={handleSubmit(onSubmit)}
                                    className="bg-primary hover:bg-primary/90 text-white font-black text-xs uppercase tracking-[0.2em] px-10 rounded-[1.2rem] shadow-2xl shadow-primary/40 h-12 transition-all hover:scale-[1.02] active:scale-95"
                                    disabled={mutation.isPending}
                                >
                                    {mutation.isPending ? "Processando..." : (taskToEdit ? "Atualizar Demanda" : "Lançar Tarefa")}
                                </Button>
                            </div>
                        </div>
                    </div>

                    {/* Right Sidebar Area (Comments and History) */}
                    {taskToEdit && (
                        <div className="w-[450px] border-l border-slate-100 dark:border-slate-800 bg-slate-50/30 dark:bg-slate-900/10 flex flex-col">
                            <div className="p-6 flex items-center justify-between border-b border-slate-100 dark:border-slate-800">
                                <h3 className="font-black text-xs uppercase tracking-widest flex items-center gap-2">
                                    <MessageSquare className="h-3.5 w-3.5 text-primary" /> Atividade
                                </h3>
                                <Badge variant="secondary" className="bg-background text-[10px] font-bold">Ativo</Badge>
                            </div>
                            <div className="flex-1 overflow-y-auto">
                                <TaskComments taskId={taskToEdit.id} />
                            </div>
                        </div>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}

