import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, MapPin } from "lucide-react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { Badge } from "@/components/ui/badge";
import { LOCAL_RETIRADA, FOTOS_RETIRADA } from "@/lib/retirada";

export const metadata: Metadata = {
  title: "Onde retirar sua impressão | TITANS",
  description:
    "Local de retirada das impressões da TITANS: Sala 208, Prédio LDTEA – FCTE Gama. Veja o endereço e fotos do caminho até a sala.",
};

export default function RetiradaPage() {
  return (
    <div className="min-h-screen bg-background">
      <Header />

      <main className="pt-24 pb-12">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl mx-auto">
            <Link
              href="/impressao"
              className="inline-flex items-center text-muted-foreground hover:text-foreground mb-6 transition-colors"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Voltar para a impressão
            </Link>

            <Badge className="mb-4 bg-gradient-to-r from-titans-red to-titans-orange text-white">
              Local de Retirada
            </Badge>
            <h1 className="text-3xl md:text-5xl font-bold mb-4">
              <span className="bg-gradient-to-r from-titans-red to-titans-orange bg-clip-text text-transparent">
                Onde pegar sua impressão
              </span>
            </h1>

            <div className="flex items-start gap-3 rounded-lg border border-border bg-muted/30 p-4 mb-8">
              <MapPin className="h-6 w-6 shrink-0 text-titans-red" />
              <div>
                <p className="text-sm text-muted-foreground">Endereço</p>
                <p className="text-lg font-semibold">{LOCAL_RETIRADA}</p>
              </div>
            </div>

            <h2 className="text-xl font-semibold mb-4">Fotos do local</h2>
            <ul className="grid grid-cols-1 sm:grid-cols-2 gap-4 list-none p-0">
              {FOTOS_RETIRADA.map((foto) => (
                <li
                  key={foto.src}
                  className="overflow-hidden rounded-xl border border-border bg-card"
                >
                  <img
                    src={foto.src}
                    alt={foto.alt}
                    loading="lazy"
                    className="aspect-video w-full object-cover"
                  />
                  <p className="px-4 py-3 text-sm text-muted-foreground">
                    {foto.alt}
                  </p>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
