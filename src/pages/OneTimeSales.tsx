import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Plus, Pencil, Trash2, Search, CheckCircle, ShoppingBag, RotateCcw } from "lucide-react";
import { OneTimeSaleDialog } from "@/components/sales/OneTimeSaleDialog";
import { format } from "date-fns";
import { BillingInvoiceDialog } from "@/components/financial/BillingInvoiceDialog";
import { CreditCard } from "lucide-react";

interface OneTimeSale {
  id: string;
  description: string;
  amount: number;
  status: string;
  type: string;
  sale_date: string;
  payment_method: string | null;
  client_id: string;
  clients: {
    name: string;
  } | null;
}

const statusLabels: Record<string, string> = {
  pending: "Pendente",
  paid: "Pago",
  refunded: "Reembolsado",
};

const statusColors: Record<string, string> = {
  pending: "bg-yellow-500",
  paid: "bg-green-500",
  refunded: "bg-orange-500",
};

const typeLabels: Record<string, string> = {
  implementation: "Implementação",
  package: "Pacote",
  penalty: "Multa",
  other: "Outro",
};

const typeColors: Record<string, string> = {
  implementation: "bg-blue-500",
  package: "bg-blue-500",
  penalty: "bg-red-500",
  other: "bg-gray-500",
};

export default function OneTimeSales() {
  const { currentWorkspace, can } = useWorkspace();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [clientFilter, setClientFilter] = useState<string>("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedSale, setSelectedSale] = useState<any>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [saleToDelete, setSaleToDelete] = useState<string | null>(null);
  const [refundDialogOpen, setRefundDialogOpen] = useState(false);
  const [saleToRefund, setSaleToRefund] = useState<OneTimeSale | null>(null);
  const [invoiceDialogOpen, setInvoiceDialogOpen] = useState(false);
  const [saleForInvoice, setSaleForInvoice] = useState<string | null>(null);

  const { data: clients } = useQuery({
    queryKey: ["clients", currentWorkspace?.id],
    queryFn: async () => {
      if (!currentWorkspace) return [];
      const { data } = await supabase
        .from("clients")
        .select("id, name")
        .eq("workspace_id", currentWorkspace.id)
        .eq("status", "active")
        .order("name");
      return (data as unknown) as { id: string; name: string }[];
    },
    enabled: !!currentWorkspace,
  });

  const { data: sales, isLoading } = useQuery({
    queryKey: ["one-time-sales", currentWorkspace?.id],
    queryFn: async () => {
      if (!currentWorkspace) return [];
      const { data, error } = await supabase
        .from("one_time_sales")
        .select(`
          *,
          clients (
            id,
            name
          )
        `)
        .eq("workspace_id", currentWorkspace.id)
        .order("sale_date", { ascending: false });

      if (error) throw error;
      return (data as unknown) as OneTimeSale[];
    },
    enabled: !!currentWorkspace,
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("one_time_sales").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["one-time-sales"] });
      toast({
        title: "Venda excluída",
        description: "Venda excluída com sucesso.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao excluir",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const markAsPaidMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("one_time_sales")
        .update({
          status: "paid",
          payment_date: format(new Date(), "yyyy-MM-dd"),
        })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["one-time-sales"] });
      toast({
        title: "Venda marcada como paga",
        description: "A venda foi atualizada com sucesso.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao atualizar",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const refundMutation = useMutation({
    mutationFn: async (sale: OneTimeSale) => {
      if (!currentWorkspace) throw new Error("Workspace não selecionado");

      // 1. Find or create "Reembolsos" category
      const { data: categories } = await supabase
        .from("financial_categories")
        .select("id")
        .eq("workspace_id", currentWorkspace.id)
        .eq("name", "Reembolsos")
        .eq("type", "expense")
        .limit(1);

      let categoryId;
      if (categories && categories.length > 0) {
        categoryId = categories[0].id;
      } else {
        const { data: newCat, error: catError } = await supabase
          .from("financial_categories")
          .insert({
            workspace_id: currentWorkspace.id,
            name: "Reembolsos",
            type: "expense",
            active: true
          })
          .select()
          .single();
        if (catError) throw catError;
        categoryId = newCat.id;
      }

      // 2. Update sale status
      const { error: saleError } = await (supabase as any)
        .from("one_time_sales")
        .update({ status: "refunded" })
        .eq("id", sale.id);
      if (saleError) throw saleError;

      // 3. Create financial payable
      const { error: payableError } = await (supabase as any)
        .from("financial_payables")
        .insert({
          workspace_id: currentWorkspace.id,
          description: `Reembolso: ${sale.description}`,
          amount: Number(sale.amount),
          total_amount: Number(sale.amount),
          due_date: new Date().toISOString().split('T')[0],
          competence_date: new Date().toISOString().split('T')[0],
          status: "pending",
          category_id: categoryId
        });
      if (payableError) throw payableError;

      return sale.id;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["one-time-sales"] });
      queryClient.invalidateQueries({ queryKey: ["financial_payables"] });
      queryClient.invalidateQueries({ queryKey: ["financial_categories"] });
      toast({
        title: "Reembolso solicitado",
        description: "A venda foi marcada como reembolsada e uma conta a pagar foi criada.",
      });
      setRefundDialogOpen(false);
      setSaleToRefund(null);
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao processar reembolso",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  if (!can('sales.manage')) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] text-center space-y-4">
        <div className="p-4 rounded-full bg-muted">
          <ShoppingBag className="h-8 w-8 text-muted-foreground" />
        </div>
        <div>
          <h2 className="text-lg font-semibold">Acesso Restrito</h2>
          <p className="text-muted-foreground max-w-sm">
            Você não tem permissão para gerenciar vendas avulsas.
          </p>
        </div>
      </div>
    );
  }

  const filteredSales = sales?.filter((sale) => {
    const matchesSearch = sale.description
      .toLowerCase()
      .includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === "all" || sale.status === statusFilter;
    const matchesType = typeFilter === "all" || sale.type === typeFilter;
    const matchesClient =
      clientFilter === "all" || sale.client_id === clientFilter;
    return matchesSearch && matchesStatus && matchesType && matchesClient;
  });

  const stats = useMemo(() => {
    if (!sales) return { total: 0, paid: 0, pending: 0, penalties: 0 };

    const total = sales
      .filter((sale) => sale.status !== "refunded")
      .reduce((sum, sale) => sum + Number(sale.amount), 0);
    const paid = sales
      .filter((sale) => sale.status === "paid")
      .reduce((sum, sale) => sum + Number(sale.amount), 0);
    const pending = sales
      .filter((sale) => sale.status === "pending")
      .reduce((sum, sale) => sum + Number(sale.amount), 0);
    const penalties = sales
      .filter((sale) => sale.type === "penalty" && sale.status === "paid")
      .reduce((sum, sale) => sum + Number(sale.amount), 0);

    return { total, paid, pending, penalties };
  }, [sales]);

  const handleEdit = (sale: any) => {
    setSelectedSale(sale);
    setDialogOpen(true);
  };

  const handleDelete = (id: string) => {
    setSaleToDelete(id);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = () => {
    if (saleToDelete) {
      deleteMutation.mutate(saleToDelete);
    }
    setDeleteDialogOpen(false);
    setSaleToDelete(null);
  };

  const handleNewSale = () => {
    setSelectedSale(null);
    setDialogOpen(true);
  };

  const handleMarkAsPaid = (id: string) => {
    markAsPaidMutation.mutate(id);
  };

  const handleShowInvoice = (id: string) => {
    setSaleForInvoice(id);
    setInvoiceDialogOpen(true);
  };

  const handleRefund = (sale: OneTimeSale) => {
    setSaleToRefund(sale);
    setRefundDialogOpen(true);
  };

  const confirmRefund = () => {
    if (saleToRefund) {
      refundMutation.mutate(saleToRefund);
    }
  };

  if (!currentWorkspace) {
    return (
      <div className="p-6">
        <p>Selecione um workspace</p>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Vendas Avulsas</h1>
        <Button onClick={handleNewSale}>
          <Plus className="mr-2 h-4 w-4" />
          Nova Venda
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total de Vendas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {new Intl.NumberFormat("pt-BR", {
                style: "currency",
                currency: "BRL",
              }).format(stats.total)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Recebido</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {new Intl.NumberFormat("pt-BR", {
                style: "currency",
                currency: "BRL",
              }).format(stats.paid)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Pendente</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">
              {new Intl.NumberFormat("pt-BR", {
                style: "currency",
                currency: "BRL",
              }).format(stats.pending)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Multas Recebidas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {new Intl.NumberFormat("pt-BR", {
                style: "currency",
                currency: "BRL",
              }).format(stats.penalties)}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por descrição..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="pending">Pendente</SelectItem>
            <SelectItem value="paid">Pago</SelectItem>
            <SelectItem value="refunded">Reembolsado</SelectItem>
          </SelectContent>
        </Select>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="Tipo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="implementation">Implementação</SelectItem>
            <SelectItem value="package">Pacote</SelectItem>
            <SelectItem value="penalty">Multa</SelectItem>
            <SelectItem value="other">Outro</SelectItem>
          </SelectContent>
        </Select>
        <Select value={clientFilter} onValueChange={setClientFilter}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Cliente" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            {clients?.map((client) => (
              <SelectItem key={client.id} value={client.id}>
                {client.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="text-center py-8">Carregando...</div>
      ) : (
        <div className="border rounded-lg overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Descrição</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Valor</TableHead>
                <TableHead>Data da Venda</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Método</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredSales?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8">
                    Nenhuma venda encontrada
                  </TableCell>
                </TableRow>
              ) : (
                filteredSales?.map((sale) => (
                  <TableRow key={sale.id}>
                    <TableCell className="font-medium">{sale.description}</TableCell>
                    <TableCell>{sale.clients?.name || "-"}</TableCell>
                    <TableCell>
                      <Badge className={typeColors[sale.type] || "bg-gray-500"}>
                        {typeLabels[sale.type] || sale.type}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {new Intl.NumberFormat("pt-BR", {
                        style: "currency",
                        currency: "BRL",
                      }).format(sale.amount)}
                    </TableCell>
                    <TableCell>
                      {format(new Date(sale.sale_date + "T12:00:00"), "dd/MM/yyyy")}
                    </TableCell>
                    <TableCell>
                      <Badge
                        className={statusColors[sale.status] || "bg-gray-500"}
                      >
                        {statusLabels[sale.status] || sale.status}
                      </Badge>
                    </TableCell>
                    <TableCell>{sale.payment_method || "-"}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        {sale.status === "pending" && (
                          <>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleMarkAsPaid(sale.id)}
                              title="Marcar como pago"
                            >
                              <CheckCircle className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleShowInvoice(sale.id)}
                              title="Ver Fatura Pagar.me"
                            >
                              <CreditCard className="h-4 w-4 text-blue-500" />
                            </Button>
                          </>
                        )}
                        {sale.status === "paid" && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleRefund(sale)}
                            title="Reembolsar"
                            className="text-orange-500 hover:text-orange-600 hover:bg-orange-50"
                          >
                            <RotateCcw className="h-4 w-4" />
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleEdit(sale)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDelete(sale.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      )}

      <OneTimeSaleDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        sale={selectedSale}
      />

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir esta venda? Esta ação não pode ser
              desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete}>Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={refundDialogOpen} onOpenChange={setRefundDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar reembolso</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja reembolsar esta venda? A venda será marcada como reembolsada e uma nova conta a pagar será criada automaticamente no financeiro.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmRefund} className="bg-orange-500 hover:bg-orange-600">
              Confirmar Reembolso
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <BillingInvoiceDialog
        open={invoiceDialogOpen}
        onOpenChange={setInvoiceDialogOpen}
        billingId={saleForInvoice || ""}
        type="sale"
      />
    </div>
  );
}
