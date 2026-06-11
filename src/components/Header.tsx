"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Menu, X, Users } from "lucide-react";
import Link from "next/link";
import { ThemeToggle } from "@/components/ThemeToggle";

const Header = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const navigation = [
    { name: "Início", href: "/" },
    { name: "Quem Somos", href: "/#sobre" },
    { name: "Modalidades", href: "/#modalidades" },
    { name: "Inscrições", href: "/#inscricoes" },
    { name: "Apoiar", href: "/#apoiar" },
    { name: "Projetos Destaques", href: "/projetos" },
    { name: "Impressão", href: "/impressao" },
  ];

  return (
    <header className="fixed top-0 w-full z-50 bg-background/80 backdrop-blur-md border-b border-border">
      <nav className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo */}
          <Link href="/" className="flex items-center space-x-2">

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
              <Link
                key={item.name}
                href={item.href}
                className="text-foreground/80 hover:text-foreground transition-colors"
              >
                {item.name}
              </Link>
            ))}
            
            <Link 
              href="/login"
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
                <Link
                  key={item.name}
                  href={item.href}
                  className="block px-3 py-2 text-foreground/80 hover:text-foreground transition-colors"
                  onClick={() => setIsMenuOpen(false)}
                >
                  {item.name}
                </Link>
              ))}
              <div className="border-t border-border my-2" />
              <Link
                href="/login"
                className="block px-3 py-2 text-foreground/80 hover:text-foreground transition-colors"
                onClick={() => setIsMenuOpen(false)}
              >
                <Users className="h-4 w-4 inline-block mr-2" />
                Área dos Membros
              </Link>
            </div>
          </div>
        )}
      </nav>
    </header>
  );
};

export default Header;
