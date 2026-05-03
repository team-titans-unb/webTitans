import { Mail, MapPin, Phone } from "lucide-react";

const Footer = () => {
  return (
    <footer className="bg-card border-t border-border">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Logo e descrição da parte de baixo */}
          <div className="space-y-4">
            <div className="flex items-center space-x-2">

                <img src="/favicon.ico" 
                    alt="Ícone Titans" 
                    className="w-10 h-10 rounded-lg" 
                />

              <span className="font-bold text-xl bg-gradient-to-r from-titans-red to-titans-orange bg-clip-text text-transparent">
                Team Titans
              </span>

            </div>
            <p className="text-muted-foreground">
              Equipe de robótica competitiva dedicada à excelência em tecnologia e inovação.
            </p>
          </div>

          {/* Links */}
          <div className="space-y-4">
            <h3 className="font-semibold text-foreground">Modalidades</h3>
            <ul className="space-y-2 text-muted-foreground">
              <li><a href="/seguidor-linha" className="hover:text-foreground transition-colors">Seguidor de Linha</a></li>
              <li><a href="/combate" className="hover:text-foreground transition-colors">Combate</a></li>
              <li><a href="/vsss" className="hover:text-foreground transition-colors">VSSS</a></li>
              <li><a href="/ssl" className="hover:text-foreground transition-colors">SSL</a></li>
            </ul>
          </div>

          {/* Contato */}
          <div className="space-y-4">
            <h3 className="font-semibold text-foreground">Contato</h3>
            <div className="space-y-2 text-muted-foreground">
               {/* Contato 
              <div className="flex items-center space-x-2">
                <Phone className="h-4 w-4" />
                <span>(61) 99999-9999</span>
              </div>
              */}

              <div className="flex items-center space-x-2">
                <Mail className="h-4 w-4" />
                <span>contato.titansteam@gmail.com</span>
              </div>

              <div className="flex items-center space-x-2">
                <MapPin className="h-4 w-4" />
                <span>Brasília, DF</span>
              </div>
            </div>
          </div>
        </div>

        <div className="border-t border-border mt-8 pt-8 text-center text-muted-foreground">
          <p>&copy; {new Date().getFullYear()} TITANS. Todos os direitos reservados.</p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;