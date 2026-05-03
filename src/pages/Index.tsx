import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowRight, Zap, Shield, Camera, Brain, Users, Code, Trophy, Target } from "lucide-react";
import { Link } from "react-router-dom";
import { useState, useEffect } from "react";

import seguidorImage from "@/assets/seguidor-linha.jpg";
import combateImage from "@/assets/combate.jpg";
import vsssImage from "@/assets/vsss.jpg";
import sslImage from "@/assets/ssl.jpg";

import { Carousel, CarouselContent, CarouselItem } from "@/components/ui/carousel";
import confraImg from '@/assets/confra26.jpeg';
import teamMember from '@/assets/teamMember.jpeg';
import sslEvent from '@/assets/sslEvent.jpeg';
import pet from '@/assets/pet.jpeg';
import symposium from '@/assets/symposium.jpeg';
import vssEvent from '@/assets/vssEvent.jpeg';
import psRoverImage from "@/assets/psRover.jpeg";

import seguidorGif from '@/assets/seguidorGif.gif';
import vssGif from '@/assets/vssGif.gif';
import sslGif from '@/assets/sslGif.gif';
import combateGif from '@/assets/combateGif.gif';

const PARTNERSHIP_LOGOS = ["UnB", "IEEE", "RAS", "Dr Eletrônico"] as const;

const Index = () => {
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [api, setApi] = useState<any>(null);
  const images = [seguidorImage, combateImage, vsssImage, sslImage];
  
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentImageIndex((prev) => (prev + 1) % images.length);
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  const robotImages = [
    {
      src: confraImg,
      title: "",
      description: ""
    },
    {
      src: teamMember,
      title: "",
      description: ""
    },
    {
      src: sslEvent,
      title: "",
      description: ""
    },
    {
      src: pet,
      title: "",
      description: ""
    },
    {
      src: symposium,
      title: "",
      description: ""
    },
    {
      src: vssEvent,
      title: "",
      description: ""
    },
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
                      {robotImages.map((image, index) => (
                        <CarouselItem key={index}>
                          <div className="text-center">
                            <div className="relative mb-4 rounded-lg overflow-hidden aspect-[4/3] bg-titans-dark/20">
                              <img 
                                src={image.src} 
                                alt={image.title}
                                className="w-full h-full object-cover"
                                loading="lazy"
                              />
                              <div className="absolute inset-0 bg-gradient-to-t from-titans-dark/60 via-transparent to-transparent" />
                              <div className="absolute bottom-2 left-2 right-2 text-white">
                                <h4 className="font-bold text-sm mb-1">{image.title}</h4>
                                <p className="text-xs opacity-90">{image.description}</p>
                              </div>
                            </div>
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
      <section id="sobre" className="py-16">
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
                    <div className="text-2xl font-bold text-titans-orange">4</div>
                    <div className="text-sm text-muted-foreground">Modalidades</div>
                  </CardContent>
                </Card>
                
                <Card className="text-center">
                  <CardContent className="p-4">
                    <div className="w-12 h-12 bg-gradient-to-br from-titans-orange to-titans-gold rounded-lg mx-auto mb-2 flex items-center justify-center">
                      <Target className="h-6 w-6 text-white" />
                    </div>
                    <div className="text-2xl font-bold text-titans-orange">100+</div>
                    <div className="text-sm text-muted-foreground">Projetos</div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Modalidades Section */}
      <section id="modalidades" className="py-16 bg-muted/20">
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
                      src={seguidorGif} 
                      alt="Modalidade robótica" 
                      className="w-full h-full object-cover transition-all duration-1000"
                    />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold mb-2">Seguidor de Linha</h3>
                    <p className="text-muted-foreground text-sm mb-3">
                      Robôs autônomos que seguem trajetos com precisão e velocidade
                    </p>
                    <Link to="/seguidor-linha" className="text-titans-orange hover:text-titans-red transition-colors text-sm font-medium inline-flex items-center">
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
                      src={combateGif} 
                      alt="Modalidade robótica" 
                      className="w-full h-full object-cover transition-all duration-1000"
                    />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold mb-2">Combate</h3>
                    <p className="text-muted-foreground text-sm mb-3">
                      Robôs de guerra projetados para competições de estratégia e resistência
                    </p>
                    <Link to="/combate" className="text-titans-orange hover:text-titans-red transition-colors text-sm font-medium inline-flex items-center">
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
                      src={vssGif} 
                      alt="Modalidade robótica" 
                      className="w-full h-full object-cover transition-all duration-1000"
                    />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold mb-2">VSSS</h3>
                    <p className="text-muted-foreground text-sm mb-3">
                      Futebol robótico com visão computacional e inteligência artificial
                    </p>
                    <Link to="/vsss" className="text-titans-orange hover:text-titans-red transition-colors text-sm font-medium inline-flex items-center">
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
                      src={sslGif} 
                      alt="Modalidade robótica" 
                      className="w-full h-full object-cover transition-all duration-1000"
                    />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold mb-2">SSL</h3>
                    <p className="text-muted-foreground text-sm mb-3">
                      Futebol robótico de alta performance com robôs omnidirecionais
                    </p>
                    <Link to="/ssl" className="text-titans-orange hover:text-titans-red transition-colors text-sm font-medium inline-flex items-center">
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

      {/* Processo Seletivo Section */}
      <section className="py-16 bg-gradient-to-br from-titans-red/10 via-titans-orange/5 to-titans-gold/10">
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
                    src={psRoverImage}
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
                <Link to="/inscricao">
                  Inscreva-se agora
                </Link>
              </Button>
            </div>
            */}

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
              <Link to="/produtos">
                Ver todos os produtos
              </Link>
            </Button>
          </div>
        </div>
      </section>
        */}
        
      {/* Partnerships Section */}
      <section className="py-8 bg-gradient-to-r from-titans-red to-titans-orange overflow-hidden">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-center mb-4">
            <h2 className="text-2xl font-bold text-white">Parcerias</h2>
          </div>
          <div className="relative overflow-hidden">
            <div className="flex w-max animate-scroll-left motion-reduce:animate-none">
              {[0, 1].map((copy) => (
                <div
                  key={copy}
                  className="flex shrink-0 items-center gap-8 pr-8"
                  aria-hidden={copy === 1 ? true : undefined}
                >
                  {PARTNERSHIP_LOGOS.map((name) => (
                    <div
                      key={`${copy}-${name}`}
                      className="flex min-w-fit items-center whitespace-nowrap rounded-lg bg-white/20 px-6 py-4"
                    >
                      <span className="text-lg font-bold text-white">{name}</span>
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
