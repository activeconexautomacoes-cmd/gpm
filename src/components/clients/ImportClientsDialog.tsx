
import { useState, useRef } from "react";
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
import {
    Download,
    Upload,
    Loader2,
    FileSpreadsheet,
    CheckCircle2,
    AlertCircle,
    UserPlus,
    RefreshCcw,
    Table as TableIcon
} from "lucide-react";
import * as XLSX from "xlsx";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

interface ImportClientsDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onImportSuccess: () => void;
}

interface ImportPreview {
    toCreate: any[];
    toUpdate: { existing: any, newData: any, matchType: 'document' | 'email' | 'name' }[];
    errors: string[];
}

export function ImportClientsDialog({ open, onOpenChange, onImportSuccess }: ImportClientsDialogProps) {
    const { currentWorkspace } = useWorkspace();
    const [isProcessing, setIsProcessing] = useState(false);
    const [preview, setPreview] = useState<ImportPreview | null>(null);
    const [step, setStep] = useState<'upload' | 'preview'>('upload');
    const fileInputRef = useRef<HTMLInputElement>(null);

    const downloadTemplate = () => {
        const templateData = [
            {
                "Razão Social / Nome": "Cliente Exemplo LTDA",
                "Nome Fantasia": "Exemplo",
                "Cnpj/CPF": "00.000.000/0001-00",
                "Email": "contato@exemplo.com",
                "Celular": "(11) 99999-9999",
                "CEP": "00000-000",
                "Rua": "Rua Exemplo",
                "Numero": "123",
                "Complemento": "Sala 01",
                "Bairro": "Centro",
                "Cidade": "São Paulo",
                "UF": "SP",
                "Insc. Estadual": "",
                "Faturamento": "R$ 10.000,00",
                "Origem": "Instagram",
                "Status": "Ativo"
            }
        ];

        const ws = XLSX.utils.json_to_sheet(templateData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Modelo");
        XLSX.writeFile(wb, "modelo_importacao_clientes.xlsx");
    };

    const normalizeKey = (str: string | null | undefined): string => {
        if (!str) return "";
        return str
            .toLowerCase()
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "") // Remove acentos
            .replace(/[^a-z0-9]/g, ""); // Remove TUDO que não for letra ou número
    };

    const normalizeString = (str: string | null | undefined): string => {
        if (!str) return "";
        return str
            .toLowerCase()
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "") // Remove acentos
            .replace(/[^\w\s]/gi, "") // Remove símbolos
            .replace(/\s+/g, "") // Remove todos os espaços
            .replace(/ltda|me|eireli|epp|sa/gi, ""); // Remove sufixos jurídicos comuns
    };

    const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file || !currentWorkspace?.id) return;

        setIsProcessing(true);
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

                // 1. Encontrar a melhor aba (aquela que tem cara de ter dados de clientes e tem MAIS registros)
                let bestSheet = { name: workbook.SheetNames[0], jsonData: [] as any[] };

                for (const name of workbook.SheetNames) {
                    const tempSheet = workbook.Sheets[name];
                    const tempJson = XLSX.utils.sheet_to_json(tempSheet) as any[];
                    if (tempJson.length === 0) continue;

                    // Verifica se essa aba tem colunas de cliente
                    const firstRow = tempJson[0];
                    const keys = Object.keys(firstRow);
                    const hasHeaders = keys.some(k => {
                        const norm = normalizeKey(k);
                        return norm.includes("nome") || norm.includes("social") || norm.includes("cnpj") || norm.includes("cpf");
                    });

                    if (hasHeaders && tempJson.length > bestSheet.jsonData.length) {
                        bestSheet = { name, jsonData: tempJson };
                    }
                }

                const jsonData = bestSheet.jsonData;

                if (jsonData.length === 0) {
                    toast.error("Não encontramos dados de clientes em nenhuma aba da planilha.");
                    setIsProcessing(false);
                    return;
                }

                console.log(`Importando da aba: ${bestSheet.name} com ${jsonData.length} linhas`);

                // 1. Buscar todos os clientes existentes para comparação
                const { data: existingClients } = await (supabase as any)
                    .from("clients")
                    .select("*")
                    .eq("workspace_id", currentWorkspace.id);

                const toCreate: any[] = [];
                const toUpdate: any[] = [];
                const errors: string[] = [];

                // 2. Mapeamento Inteligente com Helper ultra-robusto
                const getVal = (row: any, variants: string[]) => {
                    const keys = Object.keys(row);
                    const normVariants = variants.map(v => normalizeKey(v));

                    // 1. Tenta match exato primeiro (performance)
                    for (const v of variants) {
                        if (row[v] !== undefined && row[v] !== null && String(row[v]).trim() !== "") return row[v];
                    }

                    // 2. Tenta match fuzzy (normalizando keys da planilha e variants)
                    const foundKey = keys.find(k => normVariants.includes(normalizeKey(k)));
                    if (foundKey && row[foundKey] !== undefined && row[foundKey] !== null && String(row[foundKey]).trim() !== "") {
                        return row[foundKey];
                    }
                    return null;
                };

                for (const row of jsonData) {
                    const name = getVal(row, ["Razão Social / Nome", "Razão Social", "Nome", "Nome do Cliente", "NOME", "Cliente"]);
                    const documentRaw = getVal(row, ["Cnpj/CPF", "CPF/CNPJ", "Documento", "CNPJ", "CPF", "CGC", "Doc"]);
                    const document = documentRaw ? String(documentRaw).replace(/[^\d]/g, "") : null;
                    const email = getVal(row, ["Email", "E-mail", "E-mails para Envio de Recados", "EMAIL", "Correio Eletrônico"]);

                    if (!name) {
                        errors.push(`Linha ${jsonData.indexOf(row) + 2} ignorada por falta de nome.`);
                        continue;
                    }

                    const clientData = {
                        workspace_id: currentWorkspace.id,
                        name: String(name).trim(),
                        trade_name: getVal(row, ["Nome Fantasia", "Fantasia", "Apelido", "N Fantasia"]),
                        email: email ? String(email).trim().toLowerCase() : null,
                        email_billing: getVal(row, ["E-mails Para Envio de Avisos Financeiros", "Email Financeiro", "Faturamento Email"]),
                        phone: getVal(row, ["Telefone", "Fone", "Fixo", "Tel"]),
                        mobile: getVal(row, ["Celular", "WhatsApp", "Zap", "Mobile", "WhatsApp/Celular"]),
                        document: document,
                        state_registration: getVal(row, ["Insc. Estadual", "IE", "Inscrição Estadual"]),
                        municipal_registration: getVal(row, ["Insc. Municipal", "IM", "Inscrição Municipal"]),
                        zip_code: getVal(row, ["CEP", "Zip", "Codigo Postal"]),
                        street: getVal(row, ["Rua", "Logradouro", "Endereço", "Address", "R"]),
                        number: getVal(row, ["Numero", "Número", "nº", "n", "Nro"]),
                        complement: getVal(row, ["Complemento", "Compl"]),
                        neighborhood: getVal(row, ["Bairro", "Distrito", "B"]),
                        city: getVal(row, ["Cidade", "City", "Mun"]),
                        state: getVal(row, ["UF", "Estado", "State", "Sigla"]),
                        profession: getVal(row, ["Profissão", "Cargo", "Ocupacao"]),
                        activity_segment: getVal(row, ["Ramo de Atividade", "Segmento", "Area"]),
                        revenue_bracket: getVal(row, ["Faturamento"]),
                        source: getVal(row, ["Origem", "Source"]),
                        registration_date: getVal(row, ["Data de Cadastro"]),
                        status: getVal(row, ["Cliente Ativo", "Status"]) === "Não" ? "inactive" : "active",
                    };

                    // Encontrar duplicata por Documento, Email ou Nome Normalizado
                    const normName = normalizeString(name);
                    const normTradeName = normalizeString(row["Nome Fantasia"]);

                    const existing = existingClients?.find(c => {
                        // 1. Match por Documento (Mais forte)
                        if (document && c.document?.replace(/[^\d]/g, "") === document) return true;

                        // 2. Match por Email
                        if (email && c.email?.toLowerCase() === email.toLowerCase()) return true;

                        // 3. Match por Nome Normalizado
                        if (normName && normalizeString(c.name) === normName) return true;

                        // 4. Match por Nome Fantasia Normalizado
                        if (normTradeName && c.trade_name && normalizeString(c.trade_name) === normTradeName) return true;

                        return false;
                    });

                    if (existing) {
                        toUpdate.push({
                            existing,
                            newData: clientData,
                            matchType: (document && existing.document?.replace(/[^\d]/g, "") === document) ? 'document' :
                                (email && existing.email?.toLowerCase() === email.toLowerCase()) ? 'email' : 'name'
                        });
                    } else {
                        toCreate.push(clientData);
                    }
                }

                setPreview({ toCreate, toUpdate, errors });
                setStep('preview');
            } catch (error: any) {
                console.error("Erro no processamento:", error);
                toast.error("Erro ao processar arquivo: " + error.message);
            } finally {
                setIsProcessing(false);
            }
        };

        reader.readAsArrayBuffer(file);
    };

    const confirmImport = async () => {
        if (!preview || !currentWorkspace?.id) return;
        setIsProcessing(true);

        try {
            // 1. Criar Novos
            if (preview.toCreate.length > 0) {
                const { error: createError } = await (supabase as any)
                    .from("clients")
                    .insert(preview.toCreate);
                if (createError) throw createError;
            }

            // 2. Atualizar Existentes
            for (const item of preview.toUpdate) {
                const { error: updateError } = await (supabase as any)
                    .from("clients")
                    .update(item.newData)
                    .eq("id", item.existing.id);
                if (updateError) {
                    console.error("Erro ao atualizar cliente:", item.existing.name, updateError);
                }
            }

            toast.success("Importação concluída com sucesso!");
            onImportSuccess();
            onOpenChange(false);
        } catch (error: any) {
            toast.error("Erro na importação: " + error.message);
        } finally {
            setIsProcessing(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className={step === 'preview' ? "max-w-4xl max-h-[90vh] overflow-y-auto" : "sm:max-w-[500px]"}>
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <FileSpreadsheet className="h-5 w-5 text-blue-600" />
                        {step === 'upload' ? "Importar Clientes" : "Confirmar Importação"}
                    </DialogTitle>
                    <DialogDescription>
                        {step === 'upload'
                            ? "Suba sua planilha de clientes. O sistema identificará duplicatas automaticamente por CPF/CNPJ ou Email."
                            : "Revise os dados antes de processar a importação."}
                    </DialogDescription>
                </DialogHeader>

                {step === 'upload' && (
                    <div className="space-y-6 py-4">
                        <div className="bg-blue-50 p-4 rounded-lg flex items-center justify-between border border-blue-100">
                            <div className="space-y-1">
                                <p className="text-sm font-medium text-blue-900">Planilha Modelo</p>
                                <p className="text-xs text-blue-700">Use nosso modelo para compatibilidade máxima.</p>
                            </div>
                            <Button variant="outline" size="sm" onClick={downloadTemplate} className="bg-white">
                                <Download className="mr-2 h-4 w-4" />
                                Baixar Modelo
                            </Button>
                        </div>

                        <div className="space-y-4">
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
                                        <p className="text-sm font-medium">Lendo arquivo...</p>
                                    </div>
                                ) : (
                                    <div className="flex flex-col items-center gap-2 text-center">
                                        <div className="p-3 rounded-full bg-primary/10 text-primary mb-2">
                                            <Upload className="h-6 w-6" />
                                        </div>
                                        <p className="text-sm font-semibold text-foreground">Clique ou arraste o arquivo aqui</p>
                                        <p className="text-xs text-muted-foreground">Suporta .XLSX, .XLS e .CSV (UTF-8)</p>
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4 text-xs text-muted-foreground">
                            <div className="space-y-1">
                                <p className="font-bold uppercase">Mapeamento Sugerido:</p>
                                <p>• CEP / Rua / Número</p>
                                <p>• Bairro / Complemento</p>
                                <p>• Razão Social / Nome</p>
                                <p>• Nome Fantasia</p>
                                <p>• Cnpj/CPF (Chave)</p>
                                <p>• Email (Chave secundária)</p>
                            </div>
                            <div className="space-y-1">
                                <p className="font-bold uppercase">Dados Adicionais:</p>
                                <p>• Inscrições Estadual/Mun.</p>
                                <p>• Perfil (Faturamento, Ramo)</p>
                                <p>• Contato (Celular, Telefone)</p>
                            </div>
                        </div>
                    </div>
                )}

                {step === 'preview' && preview && (
                    <div className="space-y-6 py-4">
                        <div className="grid grid-cols-3 gap-4">
                            <Card className="bg-green-50 border-green-100">
                                <CardContent className="pt-4 flex flex-col items-center">
                                    <UserPlus className="h-8 w-8 text-green-600 mb-2" />
                                    <span className="text-2xl font-bold text-green-700">{preview.toCreate.length}</span>
                                    <span className="text-xs text-green-600 font-medium">Novos Clientes</span>
                                </CardContent>
                            </Card>
                            <Card className="bg-blue-50 border-blue-100">
                                <CardContent className="pt-4 flex flex-col items-center">
                                    <RefreshCcw className="h-8 w-8 text-blue-600 mb-2" />
                                    <span className="text-2xl font-bold text-blue-700">{preview.toUpdate.length}</span>
                                    <span className="text-xs text-blue-600 font-medium">Serão Atualizados</span>
                                </CardContent>
                            </Card>
                            <Card className="bg-amber-50 border-amber-100">
                                <CardContent className="pt-4 flex flex-col items-center">
                                    <AlertCircle className="h-8 w-8 text-amber-600 mb-2" />
                                    <span className="text-2xl font-bold text-amber-700">{preview.errors.length}</span>
                                    <span className="text-xs text-amber-600 font-medium">Inconsistências</span>
                                </CardContent>
                            </Card>
                        </div>

                        <div className="space-y-2">
                            <h4 className="text-sm font-semibold flex items-center gap-2">
                                <TableIcon className="h-4 w-4" />
                                Amostra dos Dados
                            </h4>
                            <div className="border rounded-lg overflow-hidden max-h-[300px] overflow-y-auto">
                                <Table>
                                    <TableHeader className="bg-muted/50 sticky top-0">
                                        <TableRow>
                                            <TableHead>Ação</TableHead>
                                            <TableHead>Identificado por</TableHead>
                                            <TableHead>Nome</TableHead>
                                            <TableHead>Documento</TableHead>
                                            <TableHead>Email</TableHead>
                                            <TableHead>Cidade/UF</TableHead>
                                            <TableHead>Celular</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {/* Show few from create and few from update */}
                                        {preview.toCreate.slice(0, 10).map((c, i) => (
                                            <TableRow key={`c-${i}`}>
                                                <TableCell><Badge variant="secondary" className="bg-green-100 text-green-700">Criar</Badge></TableCell>
                                                <TableCell>-</TableCell>
                                                <TableCell className="font-medium max-w-[200px] truncate">{c.name}</TableCell>
                                                <TableCell className="text-[10px]">{c.document || '-'}</TableCell>
                                                <TableCell className="text-[10px] truncate max-w-[150px]">{c.email || '-'}</TableCell>
                                                <TableCell className="text-[10px]">{c.city ? `${c.city}/${c.state || ''}` : '-'}</TableCell>
                                                <TableCell className="text-[10px]">{c.mobile || '-'}</TableCell>
                                            </TableRow>
                                        ))}
                                        {preview.toUpdate.slice(0, 20).map((u, i) => (
                                            <TableRow key={`u-${i}`}>
                                                <TableCell><Badge variant="secondary" className="bg-blue-100 text-blue-700">Atualizar</Badge></TableCell>
                                                <TableCell>
                                                    <Badge variant="outline" className="text-[9px] uppercase">
                                                        {u.matchType === 'document' ? 'CPF/CNPJ' : u.matchType === 'email' ? 'Email' : 'Nome'}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell className="font-medium max-w-[200px] truncate">{u.newData.name}</TableCell>
                                                <TableCell className="text-[10px]">{u.newData.document || '-'}</TableCell>
                                                <TableCell className="text-[10px] truncate max-w-[150px]">{u.newData.email || '-'}</TableCell>
                                                <TableCell className="text-[10px]">{u.newData.city ? `${u.newData.city}/${u.newData.state || ''}` : '-'}</TableCell>
                                                <TableCell className="text-[10px]">{u.newData.mobile || '-'}</TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>
                        </div>

                        {preview.errors.length > 0 && (
                            <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-700 max-h-[100px] overflow-y-auto">
                                <p className="font-bold mb-1">Alertas:</p>
                                {preview.errors.map((err, i) => <p key={i}>• {err}</p>)}
                            </div>
                        )}
                    </div>
                )}

                <DialogFooter className="gap-2">
                    {step === 'preview' ? (
                        <>
                            <Button variant="ghost" onClick={() => setStep('upload')} disabled={isProcessing}>
                                Voltar
                            </Button>
                            <Button onClick={confirmImport} disabled={isProcessing} className="bg-blue-600 hover:bg-blue-700">
                                {isProcessing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                Confirmar e Importar {preview?.toCreate.length! + preview?.toUpdate.length!} Registros
                            </Button>
                        </>
                    ) : (
                        <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={isProcessing}>
                            Cancelar
                        </Button>
                    )}
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
