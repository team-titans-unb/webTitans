import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { ArrowLeft, Shield, Swords, Flame, Users } from "lucide-react";
import { Link } from "react-router-dom";

const Combate = () => {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      {/* Hero Section */}
      <section className="pt-20 pb-16 bg-gradient-to-b from-background to-muted/20">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-4xl mx-auto text-center">
            <Link to="/" className="inline-flex items-center text-muted-foreground hover:text-foreground mb-6 transition-colors">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Voltar ao início
            </Link>
            
            <Badge className="mb-4 bg-gradient-to-r from-titans-red to-titans-orange text-white">
              Modalidade
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
              <Button variant="hero" size="lg">
                Ver Batalhas
              </Button>
              <Button variant="outline" size="lg">
                Especificações de Guerra
              </Button>
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
                Utilizamos materiais de alta resistência, sistemas de proteção avançados e 
                armas especializadas para criar máquinas de combate superiores.
              </p>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-titans-red">12</div>
                  <div className="text-sm text-muted-foreground">Robôs de Guerra</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-titans-red">25</div>
                  <div className="text-sm text-muted-foreground">Batalhas Vencidas</div>
                </div>
              </div>
            </div>
            
            <div className="bg-gradient-to-br from-titans-red/20 to-titans-orange/20 rounded-lg p-8 aspect-square flex items-center justify-center">
              <div className="text-center">
                <Swords className="h-24 w-24 text-titans-red mx-auto mb-4" />
                <p className="text-muted-foreground">Robô de combate em ação</p>
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
              Tecnologias militares adaptadas para o combate robótico
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
            <div className="w-96 h-64 bg-gradient-to-br from-titans-red/20 to-titans-orange/20 rounded-lg flex items-center justify-center border-2 border-dashed border-border">
              <div className="text-center">
                <Users className="h-16 w-16 text-titans-red mx-auto mb-2" />
                <p className="text-muted-foreground text-sm">Foto da Equipe</p>
              </div>
            </div>
          </div>

          {/* Leaders */}
          <div className="mb-12">
            <h3 className="text-xl font-semibold text-center mb-8">Líderes</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-2xl mx-auto">
              {[
                { name: "Carlos Ferreira", role: "Líder de Combate", expertise: "Armas e Sistemas de Ataque" },
                { name: "Ana Rodrigues", role: "Líder de Defesa", expertise: "Blindagem e Proteção" },
              ].map((leader, index) => (
                <Card key={index} className="text-center">
                  <CardContent className="p-6">
                    <div className="w-24 h-24 bg-muted rounded-full mx-auto mb-4 flex items-center justify-center border-2 border-dashed border-border">
                      <span className="text-muted-foreground text-xs">Foto</span>
                    </div>
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
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {[
                { name: "Lucas Martins", role: "Pilot", expertise: "Controle e Estratégia" },
                { name: "Bruno Silva", role: "Weapon Designer", expertise: "Desenvolvimento de Armas" },
                { name: "Carla Mendes", role: "Systems Analyst", expertise: "Análise de Performance" },
              ].map((member, index) => (
                <Card key={index} className="text-center">
                  <CardContent className="p-6">
                    <div className="w-20 h-20 bg-muted rounded-full mx-auto mb-4 flex items-center justify-center border-2 border-dashed border-border">
                      <span className="text-muted-foreground text-xs">Foto</span>
                    </div>
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