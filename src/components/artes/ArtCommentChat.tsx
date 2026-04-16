import { useEffect, useRef, useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Send, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useArtComments, useCreateArtComment } from "@/hooks/useArtes";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";

interface ArtCommentChatProps {
  requestId: string;
}

export function ArtCommentChat({ requestId }: ArtCommentChatProps) {
  const { data: comments = [], isLoading } = useArtComments(requestId);
  const createComment = useCreateArtComment();
  const { user } = useWorkspace();
  const [message, setMessage] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const qc = useQueryClient();

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [comments]);

  // Real-time subscription
  useEffect(() => {
    const channel = supabase
      .channel(`art-comments-${requestId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "art_comments", filter: `request_id=eq.${requestId}` },
        () => {
          qc.invalidateQueries({ queryKey: ["art-comments", requestId] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [requestId, qc]);

  const handleSend = () => {
    if (!message.trim()) return;
    createComment.mutate(
      { request_id: requestId, content: message.trim() },
      { onSuccess: () => setMessage("") }
    );
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex flex-col h-full">
      <h4 className="font-semibold text-sm px-3 py-2 border-b">Comentários</h4>

      <ScrollArea className="flex-1 px-3" ref={scrollRef}>
        <div className="space-y-3 py-3">
          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : comments.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-8">
              Nenhum comentário ainda
            </p>
          ) : (
            comments.map((comment) => {
              const isMe = comment.user_id === user?.id;
              const initials = comment.user?.full_name
                ?.split(" ")
                .map((n) => n[0])
                .join("")
                .substring(0, 2)
                .toUpperCase() || "?";

              return (
                <div
                  key={comment.id}
                  className={`flex gap-2 ${isMe ? "flex-row-reverse" : ""}`}
                >
                  <Avatar className="h-7 w-7 shrink-0">
                    <AvatarImage src={comment.user?.avatar_url || ""} />
                    <AvatarFallback className="text-[10px]">{initials}</AvatarFallback>
                  </Avatar>
                  <div className={`max-w-[80%] ${isMe ? "items-end" : "items-start"}`}>
                    <div
                      className={`rounded-lg px-3 py-2 text-sm ${
                        isMe
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted"
                      }`}
                    >
                      {!isMe && (
                        <p className="text-[10px] font-semibold mb-0.5 opacity-70">
                          {comment.user?.full_name}
                        </p>
                      )}
                      <p className="whitespace-pre-wrap break-words">{comment.content}</p>
                    </div>
                    <p className={`text-[10px] text-muted-foreground mt-0.5 ${isMe ? "text-right" : ""}`}>
                      {format(new Date(comment.created_at), "dd/MM HH:mm", { locale: ptBR })}
                    </p>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </ScrollArea>

      <div className="p-3 border-t flex gap-2">
        <Textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Digite um comentário..."
          className="min-h-[40px] max-h-[100px] text-sm resize-none"
          rows={1}
        />
        <Button
          size="icon"
          onClick={handleSend}
          disabled={!message.trim() || createComment.isPending}
          className="shrink-0"
        >
          {createComment.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Send className="h-4 w-4" />
          )}
        </Button>
      </div>
    </div>
  );
}
