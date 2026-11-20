/* Icon Folder (21st.dev), vendored. Local changes: the demo icon set and the tag chips are
   dropped (callers pass their own icons); the light theme is opaque white; the front pocket has no backdrop filter (its blur spilled past the clipped folder
   shape as a square patch); the font inherits the page's; `defaultOpen` seeds state instead of
   being synced in an effect; reduced motion is read with useSyncExternalStore. Ported from
   Next to plain <img>, palette switched to the app's black/white. */

import * as React from "react";

/* ------------------------------------------------------------------ */
/*  Icon Folder — a glass folder with app icons fanned out of it.       */
/*  Pops in when it scrolls into view; hover / tap / Enter spreads the  */
/*  icons wider. The folder tab shape is drawn to the real card width. */
/* ------------------------------------------------------------------ */

export type FolderIcon = {
  /** Image URL of an app icon (square works best). */
  src?: string;
  /** Or any custom node (SVG, emoji, component). */
  node?: React.ReactNode;
  /** Tile background behind `node`. */
  background?: string;
  label?: string;
};

export type IconFolderProps = {
  title: string;
  icons: FolderIcon[];
  theme?: "dark" | "light";
  /** Start spread open (no hover needed). */
  defaultOpen?: boolean;
  /** Horizontal distance between fanned icons, px. */
  spread?: number;
  /** Small icon pill in the corner of the folder. */
  showPill?: boolean;
  className?: string;
};

const THEMES = {
  dark: {
    ink: "#ffffff",
    // Opaque blacks so the folder reads on the app's light canvas.
    back: "linear-gradient(180deg,#3b3131,#1a1111 60%)",
    backEdge: "rgba(255,255,255,.08)",
    front: "linear-gradient(160deg,#3b3131,#1a1111 55%,#201515)",
    frontEdge: [
      "rgba(255,255,255,.38)",
      "rgba(255,255,255,.1)",
      "rgba(255,255,255,0)",
    ],
    glow: "rgba(255,255,255,.10)",
    pillBg: "rgba(0,0,0,.55)",
    pillBorder: "rgba(255,255,255,.08)",
    tileRing: "rgba(255,255,255,.14)",
    tileShadow: "rgba(0,0,0,.55)",
    focus: "rgba(255,255,255,.4)",
  },
  light: {
    ink: "#201515",
    back: "linear-gradient(180deg,#ffffff,#f1f1f1)",
    backEdge: "rgba(32,21,21,.08)",
    front: "linear-gradient(160deg,#ffffff,#f6f6f6 55%,#efefef)",
    frontEdge: ["rgba(255,255,255,1)", "rgba(32,21,21,.06)", "rgba(32,21,21,.04)"],
    glow: "rgba(255,255,255,.18)",
    pillBg: "rgba(255,255,255,.8)",
    pillBorder: "rgba(0,0,0,.08)",
    tileRing: "rgba(0,0,0,.08)",
    tileShadow: "rgba(0,0,0,.18)",
    focus: "rgba(0,0,0,.35)",
  },
} as const;

/* folder outlines: front pocket has its tab on the left, back plate on the right */
const pathL = (
  w: number,
  h: number,
  r: number,
  d: number,
  tw: number,
  s: number,
) =>
  `M0 ${r}A${r} ${r} 0 0 1 ${r} 0L${tw} 0C${tw + s * 0.55} 0 ${tw + s * 0.45} ${d} ${tw + s} ${d}L${w - r} ${d}A${r} ${r} 0 0 1 ${w} ${d + r}L${w} ${h - r}A${r} ${r} 0 0 1 ${w - r} ${h}L${r} ${h}A${r} ${r} 0 0 1 0 ${h - r}Z`;
const pathR = (
  w: number,
  h: number,
  r: number,
  d: number,
  tw: number,
  s: number,
) => {
  const x = w - tw;
  return `M0 ${d + r}A${r} ${r} 0 0 1 ${r} ${d}L${x - s} ${d}C${x - s * 0.45} ${d} ${x - s * 0.55} 0 ${x} 0L${w - r} 0A${r} ${r} 0 0 1 ${w} ${r}L${w} ${h - r}A${r} ${r} 0 0 1 ${w - r} ${h}L${r} ${h}A${r} ${r} 0 0 1 0 ${h - r}Z`;
};

function useShape(
  ref: React.RefObject<HTMLDivElement | null>,
  make: (w: number, h: number) => string,
) {
  const [d, setD] = React.useState("");
  React.useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(() =>
      setD(make(el.offsetWidth, el.offsetHeight)),
    );
    ro.observe(el);
    return () => ro.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return d;
}

const subscribeMotion = (onChange: () => void) => {
  const query = window.matchMedia("(prefers-reduced-motion: reduce)");
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
};

function Tile({
  icon,
  ring,
}: {
  icon: FolderIcon;
  ring: string;
  shadow?: string;
}) {
  return (
    <div
      className="relative grid h-full w-full place-items-center overflow-hidden rounded-[inherit]"
      style={{
        background: icon.src ? undefined : (icon.background ?? "#3b3131"),
        // No shadows in this app: tiles sit flat.
        outline: `1px solid ${ring}`, outlineOffset: -1,
      }}
    >
      {icon.src ? (
        <img src={icon.src} alt="" draggable={false} className="absolute inset-0 size-full object-cover" />
      ) : (
        icon.node
      )}
    </div>
  );
}

export function IconFolder({
  title,
  icons,
  theme = "dark",
  defaultOpen = false,
  spread = 70,
  showPill = true,
  className = "",
}: IconFolderProps) {
  const t = THEMES[theme];
  const gid = React.useId().replace(/:/g, "");

  const rootRef = React.useRef<HTMLDivElement>(null);
  const frontRef = React.useRef<HTMLDivElement>(null);
  const backRef = React.useRef<HTMLDivElement>(null);
  const [shown, setShown] = React.useState(false);
  const [open, setOpen] = React.useState(defaultOpen);
  const [hover, setHover] = React.useState(false);
  const [hi, setHi] = React.useState<number | null>(null);
  const reduced = React.useSyncExternalStore(
    subscribeMotion,
    () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    () => false,
  );

  React.useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([e]) => e.isIntersecting && setShown(true),
      { threshold: 0.3 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const frontD = useShape(frontRef, (w, h) =>
    pathL(w, h, 24, 24, Math.round(w * 0.42), 46),
  );
  const backD = useShape(backRef, (w, h) =>
    pathR(w, h, 24, 24, Math.round(w * 0.4), 46),
  );

  const n = icons.length;
  const rs = n > 1 ? 25 / (n - 1) : 0; // degrees of tilt per step
  const wide = open || hover;
  const lift = wide;
  const ease = "cubic-bezier(.2,.8,.2,1)";
  const toggle = () => setOpen((o) => !o);

  return (
    <div
      ref={rootRef}
      role="button"
      tabIndex={0}
      aria-expanded={open}
      aria-label={title}
      onClick={toggle}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          toggle();
        }
      }}
      onPointerEnter={(e) => e.pointerType === "mouse" && setHover(true)}
      onPointerLeave={() => {
        setHover(false);
        setHi(null);
      }}
      className={`relative isolate h-[258px] w-full max-w-[420px] cursor-pointer select-none outline-none [-webkit-tap-highlight-color:transparent] focus-visible:rounded-3xl focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-4 ${className}`}
      style={{
        color: t.ink,
        letterSpacing: "-0.02em",
        outlineColor: t.focus,
        zIndex: lift ? 2 : undefined,
        opacity: shown || reduced ? 1 : 0,
        transform:
          shown || reduced
            ? lift
              ? "translateY(-6px) scale(1.02)"
              : "none"
            : "translateY(34px) scale(.92)",
        transition: reduced
          ? "none"
          : `transform .9s ${ease}, opacity .6s ease`,
      }}
    >
      {/* glow removed: flat design */}

      {/* back plate */}
      <div
        ref={backRef}
        className="absolute inset-x-0 bottom-0 top-[14px]"
        style={{
          background: t.back,
          clipPath: backD ? `path('${backD}')` : undefined,
        }}
      >
        <svg
          className="pointer-events-none absolute inset-0 h-full w-full overflow-visible"
          aria-hidden="true"
        >
          <path d={backD} fill="none" stroke={t.backEdge} strokeWidth="2" />
        </svg>
      </div>

      {/* fanned icons */}
      <div className="pointer-events-none absolute inset-0" aria-hidden="true">
        {icons.map((icon, i) => {
          const k = i - (n - 1) / 2;
          const gap = wide ? spread * 1.15 : spread;
          const y = k * k * 9 - (wide ? 4 : 0);
          const rot = k * rs * (wide ? 1.2 : 1);
          return (
            <div
              key={i}
              className="absolute left-1/2 top-[42px] -ml-[50.5px] h-[101px] w-[101px] rounded-[26px] [backface-visibility:hidden]"
              style={{
                zIndex: hi === i ? 5 : undefined,
                opacity: shown || reduced ? 1 : 0,
                transform:
                  shown || reduced
                    ? `translate3d(${k * gap}px, ${y}px, 0) rotate(${rot}deg)`
                    : `translate3d(${k * spread * 0.6}px, 80px, 0)`,
                transition: reduced
                  ? "none"
                  : `transform ${wide ? 0.6 : 0.9}s ${ease}, opacity .5s`,
                transitionDelay: reduced
                  ? "0s"
                  : wide
                    ? `${i * 0.04}s`
                    : `${0.35 + i * 0.08}s`,
              }}
            >
              <div
                className="pointer-events-auto relative h-full w-full rounded-[inherit]"
                onPointerEnter={(e) => e.pointerType === "mouse" && setHi(i)}
                onPointerLeave={() => setHi((h) => (h === i ? null : h))}
                style={{
                  transform:
                    hi === i
                      ? `translateY(-26px) rotate(${-rot}deg) scale(1.1)`
                      : hi !== null
                        ? "scale(.96)"
                        : "none",
                  filter:
                    hi !== null && hi !== i
                      ? "saturate(.75) brightness(.85)"
                      : "none",
                  transition: reduced
                    ? "none"
                    : `transform .45s ${ease}, filter .3s ease`,
                }}
              >
                <Tile icon={icon} ring={t.tileRing} shadow={t.tileShadow} />
                {icon.label && (
                  <span
                    className="pointer-events-none absolute bottom-full left-1/2 mb-2.5 whitespace-nowrap rounded-full border px-2.5 py-1 text-xs font-medium leading-4 backdrop-blur-[8px]"
                    style={{
                      background: t.pillBg,
                      borderColor: t.pillBorder,
                      color: t.ink,
                      opacity: hi === i ? 1 : 0,
                      transform: `translateX(-50%) translateY(${hi === i ? 0 : 6}px)`,
                      transition: reduced
                        ? "none"
                        : `opacity .25s ease, transform .35s ${ease}`,
                    }}
                  >
                    {icon.label}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* glass front pocket */}
      <div
        ref={frontRef}
        className="absolute inset-x-0 bottom-0 h-[160px] overflow-hidden"
        style={{
          background: t.front,
          clipPath: frontD ? `path('${frontD}')` : undefined,
          transform: lift ? "translateY(6px)" : "none",
          transition: reduced ? "none" : `transform .6s ${ease}`,
        }}
      >
        <svg
          className="pointer-events-none absolute inset-0 h-full w-full overflow-visible"
          aria-hidden="true"
        >
          <defs>
            <linearGradient id={`edge-${gid}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor={t.frontEdge[0]} />
              <stop offset=".35" stopColor={t.frontEdge[1]} />
              <stop offset="1" stopColor={t.frontEdge[2]} />
            </linearGradient>
          </defs>
          <path
            d={frontD}
            fill="none"
            stroke={`url(#edge-${gid})`}
            strokeWidth="2"
          />
        </svg>

        <h3 className="m-0 px-[18px] pt-[34px] text-xl font-medium leading-[26px]">
          {title}
        </h3>
        {showPill && (
          <span
            className="absolute bottom-3.5 right-3.5 flex h-[34px] items-center gap-1.5 rounded-full border px-1.5"
            style={{ background: t.pillBg, borderColor: t.pillBorder }}
            aria-hidden="true"
          >
            {icons.map((icon, i) => (
              <span
                key={i}
                className="block h-[22px] w-[22px] overflow-hidden rounded-[7px]"
              >
                <span
                  className="relative grid h-full w-full place-items-center [&_svg]:h-[60%] [&_svg]:w-[60%]"
                  style={{ background: icon.src ? undefined : icon.background }}
                >
                  {icon.src ? (
                    <img src={icon.src} alt="" className="absolute inset-0 size-full object-cover" />
                  ) : (
                    icon.node
                  )}
                </span>
              </span>
            ))}
          </span>
        )}
      </div>
    </div>
  );
}

export default IconFolder;
