import { Bot, User, Paperclip } from "lucide-react";
import type { KbMessage } from "@/hooks/useKbConversation";

interface KbChatMessageProps {
  message: KbMessage;
}

export function KbChatMessage({ message }: KbChatMessageProps) {
  const isUser = message.role === "user";

  return (
    <div className={`flex gap-3 ${isUser ? "flex-row-reverse" : ""}`}>
      <div
        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
          isUser
            ? "bg-primary/10 text-primary"
            : "bg-muted text-muted-foreground"
        }`}
      >
        {isUser ? (
          <User className="h-4 w-4" />
        ) : (
          <Bot className="h-4 w-4" />
        )}
      </div>
      <div
        className={`max-w-[85%] rounded-2xl px-4 py-2.5 ${
          isUser
            ? "bg-primary text-primary-foreground"
            : "bg-muted text-foreground"
        }`}
      >
        <div className="whitespace-pre-wrap text-sm leading-relaxed">
          {message.content}
        </div>
        {message.attachments && message.attachments.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1">
            {message.attachments.map((att, i) => (
              <span
                key={i}
                className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs ${
                  isUser
                    ? "bg-primary-foreground/20 text-primary-foreground/80"
                    : "bg-background text-muted-foreground"
                }`}
              >
                <Paperclip className="h-3 w-3" />
                {att.filename}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
