import { useState, useMemo, useEffect, Fragment } from "react";
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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
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
  Percent,
  Copy,
  ExternalLink,
  Plus,
  Search,
  Edit,
  Trash2,
  CheckCircle,
  DollarSign,
  AlertCircle,
  ChevronDown,
  ChevronUp
} from "lucide-react";
import { BillingDialog } from "@/components/contracts/BillingDialog";
import { useNavigate, useSearchParams } from "react-router-dom";
import { getLocalDateString, formatDate } from "@/utils/format";
import { BillingInvoiceDialog } from "@/components/financial/BillingInvoiceDialog";
import { CreditCard } from "lucide-react";

const statusLabels: Record<string, string> = {
  pending: "Pendente",
  paid: "Pago",
  overdue: "Atrasado",
};

const statusColors: Record<string, string> = {
  pending: "bg-amber-500/10 text-amber-500 border-amber-500/20",
  paid: "bg-green-500/10 text-green-500 border-green-500/20",
  overdue: "bg-red-500/10 text-red-500 border-red-500/20",
};

const paymentMethodLabels: Record<string, string> = {
  pix: "PIX",
  cartao: "Cartão",
  credit_card: "Cartão de Crédito",
  ted: "TED",
  bank_transfer: "Transferência Bancária",
  dinheiro: "Dinheiro",
  cash: "Dinheiro",
};

export default function ContractBillings() {
  const { currentWorkspace } = useWorkspace();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();

  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [contractFilter, setContractFilter] = useState(searchParams.get("contract") || "all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [linkDialogOpen, setLinkDialogOpen] = useState(false);
  const [selectedBillingId, setSelectedBillingId] = useState<string | null>(null);
  const [allowedMethods, setAllowedMethods] = useState({
    pix: true,
    card: true
  });
  const [selectedBilling, setSelectedBilling] = useState<any>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [billingToDelete, setBillingToDelete] = useState<string | null>(null);
  const [invoiceDialogOpen, setInvoiceDialogOpen] = useState(false);
  const [billingForInvoice, setBillingForInvoice] = useState<string | null>(null);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  const toggleRow = (id: string) => {
    const newExpanded = new Set(expandedRows);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedRows(newExpanded);
  };

  useEffect(() => {
    const contractId = searchParams.get("contract");
    if (contractId) {
      setContractFilter(contractId);
    }
  }, [searchParams]);

  const { data: contracts } = useQuery({
    queryKey: ["contracts", currentWorkspace?.id],
    queryFn: async () => {
      if (!currentWorkspace) return [];
      const { data, error } = await supabase
        .from("contracts")
        .select("*")
        .eq("workspace_id", currentWorkspace.id)
        .order("name");

      if (error) throw error;
      return data;
    },
    enabled: !!currentWorkspace,
  });

  const { data: billings, isLoading } = useQuery({
    queryKey: ["contract-billings", currentWorkspace?.id, searchTerm, statusFilter, contractFilter],
    queryFn: async () => {
      if (!currentWorkspace) return [];

      let query = supabase
        .from("contract_billings")
        .select(`
          *,
          financial_receivables (
            id,
            amount,
            due_date,
            status,
            payment_date,
            description
          ),
          contracts (
            id,
            name,
            clients (
              id,
              name
            )
          )
        `)
        .eq("workspace_id", currentWorkspace.id);

      // Filtro por contrato se selecionado
      if (contractFilter !== "all") {
        query = query.eq("contract_id", contractFilter);
      }

      // Se houver termo de busca, tentamos filtrar (embora joins complexos no Supabase client sejam limitados,
      // buscamos trazer o máximo de dados e depois refinamos)

      const { data, error } = await query
        .order("due_date", { ascending: false })
        .limit(2000);

      if (error) throw error;
      return data as any[];
    },
    enabled: !!currentWorkspace,
  });

  const enrichedBillings = useMemo(() => {
    if (!billings) return [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return billings.map(billing => {
      const [y, m, d] = billing.due_date.split('-').map(Number);
      const dueDate = new Date(y, m - 1, d);

      const computedStatus = billing.status === 'paid'
        ? 'paid'
        : dueDate < today
          ? 'overdue'
          : 'pending';

      return {
        ...billing,
        computedStatus
      };
    });
  }, [billings]);

  const filteredBillings = useMemo(() => {
    if (!enrichedBillings) return [];

    return enrichedBillings.filter((billing) => {
      // Filtro de texto no lado do cliente para garantir precisão
      const lowerSearch = searchTerm.toLowerCase().trim();
      const matchesSearch = !lowerSearch ||
        billing.contracts?.name?.toLowerCase().includes(lowerSearch) ||
        billing.contracts?.clients?.name?.toLowerCase().includes(lowerSearch);

      // No banco já filtramos por contrato, mas mantemos aqui por segurança
      const matchesContract = contractFilter === "all" || billing.contract_id === contractFilter;

      // Filtro de status (usando o status computado pelo componente)
      const matchesStatus = statusFilter === "all" || billing.computedStatus === statusFilter;

      return matchesSearch && matchesStatus && matchesContract;
    });
  }, [enrichedBillings, searchTerm, statusFilter, contractFilter]);

  const stats = useMemo(() => {
    if (!enrichedBillings) return { totalDue: 0, totalReceived: 0, overdue: 0, delinquencyRate: 0 };

    const currentMonth = new Date().getMonth();
    const currentYear = new Date().getFullYear();

    const monthBillings = enrichedBillings.filter(b => {
      const [y, m] = b.due_date.split('-').map(Number);
      return (m - 1) === currentMonth && y === currentYear;
    });

    const totalDue = monthBillings
      .filter(b => b.status !== 'paid')
      .reduce((sum, b) => sum + Number(b.final_amount), 0);

    const totalReceived = monthBillings
      .filter(b => b.status === 'paid')
      .reduce((sum, b) => sum + Number(b.final_amount), 0);

    const overdue = enrichedBillings
      .filter(b => b.computedStatus === 'overdue')
      .reduce((sum, b) => sum + Number(b.final_amount), 0);

    const delinquencyRate = monthBillings.length > 0
      ? (monthBillings.filter(b => b.computedStatus === 'overdue').length / monthBillings.length) * 100
      : 0;

    return { totalDue, totalReceived, overdue, delinquencyRate };
  }, [enrichedBillings]);

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      // 1. Delete linked financial receivable first (if any)
      await supabase
        .from("financial_receivables")
        .delete()
        .eq("contract_billing_id", id);

      // 2. Delete the contract billing
      const { error } = await supabase
        .from("contract_billings")
        .delete()
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contract-billings"] });
      queryClient.invalidateQueries({ queryKey: ["financial_receivables"] });
      queryClient.invalidateQueries({ queryKey: ["receivables"] });
      toast({
        title: "Cobrança excluída!",
        description: "A cobrança foi excluída com sucesso.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao excluir cobrança",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const markAsPaidMutation = useMutation({
    mutationFn: async (billingId: string) => {
      // 1. Marcar contract_billing como Pago
      const { error } = await supabase
        .from("contract_billings")
        .update({
          status: "paid",
          payment_date: getLocalDateString()
        })
        .eq("id", billingId);

      if (error) throw error;

      // 2. Atualizar financial_receivable correspondente
      const today = getLocalDateString();
      const { error: finError } = await supabase
        .from("financial_receivables")
        .update({
          status: 'paid',
          payment_date: today
        })
        .eq('contract_billing_id', billingId);

      if (finError) {
        console.error("Erro ao sincronizar com financeiro:", finError);
        // Não lançar erro aqui para não travar a UI de contratos, apenas logar.
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contract-billings"] });
      queryClient.invalidateQueries({ queryKey: ["financial_receivables"] });
      queryClient.invalidateQueries({ queryKey: ["receivables"] });
      toast({
        title: "Cobrança marcada como paga!",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao atualizar cobrança",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleEdit = (billing: any) => {
    setSelectedBilling(billing);
    setDialogOpen(true);
  };

  const handleDelete = (id: string) => {
    setBillingToDelete(id);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = () => {
    if (billingToDelete) {
      deleteMutation.mutate(billingToDelete);
      setDeleteDialogOpen(false);
      setBillingToDelete(null);
    }
  };

  const handleNewBilling = () => {
    setSelectedBilling(null);
    setDialogOpen(true);
  };

  const handleMarkAsPaid = (id: string) => {
    markAsPaidMutation.mutate(id);
  };

  const handleShowInvoice = (id: string) => {
    setSelectedBillingId(id);
    setLinkDialogOpen(true);
  };

  const handleShowPagarmeInvoice = (id: string) => {
    setBillingForInvoice(id);
    setInvoiceDialogOpen(true);
  };

  const generatePaymentLink = () => {
    if (!selectedBillingId) return "";
    const methods = Object.entries(allowedMethods)
      .filter(([_, allowed]) => allowed)
      .map(([method]) => method)
      .join(",");

    const baseUrl = `${window.location.origin}/invoice/${selectedBillingId}`;
    return methods ? `${baseUrl}?methods=${methods}` : baseUrl;
  };

  const handleCopyLink = () => {
    const link = generatePaymentLink();
    navigator.clipboard.writeText(link);
    toast({
      title: "Link copiado!",
      description: "O link de pagamento foi copiado para a área de transferência.",
    });
  };

  const handleOpenLink = () => {
    const link = generatePaymentLink();
    window.open(link, '_blank');
  };

  if (!currentWorkspace) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-muted-foreground">
          Selecione um workspace para visualizar as cobranças
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Cobranças de Contratos</h1>
          <p className="text-muted-foreground">
            Gerencie as cobranças mensais dos contratos
          </p>
        </div>
        <Button onClick={handleNewBilling}>
          <Plus className="mr-2 h-4 w-4" />
          Nova Cobrança
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total a Receber</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">R$ {stats.totalDue.toFixed(2)}</div>
            <p className="text-xs text-muted-foreground">Mês atual</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Recebido</CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">R$ {stats.totalReceived.toFixed(2)}</div>
            <p className="text-xs text-muted-foreground">Mês atual</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Atrasadas</CardTitle>
            <AlertCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">R$ {stats.overdue.toFixed(2)}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Taxa de Inadimplência</CardTitle>
            <Percent className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.delinquencyRate.toFixed(1)}%</div>
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-col sm:flex-row gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
          <Input
            placeholder="Buscar por contrato ou cliente..."
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
            <SelectItem value="pending">Pendente</SelectItem>
            <SelectItem value="paid">Pago</SelectItem>
            <SelectItem value="overdue">Atrasado</SelectItem>
          </SelectContent>
        </Select>
        <Select value={contractFilter} onValueChange={setContractFilter}>
          <SelectTrigger className="w-full sm:w-[200px]">
            <SelectValue placeholder="Contrato" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os Contratos</SelectItem>
            {contracts?.map((contract) => (
              <SelectItem key={contract.id} value={contract.id}>
                {(contract as any).name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Card className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Contrato</TableHead>
              <TableHead>Cliente</TableHead>
              <TableHead>Valor Original</TableHead>
              <TableHead>Desconto</TableHead>
              <TableHead>Valor Final</TableHead>
              <TableHead>Vencimento</TableHead>
              <TableHead>Pagamento</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Método</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={10} className="text-center">
                  Carregando...
                </TableCell>
              </TableRow>
            ) : filteredBillings.length === 0 ? (
              <TableRow>
                <TableCell colSpan={10} className="text-center">
                  Nenhuma cobrança encontrada
                </TableCell>
              </TableRow>
            ) : (
              filteredBillings.map((billing) => (
                <Fragment key={billing.id}>
                  <TableRow>
                    <TableCell className="font-medium flex items-center gap-2">
                      {billing.financial_receivables && billing.financial_receivables.length > 0 && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0"
                          onClick={() => toggleRow(billing.id)}
                        >
                          {expandedRows.has(billing.id) ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                        </Button>
                      )}
                      {billing.contracts?.name}
                    </TableCell>
                    <TableCell>{billing.contracts?.clients?.name}</TableCell>
                    <TableCell>R$ {Number(billing.amount).toFixed(2)}</TableCell>
                    <TableCell>R$ {Number(billing.discount).toFixed(2)}</TableCell>
                    <TableCell className="font-semibold">R$ {Number(billing.final_amount).toFixed(2)}</TableCell>
                    <TableCell>
                      {formatDate(billing.due_date)}
                    </TableCell>
                    <TableCell>
                      {billing.payment_date
                        ? formatDate(billing.payment_date)
                        : "-"}
                    </TableCell>
                    <TableCell>
                      <Badge className={statusColors[billing.computedStatus]}>
                        {statusLabels[billing.computedStatus]}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {billing.payment_method ? paymentMethodLabels[billing.payment_method] || billing.payment_method : "-"}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        {billing.status !== 'paid' && (
                          <>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleMarkAsPaid(billing.id)}
                              title="Marcar como Pago"
                            >
                              <CheckCircle className="h-4 w-4 text-green-500" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleShowPagarmeInvoice(billing.id)}
                              title="Ver Fatura Pagar.me"
                            >
                              <CreditCard className="h-4 w-4 text-blue-500" />
                            </Button>
                          </>
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleEdit(billing)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDelete(billing.id)}
                        >
                          <Trash2 className="h-4 w-4 text-red-500" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                  {expandedRows.has(billing.id) && billing.financial_receivables?.map((parcel: any, idx: number) => (
                    <TableRow key={parcel.id} className="bg-slate-50/50">
                      <TableCell colSpan={2} className="text-xs text-muted-foreground pl-10">
                        └─ {parcel.description || `Parcela ${idx + 1}`}
                      </TableCell>
                      <TableCell className="text-xs">R$ {Number(parcel.amount).toFixed(2)}</TableCell>
                      <TableCell>-</TableCell>
                      <TableCell className="font-semibold text-xs">R$ {Number(parcel.amount).toFixed(2)}</TableCell>
                      <TableCell className="text-xs">{formatDate(parcel.due_date)}</TableCell>
                      <TableCell className="text-xs">{parcel.payment_date ? formatDate(parcel.payment_date) : "-"}</TableCell>
                      <TableCell>
                        <Badge className={(statusColors[parcel.status] || statusColors['pending']) + " scale-90 origin-left"}>
                          {statusLabels[parcel.status] || 'Pendente'}
                        </Badge>
                      </TableCell>
                      <TableCell>-</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => handleShowPagarmeInvoice(parcel.id)}
                            title="Ver Fatura da Parcela"
                          >
                            <CreditCard className="h-3 w-3 text-blue-500" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </Fragment>
              ))
            )}
          </TableBody>
        </Table>
      </Card>

      <BillingDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        billing={selectedBilling}
      />

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Cobrança</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir esta cobrança? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete}>Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <BillingInvoiceDialog
        open={invoiceDialogOpen}
        onOpenChange={setInvoiceDialogOpen}
        billingId={billingForInvoice || ""}
        type="contract"
      />

      <Dialog open={linkDialogOpen} onOpenChange={setLinkDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Link de Pagamento</DialogTitle>
          </DialogHeader>
          <div className="space-y-6 py-4">
            <div className="space-y-4">
              <h4 className="text-sm font-medium">Métodos de Pagamento Permitidos</h4>
              <div className="grid grid-cols-1 gap-4">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="pix"
                    checked={allowedMethods.pix}
                    onCheckedChange={(checked) => setAllowedMethods(prev => ({ ...prev, pix: !!checked }))}
                  />
                  <Label htmlFor="pix" className="cursor-pointer">PIX</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="card"
                    checked={allowedMethods.card}
                    onCheckedChange={(checked) => setAllowedMethods(prev => ({ ...prev, card: !!checked }))}
                  />
                  <Label htmlFor="card" className="cursor-pointer">Cartão de Crédito</Label>
                </div>

              </div>
            </div>
          </div>
          <DialogFooter className="flex flex-col sm:flex-row gap-2">
            <Button
              variant="outline"
              className="flex-1 gap-2"
              onClick={handleCopyLink}
            >
              <Copy className="h-4 w-4" />
              Copiar Link
            </Button>
            <Button
              className="flex-1 gap-2"
              onClick={handleOpenLink}
            >
              <ExternalLink className="h-4 w-4" />
              Abrir Link
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
