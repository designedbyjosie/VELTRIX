import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import { Motif } from "../projects/sailor/Can";
import type { Flavour } from "../projects/sailor/data";

/* A slim 330 ml can: 58 mm × 146 mm → radius 1, height ≈ 5 units. */
const R = 1;
const BODY_BOTTOM = 0.32;
const BODY_TOP = 4.5;

async function motifImage(f: Flavour, size: number) {
  const svg = renderToStaticMarkup(
    createElement(
      "svg",
      { xmlns: "http://www.w3.org/2000/svg", viewBox: "-30 -30 60 60", width: size, height: size },
      createElement(Motif, { kind: f.motif, color: f.weather.label, ink: f.weather.labelInk }),
    ),
  );
  const img = new Image();
  img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
  await img.decode();
  return img;
}

/** The printed label, laid flat. The front panel is centred horizontally. */
export async function labelCanvas(f: Flavour) {
  const W = 2400;
  const H = 1600;
  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  const g = c.getContext("2d")!;
  const w = f.weather;
  const cx = W / 2;

  g.fillStyle = w.label;
  g.fillRect(0, 0, W, H);
  // subtle print texture
  for (let i = 0; i < 9000; i++) {
    g.fillStyle = `rgba(${Math.random() > 0.5 ? "255,255,255" : "0,0,0"},0.025)`;
    g.fillRect(Math.random() * W, Math.random() * H, 2, 2);
  }
  // top band with the wordmark, repeated round the can
  g.fillStyle = w.band;
  g.fillRect(0, 0, W, 190);
  g.fillStyle = w.label;
  g.font = "800 58px 'Bricolage Grotesque'";
  g.textAlign = "center";
  g.textBaseline = "middle";
  for (const x of [cx, 0, W]) {
    g.save();
    g.translate(x, 100);
    (g as unknown as { letterSpacing: string }).letterSpacing = "12px";
    g.fillText("SAILOR SPRINGS", 0, 0);
    g.restore();
  }
  // thin rule under the band
  g.fillStyle = w.labelInk;
  g.globalAlpha = 0.5;
  g.fillRect(0, 214, W, 4);
  g.globalAlpha = 1;

  // the sun + motif
  g.fillStyle = w.sun;
  g.beginPath();
  g.arc(cx, 560, 270, 0, Math.PI * 2);
  g.fill();
  const motif = await motifImage(f, 620);
  g.drawImage(motif, cx - 310, 560 - 310);

  // horizon line wrapping all the way round
  g.strokeStyle = w.labelInk;
  g.lineWidth = 7;
  g.globalAlpha = 0.55;
  g.beginPath();
  for (let x = 0; x <= W; x += 10) {
    const y = 880 + Math.sin((x / W) * Math.PI * 6) * 16;
    if (x === 0) g.moveTo(x, y);
    else g.lineTo(x, y);
  }
  g.stroke();
  g.globalAlpha = 1;

  // flavour name
  g.fillStyle = w.labelInk;
  const words = f.name.split(" ");
  const size = words.some((x) => x.length > 8) ? 168 : 210;
  g.font = `400 ${size}px 'DM Serif Display'`;
  words.forEach((word, i) => g.fillText(word, cx, 1040 + i * size * 0.98));
  g.font = "600 46px 'Bricolage Grotesque'";
  (g as unknown as { letterSpacing: string }).letterSpacing = "10px";
  g.fillText("SPARKLING BOTANICAL WATER", cx, 1040 + words.length * size * 0.98 + 10);
  // mile badge
  const by = 1040 + words.length * size * 0.98 + 110;
  g.lineWidth = 6;
  g.strokeStyle = w.labelInk;
  g.beginPath();
  g.roundRect(cx - 170, by - 48, 340, 96, 48);
  g.stroke();
  g.font = "800 50px 'Bricolage Grotesque'";
  (g as unknown as { letterSpacing: string }).letterSpacing = "6px";
  g.fillText(`MILE ${f.mile}`, cx, by + 2);

  // side panels: place name set vertically
  g.save();
  g.font = "600 54px 'Bricolage Grotesque'";
  (g as unknown as { letterSpacing: string }).letterSpacing = "14px";
  for (const [x, rot] of [
    [cx - 640, -Math.PI / 2],
    [cx + 640, Math.PI / 2],
  ] as const) {
    g.save();
    g.translate(x, 900);
    g.rotate(rot);
    g.fillText(`${f.place.toUpperCase()} · 330 ML`, 0, 0);
    g.restore();
  }
  g.restore();

  // back panel: ingredients and barcode
  g.textAlign = "left";
  g.font = "600 40px 'Bricolage Grotesque'";
  (g as unknown as { letterSpacing: string }).letterSpacing = "2px";
  const back = 120;
  g.fillText("INGREDIENTS", back, 1080);
  g.font = "400 34px 'Bricolage Grotesque'";
  g.fillText("Sparkling spring water,", back, 1140);
  g.fillText(f.line.toLowerCase() + ".", back, 1186);
  for (let i = 0; i < 34; i++) g.fillRect(back + i * 9, 1280, i % 3 ? 4 : 7, 140);
  g.fillText("Fictional concept", back, 1500);
  g.fillText("not for sale", back, 1546);
  return c;
}

export async function buildCan(f: Flavour) {
  const group = new THREE.Group();
  const label = new THREE.CanvasTexture(await labelCanvas(f));
  label.colorSpace = THREE.SRGBColorSpace;
  label.anisotropy = 16;
  label.wrapS = THREE.RepeatWrapping;
  label.offset.x = 0.5;

  const printed = new THREE.MeshPhysicalMaterial({
    map: label,
    metalness: 0.25,
    roughness: 0.38,
    clearcoat: 1,
    clearcoatRoughness: 0.06,
    envMapIntensity: 1.6,
  });
  const alu = new THREE.MeshPhysicalMaterial({ color: "#d4d6da", metalness: 1, roughness: 0.2, envMapIntensity: 1.8 });
  const aluDark = new THREE.MeshPhysicalMaterial({ color: "#a9acb2", metalness: 1, roughness: 0.32 });

  const body = new THREE.Mesh(new THREE.CylinderGeometry(R, R, BODY_TOP - BODY_BOTTOM, 160, 1, true), printed);
  body.position.y = (BODY_TOP + BODY_BOTTOM) / 2;
  group.add(body);

  // shoulder and neck
  const neck = new THREE.LatheGeometry(
    [
      new THREE.Vector2(R, BODY_TOP),
      new THREE.Vector2(R * 0.99, BODY_TOP + 0.1),
      new THREE.Vector2(R * 0.93, BODY_TOP + 0.3),
      new THREE.Vector2(R * 0.88, BODY_TOP + 0.45),
      new THREE.Vector2(R * 0.875, BODY_TOP + 0.52),
    ],
    160,
  );
  group.add(new THREE.Mesh(neck, alu));
  // rolled rim
  const rim = new THREE.Mesh(new THREE.TorusGeometry(R * 0.875, 0.04, 16, 160), alu);
  rim.rotation.x = Math.PI / 2;
  rim.position.y = BODY_TOP + 0.54;
  group.add(rim);
  // recessed lid
  const lid = new THREE.Mesh(new THREE.CylinderGeometry(R * 0.84, R * 0.84, 0.02, 120), aluDark);
  lid.position.y = BODY_TOP + 0.47;
  group.add(lid);
  const score = new THREE.Mesh(new THREE.TorusGeometry(R * 0.36, 0.012, 8, 64), aluDark);
  score.rotation.x = Math.PI / 2;
  score.scale.set(1, 0.6, 1);
  score.position.set(0, BODY_TOP + 0.485, 0.3);
  group.add(score);
  const tab = new THREE.Mesh(new RoundedBoxGeometry(0.42, 0.03, 0.72, 4, 0.05), alu);
  tab.position.set(0, BODY_TOP + 0.5, -0.05);
  group.add(tab);
  const rivet = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.04, 24), alu);
  rivet.position.set(0, BODY_TOP + 0.51, 0);
  group.add(rivet);

  // base
  const base = new THREE.LatheGeometry(
    [
      new THREE.Vector2(R * 0.7, 0.04),
      new THREE.Vector2(R * 0.8, 0.0),
      new THREE.Vector2(R * 0.9, 0.05),
      new THREE.Vector2(R * 0.97, 0.16),
      new THREE.Vector2(R, BODY_BOTTOM),
    ],
    160,
  );
  group.add(new THREE.Mesh(base, alu));

  group.traverse((o) => {
    if ((o as THREE.Mesh).isMesh) {
      o.castShadow = true;
      o.receiveShadow = true;
    }
  });
  return group;
}

/** Condensation: tiny refractive beads scattered on the label. */
export function condensation(count = 380, seed = 5) {
  let s = seed;
  const r = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  const geo = new THREE.SphereGeometry(1, 10, 8);
  const mat = new THREE.MeshPhysicalMaterial({ color: "#ffffff", roughness: 0.05, transmission: 1, thickness: 0.02, ior: 1.33, transparent: true, opacity: 0.85 });
  const mesh = new THREE.InstancedMesh(geo, mat, count);
  const m = new THREE.Matrix4();
  for (let i = 0; i < count; i++) {
    const th = r() * Math.PI * 2;
    const y = BODY_BOTTOM + 0.2 + r() * (BODY_TOP - BODY_BOTTOM - 0.4);
    const size = 0.012 + r() * r() * 0.05;
    m.compose(new THREE.Vector3(Math.sin(th) * (R + size * 0.3), y, Math.cos(th) * (R + size * 0.3)), new THREE.Quaternion(), new THREE.Vector3(size, size * 1.25, size * 0.6));
    mesh.setMatrixAt(i, m);
  }
  return mesh;
}
