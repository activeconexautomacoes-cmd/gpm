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
import { AlertCircle } from "lucide-react";

interface StageDeleteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  stage: any;
  opportunityCount: number;
  onConfirm: () => void;
  isLoading: boolean;
}

export function StageDeleteDialog({
  open,
  onOpenChange,
  stage,
  opportunityCount,
  onConfirm,
  isLoading,
}: StageDeleteDialogProps) {
  const canDelete = opportunityCount === 0;

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Deletar Estágio</AlertDialogTitle>
          <AlertDialogDescription>
            Você tem certeza que deseja deletar o estágio "{stage?.name}"?
          </AlertDialogDescription>
        </AlertDialogHeader>

        {!canDelete && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Não é possível deletar</AlertTitle>
            <AlertDescription>
              Este estágio contém {opportunityCount} oportunidade(s). Mova ou delete as oportunidades antes de
              deletar o estágio.
            </AlertDescription>
          </Alert>
        )}

        {canDelete && (
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>Esta ação não pode ser desfeita.</AlertDescription>
          </Alert>
        )}

        <AlertDialogFooter>
          <AlertDialogCancel disabled={isLoading}>Cancelar</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm} disabled={!canDelete || isLoading} className="bg-destructive hover:bg-destructive/90">
            {isLoading ? "Deletando..." : "Deletar Estágio"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
