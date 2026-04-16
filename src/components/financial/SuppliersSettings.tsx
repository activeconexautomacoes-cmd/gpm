
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Plus, Search, Building2, Pencil } from "lucide-react";
import { useSuppliers } from "@/hooks/useFinancialModules";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { SupplierForm } from "./SupplierForm";
import { useState } from "react";
import { SupplierRowActions } from "./SupplierRowActions";
import { Input } from "@/components/ui/input";

export function SuppliersSettings() {
    const { currentWorkspace } = useWorkspace();
    const { suppliers, isLoading } = useSuppliers(currentWorkspace?.id);
    const [supplierToEdit, setSupplierToEdit] = useState<any>(null);
    const [search, setSearch] = useState("");

    const filteredSuppliers = suppliers?.filter(s =>
        s.name.toLowerCase().includes(search.toLowerCase()) ||
        s.document?.includes(search) ||
        s.email?.toLowerCase().includes(search.toLowerCase())
    );

    const handleEdit = (supplier: any) => {
        setSupplierToEdit(supplier);
    };

    return (
        <div className="space-y-4">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div className="space-y-1">
                    <h3 className="text-lg font-medium">Fornecedores</h3>
                    <p className="text-sm text-muted-foreground">
                        Gestão de fornecedores para contas a pagar.
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <div className="relative w-64">
                        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Buscar fornecedor..."
                            className="pl-9"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                        />
                    </div>
                    <SupplierForm
                        onSuccess={() => setSupplierToEdit(null)}
                        trigger={
                            <Button>
                                <Plus className="mr-2 h-4 w-4" />
                                Novo Fornecedor
                            </Button>
                        }
                    />
                </div>
            </div>

            {/* Modal de Edição (controlado via estado) */}
            {supplierToEdit && (
                <SupplierForm
                    initialData={supplierToEdit}
                    onSuccess={() => setSupplierToEdit(null)}
                    trigger={<div className="hidden" />} // Hidden trigger as it's controlled
                // Note: In current SupplierForm, Dialog is controlled by internal state 'open' 
                // and trigger. Since I want to open it from here based on setSupplierToEdit, 
                // I'll update SupplierForm to accept 'open' prop or just use its DialogTrigger.
                // Actually, let's keep it simple: the RowActions will call handeEdit, 
                // and we'll use a separate instance of SupplierForm or update SupplierForm to be controlled.
                />
            )}

            {isLoading ? (
                <div className="flex items-center justify-center p-8">Carregando fornecedores...</div>
            ) : (
                <div className="rounded-md border">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Nome / Razão Social</TableHead>
                                <TableHead>CPF / CNPJ</TableHead>
                                <TableHead>E-mail</TableHead>
                                <TableHead>Telefone</TableHead>
                                <TableHead className="w-[50px]"></TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {filteredSuppliers?.map((supplier) => (
                                <TableRow key={supplier.id} className="hover:bg-slate-50/50">
                                    <TableCell className="font-medium">
                                        <div className="flex items-center gap-2">
                                            <Building2 className="h-4 w-4 text-muted-foreground" />
                                            {supplier.name}
                                        </div>
                                    </TableCell>
                                    <TableCell>{supplier.document || "-"}</TableCell>
                                    <TableCell>{supplier.email || "-"}</TableCell>
                                    <TableCell>{supplier.phone || "-"}</TableCell>
                                    <TableCell className="flex justify-end gap-2">
                                        <SupplierForm
                                            initialData={supplier}
                                            trigger={
                                                <Button variant="ghost" size="icon" className="h-8 w-8">
                                                    <Pencil className="h-4 w-4 text-muted-foreground hover:text-primary transition-colors" />
                                                </Button>
                                            }
                                        />
                                        <SupplierRowActions
                                            supplier={supplier}
                                            onEdit={() => { }}
                                        />
                                    </TableCell>
                                </TableRow>
                            ))}

                            {!filteredSuppliers?.length && (
                                <TableRow>
                                    <TableCell colSpan={5} className="text-center text-muted-foreground py-12">
                                        Nenhum fornecedor encontrado.
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
