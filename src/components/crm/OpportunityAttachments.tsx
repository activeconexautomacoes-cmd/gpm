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
  FileSpreadsheetIcon
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface OpportunityAttachmentsProps {
  opportunity: {
    id: string;
    workspace_id: string;
  };
}

const getFileIcon = (fileType: string | null) => {
  if (!fileType) return FileIcon;
  if (fileType.startsWith('image/')) return ImageIcon;
  if (fileType.includes('pdf')) return FileTextIcon;
  if (fileType.includes('sheet') || fileType.includes('excel')) return FileSpreadsheetIcon;
  return FileIcon;
};

const formatFileSize = (bytes: number | null) => {
  if (!bytes) return 'N/A';
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
};

export function OpportunityAttachments({ opportunity }: OpportunityAttachmentsProps) {
  const [uploading, setUploading] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: attachments = [], isLoading } = useQuery({
    queryKey: ["opportunity-attachments", opportunity.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("opportunity_attachments")
        .select("*")
        .eq("opportunity_id", opportunity.id)
        .order("created_at", { ascending: false });

      if (error) throw error;

      // Buscar perfis dos uploaders
      const attachmentsWithProfiles = await Promise.all(
        (data || []).map(async (attachment) => {
          if (attachment.uploaded_by) {
            const { data: profile } = await supabase
              .from("profiles")
              .select("full_name, email")
              .eq("id", attachment.uploaded_by)
              .single();
            
            return { ...attachment, profiles: profile };
          }
          return { ...attachment, profiles: null };
        })
      );

      return attachmentsWithProfiles;
    },
    enabled: !!opportunity.id,
  });

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      // Validar tamanho (5MB)
      if (file.size > 5 * 1024 * 1024) {
        throw new Error("Arquivo muito grande. Máximo 5MB.");
      }

      // Upload para storage
      const fileExt = file.name.split('.').pop();
      const fileName = `${opportunity.id}/${Date.now()}.${fileExt}`;
      
      const { error: uploadError } = await supabase.storage
        .from("opportunity-attachments")
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      // Criar registro na tabela
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      const { error: dbError } = await supabase
        .from("opportunity_attachments")
        .insert({
          opportunity_id: opportunity.id,
          file_name: file.name,
          file_type: file.type,
          file_size: file.size,
          file_url: fileName,
          uploaded_by: user.id,
        });

      if (dbError) throw dbError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["opportunity-attachments"] });
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
    mutationFn: async (attachment: typeof attachments[0]) => {
      // Deletar do storage
      const { error: storageError } = await supabase.storage
        .from("opportunity-attachments")
        .remove([attachment.file_url]);

      if (storageError) throw storageError;

      // Deletar registro
      const { error: dbError } = await supabase
        .from("opportunity_attachments")
        .delete()
        .eq("id", attachment.id);

      if (dbError) throw dbError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["opportunity-attachments"] });
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

  const handleDownload = async (attachment: typeof attachments[0]) => {
    try {
      const { data, error } = await supabase.storage
        .from("opportunity-attachments")
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
      {/* Upload Area */}
      <Card className="p-4 border-dashed">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <UploadIcon className="h-5 w-5 text-muted-foreground" />
            <div>
              <p className="text-sm font-medium">Enviar Anexo</p>
              <p className="text-xs text-muted-foreground">Máximo 5MB - PDF, imagens, documentos</p>
            </div>
          </div>
          <div>
            <input
              type="file"
              id="file-upload"
              className="hidden"
              onChange={handleFileUpload}
              disabled={uploading}
              accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg,.gif,.webp,.txt,.csv"
            />
            <Button
              size="sm"
              onClick={() => document.getElementById('file-upload')?.click()}
              disabled={uploading}
            >
              {uploading ? "Enviando..." : "Selecionar Arquivo"}
            </Button>
          </div>
        </div>
      </Card>

      {/* Lista de Anexos */}
      <ScrollArea className="h-[400px]">
        {isLoading ? (
          <div className="text-center py-8 text-muted-foreground">
            <p>Carregando anexos...</p>
          </div>
        ) : attachments.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <FileIcon className="h-12 w-12 mx-auto mb-2 opacity-50" />
            <p>Nenhum anexo ainda</p>
            <p className="text-xs mt-1">Envie documentos, propostas ou imagens</p>
          </div>
        ) : (
          <div className="space-y-2">
            {attachments.map((attachment) => {
              const Icon = getFileIcon(attachment.file_type);
              
              return (
                <Card key={attachment.id} className="p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3 flex-1 min-w-0">
                      <Icon className="h-8 w-8 text-primary flex-shrink-0 mt-1" />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">
                          {attachment.file_name}
                        </p>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                          <span>{formatFileSize(attachment.file_size)}</span>
                          <span>•</span>
                          <span>
                            {format(new Date(attachment.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                          </span>
                        </div>
                        {attachment.profiles && (
                          <p className="text-xs text-muted-foreground mt-1">
                            Por: {attachment.profiles.full_name || attachment.profiles.email}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleDownload(attachment)}
                      >
                        <DownloadIcon className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => deleteMutation.mutate(attachment)}
                        disabled={deleteMutation.isPending}
                      >
                        <Trash2Icon className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}
