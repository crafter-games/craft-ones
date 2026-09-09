/**
 * Flat-vector twin of the WebGL hero: floating islands, a shot arcing between
 * them and its blast ring. It carries the hero until the canvas paints, and
 * stays put on machines with no WebGL, so it tracks the 3D scene's layout.
 */
type Island = {
  x: number;
  y: number;
  w: number;
  drop: number;
  delay?: number;
  shrubs?: [number, number, number][];
};

function Island({ x, y, w, drop, delay = 0, shrubs = [] }: Island) {
  const lip = w * 0.3;
  return (
    <g className="hero-float" style={{ animationDelay: `${delay}s` }}>
      {/* Rock spire: two eased flanks meeting at a tip, just off centre. */}
      <path
        className="hero-rock"
        d={`M ${x - w} ${y} Q ${x - w * 0.5} ${y + drop * 0.62} ${x + w * 0.08} ${y + drop} Q ${x + w * 0.58} ${y + drop * 0.56} ${x + w} ${y} Z`}
      />
      <ellipse
        className="hero-dirt"
        cx={x}
        cy={y + w * 0.1}
        rx={w}
        ry={lip * 0.92}
      />
      <ellipse className="hero-grass" cx={x} cy={y} rx={w * 0.97} ry={lip} />
      {shrubs.map(([sx, sy, r]) => (
        <ellipse
          key={`${sx}-${sy}`}
          className="hero-shrub"
          cx={x + sx * w}
          cy={y + sy * lip}
          rx={r * w}
          ry={r * w * 1.05}
        />
      ))}
    </g>
  );
}

export function HeroScene() {
  return (
    <svg
      className="hero-art"
      viewBox="0 0 640 440"
      role="img"
      aria-label="Floating grass islands with a shot arcing between them."
    >
      <title>Craft Ones arena</title>
      <defs>
        <radialGradient id="hero-sun" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#f0b96a" stopOpacity="0.6" />
          <stop offset="100%" stopColor="#f0b96a" stopOpacity="0" />
        </radialGradient>
      </defs>
      <circle cx="392" cy="66" r="170" fill="url(#hero-sun)" />
      <g className="hero-motes">
        {[
          [104, 118, 5],
          [560, 150, 4],
          [486, 74, 6],
          [150, 246, 4],
          [596, 292, 5],
        ].map(([x, y, r]) => (
          <circle key={`${x}-${y}`} cx={x} cy={y} r={r} />
        ))}
      </g>
      <Island x={498} y={148} w={44} drop={70} delay={-2.4} />
      <Island x={578} y={294} w={38} drop={62} delay={-1.2} />
      <Island
        x={318}
        y={244}
        w={116}
        drop={182}
        shrubs={[
          [-0.34, -0.5, 0.11],
          [0.3, -0.9, 0.09],
          [0.52, 0.16, 0.07],
        ]}
      />
      <path
        className="hero-arc"
        d="M 150 296 C 214 118 366 96 452 168"
        fill="none"
      />
      <g className="hero-impact">
        <circle cx="452" cy="168" r="12" />
        <circle cx="452" cy="168" r="12" />
      </g>
    </svg>
  );
}
