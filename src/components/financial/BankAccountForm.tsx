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
import { useBankAccounts } from "@/hooks/useFinancialModules";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { Loader2, Plus } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";

const formSchema = z.object({
    name: z.string().min(1, "Nome é obrigatório"),
    type: z.enum(["checking", "savings", "credit_card"]).default("checking"),
    bank_code: z.string().optional(),
    agency: z.string().optional(),
    account_number: z.string().optional(),
    initial_balance: z.coerce.number(),
    is_principal: z.boolean().default(false),
    closing_day: z.coerce.number().min(1).max(31).optional(),
    due_day: z.coerce.number().min(1).max(31).optional(),
    credit_limit: z.coerce.number().optional(),
});

interface BankAccountFormProps {
    accountToEdit?: any;
    open?: boolean;
    onOpenChange?: (open: boolean) => void;
}

export function BankAccountForm({ accountToEdit, open: controlledOpen, onOpenChange: setControlledOpen }: BankAccountFormProps) {
    const [internalOpen, setInternalOpen] = useState(false);
    const { currentWorkspace } = useWorkspace();
    const { createAccount, updateAccount } = useBankAccounts(currentWorkspace?.id);
    const { toast } = useToast();

    const isControlled = controlledOpen !== undefined;
    const open = isControlled ? controlledOpen : internalOpen;
    const setOpen = isControlled ? setControlledOpen! : setInternalOpen;

    const form = useForm<z.infer<typeof formSchema>>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            name: "",
            type: "checking",
            bank_code: "",
            agency: "",
            account_number: "",
            initial_balance: 0,
            is_principal: false,
            closing_day: 1,
            due_day: 10,
            credit_limit: 0,
        },
    });

    useEffect(() => {
        if (open) {
            if (accountToEdit) {
                form.reset({
                    name: accountToEdit.name,
                    type: accountToEdit.type || "checking",
                    bank_code: accountToEdit.bank_code || "",
                    agency: accountToEdit.agency || "",
                    account_number: accountToEdit.account_number || "",
                    initial_balance: Number(accountToEdit.initial_balance || 0),
                    is_principal: !!accountToEdit.is_principal,
                    closing_day: accountToEdit.closing_day || 1,
                    due_day: accountToEdit.due_day || 10,
                    credit_limit: Number(accountToEdit.credit_limit || 0),
                });
            } else {
                form.reset({
                    name: "",
                    type: "checking",
                    bank_code: "",
                    agency: "",
                    account_number: "",
                    initial_balance: 0,
                    is_principal: false,
                    closing_day: 1,
                    due_day: 10,
                    credit_limit: 0,
                });
            }
        }
    }, [accountToEdit, open, form]);

    const onSubmit = async (values: z.infer<typeof formSchema>) => {
        try {
            if (accountToEdit && updateAccount) {
                await updateAccount.mutateAsync({
                    id: accountToEdit.id,
                    workspace_id: accountToEdit.workspace_id,
                    name: values.name,
                    type: values.type,
                    bank_code: values.bank_code || null,
                    agency: values.agency || null,
                    account_number: values.account_number || null,
                    initial_balance: values.initial_balance,
                    is_principal: values.is_principal,
                    closing_day: values.closing_day,
                    due_day: values.due_day,
                    credit_limit: values.credit_limit,
                });
                toast({ title: "Conta atualizada", description: "Dados atualizados com sucesso." });
            } else {
                if (!currentWorkspace?.id) {
                    toast({ title: "Erro", description: "Workspace não selecionado", variant: "destructive" });
                    return;
                }

                await createAccount.mutateAsync({
                    workspace_id: currentWorkspace.id,
                    name: values.name,
                    type: values.type,
                    bank_code: values.bank_code || null,
                    agency: values.agency || null,
                    account_number: values.account_number || null,
                    initial_balance: values.initial_balance,
                    current_balance: values.initial_balance,
                    is_principal: values.is_principal,
                    closing_day: values.closing_day,
                    due_day: values.due_day,
                    credit_limit: values.credit_limit,
                });

                toast({
                    title: "Conta criada",
                    description: "A conta bancária foi adicionada com sucesso.",
                });
            }
            setOpen(false);
            if (!accountToEdit) form.reset();
        } catch (error) {
            console.error(error);
            toast({
                title: "Erro",
                description: "Ocorreu um erro ao salvar a conta.",
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
                        Nova Conta
                    </Button>
                </DialogTrigger>
            )}
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>{accountToEdit ? "Editar Conta" : "Nova Conta Bancária"}</DialogTitle>
                </DialogHeader>
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                        <FormField
                            control={form.control}
                            name="name"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Nome da Conta</FormLabel>
                                    <FormControl>
                                        <Input placeholder="Ex: Banco do Brasil" {...field} />
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
                                    <FormLabel>Tipo de Conta</FormLabel>
                                    <Select onValueChange={field.onChange} defaultValue={field.value} value={field.value}>
                                        <FormControl>
                                            <SelectTrigger>
                                                <SelectValue placeholder="Selecione o tipo..." />
                                            </SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                            <SelectItem value="checking">Conta Corrente</SelectItem>
                                            <SelectItem value="savings">Conta Poupança</SelectItem>
                                            <SelectItem value="credit_card">Cartão de Crédito</SelectItem>
                                        </SelectContent>
                                    </Select>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        {form.watch("type") === "credit_card" && (
                            <div className="space-y-4 border p-4 rounded-md bg-muted/50">
                                <h4 className="text-sm font-semibold">Configurações do Cartão</h4>
                                <div className="grid grid-cols-2 gap-4">
                                    <FormField
                                        control={form.control}
                                        name="closing_day"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Dia do Fechamento</FormLabel>
                                                <FormControl>
                                                    <Input type="number" min="1" max="31" {...field} />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                    <FormField
                                        control={form.control}
                                        name="due_day"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Dia do Vencimento</FormLabel>
                                                <FormControl>
                                                    <Input type="number" min="1" max="31" {...field} />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                </div>
                                <FormField
                                    control={form.control}
                                    name="credit_limit"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Limite Total (R$)</FormLabel>
                                            <FormControl>
                                                <Input type="number" step="0.01" {...field} />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                            </div>
                        )}

                        {form.watch("type") !== "credit_card" && (
                            <>
                                <div className="grid grid-cols-2 gap-4">
                                    <FormField
                                        control={form.control}
                                        name="bank_code"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Código Banco</FormLabel>
                                                <FormControl>
                                                    <Input placeholder="001" {...field} />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                    <FormField
                                        control={form.control}
                                        name="agency"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Agência</FormLabel>
                                                <FormControl>
                                                    <Input placeholder="1234-5" {...field} />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <FormField
                                        control={form.control}
                                        name="account_number"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Número da Conta</FormLabel>
                                                <FormControl>
                                                    <Input placeholder="12345-6" {...field} />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                    <FormField
                                        control={form.control}
                                        name="initial_balance"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Saldo Inicial (R$)</FormLabel>
                                                <FormControl>
                                                    <Input type="number" step="0.01" placeholder="0.00" {...field} />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                </div>
                            </>
                        )}

                        <FormField
                            control={form.control}
                            name="is_principal"
                            render={({ field }) => (
                                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                                    <div className="space-y-0.5">
                                        <FormLabel className="text-base">
                                            Conta Principal
                                        </FormLabel>
                                        <div className="text-sm text-muted-foreground">
                                            Esta conta será selecionada por padrão em todas as telas.
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
                        <Button type="submit" className="w-full" disabled={createAccount.isPending || updateAccount?.isPending}>
                            {(createAccount.isPending || updateAccount?.isPending) ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                            {accountToEdit ? "Salvar Alterações" : "Criar Conta"}
                        </Button>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    );
}
