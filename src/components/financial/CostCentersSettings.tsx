
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { useCostCenters } from "@/hooks/useFinancialModules";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { CostCenterForm } from "./CostCenterForm";
import { useState } from "react";
import { CostCenterRowActions } from "./CostCenterRowActions";

export function CostCentersSettings() {
    const { currentWorkspace } = useWorkspace();
    const { costCenters, isLoading } = useCostCenters(currentWorkspace?.id);
    const [costCenterToEdit, setCostCenterToEdit] = useState<any>(null);
    const [isEditOpen, setIsEditOpen] = useState(false);

    const handleEditCostCenter = (costCenter: any) => {
        setCostCenterToEdit(costCenter);
        setIsEditOpen(true);
    };

    return (
        <div className="space-y-4">
            <div className="flex justify-between items-center">
                <div className="space-y-1">
                    <h3 className="text-lg font-medium">Centros de Custo</h3>
                    <p className="text-sm text-muted-foreground">
                        Gerencie seus centros de custo.
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <Button onClick={() => { setCostCenterToEdit(null); setIsEditOpen(true); }}>
                        <Plus className="mr-2 h-4 w-4" />
                        Novo
                    </Button>
                    <CostCenterForm
                        costCenterToEdit={costCenterToEdit}
                        open={isEditOpen}
                        onOpenChange={(open) => {
                            setIsEditOpen(open);
                            if (!open) setCostCenterToEdit(null);
                        }}
                    />
                </div>
            </div>

            {isLoading ? (
                <div>Carregando centros de custo...</div>
            ) : (
                <div className="rounded-md border">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Nome</TableHead>
                                <TableHead>Código</TableHead>
                                <TableHead className="w-[50px]"></TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {costCenters?.map((cc) => (
                                <TableRow key={cc.id}>
                                    <TableCell className="font-medium">{cc.name}</TableCell>
                                    <TableCell>{cc.code || "-"}</TableCell>
                                    <TableCell>
                                        <CostCenterRowActions costCenter={cc} onEdit={() => handleEditCostCenter(cc)} />
                                    </TableCell>
                                </TableRow>
                            ))}
                            {!costCenters?.length && (
                                <TableRow>
                                    <TableCell colSpan={3} className="text-center text-muted-foreground py-4">
                                        Nenhum centro de custo cadastrado.
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
