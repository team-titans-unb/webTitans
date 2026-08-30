import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { KanbanBoard } from "@/components/kanban/KanbanBoard";

const EquipeTarefas = () => {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Header />

      <main className="container mx-auto flex-1 px-4 pb-16 pt-24 sm:px-6 lg:px-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold sm:text-3xl">Tarefas da Equipe</h1>
          <p className="mt-1 text-muted-foreground">
            Quadro Kanban para organizar as tarefas dos projetos da TITANS.
          </p>
        </div>

        <KanbanBoard />
      </main>

      <Footer />
    </div>
  );
};

export default EquipeTarefas;
