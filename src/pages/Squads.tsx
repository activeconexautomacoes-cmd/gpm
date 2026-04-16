
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, MoreVertical, Trash2, Edit, Users, UserPlus } from "lucide-react";
import { SquadDialog } from "@/components/operations/SquadDialog";
import { Squad } from "@/types/operations";
import { useNavigate } from "react-router-dom";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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

interface SquadWithDetails extends Squad {
    leader?: {
        full_name: string;
    };
    squad_members?: { count: number }[];
}

export default function Squads() {
    const { currentWorkspace, can } = useWorkspace();
    const { toast } = useToast();
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [squadToEdit, setSquadToEdit] = useState<Squad | null>(null);
    const [squadToDelete, setSquadToDelete] = useState<Squad | null>(null);

    const { data: squads, isLoading } = useQuery({
        queryKey: ["squads", currentWorkspace?.id],
        queryFn: async () => {
            if (!currentWorkspace?.id) return [];
            // Note: _count might need a specific RPC or separate query if Supabase doesn't support it directly in select for simple joins easily without correct setup, 
            // but select(*, squad_members(count)) works if foreign keys are right. 
            // For now, let's try standard select.
            const { data, error } = await (supabase as any)
                .from("squads")
                .select(`
          *,
          leader:leader_id (
            full_name
          ),
          squad_members(count)
        `)
                .eq("workspace_id", currentWorkspace.id)
                .order("created_at", { ascending: false });

            if (error) throw error;
            return data as unknown as SquadWithDetails[];
        },
        enabled: !!currentWorkspace?.id,
    });

    const deleteMutation = useMutation({
        mutationFn: async (id: string) => {
            const { error } = await (supabase as any).from("squads").delete().eq("id", id);
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["squads"] });
            toast({
                title: "Squad deletado",
                description: "O squad foi removido com sucesso.",
            });
            setSquadToDelete(null);
        },
        onError: (error) => {
            console.error("Error deleting squad:", error);
            toast({
                variant: "destructive",
                title: "Erro ao deletar",
                description: "Não foi possível remover o squad.",
            });
        },
    });

    const handleEdit = (squad: Squad) => {
        setSquadToEdit(squad);
        setIsDialogOpen(true);
    };

    const handleCreate = () => {
        setSquadToEdit(null);
        setIsDialogOpen(true);
    };

    if (!can("ops.view")) {
        return (
            <div className="container mx-auto p-6 flex flex-col items-center justify-center h-[50vh]">
                <Users className="h-16 w-16 text-muted-foreground mb-4" />
                <h2 className="text-xl font-semibold mb-2">Acesso Restrito</h2>
                <p className="text-muted-foreground">Você não tem permissão para visualizar squads.</p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-xl font-bold">Gerenciamento de Squads</h2>
                    <p className="text-muted-foreground">Organize seu time em squads para melhor gestão.</p>
                </div>
                {can("ops.manage") && (
                    <Button onClick={handleCreate}>
                        <Plus className="mr-2 h-4 w-4" />
                        Novo Squad
                    </Button>
                )}
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Squads Ativos</CardTitle>
                    <CardDescription>Lista de todos os squads do workspace atual.</CardDescription>
                </CardHeader>
                <CardContent>
                    {isLoading ? (
                        <div className="text-center py-8">Carregando...</div>
                    ) : squads && squads.length > 0 ? (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Cor</TableHead>
                                    <TableHead>Nome</TableHead>
                                    <TableHead>Líder</TableHead>
                                    <TableHead>Membros</TableHead>
                                    <TableHead>Criado em</TableHead>
                                    <TableHead className="w-[50px]"></TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {squads.map((squad) => (
                                    <TableRow key={squad.id}>
                                        <TableCell>
                                            <div className="w-6 h-6 rounded-full border" style={{ backgroundColor: squad.color || "#000" }} />
                                        </TableCell>
                                        <TableCell className="font-medium">
                                            <button
                                                onClick={() => navigate(`/dashboard/squads/${squad.id}`)}
                                                className="hover:underline text-left font-medium"
                                            >
                                                {squad.name}
                                            </button>
                                        </TableCell>
                                        <TableCell>
                                            {squad.leader?.full_name || (
                                                <span className="text-muted-foreground italic">Sem líder</span>
                                            )}
                                        </TableCell>
                                        <TableCell>
                                            <Badge variant="secondary">
                                                {squad.squad_members?.[0]?.count || 0} integrantes
                                            </Badge>
                                        </TableCell>
                                        <TableCell>
                                            {format(new Date(squad.created_at), "dd/MM/yyyy")}
                                        </TableCell>
                                        <TableCell>
                                            {can("ops.manage") && (
                                                <DropdownMenu>
                                                    <DropdownMenuTrigger asChild>
                                                        <Button variant="ghost" size="icon">
                                                            <MoreVertical className="h-4 w-4" />
                                                        </Button>
                                                    </DropdownMenuTrigger>
                                                    <DropdownMenuContent align="end">
                                                        <DropdownMenuItem onClick={() => navigate(`/dashboard/squads/${squad.id}`)}>
                                                            <UserPlus className="mr-2 h-4 w-4" />
                                                            Gerenciar Membros
                                                        </DropdownMenuItem>
                                                        <DropdownMenuItem onClick={() => handleEdit(squad)}>
                                                            <Edit className="mr-2 h-4 w-4" />
                                                            Editar
                                                        </DropdownMenuItem>
                                                        <DropdownMenuItem
                                                            className="text-destructive focus:text-destructive"
                                                            onClick={() => setSquadToDelete(squad)}
                                                        >
                                                            <Trash2 className="mr-2 h-4 w-4" />
                                                            Excluir
                                                        </DropdownMenuItem>
                                                    </DropdownMenuContent>
                                                </DropdownMenu>
                                            )}
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    ) : (
                        <div className="text-center py-12 text-muted-foreground flex flex-col items-center">
                            <Users className="h-12 w-12 mb-4 opacity-20" />
                            <p>Nenhum squad encontrado.</p>
                            {can("ops.manage") && (
                                <Button variant="link" onClick={handleCreate}>
                                    Criar o primeiro squad
                                </Button>
                            )}
                        </div>
                    )}
                </CardContent>
            </Card>

            <SquadDialog
                open={isDialogOpen}
                onOpenChange={setIsDialogOpen}
                squadToEdit={squadToEdit}
            />

            <AlertDialog open={!!squadToDelete} onOpenChange={(open) => !open && setSquadToDelete(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Tem certeza?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Esta ação não pode ser desfeita. Isso excluirá permanentemente o squad
                            <strong> {squadToDelete?.name}</strong> e removerá as associações de membros.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            onClick={() => squadToDelete && deleteMutation.mutate(squadToDelete.id)}
                        >
                            Excluir
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
