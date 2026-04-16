import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { User, Calendar, ExternalLink } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

interface ClientPanelHeaderProps {
  contract: any;
}

const ratingConfig: Record<string, { label: string; color: string; bgColor: string }> = {
  good: { label: "Bom", color: "text-green-400", bgColor: "bg-green-500/20 border-green-500/30" },
  medium: { label: "Medio", color: "text-yellow-400", bgColor: "bg-yellow-500/20 border-yellow-500/30" },
  bad: { label: "Ruim", color: "text-red-400", bgColor: "bg-red-500/20 border-red-500/30" },
};

export function ClientPanelHeader({ contract }: ClientPanelHeaderProps) {
  const rating = contract.performance_rating || "medium";
  const config = ratingConfig[rating] || ratingConfig.medium;

  return (
    <Card className="bg-card/60 backdrop-blur-md border-border/50">
      <CardContent className="pt-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <div>
            <h2 className="text-2xl font-bold tracking-tight">{contract.name}</h2>
            <p className="text-sm text-muted-foreground">{contract.clients?.name}</p>
          </div>
          <Badge variant="outline" className={cn("text-sm font-semibold px-3 py-1", config.bgColor, config.color)}>
            {config.label}
          </Badge>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {/* Gestor */}
          <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/30">
            <Avatar className="h-9 w-9">
              <AvatarImage src={contract.account_manager?.avatar_url} />
              <AvatarFallback><User className="h-4 w-4" /></AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Gestor</p>
              <p className="text-sm font-semibold truncate">{contract.account_manager?.full_name || "Sem gestor"}</p>
            </div>
          </div>

          {/* CS */}
          <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/30">
            <Avatar className="h-9 w-9">
              <AvatarImage src={contract.cs?.avatar_url} />
              <AvatarFallback><User className="h-4 w-4" /></AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">CS</p>
              <p className="text-sm font-semibold truncate">{contract.cs?.full_name || "Sem CS"}</p>
            </div>
          </div>

          {/* Data Entrada */}
          <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/30">
            <div className="flex items-center justify-center h-9 w-9 rounded-full bg-muted">
              <Calendar className="h-4 w-4 text-muted-foreground" />
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Entrada</p>
              <p className="text-sm font-semibold">
                {contract.start_date
                  ? format(new Date(contract.start_date), "dd MMM yyyy", { locale: ptBR })
                  : "-"}
              </p>
            </div>
          </div>

          {/* Link Drive */}
          <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/30">
            <div className="flex items-center justify-center h-9 w-9 rounded-full bg-muted">
              <ExternalLink className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Drive</p>
              {contract.drive_url ? (
                <a
                  href={contract.drive_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm font-semibold text-primary hover:underline truncate block"
                >
                  Abrir Drive
                </a>
              ) : (
                <p className="text-sm text-muted-foreground">-</p>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
