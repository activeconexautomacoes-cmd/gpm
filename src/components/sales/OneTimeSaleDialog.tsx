import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

const saleSchema = z.object({
  description: z.string().min(1, "Descrição é obrigatória").max(200),
  amount: z.coerce.number().positive("Valor deve ser positivo"),
  sale_date: z.string().min(1, "Data da venda é obrigatória"),
  payment_date: z.string().optional(),
  payment_method: z.string().optional(),
  status: z.enum(["pending", "paid", "refunded"]),
  type: z.enum(["implementation", "package", "penalty", "other"]),
  client_id: z.string().optional(),
  notes: z.string().optional()
}).refine(data => {
  if (data.status === "paid" && !data.payment_date) {
    return false;
  }
  return true;
}, {
  message: "Data do pagamento é obrigatória quando status é 'pago'",
  path: ["payment_date"]
});

type SaleFormData = z.infer<typeof saleSchema>;

interface OneTimeSaleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sale?: any;
}

export function OneTimeSaleDialog({ open, onOpenChange, sale }: OneTimeSaleDialogProps) {
  const { currentWorkspace } = useWorkspace();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isSubmitting, setIsSubmitting] = useState(false);

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
      return data || [];
    },
    enabled: !!currentWorkspace,
  });

  const form = useForm<SaleFormData>({
    resolver: zodResolver(saleSchema),
    defaultValues: {
      description: "",
      amount: 0,
      sale_date: format(new Date(), "yyyy-MM-dd"),
      payment_date: "",
      payment_method: "",
      status: "pending",
      type: "implementation",
      client_id: "none",
      notes: "",
    },
  });

  const watchStatus = form.watch("status");
  const watchType = form.watch("type");

  useEffect(() => {
    if (sale) {
      form.reset({
        description: sale.description,
        amount: sale.amount,
        sale_date: sale.sale_date,
        payment_date: sale.payment_date || "",
        payment_method: sale.payment_method || "",
        status: sale.status,
        type: sale.type,
        client_id: sale.client_id || "none",
        notes: sale.notes || "",
      });
    } else {
      form.reset({
        description: "",
        amount: 0,
        sale_date: format(new Date(), "yyyy-MM-dd"),
        payment_date: "",
        payment_method: "",
        status: "pending",
        type: "implementation",
        client_id: "none",
        notes: "",
      });
    }
  }, [sale, form]);

  const mutation = useMutation({
    mutationFn: async (data: SaleFormData) => {
      if (!currentWorkspace) throw new Error("Workspace não selecionado");

      const payload = {
        description: data.description,
        amount: data.amount,
        sale_date: data.sale_date,
        status: data.status,
        type: data.type,
        workspace_id: currentWorkspace.id,
        client_id: data.client_id === "none" ? null : data.client_id || null,
        payment_date: data.payment_date || null,
        payment_method: data.payment_method || null,
        notes: data.notes || null,
      };

      if (sale) {
        const { error } = await (supabase as any)
          .from("one_time_sales")
          .update(payload)
          .eq("id", sale.id);
        if (error) throw error;

        // If status was changed to refunded, also create a payable
        if (data.status === "refunded" && sale.status !== "refunded") {
          // 1. Find or create category
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
            const { data: newCat } = await supabase
              .from("financial_categories")
              .insert({
                workspace_id: currentWorkspace.id,
                name: "Reembolsos",
                type: "expense",
                active: true
              })
              .select()
              .single();
            categoryId = (newCat as any)?.id;
          }

          // 2. Create payable
          await (supabase as any)
            .from("financial_payables")
            .insert({
              workspace_id: currentWorkspace.id,
              title: `Reembolso: ${data.description}`,
              description: `Reembolso: ${data.description}`,
              amount: data.amount,
              total_amount: data.amount,
              due_date: new Date().toISOString().split('T')[0],
              competence_date: new Date().toISOString().split('T')[0],
              status: "pending",
              category_id: categoryId
            });
        }
      } else {
        const { error } = await (supabase as any)
          .from("one_time_sales")
          .insert([payload]);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["one-time-sales"] });
      queryClient.invalidateQueries({ queryKey: ["financial_payables"] });
      queryClient.invalidateQueries({ queryKey: ["financial_categories"] });
      toast({
        title: sale ? "Venda atualizada" : "Venda criada",
        description: sale
          ? "Venda atualizada com sucesso."
          : "Nova venda criada com sucesso.",
      });
      onOpenChange(false);
      form.reset();
    },
    onError: (error: Error) => {
      toast({
        title: "Erro",
        description: error.message,
        variant: "destructive",
      });
    },
    onSettled: () => {
      setIsSubmitting(false);
    },
  });

  const onSubmit = (data: SaleFormData) => {
    setIsSubmitting(true);
    mutation.mutate(data);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {sale ? "Editar Venda Avulsa" : "Nova Venda Avulsa"}
          </DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Descrição</FormLabel>
                  <FormControl>
                    <Input placeholder="Descrição da venda" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tipo</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="implementation">Implementação</SelectItem>
                        <SelectItem value="package">Pacote</SelectItem>
                        <SelectItem value="penalty">Multa</SelectItem>
                        <SelectItem value="other">Outro</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="client_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Cliente (opcional)</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione o cliente" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="none">Sem cliente</SelectItem>
                        {(clients as any[])?.map((client) => (
                          <SelectItem key={client.id} value={client.id}>
                            {client.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {watchType === "penalty" && (
              <div className="bg-blue-50 border border-blue-200 rounded-md p-3">
                <p className="text-sm text-blue-800">
                  💡 Multas criadas através do cancelamento de contratos aparecem aqui automaticamente
                </p>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="amount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Valor (R$)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="0.01"
                        placeholder="0.00"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="sale_date"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Data da Venda</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="status"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Status</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="pending">Pendente</SelectItem>
                      <SelectItem value="paid">Pago</SelectItem>
                      <SelectItem value="refunded">Reembolsado</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {watchStatus === "paid" && (
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="payment_date"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Data do Pagamento</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="payment_method"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Método de Pagamento</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="PIX">PIX</SelectItem>
                          <SelectItem value="Cartão">Cartão</SelectItem>
                          <SelectItem value="TED">TED</SelectItem>
                          <SelectItem value="Dinheiro">Dinheiro</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            )}

            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Observações</FormLabel>
                  <FormControl>
                    <Textarea placeholder="Observações adicionais" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isSubmitting}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? "Salvando..." : "Salvar"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
