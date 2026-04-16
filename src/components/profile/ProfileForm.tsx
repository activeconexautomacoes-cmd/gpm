import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { toast } from "sonner";
import { Upload, Loader2 } from "lucide-react";

export function ProfileForm() {
  const queryClient = useQueryClient();
  const [uploading, setUploading] = useState(false);

  const { data: profile } = useQuery({
    queryKey: ["profile"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();

      if (error) throw error;
      return data;
    },
  });

  const updateProfileMutation = useMutation({
    mutationFn: async (updates: { full_name?: string; avatar_url?: string }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { error } = await supabase
        .from("profiles")
        .update(updates)
        .eq("id", user.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["profile"] });
      toast.success("Perfil atualizado com sucesso!");
    },
    onError: () => {
      toast.error("Erro ao atualizar perfil");
    },
  });

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const fileExt = file.name.split(".").pop();
      const filePath = `${user.id}/avatar.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(filePath, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from("avatars")
        .getPublicUrl(filePath);

      await updateProfileMutation.mutateAsync({ avatar_url: publicUrl });
    } catch (error) {
      toast.error("Erro ao fazer upload da imagem");
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const full_name = formData.get("full_name") as string;
    updateProfileMutation.mutate({ full_name });
  };

  const initials = profile?.full_name
    ?.split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase() || "?";

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="flex flex-col items-center gap-4">
        <Avatar className="h-24 w-24">
          <AvatarImage src={profile?.avatar_url || ""} />
          <AvatarFallback>{initials}</AvatarFallback>
        </Avatar>
        <div>
          <Input
            id="avatar"
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleAvatarUpload}
            disabled={uploading}
          />
          <Label htmlFor="avatar">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={uploading}
              onClick={() => document.getElementById("avatar")?.click()}
            >
              {uploading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Upload className="mr-2 h-4 w-4" />
              )}
              {uploading ? "Enviando..." : "Alterar Foto"}
            </Button>
          </Label>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input id="email" value={profile?.email || ""} disabled />
      </div>

      <div className="space-y-2">
        <Label htmlFor="full_name">Nome Completo</Label>
        <Input
          id="full_name"
          name="full_name"
          defaultValue={profile?.full_name || ""}
          required
        />
      </div>

      <Button type="submit" disabled={updateProfileMutation.isPending}>
        {updateProfileMutation.isPending ? "Salvando..." : "Salvar Alterações"}
      </Button>
    </form>
  );
}
