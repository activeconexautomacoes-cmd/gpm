import React, { useState, useMemo } from "react";
import {
    format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval,
    addMonths, subMonths, isSameMonth, isSameDay, isToday, parseISO,
    startOfDay, endOfDay, addDays, subDays, startOfYear, endOfYear, eachMonthOfInterval,
    getHours, getMinutes, differenceInMinutes
} from "date-fns";
import { ptBR } from "date-fns/locale";
import { ChevronLeft, ChevronRight, Loader2, Calendar as CalendarIcon, Clock, User, Users } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";

interface CRMCalendarProps {
    onOpportunityClick: (opportunity: any) => void;
}

type CalendarViewType = 'day' | 'week' | 'month' | 'year' | 'agenda' | '4days';

export function CRMCalendar({ onOpportunityClick }: CRMCalendarProps) {
    const { currentWorkspace, user } = useWorkspace();
    const [currentDate, setCurrentDate] = useState(new Date());
    const [view, setView] = useState<CalendarViewType>('month');
    const [showPersonalEvents, setShowPersonalEvents] = useState(true);
    const [selectedCloserId, setSelectedCloserId] = useState<string>(user?.id || "");

    const isManager = ['owner', 'admin', 'sales_manager'].includes(currentWorkspace?.role || '');

    // Fetch members who are closers or have calendar integrated
    const { data: closers = [] } = useQuery({
        queryKey: ["workspace-closers-calendar", currentWorkspace?.id],
        queryFn: async () => {
            if (!currentWorkspace?.id) return [];
            const { data, error } = await supabase
                .from("workspace_members")
                .select(`
                    role,
                    profiles (
                        id,
                        full_name,
                        email,
                        has_google_calendar
                    )
                `)
                .eq("workspace_id", currentWorkspace.id);

            if (error) throw error;

            return data?.filter((m: any) => {
                const profile = Array.isArray(m.profiles) ? m.profiles[0] : m.profiles;
                return (profile as any)?.has_google_calendar;
            }) || [];
        },
        enabled: !!currentWorkspace?.id && isManager,
    });

    // Calculate range based on View
    const { startDate, endDate } = useMemo(() => {
        switch (view) {
            case 'month':
                return {
                    startDate: startOfWeek(startOfMonth(currentDate)),
                    endDate: endOfWeek(endOfMonth(currentDate))
                };
            case 'week':
                return {
                    startDate: startOfWeek(currentDate),
                    endDate: endOfWeek(currentDate)
                };
            case 'day':
                return {
                    startDate: startOfDay(currentDate),
                    endDate: endOfDay(currentDate)
                };
            case '4days':
                return {
                    startDate: startOfDay(currentDate),
                    endDate: endOfDay(addDays(currentDate, 3))
                };
            case 'year':
                return {
                    startDate: startOfYear(currentDate),
                    endDate: endOfYear(currentDate)
                };
            case 'agenda':
                return {
                    startDate: startOfDay(currentDate),
                    endDate: endOfDay(addDays(currentDate, 4))
                };
            default:
                return {
                    startDate: startOfWeek(startOfMonth(currentDate)),
                    endDate: endOfWeek(endOfMonth(currentDate))
                };
        }
    }, [currentDate, view]);

    // Fetch bookings
    const { data: bookings = [], isLoading: isLoadingBookings } = useQuery({
        queryKey: ["crm-calendar-bookings", currentWorkspace?.id, view, format(startDate, "yyyy-MM-dd"), format(endDate, "yyyy-MM-dd"), selectedCloserId],
        queryFn: async () => {
            if (!currentWorkspace?.id) return [];

            let query = supabase
                .from("bookings")
                .select(`
                    *,
                    opportunity:opportunities!bookings_opportunity_id_fkey(
                        id,
                        lead_name,
                        lead_company,
                        lead_email,
                        lead_phone,
                        estimated_value,
                        current_stage_id,
                        assigned_closer,
                        assigned_sdr,
                        created_at,
                        custom_fields,
                        workspace_id
                    ),
                    closer:profiles!bookings_closer_id_fkey(
                        id,
                        full_name,
                        email,
                        avatar_url
                    )
                `)
                .eq("opportunity.workspace_id", currentWorkspace.id);

            if (selectedCloserId && selectedCloserId !== "all") {
                query = query.eq("closer_id", selectedCloserId);
            }

            const { data, error } = await query
                .gte("start_time", startDate.toISOString())
                .lte("start_time", endDate.toISOString())
                .order("start_time", { ascending: true });

            if (error) {
                console.error("Error fetching bookings:", error);
                throw error;
            }
            return data || [];
        },
        enabled: !!currentWorkspace?.id,
    });

    // Fetch Google Calendar Events
    const { data: googleEvents = [], isLoading: isLoadingGoogle } = useQuery({
        queryKey: ["google-calendar-events", selectedCloserId, view, format(startDate, "yyyy-MM-dd"), format(endDate, "yyyy-MM-dd")],
        queryFn: async () => {
            if (!selectedCloserId || selectedCloserId === "all") return [];

            const { data, error } = await supabase.functions.invoke('google-calendar', {
                body: {
                    action: 'list-events',
                    closer_id: selectedCloserId,
                    start_time: startDate.toISOString(),
                    end_time: endDate.toISOString()
                }
            });

            if (error) {
                console.error("Function error:", error);
                return [];
            }
            return data.events || [];
        },
        enabled: !!selectedCloserId && selectedCloserId !== "all" && showPersonalEvents,
    });

    // Navigation handlers
    const navigate = (direction: 'prev' | 'next' | 'today') => {
        if (direction === 'today') {
            setCurrentDate(new Date());
            return;
        }

        const amount = direction === 'next' ? 1 : -1;

        switch (view) {
            case 'month': setCurrentDate(addMonths(currentDate, amount)); break;
            case 'week': setCurrentDate(addDays(currentDate, amount * 7)); break;
            case 'day': setCurrentDate(addDays(currentDate, amount)); break;
            case '4days': setCurrentDate(addDays(currentDate, amount * 4)); break;
            case 'year': setCurrentDate(cur => new Date(new Date(cur).setFullYear(cur.getFullYear() + amount))); break;
            case 'agenda': setCurrentDate(addDays(currentDate, amount * 5)); break;
        }
    };

    const isLoading = isLoadingBookings || isLoadingGoogle;

    const renderView = () => {
        const eventsProps = {
            bookings,
            googleEvents: showPersonalEvents ? googleEvents : [],
            onOpportunityClick
        };

        switch (view) {
            case 'day':
            case 'week':
            case '4days':
                return <TimeGridView
                    view={view}
                    currentDate={currentDate}
                    startDate={startDate}
                    endDate={endDate}
                    {...eventsProps}
                />;
            case 'month':
                return <MonthView
                    currentDate={currentDate}
                    startDate={startDate}
                    endDate={endDate}
                    {...eventsProps}
                />;
            case 'year':
                return <YearView
                    currentDate={currentDate}
                    {...eventsProps}
                    onMonthClick={(date: Date) => { setCurrentDate(date); setView('month'); }}
                />;
            case 'agenda':
                return <AgendaView
                    currentDate={currentDate}
                    {...eventsProps}
                />;
            default:
                return null;
        }
    };

    return (
        <div className="flex flex-col h-full bg-white/40 dark:bg-black/20 backdrop-blur-xl rounded-[32px] border border-white/60 dark:border-white/5 shadow-2xl overflow-hidden animate-in fade-in duration-700">
            {/* Header */}
            <div className="flex flex-wrap items-center justify-between px-8 py-6 border-b border-white/40 dark:border-white/5 bg-white/20 dark:bg-white/[0.02] gap-6">
                <div className="flex items-center gap-6">
                    <div className="flex items-center gap-3">
                        <h2 className="text-xl font-black text-[#1D4ED8] dark:text-white uppercase tracking-[0.2em] leading-none">
                            {format(currentDate, view === 'year' ? "yyyy" : "MMMM yyyy", { locale: ptBR })}
                        </h2>
                    </div>
                    <div className="flex items-center bg-white/60 dark:bg-white/5 p-1 rounded-2xl border border-white/60 dark:border-white/5 shadow-inner">
                        <Button variant="ghost" size="icon" className="h-8 w-8 rounded-xl hover:bg-[#3B82F6]/10 dark:hover:bg-white/10" onClick={() => navigate('prev')}>
                            <ChevronLeft className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="sm" className="h-8 px-4 text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-[#3B82F6]/10 dark:hover:bg-white/10" onClick={() => navigate('today')}>
                            Hoje
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 rounded-xl hover:bg-[#3B82F6]/10 dark:hover:bg-white/10" onClick={() => navigate('next')}>
                            <ChevronRight className="h-4 w-4" />
                        </Button>
                    </div>
                </div>

                <div className="flex items-center gap-6">
                    <Select value={view} onValueChange={(v) => setView(v as CalendarViewType)}>
                        <SelectTrigger className="w-[160px] h-10 bg-white/60 dark:bg-white/5 border-white/60 dark:border-white/5 rounded-2xl text-[10px] font-black uppercase tracking-widest focus:ring-2 ring-[#3B82F6]/20">
                            <SelectValue placeholder="Visualização" />
                        </SelectTrigger>
                        <SelectContent className="bg-white/90 dark:bg-black/90 backdrop-blur-xl border-white/20 dark:border-white/5 rounded-2xl overflow-hidden p-1">
                            <SelectItem value="day" className="rounded-xl text-[10px] font-black uppercase tracking-widest py-2.5">Dia</SelectItem>
                            <SelectItem value="week" className="rounded-xl text-[10px] font-black uppercase tracking-widest py-2.5">Semana</SelectItem>
                            <SelectItem value="month" className="rounded-xl text-[10px] font-black uppercase tracking-widest py-2.5">Mês</SelectItem>
                            <SelectItem value="year" className="rounded-xl text-[10px] font-black uppercase tracking-widest py-2.5">Ano</SelectItem>
                            <SelectItem value="agenda" className="rounded-xl text-[10px] font-black uppercase tracking-widest py-2.5">Agenda</SelectItem>
                            <SelectItem value="4days" className="rounded-xl text-[10px] font-black uppercase tracking-widest py-2.5">4 Dias</SelectItem>
                        </SelectContent>
                    </Select>

                    {isManager && (
                        <Select value={selectedCloserId} onValueChange={setSelectedCloserId}>
                            <SelectTrigger className="w-[220px] h-10 bg-white/60 dark:bg-white/5 border-white/60 dark:border-white/5 rounded-2xl text-[10px] font-black uppercase tracking-widest focus:ring-2 ring-[#3B82F6]/20">
                                <Users className="w-3.5 h-3.5 mr-2 text-[#3B82F6]" />
                                <SelectValue placeholder="Selecionar Closer" />
                            </SelectTrigger>
                            <SelectContent className="bg-white/90 dark:bg-black/90 backdrop-blur-xl border-white/20 dark:border-white/5 rounded-2xl overflow-hidden p-1">
                                <SelectItem value="all" className="rounded-xl text-[10px] font-black uppercase tracking-widest py-2.5">Todos</SelectItem>
                                {closers.map((m: any) => {
                                    const profile = Array.isArray(m.profiles) ? m.profiles[0] : m.profiles;
                                    return (
                                        <SelectItem key={profile.id} value={profile.id} className="rounded-xl text-[10px] font-black uppercase tracking-widest py-2.5">
                                            {profile.full_name || profile.email}
                                        </SelectItem>
                                    );
                                })}
                            </SelectContent>
                        </Select>
                    )}

                    <div className="flex items-center gap-3">
                        <Switch
                            id="show-personal"
                            checked={showPersonalEvents}
                            onCheckedChange={setShowPersonalEvents}
                            disabled={selectedCloserId === "all"}
                            className="data-[state=checked]:bg-[#3B82F6]"
                        />
                        <Label htmlFor="show-personal" className={cn("text-[10px] font-black uppercase tracking-widest cursor-pointer opacity-40 hover:opacity-100 transition-opacity", selectedCloserId === "all" && "opacity-20")}>
                            {selectedCloserId === user?.id ? "Minha Agenda" : "G-Calendar"}
                        </Label>
                    </div>

                    {isLoading && (
                        <div className="flex items-center justify-center w-8 h-8">
                            <Loader2 className="h-4 w-4 animate-spin text-[#3B82F6]" />
                        </div>
                    )}
                </div>
            </div>

            <div className="flex-1 overflow-hidden relative">
                {renderView()}
            </div>
        </div>
    );
}

// ---------------- SUB-COMPONENTS ----------------

// --- MONTH VIEW ---
const MonthView = ({ currentDate, bookings, googleEvents, onOpportunityClick, startDate, endDate }: any) => {
    const days = eachDayOfInterval({ start: startDate, end: endDate });
    const weekDays = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

    const getEventsForDay = (day: Date) => {
        const dayBookings = bookings.filter((b: any) => isSameDay(parseISO(b.start_time), day));
        const dayGoogle = googleEvents.filter((ev: any) => {
            const start = ev.start.dateTime || ev.start.date;
            return isSameDay(parseISO(start), day);
        });
        const bookingIds = new Set(dayBookings.map((b: any) => b.google_event_id));
        const uniqueGoogle = dayGoogle.filter((ev: any) => !bookingIds.has(ev.id));
        return { bookings: dayBookings, google: uniqueGoogle };
    };

    return (
        <div className="flex flex-col h-full overflow-y-auto overflow-x-hidden no-scrollbar">
            <div className="grid grid-cols-7 border-b border-white/40 dark:border-white/5 bg-white/20 dark:bg-white/[0.01]">
                {weekDays.map((day) => (
                    <div key={day} className="py-3 text-center text-[10px] font-black uppercase tracking-[0.2em] text-[#1D4ED8]/40 dark:text-white/30">
                        {day}
                    </div>
                ))}
            </div>
            <div className="grid grid-cols-7 auto-rows-[minmax(140px,1fr)]">
                {days.map((day, dayIdx) => {
                    const { bookings: dayBookings, google: dayGoogleEvents } = getEventsForDay(day);
                    const totalEvents = dayBookings.length + dayGoogleEvents.length;
                    const isCurrentMonth = isSameMonth(day, currentDate);
                    const isTodayDate = isToday(day);

                    return (
                        <div
                            key={day.toISOString()}
                            className={cn(
                                "min-h-[140px] p-3 border-b border-r border-white/40 dark:border-white/5 transition-all hover:bg-[#3B82F6]/5 relative group",
                                !isCurrentMonth && "bg-black/[0.02] dark:bg-white/[0.01] opacity-20",
                                (dayIdx + 1) % 7 === 0 && "border-r-0"
                            )}
                        >
                            <div className="flex items-center justify-between mb-3">
                                <span className={cn(
                                    "text-[11px] font-black font-fira-code h-7 w-7 flex items-center justify-center rounded-full transition-all",
                                    isTodayDate ? "bg-[#3B82F6] text-white shadow-lg shadow-[#3B82F6]/30 scale-110" : "text-[#1D4ED8] dark:text-white/60 group-hover:text-[#3B82F6]"
                                )}>
                                    {format(day, "d")}
                                </span>
                                {totalEvents > 0 && <span className="text-[10px] font-black text-white dark:text-white/80 bg-[#3B82F6] dark:bg-white/10 px-2.5 py-0.5 rounded-lg shadow-sm">{totalEvents}</span>}
                            </div>
                            <div className="flex-1 flex flex-col gap-1.5 overflow-y-auto max-h-[160px] no-scrollbar">
                                {dayBookings.map((booking: any) => (
                                    <EventCard key={booking.id} booking={booking} onClick={() => onOpportunityClick(booking.opportunity)} />
                                ))}
                                {dayGoogleEvents.map((event: any) => (
                                    <GoogleEventCard key={event.id} event={event} />
                                ))}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

// --- TIME GRID VIEW (Day, Week, 4Days) ---
const TimeGridView = ({ view, currentDate, startDate, endDate, bookings, googleEvents, onOpportunityClick }: any) => {
    const days = eachDayOfInterval({ start: startDate, end: endDate });
    const hours = Array.from({ length: 24 }, (_, i) => i);
    const CELL_HEIGHT = 80; // px per hour

    const getEventStyle = (startStr: string, endStr: string) => {
        const start = parseISO(startStr);
        const end = parseISO(endStr);
        const startMinutes = getHours(start) * 60 + getMinutes(start);
        const duration = differenceInMinutes(end, start);
        return {
            top: `${(startMinutes / 60) * CELL_HEIGHT}px`,
            height: `${Math.max((duration / 60) * CELL_HEIGHT, 32)}px`,
        };
    };

    const isAllDay = (event: any) => !event.start.dateTime;

    return (
        <div className="flex flex-col h-full overflow-hidden">
            {/* Header Days */}
            <div className="flex border-b border-white/40 dark:border-white/5 bg-white/20 dark:bg-white/[0.01] pl-16 overflow-hidden shrink-0">
                {days.map((day, idx) => (
                    <div key={day.toISOString()} className={cn("flex-1 py-4 text-center border-r border-white/40 dark:border-white/5 last:border-r-0 transition-colors", isToday(day) && "bg-[#3B82F6]/5")}>
                        <div className={cn("text-[10px] font-black uppercase tracking-[0.2em] text-[#1D4ED8]/40 dark:text-white/30", isToday(day) && "text-[#3B82F6] dark:text-[#60A5FA]")}>
                            {format(day, "EEE", { locale: ptBR })}
                        </div>
                        <div className={cn("text-xl font-black font-fira-code mt-1 text-[#1D4ED8] dark:text-white/80", isToday(day) && "text-[#3B82F6] dark:text-white")}>
                            {format(day, "d")}
                        </div>
                    </div>
                ))}
            </div>

            {/* Scrollable Grid */}
            <div className="flex-1 overflow-y-auto overflow-x-hidden relative scrollbar-thin scrollbar-thumb-[#3B82F6]/20 hover:scrollbar-thumb-[#3B82F6]/40">
                <div className="flex relative" style={{ height: 24 * CELL_HEIGHT }}>
                    {/* Time Labels Column */}
                    <div className="w-16 shrink-0 border-r border-white/40 dark:border-white/5 bg-white/20 dark:bg-black/20 sticky left-0 z-10 flex flex-col items-center">
                        {hours.map(hour => (
                            <div key={hour} className="w-full border-b border-white/10 dark:border-white/5 flex items-start justify-center pt-2" style={{ height: CELL_HEIGHT }}>
                                <span className="text-[10px] font-black font-fira-code text-[#1D4ED8]/40 dark:text-white/20 uppercase">
                                    {hour < 10 ? `0${hour}` : hour}:00
                                </span>
                            </div>
                        ))}
                    </div>

                    {/* Columns */}
                    <div className="flex flex-1 relative bg-white/5 dark:bg-transparent">
                        {/* Background Grid Lines */}
                        {hours.map(hour => (
                            <div key={hour} className="absolute w-full border-b border-white/10 dark:border-white/5" style={{ top: hour * CELL_HEIGHT, height: 1 }} />
                        ))}

                        {days.map((day, dayIdx) => {
                            const dayBookings = bookings.filter((b: any) => isSameDay(parseISO(b.start_time), day));
                            const dayGoogle = googleEvents.filter((ev: any) => {
                                const start = ev.start.dateTime || ev.start.date;
                                return isSameDay(parseISO(start), day);
                            });
                            const bookingIds = new Set(dayBookings.map((b: any) => b.google_event_id));
                            const uniqueGoogle = dayGoogle.filter((ev: any) => !bookingIds.has(ev.id) && !isAllDay(ev));

                            return (
                                <div key={day.toISOString()} className="flex-1 relative border-r border-white/10 dark:border-white/5 last:border-r-0">
                                    {isToday(day) && (
                                        <div className="absolute w-full bg-[#3B82F6]/5 h-full pointer-events-none" />
                                    )}
                                    {dayBookings.map((booking: any) => (
                                        <div
                                            key={booking.id}
                                            className="absolute left-1 right-2 rounded-2xl px-3 py-2.5 text-[10px] border border-[#3B82F6]/30 bg-white/80 dark:bg-[#3B82F6]/20 shadow-xl backdrop-blur-md overflow-hidden cursor-pointer hover:scale-[1.02] active:scale-95 transition-all z-20 group"
                                            style={getEventStyle(booking.start_time, booking.end_time)}
                                            onClick={(e) => { e.stopPropagation(); onOpportunityClick(booking.opportunity); }}
                                        >
                                            <div className="absolute top-0 left-0 w-1.5 h-full bg-[#3B82F6]" />
                                            <div className="font-black text-[#60A5FA] flex items-center gap-1.5 mb-1 font-fira-code">
                                                {format(parseISO(booking.start_time), 'HH:mm')}
                                            </div>
                                            <div className="font-black text-[#1D4ED8] dark:text-white text-[11px] truncate uppercase tracking-tight">{booking.opportunity?.lead_name}</div>
                                            <div className="text-[9px] font-bold text-[#1D4ED8]/40 dark:text-white/40 truncate uppercase">{booking.opportunity?.lead_company}</div>
                                        </div>
                                    ))}
                                    {uniqueGoogle.map((event: any) => (
                                        <div
                                            key={event.id}
                                            className="absolute left-1 right-2 rounded-2xl px-3 py-2 text-[10px] border border-white/30 dark:border-white/5 bg-white/40 dark:bg-white/[0.05] backdrop-blur-sm overflow-hidden z-10 opacity-70 hover:opacity-100 transition-opacity"
                                            style={getEventStyle(event.start.dateTime, event.end.dateTime)}
                                        >
                                            <div className="font-black text-[#1D4ED8]/60 dark:text-white/50 truncate uppercase tracking-widest leading-tight">{event.summary || '(Sem título)'}</div>
                                        </div>
                                    ))}
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
        </div>
    );
};

// --- AGENDA VIEW ---
const AgendaView = ({ currentDate, bookings, googleEvents, onOpportunityClick }: any) => {
    const allEvents = [
        ...bookings.map((b: any) => ({ ...b, type: 'crm', date: parseISO(b.start_time) })),
        ...googleEvents.map((e: any) => {
            const start = e.start.dateTime || e.start.date;
            return {
                id: e.id,
                type: 'google',
                summary: e.summary,
                date: parseISO(start),
                start_time: start,
                isAllDay: !e.start.dateTime
            };
        })
    ].sort((a, b) => a.date.getTime() - b.date.getTime());

    const bookingIds = new Set(bookings.map((b: any) => b.google_event_id));
    const filteredEvents = allEvents.filter(e => {
        if (e.type === 'google' && bookingIds.has(e.id)) return false;
        return true;
    });

    if (filteredEvents.length === 0) {
        return <div className="flex flex-col items-center justify-center h-full text-muted-foreground p-10 gap-6 opacity-30">
            <CalendarIcon className="h-16 w-16" />
            <span className="text-[11px] font-black uppercase tracking-[0.3em]">Nenhum evento agendado</span>
        </div>;
    }

    let lastDayStr = "";

    return (
        <div className="flex flex-col h-full overflow-y-auto p-8 space-y-4 no-scrollbar">
            {filteredEvents.map((event: any) => {
                const dayStr = format(event.date, "EEEE, d 'de' MMMM", { locale: ptBR });
                const showHeader = dayStr !== lastDayStr;
                lastDayStr = dayStr;

                return (
                    <React.Fragment key={`${event.type}-${event.id}`}>
                        {showHeader && (
                            <div className="sticky top-0 bg-white/80 dark:bg-black/80 backdrop-blur-xl py-4 z-10 border-b border-white/20 dark:border-white/5 mt-8 first:mt-0 px-2 rounded-t-2xl">
                                <span className="font-black text-[10px] text-[#3B82F6] dark:text-[#60A5FA] uppercase tracking-[0.3em]">{dayStr}</span>
                            </div>
                        )}
                        <div
                            className={cn(
                                "flex items-stretch gap-6 p-6 rounded-[32px] border transition-all hover:scale-[1.01] hover:shadow-2xl group",
                                event.type === 'crm'
                                    ? "bg-white/60 dark:bg-white/[0.03] border-white/60 dark:border-[#3B82F6]/20 cursor-pointer"
                                    : "bg-white/20 dark:bg-white/[0.01] border-white/40 dark:border-white/5"
                            )}
                            onClick={() => event.type === 'crm' && event.opportunity && onOpportunityClick(event.opportunity)}
                        >
                            <div className="flex flex-col items-center justify-center min-w-[100px] border-r border-[#3B82F6]/10 pr-6 gap-1">
                                <div className="text-2xl font-black font-fira-code text-[#1D4ED8] dark:text-white">{event.isAllDay ? "ALL" : format(event.date, "HH:mm")}</div>
                                {!event.isAllDay && <div className="text-[10px] font-black text-[#3B82F6] uppercase tracking-widest">Local</div>}
                            </div>
                            {event.type === 'crm' ? (
                                <div className="flex-1 space-y-1">
                                    <div className="font-black text-lg text-[#1D4ED8] dark:text-white uppercase tracking-tight group-hover:text-[#3B82F6] transition-colors">{event.opportunity?.lead_name}</div>
                                    <div className="text-[11px] font-bold text-[#1D4ED8]/40 dark:text-white/30 uppercase tracking-[0.1em] flex items-center gap-2">
                                        <User className="h-3 w-3" />
                                        {event.opportunity?.lead_company || "Empresa não definida"}
                                    </div>
                                </div>
                            ) : (
                                <div className="flex-1 flex items-center">
                                    <div className="font-black text-md text-[#1D4ED8]/60 dark:text-white/40 uppercase tracking-wide">
                                        {event.summary || "(Sem título)"}
                                    </div>
                                </div>
                            )}
                        </div>
                    </React.Fragment>
                );
            })}
        </div>
    );
};

// --- YEAR VIEW ---
const YearView = ({ currentDate, onMonthClick }: any) => {
    const months = eachMonthOfInterval({
        start: startOfYear(currentDate),
        end: endOfYear(currentDate)
    });

    return (
        <div className="h-full overflow-y-auto p-10 no-scrollbar pb-20">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-12">
                {months.map(month => (
                    <div
                        key={month.toISOString()}
                        className="rounded-[32px] border border-white/60 dark:border-white/5 p-8 hover:border-[#3B82F6]/40 cursor-pointer transition-all hover:shadow-2xl bg-white/40 dark:bg-black/20 group backdrop-blur-md"
                        onClick={() => onMonthClick(month)}
                    >
                        <h3 className="font-black text-center text-[11px] mb-8 uppercase tracking-[0.4em] text-[#3B82F6] dark:text-[#60A5FA] group-hover:scale-110 transition-transform">{format(month, 'MMMM', { locale: ptBR })}</h3>
                        <div className="grid grid-cols-7 text-[9px] text-center gap-y-4 font-black uppercase tracking-tighter text-[#1D4ED8]/30 dark:text-white/20">
                            {["D", "S", "T", "Q", "Q", "S", "S"].map((d, i) => <div key={i}>{d}</div>)}
                            {Array.from({ length: startOfMonth(month).getDay() }).map((_, i) => <div key={`empty-${i}`} />)}
                            {eachDayOfInterval({ start: startOfMonth(month), end: endOfMonth(month) }).map(day => (
                                <div
                                    key={day.toISOString()}
                                    className={cn(
                                        "aspect-square flex items-center justify-center rounded-xl text-[10px] font-black font-fira-code transition-all",
                                        isToday(day) ? "bg-[#3B82F6] text-white shadow-lg shadow-[#3B82F6]/20 scale-125 z-10" : "hover:bg-[#3B82F6]/10 text-[#1D4ED8] dark:text-white/60 hover:text-[#3B82F6]"
                                    )}
                                >
                                    {day.getDate()}
                                </div>
                            ))}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

// --- HELPER COMPONENTS ---

const EventCard = ({ booking, onClick }: any) => (
    <button
        onClick={(e) => { e.stopPropagation(); onClick(); }}
        className={cn(
            "text-left p-2.5 rounded-xl border transition-all hover:scale-[1.02] active:scale-95 shadow-lg w-full block",
            "bg-white/80 dark:bg-white/5 border-white/60 dark:border-[#3B82F6]/20 hover:border-[#3B82F6]/50",
            "group/card"
        )}
    >
        <div className="flex items-center gap-2 mb-1.5 font-fira-code">
            <div className="w-1.5 h-1.5 rounded-full bg-[#3B82F6]" />
            <span className="text-[9px] font-black text-[#3B82F6]">{format(parseISO(booking.start_time), "HH:mm")}</span>
        </div>
        <div className="font-black text-[#1D4ED8] dark:text-white text-[10px] truncate uppercase tracking-tight leading-tight">
            {booking.opportunity?.lead_name || "Misterioso"}
        </div>
    </button>
);

const GoogleEventCard = ({ event }: any) => {
    const eventStart = event.start.dateTime ? parseISO(event.start.dateTime) : parseISO(event.start.date);
    const isAllDay = !event.start.dateTime;

    return (
        <div
            className={cn(
                "text-left p-2 rounded-xl border text-[9px] w-full block transition-opacity",
                "bg-white/20 dark:bg-white/[0.02] border-white/20 dark:border-white/5 text-[#1D4ED8]/40 dark:text-white/20",
                "opacity-60 hover:opacity-100"
            )}
        >
            <div className="flex items-center gap-1.5 mb-1 font-black uppercase tracking-wider">
                <div className="w-1.5 h-1.5 rounded-full bg-white/20 dark:bg-white/10" />
                {isAllDay ? "Full Day" : format(eventStart, "HH:mm")}
            </div>
            <div className="truncate font-black uppercase tracking-tighter opacity-80">
                {event.summary || "Privado"}
            </div>
        </div>
    );
};
