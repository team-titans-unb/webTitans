import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { ArrowLeft, Shield, Swords, Flame, Users } from "lucide-react";
import Link from "next/link";

import robotCombate from '@/assets/robotCombate.jpeg';

import fotoEquipeCombate from "@/assets/fotosCombate/fotoEquipeC.jpeg";
import octavioPhoto from "@/assets/fotosCombate/octavio.png";
import gabrielCavalcantiPhoto from "@/assets/fotosCombate/gabrielCavalcante.png";
import mariaClaraPhoto from "@/assets/fotosCombate/mariaClara2.png";
import hybsonPhoto from "@/assets/fotosCombate/hybson.png";
import laisPhoto from "@/assets/fotosCombate/lais.png";
import osmarPhoto from "@/assets/fotosCombate/osmar.png";
import pauloLuccaPhoto from "@/assets/fotosCombate/pauloLucca.png";
import rafaelaPhoto from "@/assets/fotosCombate/rafaela.png";
import saraPhoto from "@/assets/fotosCombate/sara.png";

const Combate = () => {
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
            
            <Badge className="mb-4 bg-gradient-to-r from-titans-red to-titans-orange text-white">
              Categoria - Beetleweight
            </Badge>
            
            <h1 className="text-4xl md:text-6xl font-bold mb-6">
              <span className="bg-gradient-to-r from-titans-red to-titans-orange bg-clip-text text-transparent">
                Combate
              </span>
            </h1>
            
            <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
              Robôs de combate projetados para competições intensas de estratégia e resistência
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
              <h2 className="text-3xl font-bold mb-6">Robôs de Combate</h2>
              <p className="text-muted-foreground mb-6">
                Na modalidade de combate, projetamos robôs guerreiros capazes de enfrentar 
                adversários em arenas fechadas. Cada robô é uma obra de engenharia que combina 
                resistência, agilidade e poder destrutivo.
              </p>
              <p className="text-muted-foreground mb-8">
                Utilizamos materiais de alta resistência, sistemas de proteção e 
                armas mortiferas para criar máquinas de combate sinistras.
              </p>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-titans-red">3</div>
                  <div className="text-sm text-muted-foreground">Robôs de Guerra</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-titans-red">2</div>
                  <div className="text-sm text-muted-foreground">Batalhas Vencidas</div>
                </div>
              </div>
            </div>
            
            <div className="bg-gradient-to-br from-titans-red/20 to-titans-orange/20 rounded-lg p-8 aspect-square flex items-center justify-center">
              <div className="text-center">
                
              <img 
                      src={robotCombate.src} 
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
            <h2 className="text-3xl font-bold mb-4">Arsenal de Guerra</h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              Tecnologias adaptadas para o combate robótico
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <Card className="border-border/50 hover:border-titans-red/50 transition-colors">
              <CardContent className="p-6">
                <Shield className="h-12 w-12 text-titans-red mb-4" />
                <h3 className="font-semibold mb-2">Blindagem Titânio</h3>
                <p className="text-muted-foreground text-sm">
                  Proteção contra impactos e ataques adversários
                </p>
              </CardContent>
            </Card>
            
            <Card className="border-border/50 hover:border-titans-red/50 transition-colors">
              <CardContent className="p-6">
                <Flame className="h-12 w-12 text-titans-red mb-4" />
                <h3 className="font-semibold mb-2">Sistemas de Ataque</h3>
                <p className="text-muted-foreground text-sm">
                  Spinners, flippers e weapons personalizadas
                </p>
              </CardContent>
            </Card>
            
            <Card className="border-border/50 hover:border-titans-red/50 transition-colors">
              <CardContent className="p-6">
                <Swords className="h-12 w-12 text-titans-red mb-4" />
                <h3 className="font-semibold mb-2">Estratégia de Combate</h3>
                <p className="text-muted-foreground text-sm">
                  Controle remoto de precisão e táticas avançadas
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
            <h2 className="text-3xl font-bold mb-4">Guerreiros TITANS</h2>
            <p className="text-muted-foreground">
              Especialistas em robôs de combate
            </p>
          </div>
          
          {/* Team Photo */}
          <div className="flex justify-center mb-12">
            <div className="w-96 h-64 bg-gradient-to-br from-titans-red/20 to-titans-orange/20 rounded-lg overflow-hidden border border-border">
              <img
                src={fotoEquipeCombate.src}
                alt="Foto da equipe de combate"
                className="h-full w-full object-cover"
                loading="lazy"
              />
            </div>
          </div>

          {/* Leaders */}
          <div className="mb-12">
            <h3 className="text-xl font-semibold text-center mb-8">Gerentes de Projeto</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-2xl mx-auto">
              {[
                {
                  name: "Octávio Silva",
                  role: "Gerente de Projeto",
                  expertise: "Gestão e desenvolvimento",
                  photo: octavioPhoto,
                },
                {
                  name: "Gabriel Cavalcanti",
                  role: "Gerente de Projeto",
                  expertise: "Gestão e desenvolvimento",
                  photo: gabrielCavalcantiPhoto,
                },
              ].map((leader, index) => (
                <Card key={index} className="text-center">
                  <CardContent className="p-6">
                    {"photo" in leader && leader.photo ? (
                      <div className="mx-auto mb-4 h-24 w-24 overflow-hidden rounded-full border-2 border-titans-red/25 bg-muted">
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
                    <p className="text-titans-red text-sm mb-2">{leader.role}</p>
                    <p className="text-muted-foreground text-sm">{leader.expertise}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>

          {/* Members */}
          <div>
            <h3 className="text-xl font-semibold text-center mb-8">Membros</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
              {[
                { name: "Maria Clara", role: "Membro", expertise: "Equipe de combate", photo: mariaClaraPhoto },
                { name: "Hybson", role: "Membro", expertise: "Equipe de combate", photo: hybsonPhoto },
                { name: "Laís", role: "Membro", expertise: "Equipe de combate", photo: laisPhoto },
                { name: "Osmar", role: "Membro", expertise: "Equipe de combate", photo: osmarPhoto },
                { name: "Paulo Lucca", role: "Membro", expertise: "Equipe de combate", photo: pauloLuccaPhoto },
                { name: "Rafaela", role: "Membro", expertise: "Equipe de combate", photo: rafaelaPhoto },
                { name: "Sara", role: "Membro", expertise: "Equipe de combate", photo: saraPhoto },
              ].map((member, index) => (
                <Card key={index} className="text-center">
                  <CardContent className="p-6">
                    {"photo" in member && member.photo ? (
                      <div className="mx-auto mb-4 h-20 w-20 overflow-hidden rounded-full border-2 border-titans-red/25 bg-muted">
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
                    <p className="text-titans-red text-sm mb-2">{member.role}</p>
                    <p className="text-muted-foreground text-sm">{member.expertise}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
};

export default Combate;