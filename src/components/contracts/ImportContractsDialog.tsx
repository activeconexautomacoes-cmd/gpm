import { useState, useRef, useMemo } from "react";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Download, Upload, Loader2, FileSpreadsheet, CheckCircle2, AlertCircle, Info, ArrowRight } from "lucide-react";
import * as XLSX from "xlsx";
import { addMonths, format } from "date-fns";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";

interface ImportContractsDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onImportSuccess: () => void;
}

interface PreviewItem {
    clientName: string;
    contractName: string;
    value: number;
    startDate: string;
    period: string;
    billingDay: number;
    status: string;
    action: 'create' | 'update';
    clientId?: string;
    existingContractId?: string;
    row: any;
}

export function ImportContractsDialog({ open, onOpenChange, onImportSuccess }: ImportContractsDialogProps) {
    const { currentWorkspace } = useWorkspace();
    const [isProcessing, setIsProcessing] = useState(false);
    const [isImporting, setIsImporting] = useState(false);
    const [previewData, setPreviewData] = useState<PreviewItem[] | null>(null);
    const [importResults, setImportResults] = useState<{ success: number; errors: string[] } | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const downloadTemplate = () => {
        const templateData = [
            {
                "Nome do Cliente": "WINHUB DIGITAL LTDA",
                "Nome do Contrato": "Assessoria Completa de Marketing",
                "Valor": 5000,
                "Data de Início": "01/01/2025",
                "Dia de Faturamento": 5,
                "Período": "12_months",
                "Meses Personalizados": "",
                "Taxa de Implementação": 1000,
                "Status": "Ativo",
            }
        ];

        const ws = XLSX.utils.json_to_sheet(templateData);
        XLSX.utils.sheet_add_aoa(ws, [
            [],
            ["INSTRUÇÕES:"],
            ["Período aceita: 6_months, 12_months, 18_months, 24_months, ou custom"],
            ["Se usar 'custom', preencha 'Meses Personalizados' com o número de meses"],
            ["Status aceita: Ativo ou Cancelado"],
        ], { origin: -1 });

        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Modelo de Importação");
        XLSX.writeFile(wb, "modelo_importacao_contratos.xlsx");
        toast.success("Modelo baixado com sucesso!");
    };

    const normalizePeriod = (periodStr: string): string => {
        if (!periodStr) return "12_months";
        const normalized = periodStr.toString().toLowerCase().trim();
        const periodMap: Record<string, string> = {
            "6 meses": "6_months", "6meses": "6_months", "6": "6_months",
            "12 meses": "12_months", "12meses": "12_months", "12": "12_months",
            "18 meses": "18_months", "18meses": "18_months", "18": "18_months",
            "24 meses": "24_months", "24meses": "24_months", "24": "24_months",
            "personalizado": "custom", "customizado": "custom",
        };
        if (periodMap[normalized]) return periodMap[normalized];
        if (["6_months", "12_months", "18_months", "24_months", "custom"].includes(normalized)) return normalized;
        return "12_months";
    };

    const parseDate = (dateStr: string): string => {
        if (!dateStr) return format(new Date(), 'yyyy-MM-dd');
        const parts = dateStr.toString().split(/[/-]/);
        if (parts.length === 3) {
            if (parts[0].length === 4) return `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`;
            else return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
        }
        return format(new Date(), 'yyyy-MM-dd');
    };

    const calculateEndDate = (startDate: string, period: string, customMonths?: number): string | null => {
        const [y, m, d] = startDate.split('-').map(Number);
        const start = new Date(y, m - 1, d);
        const periodMonths: Record<string, number> = { "6_months": 6, "12_months": 12, "18_months": 18, "24_months": 24 };
        const months = period === "custom" && customMonths ? customMonths : periodMonths[period];
        if (!months) return null;
        return format(addMonths(start, months), 'yyyy-MM-dd');
    };

    const generateBillingDates = (startDate: string, endDate: string | null, billingDay: number, startFromDate?: Date) => {
        const dates: Date[] = [];
        const [startYear, startMonth, startDay] = startDate.split('-').map(Number);
        const start = new Date(startYear, startMonth - 1, startDay);

        let end: Date;
        if (endDate) {
            const [endYear, endMonth, endDay] = endDate.split('-').map(Number);
            end = new Date(endYear, endMonth - 1, endDay, 23, 59, 59);
        } else {
            // Se não houver data final, gera por 12 meses a partir de agora
            end = addMonths(new Date(), 12);
        }

        const limitDate = startFromDate || new Date();
        let currentDate = new Date(start);

        // Função auxiliar para ajustar o dia respeitando o final do mês
        const adjustDay = (date: Date, day: number) => {
            const lastDay = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
            date.setDate(Math.min(day, lastDay));
        };

        // Começa a gerar a partir do mês de início do contrato
        adjustDay(currentDate, billingDay);

        while (currentDate <= end) {
            // Apenas adiciona se a data for igual ou maior que a data limite (hoje/importação)
            if (currentDate >= limitDate) {
                dates.push(new Date(currentDate));
            }
            currentDate.setMonth(currentDate.getMonth() + 1);
            adjustDay(currentDate, billingDay);
        }
        return dates;
    };

    const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target?.files?.[0];
        if (!file || !currentWorkspace?.id) return;

        setIsProcessing(true);
        setImportResults(null);
        const reader = new FileReader();

        reader.onload = async (e) => {
            try {
                const data = new Uint8Array(e.target?.result as ArrayBuffer);
                let workbook;
                if (file.name.endsWith('.csv')) {
                    workbook = XLSX.read(data, { type: "array", codepage: 65001 });
                } else {
                    workbook = XLSX.read(data, { type: "array" });
                }

                const sheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[sheetName];
                const jsonData = XLSX.utils.sheet_to_json(worksheet) as any[];

                if (jsonData.length === 0) {
                    toast.error("O arquivo está vazio.");
                    setIsProcessing(false);
                    return;
                }

                const { data: clients } = await (supabase as any).from("clients").select("*").eq("workspace_id", currentWorkspace.id);
                const { data: contracts } = await (supabase as any).from("contracts").select("*").eq("workspace_id", currentWorkspace.id);

                const clientMap = new Map((clients || []).map((c: any) => [c.name.toLowerCase().trim(), c.id]));

                const previewItems: PreviewItem[] = [];

                for (const row of jsonData) {
                    const clientName = row["Nome do Cliente"]?.toString().trim();
                    if (!clientName) continue;

                    const clientId = clientMap.get(clientName.toLowerCase());
                    const value = parseFloat(row["Valor"]?.toString() || "0");
                    const startDate = parseDate(row["Data de Início"]);
                    const contractName = row["Nome do Contrato"] || "Contrato";

                    const existingContract = (contracts || []).find((c: any) =>
                        c.client_id === clientId &&
                        c.start_date === startDate &&
                        (Math.abs(c.value - value) < 0.01)
                    );

                    previewItems.push({
                        clientName,
                        contractName,
                        value,
                        startDate,
                        period: normalizePeriod(row["Período"]),
                        billingDay: parseInt(row["Dia de Faturamento"]?.toString() || "5"),
                        status: (row["Status"]?.toString().toLowerCase() === "cancelado") ? "cancelled" : "active",
                        action: existingContract ? 'update' : 'create',
                        clientId,
                        existingContractId: existingContract?.id,
                        row
                    });
                }
                setPreviewData(previewItems);
            } catch (error: any) {
                console.error("Erro no processamento:", error);
                toast.error("Erro ao analisar planilha: " + error.message);
            } finally {
                setIsProcessing(false);
            }
        };

        reader.readAsArrayBuffer(file);
    };

    const confirmImport = async () => {
        if (!previewData || !currentWorkspace?.id) return;

        setIsImporting(true);
        const errors: string[] = [];
        let successCount = 0;
        const clientMap = new Map();

        const { data: currentClients } = await (supabase as any).from("clients").select("*").eq("workspace_id", currentWorkspace.id);
        (currentClients || []).forEach((c: any) => clientMap.set(c.name.toLowerCase().trim(), c.id));

        for (const [index, item] of previewData.entries()) {
            try {
                let clientId = item.clientId || clientMap.get(item.clientName.toLowerCase());

                if (!clientId) {
                    const { data: newClient, error: newClientError } = await (supabase as any)
                        .from("clients")
                        .insert({
                            workspace_id: currentWorkspace.id,
                            name: item.clientName,
                            status: 'active'
                        })
                        .select()
                        .single();

                    if (newClientError) throw new Error(`Erro ao criar cliente: ${newClientError.message}`);
                    clientId = newClient.id;
                    clientMap.set(item.clientName.toLowerCase(), clientId);
                }

                const customPeriodMonths = item.row["Meses Personalizados"] || null;
                const endDate = calculateEndDate(item.startDate, item.period, customPeriodMonths);

                const contractData: any = {
                    workspace_id: currentWorkspace.id,
                    client_id: clientId,
                    name: item.contractName,
                    value: item.value,
                    start_date: item.startDate,
                    end_date: endDate,
                    billing_day: item.billingDay,
                    contract_period: item.period,
                    custom_period_months: item.period === "custom" ? (customPeriodMonths || 12) : null,
                    implementation_fee: parseFloat(item.row["Taxa de Implementação"]?.toString() || "0"),
                    status: item.status,
                };

                let savedContract;

                if (item.existingContractId) {
                    const { data, error: updateError } = await (supabase as any)
                        .from("contracts")
                        .update(contractData)
                        .eq("id", item.existingContractId)
                        .select()
                        .single();

                    if (updateError) throw updateError;
                    savedContract = data;

                    await (supabase as any).from("contract_billings").delete().eq("contract_id", savedContract.id).eq("status", "pending");
                    await (supabase as any).from("financial_receivables").delete().eq("contract_id", savedContract.id).eq("status", "pending");
                } else {
                    const { data, error: insertError } = await (supabase as any)
                        .from("contracts")
                        .insert(contractData)
                        .select()
                        .single();

                    if (insertError) throw insertError;
                    savedContract = data;
                }

                if (savedContract.status === 'active') {
                    // Gerar cobranças apenas para ativos e a partir de hoje
                    const billingDates = generateBillingDates(
                        savedContract.start_date,
                        savedContract.end_date,
                        savedContract.billing_day,
                        new Date() // startFromDate = Hoje
                    );

                    if (billingDates.length > 0) {
                        const billings = billingDates.map((date) => ({
                            workspace_id: currentWorkspace.id,
                            contract_id: savedContract.id,
                            due_date: format(date, "yyyy-MM-dd"),
                            amount: savedContract.value,
                            discount: 0,
                            final_amount: savedContract.value,
                            status: 'pending',
                        }));

                        const { data: insertedBillings, error: billingsInsertError } = await (supabase as any).from("contract_billings").insert(billings).select();
                        if (billingsInsertError) throw billingsInsertError;

                        if (insertedBillings && insertedBillings.length > 0) {
                            const { data: catData } = await (supabase as any).from('financial_categories').select('id').eq('type', 'income').limit(1).maybeSingle();
                            if (catData?.id) {
                                const receivables = insertedBillings.map((billing: any) => ({
                                    workspace_id: billing.workspace_id,
                                    description: `Mensalidade Contrato - ${savedContract.name}`,
                                    title: `Mensalidade Contrato - ${savedContract.name}`,
                                    amount: billing.final_amount,
                                    total_amount: billing.final_amount,
                                    due_date: billing.due_date,
                                    category_id: catData.id,
                                    client_id: savedContract.client_id,
                                    status: 'pending',
                                    contract_billing_id: billing.id,
                                    contract_id: savedContract.id
                                }));
                                const { error: receivablesInsertError } = await (supabase as any).from("financial_receivables").insert(receivables);
                                if (receivablesInsertError) throw receivablesInsertError;
                            }
                        }
                    }
                }

                successCount++;
            } catch (error: any) {
                errors.push(`Linha ${index + 2}: ${error.message}`);
            }
        }

        setImportResults({ success: successCount, errors });
        setIsImporting(false);
        if (successCount > 0) {
            toast.success(`${successCount} item(s) processado(s) com sucesso!`);
            onImportSuccess();
        }
    };

    const previewStats = useMemo(() => {
        if (!previewData) return null;
        return {
            total: previewData.length,
            toCreate: previewData.filter(i => i.action === 'create').length,
            toUpdate: previewData.filter(i => i.action === 'update').length,
            newClients: previewData.filter(i => !i.clientId).length
        };
    }, [previewData]);

    const handleClose = () => {
        setPreviewData(null);
        setImportResults(null);
        onOpenChange(false);
    };

    return (
        <Dialog open={open} onOpenChange={handleClose}>
            <DialogContent className={previewData && !importResults ? "sm:max-w-[900px] max-h-[90vh] overflow-y-auto" : "sm:max-w-[600px]"}>
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <FileSpreadsheet className="h-5 w-5 text-blue-600" />
                        {previewData && !importResults ? "Validar Importação" : "Importar Contratos em Massa"}
                    </DialogTitle>
                    <DialogDescription>
                        {previewData && !importResults
                            ? "Revise os dados abaixo antes de confirmar a gravação no sistema."
                            : "Importe múltiplos contratos de uma vez usando uma planilha Excel."}
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-6 py-4">
                    {!previewData && !importResults && (
                        <>
                            <div className="bg-muted/50 p-4 rounded-lg flex items-center justify-between border border-dashed">
                                <div className="space-y-1">
                                    <p className="text-sm font-medium text-foreground">Planilha Modelo</p>
                                    <p className="text-xs text-muted-foreground">Baixe o modelo para garantir o formato correto.</p>
                                </div>
                                <Button variant="outline" size="sm" onClick={downloadTemplate}>
                                    <Download className="mr-2 h-4 w-4" />
                                    Baixar Modelo
                                </Button>
                            </div>

                            <div className="flex flex-col items-center justify-center border-2 border-dashed rounded-xl p-10 hover:bg-muted/30 transition-colors cursor-pointer relative">
                                <input
                                    type="file"
                                    ref={fileInputRef}
                                    onChange={handleFileUpload}
                                    accept=".csv, .xlsx, .xls"
                                    className="absolute inset-0 opacity-0 cursor-pointer"
                                    disabled={isProcessing}
                                />
                                {isProcessing ? (
                                    <div className="flex flex-col items-center gap-2 text-center">
                                        <Loader2 className="h-10 w-10 text-primary animate-spin" />
                                        <p className="text-sm font-medium">Analisando planilha...</p>
                                    </div>
                                ) : (
                                    <div className="flex flex-col items-center gap-2 text-center">
                                        <div className="p-3 rounded-full bg-primary/10 text-primary mb-2">
                                            <Upload className="h-6 w-6" />
                                        </div>
                                        <p className="text-sm font-semibold text-foreground">Clique ou arraste o arquivo aqui</p>
                                        <p className="text-xs text-muted-foreground">Suporta .XLSX, .XLS e .CSV</p>
                                    </div>
                                )}
                            </div>
                        </>
                    )}

                    {previewData && !importResults && (
                        <div className="space-y-6">
                            <div className="grid grid-cols-4 gap-4">
                                <Card className="p-4 bg-blue-50/50 border-blue-100">
                                    <p className="text-xs font-bold text-blue-600 uppercase">Total de Linhas</p>
                                    <p className="text-2xl font-black text-blue-900">{previewStats?.total}</p>
                                </Card>
                                <Card className="p-4 bg-emerald-50/50 border-emerald-100">
                                    <p className="text-xs font-bold text-emerald-600 uppercase">Novos Contratos</p>
                                    <p className="text-2xl font-black text-emerald-900">{previewStats?.toCreate}</p>
                                </Card>
                                <Card className="p-4 bg-amber-50/50 border-amber-100">
                                    <p className="text-xs font-bold text-amber-600 uppercase">Atualizações</p>
                                    <p className="text-2xl font-black text-amber-900">{previewStats?.toUpdate}</p>
                                </Card>
                                <Card className="p-4 bg-blue-50/50 border-blue-100">
                                    <p className="text-xs font-bold text-blue-600 uppercase">Novos Clientes</p>
                                    <p className="text-2xl font-black text-blue-900">{previewStats?.newClients}</p>
                                </Card>
                            </div>

                            <div className="rounded-lg border overflow-hidden">
                                <Table>
                                    <TableHeader className="bg-muted/50">
                                        <TableRow>
                                            <TableHead className="w-[200px]">Cliente</TableHead>
                                            <TableHead>Contrato</TableHead>
                                            <TableHead>Valor</TableHead>
                                            <TableHead>Início</TableHead>
                                            <TableHead>Ação</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {previewData.slice(0, 50).map((item, i) => (
                                            <TableRow key={i}>
                                                <TableCell className="font-medium">
                                                    {item.clientName}
                                                    {!item.clientId && <Badge variant="outline" className="ml-2 text-[9px] bg-blue-50 text-blue-700 border-blue-200">Novo</Badge>}
                                                </TableCell>
                                                <TableCell className="max-w-[200px] truncate">{item.contractName}</TableCell>
                                                <TableCell>{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(item.value)}</TableCell>
                                                <TableCell>{item.startDate}</TableCell>
                                                <TableCell>
                                                    {item.action === 'create'
                                                        ? <Badge className="bg-emerald-500">CRIAR</Badge>
                                                        : <Badge variant="secondary" className="bg-amber-100 text-amber-700 hover:bg-amber-100 border-amber-200">ATUALIZAR</Badge>
                                                    }
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                                {previewData.length > 50 && (
                                    <div className="p-3 text-center bg-muted/20 text-xs text-muted-foreground border-t">
                                        Mostrando apenas os primeiros 50 itens...
                                    </div>
                                )}
                            </div>

                            <div className="flex items-start gap-3 p-4 bg-amber-50 rounded-xl border border-amber-100">
                                <Info className="h-5 w-5 text-amber-600 mt-0.5" />
                                <div className="space-y-1">
                                    <p className="text-sm font-bold text-amber-900">Atenção ao Confirmar</p>
                                    <p className="text-xs text-amber-700 leading-relaxed">
                                        Ao confirmar, o sistema irá criar ou atualizar os registros conforme indicado. <br />
                                        Para **Atualizações**, as faturas e lançamentos financeiros **PENDENTES** serão regerados conforme os novos valores da planilha.
                                    </p>
                                </div>
                            </div>
                        </div>
                    )}

                    {importResults && (
                        <div className="space-y-4">
                            <div className="p-4 border rounded-lg bg-green-50">
                                <div className="flex items-center gap-2 mb-2">
                                    <CheckCircle2 className="h-5 w-5 text-green-600" />
                                    <h4 className="font-semibold text-green-900 uppercase tracking-tight">
                                        {importResults.success} operaçõe(s) realizadas com sucesso!
                                    </h4>
                                </div>
                            </div>

                            {importResults.errors.length > 0 && (
                                <div className="p-4 border rounded-lg bg-red-50">
                                    <div className="flex items-center gap-2 mb-2">
                                        <AlertCircle className="h-5 w-5 text-red-600" />
                                        <h4 className="font-semibold text-red-900 uppercase tracking-tight">
                                            {importResults.errors.length} erro(s) encontrado(s):
                                        </h4>
                                    </div>
                                    <ul className="text-xs text-red-800 space-y-1 max-h-40 overflow-y-auto">
                                        {importResults.errors.map((error, i) => (
                                            <li key={i}>• {error}</li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                        </div>
                    )}

                    {!previewData && !importResults && (
                        <div className="space-y-3">
                            <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Colunas Esperadas</h4>
                            <ul className="text-xs space-y-2 text-muted-foreground grid grid-cols-2 gap-2">
                                <li className="flex items-center gap-2"><CheckCircle2 className="h-3 w-3 text-blue-500" /> Nome do Cliente</li>
                                <li className="flex items-center gap-2"><CheckCircle2 className="h-3 w-3 text-blue-500" /> Nome do Contrato</li>
                                <li className="flex items-center gap-2"><CheckCircle2 className="h-3 w-3 text-blue-500" /> Valor</li>
                                <li className="flex items-center gap-2"><CheckCircle2 className="h-3 w-3 text-blue-500" /> Data de Início</li>
                                <li className="flex items-center gap-2"><CheckCircle2 className="h-3 w-3 text-blue-500" /> Dia de Faturamento</li>
                                <li className="flex items-center gap-2"><CheckCircle2 className="h-3 w-3 text-blue-500" /> Período</li>
                                <li className="flex items-center gap-2"><CheckCircle2 className="h-3 w-3 text-blue-500" /> Status</li>
                            </ul>
                        </div>
                    )}
                </div>

                <DialogFooter className="gap-2">
                    {previewData && !importResults ? (
                        <>
                            <Button variant="ghost" onClick={() => setPreviewData(null)} disabled={isImporting}>
                                Voltar
                            </Button>
                            <Button className="bg-blue-600 hover:bg-blue-700" onClick={confirmImport} disabled={isImporting}>
                                {isImporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ArrowRight className="mr-2 h-4 w-4" />}
                                Confirmar Importação
                            </Button>
                        </>
                    ) : (
                        <Button variant="ghost" onClick={handleClose} disabled={isImporting}>
                            {importResults ? "Fechar" : "Cancelar"}
                        </Button>
                    )}
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
