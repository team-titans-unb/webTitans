// Fonte única de verdade do local de retirada das impressões.
// O local é fixo e público; não há consulta a banco, Storage ou API.

export const LOCAL_RETIRADA = "Sala 208, Prédio LDTEA – FCTE Gama";

export type FotoRetirada = {
  src: string;
  alt: string;
};

// Fotos do local/caminho até a sala de retirada (até 4).
// PROVISÓRIO: apontam para placeholders em `public/retirada/` até as fotos
// reais serem fornecidas pela equipe. Basta substituir os arquivos mantendo
// os mesmos caminhos para atualizar a galeria.
export const FOTOS_RETIRADA: FotoRetirada[] = [
  {
    src: "/retirada/foto-1.svg",
    alt: "Fachada do Prédio LDTEA na FCTE Gama",
  },
  {
    src: "/retirada/foto-2.svg",
    alt: "Entrada do prédio e caminho até a recepção",
  },
  {
    src: "/retirada/foto-3.svg",
    alt: "Corredor do segundo andar em direção à Sala 208",
  },
  {
    src: "/retirada/foto-4.svg",
    alt: "Porta da Sala 208, ponto de retirada das impressões",
  },
];
