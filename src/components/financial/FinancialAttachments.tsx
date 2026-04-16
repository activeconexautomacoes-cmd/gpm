import { useState, useRef } from "react";
import { useFinancialAttachments } from "@/hooks/useFinancialAttachments";
import { Button } from "@/components/ui/button";
import { Loader2, Paperclip, X, Download, FileIcon, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface FinancialAttachmentsProps {
    receivableId?: string;
    payableId?: string;
    workspaceId?: string; // Needed for upload if ID is not available yet contextually, but usually strictly needed from parent or derived.
    // Actually, if we are creating a *new* transaction, we can't attach files yet unless we upload them and link them later.
    // Or we upload them and get IDs, then link them when creating the transaction?
    // The current hook expects an ID.
    // If the form is in "create" mode, we might need a different approach:
    // 1. Upload file -> get ID. Store ID in a list. When creating transaction, update these attachment records with the new transaction ID.
    // BUT the attachments table requires `receivable_id` or `payable_id` (not strictly required by DB constraint I added? Let's check).
    // I added: CONSTRAINT financial_attachments_target_check CHECK ((receivable_id IS NOT NULL AND payable_id IS NULL) OR (receivable_id IS NULL AND payable_id IS NOT NULL))
    // So it MUST be linked to one of them.
    // So for "Create" mode, we can't upload until the transaction is saved.
    // OR we modify the constraint/schema to allow "orphan" attachments temporarily?
    // OR we just don't allow attachments until the transaction is created. Users can save, then edit to add attachments. This is the simplest MVP.
    // BUT "Attachments" tab is there.
    // Better UX: Allow upload, store in a temporary state/table, or modify the constraint to allow nulls temporarily (e.g. `is_temp` flag).
    // OR: Temporarily relax the constraint? No.
    //
    // Best Approach for now:
    // If `receivableId` or `payableId` is present (Edit mode), works as is.
    // If not (Create mode), we can't upload.
    // We should visually indicate "Save the transaction to add attachments" OR handle the upload process *after* the main mutation succeeds but *before* closing the modal.
    //
    // Let's implement the simpler version first: "Edit mode" works immediately. "Create mode" shows a message or we handle the upload queue.
    // To support "Create mode" upload, we could queue the files in React state, and then on `onSubmit` of the form, after `createReceivable`, we iterate and upload them.
    //
    // I'll add `onUpload` prop to bypass the internal hook upload if needed?
    // No, let's make the component smart.
    //
    // If `manualUpload` is true, we just return the files to the parent.
    // But we need to display them too.
    enabled?: boolean; // If false (e.g. create mode without ID), maybe show different UI?
    // Let's support an "onFilesSelected" prop for the parent to handle pending uploads.
    onPendingFilesChange?: (files: File[]) => void;
}

export function FinancialAttachments({ receivableId, payableId, workspaceId, onPendingFilesChange }: FinancialAttachmentsProps) {
    const { attachments, isLoading, uploadAttachment, deleteAttachment } = useFinancialAttachments(receivableId, payableId);
    const { toast } = useToast();
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [pendingFiles, setPendingFiles] = useState<File[]>([]);
    const [isUploading, setIsUploading] = useState(false);

    const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            const files = Array.from(e.target.files);

            // If we have an ID, upload immediately
            if (receivableId || payableId) {
                if (!workspaceId) {
                    toast({ title: "Erro", description: "Workspace ID não encontrado.", variant: "destructive" });
                    return;
                }

                setIsUploading(true);
                try {
                    for (const file of files) {
                        await uploadAttachment.mutateAsync({ file, workspaceId });
                    }
                    toast({ title: "Sucesso", description: "Arquivos enviados com sucesso." });
                } catch (error) {
                    console.error(error);
                    toast({ title: "Erro", description: "Erro ao enviar arquivos.", variant: "destructive" });
                } finally {
                    setIsUploading(false);
                    if (fileInputRef.current) fileInputRef.current.value = "";
                }
            } else {
                // Otherwise, add to pending list
                const newPending = [...pendingFiles, ...files];
                setPendingFiles(newPending);
                onPendingFilesChange?.(newPending);
                if (fileInputRef.current) fileInputRef.current.value = "";
            }
        }
    };

    const handleRemovePending = (index: number) => {
        const newPending = pendingFiles.filter((_, i) => i !== index);
        setPendingFiles(newPending);
        onPendingFilesChange?.(newPending);
    };

    const handleDelete = async (attachment: any) => {
        try {
            await deleteAttachment.mutateAsync(attachment);
            toast({ title: "Sucesso", description: "Arquivo removido." });
        } catch (error) {
            toast({ title: "Erro", description: "Erro ao remover arquivo.", variant: "destructive" });
        }
    };

    return (
        <div className="space-y-4">
            <div
                className="border-2 border-dashed border-slate-200 rounded-xl p-8 flex flex-col items-center justify-center gap-3 bg-slate-50/20 hover:bg-slate-50 hover:border-green-300 transition-all cursor-pointer group"
                onClick={() => fileInputRef.current?.click()}
            >
                <input
                    type="file"
                    className="hidden"
                    ref={fileInputRef}
                    multiple
                    onChange={handleFileSelect}
                />
                <div className="h-12 w-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 group-hover:bg-green-100 group-hover:text-green-600 transition-colors">
                    {isUploading ? <Loader2 className="h-6 w-6 animate-spin" /> : <Paperclip className="h-6 w-6" />}
                </div>
                <div className="text-center">
                    <p className="text-sm font-bold text-slate-600">
                        {isUploading ? "Enviando..." : "Clique para selecionar arquivos"}
                    </p>
                    <p className="text-xs text-slate-400 mt-1 uppercase tracking-tighter">PDF, PNG, JPG (Máx 5MB)</p>
                </div>
            </div>

            <div className="space-y-2">
                {/* Pending Files (Create Mode) */}
                {pendingFiles.map((file, index) => (
                    <div key={`pending-${index}`} className="flex items-center justify-between p-3 bg-yellow-50 border border-yellow-100 rounded-lg">
                        <div className="flex items-center gap-3 overflow-hidden">
                            <div className="h-8 w-8 rounded bg-yellow-100 flex items-center justify-center text-yellow-600 shrink-0">
                                <FileIcon className="h-4 w-4" />
                            </div>
                            <div className="min-w-0">
                                <p className="text-sm font-medium text-slate-700 truncate">{file.name}</p>
                                <p className="text-[10px] text-slate-400">{(file.size / 1024).toFixed(1)} KB • Pendente de salvamento</p>
                            </div>
                        </div>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-red-500" onClick={() => handleRemovePending(index)}>
                            <X className="h-4 w-4" />
                        </Button>
                    </div>
                ))}

                {/* Existing Attachments */}
                {attachments?.map((attachment) => (
                    <div key={attachment.id} className="flex items-center justify-between p-3 bg-white border border-slate-100 rounded-lg hover:border-slate-300 transition-colors group">
                        <div className="flex items-center gap-3 overflow-hidden">
                            <div className="h-8 w-8 rounded bg-slate-100 flex items-center justify-center text-slate-500 group-hover:bg-blue-50 group-hover:text-blue-600 transition-colors shrink-0">
                                <FileIcon className="h-4 w-4" />
                            </div>
                            <div className="min-w-0">
                                <a href={attachment.file_url} target="_blank" rel="noopener noreferrer" className="text-sm font-medium text-slate-700 truncate hover:underline hover:text-blue-600 block">
                                    {attachment.file_name}
                                </a>
                                <p className="text-[10px] text-slate-400">
                                    {(attachment.file_size ? attachment.file_size / 1024 : 0).toFixed(1)} KB • {format(new Date(attachment.created_at), "dd/MM/yyyy HH:mm")}
                                </p>
                            </div>
                        </div>
                        <div className="flex items-center gap-1">
                            <a href={attachment.file_url} target="_blank" rel="noopener noreferrer">
                                <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-blue-600">
                                    <Download className="h-4 w-4" />
                                </Button>
                            </a>
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-slate-400 hover:text-red-500"
                                onClick={() => handleDelete(attachment)}
                                disabled={deleteAttachment.isPending}
                            >
                                <Trash2 className="h-4 w-4" />
                            </Button>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
