// Fonte única de verdade do local de retirada das impressões.
// O local é fixo e público; não há consulta a banco, Storage ou API.

export const LOCAL_RETIRADA = "Sala 208, Prédio LDTEA – FCTE Gama";

export type FotoRetirada = {
  src: string;
  alt: string;
};

// Fotos do caminho até a sala de retirada, na ordem em que o cliente percorre:
// chega no prédio, sobe de elevador, segue o corredor e chega na sala.
// Arquivos em `public/retirada/`, já redimensionados para 1280x720 (16:9, o
// mesmo aspect-video da galeria) — trocar uma foto é só substituir o arquivo.
export const FOTOS_RETIRADA: FotoRetirada[] = [
  {
    src: "/retirada/fachada.jpg",
    alt: "Fachada do Prédio LDTEA, descendo do RU",
  },
  {
    src: "/retirada/elevador.jpg",
    alt: "Elevador do LDTEA: Ir para o primeiro andar",
  },
  {
    src: "/retirada/corredor.jpg",
    alt: "Corredor do primeiro andar, em direção à Sala 208",
  },
  {
    src: "/retirada/sala.jpg",
    alt: "Porta da Sala 208, ponto de retirada das impressões",
  },
];
