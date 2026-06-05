import Link from "next/link";
import { MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { LOCAL_RETIRADA } from "@/lib/retirada";

const ROTA_RETIRADA = "/impressao/retirada";
const ROTULO = "Onde Pegar Minha Impressão?";

type Variante = "discreto" | "destacado";

type Props = {
  variante?: Variante;
  className?: string;
};

/**
 * CTA de navegação para a página de local de retirada (`/impressao/retirada`).
 * Apenas navega — não cria pedido, não faz upload, não gera PIX.
 *
 * - `discreto`: botão outline para o checkout, sem competir com o fluxo principal.
 * - `destacado`: card/banner com gradiente de marca para a tela de sucesso.
 */
export function BotaoOndeRetirar({ variante = "discreto", className }: Props) {
  if (variante === "destacado") {
    return (
      <Link
        href={ROTA_RETIRADA}
        className={cn(
          "group flex items-center gap-4 rounded-lg bg-gradient-to-r from-titans-red to-titans-orange p-4 text-left text-white transition-transform hover:scale-[1.02] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-titans-orange focus-visible:ring-offset-2",
          className,
        )}
      >
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-white/20">
          <MapPin className="h-6 w-6" />
        </span>
        <span className="flex flex-col">
          <span className="font-semibold">{ROTULO}</span>
          <span className="text-sm text-white/90">{LOCAL_RETIRADA}</span>
        </span>
      </Link>
    );
  }

  return (
    <Button asChild variant="outline" className={className}>
      <Link href={ROTA_RETIRADA}>
        <MapPin className="h-4 w-4" />
        {ROTULO}
      </Link>
    </Button>
  );
}
