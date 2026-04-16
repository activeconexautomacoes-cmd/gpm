import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useEffect } from "react";

export interface KbMessage {
  id: string;
  conversation_id: string;
  role: "user" | "assistant" | "system";
  content: string;
  message_type: "text" | "file";
  attachments: Array<{
    filename: string;
    file_url: string;
    file_type: string;
    size?: number;
  }>;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface KbConversation {
  id: string;
  workspace_id: string;
  status: "active" | "paused" | "completed";
  wizard_choice: "has_materials" | "from_scratch" | null;
  overall_score: number;
  category_scores: Record<string, number>;
  created_at: string;
  updated_at: string;
}

/** Load active conversation for a workspace */
export function useKbActiveConversation(workspaceId?: string) {
  return useQuery({
    queryKey: ["kb-conversation", workspaceId],
    queryFn: async () => {
      if (!workspaceId) return null;
      const { data, error } = await supabase
        .from("kb_conversations" as any)
        .select("*")
        .eq("workspace_id", workspaceId)
        .in("status", ["active", "paused"])
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return (data as unknown as KbConversation) || null;
    },
    enabled: !!workspaceId,
  });
}

/** Load messages for a conversation */
export function useKbMessages(conversationId?: string) {
  return useQuery({
    queryKey: ["kb-messages", conversationId],
    queryFn: async () => {
      if (!conversationId) return [];
      const { data, error } = await supabase
        .from("kb_messages" as any)
        .select("*")
        .eq("conversation_id", conversationId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data as unknown as KbMessage[]) || [];
    },
    enabled: !!conversationId,
  });
}

/** Poll for new messages instead of realtime (avoids Supabase channel race condition) */
export function useKbMessagesRealtime(conversationId?: string) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!conversationId) return;

    const interval = setInterval(() => {
      queryClient.invalidateQueries({
        queryKey: ["kb-messages", conversationId],
      });
    }, 3000);

    return () => clearInterval(interval);
  }, [conversationId, queryClient]);
}

/** Send a message to the KB agent */
export function useKbSendMessage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: {
      conversation_id?: string;
      workspace_id: string;
      message?: string;
      wizard_choice?: "has_materials" | "from_scratch";
      attachments?: Array<{
        filename: string;
        file_url: string;
        file_type: "md" | "txt" | "pdf" | "docx";
        mime_type?: string;
        size?: number;
      }>;
    }) => {
      const { data, error } = await supabase.functions.invoke(
        "kb-agent-chat",
        { body: params }
      );
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || "Chat failed");
      return data as {
        success: boolean;
        conversation_id: string;
        message: string;
        metadata: Record<string, unknown>;
        overall_score: number;
        category_scores: Record<string, number>;
        background_tasks: string[];
      };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({
        queryKey: ["kb-messages", data.conversation_id],
      });
      queryClient.invalidateQueries({ queryKey: ["kb-conversation"] });
      queryClient.invalidateQueries({ queryKey: ["kb-scores"] });
    },
    onError: (error) => toast.error(`Erro no chat: ${error.message}`),
  });
}
