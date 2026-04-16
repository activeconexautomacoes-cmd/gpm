import { FileText, Sprout } from "lucide-react";

interface KbWizardProps {
  onChoice: (choice: "has_materials" | "from_scratch") => void;
}

export function KbWizard({ onChoice }: KbWizardProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center sm:p-4">
      <div className="w-full max-w-lg rounded-t-2xl bg-background p-5 shadow-xl sm:rounded-2xl sm:p-8">
        <div className="mb-5 text-center sm:mb-6">
          <h2 className="text-lg font-bold sm:text-xl">
            Vamos construir sua Base de Conhecimento
          </h2>
          <p className="mt-2 text-xs text-muted-foreground sm:text-sm">
            Documente os processos da agência para padronizar operações e
            consultar via IA.
          </p>
        </div>

        <p className="mb-3 text-center text-sm font-medium sm:mb-4">
          Como está a documentação da agência hoje?
        </p>

        <div className="flex flex-col gap-3">
          <button
            onClick={() => onChoice("has_materials")}
            className="flex items-start gap-3 rounded-xl border-2 border-border p-4 text-left transition-all hover:border-primary hover:bg-primary/5 active:bg-primary/5 sm:gap-4 sm:p-5"
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
              <FileText className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-sm font-semibold sm:text-base">
                Já tenho materiais
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground sm:mt-1 sm:text-sm">
                SOPs, playbooks, checklists, templates de processos.
              </p>
            </div>
          </button>

          <button
            onClick={() => onChoice("from_scratch")}
            className="flex items-start gap-3 rounded-xl border-2 border-border p-4 text-left transition-all hover:border-emerald-400 hover:bg-emerald-50 active:bg-emerald-50 dark:hover:bg-emerald-950 sm:gap-4 sm:p-5"
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-100 dark:bg-emerald-900">
              <Sprout className="h-5 w-5 text-emerald-600" />
            </div>
            <div>
              <p className="text-sm font-semibold sm:text-base">
                Estou começando do zero
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground sm:mt-1 sm:text-sm">
                Processos ainda não documentados. Vamos construir junto.
              </p>
            </div>
          </button>
        </div>

        <div className="h-[env(safe-area-inset-bottom)]" />
      </div>
    </div>
  );
}
