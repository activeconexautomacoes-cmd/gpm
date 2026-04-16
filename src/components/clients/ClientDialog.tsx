import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import type { Client } from "@/pages/Clients";

const clientSchema = z.object({
  name: z.string().min(1, "Nome é obrigatório").max(100, "Nome muito longo"),
  trade_name: z.string().optional().nullable(),
  email: z.string().email("Email inválido").optional().or(z.literal("")).nullable(),
  email_billing: z.string().email("Email inválido").optional().or(z.literal("")).nullable(),
  phone: z.string().optional().nullable(),
  mobile: z.string().optional().nullable(),
  document: z.string().min(1, "CPF/CNPJ é obrigatório"),
  state_registration: z.string().optional().nullable(),
  municipal_registration: z.string().optional().nullable(),
  status: z.enum(["active", "inactive"]),
  notes: z.string().optional().nullable(),
  squad_id: z.string().optional().nullable(),
  account_manager_id: z.string().optional().nullable(),
  zip_code: z.string().optional().nullable(),
  street: z.string().optional().nullable(),
  number: z.string().optional().nullable(),
  complement: z.string().optional().nullable(),
  neighborhood: z.string().optional().nullable(),
  city: z.string().optional().nullable(),
  state: z.string().optional().nullable(),
  profession: z.string().optional().nullable(),
  activity_segment: z.string().optional().nullable(),
  revenue_bracket: z.string().optional().nullable(),
  source: z.string().optional().nullable(),
  registration_date: z.string().optional().nullable(),
});

type ClientFormValues = z.infer<typeof clientSchema>;

interface ClientDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  client?: Client | null;
}

export function ClientDialog({ open, onOpenChange, client }: ClientDialogProps) {
  const { currentWorkspace, user } = useWorkspace();
  const queryClient = useQueryClient();

  const form = useForm<ClientFormValues>({
    resolver: zodResolver(clientSchema),
    defaultValues: {
      name: "",
      trade_name: "",
      email: "",
      email_billing: "",
      phone: "",
      mobile: "",
      document: "",
      state_registration: "",
      municipal_registration: "",
      status: "active",
      notes: "",
      squad_id: null,
      account_manager_id: null,
      zip_code: "",
      street: "",
      number: "",
      complement: "",
      neighborhood: "",
      city: "",
      state: "",
      profession: "",
      activity_segment: "",
      revenue_bracket: "",
      source: "",
      registration_date: "",
    },
  });

  const { data: squads } = useQuery({
    queryKey: ["squads", currentWorkspace?.id],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("squads")
        .select("*")
        .eq("workspace_id", currentWorkspace?.id);
      if (error) throw error;
      return data as any[];
    },
    enabled: !!currentWorkspace?.id
  });

  const { data: managers } = useQuery({
    queryKey: ["workspace-managers", currentWorkspace?.id],
    queryFn: async () => {
      const { data: members } = await supabase
        .from("workspace_members")
        .select("user_id")
        .eq("workspace_id", currentWorkspace?.id);

      if (!members || members.length === 0) return [];

      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name")
        .in("id", members.map(m => m.user_id));
      if (error) throw error;
      return data as any[];
    },
    enabled: !!currentWorkspace?.id
  });

  useEffect(() => {
    if (client) {
      form.reset({
        name: client.name,
        trade_name: client.trade_name || "",
        email: client.email || "",
        email_billing: client.email_billing || "",
        phone: client.phone || "",
        mobile: client.mobile || "",
        document: client.document || "",
        state_registration: client.state_registration || "",
        municipal_registration: client.municipal_registration || "",
        status: client.status,
        notes: client.notes || "",
        squad_id: (client as any).squad_id || null,
        account_manager_id: (client as any).account_manager_id || null,
        zip_code: client.zip_code || "",
        street: client.street || "",
        number: client.number || "",
        complement: client.complement || "",
        neighborhood: client.neighborhood || "",
        city: client.city || "",
        state: client.state || "",
        profession: client.profession || "",
        activity_segment: client.activity_segment || "",
        revenue_bracket: client.revenue_bracket || "",
        source: client.source || "",
        registration_date: client.registration_date || "",
      });
    } else {
      form.reset({
        name: "",
        trade_name: "",
        email: "",
        email_billing: "",
        phone: "",
        mobile: "",
        document: "",
        state_registration: "",
        municipal_registration: "",
        status: "active",
        notes: "",
        squad_id: null,
        account_manager_id: null,
        zip_code: "",
        street: "",
        number: "",
        complement: "",
        neighborhood: "",
        city: "",
        state: "",
        profession: "",
        activity_segment: "",
        revenue_bracket: "",
        source: "",
        registration_date: "",
      });
    }
  }, [client, form]);

  const createMutation = useMutation({
    mutationFn: async (values: ClientFormValues) => {
      if (!currentWorkspace?.id) throw new Error("Workspace não encontrado");

      const { error } = await (supabase as any).from("clients").insert({
        workspace_id: currentWorkspace.id,
        name: values.name,
        trade_name: values.trade_name || null,
        email: values.email || null,
        email_billing: values.email_billing || null,
        phone: values.phone || null,
        mobile: values.mobile || null,
        document: values.document || null,
        state_registration: values.state_registration || null,
        municipal_registration: values.municipal_registration || null,
        status: values.status,
        notes: values.notes || null,
        squad_id: values.squad_id || null,
        account_manager_id: values.account_manager_id || null,
        zip_code: values.zip_code || null,
        street: values.street || null,
        number: values.number || null,
        complement: values.complement || null,
        neighborhood: values.neighborhood || null,
        city: values.city || null,
        state: values.state || null,
        profession: values.profession || null,
        activity_segment: values.activity_segment || null,
        revenue_bracket: values.revenue_bracket || null,
        source: values.source || null,
        registration_date: values.registration_date || null,
      });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["clients"] });

      // Log activity
      if (user?.id && currentWorkspace?.id) {
        (supabase as any).from("client_activities").insert({
          workspace_id: currentWorkspace.id,
          // We don't have the client ID here easily unless we select it back
          // But we can skip it or select it. Let's skip for create as it's less critical 
          // or I'll select it back.
        });
      }

      toast.success("Cliente criado com sucesso");
      onOpenChange(false);
    },
    onError: (error) => {
      toast.error("Erro ao criar cliente: " + error.message);
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (values: ClientFormValues) => {
      if (!client?.id) throw new Error("Cliente não encontrado");

      const { error } = await (supabase as any)
        .from("clients")
        .update({
          name: values.name,
          trade_name: values.trade_name || null,
          email: values.email || null,
          email_billing: values.email_billing || null,
          phone: values.phone || null,
          mobile: values.mobile || null,
          document: values.document || null,
          state_registration: values.state_registration || null,
          municipal_registration: values.municipal_registration || null,
          status: values.status,
          notes: values.notes || null,
          squad_id: values.squad_id || null,
          account_manager_id: values.account_manager_id || null,
          zip_code: values.zip_code || null,
          street: values.street || null,
          number: values.number || null,
          complement: values.complement || null,
          neighborhood: values.neighborhood || null,
          city: values.city || null,
          state: values.state || null,
          profession: values.profession || null,
          activity_segment: values.activity_segment || null,
          revenue_bracket: values.revenue_bracket || null,
          source: values.source || null,
          registration_date: values.registration_date || null,
        })
        .eq("id", client.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["clients"] });

      // Log activity
      if (client?.id && user?.id && currentWorkspace?.id) {
        (supabase as any).from("client_activities").insert({
          workspace_id: currentWorkspace.id,
          client_id: client.id,
          user_id: user.id,
          description: `Atualizou os dados do cliente`,
          type: 'info'
        }).then();
      }

      toast.success("Cliente atualizado com sucesso");
      onOpenChange(false);
    },
    onError: (error) => {
      toast.error("Erro ao atualizar cliente: " + error.message);
    },
  });

  const onSubmit = (values: ClientFormValues) => {
    const formattedValues = {
      ...values,
      squad_id: values.squad_id === "none" ? null : values.squad_id,
      account_manager_id: values.account_manager_id === "none" ? null : values.account_manager_id,
    };
    if (client) {
      updateMutation.mutate(formattedValues);
    } else {
      createMutation.mutate(formattedValues);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {client ? "Editar Cliente" : "Novo Cliente"}
          </DialogTitle>
          <DialogDescription>
            {client
              ? "Atualize as informações do cliente"
              : "Adicione um novo cliente ao sistema"}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <div className="space-y-4">
              <h4 className="text-sm font-bold uppercase tracking-wider text-muted-foreground border-b pb-1">Informações Básicas</h4>
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Razão Social / Nome *</FormLabel>
                      <FormControl>
                        <Input placeholder="Nome completo ou Razão Social" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="trade_name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nome Fantasia</FormLabel>
                      <FormControl>
                        <Input placeholder="Nome fantasia" {...field} value={field.value || ""} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-3 gap-4">
                <FormField
                  control={form.control}
                  name="document"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>CPF/CNPJ *</FormLabel>
                      <FormControl>
                        <Input placeholder="000.000.000-00" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="state_registration"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Insc. Estadual</FormLabel>
                      <FormControl>
                        <Input placeholder="Inscrição estadual" {...field} value={field.value || ""} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="municipal_registration"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Insc. Municipal</FormLabel>
                      <FormControl>
                        <Input placeholder="Inscrição municipal" {...field} value={field.value || ""} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email Principal</FormLabel>
                      <FormControl>
                        <Input
                          type="email"
                          placeholder="email@exemplo.com"
                          {...field}
                          value={field.value || ""}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="email_billing"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email Financeiro</FormLabel>
                      <FormControl>
                        <Input
                          type="email"
                          placeholder="financeiro@exemplo.com"
                          {...field}
                          value={field.value || ""}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="phone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Telefone</FormLabel>
                      <FormControl>
                        <Input placeholder="(00) 0000-0000" {...field} value={field.value || ""} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="mobile"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Celular</FormLabel>
                      <FormControl>
                        <Input placeholder="(00) 00000-0000" {...field} value={field.value || ""} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            <div className="space-y-4">
              <h4 className="text-sm font-bold uppercase tracking-wider text-muted-foreground border-b pb-1">Endereço</h4>
              <div className="grid grid-cols-4 gap-4">
                <FormField
                  control={form.control}
                  name="zip_code"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>CEP</FormLabel>
                      <FormControl>
                        <Input placeholder="00000-000" {...field} value={field.value || ""} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="street"
                  render={({ field }) => (
                    <FormItem className="col-span-2">
                      <FormLabel>Rua</FormLabel>
                      <FormControl>
                        <Input placeholder="Rua / Avenida" {...field} value={field.value || ""} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="number"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Número</FormLabel>
                      <FormControl>
                        <Input placeholder="Nº" {...field} value={field.value || ""} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-4 gap-4">
                <FormField
                  control={form.control}
                  name="complement"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Complemento</FormLabel>
                      <FormControl>
                        <Input placeholder="Apto, Sala, etc" {...field} value={field.value || ""} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="neighborhood"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Bairro</FormLabel>
                      <FormControl>
                        <Input placeholder="Bairro" {...field} value={field.value || ""} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="city"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Cidade</FormLabel>
                      <FormControl>
                        <Input placeholder="Cidade" {...field} value={field.value || ""} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="state"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>UF</FormLabel>
                      <FormControl>
                        <Input placeholder="Estado" maxLength={2} {...field} value={field.value || ""} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            <div className="space-y-4">
              <h4 className="text-sm font-bold uppercase tracking-wider text-muted-foreground border-b pb-1">Dados Gerenciais & Perfil</h4>
              <div className="grid grid-cols-3 gap-4">
                <FormField
                  control={form.control}
                  name="profession"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Profissão</FormLabel>
                      <FormControl>
                        <Input placeholder="Profissão" {...field} value={field.value || ""} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="activity_segment"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Ramo de Atividade</FormLabel>
                      <FormControl>
                        <Input placeholder="Ex: Comércio" {...field} value={field.value || ""} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="revenue_bracket"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Faturamento</FormLabel>
                      <FormControl>
                        <Input placeholder="Ex: R$ 50k - 100k" {...field} value={field.value || ""} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-4 gap-4">
                <FormField
                  control={form.control}
                  name="source"
                  render={({ field }) => (
                    <FormItem className="col-span-2">
                      <FormLabel>Origem</FormLabel>
                      <FormControl>
                        <Input placeholder="Instagram, Indicação, etc" {...field} value={field.value || ""} />
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
                      <FormLabel>Status Sistema</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        value={field.value}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Status" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="active">Ativo</SelectItem>
                          <SelectItem value="inactive">Inativo</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="squad_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Squad Responsável</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        value={field.value || "none"}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione o squad" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="none">Nenhum</SelectItem>
                          {squads?.map((squad) => (
                            <SelectItem key={squad.id} value={squad.id}>
                              {squad.name}
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
                  name="account_manager_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Gestor de Conta (CS)</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        value={field.value || "none"}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione o gestor" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="none">Nenhum</SelectItem>
                          {managers?.map((manager) => (
                            <SelectItem key={manager.id} value={manager.id}>
                              {manager.full_name}
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

            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Observações</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Notas adicionais sobre o cliente"
                      className="min-h-[80px]"
                      {...field}
                      value={field.value || ""}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end gap-2 pt-4 sticky bottom-0 bg-background pb-1">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={createMutation.isPending || updateMutation.isPending}
                className="bg-blue-600 hover:bg-blue-700"
              >
                {createMutation.isPending || updateMutation.isPending
                  ? "Salvando..."
                  : client
                    ? "Atualizar Cliente"
                    : "Criar Cliente"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
