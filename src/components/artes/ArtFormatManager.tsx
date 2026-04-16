import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Plus, Loader2 } from "lucide-react";
import { useArtFormats, useCreateArtFormat, useUpdateArtFormat } from "@/hooks/useArtes";

export function ArtFormatManager() {
  const { data: formats = [], isLoading } = useArtFormats();
  const createFormat = useCreateArtFormat();
  const updateFormat = useUpdateArtFormat();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [width, setWidth] = useState("");
  const [height, setHeight] = useState("");

  const handleCreate = () => {
    if (!name || !width || !height) return;
    createFormat.mutate(
      { name, width: parseInt(width), height: parseInt(height) },
      {
        onSuccess: () => {
          setOpen(false);
          setName("");
          setWidth("");
          setHeight("");
        },
      }
    );
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-sm text-muted-foreground">{formats.length} formato(s)</p>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm">
              <Plus className="h-4 w-4 mr-1" /> Novo Formato
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Novo Formato de Arte</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Nome</Label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ex: Feed Instagram"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Largura (px)</Label>
                  <Input
                    type="number"
                    value={width}
                    onChange={(e) => setWidth(e.target.value)}
                    placeholder="1080"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Altura (px)</Label>
                  <Input
                    type="number"
                    value={height}
                    onChange={(e) => setHeight(e.target.value)}
                    placeholder="1080"
                  />
                </div>
              </div>
              <Button
                onClick={handleCreate}
                disabled={!name || !width || !height || createFormat.isPending}
                className="w-full"
              >
                {createFormat.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                Criar Formato
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {formats.map((fmt) => (
          <Card key={fmt.id} className={!fmt.active ? "opacity-50" : ""}>
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <p className="font-medium text-sm">{fmt.name}</p>
                <p className="text-xs text-muted-foreground">
                  {fmt.width} x {fmt.height}px
                </p>
              </div>
              <Switch
                checked={fmt.active}
                onCheckedChange={(active) =>
                  updateFormat.mutate({ id: fmt.id, active })
                }
              />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
