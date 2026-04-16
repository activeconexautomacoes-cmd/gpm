import React, { useState, useEffect, useRef } from "react";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Lightbulb, Bug, HelpCircle, Eye, Check, ShieldCheck, Paperclip, Loader2, Trash2, User, Send, MessageSquare, X, Mic, FileText, Download, Square, Plus, StickyNote, CornerDownLeft, Zap } from "lucide-react";
import { toast } from "sonner";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useProfile } from "@/hooks/use-profile";
import { useAudioRecorder } from "@/hooks/use-audio-recorder";
import { RequestType, SystemRequest } from "@/types/feedback";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { AITicketChat } from "@/components/feedback/AITicketChat";

interface FeedbackDialogProps {
    children?: React.ReactNode;
}

interface Message {
    id: string;
    request_id: string;
    user_id: string;
    content: string;
    created_at: string;
    attachment_url?: string;
    attachment_type?: string;
}

export function FeedbackDialog({ children }: FeedbackDialogProps) {
    const [open, setOpen] = useState(false);

    // Selection State
    const [activeRequestId, setActiveRequestId] = useState<string | "new">("new");

    // Form State (New Request)
    const [title, setTitle] = useState("");
    const [description, setDescription] = useState("");
    const [type, setType] = useState<RequestType>("suggestion");
    const [files, setFiles] = useState<File[]>([]);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isDragging, setIsDragging] = useState(false);

    // Chat State
    const [newMessage, setNewMessage] = useState("");
    const [chatAttachment, setChatAttachment] = useState<File | null>(null);
    const chatFileRef = useRef<HTMLInputElement>(null);
    const [isSendingMessage, setIsSendingMessage] = useState(false);
    const scrollRef = useRef<HTMLDivElement>(null);

    const { data: profile } = useProfile();
    const queryClient = useQueryClient();

    // Reset when opening
    useEffect(() => {
        if (open) {
            // Optional: reset to new, or keep last state?
            // setActiveRequestId("new"); 
        }
    }, [open]);

    // Auto-scroll chat
    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [activeRequestId]); // Add messages dependency later

    const { isRecording, toggleRecording } = useAudioRecorder((text) => {
        setDescription((prev) => (prev ? `${prev} ${text}` : text));
    });

    const { isRecording: isChatRecording, toggleRecording: toggleChatRecording } = useAudioRecorder((text) => {
        setNewMessage((prev) => (prev ? `${prev} ${text}` : text));
    });

    // --- File Handling (Reuse) ---
    const handleFiles = (newFiles: FileList | File[]) => {
        const fileList = Array.from(newFiles);
        const validFiles = fileList.filter(file =>
            file.type.startsWith('image/') || file.type.startsWith('video/')
        );
        if (validFiles.length < fileList.length) {
            toast.error("Alguns arquivos não são suportados (apenas imagens e vídeos).");
        }
        setFiles((prev) => [...prev, ...validFiles]);
    };
    const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); e.stopPropagation(); setIsDragging(true); };
    const handleDragLeave = (e: React.DragEvent) => { e.preventDefault(); e.stopPropagation(); setIsDragging(false); };
    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault(); e.stopPropagation(); setIsDragging(false);
        if (e.dataTransfer.files?.length > 0) handleFiles(e.dataTransfer.files);
    };
    const handlePaste = (e: React.ClipboardEvent) => {
        const items = e.clipboardData.items;
        const pastedFiles: File[] = [];
        for (let i = 0; i < items.length; i++) {
            if (items[i].type.indexOf("image") !== -1) {
                const blob = items[i].getAsFile();
                if (blob) pastedFiles.push(new File([blob], `pasted-${Date.now()}.png`, { type: blob.type }));
            }
        }
        if (pastedFiles.length > 0) {
            setFiles((prev) => [...prev, ...pastedFiles]);
            toast.success(`${pastedFiles.length} imagem(ns) colada(s).`);
        }
    };
    const removeFile = (index: number) => setFiles((prev) => prev.filter((_, i) => i !== index));

    // --- Queries ---
    const { data: myRequests = [] } = useQuery({
        queryKey: ["my-system-requests"],
        queryFn: async () => {
            const { data, error } = await (supabase as any)
                .from("system_requests")
                .select("*")
                .order("created_at", { ascending: false });
            if (error) throw error;
            return data as SystemRequest[];
        },
        enabled: open,
    });

    const { data: messages = [], refetch: refetchMessages } = useQuery({
        queryKey: ["request-messages", activeRequestId],
        queryFn: async () => {
            if (activeRequestId === "new") return [];
            console.log("Fetching messages for", activeRequestId);

            // 1. Fetch chat messages
            const { data: chatData, error } = await (supabase as any)
                .from("system_request_messages")
                .select("*")
                .eq("request_id", activeRequestId)
                .order("created_at", { ascending: true });

            if (error) {
                console.error("Error fetching messages:", error);
                // Fail gracefullly if table doesn't exist yet (though we created it)
                return [];
            }

            return chatData as Message[];
        },
        enabled: open && activeRequestId !== "new",
    });

    const { data: requestAttachments = [] } = useQuery({
        queryKey: ["request-attachments", activeRequestId],
        queryFn: async () => {
            if (activeRequestId === 'new') return [];
            const { data } = await supabase.from("system_request_attachments").select("*").eq("request_id", activeRequestId);
            return data || [];
        },
        enabled: open && activeRequestId !== "new"
    });

    // Scroll confirm when messages load
    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages]);


    // --- Mutations ---
    const uploadFiles = async (requestId: string) => {
        const uploads = files.map(async (file, index) => {
            const fileExt = file.name.split(".").pop();
            const filePath = `${requestId}/${Date.now()}-${index}.${fileExt}`;
            const { error: uploadError } = await supabase.storage.from("system-requests").upload(filePath, file);
            if (uploadError) throw uploadError;
            const { data: { publicUrl } } = supabase.storage.from("system-requests").getPublicUrl(filePath);
            const fileType = file.type.startsWith("image") ? "image" : file.type.startsWith("video") ? "video" : "audio";
            await (supabase as any).from("system_request_attachments").insert({ request_id: requestId, file_url: publicUrl, file_type: fileType });
        });
        await Promise.all(uploads);
    };

    const createRequest = useMutation({
        mutationFn: async () => {
            if (!profile) throw new Error("User not found");
            const { data, error } = await (supabase as any).from("system_requests")
                .insert({ user_id: profile.id, title, description, type, status: "pending", source: "manual" })
                .select().single();
            if (error) throw error;
            if (files.length > 0 && data) await uploadFiles(data.id);
            return data;
        },
        onSuccess: (data) => {
            toast.success("Solicitação enviada!");
            setTitle("");
            setDescription("");
            setFiles([]);
            setType("suggestion");
            queryClient.invalidateQueries({ queryKey: ["my-system-requests"] });
            setActiveRequestId(data.id); // Switch to the new request chat
        },
        onError: () => toast.error("Erro ao enviar solicitação."),
    });

    const sendMessageMutation = useMutation({
        mutationFn: async () => {
            if (!profile || activeRequestId === 'new' || (!newMessage.trim() && !chatAttachment)) return;

            let attachmentUrl = null;
            let attachmentType = null;

            if (chatAttachment) {
                const fileExt = chatAttachment.name.split(".").pop();
                const filePath = `${activeRequestId}/chat/${Date.now()}.${fileExt}`;
                const { error: uploadError } = await supabase.storage.from("system-requests").upload(filePath, chatAttachment);
                if (uploadError) throw uploadError;

                const { data } = supabase.storage.from("system-requests").getPublicUrl(filePath);
                attachmentUrl = data.publicUrl;
                attachmentType = chatAttachment.type;
            }

            const { error } = await (supabase as any).from("system_request_messages").insert({
                request_id: activeRequestId,
                user_id: profile.id,
                content: newMessage,
                attachment_url: attachmentUrl,
                attachment_type: attachmentType
            });
            if (error) throw error;
        },
        onSuccess: () => {
            setNewMessage("");
            setChatAttachment(null);
            refetchMessages();
            if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        },
        onError: () => toast.error("Falha ao enviar mensagem"),
    });

    const handleChatFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            if (file.size > 5 * 1024 * 1024) { toast.error("Arquivo muito grande (max 5MB)"); return; }
            setChatAttachment(file);
        }
    };

    const handleSubmitNew = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!title.trim() || !description.trim()) { toast.error("Preencha título e descrição."); return; }
        setIsSubmitting(true);
        try { await createRequest.mutateAsync(); } finally { setIsSubmitting(false); }
    };

    const handleSendMessage = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newMessage.trim()) return;
        setIsSendingMessage(true);
        try { await sendMessageMutation.mutateAsync(); } finally { setIsSendingMessage(false); }
    };

    // --- Helpers ---
    const getStatusColor = (status: string) => {
        switch (status) {
            case "pending": return "bg-yellow-500/10 text-yellow-500 border-yellow-500/20";
            case "analyzing": return "bg-blue-500/10 text-blue-500 border-blue-500/20";
            case "waiting_response": return "bg-indigo-500/10 text-indigo-500 border-indigo-500/20";
            case "done": return "bg-green-500/10 text-green-500 border-green-500/20";
            case "rejected": return "bg-red-500/10 text-red-500 border-red-500/20";
            default: return "bg-muted text-muted-foreground";
        }
    };

    const getStatusLabel = (status: string) => {
        switch (status) {
            case "pending": return "Pendente";
            case "analyzing": return "Em Análise";
            case "waiting_response": return "Aguardando Resposta";
            case "done": return "Concluído";
            case "rejected": return "Rejeitado";
            default: return status;
        }
    };

    const getIcon = (type: string) => {
        switch (type) {
            case 'suggestion': return <Lightbulb className="w-4 h-4 text-yellow-500" />;
            case 'bug': return <Bug className="w-4 h-4 text-red-500" />;
            case 'auto_bug': return <Zap className="w-4 h-4 text-orange-500" />;
            case 'doubt': return <HelpCircle className="w-4 h-4 text-blue-500" />;
            default: return <Lightbulb className="w-4 h-4" />;
        }
    };

    const activeRequestData = activeRequestId !== 'new' ? myRequests.find(r => r.id === activeRequestId) : null;
    const isClosed = activeRequestData?.status === 'done' || activeRequestData?.status === 'rejected';

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>{children}</DialogTrigger>
            <DialogContent className="max-w-[95vw] lg:max-w-5xl h-[85vh] flex flex-col p-0 gap-0 overflow-hidden sm:rounded-2xl">
                {/* Header Global */}
                <div className="p-4 px-6 border-b flex items-center gap-3 bg-muted/10">
                    <div className="bg-primary/10 p-2 rounded-lg">
                        <Lightbulb className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                        <DialogTitle className="text-lg font-bold">Central de Sugestões e Suporte</DialogTitle>
                        <p className="text-xs text-muted-foreground">Envie melhorias, reporte bugs e acompanhe seus chamados.</p>
                    </div>
                </div>

                <div className="flex flex-1 overflow-hidden">
                    {/* Sidebar: Request List */}
                    <div className="w-80 border-r flex flex-col bg-muted/5">
                        <div className="p-4 border-b">
                            <Button
                                className="w-full justify-start gap-2 shadow-sm"
                                variant={activeRequestId === 'new' ? "default" : "outline"}
                                onClick={() => setActiveRequestId("new")}
                            >
                                <Plus className="w-4 h-4" /> Nova Solicitação
                            </Button>
                        </div>
                        <ScrollArea className="flex-1">
                            <div className="p-3 space-y-2">
                                <p className="px-2 text-[10px] font-bold uppercase text-muted-foreground tracking-wider mb-2">Histórico (Meus Pedidos)</p>
                                {myRequests.length === 0 && (
                                    <div className="text-center py-8 text-muted-foreground text-xs">
                                        Nenhum pedido ainda.
                                    </div>
                                )}
                                {myRequests.map((req) => (
                                    <div
                                        key={req.id}
                                        onClick={() => setActiveRequestId(req.id)}
                                        className={cn(
                                            "p-3 rounded-lg cursor-pointer transition-all border text-left hover:bg-accent group",
                                            activeRequestId === req.id
                                                ? "bg-accent border-primary/20 shadow-sm"
                                                : "bg-background border-transparent hover:border-border"
                                        )}
                                    >
                                        <div className="flex justify-between items-start mb-1">
                                            <span className="text-xs font-medium line-clamp-1 flex-1 pr-2">{req.title}</span>
                                            <span className={cn("text-[10px] px-1.5 py-0.5 rounded-full border", getStatusColor(req.status))}>
                                                {getStatusLabel(req.status)}
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                            {getIcon(req.type)}
                                            <span className="text-[10px]">
                                                {format(new Date(req.created_at), "dd/MM", { locale: ptBR })}
                                            </span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </ScrollArea>
                    </div>

                    {/* Main Content Area */}
                    <div className="flex-1 flex flex-col bg-background relative overflow-hidden">
                        {activeRequestId === "new" ? (
                            // --- AI TICKET CHAT ---
                            <AITicketChat
                                onTicketCreated={(id) => {
                                    queryClient.invalidateQueries({ queryKey: ["my-system-requests"] });
                                    setActiveRequestId(id);
                                }}
                            />
                        ) : activeRequestData ? (
                            // --- CHAT INTERFACE ---
                            <div className="flex flex-col h-full">
                                {/* Chat Header */}
                                <div className="p-4 border-b bg-muted/5 flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className={cn("p-2 rounded-lg bg-muted text-muted-foreground")}>
                                            {getIcon(activeRequestData.type)}
                                        </div>
                                        <div>
                                            <h3 className="font-bold text-base leading-none mb-1">{activeRequestData.title}</h3>
                                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                                <span>Protocolo #{activeRequestData.id.slice(0, 8)}</span>
                                                <span>•</span>
                                                <span>{format(new Date(activeRequestData.created_at), "PPP 'às' HH:mm", { locale: ptBR })}</span>
                                            </div>
                                        </div>
                                    </div>
                                    <Badge variant="outline" className={cn("px-3 py-1", getStatusColor(activeRequestData.status))}>
                                        {getStatusLabel(activeRequestData.status)}
                                    </Badge>
                                </div>

                                {/* Chat Messages */}
                                <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-slate-50/50 dark:bg-black/20" ref={scrollRef}>
                                    {/* Original Request Detailed Card */}
                                    <div className="w-full bg-yellow-50/50 dark:bg-yellow-900/10 border border-yellow-200/60 dark:border-yellow-700/30 rounded-xl p-6 mb-8 shadow-sm">
                                        <div className="flex items-start gap-4 mb-4">
                                            <div className="bg-yellow-100 dark:bg-yellow-900/40 p-2.5 rounded-xl text-yellow-600 dark:text-yellow-400 shrink-0">
                                                <StickyNote className="w-5 h-5" />
                                            </div>
                                            <div className="space-y-1">
                                                <h4 className="font-bold text-base text-yellow-950 dark:text-yellow-100">Descrição da Solicitação</h4>
                                                <p className="text-xs text-yellow-700 dark:text-yellow-400">
                                                    Registrado por <strong>{profile?.full_name?.split(' ')[0]}</strong> em {format(new Date(activeRequestData.created_at), "dd 'de' MMMM, yyyy 'às' HH:mm", { locale: ptBR })}
                                                </p>
                                            </div>
                                        </div>

                                        <div className="pl-[52px]">
                                            <p className="text-sm text-yellow-900/90 dark:text-yellow-200/90 leading-relaxed whitespace-pre-wrap font-medium">
                                                {activeRequestData.description}
                                            </p>

                                            {/* Legacy Notes */}
                                            {activeRequestData.admin_notes && (
                                                <div className="mt-6 p-4 bg-yellow-100/50 dark:bg-yellow-900/20 rounded-lg border border-yellow-200 dark:border-yellow-700/20">
                                                    <p className="text-xs font-bold text-yellow-800 dark:text-yellow-300 mb-1">Nota do Administrador:</p>
                                                    <p className="text-sm text-yellow-900 dark:text-yellow-200">{activeRequestData.admin_notes}</p>
                                                </div>
                                            )}

                                            {/* Attachments Grid */}
                                            {requestAttachments.length > 0 && (
                                                <div className="mt-6 pt-4 border-t border-yellow-200/50 dark:border-yellow-700/30">
                                                    <p className="text-[10px] font-black uppercase tracking-widest text-yellow-600 dark:text-yellow-500 mb-3">
                                                        Anexos ({requestAttachments.length})
                                                    </p>
                                                    <div className="flex flex-wrap gap-3">
                                                        {requestAttachments.map((att: any) => (
                                                            <a href={att.file_url} target="_blank" rel="noreferrer" key={att.id} className="relative group overflow-hidden rounded-xl border border-yellow-200/60 shadow-sm w-24 h-24 bg-background flex items-center justify-center hover:scale-105 transition-all hover:shadow-md hover:ring-2 hover:ring-yellow-500/20">
                                                                {att.file_type === 'image' ? (
                                                                    <img src={att.file_url} className="w-full h-full object-cover" alt="attachment" />
                                                                ) : (
                                                                    <Paperclip className="w-8 h-8 text-yellow-500/50 group-hover:text-yellow-600" />
                                                                )}
                                                            </a>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* Messages Loop */}
                                    {messages.map((msg) => {
                                        const isMe = msg.user_id === profile?.id; // Assuming user_id matches profile
                                        return (
                                            <div key={msg.id} className={cn("flex gap-3 w-full", isMe ? "justify-end" : "justify-start")}>
                                                {!isMe && (
                                                    <div className="w-8 h-8 rounded-full bg-blue-500/10 flex items-center justify-center shrink-0 border border-blue-500/20">
                                                        <span className="text-[10px] font-bold text-blue-500">SUP</span>
                                                    </div>
                                                )}
                                                <div className={cn("max-w-[75%]", isMe ? "items-end" : "items-start")}>
                                                    <div className={cn(
                                                        "p-3 rounded-2xl shadow-sm text-sm whitespace-pre-wrap",
                                                        isMe
                                                            ? "bg-primary text-primary-foreground rounded-tr-none"
                                                            : "bg-background border rounded-tl-none"
                                                    )}>
                                                        {msg.attachment_url && (
                                                            <div className="mb-2">
                                                                {msg.attachment_type?.startsWith('image') ? (
                                                                    <a href={msg.attachment_url} target="_blank" rel="noreferrer">
                                                                        <img src={msg.attachment_url} className="rounded-lg max-w-[200px] border border-black/10 cursor-pointer hover:opacity-90" alt="anexo" />
                                                                    </a>
                                                                ) : (
                                                                    <a href={msg.attachment_url} target="_blank" className="flex items-center gap-2 text-xs underline bg-background/20 p-2 rounded hover:bg-background/30"><Paperclip className="w-3 h-3" /> Abrir Anexo</a>
                                                                )}
                                                            </div>
                                                        )}
                                                        {msg.content}
                                                    </div>
                                                    <p className={cn("text-[10px] text-muted-foreground mt-1 px-1", isMe ? "text-right" : "text-left")}>
                                                        {format(new Date(msg.created_at), "HH:mm")}
                                                    </p>
                                                </div>
                                                {isMe && (
                                                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0 border border-primary/20">
                                                        <span className="text-[10px] font-bold text-primary">EU</span>
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}

                                    {isClosed && (
                                        <div className="flex justify-center py-4">
                                            <Badge variant="secondary" className="px-4 py-1.5 flex gap-2">
                                                Isso é tudo! Este chamado foi encerrado em {format(new Date(activeRequestData.updated_at || Date.now()), "dd/MM/yyyy")}.
                                            </Badge>
                                        </div>
                                    )}
                                </div>

                                {/* Chat Input */}
                                <div className="p-4 border-t bg-background space-y-3">
                                    {chatAttachment && (
                                        <div className="flex items-start">
                                            <div className="relative group">
                                                <div className="w-12 h-12 rounded-lg overflow-hidden border bg-muted flex items-center justify-center">
                                                    {chatAttachment.type.startsWith('image') ? (
                                                        <img src={URL.createObjectURL(chatAttachment)} className="w-full h-full object-cover" />
                                                    ) : <Paperclip className="w-4 h-4 text-muted-foreground" />}
                                                </div>
                                                <button
                                                    onClick={() => setChatAttachment(null)}
                                                    className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-0.5 hover:bg-red-600 shadow-sm"
                                                >
                                                    <X className="w-3 h-3" />
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                    <form onSubmit={handleSendMessage} className="relative flex items-end gap-2">
                                        <input
                                            type="file"
                                            ref={chatFileRef}
                                            className="hidden"
                                            onChange={handleChatFileSelect}
                                            accept="image/*,video/*,application/pdf"
                                        />

                                        <Button
                                            type="button"
                                            size="icon"
                                            variant="ghost"
                                            className="h-10 w-8 shrink-0 text-muted-foreground hover:bg-muted mb-1"
                                            onClick={() => chatFileRef.current?.click()}
                                            disabled={isClosed}
                                        >
                                            <Paperclip className="w-4 h-4" />
                                        </Button>

                                        <Textarea
                                            value={newMessage}
                                            onChange={(e) => setNewMessage(e.target.value)}
                                            placeholder={isClosed ? "Este chamado está encerrado." : "Digite sua mensagem..."}
                                            className="min-h-[50px] max-h-[150px] resize-none pr-24 py-3 rounded-xl bg-muted/30 border-muted-foreground/20 focus-visible:ring-primary/20"
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter' && !e.shiftKey) {
                                                    e.preventDefault();
                                                    handleSendMessage(e);
                                                }
                                            }}
                                            disabled={isClosed}
                                        />
                                        <Button
                                            type="button"
                                            size="icon"
                                            variant="ghost"
                                            className={cn("absolute right-12 bottom-2 h-8 w-8 rounded-lg", isChatRecording && "text-red-500 animate-pulse")}
                                            onClick={toggleChatRecording}
                                            disabled={isClosed}
                                        >
                                            <Mic className="w-4 h-4" />
                                        </Button>
                                        <Button
                                            type="submit"
                                            size="icon"
                                            className="absolute right-2 bottom-2 h-8 w-8 rounded-lg"
                                            disabled={(!newMessage.trim() && !chatAttachment) || isSendingMessage || isClosed}
                                        >
                                            {isSendingMessage ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                                        </Button>
                                    </form>
                                </div>
                            </div>
                        ) : (
                            // Should not block typically, but fallback
                            <div className="flex-1 flex items-center justify-center text-muted-foreground">
                                <Loader2 className="w-8 h-8 animate-spin" />
                            </div>
                        )}
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
