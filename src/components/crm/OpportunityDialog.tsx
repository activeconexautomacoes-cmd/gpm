import React, { useEffect, useState, useMemo } from "react";
import { useForm, useFieldArray, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { formatCurrency, getLocalDateString } from "@/utils/format";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { Button } from "@/components/ui/button";
import { OpportunityTimeline } from "./OpportunityTimeline";
import { OpportunityStagesBar } from "./OpportunityStagesBar";
import { OpportunityActivityEditor } from "./OpportunityActivityEditor";
import { WinConfirmationDialog } from "./WinConfirmationDialog";
import { WinValidationDialog } from "./WinValidationDialog";
import { LossConfirmationDialog } from "./LossConfirmationDialog";
import { LeadScoreFeedbackModal } from "./LeadScoreFeedbackModal";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Label } from "@/components/ui/label";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  CheckCircle,
  XCircle,
  User,
  Building2,
  DollarSign,
  History,
  Paperclip,
  Briefcase,
  Settings,
  MoreHorizontal,
  Mail,
  Phone,
  Users,
  Plus,
  Info,
  ExternalLink,
  MessageSquare,
  Calendar as CalendarIcon,
  Trash2,
  Pencil,
  Check,
  Instagram,
  Globe,
  Sparkles,
  Copy,
  Unlock,
  Tag,
  Video,
  CreditCard,
  FileSignature,
  Loader2,
  CheckCircle2,
  AlertCircle,
  FileText,
  Clock,
  PenTool,
  AlertTriangle,
  RefreshCw,
  Snowflake,
  Sun,
  Flame
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Checkbox } from "@/components/ui/checkbox";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { ptBR } from "date-fns/locale";
import { format } from "date-fns";

const opportunityProductSchema = z.object({
  id: z.string().optional(),
  product_id: z.string().min(1, "Produto é obrigatório"),
  negotiated_price: z.string().or(z.number()),
  negotiated_implementation_fee: z.string().or(z.number()).optional(),
  negotiated_discount: z.string().or(z.number()).optional(),
  negotiated_period: z.string().optional(),
  contract_duration: z.string().optional(),
  contract_custom_duration: z.string().optional(),
  billing_day: z.string().optional(),
  commission_percentage: z.string().or(z.number()).optional(),
});

const opportunitySchema = z.object({
  lead_name: z.string().min(1, "Nome é obrigatório"),
  lead_phone: z.string().min(1, "Telefone é obrigatório"),
  lead_email: z.string().email("Email inválido").optional().or(z.literal("")),
  lead_company: z.string().optional(),
  lead_position: z.string().optional(),
  lead_document: z.string().optional(),
  source: z.string().optional(),
  estimated_value: z.string().optional(),
  // Qualification fields
  qualified_product: z.string().optional(),
  company_size: z.string().optional(),
  company_segment: z.string().optional(),
  company_revenue: z.string().optional(),
  company_instagram: z.string().optional(),
  company_website: z.string().optional(),
  company_investment: z.string().optional(),
  assigned_sdr: z.string().optional(),
  assigned_closer: z.string().optional(),
  session_scheduled_at: z.string().optional(),
  session_meeting_link: z.string().optional(),
  session_status: z.string().optional(),
  expected_close_date: z.string().optional(),
  // Negotiation fields
  negotiated_value: z.string().optional(),
  negotiated_period: z.string().optional(),
  negotiated_custom_period_months: z.string().optional(),
  negotiated_billing_day: z.string().optional(),
  negotiated_implementation_fee: z.string().optional(),
  negotiated_discount: z.string().optional(),
  negotiated_cancellation_penalty: z.string().optional(),
  negotiated_commission_percentage: z.string().optional(),
  negotiated_payment_method: z.string().optional(),
  is_signed: z.boolean().default(false),
  lead_score: z.string().nullable().optional(),
  products: z.array(opportunityProductSchema).default([]),
  tags: z.array(z.string()).default([]),
});

type OpportunityFormValues = z.infer<typeof opportunitySchema>;

interface OpportunityDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  opportunity?: any;
  onClose: () => void;
}

export function OpportunityDialog({
  open,
  onOpenChange,
  opportunity,
  onClose,
}: OpportunityDialogProps) {
  const { currentWorkspace } = useWorkspace();
  const queryClient = useQueryClient();
  const [currentUserRole, setCurrentUserRole] = useState<string | null>(null);
  const [currentUserPermissions, setCurrentUserPermissions] = useState<string[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [winDialogOpen, setWinDialogOpen] = useState(false);
  const [winValidationOpen, setWinValidationOpen] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [createdBillingId, setCreatedBillingId] = useState<string | null>(null);
  const [lossDialogOpen, setLossDialogOpen] = useState(false);
  const [manualContractFile, setManualContractFile] = useState<File | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [scoreModalOpen, setScoreModalOpen] = useState(false);
  const [pendingStageId, setPendingStageId] = useState<string | null>(null);
  const [isEditingContact, setIsEditingContact] = useState(opportunity ? false : true);
  const [isEditingCompany, setIsEditingCompany] = useState(opportunity ? false : true);
  const [isEditingProducts, setIsEditingProducts] = useState(opportunity ? false : true);
  const [editingProductIndex, setEditingProductIndex] = useState<number | null>(null);

  // Closing Workflow State
  const [isGeneratingLink, setIsGeneratingLink] = useState(false);
  const [generatedPaymentUrl, setGeneratedPaymentUrl] = useState<string | null>(null);
  const [isSendingContract, setIsSendingContract] = useState(false);
  const [isSignDialogOpen, setIsSignDialogOpen] = useState(false);
  const [d4signTemplates, setD4signTemplates] = useState<any[]>([]);
  const [isLoadingTemplates, setIsLoadingTemplates] = useState(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("");
  const [signerName, setSignerName] = useState("");
  const [signerEmail, setSignerEmail] = useState("");
  const [isPaymentMethodsDialogOpen, setIsPaymentMethodsDialogOpen] = useState(false);
  const [selectedMethods, setSelectedMethods] = useState<string[]>(["credit_card", "pix"]);

  // Check if workspace has Pagar.me integration configured
  const { data: hasPagarmeKey = false } = useQuery({
    queryKey: ["workspace-pagarme-key", currentWorkspace?.id],
    queryFn: async () => {
      if (!currentWorkspace?.id) return false;
      const { data } = await supabase.rpc("has_workspace_pagarme_key", {
        p_workspace_id: currentWorkspace.id,
      });
      return data ?? false;
    },
    enabled: !!currentWorkspace?.id,
  });

  const form = useForm<OpportunityFormValues>({
    resolver: zodResolver(opportunitySchema),
    defaultValues: {
      lead_name: "",
      lead_phone: "",
      lead_email: "",
      lead_company: "",
      lead_position: "",
      lead_document: "",
      source: "website",
      estimated_value: "",
      qualified_product: "",
      company_size: "",
      company_segment: "",
      company_revenue: "",
      company_instagram: "",
      company_website: "",
      company_investment: "",
      assigned_sdr: "",
      assigned_closer: "",
      session_scheduled_at: "",
      session_meeting_link: "",
      session_status: "",
      expected_close_date: "",
      negotiated_value: "",
      negotiated_period: "",
      negotiated_custom_period_months: "",
      negotiated_billing_day: "",
      negotiated_implementation_fee: "",
      negotiated_discount: "",
      negotiated_cancellation_penalty: "",
      negotiated_payment_method: "",
      is_signed: false,
      products: [],
      tags: [],
    },
  });

  const leadOrigin = useMemo(() => {
    if (!opportunity) return null;

    const tags = opportunity.opportunity_tag_assignments || [];
    const isWebinarTag = tags.some((a: any) => a.crm_tags?.name === "Webnário" || a.crm_tags?.name === "Webnario");

    const isHeld = opportunity.is_held;
    const quizSubmission = opportunity.quiz_submissions?.[0];
    const webhookName = (opportunity.custom_fields as any)?.webhook_name;
    const utmSource = (opportunity.custom_fields as any)?.utm_source;

    if (quizSubmission?.quizzes?.title) {
      return { label: `Quiz: ${quizSubmission.quizzes.title}`, type: 'quiz' };
    }
    if (opportunity.custom_fields?.quiz_title) {
      return { label: `Funil: ${opportunity.custom_fields.quiz_title}`, type: 'quiz' };
    }
    if (isHeld || isWebinarTag) {
      return { label: "Funil: Webnário", type: 'webinar' };
    }
    if (webhookName) {
      return { label: `Funil: ${webhookName}`, type: 'webhook' };
    }
    if (utmSource) {
      return { label: `Origem: ${utmSource}`, type: 'utm' };
    }
    return null;
  }, [opportunity]);

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "products",
  });

  const [schedulerDate, setSchedulerDate] = useState<Date | undefined>(new Date());
  const assignedCloser = form.watch("assigned_closer");

  const { data: slotsData, isLoading: isLoadingSlots } = useQuery({
    queryKey: ['scheduler-slots', assignedCloser, schedulerDate ? format(schedulerDate, 'yyyy-MM-dd') : null],
    queryFn: async () => {
      if (!assignedCloser || !schedulerDate) return { slots: [] };

      const { data, error } = await (supabase as any).functions.invoke('google-calendar', {
        body: {
          action: 'get-slots',
          closer_ids: [assignedCloser],
          date: format(schedulerDate, 'yyyy-MM-dd'),
          duration_minutes: currentWorkspace?.crm_meeting_duration || 30,
          find_nearest: false
        }
      });

      if (error) throw error;
      return data;
    },
    enabled: !!assignedCloser && !!schedulerDate && open,
  });

  const availableSlots = slotsData?.slots || [];

  const [isEditingBooking, setIsEditingBooking] = useState(false);
  const [isCancelingBooking, setIsCancelingBooking] = useState(false);

  const handleDeleteBooking = async () => {
    if (!booking?.id) return;

    try {
      setIsCancelingBooking(true);
      toast.loading("Cancelando reunião no Google Agenda...");

      const { data, error } = await (supabase as any).functions.invoke('google-calendar', {
        body: {
          action: 'delete-booking',
          booking_id: booking.id
        }
      });

      if (error) throw error;

      toast.dismiss();
      toast.success("Reunião cancelada!");
      queryClient.invalidateQueries({ queryKey: ["opportunity-booking", opportunity?.id] });
      queryClient.invalidateQueries({ queryKey: ["opportunities", currentWorkspace?.id] });

      form.setValue("session_scheduled_at", "");
      form.setValue("session_meeting_link", "");
      setIsEditingBooking(false);
    } catch (err: any) {
      toast.dismiss();
      console.error("Erro ao cancelar reunião:", err);
      toast.error("Falha ao cancelar reunião no Google Agenda.");
    } finally {
      setIsCancelingBooking(false);
    }
  };

  const negotiatedPeriod = form.watch("negotiated_period");

  // Detect if negotiated value has changed since payment link was generated
  const currentNegotiatedValue = parseFloat(String(form.watch("negotiated_value") || "0"));

  // Query to get the sale linked to this opportunity to compare values
  const { data: linkedSale } = useQuery({
    queryKey: ["opportunity-sale", opportunity?.id],
    queryFn: async () => {
      if (!opportunity?.id || !opportunity?.payment_link_url) return null;

      const { data, error } = await supabase
        .from("one_time_sales")
        .select("id, amount")
        .eq("opportunity_id", opportunity.id)
        .single();

      if (error) {
        console.log("No linked sale found:", error.message);
        return null;
      }
      return data;
    },
    enabled: !!opportunity?.id && !!opportunity?.payment_link_url,
    staleTime: 1000 * 60 * 5, // Cache for 5 minutes
  });

  // Check if the link needs updating by comparing with the linked sale amount
  const hasPaymentLinkValueChanged = useMemo(() => {
    if (!opportunity?.payment_link_url) return false;

    // If we have a linked sale, compare the amounts
    if (linkedSale?.amount != null) {
      // Compare with a small tolerance for floating point
      return Math.abs(currentNegotiatedValue - linkedSale.amount) > 0.01;
    }

    // No linked sale found - shouldn't happen for valid links
    return false;
  }, [opportunity?.payment_link_url, linkedSale?.amount, currentNegotiatedValue]);

  // Validation for payment link generation - Pagar.me requires company name and document
  const leadCompany = form.watch("lead_company");
  const leadDocument = form.watch("lead_document");
  const canGeneratePaymentLink = !!(leadCompany?.trim() && leadDocument?.trim() && hasPagarmeKey);
  const paymentLinkMissingFields: string[] = [];
  if (!hasPagarmeKey) paymentLinkMissingFields.push("Integração Pagar.me não configurada");
  if (!leadCompany?.trim()) paymentLinkMissingFields.push("Nome da Empresa");
  if (!leadDocument?.trim()) paymentLinkMissingFields.push("CPF/CNPJ");

  // Handle payment link invalidation when values change
  const handleInvalidatePaymentLink = async () => {
    if (!opportunity?.id) return;

    try {
      // Clear the payment link in the database
      // Note: payment_link_amount may not exist in DB yet, so we update only safe columns
      const { error } = await supabase
        .from("opportunities")
        .update({
          payment_link_url: null,
          payment_status: null
        })
        .eq("id", opportunity.id);

      if (error) throw error;

      toast.success("Link de pagamento invalidado. Gere um novo link com os valores atualizados.");
      queryClient.invalidateQueries({ queryKey: ["opportunities"] });
      queryClient.invalidateQueries({ queryKey: ["opportunity", opportunity.id] });
    } catch (error: any) {
      console.error("Erro ao invalidar link:", error);
      toast.error("Erro ao invalidar link: " + error.message);
    }
  };

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
    enabled: !!currentWorkspace?.id && open,
  });

  const { data: products = [] } = useQuery({
    queryKey: ["products", currentWorkspace?.id],
    queryFn: async () => {
      if (!currentWorkspace?.id) return [];

      const { data, error } = await (supabase as any)
        .from("products")
        .select("*")
        .eq("workspace_id", currentWorkspace.id)
        .eq("is_active", true)
        .order("name");

      if (error) throw error;
      return data || [];
    },
    enabled: !!currentWorkspace?.id && open,
  });

  const { data: members = [] } = useQuery({
    queryKey: ["workspace-members", currentWorkspace?.id],
    queryFn: async () => {
      if (!currentWorkspace?.id) return [];

      const { data, error } = await (supabase as any)
        .from("workspace_members")
        .select(`
          *,
          profiles!inner(id, full_name, email),
          roles (
            id,
            name,
            role_permissions (
              permissions (
                slug
              )
            )
          )
        `)
        .eq("workspace_id", currentWorkspace.id);

      if (error) throw error;
      return data || [];
    },
    enabled: !!currentWorkspace?.id && open,
  });

  // Helper to check if member has permission
  const hasPermission = (member: any, permission: string) => {
    return member.roles?.role_permissions?.some((rp: any) => rp.permissions?.slug === permission);
  };

  // Filter members by role (Hybrid: Legacy OR RBAC)
  const sdrMembers = members.filter((m: any) =>
    m.role === 'sdr' || m.role === 'sales_manager' || m.role === 'admin' || m.role === 'owner' || // Legacy
    hasPermission(m, 'crm.view') // RBAC (Broad check for now, can be specific if we distinguish SDR vs Closer later)
  );

  const closerMembers = members.filter((m: any) =>
    m.role === 'closer' || m.role === 'sales_manager' || m.role === 'admin' || m.role === 'owner' || // Legacy
    hasPermission(m, 'crm.edit') // RBAC (Closers usually need edit)
  );
  const { data: currentOppProductsData } = useQuery({
    queryKey: ["opportunity-products", opportunity?.id],
    queryFn: async () => {
      if (!opportunity?.id) return [];
      const { data, error } = await (supabase as any)
        .from("opportunity_products")
        .select("*")
        .eq("opportunity_id", opportunity.id);
      if (error) throw error;
      return data || [];
    },
    enabled: !!opportunity?.id && open,
  });

  // Watch products to auto-calculate sum
  const watchedProducts = useWatch({
    control: form.control,
    name: "products",
  });

  useEffect(() => {
    const total = (watchedProducts || []).reduce((sum, p) => {
      const price = parseFloat(p?.negotiated_price?.toString() || "0") || 0;
      const impl = parseFloat(p?.negotiated_implementation_fee?.toString() || "0") || 0;
      const disc = parseFloat(p?.negotiated_discount?.toString() || "0") || 0;
      return sum + price + impl - disc;
    }, 0);

    form.setValue("estimated_value", total.toString());
    // Only auto-fill negotiated_value if it's empty or matches the previous estimated_value
    // This allows the user to manually override the negotiated value
    const currentNegotiated = form.getValues("negotiated_value");
    const currentEstimated = form.getValues("estimated_value");
    if (!currentNegotiated || currentNegotiated === "0" || currentNegotiated === currentEstimated) {
      form.setValue("negotiated_value", total.toString());
    }
  }, [watchedProducts, form]);

  const { data: allTags = [] } = useQuery({
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
    enabled: !!currentWorkspace?.id && open,
  });

  const { data: assignedTagsData } = useQuery({
    queryKey: ["opportunity-tags", opportunity?.id],
    queryFn: async () => {
      if (!opportunity?.id) return [];
      const { data, error } = await (supabase as any)
        .from("opportunity_tag_assignments")
        .select("tag_id")
        .eq("opportunity_id", opportunity.id);
      if (error) throw error;
      return (data as any[] || []).map(a => a.tag_id);
    },
    enabled: !!opportunity?.id && open,
  });

  useEffect(() => {
    if (assignedTagsData && assignedTagsData.length > 0) {
      form.setValue("tags", assignedTagsData);
    }
  }, [assignedTagsData, form]);

  const createTagMutation = useMutation({
    mutationFn: async ({ name, color }: { name: string, color: string }) => {
      if (!currentWorkspace?.id) throw new Error("Workspace não encontrado");
      const { data, error } = await (supabase as any)
        .from("crm_tags")
        .insert({
          workspace_id: currentWorkspace.id,
          name,
          color
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["crm-tags", currentWorkspace?.id] });
      toast.success("Tag criada!");
    }
  });
  const { data: notesCount = 0 } = useQuery({
    queryKey: ["opportunity-notes-count", opportunity?.id],
    queryFn: async () => {
      if (!opportunity?.id) return 0;
      const { count, error } = await supabase
        .from("opportunity_notes")
        .select("*", { count: 'exact', head: true })
        .eq("opportunity_id", opportunity.id);
      if (error) return 0;
      return count || 0;
    },
    enabled: !!opportunity?.id && open,
  });

  const { data: latestNote } = useQuery({
    queryKey: ["opportunity-latest-note", opportunity?.id],
    queryFn: async () => {
      if (!opportunity?.id) return null;
      const { data, error } = await (supabase as any)
        .from("opportunity_notes")
        .select("created_at")
        .eq("opportunity_id", opportunity.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) return null;
      return data;
    },
    enabled: !!opportunity?.id && open,
  });

  const { data: booking, isLoading: isLoadingBooking } = useQuery({
    queryKey: ["opportunity-booking", opportunity?.id],
    queryFn: async () => {
      if (!opportunity?.id) return null;
      const { data, error } = await (supabase as any)
        .from("bookings")
        .select(`
          *,
          closer:profiles!bookings_closer_id_fkey(
            full_name,
            email
          )
        `)
        .eq("opportunity_id", opportunity.id)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
    enabled: !!opportunity?.id && open,
  });

  const daysOpen = opportunity?.created_at
    ? Math.floor((new Date().getTime() - new Date(opportunity.created_at).getTime()) / (1000 * 60 * 60 * 24))
    : 0;

  const daysInStage = opportunity?.stage_changed_at
    ? Math.floor((new Date().getTime() - new Date(opportunity.stage_changed_at).getTime()) / (1000 * 60 * 60 * 24))
    : 0;

  const daysSinceLastInteraction = latestNote?.created_at
    ? Math.floor((new Date().getTime() - new Date(latestNote.created_at).getTime()) / (1000 * 60 * 60 * 24))
    : daysOpen;

  // Get current user role and ID
  useEffect(() => {
    const fetchUserRole = async () => {
      if (!currentWorkspace?.id) return;

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      setCurrentUserId(user.id);

      // Fetch legacy role and RBAC permissions
      const { data, error } = await (supabase as any)
        .from("workspace_members")
        .select(`
          role,
          roles:role_id (
            name,
            role_permissions (
              permissions ( slug )
            )
          )
        `)
        .eq("workspace_id", currentWorkspace.id)
        .eq("user_id", user.id)
        .single();

      if (!error && data) {
        setCurrentUserRole(data.role);

        // Extract permissions from RBAC
        const permissions: string[] = [];
        if (data.roles?.role_permissions) {
          data.roles.role_permissions.forEach((rp: any) => {
            if (rp.permissions?.slug) {
              permissions.push(rp.permissions.slug);
            }
          });
        }
        setCurrentUserPermissions(permissions);
      }
    };

    if (open) {
      fetchUserRole();
    }
  }, [currentWorkspace?.id, open]);

  useEffect(() => {
    if (!open) return;

    if (opportunity) {
      form.reset({
        lead_name: opportunity.lead_name || "",
        lead_phone: opportunity.lead_phone || "",
        lead_email: opportunity.lead_email || "",
        lead_company: opportunity.lead_company || "",
        lead_position: opportunity.lead_position || "",
        lead_document: opportunity.lead_document || "",
        source: opportunity.source || "website",
        estimated_value: opportunity.estimated_value?.toString() || "",
        qualified_product: opportunity.qualified_product || "",
        company_size: opportunity.company_size || "",
        company_segment: opportunity.company_segment || "",
        company_revenue: opportunity.company_revenue?.toString() || "",
        company_instagram: opportunity.company_instagram || "",
        company_website: opportunity.company_website || "",
        company_investment: opportunity.company_investment || "",
        assigned_sdr: opportunity.assigned_sdr || "",
        assigned_closer: opportunity.assigned_closer || "",
        session_scheduled_at: (opportunity.session_scheduled_at && !isNaN(new Date(opportunity.session_scheduled_at).getTime())) ? format(new Date(opportunity.session_scheduled_at), "yyyy-MM-dd'T'HH:mm") : "",
        session_meeting_link: opportunity.session_meeting_link || "",
        session_status: opportunity.session_status || "",
        expected_close_date: opportunity.expected_close_date || "",
        negotiated_value: opportunity.negotiated_value?.toString() || "",
        negotiated_period: opportunity.negotiated_period || "",
        negotiated_custom_period_months: opportunity.negotiated_custom_period_months?.toString() || "",
        negotiated_billing_day: opportunity.negotiated_billing_day?.toString() || "",
        negotiated_implementation_fee: opportunity.negotiated_implementation_fee?.toString() || "",
        negotiated_discount: opportunity.negotiated_discount?.toString() || "",
        negotiated_cancellation_penalty: opportunity.negotiated_cancellation_penalty?.toString() || "",
        negotiated_commission_percentage: opportunity.negotiated_commission_percentage?.toString() || "",
        negotiated_payment_method: opportunity.negotiated_payment_method || "",
        is_signed: opportunity.is_signed || false,
        lead_score: opportunity.lead_score || null,
        products: (currentOppProductsData as any[] || []).map(p => ({
          id: p.id,
          product_id: p.product_id,
          negotiated_price: p.negotiated_price?.toString() || "0",
          negotiated_implementation_fee: p.negotiated_implementation_fee?.toString() || "0",
          negotiated_discount: p.negotiated_discount?.toString() || "0",
          negotiated_period: p.negotiated_period || "monthly",
          contract_duration: p.contract_duration || "monthly",
          contract_custom_duration: p.contract_custom_duration?.toString() || "",
          billing_day: p.billing_day?.toString() || new Date().getDate().toString(),
          commission_percentage: p.commission_percentage?.toString() || "0",
        })),
      });

      setManualContractFile(null); // Fix spill-over of manual file between modals

      if (opportunity.session_scheduled_at && !isNaN(new Date(opportunity.session_scheduled_at).getTime())) {
        setSchedulerDate(new Date(opportunity.session_scheduled_at));
      } else {
        setSchedulerDate(new Date());
      }

      setIsEditingContact(false);
      setIsEditingCompany(false);
      setIsEditingProducts(false);
    } else {
      setManualContractFile(null);
      form.reset({
        lead_name: "",
        lead_phone: "",
        lead_email: "",
        lead_company: "",
        lead_position: "",
        lead_document: "",
        source: "website",
        estimated_value: "",
        qualified_product: "",
        company_size: "",
        company_segment: "",
        company_revenue: "",
        company_instagram: "",
        company_website: "",
        company_investment: "",
        assigned_sdr: "",
        assigned_closer: "",
        session_scheduled_at: "",
        session_meeting_link: "",
        session_status: "",
        expected_close_date: "",
        negotiated_value: "",
        negotiated_period: "",
        negotiated_custom_period_months: "",
        negotiated_billing_day: "",
        negotiated_implementation_fee: "",
        is_signed: false,
        negotiated_discount: "",
        negotiated_cancellation_penalty: "",
        negotiated_commission_percentage: "",
        negotiated_payment_method: "",
        lead_score: null,
        products: [],
        tags: [],
      });
      setIsEditingContact(true);
      setIsEditingCompany(true);
      setIsEditingProducts(true);
    }
  }, [opportunity?.id, open, currentOppProductsData]);

  const fetchTemplates = async () => {
    try {
      setIsLoadingTemplates(true);
      const { data, error } = await supabase.functions.invoke("d4sign-integration", {
        body: { action: "list-templates", workspaceId: currentWorkspace?.id }
      });
      if (error) throw error;
      // API might return array or object with templates property
      // D4Sign typically returns array of objects {id, name}
      if (Array.isArray(data)) {
        setD4signTemplates(data);
      } else if (data && Array.isArray(data.templates)) {
        setD4signTemplates(data.templates);
      } else {
        console.warn("Unexpected template format", data);
        setD4signTemplates([]);
      }
    } catch (error: any) {
      toast.error("Erro ao carregar modelos de contrato: " + error.message);
    } finally {
      setIsLoadingTemplates(false);
    }
  };

  const handleGeneratePaymentLink = async () => {
    try {
      setIsGeneratingLink(true);
      setIsPaymentMethodsDialogOpen(false);
      const negotiatedValue = parseFloat(String(form.getValues("negotiated_value") || "0"));
      const productsList = form.getValues("products");

      if (negotiatedValue <= 0) {
        toast.error("O valor negociado deve ser maior que zero.");
        return;
      }

      if (!productsList || productsList.length === 0) {
        toast.error("Adicione produtos à negociação antes de gerar o link.");
        return;
      }

      // Map products to items
      const items = productsList.map((p, index) => {
        const productDef = products?.find((prod: any) => prod.id === p.product_id);
        const description = productDef?.name || `Produto ${index + 1}`;
        return {
          code: p.product_id,
          description: description,
          amount: Math.round(parseFloat(String(p.negotiated_price || 0)) * 100),
          quantity: 1
        };
      });

      const payload = {
        opportunity_id: opportunity.id,
        amount: negotiatedValue,
        description: `Proposta para ${form.getValues("lead_company") || form.getValues("lead_name")}`,
        items: items,
        payment_methods: selectedMethods
      };

      const { data, error } = await supabase.functions.invoke("pagarme-payment-link", {
        body: payload
      });

      if (error) throw error;
      if (!data.success) throw new Error(data.error || "Erro ao gerar link");

      setGeneratedPaymentUrl(data.payment_url);
      toast.success("Link de pagamento gerado com sucesso!");

      queryClient.invalidateQueries({ queryKey: ["opportunities"] });
      queryClient.invalidateQueries({ queryKey: ["opportunity", opportunity.id] });

    } catch (error: any) {
      console.error("Error generating link:", error);
      toast.error("Erro ao gerar link de pagamento: " + error.message);
    } finally {
      setIsGeneratingLink(false);
    }
  };

  const handleOpenSignDialog = async () => {
    setIsSignDialogOpen(true);
    // Fetch only if not already loaded or if forced
    if (d4signTemplates.length === 0) {
      await fetchTemplates();
    }
  };

  const handleSendContract = async () => {
    if (!selectedTemplateId) {
      toast.error("Selecione um modelo de contrato.");
      return;
    }

    // Signers validation
    const leadName = form.getValues("lead_name");
    const leadEmail = form.getValues("lead_email");
    const actualSignerName = signerName || leadName;
    const actualSignerEmail = signerEmail || leadEmail;

    if (!actualSignerEmail) {
      toast.error("O lead precisa de um email para assinar.");
      return;
    }

    try {
      setIsSendingContract(true);
      const { data, error } = await supabase.functions.invoke("d4sign-integration", {
        body: {
          opportunityId: opportunity.id,
          templateId: selectedTemplateId,
          signers: [{ name: actualSignerName, email: actualSignerEmail }],
          workspaceId: currentWorkspace?.id
        }
      });

      if (error) throw error;
      if (!data.success) throw new Error(data.error || "Erro ao enviar contrato");

      toast.success("Contrato enviado para assinatura!");
      setIsSignDialogOpen(false);

      queryClient.invalidateQueries({ queryKey: ["opportunities"] });
      queryClient.invalidateQueries({ queryKey: ["opportunity", opportunity.id] });

    } catch (error: any) {
      toast.error("Erro ao enviar contrato: " + error.message);
    } finally {
      setIsSendingContract(false);
    }
  };

  const createMutation = useMutation({
    mutationFn: async (values: OpportunityFormValues) => {
      if (!currentWorkspace?.id) throw new Error("Workspace não encontrado");

      // Get first non-final stage directly from Supabase
      const { data: firstStage, error: stageError } = await (supabase as any)
        .from("opportunity_stages")
        .select("id")
        .eq("workspace_id", currentWorkspace.id)
        .eq("is_final", false)
        .order("order_position")
        .limit(1)
        .maybeSingle();

      if (stageError) throw stageError;
      if (!firstStage) throw new Error("Configure pelo menos um estágio não-final");

      const { data, error } = await (supabase as any)
        .from("opportunities")
        .insert({
          workspace_id: currentWorkspace.id,
          lead_name: values.lead_name,
          lead_phone: values.lead_phone,
          lead_email: values.lead_email || null,
          lead_company: values.lead_company || null,
          lead_position: values.lead_position || null,
          lead_document: values.lead_document || null,
          source: values.source as any,
          estimated_value: values.estimated_value ? parseFloat(values.estimated_value) : null,
          current_stage_id: firstStage.id,
          stage_changed_at: new Date().toISOString(),
          qualified_product: values.qualified_product || null,
          company_size: values.company_size || null,
          company_segment: values.company_segment || null,
          company_revenue: values.company_revenue || null,
          company_instagram: values.company_instagram || null,
          company_website: values.company_website || null,
          company_investment: values.company_investment || null,
          assigned_sdr: values.assigned_sdr || null,
          assigned_closer: values.assigned_closer || null,
          session_scheduled_at: values.session_scheduled_at || null,
          session_meeting_link: values.session_meeting_link || null,
          session_status: values.session_status || null,
          expected_close_date: values.expected_close_date || null,
          negotiated_value: values.negotiated_value ? parseFloat(values.negotiated_value) : null,
          negotiated_period: values.negotiated_period || null,
          negotiated_custom_period_months: values.negotiated_custom_period_months ? parseInt(values.negotiated_custom_period_months) : null,
          negotiated_billing_day: values.negotiated_billing_day ? parseInt(values.negotiated_billing_day) : null,
          negotiated_implementation_fee: values.negotiated_implementation_fee ? parseFloat(values.negotiated_implementation_fee) : null,
          negotiated_discount: values.negotiated_discount ? parseFloat(values.negotiated_discount) : null,
          negotiated_cancellation_penalty: values.negotiated_cancellation_penalty ? parseFloat(values.negotiated_cancellation_penalty) : null,
          negotiated_commission_percentage: values.negotiated_commission_percentage ? parseFloat(values.negotiated_commission_percentage) : null,
          negotiated_payment_method: values.negotiated_payment_method || null,
          is_signed: values.is_signed,
          lead_score: values.lead_score || null,
        } as any)
        .select()
        .single();

      if (error) throw error;

      // Persist products
      if (values.products && values.products.length > 0) {
        const productsToInsert = values.products.map(p => ({
          opportunity_id: data.id,
          product_id: p.product_id,
          negotiated_price: parseFloat(p.negotiated_price.toString()),
          negotiated_implementation_fee: parseFloat(p.negotiated_implementation_fee?.toString() || "0"),
          negotiated_discount: parseFloat(p.negotiated_discount?.toString() || "0"),
          negotiated_period: p.negotiated_period || "monthly",
          contract_duration: p.contract_duration || "monthly",
          contract_custom_duration: p.contract_custom_duration ? parseInt(p.contract_custom_duration.toString()) : null,
          billing_day: p.billing_day ? parseInt(p.billing_day.toString()) : new Date().getDate(),
          commission_percentage: p.commission_percentage ? parseFloat(p.commission_percentage.toString()) : 0
        }));
        const { error: productsError } = await (supabase as any)
          .from("opportunity_products")
          .insert(productsToInsert as any);
        if (productsError) throw productsError;
      }

      // Persist tags
      if (values.tags && values.tags.length > 0) {
        const tagsToInsert = values.tags.map(tagId => ({
          opportunity_id: data.id,
          tag_id: tagId
        }));
        const { error: tagsError } = await (supabase as any)
          .from("opportunity_tag_assignments")
          .insert(tagsToInsert as any);
        if (tagsError) throw tagsError;
      }
      // Trigger integrated booking if date is provided
      if (values.session_scheduled_at && values.assigned_closer) {
        try {
          await (supabase as any).functions.invoke('google-calendar', {
            body: {
              action: 'create-booking',
              opportunity_id: data.id,
              closer_id: values.assigned_closer,
              start_time: new Date(values.session_scheduled_at).toISOString(),
              end_time: new Date(new Date(values.session_scheduled_at).getTime() + (currentWorkspace?.crm_meeting_duration || 30) * 60000).toISOString(),
              lead_email: values.lead_email,
              lead_name: values.lead_name,
              lead_company: values.lead_company,
              summary: currentWorkspace?.crm_meeting_template || "[GPM] Reunião: {lead_name} {lead_company}"
            }
          });
        } catch (err) {
          console.error("Erro ao integrar agenda na criação:", err);
          // Non-blocking error for creation
        }
      }

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["opportunities", currentWorkspace?.id] });
      toast.success("Lead criado com sucesso!");
      onClose();
    },
    onError: (error) => {
      console.error("Erro ao criar lead:", error);
      toast.error("Erro ao criar lead");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      if (!opportunity?.id) throw new Error("ID da oportunidade não encontrado");
      const { error } = await (supabase as any)
        .from("opportunities")
        .delete()
        .eq("id", opportunity.id);
      if (error) throw error;
      return null;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["opportunities", currentWorkspace?.id] });
      toast.success("Lead excluído permanentemente");
      setDeleteDialogOpen(false);
      onClose();
    },
    onError: (error) => {
      console.error("Erro ao excluir lead:", error);
      toast.error("Erro ao excluir o lead");
    }
  });

  const updateMutation = useMutation({
    mutationFn: async (values: OpportunityFormValues) => {
      if (!opportunity?.id) throw new Error("ID da oportunidade não encontrado");

      let finalContractUrl = opportunity.contract_url;
      if (values.is_signed && manualContractFile) {
        const fileExt = manualContractFile.name.split('.').pop();
        const fileName = `${opportunity.id}/opp_${Date.now()}_manual.${fileExt}`;
        const { error: uploadError } = await supabase.storage
          .from("contract-attachments")
          .upload(fileName, manualContractFile);
        if (uploadError) throw uploadError;
        finalContractUrl = fileName;
      } else if (!values.is_signed) {
        finalContractUrl = null;
      }

      const { data, error } = await (supabase as any)
        .from("opportunities")
        .update({
          lead_name: values.lead_name,
          lead_phone: values.lead_phone,
          lead_email: values.lead_email || null,
          lead_company: values.lead_company || null,
          lead_position: values.lead_position || null,
          lead_document: values.lead_document || null,
          source: values.source as any,
          estimated_value: values.estimated_value ? parseFloat(values.estimated_value) : null,
          qualified_product: values.qualified_product || null,
          company_size: values.company_size || null,
          company_segment: values.company_segment || null,
          company_revenue: values.company_revenue || null,
          company_instagram: values.company_instagram || null,
          company_website: values.company_website || null,
          company_investment: values.company_investment || null,
          assigned_sdr: values.assigned_sdr || null,
          assigned_closer: values.assigned_closer || null,
          session_scheduled_at: values.session_scheduled_at || null,
          session_meeting_link: values.session_meeting_link || null,
          session_status: values.session_status || null,
          expected_close_date: values.expected_close_date || null,
          negotiated_value: values.negotiated_value ? parseFloat(values.negotiated_value) : null,
          negotiated_period: values.negotiated_period || null,
          negotiated_custom_period_months: values.negotiated_custom_period_months ? parseInt(values.negotiated_custom_period_months) : null,
          negotiated_billing_day: values.negotiated_billing_day ? parseInt(values.negotiated_billing_day) : null,
          negotiated_implementation_fee: values.negotiated_implementation_fee ? parseFloat(values.negotiated_implementation_fee) : null,
          negotiated_discount: values.negotiated_discount ? parseFloat(values.negotiated_discount) : null,
          negotiated_cancellation_penalty: values.negotiated_cancellation_penalty ? parseFloat(values.negotiated_cancellation_penalty) : null,
          negotiated_commission_percentage: values.negotiated_commission_percentage ? parseFloat(values.negotiated_commission_percentage) : null,
          negotiated_payment_method: values.negotiated_payment_method || null,
          is_signed: values.is_signed,
          contract_url: finalContractUrl || null,
          lead_score: values.lead_score || null,
        } as any)
        .eq("id", opportunity.id)
        .select()
        .single();

      if (error) throw error;

      // Update products: delete and re-insert
      const { error: itemsError } = await (supabase as any)
        .from("opportunity_products")
        .delete()
        .eq("opportunity_id", opportunity.id);

      if (itemsError) throw itemsError;

      if (values.products && values.products.length > 0) {
        const productsToInsert = values.products.map(p => ({
          opportunity_id: opportunity.id,
          product_id: p.product_id,
          negotiated_price: parseFloat(p.negotiated_price.toString()),
          negotiated_implementation_fee: parseFloat(p.negotiated_implementation_fee?.toString() || "0"),
          negotiated_discount: parseFloat(p.negotiated_discount?.toString() || "0"),
          negotiated_period: p.negotiated_period || "monthly",
          contract_duration: p.contract_duration || "monthly",
          contract_custom_duration: p.contract_custom_duration ? parseInt(p.contract_custom_duration.toString()) : null,
          billing_day: p.billing_day ? parseInt(p.billing_day.toString()) : new Date().getDate(),
          commission_percentage: p.commission_percentage ? parseFloat(p.commission_percentage.toString()) : 0
        }));
        const { error: productsError } = await supabase
          .from("opportunity_products")
          .insert(productsToInsert);
        if (productsError) throw productsError;
      }

      // Update tags: delete and re-insert
      const { error: tagsDelError } = await (supabase as any)
        .from("opportunity_tag_assignments")
        .delete()
        .eq("opportunity_id", opportunity.id);

      if (tagsDelError) throw tagsDelError;

      if (values.tags && values.tags.length > 0) {
        const tagsToInsert = values.tags.map(tagId => ({
          opportunity_id: opportunity.id,
          tag_id: tagId
        }));
        const { error: tagsError } = await (supabase as any)
          .from("opportunity_tag_assignments")
          .insert(tagsToInsert as any);
        if (tagsError) throw tagsError;
      }

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["opportunities", currentWorkspace?.id] });
      toast.success("Lead atualizado com sucesso!");
      onClose();
    },
    onError: (error) => {
      console.error("Erro ao atualizar lead:", error);
      toast.error("Erro ao atualizar lead");
    },
  });

  const onError = (errors: any) => {
    console.error("Validation errors:", errors);
    if (Object.keys(errors).length > 0) {
      toast.error("Por favor, corrija os erros no formulário.");

      if (errors.lead_email) {
        toast.error("Email inválido ou incompleto.");
      }
      if (errors.lead_phone) {
        toast.error("Telefone é obrigatório.");
      }
      if (errors.lead_name) {
        toast.error("Nome do Lead é obrigatório.");
      }
    }
  };

  const onSubmit = async (values: OpportunityFormValues) => {
    if (createMutation.isPending || updateMutation.isPending) return;

    // Check if scheduling is attempted without closer
    if (values.session_scheduled_at && !values.assigned_closer) {
      toast.error("Você precisa atribuir um Closer para agendar uma reunião.");
      return;
    }

    if (opportunity) {
      const currentScheduledAt = opportunity.session_scheduled_at ? new Date(opportunity.session_scheduled_at).getTime() : 0;
      const newScheduledAt = values.session_scheduled_at ? new Date(values.session_scheduled_at).getTime() : 0;
      const isDateChanged = newScheduledAt !== currentScheduledAt;

      if (isDateChanged) {
        try {
          toast.loading("Sincronizando com Google Agenda...");

          const duration = currentWorkspace?.crm_meeting_duration || 30;
          const summary = currentWorkspace?.crm_meeting_template || "[GPM] Reunião: {lead_name} {lead_company}";

          if (!values.session_scheduled_at) {
            // REMOVAL: The date was cleared, delete existing booking
            if (booking?.id) {
              await (supabase as any).functions.invoke('google-calendar', {
                body: {
                  action: 'delete-booking',
                  booking_id: booking.id,
                  skip_opportunity_update: true
                }
              });
            }
          } else if (booking?.id) {
            // UPDATE: Move or Patch existing booking
            const { data: edgeData, error: edgeError } = await (supabase as any).functions.invoke('google-calendar', {
              body: {
                action: 'update-booking',
                booking_id: booking.id,
                closer_id: values.assigned_closer,
                start_time: new Date(values.session_scheduled_at).toISOString(),
                end_time: new Date(new Date(values.session_scheduled_at).getTime() + duration * 60000).toISOString(),
                lead_email: values.lead_email,
                lead_name: values.lead_name,
                lead_company: values.lead_company,
                summary: summary
              }
            });

            if (edgeError) throw edgeError;

            if (edgeData?.meetLink) {
              values.session_meeting_link = edgeData.meetLink;
            }
          } else {
            // Create new if no booking exists
            const { data: edgeData, error: edgeError } = await (supabase as any).functions.invoke('google-calendar', {
              body: {
                action: 'create-booking',
                opportunity_id: opportunity.id,
                closer_id: values.assigned_closer,
                start_time: new Date(values.session_scheduled_at).toISOString(),
                end_time: new Date(new Date(values.session_scheduled_at).getTime() + duration * 60000).toISOString(),
                lead_email: values.lead_email,
                lead_name: values.lead_name,
                lead_company: values.lead_company,
                summary: summary
              }
            });

            if (edgeError) throw edgeError;

            if (edgeData?.meetLink) {
              values.session_meeting_link = edgeData.meetLink;
            }
          }

          toast.dismiss();
          toast.success("Agenda atualizada no Google!");
          setIsEditingBooking(false);
          queryClient.invalidateQueries({ queryKey: ["opportunity-booking", opportunity?.id] });
        } catch (error: any) {
          toast.dismiss();
          console.error("Erro ao sincronizar agenda:", error);
          toast.error("Erro ao sincronizar com Google Agenda: " + (error.message || "Erro desconhecido"));
          return;
        }
      } else if (isEditingBooking) {
        // Just closed edit mode without changing date
        setIsEditingBooking(false);
      }

      await updateMutation.mutateAsync(values);
    } else {
      await createMutation.mutateAsync(values);
    }
  };

  const stageMutation = useMutation({
    mutationFn: async (stageId: string) => {
      if (!opportunity?.id) return;

      const { error } = await (supabase as any)
        .from("opportunities")
        .update({
          current_stage_id: stageId,
          stage_changed_at: new Date().toISOString()
        } as any)
        .eq("id", opportunity.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["opportunities", currentWorkspace?.id] });
      queryClient.invalidateQueries({ queryKey: ["opportunity-notes", opportunity?.id] });
      toast.success("Estágio atualizado!");
    },
    onError: (error) => {
      console.error("Erro ao mudar estágio:", error);
      toast.error("Erro ao mudar estágio");
    }
  });

  const handleMarkProposalSent = async () => {
    if (!opportunity?.id) return;

    try {
      const { error } = await (supabase as any)
        .from("opportunities")
        .update({ proposal_sent_at: new Date().toISOString() } as any)
        .eq("id", opportunity.id);

      if (error) throw error;

      queryClient.invalidateQueries({ queryKey: ["opportunities", currentWorkspace?.id] });
      toast.success("Proposta marcada como enviada!");
    } catch (error) {
      console.error("Erro ao marcar proposta:", error);
      toast.error("Erro ao marcar proposta");
    }
  };

  // Helper function to get period in months
  const getPeriodMonths = (period: string, customMonths?: number): number => {
    switch (period) {
      case "monthly": return 1;
      case "quarterly": return 3;
      case "semiannual": return 6;
      case "annual": return 12;
      case "6_months": return 6;
      case "12_months": return 12;
      case "18_months": return 18;
      case "24_months": return 24;
      case "custom": return customMonths || 12;
      default: return 12;
    }
  };

  const mapPeriodToDb = (period: string): string => {
    switch (period) {
      case "monthly": return "custom"; // Or handle as custom with 1 month
      case "quarterly": return "custom"; // Or handle as custom with 3 months
      case "semiannual": return "6_months";
      case "annual": return "12_months";
      default: return period; // already correct or 'custom'
    }
  };

  const getFinalCustomMonths = (period: string, customMonths?: number): number | null => {
    if (period === "monthly") return 1;
    if (period === "quarterly") return 3;
    if (period === "custom") return customMonths || 12;
    return null;
  };

  const generateBillingDates = (
    startDate: string,
    endDate: string,
    billingDay: number
  ): Date[] => {
    const dates: Date[] = [];

    // Parse strings manually to ensure LOCAL time
    const [startYear, startMonth, startDay] = startDate.split('-').map(Number);
    const [endYear, endMonth, endDay] = endDate.split('-').map(Number);

    // Initial Date (First Billing)
    const start = new Date(startYear, startMonth - 1, startDay);
    const end = new Date(endYear, endMonth - 1, endDay, 23, 59, 59);

    let currentDate = new Date(start);

    // Função auxiliar para ajustar o dia respeitando o final do mês
    const adjustDay = (date: Date, day: number) => {
      const year = date.getFullYear();
      const month = date.getMonth();
      const lastDay = new Date(year, month + 1, 0).getDate();
      date.setDate(Math.min(day, lastDay));
    };

    // Ajusta o dia inicial caso a data de início não coincida com o billingDay (se necessário)
    // Mas se é a primeira data, usamos a data de início real.
    // O loop vai incrementar meses.

    // IMPORTANTE: Não pular o primeiro mês. O frontend vai sobrescrever a data da primeira cobrança se for "Paid Now",
    // mas precisamos que essa cobrança exista na lista para que a SEGUNDA cobrança seja o próximo mês.

    while (currentDate <= end) {
      dates.push(new Date(currentDate));

      // Avançar para o próximo mês
      // RESETAR o dia para 1 antes de mudar o mês, para evitar problemas como 31/Jan -> 31/Fev (que vira Março)
      currentDate.setDate(1);
      currentDate.setMonth(currentDate.getMonth() + 1);

      // Agora seta o dia correto (billingDay ou ultimo dia do mês)
      adjustDay(currentDate, billingDay);
    }

    return dates;
  };

  // Mark as Won mutation
  const markAsWonMutation = useMutation({
    mutationFn: async ({
      values,
      sendToD4Sign,
      d4signTemplateId
    }: {
      values: OpportunityFormValues;
      sendToD4Sign?: boolean;
      d4signTemplateId?: string;
    }) => {
      if (!opportunity?.id || !currentWorkspace?.id) throw new Error("Dados faltando");

      if (!values.lead_document) {
        throw new Error("CPF/CNPJ da Empresa é obrigatório para fechar o negócio.");
      }

      let firstBillingId = null;

      // Find "Ganho" stage
      const wonStage = (stages as any[]).find(
        (s) => s.is_final && s.name.toLowerCase().includes("ganho")
      );
      if (!wonStage) throw new Error('Estágio "Ganho" não encontrado');


      // Create or Update Client
      // When email is null, upsert on workspace_id,email won't match (NULL != NULL in PG),
      // so we first try to find an existing client by phone to avoid duplicates.
      let client: any = null;
      let clientError: any = null;

      if (values.lead_email) {
        const result = await (supabase as any)
          .from("clients")
          .upsert({
            workspace_id: currentWorkspace.id,
            name: values.lead_name,
            email: values.lead_email,
            phone: values.lead_phone,
            document: values.lead_document || null,
            status: "active",
            opportunity_id: opportunity.id,
          } as any, {
            onConflict: 'workspace_id,email'
          })
          .select()
          .single();
        client = result.data;
        clientError = result.error;
      } else {
        // No email — find existing by phone or create new
        const { data: existing } = await (supabase as any)
          .from("clients")
          .select("*")
          .eq("workspace_id", currentWorkspace.id)
          .eq("phone", values.lead_phone)
          .maybeSingle();

        if (existing) {
          const result = await (supabase as any)
            .from("clients")
            .update({
              name: values.lead_name,
              document: values.lead_document || null,
              status: "active",
              opportunity_id: opportunity.id,
            })
            .eq("id", existing.id)
            .select()
            .single();
          client = result.data;
          clientError = result.error;
        } else {
          const result = await (supabase as any)
            .from("clients")
            .insert({
              workspace_id: currentWorkspace.id,
              name: values.lead_name,
              phone: values.lead_phone,
              document: values.lead_document || null,
              status: "active",
              opportunity_id: opportunity.id,
            })
            .select()
            .single();
          client = result.data;
          clientError = result.error;
        }
      }

      if (clientError) throw clientError;

      // Calculate totals from products
      const pSummary = values.products.reduce((acc, p) => ({
        price: acc.price + (parseFloat(p.negotiated_price?.toString()) || 0),
        impl: acc.impl + (parseFloat(p.negotiated_implementation_fee?.toString() || "0") || 0),
        disc: acc.disc + (parseFloat(p.negotiated_discount?.toString() || "0") || 0),
      }), { price: 0, impl: 0, disc: 0 });

      // Calculate contract dates - use first product's duration if available
      const firstProd = values.products[0];
      const contractDuration = firstProd?.contract_duration || "annual";
      const billingDay = parseInt(firstProd?.billing_day?.toString() || new Date().getDate().toString());

      const startDate = getLocalDateString();
      const periodMonths = getPeriodMonths(contractDuration, firstProd?.contract_custom_duration ? parseInt(firstProd.contract_custom_duration) : undefined);

      const endDate = new Date();
      endDate.setMonth(endDate.getMonth() + periodMonths);
      const endDateString = getLocalDateString(endDate);

      // Create Contract
      // Check if there are any recurring products by looking up the actual product type
      const hasRecurringProducts = values.products.some((p: any) => {
        const productData = (products as any[]).find(prod => prod.id === p.product_id);
        return productData?.type === 'recurring';
      });

      let contract: any = null;
      let billings: any[] = [];

      if (hasRecurringProducts) {
        // Create Contract only if recurring
        const { data: newContract, error: contractError } = await (supabase as any)
          .from("contracts")
          .insert({
            workspace_id: currentWorkspace.id,
            client_id: client.id,
            opportunity_id: opportunity.id,
            name: values.lead_company || `Contrato - ${values.lead_name}`,
            value: pSummary.price,
            start_date: startDate,
            end_date: endDateString,
            contract_period: mapPeriodToDb(contractDuration as any),
            custom_period_months: getFinalCustomMonths(contractDuration, firstProd?.contract_custom_duration ? parseInt(firstProd.contract_custom_duration) : undefined),
            billing_day: billingDay,
            implementation_fee: pSummary.impl,
            commission_percentage: parseFloat((values.products as any[]).find(p => p.commission_percentage && p.commission_percentage !== "0")?.commission_percentage?.toString() || "0"),
            status: "active",
            d4sign_template_id: d4signTemplateId || null,
          } as any)
          .select()
          .single();

        if (contractError) throw contractError;
        contract = newContract;
      }

      // Generate all billings if end_date exists AND contract exists
      const billingDates = generateBillingDates(
        startDate,
        endDateString,
        billingDay
      );

      if (contract && billingDates.length > 0) {
        const implementationFee = pSummary.impl;
        const discount = pSummary.disc;
        const baseAmount = pSummary.price;

        const billingsToInsert = billingDates.map((date, index) => {
          const isFirstBilling = index === 0;
          const finalAmount = baseAmount + (isFirstBilling ? implementationFee - discount : 0);

          // Fix: Check if already paid via Payment Link
          const isPaid = isFirstBilling && opportunity?.payment_status === 'paid';

          return {
            workspace_id: currentWorkspace.id,
            contract_id: contract.id,
            due_date: isPaid ? getLocalDateString(new Date()) : getLocalDateString(date),
            amount: baseAmount,
            discount: isFirstBilling ? discount : 0,
            final_amount: finalAmount,
            status: isPaid ? "paid" : "pending",
            payment_date: isPaid ? getLocalDateString() : null,
            payment_method: values.negotiated_payment_method || null,
            notes: isPaid ? "Pago via Link de Pagamento (Pagar.me)" : null
          };
        });

        const { data: insertedBillings, error: billingError } = await (supabase as any)
          .from("contract_billings")
          .insert(billingsToInsert as any)
          .select();

        if (billingError) throw billingError;

        firstBillingId = insertedBillings && insertedBillings.length > 0 ? insertedBillings[0].id : null;

        // INTEGRAÇÃO FINANCEIRA: A criação de lançamentos no Contas a Receber é feita via Trigger no Banco (tr_auto_create_receivable).
        // Não criar manualmente aqui para evitar duplicidade.
      }

      // Update Opportunity
      // Update Opportunity with Signature Status
      const updatePayload: any = {
        current_stage_id: wonStage.id,
        won_at: new Date().toISOString(),
        converted_client_id: client.id,
        converted_contract_id: contract?.id || null,
        is_signed: values.is_signed,
      };

      if (values.is_signed) {
        updatePayload.signed_at = new Date().toISOString();
        updatePayload.contract_signature_status = 'signed';
      }

      const { error: oppError } = await (supabase as any)
        .from("opportunities")
        .update(updatePayload)
        .eq("id", opportunity.id);

      if (oppError) throw oppError;

      // Handle D4Sign if enabled
      if (sendToD4Sign && d4signTemplateId) {
        try {
          await supabase.functions.invoke("d4sign-integration", {
            body: {
              contractId: contract.id,
              templateId: d4signTemplateId,
              workspaceId: currentWorkspace.id,
              signers: [
                {
                  name: values.lead_name || "Cliente",
                  email: values.lead_email || "",
                  document: values.lead_document || "",
                }
              ]
            }
          });
        } catch (error) {
          console.error("Erro ao enviar para D4Sign:", error);
          toast.error("Venda salva, mas houve erro ao enviar para D4Sign.");
        }
      }

      // Handle Manual Contract File if uploaded
      if (values.is_signed && manualContractFile && contract) {
        try {
          const fileExt = manualContractFile.name.split('.').pop();
          const fileName = `${contract.id}/${Date.now()}_manual.${fileExt}`;

          const { error: uploadError } = await supabase.storage
            .from("contract-attachments")
            .upload(fileName, manualContractFile);

          if (uploadError) throw uploadError;

          const { data: { user } } = await supabase.auth.getUser();

          await supabase
            .from("contract_attachments")
            .insert({
              contract_id: contract.id,
              file_name: manualContractFile.name,
              file_type: manualContractFile.type,
              file_size: manualContractFile.size,
              file_url: fileName,
              uploaded_by: user?.id,
            });
        } catch (fileErr) {
          console.error("Erro ao subir contrato manual:", fileErr);
          toast.error("Venda salva, mas houve erro ao subir o arquivo do contrato.");
        }
      }

      return { client, contract, firstBillingId };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["opportunities", currentWorkspace?.id] });
      queryClient.invalidateQueries({ queryKey: ["clients"] });
      queryClient.invalidateQueries({ queryKey: ["contracts"] });

      if (result.firstBillingId) {
        setCreatedBillingId(result.firstBillingId);
        setWinDialogOpen(false);
        setShowSuccess(true);
      } else {
        toast.success("Venda convertida com sucesso! Cliente e Contrato criados.");
        setWinDialogOpen(false);
        onClose();
      }
    },
    onError: (error: any) => {
      console.error("Erro ao converter venda:", error);

      // Handle custom database triggers errors
      if (error.code === "P0001" || error.message?.includes("Ação bloqueada")) {
        toast.error("Bloqueio: É obrigatório ter o contrato assinado para marcar como Ganho.", {
          duration: 5000,
          description: "Produtos com assinatura obrigatória exigem confirmação do contrato (D4Sign ou Manual).",
        });
      } else {
        toast.error("Erro ao converter venda: " + (error.message || "Erro desconhecido"));
      }
    },
  });

  // Mark as Lost mutation
  const markAsLostMutation = useMutation({
    mutationFn: async ({ reason, notes }: { reason: string; notes?: string }) => {
      if (!opportunity?.id) throw new Error("Oportunidade não encontrada");

      // Find "Perdido" stage
      const lostStage = (stages as any[]).find(
        (s) => s.is_final && s.name.toLowerCase().includes("perdido")
      );
      if (!lostStage) throw new Error('Estágio "Perdido" não encontrado');

      const { error } = await supabase
        .from("opportunities")
        .update({
          current_stage_id: lostStage.id,
          lost_at: new Date().toISOString(),
          loss_reason: reason as any,
          loss_notes: notes || null,
        })
        .eq("id", opportunity.id);

      if (error) throw error;

      // Register loss reason in timeline
      const lossReasonLabels: Record<string, string> = {
        high_price: "Preço muito alto",
        competitor: "Escolheu concorrente",
        bad_timing: "Timing inadequado",
        no_budget: "Sem orçamento",
        no_authority: "Sem autoridade/decisão",
        no_need: "Sem necessidade",
        no_response: "Sem resposta",
        other: "Outro motivo",
      };

      const reasonLabel = lossReasonLabels[reason] || reason;
      const noteContent = `**Oportunidade marcada como PERDIDA**\n\n**Motivo:** ${reasonLabel}${notes ? `\n\n**Observações:** ${notes}` : ""}`;

      await supabase.from("opportunity_notes").insert({
        opportunity_id: opportunity.id,
        content: noteContent,
        note_type: "loss",
        created_by: currentUserId,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["opportunities", currentWorkspace?.id] });
      queryClient.invalidateQueries({ queryKey: ["opportunity-notes", opportunity?.id] });
      toast.success("Oportunidade marcada como perdida");
      setLossDialogOpen(false);
      onClose();
    },
    onError: (error) => {
      console.error("Erro ao marcar como perdido:", error);
      toast.error("Erro ao marcar como perdido");
    },
  });

  // Check if user can finalize - All CRM users can mark as won/lost
  const canFinalize =
    // Legacy sales roles
    (currentUserRole && ['owner', 'admin', 'sales_manager', 'sdr', 'closer', 'member'].includes(currentUserRole)) ||
    // RBAC: Anyone with crm.view or crm.edit can finalize
    currentUserPermissions.includes('crm.view') ||
    currentUserPermissions.includes('crm.edit');

  // Check if user can view negotiation tab
  const canViewNegotiation =
    (currentUserRole && ['closer', 'sales_manager', 'admin', 'owner'].includes(currentUserRole)) ||
    currentUserPermissions.includes('crm.edit');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] w-full max-h-[95vh] overflow-y-auto p-0 gap-0">
        <DialogHeader className="px-6 py-3 border-b border-border bg-background sticky top-0 z-30">
          <div className="flex items-center justify-between">
            <DialogTitle className="text-xl font-bold text-foreground">
              {opportunity ? "Negócio" : "Novo Lead"}
            </DialogTitle>
            <div className="flex items-center gap-2">
              {opportunity?.is_held && (
                <Button
                  type="button"
                  variant="outline"
                  className="h-8 border-amber-500 text-amber-500 hover:bg-amber-500 hover:text-white"
                  onClick={async () => {
                    try {
                      const { error } = await (supabase as any)
                        .from("opportunities")
                        .update({ is_held: false })
                        .eq("id", opportunity.id);

                      if (error) throw error;
                      toast.success("Lead liberado para atendimento!");
                      queryClient.invalidateQueries({ queryKey: ["opportunities"] });
                      queryClient.invalidateQueries({ queryKey: ["opportunity", opportunity.id] });
                      onClose();
                    } catch (error: any) {
                      toast.error("Erro ao liberar lead");
                    }
                  }}
                >
                  <Unlock className="h-3 w-3 mr-2" />
                  Liberar para SDR
                </Button>
              )}
              <Button type="button" variant="outline" onClick={onClose} size="sm" className="h-8">
                Cancelar
              </Button>
              <Button
                type="submit"
                form="opportunity-form"
                size="sm"
                className="h-8 px-6 shadow-sm bg-indigo-600 hover:bg-indigo-700"
                disabled={createMutation.isPending || updateMutation.isPending || isLoadingBooking}
              >
                {opportunity ? "Salvar Alterações" : "Criar Lead"}
              </Button>
            </div>
          </div>
        </DialogHeader>


        {showSuccess && createdBillingId ? (
          <div className="py-12 px-10 space-y-8 animate-in zoom-in-95 duration-300">
            <div className="bg-emerald-50 border border-emerald-100 rounded-[32px] p-10 text-center">
              <div className="w-20 h-20 bg-emerald-500 rounded-3xl flex items-center justify-center text-white mx-auto mb-6 shadow-xl shadow-emerald-200 rotate-3">
                <CheckCircle className="w-12 h-12" />
              </div>
              <h3 className="text-3xl font-black text-emerald-900 mb-2">Venda Garantida!</h3>
              <p className="text-emerald-700 font-bold">O lead foi convertido, e o contrato já foi gerado com sucesso.</p>
            </div>

            <div className="space-y-4">
              <Label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 ml-1">Link de Pagamento para o Cliente</Label>
              <div className="flex gap-3">
                <Input
                  readOnly
                  value={`${window.location.origin}/invoice/${createdBillingId}`}
                  className="h-14 bg-slate-50 border-2 border-slate-100 rounded-2xl font-mono text-xs px-6"
                />
                <Button
                  onClick={() => {
                    navigator.clipboard.writeText(`${window.location.origin}/invoice/${createdBillingId}`);
                    toast.success("Link copiado!");
                  }}
                  variant="outline"
                  className="h-14 w-14 rounded-2xl border-2 border-slate-100 hover:bg-slate-50 transition-all"
                >
                  <Copy className="h-5 w-5 text-slate-400" />
                </Button>
              </div>
            </div>

            <div className="flex gap-4 pt-4">
              <Button
                variant="outline"
                className="flex-1 h-16 rounded-[24px] font-black text-slate-500 border-2 border-slate-100 hover:bg-slate-50"
                onClick={() => {
                  setShowSuccess(false);
                  setCreatedBillingId(null);
                  onClose();
                }}
              >
                FECHAR
              </Button>
              <Button
                className="flex-1 h-16 rounded-[24px] font-black bg-primary text-white shadow-xl shadow-primary/20 hover:scale-[1.02] active:scale-[0.98] transition-all"
                onClick={() => window.open(`${window.location.origin}/invoice/${createdBillingId}`, '_blank')}
              >
                VISUALIZAR FATURA
              </Button>
            </div>
          </div>
        ) : (
          <Form {...form}>
            <form
              id="opportunity-form"
              onSubmit={form.handleSubmit(onSubmit, onError)}
              className="bg-muted/10 min-h-full"
            >
              {/* Pipeline / Stages Bar */}
              <div className="bg-background border-b border-border px-6 py-3 sticky top-[57px] z-20 flex items-center justify-between gap-6">
                <div className="flex-1 overflow-x-auto no-scrollbar">
                  <OpportunityStagesBar
                    stages={(stages as any[] || []).filter(s => !s.is_final)}
                    currentStageId={opportunity?.current_stage_id}
                    wonAt={opportunity?.won_at}
                    lostAt={opportunity?.lost_at}
                    onStageClick={(stageId) => {
                      const stage = (stages as any[]).find(s => s.id === stageId);
                      if (stage?.is_final) {
                        if (stage.name.toLowerCase().includes("ganho")) setWinValidationOpen(true);
                        else if (stage.name.toLowerCase().includes("perdido")) setLossDialogOpen(true);
                      } else {
                        if (stage?.requires_lead_score_feedback) {
                          setPendingStageId(stageId);
                          setScoreModalOpen(true);
                        } else {
                          stageMutation.mutate(stageId);
                        }
                      }
                    }}
                  />
                </div>

                {opportunity && (
                  <div className="flex items-center gap-2 border-l pl-6 shrink-0">
                    {opportunity.won_at ? (
                      <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-200 border-none px-4 py-1 text-[10px] font-black uppercase tracking-wider">
                        Ganho
                      </Badge>
                    ) : opportunity.lost_at ? (
                      <Badge className="bg-red-100 text-red-700 hover:bg-red-200 border-none px-4 py-1 text-[10px] font-black uppercase tracking-wider">
                        Perdido
                      </Badge>
                    ) : canFinalize ? (
                      <>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-8 px-4 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 hover:border-emerald-300 text-[10px] font-bold uppercase transition-all"
                          onClick={() => setWinValidationOpen(true)}
                        >
                          Ganhou
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-8 px-4 text-muted-foreground hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 text-[10px] font-bold uppercase transition-all"
                          onClick={() => setLossDialogOpen(true)}
                        >
                          Perdeu
                        </Button>
                      </>
                    ) : null}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-12 gap-6 p-6 max-w-[1600px] mx-auto">
                {/* ... REST OF THE FORM CONTENT ... */}

                {/* LEFT COLUMN: Lead & Empresa (3/12) */}
                <div className="md:col-span-3 space-y-6">
                  {/* Summary Card */}
                  <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
                    <div className="p-5 flex flex-col items-center text-center">
                      <div className="relative mb-4">
                        <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center border border-primary/20 shadow-inner">
                          <Briefcase className="w-7 h-7 text-primary" />
                        </div>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button type="button" className="absolute -top-1 -right-1 p-1 bg-background rounded-full border border-border shadow-sm hover:bg-muted">
                              <MoreHorizontal className="w-3.5 h-3.5 text-muted-foreground" />
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              className="text-rose-600 focus:text-rose-600 cursor-pointer gap-2"
                              onClick={() => setDeleteDialogOpen(true)}
                            >
                              <Trash2 className="w-4 h-4" />
                              Excluir Oportunidade
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                      <h2 className="font-bold text-lg text-card-foreground leading-tight mb-1">
                        {opportunity?.lead_name || "Sem Nome"}
                      </h2>
                      <p className="text-[11px] text-muted-foreground font-medium uppercase tracking-wider mb-6">
                        Criado em {opportunity?.created_at ? new Date(opportunity.created_at).toLocaleDateString() : 'Hoje'}
                      </p>

                      <div className="w-full space-y-4 pt-4 border-t border-border">
                        <FormField
                          control={form.control}
                          name="lead_score"
                          render={({ field }) => (
                            <FormItem className="space-y-1 text-left w-full">
                              <FormLabel className="flex items-center gap-1.5 text-[10px] text-muted-foreground uppercase font-bold tracking-tight">
                                Temperatura do Lead
                              </FormLabel>
                              <Select onValueChange={field.onChange} value={field.value || undefined}>
                                <FormControl>
                                  <SelectTrigger className="h-9 w-full border-border bg-background shadow-sm hover:border-[#3B82F6]/50 transition-colors">
                                    <SelectValue placeholder="Sem Avaliação">
                                      {field.value === 'frio' && (
                                        <div className="flex items-center gap-2 text-sky-500 font-bold text-xs"><Snowflake className="h-3.5 w-3.5" /> Frio</div>
                                      )}
                                      {field.value === 'morno' && (
                                        <div className="flex items-center gap-2 text-amber-500 font-bold text-xs"><Sun className="h-3.5 w-3.5" /> Morno</div>
                                      )}
                                      {field.value === 'quente' && (
                                        <div className="flex items-center gap-2 text-rose-500 font-bold text-xs"><Flame className="h-3.5 w-3.5" /> Quente</div>
                                      )}
                                      {!field.value && <span className="text-muted-foreground text-xs">Sem avaliação</span>}
                                    </SelectValue>
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  <SelectItem value="frio">
                                    <div className="flex items-center gap-2 text-sky-500 font-bold"><Snowflake className="h-4 w-4" /> Frio</div>
                                  </SelectItem>
                                  <SelectItem value="morno">
                                    <div className="flex items-center gap-2 text-amber-500 font-bold"><Sun className="h-4 w-4" /> Morno</div>
                                  </SelectItem>
                                  <SelectItem value="quente">
                                    <div className="flex items-center gap-2 text-rose-500 font-bold"><Flame className="h-4 w-4" /> Quente</div>
                                  </SelectItem>
                                </SelectContent>
                              </Select>
                            </FormItem>
                          )}
                        />

                        <div className="grid grid-cols-2 gap-3 w-full">
                          <FormField
                            control={form.control}
                            name="assigned_sdr"
                            render={({ field }) => (
                              <FormItem className="space-y-1 text-left">
                                <FormLabel className="text-[10px] text-muted-foreground uppercase font-bold tracking-tight">SDR</FormLabel>
                                <Select onValueChange={field.onChange} value={field.value}>
                                  <FormControl>
                                    <SelectTrigger className="h-8 text-xs border-transparent bg-muted/50">
                                      <SelectValue placeholder="SDR..." />
                                    </SelectTrigger>
                                  </FormControl>
                                  <SelectContent>
                                    {(sdrMembers || []).map((m) => {
                                      const profile = Array.isArray(m.profiles) ? m.profiles[0] : m.profiles;
                                      return (
                                        <SelectItem key={m.user_id || profile?.id} value={m.user_id || profile?.id}>
                                          {profile?.full_name || profile?.email || "Usuário sem nome"}
                                        </SelectItem>
                                      );
                                    })}
                                  </SelectContent>
                                </Select>
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={form.control}
                            name="assigned_closer"
                            render={({ field }) => (
                              <FormItem className="space-y-1 text-left">
                                <FormLabel className="text-[10px] text-muted-foreground uppercase font-bold tracking-tight">Closer</FormLabel>
                                <Select onValueChange={field.onChange} value={field.value}>
                                  <FormControl>
                                    <SelectTrigger className="h-8 text-xs border-transparent bg-muted/50">
                                      <SelectValue placeholder="Closer..." />
                                    </SelectTrigger>
                                  </FormControl>
                                  <SelectContent>
                                    {(closerMembers || []).map((m) => {
                                      const profile = Array.isArray(m.profiles) ? m.profiles[0] : m.profiles;
                                      return (
                                        <SelectItem key={m.user_id || profile?.id} value={m.user_id || profile?.id}>
                                          {profile?.full_name || profile?.email || "Usuário sem nome"}
                                        </SelectItem>
                                      );
                                    })}
                                  </SelectContent>
                                </Select>
                              </FormItem>
                            )}
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Contact Section */}
                  <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden transition-all duration-300">
                    <div className="p-4 border-b bg-muted/50 flex items-center justify-between">
                      <h3 className="font-bold text-xs uppercase tracking-wider text-foreground flex items-center gap-2">
                        <User className="w-4 h-4 text-primary" /> Contato
                      </h3>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className={cn(
                          "h-8 w-8 transition-colors",
                          isEditingContact ? "text-primary bg-primary/10" : "text-muted-foreground hover:text-primary"
                        )}
                        onClick={() => setIsEditingContact(!isEditingContact)}
                      >
                        {isEditingContact ? (
                          <Check className="w-4 h-4" />
                        ) : (
                          <Pencil className="w-4 h-4" />
                        )}
                      </Button>
                    </div>
                    <div className="p-4">
                      {!isEditingContact ? (
                        <div className="flex gap-3">
                          <Avatar className="h-10 w-10 border border-border shadow-sm">
                            <AvatarFallback className="bg-primary/10 text-primary text-xs font-bold">
                              {opportunity?.lead_name?.substring(0, 1).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <div className="min-w-0">
                            <h4 className="font-bold text-sm text-foreground truncate">{form.watch("lead_name")}</h4>
                            <p className="text-xs text-muted-foreground truncate">{form.watch("lead_company")}</p>
                            <p className="text-[11px] text-primary mt-1 cursor-pointer hover:underline truncate">{form.watch("lead_email")}</p>
                            <p className="text-xs text-muted-foreground mt-0.5">{form.watch("lead_phone")}</p>
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-4 pt-1 animate-in fade-in slide-in-from-top-1 duration-200">
                          <FormField
                            control={form.control}
                            name="lead_name"
                            render={({ field }) => (
                              <FormItem className="space-y-1">
                                <FormLabel className="text-[10px] text-muted-foreground uppercase font-bold tracking-tight">Nome do Lead</FormLabel>
                                <FormControl>
                                  <Input {...field} className="h-8 text-xs border-border bg-background focus:bg-background" />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={form.control}
                            name="lead_email"
                            render={({ field }) => (
                              <FormItem className="space-y-1">
                                <FormLabel className="text-[10px] text-muted-foreground uppercase font-bold tracking-tight">Email</FormLabel>
                                <FormControl>
                                  <Input {...field} className="h-8 text-xs border-border bg-background focus:bg-background" />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <div className="grid grid-cols-1">
                            <FormField
                              control={form.control}
                              name="lead_phone"
                              render={({ field }) => (
                                <FormItem className="space-y-1">
                                  <FormLabel className="text-[10px] text-muted-foreground uppercase font-bold tracking-tight">WhatsApp</FormLabel>
                                  <FormControl>
                                    <Input {...field} className="h-8 text-xs border-border bg-background focus:bg-background" />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Company Section */}
                  <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden transition-all duration-300">
                    <div className="p-4 border-b bg-muted/50 flex items-center justify-between">
                      <h3 className="font-bold text-xs uppercase tracking-wider text-foreground flex items-center gap-2">
                        <Building2 className="w-4 h-4 text-primary" /> Empresa
                      </h3>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className={cn(
                          "h-8 w-8 transition-colors",
                          isEditingCompany ? "text-primary bg-primary/10" : "text-muted-foreground hover:text-primary"
                        )}
                        onClick={() => setIsEditingCompany(!isEditingCompany)}
                      >
                        {isEditingCompany ? (
                          <Check className="w-4 h-4" />
                        ) : (
                          <Pencil className="w-4 h-4" />
                        )}
                      </Button>
                    </div>
                    <div className="p-4">
                      {!isEditingCompany ? (
                        <div className="space-y-4">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-muted/50 rounded-lg flex items-center justify-center border border-border">
                              <Building2 className="w-5 h-5 text-muted-foreground" />
                            </div>
                            <div>
                              <h4 className="font-bold text-sm text-foreground">{form.watch("lead_company") || "Não cadastrada"}</h4>
                              <p className="text-[10px] text-muted-foreground uppercase font-medium">{form.watch("company_segment") || "Segmento não informado"}</p>
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-y-3 gap-x-4 pt-2 border-t border-border">
                            <div className="space-y-0.5">
                              <p className="text-[10px] text-muted-foreground uppercase font-bold">Faturamento</p>
                              <p className="text-xs font-semibold text-foreground">
                                {form.watch("company_revenue") || "---"}
                              </p>
                            </div>
                            <div className="space-y-0.5">
                              <p className="text-[10px] text-muted-foreground uppercase font-bold">Funcionários</p>
                              <p className="text-xs font-semibold text-foreground">{form.watch("company_size") || "---"}</p>
                            </div>
                            <div className="space-y-0.5">
                              <p className="text-[10px] text-muted-foreground uppercase font-bold">Investimento Ads</p>
                              <p className="text-xs font-semibold text-foreground">
                                {form.watch("company_investment") || "---"}
                              </p>
                            </div>
                          </div>

                          <div className="flex flex-col gap-2 pt-2 border-t border-border">
                            {form.watch("company_instagram") && (
                              <div
                                className="flex items-center gap-2 text-xs text-pink-600 font-medium cursor-pointer hover:underline"
                                onClick={() => {
                                  const handle = form.watch("company_instagram")?.replace("@", "");
                                  window.open(`https://instagram.com/${handle}`, '_blank');
                                }}
                              >
                                <Instagram className="w-3.5 h-3.5" />
                                <span className="truncate">{form.watch("company_instagram")}</span>
                              </div>
                            )}
                            {form.watch("company_website") && (
                              <div className="flex items-center gap-2 text-xs text-blue-600 font-medium cursor-pointer hover:underline" onClick={() => window.open(form.watch("company_website")?.startsWith('http') ? form.watch("company_website") : `https://${form.watch("company_website")}`, '_blank')}>
                                <Globe className="w-3.5 h-3.5" />
                                <span className="truncate">{form.watch("company_website")}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-4 pt-1 animate-in fade-in slide-in-from-top-1 duration-200">
                          <FormField
                            control={form.control}
                            name="lead_company"
                            render={({ field }) => (
                              <FormItem className="space-y-1">
                                <FormLabel className="text-[10px] text-muted-foreground uppercase font-bold tracking-tight">Nome da Empresa</FormLabel>
                                <FormControl>
                                  <Input {...field} className="h-8 text-xs border-border bg-background focus:bg-background" />
                                </FormControl>
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={form.control}
                            name="lead_document"
                            render={({ field }) => (
                              <FormItem className="space-y-1">
                                <FormLabel className="text-[10px] text-slate-400 uppercase font-bold tracking-tight">CPF/CNPJ *</FormLabel>
                                <FormControl>
                                  <Input {...field} placeholder="000.000.000-00" className="h-8 text-xs border-border bg-background focus:bg-background" />
                                </FormControl>
                              </FormItem>
                            )}
                          />
                          <div className="grid grid-cols-2 gap-4">
                            <FormField
                              control={form.control}
                              name="company_segment"
                              render={({ field }) => (
                                <FormItem className="space-y-1">
                                  <FormLabel className="text-[10px] text-muted-foreground uppercase font-bold tracking-tight">Segmento</FormLabel>
                                  <Select value={field.value || ""} onValueChange={field.onChange}>
                                    <FormControl>
                                      <SelectTrigger className="h-8 text-xs border-border bg-background">
                                        <SelectValue placeholder="Selecione..." />
                                      </SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                      <SelectItem value="Esportivo">Esportivo</SelectItem>
                                      <SelectItem value="Moda Masculina">Moda Masculina</SelectItem>
                                      <SelectItem value="Moda Feminina">Moda Feminina</SelectItem>
                                      <SelectItem value="Calçados">Calçados</SelectItem>
                                      <SelectItem value="Moda Fitness">Moda Fitness</SelectItem>
                                      <SelectItem value="Outros">Outros</SelectItem>
                                    </SelectContent>
                                  </Select>
                                </FormItem>
                              )}
                            />
                            <FormField
                              control={form.control}
                              name="company_size"
                              render={({ field }) => (
                                <FormItem className="space-y-1">
                                  <FormLabel className="text-[10px] text-muted-foreground uppercase font-bold tracking-tight">Qtd. Funcionários</FormLabel>
                                  <FormControl>
                                    <Input {...field} className="h-8 text-xs border-border bg-background focus:bg-background" />
                                  </FormControl>
                                </FormItem>
                              )}
                            />
                          </div>
                          <div className="grid grid-cols-2 gap-4">
                            <FormField
                              control={form.control}
                              name="company_revenue"
                              render={({ field }) => (
                                <FormItem className="space-y-1">
                                  <FormLabel className="text-[10px] text-muted-foreground uppercase font-bold tracking-tight">Faturamento</FormLabel>
                                  <FormControl>
                                    <Input {...field} className="h-8 text-xs border-border bg-background focus:bg-background" />
                                  </FormControl>
                                </FormItem>
                              )}
                            />
                            <FormField
                              control={form.control}
                              name="company_investment"
                              render={({ field }) => (
                                <FormItem className="space-y-1">
                                  <FormLabel className="text-[10px] text-muted-foreground uppercase font-bold tracking-tight">Investimento Ads</FormLabel>
                                  <FormControl>
                                    <Input {...field} className="h-8 text-xs border-border bg-background focus:bg-background" placeholder="Ex: R$5k a R$10k" />
                                  </FormControl>
                                </FormItem>
                              )}
                            />
                          </div>
                          <FormField
                            control={form.control}
                            name="company_instagram"
                            render={({ field }) => (
                              <FormItem className="space-y-1">
                                <FormLabel className="text-[10px] text-slate-400 uppercase font-bold tracking-tight">Instagram</FormLabel>
                                <FormControl>
                                  <div className="relative">
                                    <Instagram className="absolute left-2 top-2.5 w-3 h-3 text-slate-400" />
                                    <Input {...field} className="h-8 text-xs border-transparent bg-background focus:bg-background pl-7" placeholder="@usuario" />
                                  </div>
                                </FormControl>
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={form.control}
                            name="company_website"
                            render={({ field }) => (
                              <FormItem className="space-y-1">
                                <FormLabel className="text-[10px] text-slate-400 uppercase font-bold tracking-tight">Site</FormLabel>
                                <FormControl>
                                  <div className="relative">
                                    <Globe className="absolute left-2 top-2.5 w-3 h-3 text-slate-400" />
                                    <Input {...field} className="h-8 text-xs border-transparent bg-background focus:bg-background pl-7" placeholder="www.empresa.com" />
                                  </div>
                                </FormControl>
                              </FormItem>
                            )}
                          />
                        </div>
                      )}
                    </div>
                  </div>


                  <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
                    <div className="p-4 border-b bg-muted/50 flex items-center justify-between">
                      <h3 className="font-bold text-xs uppercase tracking-wider text-muted-foreground">Origem</h3>
                    </div>
                    <div className="p-4 space-y-4">
                      <FormField
                        control={form.control}
                        name="source"
                        render={({ field }) => (
                          <FormItem className="space-y-1">
                            <FormLabel className="text-[10px] text-muted-foreground uppercase font-bold tracking-tight">Origem</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
                              <FormControl>
                                <SelectTrigger className="h-8 text-xs border-transparent bg-muted/50">
                                  <SelectValue placeholder="Origem..." />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="manual">Manual</SelectItem>
                                <SelectItem value="website">Website</SelectItem>
                                <SelectItem value="ads">Anúncios</SelectItem>
                                <SelectItem value="prospection">Prospecção</SelectItem>
                                <SelectItem value="influencer">Influenciador</SelectItem>
                                <SelectItem value="instagram">Instagram</SelectItem>
                                <SelectItem value="youtube">YouTube</SelectItem>
                                <SelectItem value="referral">Indicação</SelectItem>
                                <SelectItem value="cold_call">Cold Call</SelectItem>
                                <SelectItem value="social_selling">Social Selling</SelectItem>
                                <SelectItem value="sdr_ai">SDRAI - Maria Eduarda</SelectItem>
                              </SelectContent>
                            </Select>

                            {/* Funil de Origem Detectado */}
                            {leadOrigin && (
                              <div className="mt-2 flex items-center gap-2 p-2 bg-muted/30 rounded border border-muted">
                                <div className={cn(
                                  "w-2 h-2 rounded-full shrink-0",
                                  leadOrigin.type === 'quiz' ? "bg-indigo-500" :
                                    leadOrigin.type === 'webinar' ? "bg-amber-500" :
                                      leadOrigin.type === 'webhook' ? "bg-cyan-500" : "bg-emerald-500"
                                )} />
                                <div className="flex flex-col">
                                  <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider">Funil Detectado</span>
                                  <span className="text-[10px] font-medium uppercase">{leadOrigin.label}</span>
                                </div>
                              </div>
                            )}

                            {/* Aviso Manual */}
                            {field.value === 'manual' && (
                              <div className="mt-1 text-[10px] text-amber-600 font-medium flex items-center gap-1">
                                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 inline-block" />
                                Cadastro Manual
                              </div>
                            )}
                          </FormItem>
                        )}
                      />

                      {/* UTM Parameters */}
                      {opportunity?.custom_fields && (
                        opportunity.custom_fields.utm_source ||
                        opportunity.custom_fields.utm_medium ||
                        opportunity.custom_fields.utm_campaign ||
                        opportunity.custom_fields.utm_term ||
                        opportunity.custom_fields.utm_content
                      ) && (
                          <div className="pt-4 border-t border-border">
                            <h4 className="text-[10px] text-muted-foreground uppercase font-bold tracking-tight mb-3">Parâmetros UTM</h4>
                            <div className="space-y-2">
                              {opportunity?.custom_fields?.utm_source && (
                                <div className="flex items-center justify-between py-1.5 px-2 bg-muted/30 rounded">
                                  <span className="text-[9px] text-muted-foreground uppercase font-bold">Source</span>
                                  <span className="text-xs font-semibold text-foreground/80">{opportunity.custom_fields.utm_source}</span>
                                </div>
                              )}
                              {opportunity?.custom_fields?.utm_medium && (
                                <div className="flex items-center justify-between py-1.5 px-2 bg-muted/30 rounded">
                                  <span className="text-[9px] text-muted-foreground uppercase font-bold">Medium</span>
                                  <span className="text-xs font-semibold text-foreground/80">{opportunity.custom_fields.utm_medium}</span>
                                </div>
                              )}
                              {opportunity?.custom_fields?.utm_campaign && (
                                <div className="flex items-center justify-between py-1.5 px-2 bg-muted/30 rounded">
                                  <span className="text-[9px] text-muted-foreground uppercase font-bold">Campaign</span>
                                  <span className="text-xs font-semibold text-foreground/80">{opportunity.custom_fields.utm_campaign}</span>
                                </div>
                              )}
                              {opportunity?.custom_fields?.utm_term && (
                                <div className="flex items-center justify-between py-1.5 px-2 bg-muted/30 rounded">
                                  <span className="text-[9px] text-muted-foreground uppercase font-bold">Term</span>
                                  <span className="text-xs font-semibold text-foreground/80">{opportunity.custom_fields.utm_term}</span>
                                </div>
                              )}
                              {opportunity?.custom_fields?.utm_content && (
                                <div className="flex items-center justify-between py-1.5 px-2 bg-muted/30 rounded">
                                  <span className="text-[9px] text-muted-foreground uppercase font-bold">Content</span>
                                  <span className="text-xs font-semibold text-foreground/80">{opportunity.custom_fields.utm_content}</span>
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                    </div>
                  </div>

                  {/* Tags Section */}
                  <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
                    <div className="p-4 border-b bg-muted/50 flex items-center justify-between">
                      <h3 className="font-bold text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                        <Tag className="w-3.5 h-3.5 text-indigo-500" />
                        Tags
                      </h3>
                    </div>
                    <div className="p-4 space-y-4">
                      <FormField
                        control={form.control}
                        name="tags"
                        render={({ field }) => (
                          <FormItem className="space-y-3">
                            <div className="flex flex-wrap gap-2">
                              {allTags.map((tag: any) => {
                                const currentTags = Array.isArray(field.value) ? field.value : [];
                                const isSelected = currentTags.includes(tag.id);
                                return (
                                  <Badge
                                    key={tag.id}
                                    variant={isSelected ? "default" : "outline"}
                                    className={cn(
                                      "cursor-pointer text-[10px] font-bold py-1 px-2.5 transition-all",
                                      isSelected
                                        ? "border-transparent text-white shadow-sm scale-105"
                                        : "hover:bg-muted/80 text-muted-foreground"
                                    )}
                                    style={isSelected ? { backgroundColor: tag.color } : {}}
                                    onClick={() => {
                                      const newValue = isSelected
                                        ? currentTags.filter((id: string) => id !== tag.id)
                                        : [...currentTags, tag.id];
                                      field.onChange(newValue);
                                    }}
                                  >
                                    {tag.name}
                                  </Badge>
                                );
                              })}

                              <Popover>
                                <PopoverTrigger asChild>
                                  <Button variant="outline" size="sm" className="h-6 px-2 text-[9px] font-bold gap-1 rounded-full border-dashed">
                                    <Plus className="w-3 h-3" /> Nova Tag
                                  </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-60 p-3" side="top">
                                  <div className="space-y-3">
                                    <div className="space-y-1.5">
                                      <Label className="text-[10px] uppercase font-bold text-muted-foreground">Nome da Tag</Label>
                                      <Input
                                        id="new-tag-name"
                                        placeholder="Ex: Urgente, VIP..."
                                        className="h-8 text-xs"
                                        onKeyDown={(e) => {
                                          if (e.key === 'Enter') {
                                            const name = (e.currentTarget as HTMLInputElement).value;
                                            if (name) {
                                              createTagMutation.mutate({ name, color: '#4F46E5' });
                                              (e.currentTarget as HTMLInputElement).value = '';
                                            }
                                          }
                                        }}
                                      />
                                    </div>
                                    <div className="space-y-1.5">
                                      <Label className="text-[10px] uppercase font-bold text-muted-foreground">Cor</Label>
                                      <div className="flex flex-wrap gap-1.5">
                                        {['#4F46E5', '#EF4444', '#F59E0B', '#10B981', '#3B82F6', '#8B5CF6', '#EC4899', '#64748B'].map(color => (
                                          <div
                                            key={color}
                                            className="w-5 h-5 rounded-full cursor-pointer border border-border"
                                            style={{ backgroundColor: color }}
                                            onClick={() => {
                                              const nameInput = document.getElementById('new-tag-name') as HTMLInputElement;
                                              if (nameInput.value) {
                                                createTagMutation.mutate({ name: nameInput.value, color });
                                                nameInput.value = '';
                                              }
                                            }}
                                          />
                                        ))}
                                      </div>
                                    </div>
                                  </div>
                                </PopoverContent>
                              </Popover>
                            </div>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </div>

                  {/* Custom Fields from Quiz */}
                  {opportunity?.custom_fields && (() => {
                    // Lista de campos que NÃO devem aparecer em "Campos Personalizados"
                    const excludedFields = [
                      // Metadados do quiz
                      'quiz_id', 'quiz_title', 'quiz_score_assessoria', 'quiz_score_mentoria', 'quiz_result',
                      'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content',
                      // Campos predefinidos que já aparecem em outras seções
                      'company_segment', 'company_website', 'lead_company', 'lead_position', 'company_size', 'company_revenue', 'company_instagram', 'company_investment', 'Investimento', 'investimento', 'Instagram', 'instagram', 'Site', 'site', 'Empresa', 'empresa'
                    ];

                    const customFieldsOnly = Object.keys(opportunity?.custom_fields || {})
                      .filter(key => !excludedFields.includes(key));

                    return customFieldsOnly.length > 0;
                  })() && (
                      <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
                        <div className="p-4 border-b bg-muted/50 flex items-center justify-between">
                          <h3 className="font-bold text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                            <Sparkles className="w-3.5 h-3.5 text-blue-500" />
                            Campos Personalizados
                          </h3>
                        </div>
                        <div className="p-4 space-y-3">
                          {Object.entries(opportunity?.custom_fields || {})
                            .filter(([key]) => {
                              const excludedFields = [
                                'quiz_id', 'quiz_title', 'quiz_score_assessoria', 'quiz_score_mentoria', 'quiz_result',
                                'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content',
                                'company_segment', 'company_website', 'lead_company', 'lead_position', 'company_size', 'company_revenue', 'company_instagram', 'company_investment', 'company_ads_budget',
                                'Investimento', 'investimento', 'Instagram', 'instagram', 'Site', 'site', 'Empresa', 'empresa'
                              ];
                              return !excludedFields.includes(key);
                            })
                            .map(([key, value]) => (
                              <div key={key} className="flex items-start justify-between py-2 border-b border-border last:border-0">
                                <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-tight">
                                  {key.replace(/_/g, ' ')}
                                </span>
                                <span className="text-xs font-semibold text-foreground text-right max-w-[60%]">
                                  {String(value)}
                                </span>
                              </div>
                            ))}
                        </div>
                      </div>
                    )}
                </div>

                {/* CENTER COLUMN: Activities & Timeline (6/12) */}
                <div className="md:col-span-6 space-y-6">
                  {/* Activity Editor */}
                  {opportunity && (
                    <OpportunityActivityEditor opportunityId={opportunity.id} />
                  )}

                  {/* Score / Stats Bar (Mocking reference) */}
                  <div className="bg-card rounded-xl border border-border shadow-sm p-4 flex justify-around items-center">
                    <div className="text-center">
                      <p className="text-[10px] text-foreground font-bold uppercase">{daysOpen}</p>
                      <p className="text-[9px] text-muted-foreground">Dias aberto</p>
                    </div>
                    <Separator orientation="vertical" className="h-8" />
                    <div className="text-center">
                      <p className="text-[10px] text-foreground font-bold uppercase">{daysInStage}</p>
                      <p className="text-[9px] text-muted-foreground">Dias na fase</p>
                    </div>
                    <Separator orientation="vertical" className="h-8" />
                    <div className="text-center">
                      <p className="text-[10px] text-foreground font-bold uppercase">{notesCount}</p>
                      <p className="text-[9px] text-muted-foreground">Interações</p>
                    </div>
                    <Separator orientation="vertical" className="h-8" />
                    <div className="text-center">
                      <p className="text-[10px] text-foreground font-bold uppercase">{daysSinceLastInteraction}</p>
                      <p className="text-[9px] text-muted-foreground">Dias sem interação</p>
                    </div>
                  </div>

                  {/* Communication Counts */}
                  <div className="grid grid-cols-2 gap-4">
                    <button
                      type="button"
                      onClick={() => {
                        const email = form.getValues("lead_email");
                        if (email) window.open(`mailto:${email}`);
                        else toast.error("Email não cadastrado");
                      }}
                      className="bg-primary/5 rounded-xl border border-primary/20 p-3 flex items-center justify-between hover:bg-primary/10 transition-colors text-left"
                    >
                      <div>
                        <p className="text-[10px] font-bold text-primary uppercase tracking-wider">Email</p>
                        <p className="text-xs text-muted-foreground truncate max-w-[150px]">{form.watch("lead_email") || "Nenhum"}</p>
                      </div>
                      <Mail className="w-5 h-5 text-indigo-300" />
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        let phone = form.getValues("lead_phone");
                        if (phone) {
                          phone = phone.replace(/\D/g, '');
                          if (!phone.startsWith('55')) phone = '55' + phone;
                          window.open(`https://wa.me/${phone}`, '_blank');
                        }
                        else toast.error("WhastApp não cadastrado");
                      }}
                      className="bg-emerald-500/10 rounded-xl border border-emerald-500/20 p-3 flex items-center justify-between hover:bg-emerald-500/20 transition-colors text-left"
                    >
                      <div>
                        <p className="text-[10px] font-bold text-emerald-500 dark:text-emerald-400 uppercase tracking-wider">Whatsapp</p>
                        <p className="text-xs text-foreground/70 truncate max-w-[150px]">{form.watch("lead_phone") || "Nenhum"}</p>
                      </div>
                      <Phone className="w-5 h-5 text-emerald-500/60 dark:text-emerald-400/60" />
                    </button>
                  </div>

                  {/* Timeline */}
                  {opportunity ? (
                    <div className="bg-card rounded-2xl border border-border shadow-sm p-6">
                      <OpportunityTimeline opportunity={opportunity} />
                    </div>
                  ) : (
                    <div className="bg-card rounded-2xl border border-border shadow-sm p-12 text-center text-slate-400 italic text-sm">
                      Preencha os dados e salve para iniciar a linha do tempo.
                    </div>
                  )}
                </div>

                {/* RIGHT COLUMN: Negociação (3/12) */}
                <div className="md:col-span-3 space-y-6">
                  {/* Business Value Summary (Moved to Top) */}
                  <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
                    <div className="p-4 border-b bg-muted/50 flex items-center justify-between">
                      <h3 className="font-bold text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                        Valor do Negócio
                      </h3>
                      <DollarSign className="w-3.5 h-3.5 text-muted-foreground" />
                    </div>
                    <div className="p-4">
                      <div className="bg-primary/5 border border-primary/10 rounded-xl p-3 flex flex-col justify-center shadow-sm">
                        <span className="text-[9px] text-primary/70 uppercase font-black tracking-wider mb-1">
                          VALOR TOTAL
                        </span>
                        <div className="flex items-baseline gap-1">
                          <span className="text-[10px] font-bold text-primary/50">R$</span>
                          <span className="text-lg font-black text-primary tracking-tight">
                            {(parseFloat(String(form.watch("negotiated_value") || "0"))).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </span>
                          <span className="ml-auto text-[8px] font-bold px-1 py-0.5 bg-primary/10 text-primary rounded uppercase tracking-tighter">
                            Automático
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Products Negotiated */}
                  <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden transition-all duration-300">
                    <div className="p-4 border-b bg-muted/50 flex items-center justify-between">
                      <h3 className="font-bold text-xs uppercase tracking-wider text-card-foreground flex items-center gap-2">
                        <Briefcase className="w-4 h-4 text-primary" /> Produtos Negociados
                      </h3>
                      <div className="flex items-center gap-1">
                        {isEditingProducts && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-7 px-2 text-indigo-600 hover:text-indigo-700 text-[10px] font-bold uppercase tracking-tight"
                            onClick={() => {
                              append({
                                product_id: "",
                                negotiated_price: "0",
                                negotiated_implementation_fee: "0",
                                negotiated_discount: "0",
                                negotiated_period: "monthly",
                                contract_duration: "monthly",
                                billing_day: new Date().getDate().toString(),
                                commission_percentage: "0"
                              });
                              setEditingProductIndex(fields.length);
                            }}
                          >
                            <Plus className="w-3 h-3 mr-1" /> Adicionar
                          </Button>
                        )}
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className={cn(
                            "h-8 w-8 transition-colors",
                            isEditingProducts ? "text-primary bg-primary/10" : "text-muted-foreground hover:text-primary"
                          )}
                          onClick={() => setIsEditingProducts(!isEditingProducts)}
                        >
                          {isEditingProducts ? (
                            <Check className="w-4 h-4" />
                          ) : (
                            <Pencil className="w-4 h-4" />
                          )}
                        </Button>
                      </div>
                    </div>
                    <div className="p-4 space-y-3">
                      {fields.length === 0 && (
                        <p className="text-[10px] text-slate-400 text-center py-2 italic uppercase font-bold tracking-wider">Nenhum produto adicionado</p>
                      )}

                      {!isEditingProducts ? (
                        <div className="space-y-4">
                          {fields.map((field, index) => {
                            const product = products.find(p => p.id === form.watch(`products.${index}.product_id`));
                            const price = parseFloat(String(form.watch(`products.${index}.negotiated_price`) || "0"));
                            const period = form.watch(`products.${index}.negotiated_period`);
                            const impl = parseFloat(String(form.watch(`products.${index}.negotiated_implementation_fee`) || "0"));
                            const disc = parseFloat(String(form.watch(`products.${index}.negotiated_discount`) || "0"));

                            return (
                              <div key={field.id} className="space-y-3 pb-3 border-b border-border last:border-0 last:pb-0">
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-3">
                                    <div className="w-9 h-9 bg-muted rounded-lg flex items-center justify-center border border-border">
                                      <Briefcase className="w-4 h-4 text-muted-foreground" />
                                    </div>
                                    <div>
                                      <h4 className="font-bold text-sm text-foreground">{product?.name || "Selecionar Produto..."}</h4>
                                      <p className="text-[10px] text-primary uppercase font-black tracking-tighter">
                                        {period === 'monthly' ? 'Mensal' : period === 'annual' ? 'Anual' : 'Único'}
                                      </p>
                                    </div>
                                  </div>
                                  <div className="text-right">
                                    <p className="text-sm font-black text-foreground tracking-tight">
                                      {formatCurrency(price)}
                                    </p>
                                  </div>
                                </div>

                                {(impl > 0 || disc > 0) && (
                                  <div className="grid grid-cols-2 gap-4 bg-muted/30 rounded-lg p-2 border border-border">
                                    {impl > 0 && (
                                      <div className="space-y-0.5">
                                        <p className="text-[9px] text-muted-foreground uppercase font-bold tracking-tight">Implementação</p>
                                        <p className="text-[11px] font-bold text-emerald-500 dark:text-emerald-400">{formatCurrency(impl)}</p>
                                      </div>
                                    )}
                                    {disc > 0 && (
                                      <div className="space-y-0.5">
                                        <p className="text-[9px] text-muted-foreground uppercase font-bold tracking-tight">Desconto</p>
                                        <p className="text-[11px] font-bold text-rose-500 dark:text-rose-400">-{formatCurrency(disc)}</p>
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="space-y-3 animate-in fade-in slide-in-from-top-1 duration-200">
                          {fields.map((field, index) => (
                            <div key={field.id} className="space-y-4 p-3 bg-muted/20 rounded-lg border border-border hover:border-primary/50 transition-colors">
                              <div className="flex items-center justify-between">
                                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">ITEM #{index + 1}</span>
                                <div className="flex items-center gap-1">
                                  <Button type="button" variant="ghost" size="icon" className="h-5 w-5 text-muted-foreground hover:text-rose-500" onClick={() => remove(index)}>
                                    <Trash2 className="w-3 h-3" />
                                  </Button>
                                </div>
                              </div>

                              <FormField
                                control={form.control}
                                name={`products.${index}.product_id`}
                                render={({ field: selectField }) => (
                                  <FormItem className="space-y-1">
                                    <Select
                                      onValueChange={(val) => {
                                        selectField.onChange(val);

                                        const prod = (products as any[] || []).find(p => p.id === val);
                                        if (prod) {
                                          form.setValue(`products.${index}.negotiated_price`, String(prod.base_price || prod.price || "0") as any);
                                          form.setValue(`products.${index}.negotiated_implementation_fee`, String(prod.default_implementation_fee || "0") as any);

                                          // Se for Assessoria, aplicar defaults específicos
                                          if (prod.name?.toLowerCase().includes("assessoria")) {
                                            form.setValue(`products.${index}.negotiated_period`, "monthly" as any);
                                            form.setValue(`products.${index}.contract_duration`, "annual" as any);
                                          } else {
                                            form.setValue(`products.${index}.negotiated_period`, (prod.default_period || "monthly") as any);
                                          }
                                        }
                                      }}
                                      value={selectField.value}
                                    >
                                      <FormControl>
                                        <SelectTrigger className="h-7 text-[11px] bg-background">
                                          <SelectValue placeholder="Selecione o produto..." />
                                        </SelectTrigger>
                                      </FormControl>
                                      <SelectContent>
                                        {products.map((p) => (
                                          <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                                        ))}
                                      </SelectContent>
                                    </Select>
                                  </FormItem>
                                )}
                              />

                              {/* Check if product is recurring to show/hide fields */}
                              {(() => {
                                const selectedProductId = form.watch(`products.${index}.product_id`);
                                const selectedProduct = (products as any[]).find(p => p.id === selectedProductId);
                                const isRecurring = selectedProduct?.type === 'recurring';

                                return (
                                  <>
                                    <div className="grid grid-cols-2 gap-2">
                                      <FormField
                                        control={form.control}
                                        name={`products.${index}.negotiated_price`}
                                        render={({ field: priceField }) => (
                                          <FormItem className="space-y-1">
                                            <FormLabel className="text-[9px] text-slate-400 uppercase font-bold">Valor</FormLabel>
                                            <FormControl>
                                              <div className="relative">
                                                <span className="absolute left-2 top-1.5 text-[9px] text-slate-400 font-bold">R$</span>
                                                <Input type="number" {...priceField} className="h-7 text-[11px] bg-background pl-7" />
                                              </div>
                                            </FormControl>
                                          </FormItem>
                                        )}
                                      />
                                      <FormField
                                        control={form.control}
                                        name={`products.${index}.negotiated_discount`}
                                        render={({ field: discField }) => (
                                          <FormItem className="space-y-1">
                                            <FormLabel className="text-[9px] text-slate-400 uppercase font-bold">Desconto</FormLabel>
                                            <FormControl>
                                              <div className="relative">
                                                <span className="absolute left-2 top-1.5 text-[9px] text-slate-400 font-bold">R$</span>
                                                <Input type="number" {...discField} className="h-7 text-[11px] bg-background pl-7" />
                                              </div>
                                            </FormControl>
                                          </FormItem>
                                        )}
                                      />
                                    </div>

                                    {/* Only show contract fields for recurring products */}
                                    {isRecurring && (
                                      <>
                                        <div className="grid grid-cols-2 gap-2">
                                          <FormField
                                            control={form.control}
                                            name={`products.${index}.negotiated_period`}
                                            render={({ field: periodField }) => (
                                              <FormItem className="space-y-1">
                                                <FormLabel className="text-[9px] text-muted-foreground uppercase font-bold">Período</FormLabel>
                                                <Select onValueChange={periodField.onChange} value={periodField.value}>
                                                  <FormControl>
                                                    <SelectTrigger className="h-7 text-[11px] bg-background">
                                                      <SelectValue placeholder="..." />
                                                    </SelectTrigger>
                                                  </FormControl>
                                                  <SelectContent>
                                                    <SelectItem value="monthly">Mensal</SelectItem>
                                                    <SelectItem value="annual">Anual</SelectItem>
                                                  </SelectContent>
                                                </Select>
                                              </FormItem>
                                            )}
                                          />
                                          <FormField
                                            control={form.control}
                                            name={`products.${index}.negotiated_implementation_fee`}
                                            render={({ field: implField }) => (
                                              <FormItem className="space-y-1">
                                                <FormLabel className="text-[9px] text-muted-foreground uppercase font-bold">Implementação</FormLabel>
                                                <FormControl>
                                                  <div className="relative">
                                                    <span className="absolute left-2 top-1.5 text-[9px] text-muted-foreground font-bold">R$</span>
                                                    <Input type="number" {...implField} className="h-7 text-[11px] bg-background border-border pl-7" />
                                                  </div>
                                                </FormControl>
                                              </FormItem>
                                            )}
                                          />
                                        </div>

                                        <div className="grid grid-cols-2 gap-2">
                                          <FormField
                                            control={form.control}
                                            name={`products.${index}.contract_duration`}
                                            render={({ field: durField }) => (
                                              <FormItem className="space-y-1">
                                                <FormLabel className="text-[9px] text-muted-foreground uppercase font-bold">Duração</FormLabel>
                                                <Select onValueChange={durField.onChange} value={durField.value}>
                                                  <FormControl>
                                                    <SelectTrigger className="h-7 text-[11px] bg-background">
                                                      <SelectValue placeholder="..." />
                                                    </SelectTrigger>
                                                  </FormControl>
                                                  <SelectContent>
                                                    <SelectItem value="monthly">1 Mês</SelectItem>
                                                    <SelectItem value="quarterly">3 Meses</SelectItem>
                                                    <SelectItem value="semiannual">6 Meses</SelectItem>
                                                    <SelectItem value="annual">12 Meses</SelectItem>
                                                    <SelectItem value="custom">Personalizado</SelectItem>
                                                  </SelectContent>
                                                </Select>
                                              </FormItem>
                                            )}
                                          />
                                          <FormField
                                            control={form.control}
                                            name={`products.${index}.billing_day`}
                                            render={({ field: dayField }) => (
                                              <FormItem className="space-y-1">
                                                <FormLabel className="text-[9px] text-muted-foreground uppercase font-bold">Dia Venc.</FormLabel>
                                                <FormControl>
                                                  <Input type="number" {...dayField} placeholder="Ex: 10" className="h-7 text-[11px] bg-background border-border" />
                                                </FormControl>
                                              </FormItem>
                                            )}
                                          />
                                        </div>

                                        <div className="grid grid-cols-2 gap-2">
                                          {form.watch(`products.${index}.negotiated_period`) !== 'single' && (
                                            <FormField
                                              control={form.control}
                                              name={`products.${index}.commission_percentage`}
                                              render={({ field }) => (
                                                <FormItem className="space-y-1">
                                                  <FormLabel className="text-[9px] text-muted-foreground uppercase font-bold">Agência Comissão %</FormLabel>
                                                  <FormControl>
                                                    <div className="relative">
                                                      <span className="absolute left-2 top-1.5 text-[9px] text-muted-foreground font-bold">%</span>
                                                      <Input type="number" {...field} placeholder="0" className="h-7 text-[11px] bg-background border-border pl-6" />
                                                    </div>
                                                  </FormControl>
                                                </FormItem>
                                              )}
                                            />
                                          )}
                                        </div>

                                        {form.watch(`products.${index}.contract_duration`) === 'custom' && (
                                          <FormField
                                            control={form.control}
                                            name={`products.${index}.contract_custom_duration`}
                                            render={({ field: customDurField }) => (
                                              <FormItem className="space-y-1 animate-in fade-in slide-in-from-top-1">
                                                <FormLabel className="text-[9px] text-muted-foreground uppercase font-bold">Meses Customizados</FormLabel>
                                                <FormControl>
                                                  <Input type="number" {...customDurField} placeholder="Ex: 18" className="h-7 text-[11px] bg-background border-border" />
                                                </FormControl>
                                              </FormItem>
                                            )}
                                          />
                                        )}
                                      </>
                                    )}
                                  </>
                                );
                              })()}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                  {/* Closing Section: Payment Link & Contract */}
                  <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden transition-all duration-300">
                    <div className="p-4 border-b bg-muted/50 flex items-center justify-between">
                      <h3 className="font-bold text-xs uppercase tracking-wider text-card-foreground flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-emerald-500" /> Fechamento
                      </h3>
                    </div>
                    <div className="p-4 space-y-4">
                      {/* 1. Payment Link */}
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] uppercase font-bold text-muted-foreground flex items-center gap-1">
                            <CreditCard className="w-3 h-3" /> Link Pagamento
                          </span>
                          {opportunity?.payment_status === "paid" ? (
                            <Badge variant="outline" className="h-5 text-[9px] border-emerald-200 text-emerald-700 bg-emerald-50">
                              Pago
                            </Badge>
                          ) : opportunity?.payment_link_url ? (
                            <Badge variant="outline" className="h-5 text-[9px] border-yellow-200 text-yellow-700 bg-yellow-50">
                              Aguardando
                            </Badge>
                          ) : null}
                        </div>

                        {opportunity?.payment_link_url && !hasPaymentLinkValueChanged ? (
                          <div className="space-y-2">
                            <div className="flex items-center gap-2 bg-muted/30 p-2 rounded-lg border border-border">
                              <div className="flex-1 truncate text-[10px] text-muted-foreground font-mono">
                                {opportunity.payment_link_url}
                              </div>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6"
                                onClick={() => {
                                  navigator.clipboard.writeText(opportunity.payment_link_url);
                                  toast.success("Link copiado!");
                                }}
                              >
                                <Copy className="w-3 h-3" />
                              </Button>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6"
                                onClick={() => window.open(opportunity.payment_link_url, '_blank')}
                              >
                                <ExternalLink className="w-3 h-3" />
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <div className="space-y-2">
                            {/* Alert when values changed and link is outdated */}
                            {hasPaymentLinkValueChanged && (
                              <div className="p-2 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg animate-in fade-in slide-in-from-top-1">
                                <div className="flex items-start gap-2">
                                  <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-500 shrink-0 mt-0.5" />
                                  <div className="flex-1 space-y-1">
                                    <p className="text-[10px] font-bold text-amber-700 dark:text-amber-400 uppercase tracking-tight">
                                      Link invalidado — valor alterado
                                    </p>
                                    <p className="text-[10px] text-amber-600 dark:text-amber-500">
                                      De {formatCurrency(linkedSale?.amount || 0)} para {formatCurrency(currentNegotiatedValue)}. Gere um novo link abaixo.
                                    </p>
                                  </div>
                                </div>
                              </div>
                            )}
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <div className="w-full">
                                  <Button
                                    type="button"
                                    variant="outline"
                                    className="w-full h-8 text-xs justify-start"
                                    onClick={() => setIsPaymentMethodsDialogOpen(true)}
                                    disabled={isGeneratingLink || !canGeneratePaymentLink}
                                  >
                                    {isGeneratingLink ? <Loader2 className="w-3 h-3 mr-2 animate-spin" /> : <Plus className="w-3 h-3 mr-2" />}
                                    Gerar Link de Pagamento
                                  </Button>
                                </div>
                              </TooltipTrigger>
                              {!canGeneratePaymentLink && (
                                <TooltipContent>
                                  {!hasPagarmeKey ? (
                                    <>
                                      <p className="font-semibold text-amber-500 mb-1">⚠️ Integração necessária</p>
                                      <p className="text-[10px]">Configure sua chave API da Pagar.me em:</p>
                                      <p className="text-[10px] font-mono">Configurações → Integração Pagar.me</p>
                                    </>
                                  ) : (
                                    <>
                                      <p className="font-semibold text-rose-500 mb-1">Campos obrigatórios faltando:</p>
                                      <ul className="list-disc pl-4 text-[10px]">
                                        {paymentLinkMissingFields.filter(f => f !== "Integração Pagar.me não configurada").map(field => (
                                          <li key={field}>{field}</li>
                                        ))}
                                      </ul>
                                    </>
                                  )}
                                </TooltipContent>
                              )}
                            </Tooltip>
                          </TooltipProvider>
                          {generatedPaymentUrl && (
                            <div className="flex items-center gap-2 bg-muted/30 p-2 rounded-lg border border-border">
                              <div className="flex-1 truncate text-[10px] text-muted-foreground font-mono">
                                {generatedPaymentUrl}
                              </div>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6 shrink-0"
                                onClick={() => {
                                  navigator.clipboard.writeText(generatedPaymentUrl).then(() => {
                                    toast.success("Link copiado!");
                                  }).catch(() => {
                                    const el = document.createElement("textarea");
                                    el.value = generatedPaymentUrl;
                                    document.body.appendChild(el);
                                    el.select();
                                    document.execCommand("copy");
                                    document.body.removeChild(el);
                                    toast.success("Link copiado!");
                                  });
                                }}
                              >
                                <Copy className="w-3 h-3" />
                              </Button>
                            </div>
                          )}
                          </div>
                        )}
                      </div>

                      <Separator />

                      {/* 2. Contract Signing */}
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] uppercase font-bold text-muted-foreground flex items-center gap-1">
                            <FileSignature className="w-3 h-3" /> Contrato Digital
                          </span>
                          {opportunity?.contract_signature_status === "signed" ? (
                            <Badge variant="outline" className="h-5 text-[9px] border-emerald-200 text-emerald-700 bg-emerald-50">
                              Assinado
                            </Badge>
                          ) : opportunity?.contract_signature_status === "sent" ? (
                            <Badge variant="outline" className="h-5 text-[9px] border-blue-200 text-blue-700 bg-blue-50">
                              Enviado
                            </Badge>
                          ) : null}
                        </div>

                        {opportunity?.d4sign_document_uuid ? (
                          <div className="p-2 bg-muted/30 rounded-lg border border-border text-[10px] text-muted-foreground flex flex-col gap-1">
                            <span className="font-bold">ID do Documento:</span>
                            <span className="font-mono">{opportunity.d4sign_document_uuid}</span>
                            <p className="text-[9px] text-slate-400 mt-1">
                              Acompanhe o status no portal da D4Sign ou aguarde atualização automática.
                            </p>
                          </div>
                        ) : (
                          <Button
                            type="button"
                            variant="outline"
                            className="w-full h-8 text-xs justify-start"
                            onClick={handleOpenSignDialog}
                            disabled={isSendingContract}
                          >
                            {isSendingContract ? <Loader2 className="w-3 h-3 mr-2 animate-spin" /> : <FileText className="w-3 h-3 mr-2" />}
                            Enviar para Assinatura
                          </Button>
                        )}
                      </div>

                      {/* MANUAL OVERRIDE */}
                      <div className="space-y-2 pt-2 border-t mt-2">
                        <FormField
                          control={form.control}
                          name="is_signed"
                          render={({ field }) => (
                            <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 bg-muted/20">
                              <div className="space-y-0.5">
                                <FormLabel className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                                  <PenTool className="w-3 h-3" /> Assinado Manualmente
                                </FormLabel>
                              </div>
                              <FormControl>
                                <Switch
                                  checked={field.value}
                                  onCheckedChange={field.onChange}
                                  disabled={opportunity?.contract_signature_status === "signed"}
                                />
                              </FormControl>
                            </FormItem>
                          )}
                        />
                      </div>

                      {form.watch("is_signed") && (
                        <div className="mt-4 space-y-3 animate-in fade-in slide-in-from-top-1">
                          <Label className="text-[10px] font-black uppercase text-slate-400">Anexar Contrato Assinado (PDF)</Label>

                          {opportunity?.contract_url && !manualContractFile && (
                            <Button
                              type="button"
                              variant="outline"
                              className="w-full justify-start text-xs border-dashed text-primary border-primary/30 bg-primary/5 hover:bg-primary/10"
                              onClick={() => {
                                const { data } = supabase.storage.from("contract-attachments").getPublicUrl(opportunity.contract_url);
                                window.open(data.publicUrl, "_blank");
                              }}
                            >
                              <FileText className="w-3 h-3 mr-2 text-primary" />
                              Ver Contrato Atual
                            </Button>
                          )}

                          <div className="flex items-center gap-2">
                            <Input
                              type="file"
                              accept=".pdf,.doc,.docx,image/*"
                              onChange={(e) => setManualContractFile(e.target.files?.[0] || null)}
                              className="text-xs h-9 bg-white"
                            />
                          </div>
                          {manualContractFile && (
                            <p className="text-[10px] text-emerald-600 font-bold flex items-center gap-1">
                              <Check className="w-3 h-3" /> {manualContractFile.name} selecionado (salve para enviar)
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Meeting & Qualification Section */}
                  <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
                    <div className="p-4 border-b bg-muted/50 flex items-center justify-between">
                      <h3 className="font-bold text-xs uppercase tracking-wider text-foreground flex items-center gap-2">
                        <CalendarIcon className="w-4 h-4 text-primary" /> Agendamento e Qualificação
                      </h3>
                    </div>
                    <div className="p-4 space-y-4">
                      {booking && !isEditingBooking ? (
                        <div className="bg-primary/5 rounded-lg border border-primary/20 p-4">
                          <div className="flex items-center gap-2 mb-3">
                            <CalendarIcon className="w-4 h-4 text-primary" />
                            <span className="text-xs font-bold text-primary uppercase tracking-wider">Agendamento Integrado</span>
                            <Badge variant="outline" className="ml-auto text-[9px] h-5 border-emerald-200 text-emerald-700 bg-emerald-50">
                              Google Calendar
                            </Badge>
                          </div>

                          <div className="space-y-3">
                            <div>
                              <p className="text-[10px] text-muted-foreground uppercase font-bold">Data e Hora</p>
                              <p className="text-sm font-semibold text-foreground">
                                {format(new Date(booking.start_time), "dd 'de' MMMM 'às' HH:mm", { locale: ptBR })}
                              </p>
                            </div>

                            <div>
                              <p className="text-[10px] text-muted-foreground uppercase font-bold">Closer Responsável</p>
                              <div className="flex items-center gap-2 mt-1">
                                <Avatar className="h-6 w-6">
                                  <AvatarFallback className="text-[10px] bg-indigo-100 text-indigo-700">
                                    {booking.closer?.full_name?.substring(0, 1) || booking.closer?.email?.substring(0, 1) || "?"}
                                  </AvatarFallback>
                                </Avatar>
                                <span className="text-xs text-foreground">
                                  {booking.closer?.full_name || booking.closer?.email || "Sem nome"}
                                </span>
                              </div>
                            </div>

                            <div className="flex flex-col gap-2 pt-2">
                              {booking.meeting_link && (
                                <Button
                                  type="button"
                                  variant="outline"
                                  className="w-full h-8 text-xs gap-2"
                                  onClick={() => window.open(booking.meeting_link, '_blank')}
                                >
                                  <Video className="w-3.5 h-3.5" />
                                  Entrar na Reunião
                                </Button>
                              )}

                              <div className="grid grid-cols-2 gap-2">
                                <Button
                                  type="button"
                                  variant="outline"
                                  className="h-8 text-[10px] uppercase font-bold"
                                  onClick={() => setIsEditingBooking(true)}
                                >
                                  <Pencil className="w-3 h-3 mr-1" />
                                  Alterar
                                </Button>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  className="h-8 text-[10px] uppercase font-bold text-rose-500 hover:text-rose-600 hover:bg-rose-50"
                                  onClick={handleDeleteBooking}
                                  disabled={isCancelingBooking}
                                >
                                  {isCancelingBooking ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <Trash2 className="w-3 h-3 mr-1" />}
                                  Cancelar
                                </Button>
                              </div>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <FormField
                          control={form.control}
                          name="session_scheduled_at"
                          render={({ field }) => (
                            <FormItem className="space-y-3">
                              <FormLabel className="text-[10px] text-muted-foreground uppercase font-bold tracking-tight">Data da Reunião</FormLabel>
                              <FormControl>
                                <div className="space-y-4">
                                  {!assignedCloser ? (
                                    <div className="p-3 border border-rose-100 bg-rose-50 rounded-lg">
                                      <p className="text-[10px] text-rose-600 font-bold uppercase text-center">Selecione um Closer para habilitar o agendamento</p>
                                    </div>
                                  ) : (
                                    <div className="space-y-4">
                                      <Popover>
                                        <PopoverTrigger asChild>
                                          <Button
                                            variant="outline"
                                            className={cn(
                                              "w-full h-9 justify-start text-left font-normal text-xs",
                                              !schedulerDate && "text-muted-foreground"
                                            )}
                                          >
                                            <CalendarIcon className="mr-2 h-4 w-4" />
                                            {schedulerDate ? format(schedulerDate, "PPP", { locale: ptBR }) : <span>Selecione uma data</span>}
                                          </Button>
                                        </PopoverTrigger>
                                        <PopoverContent className="w-auto p-0" align="start">
                                          <Calendar
                                            mode="single"
                                            selected={schedulerDate}
                                            onSelect={(date) => {
                                              setSchedulerDate(date);
                                              field.onChange(""); // Reset field when date changes
                                            }}
                                            initialFocus
                                            locale={ptBR}
                                            disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0))}
                                          />
                                        </PopoverContent>
                                      </Popover>

                                      {schedulerDate && (
                                        <div className="space-y-2">
                                          <div className="flex items-center gap-2 text-[10px] font-bold text-muted-foreground uppercase">
                                            <Clock className="w-3 h-3" />
                                            Horários Disponíveis
                                          </div>

                                          {isLoadingSlots ? (
                                            <div className="flex justify-center p-4">
                                              <Loader2 className="w-5 h-5 animate-spin text-primary" />
                                            </div>
                                          ) : availableSlots.length === 0 ? (
                                            <p className="text-[10px] text-muted-foreground italic text-center py-2 bg-muted/30 rounded-lg">
                                              Nenhum horário disponível para esta data.
                                            </p>
                                          ) : (
                                            <div className="grid grid-cols-3 gap-1.5 max-h-[160px] overflow-y-auto pr-1">
                                              {availableSlots.map((slot: any, idx: number) => {
                                                const isSelected = field.value === slot.start;
                                                const startTime = format(new Date(slot.start), 'HH:mm');
                                                return (
                                                  <Button
                                                    key={idx}
                                                    type="button"
                                                    variant={isSelected ? "default" : "outline"}
                                                    className={cn(
                                                      "h-8 text-[11px] px-0",
                                                      isSelected ? "bg-primary text-primary-foreground" : "hover:border-primary/50"
                                                    )}
                                                    onClick={() => field.onChange(slot.start)}
                                                  >
                                                    {startTime}
                                                  </Button>
                                                )
                                              })}
                                            </div>
                                          )}
                                        </div>
                                      )}

                                      {field.value && (
                                        <div className="space-y-2">
                                          <div className="p-2 bg-primary/5 border border-primary/20 rounded-lg">
                                            <p className="text-[10px] text-primary font-bold uppercase text-center">
                                              Selecionado: {format(new Date(field.value), "dd/MM 'às' HH:mm", { locale: ptBR })}
                                            </p>
                                          </div>
                                          <Button
                                            type="button"
                                            variant="ghost"
                                            size="sm"
                                            className="w-full h-8 text-rose-500 hover:text-rose-600 hover:bg-rose-50 text-[10px] font-bold uppercase"
                                            onClick={() => {
                                              if (booking?.id) {
                                                handleDeleteBooking();
                                              } else {
                                                form.setValue("session_scheduled_at", "");
                                                form.setValue("session_meeting_link", "");
                                                setSchedulerDate(new Date());
                                              }
                                            }}
                                            disabled={isCancelingBooking}
                                          >
                                            {isCancelingBooking ? (
                                              <Loader2 className="w-3 h-3 animate-spin mr-2" />
                                            ) : (
                                              <Trash2 className="w-3 h-3 mr-2" />
                                            )}
                                            Remover Agendamento
                                          </Button>
                                        </div>
                                      )}
                                    </div>
                                  )}
                                </div>
                              </FormControl>
                            </FormItem>
                          )}
                        />
                      )}

                      {!booking && (
                        <FormField
                          control={form.control}
                          name="session_meeting_link"
                          render={({ field }) => (
                            <FormItem className="space-y-1">
                              <div className="flex items-center justify-between">
                                <FormLabel className="text-[10px] text-muted-foreground uppercase font-bold tracking-tight">Link da Reunião</FormLabel>
                                {field.value && field.value.trim() !== '' && (
                                  <a
                                    href={field.value.startsWith('http') ? field.value : `https://${field.value}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-[10px] text-primary hover:underline flex items-center gap-1 uppercase font-bold tracking-tight"
                                  >
                                    Acessar <ExternalLink className="w-3 h-3" />
                                  </a>
                                )}
                              </div>
                              <FormControl>
                                <Input {...field} className="h-8 text-xs border-border bg-background focus:bg-background" placeholder="Link do Zoom, Google Meet..." />
                              </FormControl>
                            </FormItem>
                          )}
                        />
                      )}

                      <FormField
                        control={form.control}
                        name="session_status"
                        render={({ field }) => (
                          <FormItem className="space-y-1">
                            <FormLabel className="text-[10px] text-muted-foreground uppercase font-bold tracking-tight">Status da Reunião</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
                              <FormControl>
                                <SelectTrigger className="h-8 text-xs border-border bg-background">
                                  <SelectValue placeholder="Status..." />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="scheduled">Agendada</SelectItem>
                                <SelectItem value="attended">Compareceu</SelectItem>
                                <SelectItem value="no_show">No Show (Faltou)</SelectItem>
                              </SelectContent>
                            </Select>
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="qualified_product"
                        render={({ field }) => (
                          <FormItem className="space-y-1">
                            <FormLabel className="text-[10px] text-muted-foreground uppercase font-bold tracking-tight">Produto Qualificado</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value || undefined}>
                              <FormControl>
                                <SelectTrigger className="h-8 text-xs border-border bg-background">
                                  <SelectValue placeholder="Selecione um produto..." />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {(products as any[] || []).map((product: any) => (
                                  <SelectItem key={product.id} value={product.id}>
                                    {product.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </FormItem>
                        )}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </form>
          </Form>
        )
        }

        {/* Dialogs */}
        {/* D4Sign Template Dialog */}
        <Dialog open={isSignDialogOpen} onOpenChange={setIsSignDialogOpen}>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Enviar Contrato para Assinatura</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              {isLoadingTemplates ? (
                <div className="flex justify-center p-4">
                  <Loader2 className="w-6 h-6 animate-spin text-primary" />
                </div>
              ) : d4signTemplates.length === 0 ? (
                <p className="text-sm text-center text-muted-foreground">Nenhum modelo encontrado no D4Sign.</p>
              ) : (
                <div className="space-y-2">
                  <Label>Modelo de Contrato</Label>
                  <Select onValueChange={setSelectedTemplateId} value={selectedTemplateId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione um modelo..." />
                    </SelectTrigger>
                    <SelectContent>
                      {d4signTemplates.map((t: any) => (
                        <SelectItem key={t.id_template || t.id} value={t.id_template || t.id}>{t.name_template || t.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="space-y-2">
                <Label>Dados do Assinante</Label>
                <div className="grid grid-cols-1 gap-2">
                  <div className="space-y-1">
                    <span className="text-[10px] uppercase font-bold text-muted-foreground">Nome</span>
                    <Input
                      value={signerName}
                      placeholder={form.getValues("lead_name")}
                      onChange={(e) => setSignerName(e.target.value)}
                      className="h-8 text-xs"
                    />
                  </div>
                  <div className="space-y-1">
                    <span className="text-[10px] uppercase font-bold text-muted-foreground">Email</span>
                    <Input
                      value={signerEmail}
                      placeholder={form.getValues("lead_email")}
                      onChange={(e) => setSignerEmail(e.target.value)}
                      className="h-8 text-xs"
                    />
                  </div>
                  <p className="text-[10px] text-muted-foreground">Se deixar em branco, usará os dados do Lead.</p>
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setIsSignDialogOpen(false)}>Cancelar</Button>
              <Button onClick={handleSendContract} disabled={isSendingContract || !selectedTemplateId}>
                {isSendingContract && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Enviar Contrato
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        <WinValidationDialog
          open={winValidationOpen}
          onOpenChange={setWinValidationOpen}
          opportunity={opportunity}
          onContinue={() => {
            setWinValidationOpen(false);
            setWinDialogOpen(true);
          }}
        />

        <WinConfirmationDialog
          open={winDialogOpen}
          onOpenChange={setWinDialogOpen}
          formValues={form.getValues()}
          availableProducts={products}
          onConfirm={(data) => markAsWonMutation.mutate({ values: form.getValues(), ...data })}
          isLoading={markAsWonMutation.isPending}
        />

        <LossConfirmationDialog
          open={lossDialogOpen}
          onOpenChange={setLossDialogOpen}
          onConfirm={(reason, notes) => markAsLostMutation.mutate({ reason, notes })}
          isLoading={markAsLostMutation.isPending}
        />

        <LeadScoreFeedbackModal
          open={scoreModalOpen}
          onOpenChange={setScoreModalOpen}
          opportunityId={opportunity?.id}
          targetStageId={pendingStageId}
          onSuccess={(newScore) => {
            setPendingStageId(null);

            // 🔥 UPDATE REACT-HOOK-FORM STATE SYNCHRONOUSLY SO UI ADJUSTS
            form.setValue("lead_score", newScore);
            // This updates the internal opportunity copy used over here before React Query finishes syncing it

            queryClient.invalidateQueries({ queryKey: ["opportunities"] });
            queryClient.invalidateQueries({ queryKey: ["opportunity", opportunity?.id] });
            toast.success("Lead avançado com avaliação preenchida!");
          }}
        />

        <Dialog open={isPaymentMethodsDialogOpen} onOpenChange={setIsPaymentMethodsDialogOpen}>
          <DialogContent className="sm:max-w-[400px]">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <CreditCard className="w-5 h-5 text-primary" />
                Configurar Link de Pagamento
              </DialogTitle>
            </DialogHeader>
            <div className="py-4 space-y-4">
              <p className="text-sm text-muted-foreground">
                Selecione os métodos de pagamento que deseja disponibilizar para o cliente:
              </p>
              <div className="space-y-3">
                <div
                  className="flex items-center space-x-3 p-3 border rounded-lg hover:bg-muted/50 transition-colors cursor-pointer"
                  onClick={() => {
                    setSelectedMethods(prev => prev.includes("pix") ? prev.filter(m => m !== "pix") : [...prev, "pix"])
                  }}
                >
                  <Checkbox
                    checked={selectedMethods.includes("pix")}
                    className="pointer-events-none"
                  />
                  <div className="flex-1">
                    <Label className="font-bold cursor-pointer">PIX</Label>
                    <p className="text-[10px] text-muted-foreground">Pagamento instantâneo com QR Code</p>
                  </div>
                </div>

                <div
                  className="flex items-center space-x-3 p-3 border rounded-lg hover:bg-muted/50 transition-colors cursor-pointer"
                  onClick={() => {
                    setSelectedMethods(prev => prev.includes("credit_card") ? prev.filter(m => m !== "credit_card") : [...prev, "credit_card"])
                  }}
                >
                  <Checkbox
                    checked={selectedMethods.includes("credit_card")}
                    className="pointer-events-none"
                  />
                  <div className="flex-1">
                    <Label className="font-bold cursor-pointer">Cartão de Crédito</Label>
                    <p className="text-[10px] text-muted-foreground">Aprovação imediata</p>
                  </div>
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-4">
              <Button variant="ghost" onClick={() => setIsPaymentMethodsDialogOpen(false)}>Cancelar</Button>
              <Button
                onClick={handleGeneratePaymentLink}
                disabled={selectedMethods.length === 0 || isGeneratingLink}
                className="gap-2"
              >
                {isGeneratingLink ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                Gerar Link Agora
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle className="text-rose-600 flex items-center gap-2">
                <Trash2 className="w-5 h-5" /> Atenção: Exclusão Permanente
              </AlertDialogTitle>
              <AlertDialogDescription className="space-y-4">
                <p>
                  Você está prestes a excluir a oportunidade <strong>{opportunity?.lead_name}</strong>.
                  Esta ação é irreversível e removerá todos os dados, anexos e histórico da linha do tempo.
                </p>
                <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
                  <p className="text-sm font-semibold text-slate-700 mb-2">
                    Para confirmar, digite <span className="text-rose-600 font-bold select-none">DELETAR</span> abaixo:
                  </p>
                  <Input
                    value={deleteConfirmText}
                    onChange={(e) => setDeleteConfirmText(e.target.value)}
                    placeholder="Digite DELETAR para confirmar"
                    className="bg-white border-slate-300 focus:border-rose-500 focus:ring-rose-500 uppercase"
                  />
                </div>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => setDeleteConfirmText("")}>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                onClick={(e) => {
                  if (deleteConfirmText.toUpperCase() !== "DELETAR") {
                    e.preventDefault();
                    toast.error("Você deve digitar DELETAR corretamente");
                    return;
                  }
                  deleteMutation.mutate();
                }}
                className="bg-rose-600 hover:bg-rose-700 text-white"
                disabled={deleteMutation.isPending || deleteConfirmText.toUpperCase() !== "DELETAR"}
              >
                {deleteMutation.isPending ? "Excluindo..." : "Confirmar Exclusão"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </DialogContent >
    </Dialog >
  );
}
