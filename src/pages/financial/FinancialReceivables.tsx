import { ReceivablesList } from "@/components/financial/ReceivablesList";

export default function FinancialReceivables() {
    return (
        <div className="space-y-4">
            <div className="flex flex-col gap-1">
                <h1 className="text-2xl font-bold">Contas a Receber</h1>
                <p className="text-muted-foreground">Gerencie seus recebimentos.</p>
            </div>
            <ReceivablesList />
        </div>
    );
}
