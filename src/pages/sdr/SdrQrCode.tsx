import { useState, useEffect, useRef } from "react";
import { Loader2, Wifi, WifiOff, QrCode, RefreshCw } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  getConnectionState,
  connectInstance,
  logoutInstance,
  createInstance,
} from "@/lib/sdr/evolution";

type ConnectionStatus = "disconnected" | "loading" | "qr_ready" | "connected" | "error";

export default function SdrQrCode() {
  const [status, setStatus] = useState<ConnectionStatus>("loading");
  const [qrImage, setQrImage] = useState("");
  const [error, setError] = useState("");
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopPolling = () => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
  };

  const checkStatus = async () => {
    try {
      const data = await getConnectionState();
      if (data.instance.state === "open") {
        setStatus("connected");
        setQrImage("");
        stopPolling();
        return "open";
      }
      setStatus("disconnected");
      stopPolling();
      return data.instance.state;
    } catch {
      setStatus("disconnected");
      stopPolling();
      return "not_found";
    }
  };

  useEffect(() => {
    checkStatus();
    return () => stopPolling();
  }, []);

  const startPolling = () => {
    stopPolling();
    pollingRef.current = setInterval(async () => {
      try {
        const data = await getConnectionState();
        if (data.instance.state === "open") {
          setStatus("connected");
          setQrImage("");
          stopPolling();
        }
      } catch {}
    }, 5000);
  };

  const handleConnect = async () => {
    setStatus("loading");
    setError("");
    try {
      try { await createInstance(); } catch {}
      let retries = 3;
      while (retries > 0) {
        try {
          const data = await connectInstance();
          if (data.base64) {
            setQrImage(data.base64);
            setStatus("qr_ready");
            startPolling();
            return;
          }
        } catch {}
        const state = await checkStatus();
        if (state === "open") return;
        retries--;
        if (retries > 0) await new Promise((r) => setTimeout(r, 2000));
      }
      setError("Não foi possível gerar o QR Code. Tente novamente.");
      setStatus("error");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao conectar");
      setStatus("error");
    }
  };

  const disconnect = async () => {
    try {
      await logoutInstance();
      setStatus("disconnected");
      setQrImage("");
      stopPolling();
    } catch {
      setError("Erro ao desconectar");
    }
  };

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">Conexão WhatsApp</h1>

      <Card className="max-w-md">
        <CardHeader>
          <CardTitle className="text-base">Status da Conexão</CardTitle>
        </CardHeader>
        <CardContent>
          {status === "connected" && (
            <div className="text-center space-y-4">
              <div className="w-12 h-12 mx-auto bg-emerald-500/20 rounded-full flex items-center justify-center">
                <Wifi className="h-6 w-6 text-emerald-500" />
              </div>
              <p className="font-medium text-emerald-500">WhatsApp conectado</p>
              <p className="text-xs text-muted-foreground">A SDR está ativa e respondendo</p>
              <Button variant="destructive" size="sm" onClick={disconnect}>
                Desconectar
              </Button>
            </div>
          )}

          {status === "disconnected" && (
            <div className="text-center space-y-4">
              <div className="w-12 h-12 mx-auto bg-muted rounded-full flex items-center justify-center">
                <WifiOff className="h-6 w-6 text-muted-foreground" />
              </div>
              <p className="text-muted-foreground">WhatsApp desconectado</p>
              <Button onClick={handleConnect}>
                <QrCode className="mr-2 h-4 w-4" />
                Conectar WhatsApp
              </Button>
            </div>
          )}

          {status === "loading" && (
            <div className="text-center space-y-4">
              <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
              <p className="text-sm text-muted-foreground">Conectando...</p>
            </div>
          )}

          {status === "qr_ready" && qrImage && (
            <div className="text-center space-y-4">
              <p className="text-sm text-muted-foreground">Escaneie o QR Code com seu WhatsApp</p>
              <img
                src={qrImage}
                alt="QR Code WhatsApp"
                className="mx-auto rounded-lg bg-white p-2 w-64 h-64"
              />
              <div className="flex gap-2 justify-center">
                <Button variant="ghost" size="sm" onClick={handleConnect}>
                  <RefreshCw className="mr-1 h-3 w-3" /> Novo QR
                </Button>
                <Button variant="ghost" size="sm" onClick={() => checkStatus()}>
                  Já escaneei
                </Button>
              </div>
            </div>
          )}

          {status === "error" && (
            <div className="text-center space-y-4">
              <p className="text-sm text-destructive">{error}</p>
              <Button onClick={handleConnect}>Tentar novamente</Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
