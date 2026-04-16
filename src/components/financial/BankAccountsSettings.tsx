
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { useBankAccounts } from "@/hooks/useFinancialModules";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { BankAccountForm } from "./BankAccountForm";
import { formatCurrency } from "@/utils/format";
import { useState } from "react";
import { BankAccountRowActions } from "./BankAccountRowActions";

export function BankAccountsSettings() {
    const { currentWorkspace } = useWorkspace();
    const { accounts, isLoading } = useBankAccounts(currentWorkspace?.id);
    const [accountToEdit, setAccountToEdit] = useState<any>(null);
    const [isEditOpen, setIsEditOpen] = useState(false);

    const handleEditAccount = (account: any) => {
        setAccountToEdit(account);
        setIsEditOpen(true);
    };

    return (
        <div className="space-y-4">
            <div className="flex justify-between items-center">
                <div className="space-y-1">
                    <h3 className="text-lg font-medium">Contas Bancárias</h3>
                    <p className="text-sm text-muted-foreground">
                        Gerencie suas contas bancárias e saldos.
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <Button onClick={() => { setAccountToEdit(null); setIsEditOpen(true); }}>
                        <Plus className="mr-2 h-4 w-4" />
                        Nova Conta
                    </Button>
                    <BankAccountForm
                        accountToEdit={accountToEdit}
                        open={isEditOpen}
                        onOpenChange={(open) => {
                            setIsEditOpen(open);
                            if (!open) setAccountToEdit(null);
                        }}
                    />
                </div>
            </div>

            {isLoading ? (
                <div>Carregando contas...</div>
            ) : (
                <div className="rounded-md border">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Nome</TableHead>
                                <TableHead className="text-right">Saldo Atual</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead className="w-[50px]"></TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {accounts?.map((acc) => (
                                <TableRow key={acc.id}>
                                    <TableCell className="font-medium">{acc.name}</TableCell>
                                    <TableCell className="text-right">{formatCurrency(acc.current_balance || 0)}</TableCell>
                                    <TableCell>
                                        <Badge variant={acc.is_active ? "success" : "secondary"}>
                                            {acc.is_active ? "Ativa" : "Inativa"}
                                        </Badge>
                                    </TableCell>
                                    <TableCell>
                                        <BankAccountRowActions account={acc} onEdit={() => handleEditAccount(acc)} />
                                    </TableCell>
                                </TableRow>
                            ))}
                            {!accounts?.length && (
                                <TableRow>
                                    <TableCell colSpan={4} className="text-center text-muted-foreground py-4">
                                        Nenhuma conta cadastrada.
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </div>
            )}
        </div>
    );
}
