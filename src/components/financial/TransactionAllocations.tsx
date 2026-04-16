
import { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
    Select,
    SelectContent,
    SelectGroup,
    SelectItem,
    SelectLabel,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { X, Plus, PieChart } from "lucide-react";
import { Database } from "@/integrations/supabase/types";
import { cn } from "@/lib/utils";
import { CategoryCombobox } from "./CategoryCombobox";

type Category = Database["public"]["Tables"]["financial_categories"]["Row"];
type CostCenter = Database["public"]["Tables"]["financial_cost_centers"]["Row"];

export type AllocationItem = {
    category_id: string;
    cost_center_id?: string;
    amount: number;
    percentage: number;
};

interface TransactionAllocationsProps {
    totalAmount: number;
    allocations: AllocationItem[];
    onChange: (allocations: AllocationItem[]) => void;
    categories: Category[];
    costCenters: CostCenter[];
    enabled: boolean;
    onEnableChange: (enabled: boolean) => void;
    type: "income" | "expense";
}

export function TransactionAllocations({
    totalAmount,
    allocations,
    onChange,
    categories,
    costCenters,
    enabled,
    onEnableChange,
    type
}: TransactionAllocationsProps) {
    const validCategories = useMemo(() => {
        return categories.filter(c => c.type === type && c.active);
    }, [categories, type]);

    const handleAddAllocation = () => {
        const currentTotal = allocations.reduce((sum, item) => sum + item.amount, 0);
        const remaining = Math.max(0, totalAmount - currentTotal);
        const percentage = totalAmount > 0 ? (remaining / totalAmount) * 100 : 0;

        onChange([
            ...allocations,
            {
                category_id: "",
                amount: remaining,
                percentage: Number(percentage.toFixed(2)),
                cost_center_id: ""
            }
        ]);
    };

    const handleRemoveAllocation = (index: number) => {
        const newAllocations = [...allocations];
        newAllocations.splice(index, 1);
        onChange(newAllocations);
    };

    const handleUpdateAllocation = (index: number, field: keyof AllocationItem, value: any) => {
        const newAllocations = [...allocations];
        const item = { ...newAllocations[index] };

        if (field === "amount") {
            const amount = Number(value);
            item.amount = amount;
            item.percentage = totalAmount > 0 ? Number(((amount / totalAmount) * 100).toFixed(2)) : 0;
        } else if (field === "percentage") {
            const percentage = Number(value);
            item.percentage = percentage;
            item.amount = Number(((totalAmount * percentage) / 100).toFixed(2));
        } else {
            (item as any)[field] = value;
        }

        newAllocations[index] = item;
        onChange(newAllocations);
    };

    // Recalculate if total amount changes
    useEffect(() => {
        if (totalAmount > 0 && allocations.length > 0) {
            // Check if totals match, if not, maybe warn or adjust? 
            // For now, let's just re-calculate percentages based on fixed amounts to avoid jumping values
            const newAllocations = allocations.map(item => ({
                ...item,
                percentage: Number(((item.amount / totalAmount) * 100).toFixed(2))
            }));
            // Only update if percentages actually changed significantly to avoid infinite loops
            const hasChanged = newAllocations.some((newItem, idx) =>
                Math.abs(newItem.percentage - allocations[idx].percentage) > 0.01
            );

            if (hasChanged) {
                onChange(newAllocations);
            }
        }
    }, [totalAmount]);

    const totalAllocated = allocations.reduce((sum, item) => sum + item.amount, 0);
    const remaining = totalAmount - totalAllocated;
    const isFullyAllocated = Math.abs(remaining) < 0.01;

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between bg-slate-50 p-4 rounded-lg border border-slate-200">
                <div className="flex items-center gap-3">
                    <div className={cn("h-10 w-10 rounded-full flex items-center justify-center transition-colors", enabled ? "bg-primary text-primary-foreground" : "bg-white border text-slate-400")}>
                        <PieChart className="h-5 w-5" />
                    </div>
                    <div>
                        <Label className="text-sm font-bold text-slate-900 cursor-pointer" onClick={() => onEnableChange(!enabled)}>
                            Habilitar rateio
                        </Label>
                        <p className="text-xs text-slate-500">Dividir o valor em múltiplas categorias</p>
                    </div>
                </div>
                <Switch checked={enabled} onCheckedChange={onEnableChange} />
            </div>

            {enabled && (
                <div className="bg-white rounded-lg border border-slate-200 overflow-hidden animate-in slide-in-from-top-2 duration-300">
                    <div className="p-4 bg-slate-50 border-b border-slate-200 grid grid-cols-12 gap-4 text-xs font-bold text-slate-500 uppercase tracking-wider">
                        <div className="col-span-5">Categoria *</div>
                        <div className="col-span-2">Valor (R$) *</div>
                        <div className="col-span-2">Porcentagem (%) *</div>
                        <div className="col-span-2">Centro de Custo</div>
                        <div className="col-span-1"></div>
                    </div>

                    <div className="divide-y divide-slate-100">
                        {allocations.map((allocation, index) => (
                            <div key={index} className="p-4 grid grid-cols-12 gap-4 items-start group hover:bg-slate-50/50 transition-colors">
                                <div className="col-span-5">
                                    <CategoryCombobox
                                        type={type}
                                        value={allocation.category_id}
                                        onValueChange={(val) => handleUpdateAllocation(index, "category_id", val)}
                                    />
                                </div>
                                <div className="col-span-2 relative">
                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs font-bold">R$</span>
                                    <Input
                                        type="number"
                                        className="pl-8 text-right font-medium"
                                        value={allocation.amount}
                                        onChange={(e) => handleUpdateAllocation(index, "amount", e.target.value)}
                                        step="0.01"
                                    />
                                </div>
                                <div className="col-span-2 relative">
                                    <Input
                                        type="number"
                                        className="pr-8 text-right font-medium"
                                        value={allocation.percentage}
                                        onChange={(e) => handleUpdateAllocation(index, "percentage", e.target.value)}
                                        step="0.1"
                                    />
                                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs font-bold">%</span>
                                </div>
                                <div className="col-span-2">
                                    <Select
                                        value={allocation.cost_center_id || "none"}
                                        onValueChange={(val) => handleUpdateAllocation(index, "cost_center_id", val === "none" ? null : val)}
                                    >
                                        <SelectTrigger className="bg-white">
                                            <SelectValue placeholder="Nenhum" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="none" className="text-slate-400 italic">Nenhum</SelectItem>
                                            {costCenters.map(cc => (
                                                <SelectItem key={cc.id} value={cc.id}>{cc.name}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="col-span-1 flex justify-center">
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon"
                                        className="h-9 w-9 text-slate-300 hover:text-red-500 hover:bg-red-50"
                                        onClick={() => handleRemoveAllocation(index)}
                                    >
                                        <X className="h-4 w-4" />
                                    </Button>
                                </div>
                            </div>
                        ))}
                    </div>

                    <div className="p-4 bg-slate-50 border-t border-slate-200 flex flex-col md:flex-row items-center justify-between gap-4">
                        <Button type="button" variant="outline" size="sm" onClick={handleAddAllocation} className="w-full md:w-auto text-primary border-primary/20 hover:bg-primary/5">
                            <Plus className="mr-2 h-4 w-4" />
                            Adicionar categoria
                        </Button>

                        <div className="flex items-center gap-6 text-sm">
                            <div className="flex items-center gap-2">
                                <span className="text-slate-500">Restante do rateio:</span>
                                <span className={cn("font-bold", Math.abs(remaining) > 0.01 ? "text-red-600" : "text-green-600")}>
                                    {remaining.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                </span>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="text-slate-500">Total rateado:</span>
                                <span className="font-bold text-slate-900">
                                    {totalAllocated.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
