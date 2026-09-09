/**
 * Abstract isometric arena: floating slabs, a travelling shot arc and its
 * blast ring. Pure inline SVG in the game palette — no characters, no runtime.
 */
const U = [1, 0.5] as const;
const V = [-1, 0.5] as const;

type Slab = {
  x: number;
  y: number;
  w: number;
  d: number;
  h: number;
  delay?: number;
};

function points(list: number[][]) {
  return list.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
}

function Slab({ x, y, w, d, h, delay = 0 }: Slab) {
  const a = [x, y];
  const b = [x + w * U[0], y + w * U[1]];
  const c = [x + w * U[0] + d * V[0], y + w * U[1] + d * V[1]];
  const e = [x + d * V[0], y + d * V[1]];
  const drop = ([px, py]: number[]) => [px, py + h];
  return (
    <g className="hero-slab" style={{ animationDelay: `${delay}s` }}>
      <ellipse
        className="hero-shadow"
        cx={c[0]}
        cy={c[1] + h + 26}
        rx={(w + d) * 0.42}
        ry={(w + d) * 0.14}
      />
      <polygon
        className="hero-face-left"
        points={points([e, c, drop(c), drop(e)])}
      />
      <polygon
        className="hero-face-right"
        points={points([b, c, drop(c), drop(b)])}
      />
      <polygon className="hero-face-top" points={points([a, b, c, e])} />
      <polyline
        className="hero-seam"
        points={points([
          [a[0] + w * U[0] * 0.25, a[1] + w * U[1] * 0.25],
          [
            a[0] + w * U[0] * 0.25 + d * V[0],
            a[1] + w * U[1] * 0.25 + d * V[1],
          ],
        ])}
      />
    </g>
  );
}

export function HeroScene() {
  return (
    <svg
      className="hero-art"
      viewBox="0 0 640 440"
      role="img"
      aria-label="An abstract isometric arena of floating slabs with a shot arcing between them."
    >
      <title>Craft Ones arena</title>
      <defs>
        <radialGradient id="hero-glow" cx="50%" cy="40%" r="60%">
          <stop offset="0%" stopColor="#8cd5bb" stopOpacity="0.35" />
          <stop offset="100%" stopColor="#8cd5bb" stopOpacity="0" />
        </radialGradient>
      </defs>
      <circle cx="330" cy="180" r="220" fill="url(#hero-glow)" />
      <g className="hero-motes">
        {[
          [96, 96, 5],
          [548, 128, 4],
          [470, 66, 6],
          [138, 208, 4],
          [590, 262, 5],
        ].map(([x, y, r]) => (
          <circle key={`${x}-${y}`} cx={x} cy={y} r={r} />
        ))}
      </g>
      <Slab x={150} y={236} w={148} d={116} h={58} />
      <Slab x={438} y={168} w={104} d={86} h={46} delay={-2.4} />
      <Slab x={286} y={330} w={74} d={62} h={34} delay={-1.2} />
      <Slab x={92} y={150} w={46} d={40} h={22} delay={-3.1} />
      <Slab x={520} y={306} w={52} d={44} h={24} delay={-1.8} />
      <path
        className="hero-arc"
        d="M188 250 C 268 96 402 92 470 178"
        fill="none"
      />
      <g className="hero-impact">
        <circle cx="470" cy="178" r="12" />
        <circle cx="470" cy="178" r="12" />
      </g>
    </svg>
  );
}
