import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle2 } from "lucide-react";
import Link from "next/link";

type Props = {
  pedidoId: string;
};

export function TelaSucesso({ pedidoId }: Props) {
  const protocolo = pedidoId.slice(0, 8).toUpperCase();

  return (
    <Card>
      <CardContent className="p-8 text-center space-y-4">
        <CheckCircle2 className="mx-auto h-16 w-16 text-green-500" />
        <h2 className="text-2xl font-bold">Pagamento confirmado!</h2>
        <p className="text-muted-foreground">
          Seu pedido entrou na fila de impressão. Guarde o protocolo abaixo
          para retirar a impressão na sede da TITANS.
        </p>
        <div className="bg-muted/30 rounded-lg py-3">
          <p className="text-xs text-muted-foreground">Protocolo</p>
          <p className="text-2xl font-mono font-bold tracking-widest">{protocolo}</p>
        </div>
        <Button asChild className="mt-4">
          <Link href="/">Voltar ao início</Link>
        </Button>
      </CardContent>
    </Card>
  );
}
