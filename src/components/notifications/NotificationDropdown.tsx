import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Check, X, Bell, FileText, Wallet, AlertTriangle, UserPlus, Info } from "lucide-react";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";

interface NotificationDropdownProps {
  onClose: () => void;
}

export function NotificationDropdown({ onClose }: NotificationDropdownProps) {
  const { currentWorkspace } = useWorkspace();
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const { data: notifications } = useQuery({
    queryKey: ["notifications", currentWorkspace?.id],
    queryFn: async () => {
      if (!currentWorkspace?.id) return [];

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];

      const { data, error } = await supabase
        .from("notifications")
        .select("*")
        .eq("workspace_id", currentWorkspace.id)
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(20);

      if (error) throw error;
      return data;
    },
    enabled: !!currentWorkspace?.id,
  });

  const markAsReadMutation = useMutation({
    mutationFn: async (notificationId: string) => {
      const { error } = await supabase
        .from("notifications")
        .update({ is_read: true })
        .eq("id", notificationId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
      queryClient.invalidateQueries({ queryKey: ["notifications-unread"] });
    },
  });

  const markAllAsReadMutation = useMutation({
    mutationFn: async () => {
      if (!currentWorkspace?.id) return;

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { error } = await supabase
        .from("notifications")
        .update({ is_read: true })
        .eq("workspace_id", currentWorkspace.id)
        .eq("user_id", user.id)
        .eq("is_read", false);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
      queryClient.invalidateQueries({ queryKey: ["notifications-unread"] });
      toast.success("Todas as notificações marcadas como lidas");
    },
  });

  const handleNotificationClick = (notification: any) => {
    markAsReadMutation.mutate(notification.id);
    if (notification.link) {
      navigate(notification.link);
      onClose();
    }
  };

  const getNotificationConfig = (type: string) => {
    switch (type) {
      case "billing":
        return { label: "Financeiro", icon: Wallet, color: "text-green-500", bg: "bg-green-500/10" };
      case "contract":
        return { label: "Contratos", icon: FileText, color: "text-blue-500", bg: "bg-blue-500/10" };
      case "churn":
        return { label: "Churn", icon: AlertTriangle, color: "text-red-500", bg: "bg-red-500/10" };
      case "opportunity_assigned":
        return { label: "Oportunidade", icon: UserPlus, color: "text-blue-500", bg: "bg-blue-500/10" };
      default:
        return { label: "Notificação", icon: Bell, color: "text-gray-500", bg: "bg-gray-500/10" };
    }
  };

  return (
    <Card className="fixed sm:absolute right-4 left-4 sm:left-auto sm:right-0 top-16 sm:top-12 sm:w-[400px] z-[100] shadow-2xl border-border/50 backdrop-blur-xl bg-card/95">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 p-4 border-b border-border/50">
        <div className="flex items-center gap-2">
          <Bell className="h-4 w-4 text-primary" />
          <CardTitle className="text-base font-bold">Notificações</CardTitle>
        </div>
        <div className="flex gap-1">
          {notifications && notifications.some((n) => !n.is_read) && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs font-medium text-muted-foreground hover:text-primary"
              onClick={() => markAllAsReadMutation.mutate()}
            >
              Marcar todas como lidas
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <ScrollArea className="h-[450px]">
          {notifications && notifications.length > 0 ? (
            <div className="divide-y divide-border/50">
              {notifications.map((notification) => {
                const config = getNotificationConfig(notification.type);
                const Icon = config.icon;

                return (
                  <div
                    key={notification.id}
                    className={`group relative p-4 cursor-pointer transition-all hover:bg-muted/50 ${!notification.is_read ? "bg-primary/5" : ""
                      }`}
                    onClick={() => handleNotificationClick(notification)}
                  >
                    {!notification.is_read && (
                      <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary" />
                    )}
                    <div className="flex items-start gap-4">
                      <div className={`mt-1 p-2 rounded-full ${config.bg} ${config.color}`}>
                        <Icon className="h-4 w-4" />
                      </div>
                      <div className="flex-1 space-y-1">
                        <div className="flex items-center justify-between">
                          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${config.bg} ${config.color}`}>
                            {config.label}
                          </span>
                          <span className="text-[10px] text-muted-foreground">
                            {formatDistanceToNow(new Date(notification.created_at), { addSuffix: true, locale: ptBR })}
                          </span>
                        </div>
                        <p className={`text-sm ${!notification.is_read ? "font-semibold text-foreground" : "font-medium text-muted-foreground"}`}>
                          {notification.title}
                        </p>
                        <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                          {notification.description}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-center space-y-3">
              <div className="p-4 rounded-full bg-muted/50">
                <Bell className="h-8 w-8 text-muted-foreground/50" />
              </div>
              <p className="text-sm font-medium text-muted-foreground">
                Nenhuma notificação nova
              </p>
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
