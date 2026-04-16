import { useState, useMemo } from "react";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    Sheet,
    SheetContent,
    SheetHeader,
    SheetTitle,
    SheetTrigger,
    SheetFooter,
} from "@/components/ui/sheet";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
    Search,
    Filter,
    Download,
    FileSpreadsheet,
    FileText,
    FileDown,
    X,
    ArrowUpDown,
    ArrowUp,
    ArrowDown
} from "lucide-react";
import { format, isWithinInterval, startOfDay, endOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { formatCurrency } from "@/utils/format";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Unlock, Lock, Eye } from "lucide-react";

interface CRMTableProps {
    opportunities: any[];
    stages: any[];
    members: any[];
    onCardClick: (opportunity: any) => void;
    filters: any;
    setFilters: (filters: any) => void;
    searchTerm: string;
    setSearchTerm: (term: string) => void;
}

export function CRMTable({
    opportunities,
    stages,
    members,
    onCardClick,
    filters,
    setFilters,
    searchTerm,
    setSearchTerm
}: CRMTableProps) {
    const queryClient = useQueryClient();
    const [sortConfig, setSortConfig] = useState<{ key: string, direction: 'asc' | 'desc' | null }>({
        key: 'created_at',
        direction: 'desc'
    });

    const hasPermission = (member: any, permission: string) => {
        return member.roles?.role_permissions?.some((rp: any) => rp.permissions?.slug === permission);
    };

    const sdrMembers = members.filter(m => {
        const legacyRole = m.role?.toLowerCase();
        const roleName = m.roles?.name?.toLowerCase();
        return ['sdr', 'sales_manager', 'admin', 'owner'].includes(legacyRole) ||
            ['sdr', 'dono', 'admin', 'gerente de vendas', 'gestor de vendas', 'sales manager', 'owner'].includes(roleName) ||
            hasPermission(m, 'crm.view');
    });
    const closerMembers = members.filter(m => {
        const legacyRole = m.role?.toLowerCase();
        const roleName = m.roles?.name?.toLowerCase();
        return ['closer', 'sales_manager', 'admin', 'owner'].includes(legacyRole) ||
            ['closer', 'dono', 'admin', 'gerente de vendas', 'gestor de vendas', 'sales manager', 'owner'].includes(roleName) ||
            hasPermission(m, 'crm.edit');
    });

    const segments = useMemo(() => {
        const s = new Set(opportunities.map(o => o.company_segment).filter(Boolean));
        return Array.from(s);
    }, [opportunities]);

    const sources = useMemo(() => {
        const s = new Set(opportunities.map(o => o.source).filter(Boolean));
        return Array.from(s);
    }, [opportunities]);

    const allProducts = useMemo(() => {
        const p = new Set();
        opportunities.forEach(o => {
            o.opportunity_products?.forEach((op: any) => {
                if (op.products?.name) p.add(op.products.name);
            });
        });
        return Array.from(p) as string[];
    }, [opportunities]);

    const sortedOpportunities = useMemo(() => {
        return [...opportunities].sort((a, b) => {
            if (!sortConfig.key || !sortConfig.direction) return 0;

            let valA: any;
            let valB: any;

            switch (sortConfig.key) {
                case 'lead':
                    valA = a.lead_name?.toLowerCase() || "";
                    valB = b.lead_name?.toLowerCase() || "";
                    break;
                case 'stage':
                    valA = a.opportunity_stages?.name?.toLowerCase() || "";
                    valB = b.opportunity_stages?.name?.toLowerCase() || "";
                    break;
                case 'value':
                    valA = Number(a.negotiated_value || a.estimated_value || 0);
                    valB = Number(b.negotiated_value || b.estimated_value || 0);
                    break;
                case 'created_at':
                    valA = new Date(a.created_at).getTime();
                    valB = new Date(b.created_at).getTime();
                    break;
                case 'sdr':
                    valA = a.assigned_sdr_profile?.full_name?.toLowerCase() || "";
                    valB = b.assigned_sdr_profile?.full_name?.toLowerCase() || "";
                    break;
                case 'closer':
                    valA = a.assigned_closer_profile?.full_name?.toLowerCase() || "";
                    valB = b.assigned_closer_profile?.full_name?.toLowerCase() || "";
                    break;
                default:
                    valA = a[sortConfig.key];
                    valB = b[sortConfig.key];
            }

            if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
            if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
            return 0;
        });
    }, [opportunities, sortConfig]);

    const handleReleaseLead = async (oppId: string) => {
        try {
            const { error } = await (supabase as any)
                .from("opportunities")
                .update({ is_held: false })
                .eq("id", oppId);

            if (error) throw error;
            toast.success("Lead liberado para o SDR com sucesso!");
            queryClient.invalidateQueries({ queryKey: ["opportunities"] });
        } catch (error: any) {
            toast.error("Erro ao liberar lead: " + error.message);
        }
    };

    const handleSort = (key: string) => {
        setSortConfig((prev) => ({
            key,
            direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
        }));
    };

    const getSortIcon = (key: string) => {
        if (sortConfig.key !== key) return <ArrowUpDown className="ml-2 h-4 w-4" />;
        return sortConfig.direction === 'asc' ? <ArrowUp className="ml-2 h-4 w-4" /> : <ArrowDown className="ml-2 h-4 w-4" />;
    };

    const resetFilters = () => {
        setFilters({
            stageId: "all",
            sdrId: "all",
            closerId: "all",
            segment: "all",
            source: "all",
            minValue: "",
            maxValue: "",
            minRevenue: "",
            maxRevenue: "",
            minInvestment: "",
            maxInvestment: "",
            utm_source: "",
            utm_medium: "",
            utm_campaign: "",
            productId: "all",
            email: "",
            phone: "",
            document: "",
            startDate: "",
            endDate: "",
            minExpectedDate: "",
            maxExpectedDate: "",
            includeTags: [],
            excludeTags: [],
            quizIds: [],
            webinarStatuses: []
        });
        setSearchTerm("");
    };

    const getExportData = () => {
        return sortedOpportunities.map(opp => ({
            "Nome do Lead": opp.lead_name,
            "Empresa": opp.lead_company || "-",
            "Fase": opp.opportunity_stages?.name || "-",
            "Valor": opp.negotiated_value || opp.estimated_value || 0,
            "SDR": opp.assigned_sdr_profile?.full_name || "Não atribuído",
            "Closer": opp.assigned_closer_profile?.full_name || "Não atribuído",
            "Segmento": opp.company_segment || "-",
            "Origem": opp.source || "-",
            "Faturamento": opp.company_revenue || 0,
            "Investimento": opp.company_investment || 0,
            "E-mail": opp.lead_email || "-",
            "Telefone": opp.lead_phone || "-",
            "UTM Source": opp.custom_fields?.utm_source || "-",
            "UTM Medium": opp.custom_fields?.utm_medium || "-",
            "UTM Campaign": opp.custom_fields?.utm_campaign || "-",
            "Data de Criação": format(new Date(opp.created_at), "dd/MM/yyyy HH:mm")
        }));
    };

    const exportCSV = () => {
        const data = getExportData();
        const csvContent = "data:text/csv;charset=utf-8," +
            [
                Object.keys(data[0]).join(","),
                ...data.map(row => Object.values(row).map(value => `"${value}"`).join(","))
            ].join("\n");

        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `leads_crm_${format(new Date(), "yyyy-MM-dd")}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const exportXLSX = () => {
        const data = getExportData();
        const worksheet = XLSX.utils.json_to_sheet(data);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Leads");
        XLSX.writeFile(workbook, `leads_crm_${format(new Date(), "yyyy-MM-dd")}.xlsx`);
    };

    const exportPDF = () => {
        const doc = new jsPDF("l", "pt", "a4");
        const data = getExportData();
        const headers = [Object.keys(data[0])];
        const body = data.map(row => Object.values(row));

        autoTable(doc, {
            head: headers,
            body: body,
            styles: { fontSize: 8 },
            margin: { top: 40 },
            didDrawPage: (data) => {
                doc.text("Relatório de Leads CRM", 40, 30);
            }
        });

        doc.save(`leads_crm_${format(new Date(), "yyyy-MM-dd")}.pdf`);
    };

    return (
        <div className="space-y-4">
            <div className="flex flex-col sm:flex-row gap-4 justify-end items-start sm:items-center">
                <div className="flex items-center gap-2 w-full sm:w-auto">
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button disabled={opportunities.length === 0} className="gap-2">
                                <Download className="h-4 w-4" />
                                Exportar
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-48">
                            <DropdownMenuItem onClick={exportCSV} className="gap-2 cursor-pointer">
                                <FileText className="h-4 w-4" /> Exportar CSV
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={exportXLSX} className="gap-2 cursor-pointer">
                                <FileSpreadsheet className="h-4 w-4" /> Exportar Excel
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={exportPDF} className="gap-2 cursor-pointer">
                                <FileDown className="h-4 w-4" /> Exportar PDF
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
            </div>

            <div className="rounded-[32px] border border-white/60 dark:border-white/10 bg-white/40 dark:bg-black/40 backdrop-blur-xl overflow-hidden shadow-2xl">
                <div className="overflow-x-auto">
                    <Table>
                        <TableHeader className="bg-[#3B82F6]/5 dark:bg-white/5 border-b border-white/40 dark:border-white/10">
                            <TableRow className="hover:bg-transparent border-none">
                                <TableHead className="py-6 px-6 cursor-pointer group transition-colors" onClick={() => handleSort('lead')}>
                                    <div className="flex items-center text-[10px] font-black uppercase tracking-[0.2em] text-[#1D4ED8] dark:text-white/60 group-hover:text-[#3B82F6]">
                                        Lead {getSortIcon('lead')}
                                    </div>
                                </TableHead>
                                <TableHead className="py-6 px-6 cursor-pointer group transition-colors" onClick={() => handleSort('stage')}>
                                    <div className="flex items-center text-[10px] font-black uppercase tracking-[0.2em] text-[#1D4ED8] dark:text-white/60 group-hover:text-[#3B82F6]">
                                        Fase {getSortIcon('stage')}
                                    </div>
                                </TableHead>
                                <TableHead className="py-6 px-6 cursor-pointer group transition-colors" onClick={() => handleSort('value')}>
                                    <div className="flex items-center text-[10px] font-black uppercase tracking-[0.2em] text-[#1D4ED8] dark:text-white/60 group-hover:text-[#3B82F6]">
                                        Valor {getSortIcon('value')}
                                    </div>
                                </TableHead>
                                <TableHead className="py-6 px-6 cursor-pointer group transition-colors" onClick={() => handleSort('sdr')}>
                                    <div className="flex items-center text-[10px] font-black uppercase tracking-[0.2em] text-[#1D4ED8] dark:text-white/60 group-hover:text-[#3B82F6]">
                                        SDR {getSortIcon('sdr')}
                                    </div>
                                </TableHead>
                                <TableHead className="py-6 px-6 cursor-pointer group transition-colors" onClick={() => handleSort('closer')}>
                                    <div className="flex items-center text-[10px] font-black uppercase tracking-[0.2em] text-[#1D4ED8] dark:text-white/60 group-hover:text-[#3B82F6]">
                                        Closer {getSortIcon('closer')}
                                    </div>
                                </TableHead>
                                <TableHead className="py-6 px-6 cursor-pointer group transition-colors" onClick={() => handleSort('created_at')}>
                                    <div className="flex items-center text-[10px] font-black uppercase tracking-[0.2em] text-[#1D4ED8] dark:text-white/60 group-hover:text-[#3B82F6]">
                                        Data {getSortIcon('created_at')}
                                    </div>
                                </TableHead>
                                <TableHead className="py-6 px-6 text-right text-[10px] font-black uppercase tracking-[0.2em] text-[#1D4ED8] dark:text-white/60">Ações</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {sortedOpportunities.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={7} className="h-48 text-center bg-white/5 dark:bg-black/5">
                                        <div className="flex flex-col items-center justify-center opacity-30">
                                            <Search className="h-10 w-10 mb-4" />
                                            <p className="text-[11px] font-black uppercase tracking-widest">Nenhum lead encontrado</p>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ) : (
                                sortedOpportunities.map((opp) => (
                                    <TableRow
                                        key={opp.id}
                                        className="group cursor-pointer hover:bg-[#3B82F6]/5 dark:hover:bg-white/[0.03] transition-all border-b border-white/20 dark:border-white/5"
                                        onClick={() => onCardClick(opp)}
                                    >
                                        <TableCell className="py-5 px-6">
                                            <div className="flex flex-col gap-1">
                                                <div className="flex items-center gap-2">
                                                    <span className="font-black text-[13px] text-[#1D4ED8] dark:text-white uppercase tracking-tight group-hover:text-[#3B82F6] transition-colors">{opp.lead_name}</span>
                                                    {opp.is_held && (
                                                        <Badge className="bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20 text-[8px] font-black px-1.5 h-4 uppercase flex items-center gap-1">
                                                            <Lock className="h-2.5 w-2.5" />
                                                            Travado
                                                        </Badge>
                                                    )}
                                                </div>
                                                <div className="flex items-center gap-1.5 opacity-50">
                                                    <span className="text-[10px] font-bold uppercase tracking-wide">{opp.lead_company || "Empresa não informada"}</span>
                                                </div>
                                            </div>
                                        </TableCell>
                                        <TableCell className="py-5 px-6">
                                            <Badge
                                                className="text-[9px] font-black uppercase tracking-widest px-2.5 h-6 rounded-lg pointer-events-none"
                                                style={{
                                                    backgroundColor: `${opp.opportunity_stages?.color}15`,
                                                    color: opp.opportunity_stages?.color,
                                                    border: `1px solid ${opp.opportunity_stages?.color}30`
                                                }}
                                            >
                                                {opp.opportunity_stages?.name}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="py-5 px-6">
                                            <div className="font-fira-code font-black text-[14px] text-[#3B82F6] dark:text-white flex items-center gap-1">
                                                <span className="text-[10px] opacity-40">R$</span>
                                                {Number(opp.negotiated_value || opp.estimated_value || 0).toLocaleString('pt-BR', { minimumFractionDigits: 0 })}
                                            </div>
                                        </TableCell>
                                        <TableCell className="py-5 px-6">
                                            <div className="flex items-center gap-2">
                                                <div className="w-5 h-5 rounded-full bg-[#3B82F6]/10 border border-[#3B82F6]/20 flex items-center justify-center text-[9px] font-black text-[#3B82F6]">
                                                    {opp.assigned_sdr_profile?.full_name?.split(' ').map((n: string) => n[0]).join('').slice(0, 1)}
                                                </div>
                                                <span className="text-[11px] font-bold text-[#1D4ED8] dark:text-white/70 uppercase">
                                                    {opp.assigned_sdr_profile?.full_name || "-"}
                                                </span>
                                            </div>
                                        </TableCell>
                                        <TableCell className="py-5 px-6">
                                            <div className="flex items-center gap-2">
                                                <div className="w-5 h-5 rounded-full bg-[#F97316]/10 border border-[#F97316]/20 flex items-center justify-center text-[9px] font-black text-[#F97316]">
                                                    {opp.assigned_closer_profile?.full_name?.split(' ').map((n: string) => n[0]).join('').slice(0, 1)}
                                                </div>
                                                <span className="text-[11px] font-bold text-[#1D4ED8] dark:text-white/70 uppercase">
                                                    {opp.assigned_closer_profile?.full_name || "-"}
                                                </span>
                                            </div>
                                        </TableCell>
                                        <TableCell className="py-5 px-6">
                                            <div className="text-[11px] font-fira-code font-bold text-[#1D4ED8]/60 dark:text-white/40">
                                                {format(new Date(opp.created_at), "dd/MM HH:mm")}
                                            </div>
                                        </TableCell>
                                        <TableCell className="py-5 px-6 text-right">
                                            <div className="flex justify-end gap-3">
                                                {opp.is_held && (
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        className="h-8 px-4 bg-amber-500/10 text-amber-600 hover:bg-amber-500 hover:text-white rounded-xl text-[9px] font-black uppercase tracking-widest gap-2"
                                                        onClick={(e) => { e.stopPropagation(); handleReleaseLead(opp.id); }}
                                                    >
                                                        <Unlock className="h-3.5 w-3.5" />
                                                        Liberar
                                                    </Button>
                                                )}
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    className="h-8 w-8 p-0 hover:bg-[#3B82F6]/10 dark:hover:bg-white/10 rounded-xl transition-all"
                                                    onClick={(e) => { e.stopPropagation(); onCardClick(opp); }}
                                                >
                                                    <Eye className="h-4 w-4 text-[#3B82F6]" />
                                                </Button>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </div>
            </div>
        </div>
    );
}
