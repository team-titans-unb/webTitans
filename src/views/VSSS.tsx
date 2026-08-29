import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { ArrowLeft, Camera, Brain, Gamepad2, Users } from "lucide-react";
import Link from "next/link";

import robotVsss from '@/assets/robotVsss.png';

import filipePhoto from "@/assets/fotosVsss/filipeErnesto2.png";
import erickMacielPhoto from "@/assets/fotosVsss/erickMaciel.png";
import pietroPhoto from "@/assets/fotosVsss/pietro.png";
import joaoCanabarroPhoto from "@/assets/fotosVsss/joaoCanabarro.png";
import yzabellaPhoto from "@/assets/fotosVsss/yzabella.png";
import nathanPhoto from "@/assets/fotosVsss/nathan.png";
import felixPhoto from "@/assets/fotosVsss/felix.png";
import arthurPhoto from "@/assets/fotosVsss/arthur.png";

const VSSS = () => {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <section className="pt-20 pb-16 bg-gradient-to-b from-background to-muted/20">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-4xl mx-auto text-center">
              {/* 
            <Link href="/" className="inline-flex items-center text-muted-foreground hover:text-foreground mb-6 transition-colors">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Voltar ao início
            </Link>
            */}
            
            <h1 className="text-4xl md:text-6xl font-bold mb-6">
              <span className="bg-gradient-to-r from-titans-orange to-titans-gold bg-clip-text text-transparent">
                VSSS
              </span>
            </h1>
            
            <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
              Very Small Size Soccer - Futebol robótico com visão computacional e inteligência artificial
            </p>
            
            <div className="flex flex-wrap justify-center gap-4">

            {/* 
           <div className="flex flex-wrap justify-center gap-4">
              <Button variant="hero" size="lg">
                Ver Competições
              </Button>
              <Button variant="outline" size="lg">
                Especificações Técnicas
              </Button>
            </div>
            */}

            </div>
          </div>
        </div>
      </section>

      {/* About Section */}
      <section className="py-16">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div>
              <h2 className="text-3xl font-bold mb-6">Futebol Robótico</h2>
              <p className="text-muted-foreground mb-6">
                O VSSS (Very Small Size Soccer) é uma modalidade que combina robótica, visão 
                computacional e inteligência artificial. Times de robôs autônomos jogam futebol 
                em campo controlado por sistema de câmeras overhead.
              </p>
              <p className="text-muted-foreground mb-8">
                Desenvolvemos algoritmos de visão computacional, estratégias de jogo e 
                sistemas de comunicação para coordenação de múltiplos robôs em tempo real.
              </p>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-titans-gold">6</div>
                  <div className="text-sm text-muted-foreground">Robôs por Time</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-titans-gold">20</div>
                  <div className="text-sm text-muted-foreground">Partidas Jogadas</div>
                </div>
              </div>
            </div>
            
            <div className="bg-gradient-to-br from-titans-orange/20 to-titans-gold/20 rounded-lg p-8 aspect-square flex items-center justify-center">
              <div className="text-center">
                {/* Features Section 
                <Gamepad2 className="h-24 w-24 text-titans-gold mx-auto mb-4" />
                <p className="text-muted-foreground">Campo de futebol robótico</p>
                */}

                   <img 
                      src={robotVsss.src} 
                      alt="Modalidade robótica" 
                      className="w-full h-full object-cover transition-all duration-1000"
               />

              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-16 bg-muted/20">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold mb-4">Tecnologias Avançadas</h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              Sistema integrado de visão, IA e controle para futebol robótico
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <Card className="border-border/50 hover:border-titans-gold/50 transition-colors">
              <CardContent className="p-6">
                <Camera className="h-12 w-12 text-titans-gold mb-4" />
                <h3 className="font-semibold mb-2">Visão Computacional</h3>
                <p className="text-muted-foreground text-sm">
                  Processamento em tempo real de imagens para tracking
                </p>
              </CardContent>
            </Card>
            
            <Card className="border-border/50 hover:border-titans-gold/50 transition-colors">
              <CardContent className="p-6">
                <Brain className="h-12 w-12 text-titans-gold mb-4" />
                <h3 className="font-semibold mb-2">Inteligência Artificial</h3>
                <p className="text-muted-foreground text-sm">
                  Algoritmos de decisão e estratégia de jogo
                </p>
              </CardContent>
            </Card>
            
            <Card className="border-border/50 hover:border-titans-gold/50 transition-colors">
              <CardContent className="p-6">
                <Gamepad2 className="h-12 w-12 text-titans-gold mb-4" />
                <h3 className="font-semibold mb-2">Controle Multi-robô</h3>
                <p className="text-muted-foreground text-sm">
                  Coordenação e comunicação entre múltiplos agentes
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Team Section */}
      <section className="py-16">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold mb-4">Time de Desenvolvimento</h2>
            <p className="text-muted-foreground">
              Especialistas em visão computacional e IA
            </p>
          </div>
          
          {/* Team Photo */}
          <div className="flex justify-center mb-12">
            <div className="w-96 h-64 bg-gradient-to-br from-titans-orange/20 to-titans-gold/20 rounded-lg flex items-center justify-center border-2 border-dashed border-border">
              <div className="text-center">
                <Users className="h-16 w-16 text-titans-gold mx-auto mb-2" />
                <p className="text-muted-foreground text-sm">Foto da Equipe</p>
              </div>
            </div>
          </div>

          {/* Gerentes */}
          <div className="mb-12">
            <h3 className="text-xl font-semibold text-center mb-8">Gerentes de Projeto</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-2xl mx-auto">
              {[
                {
                  name: "Filipe Barbosa",
                  role: "Gerente de Projeto",
                  expertise: "Gestão e desenvolvimento",
                  photo: filipePhoto,
                },
                {
                  name: "Erick Maciel",
                  role: "Gerente de Projeto",
                  expertise: "Gestão e desenvolvimento",
                  photo: erickMacielPhoto,
                },
              ].map((leader, index) => (
                <Card key={index} className="text-center">
                  <CardContent className="p-6">
                    {"photo" in leader && leader.photo ? (
                      <div className="mx-auto mb-4 h-24 w-24 overflow-hidden rounded-full border-2 border-titans-gold/25 bg-muted">
                        <img
                          src={leader.photo.src}
                          alt={`Foto de ${leader.name}`}
                          className="h-full w-full object-cover"
                        />
                      </div>
                    ) : (
                      <div className="mx-auto mb-4 flex h-24 w-24 items-center justify-center rounded-full border-2 border-dashed border-border bg-muted">
                        <span className="text-xs text-muted-foreground">Foto</span>
                      </div>
                    )}
                    <h4 className="font-semibold mb-1">{leader.name}</h4>
                    <p className="text-titans-gold text-sm mb-2">{leader.role}</p>
                    <p className="text-muted-foreground text-sm">{leader.expertise}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>

          {/* Members */}
          <div>
            <h3 className="text-xl font-semibold text-center mb-8">Membros</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {[
                { name: "Pietro", role: "Membro", expertise: "Equipe VSSS", photo: pietroPhoto },
                { name: "Yzabella", role: "Membro", expertise: "Equipe VSSS", photo: yzabellaPhoto },
                { name: "Nathan", role: "Membro", expertise: "Equipe VSSS", photo: nathanPhoto },
                { name: "João Canabarro", role: "Membro", expertise: "Equipe VSSS", photo: joaoCanabarroPhoto },
                { name: "Félix", role: "Membro", expertise: "Equipe VSSS", photo: felixPhoto },
                { name: "Artur Silva", role: "Membro", expertise: "Equipe VSSS", photo: arthurPhoto },
              ].map((member, index) => (
                <Card key={index} className="text-center">
                  <CardContent className="p-6">
                    {"photo" in member && member.photo ? (
                      <div className="mx-auto mb-4 h-20 w-20 overflow-hidden rounded-full border-2 border-titans-gold/25 bg-muted">
                        <img
                          src={member.photo.src}
                          alt={`Foto de ${member.name}`}
                          className="h-full w-full object-cover"
                        />
                      </div>
                    ) : (
                      <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full border-2 border-dashed border-border bg-muted">
                        <span className="text-xs text-muted-foreground">Foto</span>
                      </div>
                    )}
                    <h4 className="font-semibold mb-1">{member.name}</h4>
                    <p className="text-titans-gold text-sm mb-2">{member.role}</p>
                    <p className="text-muted-foreground text-sm">{member.expertise}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* IEEE RAS Project Section */}
      <section className="py-16 bg-muted/10">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-8">
              <Badge className="mb-4 bg-gradient-to-r from-titans-orange to-titans-gold text-titans-dark">
                Projeto Vinculado
              </Badge>
              <h2 className="text-3xl font-bold mb-4">IEEE RAS</h2>
              <p className="text-muted-foreground">
                Robotics and Automation Society
              </p>
            </div>
            
            <Card className="bg-gradient-to-br from-titans-orange/5 to-titans-gold/5 border-titans-gold/20">
              <CardContent className="p-8">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
                  <div>
                    <h3 className="text-xl font-semibold mb-4">Pesquisa e Desenvolvimento</h3>
                    <p className="text-muted-foreground mb-4">
                      O projeto VSSS está alinhado com as diretrizes da IEEE RAS para desenvolvimento 
                      de sistemas robóticos inteligentes e autônomos aplicados ao futebol robótico.
                    </p>
                    <p className="text-muted-foreground mb-6">
                      Participamos de workshops, competições internacionais e publicamos pesquisas 
                      sobre visão computacional e coordenação multi-robô.
                    </p>
                    <Button variant="outline">
                      Ver publicações IEEE
                    </Button>
                  </div>
                  
                  <div className="bg-gradient-to-br from-titans-gold/20 to-titans-orange/20 rounded-lg p-8 text-center">
                    <div className="w-20 h-20 bg-gradient-to-br from-titans-orange to-titans-gold rounded-full mx-auto mb-4 flex items-center justify-center">
                      <span className="text-white font-bold text-lg">RAS</span>
                    </div>
                    <h4 className="font-semibold mb-2">IEEE RAS VSSS</h4>
                    <p className="text-muted-foreground text-sm">
                      Very Small Size Soccer Research
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
};

export default VSSS;