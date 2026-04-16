import { useState, useRef, useCallback } from "react";
import { Paperclip, Send } from "lucide-react";

const ACCEPTED_FILE_TYPES = ".md,.txt,.pdf,.docx,.doc";

interface KbChatInputProps {
  onSendText: (text: string) => void;
  onSendFiles: (files: FileList) => void;
  disabled?: boolean;
}

export function KbChatInput({
  onSendText,
  onSendFiles,
  disabled,
}: KbChatInputProps) {
  const [text, setText] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSendText = useCallback(() => {
    const trimmed = text.trim();
    if (!trimmed) return;
    onSendText(trimmed);
    setText("");
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  }, [text, onSendText]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSendText();
      }
    },
    [handleSendText]
  );

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files?.length) {
        onSendFiles(e.target.files);
        e.target.value = "";
      }
    },
    [onSendFiles]
  );

  const handleTextareaInput = useCallback(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`;
    }
  }, []);

  return (
    <div className="flex items-end gap-1.5 border-t bg-background px-3 py-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] sm:gap-2 sm:px-4 sm:py-3">
      <label
        className={`flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground ${disabled ? "pointer-events-none opacity-50" : ""}`}
        title="Anexar arquivo"
      >
        <Paperclip className="h-4 w-4" />
        <input
          ref={fileInputRef}
          type="file"
          accept={ACCEPTED_FILE_TYPES}
          multiple
          onChange={handleFileChange}
          className="sr-only"
        />
      </label>
      <textarea
        ref={textareaRef}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onInput={handleTextareaInput}
        onKeyDown={handleKeyDown}
        disabled={disabled}
        placeholder="Digite sua mensagem..."
        rows={1}
        className="max-h-[120px] min-h-[36px] flex-1 resize-none rounded-2xl border bg-muted/50 px-4 py-2 text-sm outline-none transition-colors focus:border-primary focus:bg-background disabled:opacity-50"
      />
      <button
        onClick={handleSendText}
        disabled={disabled || !text.trim()}
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground transition-colors hover:bg-primary/90 disabled:bg-muted disabled:text-muted-foreground"
        title="Enviar"
      >
        <Send className="h-4 w-4" />
      </button>
    </div>
  );
}
