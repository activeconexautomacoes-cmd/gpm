
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { TaskComment } from "@/types/operations";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Send, User } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface TaskCommentsProps {
    taskId: string;
}

export function TaskComments({ taskId }: TaskCommentsProps) {
    const { currentWorkspace } = useWorkspace();
    const { toast } = useToast();
    const queryClient = useQueryClient();
    const [newComment, setNewComment] = useState("");

    const { data: comments, isLoading } = useQuery({
        queryKey: ["task-comments", taskId],
        queryFn: async () => {
            const { data, error } = await supabase
                .from("task_comments")
                .select(`
                    *,
                    profiles (
                        id,
                        full_name,
                        avatar_url,
                        email
                    )
                `)
                .eq("task_id", taskId)
                .order("created_at", { ascending: true });

            if (error) throw error;
            // Cast profiles to expected type if needed, though join usually works well
            return data as unknown as TaskComment[];
        },
        enabled: !!taskId,
    });

    const mutation = useMutation({
        mutationFn: async (content: string) => {
            const { error } = await supabase
                .from("task_comments")
                .insert({
                    task_id: taskId,
                    user_id: (await supabase.auth.getUser()).data.user?.id,
                    content
                });
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["task-comments", taskId] });
            setNewComment("");
        },
        onError: (error) => {
            toast({
                variant: "destructive",
                title: "Erro ao enviar comentário",
                description: error.message
            });
        }
    });

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!newComment.trim()) return;
        mutation.mutate(newComment);
    };

    if (isLoading) return <div className="p-4 text-center text-sm text-muted-foreground">Carregando comentários...</div>;

    return (
        <div className="flex flex-col h-[400px]">
            <ScrollArea className="flex-1 p-4">
                <div className="space-y-4">
                    {comments?.length === 0 ? (
                        <div className="text-center text-muted-foreground py-8">
                            <p>Nenhum comentário ainda.</p>
                            <span className="text-xs">Seja o primeiro a comentar!</span>
                        </div>
                    ) : (
                        comments?.map((comment) => (
                            <div key={comment.id} className="flex gap-3 items-start">
                                <Avatar className="h-8 w-8 mt-1">
                                    <AvatarImage src={comment.profiles?.avatar_url || ""} />
                                    <AvatarFallback>
                                        <User className="h-4 w-4" />
                                    </AvatarFallback>
                                </Avatar>
                                <div className="space-y-1">
                                    <div className="flex items-center gap-2">
                                        <span className="text-sm font-semibold">{comment.profiles?.full_name || "Usuário"}</span>
                                        <span className="text-xs text-muted-foreground">
                                            {formatDistanceToNow(new Date(comment.created_at), { addSuffix: true, locale: ptBR })}
                                        </span>
                                    </div>
                                    <div className="text-sm bg-muted p-2 rounded-md rounded-tl-none">
                                        {comment.content}
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </ScrollArea>
            <div className="p-4 border-t mt-auto">
                <form onSubmit={handleSubmit} className="flex gap-2">
                    <Textarea
                        value={newComment}
                        onChange={(e) => setNewComment(e.target.value)}
                        placeholder="Escreva um comentário..."
                        className="resize-none min-h-[40px] max-h-[80px]"
                        rows={1}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                                e.preventDefault();
                                handleSubmit(e);
                            }
                        }}
                    />
                    <Button type="submit" size="icon" disabled={mutation.isPending || !newComment.trim()}>
                        <Send className="h-4 w-4" />
                    </Button>
                </form>
            </div>
        </div>
    );
}
