import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { SystemRequest, RequestStatus, RequestType, SystemRequestAttachment } from "@/types/feedback";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Lightbulb, Bug, HelpCircle, Eye, Check, ShieldCheck, Paperclip, Loader2, Trash2, User, Send, MessageSquare, X, Zap, Bot, UserCircle, Code } from "lucide-react";
import { toast } from "sonner";
import { Label } from "@/components/ui/label";

export default function AdminRequests() {
    const [filterStatus, setFilterStatus] = useState<RequestStatus | "all">("all");
    const [filterType, setFilterType] = useState<string>("all");
    const [filterSource, setFilterSource] = useState<string>("all");
    const [filterUser, setFilterUser] = useState<string>("all");
    const [searchQuery, setSearchQuery] = useState("");
    const [dateFrom, setDateFrom] = useState("");
    const [dateTo, setDateTo] = useState("");

    const [selectedRequest, setSelectedRequest] = useState<(SystemRequest & { profiles?: { full_name: string, email: string } }) | null>(null);
    const [adminNote, setAdminNote] = useState("");
    const [newStatus, setNewStatus] = useState<RequestStatus>("pending");
    const [editTitle, setEditTitle] = useState("");
    const [editDescription, setEditDescription] = useState("");

    // Chat State
    const [newMessage, setNewMessage] = useState("");
    const [chatAttachment, setChatAttachment] = useState<File | null>(null);
    const chatFileRef = useRef<HTMLInputElement>(null);
    const chatScrollRef = useRef<HTMLDivElement>(null);

    const { data: sessionData } = useQuery({
        queryKey: ['session'],
        queryFn: async () => {
            const { data } = await supabase.auth.getSession();
            return data;
        }
    });
    const currentUserId = sessionData?.session?.user.id;

    const { data: chatMessages = [] } = useQuery({
        queryKey: ["admin-chat", selectedRequest?.id],
        queryFn: async () => {
            if (!selectedRequest) return [];
            const { data } = await supabase.from("system_request_messages").select("*").eq("request_id", selectedRequest.id).order("created_at", { ascending: true });
            return data || [];
        },
        enabled: !!selectedRequest,
        refetchInterval: 3000
    });

    const sendMessageMutation = useMutation({
        mutationFn: async () => {
            if (!currentUserId || (!newMessage.trim() && !chatAttachment)) return;

            let attachmentUrl = null;
            let attachmentType = null;

            if (chatAttachment) {
                const fileExt = chatAttachment.name.split(".").pop();
                const filePath = `${selectedRequest?.id}/chat/admin_${Date.now()}.${fileExt}`;
                const { error: uploadError } = await supabase.storage.from("system-requests").upload(filePath, chatAttachment);
                if (uploadError) throw uploadError;

                const { data } = supabase.storage.from("system-requests").getPublicUrl(filePath);
                attachmentUrl = data.publicUrl;
                attachmentType = chatAttachment.type;
            }

            const { error } = await supabase.from("system_request_messages").insert({
                request_id: selectedRequest?.id,
                user_id: currentUserId,
                content: newMessage,
                attachment_url: attachmentUrl,
                attachment_type: attachmentType
            });
            if (error) throw error;
        },
        onSuccess: () => {
            setNewMessage("");
            setChatAttachment(null);
            queryClient.invalidateQueries({ queryKey: ["admin-chat"] });
        },
        onError: () => toast.error("Erro ao enviar mensagem")
    });

    const handleChatFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            if (file.size > 5 * 1024 * 1024) { toast.error("Arquivo muito grande (max 5MB)"); return; }
            setChatAttachment(file);
        }
    };

    useEffect(() => {
        if (chatScrollRef.current) {
            chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
        }
    }, [chatMessages, selectedRequest]);

    const queryClient = useQueryClient();

    const { data: attachments } = useQuery({
        queryKey: ["request-attachments", selectedRequest?.id],
        queryFn: async () => {
            if (!selectedRequest) return [];
            const { data, error } = await supabase
                .from("system_request_attachments")
                .select("*")
                .eq("request_id", selectedRequest.id);

            if (error) throw error;
            return data as SystemRequestAttachment[];
        },
        enabled: !!selectedRequest,
    });

    const { data: requests, isLoading } = useQuery({
        queryKey: ["admin-system-requests"],
        queryFn: async () => {
            const { data, error } = await supabase
                .from("system_requests")
                .select(`
          *,
          profiles:user_id (full_name, email)
        `)
                .order("created_at", { ascending: false });

            if (error) throw error;
            return data as (SystemRequest & { profiles?: { full_name: string, email: string } })[];
        },
    });

    const updateRequest = useMutation({
        mutationFn: async ({ id, status, notes, title, description }: { id: string, status: RequestStatus, notes: string, title: string, description: string }) => {
            const { error } = await supabase
                .from("system_requests")
                .update({ status, admin_notes: notes, title, description })
                .eq("id", id);
            if (error) throw error;
        },
        onSuccess: () => {
            toast.success("Solicitação atualizada!");
            queryClient.invalidateQueries({ queryKey: ["admin-system-requests"] });
            setSelectedRequest(null);
        },
        onError: () => toast.error("Erro ao atualizar."),
    });

    const deleteRequest = useMutation({
        mutationFn: async (id: string) => {
            // 1. List files in storage folder for this request
            const { data: storageFiles, error: listError } = await supabase.storage
                .from("system-requests")
                .list(id);

            if (!listError && storageFiles && storageFiles.length > 0) {
                // 2. Delete all files in that folder
                const filesToDelete = storageFiles.map(file => `${id}/${file.name}`);
                await supabase.storage
                    .from("system-requests")
                    .remove(filesToDelete);
            }

            // 3. Delete from DB (cascades to attachments table)
            const { error } = await supabase
                .from("system_requests")
                .delete()
                .eq("id", id);
            if (error) throw error;
        },
        onSuccess: async () => {
            toast.success("Solicitação e arquivos excluídos com sucesso.");
            // Garante que a query seja invalidada e recarregada imediatamente
            await queryClient.refetchQueries({ queryKey: ["admin-system-requests"] });
        },
        onError: (error: any) => {
            toast.error("Erro ao excluir: " + error.message);
        }
    });

    const filteredRequests = requests?.filter(r => {
        const matchStatus = filterStatus === "all" || r.status === filterStatus;
        const matchType = filterType === "all" || r.type === filterType;
        const matchUser = filterUser === "all" || r.user_id === filterUser;
        const matchSource = filterSource === "all" || (r as any).source === filterSource;
        const matchSearch = searchQuery === "" ||
            (r.title && r.title.toLowerCase().includes(searchQuery.toLowerCase())) ||
            (r.description && r.description.toLowerCase().includes(searchQuery.toLowerCase())) ||
            (r.id && r.id.toLowerCase().includes(searchQuery.toLowerCase()));

        let matchDate = true;
        if (dateFrom) {
            const fromDate = new Date(dateFrom + "T00:00:00");
            matchDate = matchDate && new Date(r.created_at) >= fromDate;
        }
        if (dateTo) {
            const toDate = new Date(dateTo + "T23:59:59");
            matchDate = matchDate && new Date(r.created_at) <= toDate;
        }

        return matchStatus && matchType && matchUser && matchSearch && matchDate && matchSource;
    });

    const uniqueUsers = Array.from(
        new Map(
            requests?.filter(r => r.profiles).map(r => [r.user_id, r.profiles?.full_name])
        ).entries()
    );

    const handleDelete = (id: string) => {
        if (window.confirm("Tem certeza que deseja excluir esta solicitação permanentemente? Esta ação não pode ser desfeita.")) {
            deleteRequest.mutate(id);
        }
    };

    const handleOpenDetails = (req: SystemRequest & { profiles?: { full_name: string, email: string } }) => {
        setSelectedRequest(req);
        setAdminNote(req.admin_notes || "");
        setNewStatus(req.status);
        setEditTitle(req.title);
        setEditDescription(req.description);
    };

    const handleSave = () => {
        if (!selectedRequest) return;
        updateRequest.mutate({ id: selectedRequest.id, status: newStatus, notes: adminNote, title: editTitle, description: editDescription });
    };

    const getStatusLabel = (status: string) => {
        switch (status) {
            case "pending": return "Pendente";
            case "analyzing": return "Em Análise";
            case "approved": return "Aprovado p/ Dev";
            case "developed": return "Desenvolvido";
            case "waiting_response": return "Aguardando Resposta";
            case "done": return "Concluído";
            case "rejected": return "Rejeitado";
            default: return status;
        }
    };
    const getStatusColor = (status: string) => {
        switch (status) {
            case "pending": return "bg-yellow-500/10 text-yellow-500 border-yellow-500/20";
            case "analyzing": return "bg-blue-500/10 text-blue-500 border-blue-500/20";
            case "approved": return "bg-emerald-500/10 text-emerald-500 border-emerald-500/20";
            case "developed": return "bg-teal-500/10 text-teal-500 border-teal-500/20";
            case "waiting_response": return "bg-indigo-500/10 text-indigo-500 border-indigo-500/20";
            case "done": return "bg-green-500/10 text-green-500 border-green-500/20";
            case "rejected": return "bg-red-500/10 text-red-500 border-red-500/20";
            default: return "bg-muted text-muted-foreground";
        }
    };

    if (isLoading) return <div className="p-8">Carregando...</div>;

    return (
        <div className="p-6 space-y-6">
            <div className="flex justify-between items-center">
                <h1 className="text-2xl font-bold">Gestão de Solicitações</h1>
            </div>

            <Card className="bg-muted/10 border-muted">
                <CardContent className="p-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-14 gap-4 items-end">
                        <div className="space-y-2 lg:col-span-3">
                            <Label>Buscar</Label>
                            <Input
                                placeholder="Buscar por título ou ID..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="bg-background"
                            />
                        </div>
                        <div className="space-y-2 lg:col-span-2">
                            <Label>Status</Label>
                            <Select value={filterStatus} onValueChange={(v) => setFilterStatus(v as any)}>
                                <SelectTrigger className="bg-background">
                                    <SelectValue placeholder="Status" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">Todos</SelectItem>
                                    <SelectItem value="pending">Pendente</SelectItem>
                                    <SelectItem value="analyzing">Em Análise</SelectItem>
                                    <SelectItem value="approved">Aprovado p/ Dev</SelectItem>
                                    <SelectItem value="waiting_response">Aguardando Resposta</SelectItem>
                                    <SelectItem value="done">Concluído</SelectItem>
                                    <SelectItem value="rejected">Rejeitado</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2 lg:col-span-2">
                            <Label>Tipo</Label>
                            <Select value={filterType} onValueChange={setFilterType}>
                                <SelectTrigger className="bg-background">
                                    <SelectValue placeholder="Tipo" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">Todos</SelectItem>
                                    <SelectItem value="suggestion">Sugestão</SelectItem>
                                    <SelectItem value="bug">Bug</SelectItem>
                                    <SelectItem value="auto_bug">Bug Automático</SelectItem>
                                    <SelectItem value="doubt">Dúvida</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2 lg:col-span-2">
                            <Label>Origem</Label>
                            <Select value={filterSource} onValueChange={setFilterSource}>
                                <SelectTrigger className="bg-background">
                                    <SelectValue placeholder="Origem" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">Todas</SelectItem>
                                    <SelectItem value="manual">👤 Manual</SelectItem>
                                    <SelectItem value="auto">🤖 Automático</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2 lg:col-span-2">
                            <Label>Usuário</Label>
                            <Select value={filterUser} onValueChange={setFilterUser}>
                                <SelectTrigger className="bg-background">
                                    <SelectValue placeholder="Usuário" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">Todos</SelectItem>
                                    {uniqueUsers.map(([id, name]) => (
                                        <SelectItem key={id as string} value={id as string}>{name as string}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2 lg:col-span-3 flex gap-2">
                            <div className="flex-1 space-y-2">
                                <Label>Data Inicial</Label>
                                <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="bg-background max-h-10" />
                            </div>
                            <div className="flex-1 space-y-2">
                                <Label>Data Final</Label>
                                <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="bg-background max-h-10" />
                            </div>
                        </div>
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Listagem</CardTitle>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="w-[100px]">ID</TableHead>
                                <TableHead>Data</TableHead>
                                <TableHead>Tipo</TableHead>
                                <TableHead>Origem</TableHead>
                                <TableHead>Título</TableHead>
                                <TableHead>Usuário</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead>Ação</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {filteredRequests?.map((req) => (
                                <TableRow key={req.id}>
                                    <TableCell className="font-mono text-[10px] text-muted-foreground font-bold">
                                        #{req.id.split('-')[0].toUpperCase()}
                                    </TableCell>
                                    <TableCell>{format(new Date(req.created_at), "dd/MM/yyyy HH:mm")}</TableCell>
                                    <TableCell>
                                        {req.type === 'suggestion' && <Badge variant="outline" className="gap-1"><Lightbulb className="w-3 h-3 text-yellow-500" /> Sugestão</Badge>}
                                        {req.type === 'bug' && <Badge variant="outline" className="gap-1"><Bug className="w-3 h-3 text-red-500" /> Bug</Badge>}
                                        {req.type === 'auto_bug' && <Badge variant="outline" className="gap-1 border-orange-500/20 bg-orange-500/10 text-orange-500"><Zap className="w-3 h-3" /> Auto Bug</Badge>}
                                        {req.type === 'doubt' && <Badge variant="outline" className="gap-1"><HelpCircle className="w-3 h-3 text-blue-500" /> Dúvida</Badge>}
                                    </TableCell>
                                    <TableCell>
                                        {(req as any).source === 'auto'
                                            ? <Badge variant="outline" className="gap-1 border-purple-500/20 bg-purple-500/10 text-purple-500"><Bot className="w-3 h-3" /> Auto</Badge>
                                            : <Badge variant="outline" className="gap-1"><UserCircle className="w-3 h-3" /> Manual</Badge>
                                        }
                                    </TableCell>
                                    <TableCell className="font-medium">{req.title}</TableCell>
                                    <TableCell>{req.profiles?.full_name || "Desconhecido"}</TableCell>
                                    <TableCell>
                                        <Badge variant="outline" className={getStatusColor(req.status)}>
                                            {req.status}
                                        </Badge>
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex items-center gap-2">
                                            <Button variant="ghost" size="sm" onClick={() => handleOpenDetails(req)}>
                                                <Eye className="w-4 h-4 mr-2" />
                                                Detalhes
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="text-muted-foreground hover:text-red-500 hover:bg-red-50"
                                                onClick={() => handleDelete(req.id)}
                                                disabled={deleteRequest.isPending}
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </Button>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>

            <Dialog open={!!selectedRequest} onOpenChange={(open) => !open && setSelectedRequest(null)}>
                <DialogContent className="max-w-6xl h-[90vh] flex flex-col p-0 overflow-hidden border-none shadow-2xl">
                    <DialogHeader className="p-6 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-20">
                        <DialogTitle className="flex items-center gap-3 text-2xl font-bold tracking-tight">
                            <div className="p-2 bg-primary/10 rounded-lg">
                                <ShieldCheck className="w-6 h-6 text-primary" />
                            </div>
                            Detalhes da Solicitação
                        </DialogTitle>
                    </DialogHeader>

                    <div className="flex-1 overflow-hidden flex flex-col md:flex-row">
                        <ScrollArea className="flex-1 h-full border-r">
                            <div className="p-8 space-y-10">
                                <section className="space-y-6">
                                    <div className="space-y-4">
                                        <div className="flex items-center gap-3">
                                            <Badge variant="outline" className={getStatusColor(selectedRequest?.status || "")}>
                                                {getStatusLabel(selectedRequest?.status || "")}
                                            </Badge>
                                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                                {selectedRequest?.type === 'suggestion' && <Lightbulb className="w-4 h-4 text-yellow-500" />}
                                                {selectedRequest?.type === 'bug' && <Bug className="w-4 h-4 text-red-500" />}
                                                {selectedRequest?.type === 'doubt' && <HelpCircle className="w-4 h-4 text-blue-500" />}
                                                <span className="capitalize">{selectedRequest?.type}</span>
                                            </div>
                                            <Separator orientation="vertical" className="h-4" />
                                            <span className="text-sm text-muted-foreground">
                                                ID: {selectedRequest?.id.split('-')[0]}
                                            </span>
                                        </div>
                                        <Input
                                            value={editTitle}
                                            onChange={(e) => setEditTitle(e.target.value)}
                                            className="text-2xl font-extrabold tracking-tight border-transparent hover:border-border focus-visible:ring-1 bg-transparent px-2 -ml-2 h-auto py-1 shadow-none"
                                        />
                                    </div>

                                    <div className="space-y-3 flex flex-col h-full">
                                        <Label className="text-xs uppercase tracking-widest text-muted-foreground font-bold flex items-center gap-2">Detalhes e Descrição do Chamado <span className="font-normal normal-case text-muted-foreground/60">(Editável)</span></Label>
                                        <Textarea
                                            value={editDescription}
                                            onChange={(e) => setEditDescription(e.target.value)}
                                            className="min-h-[300px] text-sm leading-relaxed p-4 bg-muted/20 border border-border/40 whitespace-pre-wrap shadow-inner font-sans resize-y focus-visible:ring-1"
                                        />
                                    </div>

                                    {/* Error Metadata (for auto bugs) */}
                                    {(selectedRequest as any)?.error_metadata && (
                                        <div className="space-y-3 mt-6">
                                            <Label className="text-xs uppercase tracking-widest text-muted-foreground font-bold flex items-center gap-2">
                                                <Code className="w-3 h-3" /> Dados Técnicos (Automático)
                                            </Label>
                                            <details className="group">
                                                <summary className="cursor-pointer text-sm font-medium text-orange-500 hover:text-orange-600 flex items-center gap-2">
                                                    <Zap className="w-4 h-4" />
                                                    Expandir metadados do erro
                                                </summary>
                                                <div className="mt-3 p-4 bg-black/80 text-green-400 rounded-xl font-mono text-xs overflow-x-auto whitespace-pre-wrap max-h-[400px] overflow-y-auto">
                                                    {JSON.stringify((selectedRequest as any).error_metadata, null, 2)}
                                                </div>
                                            </details>
                                        </div>
                                    )}
                                </section>

                                {attachments && attachments.length > 0 && (
                                    <section className="space-y-6">
                                        <div className="flex items-center justify-between">
                                            <Label className="text-xs uppercase tracking-widest text-muted-foreground font-bold">
                                                Anexos e Mídias ({attachments.length})
                                            </Label>
                                            <span className="text-xs text-muted-foreground italic">Clique para ampliar</span>
                                        </div>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                                            {attachments.map((att) => (
                                                <div key={att.id} className="group relative border rounded-2xl overflow-hidden bg-background shadow-soft hover:shadow-lg transition-all duration-300 border-border/50 aspect-video ring-offset-background focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2">
                                                    {att.file_type === 'image' ? (
                                                        <div className="w-full h-full bg-muted flex items-center justify-center overflow-hidden">
                                                            <img
                                                                src={att.file_url}
                                                                alt="Anexo"
                                                                className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                                                                loading="lazy"
                                                            />
                                                            <div
                                                                className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center cursor-pointer backdrop-blur-[2px]"
                                                                onClick={() => window.open(att.file_url, '_blank')}
                                                            >
                                                                <div className="transform translate-y-4 group-hover:translate-y-0 transition-transform duration-300">
                                                                    <Button variant="secondary" size="sm" className="rounded-full shadow-xl">
                                                                        <Eye className="w-4 h-4 mr-2" />
                                                                        Ver Original
                                                                    </Button>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    ) : att.file_type === 'video' ? (
                                                        <div className="w-full h-full bg-black flex items-center justify-center">
                                                            <video
                                                                src={att.file_url}
                                                                controls
                                                                className="w-full h-full"
                                                            />
                                                        </div>
                                                    ) : (
                                                        <div className="p-6 flex flex-col items-center justify-center h-full gap-4 text-center">
                                                            <div className="bg-primary/10 p-4 rounded-2xl">
                                                                <Paperclip className="w-8 h-8 text-primary" />
                                                            </div>
                                                            <div className="space-y-1">
                                                                <p className="text-xs font-medium text-muted-foreground truncate max-w-[150px]">Arquivo de Suporte</p>
                                                                <Button variant="link" size="sm" onClick={() => window.open(att.file_url, '_blank')} className="h-auto p-0">
                                                                    Abrir Arquivo
                                                                </Button>
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    </section>
                                )}
                            </div>
                        </ScrollArea>

                        <aside className="w-full md:w-[400px] bg-background border-l flex flex-col h-full shadow-xl z-20">
                            {/* Header Info & Actions */}
                            <div className="p-5 border-b bg-muted/30 space-y-4 shrink-0">
                                <div className="flex items-center justify-between">
                                    <h4 className="font-bold text-xs uppercase flex items-center gap-2 text-primary">
                                        <MessageSquare className="w-4 h-4" /> Interação
                                    </h4>
                                    <Badge variant="outline" className={getStatusColor(selectedRequest?.status || "")}>
                                        {getStatusLabel(selectedRequest?.status || "")}
                                    </Badge>
                                </div>

                                <div className="p-3 bg-background border rounded-xl shadow-sm space-y-1">
                                    <p className="font-bold text-xs text-foreground flex items-center gap-2">
                                        <User className="w-3 h-3" /> {selectedRequest?.profiles?.full_name}
                                    </p>
                                    <p className="text-[10px] text-muted-foreground ml-5">{selectedRequest?.profiles?.email}</p>
                                </div>

                                <div className="flex gap-2">
                                    <Select value={newStatus} onValueChange={(v) => setNewStatus(v as RequestStatus)}>
                                        <SelectTrigger className="h-8 text-xs bg-background min-w-[140px]">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="pending">Pendente</SelectItem>
                                            <SelectItem value="analyzing">Em Análise</SelectItem>
                                            <SelectItem value="approved">Aprovado p/ Dev</SelectItem>
                                            <SelectItem value="developed">Desenvolvido</SelectItem>
                                            <SelectItem value="waiting_response">Aguardando Resposta</SelectItem>
                                            <SelectItem value="done">Concluído</SelectItem>
                                            <SelectItem value="rejected">Rejeitado</SelectItem>
                                        </SelectContent>
                                    </Select>
                                    <Button onClick={handleSave} disabled={updateRequest.isPending} size="sm" className="h-8 px-4 text-xs font-bold bg-violet-600 hover:bg-violet-700 text-white">
                                        {updateRequest.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <><Check className="w-3 h-3 mr-2" /> Salvar Tudo</>}
                                    </Button>
                                </div>
                            </div>

                            {/* Chat List */}
                            <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50/50 dark:bg-black/20 scroll-smooth" ref={chatScrollRef}>
                                {chatMessages.length === 0 && (
                                    <div className="flex flex-col items-center justify-center h-full text-muted-foreground opacity-50 space-y-2">
                                        <MessageSquare className="w-8 h-8" />
                                        <p className="text-xs">Inicie a conversa...</p>
                                    </div>
                                )}

                                {chatMessages.map((msg: any) => {
                                    const isMe = msg.user_id === currentUserId;
                                    return (
                                        <div key={msg.id} className={`flex gap-3 w-full ${isMe ? "justify-end" : "justify-start"}`}>
                                            {!isMe && <div className="w-6 h-6 rounded-full bg-slate-200 dark:bg-slate-800 flex items-center justify-center text-[10px] font-bold text-muted-foreground shrink-0">U</div>}
                                            <div className={`max-w-[80%] flex flex-col ${isMe ? "items-end" : "items-start"}`}>
                                                <div className={`p-3 rounded-2xl text-xs whitespace-pre-wrap shadow-sm ${isMe ? "bg-primary text-primary-foreground rounded-tr-none" : "bg-white dark:bg-zinc-800 border rounded-tl-none"}`}>
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
                                                <span className="text-[9px] text-muted-foreground/60 mt-1 px-1">
                                                    {format(new Date(msg.created_at), "HH:mm")}
                                                </span>
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>

                            {/* Input Area */}
                            <div className="p-4 border-t bg-background shrink-0 space-y-4">
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
                                <form
                                    onSubmit={(e) => {
                                        e.preventDefault();
                                        if (!newMessage.trim() && !chatAttachment) return;
                                        sendMessageMutation.mutate();
                                    }}
                                    className="flex gap-2 items-end"
                                >
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
                                        className="h-10 w-8 shrink-0 text-muted-foreground hover:bg-muted"
                                        onClick={() => chatFileRef.current?.click()}
                                    >
                                        <Paperclip className="w-4 h-4" />
                                    </Button>

                                    <Textarea
                                        value={newMessage}
                                        onChange={e => setNewMessage(e.target.value)}
                                        placeholder="Digite uma resposta..."
                                        className="min-h-[40px] max-h-[120px] resize-none text-xs bg-muted/30 border-muted-foreground/20 focus-visible:ring-primary/20"
                                        onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessageMutation.mutate(); } }}
                                    />
                                    <Button type="submit" size="icon" disabled={(!newMessage.trim() && !chatAttachment) || sendMessageMutation.isPending} className="h-10 w-10 shrink-0 rounded-xl shadow-lg">
                                        {sendMessageMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                                    </Button>
                                </form>

                                {/* Internal Notes Accordion (Collapsible preferred but clear for now) */}
                                <div className="pt-3 border-t">
                                    <details className="text-xs group">
                                        <summary className="font-bold text-muted-foreground cursor-pointer hover:text-foreground flex items-center gap-2 select-none">
                                            <ShieldCheck className="w-3 h-3" /> Notas Internas (Privado)
                                        </summary>
                                        <div className="mt-3">
                                            <Textarea
                                                className="text-xs h-20 bg-yellow-50/50 dark:bg-yellow-900/10 border-yellow-200/50 placeholder:text-yellow-600/30"
                                                placeholder="Anotações visíveis apenas para admins..."
                                                value={adminNote}
                                                onChange={(e) => setAdminNote(e.target.value)}
                                            />
                                        </div>
                                    </details>
                                </div>
                            </div>
                        </aside>
                    </div>

                    <div className="p-4 border-t bg-muted/20 flex justify-between items-center sm:hidden">
                        <Button variant="ghost" onClick={() => setSelectedRequest(null)}>Fechar</Button>
                        <Button onClick={handleSave} disabled={updateRequest.isPending} size="sm">
                            Salvar
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}
