import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { WebRequestForm } from "@/components/web/WebRequestForm";

export default function WebNova() {
  const navigate = useNavigate();
  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard/web")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold">Nova Demanda Web</h1>
          <p className="text-sm text-muted-foreground">Descreva o que precisa ser desenvolvido</p>
        </div>
      </div>
      <WebRequestForm />
    </div>
  );
}
