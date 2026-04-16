
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ArrowLeft, UserPlus, Trash2, Crown } from "lucide-react";
import { SquadMemberDialog } from "@/components/operations/SquadMemberDialog";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface SquadDetailsType {
    id: string;
    name: string;
    color: string;
    workspace_id: string;
}

interface SquadMemberDetails {
    id: string;
    user_id: string;
    role: 'member' | 'leader';
    created_at: string;
    profiles: {
        full_name: string;
        email: string;
        avatar_url: string;
    };
}

export default function SquadDetails() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const { currentWorkspace, can } = useWorkspace();
    const { toast } = useToast();
    const queryClient = useQueryClient();
    const [isAddMemberOpen, setIsAddMemberOpen] = useState(false);
    const [memberToRemove, setMemberToRemove] = useState<SquadMemberDetails | null>(null);

    const { data: squad, isLoading: isSquadLoading } = useQuery({
        queryKey: ["squad", id],
        queryFn: async () => {
            const { data, error } = await (supabase as any)
                .from("squads")
                .select("*")
                .eq("id", id)
                .single();

            if (error) throw error;
            return data as SquadDetailsType;
        },
        enabled: !!id,
    });

    const { data: members, isLoading: isMembersLoading } = useQuery({
        queryKey: ["squad-members", id],
        queryFn: async () => {
            const { data, error } = await (supabase as any)
                .from("squad_members")
                .select(`
          *,
          profiles (
            full_name,
            email,
            avatar_url
          )
        `)
                .eq("squad_id", id);

            if (error) throw error;
            return data as unknown as SquadMemberDetails[];
        },
        enabled: !!id,
    });

    const removeMemberMutation = useMutation({
        mutationFn: async (memberId: string) => {
            const { error } = await (supabase as any)
                .from("squad_members")
                .delete()
                .eq("id", memberId);

            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["squad-members", id] });
            // Also invalidate available users query if needed, relying on query key
            queryClient.invalidateQueries({ queryKey: ["available-squad-users"] });
            toast({
                title: "Membro removido",
                description: "O membro foi removido do squad.",
            });
            setMemberToRemove(null);
        },
        onError: (error) => {
            console.error("Error removing member:", error);
            toast({
                variant: "destructive",
                title: "Erro ao remover",
                description: "Não foi possível remover o membro do squad.",
            });
        },
    });

    if (isSquadLoading) {
        return <div className="container mx-auto p-6 text-center">Carregando squad...</div>;
    }

    if (!squad) {
        return <div className="container mx-auto p-6 text-center">Squad não encontrado.</div>;
    }

    return (
        <div className="container mx-auto p-6 space-y-6">
            <div className="flex items-center gap-4">
                <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard/settings?tab=squads")}>
                    <ArrowLeft className="h-4 w-4" />
                </Button>
                <div>
                    <h1 className="text-3xl font-bold flex items-center gap-2">
                        <div className="w-4 h-4 rounded-full" style={{ backgroundColor: squad.color || "#000" }} />
                        {squad.name}
                    </h1>
                    <p className="text-muted-foreground">Gerencie os membros e detalhes deste squad.</p>
                </div>
            </div>

            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <div>
                        <CardTitle>Membros</CardTitle>
                        <CardDescription>Pessoas alocadas neste squad.</CardDescription>
                    </div>
                    {can("ops.manage") && (
                        <Button onClick={() => setIsAddMemberOpen(true)}>
                            <UserPlus className="mr-2 h-4 w-4" />
                            Adicionar Membro
                        </Button>
                    )}
                </CardHeader>
                <CardContent>
                    {isMembersLoading ? (
                        <div className="text-center py-4">Carregando membros...</div>
                    ) : members && members.length > 0 ? (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Nome</TableHead>
                                    <TableHead>Email</TableHead>
                                    <TableHead>Função</TableHead>
                                    <TableHead>Entrou em</TableHead>
                                    <TableHead className="w-[50px]"></TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {members.map((member) => (
                                    <TableRow key={member.id}>
                                        <TableCell className="font-medium">
                                            {member.profiles?.full_name || "Sem nome"}
                                        </TableCell>
                                        <TableCell>{member.profiles?.email}</TableCell>
                                        <TableCell>
                                            {member.role === 'leader' ? (
                                                <Badge variant="default" className="gap-1">
                                                    <Crown className="h-3 w-3" /> Líder
                                                </Badge>
                                            ) : (
                                                <Badge variant="outline">Membro</Badge>
                                            )}
                                        </TableCell>
                                        <TableCell>
                                            {format(new Date(member.created_at), "dd/MM/yyyy")}
                                        </TableCell>
                                        <TableCell>
                                            {can("ops.manage") && (
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="hover:text-destructive"
                                                    onClick={() => setMemberToRemove(member)}
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            )}
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    ) : (
                        <div className="text-center py-8 text-muted-foreground">
                            Este squad ainda não possui membros.
                        </div>
                    )}
                </CardContent>
            </Card>

            {currentWorkspace && (
                <SquadMemberDialog
                    open={isAddMemberOpen}
                    onOpenChange={setIsAddMemberOpen}
                    squadId={squad.id}
                    workspaceId={currentWorkspace.id}
                    existingMemberIds={members?.map(m => m.user_id) || []}
                />
            )}

            <AlertDialog open={!!memberToRemove} onOpenChange={(open) => !open && setMemberToRemove(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Remover membro?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Tem certeza que deseja remover {memberToRemove?.profiles?.full_name} deste squad?
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            onClick={() => memberToRemove && removeMemberMutation.mutate(memberToRemove.id)}
                        >
                            Remover
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
