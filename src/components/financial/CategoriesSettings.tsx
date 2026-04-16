
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Plus, ChevronRight, ChevronDown } from "lucide-react";
import { useFinancialCategories } from "@/hooks/useFinancialModules";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { CategoryForm } from "./CategoryForm";
import { useState, useMemo } from "react";
import { CategoryRowActions } from "./CategoryRowActions";
import { cn } from "@/lib/utils";

export function CategoriesSettings() {
    const { currentWorkspace } = useWorkspace();
    const { categories, isLoading } = useFinancialCategories(currentWorkspace?.id);
    const [categoryToEdit, setCategoryToEdit] = useState<any>(null);
    const [isEditOpen, setIsEditOpen] = useState(false);
    const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({});

    const handleEditCategory = (category: any) => {
        setCategoryToEdit(category);
        setIsEditOpen(true);
    };

    const toggleExpand = (id: string) => {
        setExpandedCategories(prev => ({ ...prev, [id]: !prev[id] }));
    };

    // Organize categories into hierarchy
    const categoryTree = useMemo(() => {
        if (!categories) return [];

        const tree: any[] = [];
        const map: Record<string, any> = {};

        // First pass: Create map and initialize children array
        categories.forEach(cat => {
            map[cat.id] = { ...cat, children: [] };
        });

        // Second pass: Link parents and children
        categories.forEach(cat => {
            if (cat.parent_id && map[cat.parent_id]) {
                map[cat.parent_id].children.push(map[cat.id]);
            } else {
                tree.push(map[cat.id]);
            }
        });

        // Sort by code or name
        const sortFn = (a: any, b: any) => {
            if (a.code && b.code) return a.code.localeCompare(b.code);
            return a.name.localeCompare(b.name);
        };

        const sortTree = (nodes: any[]) => {
            nodes.sort(sortFn);
            nodes.forEach(node => {
                if (node.children.length > 0) sortTree(node.children);
            });
        };

        sortTree(tree);

        return tree;
    }, [categories]);

    const renderCategoryRow = (category: any, depth = 0) => {
        const hasChildren = category.children && category.children.length > 0;
        const isExpanded = expandedCategories[category.id];

        return (
            <>
                <TableRow key={category.id} className="hover:bg-slate-50/50">
                    <TableCell className="font-medium">
                        <div className="flex items-center" style={{ paddingLeft: `${depth * 20}px` }}>
                            {hasChildren ? (
                                <button
                                    onClick={() => toggleExpand(category.id)}
                                    className="mr-2 p-1 hover:bg-slate-100 rounded-sm"
                                >
                                    {isExpanded ? (
                                        <ChevronDown className="h-4 w-4 text-slate-500" />
                                    ) : (
                                        <ChevronRight className="h-4 w-4 text-slate-500" />
                                    )}
                                </button>
                            ) : (
                                <span className="w-6 mr-2" /> // Spacer
                            )}
                            <div className="flex flex-col">
                                <span className={cn(depth === 0 ? "font-bold text-slate-800" : "text-slate-700")}>
                                    {category.code ? `${category.code} - ` : ""}{category.name}
                                </span>
                            </div>
                        </div>
                    </TableCell>
                    <TableCell>
                        <Badge
                            variant={category.type === 'income' ? "success" : "destructive"}
                            className="bg-opacity-10 text-xs px-2 py-0.5"
                        >
                            {category.type === 'income' ? "Receita" : "Despesa"}
                        </Badge>
                    </TableCell>
                    <TableCell>
                        <Badge variant={category.active !== false ? "outline" : "secondary"}>
                            {category.active !== false ? "Ativa" : "Inativa"}
                        </Badge>
                    </TableCell>
                    <TableCell>
                        <CategoryRowActions category={category} onEdit={() => handleEditCategory(category)} />
                    </TableCell>
                </TableRow>
                {hasChildren && isExpanded && (
                    category.children.map((child: any) => renderCategoryRow(child, depth + 1))
                )}
            </>
        );
    };

    return (
        <div className="space-y-4">
            <div className="flex justify-between items-center">
                <div className="space-y-1">
                    <h3 className="text-lg font-medium">Categorias Financeiras</h3>
                    <p className="text-sm text-muted-foreground">
                        Plano de contas (Receitas e Despesas).
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <Button onClick={() => { setCategoryToEdit(null); setIsEditOpen(true); }}>
                        <Plus className="mr-2 h-4 w-4" />
                        Nova Categoria
                    </Button>
                    <CategoryForm
                        categoryToEdit={categoryToEdit}
                        open={isEditOpen}
                        onOpenChange={(open) => {
                            setIsEditOpen(open);
                            if (!open) setCategoryToEdit(null);
                        }}
                        categories={categories || []}
                    />
                </div>
            </div>

            {isLoading ? (
                <div>Carregando categorias...</div>
            ) : (
                <div className="rounded-md border">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="w-[400px]">Nome</TableHead>
                                <TableHead>Tipo</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead className="w-[50px]"></TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {categoryTree.map((cat) => renderCategoryRow(cat))}

                            {!categories?.length && (
                                <TableRow>
                                    <TableCell colSpan={4} className="text-center text-muted-foreground py-4">
                                        Nenhuma categoria cadastrada.
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </div>
            )}
        </div>
    );
}
