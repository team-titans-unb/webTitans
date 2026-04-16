import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { ArrowLeft, Cpu, Network, Zap, Users } from "lucide-react";
import { Link } from "react-router-dom";

const SSL = () => {
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
            
            <Badge className="mb-4 bg-gradient-to-r from-blue-500 to-cyan-500 text-white">
              Modalidade
            </Badge>
            
            <h1 className="text-4xl md:text-6xl font-bold mb-6">
              <span className="bg-gradient-to-r from-blue-500 to-cyan-500 bg-clip-text text-transparent">
                SSL
              </span>
            </h1>
            
            <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
              Small Size League - Futebol robótico de alta performance com robôs omnidirecionais
            </p>
            
            <div className="flex flex-wrap justify-center gap-4">
              <Button className="bg-gradient-to-r from-blue-500 to-cyan-500 text-white hover:shadow-lg hover:scale-105" size="lg">
                Ver Competições
              </Button>
              <Button variant="outline" size="lg">
                Tecnologia SSL
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
              <h2 className="text-3xl font-bold mb-6">Small Size League</h2>
              <p className="text-muted-foreground mb-6">
                O SSL é a categoria mais avançada do futebol robótico, com robôs omnidirecionais 
                de alta velocidade que disputam partidas em campo oficial. Cada time pode ter 
                até 11 robôs simultâneos controlados por IA centralizada.
              </p>
              <p className="text-muted-foreground mb-8">
                Desenvolvemos robôs com rodas omnidirecionais, sistemas de visão global e 
                algoritmos de planejamento de trajetória para performance máxima.
              </p>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-blue-500">11</div>
                  <div className="text-sm text-muted-foreground">Robôs por Time</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-blue-500">35</div>
                  <div className="text-sm text-muted-foreground">Km/h Velocidade Máx</div>
                </div>
              </div>
            </div>
            
            <div className="bg-gradient-to-br from-blue-500/20 to-cyan-500/20 rounded-lg p-8 aspect-square flex items-center justify-center">
              <div className="text-center">
                <Network className="h-24 w-24 text-blue-500 mx-auto mb-4" />
                <p className="text-muted-foreground">Sistema SSL em operação</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-16 bg-muted/20">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold mb-4">Tecnologia de Ponta</h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              Sistemas avançados para futebol robótico de alta performance
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <Card className="border-border/50 hover:border-blue-500/50 transition-colors">
              <CardContent className="p-6">
                <Zap className="h-12 w-12 text-blue-500 mb-4" />
                <h3 className="font-semibold mb-2">Movimento Omnidirecional</h3>
                <p className="text-muted-foreground text-sm">
                  Rodas especiais permitem movimento em qualquer direção
                </p>
              </CardContent>
            </Card>
            
            <Card className="border-border/50 hover:border-blue-500/50 transition-colors">
              <CardContent className="p-6">
                <Cpu className="h-12 w-12 text-blue-500 mb-4" />
                <h3 className="font-semibold mb-2">IA Centralizada</h3>
                <p className="text-muted-foreground text-sm">
                  Sistema central controla todos os robôs simultaneamente
                </p>
              </CardContent>
            </Card>
            
            <Card className="border-border/50 hover:border-blue-500/50 transition-colors">
              <CardContent className="p-6">
                <Network className="h-12 w-12 text-blue-500 mb-4" />
                <h3 className="font-semibold mb-2">Comunicação RF</h3>
                <p className="text-muted-foreground text-sm">
                  Transmissão de dados em tempo real via radiofrequência
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
            <h2 className="text-3xl font-bold mb-4">Equipe SSL</h2>
            <p className="text-muted-foreground">
              Especialistas em sistemas de alta performance
            </p>
          </div>
          
          {/* Team Photo */}
          <div className="flex justify-center mb-12">
            <div className="w-96 h-64 bg-gradient-to-br from-blue-500/20 to-cyan-500/20 rounded-lg flex items-center justify-center border-2 border-dashed border-border">
              <div className="text-center">
                <Users className="h-16 w-16 text-blue-500 mx-auto mb-2" />
                <p className="text-muted-foreground text-sm">Foto da Equipe</p>
              </div>
            </div>
          </div>

          {/* Leaders */}
          <div className="mb-12">
            <h3 className="text-xl font-semibold text-center mb-8">Líderes</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-2xl mx-auto">
              {[
                { name: "Diego Almeida", role: "Líder Técnico", expertise: "Sistemas Omnidirecionais" },
                { name: "Beatriz Souza", role: "Líder de IA", expertise: "Planejamento Multi-agente" },
              ].map((leader, index) => (
                <Card key={index} className="text-center">
                  <CardContent className="p-6">
                    <div className="w-24 h-24 bg-muted rounded-full mx-auto mb-4 flex items-center justify-center border-2 border-dashed border-border">
                      <span className="text-muted-foreground text-xs">Foto</span>
                    </div>
                    <h4 className="font-semibold mb-1">{leader.name}</h4>
                    <p className="text-blue-500 text-sm mb-2">{leader.role}</p>
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
                { name: "Gabriel Pereira", role: "RF Engineer", expertise: "Comunicação e Controle" },
                { name: "Fernanda Silva", role: "Motion Engineer", expertise: "Controle de Movimento" },
                { name: "Ricardo Moura", role: "Game Analyst", expertise: "Estratégias de Jogo" },
              ].map((member, index) => (
                <Card key={index} className="text-center">
                  <CardContent className="p-6">
                    <div className="w-20 h-20 bg-muted rounded-full mx-auto mb-4 flex items-center justify-center border-2 border-dashed border-border">
                      <span className="text-muted-foreground text-xs">Foto</span>
                    </div>
                    <h4 className="font-semibold mb-1">{member.name}</h4>
                    <p className="text-blue-500 text-sm mb-2">{member.role}</p>
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

export default SSL;