
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { MoreHorizontal, Pencil, Trash, Archive } from "lucide-react";
import { useCostCenters } from "@/hooks/useFinancialModules";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Database } from "@/integrations/supabase/types";

export function CostCenterRowActions({ costCenter, onEdit }: { costCenter: any; onEdit: () => void }) {
    const { deleteCostCenter, updateCostCenter } = useCostCenters();
    const { toast } = useToast();

    const handleDelete = async () => {
        try {
            // Check dependencies
            const { count: recCount } = await supabase.from('financial_receivables').select('*', { count: 'exact', head: true }).eq('cost_center_id', costCenter.id);
            const { count: payCount } = await supabase.from('financial_payables').select('*', { count: 'exact', head: true }).eq('cost_center_id', costCenter.id);

            const totalDeps = (recCount || 0) + (payCount || 0);

            if (totalDeps > 0) {
                // Must archive
                if (!confirm(`Este centro de custo possui ${totalDeps} lançamentos vinculados e não pode ser excluído. Deseja arquivá-lo (inativar)?`)) return;

                await updateCostCenter.mutateAsync({ id: costCenter.id, active: false });
                toast({ title: "Arquivo", description: "Centro de custo arquivado com sucesso." });
            } else {
                if (!confirm("Tem certeza que deseja excluir este centro de custo?")) return;
                await deleteCostCenter.mutateAsync(costCenter.id);
                toast({ title: "Excluído", description: "Centro de custo excluído com sucesso." });
            }
        } catch (error) {
            console.error(error);
            toast({ title: "Erro", description: "Erro ao processar ação.", variant: "destructive" });
        }
    };

    const handleArchive = async () => {
        await updateCostCenter.mutateAsync({ id: costCenter.id, active: !costCenter.active });
        toast({ title: "Atualizado", description: `Centro de custo ${!costCenter.active ? 'ativado' : 'inativado'} com sucesso.` });
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
                    {costCenter.active !== false ? 'Arquivar' : 'Ativar'}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleDelete} className="text-red-600">
                    <Trash className="mr-2 h-4 w-4" />
                    Excluir
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
