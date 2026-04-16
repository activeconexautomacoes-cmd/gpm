
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { MessageSquare, History, Send, User } from "lucide-react";
import { toast } from "sonner";

interface ClientHistoryProps {
    clientId: string;
    contractId?: string;
}

export function ClientHistory({ clientId, contractId }: ClientHistoryProps) {
    const { currentWorkspace, user } = useWorkspace();
    const queryClient = useQueryClient();
    const [newComment, setNewComment] = useState("");

    // Fetch comments
    const { data: comments, isLoading: isLoadingComments } = useQuery({
        queryKey: ["client-comments", clientId, contractId],
        queryFn: async () => {
            const query = (supabase as any)
                .from("client_comments")
                .select(`
                    *,
                    profiles (
                        id,
                        full_name,
                        avatar_url
                    )
                `)
                .eq("client_id", clientId)
                .order("created_at", { ascending: false });

            if (contractId) {
                query.eq("contract_id", contractId);
            }

            const { data, error } = await query;
            if (error) throw error;
            return data as any[];
        },
        enabled: !!clientId
    });

    // Fetch activities
    const { data: activities, isLoading: isLoadingActivities } = useQuery({
        queryKey: ["client-activities", clientId, contractId],
        queryFn: async () => {
            const query = (supabase as any)
                .from("client_activities")
                .select(`
                    *,
                    profiles (
                        id,
                        full_name,
                        avatar_url
                    )
                `)
                .eq("client_id", clientId)
                .order("created_at", { ascending: false });

            if (contractId) {
                query.eq("contract_id", contractId);
            }

            const { data, error } = await query;
            if (error) throw error;
            return data as any[];
        },
        enabled: !!clientId
    });

    // Fetch workspace users for tagging
    const { data: workspaceUsers } = useQuery({
        queryKey: ["workspace-users", currentWorkspace?.id],
        queryFn: async () => {
            const { data: members } = await supabase
                .from("workspace_members")
                .select("profiles(id, full_name, avatar_url)")
                .eq("workspace_id", currentWorkspace?.id);
            if (!members) return [];
            return (members as any[]).map(m => m.profiles).filter(Boolean);
        },
        enabled: !!currentWorkspace?.id
    });

    const addCommentMutation = useMutation({
        mutationFn: async (content: string) => {
            if (!currentWorkspace?.id || !user?.id) return;

            // 1. Insert comment
            const { data: comment, error } = await (supabase as any)
                .from("client_comments")
                .insert({
                    workspace_id: currentWorkspace.id,
                    client_id: clientId,
                    contract_id: contractId,
                    user_id: user.id,
                    content: content
                })
                .select()
                .single();

            if (error) throw error;

            // 2. Extract mentions and notify
            const mentions = content.match(/@(\w+)/g);
            if (mentions) {
                const mentionedNames = mentions.map(m => m.substring(1).toLowerCase());
                const usersToNotify = workspaceUsers?.filter(u =>
                    mentionedNames.some(name => u.full_name.toLowerCase().includes(name)) && u.id !== user.id
                );

                if (usersToNotify && usersToNotify.length > 0) {
                    const notificationPromises = usersToNotify.map(u =>
                        (supabase as any).from("notifications").insert({
                            workspace_id: currentWorkspace.id,
                            user_id: u.id,
                            title: "Nova menção",
                            message: `${user.user_metadata?.full_name || 'Alguém'} mencionou você em um comentário de cliente.`,
                            type: "mention",
                            link: `/dashboard/clients/${clientId}/operations${contractId ? `?contract_id=${contractId}` : ''}`,
                            is_read: false
                        })
                    );
                    await Promise.all(notificationPromises);
                }
            }
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["client-comments", clientId, contractId] });
            setNewComment("");
            toast.success("Comentário adicionado");
        },
        onError: (error: any) => {
            toast.error("Erro ao adicionar comentário: " + error.message);
        }
    });

    const handleSubmitComment = () => {
        if (!newComment.trim()) return;
        addCommentMutation.mutate(newComment);
    };

    // Combine comments and activities for a single timeline
    const timeline = [
        ...(comments || []).map(c => ({ ...c, type: 'comment' })),
        ...(activities || []).map(a => ({ ...a, type: 'activity' }))
    ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    return (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 h-[600px]">
            <div className="md:col-span-2 flex flex-col space-y-4 border rounded-md p-4 bg-card">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                    <MessageSquare className="h-5 w-5" /> Timeline e Comentários
                </h3>

                <ScrollArea className="flex-1 pr-4">
                    <div className="space-y-6 pt-4">
                        {timeline.length === 0 && !isLoadingComments && !isLoadingActivities && (
                            <p className="text-center text-muted-foreground py-8">Nenhuma atividade registrada.</p>
                        )}

                        {timeline.map((item) => (
                            <div key={item.id} className="flex gap-3">
                                <Avatar className="h-8 w-8 mt-1">
                                    <AvatarImage src={item.profiles?.avatar_url} />
                                    <AvatarFallback><User className="h-4 w-4" /></AvatarFallback>
                                </Avatar>
                                <div className="flex-1 space-y-1">
                                    <div className="flex items-center justify-between">
                                        <span className="text-sm font-semibold">{item.profiles?.full_name || "Sistema"}</span>
                                        <span className="text-xs text-muted-foreground">
                                            {format(new Date(item.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                                        </span>
                                    </div>
                                    <div className={`p-3 rounded-lg text-sm ${item.type === 'comment' ? 'bg-muted/50 border' : 'bg-blue-50/30 text-blue-700 italic border border-blue-100'}`}>
                                        {item.type === 'comment' ? (
                                            <p className="whitespace-pre-wrap">{item.content}</p>
                                        ) : (
                                            <p>{item.description}</p>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </ScrollArea>

                <div className="flex gap-2 pt-4">
                    <Textarea
                        placeholder="Adicione um comentário... (Use @ para marcar alguém - em breve)"
                        value={newComment}
                        onChange={(e) => setNewComment(e.target.value)}
                        className="min-h-[80px]"
                    />
                    <Button
                        size="icon"
                        className="h-auto px-4"
                        disabled={addCommentMutation.isPending || !newComment.trim()}
                        onClick={handleSubmitComment}
                    >
                        <Send className="h-4 w-4" />
                    </Button>
                </div>
            </div>

            <div className="space-y-4 border rounded-md p-4 bg-card">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                    <History className="h-5 w-5" /> Atividade Recente
                </h3>
                <ScrollArea className="h-full">
                    <div className="space-y-4">
                        {activities?.slice(0, 10).map((activity) => (
                            <div key={activity.id} className="text-sm border-l-2 border-blue-400 pl-3 py-1">
                                <p className="font-medium text-xs text-muted-foreground">
                                    {format(new Date(activity.created_at), "dd/MM HH:mm")}
                                </p>
                                <p>{activity.description}</p>
                            </div>
                        ))}
                        {(!activities || activities.length === 0) && (
                            <p className="text-xs text-muted-foreground">Sem atividades recentes.</p>
                        )}
                    </div>
                </ScrollArea>
            </div>
        </div>
    );
}
