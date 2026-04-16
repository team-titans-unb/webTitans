import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Menu, X, Users } from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import { ThemeToggle } from "@/components/ThemeToggle";

const Header = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const location = useLocation();

  const navigation = [
    { name: "Início", href: "/" },
    { name: "Quem Somos", href: "#sobre" },
    { name: "Modalidades", href: "#modalidades" },
    {/* { name: "Processo Seletivo", href: "/inscricao" },*/}  
  ];

  const teams = [
    { name: "Seguidor de Linha", href: "/seguidor-linha" },
    { name: "Combate", href: "/combate" },
    { name: "VSSS", href: "/vsss" },
    { name: "SSL", href: "/ssl" },
  ];

  return (
    <header className="fixed top-0 w-full z-50 bg-background/80 backdrop-blur-md border-b border-border">
      <nav className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo */}
          <Link to="/" className="flex items-center space-x-2">

          {/* <div className="w-10 h-10 bg-gradient-to-br from-titans-red to-titans-orange rounded-lg flex items-center justify-center">       </div>*/}
          
               <img src="/favicon.ico" 
                    alt="Ícone Titans" 
                    className="w-10 h-10 rounded-lg" 
                />
                         
            <span className="font-bold text-xl bg-gradient-to-r from-titans-red to-titans-orange bg-clip-text text-transparent">
              TITANS
            </span>
          </Link>

          {/* navegação no desktop */}
          <div className="hidden md:flex items-center space-x-8">
            <ThemeToggle />
            {navigation.map((item) => (
              <a
                key={item.name}
                href={item.href}
                className="text-foreground/80 hover:text-foreground transition-colors"
              >
                {item.name}
              </a>
            ))}
            
            {/* Equipes Dropdown */}
            <div className="relative group">
              <button className="text-foreground/80 hover:text-foreground transition-colors">
                Equipes
              </button>
              <div className="absolute top-full left-0 mt-2 w-48 bg-card border border-border rounded-lg shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200">
                <div className="py-2">
                  {teams.map((team) => (
                    <Link
                      key={team.name}
                      to={team.href}
                      className="block px-4 py-2 text-sm text-foreground/80 hover:text-foreground hover:bg-muted transition-colors"
                    >
                      {team.name}
                    </Link>
                  ))}
                </div>
              </div>
            </div>
            
            <Link 
              to="/login"
              className="text-foreground/80 hover:text-foreground transition-colors p-2 rounded-lg hover:bg-muted/50"
              title="Área dos Membros"
            >
              <Users className="h-5 w-5" />
            </Link>
          </div>

          {/* Mobile menu button */}
          <div className="md:hidden flex items-center">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsMenuOpen(!isMenuOpen)}
            >
              {isMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </Button>
          </div>
        </div>

        {/* Mobile Navigation */}
        {isMenuOpen && (
          <div className="md:hidden">
            <div className="px-2 pt-2 pb-3 space-y-1 bg-card border border-border rounded-lg mt-2">
              <div className="flex justify-center pb-2 border-b border-border mb-2">
                <ThemeToggle />
              </div>
              {navigation.map((item) => (
                <a
                  key={item.name}
                  href={item.href}
                  className="block px-3 py-2 text-foreground/80 hover:text-foreground transition-colors"
                  onClick={() => setIsMenuOpen(false)}
                >
                  {item.name}
                </a>
              ))}
              <div className="border-t border-border my-2"></div>
              <p className="px-3 py-1 text-sm font-medium text-foreground/60">Equipes</p>
              {teams.map((team) => (
                <Link
                  key={team.name}
                  to={team.href}
                  className="block px-3 py-2 text-foreground/80 hover:text-foreground transition-colors"
                  onClick={() => setIsMenuOpen(false)}
                >
                  {team.name}
                  </Link>
                ))}
              </div>
              <div className="border-t border-border my-2"></div>
              <Link
                to="/login"
                className="block px-3 py-2 text-foreground/80 hover:text-foreground transition-colors"
                onClick={() => setIsMenuOpen(false)}
              >
                <Users className="h-4 w-4 inline-block mr-2" />
                Área dos Membros
              </Link>
          </div>
        )}
      </nav>
    </header>
  );
};

export default Header;