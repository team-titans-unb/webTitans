import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowRight, Zap, Shield, Camera, Brain, Users, Code, Trophy, Target } from "lucide-react";
import Link from "next/link";
import { useState, useEffect } from "react";
import { Carousel, CarouselContent, CarouselItem } from "@/components/ui/carousel";
import bannerConfra from "@/assets/banner/confra26.jpeg";
import bannerTeamMember from "@/assets/banner/teamMember.jpeg";
import bannerSslEvent from "@/assets/banner/sslEvent.jpeg";
import bannerRcx2025 from "@/assets/banner/rcx2025.png";
import bannerVssEvent from "@/assets/banner/vssEvent.jpeg";
import bannerCienciaNaEstrada from "@/assets/banner/cienciaNaEstrada.png";
import bannerCienciaNaEstradaExtensao from "@/assets/banner/cienciaNaEstradaExtencao.png";
import bannerConfra2024 from "@/assets/banner/Confra24.jpg";
import bannerEquipe from "@/assets/banner/Equipe.jpg";
import bannerSenado from "@/assets/banner/Senado.jpg";
import bannerRcx from "@/assets/banner/Rcx.jpg";
import bannerEvento from "@/assets/banner/Evento.jpg";
import psRoverImage from "@/assets/psRover.jpeg";
import roverTitansImage from "@/assets/roverTitans.jpeg";

import seguidorGif from '@/assets/seguidorGif.gif';
import vssGif from '@/assets/vssGif.gif';
import sslGif from '@/assets/sslGif.gif';
import combateGif from '@/assets/combateGif.gif';

import unbLogo from "@/assets/parcerias/unb.png";
import ieeeLogo from "@/assets/parcerias/ieee.png";
import rasLogo from "@/assets/parcerias/ras.png";
import labAbertoLogo from "@/assets/parcerias/labAberto.png";
import drEletronicoLogo from "@/assets/parcerias/drEletronico.png";
import aessLogo from "@/assets/parcerias/aess.png";

const PARTNERSHIP_LOGOS = [
  { src: unbLogo.src, alt: "Universidade de Brasília" },
  { src: ieeeLogo.src, alt: "IEEE" },
  { src: rasLogo.src, alt: "RAS" },
  { src: aessLogo.src, alt: "AESS" },
  { src: labAbertoLogo.src, alt: "Lab Aberto" },
  { src: drEletronicoLogo.src, alt: "Dr Eletrônico" },
] as const;

const Index = () => {
  const [api, setApi] = useState<any>(null);

  const bannerImages = [
    { src: bannerRcx2025.src, alt: "RCX 2025 — Titans" },
    { src: bannerTeamMember.src, alt: "Membros da equipe TITANS" },
    { src: bannerSslEvent.src, alt: "Competição SSL" },
    { src: bannerVssEvent.src, alt: "Competição VSS" },
    { src: bannerConfra.src, alt: "Confraternização TITANS" },
    { src: bannerCienciaNaEstrada.src, alt: "Ciência na Estrada — TITANS" },
    { src: bannerCienciaNaEstradaExtensao.src, alt: "Ciência na Estrada — extensão" },
    { src: bannerConfra2024.src, alt: "Confraternização — Titans" },
    { src: bannerEquipe.src, alt: "Preparativos Rover"},
    { src: bannerSenado.src, alt: "Reunião no Senado"},
    { src: bannerRcx.src, alt: "RCX - titans"},
    { src: bannerEvento.src, alt: "Evento - Titans"},
  ];

  useEffect(() => {
    if (!api) return;

    const interval = setInterval(() => {
      api.scrollNext();
    }, 3000);

    return () => clearInterval(interval);
  }, [api]);

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      {/* Hero Section */}
      <section className="pt-20 pb-16 bg-gradient-to-b from-muted/10 via-muted/5 to-background">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-6xl mx-auto">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
              <div className="text-center lg:text-left">
                
                <h1 className="text-4xl md:text-6xl font-bold mb-6">
                  Muito mais que
                  <br />
                  <span className="bg-gradient-to-r from-titans-red to-titans-orange bg-clip-text text-transparent">
                  uma equipe de robótica
                  </span>
                </h1>
                
                <p className="text-xl text-muted-foreground mb-8 max-w-lg">
                  Somos os TITANS, uma equipe de robótica competitiva dedicada à excelência 
                  em tecnologia, inovação e trabalho em equipe.
                </p>
                
                 {/* carrossel do topo 
                <div className="flex flex-wrap gap-4 justify-center lg:justify-start">
                  <Button variant="hero" size="lg">
                    Conheça nossa equipe
                  </Button>
                  <Button variant="outline" size="lg">
                    Ver competições
                  </Button>
                </div>
                 */}

              </div>

              {/* carrossel do topo */}
              <div className="relative">
                <div className="bg-gradient-to-br from-titans-red/10 to-titans-orange/10 rounded-2xl p-6 backdrop-blur-sm">
                  <Carousel 
                    setApi={setApi}
                    className="w-full max-w-lg mx-auto"
                    opts={{
                      align: "start",
                      loop: true,
                    }}
                  >
                    <CarouselContent>
                      {bannerImages.map((image) => (
                        <CarouselItem key={image.alt}>
                          <div className="relative mb-4 aspect-[4/3] overflow-hidden rounded-lg bg-titans-dark/20">
                            <img
                              src={image.src}
                              alt={image.alt}
                              className="h-full w-full object-cover"
                              loading="lazy"
                            />
                          </div>
                        </CarouselItem>
                      ))}
                    </CarouselContent>
                  </Carousel>
                  <div className="text-center mt-4">
                    <h3 className="font-bold text-xl mb-2">TITANS em ação</h3>
                    <p className="text-muted-foreground text-sm"></p>
                  </div>
                </div>
              </div>

            </div>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-16 bg-muted/20">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-4xl mx-auto">

            <div className="text-center">
              <div className="w-16 h-16 bg-gradient-to-br from-titans-red to-titans-orange rounded-full mx-auto mb-4 flex items-center justify-center">
                <Trophy className="h-8 w-8 text-white" />
              </div>
              <div className="text-3xl font-bold text-titans-orange mb-2">+ de 10</div>
              <div className="text-muted-foreground">premiações</div>
            </div>
            
            <div className="text-center">
              <div className="w-16 h-16 bg-gradient-to-br from-titans-orange to-titans-gold rounded-full mx-auto mb-4 flex items-center justify-center">
                <Target className="h-8 w-8 text-white" />
              </div>
              <div className="text-3xl font-bold text-titans-orange mb-2">Competindo desde</div>
              <div className="text-muted-foreground">2017</div>
            </div>
            
            <div className="text-center">
              <div className="w-16 h-16 bg-gradient-to-br from-titans-gold to-titans-orange rounded-full mx-auto mb-4 flex items-center justify-center">
                <Users className="h-8 w-8 text-white" />
              </div>
              <div className="text-3xl font-bold text-titans-orange mb-2">+ de 35</div>
              <div className="text-muted-foreground">membros ativos</div>
            </div>

          </div>
        </div>
      </section>

      {/* About */}
      <section id="sobre" className="scroll-mt-20 py-16">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-12">
              <h2 className="text-3xl md:text-4xl font-bold mb-4">Quem somos?</h2>
              <p className="text-muted-foreground max-w-2xl mx-auto">
                Somos a TITANS, equipe de robótica da Universidade de Brasília (UnB). 
                Unimos paixão por tecnologia e excelência acadêmica para desenvolver soluções inovadoras e competitivas, movidos pelo poder do trabalho em equipe.
              </p>
            </div>
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
              <div>
                <p className="text-muted-foreground mb-6">
                  Desenvolvemos projetos robóticos que promovem aprendizado prático, 
                  inovação e trabalho em equipe. Nossa equipe é formada por estudantes de diversas 
                  áreas técnicas e administrativas.
                </p>
                <p className="text-muted-foreground mb-8">
                  Nosso objetivo é fomentar a paixão pela robótica, preparando futuros 
                  líderes com habilidades em planejamento, liderança e ética profissional.
                </p>
            
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <Card className="text-center">
                  <CardContent className="p-4">
                    <div className="w-12 h-12 bg-gradient-to-br from-titans-red to-titans-orange rounded-lg mx-auto mb-2 flex items-center justify-center">
                      <Zap className="h-6 w-6 text-white" />
                    </div>
                    <div className="text-2xl font-bold text-titans-orange">5</div>
                    <div className="text-sm text-muted-foreground">modalidades de competição</div>
                  </CardContent>
                </Card>
                
                <Card className="text-center">
                  <CardContent className="p-4">
                    <div className="w-12 h-12 bg-gradient-to-br from-titans-orange to-titans-gold rounded-lg mx-auto mb-2 flex items-center justify-center">
                      <Target className="h-6 w-6 text-white" />
                    </div>
                    <div className="text-2xl font-bold text-titans-orange">mais de 14</div>
                    <div className="text-sm text-muted-foreground">projetos</div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Modalidades Section */}
      <section id="modalidades" className="scroll-mt-20 py-16 bg-muted/20">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">O que fazemos?</h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              Projetamos, construímos e testamos robôs avançados em diferentes modalidades competitivas
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            <Card className="group hover:shadow-lg transition-all duration-300">
              <CardContent className="p-6">
                <div className="flex items-start space-x-4">
                  <div className="w-56 h-56 rounded-lg overflow-hidden flex-shrink-0">
                    <img 
                      src={seguidorGif.src} 
                      alt="Modalidade robótica" 
                      className="w-full h-full object-cover transition-all duration-1000"
                    />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold mb-2">Seguidor de Linha</h3>
                    <p className="text-muted-foreground text-sm mb-3">
                      Robôs autônomos que seguem trajetos com precisão e velocidade
                    </p>
                    <Link href="/seguidor-linha" className="text-titans-orange hover:text-titans-red transition-colors text-sm font-medium inline-flex items-center">
                      Saiba mais <ArrowRight className="h-4 w-4 ml-1" />
                    </Link>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card className="group hover:shadow-lg transition-all duration-300">
              <CardContent className="p-6">
                <div className="flex items-start space-x-4">
                  <div className="w-56 h-56 rounded-lg overflow-hidden flex-shrink-0">
                    <img 
                      src={combateGif.src} 
                      alt="Modalidade robótica" 
                      className="w-full h-full object-cover transition-all duration-1000"
                    />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold mb-2">Combate</h3>
                    <p className="text-muted-foreground text-sm mb-3">
                      Robôs de guerra projetados para competições de estratégia e resistência
                    </p>
                    <Link href="/combate" className="text-titans-orange hover:text-titans-red transition-colors text-sm font-medium inline-flex items-center">
                      Saiba mais <ArrowRight className="h-4 w-4 ml-1" />
                    </Link>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card className="group hover:shadow-lg transition-all duration-300">
              <CardContent className="p-6">
                <div className="flex items-start space-x-4">
                  <div className="w-56 h-56 rounded-lg overflow-hidden flex-shrink-0">
                    <img 
                      src={vssGif.src} 
                      alt="Modalidade robótica" 
                      className="w-full h-full object-cover transition-all duration-1000"
                    />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold mb-2">VSSS</h3>
                    <p className="text-muted-foreground text-sm mb-3">
                      Futebol robótico com visão computacional e inteligência artificial
                    </p>
                    <Link href="/vsss" className="text-titans-orange hover:text-titans-red transition-colors text-sm font-medium inline-flex items-center">
                      Saiba mais <ArrowRight className="h-4 w-4 ml-1" />
                    </Link>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card className="group hover:shadow-lg transition-all duration-300">
              <CardContent className="p-6">
                <div className="flex items-start space-x-4">
                  <div className="w-56 h-56 rounded-lg overflow-hidden flex-shrink-0">
                    <img 
                      src={sslGif.src} 
                      alt="Modalidade robótica" 
                      className="w-full h-full object-cover transition-all duration-1000"
                    />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold mb-2">SSL</h3>
                    <p className="text-muted-foreground text-sm mb-3">
                      Futebol robótico de alta performance com robôs omnidirecionais
                    </p>
                    <Link href="/ssl" className="text-titans-orange hover:text-titans-red transition-colors text-sm font-medium inline-flex items-center">
                      Saiba mais <ArrowRight className="h-4 w-4 ml-1" />
                    </Link>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Diferenciais Section */}
      <section className="py-16 bg-muted/10">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">Nossos diferenciais</h2>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <Card className="bg-gradient-to-br from-titans-red/10 to-titans-orange/10 border-titans-orange/20">
              <CardContent className="p-8 text-center">
                <Users className="h-12 w-12 text-titans-orange mx-auto mb-4" />
                <h3 className="font-semibold mb-4">Equipe multidisciplinar</h3>
                <p className="text-muted-foreground text-sm">
                  com membros especializados atuando em diversas áreas técnicas como eletrônica, mecânica e software.
                </p>
              </CardContent>
            </Card>
            
            <Card className="bg-gradient-to-br from-titans-orange/10 to-titans-gold/10 border-titans-gold/20">
              <CardContent className="p-8 text-center">
                <Target className="h-12 w-12 text-titans-gold mx-auto mb-4" />
                <h3 className="font-semibold mb-4">Infraestrutura completa</h3>
                <p className="text-muted-foreground text-sm">
                  com acesso a laboratórios e oficinas do campus de engenharias da UnB.
                </p>
              </CardContent>
            </Card>
            
            <Card className="bg-gradient-to-br from-titans-gold/10 to-titans-orange/10 border-titans-orange/20">
              <CardContent className="p-8 text-center">
                <Trophy className="h-12 w-12 text-titans-orange mx-auto mb-4" />
                <h3 className="font-semibold mb-4">Apoio técnico</h3>
                <p className="text-muted-foreground text-sm">
                  especializado de professores da universidade
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Processo Seletivo Section — âncora para login "Saiba como participar" */}
      <section
        id="inscricoes"
        className="scroll-mt-20 py-16 bg-gradient-to-br from-titans-red/10 via-titans-orange/5 to-titans-gold/10"
      >
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-4xl mx-auto text-center">
           {/*
            <div className="inline-flex items-center bg-gradient-to-r from-titans-red to-titans-orange text-white px-4 py-2 rounded-full text-sm font-semibold mb-6">
              <span className="w-2 h-2 bg-white rounded-full mr-2 animate-pulse"></span>
              INSCRIÇÕES ABERTAS - PROJETO ROVER 2026-1
            </div>
           */}
            <h2 className="text-3xl md:text-4xl font-bold mb-6">INSCRIÇÕES ABERTAS - PROJETO ROVER 2026-1</h2>
            <p className="text-lg text-muted-foreground mb-8 max-w-2xl mx-auto">
              {/* Quer fazer parte da nossa equipe? Estamos com inscrições abertas para novos membros 
              interessados em robótica competitiva, programação, eletrônica e gestão. */}

              {/* Quer fazer parte da nossa equipe? As inscrições são abertas no final do segundo semestre do ano.*/}

              Quer fazer parte da nossa equipe? Estamos com inscrições abertas para novos membros 
              interessados em contruir um rover para fins de competição. 

            </p>



            <div className="group relative mx-auto mb-10 max-w-md">
              <div
                className="pointer-events-none absolute -inset-3 rounded-3xl bg-gradient-to-br from-titans-red/50 via-titans-orange/40 to-titans-gold/30 opacity-70 blur-2xl transition-opacity duration-500 group-hover:opacity-100"
                aria-hidden
              />
              <div className="relative overflow-hidden rounded-2xl border border-titans-red/25 bg-gradient-to-br from-titans-red/10 to-titans-orange/5 p-1 shadow-[0_0_0_1px_rgba(255,255,255,0.06),0_25px_50px_-12px_rgba(185,28,28,0.35)]">
                <div className="overflow-hidden rounded-xl bg-black/20 ring-1 ring-inset ring-white/10">
                  <img
                    src={psRoverImage.src}
                    alt="Cartaz do processo seletivo — projeto rover TITANS"
                    className="w-full h-auto object-cover transition-transform duration-500 ease-out will-change-transform group-hover:scale-[1.04]"
                    loading="lazy"
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-center mb-6">
              <Button
                size="lg"
                className="bg-gradient-to-r from-titans-red to-titans-orange hover:from-titans-red/90 hover:to-titans-orange/90 text-white font-semibold px-8 py-3 shadow-lg shadow-titans-red/25"
                asChild
              >
                <a
                  href="https://docs.google.com/forms/d/e/1FAIpQLScdpgShgFvmgjkOS31xk9nXVh3CM0WfdlsyU6ZRiP8CcqotcQ/viewform"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Inscrever-se no processo seletivo
                  <ArrowRight className="ml-2 h-4 w-4" />
                </a>
              </Button>
            </div>

            <p className="text-lg text-muted-foreground mb-8 max-w-2xl mx-auto">
              
            As inscrições são somente para o projeto rover, para os outros projetos acompanhe nossas redes sociais que em breve abrirão!

            </p>

            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
              <div className="bg-card/50 backdrop-blur-sm border border-titans-orange/20 rounded-xl p-6">
                <div className="w-12 h-12 bg-gradient-to-br from-titans-red to-titans-orange rounded-lg flex items-center justify-center mx-auto mb-4">
                  <Users className="h-6 w-6 text-white" />
                </div>
                <h3 className="font-semibold mb-2">Diversas áreas</h3>
                <p className="text-sm text-muted-foreground">Software, eletrônica, mecânica, gestão e marketing</p>
              </div>
              
              <div className="bg-card/50 backdrop-blur-sm border border-titans-orange/20 rounded-xl p-6">
                <div className="w-12 h-12 bg-gradient-to-br from-titans-orange to-titans-gold rounded-lg flex items-center justify-center mx-auto mb-4">
                  <Target className="h-6 w-6 text-white" />
                </div>
                <h3 className="font-semibold mb-2">Experiência prática</h3>
                <p className="text-sm text-muted-foreground">Participe de competições nacionais e internacionais</p>
              </div>
              
              <div className="bg-card/50 backdrop-blur-sm border border-titans-orange/20 rounded-xl p-6">
                <div className="w-12 h-12 bg-gradient-to-br from-titans-gold to-titans-orange rounded-lg flex items-center justify-center mx-auto mb-4">
                  <Trophy className="h-6 w-6 text-white" />
                </div>
                <h3 className="font-semibold mb-2">Desenvolvimento</h3>
                <p className="text-sm text-muted-foreground">Aprenda com veteranos e desenvolva suas habilidades</p>
              </div>
            </div>
            
             {/* Shop Section 
            <div className="mt-8">
              <Button 
                size="lg" 
                className="bg-gradient-to-r from-titans-red to-titans-orange hover:from-titans-red/90 hover:to-titans-orange/90 text-white font-semibold px-8 py-3"
                asChild
              >
                <Link href="/inscricao">
                  Inscreva-se agora
                </Link>
              </Button>
            </div>
            */}

          </div>
        </div>
      </section>

      {/* Vaquinha — Rover na Lua (Vakinha.com.br) */}
      <section id="apoiar" className="scroll-mt-20 py-16 bg-muted/30">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-10">
              <h2 className="text-3xl md:text-4xl font-bold mb-6">
                Rover na Lua
              </h2>
              <div className="mx-auto mb-6 max-w-2xl overflow-hidden rounded-2xl border border-titans-orange/20 shadow-lg shadow-titans-red/10 ring-1 ring-inset ring-white/10">
                <img
                  src={roverTitansImage.src}
                  alt="Rover espacial com marca Titans em terreno rochoso — projeto Rover na Lua"
                  className="w-full h-auto object-cover"
                  loading="lazy"
                />
              </div>
              <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
                Desenvolvimento de rovers pelo Grupo de Robótica Titans e pelo Capítulo Estudantil AESS.
              </p>
            </div>

            <Card className="border-titans-orange/25 bg-gradient-to-br from-titans-red/5 via-background to-titans-gold/5 shadow-lg">
              <CardContent className="p-8 md:p-10">
                <p className="text-foreground font-medium mb-4">
                  Ajude a Titans a construir o futuro da robótica. Imagine um rover, projetado e construído por
                  estudantes, explorando terrenos e enfrentando desafios tecnológicos de alto nível — o projeto já
                  está saindo do papel e precisa do seu apoio para ir ainda mais longe.
                </p>
                <p className="text-muted-foreground mb-6 leading-relaxed">
                  A meta é ambiciosa: levar o rover do papel com excelência técnica. Já foram arrecadados cerca de{" "}
                  <span className="text-foreground font-medium">R$ 26 mil</span>; a meta da campanha é de{" "}
                  <span className="text-foreground font-medium">R$ 100 mil</span> para componentes e estrutura
                  necessários ao rover. Qualquer contribuição faz diferença.
                </p>
                <p className="text-sm text-muted-foreground mb-8">
                  Vaquinha criada em 29/04/2026 na plataforma Vakinha.
                </p>

                <div className="flex flex-col sm:flex-row gap-4 sm:items-center sm:justify-center mb-8">
                  <Button
                    size="lg"
                    className="bg-gradient-to-r from-titans-red to-titans-orange hover:from-titans-red/90 hover:to-titans-orange/90 text-white font-semibold px-8 shadow-lg shadow-titans-red/25"
                    asChild
                  >
                    <a
                      href="https://www.vakinha.com.br/vaquinha/rover-na-lua-desenvolvimento-de-rovers-pelo-grupo-de-robotica-titans-e-pelo-capitulo-estudantil-aess"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Apoiar na Vakinha
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </a>
                  </Button>
                </div>

                <div className="rounded-xl border border-titans-orange/20 bg-card/60 px-5 py-4 text-center">
                  <p className="text-sm text-muted-foreground mb-1">Contribua também via Pix</p>
                  <p className="font-mono text-base font-semibold tracking-tight break-all">
                    6094196@vakinha.com.br
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Shop 
      <section className="py-16">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">Nossa Lojinha</h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              Produtos oficiais da equipe TITANS
            </p>
          </div>

          <div className="relative overflow-hidden rounded-xl bg-gradient-to-r from-titans-red/5 to-titans-orange/5 p-8">
            <div className="flex items-center animate-scroll-left">
              <div className="flex items-center space-x-8 flex-shrink-0">
                <div className="w-48 h-48 bg-gradient-to-br from-titans-red/20 to-titans-orange/20 rounded-lg flex items-center justify-center border-2 border-dashed border-border">
                  <span className="text-muted-foreground text-sm">Camiseta TITANS</span>
                </div>
                <div className="w-48 h-48 bg-gradient-to-br from-titans-orange/20 to-titans-gold/20 rounded-lg flex items-center justify-center border-2 border-dashed border-border">
                  <span className="text-muted-foreground text-sm">Moletom</span>
                </div>
                <div className="w-48 h-48 bg-gradient-to-br from-titans-gold/20 to-titans-orange/20 rounded-lg flex items-center justify-center border-2 border-dashed border-border">
                  <span className="text-muted-foreground text-sm">Adesivos</span>
                </div>
                <div className="w-48 h-48 bg-gradient-to-br from-titans-red/20 to-titans-gold/20 rounded-lg flex items-center justify-center border-2 border-dashed border-border">
                  <span className="text-muted-foreground text-sm">Caneca</span>
                </div>
              </div>
              
              <div className="flex items-center space-x-8 flex-shrink-0 ml-8">
                <div className="w-48 h-48 bg-gradient-to-br from-titans-red/20 to-titans-orange/20 rounded-lg flex items-center justify-center border-2 border-dashed border-border">
                  <span className="text-muted-foreground text-sm">Camiseta TITANS</span>
                </div>
                <div className="w-48 h-48 bg-gradient-to-br from-titans-orange/20 to-titans-gold/20 rounded-lg flex items-center justify-center border-2 border-dashed border-border">
                  <span className="text-muted-foreground text-sm">Moletom</span>
                </div>
                <div className="w-48 h-48 bg-gradient-to-br from-titans-gold/20 to-titans-orange/20 rounded-lg flex items-center justify-center border-2 border-dashed border-border">
                  <span className="text-muted-foreground text-sm">Adesivos</span>
                </div>
                <div className="w-48 h-48 bg-gradient-to-br from-titans-red/20 to-titans-gold/20 rounded-lg flex items-center justify-center border-2 border-dashed border-border">
                  <span className="text-muted-foreground text-sm">Caneca</span>
                </div>
              </div>
            </div>
          </div>

          <div className="text-center mt-8">
            <Button 
              variant="titans"
              size="lg"
              asChild
            >
              <Link href="/produtos">
                Ver todos os produtos
              </Link>
            </Button>
          </div>
        </div>
      </section>
        */}
        
      {/* Partnerships Section */}
      <section className="py-8 bg-gradient-to-r from-titans-red to-titans-orange overflow-hidden w-full">
        <div className="w-full"> 
          <div className="flex items-center justify-center mb-6">
            <h2 className="text-2xl font-bold text-white">Parcerias</h2>
          </div>
          <div className="relative w-full overflow-hidden">
            <div className="flex w-max animate-scroll-left hover:[animation-play-state:paused]">
              {[0, 1, 2].map((copy) => (
                <div
                  key={copy}
                  className="flex shrink-0 items-center gap-8 pl-8"
                  aria-hidden={copy > 0 ? true : undefined}
                >
                  {PARTNERSHIP_LOGOS.map((partner, index) => (
                    <div
                      key={`${copy}-${partner.alt}-${index}`}
                      className="flex h-28 min-w-[220px] items-center justify-center rounded-lg bg-white/90 px-8 py-4 backdrop-blur-sm"
                    >
                      <img
                        src={partner.src}
                        alt={partner.alt}
                        className="h-16 w-auto max-w-[200px] object-contain"
                      />
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
};

export default Index;
