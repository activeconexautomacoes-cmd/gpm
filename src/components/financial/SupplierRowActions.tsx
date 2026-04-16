
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { MoreHorizontal, Edit2, Trash2 } from "lucide-react";
import { useSuppliers } from "@/hooks/useFinancialModules";
import { useToast } from "@/hooks/use-toast";

interface SupplierRowActionsProps {
    supplier: any;
    onEdit: () => void;
}

export function SupplierRowActions({ supplier, onEdit }: SupplierRowActionsProps) {
    const { deleteSupplier } = useSuppliers();
    const { toast } = useToast();

    const handleDelete = async () => {
        if (window.confirm(`Tem certeza que deseja excluir o fornecedor "${supplier.name}"?`)) {
            try {
                await deleteSupplier.mutateAsync(supplier.id);
                toast({ title: "Sucesso", description: "Fornecedor excluído com sucesso." });
            } catch (error) {
                toast({
                    title: "Erro",
                    description: "Não foi possível excluir o fornecedor.",
                    variant: "destructive",
                });
            }
        }
    };

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="h-8 w-8 p-0">
                    <MoreHorizontal className="h-4 w-4" />
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
                <DropdownMenuLabel>Ações</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={onEdit}>
                    <Edit2 className="h-4 w-4 mr-2" /> Editar
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleDelete} className="text-destructive">
                    <Trash2 className="h-4 w-4 mr-2" /> Excluir
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
