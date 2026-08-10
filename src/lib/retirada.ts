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
    alt: "Fachada do Prédio LDTEA, na FCTE Gama, vista do caminho de pedestres",
  },
  {
    src: "/retirada/elevador.jpg",
    alt: "Botoeira do elevador do prédio: a Sala 208 fica no andar 2",
  },
  {
    src: "/retirada/corredor.jpg",
    alt: "Corredor do segundo andar, em direção à Sala 208",
  },
  {
    src: "/retirada/sala.jpg",
    alt: "Porta da Sala 208 aberta, ponto de retirada das impressões",
  },
];
