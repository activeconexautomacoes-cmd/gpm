import { LayoutDashboard, Users, Wallet, Tag, ShoppingBag, FileText, Receipt, LogOut, TrendingDown, TrendingUp, BarChart, Settings, User, Kanban, Package, BrainCircuit, Activity, Shield, Briefcase, ListTodo, Grid, ChevronRight, BarChart3, PieChart, Coins, Calculator, BookOpen, Bot, QrCode, MessageCircle, Lightbulb, GraduationCap, Palette, Plus } from "lucide-react";
import { NavLink, useNavigate, useLocation } from "react-router-dom";
import { useEffect, useState, useMemo } from "react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  useSidebar,
} from "@/components/ui/sidebar";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { ChevronDown } from "lucide-react";
import { useTheme } from "@/components/theme-provider";

export function AppSidebar() {
  const { open, setOpen } = useSidebar();
  const { currentWorkspace, workspaces, setCurrentWorkspace, can } = useWorkspace();
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const { theme } = useTheme();

  const isQuizEditor = location.pathname.includes("/dashboard/quizzes/") && location.pathname.split("/").filter(Boolean).length > 2;
  const [prevIsEditor, setPrevIsEditor] = useState(false);

  useEffect(() => {
    // Only auto-collapse when entering the editor from another page
    if (isQuizEditor && !prevIsEditor) {
      setOpen(false);
    }
    setPrevIsEditor(isQuizEditor);
  }, [isQuizEditor, prevIsEditor, setOpen]);

  // Handle temporary expand on hover
  const [isHovered, setIsHovered] = useState(false);

  const handleMouseEnter = () => {
    if (!open) {
      setIsHovered(true);
      setOpen(true);
    }
  };

  const handleMouseLeave = () => {
    if (isHovered) {
      setIsHovered(false);
      setOpen(false);
    }
  };


  const menuItems = useMemo(() => [
    {
      title: "Dashboard",
      url: "/dashboard",
      icon: LayoutDashboard,
      permission: "dashboard.view",
    },
    {
      title: "CRM",
      url: "/dashboard/crm",
      icon: Kanban,
      permission: "crm.view",
    },
    {
      title: "Contratos",
      url: "/dashboard/contracts",
      icon: FileText,
      permission: "contracts.view",
    },
    {
      title: "Vendas",
      url: "/dashboard/sales",
      icon: ShoppingBag,
      permission: "sales.manage",
    },
    {
      title: "Quizzes",
      url: "/dashboard/quizzes",
      icon: BrainCircuit,
      permission: "quizzes.view",
    },
    {
      title: "Financeiro",
      url: "/dashboard/financial",
      icon: Wallet,
      permission: "financial.view",
      items: [
        { title: "Visão Geral", url: "/dashboard/financial/overview", icon: PieChart },
        { title: "A Receber", url: "/dashboard/financial/receivables", icon: TrendingUp },
        { title: "A Pagar", url: "/dashboard/financial/payables", icon: TrendingDown },
        { title: "Conciliação", url: "/dashboard/financial/reconciliation", icon: Coins },
        { title: "Extrato", url: "/dashboard/financial/statement", icon: FileText },
        { title: "D.R.E.", url: "/dashboard/financial/dre", icon: BarChart3 },
        { title: "Configurações", url: "/dashboard/financial/settings", icon: Settings },
      ]
    },
    {
      title: "CS",
      url: "/dashboard/cs",
      icon: Users,
      permission: "reports.view",
      items: [
        { title: "Cobranças", url: "/dashboard/contract-billings", icon: Receipt },
        { title: "Churns", url: "/dashboard/churns", icon: TrendingDown },
      ]
    },
    {
      title: "Operações",
      url: "/dashboard/operations",
      icon: Briefcase,
      permission: "ops.view",
    },
    {
      title: "Demandas",
      url: "/dashboard/tasks",
      icon: ListTodo,
      permission: "ops.view",
    },
    {
      title: "Base de Conhecimento",
      url: "/dashboard/knowledge-base",
      icon: BookOpen,
      permission: "kb.view",
    },
    {
      title: "SDR AI",
      url: "/dashboard/sdr",
      icon: Bot,
      permission: "sdr.view",
      items: [
        { title: "Dashboard", url: "/dashboard/sdr", icon: BarChart3 },
        { title: "WhatsApp", url: "/dashboard/sdr/whatsapp", icon: QrCode },
        { title: "Sugestões", url: "/dashboard/sdr/sugestoes", icon: Lightbulb },
        { title: "Sugerir", url: "/dashboard/sdr/sugerir", icon: GraduationCap },
      ]
    },
    {
      title: "Artes",
      url: "/dashboard/artes",
      icon: Palette,
      items: [
        { title: "Kanban", url: "/dashboard/artes", icon: Kanban },
        { title: "Nova Solicitação", url: "/dashboard/artes/nova", icon: Plus },
      ],
    },
    {
      title: "Cadastros",
      url: "/dashboard/registrations",
      icon: Grid,
      permission: "settings.view",
      items: [
        { title: "Clientes", url: "/dashboard/clients", icon: Users },
        { title: "Produtos", url: "/dashboard/products", icon: Package },
        { title: "Fornecedores", url: "/dashboard/suppliers", icon: Briefcase },
      ]
    },
  ], []);

  const settingsItems = useMemo(() => [
    {
      title: "Membros",
      url: "/dashboard/workspace-members",
      icon: Users,
      permission: "team.manage",
    },
    {
      title: "Configurações",
      url: "/dashboard/settings",
      icon: Settings,
      permission: "settings.view",
    },
    {
      title: "Perfis e Permissões",
      url: "/dashboard/settings/roles",
      icon: Shield,
      permission: "team.manage",
    },
  ], []);

  const filteredMenuItems = menuItems.filter(item =>
    !item.permission || can(item.permission)
  );

  const filteredSettingsItems = settingsItems.filter(item =>
    !item.permission || can(item.permission)
  );

  return (
    <Sidebar
      collapsible="icon"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      className="mt-16 h-[calc(100vh-4rem)] border-r"
    >

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {filteredMenuItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  {item.items && item.items.length > 0 ? (
                    <Collapsible asChild defaultOpen={location.pathname.startsWith(item.url)} className="group/collapsible">
                      <div>
                        <CollapsibleTrigger asChild>
                          <SidebarMenuButton tooltip={item.title}>
                            {item.icon && <item.icon className="h-4 w-4" />}
                            <span>{item.title}</span>
                            <ChevronRight className="ml-auto transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
                          </SidebarMenuButton>
                        </CollapsibleTrigger>
                        <CollapsibleContent>
                          <SidebarMenuSub>
                            {item.items.map((subItem) => (
                              <SidebarMenuSubItem key={subItem.title}>
                                <SidebarMenuSubButton asChild>
                                  <NavLink
                                    to={subItem.url}
                                    className={({ isActive }) =>
                                      isActive ? "text-primary font-medium" : ""
                                    }
                                  >
                                    {subItem.icon && <subItem.icon className="h-4 w-4" />}
                                    <span>{subItem.title}</span>
                                  </NavLink>
                                </SidebarMenuSubButton>
                              </SidebarMenuSubItem>
                            ))}
                          </SidebarMenuSub>
                        </CollapsibleContent>
                      </div>
                    </Collapsible>
                  ) : (
                    <SidebarMenuButton asChild>
                      <NavLink
                        to={item.url}
                        className={({ isActive }) =>
                          isActive ? "bg-accent text-accent-foreground" : ""
                        }
                      >
                        <item.icon className="h-4 w-4" />
                        <span>{item.title}</span>
                      </NavLink>
                    </SidebarMenuButton>
                  )}
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {filteredSettingsItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink
                      to={item.url}
                      className={({ isActive }) =>
                        isActive ? "bg-accent text-accent-foreground" : ""
                      }
                    >
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>


    </Sidebar>
  );
}
