import { useProfile } from "@/hooks/use-profile";
import { Navigate, Outlet } from "react-router-dom";
import { Loader2 } from "lucide-react";

export function AdminRoute() {
    const { data: profile, isLoading } = useProfile();

    if (isLoading) {
        return <div className="flex h-screen items-center justify-center"><Loader2 className="h-8 w-8 animate-spin" /></div>;
    }

    if (!profile?.is_super_admin) {
        return <Navigate to="/dashboard" replace />;
    }

    return <Outlet />;
}
