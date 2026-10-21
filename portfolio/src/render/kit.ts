/**
 * Asset-baking toolkit. These helpers build offline studio renders with
 * three.js (physically based materials, an environment for reflections and
 * baked shadows) that are exported as WebP images for the site.
 * Nothing in here ships to visitors.
 */
import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";

export interface Stage {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  width: number;
  height: number;
}

export function makeStage(width: number, height: number, opts: { transparent?: boolean; exposure?: number } = {}): Stage {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  document.body.appendChild(canvas);
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: !!opts.transparent, preserveDrawingBuffer: true });
  renderer.setPixelRatio(1);
  renderer.setSize(width, height, false);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.toneMappingExposure = opts.exposure ?? 1;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  if (opts.transparent) renderer.setClearColor(0x000000, 0);
  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.8;
  return { renderer, scene, width, height };
}

/** A key light with a big, soft shadow — the "window" every asset shares. */
export function keyLight(scene: THREE.Scene, opts: { dir?: [number, number, number]; intensity?: number; color?: string; size?: number; radius?: number; target?: [number, number, number] } = {}) {
  const light = new THREE.DirectionalLight(opts.color ?? "#fff4ea", opts.intensity ?? 3);
  const d = opts.dir ?? [-6, 10, 5];
  const t = opts.target ?? [0, 0, 0];
  light.position.set(t[0] + d[0], t[1] + d[1], t[2] + d[2]);
  light.target.position.set(t[0], t[1], t[2]);
  light.castShadow = true;
  light.shadow.mapSize.set(4096, 4096);
  const s = opts.size ?? 30;
  const cam = light.shadow.camera as THREE.OrthographicCamera;
  cam.left = -s;
  cam.right = s;
  cam.top = s;
  cam.bottom = -s;
  cam.near = 0.1;
  cam.far = 200;
  light.shadow.radius = Math.min(6, (opts.radius ?? 12) / 3);
  light.shadow.bias = -0.0004;
  light.shadow.normalBias = 0.02;
  scene.add(light, light.target);
  return light;
}

/** A plane that renders only the shadows falling on it, so cut-outs keep a real contact shadow. */
export function shadowCatcher(scene: THREE.Scene, size = 200, opacity = 0.32, y = 0) {
  const plane = new THREE.Mesh(new THREE.PlaneGeometry(size, size), new THREE.ShadowMaterial({ opacity, color: "#3a2320" }));
  plane.rotation.x = -Math.PI / 2;
  plane.position.y = y;
  plane.receiveShadow = true;
  scene.add(plane);
  return plane;
}

/** Soft ambient occlusion under objects: a radial-gradient decal on the surface. */
export function contactShadow(scene: THREE.Scene, w: number, d: number, x = 0, z = 0, strength = 0.45, y = 0.01) {
  const c = document.createElement("canvas");
  c.width = c.height = 256;
  const g = c.getContext("2d")!;
  const grad = g.createRadialGradient(128, 128, 10, 128, 128, 128);
  grad.addColorStop(0, `rgba(40,20,18,${strength})`);
  grad.addColorStop(0.6, `rgba(40,20,18,${strength * 0.35})`);
  grad.addColorStop(1, "rgba(40,20,18,0)");
  g.fillStyle = grad;
  g.fillRect(0, 0, 256, 256);
  const tex = new THREE.CanvasTexture(c);
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false }));
  m.rotation.x = -Math.PI / 2;
  m.position.set(x, y, z);
  scene.add(m);
  return m;
}

/** Orthographic "tabletop" camera looking down at the desk from the front. */
export function deskCamera(width: number, height: number, viewWidth: number, elevationDeg = 54, target: [number, number, number] = [0, 0, 0]) {
  const aspect = width / height;
  const vh = viewWidth / aspect;
  const cam = new THREE.OrthographicCamera(-viewWidth / 2, viewWidth / 2, vh / 2, -vh / 2, 0.1, 500);
  const el = THREE.MathUtils.degToRad(elevationDeg);
  cam.position.set(target[0], target[1] + Math.sin(el) * 100, target[2] + Math.cos(el) * 100);
  cam.lookAt(...target);
  cam.updateProjectionMatrix();
  return cam;
}

/* ------------------------------ canvas textures ------------------------------ */

export function canvasTexture(w: number, h: number, draw: (g: CanvasRenderingContext2D, w: number, h: number) => void, srgb = true) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  draw(c.getContext("2d")!, w, h);
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

export function rng(seed: number) {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
}

/** Fine paper grain and fibres. */
export function paperTexture(base: string, seed = 1, fibres = 0.06) {
  return canvasTexture(1024, 1024, (g, w, h) => {
    g.fillStyle = base;
    g.fillRect(0, 0, w, h);
    const r = rng(seed);
    const img = g.getImageData(0, 0, w, h);
    for (let i = 0; i < img.data.length; i += 4) {
      const n = (r() - 0.5) * 14;
      img.data[i] += n;
      img.data[i + 1] += n;
      img.data[i + 2] += n;
    }
    g.putImageData(img, 0, 0);
    g.strokeStyle = `rgba(90,60,50,${fibres})`;
    g.lineWidth = 1;
    for (let i = 0; i < 900; i++) {
      const x = r() * w;
      const y = r() * h;
      const a = r() * Math.PI * 2;
      const l = 4 + r() * 14;
      g.beginPath();
      g.moveTo(x, y);
      g.quadraticCurveTo(x + Math.cos(a) * l * 0.5 + r() * 3, y + Math.sin(a) * l * 0.5, x + Math.cos(a) * l, y + Math.sin(a) * l);
      g.stroke();
    }
  });
}

/** Woven cloth for book covers and felt. */
export function clothTexture(base: string, seed = 3, weave = 3) {
  return canvasTexture(1024, 1024, (g, w, h) => {
    g.fillStyle = base;
    g.fillRect(0, 0, w, h);
    const r = rng(seed);
    for (let y = 0; y < h; y += weave) {
      g.fillStyle = `rgba(255,255,255,${0.025 + r() * 0.04})`;
      g.fillRect(0, y, w, 1);
    }
    for (let x = 0; x < w; x += weave) {
      g.fillStyle = `rgba(0,0,0,${0.02 + r() * 0.035})`;
      g.fillRect(x, 0, 1, h);
    }
    const img = g.getImageData(0, 0, w, h);
    for (let i = 0; i < img.data.length; i += 4) {
      const n = (r() - 0.5) * 10;
      img.data[i] += n;
      img.data[i + 1] += n;
      img.data[i + 2] += n;
    }
    g.putImageData(img, 0, 0);
  });
}

/** Rift-sawn oak: long grain lines, rays and subtle colour drift. */
export function woodTexture(seed = 7, base = "#c9a57a", dark = "#9a7550", w = 4096, h = 2048) {
  return canvasTexture(w, h, (g) => {
    const r = rng(seed);
    const grad = g.createLinearGradient(0, 0, w, h);
    grad.addColorStop(0, base);
    grad.addColorStop(0.5, shade(base, -0.04));
    grad.addColorStop(1, shade(base, 0.03));
    g.fillStyle = grad;
    g.fillRect(0, 0, w, h);
    // planks
    const planks = 5;
    for (let p = 0; p < planks; p++) {
      const y0 = (p / planks) * h;
      g.fillStyle = `rgba(${r() > 0.5 ? "255,240,220" : "80,50,30"},${0.03 + r() * 0.05})`;
      g.fillRect(0, y0, w, h / planks);
      g.fillStyle = "rgba(60,35,20,0.35)";
      g.fillRect(0, y0, w, 2);
      // grain
      for (let i = 0; i < 160; i++) {
        let y = y0 + r() * (h / planks);
        const amp = 2 + r() * 10;
        const freq = 0.0015 + r() * 0.004;
        const ph = r() * 10;
        g.strokeStyle = `rgba(${r() > 0.3 ? "90,58,32" : "255,236,210"},${0.04 + r() * 0.12})`;
        g.lineWidth = 0.6 + r() * 2.4;
        g.beginPath();
        for (let x = 0; x <= w; x += 24) {
          const yy = y + Math.sin(x * freq + ph) * amp + Math.sin(x * freq * 3.1) * amp * 0.25;
          if (x === 0) g.moveTo(x, yy);
          else g.lineTo(x, yy);
        }
        g.stroke();
        y += 0;
      }
      // medullary rays (oak fleck)
      for (let i = 0; i < 260; i++) {
        const x = r() * w;
        const y = y0 + r() * (h / planks);
        g.fillStyle = `rgba(240,215,180,${0.08 + r() * 0.12})`;
        g.beginPath();
        g.ellipse(x, y, 6 + r() * 26, 1 + r() * 2, 0, 0, Math.PI * 2);
        g.fill();
      }
    }
    g.fillStyle = dark;
    g.globalAlpha = 0.05;
    g.fillRect(0, 0, w, h);
    g.globalAlpha = 1;
  });
}

export function shade(hex: string, amt: number) {
  const c = new THREE.Color(hex);
  const hsl = { h: 0, s: 0, l: 0 };
  c.getHSL(hsl);
  c.setHSL(hsl.h, hsl.s, Math.max(0, Math.min(1, hsl.l + amt)));
  return "#" + c.getHexString();
}

/** Knit/mesh fabric (headphone cushions, canopy). */
export function knitTexture(base: string, cell = 6, seed = 11) {
  return canvasTexture(512, 512, (g, w, h) => {
    g.fillStyle = base;
    g.fillRect(0, 0, w, h);
    const r = rng(seed);
    for (let y = 0; y < h; y += cell) {
      for (let x = 0; x < w; x += cell) {
        g.fillStyle = `rgba(255,255,255,${0.04 + r() * 0.05})`;
        g.beginPath();
        g.ellipse(x + cell / 2, y + cell / 2, cell * 0.35, cell * 0.22, (y / cell) % 2 ? 0.6 : -0.6, 0, Math.PI * 2);
        g.fill();
      }
    }
  });
}

/** Loads an image URL (or SVG markup) into a texture. */
export async function imageTexture(src: string): Promise<THREE.Texture> {
  const img = new Image();
  img.src = src;
  await img.decode();
  const t = new THREE.Texture(img);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  t.needsUpdate = true;
  return t;
}

/* ------------------------------ export ------------------------------ */

export interface Exported {
  dataUrl: string;
  bbox: { x: number; y: number; w: number; h: number }; // percent of full frame
  width: number;
  height: number;
}

/**
 * Exports the canvas, optionally cropped to its visible (non-transparent)
 * pixels plus padding. Bounding boxes are returned as percentages of the
 * full frame so cut-outs can be placed back exactly.
 */
export function exportCanvas(stage: Stage, opts: { crop?: boolean; pad?: number; type?: string; quality?: number; bboxOverride?: Exported["bbox"] } = {}): Exported {
  const src = stage.renderer.domElement;
  const { width, height } = stage;
  let x0 = 0;
  let y0 = 0;
  let x1 = width;
  let y1 = height;
  if (opts.bboxOverride) {
    x0 = Math.round((opts.bboxOverride.x / 100) * width);
    y0 = Math.round((opts.bboxOverride.y / 100) * height);
    x1 = Math.round(x0 + (opts.bboxOverride.w / 100) * width);
    y1 = Math.round(y0 + (opts.bboxOverride.h / 100) * height);
  } else if (opts.crop) {
    const tmp = document.createElement("canvas");
    tmp.width = width;
    tmp.height = height;
    const g = tmp.getContext("2d")!;
    g.drawImage(src, 0, 0);
    const d = g.getImageData(0, 0, width, height).data;
    x0 = width;
    y0 = height;
    x1 = 0;
    y1 = 0;
    for (let y = 0; y < height; y += 2) {
      for (let x = 0; x < width; x += 2) {
        if (d[(y * width + x) * 4 + 3] > 6) {
          if (x < x0) x0 = x;
          if (x > x1) x1 = x;
          if (y < y0) y0 = y;
          if (y > y1) y1 = y;
        }
      }
    }
    const pad = opts.pad ?? 8;
    x0 = Math.max(0, x0 - pad);
    y0 = Math.max(0, y0 - pad);
    x1 = Math.min(width, x1 + pad);
    y1 = Math.min(height, y1 + pad);
  }
  const out = document.createElement("canvas");
  out.width = x1 - x0;
  out.height = y1 - y0;
  out.getContext("2d")!.drawImage(src, x0, y0, out.width, out.height, 0, 0, out.width, out.height);
  return {
    dataUrl: out.toDataURL(opts.type ?? "image/webp", opts.quality ?? 0.9),
    bbox: { x: (x0 / width) * 100, y: (y0 / height) * 100, w: ((x1 - x0) / width) * 100, h: ((y1 - y0) / height) * 100 },
    width: out.width,
    height: out.height,
  };
}

export function project(cam: THREE.Camera, p: THREE.Vector3) {
  const v = p.clone().project(cam);
  return { x: ((v.x + 1) / 2) * 100, y: ((1 - v.y) / 2) * 100 };
}

/**
 * Invisible foliage between the sun and the set: it only exists in the shadow
 * pass, throwing crisp, physically placed palm and window shadows.
 */
export function shadowGobo(scene: THREE.Scene, light: THREE.DirectionalLight, distance = 0.45, size = 26, seed = 4) {
  const tex = canvasTexture(1024, 1024, (g, w, h) => {
    g.clearRect(0, 0, w, h);
    const r = rng(seed);
    g.fillStyle = "#000";
    // a window frame edge and one mullion
    g.fillRect(0, 0, w * 0.08, h);
    g.fillRect(w * 0.64, 0, w * 0.035, h);
    g.fillRect(0, h * 0.82, w, h * 0.04);
    // palm fronds
    for (let f = 0; f < 3; f++) {
      const ox = w * (0.15 + r() * 0.45);
      const oy = h * (0.05 + r() * 0.3);
      const ang = Math.PI * (0.35 + r() * 0.5);
      g.strokeStyle = "#000";
      g.lineWidth = 6;
      g.beginPath();
      g.moveTo(ox, oy);
      g.lineTo(ox + Math.cos(ang) * 560, oy + Math.sin(ang) * 560);
      g.stroke();
      for (let i = 2; i < 30; i++) {
        const t = i / 30;
        const x = ox + Math.cos(ang) * t * 560;
        const y = oy + Math.sin(ang) * t * 560;
        for (const side of [-1, 1]) {
          g.save();
          g.translate(x, y);
          g.rotate(ang + side * (0.9 + r() * 0.25));
          g.beginPath();
          const len = 150 * Math.sin(t * Math.PI) + 20;
          g.moveTo(0, 0);
          g.quadraticCurveTo(len * 0.5, -10, len, side * 6);
          g.quadraticCurveTo(len * 0.5, 8, 0, 0);
          g.fill();
          g.restore();
        }
      }
    }
  }, false);
  const mat = new THREE.MeshBasicMaterial({ map: tex, alphaTest: 0.5, transparent: true, side: THREE.DoubleSide, colorWrite: false, depthWrite: false });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(size, size), mat);
  mesh.customDepthMaterial = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map: tex, alphaTest: 0.5, side: THREE.DoubleSide });
  mesh.castShadow = true;
  const p = light.position.clone().lerp(light.target.position, distance);
  mesh.position.copy(p);
  mesh.lookAt(light.position);
  scene.add(mesh);
  return mesh;
}
