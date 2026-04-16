import { Loader2, AlertCircle } from "lucide-react";
import type { UploadFile } from "@/hooks/useKbFileUpload";

interface KbProcessingIndicatorProps {
  files: UploadFile[];
  backgroundTasks?: string[];
}

export function KbProcessingIndicator({
  files,
  backgroundTasks = [],
}: KbProcessingIndicatorProps) {
  const activeFiles = files.filter(
    (f) =>
      f.status === "uploading" ||
      f.status === "processing" ||
      f.status === "error"
  );

  if (activeFiles.length === 0 && backgroundTasks.length === 0) return null;

  return (
    <div className="border-t bg-muted/50 px-4 py-2">
      {activeFiles.map((file) => (
        <div key={file.id} className="flex items-center gap-2 py-1">
          {file.status === "error" ? (
            <AlertCircle className="h-3 w-3 text-destructive" />
          ) : (
            <Loader2 className="h-3 w-3 animate-spin text-primary" />
          )}
          <span
            className={`flex-1 truncate text-xs ${file.status === "error" ? "text-destructive" : "text-muted-foreground"}`}
          >
            {file.status === "error"
              ? `Erro: ${file.filename}`
              : file.status === "uploading"
                ? `Enviando: ${file.filename}`
                : `Processando: ${file.filename}`}
            {file.error && (
              <span className="ml-1 text-destructive/70">— {file.error}</span>
            )}
          </span>
          {file.status !== "error" && (
            <div className="h-1 w-20 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-primary transition-all duration-300"
                style={{ width: `${file.progress}%` }}
              />
            </div>
          )}
        </div>
      ))}
      {backgroundTasks.map((task, i) => (
        <div key={i} className="flex items-center gap-2 py-1">
          <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
          <span className="text-xs text-muted-foreground">{task}</span>
        </div>
      ))}
    </div>
  );
}
