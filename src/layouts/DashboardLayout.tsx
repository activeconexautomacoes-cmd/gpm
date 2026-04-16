import { Outlet } from "react-router-dom";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { NotificationBell } from "@/components/notifications/NotificationBell";
import { useTheme } from "@/components/theme-provider";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { ChevronDown } from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";
import { UserNav } from "@/components/UserNav";
import { FeedbackDialog } from "@/components/feedback/FeedbackDialog";
import { Lightbulb, ShieldCheck } from "lucide-react";
import { useProfile } from "@/hooks/use-profile";
import { Link } from "react-router-dom";

export default function DashboardLayout() {
  const { theme } = useTheme();
  const { currentWorkspace, workspaces, setCurrentWorkspace } = useWorkspace();
  const { data: profile } = useProfile();

  const logoUrl = theme === "dark" || (theme === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches)
    ? "https://rkngilknpcibcwalropj.supabase.co/storage/v1/object/public/sistema/Logo%20GPM%20branco%20-%20fundo%20transparente%20(2).png"
    : "https://rkngilknpcibcwalropj.supabase.co/storage/v1/object/public/sistema/Logo%20GPM%20preto%20-%20fundo%20transparente%20(1).png";

  return (
    <SidebarProvider defaultOpen={true}>
      <div className="flex flex-col min-h-screen w-full bg-background">
        <header className="h-16 border-b flex items-center justify-between px-4 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-50 w-full">
          <div className="flex items-center gap-4">
            <SidebarTrigger />
            <div className="h-10 w-auto flex items-center">
              <img
                src={logoUrl}
                alt="GPM Logo"
                className="h-8 w-auto object-contain"
              />
            </div>
          </div>
          <div className="flex items-center gap-1">
            {profile?.is_super_admin && (
              <Link to="/dashboard/admin/requests">
                <Button variant="ghost" size="icon" className="h-9 w-9 text-primary hover:text-primary hover:bg-primary/10" title="Painel Admin">
                  <ShieldCheck className="h-5 w-5" />
                </Button>
              </Link>
            )}
            <FeedbackDialog>
              <Button variant="outline" className="h-9 px-3 gap-2 text-muted-foreground hover:text-foreground border-dashed" title="Sugestões e Suporte">
                <Lightbulb className="h-4 w-4" />
                <span className="text-sm font-medium">Sugestões</span>
              </Button>
            </FeedbackDialog>
            <NotificationBell />
            <div className="w-[1px] h-6 bg-border mx-2" />

            {currentWorkspace && workspaces.length > 0 && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="h-9 px-3 gap-2 hover:bg-accent/50 border-none shadow-none font-medium">
                    <span className="truncate max-w-[150px]">{currentWorkspace.name}</span>
                    <ChevronDown className="h-4 w-4 opacity-50" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  {workspaces.map((workspace) => (
                    <DropdownMenuItem
                      key={workspace.id}
                      onClick={() => setCurrentWorkspace(workspace)}
                      className={currentWorkspace.id === workspace.id ? "bg-primary text-primary-foreground font-medium" : ""}
                    >
                      {workspace.name}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            )}

            <div className="w-[1px] h-6 bg-border mx-2" />
            <ThemeToggle />
            <div className="w-[1px] h-6 bg-border mx-2" />
            <UserNav />
          </div>
        </header>

        <div className="flex flex-1 overflow-hidden">
          <AppSidebar />
          <main className="flex-1 overflow-auto relative">
            <Outlet />
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
