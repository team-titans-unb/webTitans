import type { CSSProperties } from "react";
import { Code2, Gauge, Route } from "lucide-react";

export type PlayerCardStat = { label: string; value: number };

export type PlayerCardVariant =
  | "gold"
  | "icon"
  | "silver"
  | "teal"
  | "emerald"
  | "purple";

type PlayerCardProps = {
  name: string;
  photo: string;
  /** Nota geral, canto superior esquerdo. */
  rating: number;
  /** Sigla da "posição" (ex.: DEV). */
  position: string;
  /** 6 atributos exibidos na base da carta. */
  stats: PlayerCardStat[];
  /** Texto do "clube". */
  club?: string;
  /** Brasão do clube (caminho público). */
  clubLogo?: string;
  /** Imagem discreta atrás da foto principal (ex.: render do projeto). */
  backdrop?: string;
  /** Moldura decorada, mais chamativa (carta destaque). */
  ornate?: boolean;
  /** "figure" = recorte que preenche a carta; "framed" = foto comum numa janela. */
  photoFit?: "figure" | "framed";
  /** Paleta da carta: "gold" (azul/dourado) ou "icon" (pérola amarelo queimado). */
  variant?: PlayerCardVariant;
};

// Moldura em escudo, no estilo das cartas do EA FC.
const SHIELD = "polygon(4% 0%, 96% 0%, 100% 3%, 100% 86%, 50% 100%, 0% 86%, 0% 3%)";

type CardEffect = {
  src: string;
  blend: CSSProperties["mixBlendMode"];
  opacity: number;
};

type Theme = {
  frame: string;
  inner: string;
  sunburst: string;
  glow: string;
  sheen: string;
  ink: string;
  inkSoft: string;
  inkStrong: string;
  hair: string;
  textShadow: string;
  /** Efeito animado de fundo (webp). null = sem efeito. */
  effect: CardEffect | null;
  ornStops: [string, string, string, string, string];
  crestDot: string;
  glowShadow: string;
};

const RAIO: CardEffect = { src: "/raio-fundo.webp", blend: "lighten", opacity: 0.8 };

const THEMES: Record<PlayerCardVariant, Theme> = {
  gold: {
    frame:
      "linear-gradient(150deg, #a9781a 0%, #f4d58d 20%, #fff6d6 36%, #d4af37 54%, #f4d58d 72%, #9a6c14 100%)",
    inner: `
      radial-gradient(135% 100% at 50% -6%, rgba(96,160,224,0.5), transparent 55%),
      radial-gradient(95% 65% at 50% 108%, rgba(3,8,17,0.6), transparent 62%),
      linear-gradient(165deg, #0a1a30 0%, #123a63 46%, #0a1526 100%)
    `,
    sunburst: "rgba(214,230,255,0.11)",
    glow: "radial-gradient(circle, rgba(125,180,245,0.4), rgba(70,120,195,0.12) 45%, transparent 72%)",
    sheen: "rgba(255,255,255,0.05)",
    ink: "#f8e8bd",
    inkSoft: "#c9d6e3",
    inkStrong: "#ffffff",
    hair: "#f4d58d",
    textShadow: "0 1px 3px rgba(0,0,0,0.6)",
    effect: RAIO,
    ornStops: ["#8a6416", "#f4d58d", "#fff6d6", "#d4af37", "#8a6416"],
    crestDot: "#0b1a2e",
    glowShadow: "rgba(244,213,141,0.35)",
  },
  icon: {
    frame:
      "linear-gradient(150deg, #9c7735 0%, #e9d09a 18%, #fbf1cf 38%, #dcbb72 55%, #eddca6 74%, #8f6a2c 100%)",
    inner: `
      radial-gradient(130% 95% at 50% -8%, rgba(255,247,220,0.95), transparent 52%),
      radial-gradient(95% 70% at 50% 114%, rgba(120,82,30,0.35), transparent 58%),
      linear-gradient(165deg, #f6e9c2 0%, #e4c884 44%, #c7a24a 100%)
    `,
    sunburst: "rgba(150,104,40,0.17)",
    glow: "radial-gradient(circle, rgba(255,243,205,0.6), rgba(214,176,108,0.22) 45%, transparent 72%)",
    sheen: "rgba(255,255,255,0.16)",
    ink: "#4a3510",
    inkSoft: "#6f5726",
    inkStrong: "#2b1e06",
    hair: "#8a6a2e",
    textShadow: "0 1px 2px rgba(255,248,224,0.6)",
    effect: { src: "/raio-fundo.webp", blend: "multiply", opacity: 0.3 },
    ornStops: ["#7a5c22", "#c9a24a", "#f3e2b0", "#b8912f", "#7a5c22"],
    crestDot: "#f6e9c2",
    glowShadow: "rgba(232,206,146,0.5)",
  },
  silver: {
    frame:
      "linear-gradient(150deg, #63696f 0%, #cbd0d6 18%, #f4f6f8 38%, #9aa1a9 55%, #dbe0e4 74%, #5b6067 100%)",
    inner: `
      radial-gradient(130% 90% at 50% -10%, rgba(255,255,255,0.5), transparent 55%),
      radial-gradient(90% 60% at 50% 112%, rgba(40,46,54,0.4), transparent 60%),
      linear-gradient(165deg, #9aa0a8 0%, #c3c8ce 46%, #7c828b 100%)
    `,
    sunburst: "rgba(255,255,255,0.09)",
    glow: "radial-gradient(circle, rgba(255,255,255,0.22), rgba(190,198,208,0.1) 45%, transparent 70%)",
    sheen: "rgba(255,255,255,0.2)",
    ink: "#2a2f37",
    inkSoft: "#57606b",
    inkStrong: "#14181e",
    hair: "#8a929c",
    textShadow: "0 1px 2px rgba(255,255,255,0.55)",
    effect: null,
    ornStops: ["#5b6067", "#cbd0d6", "#f4f6f8", "#9aa1a9", "#5b6067"],
    crestDot: "#7c828b",
    glowShadow: "rgba(210,214,220,0.3)",
  },
  teal: {
    frame:
      "linear-gradient(150deg, #0c4a4a 0%, #1f9e94 18%, #7bede0 38%, #148f83 55%, #46c9bd 72%, #0a3f3f 100%)",
    inner: `
      radial-gradient(130% 95% at 50% -8%, rgba(120,235,225,0.36), transparent 55%),
      radial-gradient(90% 60% at 50% 112%, rgba(2,20,20,0.5), transparent 60%),
      linear-gradient(160deg, #0d4747 0%, #14666a 42%, #0c3d40 70%, #072a2d 100%)
    `,
    sunburst: "rgba(160,245,240,0.1)",
    glow: "radial-gradient(circle, rgba(120,230,220,0.28), rgba(30,140,135,0.12) 45%, transparent 70%)",
    sheen: "rgba(220,255,252,0.1)",
    ink: "#dff5f2",
    inkSoft: "#8fc7c2",
    inkStrong: "#f2fffe",
    hair: "#5fd7cd",
    textShadow: "0 1px 3px rgba(0,18,18,0.55)",
    effect: null,
    ornStops: ["#0c4a4a", "#46c9bd", "#c9f6f1", "#1f9e94", "#0c4a4a"],
    crestDot: "#072a2d",
    glowShadow: "rgba(95,215,205,0.35)",
  },
  emerald: {
    frame:
      "linear-gradient(150deg, #0a3b2d 0%, #1f8f6b 18%, #7bebc4 38%, #128a63 55%, #45c79c 72%, #093428 100%)",
    inner: `
      radial-gradient(130% 95% at 50% -8%, rgba(120,235,195,0.38), transparent 55%),
      radial-gradient(90% 60% at 50% 112%, rgba(2,20,14,0.5), transparent 60%),
      linear-gradient(160deg, #0d4234 0%, #14664c 42%, #0c3a2c 70%, #072a20 100%)
    `,
    sunburst: "rgba(160,245,210,0.1)",
    glow: "radial-gradient(circle, rgba(120,235,195,0.28), rgba(30,140,105,0.12) 45%, transparent 70%)",
    sheen: "rgba(220,255,240,0.1)",
    ink: "#e2f7ef",
    inkSoft: "#93c9b6",
    inkStrong: "#f3fffb",
    hair: "#5fd7ad",
    textShadow: "0 1px 3px rgba(0,20,12,0.55)",
    effect: { src: "/esmeralda.gif", blend: "screen", opacity: 0.4 },
    ornStops: ["#0a3b2d", "#45c79c", "#c9f6e6", "#1f8f6b", "#0a3b2d"],
    crestDot: "#072a20",
    glowShadow: "rgba(95,215,173,0.35)",
  },
  purple: {
    frame:
      "linear-gradient(150deg, #33115a 0%, #7b3fb8 18%, #cfa4f2 38%, #6a2fa8 55%, #a06ad9 72%, #290d45 100%)",
    inner: `
      radial-gradient(130% 95% at 50% -8%, rgba(196,148,244,0.42), transparent 55%),
      radial-gradient(90% 60% at 50% 112%, rgba(14,4,26,0.5), transparent 60%),
      linear-gradient(160deg, #2b0f47 0%, #4a1d7a 42%, #23093d 70%, #180530 100%)
    `,
    sunburst: "rgba(210,170,250,0.1)",
    glow: "radial-gradient(circle, rgba(200,150,245,0.3), rgba(110,50,170,0.12) 45%, transparent 70%)",
    sheen: "rgba(240,225,255,0.1)",
    ink: "#f1e4ff",
    inkSoft: "#c4a6e6",
    inkStrong: "#fbf5ff",
    hair: "#bd85f0",
    textShadow: "0 1px 3px rgba(10,2,20,0.55)",
    effect: { src: "/psicodelico.webp", blend: "screen", opacity: 0.42 },
    ornStops: ["#33115a", "#a06ad9", "#e6ccff", "#7b3fb8", "#33115a"],
    crestDot: "#180530",
    glowShadow: "rgba(170,110,230,0.4)",
  },
};

function BrazilFlag() {
  return (
    <svg viewBox="0 0 28 20" className="h-3.5 w-5 rounded-[2px]" aria-hidden>
      <rect width="28" height="20" fill="#009c3b" />
      <path d="M14 2 25 10 14 18 3 10Z" fill="#ffdf00" />
      <circle cx="14" cy="10" r="4" fill="#002776" />
    </svg>
  );
}

/** Ornamentos simétricos sobre a moldura (carta destaque). */
function OrnateFrame({ id, stops, dot }: { id: string; stops: Theme["ornStops"]; dot: string }) {
  const g = `url(#${id})`;
  // Um canto (superior esquerdo). O lado direito é o espelho deste grupo.
  const corner = (
    <g fill="none" stroke={g} strokeLinecap="round">
      <path d="M8 52 V20 Q8 8 20 8 H52" strokeWidth="2.4" />
      <path d="M13 58 V24 Q13 14 23 14 H58" strokeWidth="1.1" opacity="0.55" />
      <path d="M26 8 l7 -7 M8 26 l-7 7" strokeWidth="2" />
      <circle cx="20" cy="20" r="3" fill={g} stroke="none" />
      <path d="M40 9 q6 3 6 9 M9 40 q3 6 9 6" strokeWidth="1.4" opacity="0.8" />
    </g>
  );

  return (
    <svg
      viewBox="0 0 280 446"
      className="pointer-events-none absolute inset-0 z-[2] h-full w-full"
      aria-hidden
      preserveAspectRatio="none"
    >
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={stops[0]} />
          <stop offset="0.35" stopColor={stops[1]} />
          <stop offset="0.55" stopColor={stops[2]} />
          <stop offset="0.8" stopColor={stops[3]} />
          <stop offset="1" stopColor={stops[4]} />
        </linearGradient>
      </defs>

      {/* Fio interno duplo, acompanhando o escudo */}
      <polygon
        points="20,7 260,7 272,19 272,376 140,434 8,376 8,19"
        fill="none"
        stroke={g}
        strokeWidth="1.4"
        opacity="0.85"
      />
      <polygon
        points="25,12 255,12 267,23 267,372 140,427 13,372 13,23"
        fill="none"
        stroke={g}
        strokeWidth="0.7"
        opacity="0.4"
      />

      {/* Cantos superiores (simétricos) */}
      {corner}
      <g transform="translate(280,0) scale(-1,1)">{corner}</g>

      {/* Crista no topo-centro */}
      <g transform="translate(140,4)">
        <path d="M0 1 L8 10 L0 19 L-8 10 Z" fill={g} />
        <path d="M-8 10 h-16 M8 10 h16" stroke={g} strokeWidth="2.4" strokeLinecap="round" />
        <circle cx="0" cy="10" r="2.4" fill={dot} />
      </g>

      {/* Studs simétricos na borda superior */}
      {[46, 70, 94].flatMap((x) => [x, 280 - x]).map((x) => (
        <path key={x} d={`M${x - 3} 3 L${x + 3} 3 L${x} 9 Z`} fill={g} opacity="0.9" />
      ))}

      {/* Ombros do escudo (onde afunila) — acentos simétricos */}
      <path
        d="M6 356 q10 10 10 22 M274 356 q-10 10 -10 22"
        fill="none"
        stroke={g}
        strokeWidth="2"
        strokeLinecap="round"
      />

      {/* Bico inferior */}
      <g transform="translate(140,430)">
        <path d="M0 0 L6 -7 L0 -14 L-6 -7 Z" fill={g} />
        <path d="M-6 -7 l-12 -5 M6 -7 l12 -5" stroke={g} strokeWidth="1.6" strokeLinecap="round" />
      </g>
    </svg>
  );
}

export function PlayerCard({
  name,
  photo,
  rating,
  position,
  stats,
  club = "TITANS",
  clubLogo = "/favicon.ico",
  backdrop,
  ornate = false,
  photoFit = "figure",
  variant = "gold",
}: PlayerCardProps) {
  const t = THEMES[variant];

  return (
    <div
      className="relative mx-auto h-[446px] w-[280px] max-w-full select-none"
      style={ornate ? { filter: `drop-shadow(0 0 22px ${t.glowShadow})` } : undefined}
    >
      {/* Moldura */}
      <div className="absolute inset-0" style={{ clipPath: SHIELD, background: t.frame }} />

      {/* Tudo dentro do escudo */}
      <div
        className="absolute inset-[9px] isolate overflow-hidden"
        style={{ clipPath: SHIELD, background: t.inner }}
      >
        {/* Sunburst discreto */}
        <div
          className="pointer-events-none absolute left-1/2 top-[24%] h-[420px] w-[420px] -translate-x-1/2 -translate-y-1/2 opacity-[0.45]"
          style={{
            background: `repeating-conic-gradient(from 0deg, ${t.sunburst} 0deg 1.1deg, transparent 1.1deg 9deg)`,
            WebkitMaskImage:
              "radial-gradient(closest-side, #000 4%, rgba(0,0,0,0.32) 46%, transparent 80%)",
            maskImage:
              "radial-gradient(closest-side, #000 4%, rgba(0,0,0,0.32) 46%, transparent 80%)",
          }}
        />
        {/* Brilho central */}
        <div
          className="pointer-events-none absolute left-1/2 top-[40%] h-[360px] w-[360px] -translate-x-1/2 -translate-y-1/2 rounded-full"
          style={{ background: t.glow }}
        />
        {/* Reflexo diagonal */}
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background: `linear-gradient(115deg, transparent 42%, ${t.sheen} 50%, transparent 58%)`,
          }}
        />

        {/* Render do projeto no canto superior direito */}
        {backdrop ? (
          <img
            src={backdrop}
            alt=""
            aria-hidden
            loading="lazy"
            className="pointer-events-none absolute -right-[55%] -top-[8%] w-[190%] max-w-none opacity-90"
            style={{
              WebkitMaskImage:
                "radial-gradient(125% 125% at 100% 0%, #000 52%, transparent 100%)",
              maskImage:
                "radial-gradient(125% 125% at 100% 0%, #000 52%, transparent 100%)",
            }}
          />
        ) : null}

        {/* Efeito animado de fundo (contido na moldura) */}
        {t.effect ? (
          <img
            src={t.effect.src}
            alt=""
            aria-hidden
            loading="lazy"
            className="pointer-events-none absolute inset-0 h-full w-full object-cover"
            style={{
              opacity: t.effect.opacity,
              mixBlendMode: t.effect.blend,
              WebkitMaskImage:
                "radial-gradient(118% 114% at 50% 44%, #000 70%, transparent 100%)",
              maskImage:
                "radial-gradient(118% 114% at 50% 44%, #000 70%, transparent 100%)",
            }}
          />
        ) : null}

        {/* Foto do jogador — primeiro plano */}
        {photoFit === "framed" ? (
          <div
            className="pointer-events-none absolute left-1/2 top-[6%] z-[1] h-[46%] w-[74%] -translate-x-1/2 overflow-hidden rounded-xl"
            style={{
              boxShadow: `0 8px 22px -6px rgba(0,0,0,0.7), inset 0 0 0 1.5px ${t.hair}8c`,
            }}
          >
            <img
              src={photo}
              alt={`Foto de ${name}`}
              className="h-full w-full object-cover object-center"
            />
          </div>
        ) : (
          <div className="pointer-events-none absolute left-1/2 top-[3%] z-[1] h-[65%] w-[94%] -translate-x-1/2">
            <img
              src={photo}
              alt={`Foto de ${name}`}
              className="h-full w-full object-cover object-top [filter:drop-shadow(0_6px_14px_rgba(0,0,0,0.45))]"
              style={{
                WebkitMaskImage: "linear-gradient(to top, transparent 4%, #000 40%)",
                maskImage: "linear-gradient(to top, transparent 4%, #000 40%)",
              }}
            />
          </div>
        )}
      </div>

      {/* Ornamentos da moldura */}
      {ornate ? (
        <OrnateFrame id={`pc-orn-${variant}`} stops={t.ornStops} dot={t.crestDot} />
      ) : null}

      {/* Conteúdo — altura fixa dentro da área reta do escudo */}
      <div className="absolute inset-x-0 top-0 flex h-[352px] flex-col overflow-hidden px-5 pt-4">
        {/* Nota + posição + ícones */}
        <div className="w-[86px]">
          <div
            className="text-[40px] font-extrabold leading-none"
            style={{ color: t.ink, textShadow: t.textShadow }}
          >
            {rating}
          </div>
          <div
            className="text-lg font-bold leading-tight tracking-wide"
            style={{ color: t.ink }}
          >
            {position}
          </div>
          <div className="my-1.5 h-px w-9" style={{ background: `${t.hair}80` }} />
          <div className="flex gap-2" style={{ color: t.hair }}>
            <Code2 className="h-4 w-4" />
            <Route className="h-4 w-4" />
            <Gauge className="h-4 w-4" />
          </div>
        </div>

        <div className="flex-1" />

        {/* Nome */}
        <div className="border-t pt-1.5 text-center" style={{ borderColor: `${t.hair}66` }}>
          <p
            className="truncate text-[16px] font-extrabold uppercase tracking-wide"
            style={{ color: t.ink }}
          >
            {name}
          </p>
        </div>

        {/* Atributos */}
        <div className="mt-1.5 grid grid-cols-6 gap-x-0.5 text-center">
          {stats.map((s) => (
            <span
              key={s.label}
              className="text-[9px] font-semibold uppercase tracking-wide"
              style={{ color: t.inkSoft }}
            >
              {s.label}
            </span>
          ))}
          {stats.map((s) => (
            <span
              key={`${s.label}-v`}
              className="text-[13px] font-extrabold"
              style={{ color: t.inkStrong }}
            >
              {s.value}
            </span>
          ))}
        </div>

        {/* Bandeira · clube · brasão */}
        <div
          className="mt-2 flex items-center justify-center gap-2.5 border-t pt-1.5"
          style={{ borderColor: `${t.hair}4d` }}
        >
          <BrazilFlag />
          <span
            className="text-[11px] font-bold tracking-[0.18em]"
            style={{ color: t.ink }}
          >
            {club}
          </span>
          {clubLogo ? (
            <img src={clubLogo} alt="" aria-hidden className="h-4 w-4 object-contain" />
          ) : null}
        </div>
      </div>
    </div>
  );
}
