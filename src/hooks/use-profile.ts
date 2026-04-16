import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface Profile {
    id: string;
    email: string;
    full_name: string;
    avatar_url: string;
    is_super_admin: boolean;
    has_google_calendar: boolean;
}

export function useProfile() {
    return useQuery({
        queryKey: ["profile"],
        queryFn: async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return null;

            const { data, error } = await supabase
                .from("profiles")
                .select("*")
                .eq("id", user.id)
                .single();

            if (error) {
                console.error("Error fetching profile:", error);
                return null;
            }
            return data as unknown as Profile;
        },
    });
}
