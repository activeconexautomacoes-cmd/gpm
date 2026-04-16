import { useEffect, useRef, useState, useCallback } from "react";
import { MessageSquare, Minimize2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  useKbMessages,
  useKbMessagesRealtime,
  useKbSendMessage,
} from "@/hooks/useKbConversation";
import { useKbFileUpload } from "@/hooks/useKbFileUpload";
import { supabase } from "@/integrations/supabase/client";
import { KbChatMessage } from "./KbChatMessage";
import { KbChatInput } from "./KbChatInput";
import { KbProcessingIndicator } from "./KbProcessingIndicator";

interface KbChatProps {
  conversationId?: string;
  workspaceId?: string;
  onMinimize?: () => void;
  hideHeader?: boolean;
}

export function KbChat({
  conversationId,
  workspaceId,
  onMinimize,
  hideHeader,
}: KbChatProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [backgroundTasks, setBackgroundTasks] = useState<string[]>([]);

  const { data: messages = [], isLoading } = useKbMessages(conversationId);
  useKbMessagesRealtime(conversationId);

  const sendMessage = useKbSendMessage();
  const fileUpload = useKbFileUpload(workspaceId, conversationId);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (backgroundTasks.length > 0) {
      const timer = setTimeout(() => setBackgroundTasks([]), 10000);
      return () => clearTimeout(timer);
    }
  }, [backgroundTasks]);

  const handleSendText = useCallback(
    async (text: string) => {
      if (!workspaceId || !conversationId) return;

      const result = await sendMessage.mutateAsync({
        conversation_id: conversationId,
        workspace_id: workspaceId,
        message: text,
      });

      if (result.background_tasks?.length) {
        setBackgroundTasks(result.background_tasks);
      }
    },
    [workspaceId, conversationId, sendMessage]
  );

  const handleSendFiles = useCallback(
    async (fileList: FileList) => {
      if (!workspaceId) {
        toast.error("Workspace não encontrado");
        return;
      }
      if (!conversationId) {
        toast.error("Inicie a conversa antes de enviar arquivos");
        return;
      }

      const files = Array.from(fileList);
      const uploadedAttachments: Array<{
        filename: string;
        file_url: string;
        file_type: "md" | "txt" | "pdf" | "docx";
      }> = [];

      for (const file of files) {
        try {
          const ext = file.name.split(".").pop()?.toLowerCase() || "txt";
          const typeMap: Record<string, "md" | "txt" | "pdf" | "docx"> = {
            md: "md", txt: "txt", pdf: "pdf", docx: "docx", doc: "docx",
          };
          const fileType = typeMap[ext] || "txt";
          const storagePath = `${workspaceId}/documents/${Date.now()}-${file.name}`;

          const { error: uploadErr } = await supabase.storage
            .from("kb-uploads")
            .upload(storagePath, file);

          if (uploadErr) {
            toast.error(`Erro no upload de ${file.name}: ${uploadErr.message}`);
            continue;
          }

          uploadedAttachments.push({
            filename: file.name,
            file_url: storagePath,
            file_type: fileType,
          });
        } catch (err) {
          toast.error(`Erro em ${file.name}: ${(err as Error).message}`);
        }
      }

      if (uploadedAttachments.length > 0) {
        try {
          const fileNames = uploadedAttachments.map((a) => a.filename).join(", ");
          await sendMessage.mutateAsync({
            conversation_id: conversationId,
            workspace_id: workspaceId,
            message: `[Arquivos enviados: ${fileNames}]`,
            attachments: uploadedAttachments.map((a) => ({
              ...a,
              mime_type: files.find((f) => f.name === a.filename)?.type,
            })),
          });
          toast.success(
            `${uploadedAttachments.length} arquivo${uploadedAttachments.length > 1 ? "s" : ""} enviado${uploadedAttachments.length > 1 ? "s" : ""}!`
          );
        } catch (err) {
          toast.error(`Erro ao processar: ${(err as Error).message}`);
        }
      }
    },
    [workspaceId, conversationId, sendMessage]
  );

  const isSending = sendMessage.isPending;

  return (
    <div className="flex h-full flex-col border-l bg-background">
      {!hideHeader && (
        <div className="flex items-center justify-between border-b px-4 py-3">
          <div className="flex items-center gap-2">
            <MessageSquare className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-semibold">
              Agente de Processos
            </h3>
          </div>
          {onMinimize && (
            <button
              onClick={onMinimize}
              className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <Minimize2 className="h-4 w-4" />
            </button>
          )}
        </div>
      )}

      <div className="flex-1 overflow-y-auto px-4 py-4">
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <MessageSquare className="mb-2 h-8 w-8 text-muted-foreground/30" />
            <p className="text-sm text-muted-foreground">
              Inicie a conversa para começar a documentar
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {messages.map((msg) => (
              <KbChatMessage key={msg.id} message={msg} />
            ))}
            {isSending && (
              <div className="flex gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted">
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                </div>
                <div className="rounded-2xl bg-muted px-4 py-2.5">
                  <div className="flex gap-1">
                    <div className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground/50" />
                    <div
                      className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground/50"
                      style={{ animationDelay: "0.1s" }}
                    />
                    <div
                      className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground/50"
                      style={{ animationDelay: "0.2s" }}
                    />
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      <KbProcessingIndicator
        files={fileUpload.files}
        backgroundTasks={backgroundTasks}
      />

      <KbChatInput
        onSendText={handleSendText}
        onSendFiles={handleSendFiles}
        disabled={isSending}
      />
    </div>
  );
}
