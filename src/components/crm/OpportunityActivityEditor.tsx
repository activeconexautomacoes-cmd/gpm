import React, { useState, useEffect } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
    Phone,
    Mail,
    Users,
    MessageCircle,
    FileText,
    Activity,
    Mic,
    ChevronDown,
    Paperclip,
    X,
    FileIcon,
    Calendar,
    Bell
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { toast } from "sonner";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { useQuery } from "@tanstack/react-query";

const activityTypes = [
    { value: "whatsapp", label: "WhatsApp", icon: MessageCircle },
    { value: "call", label: "Ligação", icon: Phone },
    { value: "meeting", label: "Reunião", icon: Users },
    { value: "email", label: "Email", icon: Mail },
    { value: "note", label: "Nota / Outros", icon: FileText },
    { value: "follow_up", label: "Follow-up", icon: Bell },
];

interface OpportunityActivityEditorProps {
    opportunityId: string;
    onSuccess?: () => void;
}

export function OpportunityActivityEditor({
    opportunityId,
    onSuccess
}: OpportunityActivityEditorProps) {
    const { currentWorkspace } = useWorkspace();
    const [content, setContent] = useState("");
    const queryClient = useQueryClient();
    const [currentUser, setCurrentUser] = useState<any>(null);
    const [selectedType, setSelectedType] = useState(activityTypes[0]); // WhatsApp as default
    const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
    const [uploading, setUploading] = useState(false);
    const [isRecording, setIsRecording] = useState(false);
    const [scheduledAt, setScheduledAt] = useState("");
    const [assignedTo, setAssignedTo] = useState<string>("");

    // Fetch workspace members for assignment
    const { data: workspaceMembers = [] } = useQuery({
        queryKey: ["workspace-members-assign", currentWorkspace?.id],
        queryFn: async () => {
            if (!currentWorkspace?.id) return [];

            const { data, error } = await supabase
                .from("workspace_members")
                .select(`
                    user_id,
                    profiles:user_id (
                        id,
                        full_name,
                        email,
                        avatar_url
                    )
                `)
                .eq("workspace_id", currentWorkspace.id);

            if (error) {
                console.error("Error fetching members:", error);
                return [];
            }
            return data.map((m: any) => m.profiles).filter(Boolean);
        },
        enabled: !!currentWorkspace?.id
    });

    useEffect(() => {
        const fetchUser = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                const { data } = await supabase
                    .from("profiles")
                    .select("*")
                    .eq("id", user.id)
                    .single();
                setCurrentUser(data);
                if (!assignedTo) setAssignedTo(user.id);
            }
        };
        fetchUser();
    }, []);

    const createActivityMutation = useMutation({
        mutationFn: async ({ noteType, files, scheduledDate, assignedResult }: { noteType: string, files: File[], scheduledDate?: string, assignedResult?: string }) => {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error("Usuário não autenticado");

            // 1. Upload files if any
            const uploadedAttachments = [];
            for (const file of files) {
                const fileExt = file.name.split('.').pop();
                const fileName = `${opportunityId}/${Date.now()}_${file.name}`;

                const { error: uploadError } = await supabase.storage
                    .from("opportunity-attachments")
                    .upload(fileName, file);

                if (uploadError) throw uploadError;

                const { data: attachment, error: dbError } = await (supabase as any)
                    .from("opportunity_attachments")
                    .insert({
                        opportunity_id: opportunityId,
                        file_name: file.name,
                        file_type: file.type,
                        file_size: file.size,
                        file_url: fileName,
                        uploaded_by: user.id,
                    })
                    .select()
                    .single();

                if (dbError) throw dbError;
                uploadedAttachments.push(attachment);
            }

            // 2. Create note if there's content OR if it was just an attachment upload
            if (content.trim()) {
                const { error } = await (supabase as any)
                    .from("opportunity_notes")
                    .insert({
                        opportunity_id: opportunityId,
                        created_by: user.id,
                        note_type: noteType,
                        content: content,
                        scheduled_at: scheduledDate || null,
                        assigned_to: assignedResult || null
                    });

                if (error) throw error;
            } else if (uploadedAttachments.length > 0) {
                // If only files, create a system note to show in timeline
                const { error } = await (supabase as any)
                    .from("opportunity_notes")
                    .insert({
                        opportunity_id: opportunityId,
                        created_by: user.id,
                        note_type: "attachment",
                        content: `Arquivo(s) enviado(s): ${uploadedAttachments.map(a => a.file_name).join(", ")}`,
                    });
                if (error) throw error;
            }
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["opportunities", currentWorkspace?.id] });
            queryClient.invalidateQueries({ queryKey: ["opportunity-notes", opportunityId] });
            queryClient.invalidateQueries({ queryKey: ["opportunity-attachments", opportunityId] });
            queryClient.invalidateQueries({ queryKey: ["opportunity-timeline", opportunityId] });
            setContent("");
            setSelectedFiles([]);
            setScheduledAt("");
            setUploading(false);
            toast.success("Registrado com sucesso!");
            onSuccess?.();
        },
        onError: (error) => {
            console.error("Erro ao registrar:", error);
            setUploading(false);
            toast.error("Erro ao registrar atividade");
        },
    });

    const handleSave = () => {
        if (!content.trim() && selectedFiles.length === 0) return;

        if (selectedType.value === "follow_up" && !scheduledAt) {
            toast.error("Selecione uma data para o follow-up");
            return;
        }

        setUploading(true);
        createActivityMutation.mutate({
            noteType: selectedType.value,
            files: selectedFiles,
            scheduledDate: scheduledAt,
            assignedResult: assignedTo
        });
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            const newFiles = Array.from(e.target.files);
            setSelectedFiles(prev => [...prev, ...newFiles]);
        }
    };

    const removeFile = (index: number) => {
        setSelectedFiles(prev => prev.filter((_, i) => i !== index));
    };

    const toggleRecording = () => {
        if (isRecording) {
            setIsRecording(false);
            if ((window as any)._activeRecognition) {
                (window as any)._activeRecognition.stop();
            }
            return;
        }

        const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

        if (!SpeechRecognition) {
            toast.error("Seu navegador não suporta reconhecimento de voz.");
            return;
        }

        const recognition = new SpeechRecognition();
        recognition.lang = 'pt-BR';
        recognition.interimResults = true;
        recognition.continuous = true;

        recognition.onstart = () => {
            setIsRecording(true);
            toast.info("Gravando... Fale agora. Clique no microfone para parar.");
        };

        recognition.onresult = (event: any) => {
            for (let i = event.resultIndex; i < event.results.length; ++i) {
                if (event.results[i].isFinal) {
                    const transcript = event.results[i][0].transcript;
                    setContent(prev => prev ? `${prev.trim()} ${transcript}` : transcript);
                }
            }
        };

        recognition.onerror = (event: any) => {
            if (event.error === 'no-speech') return;
            console.error("Erro no reconhecimento de voz:", event.error);
            setIsRecording(false);
            toast.error("Erro ao processar áudio.");
        };

        recognition.onend = () => {
            if (isRecording) {
                recognition.start();
            } else {
                setIsRecording(false);
            }
        };

        (window as any)._activeRecognition = recognition;
        recognition.start();
    };

    return (
        <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden mb-6 transition-all duration-300">
            <div className="flex items-center justify-between px-6 py-3 border-b bg-muted/30">
                <span className="text-sm font-bold text-foreground/80 uppercase tracking-tight">Atividade Realizada</span>
                {currentUser && (
                    <div className="flex items-center gap-2">
                        <span className="text-[10px] text-muted-foreground font-medium uppercase">{currentUser.full_name}</span>
                        <Avatar className="h-6 w-6 border border-border">
                            <AvatarImage src={currentUser?.avatar_url} />
                            <AvatarFallback className="text-[8px] bg-muted">
                                {currentUser?.full_name?.substring(0, 2).toUpperCase() || "..."}
                            </AvatarFallback>
                        </Avatar>
                    </div>
                )}
            </div>

            <div className="p-5">
                <div className="space-y-4">
                    <Textarea
                        placeholder={selectedType.value === "follow_up" ? "Descreva o objetivo do follow-up..." : "Escreva ou grave o que aconteceu..."}
                        value={content}
                        onChange={(e) => setContent(e.target.value)}
                        className="min-h-[120px] border-none shadow-none focus-visible:ring-0 p-0 resize-none text-sm placeholder:text-muted-foreground/40 leading-relaxed"
                    />

                    {selectedType.value === "follow_up" && (
                        <div className="flex flex-col gap-2 p-3 bg-primary/5 rounded-lg border border-primary/10 animate-in fade-in slide-in-from-top-2">
                            <div className="grid grid-cols-2 gap-3">
                                <div className="space-y-1">
                                    <div className="flex items-center gap-2 text-primary">
                                        <Calendar className="w-4 h-4" />
                                        <Label className="text-xs font-bold uppercase tracking-wider">Agendar Follow-up</Label>
                                    </div>
                                    <Input
                                        type="datetime-local"
                                        value={scheduledAt}
                                        onChange={(e) => setScheduledAt(e.target.value)}
                                        className="h-9 text-xs bg-background border-primary/20 focus:border-primary transition-colors"
                                    />
                                </div>

                                <div className="space-y-1">
                                    <div className="flex items-center gap-2 text-primary">
                                        <Users className="w-4 h-4" />
                                        <Label className="text-xs font-bold uppercase tracking-wider">Responsável</Label>
                                    </div>
                                    <Select value={assignedTo} onValueChange={setAssignedTo}>
                                        <SelectTrigger className="h-9 text-xs bg-background border-primary/20 focus:border-primary">
                                            <SelectValue placeholder="Selecione o responsável" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {workspaceMembers.map((member: any) => (
                                                <SelectItem key={member.id} value={member.id}>
                                                    {member.full_name || member.email}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                            <p className="text-[10px] text-muted-foreground italic">
                                Este agendamento aparecerá na lista de atividades do responsável designado.
                            </p>
                        </div>
                    )}

                    {selectedFiles.length > 0 && (
                        <div className="flex flex-wrap gap-2 py-3 border-t border-border">
                            {selectedFiles.map((file, idx) => (
                                <div key={idx} className="flex items-center gap-2 bg-muted/40 border border-border rounded-lg px-2.5 py-1.5 group hover:bg-muted/80 transition-colors">
                                    <FileIcon className="w-3.5 h-3.5 text-muted-foreground" />
                                    <span className="text-[11px] text-foreground/80 max-w-[120px] truncate font-medium">{file.name}</span>
                                    <button
                                        type="button"
                                        onClick={() => removeFile(idx)}
                                        className="text-muted-foreground hover:text-rose-500 opacity-60 group-hover:opacity-100 transition-all"
                                    >
                                        <X className="w-3.5 h-3.5" />
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}

                    <div className="flex items-center justify-between border-t border-border pt-4">
                        <div className="flex items-center gap-2">
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button type="button" variant="outline" size="sm" className="h-8 text-primary border-primary/20 bg-primary/5 hover:bg-primary/10 gap-2 px-3 transition-all rounded-full">
                                        <selectedType.icon className="w-3.5 h-3.5" />
                                        <span className="text-xs font-bold uppercase tracking-wide">{selectedType.label}</span>
                                        <ChevronDown className="w-3 h-3 opacity-50" />
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="start" className="w-[180px] p-1 shadow-xl border-border/50">
                                    {activityTypes.map((type) => (
                                        <DropdownMenuItem
                                            key={type.value}
                                            onClick={() => setSelectedType(type)}
                                            className={cn(
                                                "gap-3 text-xs py-2.5 cursor-pointer rounded-md transition-colors",
                                                selectedType.value === type.value ? "bg-primary/10 text-primary font-bold" : "hover:bg-muted"
                                            )}
                                        >
                                            <type.icon className={cn("w-4 h-4", selectedType.value === type.value ? "text-primary" : "text-muted-foreground")} />
                                            {type.label}
                                        </DropdownMenuItem>
                                    ))}
                                </DropdownMenuContent>
                            </DropdownMenu>
                        </div>
                        <div className="flex items-center gap-3">
                            <input
                                type="file"
                                id="activity-file-upload"
                                className="hidden"
                                multiple
                                onChange={handleFileChange}
                            />
                            <div className="flex items-center bg-muted/50 rounded-full p-0.5 border border-border/50">
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7 rounded-full text-muted-foreground hover:text-primary transition-colors"
                                    onClick={() => document.getElementById('activity-file-upload')?.click()}
                                    title="Anexar arquivo"
                                >
                                    <Paperclip className="w-3.5 h-3.5" />
                                </Button>
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    className={cn(
                                        "h-7 w-7 rounded-full transition-all",
                                        isRecording ? "text-rose-500 bg-rose-500/10 animate-pulse" : "text-muted-foreground hover:text-primary"
                                    )}
                                    onClick={toggleRecording}
                                    title="Gravar áudio"
                                >
                                    <Mic className="w-3.5 h-3.5" />
                                </Button>
                            </div>
                            <Button
                                type="button"
                                variant="default"
                                size="sm"
                                className="h-8 px-6 rounded-full font-bold uppercase tracking-wider text-[10px] shadow-sm bg-primary hover:bg-primary/90 text-primary-foreground transition-all active:scale-95"
                                onClick={handleSave}
                                disabled={(!content.trim() && selectedFiles.length === 0) || uploading}
                            >
                                {uploading ? "Salvando..." : "Salvar"}
                            </Button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
