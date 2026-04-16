import { useEffect } from "react";
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
import { useCostCenters } from "@/hooks/useFinancialModules";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";
import { Loader2, Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

const formSchema = z.object({
    name: z.string().min(1, "Nome é obrigatório"),
    code: z.string().optional(),
    description: z.string().optional(),
});

interface CostCenterFormProps {
    costCenterToEdit?: any;
    open?: boolean;
    onOpenChange?: (open: boolean) => void;
}

export function CostCenterForm({ costCenterToEdit, open: controlledOpen, onOpenChange: setControlledOpen }: CostCenterFormProps = {}) {
    const [internalOpen, setInternalOpen] = useState(false);
    const { createCostCenter, updateCostCenter } = useCostCenters();
    const { toast } = useToast();

    const isControlled = controlledOpen !== undefined;
    const open = isControlled ? controlledOpen : internalOpen;
    const setOpen = isControlled ? setControlledOpen! : setInternalOpen;

    const form = useForm<z.infer<typeof formSchema>>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            name: "",
            code: "",
            description: "",
        },
    });

    useEffect(() => {
        if (open) {
            if (costCenterToEdit) {
                form.reset({
                    name: costCenterToEdit.name,
                    code: costCenterToEdit.code || "",
                    description: costCenterToEdit.description || "",
                });
            } else {
                form.reset({
                    name: "",
                    code: "",
                    description: "",
                });
            }
        }
    }, [costCenterToEdit, open, form]);


    const onSubmit = async (values: z.infer<typeof formSchema>) => {
        try {
            if (costCenterToEdit && updateCostCenter) {
                await updateCostCenter.mutateAsync({
                    id: costCenterToEdit.id,
                    name: values.name,
                    code: values.code || null,
                    description: values.description || null,
                });
                toast({ title: "Centro de Custo atualizado", description: "Dados atualizados com sucesso." });
            } else {
                const { data: { session } } = await supabase.auth.getSession();
                if (!session) return;

                const { data: member } = await supabase
                    .from('workspace_members')
                    .select('workspace_id')
                    .eq('user_id', session.user.id)
                    .single();

                if (!member) {
                    toast({ title: "Erro", description: "Workspace não encontrado", variant: "destructive" });
                    return;
                }

                await createCostCenter.mutateAsync({
                    workspace_id: member.workspace_id,
                    name: values.name,
                    code: values.code || null,
                    description: values.description || null,
                    active: true
                });

                toast({
                    title: "Centro de Custo criado",
                    description: "Centro de custo adicionado com sucesso.",
                });
            }
            setOpen(false);
            if (!costCenterToEdit) form.reset();
        } catch (error) {
            console.error(error);
            toast({
                title: "Erro",
                description: "Erro ao salvar centro de custo.",
                variant: "destructive",
            });
        }
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            {!isControlled && (
                <DialogTrigger asChild>
                    <Button>
                        <Plus className="mr-2 h-4 w-4" />
                        Novo Centro de Custo
                    </Button>
                </DialogTrigger>
            )}
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>{costCenterToEdit ? "Editar Centro de Custo" : "Novo Centro de Custo"}</DialogTitle>
                </DialogHeader>
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                        <FormField
                            control={form.control}
                            name="name"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Nome</FormLabel>
                                    <FormControl>
                                        <Input placeholder="Ex: Marketing" {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="code"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Código (Opcional)</FormLabel>
                                    <FormControl>
                                        <Input placeholder="Ex: 1.01" {...field} />
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
                                    <FormLabel>Descrição (Opcional)</FormLabel>
                                    <FormControl>
                                        <Input placeholder="Ex: Despesas com marketing e publicidade" {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <Button type="submit" className="w-full" disabled={createCostCenter.isPending}>
                            {createCostCenter.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                            Salvar
                        </Button>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    );
}
