import { BankReconciliation } from "@/components/financial/BankReconciliation";

export default function FinancialReconciliation() {
    return (
        <div className="space-y-4">
            <div className="flex flex-col gap-1">
                <h1 className="text-2xl font-bold">Conciliação Bancária</h1>
                <p className="text-muted-foreground">Importe OFX e concilie suas transações.</p>
            </div>
            <BankReconciliation />
        </div>
    );
}
