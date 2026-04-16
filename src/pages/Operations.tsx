
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { Users } from "lucide-react";
import { ClientPortfolio } from "@/components/operations/ClientPortfolio";

export default function Operations() {
    const { can } = useWorkspace();

    if (!can("ops.view")) {
        return (
            <div className="container mx-auto p-6 flex flex-col items-center justify-center h-[50vh]">
                <Users className="h-16 w-16 text-muted-foreground mb-4" />
                <h2 className="text-xl font-semibold mb-2">Acesso Restrito</h2>
                <p className="text-muted-foreground">Você não tem permissão para visualizar a área de operações.</p>
            </div>
        );
    }

    return (
        <div className="container mx-auto p-6 space-y-6">
            <div className="flex flex-col gap-2">
                <h1 className="text-3xl font-bold">Operações</h1>
            </div>

            <ClientPortfolio />
        </div>
    );
}
