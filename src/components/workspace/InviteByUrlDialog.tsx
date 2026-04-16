
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Copy, Check, Trash2, Link as LinkIcon } from "lucide-react";
import { format } from "date-fns";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

interface InviteByUrlDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    roles: any[];
}

export function InviteByUrlDialog({ open, onOpenChange, roles }: InviteByUrlDialogProps) {
    const { currentWorkspace, user } = useWorkspace();
    const { toast } = useToast();
    const queryClient = useQueryClient();
    const [selectedRole, setSelectedRole] = useState<string>("");
    const [expiration, setExpiration] = useState<string>("24h");
    const [copiedId, setCopiedId] = useState<string | null>(null);

    const { data: inviteLinks, isLoading } = useQuery({
        queryKey: ["workspace-invite-links", currentWorkspace?.id],
        queryFn: async () => {
            if (!currentWorkspace?.id) return [];
            const { data, error } = await (supabase as any)
                .from("workspace_invite_links")
                .select(`
          *,
          roles(name)
        `)
                .eq("workspace_id", currentWorkspace.id)
                .eq("active", true)
                .order("created_at", { ascending: false });

            if (error) throw error;
            return data as any[];
        },
        enabled: open && !!currentWorkspace?.id,
    });

    const createMutation = useMutation({
        mutationFn: async () => {
            if (!selectedRole || !currentWorkspace?.id || !user?.id) return;

            const code = Math.random().toString(36).substring(2, 10);
            let expiresAt: Date | null = null;

            if (expiration !== "never") {
                expiresAt = new Date();
                if (expiration === "24h") expiresAt.setHours(expiresAt.getHours() + 24);
                else if (expiration === "48h") expiresAt.setHours(expiresAt.getHours() + 48);
                else if (expiration === "1w") expiresAt.setDate(expiresAt.getDate() + 7);
            }

            const { error } = await (supabase as any)
                .from("workspace_invite_links")
                .insert({
                    code,
                    workspace_id: currentWorkspace.id,
                    role_id: selectedRole,
                    created_by: user.id,
                    expires_at: expiresAt?.toISOString(),
                });

            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["workspace-invite-links"] });
            toast({
                title: "Link de convite criado",
                description: "O link foi gerado com sucesso.",
            });
            setSelectedRole("");
        },
        onError: (error) => {
            toast({
                variant: "destructive",
                title: "Erro ao criar link",
                description: error.message,
            });
        },
    });

    const deleteMutation = useMutation({
        mutationFn: async (id: string) => {
            const { error } = await (supabase as any)
                .from("workspace_invite_links")
                .update({ active: false })
                .eq("id", id);
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["workspace-invite-links"] });
            toast({
                title: "Link removido",
                description: "O link de convite foi desativado.",
            });
        },
    });

    const copyToClipboard = (code: string) => {
        const url = `${window.location.origin}/invite/${code}`;
        navigator.clipboard.writeText(url);
        setCopiedId(code);
        setTimeout(() => setCopiedId(null), 2000);
        toast({
            title: "Link copiado!",
            description: "O link de convite foi copiado para a área de transferência.",
        });
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[600px]">
                <DialogHeader>
                    <DialogTitle>Convidar por URL</DialogTitle>
                    <DialogDescription>
                        Crie links que permitem que qualquer pessoa entre no workspace com um perfil específico.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-6 py-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>Perfil de entrada</Label>
                            <Select value={selectedRole} onValueChange={setSelectedRole}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Selecione um perfil" />
                                </SelectTrigger>
                                <SelectContent>
                                    {roles.map((role) => (
                                        <SelectItem key={role.id} value={role.id}>
                                            {role.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label>Expiração</Label>
                            <Select value={expiration} onValueChange={setExpiration}>
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="24h">24 horas</SelectItem>
                                    <SelectItem value="48h">48 horas</SelectItem>
                                    <SelectItem value="1w">1 semana</SelectItem>
                                    <SelectItem value="never">Nunca</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                    <Button
                        className="w-full"
                        onClick={() => createMutation.mutate()}
                        disabled={!selectedRole || createMutation.isPending}
                    >
                        <LinkIcon className="mr-2 h-4 w-4" />
                        Gerar novo link
                    </Button>

                    <div className="space-y-2">
                        <h3 className="text-sm font-semibold">Links Ativos</h3>
                        {isLoading ? (
                            <div className="text-center py-4 text-sm text-muted-foreground">Carregando links...</div>
                        ) : inviteLinks && inviteLinks.length > 0 ? (
                            <div className="border rounded-md">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Perfil</TableHead>
                                            <TableHead>Expira em</TableHead>
                                            <TableHead>Usos</TableHead>
                                            <TableHead className="text-right">Ações</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {inviteLinks.map((link) => (
                                            <TableRow key={link.id}>
                                                <TableCell className="font-medium">{link.roles?.name}</TableCell>
                                                <TableCell className="text-xs">
                                                    {link.expires_at
                                                        ? format(new Date(link.expires_at), "dd/MM/yyyy HH:mm")
                                                        : "Nunca"}
                                                </TableCell>
                                                <TableCell>{link.current_uses}</TableCell>
                                                <TableCell className="text-right space-x-2">
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        onClick={() => copyToClipboard(link.code)}
                                                    >
                                                        {copiedId === link.code ? (
                                                            <Check className="h-4 w-4 text-green-500" />
                                                        ) : (
                                                            <Copy className="h-4 w-4" />
                                                        )}
                                                    </Button>
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="text-destructive hover:text-destructive"
                                                        onClick={() => deleteMutation.mutate(link.id)}
                                                    >
                                                        <Trash2 className="h-4 w-4" />
                                                    </Button>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>
                        ) : (
                            <div className="text-center py-8 border rounded-md border-dashed text-sm text-muted-foreground">
                                Nenhum link ativo.
                            </div>
                        )}
                    </div>
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>Fechar</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
