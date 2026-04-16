import React, { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
    Send,
    Loader2,
    Paperclip,
    X,
    CheckCircle2,
    Pencil,
    Bot,
    User,
    Sparkles,
    Bug,
    Lightbulb,
    HelpCircle,
    RefreshCw,
    Mic,
    Square,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useProfile } from "@/hooks/use-profile";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { useAIChat, AITicketData } from "@/hooks/use-ai-chat";
import { useAudioRecorder } from "@/hooks/use-audio-recorder";
import { RequestType } from "@/types/feedback";

interface AITicketChatProps {
    onTicketCreated: (requestId: string) => void;
}

export function AITicketChat({ onTicketCreated }: AITicketChatProps) {
    const { data: profile } = useProfile();
    const { currentWorkspace } = useWorkspace();
    const scrollRef = useRef<HTMLDivElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const [inputText, setInputText] = useState("");
    const [attachment, setAttachment] = useState<File | null>(null);
    const [isCreating, setIsCreating] = useState(false);
    const [editingTicket, setEditingTicket] = useState<AITicketData | null>(null);

    const {
        messages,
        isLoading,
        ticketData,
        isResolved,
        resolvedMessage,
        sendMessage,
        reset,
        clearTicketData,
    } = useAIChat({
        userContext: {
            page_url: window.location.pathname,
            user_name: profile?.full_name || "",
            workspace_name: currentWorkspace?.name || "",
        },
    });

    const { isRecording, toggleRecording } = useAudioRecorder((text) => {
        setInputText((prev) => (prev ? `${prev} ${text}` : text));
    });

    const [showRecoveryPrompt, setShowRecoveryPrompt] = useState(() => {
        try {
            const saved = localStorage.getItem("@gpm/ai_chat_state_v1");
            if (saved) {
                const parsed = JSON.parse(saved);
                return (parsed.messages && parsed.messages.length > 0);
            }
        } catch (e) {}
        return false;
    });

    // Auto-scroll
    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages, isLoading, ticketData, showRecoveryPrompt]);

    // When ticketData arrives, prep for editing
    useEffect(() => {
        if (ticketData) {
            setEditingTicket({ ...ticketData });
        }
    }, [ticketData]);

    const handleSend = async (e?: React.FormEvent) => {
        e?.preventDefault();
        if (!inputText.trim() && !attachment) return;

        let attachmentUrl: string | undefined;

        // Upload attachment if present
        if (attachment) {
            const fileExt = attachment.name.split(".").pop();
            const filePath = `ai-chat/${Date.now()}.${fileExt}`;
            const { error: uploadError } = await supabase.storage
                .from("system-requests")
                .upload(filePath, attachment);
            if (uploadError) {
                toast.error("Erro ao enviar imagem");
                return;
            }
            const { data } = supabase.storage.from("system-requests").getPublicUrl(filePath);
            attachmentUrl = data.publicUrl;
            setAttachment(null);
        }

        const text = inputText;
        setInputText("");
        await sendMessage(text, attachmentUrl);
    };

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            if (!file.type.startsWith("image/") && !file.type.startsWith("audio/")) {
                toast.error("Apenas imagens e áudios são suportados");
                return;
            }
            if (file.size > 10 * 1024 * 1024) { // Increased to 10MB for audio
                toast.error("Arquivo muito grande (max 10MB)");
                return;
            }
            setAttachment(file);
        }
    };

    const handleConfirmTicket = async () => {
        if (!editingTicket || !profile) return;
        setIsCreating(true);

        try {
            const { data: requestRecord, error } = await (supabase as any)
                .from("system_requests")
                .insert({
                    user_id: profile.id,
                    type: editingTicket.type as RequestType,
                    title: editingTicket.title,
                    description: editingTicket.description,
                    status: "pending",
                    source: "manual",
                    workspace_id: currentWorkspace?.id || null,
                })
                .select()
                .single();

            if (error) throw error;

            // Extract all attachments from the conversation and attach to the created request
            const attachments = messages
                .filter(m => m.attachment_url)
                .map(m => m.attachment_url as string);

            // Deduplicate attachments
            const uniqueAttachments = Array.from(new Set(attachments));

            for (const fileUrl of uniqueAttachments) {
                const fileType = fileUrl.includes(".mp3") || fileUrl.includes(".m4a") || fileUrl.includes(".wav") || fileUrl.includes(".ogg") || fileUrl.includes("audio") ? "audio" : "image";
                await (supabase as any).from("system_request_attachments").insert({
                    request_id: requestRecord.id,
                    file_url: fileUrl,
                    file_type: fileType,
                });
            }

            toast.success("Chamado criado com sucesso!");
            onTicketCreated(requestRecord.id);
            reset();
        } catch (err) {
            toast.error("Erro ao criar chamado");
        } finally {
            setIsCreating(false);
        }
    };

    const handleForceTicket = async () => {
        // User wants ticket even though AI resolved as help
        clearTicketData();
        await sendMessage("Não, preciso abrir um chamado mesmo assim. Por favor, crie o chamado com as informações que já passei.");
    };

    const getTypeIcon = (type: string) => {
        switch (type) {
            case "bug": return <Bug className="w-4 h-4 text-red-500" />;
            case "suggestion": return <Lightbulb className="w-4 h-4 text-yellow-500" />;
            case "doubt": return <HelpCircle className="w-4 h-4 text-blue-500" />;
            default: return <Sparkles className="w-4 h-4" />;
        }
    };

    const getTypeLabel = (type: string) => {
        switch (type) {
            case "bug": return "Bug";
            case "suggestion": return "Sugestão";
            case "doubt": return "Dúvida";
            default: return type;
        }
    };

    if (showRecoveryPrompt) {
        return (
            <div className="flex flex-col h-full bg-slate-50/50 dark:bg-black/20">
                <div className="p-5 pb-4 border-b bg-gradient-to-r from-violet-500/5 to-blue-500/5">
                    <div className="flex items-center gap-3">
                        <div className="bg-gradient-to-br from-violet-500 to-blue-500 p-2.5 rounded-xl text-white shadow-lg shadow-violet-500/20">
                            <Sparkles className="w-5 h-5" />
                        </div>
                        <div>
                            <h2 className="text-lg font-bold tracking-tight">Assistente GPM</h2>
                            <p className="text-xs text-muted-foreground">
                                Você tem um atendimento pendente
                            </p>
                        </div>
                    </div>
                </div>
                
                <div className="flex-1 flex flex-col items-center justify-center p-6 text-center space-y-6">
                    <div className="w-20 h-20 rounded-full bg-gradient-to-br from-violet-500/10 to-blue-500/10 flex items-center justify-center shadow-inner border border-violet-500/20">
                       <RefreshCw className="w-8 h-8 text-violet-500" />
                    </div>
                    
                    <div className="space-y-2">
                        <h3 className="text-xl font-bold">Rascunho Encontrado</h3>
                        <p className="text-sm text-muted-foreground w-4/5 mx-auto leading-relaxed">
                            Você possui um atendimento em andamento que não foi concluído.
                        </p>
                    </div>
                    
                    <div className="flex flex-col w-full px-4 gap-3">
                        <Button 
                            onClick={() => setShowRecoveryPrompt(false)} 
                            className="bg-violet-600 hover:bg-violet-700 text-white w-full h-11 shadow-md"
                        >
                            Continuar de onde parei
                        </Button>
                        <Button 
                            variant="outline" 
                            onClick={() => { reset(); setShowRecoveryPrompt(false); setEditingTicket(null); clearTicketData(); }}
                            className="w-full text-zinc-600 bg-white dark:bg-black/20"
                        >
                            Começar do Zero
                        </Button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full">
            {/* Header */}
            <div className="p-5 pb-4 border-b bg-gradient-to-r from-violet-500/5 to-blue-500/5">
                <div className="flex items-center gap-3">
                    <div className="bg-gradient-to-br from-violet-500 to-blue-500 p-2.5 rounded-xl text-white shadow-lg shadow-violet-500/20">
                        <Sparkles className="w-5 h-5" />
                    </div>
                    <div>
                        <h2 className="text-lg font-bold tracking-tight">Assistente GPM</h2>
                        <p className="text-xs text-muted-foreground">
                            Descreva seu problema ou sugestão e eu vou te ajudar
                        </p>
                    </div>
                </div>
            </div>

            {/* Messages Area */}
            <div
                className="flex-1 overflow-y-auto p-5 space-y-4 bg-slate-50/50 dark:bg-black/20"
                ref={scrollRef}
            >
                {/* Welcome message */}
                {messages.length === 0 && !isLoading && (
                    <div className="flex gap-3">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-violet-500 to-blue-500 flex items-center justify-center shrink-0 shadow-md">
                            <Bot className="w-4 h-4 text-white" />
                        </div>
                        <div className="max-w-[80%]">
                            <div className="p-3.5 rounded-2xl rounded-tl-none bg-background border shadow-sm text-sm">
                                Olá! 👋 Sou o assistente do GPM Nexus. Me conta o que está
                                acontecendo que eu vou te ajudar! Pode ser um bug, uma sugestão
                                de melhoria, ou até uma dúvida sobre como usar o sistema.
                            </div>
                        </div>
                    </div>
                )}

                {/* Chat messages */}
                {messages.map((msg, i) => {
                    const isUser = msg.role === "user";
                    return (
                        <div
                            key={i}
                            className={cn("flex gap-3", isUser ? "justify-end" : "justify-start")}
                        >
                            {!isUser && (
                                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-violet-500 to-blue-500 flex items-center justify-center shrink-0 shadow-md">
                                    <Bot className="w-4 h-4 text-white" />
                                </div>
                            )}
                            <div className={cn("max-w-[80%]", isUser ? "items-end" : "items-start")}>
                                <div
                                    className={cn(
                                        "p-3.5 rounded-2xl shadow-sm text-sm whitespace-pre-wrap leading-relaxed",
                                        isUser
                                            ? "bg-primary text-primary-foreground rounded-tr-none"
                                            : "bg-background border rounded-tl-none"
                                    )}
                                >
                                    {msg.attachment_url && (
                                        <div className="mb-2">
                                            {msg.attachment_url.includes(".mp3") || msg.attachment_url.includes(".wav") || msg.attachment_url.includes(".m4a") || msg.attachment_url.includes(".ogg") || msg.attachment_url.includes(".webm") ? (
                                                <audio controls className="max-w-[200px] h-10 rounded">
                                                    <source src={msg.attachment_url} />
                                                </audio>
                                            ) : (
                                                <a href={msg.attachment_url} target="_blank" rel="noreferrer">
                                                    <img
                                                        src={msg.attachment_url}
                                                        className="rounded-lg max-w-[200px] border border-black/10 cursor-pointer hover:opacity-90"
                                                        alt="anexo"
                                                    />
                                                </a>
                                            )}
                                        </div>
                                    )}
                                    {msg.content}
                                </div>
                            </div>
                            {isUser && (
                                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0 border border-primary/20">
                                    <User className="w-4 h-4 text-primary" />
                                </div>
                            )}
                        </div>
                    );
                })}

                {/* Typing indicator */}
                {isLoading && (
                    <div className="flex gap-3">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-violet-500 to-blue-500 flex items-center justify-center shrink-0 shadow-md">
                            <Bot className="w-4 h-4 text-white" />
                        </div>
                        <div className="p-3.5 rounded-2xl rounded-tl-none bg-background border shadow-sm">
                            <div className="flex gap-1.5 items-center">
                                <div className="w-2 h-2 rounded-full bg-violet-400 animate-bounce [animation-delay:0ms]" />
                                <div className="w-2 h-2 rounded-full bg-violet-400 animate-bounce [animation-delay:150ms]" />
                                <div className="w-2 h-2 rounded-full bg-violet-400 animate-bounce [animation-delay:300ms]" />
                            </div>
                        </div>
                    </div>
                )}

                {/* Ticket confirmation card */}
                {editingTicket && ticketData && (
                    <div className="w-full bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-950/20 dark:to-emerald-950/20 border border-green-200 dark:border-green-800/30 rounded-2xl p-5 shadow-md mt-4">
                        <div className="flex items-center gap-2 mb-4">
                            <CheckCircle2 className="w-5 h-5 text-green-500" />
                            <h3 className="font-bold text-green-900 dark:text-green-100">
                                Chamado pronto para envio
                            </h3>
                        </div>

                        <div className="space-y-3 mb-5">
                            <div className="flex items-center gap-2">
                                <Badge
                                    variant="outline"
                                    className={cn(
                                        "gap-1.5 px-2.5 py-1",
                                        editingTicket.type === "bug" && "border-red-200 bg-red-50 text-red-600 dark:border-red-800 dark:bg-red-950/30 dark:text-red-400",
                                        editingTicket.type === "suggestion" && "border-yellow-200 bg-yellow-50 text-yellow-600 dark:border-yellow-800 dark:bg-yellow-950/30 dark:text-yellow-400",
                                        editingTicket.type === "doubt" && "border-blue-200 bg-blue-50 text-blue-600 dark:border-blue-800 dark:bg-blue-950/30 dark:text-blue-400"
                                    )}
                                >
                                    {getTypeIcon(editingTicket.type)}
                                    {getTypeLabel(editingTicket.type)}
                                </Badge>
                            </div>

                            <div className="space-y-2">
                                <label className="text-[10px] font-bold uppercase tracking-widest text-green-600 dark:text-green-400">
                                    Título
                                </label>
                                <input
                                    type="text"
                                    value={editingTicket.title}
                                    onChange={(e) =>
                                        setEditingTicket({ ...editingTicket, title: e.target.value })
                                    }
                                    className="w-full p-2.5 rounded-lg border bg-white dark:bg-black/20 text-sm font-medium focus:ring-2 focus:ring-green-500/20 outline-none"
                                />
                            </div>

                            <div className="space-y-2">
                                <label className="text-[10px] font-bold uppercase tracking-widest text-green-600 dark:text-green-400">
                                    Descrição
                                </label>
                                <textarea
                                    value={editingTicket.description}
                                    onChange={(e) =>
                                        setEditingTicket({
                                            ...editingTicket,
                                            description: e.target.value,
                                        })
                                    }
                                    rows={5}
                                    className="w-full p-2.5 rounded-lg border bg-white dark:bg-black/20 text-sm resize-none leading-relaxed focus:ring-2 focus:ring-green-500/20 outline-none"
                                />
                            </div>
                        </div>

                        <div className="flex flex-col gap-2.5 mt-2">
                            <Button
                                onClick={handleConfirmTicket}
                                disabled={isCreating}
                                className="w-full bg-green-600 hover:bg-green-700 text-white shadow-md font-semibold h-11"
                            >
                                {isCreating ? (
                                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                                ) : (
                                    <CheckCircle2 className="w-5 h-5 mr-2" />
                                )}
                                Confirmar e Enviar Chamado
                            </Button>
                            
                            <div className="flex gap-2">
                                <Button
                                    variant="outline"
                                    onClick={async () => {
                                        clearTicketData();
                                        setEditingTicket(null);
                                        await sendMessage("Esqueci de uma coisa, preciso adicionar mais detalhes antes de enviarmos.");
                                    }}
                                    disabled={isCreating}
                                    className="flex-1 bg-white dark:bg-black/20"
                                >
                                    <Pencil className="w-4 h-4 mr-2" />
                                    Acrescentar Dados
                                </Button>
                                <Button
                                    variant="outline"
                                    onClick={() => {
                                        reset();
                                        setEditingTicket(null);
                                    }}
                                    disabled={isCreating}
                                    className="flex-1 text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/30 bg-white dark:bg-black/20 border-red-200 dark:border-red-900/50"
                                >
                                    <RefreshCw className="w-4 h-4 mr-2" />
                                    Descartar Rascunho
                                </Button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Resolved as help */}
                {isResolved && (
                    <div className="w-full bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/20 dark:to-indigo-950/20 border border-blue-200 dark:border-blue-800/30 rounded-2xl p-5 shadow-md mt-4">
                        <div className="flex items-center gap-2 mb-3">
                            <CheckCircle2 className="w-5 h-5 text-blue-500" />
                            <h3 className="font-bold text-blue-900 dark:text-blue-100">
                                Dúvida respondida!
                            </h3>
                        </div>
                        <div className="flex gap-2 mt-4">
                            <Button
                                variant="outline"
                                className="flex-1"
                                onClick={() => reset()}
                            >
                                <CheckCircle2 className="w-4 h-4 mr-2 text-green-500" />
                                Resolvido!
                            </Button>
                            <Button
                                variant="outline"
                                className="flex-1"
                                onClick={handleForceTicket}
                            >
                                <Pencil className="w-4 h-4 mr-2" />
                                Abrir chamado mesmo assim
                            </Button>
                        </div>
                    </div>
                )}
            </div>

            {/* Input Area */}
            {!ticketData && !isResolved && (
                <div className="p-4 border-t bg-background space-y-3">
                    {attachment && (
                        <div className="flex items-start">
                            <div className="relative group">
                                <div className="w-14 h-14 rounded-lg overflow-hidden border bg-muted flex items-center justify-center p-1">
                                    {attachment.type.startsWith("audio/") ? (
                                        <div className="text-xs text-center font-medium text-muted-foreground flex flex-col items-center">
                                            <Mic className="w-4 h-4 mb-1" />
                                            Áudio
                                        </div>
                                    ) : (
                                        <img
                                            src={URL.createObjectURL(attachment)}
                                            className="w-full h-full object-cover"
                                            alt="preview"
                                        />
                                    )}
                                </div>
                                <button
                                    onClick={() => setAttachment(null)}
                                    className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-0.5 hover:bg-red-600 shadow-sm"
                                >
                                    <X className="w-3 h-3" />
                                </button>
                            </div>
                        </div>
                    )}
                    <form onSubmit={handleSend} className="relative flex items-end gap-2">
                        <input
                            type="file"
                            ref={fileInputRef}
                            className="hidden"
                            onChange={handleFileSelect}
                            accept="image/*, audio/*"
                        />
                        <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            className="h-10 w-8 shrink-0 text-muted-foreground hover:bg-muted mb-1"
                            onClick={() => fileInputRef.current?.click()}
                            disabled={isLoading}
                        >
                            <Paperclip className="w-4 h-4" />
                        </Button>

                        <Textarea
                            value={inputText}
                            onChange={(e) => setInputText(e.target.value)}
                            placeholder="Descreva seu problema, sugestão ou dúvida..."
                            className="min-h-[50px] max-h-[150px] resize-none pr-24 py-3 rounded-xl bg-muted/30 border-muted-foreground/20 focus-visible:ring-violet-500/20"
                            onKeyDown={(e) => {
                                if (e.key === "Enter" && !e.shiftKey) {
                                    e.preventDefault();
                                    handleSend();
                                }
                            }}
                            onPaste={(e) => {
                                const items = e.clipboardData?.items;
                                if (!items) return;
                                
                                for (let i = 0; i < items.length; i++) {
                                    const item = items[i];
                                    if (item.type.startsWith("image/")) {
                                        e.preventDefault(); // Prevent default paste (like text representation of image)
                                        const file = item.getAsFile();
                                        if (file) {
                                            if (file.size > 10 * 1024 * 1024) {
                                                toast.error("Imagem muito grande (max 10MB)");
                                                return;
                                            }
                                            setAttachment(file);
                                            toast.success("Imagem colada com sucesso!");
                                        }
                                        break; // Only process the first image found
                                    }
                                }
                            }}
                            disabled={isLoading}
                        />
                        <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            className={cn(
                                "absolute right-12 bottom-2 h-8 w-8 rounded-lg",
                                isRecording && "text-red-500 animate-pulse"
                            )}
                            onClick={toggleRecording}
                            disabled={isLoading}
                        >
                            {isRecording ? <Square className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                        </Button>
                        <Button
                            type="submit"
                            size="icon"
                            className="absolute right-2 bottom-2 h-8 w-8 rounded-lg bg-gradient-to-r from-violet-500 to-blue-500 hover:from-violet-600 hover:to-blue-600"
                            disabled={(!inputText.trim() && !attachment) || isLoading}
                        >
                            {isLoading ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                                <Send className="w-4 h-4" />
                            )}
                        </Button>
                    </form>
                </div>
            )}
        </div>
    );
}
