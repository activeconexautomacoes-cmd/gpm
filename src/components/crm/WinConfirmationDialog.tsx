import React, { useState, useRef, useEffect } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { AlertCircle, FileText, Check, Briefcase, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/contexts/WorkspaceContext";

interface WinConfirmationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  formValues: any;
  availableProducts?: any[];
  onConfirm: (data: { sendToD4Sign: boolean; d4signTemplateId: string }) => void;
  isLoading?: boolean;
}

const translatePeriod = (period: string, customMonths?: number): string => {
  switch (period) {
    case "monthly": return "Mensal";
    case "quarterly": return "Trimestral";
    case "semiannual": return "Semestral";
    case "annual": return "Anual";
    case "custom": return `${customMonths || 0} meses`;
    default: return period;
  }
};

export function WinConfirmationDialog({
  open,
  onOpenChange,
  formValues,
  availableProducts = [],
  onConfirm,
  isLoading = false,
}: WinConfirmationDialogProps) {
  const [isDataReviewed, setIsDataReviewed] = useState(false);
  const [sendToD4Sign, setSendToD4Sign] = useState(false);
  const [d4signTemplateId, setD4signTemplateId] = useState("");
  const [templates, setTemplates] = useState<any[]>([]);
  const [loadingTemplates, setLoadingTemplates] = useState(false);
  const { currentWorkspace } = useWorkspace();

  useEffect(() => {
    const fetchTemplates = async () => {
      if (sendToD4Sign && templates.length === 0 && currentWorkspace?.id) {
        setLoadingTemplates(true);
        try {
          const { data, error } = await supabase.functions.invoke("d4sign-integration", {
            body: { action: "list-templates", workspaceId: currentWorkspace.id }
          });
          if (error) {
            toast.error(`Erro ao carregar templates: ${error.message}`);
            throw error;
          }

          let list = [];
          if (Array.isArray(data)) {
            list = data;
          } else if (data && typeof data === 'object') {
            list = data.templates || data;
          }

          if (Array.isArray(list)) {
            setTemplates(list);
            if (list.length === 0) {
              toast.info("Nenhum modelo de contrato encontrado no D4Sign.");
            }
          } else if (data?.error) {
            toast.error(`D4Sign: ${data.error}`);
          }
        } catch (error: any) {
          console.error("Erro ao carregar templates D4Sign:", error);
          toast.error("Não foi possível carregar os modelos da D4Sign. Verifique suas credenciais em Configurações.");
        } finally {
          setLoadingTemplates(false);
        }
      }
    };

    fetchTemplates();
  }, [sendToD4Sign, currentWorkspace?.id, templates.length]);

  const missingFields: string[] = [];
  const products = formValues?.products || [];
  const firstProd = products[0];

  if (!formValues?.negotiated_value || Number(formValues.negotiated_value) <= 0) {
    missingFields.push("Valor Negociado");
  }
  if (products.length === 0) {
    missingFields.push("Produto");
  }
  if (!firstProd?.contract_duration) {
    missingFields.push("Duração do Contrato");
  }
  if (!firstProd?.billing_day) {
    missingFields.push("Dia de Vencimento");
  }

  const canConvert = missingFields.length === 0;

  const handleConfirm = () => {
    onConfirm({ sendToD4Sign, d4signTemplateId });
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <Check className="w-5 h-5 text-emerald-500" /> Confirmar Venda Ganha
          </AlertDialogTitle>
          <AlertDialogDescription>
            Esta ação irá criar automaticamente um Cliente e um Contrato com a primeira cobrança agendada.
          </AlertDialogDescription>
        </AlertDialogHeader>

        {!canConvert && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Campos obrigatórios faltando</AlertTitle>
            <AlertDescription>
              <ul className="list-disc pl-5 mt-2">
                {missingFields.map((field) => (
                  <li key={field}>{field}</li>
                ))}
              </ul>
              <p className="mt-2">
                Por favor, preencha todos os campos obrigatórios na aba de Negociação antes de marcar como Ganho.
              </p>
            </AlertDescription>
          </Alert>
        )}

        {canConvert && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <Card className="border-slate-100 shadow-none bg-slate-50/50">
                <CardHeader className="p-3 border-b bg-white/50">
                  <CardTitle className="text-[10px] uppercase tracking-widest text-slate-400 font-black">Dados do Cliente</CardTitle>
                </CardHeader>
                <CardContent className="p-3 space-y-1.5 text-xs text-slate-600">
                  <div className="flex justify-between"><strong>Nome:</strong> <span className="text-slate-900 font-bold">{formValues.lead_name}</span></div>
                  <div className="flex justify-between"><strong>Empresa:</strong> <span>{formValues.lead_company || "N/A"}</span></div>
                  <div className="flex justify-between"><strong>Telefone:</strong> <span>{formValues.lead_phone}</span></div>
                </CardContent>
              </Card>

              <Card className="border-slate-100 shadow-none bg-slate-50/50">
                <CardHeader className="p-3 border-b bg-white/50">
                  <CardTitle className="text-[10px] uppercase tracking-widest text-slate-400 font-black">Resumo do Contrato</CardTitle>
                </CardHeader>
                <CardContent className="p-3 space-y-1.5 text-xs text-slate-600">
                  <div className="flex justify-between"><strong>Valor Total:</strong> <span className="text-indigo-600 font-black">R$ {Number(formValues.negotiated_value).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span></div>
                  <div className="flex justify-between"><strong>Duração:</strong> <span>{translatePeriod(firstProd?.contract_duration, firstProd?.contract_custom_duration ? parseInt(firstProd.contract_custom_duration) : undefined)}</span></div>
                  <div className="flex justify-between"><strong>Dia Venc.:</strong> <span>{firstProd?.billing_day}</span></div>
                </CardContent>
              </Card>
            </div>

            <Card className="border-slate-100 shadow-none">
              <CardHeader className="p-3 border-b bg-slate-50/50">
                <CardTitle className="text-[10px] uppercase tracking-widest text-slate-400 font-black">Detalhamento dos Itens</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="divide-slate-100 divide-y">
                  {products.map((p: any, idx: number) => (
                    <div key={idx} className="p-3 flex items-start justify-between bg-white text-xs">
                      <div className="space-y-1 flex-1">
                        <div className="font-bold text-slate-800 flex items-center gap-1.5 uppercase tracking-tight">
                          <Briefcase className="w-3 h-3 text-indigo-500" /> {availableProducts.find(ap => ap.id === p.product_id)?.name || p.product_id}
                        </div>
                        <div className="flex items-center gap-3 text-slate-500">
                          <span className="flex items-center gap-1">Recorrência: <strong className="text-slate-700">R$ {Number(p.negotiated_price).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</strong></span>
                          {Number(p.negotiated_implementation_fee) > 0 && (
                            <span className="flex items-center gap-1">Implementação: <strong className="text-emerald-600">R$ {Number(p.negotiated_implementation_fee).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</strong></span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card className="border-indigo-100 shadow-none bg-indigo-50/20">
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <Checkbox
                    id="review-check"
                    checked={isDataReviewed}
                    onCheckedChange={(checked) => setIsDataReviewed(checked === true)}
                    className="mt-1"
                  />
                  <div className="grid gap-1.5 leading-none">
                    <Label htmlFor="review-check" className="text-xs font-bold text-slate-700 cursor-pointer">
                      Revisão dos Dados da Negociação
                    </Label>
                    <p className="text-[10px] text-slate-500">
                      Confirmo que revisei os produtos, valores e condições de pagamento e que estão corretos conforme o combinado com o cliente.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>


            <div className="space-y-3 p-4 border rounded-xl bg-white border-slate-200">
              <h4 className="text-xs font-black uppercase tracking-tight text-slate-800 flex items-center gap-2">
                <FileText className="w-3.5 h-3.5 text-orange-500" /> Assinatura de Contrato (D4Sign)
              </h4>

              <div className="flex items-center space-x-2 pt-1">
                <Checkbox
                  id="send-d4sign"
                  checked={sendToD4Sign}
                  onCheckedChange={(checked) => setSendToD4Sign(checked === true)}
                />
                <Label htmlFor="send-d4sign" className="text-xs font-bold text-slate-600 cursor-pointer">
                  Enviar automaticamente para assinatura eletrônica
                </Label>
              </div>

              {sendToD4Sign && (
                <div className="mt-4 space-y-2 animate-in fade-in slide-in-from-top-1">
                  <Label className="text-[10px] font-black uppercase text-slate-400">Modelo de Contrato (D4Sign)</Label>
                  {loadingTemplates ? (
                    <div className="flex items-center gap-2 text-xs text-slate-500 py-2">
                      <Loader2 className="w-3 h-3 animate-spin" /> Carregando modelos...
                    </div>
                  ) : (
                    <Select value={d4signTemplateId} onValueChange={setD4signTemplateId}>
                      <SelectTrigger className="h-8 text-xs bg-white">
                        <SelectValue placeholder="Selecione um modelo..." />
                      </SelectTrigger>
                      <SelectContent>
                        {templates.map((t) => (
                          <SelectItem key={t.id_template || t.id} value={t.id_template || t.id}>
                            {t.name_template || t.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                  <p className="text-[9px] text-slate-500 italic">O documento será gerado e enviado por e-mail para o tomador.</p>
                </div>
              )}
            </div>
          </div>
        )}

        <AlertDialogFooter>
          <AlertDialogCancel disabled={isLoading}>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault();
              handleConfirm();
            }}
            disabled={!canConvert || !isDataReviewed || isLoading}
            className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
          >
            {isLoading ? "Processando..." : "Confirmar e Criar Cliente/Contrato"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
