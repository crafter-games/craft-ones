"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";

/** Lobby palette, lifted from globals.css so the scene and the UI agree. */
const GRASS = "#b6d466";
const GRASS_DEEP = "#8fb64c";
const GRASS_LIT = "#d2fb78";
const DIRT = "#a2694a";
const ROCK = "#8b6149";
const ROCK_DEEP = "#5d4437";
const SHRUB = "#5f9a55";
const STONE = "#8d8272";
const GOLD = "#f3c677";
const MINT = "#8cd5bb";

const TAU = Math.PI * 2;

/**
 * Deterministic ridge noise. Three sines at incommensurable frequencies read as
 * organic at this scale and, unlike a hash grid, they cost nothing to seed.
 */
function ridges(a: number, b: number, seed: number): number {
  return (
    Math.sin(a * 2.7 + seed * 1.3) * 0.52 +
    Math.sin(a * 5.1 - b * 1.9 + seed * 2.7) * 0.29 +
    Math.sin(b * 3.3 + a * 0.8 - seed * 1.9) * 0.19
  );
}

/** Silhouette of the rock below the rim: y and radius, both in island radii. */
const PROFILE: [number, number][] = [
  [0.0, 1.0],
  [-0.11, 1.07], // The overhang lip is what makes a lump read as an island.
  [-0.31, 0.92],
  [-0.6, 0.71],
  [-0.96, 0.5],
  [-1.4, 0.31],
  [-1.92, 0.14],
  [-2.45, 0.0],
];
/** Grass plateau, from the rim inwards. */
const CAP = [1.0, 0.78, 0.5, 0.24];
const RADIAL = 17; // Odd, so no two silhouette facets mirror each other.

type Mesh = { position: number[]; color: number[] };

/** Appends one triangle, dimming it slightly per face so facets stay legible. */
function tri(
  mesh: Mesh,
  a: THREE.Vector3,
  b: THREE.Vector3,
  c: THREE.Vector3,
  color: THREE.Color,
  shade: number,
) {
  mesh.position.push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z);
  for (let i = 0; i < 3; i++)
    mesh.color.push(color.r * shade, color.g * shade, color.b * shade);
}

/** Bakes an existing geometry (a shrub, a boulder) into the island mesh. */
function stamp(
  mesh: Mesh,
  geometry: THREE.BufferGeometry,
  matrix: THREE.Matrix4,
  color: THREE.Color,
  seed: number,
) {
  const flat = geometry.toNonIndexed();
  flat.applyMatrix4(matrix);
  const points = flat.getAttribute("position");
  for (let i = 0; i < points.count; i += 3) {
    const shade = 0.86 + 0.28 * Math.abs(ridges(i * 0.7, seed, seed));
    for (let v = 0; v < 3; v++) {
      mesh.position.push(
        points.getX(i + v),
        points.getY(i + v),
        points.getZ(i + v),
      );
      mesh.color.push(color.r * shade, color.g * shade, color.b * shade);
    }
  }
  flat.dispose();
}

const scratch = {
  grass: new THREE.Color(),
  rock: new THREE.Color(),
  top: new THREE.Color(GRASS),
  lit: new THREE.Color(GRASS_LIT),
  deep: new THREE.Color(GRASS_DEEP),
  dirt: new THREE.Color(DIRT),
  stone: new THREE.Color(ROCK),
  abyss: new THREE.Color(ROCK_DEEP),
  shrub: new THREE.Color(SHRUB),
  boulder: new THREE.Color(STONE),
};

/**
 * One floating island: a domed grass plateau over a chiselled rock spire, with
 * a scatter of shrubs and boulders on top. Everything lands in a single
 * flat-shaded, vertex-coloured buffer, so an island is one draw call.
 */
function island(
  radius: number,
  seed: number,
  props: boolean,
): THREE.BufferGeometry {
  const mesh: Mesh = { position: [], color: [] };
  // Silhouette wobble, shared by the rim and the plateau so they stay welded.
  const wobble = (j: number) =>
    1 + 0.13 * ridges((j / RADIAL) * TAU * 1.7, seed, seed);
  const capHeight = (rr: number, j: number) =>
    radius *
    (0.03 +
      0.17 * (1 - rr ** 1.8) +
      0.03 * ridges((j / RADIAL) * TAU * 2.3, rr * 5, seed + 4));

  const at = (ring: number, j: number, r: number, y: number) => {
    const angle = (j % RADIAL) * (TAU / RADIAL);
    const spread = radius * r * wobble(j % RADIAL);
    return new THREE.Vector3(
      Math.cos(angle) * spread,
      radius * y + radius * 0.05 * ridges(ring * 1.9, j * 0.6, seed + 2) * r,
      Math.sin(angle) * spread,
    );
  };

  // Rock: quad strips down the profile, browner and darker towards the tip.
  for (let ring = 0; ring < PROFILE.length - 1; ring++) {
    const [yUp, rUp] = PROFILE[ring];
    const [yLow, rLow] = PROFILE[ring + 1];
    const depth = Math.min(1, -((yUp + yLow) / 2) / 1.5);
    scratch.rock
      .copy(ring === 0 ? scratch.dirt : scratch.stone)
      .lerp(scratch.abyss, depth * 0.85);
    for (let j = 0; j < RADIAL; j++) {
      const a = at(ring, j, rUp, yUp);
      const b = at(ring, j + 1, rUp, yUp);
      const c = at(ring + 1, j + 1, rLow, yLow);
      const d = at(ring + 1, j, rLow, yLow);
      const shade =
        0.82 + 0.3 * Math.abs(ridges(j * 1.4, ring * 2.1, seed + 7));
      tri(mesh, a, c, d, scratch.rock, shade);
      tri(mesh, a, b, c, scratch.rock, shade);
    }
  }

  // Grass: rings closing in on a domed centre.
  const cap = (k: number, j: number) => {
    const rr = CAP[k];
    const angle = (j % RADIAL) * (TAU / RADIAL);
    const spread = radius * rr * wobble(j % RADIAL);
    return new THREE.Vector3(
      Math.cos(angle) * spread,
      capHeight(rr, j % RADIAL),
      Math.sin(angle) * spread,
    );
  };
  for (let k = 0; k < CAP.length - 1; k++) {
    for (let j = 0; j < RADIAL; j++) {
      const a = cap(k, j);
      const b = cap(k, j + 1);
      const c = cap(k + 1, j + 1);
      const d = cap(k + 1, j);
      // Patches of lighter and deeper green break up an otherwise flat field.
      const patch = ridges(j * 1.1, k * 2.6, seed + 11);
      scratch.grass
        .copy(scratch.top)
        .lerp(patch > 0 ? scratch.lit : scratch.deep, Math.abs(patch) * 0.5);
      const shade = 0.9 + 0.16 * Math.abs(ridges(k * 1.7, j * 0.9, seed + 3));
      tri(mesh, a, c, b, scratch.grass, shade);
      tri(mesh, a, d, c, scratch.grass, shade);
    }
  }
  const centre = new THREE.Vector3(0, capHeight(0, 0), 0);
  for (let j = 0; j < RADIAL; j++) {
    const a = cap(CAP.length - 1, j);
    const b = cap(CAP.length - 1, j + 1);
    const patch = ridges(j * 1.1, 9.4, seed + 11);
    scratch.grass
      .copy(scratch.top)
      .lerp(patch > 0 ? scratch.lit : scratch.deep, Math.abs(patch) * 0.5);
    tri(mesh, centre, b, a, scratch.grass, 0.95);
  }

  // Shrubs and boulders: the difference between an island and a green lump.
  if (props) {
    const blob = new THREE.IcosahedronGeometry(1, 0);
    const rock = new THREE.DodecahedronGeometry(1, 0);
    const matrix = new THREE.Matrix4();
    const place = (
      geometry: THREE.BufferGeometry,
      color: THREE.Color,
      rr: number,
      turn: number,
      size: number,
      squash: number,
    ) => {
      const angle = turn * TAU;
      const spread = radius * rr;
      matrix.compose(
        new THREE.Vector3(
          Math.cos(angle) * spread,
          capHeight(rr, (turn * RADIAL) | 0) + radius * size * squash * 0.55,
          Math.sin(angle) * spread,
        ),
        new THREE.Quaternion().setFromEuler(
          new THREE.Euler(turn * 2.1, turn * 5.7, turn * 1.3),
        ),
        new THREE.Vector3(radius * size, radius * size * squash, radius * size),
      );
      stamp(mesh, geometry, matrix, color, seed + turn * 10);
    };
    place(blob, scratch.shrub, 0.52, 0.08, 0.15, 1.15);
    place(blob, scratch.shrub, 0.44, 0.14, 0.1, 1.0);
    place(blob, scratch.shrub, 0.63, 0.61, 0.12, 1.25);
    place(blob, scratch.shrub, 0.28, 0.78, 0.09, 1.05);
    place(rock, scratch.boulder, 0.66, 0.32, 0.1, 0.8);
    place(rock, scratch.boulder, 0.36, 0.44, 0.06, 0.75);
    blob.dispose();
    rock.dispose();
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(mesh.position, 3),
  );
  geometry.setAttribute(
    "color",
    new THREE.Float32BufferAttribute(mesh.color, 3),
  );
  geometry.computeVertexNormals();
  return geometry;
}

const SKY_FRAGMENT = /* glsl */ `
  precision highp float;
  varying vec2 vUv;
  uniform vec2 uSun;
  uniform float uAspect;
  uniform float uTime;
  uniform vec3 uHigh;
  uniform vec3 uLow;
  uniform vec3 uWarm;
  void main() {
    vec3 color = mix(uLow, uHigh, pow(clamp(vUv.y, 0.0, 1.0), 0.72));
    vec2 p = (vUv - uSun) * vec2(uAspect, 1.0);
    float d = length(p);
    // Two falloffs: a wide haze that lifts the whole sky, and a tight core.
    color += uWarm * (exp(-d * 4.2) * 0.26 + exp(-d * 13.0) * 0.30);
    color *= 1.0 - 0.42 * smoothstep(0.30, 1.10, length(vUv - 0.5) * 1.7);
    // Ordered dither: a smooth dark gradient bands badly on 8-bit displays.
    float grain = fract(sin(dot(gl_FragCoord.xy + uTime, vec2(12.9898, 78.233))) * 43758.5453);
    gl_FragColor = vec4(color + (grain - 0.5) / 220.0, 1.0);
    #include <colorspace_fragment>
  }
`;

const TRAIL_VERTEX = /* glsl */ `
  attribute vec3 aCenter;
  varying vec2 vUv;
  uniform float uHead;
  void main() {
    vUv = uv;
    float behind = uHead - uv.x;
    // Behind the shot the tube swells into a comet; ahead it collapses to the
    // thin line an artillery game draws when you are still aiming.
    float taper = behind >= 0.0 ? smoothstep(0.34, 0.0, behind) : 0.16;
    vec3 shaped = mix(aCenter, position, clamp(taper, 0.16, 1.0));
    gl_Position = projectionMatrix * modelViewMatrix * vec4(shaped, 1.0);
  }
`;

const TRAIL_FRAGMENT = /* glsl */ `
  precision highp float;
  varying vec2 vUv;
  uniform float uHead;
  uniform vec3 uHot;
  uniform vec3 uCool;
  void main() {
    float behind = uHead - vUv.x;
    vec3 tint;
    float alpha;
    if (behind >= 0.0) {
      if (behind > 0.34) discard;
      float fade = smoothstep(0.34, 0.0, behind);
      tint = mix(uCool, uHot, fade);
      alpha = fade * 0.85;
    } else {
      // The unflown half of the arc: a dashed aim line, barely there.
      if (fract(vUv.x * 46.0) > 0.42) discard;
      tint = uCool;
      alpha = 0.24;
    }
    gl_FragColor = vec4(tint, alpha);
    #include <colorspace_fragment>
  }
`;

const GLOW_FRAGMENT = /* glsl */ `
  precision highp float;
  varying vec2 vUv;
  uniform vec3 uColor;
  void main() {
    float d = length(vUv - 0.5) * 2.0;
    if (d > 1.0) discard;
    float glow = pow(1.0 - d, 2.6);
    gl_FragColor = vec4(uColor, glow * 0.75);
    #include <colorspace_fragment>
  }
`;

const MOTE_VERTEX = /* glsl */ `
  attribute float aSeed;
  varying float vSeed;
  uniform float uTime;
  uniform float uHeight;
  void main() {
    vSeed = aSeed;
    vec3 drift = position;
    // Each mote rises on its own clock and wraps, so the field never restarts.
    drift.y = mod(position.y + uTime * (1.4 + aSeed * 2.2), uHeight) - uHeight * 0.5;
    drift.x += sin(uTime * 0.4 + aSeed * 12.0) * 2.2;
    vec4 view = modelViewMatrix * vec4(drift, 1.0);
    gl_PointSize = (2.0 + aSeed * 4.0) * (34.0 / -view.z);
    gl_Position = projectionMatrix * view;
  }
`;

const MOTE_FRAGMENT = /* glsl */ `
  precision highp float;
  varying float vSeed;
  uniform vec3 uMint;
  uniform vec3 uGold;
  void main() {
    float d = length(gl_PointCoord - 0.5);
    if (d > 0.5) discard;
    float glow = smoothstep(0.5, 0.0, d);
    gl_FragColor = vec4(mix(uMint, uGold, step(0.62, vSeed)), glow * glow * 0.7);
    #include <colorspace_fragment>
  }
`;

export default function HeroCanvas() {
  const host = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const mount = host.current;
    if (!mount) return;
    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        antialias: true,
        alpha: false,
        powerPreference: "low-power",
      });
    } catch {
      return; // No WebGL: the SVG poster underneath stays on screen.
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    mount.append(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(34, 1, 1, 600);
    const clock = new THREE.Clock();
    const disposables: { dispose(): void }[] = [];
    const track = <T extends { dispose(): void }>(item: T) => {
      disposables.push(item);
      return item;
    };

    const sky = new THREE.Mesh(
      track(new THREE.PlaneGeometry(2, 2)),
      track(
        new THREE.ShaderMaterial({
          vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 1.0, 1.0); }`,
          fragmentShader: SKY_FRAGMENT,
          depthWrite: false,
          depthTest: false,
          uniforms: {
            uTime: { value: 0 },
            uSun: { value: new THREE.Vector2(0.64, 0.88) },
            uAspect: { value: 1 },
            uHigh: { value: new THREE.Color("#14302c") },
            uLow: { value: new THREE.Color("#4d8375") },
            uWarm: { value: new THREE.Color("#f0b96a") },
          },
        }),
      ),
    );
    sky.frustumCulled = false;
    sky.renderOrder = -1;
    scene.add(sky);

    // Four toon bands: cartoon enough to match the game art, wide enough that
    // the shadowed side of the spire keeps its colour.
    const ramp = track(
      new THREE.DataTexture(
        new Uint8Array([84, 142, 200, 255]),
        4,
        1,
        THREE.RedFormat,
      ),
    );
    ramp.minFilter = THREE.NearestFilter;
    ramp.magFilter = THREE.NearestFilter;
    ramp.needsUpdate = true;
    // Every island is built non-indexed, so computeVertexNormals already gives
    // per-face normals: the facets are flat without asking for flatShading.
    const shell = track(
      new THREE.MeshToonMaterial({ vertexColors: true, gradientMap: ramp }),
    );

    const world = new THREE.Group();
    scene.add(world);

    const home = new THREE.Mesh(track(island(10, 1.7, true)), shell);
    home.castShadow = true;
    home.receiveShadow = true;
    world.add(home);

    // Satellites drift on their own orbits: the arena is an archipelago, and a
    // rotating group reads as depth far better than a static scatter.
    const orbits: { pivot: THREE.Group; speed: number; bob: number }[] = [];
    const satellites: [number, number, number, number, number, number][] = [
      [4.4, 22, 9, 0.6, 0.05, 3.1],
      [3.2, 28, -7, 2.5, -0.034, 5.7],
      [2.8, 18, 15, 4.3, 0.066, 11.9],
    ];
    for (const [size, reach, lift, phase, speed, seed] of satellites) {
      const pivot = new THREE.Group();
      pivot.rotation.y = phase;
      const rock = new THREE.Mesh(track(island(size, seed, true)), shell);
      rock.position.set(reach, lift, 0);
      rock.rotation.z = Math.sin(seed) * 0.14;
      rock.castShadow = true;
      rock.receiveShadow = true;
      pivot.add(rock);
      world.add(pivot);
      orbits.push({ pivot, speed, bob: seed });
    }

    // The shot: launched from the far island, landing on the home plateau.
    const curve = new THREE.QuadraticBezierCurve3(
      new THREE.Vector3(-30, 8, 10),
      new THREE.Vector3(-8, 40, 4),
      new THREE.Vector3(4.5, 2.2, 3),
    );
    const tube = track(new THREE.TubeGeometry(curve, 140, 0.95, 10, false));
    const uv = tube.getAttribute("uv");
    const centres = new Float32Array(uv.count * 3);
    const spine = new THREE.Vector3();
    for (let i = 0; i < uv.count; i++) {
      curve.getPointAt(THREE.MathUtils.clamp(uv.getX(i), 0, 1), spine);
      centres.set([spine.x, spine.y, spine.z], i * 3);
    }
    tube.setAttribute("aCenter", new THREE.BufferAttribute(centres, 3));
    const trailMaterial = track(
      new THREE.ShaderMaterial({
        vertexShader: TRAIL_VERTEX,
        fragmentShader: TRAIL_FRAGMENT,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        uniforms: {
          uHead: { value: 0 },
          uHot: { value: new THREE.Color("#fff0c4") },
          uCool: { value: new THREE.Color(GRASS_LIT) },
        },
      }),
    );
    world.add(new THREE.Mesh(tube, trailMaterial));

    const shot = new THREE.Mesh(
      track(new THREE.IcosahedronGeometry(0.95, 0)),
      track(new THREE.MeshBasicMaterial({ color: "#fff2cd" })),
    );
    world.add(shot);
    const halo = new THREE.Mesh(
      track(new THREE.PlaneGeometry(9, 9)),
      track(
        new THREE.ShaderMaterial({
          vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
          fragmentShader: GLOW_FRAGMENT,
          transparent: true,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
          uniforms: { uColor: { value: new THREE.Color(GOLD) } },
        }),
      ),
    );
    world.add(halo);

    const blastMaterial = track(
      new THREE.MeshBasicMaterial({
        color: GOLD,
        transparent: true,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    );
    const blast = new THREE.Mesh(
      track(new THREE.RingGeometry(0.74, 1, 56)),
      blastMaterial,
    );
    blast.position.copy(curve.getPoint(1));
    world.add(blast);
    const flash = new THREE.PointLight("#ffcf85", 0, 42, 2);
    flash.position.copy(blast.position);
    world.add(flash);

    // Motes: a cheap parallax layer that keeps the empty sky from feeling flat.
    const MOTES = 90;
    const dust = track(new THREE.BufferGeometry());
    const spots = new Float32Array(MOTES * 3);
    const seeds = new Float32Array(MOTES);
    for (let i = 0; i < MOTES; i++) {
      seeds[i] = (i * 0.6180339887) % 1;
      spots.set(
        [
          (seeds[i] - 0.5) * 120 + Math.sin(i * 2.3) * 20,
          Math.random() * 90,
          Math.cos(i * 1.7) * 44 - 8,
        ],
        i * 3,
      );
    }
    dust.setAttribute("position", new THREE.Float32BufferAttribute(spots, 3));
    dust.setAttribute("aSeed", new THREE.Float32BufferAttribute(seeds, 1));
    const moteMaterial = track(
      new THREE.ShaderMaterial({
        vertexShader: MOTE_VERTEX,
        fragmentShader: MOTE_FRAGMENT,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        uniforms: {
          uTime: { value: 0 },
          uHeight: { value: 90 },
          uMint: { value: new THREE.Color(MINT) },
          uGold: { value: new THREE.Color(GOLD) },
        },
      }),
    );
    scene.add(new THREE.Points(dust, moteMaterial));

    scene.add(new THREE.HemisphereLight("#93e2ce", "#2c241c", 2.3));
    const sun = new THREE.DirectionalLight("#fff1d6", 3.4);
    sun.position.set(26, 34, 20);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    sun.shadow.camera.near = 10;
    sun.shadow.camera.far = 160;
    sun.shadow.camera.left = -46;
    sun.shadow.camera.right = 46;
    sun.shadow.camera.top = 46;
    sun.shadow.camera.bottom = -46;
    sun.shadow.bias = -0.0012;
    sun.shadow.normalBias = 0.4;
    scene.add(sun);
    // A cool counter-light from behind separates the spire from the sky.
    const rim = new THREE.DirectionalLight(MINT, 2.4);
    rim.position.set(-30, 6, -24);
    scene.add(rim);

    const pointer = { x: 0, y: 0, tx: 0, ty: 0 };
    const onPointer = (event: PointerEvent) => {
      pointer.tx = (event.clientX / window.innerWidth - 0.5) * 2;
      pointer.ty = (event.clientY / window.innerHeight - 0.5) * 2;
    };
    if (!still) window.addEventListener("pointermove", onPointer);

    // Frame the widest swing of the archipelago, not its rest pose: the
    // satellites orbit, so a fit taken from one frame clips them in the next.
    const reach = new THREE.Box3(
      new THREE.Vector3(-33, -22, -33),
      new THREE.Vector3(33, 24, 33),
    );
    const corners: THREE.Vector3[] = [];
    for (const x of [reach.min.x, reach.max.x])
      for (const y of [reach.min.y, reach.max.y])
        for (const z of [reach.min.z, reach.max.z])
          corners.push(new THREE.Vector3(x, y, z));
    const centre = reach.getCenter(new THREE.Vector3());
    const span = reach.getSize(new THREE.Vector3());
    const direction = new THREE.Vector3(-0.16, 0.3, 0.94).normalize();
    const right = new THREE.Vector3();
    const up = new THREE.Vector3();
    const offset = new THREE.Vector3();
    const target = new THREE.Vector3();
    const resize = () => {
      const { clientWidth: w, clientHeight: h } = mount;
      if (!w || !h) return;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      (sky.material as THREE.ShaderMaterial).uniforms.uAspect.value =
        camera.aspect;
      // On wide screens the copy owns the left, so aim left of the archipelago.
      const shift = camera.aspect > 1.15 ? span.x * 0.3 : 0;
      target.copy(centre).setX(centre.x - shift);
      right.set(0, 1, 0).cross(direction).normalize();
      up.copy(direction).cross(right).normalize();
      const vertical = Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2);
      const horizontal = vertical * camera.aspect;
      let distance = 0;
      for (const corner of corners) {
        offset.copy(corner).sub(target);
        const along = offset.dot(direction);
        distance = Math.max(
          distance,
          along + Math.abs(offset.dot(right)) / horizontal,
          along + Math.abs(offset.dot(up)) / vertical,
        );
      }
      // The boxed mobile card has no copy to dodge, so the archipelago can fill
      // more of it than it can on a wide screen.
      const fill = camera.aspect > 1.15 ? 0.94 : 0.82;
      camera.position.copy(target).addScaledVector(direction, distance * fill);
      camera.lookAt(target);
      camera.updateProjectionMatrix();
      // Haze follows the framing, or a wide window renders an unlit black field.
      scene.fog = new THREE.Fog("#356e5f", distance * 1.05, distance * 2.8);
    };
    const CYCLE = 5.4; // Seconds per shot: long enough to read, short enough to loop.
    const FLIGHT = 0.62;
    const draw = (t: number) => {
      (sky.material as THREE.ShaderMaterial).uniforms.uTime.value = t;
      moteMaterial.uniforms.uTime.value = t;
      for (const orbit of orbits) {
        orbit.pivot.rotation.y = orbit.bob + t * orbit.speed;
        orbit.pivot.position.y = Math.sin(t * 0.4 + orbit.bob) * 1.6;
      }
      home.position.y = Math.sin(t * 0.32) * 0.9;

      const phase = (t % CYCLE) / CYCLE;
      const flown = Math.min(phase / FLIGHT, 1);
      trailMaterial.uniforms.uHead.value = flown;
      curve.getPointAt(flown, spine);
      shot.position.copy(spine);
      shot.rotation.set(t * 2.4, t * 1.7, 0);
      shot.visible = flown < 1;
      halo.position.copy(spine);
      halo.lookAt(camera.position);
      halo.visible = shot.visible;

      const since = Math.max(0, phase - FLIGHT) / (1 - FLIGHT);
      const punch = since > 0 ? (1 - since) ** 2.4 : 0;
      blast.scale.setScalar(1 + since * 11);
      blastMaterial.opacity = punch * 0.9;
      blast.visible = punch > 0.01;
      blast.lookAt(camera.position);
      flash.intensity = punch * 520;

      pointer.x += (pointer.tx - pointer.x) * 0.04;
      pointer.y += (pointer.ty - pointer.y) * 0.04;
      world.rotation.y = Math.sin(t * 0.05) * 0.06 + pointer.x * 0.06;
      world.rotation.x = pointer.y * 0.025;
      renderer.render(scene, camera);
    };

    const observer = new ResizeObserver(() => {
      resize();
      // A still hero never runs the loop, so a resize has to repaint it or the
      // canvas keeps stretching the frame it was born with.
      if (still) draw(CYCLE * 0.42);
    });
    observer.observe(mount);
    resize();

    let frame = 0;
    const loop = () => {
      draw(clock.getElapsedTime());
      frame = requestAnimationFrame(loop);
    };
    if (still) draw(CYCLE * 0.42);
    else frame = requestAnimationFrame(loop);

    const visibility = () => {
      if (still) return;
      cancelAnimationFrame(frame);
      if (!document.hidden) frame = requestAnimationFrame(loop);
    };
    document.addEventListener("visibilitychange", visibility);

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      document.removeEventListener("visibilitychange", visibility);
      window.removeEventListener("pointermove", onPointer);
      for (const item of disposables) item.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, []);

  return <div ref={host} className="hero-gl" aria-hidden="true" />;
}
