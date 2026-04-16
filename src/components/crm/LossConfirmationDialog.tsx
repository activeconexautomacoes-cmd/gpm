import React, { useState } from "react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

interface LossConfirmationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (reason: string, notes?: string) => void;
  isLoading?: boolean;
}

const lossReasonOptions = [
  { value: "high_price", label: "Preço muito alto" },
  { value: "competitor", label: "Escolheu concorrente" },
  { value: "bad_timing", label: "Timing inadequado" },
  { value: "no_budget", label: "Sem orçamento" },
  { value: "no_authority", label: "Sem autoridade/decisão" },
  { value: "no_need", label: "Sem necessidade" },
  { value: "no_response", label: "Sem resposta" },
  { value: "other", label: "Outro motivo" },
];

export function LossConfirmationDialog({
  open,
  onOpenChange,
  onConfirm,
  isLoading = false,
}: LossConfirmationDialogProps) {
  const [reason, setReason] = useState<string>("");
  const [notes, setNotes] = useState<string>("");

  const handleConfirm = () => {
    if (!reason) return;
    onConfirm(reason, notes || undefined);
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen && !isLoading) {
      setReason("");
      setNotes("");
    }
    onOpenChange(newOpen);
  };

  return (
    <AlertDialog open={open} onOpenChange={handleOpenChange}>
      <AlertDialogContent className="max-w-lg">
        <AlertDialogHeader>
          <AlertDialogTitle>Marcar Oportunidade como Perdida</AlertDialogTitle>
          <AlertDialogDescription>
            Registre o motivo da perda para análise futura e melhoria do processo de vendas.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="loss-reason">Motivo da Perda *</Label>
            <Select value={reason} onValueChange={setReason} disabled={isLoading}>
              <SelectTrigger id="loss-reason">
                <SelectValue placeholder="Selecione o motivo" />
              </SelectTrigger>
              <SelectContent>
                {lossReasonOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="loss-notes">Observações (opcional)</Label>
            <Textarea
              id="loss-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Adicione detalhes adicionais sobre a perda..."
              rows={4}
              disabled={isLoading}
            />
          </div>
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel disabled={isLoading}>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleConfirm}
            disabled={!reason || isLoading}
            className="bg-red-600 hover:bg-red-700"
          >
            {isLoading ? "Processando..." : "Confirmar Perda"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
