import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import {
  Plus,
  Search,
  Edit,
  XCircle,
  FileText,
  TrendingUp,
  AlertTriangle,
  Percent,
  Upload
} from "lucide-react";
import { ContractDialog } from "@/components/contracts/ContractDialog";
import { CancelContractDialog } from "@/components/contracts/CancelContractDialog";
import { ImportContractsDialog } from "@/components/contracts/ImportContractsDialog";
import { useNavigate } from "react-router-dom";

interface Contract {
  id: string;
  name: string;
  status: string;
  value: number;
  contract_period: string;
  custom_period_months: number | null;
  start_date: string;
  end_date: string | null;
  billing_day: number;
  client_id: string;
  clients: {
    name: string;
  } | null;
}

const statusLabels: Record<string, string> = {
  active: "Ativo",
  cancelled: "Cancelado",
};

const statusColors: Record<string, string> = {
  active: "bg-green-500/10 text-green-500 border-green-500/20",
  cancelled: "bg-red-500/10 text-red-500 border-red-500/20",
};

const periodLabels: Record<string, string> = {
  "6_months": "6 meses",
  "12_months": "12 meses",
  "18_months": "18 meses",
  "24_months": "24 meses",
  custom: "Custom",
};

export default function Contracts() {
  const { currentWorkspace, can } = useWorkspace();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [periodFilter, setPeriodFilter] = useState("all");
  const [clientFilter, setClientFilter] = useState("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [selectedContract, setSelectedContract] = useState<any>(null);

  const { data: clients } = useQuery({
    queryKey: ["clients", currentWorkspace?.id],
    queryFn: async () => {
      if (!currentWorkspace) return [];
      const { data, error } = await supabase
        .from("clients")
        .select("id, name")
        .eq("workspace_id", currentWorkspace.id)
        .eq("status", "active")
        .order("name");

      if (error) throw error;
      return (data as unknown) as { id: string; name: string }[];
    },
    enabled: !!currentWorkspace,
  });

  const { data: contracts, isLoading } = useQuery({
    queryKey: ["contracts", currentWorkspace?.id],
    queryFn: async () => {
      if (!currentWorkspace) return [];
      const { data, error } = await supabase
        .from("contracts")
        .select(`
          *,
          clients (
            id,
            name,
            email
          )
        `)
        .eq("workspace_id", currentWorkspace.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return (data as unknown) as Contract[];
    },
    enabled: !!currentWorkspace,
  });

  const filteredContracts = useMemo(() => {
    if (!contracts) return [];

    return contracts.filter((contract) => {
      const matchesSearch =
        contract.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        contract.clients?.name.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesStatus = statusFilter === "all" || contract.status === statusFilter;
      const matchesPeriod = periodFilter === "all" || contract.contract_period === periodFilter;
      const matchesClient = clientFilter === "all" || contract.client_id === clientFilter;

      return matchesSearch && matchesStatus && matchesPeriod && matchesClient;
    });
  }, [contracts, searchTerm, statusFilter, periodFilter, clientFilter]);

  const stats = useMemo(() => {
    if (!contracts) return { activeCount: 0, mrr: 0, expiring: 0, churnRate: 0 };

    const activeContracts = contracts.filter(c => c.status === 'active');
    const activeCount = activeContracts.length;
    const mrr = activeContracts.reduce((sum, c) => sum + Number(c.value), 0);

    const now = new Date();
    const in30Days = new Date();
    in30Days.setDate(in30Days.getDate() + 30);

    const expiring = activeContracts.filter(c => {
      if (!c.end_date) return false;
      const [y, m, d] = c.end_date.split('-').map(Number);
      const endDate = new Date(y, m - 1, d);
      return endDate >= now && endDate <= in30Days;
    }).length;

    return { activeCount, mrr, expiring, churnRate: 0 };
  }, [contracts]);

  const handleEdit = (contract: any) => {
    setSelectedContract(contract);
    setDialogOpen(true);
  };

  const handleCancel = (contract: any) => {
    setSelectedContract(contract);
    setCancelDialogOpen(true);
  };

  const handleNewContract = () => {
    setSelectedContract(null);
    setDialogOpen(true);
  };

  const handleViewBillings = (contractId: string) => {
    navigate(`/dashboard/contract-billings?contract=${contractId}`);
  };

  const isExpiringSoon = (endDate: string | null) => {
    if (!endDate) return false;
    const now = new Date();
    const in30Days = new Date();
    in30Days.setDate(in30Days.getDate() + 30);
    const [y, m, d] = endDate.split('-').map(Number);
    const end = new Date(y, m - 1, d);
    return end >= now && end <= in30Days;
  };

  if (!can('contracts.view')) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] text-center space-y-4">
        <div className="p-4 rounded-full bg-muted">
          <FileText className="h-8 w-8 text-muted-foreground" />
        </div>
        <div>
          <h2 className="text-lg font-semibold">Acesso Restrito</h2>
          <p className="text-muted-foreground max-w-sm">
            Você não tem permissão para visualizar contratos.
          </p>
        </div>
      </div>
    );
  }

  if (!currentWorkspace) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-muted-foreground">
          Selecione um workspace para visualizar os contratos
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Contratos</h1>
          <p className="text-muted-foreground">
            Gerencie contratos recorrentes com seus clientes
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setImportDialogOpen(true)}>
            <Upload className="mr-2 h-4 w-4" />
            Importar em Massa
          </Button>
          <Button onClick={handleNewContract}>
            <Plus className="mr-2 h-4 w-4" />
            Novo Contrato
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Contratos Ativos</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.activeCount}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">MRR Total</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              R$ {stats.mrr.toFixed(2)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Vencendo em 30 Dias</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.expiring}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Taxa de Churn</CardTitle>
            <Percent className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.churnRate.toFixed(1)}%</div>
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-col sm:flex-row gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
          <Input
            placeholder="Buscar por nome do contrato ou cliente..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-[180px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os Status</SelectItem>
            <SelectItem value="active">Ativo</SelectItem>
            <SelectItem value="cancelled">Cancelado</SelectItem>
          </SelectContent>
        </Select>
        <Select value={periodFilter} onValueChange={setPeriodFilter}>
          <SelectTrigger className="w-full sm:w-[180px]">
            <SelectValue placeholder="Período" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os Períodos</SelectItem>
            <SelectItem value="6_months">6 meses</SelectItem>
            <SelectItem value="12_months">12 meses</SelectItem>
            <SelectItem value="18_months">18 meses</SelectItem>
            <SelectItem value="24_months">24 meses</SelectItem>
            <SelectItem value="custom">Custom</SelectItem>
          </SelectContent>
        </Select>
        <Select value={clientFilter} onValueChange={setClientFilter}>
          <SelectTrigger className="w-full sm:w-[180px]">
            <SelectValue placeholder="Cliente" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os Clientes</SelectItem>
            {clients?.map((client) => (
              <SelectItem key={client.id} value={client.id}>
                {client.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Card className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome do Contrato</TableHead>
              <TableHead>Cliente</TableHead>
              <TableHead>Valor</TableHead>
              <TableHead>Período</TableHead>
              <TableHead>Início</TableHead>
              <TableHead>Término</TableHead>
              <TableHead>Dia Cobrança</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center">
                  Carregando...
                </TableCell>
              </TableRow>
            ) : filteredContracts.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center">
                  Nenhum contrato encontrado
                </TableCell>
              </TableRow>
            ) : (
              filteredContracts.map((contract) => (
                <TableRow key={contract.id}>
                  <TableCell className="font-medium">
                    {contract.name}
                    {contract.status === 'active' && isExpiringSoon(contract.end_date) && (
                      <AlertTriangle className="inline ml-2 h-4 w-4 text-amber-500" />
                    )}
                  </TableCell>
                  <TableCell>{contract.clients?.name}</TableCell>
                  <TableCell>R$ {Number(contract.value).toFixed(2)}</TableCell>
                  <TableCell>
                    <Badge variant="outline">
                      {periodLabels[contract.contract_period] || contract.contract_period}
                      {contract.contract_period === 'custom' && ` (${contract.custom_period_months}m)`}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {contract.start_date.split('-').reverse().join('/')}
                  </TableCell>
                  <TableCell>
                    {contract.end_date
                      ? contract.end_date.split('-').reverse().join('/')
                      : "Indeterminado"}
                  </TableCell>
                  <TableCell>Dia {contract.billing_day}</TableCell>
                  <TableCell>
                    <Badge className={statusColors[contract.status]}>
                      {statusLabels[contract.status]}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleViewBillings(contract.id)}
                        title="Ver Cobranças"
                      >
                        <FileText className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleEdit(contract)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      {contract.status === 'active' && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleCancel(contract)}
                          title="Cancelar Contrato"
                        >
                          <XCircle className="h-4 w-4 text-red-500" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>

      <ContractDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        contract={selectedContract}
      />

      <CancelContractDialog
        open={cancelDialogOpen}
        onOpenChange={setCancelDialogOpen}
        contract={selectedContract}
      />

      <ImportContractsDialog
        open={importDialogOpen}
        onOpenChange={setImportDialogOpen}
        onImportSuccess={() => queryClient.invalidateQueries({ queryKey: ["contracts"] })}
      />
    </div>
  );
}
