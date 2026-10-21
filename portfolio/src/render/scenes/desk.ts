/**
 * The Creator's Desk, built as a real tabletop in centimetres and photographed
 * from one fixed camera. Every interactive object is rendered on its own
 * (transparent, with its own contact shadow) so the site can stack them as
 * separate, clickable layers that line up exactly with the desk underneath.
 */
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { canvasTexture, clothTexture, contactShadow, exportCanvas, imageTexture, knitTexture, makeStage, paperTexture, project, rng, shade, shadowCatcher, shadowGobo, woodTexture, type Stage } from "../kit";
import { buildCan } from "../can";
import { flavours } from "../../projects/sailor/data";
import type { Output } from "./sailor";

const W = 2400;
const H = 1500;
const VIEW = 168; // cm of desk across the frame
const ELEV = 56;

/* ------------------------------------------------------------------ */
/* materials                                                          */
/* ------------------------------------------------------------------ */
const mat = {
  alu: () => new THREE.MeshPhysicalMaterial({ color: "#d8d9dc", metalness: 1, roughness: 0.34, envMapIntensity: 1.25 }),
  aluEdge: () => new THREE.MeshPhysicalMaterial({ color: "#eceef0", metalness: 1, roughness: 0.16, envMapIntensity: 1.6 }),
  navy: () => new THREE.MeshPhysicalMaterial({ color: "#263759", metalness: 0.85, roughness: 0.36, envMapIntensity: 1.0, clearcoat: 0.35, clearcoatRoughness: 0.35 }),
  steel: () => new THREE.MeshPhysicalMaterial({ color: "#d6d9de", metalness: 1, roughness: 0.12, envMapIntensity: 1.8 }),
  black: () => new THREE.MeshPhysicalMaterial({ color: "#0b0b0d", metalness: 0, roughness: 0.25, clearcoat: 1, clearcoatRoughness: 0.03 }),
  paper: (c = "#fbf6ef", seed = 1) => new THREE.MeshStandardMaterial({ map: paperTexture(c, seed), roughness: 0.92 }),
};

function rbox(w: number, h: number, d: number, r: number, m: THREE.Material, seg = 6) {
  const mesh = new THREE.Mesh(new RoundedBoxGeometry(w, h, d, seg, Math.min(r, w / 2, h / 2, d / 2) - 0.001), m);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}
function box(w: number, h: number, d: number, m: THREE.Material | THREE.Material[]) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}
/** A flat rounded-rectangle slab (extruded), lying on the desk. */
function slab(w: number, d: number, t: number, r: number, m: THREE.Material | THREE.Material[], bevel = 0.06) {
  const s = new THREE.Shape();
  const x = -w / 2;
  const y = -d / 2;
  s.moveTo(x + r, y);
  s.lineTo(x + w - r, y);
  s.quadraticCurveTo(x + w, y, x + w, y + r);
  s.lineTo(x + w, y + d - r);
  s.quadraticCurveTo(x + w, y + d, x + w - r, y + d);
  s.lineTo(x + r, y + d);
  s.quadraticCurveTo(x, y + d, x, y + d - r);
  s.lineTo(x, y + r);
  s.quadraticCurveTo(x, y, x + r, y);
  const g = new THREE.ExtrudeGeometry(s, { depth: t, bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 2, curveSegments: 12 });
  // planar UVs across the top face
  const uv = g.attributes.uv as THREE.BufferAttribute;
  const pos = g.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, (pos.getX(i) + w / 2) / w, (pos.getY(i) + d / 2) / d);
  g.rotateX(-Math.PI / 2);
  const mesh = new THREE.Mesh(g, m);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}
function texFrom(w: number, h: number, draw: (g: CanvasRenderingContext2D, w: number, h: number) => void) {
  const t = canvasTexture(w, h, draw);
  t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
  return t;
}
function roundRect(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  g.beginPath();
  g.roundRect(x, y, w, h, r);
}

/* ------------------------------------------------------------------ */
/* the MacBook-inspired laptop                                         */
/* ------------------------------------------------------------------ */
const LAPTOP = { w: 30.4, d: 21.5, base: 1.13, lid: 0.52, open: 108 };

function keyboardTexture() {
  return texFrom(2048, 1448, (g, w, h) => {
    g.clearRect(0, 0, w, h);
    const u = w / 30.4; // px per cm
    // keyboard well
    const kx = 2.1 * u;
    const ky = 1.6 * u;
    const kw = w - 4.2 * u;
    const kh = 10.2 * u;
    g.fillStyle = "rgba(60,60,64,0.18)";
    roundRect(g, kx - 6, ky - 6, kw + 12, kh + 12, 14);
    g.fill();
    const rows = [14, 14, 14, 13, 12, 10];
    const keyH = (kh - 5 * 0.16 * u) / 6;
    for (let r = 0; r < 6; r++) {
      const n = rows[r];
      const y = ky + r * (keyH + 0.16 * u);
      const hh = r === 0 ? keyH * 0.55 : keyH;
      const yy = r === 0 ? y + keyH * 0.45 : y;
      let x = kx;
      const widths: number[] = [];
      if (r === 5) widths.push(1, 1, 1, 1.3, 5.6, 1.3, 1, 1, 1, 1);
      else for (let i = 0; i < n; i++) widths.push(r === 1 && i === n - 1 ? 1.5 : r === 3 && (i === 0 || i === n - 1) ? 1.8 : r === 4 && (i === 0 || i === n - 1) ? 2.3 : r === 2 && i === 0 ? 1.5 : 1);
      const total = widths.reduce((a, b) => a + b, 0);
      const gap = 0.16 * u;
      const unit = (kw - gap * (widths.length - 1)) / total;
      for (const kwid of widths) {
        const ww = kwid * unit;
        const grd = g.createLinearGradient(0, yy, 0, yy + hh);
        grd.addColorStop(0, "#2a2a2e");
        grd.addColorStop(1, "#141416");
        g.fillStyle = grd;
        roundRect(g, x, yy, ww, hh, 7);
        g.fill();
        g.strokeStyle = "rgba(255,255,255,0.08)";
        g.lineWidth = 1.5;
        g.stroke();
        x += ww + gap;
      }
    }
    // Touch ID key highlight
    g.fillStyle = "rgba(255,255,255,0.05)";
    // speaker grilles
    g.fillStyle = "rgba(40,40,44,0.35)";
    const r0 = rng(3);
    for (const side of [0.9 * u, w - 1.6 * u]) {
      for (let yy = ky; yy < ky + kh; yy += 9) for (let xx = 0; xx < 0.7 * u; xx += 9) if (r0() > 0.02) g.fillRect(side + xx, yy, 3, 3);
    }
    // trackpad
    const tw = 12.8 * u;
    const th = 8.2 * u;
    const tx = (w - tw) / 2;
    const ty = ky + kh + 1.1 * u;
    const tg = g.createLinearGradient(0, ty, 0, ty + th);
    tg.addColorStop(0, "rgba(255,255,255,0.10)");
    tg.addColorStop(1, "rgba(0,0,0,0.06)");
    g.fillStyle = tg;
    roundRect(g, tx, ty, tw, th, 22);
    g.fill();
    g.strokeStyle = "rgba(90,90,96,0.35)";
    g.lineWidth = 2;
    g.stroke();
  });
}

function screenTexture() {
  return texFrom(1600, 1040, (g, w, h) => {
    // a calm desktop: blush gradient wallpaper, a Finder-like window with the folder
    const bg = g.createLinearGradient(0, 0, w, h);
    bg.addColorStop(0, "#f6d7d4");
    bg.addColorStop(0.55, "#e3a9b2");
    bg.addColorStop(1, "#9e5163");
    g.fillStyle = bg;
    g.fillRect(0, 0, w, h);
    const glow = g.createRadialGradient(w * 0.3, h * 0.2, 10, w * 0.3, h * 0.2, w * 0.7);
    glow.addColorStop(0, "rgba(255,255,255,0.55)");
    glow.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = glow;
    g.fillRect(0, 0, w, h);
    // menu bar
    g.fillStyle = "rgba(255,255,255,0.35)";
    g.fillRect(0, 0, w, 28);
    // window
    g.shadowColor = "rgba(60,20,30,0.35)";
    g.shadowBlur = 40;
    g.shadowOffsetY = 14;
    g.fillStyle = "#fbf7f2";
    roundRect(g, w * 0.14, h * 0.16, w * 0.72, h * 0.68, 22);
    g.fill();
    g.shadowColor = "transparent";
    g.fillStyle = "#f1e8e2";
    roundRect(g, w * 0.14, h * 0.16, w * 0.72, 56, 22);
    g.fill();
    g.fillRect(w * 0.14, h * 0.16 + 30, w * 0.72, 26);
    for (const [i, c] of ["#ec6a5e", "#f4bf4f", "#61c554"].entries()) {
      g.fillStyle = c;
      g.beginPath();
      g.arc(w * 0.14 + 30 + i * 26, h * 0.16 + 28, 8, 0, Math.PI * 2);
      g.fill();
    }
    g.fillStyle = "#241d1f";
    g.font = "400 96px 'Instrument Serif'";
    g.fillText("Four", w * 0.2, h * 0.38);
    g.font = "italic 400 96px 'Instrument Serif'";
    g.fillStyle = "#8e3b4d";
    g.fillText("worlds", w * 0.2 + 190, h * 0.38);
    const colours = ["#e7bfa8", "#2a2326", "#a2472a", "#efe3d2"];
    colours.forEach((c, i) => {
      g.fillStyle = c;
      roundRect(g, w * 0.2 + i * (w * 0.145), h * 0.46, w * 0.13, h * 0.28, 12);
      g.fill();
    });
  });
}

function buildLaptop(screenTex?: THREE.Texture) {
  const group = new THREE.Group();
  const { w, d, base, lid } = LAPTOP;
  const alu = mat.alu();
  // base, slightly tapered look via two stacked rounded boxes
  const b = rbox(w, base, d, 0.55, alu, 8);
  b.position.y = base / 2;
  group.add(b);
  // rubber feet shadow line
  const lip = rbox(w - 0.6, 0.08, d - 0.6, 0.3, new THREE.MeshStandardMaterial({ color: "#7d7f84", roughness: 0.6, metalness: 0.5 }));
  lip.position.y = 0.04;
  group.add(lip);
  // keyboard deck
  const deck = new THREE.Mesh(new THREE.PlaneGeometry(w - 0.4, d - 0.4), new THREE.MeshPhysicalMaterial({ map: keyboardTexture(), transparent: true, roughness: 0.5, metalness: 0.2 }));
  deck.rotation.x = -Math.PI / 2;
  deck.position.y = base + 0.012;
  deck.receiveShadow = true;
  group.add(deck);
  // thumb notch on the front edge
  const notch = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.5, 0.3, 32, 1, false, 0, Math.PI), new THREE.MeshStandardMaterial({ color: "#a7a9ae", metalness: 1, roughness: 0.3 }));
  notch.rotation.z = Math.PI / 2;
  notch.rotation.y = Math.PI / 2;
  notch.position.set(0, base - 0.12, d / 2 - 0.02);
  notch.scale.set(1, 0.6, 0.35);
  group.add(notch);
  // hinge
  const hinge = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, w - 6, 32), new THREE.MeshPhysicalMaterial({ color: "#2b2c2f", metalness: 0.8, roughness: 0.35 }));
  hinge.rotation.z = Math.PI / 2;
  hinge.position.set(0, base + 0.05, -d / 2 + 0.45);
  hinge.castShadow = true;
  group.add(hinge);

  // lid on a pivot at the back edge
  const pivot = new THREE.Group();
  pivot.position.set(0, base + 0.05, -d / 2 + 0.45);
  pivot.rotation.x = -THREE.MathUtils.degToRad(LAPTOP.open - 90);
  group.add(pivot);
  const lidD = d - 0.3;
  const shell = rbox(w, lidD, lid, 0.5, alu, 8);
  shell.position.set(0, lidD / 2, -lid / 2);
  pivot.add(shell);
  // glass bezel (black) and the display
  const bezel = new THREE.Mesh(new RoundedBoxGeometry(w - 0.25, lidD - 0.25, 0.04, 4, 0.45), mat.black());
  bezel.position.set(0, lidD / 2, 0.01);
  pivot.add(bezel);
  const sw = w - 1.4;
  const sh = lidD - 2.1;
  const display = new THREE.Mesh(
    new THREE.PlaneGeometry(sw, sh),
    new THREE.MeshPhysicalMaterial({ map: screenTex ?? screenTexture(), emissive: "#ffffff", emissiveMap: screenTex ?? screenTexture(), emissiveIntensity: 0.55, roughness: 0.08, clearcoat: 1, clearcoatRoughness: 0.02, metalness: 0 }),
  );
  display.position.set(0, lidD / 2 + 0.25, 0.04);
  display.name = "display";
  pivot.add(display);
  // camera notch
  const cam = new THREE.Mesh(new RoundedBoxGeometry(2.4, 0.55, 0.02, 2, 0.2), mat.black());
  cam.position.set(0, lidD - 0.55, 0.05);
  pivot.add(cam);
  // anchors for the live screen overlay
  const anchors = [
    [-sw / 2, lidD / 2 + 0.25 + sh / 2],
    [sw / 2, lidD / 2 + 0.25 + sh / 2],
    [sw / 2, lidD / 2 + 0.25 - sh / 2],
    [-sw / 2, lidD / 2 + 0.25 - sh / 2],
  ].map(([x, y]) => {
    const o = new THREE.Object3D();
    o.position.set(x, y, 0.05);
    pivot.add(o);
    return o;
  });
  return { group, anchors };
}

/* ------------------------------------------------------------------ */
/* AirPods Max-inspired headphones, navy                               */
/* ------------------------------------------------------------------ */
function buildHeadphones() {
  const group = new THREE.Group();
  const navy = mat.navy();
  const steel = mat.steel();
  const cushion = new THREE.MeshStandardMaterial({ map: knitTexture("#1c2436", 5, 21), roughness: 1, color: "#ffffff" });
  const canopyTex = knitTexture("#2c3650", 4, 9);
  canopyTex.repeat.set(6, 1);
  const canopy = new THREE.MeshStandardMaterial({ map: canopyTex, roughness: 1, envMapIntensity: 0.4 });
  const sep = 8.2; // half distance between cup centres

  for (const side of [-1, 1]) {
    const cupG = new THREE.Group();
    cupG.position.set(side * sep, 4.7, 0);
    // anodised aluminium cup: tall rounded rectangle
    const cup = rbox(3.5, 9.3, 8.0, 1.7, navy, 12);
    cup.position.x = side * 0.4;
    cupG.add(cup);
    // the knit cushion faces inward
    const cush = rbox(2.4, 8.4, 7.1, 1.1, cushion, 8);
    cush.position.x = -side * 1.6;
    cupG.add(cush);
    // a fine chamfer highlight on the outer face
    const face = rbox(0.2, 8.6, 7.2, 0.1, mat.aluEdge(), 4);
    face.position.x = side * 1.98;
    face.material = navy.clone();
    (face.material as THREE.MeshPhysicalMaterial).roughness = 0.28;
    cupG.add(face);
    // pivot hinge on top
    const hingeM = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 1.2, 24), steel);
    hingeM.position.set(side * 0.4, 4.9, 0);
    hingeM.castShadow = true;
    cupG.add(hingeM);
    if (side === 1) {
      // digital crown + noise-control button
      const crown = new THREE.Mesh(new THREE.CylinderGeometry(0.75, 0.75, 0.55, 48), new THREE.MeshPhysicalMaterial({ color: "#2b3956", metalness: 1, roughness: 0.25 }));
      crown.position.set(0.9, 4.65, -1.8);
      crown.castShadow = true;
      cupG.add(crown);
      const btn = rbox(0.5, 0.25, 1.6, 0.12, navy, 3);
      btn.position.set(0.9, 4.62, 1.2);
      cupG.add(btn);
    }
    group.add(cupG);
    // telescoping steel arm
    const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 3.6, 20), steel);
    arm.position.set(side * (sep + 0.4), 9.6 + 1.8, 0);
    arm.castShadow = true;
    group.add(arm);
  }
  // stainless headband frame + mesh canopy
  const rx = sep + 0.4;
  const top = 11.4;
  const arc = new THREE.CatmullRomCurve3(
    Array.from({ length: 21 }, (_, i) => {
      const a = Math.PI * (i / 20);
      return new THREE.Vector3(-Math.cos(a) * rx, top + Math.sin(a) * 6.8, 0);
    }),
  );
  for (const z of [-1.1, 1.1]) {
    const rail = new THREE.Mesh(new THREE.TubeGeometry(arc, 80, 0.15, 12, false), steel);
    rail.position.z = z;
    rail.castShadow = true;
    group.add(rail);
  }
  // the canopy: a sagging ribbon slightly below the frame
  const canopyCurve = new THREE.CatmullRomCurve3(
    Array.from({ length: 21 }, (_, i) => {
      const a = Math.PI * (i / 20);
      return new THREE.Vector3(-Math.cos(a) * (rx - 0.2), top - 0.4 + Math.sin(a) * 5.9, 0);
    }),
  );
  const pts = canopyCurve.getPoints(90);
  const ribbon = new THREE.BufferGeometry();
  const verts: number[] = [];
  const uvs: number[] = [];
  const idx: number[] = [];
  const half = 2.1;
  pts.forEach((p, i) => {
    const t = i / (pts.length - 1);
    verts.push(p.x, p.y, -half, p.x, p.y, half);
    uvs.push(t, 0, t, 1);
    if (i > 0) {
      const a = (i - 1) * 2;
      idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
  });
  ribbon.setAttribute("position", new THREE.Float32BufferAttribute(verts, 3));
  ribbon.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  ribbon.setIndex(idx);
  ribbon.computeVertexNormals();
  const band = new THREE.Mesh(ribbon, canopy);
  (band.material as THREE.MeshStandardMaterial).side = THREE.DoubleSide;
  band.castShadow = true;
  group.add(band);
  return group;
}

/* ------------------------------------------------------------------ */
/* paper things                                                       */
/* ------------------------------------------------------------------ */
function handwritingTexture(lines: string[], opts: { title?: string; w?: number; h?: number; ink?: string; size?: number; base?: string } = {}) {
  const w = opts.w ?? 1200;
  const h = opts.h ?? 1700;
  const paper = paperTexture(opts.base ?? "#fbf6ef", 5).image as HTMLCanvasElement;
  return texFrom(w, h, (g) => {
    g.drawImage(paper, 0, 0, w, h);
    g.fillStyle = opts.ink ?? "#3b2a33";
    const size = opts.size ?? 56;
    g.font = `600 ${size}px Caveat`;
    let y = 170;
    if (opts.title) {
      g.font = `600 ${size * 1.25}px Caveat`;
      g.fillText(opts.title, 110, y);
      y += size * 1.8;
      g.font = `400 ${size}px Caveat`;
    }
    const r = rng(9);
    for (const line of lines) {
      g.save();
      g.translate(110, y);
      g.rotate((r() - 0.5) * 0.01);
      g.fillText(line, 0, 0);
      g.restore();
      y += size * 1.35;
    }
  });
}

function buildLetter() {
  const group = new THREE.Group();
  const tex = handwritingTexture(
    [
      "I'm at the very start of a design",
      "career, so I made the evidence",
      "instead: four small worlds, each",
      "built to answer one question.",
      "",
      "I want to get good at the part",
      "of interfaces you can touch.",
      "",
      "If anything here made you curious,",
      "write to me. I reply to everything.",
    ],
    { title: "Hi — thank you for opening this." },
  );
  const w = 15.5;
  const h = 21.5;
  // folded in thirds and opened again, so it tents slightly
  const thirds = [0, 1, 2].map((i) => {
    const t = tex.clone();
    t.needsUpdate = true;
    t.repeat.set(1, 1 / 3);
    t.offset.set(0, (2 - i) / 3);
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h / 3), new THREE.MeshStandardMaterial({ map: t, roughness: 0.9, side: THREE.DoubleSide }));
    m.castShadow = true;
    m.receiveShadow = true;
    return m;
  });
  const lift = 0.06;
  thirds[0].rotation.x = -Math.PI / 2 + lift;
  thirds[0].position.set(0, Math.sin(lift) * (h / 6), -h / 3);
  thirds[1].rotation.x = -Math.PI / 2;
  thirds[1].position.set(0, 0.05, 0);
  thirds[2].rotation.x = -Math.PI / 2 - lift;
  thirds[2].position.set(0, Math.sin(lift) * (h / 6), h / 3);
  thirds.forEach((m) => group.add(m));
  return group;
}

function buildEnvelope() {
  const group = new THREE.Group();
  const w = 17;
  const h = 11.5;
  const tex = texFrom(1360, 920, (g, cw, ch) => {
    const p = paperTexture("#f0cdcc", 12).image as HTMLCanvasElement;
    g.drawImage(p, 0, 0, cw, ch);
    // flap fold lines and a soft shadow under the flap
    g.strokeStyle = "rgba(120,60,70,0.25)";
    g.lineWidth = 3;
    g.beginPath();
    g.moveTo(0, 0);
    g.lineTo(cw / 2, ch * 0.58);
    g.lineTo(cw, 0);
    g.stroke();
    g.strokeStyle = "rgba(120,60,70,0.12)";
    g.beginPath();
    g.moveTo(0, ch);
    g.lineTo(cw * 0.42, ch * 0.5);
    g.moveTo(cw, ch);
    g.lineTo(cw * 0.58, ch * 0.5);
    g.stroke();
    g.fillStyle = "#6a2a39";
    g.font = "600 64px Caveat";
    g.fillText("for potential collaborators", cw * 0.1, ch * 0.86);
  });
  const env = slab(w, h, 0.25, 0.25, new THREE.MeshStandardMaterial({ map: tex, roughness: 0.85 }), 0.04);
  group.add(env);
  // wax seal: a glossy rosewood disc with a pressed rim
  const wax = new THREE.MeshPhysicalMaterial({ color: "#8e2f45", roughness: 0.32, clearcoat: 0.8, clearcoatRoughness: 0.2 });
  const seal = new THREE.Mesh(new THREE.CylinderGeometry(1.75, 1.95, 0.35, 48), wax);
  seal.position.set(0, 0.45, -h / 2 + h * 0.58);
  seal.castShadow = true;
  group.add(seal);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(1.15, 0.14, 12, 48), wax);
  rim.rotation.x = -Math.PI / 2;
  rim.position.set(0, 0.64, seal.position.z);
  group.add(rim);
  const heart = new THREE.Mesh(new THREE.SphereGeometry(0.55, 24, 12), wax);
  heart.scale.set(1, 0.25, 1);
  heart.position.set(0, 0.62, seal.position.z);
  group.add(heart);
  return group;
}

async function buildPolaroids(covers: THREE.Texture[]) {
  const group = new THREE.Group();
  const r = rng(4);
  for (let i = 0; i < 3; i++) {
    const p = new THREE.Group();
    const frame = slab(8.8, 10.7, 0.08, 0.15, new THREE.MeshStandardMaterial({ map: paperTexture("#fbf9f4", 30 + i), roughness: 0.75 }), 0.02);
    p.add(frame);
    const photo = new THREE.Mesh(new THREE.PlaneGeometry(7.9, 7.9), new THREE.MeshPhysicalMaterial({ map: covers[i], roughness: 0.25, clearcoat: 0.6 }));
    photo.rotation.x = -Math.PI / 2;
    photo.position.set(0, 0.13, -0.95);
    photo.receiveShadow = true;
    p.add(photo);
    p.position.set((r() - 0.5) * 2.4, i * 0.16, (r() - 0.5) * 2);
    p.rotation.y = (r() - 0.5) * 0.5 + (i - 1) * 0.22;
    group.add(p);
  }
  return group;
}

function buildSketchbook() {
  const group = new THREE.Group();
  const w = 21;
  const d = 27.5;
  const cloth = clothTexture("#d79aa4", 13, 3);
  const coverM = new THREE.MeshStandardMaterial({ map: cloth, roughness: 0.95 });
  const pagesTex = canvasTexture(256, 64, (g, cw, ch) => {
    g.fillStyle = "#f6efe6";
    g.fillRect(0, 0, cw, ch);
    for (let y = 0; y < ch; y += 2) {
      g.fillStyle = `rgba(120,90,80,${0.08 + Math.random() * 0.08})`;
      g.fillRect(0, y, cw, 1);
    }
  });
  const pages = box(w - 0.6, 1.2, d - 0.5, new THREE.MeshStandardMaterial({ map: pagesTex, roughness: 0.9 }));
  pages.position.y = 0.75;
  group.add(pages);
  const bottom = slab(w, d, 0.2, 0.6, coverM, 0.05);
  group.add(bottom);
  const top = slab(w, d, 0.2, 0.6, coverM, 0.05);
  top.position.y = 1.4;
  group.add(top);
  // spine
  const spine = rbox(0.5, 1.8, d, 0.25, coverM, 4);
  spine.position.set(-w / 2 + 0.1, 0.8, 0);
  group.add(spine);
  // a debossed label
  const label = new THREE.Mesh(
    new THREE.PlaneGeometry(9, 3),
    new THREE.MeshStandardMaterial({
      map: texFrom(900, 300, (g, cw, ch) => {
        g.fillStyle = "#c98896";
        g.fillRect(0, 0, cw, ch);
        g.strokeStyle = "rgba(94,36,51,0.35)";
        g.lineWidth = 6;
        g.strokeRect(10, 10, cw - 20, ch - 20);
        g.fillStyle = "rgba(255,240,236,0.92)";
        g.font = "italic 400 120px 'Instrument Serif'";
        g.textAlign = "center";
        g.fillText("Sketches", cw / 2, ch * 0.68);
      }),
      roughness: 0.9,
    }),
  );
  label.rotation.x = -Math.PI / 2;
  label.position.set(0.5, 1.66, -4);
  group.add(label);
  // elastic closure
  const elastic = box(1.1, 1.9, d + 0.2, new THREE.MeshStandardMaterial({ color: "#6e2537", roughness: 0.75 }));
  elastic.position.set(w / 2 - 2.6, 0.8, 0);
  elastic.scale.set(1, 1, 1);
  group.add(elastic);
  // ribbon bookmark
  const ribbon = box(0.8, 0.04, 6, new THREE.MeshStandardMaterial({ color: "#9b4a5b", roughness: 0.6 }));
  ribbon.position.set(-3, 0.05, d / 2 + 2.6);
  ribbon.rotation.y = 0.18;
  group.add(ribbon);
  return group;
}

function buildFanDeck() {
  const group = new THREE.Group();
  const palettes = [
    ["#fbf7f2", "#f3d9d6", "#e8bcc0", "#d8a1a8"],
    ["#c7798a", "#8e3b4d", "#5e2433", "#241d1f"],
    ["#e7bfa8", "#173f73", "#f2c94c", "#2f6b4f"],
    ["#1d1b20", "#b33b2e", "#efe3d2", "#7a6f66"],
    ["#a2472a", "#e8a33d", "#f3e2c3", "#3b2a20"],
    ["#f5f1e8", "#2e5e4e", "#d9c7a7", "#28323d"],
    ["#eadfd4", "#c8b6a6", "#9b8a7d", "#4a3f39"],
  ];
  const n = palettes.length;
  palettes.forEach((pal, i) => {
    const tex = texFrom(256, 1024, (g, cw, ch) => {
      g.fillStyle = "#fbf9f6";
      g.fillRect(0, 0, cw, ch);
      pal.forEach((c, j) => {
        g.fillStyle = c;
        g.fillRect(14, 14 + j * 210, cw - 28, 196);
      });
      g.fillStyle = "#6a5c5f";
      g.font = "600 30px 'Hanken Grotesk'";
      g.fillText(`NO. ${String(i + 1).padStart(2, "0")}`, 18, ch - 60);
    });
    const strip = slab(4.2, 17, 0.06, 0.4, new THREE.MeshStandardMaterial({ map: tex, roughness: 0.7 }), 0.01);
    // pivot at the bottom end
    const p = new THREE.Group();
    strip.position.set(0, 0, -17 / 2 + 1.2);
    p.add(strip);
    p.position.y = i * 0.07;
    p.rotation.y = 0.75 - (i / (n - 1)) * 1.3;
    group.add(p);
  });
  const rivet = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, n * 0.07 + 0.25, 32), mat.steel());
  rivet.position.y = (n * 0.07) / 2;
  rivet.castShadow = true;
  group.add(rivet);
  return group;
}

async function buildPinboard(covers: THREE.Texture[]) {
  const group = new THREE.Group();
  const w = 32;
  const d = 23;
  const walnut = new THREE.MeshPhysicalMaterial({ map: woodTexture(21, "#6b4a35", "#3d2618", 1024, 512), roughness: 0.5, clearcoat: 0.3 });
  const frame = slab(w, d, 1.4, 0.4, walnut, 0.1);
  group.add(frame);
  const cork = new THREE.Mesh(
    new THREE.PlaneGeometry(w - 2.6, d - 2.6),
    new THREE.MeshStandardMaterial({
      map: canvasTexture(1024, 768, (g, cw, ch) => {
        g.fillStyle = "#c69a6c";
        g.fillRect(0, 0, cw, ch);
        const r = rng(17);
        for (let i = 0; i < 26000; i++) {
          g.fillStyle = r() > 0.5 ? `rgba(120,80,45,${0.12 + r() * 0.25})` : `rgba(240,210,170,${0.1 + r() * 0.2})`;
          g.fillRect(r() * cw, r() * ch, 1 + r() * 3, 1 + r() * 3);
        }
      }),
      roughness: 1,
    }),
  );
  cork.rotation.x = -Math.PI / 2;
  cork.position.y = 1.52;
  cork.receiveShadow = true;
  group.add(cork);
  const slots = [
    [-7.2, -4.4, -0.05],
    [7.4, -4.6, 0.06],
    [-7.0, 4.8, 0.04],
    [7.6, 4.6, -0.07],
  ];
  const pinColours = ["#c7798a", "#8e3b4d", "#e8bcc0", "#f2f0ee"];
  slots.forEach(([x, z, rot], i) => {
    const card = new THREE.Group();
    const back = slab(11, 8.6, 0.05, 0.1, new THREE.MeshStandardMaterial({ color: "#fdfbf8", roughness: 0.8 }), 0.01);
    card.add(back);
    const img = new THREE.Mesh(new THREE.PlaneGeometry(10.2, 7.65), new THREE.MeshPhysicalMaterial({ map: covers[i], roughness: 0.3, clearcoat: 0.4 }));
    img.rotation.x = -Math.PI / 2;
    img.position.y = 0.09;
    img.receiveShadow = true;
    card.add(img);
    card.position.set(x, 1.56, z);
    card.rotation.y = rot;
    group.add(card);
    const pin = new THREE.Group();
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.42, 24, 16), new THREE.MeshPhysicalMaterial({ color: pinColours[i], roughness: 0.2, clearcoat: 1 }));
    head.position.y = 0.55;
    head.castShadow = true;
    const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.32, 0.5, 16), head.material);
    neck.position.y = 0.2;
    neck.castShadow = true;
    pin.add(head, neck);
    pin.position.set(x, 1.6, z - 3.3);
    group.add(pin);
  });
  return group;
}

function buildCardBox(open: boolean) {
  const group = new THREE.Group();
  const walnut = new THREE.MeshPhysicalMaterial({ map: woodTexture(33, "#7a5038", "#3d2618", 1024, 512), roughness: 0.42, clearcoat: 0.5, clearcoatRoughness: 0.3 });
  const w = 30;
  const d = 15;
  const hgt = 9;
  const t = 0.8;
  // walls
  const front = box(w, hgt, t, walnut);
  front.position.set(0, hgt / 2, d / 2 - t / 2);
  const backW = box(w, hgt, t, walnut);
  backW.position.set(0, hgt / 2, -d / 2 + t / 2);
  const left = box(t, hgt, d, walnut);
  left.position.set(-w / 2 + t / 2, hgt / 2, 0);
  const right = box(t, hgt, d, walnut);
  right.position.set(w / 2 - t / 2, hgt / 2, 0);
  const floor = box(w, t, d, walnut);
  floor.position.y = t / 2;
  group.add(front, backW, left, right, floor);
  // brass label holder + pull on the front
  const brass = new THREE.MeshPhysicalMaterial({ color: "#d6a77c", metalness: 1, roughness: 0.28 });
  const holder = rbox(7, 2.6, 0.25, 0.2, brass, 3);
  holder.position.set(0, hgt * 0.62, d / 2 + 0.1);
  group.add(holder);
  const card = new THREE.Mesh(
    new THREE.PlaneGeometry(6.2, 2),
    new THREE.MeshStandardMaterial({
      map: texFrom(620, 200, (g, cw, ch) => {
        g.fillStyle = "#fbf6ef";
        g.fillRect(0, 0, cw, ch);
        g.fillStyle = "#5e2433";
        g.font = "600 84px Caveat";
        g.textAlign = "center";
        g.fillText("experiments", cw / 2, ch * 0.7);
      }),
    }),
  );
  card.position.set(0, hgt * 0.62, d / 2 + 0.24);
  group.add(card);
  const pull = new THREE.Mesh(new THREE.TorusGeometry(1.1, 0.18, 12, 32, Math.PI), brass);
  pull.rotation.z = Math.PI;
  pull.position.set(0, hgt * 0.32, d / 2 + 0.3);
  pull.castShadow = true;
  group.add(pull);
  // index cards inside
  const r = rng(8);
  const tabs = ["#e8bcc0", "#c7798a", "#efe3d2", "#d8a1a8", "#8e3b4d", "#f3d9d6"];
  for (let i = 0; i < 16; i++) {
    const c = new THREE.Group();
    const tall = 7.6 + (i % 4 === 0 ? 1.2 : 0);
    const sheet = box(w - 2.6, tall, 0.06, new THREE.MeshStandardMaterial({ color: shade("#fbf6ef", (r() - 0.5) * 0.04), roughness: 0.9 }));
    sheet.position.y = tall / 2 + t;
    c.add(sheet);
    if (i % 3 === 0) {
      const tab = box(4, 1.2, 0.07, new THREE.MeshStandardMaterial({ color: tabs[(i / 3) % tabs.length], roughness: 0.8 }));
      tab.position.set(-10 + ((i * 3.7) % 20), tall + t + 0.5, 0);
      c.add(tab);
    }
    c.position.z = -d / 2 + 1.6 + i * 0.75;
    c.rotation.x = open ? -0.22 - i * 0.008 : -0.08;
    group.add(c);
  }
  // lid: hinged at the back, open or closed
  const lid = new THREE.Group();
  lid.position.set(0, hgt, -d / 2);
  const lidSlab = box(w + 0.4, 0.9, d + 0.4, walnut);
  lidSlab.position.set(0, 0.45, d / 2);
  lid.add(lidSlab);
  lid.rotation.x = open ? -1.95 : 0;
  group.add(lid);
  return group;
}

function buildMug() {
  const group = new THREE.Group();
  const glaze = new THREE.MeshPhysicalMaterial({ color: "#efd6d3", roughness: 0.35, clearcoat: 1, clearcoatRoughness: 0.12 });
  const pts: THREE.Vector2[] = [];
  for (let i = 0; i <= 20; i++) {
    const t = i / 20;
    pts.push(new THREE.Vector2(4.2 - Math.pow(1 - t, 6) * 0.5, t * 9.4));
  }
  pts.push(new THREE.Vector2(3.8, 9.4), new THREE.Vector2(3.8, 1));
  const body = new THREE.Mesh(new THREE.LatheGeometry(pts, 96), glaze);
  body.castShadow = true;
  body.receiveShadow = true;
  group.add(body);
  const coffee = new THREE.Mesh(new THREE.CircleGeometry(3.8, 64), new THREE.MeshPhysicalMaterial({ color: "#3a2116", roughness: 0.1, clearcoat: 1 }));
  coffee.rotation.x = -Math.PI / 2;
  coffee.position.y = 8.4;
  group.add(coffee);
  const crema = new THREE.Mesh(new THREE.RingGeometry(2.9, 3.8, 64), new THREE.MeshStandardMaterial({ color: "#8a5a3c", roughness: 0.6 }));
  crema.rotation.x = -Math.PI / 2;
  crema.position.y = 8.41;
  group.add(crema);
  const handle = new THREE.Mesh(new THREE.TorusGeometry(2.3, 0.55, 20, 48, Math.PI * 1.15), glaze);
  handle.rotation.z = -Math.PI * 0.57;
  handle.position.set(4.3, 5, 0);
  handle.castShadow = true;
  group.add(handle);
  return group;
}

function buildPencil(colour: string) {
  const group = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.38, 15, 6), new THREE.MeshPhysicalMaterial({ color: colour, roughness: 0.4, clearcoat: 0.6 }));
  body.rotation.z = Math.PI / 2;
  body.castShadow = true;
  group.add(body);
  const wood = new THREE.Mesh(new THREE.ConeGeometry(0.38, 1.8, 6), new THREE.MeshStandardMaterial({ color: "#e2c39b", roughness: 0.8 }));
  wood.rotation.z = -Math.PI / 2;
  wood.position.x = 8.4;
  wood.castShadow = true;
  group.add(wood);
  const lead = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.55, 6), new THREE.MeshStandardMaterial({ color: "#2b2b2b", roughness: 0.5 }));
  lead.rotation.z = -Math.PI / 2;
  lead.position.x = 9.5;
  group.add(lead);
  group.position.y = 0.38;
  return group;
}

/* ------------------------------------------------------------------ */
/* the composition                                                    */
/* ------------------------------------------------------------------ */
type Place = { x: number; z: number; ry: number; y?: number };
const places: Record<string, Place> = {
  laptop: { x: -2, z: -15, ry: 0 },
  sketchbook: { x: -56, z: -18, ry: 0.16 },
  moodboard: { x: 52, z: -24, ry: -0.2 },
  pinboard: { x: -55, z: 24, ry: -0.06 },
  letter: { x: -18, z: 21, ry: 0.12 },
  headphones: { x: 37, z: 14, ry: -0.42 },
  photos: { x: 66, z: 8, ry: 0.1 },
  envelope: { x: 15, z: 35, ry: -0.08 },
  drawer: { x: -10, z: 45, ry: 0.0 },
  // decoration (in the base)
  mug: { x: 26, z: -27, ry: 0.4 },
  can: { x: 70, z: -40, ry: 0.3 },
  pencils: { x: 12, z: 16, ry: -0.5 },
  mat: { x: -2, z: 4, ry: 0 },
};

function camera() {
  const aspect = W / H;
  const vh = VIEW / aspect;
  const cam = new THREE.OrthographicCamera(-VIEW / 2, VIEW / 2, vh / 2, -vh / 2, 1, 1200);
  const el = THREE.MathUtils.degToRad(ELEV);
  cam.position.set(0, Math.sin(el) * 400, Math.cos(el) * 400 + 2);
  cam.lookAt(0, 0, 2);
  cam.updateProjectionMatrix();
  return cam;
}

function light(stage: Stage) {
  const { scene } = stage;
  const key = new THREE.DirectionalLight("#ffeedd", 3.4);
  key.position.set(-190, 150, -110);
  key.target.position.set(0, 0, 0);
  key.castShadow = true;
  key.shadow.mapSize.set(4096, 4096);
  const c = key.shadow.camera as THREE.OrthographicCamera;
  c.left = -110;
  c.right = 110;
  c.top = 110;
  c.bottom = -110;
  c.near = 1;
  c.far = 600;
  key.shadow.radius = 4;
  key.shadow.bias = -0.0003;
  key.shadow.normalBias = 0.04;
  scene.add(key, key.target);
  scene.add(new THREE.HemisphereLight("#fff6ee", "#8a6a55", 0.35));
  return key;
}

function place(obj: THREE.Object3D, p: Place) {
  obj.position.set(p.x, p.y ?? 0, p.z);
  obj.rotation.y = p.ry;
  return obj;
}

async function coverTextures() {
  const ids = ["sailor", "lightleak", "ranch", "margin"];
  const tex = await Promise.all(ids.map((id) => imageTexture(`/img/covers/${id}.webp`).catch(() => imageTexture("/img/sailor/hero.webp"))));
  return tex;
}

async function build(id: string, opts: { covers: THREE.Texture[] }): Promise<{ obj: THREE.Object3D; anchors?: THREE.Object3D[]; shadow: [number, number] }> {
  switch (id) {
    case "laptop": {
      const { group, anchors } = buildLaptop();
      return { obj: group, anchors, shadow: [34, 26] };
    }
    case "headphones":
      return { obj: buildHeadphones(), shadow: [22, 12] };
    case "sketchbook":
      return { obj: buildSketchbook(), shadow: [24, 31] };
    case "moodboard":
      return { obj: buildFanDeck(), shadow: [20, 18] };
    case "pinboard":
      return { obj: await buildPinboard(opts.covers), shadow: [35, 26] };
    case "letter":
      return { obj: buildLetter(), shadow: [17, 23] };
    case "envelope":
      return { obj: buildEnvelope(), shadow: [19, 13] };
    case "photos":
      return { obj: await buildPolaroids([opts.covers[2], opts.covers[1], opts.covers[0]]), shadow: [13, 14] };
    case "drawer":
      return { obj: buildCardBox(false), shadow: [34, 19] };
    case "drawer-open":
      return { obj: buildCardBox(true), shadow: [34, 19] };
  }
  throw new Error("unknown object " + id);
}

async function baseScene(): Promise<Output[]> {
  const stage = makeStage(W, H, { exposure: 0.88 });
  const { scene } = stage;
  scene.background = new THREE.Color("#a98463");
  const key = light(stage);
  shadowGobo(scene, key, 0.5, 260, 6);
  // oak desk
  const oak = woodTexture(7, "#b88d64", "#7c5638");
  oak.repeat.set(1, 1);
  const desk = new THREE.Mesh(new THREE.PlaneGeometry(320, 200), new THREE.MeshPhysicalMaterial({ map: oak, roughness: 0.55, clearcoat: 0.35, clearcoatRoughness: 0.4 }));
  desk.rotation.x = -Math.PI / 2;
  desk.receiveShadow = true;
  scene.add(desk);
  // blush felt desk mat
  const felt = canvasTexture(2048, 1104, (g, cw, ch) => {
    g.fillStyle = "#dcaaac";
    g.fillRect(0, 0, cw, ch);
    const r = rng(41);
    // matted wool fibres
    for (let i = 0; i < 90000; i++) {
      g.fillStyle = r() > 0.5 ? `rgba(255,236,236,${0.05 + r() * 0.08})` : `rgba(120,50,60,${0.04 + r() * 0.06})`;
      const x = r() * cw;
      const y = r() * ch;
      g.fillRect(x, y, 1 + r() * 4, 1);
    }
    // stitched border
    g.strokeStyle = "rgba(142,59,77,0.45)";
    g.lineWidth = 3;
    g.setLineDash([14, 10]);
    g.beginPath();
    g.roundRect(26, 26, cw - 52, ch - 52, 48);
    g.stroke();
  });
  felt.wrapS = felt.wrapT = THREE.ClampToEdgeWrapping;
  const matMesh = place(slab(104, 56, 0.35, 3.2, new THREE.MeshStandardMaterial({ map: felt, roughness: 1 }), 0.12), places.mat);
  scene.add(matMesh);
  // decoration
  const mug = place(buildMug(), places.mug);
  scene.add(mug);
  contactShadow(scene, 13, 13, places.mug.x, places.mug.z, 0.5, 0.4);
  const can = await buildCan(flavours[0]);
  can.scale.setScalar(3.3);
  place(can, places.can);
  can.traverse((m) => ((m as THREE.Mesh).castShadow = true));
  scene.add(can);
  contactShadow(scene, 9, 9, places.can.x, places.can.z, 0.5);
  const p1 = buildPencil("#8e3b4d");
  const p2 = buildPencil("#e9e1d6");
  p1.position.set(places.pencils.x, 0.75, places.pencils.z);
  p1.rotation.y = places.pencils.ry;
  p2.position.set(places.pencils.x + 1.6, 0.75, places.pencils.z + 1.8);
  p2.rotation.y = places.pencils.ry + 0.08;
  scene.add(p1, p2);
  // soft occlusion under every interactive object, baked into the desk
  const cam = camera();
  stage.renderer.render(scene, cam);
  return [{ file: "desk/base.webp", ...exportCanvas(stage, { quality: 0.86 }) }];
}

async function objectRender(id: string): Promise<Output> {
  const stage = makeStage(W, H, { transparent: true, exposure: 0.88 });
  const { scene } = stage;
  light(stage);
  shadowCatcher(scene, 400, 0.34, id === "laptop" || id === "letter" || id === "envelope" ? 0.36 : 0);
  const covers = await coverTextures();
  const key = id.replace("-open", "");
  const { obj, anchors, shadow } = await build(id, { covers });
  place(obj, places[key]);
  const onMat = ["laptop", "letter", "envelope"].includes(key);
  if (onMat) obj.position.y += 0.36;
  scene.add(obj);
  contactShadow(scene, shadow[0], shadow[1], places[key].x, places[key].z, 0.42, onMat ? 0.38 : 0.02).rotation.z = places[key].ry;
  const cam = camera();
  stage.renderer.render(scene, cam);
  scene.updateMatrixWorld(true);
  const exp = exportCanvas(stage, { crop: true, pad: 6, quality: 0.88 });
  const meta: Record<string, unknown> = { bbox: exp.bbox, width: exp.width, height: exp.height };
  if (anchors) meta.screen = anchors.map((a) => project(cam, a.getWorldPosition(new THREE.Vector3())));
  return { file: `desk/${id}.webp`, dataUrl: exp.dataUrl, meta };
}

const ids = ["sketchbook", "moodboard", "laptop", "pinboard", "letter", "headphones", "photos", "envelope", "drawer", "drawer-open"];

export const deskScenes: Record<string, (p: URLSearchParams) => Promise<Output[]>> = {
  "desk-base": () => baseScene(),
  "desk-objects": async (p) => {
    const only = p.get("only")?.split(" ");
    const outs: Output[] = [];
    const layout: Record<string, unknown> = {};
    for (const id of only ?? ids) {
      const o = await objectRender(id);
      outs.push({ file: o.file, dataUrl: o.dataUrl });
      layout[id] = o.meta;
    }
    outs.push({ file: only ? `src/desk/layout.partial.json` : "src/desk/layout.json", dataUrl: "", meta: { frame: { width: W, height: H }, objects: layout } });
    return outs;
  },
};
