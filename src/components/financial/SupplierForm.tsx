
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
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
import { Button } from "@/components/ui/button";
import { useSuppliers } from "@/hooks/useFinancialModules";
import { useToast } from "@/hooks/use-toast";
import { useState, useEffect } from "react";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { Loader2 } from "lucide-react";

const supplierSchema = z.object({
    name: z.string().min(2, "Nome é obrigatório"),
    document: z.string().optional(),
    email: z.string().email("E-mail inválido").optional().or(z.literal("")),
    phone: z.string().optional(),
});

type SupplierFormValues = z.infer<typeof supplierSchema>;

interface SupplierFormProps {
    initialData?: any;
    onSuccess?: () => void;
    trigger?: React.ReactNode;
}

export function SupplierForm({ initialData, onSuccess, trigger }: SupplierFormProps) {
    const [open, setOpen] = useState(false);
    const { createSupplier, updateSupplier } = useSuppliers();
    const { toast } = useToast();
    const { currentWorkspace } = useWorkspace();

    const form = useForm<SupplierFormValues>({
        resolver: zodResolver(supplierSchema),
        defaultValues: {
            name: "",
            document: "",
            email: "",
            phone: "",
        },
    });

    useEffect(() => {
        if (initialData) {
            form.reset({
                name: initialData.name || "",
                document: initialData.document || "",
                email: initialData.email || "",
                phone: initialData.phone || "",
            });
        } else {
            form.reset({
                name: "",
                document: "",
                email: "",
                phone: "",
            });
        }
    }, [initialData, form, open]);

    const onSubmit = async (values: SupplierFormValues) => {
        if (!currentWorkspace?.id) return;

        try {
            if (initialData) {
                await updateSupplier.mutateAsync({
                    ...values,
                    id: initialData.id,
                });
                toast({ title: "Sucesso", description: "Fornecedor atualizado com sucesso." });
            } else {
                await createSupplier.mutateAsync({
                    ...values,
                    workspace_id: currentWorkspace.id,
                });
                toast({ title: "Sucesso", description: "Fornecedor criado com sucesso." });
            }
            setOpen(false);
            onSuccess?.();
            if (!initialData) form.reset();
        } catch (error) {
            console.error(error);
            toast({
                title: "Erro",
                description: "Ocorreu um erro ao salvar o fornecedor.",
                variant: "destructive",
            });
        }
    };

    const isSubmitting = createSupplier.isPending || updateSupplier.isPending;

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                {trigger || <Button>Novo Fornecedor</Button>}
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>{initialData ? "Editar Fornecedor" : "Novo Fornecedor"}</DialogTitle>
                </DialogHeader>
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pt-4">
                        <FormField
                            control={form.control}
                            name="name"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Nome / Razão Social</FormLabel>
                                    <FormControl>
                                        <Input placeholder="Ex: Auto Posto Central" {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <FormField
                            control={form.control}
                            name="document"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>CPF / CNPJ</FormLabel>
                                    <FormControl>
                                        <Input placeholder="00.000.000/0000-00" {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <div className="grid grid-cols-1 gap-4">
                            <FormField
                                control={form.control}
                                name="email"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>E-mail</FormLabel>
                                        <FormControl>
                                            <Input placeholder="fornecedor@email.com" {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <FormField
                                control={form.control}
                                name="phone"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Telefone</FormLabel>
                                        <FormControl>
                                            <Input placeholder="(00) 00000-0000" {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>

                        <div className="flex justify-end gap-3 pt-4">
                            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                                Cancelar
                            </Button>
                            <Button type="submit" disabled={isSubmitting}>
                                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                {initialData ? "Salvar Alterações" : "Cadastrar"}
                            </Button>
                        </div>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    );
}
