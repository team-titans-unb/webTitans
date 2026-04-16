import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, ShoppingCart } from "lucide-react";
import { Link } from "react-router-dom";

const Produtos = () => {
  const products = [
    {
      name: "Camiseta TITANS",
      price: "R$ 45,00",
      description: "Camiseta oficial da equipe com logo bordado",
      image: "bg-gradient-to-br from-titans-red/20 to-titans-orange/20"
    },
    {
      name: "Moletom TITANS",
      price: "R$ 89,00", 
      description: "Moletom com capuz e logo da equipe",
      image: "bg-gradient-to-br from-titans-orange/20 to-titans-gold/20"
    },
    {
      name: "Kit Adesivos",
      price: "R$ 15,00",
      description: "Pack com 10 adesivos variados",
      image: "bg-gradient-to-br from-titans-gold/20 to-titans-orange/20"
    },
    {
      name: "Caneca TITANS",
      price: "R$ 25,00",
      description: "Caneca cerâmica com logo da equipe",
      image: "bg-gradient-to-br from-titans-red/20 to-titans-gold/20"
    },
    {
      name: "Boné TITANS",
      price: "R$ 35,00",
      description: "Boné ajustável com bordado",
      image: "bg-gradient-to-br from-titans-orange/20 to-titans-red/20"
    },
    {
      name: "Chaveiro Robô",
      price: "R$ 12,00",
      description: "Chaveiro miniatura dos nossos robôs",
      image: "bg-gradient-to-br from-titans-gold/20 to-titans-red/20"
    }
  ];

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      {/* Hero Section */}
      <section className="pt-20 pb-16 bg-gradient-to-b from-background to-muted/10">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-4xl mx-auto text-center">
            <Link to="/" className="inline-flex items-center text-muted-foreground hover:text-foreground mb-6 transition-colors">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Voltar ao início
            </Link>
            
            <Badge className="mb-4 bg-gradient-to-r from-titans-red to-titans-orange text-white">
              Loja Oficial
            </Badge>
            
            <h1 className="text-4xl md:text-6xl font-bold mb-6">
              <span className="bg-gradient-to-r from-titans-red to-titans-orange bg-clip-text text-transparent">
                TITANS Store
              </span>
            </h1>
            
            <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
              Produtos oficiais da equipe TITANS. Vista nossa camisa e apoie a robótica!
            </p>
          </div>
        </div>
      </section>

      {/* Products Grid */}
      <section className="py-16">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 max-w-6xl mx-auto">
            {products.map((product, index) => (
              <Card key={index} className="group hover:shadow-lg transition-all duration-300 border-border/50 hover:border-titans-orange/50">
                <CardContent className="p-6">
                  <div className={`w-full h-48 ${product.image} rounded-lg flex items-center justify-center mb-4 border-2 border-dashed border-border`}>
                    <span className="text-muted-foreground text-sm">{product.name}</span>
                  </div>
                  
                  <h3 className="font-semibold text-lg mb-2">{product.name}</h3>
                  <p className="text-muted-foreground text-sm mb-4">{product.description}</p>
                  
                  <div className="flex items-center justify-between">
                    <span className="text-2xl font-bold text-titans-orange">{product.price}</span>
                    <Button size="sm" className="bg-gradient-to-r from-titans-red to-titans-orange hover:from-titans-red/90 hover:to-titans-orange/90">
                      <ShoppingCart className="h-4 w-4 mr-2" />
                      Comprar
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Contact Section */}
      <section className="py-16 bg-muted/10">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-2xl mx-auto text-center">
            <h2 className="text-3xl font-bold mb-6">Interesse em nossos produtos?</h2>
            <p className="text-muted-foreground mb-8">
              Entre em contato conosco através das redes sociais ou e-mail para mais informações sobre disponibilidade e formas de pagamento.
            </p>
            <Button variant="titans" size="lg">
              Entrar em contato
            </Button>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
};

export default Produtos;