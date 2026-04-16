
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { ClientPerformanceMetric } from "@/types/operations";
import { Button } from "@/components/ui/button";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, TrendingUp } from "lucide-react";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";

interface ClientMetricsProps {
    clientId: string;
}

interface MetricFormData {
    period_start: string;
    period_end: string;
    spend: number;
    revenue: number;
    leads: number;
    clicks: number;
    impressions: number;
}

export function ClientMetrics({ clientId }: ClientMetricsProps) {
    const { currentWorkspace } = useWorkspace();
    const { toast } = useToast();
    const queryClient = useQueryClient();
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const { register, handleSubmit, reset } = useForm<MetricFormData>();

    const { data: metrics, isLoading } = useQuery({
        queryKey: ["client-metrics", clientId],
        queryFn: async () => {
            const { data, error } = await (supabase as any)
                .from("client_performance_metrics")
                .select("*")
                .eq("client_id", clientId)
                .order("period_end", { ascending: false });

            if (error) throw error;
            return data as ClientPerformanceMetric[];
        },
        enabled: !!clientId,
    });

    const mutation = useMutation({
        mutationFn: async (data: MetricFormData) => {
            if (!currentWorkspace?.id) throw new Error("No workspace");

            // Calculate derived metrics
            const roas = data.spend > 0 ? data.revenue / data.spend : 0;
            const cpl = data.leads > 0 ? data.spend / data.leads : 0;
            const ctr = data.impressions > 0 ? (data.clicks / data.impressions) * 100 : 0;

            const payload = {
                workspace_id: currentWorkspace.id,
                client_id: clientId,
                period_start: data.period_start,
                period_end: data.period_end,
                spend: Number(data.spend),
                revenue: Number(data.revenue),
                leads: Number(data.leads),
                clicks: Number(data.clicks),
                impressions: Number(data.impressions),
                roas,
                cpl,
                ctr
            };

            const { error } = await (supabase as any)
                .from("client_performance_metrics")
                .insert(payload);

            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["client-metrics", clientId] });
            toast({ title: "Métricas adicionadas com sucesso" });
            setIsDialogOpen(false);
            reset();
        },
        onError: (error) => {
            toast({
                variant: "destructive",
                title: "Erro ao salvar métricas",
                description: error.message
            });
        }
    });

    const onSubmit = (data: MetricFormData) => {
        mutation.mutate(data);
    };

    if (isLoading) return <div>Carregando métricas...</div>;

    return (
        <div className="space-y-4">
            <div className="flex justify-between items-center">
                <h3 className="text-lg font-medium flex items-center gap-2">
                    <TrendingUp className="h-5 w-5" />
                    Histórico de Performance
                </h3>
                <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                    <DialogTrigger asChild>
                        <Button size="sm">
                            <Plus className="mr-2 h-4 w-4" />
                            Adicionar Período
                        </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-md">
                        <DialogHeader>
                            <DialogTitle>Adicionar Métricas</DialogTitle>
                        </DialogHeader>
                        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label>Início do Período</Label>
                                    <Input type="date" {...register("period_start", { required: true })} />
                                </div>
                                <div className="space-y-2">
                                    <Label>Fim do Período</Label>
                                    <Input type="date" {...register("period_end", { required: true })} />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label>Investimento (R$)</Label>
                                    <Input type="number" step="0.01" {...register("spend", { required: true })} />
                                </div>
                                <div className="space-y-2">
                                    <Label>Receita (R$)</Label>
                                    <Input type="number" step="0.01" {...register("revenue", { required: true })} />
                                </div>
                            </div>

                            <div className="grid grid-cols-3 gap-4">
                                <div className="space-y-2">
                                    <Label>Leads</Label>
                                    <Input type="number" {...register("leads", { required: true })} />
                                </div>
                                <div className="space-y-2">
                                    <Label>Cliques</Label>
                                    <Input type="number" {...register("clicks", { required: true })} />
                                </div>
                                <div className="space-y-2">
                                    <Label>Impressões</Label>
                                    <Input type="number" {...register("impressions", { required: true })} />
                                </div>
                            </div>

                            <DialogFooter>
                                <Button type="submit" disabled={mutation.isPending}>
                                    {mutation.isPending ? "Salvando..." : "Salvar"}
                                </Button>
                            </DialogFooter>
                        </form>
                    </DialogContent>
                </Dialog>
            </div>

            <div className="rounded-md border">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Período</TableHead>
                            <TableHead>Investimento</TableHead>
                            <TableHead>Receita</TableHead>
                            <TableHead>ROAS</TableHead>
                            <TableHead>Leads</TableHead>
                            <TableHead>CPL</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {metrics?.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                                    Nenhum dado registrado.
                                </TableCell>
                            </TableRow>
                        ) : (
                            metrics?.map((metric) => (
                                <TableRow key={metric.id}>
                                    <TableCell>
                                        {format(new Date(metric.period_start), "dd/MM")} - {format(new Date(metric.period_end), "dd/MM/yy")}
                                    </TableCell>
                                    <TableCell>
                                        {metric.spend.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                                    </TableCell>
                                    <TableCell>
                                        {metric.revenue.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                                    </TableCell>
                                    <TableCell className={metric.roas >= 4 ? "text-green-600 font-medium" : ""}>
                                        {metric.roas.toFixed(2)}x
                                    </TableCell>
                                    <TableCell>{metric.leads}</TableCell>
                                    <TableCell>
                                        {metric.cpl.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </div>
        </div>
    );
}
