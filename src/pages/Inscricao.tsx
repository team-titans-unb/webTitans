import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { ArrowLeft, Upload, UserPlus } from "lucide-react";
import { Link } from "react-router-dom";
import { ThemeToggle } from "@/components/ThemeToggle";

const Inscricao = () => {
  const [formData, setFormData] = useState({
    nome: "",
    email: "",
    telefone: "",
    curso: "",
    semestre: "",
    area: "",
    experiencia: "",
    motivacao: "",
    disponibilidade: "",
    termos: false
  });

  const handleInputChange = (field: string, value: string | boolean) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    console.log("Inscrição enviada:", formData);
    // Gerencie a lógica de envio do formulário aqui.
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-muted/20 to-titans-red/5">
      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>
      
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-2xl mx-auto">
          <div className="flex items-center mb-8">
            <Button variant="ghost" size="icon" asChild className="mr-4">
              <Link to="/">
                <ArrowLeft className="h-5 w-5" />
              </Link>
            </Button>
            <div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-titans-red to-titans-orange bg-clip-text text-transparent">
                Processo Seletivo TITANS
              </h1>
              <p className="text-muted-foreground">Preencha os dados para sua inscrição</p>
            </div>
          </div>

          <Card className="shadow-xl border-0 bg-card/80 backdrop-blur-sm">
            <CardHeader className="text-center">
              <div className="w-16 h-16 bg-gradient-to-br from-titans-red to-titans-orange rounded-full flex items-center justify-center mx-auto mb-4">
                <UserPlus className="h-8 w-8 text-white" />
              </div>
              <CardTitle className="text-xl">Formulário de Inscrição</CardTitle>
            </CardHeader>
            
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-6">
                {/* Dados Pessoais */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-titans-orange">Dados Pessoais</h3>
                  
                  <div className="space-y-2">
                    <Label htmlFor="nome">Nome Completo *</Label>
                    <Input
                      id="nome"
                      placeholder="Seu nome completo"
                      value={formData.nome}
                      onChange={(e) => handleInputChange("nome", e.target.value)}
                      required
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="email">Email *</Label>
                      <Input
                        id="email"
                        type="email"
                        placeholder="seu.email@example.com"
                        value={formData.email}
                        onChange={(e) => handleInputChange("email", e.target.value)}
                        required
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="telefone">Telefone *</Label>
                      <Input
                        id="telefone"
                        placeholder="(11) 99999-9999"
                        value={formData.telefone}
                        onChange={(e) => handleInputChange("telefone", e.target.value)}
                        required
                      />
                    </div>
                  </div>
                </div>

                {/* Dados Acadêmicos */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-titans-orange">Dados Acadêmicos</h3>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="curso">Curso *</Label>
                      <Input
                        id="curso"
                        placeholder="Ex: Engenharia Elétrica"
                        value={formData.curso}
                        onChange={(e) => handleInputChange("curso", e.target.value)}
                        required
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="semestre">Semestre *</Label>
                      <Select onValueChange={(value) => handleInputChange("semestre", value)}>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione o semestre" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="1">1º Semestre</SelectItem>
                          <SelectItem value="2">2º Semestre</SelectItem>
                          <SelectItem value="3">3º Semestre</SelectItem>
                          <SelectItem value="4">4º Semestre</SelectItem>
                          <SelectItem value="5">5º Semestre</SelectItem>
                          <SelectItem value="6">6º Semestre</SelectItem>
                          <SelectItem value="7">7º Semestre</SelectItem>
                          <SelectItem value="8">8º Semestre</SelectItem>
                          <SelectItem value="9">9º Semestre</SelectItem>
                          <SelectItem value="10">10º Semestre</SelectItem>
                          <SelectItem value="10 + ">10º + Semestre</SelectItem>
                          <SelectItem value="pos">Pós-graduação</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>

                {/* Área de Interesse */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-titans-orange">Área de Interesse</h3>
                  
                  <div className="space-y-2">
                    <Label htmlFor="area">Área de Interesse *</Label>
                    <Select onValueChange={(value) => handleInputChange("area", value)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione sua área de interesse" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="programacao">Programação</SelectItem>
                        <SelectItem value="eletronica">Eletrônica</SelectItem>
                        <SelectItem value="mecanica">Mecânica</SelectItem>
                        <SelectItem value="gestao">Gestão</SelectItem>
                        <SelectItem value="marketing">Marketing</SelectItem>
                        <SelectItem value="design">Design</SelectItem>
                        <SelectItem value="pesquisa">Pesquisa</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="experiencia">Experiência Prévia</Label>
                    <Textarea
                      id="experiencia"
                      placeholder="Descreva sua experiência na área (projetos, cursos, trabalhos, etc.)"
                      value={formData.experiencia}
                      onChange={(e) => handleInputChange("experiencia", e.target.value)}
                      rows={3}
                    />
                  </div>
                </div>

                {/* Motivação */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-titans-orange">Sobre Você</h3>
                  
                  <div className="space-y-2">
                    <Label htmlFor="motivacao">Por que quer fazer parte dos TITANS? *</Label>
                    <Textarea
                      id="motivacao"
                      placeholder="Conte-nos sua motivação para participar da equipe..."
                      value={formData.motivacao}
                      onChange={(e) => handleInputChange("motivacao", e.target.value)}
                      required
                      rows={4}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="disponibilidade">Disponibilidade *</Label>
                    <Select onValueChange={(value) => handleInputChange("disponibilidade", value)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Qual sua disponibilidade semanal?" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="5-10h">5-10 horas por semana</SelectItem>
                        <SelectItem value="10-15h">10-15 horas por semana</SelectItem>
                        <SelectItem value="15-20h">15-20 horas por semana</SelectItem>
                        <SelectItem value="20h+">Mais de 20 horas por semana</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Termos */}
                <div className="flex items-start space-x-2">
                  <Checkbox
                    id="termos"
                    checked={formData.termos}
                    onCheckedChange={(checked) => handleInputChange("termos", checked as boolean)}
                  />
                  <Label htmlFor="termos" className="text-sm leading-5">
                    Concordo com os termos de participação e autorizo o uso dos meus dados para fins do processo seletivo. *
                  </Label>
                </div>

                <Button
                  type="submit"
                  className="w-full bg-gradient-to-r from-titans-red to-titans-orange hover:from-titans-red/90 hover:to-titans-orange/90 text-white font-semibold h-12"
                  disabled={!formData.termos}
                >
                  Enviar Inscrição
                </Button>
              </form>
            </CardContent>
          </Card>

          <p className="text-center text-xs text-muted-foreground mt-6">
            Após o envio, você receberá um e-mail de confirmação com as próximas etapas do processo seletivo.
          </p>
        </div>
      </div>
    </div>
  );
};

export default Inscricao;