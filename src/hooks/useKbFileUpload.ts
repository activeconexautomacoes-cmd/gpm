import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface UploadFile {
  id: string;
  file: File;
  filename: string;
  progress: number;
  status: "pending" | "uploading" | "processing" | "done" | "error";
  error?: string;
  result?: {
    category: string;
    title: string;
    summary: string;
  };
}

const MIME_TO_TYPE: Record<string, string> = {
  "text/plain": "txt",
  "text/markdown": "md",
  "text/x-markdown": "md",
  "application/pdf": "pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
  "application/msword": "docx",
};

const EXT_TO_TYPE: Record<string, string> = {
  md: "md",
  txt: "txt",
  pdf: "pdf",
  docx: "docx",
  doc: "docx",
};

function detectFileType(file: File): string | null {
  if (file.type && MIME_TO_TYPE[file.type]) {
    return MIME_TO_TYPE[file.type];
  }
  const ext = file.name.split(".").pop()?.toLowerCase();
  if (ext && EXT_TO_TYPE[ext]) {
    return EXT_TO_TYPE[ext];
  }
  return null;
}

const MAX_TEXT_SIZE = 2 * 1024 * 1024; // 2MB
const MAX_DOC_SIZE = 10 * 1024 * 1024; // 10MB

export function useKbFileUpload(
  workspaceId: string | undefined,
  conversationId: string | undefined
) {
  const [files, setFiles] = useState<UploadFile[]>([]);

  const validateFile = useCallback(
    (file: File): string | null => {
      const fileType = detectFileType(file);
      if (!fileType) {
        return `Tipo não suportado: ${file.name.split(".").pop() || file.type}`;
      }

      if (
        (fileType === "pdf" || fileType === "docx") &&
        file.size > MAX_DOC_SIZE
      ) {
        return `Documento excede 10MB (${(file.size / 1024 / 1024).toFixed(1)}MB)`;
      }
      if (
        (fileType === "txt" || fileType === "md") &&
        file.size > MAX_TEXT_SIZE
      ) {
        return `Arquivo de texto excede 2MB (${(file.size / 1024 / 1024).toFixed(1)}MB)`;
      }

      return null;
    },
    []
  );

  const uploadFile = useCallback(
    async (uploadFile: UploadFile) => {
      if (!workspaceId) return;

      const fileType = detectFileType(uploadFile.file) || "txt";
      const sanitizedName = uploadFile.filename.replace(/[^a-zA-Z0-9._-]/g, "_");
      const storagePath = `${workspaceId}/documents/${Date.now()}-${sanitizedName}`;

      setFiles((prev) =>
        prev.map((f) =>
          f.id === uploadFile.id ? { ...f, status: "uploading", progress: 30 } : f
        )
      );

      const { error: uploadErr } = await supabase.storage
        .from("kb-uploads")
        .upload(storagePath, uploadFile.file);

      if (uploadErr) throw new Error(`Upload falhou: ${uploadErr.message}`);

      setFiles((prev) =>
        prev.map((f) =>
          f.id === uploadFile.id
            ? { ...f, status: "processing", progress: 60 }
            : f
        )
      );

      const { data, error: processErr } = await supabase.functions.invoke(
        "kb-upload-process",
        {
          body: {
            workspace_id: workspaceId,
            conversation_id: conversationId,
            file_url: storagePath,
            filename: uploadFile.filename,
            file_type: fileType as "md" | "txt" | "pdf" | "docx",
            mime_type: uploadFile.file.type,
          },
        }
      );

      if (processErr) throw processErr;

      setFiles((prev) =>
        prev.map((f) =>
          f.id === uploadFile.id
            ? {
                ...f,
                status: "done",
                progress: 100,
                result: data?.classification,
              }
            : f
        )
      );
    },
    [workspaceId, conversationId]
  );

  const addFiles = useCallback(
    async (newFiles: FileList | File[]) => {
      const fileArray = Array.from(newFiles);
      const validFiles: UploadFile[] = [];

      for (const file of fileArray) {
        const validationError = validateFile(file);
        if (validationError) {
          validFiles.push({
            id: crypto.randomUUID(),
            file,
            filename: file.name,
            progress: 0,
            status: "error",
            error: validationError,
          });
          continue;
        }

        validFiles.push({
          id: crypto.randomUUID(),
          file,
          filename: file.name,
          progress: 0,
          status: "pending",
        });
      }

      setFiles((prev) => [...prev, ...validFiles]);

      const pending = validFiles.filter((f) => f.status === "pending");
      const concurrency = 4;
      const batches: UploadFile[][] = [];

      for (let i = 0; i < pending.length; i += concurrency) {
        batches.push(pending.slice(i, i + concurrency));
      }

      for (const batch of batches) {
        await Promise.allSettled(
          batch.map(async (f) => {
            try {
              await uploadFile(f);
            } catch (err) {
              setFiles((prev) =>
                prev.map((pf) =>
                  pf.id === f.id
                    ? {
                        ...pf,
                        status: "error",
                        error: (err as Error).message,
                      }
                    : pf
                )
              );
            }
          })
        );
      }

      return validFiles;
    },
    [validateFile, uploadFile]
  );

  const clearFiles = useCallback(() => {
    setFiles([]);
  }, []);

  const removeFile = useCallback((fileId: string) => {
    setFiles((prev) => prev.filter((f) => f.id !== fileId));
  }, []);

  return {
    files,
    addFiles,
    clearFiles,
    removeFile,
    isUploading: files.some(
      (f) => f.status === "uploading" || f.status === "processing"
    ),
    completedCount: files.filter((f) => f.status === "done").length,
    totalCount: files.length,
  };
}
