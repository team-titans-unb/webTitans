import { addDays } from "date-fns";

import { toISODate } from "./format";
import type { Task } from "./types";

const today = new Date();
const rel = (days: number) => toISODate(addDays(today, days));

let subCounter = 0;
const sub = (description: string, done = false) => ({
  id: `seed-sub-${++subCounter}`,
  description,
  done,
});

/**
 * Dados de exemplo — usados apenas para o design. O estado é 100% em memória:
 * recarregar a página volta para esta lista.
 */
export const SEED_TASKS: Task[] = [
  {
    id: "seed-1",
    title: "Montar bancada de testes do robô SSL",
    description:
      "Organizar cabos, fonte e o campo reduzido para os testes de locomoção da próxima semana.",
    status: "pendente",
    priority: 3,
    dueDate: rel(0),
    createdAt: rel(-4),
    subtasks: [
      sub("Separar as fontes de 12V"),
      sub("Conferir cabos de comunicação"),
      sub("Imprimir marcadores do campo"),
    ],
  },
  {
    id: "seed-2",
    title: "Revisar orçamento de peças",
    description:
      "Comparar fornecedores de motores brushless e atualizar a planilha de compras.",
    status: "pendente",
    priority: 2,
    dueDate: rel(3),
    createdAt: rel(-2),
    subtasks: [],
  },
  {
    id: "seed-3",
    title: "Escrever roteiro do vídeo de divulgação",
    description:
      "Roteiro curto (até 60s) para o Instagram apresentando as modalidades da equipe.",
    status: "pendente",
    priority: 1,
    dueDate: rel(10),
    createdAt: rel(-1),
    subtasks: [sub("Rascunhar tópicos"), sub("Definir trilha sonora")],
  },
  {
    id: "seed-4",
    title: "Calibrar PID do seguidor de linha",
    description:
      "Ajustar ganhos Kp/Ki/Kd na pista de treino e registrar os tempos de volta.",
    status: "em_progresso",
    priority: 3,
    dueDate: rel(1),
    createdAt: rel(-6),
    subtasks: [
      sub("Medir tempo base", true),
      sub("Testar Kp entre 0.4 e 0.8"),
      sub("Documentar resultados"),
    ],
  },
  {
    id: "seed-5",
    title: "Integrar visão computacional com a estratégia",
    description:
      "Publicar a posição da bola no tópico usado pelo módulo de decisão do VSSS.",
    status: "em_progresso",
    priority: 2,
    dueDate: rel(5),
    createdAt: rel(-3),
    subtasks: [sub("Definir formato da mensagem", true), sub("Testar latência")],
  },
  {
    id: "seed-6",
    title: "Atualizar o site com a equipe de Combate",
    description: "Subir as fotos e a descrição dos novos integrantes.",
    status: "concluida",
    priority: 1,
    dueDate: rel(-2),
    createdAt: rel(-9),
    subtasks: [
      sub("Coletar fotos", true),
      sub("Revisar textos", true),
      sub("Publicar", true),
    ],
  },
  {
    id: "seed-7",
    title: "Comprar filamento PLA",
    description: "Repor o estoque da impressora 3D (2 rolos pretos, 1 branco).",
    status: "concluida",
    priority: 2,
    dueDate: rel(-5),
    createdAt: rel(-12),
    subtasks: [],
  },
];
