import { useCallback, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Upload, FileIcon, Image, Loader2, Download } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useArtFiles, useUploadArtFile } from "@/hooks/useArtes";
import { useWorkspace } from "@/contexts/WorkspaceContext";

const ACCEPTED_TYPES = [
  "image/png",
  "image/jpeg",
  "application/pdf",
  "image/vnd.adobe.photoshop",
  "application/postscript",
  "application/x-photoshop",
];
const ACCEPTED_EXTENSIONS = ".png,.jpg,.jpeg,.pdf,.psd,.ai";

interface ArtFileUploaderProps {
  requestId: string;
  formatId?: string;
}

export function ArtFileUploader({ requestId, formatId }: ArtFileUploaderProps) {
  const { data: files = [], isLoading } = useArtFiles(requestId);
  const uploadFile = useUploadArtFile();
  const { can } = useWorkspace();
  const [isDragging, setIsDragging] = useState(false);
  const canUpload = can("art.upload");

  const handleFiles = useCallback(
    (fileList: FileList) => {
      Array.from(fileList).forEach((file) => {
        uploadFile.mutate({ requestId, formatId, file });
      });
    },
    [requestId, formatId, uploadFile]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      if (e.dataTransfer.files.length > 0) {
        handleFiles(e.dataTransfer.files);
      }
    },
    [handleFiles]
  );

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const isImage = (name: string) => /\.(png|jpg|jpeg)$/i.test(name);

  return (
    <div className="space-y-4">
      {canUpload && (
        <div
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={() => setIsDragging(false)}
          className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors cursor-pointer ${
            isDragging ? "border-primary bg-primary/5" : "border-muted-foreground/25 hover:border-primary/50"
          }`}
          onClick={() => {
            const input = document.createElement("input");
            input.type = "file";
            input.multiple = true;
            input.accept = ACCEPTED_EXTENSIONS;
            input.onchange = (e) => {
              const files = (e.target as HTMLInputElement).files;
              if (files) handleFiles(files);
            };
            input.click();
          }}
        >
          {uploadFile.isPending ? (
            <Loader2 className="h-8 w-8 mx-auto mb-2 animate-spin text-primary" />
          ) : (
            <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
          )}
          <p className="text-sm text-muted-foreground">
            {uploadFile.isPending
              ? "Enviando arquivo..."
              : "Arraste arquivos ou clique para selecionar"}
          </p>
          <p className="text-xs text-muted-foreground mt-1">PNG, JPG, PDF, PSD, AI</p>
        </div>
      )}

      {isLoading ? (
        <div className="flex justify-center py-4">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : files.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-4">
          Nenhum arquivo enviado
        </p>
      ) : (
        <div className="space-y-2">
          {files.map((file) => (
            <Card key={file.id} className="p-3">
              <div className="flex items-center gap-3">
                {isImage(file.file_name) ? (
                  <div className="h-12 w-12 rounded border overflow-hidden shrink-0 bg-muted">
                    <img
                      src={file.file_url}
                      alt={file.file_name}
                      className="h-full w-full object-cover"
                    />
                  </div>
                ) : (
                  <div className="h-12 w-12 rounded border flex items-center justify-center shrink-0 bg-muted">
                    <FileIcon className="h-5 w-5 text-muted-foreground" />
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate">{file.file_name}</p>
                  <p className="text-xs text-muted-foreground">
                    v{file.version} · {file.uploader?.full_name} ·{" "}
                    {format(new Date(file.created_at), "dd/MM HH:mm", { locale: ptBR })}
                  </p>
                </div>
                <Button variant="ghost" size="icon" className="shrink-0" asChild>
                  <a href={file.file_url} target="_blank" rel="noopener noreferrer">
                    <Download className="h-4 w-4" />
                  </a>
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
