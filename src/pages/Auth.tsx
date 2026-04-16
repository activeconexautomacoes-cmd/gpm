import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";
import { useTheme } from "@/components/theme-provider";

export default function Auth() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const { theme } = useTheme();
  const [mode, setMode] = useState<"signin" | "signup">("signin");

  const logoUrl = theme === "dark" || (theme === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches)
    ? "https://rkngilknpcibcwalropj.supabase.co/storage/v1/object/public/sistema/Logo%20GPM%20branco%20-%20fundo%20transparente%20(2).png"
    : "https://rkngilknpcibcwalropj.supabase.co/storage/v1/object/public/sistema/Logo%20GPM%20preto%20-%20fundo%20transparente%20(1).png";

  // Handle invite code from URL
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const inviteCode = params.get("invite");
    const storedInvite = localStorage.getItem("pending_invite_code");

    if (inviteCode) {
      localStorage.setItem("pending_invite_code", inviteCode);
      setHasInvite(true);
    } else if (storedInvite) {
      setHasInvite(true);
    }
  }, []);

  // Form states
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [workspaceName, setWorkspaceName] = useState("");
  const [hasInvite, setHasInvite] = useState(false);

  useEffect(() => {
    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (session) {
        const pendingInvite = localStorage.getItem("pending_invite_code");
        if (pendingInvite) {
          localStorage.removeItem("pending_invite_code");
          navigate(`/invite/${pendingInvite}`);
        } else {
          navigate("/dashboard");
        }
      }
    });

    // THEN check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        const pendingInvite = localStorage.getItem("pending_invite_code");
        if (pendingInvite) {
          localStorage.removeItem("pending_invite_code");
          navigate(`/invite/${pendingInvite}`);
        } else {
          navigate("/dashboard");
        }
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;

      toast({
        title: "Login realizado com sucesso!",
        description: "Bem-vindo de volta ao GPM.",
      });
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Erro no login",
        description: error.message || "Verifique suas credenciais e tente novamente.",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Create user
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName,
          },
          emailRedirectTo: `${window.location.origin}/`,
        },
      });

      if (authError) throw authError;
      if (!authData.user) throw new Error("Erro ao criar usuário");

      const hasSession = !!authData.session;
      const workspaceNameTrimmed = workspaceName.trim();

      // If workspace name provided
      if (workspaceNameTrimmed) {
        if (hasSession) {
          // Session active: create workspace immediately
          const slug = workspaceNameTrimmed.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "").slice(0, 60);

          const { data: workspace, error: workspaceError } = await supabase
            .from("workspaces")
            .insert({
              name: workspaceNameTrimmed,
              slug,
              owner_id: authData.user.id,
            })
            .select()
            .single();

          if (workspaceError) throw workspaceError;

          // Add user as owner to workspace
          const { error: memberError } = await supabase
            .from("workspace_members")
            .insert({
              workspace_id: workspace.id,
              user_id: authData.user.id,
              role: "owner",
            });

          if (memberError) throw memberError;

          toast({
            title: "Conta criada com sucesso!",
            description: "Seu workspace foi configurado.",
          });
        } else {
          // No session: save workspace name for later creation
          localStorage.setItem("pendingWorkspaceName", workspaceNameTrimmed);
          toast({
            title: "Conta criada!",
            description: "Por favor, confirme seu email. Seu workspace será criado no primeiro login.",
          });
        }
      } else {
        toast({
          title: "Conta criada com sucesso!",
          description: hasSession ? "Você pode criar um workspace no dashboard." : "Por favor, confirme seu email para continuar.",
        });
      }
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Erro no cadastro",
        description: error.message || "Não foi possível criar a conta.",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-primary/5 p-4">
      <Card className="w-full max-w-md shadow-elegant">
        <CardHeader className="space-y-1 pt-4">
          <div className="flex items-center justify-center mb-0">
            <img
              src={logoUrl}
              alt="GPM Logo"
              className="h-56 w-auto object-contain"
            />
          </div>
        </CardHeader>
        <CardContent>
          <Tabs value={mode} onValueChange={(v) => setMode(v as "signin" | "signup")}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="signin">Entrar</TabsTrigger>
              <TabsTrigger value="signup">Criar Conta</TabsTrigger>
            </TabsList>

            <TabsContent value="signin">
              <form onSubmit={handleSignIn} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="signin-email">Email</Label>
                  <Input
                    id="signin-email"
                    type="email"
                    placeholder="seu@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    disabled={loading}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signin-password">Senha</Label>
                  <Input
                    id="signin-password"
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    disabled={loading}
                  />
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Entrar
                </Button>
              </form>
            </TabsContent>

            <TabsContent value="signup">
              <form onSubmit={handleSignUp} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="signup-name">Nome Completo</Label>
                  <Input
                    id="signup-name"
                    type="text"
                    placeholder="João Silva"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    required
                    disabled={loading}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signup-email">Email</Label>
                  <Input
                    id="signup-email"
                    type="email"
                    placeholder="seu@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    disabled={loading}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signup-password">Senha</Label>
                  <Input
                    id="signup-password"
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    disabled={loading}
                    minLength={6}
                  />
                </div>
                {!hasInvite && (
                  <div className="space-y-2">
                    <Label htmlFor="workspace-name">
                      Nome do Workspace <span className="text-muted-foreground">(opcional)</span>
                    </Label>
                    <Input
                      id="workspace-name"
                      type="text"
                      placeholder="Minha Empresa"
                      value={workspaceName}
                      onChange={(e) => setWorkspaceName(e.target.value)}
                      disabled={loading}
                    />
                  </div>
                )}
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Criar Conta
                </Button>
              </form>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
