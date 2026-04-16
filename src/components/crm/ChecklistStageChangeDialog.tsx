import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { AlertTriangle } from "lucide-react";

interface ChecklistStageChangeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pendingCount: number;
  onCancelPending: () => void;
  onKeepAll: () => void;
  isLoading?: boolean;
}

export function ChecklistStageChangeDialog({
  open,
  onOpenChange,
  pendingCount,
  onCancelPending,
  onKeepAll,
  isLoading,
}: ChecklistStageChangeDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-full bg-amber-500/10">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
            </div>
            <AlertDialogTitle>Tarefas pendentes encontradas</AlertDialogTitle>
          </div>
          <AlertDialogDescription className="pt-2">
            Existem <strong>{pendingCount}</strong> tarefa(s) pendente(s) da checklist do estágio anterior. O que deseja fazer?
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="flex-col sm:flex-row gap-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isLoading}
          >
            Voltar
          </Button>
          <Button
            variant="destructive"
            onClick={onCancelPending}
            disabled={isLoading}
          >
            {isLoading ? "Processando..." : "Cancelar pendentes"}
          </Button>
          <Button
            onClick={onKeepAll}
            disabled={isLoading}
          >
            {isLoading ? "Processando..." : "Manter todas"}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
