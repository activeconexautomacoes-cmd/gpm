import { PayablesList } from "@/components/financial/PayablesList";

export default function FinancialPayables() {
    return (
        <div className="space-y-4">
            <div className="flex flex-col gap-1">
                <h1 className="text-2xl font-bold">Contas a Pagar</h1>
                <p className="text-muted-foreground">Gerencie seus pagamentos.</p>
            </div>
            <PayablesList />
        </div>
    );
}
