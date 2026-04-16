
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { MoreHorizontal, Pencil, Trash, Archive } from "lucide-react";
import { useBankAccounts } from "@/hooks/useFinancialModules";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

export function BankAccountRowActions({ account, onEdit }: { account: any; onEdit: () => void }) {
    const { currentWorkspace } = useWorkspace();
    const { deleteAccount, updateAccount } = useBankAccounts(currentWorkspace?.id);
    const { toast } = useToast();

    const handleDelete = async () => {
        try {
            // Check dependencies
            const { count: recCount } = await supabase.from('financial_receivables').select('*', { count: 'exact', head: true }).eq('bank_account_id', account.id);
            const { count: payCount } = await supabase.from('financial_payables').select('*', { count: 'exact', head: true }).eq('bank_account_id', account.id);
            const { count: transCount } = await supabase.from('financial_bank_transactions').select('*', { count: 'exact', head: true }).eq('bank_account_id', account.id);

            const totalDeps = (recCount || 0) + (payCount || 0) + (transCount || 0);

            if (totalDeps > 0) {
                // Must archive
                if (!confirm(`Esta conta possui ${totalDeps} lançamentos vinculados e não pode ser excluída. Deseja arquivá-la (inativar)?`)) return;

                await updateAccount.mutateAsync({ id: account.id, workspace_id: currentWorkspace!.id, is_active: false });
                toast({ title: "Arquivo", description: "Conta arquivada com sucesso." });
            } else {
                if (!confirm("Tem certeza que deseja excluir esta conta?")) return;
                await deleteAccount.mutateAsync({ accountId: account.id, workspaceId: currentWorkspace!.id });
                toast({ title: "Excluída", description: "Conta excluída com sucesso." });
            }
        } catch (error) {
            console.error(error);
            toast({ title: "Erro", description: "Erro ao processar ação.", variant: "destructive" });
        }
    };

    const handleArchive = async () => {
        await updateAccount.mutateAsync({ id: account.id, workspace_id: currentWorkspace!.id, is_active: !account.is_active });
        toast({ title: "Atualizado", description: `Conta ${!account.is_active ? 'ativada' : 'inativada'} com sucesso.` });
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
                    {account.is_active ? 'Arquivar' : 'Ativar'}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleDelete} className="text-red-600">
                    <Trash className="mr-2 h-4 w-4" />
                    Excluir
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
