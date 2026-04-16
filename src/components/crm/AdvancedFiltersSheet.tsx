import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import {
    Sheet,
    SheetContent,
    SheetHeader,
    SheetTitle,
    SheetTrigger,
    SheetFooter,
} from "@/components/ui/sheet";
import {
    Accordion,
    AccordionContent,
    AccordionItem,
    AccordionTrigger,
} from "@/components/ui/accordion";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    Filter,
    Users,
    Target,
    Zap,
    DollarSign,
    Calendar,
    TrendingUp,
    Tag,
    Video,
    Search,
    X,
    User,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface AdvancedFiltersSheetProps {
    filters: any;
    setFilters: (filters: any) => void;
    searchTerm: string;
    setSearchTerm: (term: string) => void;
    stages: any[];
    sdrMembers: any[];
    closerMembers: any[];
    triggerClassName?: string;
    triggerIcon?: React.ReactNode;
}

const lossReasonMap: Record<string, string> = {
    high_price: "Preço muito alto",
    competitor: "Escolheu concorrente",
    bad_timing: "Timing inadequado",
    no_budget: "Sem orçamento",
    no_authority: "Sem autoridade/decisão",
    no_need: "Sem necessidade",
    no_response: "Sem resposta",
    other: "Outro motivo",
};

export function AdvancedFiltersSheet({
    filters,
    setFilters,
    searchTerm,
    setSearchTerm,
    stages,
    sdrMembers,
    closerMembers,
    triggerClassName,
    triggerIcon,
}: AdvancedFiltersSheetProps) {
    const { currentWorkspace } = useWorkspace();

    // Query: CRM Tags
    const { data: tags = [] } = useQuery({
        queryKey: ["crm-tags", currentWorkspace?.id],
        queryFn: async () => {
            if (!currentWorkspace?.id) return [];
            const { data, error } = await supabase
                .from("crm_tags")
                .select("*")
                .eq("workspace_id", currentWorkspace.id)
                .order("name");
            if (error) throw error;
            return data || [];
        },
        enabled: !!currentWorkspace?.id,
    });

    // Query: Quizzes
    const { data: quizzes = [] } = useQuery({
        queryKey: ["quizzes", currentWorkspace?.id],
        queryFn: async () => {
            if (!currentWorkspace?.id) return [];
            const { data, error } = await supabase
                .from("quizzes")
                .select("id, title")
                .eq("workspace_id", currentWorkspace.id)
                .order("title");
            if (error) throw error;
            return data || [];
        },
        enabled: !!currentWorkspace?.id,
    });

    // Query: Webhooks
    const { data: webhooks = [] } = useQuery({
        queryKey: ["webhook_integrations", currentWorkspace?.id],
        queryFn: async () => {
            if (!currentWorkspace?.id) return [];
            const { data, error } = await supabase
                .from("webhook_integrations")
                .select("id, name")
                .eq("workspace_id", currentWorkspace.id)
                .eq("is_active", true)
                .order("name");
            if (error) throw error;
            return data || [];
        },
        enabled: !!currentWorkspace?.id,
    });

    // Query: Products
    const { data: products = [] } = useQuery({
        queryKey: ["products", currentWorkspace?.id],
        queryFn: async () => {
            if (!currentWorkspace?.id) return [];
            const { data, error } = await supabase
                .from("products")
                .select("id, name")
                .eq("workspace_id", currentWorkspace.id)
                .order("name");
            if (error) throw error;
            return data || [];
        },
        enabled: !!currentWorkspace?.id,
    });

    // Count active filters
    const activeFiltersCount = useMemo(() => {
        let count = 0;
        Object.entries(filters).forEach(([key, value]) => {
            if (key === "meMode" && value === true) count++;
            else if (Array.isArray(value) && value.length > 0) count++;
            else if (typeof value === "string" && value !== "" && value !== "all") count++;
        });
        return count;
    }, [filters]);

    const resetFilters = () => {
        setFilters({
            stageId: "all", sdrId: "all", closerId: "all", segment: "all", source: "all",
            minValue: "", maxValue: "", minRevenue: "", maxRevenue: "", minInvestment: "",
            maxInvestment: "", utm_source: "", utm_medium: "", utm_campaign: "",
            productId: "all", email: "", phone: "", document: "", startDate: "", endDate: "",
            startStageDate: "", endStageDate: "", minExpectedDate: "", maxExpectedDate: "",
            startFollowUpDate: "", endFollowUpDate: "", includeTags: [], excludeTags: [],
            quizIds: [], excludeQuizIds: [], webinarStatuses: [], webhookId: "all", meMode: false,
            lossReason: "all"
        });
        setSearchTerm("");
    };

    const webinarStatusOptions = [
        { value: "registered", label: "Inscrito" },
        { value: "attended", label: "Assistiu" },
        { value: "no_show", label: "No-Show" },
        { value: "replay", label: "Replay" },
    ];

    const sourceOptions = [
        { value: "quiz", label: "Quiz" },
        { value: "webhook", label: "Webhook" },
        { value: "manual", label: "Manual" },
        { value: "import", label: "Importação" },
    ];

    const labelClass = "text-[10px] font-black uppercase tracking-widest text-muted-foreground";
    const inputClass = "h-11 rounded-xl bg-muted/30 border-border text-[11px] font-bold text-foreground placeholder:text-muted-foreground/50";
    const selectTriggerClass = "h-11 rounded-xl bg-muted/30 border-border text-[11px] font-bold text-foreground";

    return (
        <Sheet>
            <SheetTrigger asChild>
                <Button
                    variant="ghost"
                    className={cn(
                        "h-10 px-6 bg-background border border-border rounded-xl text-[9px] font-black uppercase tracking-widest text-muted-foreground hover:bg-muted hover:text-foreground transition-all gap-2.5",
                        triggerClassName
                    )}
                >
                    {triggerIcon || <Filter className="h-3.5 w-3.5" />}
                    Filtros Avançados
                    {activeFiltersCount > 0 && (
                        <Badge className="h-5 min-w-5 px-1.5 bg-primary text-primary-foreground text-[9px] font-black rounded-full">
                            {activeFiltersCount}
                        </Badge>
                    )}
                </Button>
            </SheetTrigger>
            <SheetContent className="w-[480px] sm:w-[560px] border-l border-border bg-background p-0 overflow-hidden flex flex-col">
                <SheetHeader className="p-6 border-b border-border flex flex-row items-center justify-between">
                    <SheetTitle className="text-xl font-black tracking-tighter uppercase text-foreground">
                        Filtros Avançados
                    </SheetTitle>
                    {activeFiltersCount > 0 && (
                        <Badge className="bg-primary/10 text-primary text-[10px] font-black px-3 py-1">
                            {activeFiltersCount} {activeFiltersCount === 1 ? "filtro ativo" : "filtros ativos"}
                        </Badge>
                    )}
                </SheetHeader>

                <div className="flex-1 overflow-y-auto scrollbar-hide">
                    <Accordion type="multiple" defaultValue={["assignment", "pipeline"]} className="w-full">
                        {/* SECTION: Assignment */}
                        <AccordionItem value="assignment" className="border-b border-border">
                            <AccordionTrigger className="px-6 py-4 hover:no-underline hover:bg-muted/50 transition-colors">
                                <div className="flex items-center gap-3">
                                    <Users className="h-4 w-4 text-primary" />
                                    <span className="text-[11px] font-black uppercase tracking-widest text-foreground">Atribuição</span>
                                </div>
                            </AccordionTrigger>
                            <AccordionContent className="px-6 pb-6 space-y-4">
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <label className={labelClass}>SDR</label>
                                        <Select value={filters.sdrId} onValueChange={(v) => setFilters({ ...filters, sdrId: v })}>
                                            <SelectTrigger className={selectTriggerClass}>
                                                <SelectValue placeholder="Todos" />
                                            </SelectTrigger>
                                            <SelectContent className="bg-background border-border">
                                                <SelectItem value="all" className="text-[11px] font-black uppercase">Todos</SelectItem>
                                                <SelectItem value="unassigned" className="text-[11px] font-bold">Sem SDR</SelectItem>
                                                {sdrMembers.map(m => {
                                                    const profile = Array.isArray(m.profiles) ? m.profiles[0] : m.profiles;
                                                    return (
                                                        <SelectItem key={profile?.id || m.user_id} value={profile?.id || m.user_id} className="text-[11px] font-bold">
                                                            {profile?.full_name || profile?.email || "Sem Perfil"}
                                                        </SelectItem>
                                                    );
                                                })}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="space-y-2">
                                        <label className={labelClass}>Closer</label>
                                        <Select value={filters.closerId} onValueChange={(v) => setFilters({ ...filters, closerId: v })}>
                                            <SelectTrigger className={selectTriggerClass}>
                                                <SelectValue placeholder="Todos" />
                                            </SelectTrigger>
                                            <SelectContent className="bg-background border-border">
                                                <SelectItem value="all" className="text-[11px] font-black uppercase">Todos</SelectItem>
                                                <SelectItem value="unassigned" className="text-[11px] font-bold">Sem Closer</SelectItem>
                                                {closerMembers.map(m => {
                                                    const profile = Array.isArray(m.profiles) ? m.profiles[0] : m.profiles;
                                                    return (
                                                        <SelectItem key={profile?.id || m.user_id} value={profile?.id || m.user_id} className="text-[11px] font-bold">
                                                            {profile?.full_name || profile?.email || "Sem Perfil"}
                                                        </SelectItem>
                                                    );
                                                })}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>
                                <div className="flex items-center gap-3 pt-2">
                                    <Checkbox
                                        id="meMode"
                                        checked={filters.meMode}
                                        onCheckedChange={(checked) => setFilters({ ...filters, meMode: !!checked })}
                                        className="border-[#3B82F6]/30 data-[state=checked]:bg-[#3B82F6] data-[state=checked]:border-[#3B82F6]"
                                    />
                                    <label htmlFor="meMode" className="text-[11px] font-bold cursor-pointer flex items-center gap-2 text-foreground">
                                        <User className="h-3.5 w-3.5 text-primary" />
                                        Modo Eu (Apenas minhas oportunidades)
                                    </label>
                                </div>
                            </AccordionContent>
                        </AccordionItem>

                        {/* SECTION: Pipeline */}
                        <AccordionItem value="pipeline" className="border-b border-border">
                            <AccordionTrigger className="px-6 py-4 hover:no-underline hover:bg-muted/50 transition-colors">
                                <div className="flex items-center gap-3">
                                    <Target className="h-4 w-4 text-emerald-500" />
                                    <span className="text-[11px] font-black uppercase tracking-widest text-foreground">Pipeline</span>
                                </div>
                            </AccordionTrigger>
                            <AccordionContent className="px-6 pb-6 space-y-4">
                                <div className="space-y-2">
                                    <label className={labelClass}>Fase do Pipeline</label>
                                    <Select value={filters.stageId} onValueChange={(v) => setFilters({ ...filters, stageId: v })}>
                                        <SelectTrigger className={selectTriggerClass}>
                                            <SelectValue placeholder="Todas as fases" />
                                        </SelectTrigger>
                                        <SelectContent className="bg-background border-border">
                                            <SelectItem value="all" className="text-[11px] font-black uppercase">Todas as fases</SelectItem>
                                            {stages.map(s => (
                                                <SelectItem key={s.id} value={s.id} className="text-[11px] font-bold">
                                                    <div className="flex items-center gap-2">
                                                        <div className="h-2 w-2 rounded-full" style={{ backgroundColor: s.color || "#6B7280" }} />
                                                        {s.name}
                                                    </div>
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-2">
                                    <label className={labelClass}>Produto</label>
                                    <Select value={filters.productId} onValueChange={(v) => setFilters({ ...filters, productId: v })}>
                                        <SelectTrigger className={selectTriggerClass}>
                                            <SelectValue placeholder="Todos os produtos" />
                                        </SelectTrigger>
                                        <SelectContent className="bg-background border-border">
                                            <SelectItem value="all" className="text-[11px] font-black uppercase">Todos os produtos</SelectItem>
                                            {products.map(p => (
                                                <SelectItem key={p.id} value={p.name} className="text-[11px] font-bold">{p.name}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                {stages.find(s => s.id === filters.stageId)?.name?.toLowerCase() === 'perdido' && (
                                    <div className="space-y-2">
                                        <label className={labelClass}>Motivo da Perda</label>
                                        <Select value={filters.lossReason || "all"} onValueChange={(v) => setFilters({ ...filters, lossReason: v })}>
                                            <SelectTrigger className={selectTriggerClass}>
                                                <SelectValue placeholder="Todos os motivos" />
                                            </SelectTrigger>
                                            <SelectContent className="bg-background border-border">
                                                <SelectItem value="all" className="text-[11px] font-black uppercase">Todos os motivos</SelectItem>
                                                {Object.entries(lossReasonMap).map(([key, label]) => (
                                                    <SelectItem key={key} value={key} className="text-[11px] font-bold">{label}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                )}
                            </AccordionContent>
                        </AccordionItem>

                        {/* SECTION: Origin */}
                        <AccordionItem value="origin" className="border-b border-border">
                            <AccordionTrigger className="px-6 py-4 hover:no-underline hover:bg-muted/50 transition-colors">
                                <div className="flex items-center gap-3">
                                    <Zap className="h-4 w-4 text-amber-500" />
                                    <span className="text-[11px] font-black uppercase tracking-widest text-foreground">Origem</span>
                                </div>
                            </AccordionTrigger>
                            <AccordionContent className="px-6 pb-6 space-y-4">
                                <div className="space-y-2">
                                    <label className={labelClass}>Fonte</label>
                                    <Select value={filters.source} onValueChange={(v) => setFilters({ ...filters, source: v })}>
                                        <SelectTrigger className={selectTriggerClass}>
                                            <SelectValue placeholder="Todas as fontes" />
                                        </SelectTrigger>
                                        <SelectContent className="bg-background border-border">
                                            <SelectItem value="all" className="text-[11px] font-black uppercase">Todas as fontes</SelectItem>
                                            {sourceOptions.map(o => (
                                                <SelectItem key={o.value} value={o.value} className="text-[11px] font-bold">{o.label}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-2">
                                    <label className={labelClass}>Webhook</label>
                                    <Select value={filters.webhookId} onValueChange={(v) => setFilters({ ...filters, webhookId: v })}>
                                        <SelectTrigger className={selectTriggerClass}>
                                            <SelectValue placeholder="Todos os webhooks" />
                                        </SelectTrigger>
                                        <SelectContent className="bg-background border-border">
                                            <SelectItem value="all" className="text-[11px] font-black uppercase">Todos os webhooks</SelectItem>
                                            {webhooks.map(w => (
                                                <SelectItem key={w.id} value={w.id} className="text-[11px] font-bold">{w.name}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-2">
                                    <label className={labelClass}>Quiz / Funil</label>
                                    <div className="flex flex-wrap gap-2">
                                        {quizzes.map(q => (
                                            <Badge
                                                key={q.id}
                                                variant="outline"
                                                className={cn(
                                                    "cursor-pointer text-[10px] font-bold transition-all",
                                                    filters.quizIds.includes(q.id)
                                                        ? "bg-primary text-primary-foreground border-primary"
                                                        : "bg-muted/50 border-input hover:border-primary/50 text-foreground"
                                                )}
                                                onClick={() => {
                                                    const newQuizIds = filters.quizIds.includes(q.id)
                                                        ? filters.quizIds.filter((id: string) => id !== q.id)
                                                        : [...filters.quizIds, q.id];
                                                    setFilters({ ...filters, quizIds: newQuizIds });
                                                }}
                                            >
                                                {q.title}
                                            </Badge>
                                        ))}
                                        {quizzes.length === 0 && (
                                            <span className="text-[10px] text-gray-400">Nenhum quiz disponível</span>
                                        )}
                                    </div>
                                </div>
                            </AccordionContent>
                        </AccordionItem>

                        {/* SECTION: Values */}
                        <AccordionItem value="values" className="border-b border-border">
                            <AccordionTrigger className="px-6 py-4 hover:no-underline hover:bg-muted/50 transition-colors">
                                <div className="flex items-center gap-3">
                                    <DollarSign className="h-4 w-4 text-emerald-500" />
                                    <span className="text-[11px] font-black uppercase tracking-widest text-foreground">Valores</span>
                                </div>
                            </AccordionTrigger>
                            <AccordionContent className="px-6 pb-6 space-y-4">
                                <div className="space-y-2">
                                    <label className={labelClass}>Valor Negociado</label>
                                    <div className="grid grid-cols-2 gap-3">
                                        <Input
                                            type="number"
                                            placeholder="Mínimo"
                                            value={filters.minValue}
                                            onChange={(e) => setFilters({ ...filters, minValue: e.target.value })}
                                            className={inputClass}
                                        />
                                        <Input
                                            type="number"
                                            placeholder="Máximo"
                                            value={filters.maxValue}
                                            onChange={(e) => setFilters({ ...filters, maxValue: e.target.value })}
                                            className={inputClass}
                                        />
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <label className={labelClass}>Faturamento</label>
                                    <div className="grid grid-cols-2 gap-3">
                                        <Input
                                            type="number"
                                            placeholder="Mínimo"
                                            value={filters.minRevenue}
                                            onChange={(e) => setFilters({ ...filters, minRevenue: e.target.value })}
                                            className={inputClass}
                                        />
                                        <Input
                                            type="number"
                                            placeholder="Máximo"
                                            value={filters.maxRevenue}
                                            onChange={(e) => setFilters({ ...filters, maxRevenue: e.target.value })}
                                            className={inputClass}
                                        />
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <label className={labelClass}>Investimento</label>
                                    <div className="grid grid-cols-2 gap-3">
                                        <Input
                                            type="number"
                                            placeholder="Mínimo"
                                            value={filters.minInvestment}
                                            onChange={(e) => setFilters({ ...filters, minInvestment: e.target.value })}
                                            className={inputClass}
                                        />
                                        <Input
                                            type="number"
                                            placeholder="Máximo"
                                            value={filters.maxInvestment}
                                            onChange={(e) => setFilters({ ...filters, maxInvestment: e.target.value })}
                                            className={inputClass}
                                        />
                                    </div>
                                </div>
                            </AccordionContent>
                        </AccordionItem>

                        {/* SECTION: Dates */}
                        <AccordionItem value="dates" className="border-b border-border">
                            <AccordionTrigger className="px-6 py-4 hover:no-underline hover:bg-muted/50 transition-colors">
                                <div className="flex items-center gap-3">
                                    <Calendar className="h-4 w-4 text-violet-500" />
                                    <span className="text-[11px] font-black uppercase tracking-widest text-foreground">Datas</span>
                                </div>
                            </AccordionTrigger>
                            <AccordionContent className="px-6 pb-6 space-y-4">
                                <div className="space-y-2">
                                    <label className={labelClass}>Data de Criação</label>
                                    <div className="grid grid-cols-2 gap-3">
                                        <Input
                                            type="date"
                                            value={filters.startDate}
                                            onChange={(e) => setFilters({ ...filters, startDate: e.target.value })}
                                            className={inputClass}
                                        />
                                        <Input
                                            type="date"
                                            value={filters.endDate}
                                            onChange={(e) => setFilters({ ...filters, endDate: e.target.value })}
                                            className={inputClass}
                                        />
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <label className={labelClass}>Data de Mudança de Fase</label>
                                    <div className="grid grid-cols-2 gap-3">
                                        <Input
                                            type="date"
                                            value={filters.startStageDate}
                                            onChange={(e) => setFilters({ ...filters, startStageDate: e.target.value })}
                                            className={inputClass}
                                        />
                                        <Input
                                            type="date"
                                            value={filters.endStageDate}
                                            onChange={(e) => setFilters({ ...filters, endStageDate: e.target.value })}
                                            className={inputClass}
                                        />
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <label className={labelClass}>Data de Follow-up</label>
                                    <div className="grid grid-cols-2 gap-3">
                                        <Input
                                            type="date"
                                            value={filters.startFollowUpDate}
                                            onChange={(e) => setFilters({ ...filters, startFollowUpDate: e.target.value })}
                                            className={inputClass}
                                        />
                                        <Input
                                            type="date"
                                            value={filters.endFollowUpDate}
                                            onChange={(e) => setFilters({ ...filters, endFollowUpDate: e.target.value })}
                                            className={inputClass}
                                        />
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <label className={labelClass}>Data de Fechamento Esperada</label>
                                    <div className="grid grid-cols-2 gap-3">
                                        <Input
                                            type="date"
                                            value={filters.minExpectedDate}
                                            onChange={(e) => setFilters({ ...filters, minExpectedDate: e.target.value })}
                                            className={inputClass}
                                        />
                                        <Input
                                            type="date"
                                            value={filters.maxExpectedDate}
                                            onChange={(e) => setFilters({ ...filters, maxExpectedDate: e.target.value })}
                                            className={inputClass}
                                        />
                                    </div>
                                </div>
                            </AccordionContent>
                        </AccordionItem>

                        {/* SECTION: Marketing */}
                        <AccordionItem value="marketing" className="border-b border-border">
                            <AccordionTrigger className="px-6 py-4 hover:no-underline hover:bg-muted/50 transition-colors">
                                <div className="flex items-center gap-3">
                                    <TrendingUp className="h-4 w-4 text-pink-500" />
                                    <span className="text-[11px] font-black uppercase tracking-widest text-foreground">Marketing (UTM)</span>
                                </div>
                            </AccordionTrigger>
                            <AccordionContent className="px-6 pb-6 space-y-4">
                                <div className="space-y-2">
                                    <label className={labelClass}>UTM Source</label>
                                    <Input
                                        placeholder="Ex: google, facebook..."
                                        value={filters.utm_source}
                                        onChange={(e) => setFilters({ ...filters, utm_source: e.target.value })}
                                        className={inputClass}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className={labelClass}>UTM Medium</label>
                                    <Input
                                        placeholder="Ex: cpc, organic..."
                                        value={filters.utm_medium}
                                        onChange={(e) => setFilters({ ...filters, utm_medium: e.target.value })}
                                        className={inputClass}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className={labelClass}>UTM Campaign</label>
                                    <Input
                                        placeholder="Ex: black_friday_2024..."
                                        value={filters.utm_campaign}
                                        onChange={(e) => setFilters({ ...filters, utm_campaign: e.target.value })}
                                        className={inputClass}
                                    />
                                </div>
                            </AccordionContent>
                        </AccordionItem>

                        {/* SECTION: Tags */}
                        <AccordionItem value="tags" className="border-b border-border">
                            <AccordionTrigger className="px-6 py-4 hover:no-underline hover:bg-muted/50 transition-colors">
                                <div className="flex items-center gap-3">
                                    <Tag className="h-4 w-4 text-amber-500" />
                                    <span className="text-[11px] font-black uppercase tracking-widest text-foreground">Tags</span>
                                </div>
                            </AccordionTrigger>
                            <AccordionContent className="px-6 pb-6 space-y-4">
                                <div className="space-y-2">
                                    <label className={labelClass}>Incluir Tags (OU)</label>
                                    <div className="flex flex-wrap gap-2">
                                        {tags.map((t: any) => (
                                            <Badge
                                                key={t.id}
                                                variant="outline"
                                                className={cn(
                                                    "cursor-pointer text-[10px] font-bold transition-all",
                                                    filters.includeTags.includes(t.id)
                                                        ? "bg-emerald-500 text-white border-emerald-500"
                                                        : "bg-muted/50 border-input hover:border-emerald-500/50 text-foreground"
                                                )}
                                                onClick={() => {
                                                    const newTags = filters.includeTags.includes(t.id)
                                                        ? filters.includeTags.filter((id: string) => id !== t.id)
                                                        : [...filters.includeTags, t.id];
                                                    setFilters({ ...filters, includeTags: newTags });
                                                }}
                                            >
                                                {t.name}
                                            </Badge>
                                        ))}
                                        {tags.length === 0 && (
                                            <span className="text-[10px] text-gray-400">Nenhuma tag disponível</span>
                                        )}
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <label className={labelClass}>Excluir Tags</label>
                                    <div className="flex flex-wrap gap-2">
                                        {tags.map((t: any) => (
                                            <Badge
                                                key={t.id}
                                                variant="outline"
                                                className={cn(
                                                    "cursor-pointer text-[10px] font-bold transition-all",
                                                    filters.excludeTags.includes(t.id)
                                                        ? "bg-red-500 text-white border-red-500"
                                                        : "bg-muted/50 border-input hover:border-red-500/50 text-foreground"
                                                )}
                                                onClick={() => {
                                                    const newTags = filters.excludeTags.includes(t.id)
                                                        ? filters.excludeTags.filter((id: string) => id !== t.id)
                                                        : [...filters.excludeTags, t.id];
                                                    setFilters({ ...filters, excludeTags: newTags });
                                                }}
                                            >
                                                {t.name}
                                            </Badge>
                                        ))}
                                    </div>
                                </div>
                            </AccordionContent>
                        </AccordionItem>

                        {/* SECTION: Webinar */}
                        <AccordionItem value="webinar" className="border-b border-border">
                            <AccordionTrigger className="px-6 py-4 hover:no-underline hover:bg-muted/50 transition-colors">
                                <div className="flex items-center gap-3">
                                    <Video className="h-4 w-4 text-red-500" />
                                    <span className="text-[11px] font-black uppercase tracking-widest text-foreground">Webinário</span>
                                </div>
                            </AccordionTrigger>
                            <AccordionContent className="px-6 pb-6 space-y-4">
                                <div className="space-y-2">
                                    <label className={labelClass}>Status do Webinário</label>
                                    <div className="grid grid-cols-2 gap-3">
                                        {webinarStatusOptions.map(option => (
                                            <div key={option.value} className="flex items-center gap-2">
                                                <Checkbox
                                                    id={`webinar-${option.value}`}
                                                    checked={filters.webinarStatuses.includes(option.value)}
                                                    onCheckedChange={(checked) => {
                                                        const newStatuses = checked
                                                            ? [...filters.webinarStatuses, option.value]
                                                            : filters.webinarStatuses.filter((s: string) => s !== option.value);
                                                        setFilters({ ...filters, webinarStatuses: newStatuses });
                                                    }}
                                                    className="border-primary/30 data-[state=checked]:bg-primary data-[state=checked]:border-primary"
                                                />
                                                <label htmlFor={`webinar-${option.value}`} className="text-[11px] font-bold cursor-pointer text-foreground">
                                                    {option.label}
                                                </label>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </AccordionContent>
                        </AccordionItem>

                        {/* SECTION: Contact */}
                        <AccordionItem value="contact" className="border-b border-border">
                            <AccordionTrigger className="px-6 py-4 hover:no-underline hover:bg-muted/50 transition-colors">
                                <div className="flex items-center gap-3">
                                    <Search className="h-4 w-4 text-muted-foreground" />
                                    <span className="text-[11px] font-black uppercase tracking-widest text-foreground">Contato</span>
                                </div>
                            </AccordionTrigger>
                            <AccordionContent className="px-6 pb-6 space-y-4">
                                <div className="space-y-2">
                                    <label className={labelClass}>E-mail</label>
                                    <Input
                                        placeholder="Buscar por e-mail..."
                                        value={filters.email}
                                        onChange={(e) => setFilters({ ...filters, email: e.target.value })}
                                        className={inputClass}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className={labelClass}>Telefone</label>
                                    <Input
                                        placeholder="Buscar por telefone..."
                                        value={filters.phone}
                                        onChange={(e) => setFilters({ ...filters, phone: e.target.value })}
                                        className={inputClass}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className={labelClass}>CPF/CNPJ</label>
                                    <Input
                                        placeholder="Buscar por documento..."
                                        value={filters.document}
                                        onChange={(e) => setFilters({ ...filters, document: e.target.value })}
                                        className={inputClass}
                                    />
                                </div>
                            </AccordionContent>
                        </AccordionItem>
                    </Accordion>
                </div>

                <SheetFooter className="p-6 border-t border-border bg-muted/20 flex flex-row gap-3">
                    <Button
                        variant="ghost"
                        onClick={resetFilters}
                        className="flex-1 h-12 rounded-2xl text-[10px] font-black uppercase tracking-widest text-destructive hover:bg-destructive/10 border border-destructive/20"
                    >
                        <X className="h-4 w-4 mr-2" />
                        Limpar Tudo
                    </Button>
                </SheetFooter>
            </SheetContent>
        </Sheet>
    );
}
