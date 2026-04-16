
import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Loader2, CheckCircle2, XCircle } from "lucide-react";

export default function InvitePage() {
    const { code } = useParams<{ code: string }>();
    const navigate = useNavigate();
    const { toast } = useToast();
    const [loading, setLoading] = useState(true);
    const [status, setStatus] = useState<"idle" | "success" | "error">("idle");
    const [message, setMessage] = useState("");

    useEffect(() => {
        async function processInvite() {
            if (!code) return;

            try {
                const { data: { session } } = await supabase.auth.getSession();

                if (!session) {
                    // Store code in local storage to join after login/signup
                    localStorage.setItem("pending_invite_code", code);
                    toast({
                        title: "Convite pendente",
                        description: "Por favor, faça login ou cadastre-se para entrar no workspace.",
                    });
                    navigate(`/auth?invite=${code}`);
                    return;
                }

                const { data, error } = await (supabase as any).rpc("join_workspace_via_link", {
                    invite_code: code
                });

                if (error) throw error;

                const result = data as { success: boolean; message: string; workspace_id?: string; needs_auth?: boolean };

                if (result.success) {
                    setStatus("success");
                    setMessage(result.message);
                    toast({
                        title: "Sucesso!",
                        description: result.message,
                    });
                    // Redirect to dashboard after a delay
                    setTimeout(() => {
                        navigate("/dashboard");
                    }, 3000);
                } else {
                    setStatus("error");
                    setMessage(result.message);
                    if (result.needs_auth) {
                        localStorage.setItem("pending_invite_code", code);
                        navigate(`/auth?invite=${code}`);
                    }
                }
            } catch (error: any) {
                console.error("Error processing invite:", error);
                setStatus("error");
                setMessage("Ocorreu um erro ao processar seu convite. Tente novamente mais tarde.");
            } finally {
                setLoading(false);
            }
        }

        processInvite();
    }, [code, navigate, toast]);

    return (
        <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
            <Card className="max-w-md w-full border-2">
                <CardHeader className="text-center">
                    <CardTitle className="text-2xl">Convite para Workspace</CardTitle>
                    <CardDescription>
                        Validando seu link de acesso...
                    </CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col items-center justify-center py-10 space-y-4">
                    {loading ? (
                        <>
                            <Loader2 className="h-12 w-12 text-primary animate-spin" />
                            <p className="text-muted-foreground animate-pulse">Verificando convite...</p>
                        </>
                    ) : status === "success" ? (
                        <>
                            <CheckCircle2 className="h-16 w-16 text-green-500" />
                            <p className="text-xl font-semibold text-center">{message}</p>
                            <p className="text-muted-foreground">Redirecionando você para o dashboard...</p>
                            <Button onClick={() => navigate("/dashboard")}>Ir para o Dashboard</Button>
                        </>
                    ) : (
                        <>
                            <XCircle className="h-16 w-16 text-destructive" />
                            <p className="text-xl font-semibold text-center text-destructive">{message}</p>
                            <Button variant="outline" onClick={() => navigate("/auth")}>Ir para Login</Button>
                        </>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
