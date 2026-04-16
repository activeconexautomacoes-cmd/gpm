import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuGroup,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useToast } from "@/hooks/use-toast";
import { User, LogOut, Settings } from "lucide-react";

export function UserNav() {
    const navigate = useNavigate();
    const { toast } = useToast();

    const { data: profile } = useQuery({
        queryKey: ["profile"],
        queryFn: async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return null;

            const { data, error } = await supabase
                .from("profiles")
                .select("*")
                .eq("id", user.id)
                .single();

            if (error) return null;
            return data;
        },
    });

    const handleLogout = async () => {
        await supabase.auth.signOut();
        toast({
            title: "Logout realizado",
            description: "Até logo!",
        });
        navigate("/auth");
    };

    const initials = profile?.full_name
        ?.split(" ")
        .map((n: string) => n[0])
        .join("")
        .toUpperCase() || "U";

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="relative h-10 w-10 rounded-full">
                    <Avatar className="h-10 w-10 border border-border shadow-sm">
                        <AvatarImage src={profile?.avatar_url || ""} alt={profile?.full_name || ""} />
                        <AvatarFallback className="bg-primary/10 text-primary font-bold">
                            {initials}
                        </AvatarFallback>
                    </Avatar>
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-64" align="end" forceMount>
                <DropdownMenuLabel className="font-normal">
                    <div className="flex flex-col space-y-1 py-1">
                        <p className="text-sm font-semibold leading-none">{profile?.full_name || "Usuário"}</p>
                        <p className="text-xs leading-none text-muted-foreground">
                            {profile?.email || ""}
                        </p>
                    </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuGroup>
                    <DropdownMenuItem onClick={() => navigate("/dashboard/profile")} className="cursor-pointer">
                        <User className="mr-2 h-4 w-4" />
                        <span>Meu Perfil</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => navigate("/dashboard/settings")} className="cursor-pointer">
                        <Settings className="mr-2 h-4 w-4" />
                        <span>Configurações</span>
                    </DropdownMenuItem>
                </DropdownMenuGroup>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleLogout} className="cursor-pointer text-destructive focus:text-destructive">
                    <LogOut className="mr-2 h-4 w-4" />
                    <span>Sair</span>
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
