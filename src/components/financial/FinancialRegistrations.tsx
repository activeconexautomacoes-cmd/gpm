
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BankAccountsSettings } from "./BankAccountsSettings";
import { CategoriesSettings } from "./CategoriesSettings";
import { CostCentersSettings } from "./CostCentersSettings";
import { Card, CardContent } from "@/components/ui/card";

export function FinancialRegistrations() {
    return (
        <Card className="border-none shadow-none bg-transparent">
            <Tabs defaultValue="categories" className="space-y-4">
                <TabsList>
                    <TabsTrigger value="categories">Categorias</TabsTrigger>
                    <TabsTrigger value="accounts">Contas Bancárias</TabsTrigger>
                    <TabsTrigger value="cost-centers">Centros de Custo</TabsTrigger>
                </TabsList>
                <TabsContent value="categories" className="space-y-4">
                    <Card>
                        <CardContent className="pt-6">
                            <CategoriesSettings />
                        </CardContent>
                    </Card>
                </TabsContent>
                <TabsContent value="accounts" className="space-y-4">
                    <Card>
                        <CardContent className="pt-6">
                            <BankAccountsSettings />
                        </CardContent>
                    </Card>
                </TabsContent>
                <TabsContent value="cost-centers" className="space-y-4">
                    <Card>
                        <CardContent className="pt-6">
                            <CostCentersSettings />
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
        </Card>
    );
}
