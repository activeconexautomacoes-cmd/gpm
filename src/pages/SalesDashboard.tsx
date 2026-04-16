import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { SalesTable } from "@/components/sales/SalesTable";
import { SaleDetails } from "@/components/sales/SaleDetails";
import { Sale } from "@/components/sales/types";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Search, Filter, Download } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function SalesDashboard() {
    const { currentWorkspace } = useWorkspace();
    const [selectedSale, setSelectedSale] = useState<Sale | null>(null);
    const [searchTerm, setSearchTerm] = useState("");
    const [detailsOpen, setDetailsOpen] = useState(false);

    const { data: sales, isLoading } = useQuery({
        queryKey: ['sales-dashboard', currentWorkspace?.id],
        queryFn: async () => {
            if (!currentWorkspace?.id) return [];
            const { data, error } = await supabase
                .from('analytics_sales_view')
                .select('*')
                .eq('workspace_id', currentWorkspace.id)
                .order('won_at', { ascending: false });

            if (error) throw error;
            return data as Sale[];
        },
        enabled: !!currentWorkspace?.id
    });

    const filteredSales = sales?.filter(s =>
        s.client_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        s.company_name?.toLowerCase().includes(searchTerm.toLowerCase())
    ) || [];

    const handleSaleClick = (sale: Sale) => {
        setSelectedSale(sale);
        setDetailsOpen(true);
    };

    const totalSalesValue = filteredSales.reduce((acc, s) => acc + (s.total_value || 0), 0);

    return (
        <div className="p-8 space-y-8 animate-in fade-in duration-500">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-black tracking-tight text-slate-900">Vendas</h1>
                    <p className="text-slate-500 mt-1">
                        Gestão unificada de todas as vendas (Recorrentes e Avulsas).
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    <Button variant="outline" className="gap-2">
                        <Filter className="h-4 w-4" /> Filtros
                    </Button>
                    <Button variant="outline" className="gap-2">
                        <Download className="h-4 w-4" /> Exportar
                    </Button>
                </div>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Card className="border-indigo-100 bg-indigo-50/30 shadow-sm">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-indigo-900 uppercase tracking-wider">Total em Vendas</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-black text-indigo-700">
                            {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totalSalesValue)}
                        </div>
                        <p className="text-xs text-indigo-500 mt-1">{filteredSales.length} vendas registradas</p>
                    </CardContent>
                </Card>
            </div>

            <div className="space-y-4">
                <div className="relative max-w-sm">
                    <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                    <Input
                        placeholder="Buscar por cliente ou empresa..."
                        className="pl-9 h-10 bg-white"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>

                <SalesTable
                    sales={filteredSales}
                    isLoading={isLoading}
                    onSaleClick={handleSaleClick}
                />
            </div>

            <SaleDetails
                sale={selectedSale}
                open={detailsOpen}
                onOpenChange={setDetailsOpen}
            />
        </div>
    );
}
