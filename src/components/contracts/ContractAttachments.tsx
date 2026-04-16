import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import {
    FileIcon,
    DownloadIcon,
    Trash2Icon,
    UploadIcon,
    FileTextIcon,
    ImageIcon,
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface ContractAttachmentsProps {
    contractId: string;
}

const getFileIcon = (fileType: string | null) => {
    if (!fileType) return FileIcon;
    if (fileType.startsWith('image/')) return ImageIcon;
    if (fileType.includes('pdf')) return FileTextIcon;
    return FileIcon;
};

const formatFileSize = (bytes: number | null) => {
    if (!bytes) return 'N/A';
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
};

export function ContractAttachments({ contractId }: ContractAttachmentsProps) {
    const [uploading, setUploading] = useState(false);
    const { toast } = useToast();
    const queryClient = useQueryClient();

    const { data: attachments = [], isLoading } = useQuery({
        queryKey: ["contract-attachments", contractId],
        queryFn: async () => {
            const { data, error } = await supabase
                .from("contract_attachments")
                .select("*")
                .eq("contract_id", contractId)
                .order("created_at", { ascending: false });

            if (error) throw error;
            return data;
        },
        enabled: !!contractId,
    });

    const uploadMutation = useMutation({
        mutationFn: async (file: File) => {
            if (file.size > 10 * 1024 * 1024) {
                throw new Error("Arquivo muito grande. Máximo 10MB.");
            }

            const fileExt = file.name.split('.').pop();
            const fileName = `${contractId}/${Date.now()}.${fileExt}`;

            const { error: uploadError } = await supabase.storage
                .from("contract-attachments")
                .upload(fileName, file);

            if (uploadError) throw uploadError;

            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error("Usuário não autenticado");

            const { error: dbError } = await supabase
                .from("contract_attachments")
                .insert({
                    contract_id: contractId,
                    file_name: file.name,
                    file_type: file.type,
                    file_size: file.size,
                    file_url: fileName,
                    uploaded_by: user.id,
                });

            if (dbError) throw dbError;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["contract-attachments", contractId] });
            toast({
                title: "Sucesso",
                description: "Arquivo enviado com sucesso",
            });
        },
        onError: (error: Error) => {
            toast({
                title: "Erro ao enviar arquivo",
                description: error.message,
                variant: "destructive",
            });
        },
    });

    const deleteMutation = useMutation({
        mutationFn: async (attachment: any) => {
            // Delete DB record first — if it fails, storage remains intact (consistent state)
            const { error: dbError } = await supabase
                .from("contract_attachments")
                .delete()
                .eq("id", attachment.id);

            if (dbError) throw dbError;

            // Only remove from storage after DB record is gone
            await supabase.storage
                .from("contract-attachments")
                .remove([attachment.file_url]);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["contract-attachments", contractId] });
            toast({
                title: "Sucesso",
                description: "Arquivo removido com sucesso",
            });
        },
        onError: (error: Error) => {
            toast({
                title: "Erro ao remover arquivo",
                description: error.message,
                variant: "destructive",
            });
        },
    });

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setUploading(true);
        try {
            await uploadMutation.mutateAsync(file);
        } finally {
            setUploading(false);
            e.target.value = '';
        }
    };

    const handleDownload = async (attachment: any) => {
        try {
            const { data, error } = await supabase.storage
                .from("contract-attachments")
                .download(attachment.file_url);

            if (error) throw error;

            const url = URL.createObjectURL(data);
            const a = document.createElement('a');
            a.href = url;
            a.download = attachment.file_name;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        } catch (error) {
            toast({
                title: "Erro ao baixar arquivo",
                description: error instanceof Error ? error.message : "Erro desconhecido",
                variant: "destructive",
            });
        }
    };

    return (
        <div className="space-y-4">
            <Card className="p-4 border-dashed bg-muted/30">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <UploadIcon className="h-4 w-4 text-muted-foreground" />
                        <div>
                            <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Anexar Documento</p>
                            <p className="text-[10px] text-muted-foreground">PDF, imagens (Máximo 10MB)</p>
                        </div>
                    </div>
                    <div>
                        <input
                            type="file"
                            id={`contract-file-${contractId}`}
                            className="hidden"
                            onChange={handleFileUpload}
                            disabled={uploading}
                            accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg,.gif,.webp"
                        />
                        <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="h-7 text-[10px] font-bold"
                            onClick={() => document.getElementById(`contract-file-${contractId}`)?.click()}
                            disabled={uploading}
                        >
                            {uploading ? "Enviando..." : "SOLICITAR ARQUIVO"}
                        </Button>
                    </div>
                </div>
            </Card>

            <ScrollArea className={attachments.length > 0 ? "h-[150px]" : ""}>
                {isLoading ? (
                    <div className="text-center py-4 text-muted-foreground text-xs font-medium">
                        Carregando anexos...
                    </div>
                ) : attachments.length === 0 ? (
                    <div className="text-center py-4 text-muted-foreground">
                        <p className="text-[10px] font-medium uppercase tracking-widest opacity-50">Nenhum anexo</p>
                    </div>
                ) : (
                    <div className="space-y-2">
                        {attachments.map((attachment: any) => {
                            const Icon = getFileIcon(attachment.file_type);

                            return (
                                <div key={attachment.id} className="flex items-center justify-between gap-3 p-2 bg-white rounded-lg border border-slate-100 shadow-sm">
                                    <div className="flex items-center gap-2 min-w-0">
                                        <Icon className="h-4 w-4 text-indigo-500 flex-shrink-0" />
                                        <div className="min-w-0">
                                            <p className="font-bold text-[11px] truncate text-slate-700">
                                                {attachment.file_name}
                                            </p>
                                            <p className="text-[9px] text-slate-400">
                                                {formatFileSize(attachment.file_size)} • {format(new Date(attachment.created_at), "dd/MM/yyyy", { locale: ptBR })}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-1 flex-shrink-0">
                                        <Button
                                            type="button"
                                            size="icon"
                                            variant="ghost"
                                            className="h-6 w-6"
                                            onClick={() => handleDownload(attachment)}
                                        >
                                            <DownloadIcon className="h-3 w-3" />
                                        </Button>
                                        <Button
                                            type="button"
                                            size="icon"
                                            variant="ghost"
                                            className="h-6 w-6 text-red-500 hover:text-red-600 hover:bg-red-50"
                                            onClick={() => deleteMutation.mutate(attachment)}
                                            disabled={deleteMutation.isPending}
                                        >
                                            <Trash2Icon className="h-3 w-3" />
                                        </Button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </ScrollArea>
        </div>
    );
}
