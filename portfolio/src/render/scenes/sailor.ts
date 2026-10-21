import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { flavours, flavourById, type Flavour } from "../../projects/sailor/data";
import { buildCan, condensation } from "../can";
import { contactShadow, exportCanvas, keyLight, makeStage, paperTexture, rng, shade, shadowCatcher, shadowGobo, type Stage } from "../kit";

function canvasTex(text: string) {
  const c = document.createElement("canvas");
  c.width = 2048;
  c.height = 240;
  const g = c.getContext("2d")!;
  g.fillStyle = "#3b2a1c";
  g.font = "800 92px 'Bricolage Grotesque'";
  g.textAlign = "center";
  g.textBaseline = "middle";
  (g as unknown as { letterSpacing: string }).letterSpacing = "16px";
  g.fillText(text, 1024, 120);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export type Output = { file: string; dataUrl: string; meta?: unknown };

function backdrop(scene: THREE.Scene, colour: string, width = 60) {
  // a seamless paper sweep: floor curving up into a wall
  const shape = new THREE.Shape();
  const curve = new THREE.CurvePath<THREE.Vector2>();
  curve.add(new THREE.LineCurve(new THREE.Vector2(0, 30), new THREE.Vector2(0, 8)));
  curve.add(new THREE.QuadraticBezierCurve(new THREE.Vector2(0, 8), new THREE.Vector2(0, 0), new THREE.Vector2(8, 0)));
  curve.add(new THREE.LineCurve(new THREE.Vector2(8, 0), new THREE.Vector2(40, 0)));
  const pts = curve.getPoints(40);
  void shape;
  const geo = new THREE.BufferGeometry();
  const verts: number[] = [];
  const uvs: number[] = [];
  const idx: number[] = [];
  pts.forEach((p, i) => {
    verts.push(-width / 2, p.y, -12 + p.x, width / 2, p.y, -12 + p.x);
    uvs.push(0, i / pts.length, 1, i / pts.length);
    if (i < pts.length - 1) idx.push(i * 2, i * 2 + 1, i * 2 + 2, i * 2 + 1, i * 2 + 3, i * 2 + 2);
  });
  geo.setAttribute("position", new THREE.Float32BufferAttribute(verts, 3));
  geo.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: colour, roughness: 0.95, side: THREE.DoubleSide }));
  mesh.receiveShadow = true;
  scene.add(mesh);
  return mesh;
}

function plinth(scene: THREE.Scene, colour: string, w: number, h: number, d: number, x: number, z: number) {
  const tex = paperTexture(colour, 21, 0.015);
  tex.repeat.set(1.5, 1.5);
  const m = new THREE.Mesh(new RoundedBoxGeometry(w, h, d, 6, 0.08), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.9 }));
  m.position.set(x, h / 2, z);
  m.castShadow = true;
  m.receiveShadow = true;
  scene.add(m);
  return h;
}

function sunlight(scene: THREE.Scene, colour: string, pos: [number, number, number], target: [number, number, number], intensity = 1400) {
  const dir: [number, number, number] = [pos[0] - target[0], pos[1] - target[1], pos[2] - target[2]];
  const sun = keyLight(scene, { dir, target, color: colour, intensity: intensity / 420, size: 22, radius: 6 });
  shadowGobo(scene, sun, 0.55, 30);
  return sun;
}

function camera(stage: Stage, fov: number, pos: [number, number, number], look: [number, number, number]) {
  const cam = new THREE.PerspectiveCamera(fov, stage.width / stage.height, 0.1, 400);
  cam.position.set(...pos);
  cam.lookAt(...look);
  return cam;
}

/** A large soft-box from camera right, for the long vertical highlight down the can. */
function fill(scene: THREE.Scene, colour = "#ffffff", intensity = 3) {
  const box = new THREE.RectAreaLight(colour, intensity, 3, 12);
  box.position.set(7, 6, 6);
  box.lookAt(0, 4.5, 0);
  scene.add(box);
  return box;
}

/** One flavour, one plinth, one patch of afternoon light. */
async function portrait(f: Flavour): Promise<Output[]> {
  const stage = makeStage(1600, 2000, { exposure: 1.05 });
  const { scene } = stage;
  const w = f.weather;
  const dark = f.id === "night-swim";
  scene.background = new THREE.Color(w.sky);
  backdrop(scene, shade(w.sky, dark ? 0.06 : -0.02));
  const ph = plinth(scene, shade(w.sea, dark ? 0.1 : 0.12), 3.4, 3.2, 3.4, 0, 0);
  const can = await buildCan(f);
  can.position.set(0, ph, 0);
  can.rotation.y = -0.16;
  scene.add(can);
  if (f.id === "fog-line" || f.id === "low-tide") {
    const drops = condensation();
    drops.position.copy(can.position);
    drops.rotation.y = can.rotation.y;
    scene.add(drops);
  }
  sunlight(scene, dark ? "#cfc6ff" : "#ffe2bd", [-16, 20, 14], [1, 3, -4], dark ? 1300 : 2000);
  fill(scene, dark ? "#7d8cff" : "#e6eeff", dark ? 2 : 3);
  scene.add(new THREE.HemisphereLight(w.sky, shade(w.sea, -0.25), dark ? 0.2 : 0.25));
  scene.environmentIntensity = 0.45;
  const cam = camera(stage, 24, [0.8, 6.4, 18], [0, 5, 0]);
  stage.renderer.render(scene, cam);
  return [{ file: `sailor/portrait-${f.id}.webp`, dataUrl: exportCanvas(stage, { quality: 0.86 }).dataUrl }];
}

/** Three cans on stepped plinths in raking sun — the homepage hero. */
async function hero(): Promise<Output[]> {
  const stage = makeStage(2400, 1500, { exposure: 0.92 });
  const { scene } = stage;
  scene.background = new THREE.Color("#e7bfa8");
  backdrop(scene, "#e6bba4", 80);
  const picks = [flavourById("lighthouse-lemon")!, flavourById("low-tide")!, flavourById("night-swim")!];
  const heights = [2.4, 3.6, 1.6];
  const xs = [-4.1, 0, 4.1];
  for (let i = 0; i < 3; i++) {
    const h = plinth(scene, ["#e8c4ad", "#e0b49b", "#ecccb8"][i], 3.2, heights[i], 3.2, xs[i], i === 1 ? -0.6 : 0.4);
    const can = await buildCan(picks[i]);
    can.position.set(xs[i], h, i === 1 ? -0.6 : 0.4);
    can.rotation.y = [0.18, -0.08, -0.2][i];
    scene.add(can);
  }
  sunlight(scene, "#ffe0b8", [-20, 24, 18], [0, 3, -4], 2400);
  fill(scene, "#e9efff", 4);
  scene.add(new THREE.HemisphereLight("#fff3ea", "#c99a86", 0.3));
  scene.environmentIntensity = 0.45;
  const cam = camera(stage, 22, [0, 7, 31], [0, 4.6, 0]);
  stage.renderer.render(scene, cam);
  return [{ file: "sailor/hero.webp", dataUrl: exportCanvas(stage, { quality: 0.86 }).dataUrl }];
}

/** All six on one long ledge. */
async function lineup(): Promise<Output[]> {
  const stage = makeStage(2800, 1300, { exposure: 1.05 });
  const { scene } = stage;
  scene.background = new THREE.Color("#e9e3da");
  backdrop(scene, "#ebe4db", 90);
  plinth(scene, "#ddd2c5", 22, 1.2, 4, 0, 0);
  for (let i = 0; i < flavours.length; i++) {
    const can = await buildCan(flavours[i]);
    can.position.set(-8.75 + i * 3.5, 1.2, (i % 2) * 0.5 - 0.2);
    can.rotation.y = 0.12 - i * 0.05;
    scene.add(can);
  }
  sunlight(scene, "#ffeccf", [-24, 24, 18], [0, 3, -4], 2400);
  fill(scene, "#eef2ff", 4);
  scene.add(new THREE.HemisphereLight("#ffffff", "#bba996", 0.35));
  scene.environmentIntensity = 0.45;
  const cam = camera(stage, 24, [0, 6, 30], [0, 3.6, 0]);
  stage.renderer.render(scene, cam);
  return [{ file: "sailor/lineup.webp", dataUrl: exportCanvas(stage, { quality: 0.86 }).dataUrl }];
}

/** A can lying in crushed ice, shot from above. */
async function ice(): Promise<Output[]> {
  const stage = makeStage(1800, 1800, { exposure: 1.1 });
  const { scene } = stage;
  scene.background = new THREE.Color("#3f7f72");
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(80, 80), new THREE.MeshStandardMaterial({ color: "#3f7f72", roughness: 0.6 }));
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);
  const r = rng(42);
  const iceMat = new THREE.MeshPhysicalMaterial({ color: "#f4fbff", roughness: 0.12, transmission: 1, thickness: 0.8, ior: 1.31, attenuationColor: new THREE.Color("#dff3ff"), attenuationDistance: 2, clearcoat: 1 });
  for (let i = 0; i < 110; i++) {
    const s = 0.6 + r() * 0.8;
    const cube = new THREE.Mesh(new RoundedBoxGeometry(s, s * (0.8 + r() * 0.3), s, 3, 0.16), iceMat);
    const a = r() * Math.PI * 2;
    const d = 1.6 + r() * 7;
    cube.position.set(Math.cos(a) * d * 1.2, 0.3 + r() * 1.4, Math.sin(a) * d);
    cube.rotation.set(r() * 3, r() * 3, r() * 3);
    cube.castShadow = true;
    scene.add(cube);
  }
  const can = await buildCan(flavourById("fog-line")!);
  can.rotation.set(-Math.PI / 2, 0, -0.55);
  can.position.set(0, 1.15, 0);
  scene.add(can);
  const drops = condensation(500);
  drops.rotation.copy(can.rotation);
  drops.position.copy(can.position);
  scene.add(drops);
  keyLight(scene, { dir: [-6, 14, 4], intensity: 3.6, color: "#fff6ea", radius: 10, size: 16 });
  scene.add(new THREE.HemisphereLight("#f2fbff", "#2c5c52", 0.5));
  const cam = camera(stage, 30, [0, 22, 0.01], [0, 0, 0]);
  stage.renderer.render(scene, cam);
  return [{ file: "sailor/ice.webp", dataUrl: exportCanvas(stage, { quality: 0.86 }).dataUrl }];
}

/** Transparent cut-outs for the shop, picker and bag. */
async function cutout(f: Flavour): Promise<Output[]> {
  const stage = makeStage(700, 1300, { transparent: true, exposure: 1.05 });
  const { scene } = stage;
  const can = await buildCan(f);
  can.rotation.y = -0.14;
  scene.add(can);
  shadowCatcher(scene, 40, 0.22);
  contactShadow(scene, 3, 3, 0, 0, 0.5);
  keyLight(scene, { dir: [-6, 9, 8], intensity: 3, radius: 18, size: 8 });
  // a tall soft-box on the right for the long vertical highlight
  const box = new THREE.RectAreaLight("#ffffff", 6, 2, 10);
  box.position.set(5, 3, 4);
  box.lookAt(0, 2.5, 0);
  scene.add(box);
  scene.add(new THREE.HemisphereLight("#ffffff", "#c8b8a8", 0.8));
  const cam = camera(stage, 26, [0, 3.4, 16.5], [0, 2.55, 0]);
  stage.renderer.render(scene, cam);
  return [{ file: `sailor/can-${f.id}.webp`, dataUrl: exportCanvas(stage, { quality: 0.9 }).dataUrl }];
}

/** The Whole Road box: twelve cans in a kraft case, from above. */
async function box(): Promise<Output[]> {
  const stage = makeStage(2000, 1500, { exposure: 1.05 });
  const { scene } = stage;
  scene.background = new THREE.Color("#ecdccc");
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(120, 120), new THREE.MeshStandardMaterial({ map: paperTexture("#ecdccc", 6, 0.02), roughness: 0.95 }));
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);
  const kraft = new THREE.MeshStandardMaterial({ map: paperTexture("#c4a074", 13, 0.12), roughness: 0.95 });
  const W = 13.2;
  const D = 4.6;
  const H = 2.3;
  const walls: [number, number, number, number, number][] = [
    [W, H, 0.12, 0, D / 2],
    [W, H, 0.12, 0, -D / 2],
    [0.12, H, D, W / 2, 0],
    [0.12, H, D, -W / 2, 0],
  ];
  for (const [w, h, d, x, z] of walls) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), kraft);
    m.position.set(x, h / 2, z);
    m.castShadow = m.receiveShadow = true;
    scene.add(m);
  }
  const lid = new THREE.Mesh(new THREE.BoxGeometry(W, D + 1, 0.1), kraft);
  lid.position.set(0, (D + 1) / 2 - 0.2, -D / 2 - 1.4);
  lid.rotation.x = -0.32;
  lid.castShadow = true;
  scene.add(lid);
  const print = new THREE.Mesh(
    new THREE.PlaneGeometry(W * 0.62, 0.9),
    new THREE.MeshStandardMaterial({ map: canvasTex("THE WHOLE ROAD · TWELVE CANS · MILES 4–36"), transparent: true, roughness: 0.9 }),
  );
  print.position.set(0, -D / 2 + 1.1, -D / 2 + 0.06 + 2.3);
  print.position.set(0, 1.2, 0.07);
  lid.add(print);
  const inner = new THREE.Mesh(new THREE.BoxGeometry(W - 0.2, 0.1, D - 0.2), kraft);
  inner.position.y = 0.05;
  inner.receiveShadow = true;
  scene.add(inner);
  for (let row = 0; row < 2; row++) {
    for (let col = 0; col < 6; col++) {
      const f = flavours[col];
      const can = await buildCan(f);
      can.position.set(-5.4 + col * 2.16, 0.1, -1.1 + row * 2.2);
      can.rotation.y = row ? 0 : 0.6;
      scene.add(can);
    }
  }
  keyLight(scene, { dir: [-8, 16, 6], intensity: 3.2, radius: 14, size: 18 });
  scene.add(new THREE.HemisphereLight("#fff8ef", "#a98a6a", 0.8));
  const cam = camera(stage, 26, [0, 17, 21], [0, 2.2, 0]);
  stage.renderer.render(scene, cam);
  return [{ file: "sailor/box.webp", dataUrl: exportCanvas(stage, { quality: 0.86 }).dataUrl }];
}

export const sailorScenes: Record<string, (p: URLSearchParams) => Promise<Output[]>> = {
  "sailor-portrait": (p) => portrait(flavourById(p.get("flavour") ?? "low-tide")!),
  "sailor-hero": () => hero(),
  "sailor-lineup": () => lineup(),
  "sailor-ice": () => ice(),
  "sailor-cutout": (p) => cutout(flavourById(p.get("flavour") ?? "low-tide")!),
  "sailor-box": () => box(),
};
