import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/contexts/WorkspaceContext";
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
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";

const productSchema = z.object({
  name: z.string().min(1, "Nome é obrigatório"),
  description: z.string().optional(),
  type: z.enum(["recurring", "one_time"]),
  base_price: z.string().optional(),
  default_period: z.string().optional(),
  default_implementation_fee: z.string().optional(),
  default_cancellation_penalty: z.string().optional(),
  recurrence_type: z.enum(["one_time", "monthly", "yearly", "custom"]).optional(),
  signature_required: z.boolean().default(false),
  is_active: z.boolean().default(true),
});

type ProductFormValues = z.infer<typeof productSchema>;

interface ProductDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product?: any;
  onClose: () => void;
}

export function ProductDialog({
  open,
  onOpenChange,
  product,
  onClose,
}: ProductDialogProps) {
  const { currentWorkspace } = useWorkspace();
  const queryClient = useQueryClient();

  const form = useForm<ProductFormValues>({
    resolver: zodResolver(productSchema),
    defaultValues: {
      name: "",
      description: "",
      type: "recurring",
      base_price: "",
      default_period: "",
      default_implementation_fee: "",
      default_cancellation_penalty: "",
      recurrence_type: "one_time",
      signature_required: false,
      is_active: true,
    },
  });

  useEffect(() => {
    if (product) {
      form.reset({
        name: product.name || "",
        description: product.description || "",
        type: product.type || "recurring",
        base_price: product.base_price?.toString() || "",
        default_period: product.default_period || "",
        default_implementation_fee: product.default_implementation_fee?.toString() || "",
        default_cancellation_penalty: product.default_cancellation_penalty?.toString() || "",
        recurrence_type: product.recurrence_type || "one_time",
        signature_required: product.signature_required || false,
        is_active: product.is_active ?? true,
      });
    } else {
      form.reset({
        name: "",
        description: "",
        type: "recurring",
        base_price: "",
        default_period: "",
        default_implementation_fee: "",
        default_cancellation_penalty: "",
        recurrence_type: "one_time",
        signature_required: false,
        is_active: true,
      });
    }
  }, [product, form, open]);

  const createMutation = useMutation({
    mutationFn: async (values: ProductFormValues) => {
      if (!currentWorkspace?.id) throw new Error("Workspace não encontrado");

      const { data, error } = await supabase
        .from("products")
        .insert({
          workspace_id: currentWorkspace.id,
          name: values.name,
          description: values.description || null,
          type: values.type,
          base_price: values.base_price ? parseFloat(values.base_price) : null,
          default_period: values.default_period || null,
          default_implementation_fee: values.default_implementation_fee
            ? parseFloat(values.default_implementation_fee)
            : null,
          default_cancellation_penalty: values.default_cancellation_penalty
            ? parseFloat(values.default_cancellation_penalty)
            : null,
          recurrence_type: values.recurrence_type,
          signature_required: values.signature_required,
          is_active: values.is_active,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      toast.success("Produto criado com sucesso!");
      onClose();
    },
    onError: (error) => {
      console.error("Erro ao criar produto:", error);
      toast.error("Erro ao criar produto");
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (values: ProductFormValues) => {
      if (!product?.id) throw new Error("ID do produto não encontrado");

      const { data, error } = await supabase
        .from("products")
        .update({
          name: values.name,
          description: values.description || null,
          type: values.type,
          base_price: values.base_price ? parseFloat(values.base_price) : null,
          default_period: values.default_period || null,
          default_implementation_fee: values.default_implementation_fee
            ? parseFloat(values.default_implementation_fee)
            : null,
          default_cancellation_penalty: values.default_cancellation_penalty
            ? parseFloat(values.default_cancellation_penalty)
            : null,
          recurrence_type: values.recurrence_type,
          signature_required: values.signature_required,
          is_active: values.is_active,
        })
        .eq("id", product.id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      toast.success("Produto atualizado com sucesso!");
      onClose();
    },
    onError: (error) => {
      console.error("Erro ao atualizar produto:", error);
      toast.error("Erro ao atualizar produto");
    },
  });

  const onSubmit = (values: ProductFormValues) => {
    if (product) {
      updateMutation.mutate(values);
    } else {
      createMutation.mutate(values);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {product ? "Editar Produto" : "Novo Produto"}
          </DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nome *</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Descrição</FormLabel>
                  <FormControl>
                    <Textarea {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Tipo *</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    defaultValue={field.value}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione o tipo" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="recurring">Recorrente (Contrato)</SelectItem>
                      <SelectItem value="one_time">Avulso</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="base_price"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Preço Base</FormLabel>
                    <FormControl>
                      <Input type="number" step="0.01" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="default_period"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Período Padrão</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="6_months">6 meses</SelectItem>
                        <SelectItem value="12_months">12 meses</SelectItem>
                        <SelectItem value="24_months">24 meses</SelectItem>
                        <SelectItem value="custom">Personalizado</SelectItem>
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
                name="default_implementation_fee"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Taxa de Implementação</FormLabel>
                    <FormControl>
                      <Input type="number" step="0.01" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="default_cancellation_penalty"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Multa Rescisória</FormLabel>
                    <FormControl>
                      <Input type="number" step="0.01" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="recurrence_type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tipo de Recorrência</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="one_time">Venda Única</SelectItem>
                        <SelectItem value="monthly">Mensal</SelectItem>
                        <SelectItem value="yearly">Anual</SelectItem>
                        <SelectItem value="custom">Outro</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="signature_required"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm mt-8">
                    <div className="space-y-0.5">
                      <FormLabel>Exige Assinatura</FormLabel>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="is_active"
              render={({ field }) => (
                <FormItem className="flex items-center justify-between rounded-lg border p-4">
                  <div className="space-y-0.5">
                    <FormLabel>Ativo</FormLabel>
                    <div className="text-sm text-muted-foreground">
                      Produto disponível para seleção
                    </div>
                  </div>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                </FormItem>
              )}
            />

            <div className="flex justify-end gap-2 pt-4">
              <Button type="button" variant="outline" onClick={onClose}>
                Cancelar
              </Button>
              <Button type="submit">
                {product ? "Atualizar" : "Criar"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
