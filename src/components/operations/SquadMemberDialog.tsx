
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { SquadRole } from "@/types/operations";

interface SquadMemberDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    squadId: string;
    workspaceId: string;
    existingMemberIds: string[];
}

export function SquadMemberDialog({ open, onOpenChange, squadId, workspaceId, existingMemberIds }: SquadMemberDialogProps) {
    const { toast } = useToast();
    const queryClient = useQueryClient();
    const [selectedUserId, setSelectedUserId] = useState<string>("");
    const [role, setRole] = useState<SquadRole>("member");

    const { data: availableUsers, isLoading } = useQuery({
        queryKey: ["available-squad-users", workspaceId, squadId],
        queryFn: async () => {
            const { data, error } = await supabase
                .from("workspace_members")
                .select(`
          user_id,
          profiles (
            id,
            full_name,
            email
          )
        `)
                .eq("workspace_id", workspaceId);

            if (error) throw error;

            // Filter out users already in the squad
            // Note: Casting data to any to handle type issues
            const users = (data as any[]).map(m => m.profiles).filter(p => p !== null);
            return users.filter((u: any) => !existingMemberIds.includes(u.id));
        },
        enabled: open && !!workspaceId,
    });

    const mutation = useMutation({
        mutationFn: async () => {
            if (!selectedUserId) throw new Error("Selecione um usuário");

            const { error } = await (supabase as any)
                .from("squad_members")
                .insert({
                    squad_id: squadId,
                    user_id: selectedUserId,
                    role: role
                });

            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["squad-members", squadId] });
            toast({
                title: "Membro adicionado",
                description: "O usuário foi adicionado ao squad com sucesso.",
            });
            onOpenChange(false);
            setSelectedUserId("");
            setRole("member");
        },
        onError: (error) => {
            console.error("Error adding squad member:", error);
            toast({
                variant: "destructive",
                title: "Erro ao adicionar membro",
                description: "Não foi possível adicionar o membro ao squad.",
            });
        },
    });

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Adicionar Membro ao Squad</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-4">
                    <div className="space-y-2">
                        <Label htmlFor="user">Usuário</Label>
                        <Select onValueChange={setSelectedUserId} value={selectedUserId}>
                            <SelectTrigger>
                                <SelectValue placeholder="Selecione um usuário" />
                            </SelectTrigger>
                            <SelectContent>
                                {isLoading ? (
                                    <SelectItem value="loading" disabled>Carregando...</SelectItem>
                                ) : availableUsers?.length === 0 ? (
                                    <SelectItem value="none" disabled>Todos os membros já estão no squad</SelectItem>
                                ) : (
                                    availableUsers?.map((user: any) => (
                                        <SelectItem key={user.id} value={user.id}>
                                            {user.full_name || user.email}
                                        </SelectItem>
                                    ))
                                )}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="role">Função no Squad</Label>
                        <Select onValueChange={(val) => setRole(val as SquadRole)} value={role}>
                            <SelectTrigger>
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="member">Membro</SelectItem>
                                <SelectItem value="leader">Líder</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
                    <Button onClick={() => mutation.mutate()} disabled={!selectedUserId || mutation.isPending}>
                        {mutation.isPending ? "Adicionando..." : "Adicionar"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
