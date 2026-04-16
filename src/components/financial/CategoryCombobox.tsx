import * as React from "react";
import { Check, ChevronsUpDown, Plus, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
    CommandSeparator,
} from "@/components/ui/command";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import { useFinancialCategories } from "@/hooks/useFinancialModules";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface CategoryComboboxProps {
    value: string;
    onValueChange: (value: string) => void;
    type: "income" | "expense";
}

export function CategoryCombobox({ value, onValueChange, type }: CategoryComboboxProps) {
    const [open, setOpen] = React.useState(false);
    const [searchQuery, setSearchQuery] = React.useState("");
    const [isCreating, setIsCreating] = React.useState(false);
    const [newCategoryName, setNewCategoryName] = React.useState("");
    const [parentCategoryId, setParentCategoryId] = React.useState<string | null>(null);
    const { currentWorkspace } = useWorkspace();
    const { categories, createCategory } = useFinancialCategories(currentWorkspace?.id);
    const { toast } = useToast();

    const filteredCategories = React.useMemo(() => {
        if (!categories) return [];
        const typeFiltered = categories.filter(c => c.type === type);
        if (!searchQuery) return typeFiltered;

        return typeFiltered.filter((c) =>
            c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            (c.code && c.code.toLowerCase().includes(searchQuery.toLowerCase()))
        );
    }, [categories, searchQuery, type]);

    const selectedCategory = categories?.find(c => c.id === value);

    const handleCreateCategory = async () => {
        if (!newCategoryName.trim()) {
            toast({ title: "Erro", description: "O nome da categoria é obrigatório.", variant: "destructive" });
            return;
        }

        try {
            if (!currentWorkspace?.id) {
                toast({ title: "Erro", description: "Workspace não encontrado ou não selecionado.", variant: "destructive" });
                return;
            }

            await createCategory.mutateAsync({
                name: newCategoryName,
                type: type,
                parent_id: parentCategoryId || null,
                workspace_id: currentWorkspace.id
            });

            toast({ title: "Sucesso", description: "Categoria criada com sucesso." });
            setNewCategoryName("");
            setIsCreating(false);
            setParentCategoryId(null);
        } catch (error) {
            toast({ title: "Erro", description: "Não foi possível criar a categoria.", variant: "destructive" });
        }
    };

    // Get roots for the "Parent" select in creation mode
    const rootCategories = React.useMemo(() => {
        if (!categories) return [];
        return categories.filter(c => c.type === type && !c.parent_id);
    }, [categories, type]);

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
                        {selectedCategory ? (
                            <span className="flex items-center gap-2">
                                {selectedCategory.code && <span className="text-[10px] font-bold text-slate-400">{selectedCategory.code}</span>}
                                {selectedCategory.name}
                            </span>
                        ) : "Selecione uma categoria..."}
                    </span>
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
            </PopoverTrigger>
            <PopoverContent
                className="w-[450px] p-0 shadow-2xl border-slate-200"
                align="start"
                onWheel={(e) => e.stopPropagation()}
            >
                {!isCreating ? (
                    <Command shouldFilter={false}>
                        <div className="flex items-center border-b px-3">
                            <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
                            <input
                                className="flex h-11 w-full rounded-md bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50"
                                placeholder="Pesquisar categoria..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />
                        </div>
                        <CommandList className="max-h-[300px]">
                            <CommandEmpty>Nenhuma categoria encontrada.</CommandEmpty>
                            {searchQuery ? (
                                <CommandGroup>
                                    {filteredCategories.map(cat => {
                                        const parent = cat.parent_id ? categories?.find(c => c.id === cat.parent_id) : null;
                                        return (
                                            <CommandItem
                                                key={cat.id}
                                                value={cat.id}
                                                onSelect={() => {
                                                    onValueChange(cat.id);
                                                    setOpen(false);
                                                }}
                                                className="cursor-pointer"
                                            >
                                                <Check
                                                    className={cn(
                                                        "mr-2 h-4 w-4 text-primary",
                                                        value === cat.id ? "opacity-100" : "opacity-0"
                                                    )}
                                                />
                                                <div className="flex flex-col">
                                                    <span className="text-sm">
                                                        {parent && <span className="text-slate-400 text-[10px] mr-1">{parent.name} &gt; </span>}
                                                        {cat.name}
                                                    </span>
                                                    {cat.code && <span className="text-[10px] text-muted-foreground">{cat.code}</span>}
                                                </div>
                                            </CommandItem>
                                        );
                                    })}
                                </CommandGroup>
                            ) : (
                                (() => {
                                    // Group by parent
                                    const roots = filteredCategories.filter(c => !c.parent_id).sort((a, b) => (a.code || "").localeCompare(b.code || ""));

                                    return roots.map(root => {
                                        const children = filteredCategories.filter(c => c.parent_id === root.id).sort((a, b) => (a.code || "").localeCompare(b.code || ""));

                                        return (
                                            <CommandGroup key={root.id} heading={root.code ? `${root.code} - ${root.name}` : root.name}>
                                                {children.map(child => (
                                                    <CommandItem
                                                        key={child.id}
                                                        value={child.id}
                                                        onSelect={() => {
                                                            onValueChange(child.id);
                                                            setOpen(false);
                                                        }}
                                                        className="cursor-pointer pl-6"
                                                    >
                                                        <Check
                                                            className={cn(
                                                                "mr-2 h-4 w-4 text-primary",
                                                                value === child.id ? "opacity-100" : "opacity-0"
                                                            )}
                                                        />
                                                        <div className="flex flex-col">
                                                            <span className="text-sm">{child.name}</span>
                                                            {child.code && <span className="text-[10px] text-muted-foreground">{child.code}</span>}
                                                        </div>
                                                    </CommandItem>
                                                ))}
                                                {/* Allow selecting root if it has no children or if user wants to */}
                                                {children.length === 0 && (
                                                    <CommandItem
                                                        key={root.id}
                                                        value={root.id}
                                                        onSelect={() => {
                                                            onValueChange(root.id);
                                                            setOpen(false);
                                                        }}
                                                        className="cursor-pointer"
                                                    >
                                                        <Check
                                                            className={cn(
                                                                "mr-2 h-4 w-4 text-primary",
                                                                value === root.id ? "opacity-100" : "opacity-0"
                                                            )}
                                                        />
                                                        {root.name}
                                                    </CommandItem>
                                                )}
                                            </CommandGroup>
                                        );
                                    });
                                })()
                            )}
                        </CommandList>
                        <CommandSeparator />
                        <div className="p-2">
                            <Button
                                variant="ghost"
                                className="w-full justify-start text-primary font-bold gap-2 h-9"
                                onClick={() => setIsCreating(true)}
                            >
                                <Plus className="h-4 w-4" />
                                Adicionar nova categoria
                            </Button>
                        </div>
                    </Command>
                ) : (
                    <div className="p-4 space-y-4 animate-in fade-in zoom-in-95 duration-200">
                        <div className="flex items-center justify-between border-b pb-2 mb-2">
                            <h3 className="font-bold text-slate-800 text-sm">Cadastro de categoria</h3>
                        </div>

                        <div className="space-y-2">
                            <label className="text-[10px] font-bold uppercase text-slate-500">Nova categoria *</label>
                            <Input
                                placeholder="Ex: Marketing"
                                value={newCategoryName}
                                onChange={(e) => setNewCategoryName(e.target.value)}
                                className="h-10"
                                autoFocus
                            />
                        </div>

                        <div className="space-y-2">
                            <label className="text-[10px] font-bold uppercase text-slate-500">Aparecer dentro de (Opcional)</label>
                            <select
                                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                value={parentCategoryId || ""}
                                onChange={(e) => setParentCategoryId(e.target.value || null)}
                            >
                                <option value="">Nenhuma (Raiz)</option>
                                {rootCategories.map(cat => (
                                    <option key={cat.id} value={cat.id}>{cat.code ? `${cat.code} - ` : ''}{cat.name}</option>
                                ))}
                            </select>
                        </div>

                        <div className="flex gap-2 pt-4 border-t">
                            <Button
                                variant="outline"
                                className="flex-1 h-10 font-bold"
                                onClick={() => setIsCreating(false)}
                            >
                                Cancelar
                            </Button>
                            <Button
                                className="flex-1 h-10 font-bold bg-primary"
                                onClick={handleCreateCategory}
                                disabled={createCategory.isPending}
                            >
                                {createCategory.isPending ? "Salvando..." : "Cadastrar"}
                            </Button>
                        </div>
                    </div>
                )}
            </PopoverContent>
        </Popover>
    );
}
