import * as React from "react";
import { Check, ChevronsUpDown, Plus } from "lucide-react";
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
import { useSuppliers } from "@/hooks/useFinancialModules";
import { useWorkspace } from "@/contexts/WorkspaceContext";

interface SupplierComboboxProps {
    value: string;
    onValueChange: (value: string) => void;
}

export function SupplierCombobox({ value, onValueChange }: SupplierComboboxProps) {
    const [open, setOpen] = React.useState(false);
    const [inputValue, setInputValue] = React.useState(value || "");
    const { currentWorkspace } = useWorkspace();
    const { suppliers } = useSuppliers(currentWorkspace?.id);

    // Update input value when selection changes from outside
    React.useEffect(() => {
        if (value !== undefined) {
            setInputValue(value || "");
        }
    }, [value]);

    const filteredSuppliers = React.useMemo(() => {
        if (!suppliers) return [];
        if (!inputValue) return suppliers;
        return suppliers.filter((s) =>
            s.name.toLowerCase().includes(inputValue.toLowerCase())
        );
    }, [suppliers, inputValue]);

    const exactMatch = suppliers?.find(
        (s) => s.name.toLowerCase() === inputValue.toLowerCase()
    );

    const displayValue = exactMatch ? exactMatch.name : (value || "");

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
                        {displayValue || "Buscar fornecedor..."}
                    </span>
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[--radix-popover-trigger-width] p-0 shadow-xl border-slate-200" align="start">
                <Command className="border-none" shouldFilter={false}>
                    <CommandInput
                        placeholder="Digite o nome do fornecedor..."
                        value={inputValue}
                        onValueChange={(val) => {
                            setInputValue(val);
                            onValueChange(val);
                        }}
                    />
                    <CommandList className="max-h-[300px]">
                        <CommandEmpty>
                            <div className="flex flex-col items-center justify-center py-4 px-2 text-sm">
                                <p className="text-slate-500 mb-2">Nenhum fornecedor encontrado</p>
                                {inputValue && !exactMatch && (
                                    <Button
                                        variant="secondary"
                                        size="sm"
                                        className="w-full justify-start text-red-600 bg-red-50 hover:bg-red-100"
                                        onClick={() => {
                                            onValueChange(inputValue);
                                            setOpen(false);
                                        }}
                                    >
                                        <Plus className="mr-2 h-4 w-4" />
                                        Cadastrar "{inputValue}"
                                    </Button>
                                )}
                            </div>
                        </CommandEmpty>
                        <CommandGroup>
                            {filteredSuppliers.map((supplier) => (
                                <CommandItem
                                    key={supplier.id}
                                    value={supplier.name}
                                    onSelect={() => {
                                        onValueChange(supplier.name);
                                        setInputValue(supplier.name);
                                        setOpen(false);
                                    }}
                                    className="cursor-pointer"
                                >
                                    <Check
                                        className={cn(
                                            "mr-2 h-4 w-4 text-red-600",
                                            value === supplier.name ? "opacity-100" : "opacity-0"
                                        )}
                                    />
                                    {supplier.name}
                                </CommandItem>
                            ))}
                        </CommandGroup>
                    </CommandList>
                </Command>
            </PopoverContent>
        </Popover>
    );
}
