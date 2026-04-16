import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
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
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { Loader2, AlertTriangle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { getLocalDateString } from "@/utils/format";

const cancelSchema = z.object({
  cancellation_reason: z.string().min(1, "Motivo é obrigatório"),
  reason_type: z.enum([
    "price",
    "service_quality",
    "competitor",
    "business_closure",
    "financial_difficulty",
    "other"
  ], {
    required_error: "Selecione um tipo de motivo"
  }),
  reason_detail: z.string().optional(),
  penalty_paid: z.boolean().default(false),
  penalty_amount: z.coerce.number().optional(),
  cancellation_date: z.string().min(1, "Data de cancelamento é obrigatória")
});

type CancelFormData = z.infer<typeof cancelSchema>;

interface Contract {
  id: string;
  name: string;
  client_id: string;
  value: number;
  start_date: string;
  clients?: {
    name: string;
  };
}

interface CancelContractDialogProps {
  contract: Contract | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const reasonTypeLabels: Record<string, string> = {
  price: "Preço",
  service_quality: "Qualidade do Serviço",
  competitor: "Concorrente",
  business_closure: "Fechamento do Negócio",
  financial_difficulty: "Dificuldade Financeira",
  other: "Outro"
};

export function CancelContractDialog({ contract, open, onOpenChange }: CancelContractDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { currentWorkspace } = useWorkspace();

  const form = useForm<CancelFormData>({
    resolver: zodResolver(cancelSchema),
    defaultValues: {
      cancellation_reason: "",
      reason_type: "other",
      reason_detail: "",
      penalty_paid: false,
      penalty_amount: 0,
      cancellation_date: getLocalDateString(),
    },
  });

  useEffect(() => {
    if (contract) {
      form.reset({
        cancellation_reason: "",
        reason_type: "other",
        reason_detail: "",
        penalty_paid: false,
        penalty_amount: 0,
        cancellation_date: getLocalDateString(),
      });
    }
  }, [contract, form]);

  const mutation = useMutation({
    mutationFn: async (data: CancelFormData) => {
      if (!currentWorkspace || !contract) throw new Error("Dados inválidos");

      // 1. Update contract status
      const { error: contractError } = await supabase
        .from("contracts")
        .update({
          status: "cancelled",
          cancellation_date: data.cancellation_date,
          cancellation_reason: data.cancellation_reason,
        })
        .eq("id", contract.id);

      if (contractError) throw contractError;

      // 2. Insert churn record
      const { error: churnError } = await supabase
        .from("churns")
        .insert({
          workspace_id: currentWorkspace.id,
          contract_id: contract.id,
          client_id: contract.client_id,
          churn_date: data.cancellation_date,
          reason_type: data.reason_type,
          reason_detail: data.reason_detail || null,
          mrr_lost: contract.value,
          penalty_paid: data.penalty_paid,
          penalty_amount: data.penalty_amount || null,
        });

      if (churnError) throw churnError;

      // 3. If penalty was paid, create one-time sale
      if (data.penalty_paid && data.penalty_amount && data.penalty_amount > 0) {
        const { error: saleError } = await supabase
          .from("one_time_sales")
          .insert({
            workspace_id: currentWorkspace.id,
            client_id: contract.client_id,
            type: "penalty",
            description: `Multa - Cancelamento: ${contract.name}`,
            amount: data.penalty_amount,
            sale_date: data.cancellation_date,
            status: "paid",
            payment_date: data.cancellation_date,
          });

        if (saleError) throw saleError;
      }

      // 4. Delete pending/overdue financial_receivables after churn date
      const { error: receivablesError } = await supabase
        .from("financial_receivables")
        .delete()
        .eq("contract_id", contract.id)
        .in("status", ["pending", "overdue"])
        .gt("due_date", data.cancellation_date);

      if (receivablesError) throw receivablesError;

      // 5. Delete pending/overdue contract_billings after churn date
      const { error: billingsError } = await supabase
        .from("contract_billings")
        .delete()
        .eq("contract_id", contract.id)
        .in("status", ["pending", "overdue"])
        .gt("due_date", data.cancellation_date);

      if (billingsError) throw billingsError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contracts"] });
      queryClient.invalidateQueries({ queryKey: ["churns"] });
      queryClient.invalidateQueries({ queryKey: ["one_time_sales"] });
      queryClient.invalidateQueries({ queryKey: ["contract-billings"] });
      queryClient.invalidateQueries({ queryKey: ["receivables"] });
      queryClient.invalidateQueries({ queryKey: ["receivables"] });
      queryClient.invalidateQueries({ queryKey: ["billings"] });
      toast({
        title: "Contrato cancelado",
        description: "O contrato foi cancelado, o churn foi registrado e as cobranças futuras foram excluídas.",
      });
      onOpenChange(false);
      form.reset();
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao cancelar contrato",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: CancelFormData) => {
    if (mutation.isPending) return;
    mutation.mutate(data);
  };

  const penaltyPaid = form.watch("penalty_paid");

  if (!contract) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Cancelar Contrato</DialogTitle>
          <DialogDescription>
            Registre o cancelamento do contrato e os motivos do churn
          </DialogDescription>
        </DialogHeader>

        <Alert variant="destructive" className="mb-4">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            <strong>Atenção!</strong> Esta ação cancelará o contrato e registrará o churn. Não pode ser desfeita.
          </AlertDescription>
        </Alert>

        <div className="bg-muted p-4 rounded-lg mb-4">
          <h4 className="font-semibold mb-2">Resumo do Contrato</h4>
          <div className="space-y-1 text-sm">
            <p><strong>Nome:</strong> {contract.name}</p>
            <p><strong>Cliente:</strong> {contract.clients?.name || "N/A"}</p>
            <p><strong>Valor Mensal:</strong> R$ {Number(contract.value).toFixed(2)}</p>
            <p><strong>Data de Início:</strong> {contract.start_date.split('-').reverse().join('/')}</p>
          </div>
        </div>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="cancellation_date"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Data de Cancelamento</FormLabel>
                  <FormControl>
                    <Input type="date" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="reason_type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Motivo Principal</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione o motivo" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {Object.entries(reasonTypeLabels).map(([value, label]) => (
                        <SelectItem key={value} value={value}>
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="cancellation_reason"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Resumo do Motivo</FormLabel>
                  <FormControl>
                    <Input placeholder="Ex: Cliente migrou para concorrente" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="reason_detail"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Detalhes do Motivo (Opcional)</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Descreva mais detalhes sobre o cancelamento..."
                      className="min-h-[100px]"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="penalty_paid"
              render={({ field }) => (
                <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                  <FormControl>
                    <Checkbox
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                  <div className="space-y-1 leading-none">
                    <FormLabel>
                      Penalidade Aplicada?
                    </FormLabel>
                    <FormDescription>
                      Marque se o cliente pagou multa por cancelamento
                    </FormDescription>
                  </div>
                </FormItem>
              )}
            />

            {penaltyPaid && (
              <FormField
                control={form.control}
                name="penalty_amount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Valor da Penalidade</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="0.01"
                        placeholder="0.00"
                        {...field}
                      />
                    </FormControl>
                    <FormDescription>
                      Será registrado automaticamente como venda avulsa
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            <div className="flex justify-end gap-3 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                Cancelar
              </Button>
              <Button type="submit" variant="destructive" disabled={mutation.isPending}>
                {mutation.isPending && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Confirmar Cancelamento
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
