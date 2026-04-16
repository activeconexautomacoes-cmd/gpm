
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { MoreHorizontal, Pencil, Trash, Archive } from "lucide-react";
import { useFinancialCategories } from "@/hooks/useFinancialModules";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Database } from "@/integrations/supabase/types";

export function CategoryRowActions({ category, onEdit }: { category: any; onEdit: () => void }) {
    const { currentWorkspace } = useWorkspace();
    const { deleteCategory, updateCategory } = useFinancialCategories(currentWorkspace?.id);
    const { toast } = useToast();

    const handleDelete = async () => {
        try {
            // Check dependencies
            const { count: recCount } = await supabase.from('financial_receivables').select('*', { count: 'exact', head: true }).eq('category_id', category.id);
            const { count: payCount } = await supabase.from('financial_payables').select('*', { count: 'exact', head: true }).eq('category_id', category.id);

            const totalDeps = (recCount || 0) + (payCount || 0);

            if (totalDeps > 0) {
                // Must archive
                if (!confirm(`Esta categoria possui ${totalDeps} lançamentos vinculados e não pode ser excluída. Deseja arquivá-la (inativar)?`)) return;

                await updateCategory.mutateAsync({ id: category.id, workspace_id: currentWorkspace!.id, active: false } as any);
                toast({ title: "Arquivo", description: "Categoria arquivada com sucesso." });
            } else {
                if (!confirm("Tem certeza que deseja excluir esta categoria?")) return;
                await deleteCategory.mutateAsync({ categoryId: category.id, workspaceId: currentWorkspace!.id });
                toast({ title: "Excluída", description: "Categoria excluída com sucesso." });
            }
        } catch (error) {
            console.error(error);
            toast({ title: "Erro", description: "Erro ao processar ação.", variant: "destructive" });
        }
    };

    const handleArchive = async () => {
        await updateCategory.mutateAsync({ id: category.id, workspace_id: currentWorkspace!.id, active: !(category.active !== false) } as any);
        toast({ title: "Atualizado", description: `Categoria ${!(category.active !== false) ? 'ativada' : 'inativada'} com sucesso.` });
    }

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="h-8 w-8 p-0">
                    <span className="sr-only">Abrir menu</span>
                    <MoreHorizontal className="h-4 w-4" />
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
                <DropdownMenuLabel>Ações</DropdownMenuLabel>
                <DropdownMenuItem onClick={onEdit}>
                    <Pencil className="mr-2 h-4 w-4" />
                    Editar
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleArchive}>
                    <Archive className="mr-2 h-4 w-4" />
                    {(category as any).active !== false ? 'Arquivar' : 'Ativar'}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleDelete} className="text-red-600">
                    <Trash className="mr-2 h-4 w-4" />
                    Excluir
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
