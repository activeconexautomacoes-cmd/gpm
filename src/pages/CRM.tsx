import { useState, useEffect, useMemo } from "react";
import { toast } from "sonner";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus } from "lucide-react";
import { KanbanBoard } from "@/components/crm/KanbanBoard";
import { OpportunityDialog } from "@/components/crm/OpportunityDialog";
import { MetricsCard } from "@/components/dashboard/MetricsCard";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CommercialDashboard } from "@/components/crm/commercial-dashboard/CommercialDashboard";
import { CRMTable } from "@/components/crm/CRMTable";
import { CRMCalendar } from "@/components/crm/CRMCalendar";
import { CRMActivities } from "@/components/crm/CRMActivities";
import { AdvancedFiltersSheet } from "@/components/crm/AdvancedFiltersSheet";
import { cn } from "@/lib/utils";
import {
  DollarSign,
  Target,
  TrendingUp,
  Clock,
  BarChart3,
  LayoutDashboard,
  List,
  Shield,
  Unlock,
  Filter,
  X,
  Search as SearchIcon,
  Tag,
  Calendar,
  User as UserIcon,
  CheckSquare
} from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
  SheetFooter,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { startOfDay, endOfDay } from "date-fns";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export default function CRM() {
  const { currentWorkspace, can, user } = useWorkspace();
  const queryClient = useQueryClient();

  const [searchTerm, setSearchTerm] = useState("");
  const [opportunityDialogOpen, setOpportunityDialogOpen] = useState(false);
  const [selectedOpportunity, setSelectedOpportunity] = useState<any>(null);
  const [activeTab, setActiveTab] = useState("kanban");

  const [filters, setFilters] = useState<any>({
    stageId: "all",
    sdrId: "all",
    closerId: "all",
    segment: "all",
    source: "all",
    minValue: "",
    maxValue: "",
    minRevenue: "",
    maxRevenue: "",
    minInvestment: "",
    maxInvestment: "",
    utm_source: "",
    utm_medium: "",
    utm_campaign: "",
    productId: "all",
    email: "",
    phone: "",
    document: "",
    startDate: "",
    endDate: "",
    startStageDate: "",
    endStageDate: "",
    minExpectedDate: "",
    maxExpectedDate: "",
    includeTags: [] as string[],
    excludeTags: [] as string[],
    quizIds: [] as string[],
    excludeQuizIds: [] as string[],
    webinarStatuses: [] as string[],
    webhookId: "all",
    startFollowUpDate: "",
    endFollowUpDate: "",
    meMode: false,
    lossReason: "all"
  });


  useEffect(() => {
    setFilters((prev: any) => ({
      ...prev,
      sdrId: "all",
      closerId: "all"
    }));
    setSearchTerm("");
  }, [currentWorkspace?.id]);

  const { data: stages = [] } = useQuery({
    queryKey: ["opportunity-stages", currentWorkspace?.id],
    queryFn: async () => {
      if (!currentWorkspace?.id) return [];

      const { data, error } = await supabase
        .from("opportunity_stages")
        .select("*")
        .eq("workspace_id", currentWorkspace.id)
        .order("order_position");

      if (error) throw error;
      return data || [];
    },
    enabled: !!currentWorkspace?.id,
  });

  const { data: opportunities = [] } = useQuery({
    queryKey: ["opportunities", currentWorkspace?.id],
    queryFn: async () => {
      if (!currentWorkspace?.id) return [];

      let allData: any[] = [];
      let page = 0;
      const pageSize = 1000;
      let hasMore = true;

      while (hasMore) {
        const { data, error } = await supabase
          .from("opportunities")
          .select(`
            *,
            opportunity_products (
              negotiated_price,
              negotiated_implementation_fee,
              products (name)
            ),
            opportunity_stages (id, name, color),
            assigned_sdr_profile:profiles!assigned_sdr (full_name),
            assigned_closer_profile:profiles!assigned_closer (full_name),
            opportunity_tag_assignments (
              tag_id,
              crm_tags (id, name, color)
            ),
            quiz_submissions (
              quiz_id,
              quizzes (title)
            ),
            opportunity_notes (
              id,
              note_type,
              content,
              scheduled_at,
              completed_at,
              created_at
            )
          `)
          .eq("workspace_id", currentWorkspace.id)
          .order("created_at", { ascending: false })
          .range(page * pageSize, (page + 1) * pageSize - 1);

        if (error) {
          console.error("Erro ao buscar oportunidades:", error);
          throw error;
        }

        if (data && data.length > 0) {
          allData = [...allData, ...data];
          hasMore = data.length === pageSize;
          page++;
        } else {
          hasMore = false;
        }
      }

      // Process follow-ups locally
      allData = allData.map(opp => {
        const pendingFollowUps = (opp.opportunity_notes || [])
          .filter((n: any) => n.note_type === 'follow_up' && !n.completed_at && n.scheduled_at)
          .sort((a: any, b: any) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime());

        return {
          ...opp,
          next_follow_up: pendingFollowUps[0] || null
        };
      });

      return allData;
    },
    enabled: !!currentWorkspace?.id,
  });

  const { data: members = [] } = useQuery({
    queryKey: ["workspace-members", currentWorkspace?.id],
    queryFn: async () => {
      if (!currentWorkspace?.id) return [];

      const { data, error } = await supabase
        .from("workspace_members")
        .select(`
          *,
          profiles(id, full_name, email),
          roles (
            id,
            name,
            color,
            role_permissions (
              permissions (
                slug
              )
            )
          )
        `)
        .eq("workspace_id", currentWorkspace.id);

      if (error) throw error;
      return (data || []) as any[];
    },
    enabled: !!currentWorkspace?.id,
  });

  const { data: tags = [] } = useQuery({
    queryKey: ["crm-tags", currentWorkspace?.id],
    queryFn: async () => {
      if (!currentWorkspace?.id) return [];
      const { data, error } = await (supabase as any)
        .from("crm_tags")
        .select("*")
        .eq("workspace_id", currentWorkspace.id)
        .order("name");
      if (error) throw error;
      return data || [];
    },
    enabled: !!currentWorkspace?.id,
  });

  const { data: availableQuizzes = [] } = useQuery({
    queryKey: ["available-quizzes", currentWorkspace?.id],
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

  const { data: webhookIntegrations = [] } = useQuery({
    queryKey: ["webhook-integrations", currentWorkspace?.id],
    queryFn: async () => {
      if (!currentWorkspace?.id) return [];
      const { data, error } = await (supabase as any)
        .from("webhook_integrations")
        .select("id, name")
        .eq("workspace_id", currentWorkspace.id)
        .order("name");
      if (error) throw error;
      return data || [];
    },
    enabled: !!currentWorkspace?.id,
  });

  const hasPermission = (member: any, permission: string) => {
    return member.roles?.role_permissions?.some((rp: any) => rp.permissions?.slug === permission);
  };

  const sdrMembers = members.filter(m => {
    const legacyRole = m.role?.toLowerCase();
    const roleName = m.roles?.name?.toLowerCase();
    return ['sdr', 'sales_manager', 'admin', 'owner'].includes(legacyRole) ||
      ['sdr', 'dono', 'admin', 'gerente de vendas', 'gestor de vendas', 'sales manager', 'owner'].includes(roleName) ||
      hasPermission(m, 'crm.view');
  });
  const closerMembers = members.filter(m => {
    const legacyRole = m.role?.toLowerCase();
    const roleName = m.roles?.name?.toLowerCase();
    return ['closer', 'sales_manager', 'admin', 'owner'].includes(legacyRole) ||
      ['closer', 'dono', 'admin', 'gerente de vendas', 'gestor de vendas', 'sales manager', 'owner'].includes(roleName) ||
      hasPermission(m, 'crm.edit');
  });

  const filteredOpportunities = useMemo(() => {
    return opportunities.filter((opp) => {
      // Basic Search
      const searchLower = searchTerm.toLowerCase();
      const matchesSearch = !searchTerm ||
        [opp.lead_name, opp.lead_company, opp.lead_phone, opp.lead_email]
          .some(field => (field || "").toLowerCase().includes(searchLower));

      // Filters
      const matchesStage = filters.stageId === "all" || opp.current_stage_id === filters.stageId;
      const matchesSdr = filters.sdrId === "all"
        ? true
        : filters.sdrId === "unassigned" ? !opp.assigned_sdr : opp.assigned_sdr === filters.sdrId;
      const matchesCloser = filters.closerId === "all"
        ? true
        : filters.closerId === "unassigned" ? !opp.assigned_closer : opp.assigned_closer === filters.closerId;

      const segments = opp.company_segment;
      const matchesSegment = filters.segment === "all" || segments === filters.segment;
      const matchesSource = filters.source === "all" || opp.source === filters.source;

      const value = Number(opp.negotiated_value || opp.estimated_value || 0);
      const matchesValue = (!filters.minValue || value >= Number(filters.minValue)) &&
        (!filters.maxValue || value <= Number(filters.maxValue));

      const revenue = Number(opp.company_revenue || 0);
      const matchesRevenue = (!filters.minRevenue || revenue >= Number(filters.minRevenue)) &&
        (!filters.maxRevenue || revenue <= Number(filters.maxRevenue));

      const investment = Number(opp.company_investment || 0);
      const matchesInvestment = (!filters.minInvestment || investment >= Number(filters.minInvestment)) &&
        (!filters.maxInvestment || investment <= Number(filters.maxInvestment));

      const utms = opp.custom_fields || {};
      const matchesUtmSource = !filters.utm_source || (utms.utm_source || "").toLowerCase().includes(filters.utm_source.toLowerCase());
      const matchesUtmMedium = !filters.utm_medium || (utms.utm_medium || "").toLowerCase().includes(filters.utm_medium.toLowerCase());
      const matchesUtmCampaign = !filters.utm_campaign || (utms.utm_campaign || "").toLowerCase().includes(filters.utm_campaign.toLowerCase());

      const matchesProduct = filters.productId === "all" ||
        opp.opportunity_products?.some((op: any) => op.products?.name === filters.productId);

      const matchesEmail = !filters.email || (opp.lead_email || "").toLowerCase().includes(filters.email.toLowerCase());
      const matchesPhone = !filters.phone || (opp.lead_phone || "").includes(filters.phone);
      const matchesDocument = !filters.document || (opp.lead_document || "").includes(filters.document);

      // Date Filters
      const oppDate = new Date(opp.created_at);
      const matchesStartDate = !filters.startDate || oppDate >= new Date(filters.startDate + 'T00:00:00');
      const matchesEndDate = !filters.endDate || oppDate <= new Date(filters.endDate + 'T23:59:59');

      const stageDate = opp.stage_changed_at ? new Date(opp.stage_changed_at) : null;
      const matchesStartStageDate = !filters.startStageDate || (stageDate && stageDate >= new Date(filters.startStageDate + 'T00:00:00'));
      const matchesEndStageDate = !filters.endStageDate || (stageDate && stageDate <= new Date(filters.endStageDate + 'T23:59:59'));

      const expDate = opp.expected_close_date;
      const matchesMinExpDate = !filters.minExpectedDate || (expDate && expDate >= filters.minExpectedDate);
      const matchesMaxExpDate = !filters.maxExpectedDate || (expDate && expDate <= filters.maxExpectedDate);

      // Follow-up Date Filter
      const followUpDate = opp.next_follow_up?.scheduled_at ? new Date(opp.next_follow_up.scheduled_at) : null;
      const matchesStartFollowUpDate = !filters.startFollowUpDate || (followUpDate && followUpDate >= new Date(filters.startFollowUpDate + 'T00:00:00'));
      const matchesEndFollowUpDate = !filters.endFollowUpDate || (followUpDate && followUpDate <= new Date(filters.endFollowUpDate + 'T23:59:59'));


      const oppTags = opp.opportunity_tag_assignments?.map((a: any) => a.tag_id) || [];
      const matchesIncludeTags = filters.includeTags.length === 0 ||
        filters.includeTags.some((tid: string) => oppTags.includes(tid));
      const matchesExcludeTags = filters.excludeTags.length === 0 ||
        !filters.excludeTags.some((tid: string) => oppTags.includes(tid));

      const matchesQuiz = filters.quizIds.length === 0 ||
        opp.quiz_submissions?.some((qs: any) => filters.quizIds.includes(qs.quiz_id));
      const matchesExcludeQuiz = filters.excludeQuizIds.length === 0 ||
        !opp.quiz_submissions?.some((qs: any) => filters.excludeQuizIds.includes(qs.quiz_id));

      const oppTagsNames = opp.opportunity_tag_assignments?.map((a: any) => a.crm_tags?.name) || [];
      const isWebinarTag = oppTagsNames.includes("Webnário");
      const isWebinarLead = isWebinarTag || opp.is_held;

      const matchesWebhook = filters.webhookId === "all" ||
        (opp.custom_fields && (opp.custom_fields as any).webhook_id === filters.webhookId);

      let matchesWebinar = true;
      if (filters.webinarStatuses.length > 0) {
        matchesWebinar = filters.webinarStatuses.some(status => {
          if (status === "webinar_all") return isWebinarLead;
          if (status === "webinar_held") return opp.is_held;
          if (status === "webinar_released") return isWebinarTag && !opp.is_held;
          if (status === "all") return true;
          return false;
        });
      }

      const matchesLossReason = filters.lossReason === "all" || opp.loss_reason === filters.lossReason;

      const matchesMeMode = !filters.meMode || (opp.assigned_closer === user?.id || opp.assigned_sdr === user?.id);

      return matchesSearch && matchesStage && matchesSdr && matchesCloser &&
        matchesSegment && matchesSource && matchesValue &&
        matchesRevenue && matchesInvestment &&
        matchesUtmSource && matchesUtmMedium && matchesUtmCampaign &&
        matchesProduct && matchesEmail && matchesPhone && matchesDocument &&
        matchesStartDate && matchesEndDate && matchesStartStageDate && matchesEndStageDate &&
        matchesMinExpDate && matchesMaxExpDate &&
        matchesStartFollowUpDate && matchesEndFollowUpDate &&
        matchesIncludeTags && matchesExcludeTags && matchesQuiz && matchesExcludeQuiz && matchesWebinar && matchesWebhook && matchesLossReason && matchesMeMode;
    });
  }, [opportunities, searchTerm, filters, user?.id]);

  const kanbanOpportunities = useMemo(() => {
    return filteredOpportunities.filter(o => !o.is_held);
  }, [filteredOpportunities]);

  useEffect(() => {
    if (selectedOpportunity) {
      const fresh = opportunities.find(o => o.id === selectedOpportunity.id);
      if (fresh) setSelectedOpportunity(fresh);
    }
  }, [opportunities, selectedOpportunity]);

  const totalValue = filteredOpportunities
    .filter((o) => !o.won_at && !o.lost_at)
    .reduce((sum, opp) => sum + (Number(opp.negotiated_value || opp.estimated_value) || 0), 0);

  const wonCount = opportunities.filter((o) => o.won_at).length;
  const totalCount = opportunities.filter((o) => o.created_at).length;
  const conversionRate = totalCount > 0 ? ((wonCount / totalCount) * 100).toFixed(1) : "0";

  const markAsReadMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any)
        .from("opportunities")
        .update({ is_new_lead: false })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["opportunities", currentWorkspace?.id] });
    }
  });

  const handleCardClick = (opportunity: any) => {
    setSelectedOpportunity(opportunity);
    setOpportunityDialogOpen(true);

    if (opportunity.is_new_lead) {
      markAsReadMutation.mutate(opportunity.id);
    }
  };

  const handleDialogClose = () => {
    setOpportunityDialogOpen(false);
    setSelectedOpportunity(null);
  };

  if (!can('crm.view')) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] text-center space-y-4">
        <div className="p-4 rounded-full bg-muted">
          <Shield className="h-8 w-8 text-muted-foreground" />
        </div>
        <div>
          <h2 className="text-lg font-semibold">Acesso Restrito</h2>
          <p className="text-muted-foreground max-w-sm">
            Você não tem permissão para visualizar o CRM.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white dark:bg-[#0A0510] relative overflow-hidden font-fira-sans text-[#1D4ED8] dark:text-white/90 antialiased transition-colors duration-500">
      {/* Premium Gradient Backgrounds */}
      <div className="absolute top-[-5%] right-[-5%] w-[600px] h-[600px] bg-[#3B82F6]/10 dark:bg-[#3B82F6]/20 rounded-full blur-[120px] -z-10 animate-pulse" />
      <div className="absolute bottom-[-5%] left-[-5%] w-[500px] h-[500px] bg-[#F97316]/5 dark:bg-[#F97316]/10 rounded-full blur-[100px] -z-10" />

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <div className="p-4 md:p-8 space-y-10 max-w-[1700px] mx-auto relative z-10">
          <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6 border-b border-[#3B82F6]/10 dark:border-white/10 pb-8">
            <TabsList className="bg-white/40 dark:bg-white/5 backdrop-blur-md p-1 border border-white/40 dark:border-white/10 rounded-2xl h-14 w-full lg:w-auto">
              <TabsTrigger value="kanban" className="flex-1 lg:px-8 h-12 rounded-xl text-[10px] font-black uppercase tracking-widest data-[state=active]:bg-[#3B82F6] data-[state=active]:text-white transition-all gap-2">
                <LayoutDashboard className="h-4 w-4" />
                Pipeline
              </TabsTrigger>
              <TabsTrigger value="list" className="flex-1 lg:px-8 h-12 rounded-xl text-[10px] font-black uppercase tracking-widest data-[state=active]:bg-[#3B82F6] data-[state=active]:text-white transition-all gap-2">
                <List className="h-4 w-4" />
                Table
              </TabsTrigger>
              <TabsTrigger value="agenda" className="flex-1 lg:px-8 h-12 rounded-xl text-[10px] font-black uppercase tracking-widest data-[state=active]:bg-[#3B82F6] data-[state=active]:text-white transition-all gap-2">
                <Calendar className="h-4 w-4" />
                Agenda
              </TabsTrigger>
              <TabsTrigger value="activities" className="flex-1 lg:px-8 h-12 rounded-xl text-[10px] font-black uppercase tracking-widest data-[state=active]:bg-[#3B82F6] data-[state=active]:text-white transition-all gap-2">
                <CheckSquare className="h-4 w-4" />
                Tasks
              </TabsTrigger>
              <TabsTrigger value="analytics" className="flex-1 lg:px-8 h-12 rounded-xl text-[10px] font-black uppercase tracking-widest data-[state=active]:bg-[#3B82F6] data-[state=active]:text-white transition-all gap-2">
                <BarChart3 className="h-4 w-4" />
                Intel
              </TabsTrigger>
            </TabsList>

            <div className="flex items-center gap-4 bg-white/60 dark:bg-black/60 backdrop-blur-xl p-1.5 rounded-2xl border border-white/60 dark:border-white/10 shadow-xl ring-1 ring-black/5 dark:ring-white/5 w-full lg:w-auto justify-end">
              {can('crm.edit') && opportunities.some(o => o.is_held) && (
                <Button
                  variant="ghost"
                  className="h-11 px-6 justify-start text-left font-black text-[10px] uppercase tracking-widest text-amber-600 hover:bg-amber-500/10 transition-all rounded-xl"
                  onClick={async () => {
                    if (!confirm("Deseja liberar todos os leads de webnário para atendimento?")) return;
                    try {
                      const { error } = await (supabase as any)
                        .from("opportunities")
                        .update({ is_held: false })
                        .eq("workspace_id", currentWorkspace?.id)
                        .eq("is_held", true);

                      if (error) throw error;
                      queryClient.invalidateQueries({ queryKey: ["opportunities", currentWorkspace?.id] });
                      toast.success("Leads liberados com sucesso!");
                    } catch (error: any) {
                      toast.error("Erro ao liberar leads: " + error.message);
                    }
                  }}
                >
                  <Unlock className="h-4 w-4 mr-2" />
                  Liberar Leads
                </Button>
              )}
              {can('crm.edit') && (
                <Button
                  onClick={() => setOpportunityDialogOpen(true)}
                  className="h-11 px-8 bg-[#3B82F6] hover:bg-[#2563EB] text-white font-black text-[10px] uppercase tracking-widest rounded-xl transition-all shadow-lg hover:shadow-[#3B82F6]/40"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Novo Lead
                </Button>
              )}
            </div>
          </div>

          {activeTab !== "activities" && activeTab !== "analytics" && (
            <div className="space-y-10 mt-10">
              <div className={cn(
                "flex flex-col sm:flex-row gap-4 items-center bg-white/40 dark:bg-white/5 backdrop-blur-xl rounded-2xl border border-white/60 dark:border-white/10 shadow-xl w-full",
                activeTab === "analytics" ? "p-1.5 md:p-2" : "p-2"
              )}>
                {activeTab === "analytics" ? (
                  <div className="flex flex-col sm:flex-row items-center gap-3 w-full">
                    <div className="flex items-center gap-3 px-4 border-r border-[#3B82F6]/10 dark:border-white/10 shrink-0">
                      <Filter className="h-4 w-4 text-[#3B82F6] opacity-70" />
                      <span className="text-[10px] font-black uppercase tracking-[0.2em] text-[#1D4ED8]/60 dark:text-white/40">Período</span>
                    </div>

                    <div className="flex items-center gap-1.5 flex-1 w-full sm:w-auto overflow-hidden">
                      <Input
                        type="date"
                        value={filters.startDate}
                        onChange={(e) => setFilters({ ...filters, startDate: e.target.value })}
                        className="h-10 w-full sm:w-[160px] bg-white/50 dark:bg-black/20 border-white/30 dark:border-white/5 rounded-xl text-[10px] font-black uppercase tracking-widest focus:ring-2 ring-[#3B82F6]/20 transition-all border-none"
                      />
                      <span className="text-[9px] font-black text-[#1D4ED8]/30 dark:text-white/20 uppercase px-1">até</span>
                      <Input
                        type="date"
                        value={filters.endDate}
                        onChange={(e) => setFilters({ ...filters, endDate: e.target.value })}
                        className="h-10 w-full sm:w-[160px] bg-white/50 dark:bg-black/20 border-white/30 dark:border-white/5 rounded-xl text-[10px] font-black uppercase tracking-widest focus:ring-2 ring-[#3B82F6]/20 transition-all border-none"
                      />
                      {(filters.startDate || filters.endDate) && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setFilters({ ...filters, startDate: "", endDate: "" })}
                          className="h-10 w-10 p-0 text-rose-500 hover:bg-rose-500/10 rounded-xl shrink-0"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      )}
                    </div>

                    <div className="pl-4 sm:border-l border-[#3B82F6]/10 dark:border-white/10 w-full sm:w-auto">
                      <AdvancedFiltersSheet
                        filters={filters}
                        setFilters={setFilters}
                        searchTerm={searchTerm}
                        setSearchTerm={setSearchTerm}
                        stages={stages}
                        sdrMembers={sdrMembers}
                        closerMembers={closerMembers}
                        triggerClassName="w-full"
                      />
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col sm:flex-row gap-4 items-center flex-1 w-full">
                    <div className="relative flex-1 group">
                      <SearchIcon className="absolute left-4 top-1/2 transform -translate-y-1/2 h-3.5 w-3.5 text-[#3B82F6]/40 dark:text-white/20 group-focus-within:text-[#3B82F6] transition-colors" />
                      <Input
                        placeholder="BUSCAR POR NOME, EMPRESA OU TELEFONE..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-11 h-10 bg-white/50 dark:bg-black/20 border-white/40 dark:border-white/5 rounded-xl text-[10px] font-bold uppercase tracking-widest focus:ring-2 ring-[#3B82F6]/20 transition-all border-none"
                      />
                    </div>

                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        onClick={() => setFilters({ ...filters, meMode: !filters.meMode })}
                        className={cn(
                          "h-10 px-6 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all gap-2.5 border border-transparent",
                          filters.meMode
                            ? "bg-[#3B82F6] text-white shadow-lg shadow-[#3B82F6]/40 hover:bg-[#2563EB]"
                            : "bg-white/60 dark:bg-white/5 text-[#3B82F6] dark:text-[#60A5FA] hover:bg-white/80 dark:hover:bg-white/10 border border-white/60 dark:border-white/5"
                        )}
                      >
                        <UserIcon className="h-3.5 w-3.5" />
                        Modo Eu
                      </Button>

                      <AdvancedFiltersSheet
                        filters={filters}
                        setFilters={setFilters}
                        searchTerm={searchTerm}
                        setSearchTerm={setSearchTerm}
                        stages={stages}
                        sdrMembers={sdrMembers}
                        closerMembers={closerMembers}
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="mt-10">
            <TabsContent value="kanban" className="focus-visible:outline-none">
              <KanbanBoard
                stages={stages}
                opportunities={kanbanOpportunities}
                workspaceId={currentWorkspace?.id}
                onCardClick={handleCardClick}
              />
            </TabsContent>

            <TabsContent value="list" className="focus-visible:outline-none">
              <div className="bg-white/40 dark:bg-white/5 backdrop-blur-xl rounded-[40px] border border-white dark:border-white/10 shadow-2xl p-6 overflow-hidden">
                <CRMTable
                  opportunities={filteredOpportunities}
                  stages={stages}
                  members={members}
                  onCardClick={handleCardClick}
                  filters={filters}
                  setFilters={setFilters}
                  searchTerm={searchTerm}
                  setSearchTerm={setSearchTerm}
                />
              </div>
            </TabsContent>

            <TabsContent value="agenda" className="focus-visible:outline-none">
              <div className="bg-white/40 dark:bg-white/5 backdrop-blur-xl rounded-[40px] border border-white dark:border-white/10 shadow-2xl p-8">
                <CRMCalendar onOpportunityClick={handleCardClick} />
              </div>
            </TabsContent>

            <TabsContent value="activities" className="focus-visible:outline-none">
              <CRMActivities onOpportunityClick={handleCardClick} />
            </TabsContent>

            <TabsContent value="analytics" className="focus-visible:outline-none">
              <CommercialDashboard
                opportunities={opportunities}
                stages={stages}
              />
            </TabsContent>
          </div>

          <OpportunityDialog
            open={opportunityDialogOpen}
            onOpenChange={setOpportunityDialogOpen}
            opportunity={selectedOpportunity}
            onClose={handleDialogClose}
          />
        </div>
      </Tabs>
    </div>
  );
}
