"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";

const PALETTE = {
  grass: new THREE.Color("#b6d466"),
  earth: new THREE.Color("#a2694a"),
  shade: new THREE.Color("#75503f"),
  rim: new THREE.Color("#8cd5bb"),
  ink: new THREE.Color("#0b1512"),
};

const SLAB_VERTEX = /* glsl */ `
  attribute float aSeed;
  varying vec3 vNormal;
  varying vec3 vWorld;
  varying float vSeed;
  uniform float uTime;
  void main() {
    vSeed = aSeed;
    vec4 world = instanceMatrix * vec4(position, 1.0);
    // Each slab breathes on its own clock so the field never pulses in step.
    world.y += sin(uTime * 0.55 + aSeed * 6.2831) * (1.0 + aSeed * 1.1);
    vWorld = world.xyz;
    vNormal = normalize(mat3(instanceMatrix) * normal);
    gl_Position = projectionMatrix * viewMatrix * world;
  }
`;

const SLAB_FRAGMENT = /* glsl */ `
  precision highp float;
  varying vec3 vNormal;
  varying vec3 vWorld;
  varying float vSeed;
  uniform vec3 uGrass;
  uniform vec3 uEarth;
  uniform vec3 uShade;
  uniform vec3 uRim;
  uniform vec3 uFog;
  uniform vec2 uFogRange;
  uniform float uTime;
  void main() {
    vec3 n = normalize(vNormal);
    // Flat cartoon shading: the palette is chosen by which way the face points.
    vec3 base = mix(uEarth, uShade, step(0.5, abs(n.z)));
    base = mix(base, uGrass, step(0.5, n.y));
    base *= 0.92 + vSeed * 0.2;
    // One key light keeps the faces legible without turning the scene realistic.
    base *= 0.88 + 0.34 * max(dot(n, normalize(vec3(0.35, 0.9, 0.45))), 0.0);
    vec3 view = normalize(cameraPosition - vWorld);
    float fresnel = pow(1.0 - max(dot(view, n), 0.0), 3.0);
    // A slow band of light sweeps the field, so the scene never sits still.
    float sweep = smoothstep(0.86, 1.0, sin(vWorld.x * 0.05 - uTime * 0.5) * 0.5 + 0.5);
    vec3 color = base + uRim * (fresnel * 0.55 + sweep * 0.16);
    float depth = smoothstep(uFogRange.x, uFogRange.y, length(cameraPosition - vWorld));
    gl_FragColor = vec4(mix(color, uFog, depth), 1.0);
  }
`;

const SKY_FRAGMENT = /* glsl */ `
  precision highp float;
  varying vec2 vUv;
  uniform float uTime;
  uniform vec3 uTop;
  uniform vec3 uBottom;
  uniform vec3 uGlow;
  void main() {
    vec2 p = vUv - vec2(0.5, 0.62);
    float halo = exp(-dot(p, p) * 5.5);
    float drift = sin(vUv.x * 3.0 + uTime * 0.18) * 0.04;
    vec3 color = mix(uBottom, uTop, clamp(vUv.y + drift, 0.0, 1.0));
    gl_FragColor = vec4(color + uGlow * halo * 0.5, 1.0);
  }
`;

const ARC_FRAGMENT = /* glsl */ `
  precision highp float;
  varying vec2 vUv;
  uniform float uTime;
  uniform vec3 uColor;
  void main() {
    // Marching dashes read as a shot travelling the trajectory.
    float dash = fract(vUv.x * 26.0 - uTime * 1.4);
    float mask = smoothstep(0.5, 0.24, dash);
    float edge = smoothstep(0.0, 0.45, abs(vUv.y - 0.5));
    if (mask < 0.04) discard;
    gl_FragColor = vec4(uColor, mask * (1.0 - edge * 0.5));
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
    mount.append(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(38, 1, 1, 400);
    const clock = new THREE.Clock();

    const sky = new THREE.Mesh(
      new THREE.PlaneGeometry(2, 2),
      new THREE.ShaderMaterial({
        vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 1.0, 1.0); }`,
        fragmentShader: SKY_FRAGMENT,
        depthWrite: false,
        depthTest: false,
        uniforms: {
          uTime: { value: 0 },
          uTop: { value: new THREE.Color("#2c5049") },
          uBottom: { value: new THREE.Color("#101c18") },
          uGlow: { value: new THREE.Color("#4d9080") },
        },
      }),
    );
    sky.frustumCulled = false;
    sky.renderOrder = -1;
    scene.add(sky);

    // A loose archipelago: a couple of anchors plus a scatter of small shards.
    const layout: [number, number, number, number, number][] = [
      [-14, -4, 4, 30, 20],
      [14, 2, -10, 24, 17],
      [4, -14, 18, 19, 13],
      [-24, 9, -18, 13, 9],
      [30, -9, 12, 13, 9],
      [-2, 14, 24, 10, 7],
      [24, 14, -22, 9, 6],
      [-28, -12, 22, 9, 6],
      [36, 7, -4, 8, 6],
      [10, 22, 4, 7, 5],
      [-12, 20, -6, 6, 4],
      [20, -18, 26, 8, 6],
    ];
    const geometry = new THREE.BoxGeometry(1, 1, 1);
    const seeds = new Float32Array(layout.length);
    const slabs = new THREE.InstancedMesh(
      geometry,
      new THREE.ShaderMaterial({
        vertexShader: SLAB_VERTEX,
        fragmentShader: SLAB_FRAGMENT,
        uniforms: {
          uTime: { value: 0 },
          uGrass: { value: PALETTE.grass },
          uEarth: { value: PALETTE.earth },
          uShade: { value: PALETTE.shade },
          uRim: { value: PALETTE.rim },
          uFog: { value: new THREE.Color("#1b2f28") },
          uFogRange: { value: new THREE.Vector2(140, 320) },
        },
      }),
      layout.length,
    );
    const matrix = new THREE.Matrix4();
    layout.forEach(([x, y, z, w, d], i) => {
      const height = 5 + (i % 3) * 2.5;
      matrix.compose(
        new THREE.Vector3(x, y, z),
        new THREE.Quaternion(),
        new THREE.Vector3(w, height, d),
      );
      slabs.setMatrixAt(i, matrix);
      seeds[i] = (i * 0.37) % 1;
    });
    geometry.setAttribute(
      "aSeed",
      new THREE.InstancedBufferAttribute(seeds, 1),
    );
    slabs.instanceMatrix.needsUpdate = true;
    const field = new THREE.Group();
    field.add(slabs);
    scene.add(field);

    const curve = new THREE.QuadraticBezierCurve3(
      new THREE.Vector3(-26, 4, 6),
      new THREE.Vector3(-2, 46, -2),
      new THREE.Vector3(22, 8, -8),
    );
    const arc = new THREE.Mesh(
      new THREE.TubeGeometry(curve, 90, 0.55, 8, false),
      new THREE.ShaderMaterial({
        vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
        fragmentShader: ARC_FRAGMENT,
        transparent: true,
        uniforms: {
          uTime: { value: 0 },
          uColor: { value: new THREE.Color("#d2fb78") },
        },
      }),
    );
    field.add(arc);

    const shot = new THREE.Mesh(
      new THREE.IcosahedronGeometry(1.15, 1),
      new THREE.MeshBasicMaterial({ color: "#f3c677" }),
    );
    field.add(shot);
    const blast = new THREE.Mesh(
      new THREE.RingGeometry(1.1, 1.5, 40),
      new THREE.MeshBasicMaterial({
        color: "#f3c677",
        transparent: true,
        side: THREE.DoubleSide,
      }),
    );
    blast.position.copy(curve.getPoint(1));
    field.add(blast);

    const pointer = { x: 0, y: 0, tx: 0, ty: 0 };
    const onPointer = (event: PointerEvent) => {
      pointer.tx = (event.clientX / window.innerWidth - 0.5) * 2;
      pointer.ty = (event.clientY / window.innerHeight - 0.5) * 2;
    };
    if (!still) window.addEventListener("pointermove", onPointer);

    // Frame every corner of the field: a sphere fit wastes half the frame, and
    // anything looser clips a slab on some window shape.
    const box = new THREE.Box3().setFromObject(field).expandByScalar(3);
    const corners: THREE.Vector3[] = [];
    // The field drifts as it turns, so frame its widest swing, not its rest.
    for (const x of [box.min.x, box.max.x])
      for (const y of [box.min.y, box.max.y])
        for (const z of [box.min.z, box.max.z])
          for (const yaw of [-0.18, 0.18])
            corners.push(
              new THREE.Vector3(x, y, z).applyEuler(
                new THREE.Euler(0.05, yaw, 0),
              ),
            );
    const centre = box.getCenter(new THREE.Vector3());
    const span = box.getSize(new THREE.Vector3());
    const direction = new THREE.Vector3(0, 0.36, 0.93).normalize();
    const right = new THREE.Vector3();
    const up = new THREE.Vector3();
    const offset = new THREE.Vector3();
    const target = new THREE.Vector3();
    const resize = () => {
      const { clientWidth: w, clientHeight: h } = mount;
      if (!w || !h) return;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      // On wide screens the copy owns the left, so aim left of the field.
      const shift = camera.aspect > 1.15 ? span.x * 0.34 : 0;
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
      distance *= 1.02;
      camera.position.copy(target).addScaledVector(direction, distance);
      camera.lookAt(target);
      camera.updateProjectionMatrix();
      // Haze has to follow the framing, or a wide window renders a black field.
      (slabs.material as THREE.ShaderMaterial).uniforms.uFogRange.value.set(
        distance * 0.78,
        distance * 2.1,
      );
    };
    const observer = new ResizeObserver(resize);
    observer.observe(mount);
    resize();

    let frame = 0;
    const render = () => {
      const t = clock.getElapsedTime();
      (sky.material as THREE.ShaderMaterial).uniforms.uTime.value = t;
      (slabs.material as THREE.ShaderMaterial).uniforms.uTime.value = t;
      (arc.material as THREE.ShaderMaterial).uniforms.uTime.value = t;
      const travel = (t * 0.32) % 1;
      shot.position.copy(curve.getPoint(travel));
      shot.rotation.set(t * 1.6, t * 1.1, 0);
      const impact = Math.max(0, 1 - ((t * 0.32) % 1) / 0.22);
      blast.scale.setScalar(1 + (1 - impact) * 2.2);
      (blast.material as THREE.MeshBasicMaterial).opacity = impact * 0.8;
      blast.lookAt(camera.position);
      pointer.x += (pointer.tx - pointer.x) * 0.04;
      pointer.y += (pointer.ty - pointer.y) * 0.04;
      field.rotation.y = Math.sin(t * 0.06) * 0.1 + pointer.x * 0.07;
      field.rotation.x = pointer.y * 0.03;
      renderer.render(scene, camera);
      frame = requestAnimationFrame(render);
    };
    if (still) {
      resize();
      renderer.render(scene, camera);
    } else frame = requestAnimationFrame(render);

    const visibility = () => {
      if (still) return;
      cancelAnimationFrame(frame);
      if (!document.hidden) frame = requestAnimationFrame(render);
    };
    document.addEventListener("visibilitychange", visibility);

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      document.removeEventListener("visibilitychange", visibility);
      window.removeEventListener("pointermove", onPointer);
      scene.traverse((object) => {
        if (object instanceof THREE.Mesh) {
          object.geometry.dispose();
          (object.material as THREE.Material).dispose();
        }
      });
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, []);

  return <div ref={host} className="hero-gl" aria-hidden="true" />;
}
