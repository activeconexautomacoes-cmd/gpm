import * as React from "react";
import { Check, ChevronsUpDown, Plus, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
} from "@/components/ui/command";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import { useClients } from "@/hooks/useFinancialModules";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";

interface ClientComboboxProps {
    value: string;
    onValueChange: (value: string) => void;
}

export function ClientCombobox({ value, onValueChange }: ClientComboboxProps) {
    const [open, setOpen] = React.useState(false);
    const [searchTerm, setSearchTerm] = React.useState("");
    const [isCreating, setIsCreating] = React.useState(false);
    const { currentWorkspace } = useWorkspace();
    const { clients } = useClients(currentWorkspace?.id);
    const queryClient = useQueryClient();
    const { toast } = useToast();

    const selectedClient = React.useMemo(() => {
        if (!value || !clients) return null;
        return clients.find((c) => c.id === value);
    }, [value, clients]);

    const filteredClients = React.useMemo(() => {
        if (!clients) return [];
        if (!searchTerm) return clients;
        const term = searchTerm.toLowerCase();
        return clients.filter(
            (c) =>
                c.name.toLowerCase().includes(term) ||
                (c.document && c.document.toLowerCase().includes(term))
        );
    }, [clients, searchTerm]);

    const exactNameMatch = React.useMemo(() => {
        if (!clients || !searchTerm) return false;
        return clients.some(
            (c) => c.name.toLowerCase() === searchTerm.toLowerCase()
        );
    }, [clients, searchTerm]);

    const handleCreateClient = async () => {
        if (!currentWorkspace?.id || !searchTerm.trim()) return;

        setIsCreating(true);
        try {
            const { data, error } = await (supabase as any)
                .from("clients")
                .insert({
                    workspace_id: currentWorkspace.id,
                    name: searchTerm.trim(),
                    status: "active",
                })
                .select("id")
                .single();

            if (error) throw error;

            await queryClient.invalidateQueries({
                queryKey: ["clients", currentWorkspace.id],
            });

            onValueChange(data.id);
            setSearchTerm("");
            setOpen(false);

            toast({
                title: "Cliente criado",
                description: `"${searchTerm.trim()}" foi cadastrado com sucesso.`,
            });
        } catch (error: any) {
            toast({
                title: "Erro ao criar cliente",
                description: error.message || "Tente novamente.",
                variant: "destructive",
            });
        } finally {
            setIsCreating(false);
        }
    };

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={open}
                    className="w-full justify-between bg-slate-50/50 border-slate-200 h-10 font-normal hover:bg-slate-100 transition-colors"
                >
                    <span className="truncate">
                        {selectedClient ? selectedClient.name : "Buscar cliente..."}
                    </span>
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
            </PopoverTrigger>
            <PopoverContent
                className="w-[--radix-popover-trigger-width] p-0 shadow-xl border-slate-200"
                align="start"
            >
                <Command className="border-none" shouldFilter={false}>
                    <CommandInput
                        placeholder="Digite o nome do cliente..."
                        value={searchTerm}
                        onValueChange={setSearchTerm}
                    />
                    <CommandList className="max-h-[300px]">
                        <CommandEmpty>
                            <div className="flex flex-col items-center justify-center py-4 px-2 text-sm">
                                <p className="text-slate-500 mb-2">
                                    Nenhum cliente encontrado
                                </p>
                                {searchTerm && !exactNameMatch && (
                                    <Button
                                        variant="secondary"
                                        size="sm"
                                        className="w-full justify-start text-green-700 bg-green-50 hover:bg-green-100"
                                        onClick={handleCreateClient}
                                        disabled={isCreating}
                                    >
                                        {isCreating ? (
                                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        ) : (
                                            <Plus className="mr-2 h-4 w-4" />
                                        )}
                                        Cadastrar "{searchTerm}"
                                    </Button>
                                )}
                            </div>
                        </CommandEmpty>
                        <CommandGroup>
                            {filteredClients.map((client) => (
                                <CommandItem
                                    key={client.id}
                                    value={client.id}
                                    onSelect={() => {
                                        onValueChange(client.id);
                                        setSearchTerm("");
                                        setOpen(false);
                                    }}
                                    className="cursor-pointer"
                                >
                                    <Check
                                        className={cn(
                                            "mr-2 h-4 w-4 text-green-600",
                                            value === client.id
                                                ? "opacity-100"
                                                : "opacity-0"
                                        )}
                                    />
                                    <div className="flex flex-col">
                                        <span>{client.name}</span>
                                        {client.document && (
                                            <span className="text-xs text-slate-400">
                                                {client.document}
                                            </span>
                                        )}
                                    </div>
                                </CommandItem>
                            ))}
                        </CommandGroup>
                        {searchTerm &&
                            !exactNameMatch &&
                            filteredClients.length > 0 && (
                                <div className="border-t border-slate-100 p-2">
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        className="w-full justify-start text-green-700 hover:bg-green-50"
                                        onClick={handleCreateClient}
                                        disabled={isCreating}
                                    >
                                        {isCreating ? (
                                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        ) : (
                                            <Plus className="mr-2 h-4 w-4" />
                                        )}
                                        Cadastrar "{searchTerm}"
                                    </Button>
                                </div>
                            )}
                    </CommandList>
                </Command>
            </PopoverContent>
        </Popover>
    );
}
