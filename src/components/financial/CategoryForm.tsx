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
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useFinancialCategories } from "@/hooks/useFinancialModules";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";
import { Loader2, Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

const formSchema = z.object({
    name: z.string().min(1, "Nome é obrigatório"),
    type: z.enum(["income", "expense"]),
    parent_id: z.string().optional(),
});

interface CategoryFormProps {
    categoryToEdit?: any;
    open?: boolean;
    onOpenChange?: (open: boolean) => void;
    categories?: any[];
}

export function CategoryForm({ categoryToEdit, open: controlledOpen, onOpenChange: setControlledOpen, categories: propCategories }: CategoryFormProps = {}) {
    const [internalOpen, setInternalOpen] = useState(false);
    const { currentWorkspace } = useWorkspace();
    const { categories: hookCategories, createCategory, updateCategory } = useFinancialCategories(currentWorkspace?.id);

    // Use passed categories or fetch them if not provided
    const categories = propCategories || hookCategories;
    const { toast } = useToast();

    const isControlled = controlledOpen !== undefined;
    const open = isControlled ? controlledOpen : internalOpen;
    const setOpen = isControlled ? setControlledOpen! : setInternalOpen;

    const form = useForm<z.infer<typeof formSchema>>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            name: "",
            type: "expense",
            parent_id: "none",
        },
    });

    useEffect(() => {
        if (open) {
            if (categoryToEdit) {
                form.reset({
                    name: categoryToEdit.name,
                    type: categoryToEdit.type || "expense",
                    parent_id: categoryToEdit.parent_id || "none",
                });
            } else {
                form.reset({
                    name: "",
                    type: "expense",
                    parent_id: "none",
                });
            }
        }
    }, [categoryToEdit, open, form]);


    const onSubmit = async (values: z.infer<typeof formSchema>) => {
        try {
            if (categoryToEdit && updateCategory) {
                await updateCategory.mutateAsync({
                    id: categoryToEdit.id,
                    workspace_id: currentWorkspace!.id,
                    name: values.name,
                    type: values.type,
                    parent_id: values.parent_id === "none" ? null : values.parent_id,
                });
                toast({ title: "Categoria atualizada", description: "Dados atualizados com sucesso." });
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

                await createCategory.mutateAsync({
                    workspace_id: member.workspace_id,
                    name: values.name,
                    type: values.type,
                    parent_id: values.parent_id === "none" ? null : values.parent_id,
                    active: true
                });

                toast({
                    title: "Categoria criada",
                    description: "Categoria adicionada com sucesso.",
                });
            }
            setOpen(false);
            if (!categoryToEdit) form.reset();
        } catch (error) {
            console.error(error);
            toast({
                title: "Erro",
                description: "Erro ao salvar categoria.",
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
                        Nova Categoria
                    </Button>
                </DialogTrigger>
            )}
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>{categoryToEdit ? "Editar Categoria" : "Nova Categoria"}</DialogTitle>
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
                                        <Input placeholder="Ex: Alimentação" {...field} />
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
                                    <FormLabel>Tipo</FormLabel>
                                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                                        <FormControl>
                                            <SelectTrigger>
                                                <SelectValue placeholder="Selecione o tipo" />
                                            </SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                            <SelectItem value="income">Receita</SelectItem>
                                            <SelectItem value="expense">Despesa</SelectItem>
                                        </SelectContent>
                                    </Select>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="parent_id"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Categoria Pai (Opcional)</FormLabel>
                                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                                        <FormControl>
                                            <SelectTrigger>
                                                <SelectValue placeholder="Selecione..." />
                                            </SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                            <SelectItem value="none">Nenhuma</SelectItem>
                                            {categories?.filter(c => c.type === form.watch('type') && c.id !== categoryToEdit?.id).map((c) => (
                                                <SelectItem key={c.id} value={c.id}>
                                                    {c.name}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <Button type="submit" className="w-full" disabled={createCategory.isPending}>
                            {createCategory.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                            Salvar
                        </Button>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    );
}
