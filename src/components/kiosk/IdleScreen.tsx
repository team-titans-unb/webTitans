"use client";

type Props = {
  // Qualquer toque na tela idle volta para a tela principal.
  onInteract: () => void;
};

// Cor média das bordas da arte: preenche as faixas de letterbox quando a tela do
// totem não é 16:9, já que a imagem usa object-contain (nada de corte).
const COR_FUNDO = "#883e2c";

// Tela idle (sem toque há alguns minutos): arte do grupo em tela cheia. O QR e as
// instruções já fazem parte do desenho — nada é sobreposto para não cobrir a arte.
// O QR embutido aponta para https://www.roboticstitans.com.br/impressao; se o
// domínio mudar, a arte precisa ser reexportada.
export function IdleScreen({ onInteract }: Props) {
  return (
    <div
      // onClick (não onPointerDown): a troca de tela no pointerdown deixaria o
      // click do mesmo toque "vazar" para o botão da barra inferior que surge
      // na mesma posição, abrindo um overlay acidentalmente.
      onClick={onInteract}
      className="flex h-full w-full items-center justify-center"
      style={{ backgroundColor: COR_FUNDO }}
    >
      <img
        src="/kiosk/idle.png"
        alt="TITANS Impressão — aponte a câmera para o QR code ou toque na tela"
        className="max-h-full max-w-full object-contain"
        draggable={false}
      />
    </div>
  );
}
