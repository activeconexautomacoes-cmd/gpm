
import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Calendar, CheckCircle2, AlertCircle, Clock, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";

const DAYS_OF_WEEK = [
    { id: 1, label: "Segunda-feira" },
    { id: 2, label: "Terça-feira" },
    { id: 3, label: "Quarta-feira" },
    { id: 4, label: "Quinta-feira" },
    { id: 5, label: "Sexta-feira" },
    { id: 6, label: "Sábado" },
    { id: 0, label: "Domingo" },
];

export function PersonalCalendarSettings() {
    const queryClient = useQueryClient();
    const [currentUser, setCurrentUser] = useState<any>(null);
    const [eventTitleTemplate, setEventTitleTemplate] = useState("Reunião CRM: {lead_name}");

    useEffect(() => {
        supabase.auth.getUser().then(({ data }) => setCurrentUser(data.user));

        const params = new URLSearchParams(window.location.search);
        if (params.get("google_connect") === "success") {
            toast.success("Google Calendar conectado com sucesso!");
            window.history.replaceState({}, document.title, window.location.pathname);
        }
    }, []);

    const { data: googleIntegration, isLoading: loadingIntegration } = useQuery({
        queryKey: ["integrations", "google"],
        queryFn: async () => {
            const { data, error } = await supabase
                .from("integrations")
                .select("*")
                .eq("user_id", (await supabase.auth.getUser()).data.user?.id)
                .eq("provider", "google")
                .maybeSingle();

            if (error) throw error;
            return data;
        },
        enabled: !!currentUser,
    });

    useEffect(() => {
        const settings = (googleIntegration as any)?.calendar_settings;
        if (settings?.event_title_template) {
            setEventTitleTemplate(settings.event_title_template);
        }
    }, [googleIntegration]);

    const { data: availability, isLoading: loadingAvailability } = useQuery({
        queryKey: ["availability"],
        queryFn: async () => {
            const { data, error } = await supabase
                .from("availability_schedules")
                .select("*")
                .eq("user_id", (await supabase.auth.getUser()).data.user?.id);

            if (error) throw error;
            return data || [];
        },
        enabled: !!currentUser,
    });

    const connectGoogle = async () => {
        try {
            const { data, error } = await supabase.functions.invoke("google-auth/connect", {
                headers: {
                    Authorization: `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`
                }
            });
            if (error) throw error;
            if (data?.url) {
                window.location.href = data.url;
            }
        } catch (error) {
            toast.error("Erro ao iniciar conexão: " + error.message);
        }
    };

    const disconnectGoogle = async () => {
        if (!googleIntegration) return;
        try {
            const { error } = await supabase.from("integrations").delete().eq("id", googleIntegration.id);
            if (error) throw error;
            toast.success("Desconectado com sucesso.");
            queryClient.invalidateQueries({ queryKey: ["integrations"] });
        } catch (error) {
            toast.error("Erro ao desconectar: " + error.message);
        }
    };

    const saveEventTitleTemplate = async () => {
        if (!googleIntegration) return;
        try {
            const { error } = await supabase
                .from("integrations")
                .update({
                    calendar_settings: {
                        ...((googleIntegration as any)?.calendar_settings || {}),
                        event_title_template: eventTitleTemplate
                    }
                } as any)
                .eq("id", googleIntegration.id);

            if (error) throw error;
            toast.success("Modelo de título atualizado!");
            queryClient.invalidateQueries({ queryKey: ["integrations"] });
        } catch (error) {
            toast.error("Erro ao salvar: " + error.message);
        }
    };

    const saveAvailability = async (dayId: number, startTime: string, endTime: string, isActive: boolean, startTime2: string | null = null, endTime2: string | null = null) => {
        try {
            const { error } = await supabase.from("availability_schedules").upsert({
                user_id: currentUser.id,
                day_of_week: dayId,
                start_time: startTime,
                end_time: endTime,
                start_time_2: startTime2 || null,
                end_time_2: endTime2 || null,
                is_active: isActive
            }, { onConflict: "user_id, day_of_week" });

            if (error) throw error;
            queryClient.invalidateQueries({ queryKey: ["availability"] });
            toast.success("Disponibilidade atualizada!");
        } catch (error) {
            toast.error("Erro ao salvar: " + error.message);
        }
    };

    return (
        <div className="space-y-6">
            <Card>
                <CardHeader>
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-blue-100 dark:bg-blue-900 rounded-lg">
                            <Calendar className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                        </div>
                        <div>
                            <CardTitle>Google Calendar (Pessoal)</CardTitle>
                            <CardDescription>Conecte sua agenda para sincronizar reuniões e verificar conflitos.</CardDescription>
                        </div>
                    </div>
                </CardHeader>
                <CardContent>
                    {loadingIntegration ? (
                        <p>Carregando...</p>
                    ) : googleIntegration ? (
                        <div className="flex items-center justify-between p-4 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-900">
                            <div className="flex items-center gap-3">
                                <CheckCircle2 className="w-5 h-5 text-green-600 dark:text-green-400" />
                                <div>
                                    <p className="font-medium text-green-900 dark:text-green-100">Conectado</p>
                                    <p className="text-sm text-green-700 dark:text-green-300">{googleIntegration.email}</p>
                                </div>
                            </div>
                            <Button variant="outline" size="sm" onClick={disconnectGoogle} className="text-red-600 hover:text-red-700 hover:bg-red-50">
                                Desconectar
                            </Button>
                        </div>
                    ) : (
                        <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg border">
                            <div className="flex items-center gap-3">
                                <AlertCircle className="w-5 h-5 text-gray-500" />
                                <p className="text-sm text-gray-600 dark:text-gray-400">Nenhuma conta conectada.</p>
                            </div>
                            <Button onClick={connectGoogle}>
                                Conectar Google Calendar
                            </Button>
                        </div>
                    )}
                </CardContent>
            </Card>

            {googleIntegration && (
                <Card>
                    <CardHeader>
                        <CardTitle className="text-sm font-bold uppercase tracking-wider">Configurações do Evento</CardTitle>
                        <CardDescription>Configure como o compromisso aparecerá no seu Google Agenda.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="space-y-2">
                            <Label>Nome do compromisso no Google Agenda</Label>
                            <Input
                                value={eventTitleTemplate}
                                onChange={(e) => setEventTitleTemplate(e.target.value)}
                                placeholder="Ex: Reunião GPM: {lead_name}"
                            />
                            <p className="text-[10px] text-muted-foreground p-2 bg-muted/50 rounded-lg">
                                Use variáveis para personalizar o título: <br />
                                <code className="bg-background px-1 rounded text-primary">{'{lead_name}'}</code> - Nome do Lead <br />
                                <code className="bg-background px-1 rounded text-primary">{'{lead_company}'}</code> - Empresa do Lead
                            </p>
                        </div>
                        <Button onClick={saveEventTitleTemplate} size="sm" className="bg-indigo-600 hover:bg-indigo-700">
                            Salvar Configuração
                        </Button>
                    </CardContent>
                </Card>
            )}

            <Card>
                <CardHeader>
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-blue-100 dark:bg-blue-900 rounded-lg">
                            <Clock className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                        </div>
                        <div>
                            <CardTitle>Disponibilidade Semanal</CardTitle>
                            <CardDescription>Defina seus horários de trabalho para receber agendamentos. Você pode definir até dois intervalos por dia.</CardDescription>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="space-y-4">
                    {loadingAvailability ? (
                        <p>Carregando disponibilidade...</p>
                    ) : (
                        <div className="grid gap-4">
                            {DAYS_OF_WEEK.map((day) => {
                                const schedule = availability?.find((s: any) => s.day_of_week === day.id);
                                const isActive = schedule?.is_active ?? (day.id >= 1 && day.id <= 5);
                                const startTime = schedule?.start_time?.slice(0, 5) ?? "09:00";
                                const endTime = schedule?.end_time?.slice(0, 5) ?? "17:00";
                                const startTime2 = schedule?.start_time_2?.slice(0, 5) ?? "";
                                const endTime2 = schedule?.end_time_2?.slice(0, 5) ?? "";

                                return (
                                    <div key={day.id} className="flex items-center justify-between p-3 rounded-lg border hover:bg-accent/5 transition-colors">
                                        <div className="flex items-center gap-4 w-40">
                                            <Switch
                                                checked={isActive}
                                                onCheckedChange={(checked) => saveAvailability(day.id, startTime, endTime, checked, startTime2 || null, endTime2 || null)}
                                            />
                                            <span className={`font-medium ${!isActive && "text-muted-foreground"}`}>{day.label}</span>
                                        </div>

                                        {isActive && (
                                            <div className="flex flex-col gap-2">
                                                <div className="flex items-center gap-2">
                                                    <Input
                                                        type="time"
                                                        value={startTime}
                                                        onChange={(e) => saveAvailability(day.id, e.target.value, endTime, isActive, startTime2 || null, endTime2 || null)}
                                                        className="w-28 h-8 text-xs"
                                                    />
                                                    <span className="text-muted-foreground">-</span>
                                                    <Input
                                                        type="time"
                                                        value={endTime}
                                                        onChange={(e) => saveAvailability(day.id, startTime, e.target.value, isActive, startTime2 || null, endTime2 || null)}
                                                        className="w-28 h-8 text-xs"
                                                    />
                                                </div>

                                                <div className="flex items-center gap-2">
                                                    <Input
                                                        type="time"
                                                        value={startTime2}
                                                        onChange={(e) => saveAvailability(day.id, startTime, endTime, isActive, e.target.value || null, endTime2 || null)}
                                                        className="w-28 h-8 text-xs"
                                                    />
                                                    <span className="text-muted-foreground">-</span>
                                                    <Input
                                                        type="time"
                                                        value={endTime2}
                                                        onChange={(e) => saveAvailability(day.id, startTime, endTime, isActive, startTime2 || null, e.target.value || null)}
                                                        className="w-28 h-8 text-xs"
                                                    />
                                                    {(startTime2 || endTime2) && (
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            className="h-6 w-6 text-destructive hover:text-destructive hover:bg-destructive/10"
                                                            onClick={() => saveAvailability(day.id, startTime, endTime, isActive, null, null)}
                                                        >
                                                            <Trash2 className="h-3 w-3" />
                                                        </Button>
                                                    )}
                                                </div>
                                            </div>
                                        )}
                                        <div className="w-20 text-right">
                                            {isActive ? <Badge variant="secondary" className="bg-green-100 text-green-800 hover:bg-green-100">Disponível</Badge> : <Badge variant="outline" className="text-muted-foreground">Fechado</Badge>}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
