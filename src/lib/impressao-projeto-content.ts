import filipeErnestoPhoto from "@/assets/fotosVsss/filipeErnesto2.png";
import impressora from "@/assets/fotosImpressora/impressora.jpeg";
import impressoraTotem from "@/assets/fotosImpressora/impressoraTotem.jpeg";
import portaImpressoes from "@/assets/fotosImpressora/portaImpressoes.jpeg";

export const IMPRESSAO_PROJETO_DETAIL_PATH = "/projetos/impressao";

export const IMPRESSAO_PROJETO_TITLE = "Projeto Impressão";

export const IMPRESSAO_PROJETO_SUMMARY =
  "Serviço de impressão sob demanda acoplado ao site da TITANS: qualquer pessoa envia um PDF, paga por PIX e o documento sai na impressora do laboratório com o mínimo de intervenção da equipe.";

// Capa exibida no card em "Projetos Destaques".
export const IMPRESSAO_PROJETO_COVER = impressoraTotem.src;

export const IMPRESSAO_PROJETO_MEMBERS = [
  { name: "Filipe Ernesto", photo: filipeErnestoPhoto.src },
] as const;

// Todas as imagens da pasta fotosImpressora, exibidas no carrossel da página.
export const IMPRESSAO_PROJETO_HERO_IMAGES = [
  { src: impressoraTotem.src, alt: "Totem de impressão" },
  { src: impressora.src, alt: "Impressora da sede" },
  { src: portaImpressoes.src, alt: "Retirada das impressões" },
] as const;

export const IMPRESSAO_PROJETO_INTRO = [
  "O Projeto Impressão é um serviço de impressão sob demanda embutido no site da equipe. O visitante abre o site, envia um ou mais PDFs, escolhe as opções, paga por PIX e recebe um protocolo enquanto isso, no laboratório, a HP Laser imprime o documento sozinha e a equipe só precisa entregar as folhas.",
  "O desafio central foi de arquitetura: o site roda com funções com timeout de 10s e sem armazenamento, a impressão física acontece numa única máquina na faculdade, e o dinheiro real envolvido exige que ninguém consiga falsificar o preço nem fazer o mesmo pedido imprimir duas vezes.",
  "A solução são quatro subsistemas independentes checkout no navegador, pagamento, armazenamento e um worker na sede que nunca se chamam diretamente: eles se coordenam apenas por uma coluna de status no banco. O PDF vai direto do navegador para o Storage.",
];

export type ImpressaoSection = {
  id: string;
  label: string;
  paragraphs: string[];
};

export const IMPRESSAO_PROJETO_SECTIONS: ImpressaoSection[] = [
  {
    id: "visao-geral",
    label: "Visão geral",
    paragraphs: [
      "A feature é composta por quatro subsistemas que rodam em três ambientes com níveis de confiança diferentes: o navegador do cliente (não confiável), hospedagem do site (confiável, mas sem estado e efêmera) e a máquina da sede (confiável e com estado físico).",
      "Nenhum deles conhece os outros. A única fonte da verdade é a coluna fila_impressao.status no banco de dados: o checkout cria a linha, o webhook do pagamento a promove para PAGO, o worker a move para IMPRIMINDO e finaliza em IMPRESSO. Entender essa máquina de estados é entender o sistema inteiro.",
      "O princípio central é esse: os subsistemas se coordenam só pela máquina de estados de status e o PDF nunca passa pela hospegam, indo direto do navegador para o Storage do banco de dados.",
    ],
  },
];
