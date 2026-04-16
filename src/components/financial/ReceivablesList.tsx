import { useState, useMemo } from "react";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useReceivables, useBankAccounts, useFinancialCategories } from "@/hooks/useFinancialModules";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { formatCurrency, formatDate } from "@/utils/format";
import { format, isWithinInterval, startOfDay, endOfDay, subDays, addDays, addWeeks, addMonths, addYears, subWeeks, subMonths, subYears, startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfYear, endOfYear } from "date-fns";
import { ptBR } from "date-fns/locale";
import { MarkAsPaid } from "./MarkAsPaid";
import { FinancialDetails } from "./FinancialDetails";
import { BillingInvoiceDialog } from "./BillingInvoiceDialog";
import { DeleteConfirmDialog } from "./DeleteConfirmDialog";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { ReceivableForm } from "./ReceivableForm";
import {
    ChevronDown, ChevronUp, ChevronsUpDown, ChevronLeft, ChevronRight,
    Edit2, Trash2, Search, MoreHorizontal, Copy, RotateCcw, Eye,
    CheckCircle2, AlertCircle, Clock, Calendar, Download, Printer,
    FileText, Plus, LayoutGrid, X, Filter, CreditCard, MessageSquare, Paperclip
} from "lucide-react";
import { FinancialBatchActions } from "./FinancialBatchActions";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from "@/components/ui/dialog";
import { Info } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { getLocalDateString } from "@/utils/format";

import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip";

export function ReceivablesList() {
    const { toast } = useToast();
    const { currentWorkspace } = useWorkspace();
    const { receivables, isLoading, createReceivable, updateReceivable, deleteReceivable } = useReceivables(currentWorkspace?.id);
    const { accounts } = useBankAccounts(currentWorkspace?.id);
    const { categories } = useFinancialCategories(currentWorkspace?.id);

    const [search, setSearch] = useState("");
    const [statusFilter, setStatusFilter] = useState("all");
    const [dateFilter, setDateFilter] = useState("month");
    const [bankAccountFilter, setBankAccountFilter] = useState("all");
    const [categoryFilter, setCategoryFilter] = useState("all");
    const [minAmount, setMinAmount] = useState("");
    const [maxAmount, setMaxAmount] = useState("");
    const [customRange, setCustomRange] = useState<{ from: string, to: string }>({
        from: format(new Date(), "yyyy-MM-dd"),
        to: format(new Date(), "yyyy-MM-dd")
    });
    const [selectedIds, setSelectedIds] = useState<string[]>([]);
    const [quickStatusFilter, setQuickStatusFilter] = useState<string>("all");

    // Pagination & Sorting State
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(100);
    const [sortConfig, setSortConfig] = useState<{ key: string, direction: 'asc' | 'desc' | null }>({
        key: 'due_date',
        direction: 'asc'
    });

    // Reference date for period navigation
    const [referenceDate, setReferenceDate] = useState(new Date());

    // Delete confirmation dialog state
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
    const [itemToDelete, setItemToDelete] = useState<any>(null);
    // Confirm Delete Dialog State - already declared above, removing duplicates
    const [isDeleting, setIsDeleting] = useState(false);
    const [paidBlockOpen, setPaidBlockOpen] = useState(false);
    const [batchDeleteDialogOpen, setBatchDeleteDialogOpen] = useState(false);
    const [batchDeletePendingAction, setBatchDeletePendingAction] = useState<(() => void) | null>(null);


    // Invoice Dialog State
    const [invoiceDialogOpen, setInvoiceDialogOpen] = useState(false);
    const [invoiceData, setInvoiceData] = useState<{ id: string, type: 'contract' | 'sale', receivableId: string } | null>(null);

    // Get related items for installment/contract billing deletion
    const relatedReceivables = useMemo(() => {
        if (!itemToDelete || !receivables) return [];

        // Find items with same reference_code, contract_id, or contract_billing_id
        const currentId = itemToDelete.id;
        const refCode = itemToDelete.reference_code;
        const contractId = itemToDelete.contract_id;
        const contractBillingId = itemToDelete.contract_billing_id;

        const installmentMatch = itemToDelete.description.match(/(.+) (\d+)\/(\d+)$/);
        const baseDescription = installmentMatch ? installmentMatch[1].trim() : null;
        const outOfMatch = installmentMatch ? installmentMatch[3].trim() : null;

        return receivables.filter(r => {
            if (r.id === currentId) return false;

            // Skip paid items - they should remain in the system
            if (r.status === 'paid') return false;

            // Match by reference_code (installments)
            if (refCode && r.reference_code === refCode) return true;

            // Match by contract_id (recurring contract items)
            if (contractId && r.contract_id === contractId) return true;

            // Match by contract_billing_id (same billing batch)
            if (contractBillingId && r.contract_billing_id === contractBillingId) return true;

            // Fallback for older installments without reference_code
            if (!refCode && !contractId && !contractBillingId && baseDescription) {
                const rMatch = r.description.match(/(.+) (\d+)\/(\d+)$/);
                if (rMatch && rMatch[1].trim() === baseDescription && rMatch[3].trim() === outOfMatch) {
                    return true;
                }
            }

            return false;
        }).map(r => ({
            id: r.id,
            description: r.description,
            due_date: r.due_date,
            total_amount: r.total_amount,
            status: r.status || 'pending'
        }));
    }, [itemToDelete, receivables]);

    // Handle delete confirmation
    const handleDeleteClick = (item: any) => {
        if (item.status === 'paid') {
            setPaidBlockOpen(true);
            return;
        }
        setItemToDelete(item);
        setDeleteDialogOpen(true);
    };

    const handleConfirmDeleteSingle = async (id: string) => {
        setIsDeleting(true);
        try {
            await deleteReceivable.mutateAsync({ id, workspaceId: currentWorkspace!.id });
            toast({ title: "Sucesso", description: "Lançamento excluído com sucesso." });
            setDeleteDialogOpen(false);
            setItemToDelete(null);
        } catch (error) {
            toast({ title: "Erro", description: "Não foi possível excluir o lançamento.", variant: "destructive" });
        } finally {
            setIsDeleting(false);
        }
    };

    const handleConfirmDeleteAll = async (ids: string[]) => {
        setIsDeleting(true);
        try {
            await Promise.all(ids.map(id => deleteReceivable.mutateAsync({ id, workspaceId: currentWorkspace!.id })));
            toast({ title: "Sucesso", description: `${ids.length} lançamentos excluídos com sucesso.` });
            setDeleteDialogOpen(false);
            setItemToDelete(null);
        } catch (error) {
            toast({ title: "Erro", description: "Não foi possível excluir os lançamentos.", variant: "destructive" });
        } finally {
            setIsDeleting(false);
        }
    };

    // Navigate period (forward/backward)
    const navigatePeriod = (direction: 'prev' | 'next') => {
        const offset = direction === 'next' ? 1 : -1;

        if (dateFilter === 'all') {
            // If "all" is selected, go to current month
            setDateFilter('month');
            setReferenceDate(new Date());
            return;
        }

        let newDate: Date;

        switch (dateFilter) {
            case 'today':
            case 'yesterday':
                newDate = addDays(referenceDate, offset);
                setDateFilter('today');
                break;
            case 'week':
                newDate = addWeeks(referenceDate, offset);
                break;
            case 'month':
                newDate = addMonths(referenceDate, offset);
                break;
            case 'year':
                newDate = addYears(referenceDate, offset);
                break;
            case 'custom':
                // For custom, navigate by the same range duration
                const fromDate = new Date(customRange.from + "T12:00:00");
                const toDate = new Date(customRange.to + "T12:00:00");
                const daysDiff = Math.ceil((toDate.getTime() - fromDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;
                const newFrom = addDays(fromDate, offset * daysDiff);
                const newTo = addDays(toDate, offset * daysDiff);
                setCustomRange({
                    from: format(newFrom, "yyyy-MM-dd"),
                    to: format(newTo, "yyyy-MM-dd")
                });
                return;
            default:
                return;
        }

        setReferenceDate(newDate);
    };

    const filteredReceivables = useMemo(() => {
        if (!receivables) return [];
        return receivables.filter((item) => {
            const matchesSearch =
                item.description.toLowerCase().includes(search.toLowerCase()) ||
                (item.clients?.name || "").toLowerCase().includes(search.toLowerCase()) ||
                item.total_amount.toString().includes(search);

            const matchesStatus = statusFilter === "all" || item.status === statusFilter;
            const matchesBankAccount = bankAccountFilter === "all" || item.bank_account_id === bankAccountFilter;
            const matchesCategory = categoryFilter === "all" || item.category_id === categoryFilter;

            const amount = Number(item.total_amount);
            const matchesMinAmount = !minAmount || amount >= Number(minAmount);
            const matchesMaxAmount = !maxAmount || amount <= Number(maxAmount);

            let matchesDate = true;
            if (dateFilter !== "all") {
                const itemDate = new Date(item.due_date + "T12:00:00");

                if (dateFilter === "today") {
                    matchesDate = format(itemDate, "yyyy-MM-dd") === format(referenceDate, "yyyy-MM-dd");
                } else if (dateFilter === "yesterday") {
                    const yesterday = subDays(referenceDate, 1);
                    matchesDate = format(itemDate, "yyyy-MM-dd") === format(yesterday, "yyyy-MM-dd");
                } else if (dateFilter === "week") {
                    matchesDate = isWithinInterval(itemDate, {
                        start: startOfWeek(referenceDate, { weekStartsOn: 0 }),
                        end: endOfWeek(referenceDate, { weekStartsOn: 0 })
                    });
                } else if (dateFilter === "month") {
                    matchesDate = isWithinInterval(itemDate, {
                        start: startOfMonth(referenceDate),
                        end: endOfMonth(referenceDate)
                    });
                } else if (dateFilter === "year") {
                    matchesDate = isWithinInterval(itemDate, {
                        start: startOfYear(referenceDate),
                        end: endOfYear(referenceDate)
                    });
                } else if (dateFilter === "custom") {
                    matchesDate = isWithinInterval(itemDate, {
                        start: startOfDay(new Date(customRange.from + "T12:00:00")),
                        end: endOfDay(new Date(customRange.to + "T12:00:00"))
                    });
                }
            }

            const matchesQuick = () => {
                if (quickStatusFilter === "all") return true;
                const itemDate = new Date(item.due_date + "T12:00:00");
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                const itemDateOnly = new Date(itemDate);
                itemDateOnly.setHours(0, 0, 0, 0);

                if (quickStatusFilter === "overdue") return item.status !== 'paid' && itemDateOnly < today;
                if (quickStatusFilter === "today") return item.status !== 'paid' && itemDateOnly.getTime() === today.getTime();
                if (quickStatusFilter === "upcoming") return item.status !== 'paid' && itemDateOnly > today;
                if (quickStatusFilter === "paid") return item.status === 'paid';
                return true;
            };

            return matchesSearch && matchesStatus && matchesDate && matchesBankAccount && matchesCategory && matchesMinAmount && matchesMaxAmount && matchesQuick();
        });
    }, [receivables, search, statusFilter, dateFilter, referenceDate, customRange, bankAccountFilter, categoryFilter, minAmount, maxAmount, quickStatusFilter]);

    const sortedReceivables = useMemo(() => {
        const sorted = [...filteredReceivables];
        if (sortConfig.key && sortConfig.direction) {
            sorted.sort((a, b) => {
                let aValue = a[sortConfig.key as keyof typeof a] as string | number | null;
                let bValue = b[sortConfig.key as keyof typeof b] as string | number | null;

                if (sortConfig.key === 'client') aValue = a.clients?.name || '';
                if (sortConfig.key === 'client') bValue = b.clients?.name || '';
                if (sortConfig.key === 'category') aValue = a.financial_categories?.name || '';
                if (sortConfig.key === 'category') bValue = b.financial_categories?.name || '';

                if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
                if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
                return 0;
            });
        }
        return sorted;
    }, [filteredReceivables, sortConfig]);

    const paginatedReceivables = useMemo(() => {
        const startIndex = (currentPage - 1) * itemsPerPage;
        return sortedReceivables.slice(startIndex, startIndex + itemsPerPage);
    }, [sortedReceivables, currentPage, itemsPerPage]);

    const totalPages = Math.ceil(sortedReceivables.length / itemsPerPage);


    const getStatusColor = (status: string | null) => {
        switch (status) {
            case "paid": return "success";
            case "pending": return "warning";
            case "overdue": return "destructive";
            default: return "secondary";
        }
    };

    const handleSelectAll = (checked: boolean) => {
        if (checked) {
            setSelectedIds(filteredReceivables.map(item => item.id));
        } else {
            setSelectedIds([]);
        }
    };

    const handleSelectRow = (id: string, checked: boolean) => {
        if (checked) {
            setSelectedIds(prev => [...prev, id]);
        } else {
            setSelectedIds(prev => prev.filter(selectedId => selectedId !== id));
        }
    };

    const periodTotals = useMemo(() => {
        if (!receivables) return { paid: 0, paidTotal: 0, pending: 0, pendingTotal: 0, overdue: 0, overdueTotal: 0, today: 0, todayTotal: 0, upcoming: 0, upcomingTotal: 0, total: 0, totalCount: 0 };

        const now = new Date();
        now.setHours(0, 0, 0, 0);

        const baseFiltered = receivables.filter(item => {
            const matchesSearch = item.description.toLowerCase().includes(search.toLowerCase()) ||
                (item.clients?.name || "").toLowerCase().includes(search.toLowerCase()) ||
                item.total_amount.toString().includes(search);
            const matchesBankAccount = bankAccountFilter === "all" || item.bank_account_id === bankAccountFilter;
            const matchesCategory = categoryFilter === "all" || item.category_id === categoryFilter;
            const amount = Number(item.total_amount);
            const matchesMinAmount = !minAmount || amount >= Number(minAmount);
            const matchesMaxAmount = !maxAmount || amount <= Number(maxAmount);

            let matchesDate = true;
            if (dateFilter !== "all") {
                const itemDate = new Date(item.due_date + "T12:00:00");
                if (dateFilter === "today") matchesDate = format(itemDate, "yyyy-MM-dd") === format(now, "yyyy-MM-dd");
                else if (dateFilter === "yesterday") matchesDate = format(itemDate, "yyyy-MM-dd") === format(subDays(now, 1), "yyyy-MM-dd");
                else if (dateFilter === "week") matchesDate = isWithinInterval(itemDate, { start: startOfWeek(now, { weekStartsOn: 0 }), end: endOfWeek(now, { weekStartsOn: 0 }) });
                else if (dateFilter === "month") matchesDate = isWithinInterval(itemDate, { start: startOfMonth(now), end: endOfMonth(now) });
                else if (dateFilter === "year") matchesDate = isWithinInterval(itemDate, { start: startOfYear(now), end: endOfYear(now) });
                else if (dateFilter === "custom") matchesDate = isWithinInterval(itemDate, { start: startOfDay(new Date(customRange.from + "T12:00:00")), end: endOfDay(new Date(customRange.to + "T12:00:00")) });
            }

            return matchesSearch && matchesBankAccount && matchesCategory && matchesMinAmount && matchesMaxAmount && matchesDate;
        });

        return baseFiltered.reduce((acc, item) => {
            const amount = Number(item.total_amount);
            const itemDate = new Date(item.due_date + "T12:00:00");
            itemDate.setHours(0, 0, 0, 0);

            acc.total += amount;
            acc.totalCount += 1;

            if (item.status === 'paid') {
                acc.paidTotal += amount;
                acc.paid += 1;
            } else {
                if (itemDate < now) {
                    acc.overdueTotal += amount;
                    acc.overdue += 1;
                } else if (itemDate.getTime() === now.getTime()) {
                    acc.todayTotal += amount;
                    acc.today += 1;
                } else {
                    acc.upcomingTotal += amount;
                    acc.upcoming += 1;
                }
            }
            return acc;
        }, { paid: 0, paidTotal: 0, pending: 0, pendingTotal: 0, overdue: 0, overdueTotal: 0, today: 0, todayTotal: 0, upcoming: 0, upcomingTotal: 0, total: 0, totalCount: 0 });
    }, [receivables, dateFilter, customRange, search, bankAccountFilter, categoryFilter, minAmount, maxAmount]);

    const selectedSum = useMemo(() => {
        if (!receivables || selectedIds.length === 0) return 0;
        return receivables
            .filter(item => selectedIds.includes(item.id))
            .reduce((acc, item) => acc + Number(item.total_amount), 0);
    }, [receivables, selectedIds]);

    const getDateRangeLabel = () => {
        switch (dateFilter) {
            case "all": return "Todo o período";
            case "today": return format(referenceDate, "dd/MM/yyyy");
            case "yesterday": return format(subDays(referenceDate, 1), "dd/MM/yyyy");
            case "week": return `${format(startOfWeek(referenceDate), "dd/MM/yyyy")} a ${format(endOfWeek(referenceDate), "dd/MM/yyyy")}`;
            case "month": return format(referenceDate, "MMMM 'de' yyyy", { locale: ptBR });
            case "year": return format(referenceDate, "yyyy");
            case "custom": return `${format(new Date(customRange.from), "dd/MM/yyyy")} a ${format(new Date(customRange.to), "dd/MM/yyyy")}`;
            default: return "";
        }
    };

    const handleSort = (key: string) => {
        setSortConfig(prev => ({
            key,
            direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
        }));
    };

    const SortIcon = ({ column }: { column: string }) => {
        if (sortConfig.key !== column) return <ChevronsUpDown className="ml-2 h-4 w-4 text-muted-foreground/50" />;
        return sortConfig.direction === 'asc'
            ? <ChevronUp className="ml-2 h-4 w-4 text-primary" />
            : <ChevronDown className="ml-2 h-4 w-4 text-primary" />;
    };

    const executeBatchDelete = async () => {
        const selectedItems = receivables?.filter(item => selectedIds.includes(item.id)) || [];
        const paidItems = selectedItems.filter(item => item.status === 'paid');
        const deletableItems = selectedItems.filter(item => item.status !== 'paid');

        if (deletableItems.length === 0) {
            toast({
                title: "Ação bloqueada",
                description: "Todos os lançamentos selecionados já estão recebidos e não podem ser excluídos.",
                variant: "destructive"
            });
            return;
        }

        try {
            await Promise.all(deletableItems.map(item => deleteReceivable.mutateAsync({ id: item.id, workspaceId: currentWorkspace!.id })));

            const message = paidItems.length > 0
                ? `${deletableItems.length} lançamentos excluídos. ${paidItems.length} lançamento(s) recebido(s) foram mantidos.`
                : `${deletableItems.length} lançamentos excluídos.`;

            toast({ title: "Sucesso", description: message });
            setSelectedIds([]);
        } catch (error) {
            toast({ title: "Erro", description: "Ocorreu um erro ao excluir os lançamentos.", variant: "destructive" });
        }
    };

    const handleBatchAction = async (action: string, data?: any) => {
        if (selectedIds.length === 0) return;

        // For delete action, use app dialog instead of window.confirm
        if (action === 'delete') {
            const selectedItems = receivables?.filter(item => selectedIds.includes(item.id)) || [];
            const paidItems = selectedItems.filter(item => item.status === 'paid');
            const deletableItems = selectedItems.filter(item => item.status !== 'paid');

            if (deletableItems.length === 0) {
                toast({
                    title: "Ação bloqueada",
                    description: "Todos os lançamentos selecionados já estão recebidos e não podem ser excluídos.",
                    variant: "destructive"
                });
                return;
            }

            setBatchDeletePendingAction(() => executeBatchDelete);
            setBatchDeleteDialogOpen(true);
            return;
        }

        const confirmMessage = action === 'mark_paid'
                ? `Deseja marcar ${selectedIds.length} lançamentos como recebidos?`
                : action === 'mark_pending'
                    ? `Deseja marcar ${selectedIds.length} lançamentos como pendentes?`
                    : null;

        if (confirmMessage && !window.confirm(confirmMessage)) return;

        try {
            const selectedItems = receivables?.filter(item => selectedIds.includes(item.id)) || [];

            if (action === "mark_paid") {
                const itemsWithoutAccount = selectedItems.filter(item => !item.bank_account_id);

                if (itemsWithoutAccount.length > 0) {
                    toast({
                        title: "Ação bloqueada",
                        description: `Existem ${itemsWithoutAccount.length} lançamento(s) sem conta bancária vinculada. Selecione apenas lançamentos com conta informada.`,
                        variant: "destructive"
                    });
                    return;
                }

                await Promise.all(selectedItems.map(item => updateReceivable.mutateAsync({
                    item: {
                        id: item.id,
                        workspace_id: item.workspace_id,
                        status: 'paid' as const,
                        payment_date: getLocalDateString()
                    }
                })));
                toast({ title: "Sucesso", description: `${selectedIds.length} lançamentos marcados como recebidos.` });
            } else if (action === "mark_pending") {
                await Promise.all(selectedItems.map(item => updateReceivable.mutateAsync({
                    item: {
                        id: item.id,
                        workspace_id: item.workspace_id,
                        status: 'pending' as const,
                        payment_date: null
                    }
                })));
                toast({ title: "Sucesso", description: `${selectedIds.length} lançamentos marcados em aberto.` });
            } else if (action === 'batch_edit_date') {
                await Promise.all(selectedItems.map(item => updateReceivable.mutateAsync({
                    item: {
                        id: item.id,
                        workspace_id: item.workspace_id,
                        due_date: data.newDate
                    }
                })));
                toast({ title: "Sucesso", description: `${selectedIds.length} lançamentos atualizados.` });
            } else if (action === 'batch_edit_amount') {
                await Promise.all(selectedItems.map(item => updateReceivable.mutateAsync({
                    item: {
                        id: item.id,
                        workspace_id: item.workspace_id,
                        total_amount: Number(data.newValue)
                    }
                })));
                toast({ title: "Sucesso", description: `${selectedIds.length} lançamentos atualizados.` });
            } else if (action === 'batch_edit_account') {
                await Promise.all(selectedItems.map(item => updateReceivable.mutateAsync({
                    item: {
                        id: item.id,
                        workspace_id: item.workspace_id,
                        bank_account_id: data.newAccount
                    }
                })));
                toast({ title: "Sucesso", description: `${selectedIds.length} lançamentos atualizados.` });
            } else if (action === 'unmark_scheduled') {
                await Promise.all(selectedItems.map(item => updateReceivable.mutateAsync({
                    item: {
                        id: item.id,
                        workspace_id: item.workspace_id,
                        is_scheduled: false
                    }
                })));
                toast({ title: "Sucesso", description: `${selectedIds.length} lançamentos atualizados.` });
            }
            setSelectedIds([]);
        } catch (err) {
            toast({ title: "Erro", description: "Ocorreu um erro ao realizar a ação em lote.", variant: "destructive" });
        }
    };

    if (isLoading) {
        return <div className="p-8 text-center">Carregando contas a receber...</div>;
    }

    return (
        <div className="space-y-6">
            {/* TOOLBAR SUPERIOR (ESTILO CONTA AZUL) */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div className="flex items-center gap-2">
                    <ReceivableForm
                        trigger={
                            <Button className="bg-green-600 hover:bg-green-700 text-white font-bold flex gap-2">
                                <Plus className="h-4 w-4" /> Novo recebimento
                            </Button>
                        }
                    />
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="outline" className="flex gap-2">
                                Relatórios <ChevronDown className="h-4 w-4" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent>
                            <DropdownMenuItem>Vendas por Cliente</DropdownMenuItem>
                            <DropdownMenuItem>Relação de Recebimentos</DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                    <Button variant="ghost" size="sm" className="hidden md:flex gap-1 text-muted-foreground">
                        <Download className="h-4 w-4" /> Exportar
                    </Button>
                    <Button variant="ghost" size="sm" className="hidden md:flex gap-1 text-muted-foreground">
                        <Printer className="h-4 w-4" /> Imprimir
                    </Button>
                    <Button variant="ghost" size="sm" className="hidden md:flex gap-1 text-muted-foreground">
                        <FileText className="h-4 w-4" /> Importar planilha
                    </Button>
                </div>
            </div>

            {/* FILTROS PRINCIPAIS */}
            <div className="bg-card border rounded-lg p-5 shadow-sm space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                    <div className="space-y-2">
                        <label className="text-[10px] font-bold uppercase text-muted-foreground">Período de Vencimento</label>
                        <div className="flex items-center gap-1">
                            <Button variant="outline" size="icon" className="h-10 w-10 shrink-0" onClick={() => navigatePeriod('prev')}>
                                <ChevronLeft className="h-4 w-4" />
                            </Button>
                            <Select value={dateFilter} onValueChange={(value) => { setDateFilter(value); setReferenceDate(new Date()); }}>
                                <SelectTrigger className="h-10 grow font-medium">
                                    <SelectValue>{getDateRangeLabel()}</SelectValue>
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">Todo o período</SelectItem>
                                    <SelectItem value="today">Hoje</SelectItem>
                                    <SelectItem value="yesterday">Ontem</SelectItem>
                                    <SelectItem value="week">Esta Semana</SelectItem>
                                    <SelectItem value="month">Este Mês</SelectItem>
                                    <SelectItem value="year">Este Ano</SelectItem>
                                    <SelectItem value="custom">Personalizado</SelectItem>
                                </SelectContent>
                            </Select>
                            <Button variant="outline" size="icon" className="h-10 w-10 shrink-0" onClick={() => navigatePeriod('next')}>
                                <ChevronRight className="h-4 w-4" />
                            </Button>
                        </div>
                    </div>

                    <div className="space-y-2 md:col-span-1">
                        <label className="text-[10px] font-bold uppercase text-muted-foreground">Pesquisar por descrição ou cliente</label>
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="Ex: Mensalidade..."
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                className="pl-9 h-10"
                            />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <label className="text-[10px] font-bold uppercase text-muted-foreground">Conta</label>
                        <Select value={bankAccountFilter} onValueChange={setBankAccountFilter}>
                            <SelectTrigger className="h-10">
                                <SelectValue placeholder="Todas as contas" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">Todas as contas</SelectItem>
                                {accounts?.map(acc => (
                                    <SelectItem key={acc.id} value={acc.id}>{acc.name}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="flex gap-2">
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="ghost" className="h-10 flex grow gap-2 text-primary font-bold">
                                    Mais filtros <ChevronDown className="h-4 w-4" />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-80 p-4">
                                <div className="space-y-4">
                                    <div className="space-y-2">
                                        <label className="text-xs font-bold uppercase text-muted-foreground">Categoria</label>
                                        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                                            <SelectTrigger>
                                                <SelectValue placeholder="Todas as categorias" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="all">Todas as categorias</SelectItem>
                                                {categories?.filter(c => c.type === 'income').map(cat => (
                                                    <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-xs font-bold uppercase text-muted-foreground">Valor</label>
                                        <div className="flex gap-2 items-center">
                                            <Input placeholder="Mín." type="number" value={minAmount} onChange={(e) => setMinAmount(e.target.value)} />
                                            <span>-</span>
                                            <Input placeholder="Max." type="number" value={maxAmount} onChange={(e) => setMaxAmount(e.target.value)} />
                                        </div>
                                    </div>
                                </div>
                            </DropdownMenuContent>
                        </DropdownMenu>
                        <Button variant="ghost" className="h-10 px-2 text-muted-foreground" onClick={() => {
                            setSearch(""); setStatusFilter("all"); setBankAccountFilter("all");
                            setCategoryFilter("all"); setDateFilter("month"); setQuickStatusFilter("all");
                            setMinAmount(""); setMaxAmount(""); setReferenceDate(new Date());
                        }}>
                            Limpar filtros
                        </Button>
                    </div>
                </div>
                {dateFilter === "custom" && (
                    <div className="flex gap-2 items-center animate-in fade-in slide-in-from-left-2 pt-2">
                        <div className="flex flex-col gap-1">
                            <label className="text-[10px] font-bold uppercase text-muted-foreground">De</label>
                            <Input type="date" value={customRange.from} onChange={(e) => setCustomRange(prev => ({ ...prev, from: e.target.value }))} className="h-10" />
                        </div>
                        <div className="flex flex-col gap-1">
                            <label className="text-[10px] font-bold uppercase text-muted-foreground">Até</label>
                            <Input type="date" value={customRange.to} onChange={(e) => setCustomRange(prev => ({ ...prev, to: e.target.value }))} className="h-10" />
                        </div>
                    </div>
                )}
            </div>

            {/* CARDS DE RESUMO (INTERATIVOS) */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-0 border rounded-lg overflow-hidden bg-white shadow-sm">
                <button
                    onClick={() => setQuickStatusFilter(quickStatusFilter === "overdue" ? "all" : "overdue")}
                    className={`p-4 text-center border-r hover:bg-muted/30 transition-colors ${quickStatusFilter === "overdue" ? "bg-red-50 ring-2 ring-inset ring-destructive/20" : ""}`}
                >
                    <p className="text-[10px] font-bold text-muted-foreground uppercase mb-1">Vencidos (R$)</p>
                    <p className="text-xl font-bold text-destructive">{formatCurrency(periodTotals.overdueTotal)}</p>
                    <p className="text-[10px] text-muted-foreground mt-1">{periodTotals.overdue} lançamentos</p>
                </button>
                <button
                    onClick={() => setQuickStatusFilter(quickStatusFilter === "today" ? "all" : "today")}
                    className={`p-4 text-center border-r hover:bg-muted/30 transition-colors ${quickStatusFilter === "today" ? "bg-orange-50 ring-2 ring-inset ring-warning/20" : ""}`}
                >
                    <p className="text-[10px] font-bold text-muted-foreground uppercase mb-1">Vencem hoje (R$)</p>
                    <p className="text-xl font-bold text-warning">{formatCurrency(periodTotals.todayTotal)}</p>
                    <p className="text-[10px] text-muted-foreground mt-1">{periodTotals.today} lançamentos</p>
                </button>
                <button
                    onClick={() => setQuickStatusFilter(quickStatusFilter === "upcoming" ? "all" : "upcoming")}
                    className={`p-4 text-center border-r hover:bg-muted/30 transition-colors ${quickStatusFilter === "upcoming" ? "bg-blue-50 ring-2 ring-inset ring-primary/20" : ""}`}
                >
                    <p className="text-[10px] font-bold text-muted-foreground uppercase mb-1">A vencer (R$)</p>
                    <p className="text-xl font-bold text-primary">{formatCurrency(periodTotals.upcomingTotal)}</p>
                    <p className="text-[10px] text-muted-foreground mt-1">{periodTotals.upcoming} lançamentos</p>
                </button>
                <button
                    onClick={() => setQuickStatusFilter(quickStatusFilter === "paid" ? "all" : "paid")}
                    className={`p-4 text-center border-r hover:bg-muted/30 transition-colors ${quickStatusFilter === "paid" ? "bg-green-50 ring-2 ring-inset ring-success/20" : ""}`}
                >
                    <p className="text-[10px] font-bold text-muted-foreground uppercase mb-1">Recebidos (R$)</p>
                    <p className="text-xl font-bold text-success">{formatCurrency(periodTotals.paidTotal)}</p>
                    <p className="text-[10px] text-muted-foreground mt-1">{periodTotals.paid} lançamentos</p>
                </button>
                <button
                    onClick={() => setQuickStatusFilter("all")}
                    className={`p-4 text-center hover:bg-muted/30 transition-colors ${quickStatusFilter === "all" ? "bg-muted/20" : ""}`}
                >
                    <p className="text-[10px] font-bold text-muted-foreground uppercase mb-1">Total do período (R$)</p>
                    <p className="text-xl font-bold text-slate-700">{formatCurrency(periodTotals.total)}</p>
                    <p className="text-[10px] text-muted-foreground mt-1">{periodTotals.totalCount} lançamentos</p>
                </button>
            </div>

            {/* SELEÇÃO E AÇÕES EM LOTE */}
            {selectedIds.length > 0 && (
                <div className="flex items-center gap-4 bg-primary text-primary-foreground px-4 py-2 rounded-md animate-in slide-in-from-top-2">
                    <span className="text-sm font-medium">{selectedIds.length} registro(s) selecionado(s) - Total: {formatCurrency(selectedSum)}</span>
                    <FinancialBatchActions
                        selectedItems={receivables?.filter(item => selectedIds.includes(item.id)) || []}
                        onAction={handleBatchAction}
                        bankAccounts={accounts}
                        type="receivable"
                    />
                    <button onClick={() => setSelectedIds([])} className="ml-auto text-primary-foreground/70 hover:text-white">
                        <X className="h-4 w-4" />
                    </button>
                </div>
            )}

            {/* TABELA DE LANÇAMENTOS */}
            <div className="rounded-lg border bg-card shadow-sm overflow-hidden">
                <Table>
                    <TableHeader className="bg-muted/50">
                        <TableRow>
                            <TableHead className="w-[40px]">
                                <Checkbox
                                    checked={selectedIds.length === filteredReceivables.length && filteredReceivables.length > 0}
                                    onCheckedChange={(checked) => handleSelectAll(!!checked)}
                                />
                            </TableHead>
                            <TableHead className="cursor-pointer hover:text-primary transition-colors" onClick={() => handleSort('due_date')}>
                                <div className="flex items-center gap-1 font-bold text-xs uppercase">Vencimento <SortIcon column="due_date" /></div>
                            </TableHead>
                            <TableHead className="font-bold text-xs uppercase">Recebimento</TableHead>
                            <TableHead className="cursor-pointer hover:text-primary transition-colors" onClick={() => handleSort('description')}>
                                <div className="flex items-center gap-1 font-bold text-xs uppercase">Descrição <SortIcon column="description" /></div>
                            </TableHead>
                            <TableHead className="hidden md:table-cell font-bold text-xs uppercase">C. Custo</TableHead>
                            <TableHead className="hidden xl:table-cell font-bold text-xs uppercase">Ref</TableHead>
                            <TableHead className="text-right cursor-pointer hover:text-primary transition-colors" onClick={() => handleSort('total_amount')}>
                                <div className="flex items-center justify-end gap-1 font-bold text-xs uppercase">Total (R$) <SortIcon column="total_amount" /></div>
                            </TableHead>
                            <TableHead className="text-right font-bold text-xs uppercase">A receber (R$)</TableHead>
                            <TableHead className="cursor-pointer hover:text-primary transition-colors" onClick={() => handleSort('status')}>
                                <div className="flex items-center gap-1 font-bold text-xs uppercase">Situação <SortIcon column="status" /></div>
                            </TableHead>
                            <TableHead className="w-[100px] font-bold text-xs uppercase">Ações</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {!paginatedReceivables.length ? (
                            <TableRow>
                                <TableCell colSpan={8} className="text-center text-muted-foreground py-12">
                                    <div className="flex flex-col items-center gap-2">
                                        <AlertCircle className="h-8 w-8 text-muted-foreground/30" />
                                        <p>Nenhum lançamento encontrado para este filtro.</p>
                                    </div>
                                </TableCell>
                            </TableRow>
                        ) : (
                            paginatedReceivables.map((item) => {
                                const balance = item.status === 'paid' ? 0 : Number(item.total_amount) - (item.paid_amount || 0);
                                return (
                                    <TableRow key={item.id} className={`${selectedIds.includes(item.id) ? "bg-primary/5" : "hover:bg-muted/30"} transition-colors group h-14`}>
                                        <TableCell>
                                            <Checkbox
                                                checked={selectedIds.includes(item.id)}
                                                onCheckedChange={(checked) => handleSelectRow(item.id, !!checked)}
                                            />
                                        </TableCell>
                                        <TableCell className="text-sm font-medium">{formatDate(item.due_date)}</TableCell>
                                        <TableCell className="text-sm text-muted-foreground">
                                            {item.status === 'paid' ? formatDate(item.payment_date) : '-'}
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex flex-col">
                                                <span className="text-sm font-semibold text-slate-700">{item.description}</span>
                                                <span className="text-[10px] text-muted-foreground truncate max-w-[200px]">
                                                    {item.clients?.name} | {item.financial_categories?.name}
                                                </span>
                                            </div>
                                        </TableCell>
                                        <TableCell className="hidden md:table-cell text-xs text-muted-foreground">
                                            {(item.financial_cost_centers as any)?.name || '-'}
                                        </TableCell>
                                        <TableCell className="hidden xl:table-cell text-xs text-muted-foreground">
                                            {item.reference_code || '-'}
                                        </TableCell>
                                        <TableCell className="text-right font-bold text-sm">
                                            {formatCurrency(item.total_amount)}
                                        </TableCell>
                                        <TableCell className="text-right text-sm font-medium">
                                            {balance > 0 ? formatCurrency(balance) : "0,00"}
                                        </TableCell>
                                        <TableCell>
                                            <Badge variant={getStatusColor(item.status) as 'default'} className="font-bold text-[10px] uppercase border shadow-none flex items-center w-fit gap-1">
                                                {item.status === 'paid' ? 'Recebido' :
                                                    item.status === 'partial' ? 'Receb. Parcial' :
                                                        item.status === 'pending' ? 'Em Aberto' :
                                                            item.status === 'overdue' ? 'Vencido' : item.status}
                                                {item.is_scheduled && <Clock className="h-3 w-3 ml-1" />}
                                            </Badge>
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex items-center justify-end gap-2 group">
                                                <TooltipProvider>
                                                    {item.financial_attachments && item.financial_attachments.length > 0 && (
                                                        <Tooltip>
                                                            <TooltipTrigger asChild>
                                                                <Paperclip className="h-4 w-4 text-slate-400 group-hover:text-primary transition-colors cursor-help" />
                                                            </TooltipTrigger>
                                                            <TooltipContent>
                                                                <p className="text-[11px] font-bold">Possui {item.financial_attachments.length} anexo(s)</p>
                                                            </TooltipContent>
                                                        </Tooltip>
                                                    )}

                                                    {item.notes && (
                                                        <Tooltip>
                                                            <TooltipTrigger asChild>
                                                                <MessageSquare className="h-4 w-4 text-slate-400 group-hover:text-amber-500 transition-colors cursor-help" />
                                                            </TooltipTrigger>
                                                            <TooltipContent className="max-w-[250px] p-3 text-xs leading-relaxed bg-white text-slate-700 border-slate-200 shadow-xl">
                                                                <p className="font-bold mb-1 text-slate-400 uppercase text-[10px]">Observações:</p>
                                                                {item.notes}
                                                            </TooltipContent>
                                                        </Tooltip>
                                                    )}
                                                </TooltipProvider>

                                                <DropdownMenu>
                                                    <DropdownMenuTrigger asChild>
                                                        <Button variant="outline" size="sm" className="h-8 w-18 font-bold flex gap-1 bg-white border-primary/20 hover:border-primary text-primary transition-colors">
                                                            Ações <ChevronDown className="h-3 w-3" />
                                                        </Button>
                                                    </DropdownMenuTrigger>
                                                    <DropdownMenuContent align="end" className="w-56">
                                                        <DropdownMenuLabel>Ações</DropdownMenuLabel>
                                                        <DropdownMenuSeparator />

                                                        {item.status !== 'paid' && (
                                                            <MarkAsPaid
                                                                type="receivable"
                                                                item={item}
                                                                trigger={
                                                                    <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                                                                        <CheckCircle2 className="h-4 w-4 mr-2 text-success" /> Informar recebimento
                                                                    </DropdownMenuItem>
                                                                }
                                                            />
                                                        )}

                                                        <ReceivableForm
                                                            initialData={item}
                                                            trigger={
                                                                <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                                                                    <Edit2 className="h-4 w-4 mr-2" /> Editar lançamento
                                                                </DropdownMenuItem>
                                                            }
                                                        />

                                                        {item.status === 'paid' && (
                                                            <DropdownMenuItem onClick={() => updateReceivable.mutate({ item: { id: item.id, workspace_id: item.workspace_id, status: 'pending' as const, payment_date: null } })}>
                                                                <RotateCcw className="h-4 w-4 mr-2" /> Voltar para em aberto
                                                            </DropdownMenuItem>
                                                        )}

                                                        <ReceivableForm
                                                            initialData={{
                                                                ...item,
                                                                id: undefined as any,
                                                                description: `${item.description} (Cópia)`,
                                                                title: `${item.title || item.description} (Cópia)`,
                                                                status: 'pending',
                                                                payment_date: null as any
                                                            }}
                                                            trigger={
                                                                <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                                                                    <Copy className="h-4 w-4 mr-2" /> Clonar lançamento
                                                                </DropdownMenuItem>
                                                            }
                                                        />

                                                        <FinancialDetails
                                                            type="receivable"
                                                            item={item}
                                                            trigger={
                                                                <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                                                                    <Eye className="mr-2 h-4 w-4" />
                                                                    Ver detalhes
                                                                </DropdownMenuItem>
                                                            }
                                                        />


                                                        {(item.contract_billing_id || item.one_time_sale_id) && (
                                                            <DropdownMenuItem onSelect={() => {
                                                                setInvoiceData({
                                                                    id: item.contract_billing_id || item.one_time_sale_id,
                                                                    type: item.contract_billing_id ? 'contract' : 'sale',
                                                                    receivableId: item.id
                                                                });
                                                                setInvoiceDialogOpen(true);
                                                            }}>
                                                                <CreditCard className="mr-2 h-4 w-4" />
                                                                Gerar Fatura
                                                            </DropdownMenuItem>
                                                        )}

                                                        <DropdownMenuSeparator />

                                                        <DropdownMenuItem onClick={() => handleDeleteClick(item)} className="text-destructive">
                                                            <Trash2 className="h-4 w-4 mr-2" /> Excluir lançamento
                                                        </DropdownMenuItem>
                                                    </DropdownMenuContent>
                                                </DropdownMenu>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                );
                            })
                        )}
                    </TableBody>
                </Table>
            </div>

            {/* PAGINAÇÃO */}
            <div className="flex flex-col md:flex-row justify-between items-center bg-card border rounded-lg p-4 gap-4 shadow-sm">
                <div className="flex items-center gap-2">
                    <Select
                        value={itemsPerPage.toString()}
                        onValueChange={(val) => {
                            setItemsPerPage(Number(val));
                            setCurrentPage(1);
                        }}
                    >
                        <SelectTrigger className="w-[80px] h-9">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="10">10</SelectItem>
                            <SelectItem value="25">25</SelectItem>
                            <SelectItem value="50">50</SelectItem>
                            <SelectItem value="100">100</SelectItem>
                        </SelectContent>
                    </Select>
                    <span className="text-sm text-muted-foreground whitespace-nowrap">Registros por página</span>
                </div>

                <div className="flex items-center gap-6">
                    <span className="text-sm text-muted-foreground">
                        Mostrando {Math.min((currentPage - 1) * itemsPerPage + 1, sortedReceivables.length)} - {Math.min(currentPage * itemsPerPage, sortedReceivables.length)} de {sortedReceivables.length} registros
                    </span>
                    <div className="flex items-center gap-1">
                        <Button
                            variant="outline"
                            size="icon"
                            className="h-9 w-9"
                            disabled={currentPage === 1}
                            onClick={() => setCurrentPage(prev => prev - 1)}
                        >
                            <ChevronLeft className="h-4 w-4" />
                        </Button>
                        <div className="flex items-center justify-center min-w-[32px] h-9 bg-primary/5 text-primary text-sm font-medium rounded-md px-2">
                            {currentPage}
                        </div>
                        <Button
                            variant="outline"
                            size="icon"
                            className="h-9 w-9"
                            disabled={currentPage === totalPages}
                            onClick={() => setCurrentPage(prev => prev + 1)}
                        >
                            <ChevronRight className="h-4 w-4" />
                        </Button>
                    </div>
                </div>
            </div>

            {/* Delete Confirmation Dialog */}
            <DeleteConfirmDialog
                open={deleteDialogOpen}
                onOpenChange={setDeleteDialogOpen}
                item={itemToDelete}
                type="receivable"
                relatedItems={relatedReceivables}
                onConfirmSingle={handleConfirmDeleteSingle}
                onConfirmAll={handleConfirmDeleteAll}
                isDeleting={isDeleting}
            />

            {invoiceData && (
                <BillingInvoiceDialog
                    open={invoiceDialogOpen}
                    onOpenChange={setInvoiceDialogOpen}
                    billingId={invoiceData.id}
                    type={invoiceData.type}
                    financialReceivableId={invoiceData.receivableId}
                />
            )}

            {/* Batch Delete Confirmation Dialog */}
            <AlertDialog open={batchDeleteDialogOpen} onOpenChange={setBatchDeleteDialogOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle className="flex items-center gap-2">
                            <Trash2 className="h-5 w-5 text-destructive" />
                            Excluir lançamentos em lote
                        </AlertDialogTitle>
                        <AlertDialogDescription className="space-y-2">
                            {(() => {
                                const selectedItems = receivables?.filter(item => selectedIds.includes(item.id)) || [];
                                const paidItems = selectedItems.filter(item => item.status === 'paid');
                                const deletableItems = selectedItems.filter(item => item.status !== 'paid');
                                return (
                                    <>
                                        <span className="block">
                                            {deletableItems.length} lançamento(s) em aberto serão excluídos permanentemente.
                                        </span>
                                        {paidItems.length > 0 && (
                                            <span className="block text-amber-600 font-medium">
                                                {paidItems.length} lançamento(s) com status "Recebido" serão mantidos.
                                            </span>
                                        )}
                                        <span className="block font-medium">Esta ação não pode ser desfeita.</span>
                                    </>
                                );
                            })()}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <Button
                            variant="destructive"
                            onClick={async () => {
                                setBatchDeleteDialogOpen(false);
                                if (batchDeletePendingAction) {
                                    await batchDeletePendingAction();
                                    setBatchDeletePendingAction(null);
                                }
                            }}
                        >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Excluir
                        </Button>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* Modal: Lançamento pago não pode ser excluído */}
            <Dialog open={paidBlockOpen} onOpenChange={setPaidBlockOpen}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <div className="flex items-center gap-3">
                            <div className="flex items-center justify-center h-10 w-10 rounded-full bg-amber-100 shrink-0">
                                <Info className="h-5 w-5 text-amber-600" />
                            </div>
                            <div>
                                <DialogTitle>Lançamento já recebido</DialogTitle>
                                <DialogDescription>
                                    Não é possível excluir um lançamento com status "Recebido".
                                </DialogDescription>
                            </div>
                        </div>
                    </DialogHeader>

                    <div className="bg-slate-50 border rounded-lg p-4 space-y-3">
                        <p className="text-sm font-semibold text-slate-700">Para excluir, siga os passos abaixo:</p>
                        <div className="space-y-2.5">
                            <div className="flex items-start gap-3">
                                <span className="flex items-center justify-center h-6 w-6 rounded-full bg-primary text-white text-xs font-bold shrink-0">1</span>
                                <p className="text-sm text-slate-600">Clique em <strong>"Ações"</strong> ao lado do lançamento que deseja excluir.</p>
                            </div>
                            <div className="flex items-start gap-3">
                                <span className="flex items-center justify-center h-6 w-6 rounded-full bg-primary text-white text-xs font-bold shrink-0">2</span>
                                <p className="text-sm text-slate-600">Selecione a opção <strong>"Voltar para Em Aberto"</strong> para reverter o status do lançamento.</p>
                            </div>
                            <div className="flex items-start gap-3">
                                <span className="flex items-center justify-center h-6 w-6 rounded-full bg-primary text-white text-xs font-bold shrink-0">3</span>
                                <p className="text-sm text-slate-600">Após o status voltar para <strong>"Em Aberto"</strong>, clique novamente em <strong>"Excluir"</strong>.</p>
                            </div>
                        </div>
                    </div>

                    <DialogFooter>
                        <Button onClick={() => setPaidBlockOpen(false)} className="w-full sm:w-auto">
                            Entendi
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div >
    );
}
