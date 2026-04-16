import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface MetricsCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  trend?: "up" | "down" | "neutral";
  trendValue?: string;
  loading?: boolean;
  description?: string;
  variant?: "default" | "primary" | "secondary" | "success" | "warning" | "destructive";
}

export function MetricsCard({
  title,
  value,
  icon: Icon,
  trend,
  trendValue,
  loading,
  description,
  variant = "default",
}: MetricsCardProps) {
  const trendColors = {
    up: "text-emerald-600 bg-emerald-500/10 dark:text-emerald-400 dark:bg-emerald-500/20",
    down: "text-rose-600 bg-rose-500/10 dark:text-rose-400 dark:bg-rose-500/20",
    neutral: "text-slate-600 bg-slate-500/10 dark:text-slate-400 dark:bg-slate-500/20",
  };

  const trendSymbols = {
    up: "↑",
    down: "↓",
    neutral: "→",
  };

  const variants = {
    default: "bg-white/40 dark:bg-black/40 backdrop-blur-md border-white/20 dark:border-white/10 shadow-sm",
    primary: "bg-primary/5 dark:bg-primary/10 backdrop-blur-md border-primary/20 dark:border-primary/20",
    secondary: "bg-indigo-500/5 dark:bg-indigo-500/10 backdrop-blur-md border-indigo-500/20 dark:border-indigo-500/20",
    success: "bg-emerald-500/5 dark:bg-emerald-500/10 backdrop-blur-md border-emerald-500/20 dark:border-emerald-500/20",
    warning: "bg-amber-500/5 dark:bg-amber-500/10 backdrop-blur-md border-amber-500/20 dark:border-amber-500/20",
    destructive: "bg-rose-500/5 dark:bg-rose-500/10 backdrop-blur-md border-rose-500/20 dark:border-rose-500/20",
  };

  const iconColors = {
    default: "text-primary bg-primary/10 border-primary/20",
    primary: "text-primary bg-primary/20 border-primary/30",
    secondary: "text-indigo-600 dark:text-indigo-400 bg-indigo-500/10 border-indigo-500/20",
    success: "text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
    warning: "text-amber-600 dark:text-amber-400 bg-amber-500/10 border-amber-500/20",
    destructive: "text-rose-600 dark:text-rose-400 bg-rose-500/10 border-rose-500/20",
  };

  return (
    <Card className={cn(
      "group relative overflow-hidden transition-all duration-300 hover:shadow-2xl hover:-translate-y-1.5 border antialiased",
      variants[variant]
    )}>
      {/* Glossy overlay effect */}
      <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-white/10 dark:from-white/5 to-transparent pointer-events-none" />

      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3 pt-5 px-6">
        <CardTitle className="text-[11px] font-black uppercase tracking-[0.15em] text-muted-foreground/70 dark:text-white/50 group-hover:text-primary transition-colors duration-300">
          {title}
        </CardTitle>
        <div className={cn(
          "p-2.5 rounded-xl border transition-all duration-300 group-hover:scale-110 shadow-sm",
          iconColors[variant]
        )}>
          <Icon className="h-4 w-4" />
        </div>
      </CardHeader>

      <CardContent className="px-6 pb-6">
        {loading ? (
          <Skeleton className="h-10 w-28 rounded-lg" />
        ) : (
          <div className="space-y-2">
            <div className="text-3xl font-black tracking-tight font-fira-code text-foreground dark:text-white selection:bg-primary selection:text-white">
              {value}
            </div>

            <div className="flex items-center gap-2.5">
              {trend && trendValue && (
                <div className={cn(
                  "text-[10px] font-black px-2 py-0.5 rounded-lg flex items-center gap-0.5 border border-current/10 shadow-inner uppercase tracking-wider",
                  trendColors[trend]
                )}>
                  <span>{trendSymbols[trend]}</span>
                  <span>{trendValue}</span>
                </div>
              )}
              {description && (
                <p className="text-[10px] font-bold text-muted-foreground/60 dark:text-white/40 uppercase tracking-tight line-clamp-1 italic">
                  {description}
                </p>
              )}
            </div>
          </div>
        )}
      </CardContent>

      <div className="absolute bottom-0 left-0 h-1 w-0 bg-primary group-hover:w-full transition-all duration-500" />
    </Card>
  );
}
