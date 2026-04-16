
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { useToast } from "@/hooks/use-toast";
import {
    File,
    Image as ImageIcon,
    Video as VideoIcon,
    FileText,
    Download,
    Trash2,
    UploadCloud,
    Loader2,
    MoreVertical,
    ExternalLink,
    Search
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { format } from "date-fns";
import { ClientAsset } from "@/types/operations";
import { cn } from "@/lib/utils";

interface ClientAssetsProps {
    clientId: string;
    contractId?: string;
}

export function ClientAssets({ clientId, contractId }: ClientAssetsProps) {
    const { currentWorkspace, user } = useWorkspace();
    const { toast } = useToast();
    const queryClient = useQueryClient();
    const [isUploading, setIsUploading] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");

    const { data: assets, isLoading } = useQuery({
        queryKey: ["client-assets", clientId, contractId],
        queryFn: async () => {
            let query = (supabase as any)
                .from("client_assets")
                .select(`
                    *,
                    profiles:created_by (full_name, avatar_url)
                `)
                .eq("client_id", clientId);

            if (contractId) {
                query = query.eq("contract_id", contractId);
            }

            const { data, error } = await query.order("created_at", { ascending: false });
            if (error) throw error;
            return data as ClientAsset[];
        }
    });

    const uploadMutation = useMutation({
        mutationFn: async (file: File) => {
            if (!currentWorkspace?.id || !user?.id) throw new Error("Não autorizado");

            setIsUploading(true);
            const fileExt = file.name.split(".").pop();
            const fileName = `${Math.random().toString(36).substring(2)}-${Date.now()}.${fileExt}`;
            const filePath = `${currentWorkspace.id}/${clientId}/${fileName}`;

            // 1. Upload to Storage
            const { error: uploadError } = await supabase.storage
                .from("client-assets")
                .upload(filePath, file);

            if (uploadError) throw uploadError;

            // 2. Insert into Database
            const { error: dbError } = await (supabase as any)
                .from("client_assets")
                .insert({
                    workspace_id: currentWorkspace.id,
                    client_id: clientId,
                    contract_id: contractId || null,
                    name: file.name,
                    file_path: filePath,
                    file_type: file.type,
                    size: file.size,
                    created_by: user.id
                });

            if (dbError) throw dbError;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["client-assets"] });
            toast({
                title: "Arquivo enviado!",
                description: "O arquivo foi armazenado com sucesso.",
            });
            setIsUploading(false);
        },
        onError: (error: any) => {
            toast({
                title: "Erro no envio",
                description: error.message || "Houve um problema ao enviar o arquivo.",
                variant: "destructive"
            });
            setIsUploading(false);
        }
    });

    const deleteMutation = useMutation({
        mutationFn: async (asset: ClientAsset) => {
            // 1. Delete from Storage
            const { error: storageError } = await supabase.storage
                .from("client-assets")
                .remove([asset.file_path]);

            if (storageError) throw storageError;

            // 2. Delete from Database
            const { error: dbError } = await (supabase as any)
                .from("client_assets")
                .delete()
                .eq("id", asset.id);

            if (dbError) throw dbError;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["client-assets"] });
            toast({
                title: "Arquivo excluído",
                description: "O arquivo foi removido permanentemente.",
            });
        }
    });

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (files && files.length > 0) {
            uploadMutation.mutate(files[0]);
        }
    };

    const getFileIcon = (type: string) => {
        if (type.startsWith("image/")) return <ImageIcon className="h-5 w-5 text-blue-500" />;
        if (type.startsWith("video/")) return <VideoIcon className="h-5 w-5 text-blue-500" />;
        if (type.includes("pdf")) return <FileText className="h-5 w-5 text-red-500" />;
        return <File className="h-5 w-5 text-slate-500" />;
    };

    const formatFileSize = (bytes: number) => {
        if (bytes === 0) return "0 Bytes";
        const k = 1024;
        const sizes = ["Bytes", "KB", "MB", "GB"];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
    };

    const getPublicUrl = (filePath: string) => {
        const { data } = supabase.storage.from("client-assets").getPublicUrl(filePath);
        return data.publicUrl;
    };

    const filteredAssets = assets?.filter(a =>
        a.name.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
                <div className="relative flex-1 w-full">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Buscar arquivos..."
                        className="pl-10 bg-background/50 backdrop-blur-md border-slate-200/50 dark:border-slate-800/50"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </div>

                <div className="flex items-center gap-2 w-full md:w-auto">
                    <label className="flex-1 md:flex-none">
                        <Input
                            type="file"
                            className="hidden"
                            onChange={handleFileUpload}
                            disabled={isUploading}
                        />
                        <Button
                            variant="default"
                            className="w-full bg-primary hover:bg-primary/90 shadow-lg shadow-primary/20 transition-all active:scale-95"
                            asChild
                            disabled={isUploading}
                        >
                            <span>
                                {isUploading ? (
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                ) : (
                                    <UploadCloud className="mr-2 h-4 w-4" />
                                )}
                                Enviar Arquivo
                            </span>
                        </Button>
                    </label>
                </div>
            </div>

            {isLoading ? (
                <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
                    <Loader2 className="h-8 w-8 animate-spin mb-4" />
                    <p>Carregando arquivos e criativos...</p>
                </div>
            ) : filteredAssets?.length === 0 ? (
                <Card className="border-dashed bg-muted/20 border-2">
                    <CardContent className="flex flex-col items-center justify-center py-16 text-center">
                        <div className="p-4 rounded-full bg-background shadow-sm mb-4">
                            <UploadCloud className="h-10 w-10 text-muted-foreground/40" />
                        </div>
                        <h3 className="text-lg font-semibold">Nenhum arquivo encontrado</h3>
                        <p className="text-muted-foreground max-w-sm mx-auto mt-2">
                            Ainda não há criativos ou arquivos registrados para este cliente. Comece enviando o primeiro material.
                        </p>
                    </CardContent>
                </Card>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {filteredAssets?.map((asset) => (
                        <Card
                            key={asset.id}
                            className="group relative overflow-hidden bg-background/40 backdrop-blur-md border-slate-200/50 dark:border-slate-800/50 hover:shadow-xl hover:border-primary/30 transition-all duration-300"
                        >
                            <CardContent className="p-0">
                                <div className="aspect-video relative overflow-hidden bg-slate-100 dark:bg-slate-900 flex items-center justify-center">
                                    {asset.file_type.startsWith("image/") ? (
                                        <img
                                            src={getPublicUrl(asset.file_path)}
                                            alt={asset.name}
                                            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                                        />
                                    ) : (
                                        <div className="flex flex-col items-center gap-2">
                                            <div className="p-3 rounded-2xl bg-background shadow-md">
                                                {getFileIcon(asset.file_type)}
                                            </div>
                                            <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">{asset.file_type.split("/")[1] || "FILE"}</span>
                                        </div>
                                    )}

                                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                                        <Button
                                            size="icon"
                                            variant="secondary"
                                            className="h-9 w-9 rounded-full shadow-lg"
                                            asChild
                                        >
                                            <a href={getPublicUrl(asset.file_path)} target="_blank" rel="noopener noreferrer">
                                                <ExternalLink className="h-4 w-4" />
                                            </a>
                                        </Button>
                                        <Button
                                            size="icon"
                                            variant="secondary"
                                            className="h-9 w-9 rounded-full shadow-lg"
                                            onClick={() => {
                                                const link = document.createElement("a");
                                                link.href = getPublicUrl(asset.file_path);
                                                link.download = asset.name;
                                                link.click();
                                            }}
                                        >
                                            <Download className="h-4 w-4" />
                                        </Button>
                                    </div>
                                </div>

                                <div className="p-3">
                                    <div className="flex items-start justify-between gap-2">
                                        <div className="flex-1 min-w-0">
                                            <h4 className="text-sm font-bold truncate group-hover:text-primary transition-colors" title={asset.name}>
                                                {asset.name}
                                            </h4>
                                            <div className="flex items-center gap-2 mt-1">
                                                <span className="text-[10px] text-muted-foreground font-medium">
                                                    {formatFileSize(asset.size)}
                                                </span>
                                                <span className="text-[10px] text-muted-foreground/30">•</span>
                                                <span className="text-[10px] text-muted-foreground font-medium">
                                                    {format(new Date(asset.created_at), "dd/MM/yyyy")}
                                                </span>
                                            </div>
                                        </div>

                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <Button variant="ghost" size="icon" className="h-7 w-7 rounded-full hover:bg-muted opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <MoreVertical className="h-4 w-4" />
                                                </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end">
                                                <DropdownMenuItem
                                                    className="text-destructive focus:text-destructive"
                                                    onClick={() => deleteMutation.mutate(asset)}
                                                >
                                                    <Trash2 className="mr-2 h-4 w-4" />
                                                    Excluir permanentemente
                                                </DropdownMenuItem>
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    </div>

                                    <div className="mt-3 flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <div className="w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center">
                                                <span className="text-[9px] font-black text-primary uppercase">
                                                    {asset.profiles?.full_name?.charAt(0) || "U"}
                                                </span>
                                            </div>
                                            <span className="text-[10px] text-muted-foreground font-semibold truncate max-w-[80px]">
                                                {asset.profiles?.full_name?.split(" ")[0] || "Sistema"}
                                            </span>
                                        </div>
                                        <Badge variant="outline" className="text-[8px] h-4 px-1 uppercase font-black border-slate-200 dark:border-slate-800">
                                            {asset.file_type.split("/")[1]?.substring(0, 4) || "FILE"}
                                        </Badge>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}
        </div>
    );
}

