"use client";

import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Copy, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { formatBRL } from "@/lib/pricing";
import { usePedidoStatus } from "@/hooks/usePedidoStatus";

type Props = {
  pedidoId: string;
  qrCodeBase64: string;
  qrCodeCopiaCola: string;
  expirationDateTo: string | null | undefined;
  valorCentavos: number;
  onPago: () => void;
  onTimeout: () => void;
};

function calcSegundosRestantes(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return null;
  return Math.max(0, Math.floor((t - Date.now()) / 1000));
}

function formatarSegundos(s: number): string {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${sec.toString().padStart(2, "0")}`;
}

export function TelaPagamento({
  pedidoId,
  qrCodeBase64,
  qrCodeCopiaCola,
  expirationDateTo,
  valorCentavos,
  onPago,
  onTimeout,
}: Props) {
  const { status, error } = usePedidoStatus(pedidoId, expirationDateTo);
  const [restantes, setRestantes] = useState<number | null>(() =>
    calcSegundosRestantes(expirationDateTo)
  );

  useEffect(() => {
    if (status === "PAGO") onPago();
  }, [status, onPago]);

  useEffect(() => {
    if (error === "TIMEOUT") onTimeout();
  }, [error, onTimeout]);

  useEffect(() => {
    if (!expirationDateTo) return;
    const tick = () => setRestantes(calcSegundosRestantes(expirationDateTo));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [expirationDateTo]);

  const qrSrc = useMemo(
    () => `data:image/png;base64,${qrCodeBase64}`,
    [qrCodeBase64]
  );

  async function copiar() {
    try {
      await navigator.clipboard.writeText(qrCodeCopiaCola);
      toast.success("Código PIX copiado!");
    } catch {
      toast.error("Não foi possível copiar. Selecione manualmente.");
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Pague com PIX</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="text-center">
          <p className="text-sm text-muted-foreground">Valor</p>
          <p className="text-3xl font-bold text-titans-orange">{formatBRL(valorCentavos)}</p>
        </div>

        <div className="flex flex-col items-center gap-3">
          <img
            src={qrSrc}
            alt="QR Code PIX"
            className="w-56 h-56 border border-border rounded-lg bg-white p-2"
          />
          <Button variant="outline" onClick={copiar} className="gap-2">
            <Copy className="h-4 w-4" />
            Copiar código Copia e Cola
          </Button>
          {restantes !== null && restantes > 0 && (
            <p className="text-sm text-muted-foreground">
              Expira em {formatarSegundos(restantes)}
            </p>
          )}
        </div>

        <div className="border-t border-border pt-4 text-center text-sm text-muted-foreground flex items-center justify-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin" />
          Aguardando confirmação do pagamento…
        </div>
      </CardContent>
    </Card>
  );
}
