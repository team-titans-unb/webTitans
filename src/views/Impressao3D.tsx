"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, Boxes, Layers, Ruler } from "lucide-react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import ProjectHeroCarousel from "@/components/ProjectHeroCarousel";
import FormularioModelagem from "@/components/servicos/FormularioModelagem";
import FormularioArquivos from "@/components/servicos/FormularioArquivos";
import impressoraCa from "@/assets/fotosImpressora3D/impressoraCa.jpeg";
import impressaoLogos from "@/assets/fotosImpressora3D/impressaoLogos.jpeg";

const HERO_IMAGES = [
  { src: impressoraCa.src, alt: "Impressora 3D da TITANS em funcionamento" },
  { src: impressaoLogos.src, alt: "Peças impressas em 3D pela TITANS" },
] as const;

const MATERIAIS = [
  { nome: "PLA", desc: "Rígido, fácil de imprimir, ótimo para protótipos e peças de baixo custo." },
  { nome: "ABS", desc: "Mais resistente a impacto e calor, indicado para peças que ficam expostas a sol e chuva." },
  { nome: "PETG", desc: "Termoplástico que combina a facilidade do PLA com a alta resistência e durabilidade do ABS" },
  { nome: "TPU", desc: "Filamento flexível (borrachoso), para peças que precisam dobrar ou amortecer." },
];

type FormAberto = null | "arquivos" | "modelagem";

const Impressao3D = () => {
  const [formAberto, setFormAberto] = useState<FormAberto>(null);

  return (
    <div className="min-h-screen bg-background">
      <Header />

      {/* Hero / apresentação */}
      <section className="pt-24 pb-14 bg-gradient-to-b from-background to-muted/10">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <Link
            href="/impressao"
            className="inline-flex items-center text-muted-foreground hover:text-foreground mb-6 transition-colors text-sm"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Ver também: Imprima seu PDF
          </Link>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-12 items-center max-w-6xl mx-auto">
            <div className="text-center lg:text-left">
              <h1 className="text-4xl md:text-5xl font-bold mb-6">
                <span className="bg-gradient-to-r from-titans-red to-titans-orange bg-clip-text text-transparent">
                  Impressão 3D
                </span>
              </h1>
              <p className="text-lg text-muted-foreground leading-relaxed mb-4">
                Precisando fazer impressão 3D para o seu projeto ou para as suas
                matérias na universidade? A TITANS tem a solução!
              </p>
              <p className="text-muted-foreground leading-relaxed">
                Imprimimos com camadas de até <strong>0,05&nbsp;mm</strong>, garantindo um acabamento fino e detalhes bem definidos.
                Trabalhamos com materiais como <strong>ABS</strong>,{" "}
                <strong>PLA</strong>, <strong>PETG</strong> e filamentos flexíveis
                como o <strong>TPU</strong> escolhemos junto com você o mais
                adequado para a aplicação da peça.
              </p>

              <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center lg:justify-start">
                <Button
                  onClick={() => {
                    setFormAberto("arquivos");
                    document
                      .getElementById("pedido")
                      ?.scrollIntoView({ behavior: "smooth", block: "start" });
                  }}
                >
                  Já tenho os arquivos
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setFormAberto("modelagem");
                    document
                      .getElementById("pedido")
                      ?.scrollIntoView({ behavior: "smooth", block: "start" });
                  }}
                >
                  Preciso de modelagem
                </Button>
              </div>
            </div>

            <ProjectHeroCarousel
              images={HERO_IMAGES}
              ariaLabel="Fotos da impressão 3D da TITANS"
            />
          </div>
        </div>
      </section>

      {/* Destaques técnicos */}
      <section className="pb-14">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-6xl">
          <div className="grid gap-4 sm:grid-cols-3">
            <Card>
              <CardContent className="pt-6 flex flex-col items-center text-center gap-2">
                <Ruler className="h-6 w-6 text-titans-orange" />
                <p className="font-semibold">Camadas de até 0,05 mm</p>
                <p className="text-sm text-muted-foreground">
                  Alta resolução para detalhes finos e superfícies suaves.
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6 flex flex-col items-center text-center gap-2">
                <Layers className="h-6 w-6 text-titans-orange" />
                <p className="font-semibold">ABS, PLA, PETG e TPU</p>
                <p className="text-sm text-muted-foreground">
                  Rígidos ou flexíveis, o material certo para cada peça.
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6 flex flex-col items-center text-center gap-2">
                <Boxes className="h-6 w-6 text-titans-orange" />
                <p className="font-semibold">Projetos e trabalhos da UnB</p>
                <p className="text-sm text-muted-foreground">
                  Protótipos e peças de reposição.
                </p>
              </CardContent>
            </Card>
          </div>

          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {MATERIAIS.map((m) => (
              <div
                key={m.nome}
                className="rounded-lg border border-border bg-muted/20 p-4"
              >
                <p className="font-bold text-titans-orange">{m.nome}</p>
                <p className="text-sm text-muted-foreground mt-1">{m.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pedido — formulários na mesma tela */}
      <section
        id="pedido"
        className="relative pb-24 pt-4 scroll-mt-24 overflow-hidden"
      >
        {/* fundo decorativo discreto */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-gradient-to-b from-titans-orange/5 via-transparent to-transparent"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute left-1/2 top-8 h-64 w-[36rem] -translate-x-1/2 rounded-full bg-titans-red/10 blur-3xl"
        />

        <div className="relative container mx-auto px-4 sm:px-6 lg:px-8 max-w-3xl space-y-8">
          <div className="text-center">
            <span className="mx-auto mb-3 block h-px w-16 bg-gradient-to-r from-transparent via-titans-orange to-transparent" />
            <h2 className="text-2xl md:text-3xl font-bold">
              Vamos tirar seu projeto do papel
            </h2>
          </div>

          <PedidoBloco
            aberto={formAberto === "arquivos"}
            onToggle={() =>
              setFormAberto((v) => (v === "arquivos" ? null : "arquivos"))
            }
            titulo="Já tem os arquivos para o seu projeto?"
            descricao={
              <>
                Aceitamos <strong>.stl</strong> e <strong>.step</strong>. Envie
                uma foto e os arquivos que entramos em contato com você.
              </>
            }
          >
            <FormularioArquivos />
          </PedidoBloco>

          <PedidoBloco
            aberto={formAberto === "modelagem"}
            onToggle={() =>
              setFormAberto((v) => (v === "modelagem" ? null : "modelagem"))
            }
            titulo="Precisa fazer a modelagem, mas não sabe como?"
            descricao="A TITANS te ajuda: preencha o formulário abaixo e a gente desenha a peça com você."
          >
            <FormularioModelagem />
          </PedidoBloco>
        </div>
      </section>

      <Footer />
    </div>
  );
};

type PedidoBlocoProps = {
  aberto: boolean;
  onToggle: () => void;
  titulo: string;
  descricao: React.ReactNode;
  children: React.ReactNode;
};

const PedidoBloco = ({
  aberto,
  onToggle,
  titulo,
  descricao,
  children,
}: PedidoBlocoProps) => (
  <div
    className={cn(
      "rounded-2xl bg-gradient-to-br from-titans-red via-titans-orange to-titans-red p-[2px] transition-all duration-300",
      aberto
        ? "shadow-2xl shadow-titans-orange/25"
        : "shadow-lg shadow-titans-orange/10 hover:shadow-xl hover:shadow-titans-orange/20",
    )}
  >
    <Card className="h-full rounded-[calc(1rem-2px)] border-none">
      <CardContent className="pt-6">
        <button type="button" onClick={onToggle} className="w-full text-left">
          <p className="text-lg font-semibold">{titulo}</p>
          <p className="text-sm text-muted-foreground mt-1">{descricao}</p>
        </button>

        {aberto && (
          <div className="mt-6 border-t border-border pt-6">{children}</div>
        )}
      </CardContent>
    </Card>
  </div>
);

export default Impressao3D;
