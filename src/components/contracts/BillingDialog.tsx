import { useEffect } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
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
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { Loader2, Plus, Trash2 } from "lucide-react";

const billingSchema = z.object({
  contract_id: z.string().uuid("Selecione um contrato"),
  amount: z.coerce.number().positive("Valor deve ser positivo"),
  discount: z.coerce.number().min(0, "Desconto não pode ser negativo"),
  final_amount: z.coerce.number().positive("Valor final deve ser positivo"),
  notes: z.string().optional(),

  // Split logic
  is_split: z.boolean().default(false),
  parcels: z.array(z.object({
    id: z.string().optional(),
    amount: z.coerce.number().positive(),
    due_date: z.string().min(1, "Data de vencimento é obrigatória"),
    status: z.enum(["pending", "paid"]),
    payment_method: z.string().optional(),
    payment_date: z.string().optional()
  })).optional(),

  // Single fields (optional validation handled in superRefine)
  due_date: z.string().optional(),
  payment_date: z.string().optional(),
  payment_method: z.string().optional(),
  status: z.enum(["pending", "paid"]).optional(),
}).superRefine((data, ctx) => {
  if (data.is_split) {
    if (!data.parcels || data.parcels.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Adicione pelo menos uma parcela",
        path: ["parcels"]
      });
      return;
    }

    const totalParcels = data.parcels.reduce((sum, p) => sum + (p.amount || 0), 0);
    if (Math.abs(totalParcels - data.final_amount) > 0.05) { // 0.05 tolerance
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Soma das parcelas (R$ ${totalParcels.toFixed(2)}) difere do valor final (R$ ${data.final_amount.toFixed(2)})`,
        path: ["parcels"]
      });
    }
  } else {
    // Single validation
    if (!data.due_date) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Data de vencimento é obrigatória",
        path: ["due_date"]
      });
    }
    if (!data.status) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Status obrigatório",
        path: ["status"]
      });
    }
    if (data.status === "paid" && !data.payment_date) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Data de pagamento é obrigatória",
        path: ["payment_date"]
      });
    }
  }
});

type BillingFormData = z.infer<typeof billingSchema>;

interface Billing {
  id: string;
  contract_id: string;
  amount: number;
  discount: number;
  final_amount: number;
  // due_date, status, etc might be ambiguous if mixed with fields not in DB for billing but derived
  // The billing object passed here usually comes from `contract_billings` table
  due_date: string;
  payment_date: string | null;
  payment_method: string | null;
  status: string;
  notes: string | null;
  // We might need to check related receivables to populate "parcels"
  financial_receivables?: any[]; // We will need to fetch this if we are editing
}

interface BillingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  billing?: Billing | null;
}

export function BillingDialog({ open, onOpenChange, billing }: BillingDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { currentWorkspace } = useWorkspace();

  const form = useForm<BillingFormData>({
    resolver: zodResolver(billingSchema),
    defaultValues: {
      contract_id: "",
      amount: 0,
      discount: 0,
      final_amount: 0,
      due_date: "",
      payment_date: "",
      payment_method: "",
      status: "pending",
      notes: "",
      is_split: false,
      parcels: []
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "parcels"
  });

  const { data: contracts } = useQuery({
    queryKey: ["contracts", currentWorkspace?.id],
    queryFn: async () => {
      if (!currentWorkspace) return [];
      const { data, error } = await supabase
        .from("contracts")
        .select(`
          *,
          clients (
            id,
            name
          )
        `)
        .eq("workspace_id", currentWorkspace.id)
        .eq("status", "active")
        .order("name");

      if (error) throw error;
      return data;
    },
    enabled: !!currentWorkspace,
  });

  // Fetch existing receivables for this billing
  const { data: existingReceivables } = useQuery({
    queryKey: ["contract-receivables", billing?.id],
    queryFn: async () => {
      if (!billing?.id) return [];
      const { data, error } = await supabase
        .from("financial_receivables")
        .select("*")
        .eq("contract_billing_id", billing.id)
        .order("created_at");
      if (error) throw error;
      return data;
    },
    enabled: !!billing?.id
  });

  useEffect(() => {
    if (billing) {
      const isMulti = existingReceivables && existingReceivables.length > 1;

      form.reset({
        contract_id: billing.contract_id,
        amount: billing.amount,
        discount: billing.discount,
        final_amount: billing.final_amount,
        due_date: billing.due_date,
        payment_date: billing.payment_date || "",
        payment_method: billing.payment_method || "",
        status: billing.status as any,
        notes: billing.notes || "",
        is_split: !!isMulti,
        parcels: existingReceivables?.map(r => ({
          id: r.id,
          amount: r.amount,
          due_date: r.due_date,
          status: r.status as any,
          payment_method: r.payment_method || "",
          payment_date: r.payment_date || ""
        })) || []
      });
    } else {
      form.reset({
        contract_id: "",
        amount: 0,
        discount: 0,
        final_amount: 0,
        due_date: "",
        payment_date: "",
        payment_method: "",
        status: "pending",
        notes: "",
        is_split: false,
        parcels: []
      });
    }
  }, [billing, existingReceivables, form]);

  // Auto-fill amount when contract is selected
  useEffect(() => {
    const subscription = form.watch((value, { name }) => {
      if (name === 'contract_id' && value.contract_id) {
        const selectedContract = contracts?.find(c => c.id === value.contract_id);
        if (selectedContract) {
          form.setValue('amount', selectedContract.value);
          form.setValue('final_amount', selectedContract.value);
        }
      }
    });
    return () => subscription.unsubscribe();
  }, [form, contracts]);

  // Auto-calculate final_amount
  useEffect(() => {
    const subscription = form.watch((value, { name }) => {
      if ((name === 'amount' || name === 'discount') && value.amount !== undefined) {
        const amount = value.amount || 0;
        const discount = value.discount || 0;
        form.setValue('final_amount', amount - discount);
      }
    });
    return () => subscription.unsubscribe();
  }, [form]);

  const mutation = useMutation({
    mutationFn: async (data: BillingFormData) => {
      if (!currentWorkspace) throw new Error("Workspace não selecionado");

      const payload = {
        contract_id: data.contract_id,
        amount: data.amount,
        discount: data.discount,
        final_amount: data.final_amount,
        // For billing record, we use main fields or first parcel?
        // If split, billing record keeps "summary" values.
        due_date: data.is_split && data.parcels?.[0] ? data.parcels[0].due_date : data.due_date,
        payment_date: data.is_split ? null : (data.payment_date || null),
        payment_method: data.is_split ? null : (data.payment_method || null),
        status: data.is_split ? 'pending' : data.status, // Aggregate status is complex, keep pending for wrapper
        notes: data.notes || null,
        workspace_id: currentWorkspace.id,
      };

      // Validate category BEFORE any writes to avoid partial failure
      const selectedContract = contracts?.find(c => c.id === data.contract_id);
      const { data: catData } = await supabase
        .from('financial_categories')
        .select('id')
        .eq('type', 'income')
        .limit(1)
        .maybeSingle();

      if (!catData) throw new Error("Categoria financeira não encontrada");

      let billingId = billing?.id;

      if (billingId) {
        // Update billing
        const { error } = await supabase.from("contract_billings").update(payload).eq("id", billingId);
        if (error) throw error;
      } else {
        // Create billing
        const { data: newBilling, error } = await supabase.from("contract_billings").insert([payload]).select().single();
        if (error) throw error;
        billingId = newBilling.id;
      }

      // Prepare parcels data
      let parcelsToSync = [];
      if (data.is_split && data.parcels) {
        parcelsToSync = data.parcels.map((p, index) => ({
          id: p.id,
          title: `Cobrança Contrato - ${selectedContract?.name || 'Contrato'} (Parcela ${index + 1}/${data.parcels!.length})`,
          amount: p.amount,
          due_date: p.due_date,
          status: p.status,
          payment_date: p.payment_date || null,
          payment_method: p.payment_method || null
        }));
      } else {
        parcelsToSync = [{
          id: existingReceivables?.[0]?.id, // Try to reuse first if exists
          title: `Cobrança Contrato - ${selectedContract?.name || 'Contrato'}`,
          amount: data.final_amount,
          due_date: data.due_date!,
          status: data.status!,
          payment_date: data.payment_date || null,
          payment_method: data.payment_method || null
        }];
      }

      // 1. Delete removed
      if (existingReceivables) {
        const keptIds = parcelsToSync.map(p => p.id).filter(Boolean);
        const toDelete = existingReceivables.filter(r => !keptIds.includes(r.id));
        if (toDelete.length > 0) {
          const { error: delError } = await supabase.from("financial_receivables").delete().in("id", toDelete.map(r => r.id));
          // If delete fails (e.g. FK), we might throw or ignore? Throwing is safer.
          if (delError) throw new Error("Não foi possível excluir parcelas antigas. Verifique se existem faturas geradas.");
        }
      }

      // 2. Upsert (Insert/Update)
      for (const p of parcelsToSync) {
        const receivablesPayload = {
          workspace_id: currentWorkspace.id,
          contract_billing_id: billingId,
          contract_id: data.contract_id,
          category_id: catData.id,
          client_id: selectedContract?.clients?.id || null,
          description: `Cobrança Contrato - ${selectedContract?.name || 'Contrato'}`, // Description same as title
          total_amount: p.amount,
          ...p
        };

        if (p.id) {
          const { error: updateError } = await supabase.from("financial_receivables").update(receivablesPayload).eq("id", p.id);
          if (updateError) throw updateError;
        } else {
          // Remove undefined 'id' before insert
          const { id, ...insertData } = receivablesPayload;
          const { error: insertError } = await supabase.from("financial_receivables").insert(insertData);
          if (insertError) throw insertError;
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contract-billings"] });
      queryClient.invalidateQueries({ queryKey: ["contract-receivables"] });
      toast({
        title: billing ? "Cobrança atualizada!" : "Cobrança criada!",
        description: "Os dados foram salvos com sucesso."
      });
      onOpenChange(false);
      form.reset();
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao salvar cobrança",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: BillingFormData) => {
    if (mutation.isPending) return;
    mutation.mutate(data);
  };

  const status = form.watch("status");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {billing ? "Editar Cobrança" : "Nova Cobrança"}
          </DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="contract_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Contrato</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione um contrato" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {contracts?.map((contract) => (
                        <SelectItem key={contract.id} value={contract.id}>
                          {contract.name} - {contract.clients?.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormDescription>
                    O valor será preenchido automaticamente
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-3 gap-4">
              <FormField
                control={form.control}
                name="amount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Valor Original</FormLabel>
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
                name="discount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Desconto</FormLabel>
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
                name="final_amount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Valor Final</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="0.01"
                        placeholder="0.00"
                        {...field}
                        readOnly
                        className="bg-muted"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Split Switch */}
            <div className="flex items-center space-x-2 py-4">
              <Switch
                checked={form.watch("is_split")}
                onCheckedChange={(checked) => {
                  form.setValue("is_split", checked);
                  if (checked && (!form.getValues("parcels") || form.getValues("parcels")?.length === 0)) {
                    append({
                      amount: form.getValues("final_amount"),
                      due_date: form.getValues("due_date") || "",
                      status: "pending"
                    });
                  }
                }}
              />
              <Label>Parcelar cobrança</Label>
            </div>

            {form.watch("is_split") ? (
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <h4 className="text-sm font-medium">Parcelas</h4>
                </div>
                {fields.map((field, index) => (
                  <div key={field.id} className="grid grid-cols-12 gap-2 items-end border p-4 rounded-lg">
                    <div className="col-span-3">
                      <Label className="text-xs">Valor</Label>
                      <Input
                        type="number"
                        step="0.01"
                        {...form.register(`parcels.${index}.amount` as const)}
                        defaultValue={field.amount}
                      />
                    </div>
                    <div className="col-span-3">
                      <Label className="text-xs">Vencimento</Label>
                      <Input
                        type="date"
                        {...form.register(`parcels.${index}.due_date` as const)}
                        defaultValue={field.due_date}
                      />
                    </div>
                    <div className="col-span-3">
                      <Label className="text-xs">Status</Label>
                      <Select
                        onValueChange={(val) => form.setValue(`parcels.${index}.status`, val as any)}
                        defaultValue={field.status}
                      >
                        <SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="pending">Pendente</SelectItem>
                          <SelectItem value="paid">Pago</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="col-span-3 flex gap-2 items-end pb-1">
                      <Button type="button" variant="ghost" size="icon" onClick={() => remove(index)}>
                        <Trash2 className="h-4 w-4 text-red-500" />
                      </Button>
                    </div>
                  </div>
                ))}
                <Button type="button" variant="outline" size="sm" onClick={() => append({
                  amount: 0,
                  due_date: "",
                  status: "pending"
                })} className="gap-2">
                  <Plus className="h-4 w-4" /> Adicionar Parcela
                </Button>
                {form.formState.errors.parcels?.root && (
                  <p className="text-sm text-red-500">{form.formState.errors.parcels.root.message}</p>
                )}
                {Math.abs((form.watch("parcels")?.reduce((sum, p) => sum + Number(p.amount || 0), 0) || 0) - form.watch("final_amount")) > 0.05 && (
                  <p className="text-sm text-yellow-600">
                    Total parcelas: R$ {form.watch("parcels")?.reduce((sum, p) => sum + Number(p.amount || 0), 0).toFixed(2)} (Diferença: R$ {(form.watch("final_amount") - (form.watch("parcels")?.reduce((sum, p) => sum + Number(p.amount || 0), 0) || 0)).toFixed(2)})
                  </p>
                )}
              </div>
            ) : (
              <>
                <FormField
                  control={form.control}
                  name="due_date"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Data de Vencimento</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

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
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {status === "paid" && (
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="payment_date"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Data de Pagamento</FormLabel>
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
                          <Select onValueChange={field.onChange} value={field.value || ""}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Selecione" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="pix">PIX</SelectItem>
                              <SelectItem value="cartao">Cartão</SelectItem>
                              <SelectItem value="ted">TED</SelectItem>
                              <SelectItem value="dinheiro">Dinheiro</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                )}
              </>
            )}

            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Observações (Opcional)</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Adicione observações sobre esta cobrança..."
                      className="min-h-[80px]"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end gap-3 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={mutation.isPending}>
                {mutation.isPending && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Salvar
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
