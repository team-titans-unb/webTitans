import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { ArrowLeft, Trophy, Zap, Target, Users } from "lucide-react";
import Link from "next/link";

import { PlayerCard } from "@/components/PlayerCard";

import seguidorEletronica from "@/assets/fotosSeguidor/seguidorCad2.png";
import felipeDasNevesPhoto from "@/assets/fotosSeguidor/felipeNevesCutout.png";
import robotChassiBackdrop from "@/assets/fotosSeguidor/chassi_sucrilho.png";
import arthurPhoto from "@/assets/fotosSeguidor/arthur_s.png";
import gustavoPhoto from "@/assets/fotosSeguidor/gustavo_s.png";
import henriquePhoto from "@/assets/fotosSeguidor/henrique_s.png";
import joaoVictorPhoto from "@/assets/fotosSeguidor/joaoVictor2_s.png";
import thamiresPhoto from "@/assets/fotosSeguidor/thamires_s.png";

import lider from '@/assets/combateGif.gif';

/** Efeito em cima da foto do Felipe (fundo preto do GIF some com mix-blend-screen). */
const FELIPE_OVERLAY_GIF =
  "https://media4.giphy.com/media/v1.Y2lkPTc5MGI3NjExYnk0aDdmbzk1aHBwOTRpYmkyNmo5d2czZnF3bGNuZWIya3A4emZtMyZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/NkwUVZDI1OXbLxoiX9/giphy.gif";

const SeguirLinha = () => {
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
              Categoria - PRO
            </Badge>
            
            <h1 className="text-4xl md:text-6xl font-bold mb-6">
              <span className="bg-gradient-to-r from-titans-red to-titans-orange bg-clip-text text-transparent">
                Seguidor de Linha
              </span>
            </h1>
            
            <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
              Robôs autônomos que seguem trajetos predefinidos com precisão e velocidade 
            </p>

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
      </section>

      {/* About Section */}
      <section className="py-16">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div>
              <h2 className="text-3xl font-bold mb-6">O que é Seguidor de Linha?</h2>
              <p className="text-muted-foreground mb-6">
                A modalidade de seguidor de linha é uma das mais tradicionais na robótica competitiva. 
                Os robôs devem percorrer um trajeto marcado no chão, seguindo uma linha preta sobre 
                fundo branco ou linha branca sobre fundo preto, superando o trajeto com curvas  na maior velocidade possível.
              </p>
              <p className="text-muted-foreground mb-8">
                Nossa equipe desenvolve robôs utilizando sensores de refletância, algoritmos de controle 
                PID, mapeamento do circuito e sistema de empuxo para garantir precisão e velocidade nos trajetos.
              </p>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-titans-orange">4</div>
                  <div className="text-sm text-muted-foreground">Robôs Desenvolvidos</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-titans-orange">2</div>
                  <div className="text-sm text-muted-foreground">Competições</div>
                </div>
              </div>
            </div>
            
            <div className="bg-gradient-to-br from-muted/50 to-muted/20 rounded-lg p-8 aspect-square flex items-center justify-center">
              <div className="text-center">
                 
                   <img 
                      src={seguidorEletronica.src} 
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
            <h2 className="text-3xl font-bold mb-4">Características Técnicas</h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              Nossos robôs seguidor de linha incorporam as mais avançadas tecnologias
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">

            <Card className="border-border/50 hover:border-titans-orange/50 transition-colors">
              <CardContent className="p-6">
                <Target className="h-12 w-12 text-titans-orange mb-4" />
                <h3 className="font-semibold mb-2">Sensores de Precisão</h3>
                <p className="text-muted-foreground text-sm">
                  Array de sensores infravermelhos para detecção precisa da linha
                </p>
              </CardContent>
            </Card>
            
            <Card className="border-border/50 hover:border-titans-orange/50 transition-colors">
              <CardContent className="p-6">
                <Zap className="h-12 w-12 text-titans-orange mb-4" />
                <h3 className="font-semibold mb-2">Controle PID</h3>
                <p className="text-muted-foreground text-sm">
                  Algoritmos de controle avançados para movimentação suave
                </p>
              </CardContent>
            </Card>

            <Card className="border-border/50 hover:border-titans-orange/50 transition-colors">
              <CardContent className="p-6">
                <Trophy className="h-12 w-12 text-titans-orange mb-4" />
                <h3 className="font-semibold mb-2">Alta Performance</h3>
                <p className="text-muted-foreground text-sm">
                  Motores e chassis otimizados para máxima velocidade
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
            <h2 className="text-3xl font-bold mb-4">Nossa Equipe</h2>
            <p className="text-muted-foreground">
              Membros especializados em seguidor de linha
            </p>
          </div>
          
          {/* Team Photo */}
          <div className="flex justify-center mb-12">
            <div className="w-96 h-64 bg-gradient-to-br from-titans-red/20 to-titans-orange/20 rounded-lg flex items-center justify-center border-2 border-dashed border-border">
              <div className="text-center">
                <Users className="h-16 w-16 text-titans-orange mx-auto mb-2" />
                <p className="text-muted-foreground text-sm">Foto da Equipe</p>
              </div>
            </div>
          </div>

          {/* lideres */}
          <div className="mb-12">
            <h3 className="text-xl font-semibold text-center mb-8">Gerentes de Projeto</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-2xl mx-auto items-center justify-items-center">
              {[
                {
                  name: "Felipe das Neves",
                  photo: felipeDasNevesPhoto,
                  rating: 96,
                  position: "DEV",
                  variant: "gold" as const,
                  stats: [
                    { label: "CTR", value: 95 },
                    { label: "MAP", value: 97 },
                    { label: "VEL", value: 92 },
                    { label: "SEN", value: 91 },
                    { label: "COD", value: 96 },
                    { label: "DBG", value: 94 },
                  ],
                },
                {
                  name: "Arthur Vilas boas",
                  photo: arthurPhoto,
                  rating: 91,
                  position: "SEN",
                  variant: "icon" as const,
                  stats: [
                    { label: "CTR", value: 93 },
                    { label: "MAP", value: 88 },
                    { label: "VEL", value: 90 },
                    { label: "SEN", value: 96 },
                    { label: "COD", value: 89 },
                    { label: "DBG", value: 90 },
                  ],
                },
              ].map((leader, index) => (
                <PlayerCard
                  key={index}
                  ornate
                  variant={leader.variant}
                  name={leader.name}
                  photo={leader.photo.src}
                  backdrop={robotChassiBackdrop.src}
                  rating={leader.rating}
                  position={leader.position}
                  stats={leader.stats}
                />
              ))}
            </div>
          </div>

          {/* membros */}
          <div>
            <h3 className="text-xl font-semibold text-center mb-8">Membros</h3>

            <div className="flex flex-wrap justify-center gap-6 sm:gap-10">
              {[
                {
                  name: "Henrique Oliveira",
                  photo: henriquePhoto,
                  variant: "emerald" as const,
                  rating: 87,
                  position: "ELE",
                  stats: [
                    { label: "CTR", value: 84 },
                    { label: "MAP", value: 83 },
                    { label: "VEL", value: 85 },
                    { label: "SEN", value: 88 },
                    { label: "COD", value: 82 },
                    { label: "DBG", value: 86 },
                  ],
                },
                {
                  name: "Gustavo Emmanuel",
                  photo: gustavoPhoto,
                  variant: "silver" as const,
                  rating: 86,
                  position: "CAD",
                  stats: [
                    { label: "CTR", value: 82 },
                    { label: "MAP", value: 85 },
                    { label: "VEL", value: 84 },
                    { label: "SEN", value: 83 },
                    { label: "COD", value: 80 },
                    { label: "DBG", value: 88 },
                  ],
                },
                {
                  name: "Thamires Ellen",
                  photo: thamiresPhoto,
                  variant: "teal" as const,
                  rating: 85,
                  position: "CTR",
                  stats: [
                    { label: "CTR", value: 90 },
                    { label: "MAP", value: 80 },
                    { label: "VEL", value: 83 },
                    { label: "SEN", value: 84 },
                    { label: "COD", value: 88 },
                    { label: "DBG", value: 85 },
                  ],
                },
                {
                  name: "João Victor",
                  photo: joaoVictorPhoto,
                  variant: "purple" as const,
                  rating: 84,
                  position: "ELE",
                  stats: [
                    { label: "CTR", value: 80 },
                    { label: "MAP", value: 82 },
                    { label: "VEL", value: 86 },
                    { label: "SEN", value: 83 },
                    { label: "COD", value: 79 },
                    { label: "DBG", value: 85 },
                  ],
                },
              ].map((member, index) => (
                <div key={index}>
                  <PlayerCard
                    variant={member.variant}
                    photoFit="framed"
                    name={member.name}
                    photo={member.photo.src}
                    rating={member.rating}
                    position={member.position}
                    stats={member.stats}
                  />
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

 {/* IEEE RAS Project Section  
      <section className="py-16 bg-muted/10">

        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-8">
              <Badge className="mb-4 bg-gradient-to-r from-titans-red to-titans-orange text-white">
                Projeto Vinculado
              </Badge>
              <h2 className="text-3xl font-bold mb-4">IEEE RAS</h2>
              <p className="text-muted-foreground">
                Robotics and Automation Society
              </p>
            </div>
            
            <Card className="bg-gradient-to-br from-titans-red/5 to-titans-orange/5 border-titans-orange/20">
              <CardContent className="p-8">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
                  <div>
                    <h3 className="text-xl font-semibold mb-4">Parceria Estratégica</h3>
                    <p className="text-muted-foreground mb-4">
                      Nossa equipe de seguidor de linha está vinculada aos projetos da IEEE RAS, 
                      participando de competições e desenvolvendo pesquisas na área de robótica móvel autônoma.
                    </p>
                    <p className="text-muted-foreground mb-6">
                      Esta parceria nos permite acesso a recursos técnicos, publicações científicas 
                      e networking com profissionais da área internacional.
                    </p>
                    <Button variant="outline">
                      Saiba mais sobre IEEE RAS
                    </Button>
                  </div>
                  

                  <div className="bg-gradient-to-br from-titans-orange/20 to-titans-red/20 rounded-lg p-8 text-center">
                    <div className="w-20 h-20 bg-gradient-to-br from-titans-red to-titans-orange rounded-full mx-auto mb-4 flex items-center justify-center">
                      <span className="text-white font-bold text-2xl">IEEE</span>
                    </div>
                    <h4 className="font-semibold mb-2">IEEE RAS</h4>
                    <p className="text-muted-foreground text-sm">
                      Robotics and Automation Society
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>
*/}     

      <Footer />
    </div>
  );
};

export default SeguirLinha;