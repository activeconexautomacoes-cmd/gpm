import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { ArtRequestForm } from "@/components/artes/ArtRequestForm";

export default function ArtesNova() {
  const navigate = useNavigate();

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard/artes")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold">Nova Solicitação de Arte</h1>
          <p className="text-sm text-muted-foreground">
            Preencha os dados e a IA vai gerar o brief para o designer
          </p>
        </div>
      </div>

      <ArtRequestForm />
    </div>
  );
}
