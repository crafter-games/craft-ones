// Deterministic math for the simulation. Math.sin, Math.cos, Math.exp and Math.hypot are not specified to the
// last bit, and engines differ (JavaScriptCore on macOS and on Linux disagreed and broke the golden replays), so
// two peers on different platforms would drift apart. These use only +, -, *, / and Math.sqrt, which IEEE 754
// fixes exactly, with fdlibm's kernels. Accuracy is within a couple of ulps, far below anything a player sees.

const PIO2_HI = 1.5707963267341256; // first 33 bits of pi/2
const PIO2_LO = 6.077100506506192e-11; // pi/2 - PIO2_HI
const TWO_OVER_PI = 0.6366197723675814;

// fdlibm __kernel_sin and __kernel_cos on [-pi/4, pi/4].
function kernelSin(x: number): number {
  const z = x * x;
  const v = z * x;
  const r =
    0.00833333333332249 +
    z *
      (-0.0001984126982985795 +
        z *
          (2.7557313707070068e-6 +
            z * (-2.5050760253406863e-8 + z * 1.58969099521155e-10)));
  return x + v * (-0.16666666666666632 + z * r);
}

function kernelCos(x: number): number {
  const z = x * x;
  const r =
    z *
    (0.0416666666666666 +
      z *
        (-0.001388888888887411 +
          z *
            (2.480158728947673e-5 +
              z *
                (-2.7557314351390663e-7 +
                  z * (2.087572321298175e-9 + z * -1.1359647557788195e-11)))));
  const hz = 0.5 * z;
  const w = 1 - hz;
  return w + (1 - w - hz + z * r);
}

// Cody-Waite reduction; game angles stay within a few turns, where it is exact enough.
function reduce(x: number): { r: number; q: number } {
  const k = Math.round(x * TWO_OVER_PI);
  const r = x - k * PIO2_HI - k * PIO2_LO;
  return { r, q: ((k % 4) + 4) % 4 };
}

export function dsin(x: number): number {
  const { r, q } = reduce(x);
  return q === 0
    ? kernelSin(r)
    : q === 1
      ? kernelCos(r)
      : q === 2
        ? -kernelSin(r)
        : -kernelCos(r);
}

export function dcos(x: number): number {
  const { r, q } = reduce(x);
  return q === 0
    ? kernelCos(r)
    : q === 1
      ? -kernelSin(r)
      : q === 2
        ? -kernelCos(r)
        : kernelSin(r);
}

// fdlibm exp: x = k*ln2 + r, |r| <= ln2/2, then a rational approximation of e^r.
const LN2_HI = 0.6931471803691238;
const LN2_LO = 1.9082149292705877e-10;
const INV_LN2 = Math.LOG2E;
export function dexp(x: number): number {
  if (x > 709) return Number.POSITIVE_INFINITY;
  if (x < -745) return 0;
  const k = Math.round(x * INV_LN2);
  const hi = x - k * LN2_HI;
  const lo = k * LN2_LO;
  const r = hi - lo;
  const t = r * r;
  const c =
    r -
    t *
      (0.16666666666666602 +
        t *
          (-0.0027777777777015593 +
            t *
              (6.613756321437934e-5 +
                t * (-1.6533902205465252e-6 + t * 4.1381367970572385e-8))));
  let y = 1 - (lo - (r * c) / (2 - c) - hi);
  // Scale by 2^k with exact multiplications.
  let n = k;
  while (n > 0) {
    y *= 2;
    n -= 1;
  }
  while (n < 0) {
    y *= 0.5;
    n += 1;
  }
  return y;
}

export function dhypot(x: number, y: number): number {
  return Math.sqrt(x * x + y * y);
}

// An angle wrapped to (-pi, pi], without atan2.
const TAU = 6.283185307179586;
export function wrapAngle(a: number): number {
  let w = a - TAU * Math.round(a / TAU);
  if (w <= -Math.PI) w += TAU;
  return w;
}

export function sq(x: number): number {
  return x * x;
}
