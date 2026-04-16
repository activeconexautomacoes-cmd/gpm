import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ProfileForm } from "@/components/profile/ProfileForm";
import { PasswordChangeDialog } from "@/components/profile/PasswordChangeDialog";
import { User, Calendar } from "lucide-react";
import { PersonalCalendarSettings } from "@/components/settings/PersonalCalendarSettings";

export default function Profile() {
  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center gap-3">
        <User className="h-8 w-8" />
        <div>
          <h1 className="text-3xl font-bold">Meu Perfil</h1>
          <p className="text-muted-foreground">
            Gerencie suas informações pessoais e preferências
          </p>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Informações Pessoais</CardTitle>
          </CardHeader>
          <CardContent>
            <ProfileForm />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Segurança</CardTitle>
          </CardHeader>
          <CardContent>
            <PasswordChangeDialog />
          </CardContent>
        </Card>
      </div>

      <div className="pt-6 border-t">
        <div className="flex items-center gap-3 mb-6">
          <Calendar className="h-6 w-6 text-primary" />
          <h2 className="text-2xl font-bold">Minha Agenda e Disponibilidade</h2>
        </div>
        <PersonalCalendarSettings />
      </div>
    </div>
  );
}
