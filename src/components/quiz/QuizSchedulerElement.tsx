import { useState, useEffect } from "react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Calendar } from "@/components/ui/calendar";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, ChevronRight, Check, Calendar as CalendarIcon, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Label } from "@/components/ui/label";

interface QuizSchedulerElementProps {
    element: any;
    value: any;
    onChange: (value: any) => void;
    onAdvance: () => void;
    elementValues: Record<string, any>;
    quizData: any;
}

export function QuizSchedulerElement({
    element,
    value,
    onChange,
    onAdvance,
    elementValues,
    quizData
}: QuizSchedulerElementProps) {
    const [date, setDate] = useState<Date | undefined>(new Date());
    const [selectedSlot, setSelectedSlot] = useState<any>(value?.slot || null);
    const [bookingData, setBookingData] = useState<any>(value?.booking || null);

    // Find closer IDs from element content
    const closerIds = element.content.closerIds || (element.content.closerId ? [element.content.closerId] : []);
    const hasCloser = closerIds.length > 0;

    // Find lead email from previous answers
    // We look for an element of type 'email' or with 'lead_email' mapping
    const findLeadEmail = () => {
        // 1. Check for mapped field
        // This is complex as mapping is done in QuizPlayer state or backend.
        // QuizPlayer treats answers as elementId -> value.
        // We iterate over quiz questions -> elements to find type 'email'
        if (!quizData) return null;

        for (const q of quizData.questions) {
            for (const el of q.elements) {
                if (el.type === 'email' || (el.content && el.content.mapping === 'lead_email')) {
                    if (elementValues[el.id]) {
                        return elementValues[el.id];
                    }
                }
            }
        }
        return null;
    };

    const leadEmail = findLeadEmail();

    // Query for slots
    const { data: slotsData, isLoading: isLoadingSlots, error: slotsError, refetch: refetchSlots } = useQuery({
        queryKey: ['scheduler-slots', closerIds.join(','), date ? format(date, 'yyyy-MM-dd') : null],
        queryFn: async () => {
            if (!hasCloser || !date) return { slots: [] };

            const { data, error } = await supabase.functions.invoke('google-calendar', {
                body: {
                    action: 'get-slots',
                    closer_ids: closerIds, // Pass the array
                    date: format(date, 'yyyy-MM-dd'),
                    duration_minutes: element.content.duration || 30,
                    find_nearest: true
                }
            });

            if (data?.error?.includes("connected")) {
                // Fallback for single closer case to keep old behavior if needed, 
                // but usually the function should handle the array.
            }

            if (error) {
                console.error("Function error:", error);
                throw error;
            }
            if (data.error) {
                throw new Error(data.error);
            }
            return data;
        },
        enabled: hasCloser && !!date,
        retry: 1
    });

    const slots = slotsData?.slots || [];

    useEffect(() => {
        if (slotsData?.date && date) {
            const newDate = parseISO(slotsData.date);
            if (format(newDate, 'yyyy-MM-dd') !== format(date, 'yyyy-MM-dd')) {
                setDate(newDate);
            }
        }
    }, [slotsData, date]);

    // Mutation for booking
    const bookMutation = useMutation({
        mutationFn: async (slot: any) => {
            if (!hasCloser || !leadEmail) throw new Error("Missing info");

            const { data, error } = await supabase.functions.invoke('google-calendar', {
                body: {
                    action: 'create-booking',
                    closer_ids: closerIds, // Pass all possible closers, backend will pick one
                    start_time: slot.start,
                    end_time: slot.end,
                    lead_email: leadEmail,
                    summary: `Reunião Quiz - ${element.content.description || 'Consulta'}`
                }
            });

            if (error) throw error;
            if (data.error) throw new Error(data.error);

            return data;
        },
        onSuccess: (data) => {
            toast.success("Agendamento realizado com sucesso!");
            setBookingData(data);
            onChange({
                slot: selectedSlot,
                booking: data
            });
            // Auto advance after short delay
            setTimeout(() => {
                onAdvance();
            }, 1500);
        },
        onError: (err) => {
            console.error(err);
            toast.error("Erro ao agendar: " + err.message);
        }
    });

    const handleSlotClick = (slot: any) => {
        setSelectedSlot(slot);

        if (leadEmail) {
            // Initiate booking confirmation or direct booking?
            // For now, let's just select. The user must click "Confirmar" or we auto-book.
            // Let's use a "Confirmar Horário" button pattern for safety.
        } else {
            // Just save the slot locally
            onChange({ slot });
            toast.info("Horário selecionado. Preencha seus dados para confirmar.");
        }
    };

    const handleConfirm = () => {
        if (!selectedSlot) return;
        if (!leadEmail) {
            toast.error("Email não encontrado. Por favor preencha seus dados de contato antes de agendar.");
            return;
        }
        bookMutation.mutate(selectedSlot);
    };

    if (!hasCloser) {
        return <div className="p-4 border border-red-200 bg-red-50 rounded text-red-600">Erro: Agendamento não configurado (Falta Closer).</div>;
    }

    if (bookingData) {
        return (
            <div className="flex flex-col items-center justify-center p-8 space-y-4 bg-green-50 border border-green-200 rounded-2xl animate-in fade-in zoom-in duration-500">
                <div className="h-16 w-16 bg-green-500 rounded-full flex items-center justify-center text-white shadow-lg">
                    <Check className="h-8 w-8" />
                </div>
                <h3 className="text-xl font-bold text-green-800">Agendado!</h3>
                <p className="text-green-700 text-center">
                    {format(new Date(selectedSlot.start), "dd 'de' MMMM 'às' HH:mm", { locale: ptBR })}
                </p>
                {bookingData.meetLink && (
                    <Button variant="outline" className="mt-2 bg-white" onClick={() => window.open(bookingData.meetLink, '_blank')}>
                        Participar da Reunião
                    </Button>
                )}
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {element.content.description && (
                <div className="text-center space-y-2">
                    <Label className="text-lg font-bold text-slate-800 whitespace-pre-wrap">{element.content.description}</Label>
                </div>
            )}

            <div className="flex flex-col md:flex-row gap-6 items-start justify-center">
                <div className="w-full md:w-auto p-4 bg-white border rounded-2xl shadow-sm">
                    <Calendar
                        mode="single"
                        selected={date}
                        onSelect={setDate}
                        locale={ptBR}
                        className="rounded-md mx-auto"
                        disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0)) || date.getDay() === 0 || date.getDay() === 6} // Basic disable past/weekends (backend handles real schedule)
                    />
                </div>

                <div className="w-full md:w-64 space-y-4">
                    <div className="font-medium text-slate-700 flex items-center gap-2">
                        <Clock className="w-4 h-4" />
                        Horários Disponíveis
                    </div>

                    {isLoadingSlots ? (
                        <div className="flex items-center justify-center h-40">
                            <Loader2 className="h-8 w-8 animate-spin text-primary" />
                        </div>
                    ) : slotsError ? (
                        <div className="p-3 text-xs text-red-500 bg-red-50 rounded-lg">
                            Erro ao carregar horários. Tente novamente.
                            <Button variant="link" size="sm" onClick={() => refetchSlots()} className="h-auto p-0 ml-1">Recarregar</Button>
                        </div>
                    ) : slots.length === 0 ? (
                        <div className="p-4 text-sm text-slate-500 bg-slate-50 rounded-lg text-center">
                            Nenhum horário disponível para esta data.
                        </div>
                    ) : (
                        <div className="grid grid-cols-2 gap-2 max-h-[300px] overflow-y-auto pr-1">
                            {slots.map((slot: any, idx: number) => {
                                const isSelected = selectedSlot?.start === slot.start;
                                const startTime = format(new Date(slot.start), 'HH:mm');
                                return (
                                    <Button
                                        key={idx}
                                        variant={isSelected ? "default" : "outline"}
                                        className={cn(
                                            "w-full transition-all",
                                            isSelected ? "ring-2 ring-primary ring-offset-2" : "hover:border-primary/50"
                                        )}
                                        onClick={() => handleSlotClick(slot)}
                                    >
                                        {startTime}
                                    </Button>
                                )
                            })}
                        </div>
                    )}
                </div>
            </div>

            {selectedSlot && !bookingData && (
                <div className="fixed bottom-0 left-0 right-0 p-4 bg-white/80 backdrop-blur-md border-t z-50 flex justify-center animate-in slide-in-from-bottom-5">
                    <Button
                        size="lg"
                        className="w-full max-w-md shadow-xl text-lg h-14 rounded-2xl"
                        onClick={handleConfirm}
                        disabled={bookMutation.isPending}
                    >
                        {bookMutation.isPending ? (
                            <>
                                <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Agendando...
                            </>
                        ) : (
                            <>
                                Confirmar Agendamento <ChevronRight className="ml-2 h-5 w-5" />
                            </>
                        )}
                    </Button>
                </div>
            )}
        </div>
    );
}
