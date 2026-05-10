import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import ScrollToTop from "./components/ScrollToTop";
import { ThemeProvider } from "next-themes";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import SeguirLinha from "./pages/SeguirLinha";
import Combate from "./pages/Combate";
import VSSS from "./pages/VSSS";
import SSL from "./pages/SSL";
import Login from "./pages/Login";
import Inscricao from "./pages/Inscricao";
import Produtos from "./pages/Produtos";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider attribute="class" defaultTheme="dark" enableSystem>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <ScrollToTop />
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/seguidor-linha" element={<SeguirLinha />} />
            <Route path="/combate" element={<Combate />} />
            <Route path="/vsss" element={<VSSS />} />
            <Route path="/ssl" element={<SSL />} />
            <Route path="/login" element={<Login />} />
            <Route path="/inscricao" element={<Inscricao />} />
            <Route path="/produtos" element={<Produtos />} />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
