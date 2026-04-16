
import { SuppliersSettings } from "@/components/financial/SuppliersSettings";

export default function Suppliers() {
    return (
        <div className="container mx-auto p-4 md:p-6 space-y-6">
            <div className="flex justify-between items-center border-b pb-4">
                <div>
                    <h1 className="text-3xl font-bold">Gestão de Fornecedores</h1>
                    <p className="text-muted-foreground">Visualize e edite os dados dos seus fornecedores.</p>
                </div>
            </div>
            <SuppliersSettings />
        </div>
    );
}
