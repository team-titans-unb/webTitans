import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Fila de impressão | TITANS",
};

// Layout próprio do totem (Sala 208): tela cheia, fundo escuro, sem Header/Footer,
// otimizado para toque (sem gesto de zoom/scroll horizontal). O cursor fica
// visível: o totem atual é um computador operado com mouse.
export default function KioskLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div
      className="dark fixed inset-0 overflow-hidden overscroll-none bg-zinc-950 text-white select-none"
      style={{ touchAction: "manipulation" }}
    >
      {/* Keyframes usados só no kiosk (evita tocar no tailwind.config global). */}
      <style>{`
        @keyframes kiosk-gradient {
          0%, 100% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
        }
        @keyframes kiosk-float {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-10px); }
        }
      `}</style>
      {children}
    </div>
  );
}
