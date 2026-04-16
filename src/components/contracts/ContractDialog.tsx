import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
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
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { Loader2, CheckCircle, Copy } from "lucide-react";
import { getLocalDateString } from "@/utils/format";
import { ContractAttachments } from "./ContractAttachments";

const contractSchema = z.object({
  name: z.string().min(1, "Nome do contrato é obrigatório").max(200),
  client_id: z.string().uuid("Selecione um cliente"),
  value: z.coerce.number().positive("Valor deve ser positivo"),
  contract_period: z.enum(["6_months", "12_months", "18_months", "24_months", "custom"], {
    required_error: "Período é obrigatório"
  }),
  custom_period_months: z.coerce.number().optional(),
  start_date: z.string().min(1, "Data de início é obrigatória"),
  end_date: z.string().optional(),
  billing_day: z.coerce.number().min(1, "Dia mínimo é 1").max(31, "Dia máximo é 31"),
  status: z.enum(["active", "cancelled"]).default("active"),
  implementation_fee: z.coerce.number().min(0, "Valor não pode ser negativo").optional(),
  mark_first_billing_paid: z.boolean().default(false),
  first_billing_payment_method: z.string().optional(),
  account_manager_id: z.string().uuid("Selecione um gestor de tráfego").optional().nullable(),
  cs_id: z.string().uuid("Selecione um CS responsável").optional().nullable(),
  send_to_d4sign: z.boolean().default(false),
  d4sign_template_id: z.string().optional(),
}).refine(data => {
  if (data.contract_period === "custom" && !data.custom_period_months) {
    return false;
  }
  return true;
}, {
  message: "Período customizado requer número de meses",
  path: ["custom_period_months"]
});

type ContractFormData = z.infer<typeof contractSchema>;

interface Contract {
  id: string;
  name: string;
  client_id: string;
  value: number;
  contract_period: string;
  custom_period_months: number | null;
  start_date: string;
  end_date: string | null;
  billing_day: number;
  status: string;
  implementation_fee: number | null;
  account_manager_id: string | null;
  cs_id: string | null;
}

interface ContractDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contract?: Contract | null;
}

const periodMonths: Record<string, number> = {
  "6_months": 6,
  "12_months": 12,
  "18_months": 18,
  "24_months": 24,
};

const generateBillingDates = (
  startDate: string,
  endDate: string | null,
  billingDay: number
) => {
  const dates: Date[] = [];
  const [startYear, startMonth, startDay] = startDate.split('-').map(Number);
  const startDateObj = new Date(startYear, startMonth - 1, startDay);

  let limitDate: Date;
  if (endDate) {
    const [endYear, endMonth, endDay] = endDate.split('-').map(Number);
    limitDate = new Date(endYear, endMonth - 1, endDay, 23, 59, 59);
  } else {
    limitDate = new Date(startYear, startMonth - 1, startDay);
    limitDate.setMonth(limitDate.getMonth() + 12);
  }

  // Cursor starts at 1st of start month to range check current month
  const cursor = new Date(startYear, startMonth - 1, 1);

  let safety = 0;
  while (safety < 120) {
    const year = cursor.getFullYear();
    const month = cursor.getMonth();
    const lastDayOfMonth = new Date(year, month + 1, 0).getDate();

    const dayToUse = Math.min(billingDay, lastDayOfMonth);
    const billingDate = new Date(year, month, dayToUse);

    // If billing date is valid (on or after start date) and within limit
    if (billingDate >= startDateObj && billingDate <= limitDate) {
      dates.push(billingDate);
    } else if (billingDate > limitDate) {
      break;
    }

    // Advance to next month
    cursor.setMonth(cursor.getMonth() + 1);
    safety++;
  }

  return dates;
};

export function ContractDialog({ open, onOpenChange, contract }: ContractDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { currentWorkspace } = useWorkspace();
  const [createdBillingId, setCreatedBillingId] = useState<string | null>(null);
  const [showSuccess, setShowSuccess] = useState(false);
  const [d4signEnabled, setD4signEnabled] = useState(false);
  const [templates, setTemplates] = useState<any[]>([]);
  const [loadingTemplates, setLoadingTemplates] = useState(false);

  useEffect(() => {
    const checkD4sign = async () => {
      if (!currentWorkspace) return;
      const { data } = await supabase
        .from("workspace_integrations")
        .select("id")
        .eq("workspace_id", currentWorkspace.id)
        .eq("provider", "d4sign")
        .eq("is_active", true)
        .maybeSingle();

      setD4signEnabled(!!data);
    };
    checkD4sign();
  }, [currentWorkspace]);


  const form = useForm<ContractFormData>({
    resolver: zodResolver(contractSchema),
    defaultValues: {
      name: "",
      client_id: "",
      value: 0,
      contract_period: "12_months",
      custom_period_months: undefined,
      start_date: "",
      end_date: "",
      billing_day: 5,
      status: "active",
      implementation_fee: 0,
      mark_first_billing_paid: false,
      first_billing_payment_method: "",
      account_manager_id: null,
      cs_id: null,
      send_to_d4sign: false,
      d4sign_template_id: "",
    },
  });

  const sendToD4sign = form.watch("send_to_d4sign");

  useEffect(() => {
    const fetchTemplates = async () => {
      if (sendToD4sign && templates.length === 0 && currentWorkspace?.id) {
        setLoadingTemplates(true);
        try {
          const { data, error } = await supabase.functions.invoke("d4sign-integration", {
            body: { action: "list-templates", workspaceId: currentWorkspace.id }
          });

          if (error) {
            toast({
              title: "Erro na D4Sign",
              description: `Erro ao carregar templates: ${error.message}`,
              variant: "destructive"
            });
            throw error;
          }

          let list = [];
          if (Array.isArray(data)) {
            list = data;
          } else if (data && typeof data === 'object') {
            list = data.templates || data;
          }

          if (Array.isArray(list)) {
            setTemplates(list);
            if (list.length === 0) {
              toast({
                title: "D4Sign",
                description: "Nenhum modelo de contrato encontrado.",
              });
            }
          } else if (data?.error) {
            toast({
              title: "Erro",
              description: `D4Sign: ${data.error}`,
              variant: "destructive"
            });
          }
        } catch (error: any) {
          console.error("Erro ao carregar templates D4Sign:", error);
          toast({
            title: "Erro de Conexão",
            description: "Não foi possível carregar os modelos da D4Sign. Verifique suas credenciais.",
            variant: "destructive"
          });
        } finally {
          setLoadingTemplates(false);
        }
      }
    };
    fetchTemplates();
  }, [sendToD4sign, currentWorkspace?.id, templates.length, toast]);

  const { data: clients } = useQuery({
    queryKey: ["clients", currentWorkspace?.id],
    queryFn: async () => {
      if (!currentWorkspace) return [];
      const { data, error } = await supabase
        .from("clients")
        .select("*")
        .eq("workspace_id", currentWorkspace.id)
        .eq("status", "active")
        .order("name");

      if (error) throw error;
      return data;
    },
    enabled: !!currentWorkspace,
  });


  const { data: members } = useQuery({
    queryKey: ["workspace-members-profiles", currentWorkspace?.id],
    queryFn: async () => {
      if (!currentWorkspace) return [];
      const { data, error } = await supabase
        .from("workspace_members")
        .select(`
          user_id,
          profiles (id, full_name, avatar_url)
        `)
        .eq("workspace_id", currentWorkspace.id);

      if (error) throw error;
      return (data as any[]).map(m => m.profiles).filter(p => !!p);
    },
    enabled: !!currentWorkspace,
  });

  useEffect(() => {
    if (contract) {
      form.reset({
        name: contract.name,
        client_id: contract.client_id,
        value: contract.value,
        contract_period: contract.contract_period as any,
        custom_period_months: contract.custom_period_months || undefined,
        start_date: contract.start_date,
        end_date: contract.end_date || "",
        billing_day: contract.billing_day,
        status: contract.status as any,
        implementation_fee: contract.implementation_fee || 0,
        mark_first_billing_paid: false,
        first_billing_payment_method: "",
        account_manager_id: contract.account_manager_id,
        cs_id: contract.cs_id,
      });
    } else {
      form.reset({
        name: "",
        client_id: "",
        value: 0,
        contract_period: "12_months",
        custom_period_months: undefined,
        start_date: "",
        end_date: "",
        billing_day: 5,
        status: "active",
        implementation_fee: 0,
        mark_first_billing_paid: false,
        first_billing_payment_method: "",
        account_manager_id: null,
        cs_id: null,
      });
    }
  }, [contract, form]);

  // Auto-calculate end_date based on period
  useEffect(() => {
    const subscription = form.watch((value, { name }) => {
      if ((name === 'start_date' || name === 'contract_period') &&
        value.start_date &&
        value.contract_period &&
        value.contract_period !== 'custom') {
        const [y, m, d] = value.start_date.split('-').map(Number);
        const startDate = new Date(y, m - 1, d);
        const months = periodMonths[value.contract_period];
        if (months) {
          const targetMonth = startDate.getMonth() + months;
          const originalDay = startDate.getDate();
          startDate.setMonth(targetMonth);

          // Handle safe month addition (prevent overflow e.g. Jan 31 + 1 mo -> Mar 3)
          if (startDate.getDate() !== originalDay) {
            startDate.setDate(0);
          }

          form.setValue('end_date', getLocalDateString(startDate));
        }
      }

      // Auto-populate contract name based on client name if name is empty
      if (name === 'client_id' && value.client_id) {
        const currentName = form.getValues('name');
        if (!currentName || currentName === "" || currentName.startsWith("Contrato - ")) {
          const client = (clients as any[])?.find((c: any) => c.id === value.client_id);
          if (client) {
            form.setValue('name', client.name || client.company_name);
          }
        }
      }
    });
    return () => subscription.unsubscribe();
  }, [form, clients]);

  const mutation = useMutation({
    mutationFn: async (data: ContractFormData) => {
      if (!currentWorkspace) throw new Error("Workspace não selecionado");

      const selectedClient = clients?.find(c => (c as any).id === data.client_id);
      if (data.send_to_d4sign && (!selectedClient || !(selectedClient as any).document)) {
        throw new Error("O cliente selecionado não possui CPF/CNPJ cadastrado. Por favor, atualize os dados do cliente antes de enviar para assinatura.");
      }

      const contractPayload = {
        name: data.name,
        client_id: data.client_id,
        value: data.value,
        contract_period: data.contract_period,
        custom_period_months: data.contract_period === "custom" ? data.custom_period_months : null,
        start_date: data.start_date,
        end_date: data.end_date || null,
        billing_day: data.billing_day,
        status: data.status,
        workspace_id: currentWorkspace.id,
        implementation_fee: data.implementation_fee || 0,
        account_manager_id: data.account_manager_id === "none" ? null : data.account_manager_id,
        cs_id: data.cs_id === "none" ? null : data.cs_id,
        d4sign_template_id: data.d4sign_template_id || null,
      };

      if (contract) {
        // Edição: apenas atualiza o contrato (não gera cobranças)
        const { error } = await (supabase as any)
          .from("contracts")
          .update(contractPayload)
          .eq("id", contract.id);

        if (error) throw error;
        return { billingsCreated: 0 };
      } else {
        // Criação: insere o contrato e gera cobranças automaticamente
        const { data: newContract, error: contractError } = await (supabase as any)
          .from("contracts")
          .insert(contractPayload)
          .select()
          .single();


        if (contractError) throw contractError;

        let billingsCreated = 0;
        let firstBillingId: string | null = null;

        // Implementation fee merged into first billing below

        // Gerar cobranças apenas se o contrato estiver ativo
        if (data.status === 'active') {
          const billingDates = generateBillingDates(
            data.start_date,
            data.end_date || null,
            data.billing_day
          );

          if (billingDates.length > 0) {
            const billings = billingDates.map((date, index) => {
              const baseAmount = data.value;
              const implementationFee = (index === 0 ? (data.implementation_fee || 0) : 0);
              const finalAmount = baseAmount + implementationFee;
              const isFirstAndPaid = index === 0 && data.mark_first_billing_paid;

              return {
                workspace_id: currentWorkspace.id,
                contract_id: newContract.id,
                due_date: getLocalDateString(date),
                amount: finalAmount,
                discount: 0,
                final_amount: finalAmount,
                status: (isFirstAndPaid ? 'paid' : 'pending') as "pending" | "paid",
                payment_date: isFirstAndPaid ? getLocalDateString() : null,
                payment_method: isFirstAndPaid ? (data.first_billing_payment_method || null) : null,
              };
            });

            const { data: insertedBillings, error: billingsError } = await (supabase as any)
              .from("contract_billings")
              .insert(billings)
              .select();

            if (billingsError) throw billingsError;
            billingsCreated += billings.length;

            if (!firstBillingId && insertedBillings && insertedBillings.length > 0) {
              firstBillingId = insertedBillings[0].id;
            }

            // Financial records creation delegated to database triggers to prevent duplication
          }
        }

        if (data.send_to_d4sign && data.d4sign_template_id) {
          try {
            const client = clients?.find(c => (c as any).id === data.client_id);
            await supabase.functions.invoke("d4sign-integration", {
              body: {
                contractId: newContract.id,
                templateId: data.d4sign_template_id,
                workspaceId: currentWorkspace.id,
                signers: [
                  {
                    name: client ? (client as any).name : "Cliente",
                    email: client ? (client as any).email : "",
                    document: client ? (client as any).document : "",
                  }
                ]
              }
            });
          } catch (error) {
            console.error("Erro ao enviar para D4Sign:", error);
            toast({
              title: "Aviso",
              description: "Contrato criado, mas houve erro ao enviar para assinatura eletrônica.",
              variant: "destructive"
            });
          }
        }

        return { billingsCreated, firstBillingId };
      }
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["contracts"] });
      queryClient.invalidateQueries({ queryKey: ["contract-billings"] });

      if (!contract && result.firstBillingId) {
        setCreatedBillingId(result.firstBillingId);
        setShowSuccess(true);
      } else {
        const description = contract
          ? "O contrato foi atualizado com sucesso."
          : result.billingsCreated > 0
            ? `Contrato criado com ${result.billingsCreated} cobrança${result.billingsCreated > 1 ? 's' : ''} gerada${result.billingsCreated > 1 ? 's' : ''} automaticamente.`
            : "O contrato foi criado com sucesso.";

        toast({
          title: contract ? "Contrato atualizado!" : "Contrato criado!",
          description,
        });
        onOpenChange(false);
        form.reset();
      }
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao salvar contrato",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: ContractFormData) => {
    if (mutation.isPending) return;
    mutation.mutate(data);
  };

  const period = form.watch("contract_period");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {showSuccess ? "Contrato Criado com Sucesso!" : (contract ? "Editar Contrato" : "Novo Contrato")}
          </DialogTitle>
        </DialogHeader>

        {showSuccess && createdBillingId ? (
          <div className="py-6 space-y-6">
            <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-6 text-center">
              <div className="w-16 h-16 bg-emerald-500 rounded-full flex items-center justify-center text-white mx-auto mb-4 shadow-lg shadow-emerald-200">
                <CheckCircle className="w-10 h-10" />
              </div>
              <h3 className="text-xl font-black text-emerald-900">Tudo Pronto!</h3>
              <p className="text-emerald-700 font-medium">O contrato foi criado e a primeira mensalidade já está disponível para pagamento.</p>
            </div>

            <div className="space-y-3">
              <Label className="text-xs font-black uppercase text-slate-400">Link de Pagamento do Cliente</Label>
              <div className="flex gap-2">
                <Input
                  readOnly
                  value={`${window.location.origin}/invoice/${createdBillingId}`}
                  className="bg-slate-50 font-mono text-xs"
                />
                <Button
                  onClick={() => {
                    navigator.clipboard.writeText(`${window.location.origin}/invoice/${createdBillingId}`);
                    toast({ title: "Copiado!", description: "Link copiado para a área de transferência." });
                  }}
                  variant="outline"
                  size="icon"
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <div className="flex gap-3">
              <Button
                variant="outline"
                className="flex-1 h-12 rounded-xl font-bold"
                onClick={() => {
                  setShowSuccess(false);
                  setCreatedBillingId(null);
                  onOpenChange(false);
                  form.reset();
                }}
              >
                FECHAR
              </Button>
              <Button
                className="flex-1 h-12 rounded-xl font-black bg-primary"
                onClick={() => window.open(`${window.location.origin}/invoice/${createdBillingId}`, '_blank')}
              >
                VER FATURA
              </Button>
            </div>
          </div>
        ) : (
          <>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nome do Contrato</FormLabel>
                      <FormControl>
                        <Input placeholder="Ex: Contrato Mensal - Marketing Digital" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="client_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Cliente</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione um cliente" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {clients?.map((client: any) => (
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

                <FormField
                  control={form.control}
                  name="value"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Valor Mensal (MRR)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step="0.01"
                          placeholder="0.00"
                          {...field}
                        />
                      </FormControl>
                      <FormDescription>
                        Valor que será cobrado mensalmente
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="implementation_fee"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Valor de Implementação (Opcional)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step="0.01"
                          placeholder="0.00"
                          {...field}
                        />
                      </FormControl>
                      <FormDescription>
                        💡 Este valor será adicionado apenas à primeira cobrança
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {!contract && (
                  <>
                    <FormField
                      control={form.control}
                      name="mark_first_billing_paid"
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
                              Marcar primeira cobrança como paga
                            </FormLabel>
                            <FormDescription>
                              A primeira mensalidade já foi recebida
                            </FormDescription>
                          </div>
                        </FormItem>
                      )}
                    />

                    {form.watch("mark_first_billing_paid") && (
                      <FormField
                        control={form.control}
                        name="first_billing_payment_method"
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
                                <SelectItem value="pix">PIX</SelectItem>
                                <SelectItem value="cartao">Cartão de Crédito</SelectItem>
                                <SelectItem value="ted">Transferência Bancária</SelectItem>
                                <SelectItem value="dinheiro">Dinheiro</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    )}
                  </>
                )}

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="contract_period"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Período do Contrato</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Selecione o período" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="6_months">6 meses</SelectItem>
                            <SelectItem value="12_months">12 meses</SelectItem>
                            <SelectItem value="18_months">18 meses</SelectItem>
                            <SelectItem value="24_months">24 meses</SelectItem>
                            <SelectItem value="custom">Período Customizado</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {period === "custom" && (
                    <FormField
                      control={form.control}
                      name="custom_period_months"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Meses (Custom)</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              min="1"
                              placeholder="Ex: 36"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="start_date"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Data de Início</FormLabel>
                        <FormControl>
                          <Input type="date" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="end_date"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Data de Término</FormLabel>
                        <FormControl>
                          <Input type="date" {...field} />
                        </FormControl>
                        <FormDescription>
                          {period !== "custom" ? "Calculado automaticamente" : "Opcional"}
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="billing_day"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Dia de Cobrança</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min="1"
                          max="31"
                          placeholder="Ex: 5 (todo dia 5 do mês)"
                          {...field}
                        />
                      </FormControl>
                      <FormDescription>
                        💡 As cobranças mensais serão geradas automaticamente neste dia
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {contract && (
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
                            <SelectItem value="active">Ativo</SelectItem>
                            <SelectItem value="cancelled">Cancelado</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}

                <div className="border-t pt-4 mt-6">
                  <h3 className="text-sm font-medium mb-4">Gestão Operacional</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="account_manager_id"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Gestor de Tráfego</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value || "none"}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Selecione um gestor" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="none">Nenhum Gestor</SelectItem>
                              {members?.map((member: any) => (
                                <SelectItem key={member.id} value={member.id}>
                                  {member.full_name}
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
                      name="cs_id"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>CS Responsável</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value || "none"}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Selecione um CS" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="none">Nenhum CS</SelectItem>
                              {members?.map((member: any) => (
                                <SelectItem key={member.id} value={member.id}>
                                  {member.full_name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>

                {d4signEnabled && !contract && (
                  <div className="border-t pt-4 mt-6 space-y-4">
                    <h3 className="text-sm font-medium">Assinatura Eletrônica (D4Sign)</h3>
                    <FormField
                      control={form.control}
                      name="send_to_d4sign"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4 bg-orange-50/30 border-orange-100">
                          <FormControl>
                            <Checkbox
                              checked={field.value}
                              onCheckedChange={field.onChange}
                            />
                          </FormControl>
                          <div className="space-y-1 leading-none">
                            <FormLabel>
                              Enviar automaticamente para assinatura
                            </FormLabel>
                            <FormDescription>
                              Gera o documento e envia por e-mail para o cliente
                            </FormDescription>
                          </div>
                        </FormItem>
                      )}
                    />

                    {form.watch("send_to_d4sign") && (
                      <FormField
                        control={form.control}
                        name="d4sign_template_id"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Modelo de Contrato (D4Sign)</FormLabel>
                            {loadingTemplates ? (
                              <div className="flex items-center gap-2 text-xs text-slate-500 py-2">
                                <Loader2 className="w-3 h-3 animate-spin" /> Carregando modelos...
                              </div>
                            ) : (
                              <Select onValueChange={field.onChange} value={field.value}>
                                <FormControl>
                                  <SelectTrigger>
                                    <SelectValue placeholder="Selecione um modelo..." />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  {templates.map((t) => (
                                    <SelectItem key={t.id_template || t.id} value={t.id_template || t.id}>
                                      {t.name_template || t.name}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            )}
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    )}
                  </div>
                )}

                <div className="flex justify-end gap-3 pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => onOpenChange(false)}
                  >
                    Cancelar
                  </Button>
                  <Button type="submit" className="w-full h-12 rounded-xl font-black bg-primary" disabled={mutation.isPending}>
                    {mutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                    {contract ? "SALVAR ALTERAÇÕES" : "CRIAR CONTRATO"}
                  </Button>
                </div>
              </form>
            </Form>

            {contract && (
              <div className="mt-8 pt-6 border-t">
                <h4 className="text-xs font-black uppercase tracking-widest text-slate-400 mb-4">Anexos do Contrato</h4>
                <ContractAttachments contractId={contract.id} />
              </div>
            )}
          </>
        )}
      </DialogContent>
    </Dialog >
  );
}
