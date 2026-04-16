import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { Button } from "@/components/ui/button";
import { Bell } from "lucide-react";
import { NotificationDropdown } from "./NotificationDropdown";
import { toast } from "sonner";

export function NotificationBell() {
  const { currentWorkspace } = useWorkspace();
  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();

  // Play a subtle sound
  const playNotificationSound = () => {
    const audio = new Audio("https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3");
    audio.volume = 0.5;
    audio.play().catch(console.error);
  };

  const { data: unreadCount } = useQuery({
    queryKey: ["notifications-unread", currentWorkspace?.id],
    queryFn: async () => {
      if (!currentWorkspace?.id) return 0;

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return 0;

      const { count, error } = await supabase
        .from("notifications")
        .select("*", { count: "exact", head: true })
        .eq("workspace_id", currentWorkspace.id)
        .eq("user_id", user.id)
        .eq("is_read", false);

      if (error) throw error;
      return count || 0;
    },
    enabled: !!currentWorkspace?.id,
  });

  useEffect(() => {
    if (!currentWorkspace?.id) return;

    const setupRealtime = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const channel = supabase
        .channel('notifications-realtime')
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'notifications',
            filter: `workspace_id=eq.${currentWorkspace.id}`
          },
          (payload) => {
            const newNotification = payload.new as any;
            if (newNotification.user_id === user.id) {
              // Invalidate queries to update count and list
              queryClient.invalidateQueries({ queryKey: ["notifications-unread"] });
              queryClient.invalidateQueries({ queryKey: ["notifications"] });

              // Show toast and play sound
              playNotificationSound();
              toast(newNotification.title, {
                description: newNotification.description,
                action: {
                  label: "Ver",
                  onClick: () => setOpen(true),
                },
              });
            }
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    };

    setupRealtime();
  }, [currentWorkspace?.id, queryClient]);

  return (
    <div className="relative">
      <Button
        variant="ghost"
        size="icon"
        onClick={() => setOpen(!open)}
        className="relative"
      >
        <Bell className="h-5 w-5" />
        {unreadCount !== undefined && unreadCount > 0 && (
          <span className="absolute top-0 right-0 h-5 w-5 rounded-full bg-destructive text-destructive-foreground text-xs flex items-center justify-center animate-in zoom-in duration-300">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </Button>
      {open && <NotificationDropdown onClose={() => setOpen(false)} />}
    </div>
  );
}
