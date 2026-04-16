import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { Search, TrendingDown, DollarSign, AlertCircle } from "lucide-react";
import { ChurnAnalytics } from "@/components/churns/ChurnAnalytics";

export default function Churns() {
  const { currentWorkspace, can } = useWorkspace();
  const [searchTerm, setSearchTerm] = useState("");

  const { data: churns, isLoading } = useQuery({
    queryKey: ["churns", currentWorkspace?.id],
    queryFn: async () => {
      if (!currentWorkspace?.id) return [];

      const { data, error } = await supabase
        .from("churns")
        .select(`
          *,
          clients (name),
          contracts (name)
        `)
        .eq("workspace_id", currentWorkspace.id)
        .order("churn_date", { ascending: false });

      if (error) throw error;
      return (data as unknown) as any[];
    },
    enabled: !!currentWorkspace?.id,
  });

  const filteredChurns = churns?.filter((churn) => {
    const searchLower = searchTerm.toLowerCase();
    return (
      churn.clients?.name.toLowerCase().includes(searchLower) ||
      churn.contracts?.name.toLowerCase().includes(searchLower) ||
      churn.reason_type?.toLowerCase().includes(searchLower)
    );
  });

  if (!can('reports.view')) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] text-center space-y-4">
        <div className="p-4 rounded-full bg-muted">
          <AlertCircle className="h-8 w-8 text-muted-foreground" />
        </div>
        <div>
          <h2 className="text-lg font-semibold">Acesso Restrito</h2>
          <p className="text-muted-foreground max-w-sm">
            Você não tem permissão para visualizar os relatórios de churn.
          </p>
        </div>
      </div>
    );
  }

  const totalMRRLost = churns?.reduce((sum, churn) => sum + Number(churn.mrr_lost), 0) || 0;
  const totalWithPenalty = churns?.filter((churn) => churn.penalty_paid).length || 0;
  const totalPenaltyAmount = churns?.reduce(
    (sum, churn) => sum + (churn.penalty_paid ? Number(churn.penalty_amount || 0) : 0),
    0
  ) || 0;

  return (
    <div className="container mx-auto p-4 md:p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Churns & Cancelamentos</h1>
          <p className="text-muted-foreground">
            Análise de cancelamentos e churns do workspace
          </p>
        </div>
      </div>

      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de Churns</CardTitle>
            <TrendingDown className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{churns?.length || 0}</div>
            <p className="text-xs text-muted-foreground">
              Cancelamentos registrados
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">MRR Perdido</CardTitle>
            <DollarSign className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              R$ {totalMRRLost.toFixed(2)}
            </div>
            <p className="text-xs text-muted-foreground">
              Receita recorrente perdida
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Multas Cobradas</CardTitle>
            <AlertCircle className="h-4 w-4 text-warning" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              R$ {totalPenaltyAmount.toFixed(2)}
            </div>
            <p className="text-xs text-muted-foreground">
              {totalWithPenalty} churns com multa
            </p>
          </CardContent>
        </Card>
      </div>

      {churns && churns.length > 0 && <ChurnAnalytics churns={churns} />}

      <Card>
        <CardHeader>
          <CardTitle>Histórico de Churns</CardTitle>
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2">
            <Search className="h-4 w-4 text-muted-foreground hidden sm:block" />
            <Input
              placeholder="Buscar por cliente, contrato ou motivo..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full sm:max-w-sm"
            />
          </div>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {isLoading ? (
            <div className="text-center py-8">Carregando...</div>
          ) : filteredChurns && filteredChurns.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Contrato</TableHead>
                  <TableHead>Motivo</TableHead>
                  <TableHead>MRR Perdido</TableHead>
                  <TableHead>Multa</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredChurns.map((churn) => (
                  <TableRow key={churn.id}>
                    <TableCell>
                      {format(new Date(churn.churn_date), "dd/MM/yyyy")}
                    </TableCell>
                    <TableCell className="font-medium">
                      {churn.clients?.name}
                    </TableCell>
                    <TableCell>{churn.contracts?.name}</TableCell>
                    <TableCell>
                      <div>
                        <div className="font-medium">{churn.reason_type}</div>
                        {churn.reason_detail && (
                          <div className="text-sm text-muted-foreground">
                            {churn.reason_detail}
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>R$ {Number(churn.mrr_lost).toFixed(2)}</TableCell>
                    <TableCell>
                      {churn.penalty_paid ? (
                        <div>
                          <Badge variant="destructive">Cobrada</Badge>
                          <div className="text-sm mt-1">
                            R$ {Number(churn.penalty_amount || 0).toFixed(2)}
                          </div>
                        </div>
                      ) : (
                        <Badge variant="secondary">Não cobrada</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">Cancelado</Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              {searchTerm
                ? "Nenhum churn encontrado com os filtros aplicados"
                : "Nenhum churn registrado"}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
