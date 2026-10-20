import * as THREE from "three";
import { locations, type LocationId } from "./data";

export type TimeOfDay = "dawn" | "day" | "dusk" | "night";

interface Preset {
  skyTop: string;
  horizon: string;
  fog: string;
  sun: string;
  sunIntensity: number;
  ambient: number;
  sunAngle: number; // radians above horizon
  stars: number;
  windows: number;
  fire: number;
  cloud: string;
}

const presets: Record<TimeOfDay, Preset> = {
  dawn: { skyTop: "#6f7fb0", horizon: "#f2b28a", fog: "#e9b693", sun: "#ffc79a", sunIntensity: 1.6, ambient: 0.75, sunAngle: 0.12, stars: 0.1, windows: 0.6, fire: 0.3, cloud: "#f6c9b0" },
  day: { skyTop: "#5aa3d6", horizon: "#f6e6c4", fog: "#efdab4", sun: "#fff1d6", sunIntensity: 3, ambient: 1.4, sunAngle: 0.9, stars: 0, windows: 0, fire: 0, cloud: "#fff8ee" },
  dusk: { skyTop: "#3b3a73", horizon: "#f07a4a", fog: "#c86e52", sun: "#ff8a4c", sunIntensity: 1.5, ambient: 0.6, sunAngle: 0.05, stars: 0.35, windows: 1, fire: 0.8, cloud: "#e48a74" },
  night: { skyTop: "#070b1f", horizon: "#24305a", fog: "#1b2240", sun: "#9fb3ff", sunIntensity: 0.35, ambient: 0.32, sunAngle: 0.7, stars: 1, windows: 1.4, fire: 1.5, cloud: "#323a5c" },
};

/** Deterministic pseudo-random, so the landscape is the same every visit. */
function rng(seed: number) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

function smooth(a: number, b: number, x: number) {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

function height(x: number, z: number) {
  const d = Math.hypot(x * 0.8, (z - 6) * 0.6);
  const amp = 0.35 + smooth(20, 70, d) * 7;
  const n =
    Math.sin(x * 0.11) * Math.cos(z * 0.09) * 0.6 +
    Math.sin(x * 0.27 + z * 0.19) * 0.25 +
    Math.cos(x * 0.05 - z * 0.13) * 0.4;
  return n * amp;
}

const ROAD_POINTS = [
  new THREE.Vector3(0, 0, 46),
  new THREE.Vector3(0.5, 0, 34),
  new THREE.Vector3(-3, 0, 24),
  new THREE.Vector3(3, 0, 14),
  new THREE.Vector3(1, 0, 6),
  new THREE.Vector3(-2, 0, -1),
];

export class RanchScene {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera: THREE.PerspectiveCamera;
  private clock = new THREE.Clock();
  private raf = 0;
  private running = true;
  private sky!: THREE.Mesh;
  private skyUniforms = { top: { value: new THREE.Color() }, horizon: { value: new THREE.Color() } };
  private sun = new THREE.DirectionalLight();
  private hemi = new THREE.HemisphereLight();
  private sunDisc!: THREE.Mesh;
  private stars!: THREE.Points;
  private dust!: THREE.Points;
  private clouds: THREE.Group[] = [];
  private windowMat = new THREE.MeshStandardMaterial({ color: "#2b1d14", emissive: new THREE.Color("#ffb45a"), emissiveIntensity: 0 });
  private fireLight = new THREE.PointLight("#ff8a3c", 0, 18, 1.6);
  private flame!: THREE.Mesh;
  private blades!: THREE.Group;
  private current: Preset = { ...presets.day };
  private target: Preset = presets.day;
  private pointer = { x: 0, y: 0 };
  private ride: { t: number; duration: number; done: () => void } | null = null;
  private roadCurve = new THREE.CatmullRomCurve3(ROAD_POINTS);
  private arrived = false;
  private markerEls = new Map<LocationId, HTMLElement>();
  private onArrive?: () => void;

  constructor(private canvas: HTMLCanvasElement, opts: { time: TimeOfDay; arrived: boolean }) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: "high-performance" });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.camera = new THREE.PerspectiveCamera(50, 1, 0.1, 600);
    this.target = presets[opts.time];
    this.current = { ...this.target };
    this.build();
    this.applyPreset(1);
    if (opts.arrived) this.placeArrived();
    else this.placeAtGate();
    this.resize();
    this.loop();
  }

  /* ------------------------------ world ------------------------------ */
  private build() {
    const s = this.scene;
    s.fog = new THREE.Fog("#ead2a8", 40, 230);

    // sky dome with a vertical gradient
    const skyGeo = new THREE.SphereGeometry(400, 32, 16);
    const skyMat = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
      uniforms: this.skyUniforms,
      vertexShader: `varying vec3 vPos; void main(){ vPos = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
      fragmentShader: `uniform vec3 top; uniform vec3 horizon; varying vec3 vPos;
        void main(){ float h = normalize(vPos).y; float t = smoothstep(-0.05, 0.55, h); gl_FragColor = vec4(mix(horizon, top, t), 1.0); }`,
    });
    this.sky = new THREE.Mesh(skyGeo, skyMat);
    s.add(this.sky);

    this.sunDisc = new THREE.Mesh(new THREE.CircleGeometry(14, 40), new THREE.MeshBasicMaterial({ color: "#fff1d6", fog: false }));
    s.add(this.sunDisc);

    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(1024, 1024);
    const sc = this.sun.shadow.camera as THREE.OrthographicCamera;
    sc.left = -40;
    sc.right = 40;
    sc.top = 40;
    sc.bottom = -40;
    sc.far = 200;
    s.add(this.sun, this.sun.target, this.hemi);

    // stars
    const starGeo = new THREE.BufferGeometry();
    const r = rng(9);
    const pts: number[] = [];
    for (let i = 0; i < 900; i++) {
      const th = r() * Math.PI * 2;
      const ph = r() * Math.PI * 0.45;
      pts.push(Math.cos(th) * Math.cos(ph) * 380, Math.sin(ph) * 380 + 10, Math.sin(th) * Math.cos(ph) * 380);
    }
    starGeo.setAttribute("position", new THREE.Float32BufferAttribute(pts, 3));
    this.stars = new THREE.Points(starGeo, new THREE.PointsMaterial({ color: "#fff", size: 1.4, sizeAttenuation: false, transparent: true, opacity: 0, fog: false }));
    s.add(this.stars);

    this.buildTerrain();
    this.buildMesas();
    this.buildRoad();
    this.buildRanch();
    this.buildTrees();
    this.buildDust();
    this.buildClouds();
  }

  private buildTerrain() {
    const geo = new THREE.PlaneGeometry(320, 320, 120, 120);
    geo.rotateX(-Math.PI / 2);
    const pos = geo.attributes.position as THREE.BufferAttribute;
    const colors: number[] = [];
    const sand = new THREE.Color("#d9a86a");
    const rust = new THREE.Color("#b5643a");
    const sage = new THREE.Color("#9a9a62");
    const c = new THREE.Color();
    const r = rng(4);
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const z = pos.getZ(i);
      const y = height(x, z);
      pos.setY(i, y);
      c.copy(sand).lerp(rust, Math.min(1, Math.max(0, y * 0.12 + 0.25 + (r() - 0.5) * 0.2)));
      if (Math.sin(x * 0.3) * Math.cos(z * 0.25) > 0.55) c.lerp(sage, 0.35);
      colors.push(c.r, c.g, c.b);
    }
    geo.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
    geo.computeVertexNormals();
    const ground = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true }));
    ground.receiveShadow = true;
    this.scene.add(ground);
  }

  private buildMesas() {
    const r = rng(21);
    const cols = ["#a2472a", "#b85d34", "#8f3f27", "#c27a45"];
    for (let i = 0; i < 16; i++) {
      const g = new THREE.Group();
      const radius = 10 + r() * 22;
      const h = 14 + r() * 26;
      const layers = 2 + Math.floor(r() * 2);
      for (let l = 0; l < layers; l++) {
        const lh = h / layers;
        const rad = radius * (1 - l * 0.12);
        const m = new THREE.Mesh(
          new THREE.CylinderGeometry(rad * 0.86, rad, lh, 7 + Math.floor(r() * 3)),
          new THREE.MeshLambertMaterial({ color: cols[(i + l) % cols.length], flatShading: true }),
        );
        m.position.y = lh / 2 + l * lh;
        g.add(m);
      }
      const angle = -Math.PI * 0.95 + (i / 16) * Math.PI * 0.9 + (r() - 0.5) * 0.1;
      const dist = 95 + r() * 70;
      g.position.set(Math.cos(angle) * dist, -2, Math.sin(angle) * dist);
      g.scale.x = 1 + r() * 1.4;
      this.scene.add(g);
    }
    // the overlook mesa, close enough to visit
    const over = new THREE.Mesh(new THREE.CylinderGeometry(9, 12, 6, 8), new THREE.MeshLambertMaterial({ color: "#a2472a", flatShading: true }));
    over.position.set(-16, 2.6, -24);
    over.castShadow = true;
    this.scene.add(over);
  }

  private buildRoad() {
    const samples = 120;
    const verts: number[] = [];
    const idx: number[] = [];
    const tangent = new THREE.Vector3();
    const side = new THREE.Vector3();
    for (let i = 0; i <= samples; i++) {
      const t = i / samples;
      const p = this.roadCurve.getPoint(t);
      this.roadCurve.getTangent(t, tangent);
      side.set(-tangent.z, 0, tangent.x).normalize().multiplyScalar(1.5);
      for (const sgn of [-1, 1]) {
        const x = p.x + side.x * sgn;
        const z = p.z + side.z * sgn;
        verts.push(x, height(x, z) + 0.06, z);
      }
      if (i < samples) {
        const a = i * 2;
        idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(verts, 3));
    geo.setIndex(idx);
    geo.computeVertexNormals();
    const road = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ color: "#e8c897", side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -2 }));
    road.receiveShadow = true;
    this.scene.add(road);
  }

  private box(w: number, h: number, d: number, color: string, x: number, y: number, z: number, parent: THREE.Object3D = this.scene) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshLambertMaterial({ color, flatShading: true }));
    m.position.set(x, y, z);
    m.castShadow = true;
    m.receiveShadow = true;
    parent.add(m);
    return m;
  }

  private gable(w: number, h: number, d: number, color: string) {
    const shape = new THREE.Shape();
    shape.moveTo(-w / 2, 0);
    shape.lineTo(0, h);
    shape.lineTo(w / 2, 0);
    shape.lineTo(-w / 2, 0);
    const geo = new THREE.ExtrudeGeometry(shape, { depth: d, bevelEnabled: false });
    geo.translate(0, 0, -d / 2);
    const m = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ color, flatShading: true }));
    m.castShadow = true;
    return m;
  }

  private signTexture() {
    const c = document.createElement("canvas");
    c.width = 1024;
    c.height = 256;
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 4;
    this.paintSign(c);
    // repaint once the poster fonts have loaded
    if (document.fonts) {
      Promise.all([document.fonts.load("120px 'Alfa Slab One'"), document.fonts.load("40px 'Special Elite'")])
        .then(() => {
          this.paintSign(c);
          tex.needsUpdate = true;
        })
        .catch(() => undefined);
    }
    return tex;
  }

  private paintSign(c: HTMLCanvasElement) {
    const g = c.getContext("2d")!;
    g.fillStyle = "#efe2c8";
    g.fillRect(0, 0, 1024, 256);
    g.strokeStyle = "#3b2418";
    g.lineWidth = 14;
    g.strokeRect(14, 14, 996, 228);
    g.fillStyle = "#a2472a";
    g.font = "120px 'Alfa Slab One', Georgia, serif";
    g.textAlign = "center";
    g.fillText("COPPER WELLS", 512, 150);
    g.fillStyle = "#3b2418";
    g.font = "40px 'Special Elite', monospace";
    g.fillText("GUEST RANCH · EST. 1891", 512, 214);
  }

  private buildRanch() {
    // gate
    const gate = new THREE.Group();
    gate.position.set(0, height(0, 34), 34);
    this.box(0.5, 6, 0.5, "#5a3b26", -4, 3, 0, gate);
    this.box(0.5, 6, 0.5, "#5a3b26", 4, 3, 0, gate);
    this.box(9.6, 0.45, 0.45, "#5a3b26", 0, 5.9, 0, gate);
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(7, 1.75), new THREE.MeshLambertMaterial({ map: this.signTexture(), side: THREE.DoubleSide }));
    sign.position.set(0, 4.75, 0.3);
    sign.rotation.y = Math.PI;
    sign.castShadow = true;
    gate.add(sign);
    gate.rotation.y = Math.PI;
    this.scene.add(gate);

    // ranch house: adobe, flat roof with parapet, timber porch
    const house = new THREE.Group();
    house.position.set(-4, height(-4, -6), -6);
    this.box(10, 3.4, 6, "#c98e66", 0, 1.7, 0, house);
    this.box(10.4, 0.5, 6.4, "#b57a55", 0, 3.6, 0, house);
    this.box(4, 2.6, 4, "#c98e66", 6.5, 1.3, -0.8, house);
    this.box(10, 0.18, 2.6, "#6b4a33", 0, 2.7, 4.2, house);
    for (let i = -2; i <= 2; i++) this.box(0.22, 2.7, 0.22, "#5a3b26", i * 2.4, 1.35, 5.3, house);
    for (let i = -1; i <= 1; i++) {
      const win = new THREE.Mesh(new THREE.PlaneGeometry(1, 1.2), this.windowMat);
      win.position.set(i * 3, 1.8, 3.01);
      house.add(win);
    }
    const door = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 2), new THREE.MeshLambertMaterial({ color: "#5e9c97" }));
    door.position.set(1.5, 1, 3.02);
    house.add(door);
    this.scene.add(house);

    // stables: barn with a gable roof
    const barn = new THREE.Group();
    barn.position.set(7, height(7, -3), -3);
    this.box(7, 3, 5, "#8f3f27", 0, 1.5, 0, barn);
    const roof = this.gable(7.6, 2.2, 5.6, "#4a3326");
    roof.position.y = 3;
    roof.rotation.y = Math.PI / 2;
    barn.add(roof);
    this.box(2, 2.4, 0.1, "#efe2c8", 0, 1.2, 2.55, barn);
    // corral fence
    for (let i = 0; i < 9; i++) {
      this.box(0.15, 1.2, 0.15, "#6b4a33", 4.5 + i * 0.9, 0.6, 3.5, barn);
    }
    this.box(8, 0.12, 0.12, "#6b4a33", 8.1, 1, 3.5, barn);
    this.box(8, 0.12, 0.12, "#6b4a33", 8.1, 0.55, 3.5, barn);
    barn.rotation.y = -0.4;
    this.scene.add(barn);

    // general store with a false front
    const store = new THREE.Group();
    store.position.set(-16, height(-16, 17), 17);
    this.box(4.5, 2.8, 4, "#a56a45", 0, 1.4, 0, store);
    this.box(5, 4.4, 0.25, "#efe2c8", 0, 2.2, 2.1, store);
    this.box(4.6, 0.6, 0.3, "#5e9c97", 0, 3.7, 2.25, store);
    store.rotation.y = 1.1;
    this.scene.add(store);

    // windmill + stock tank: the copper wells
    const mill = new THREE.Group();
    mill.position.set(-12, height(-12, 4), 4);
    const tower = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 1.4, 9, 4, 1, true), new THREE.MeshLambertMaterial({ color: "#3b2418", wireframe: true }));
    tower.position.y = 4.5;
    mill.add(tower);
    this.box(0.2, 9, 0.2, "#3b2418", 0, 4.5, 0, mill);
    this.blades = new THREE.Group();
    this.blades.position.set(0, 9.2, 0.6);
    for (let i = 0; i < 14; i++) {
      const b = new THREE.Mesh(new THREE.BoxGeometry(0.35, 2.3, 0.05), new THREE.MeshLambertMaterial({ color: "#d9cdb5" }));
      b.position.y = 1.4;
      const holder = new THREE.Group();
      holder.rotation.z = (i / 14) * Math.PI * 2;
      holder.add(b);
      this.blades.add(holder);
    }
    mill.add(this.blades);
    this.box(0.1, 0.6, 2.4, "#a2472a", 0, 9.2, -1.4, mill);
    const tank = new THREE.Mesh(new THREE.CylinderGeometry(2.4, 2.4, 1, 20), new THREE.MeshLambertMaterial({ color: "#7d8a8a" }));
    tank.position.set(3.5, 0.5, 0);
    tank.castShadow = true;
    mill.add(tank);
    const water = new THREE.Mesh(new THREE.CircleGeometry(2.3, 20), new THREE.MeshLambertMaterial({ color: "#5e9c97" }));
    water.rotation.x = -Math.PI / 2;
    water.position.set(3.5, 1.01, 0);
    mill.add(water);
    this.scene.add(mill);

    // campfire
    const fire = new THREE.Group();
    fire.position.set(2, height(2, 6), 6);
    for (let i = 0; i < 9; i++) {
      const st = new THREE.Mesh(new THREE.DodecahedronGeometry(0.28), new THREE.MeshLambertMaterial({ color: "#6d665d", flatShading: true }));
      st.position.set(Math.cos((i / 9) * Math.PI * 2) * 1.1, 0.15, Math.sin((i / 9) * Math.PI * 2) * 1.1);
      fire.add(st);
    }
    for (let i = 0; i < 4; i++) {
      const bench = this.box(2.6, 0.35, 0.5, "#6b4a33", 0, 0.35, 0, fire);
      bench.position.set(Math.cos((i / 4) * Math.PI * 2) * 3.2, 0.35, Math.sin((i / 4) * Math.PI * 2) * 3.2);
      bench.rotation.y = -(i / 4) * Math.PI * 2 + Math.PI / 2;
    }
    this.flame = new THREE.Mesh(new THREE.ConeGeometry(0.45, 1.2, 6), new THREE.MeshBasicMaterial({ color: "#ffb347", transparent: true, opacity: 0 }));
    this.flame.position.y = 0.6;
    fire.add(this.flame);
    this.fireLight.position.set(0, 1.4, 0);
    fire.add(this.fireLight);
    this.scene.add(fire);
  }

  private buildTrees() {
    const r = rng(77);
    const geo = new THREE.DodecahedronGeometry(1, 0);
    const mat = new THREE.MeshLambertMaterial({ color: "#56603a", flatShading: true });
    const trunkMat = new THREE.MeshLambertMaterial({ color: "#4a3326" });
    const tree = new THREE.InstancedMesh(geo, mat, 140);
    const trunks = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.12, 0.18, 1, 5), trunkMat, 140);
    tree.castShadow = true;
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    let n = 0;
    while (n < 140) {
      const x = (r() - 0.5) * 140;
      const z = (r() - 0.5) * 120 - 5;
      // keep the road, buildings and the camera's path clear
      if (Math.abs(x) < 7 && z > -4 && z < 50) continue;
      if (Math.hypot(x + 4, z + 6) < 10 || Math.hypot(x - 7, z + 3) < 8 || Math.hypot(x + 16, z - 17) < 6 || Math.hypot(x + 12, z - 4) < 7 || Math.hypot(x - 2, z - 6) < 5) continue;
      const s = 0.7 + r() * 1.3;
      const y = height(x, z);
      m.compose(new THREE.Vector3(x, y + 1 * s + 0.4, z), q.setFromEuler(new THREE.Euler(r(), r(), r())), new THREE.Vector3(s, s * 1.15, s));
      tree.setMatrixAt(n, m);
      m.compose(new THREE.Vector3(x, y + 0.4, z), new THREE.Quaternion(), new THREE.Vector3(1, 0.9 * s, 1));
      trunks.setMatrixAt(n, m);
      n++;
    }
    this.scene.add(tree, trunks);
  }

  private buildDust() {
    const r = rng(5);
    const pts: number[] = [];
    for (let i = 0; i < 700; i++) pts.push((r() - 0.5) * 120, r() * 7, (r() - 0.5) * 120);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(pts, 3));
    this.dust = new THREE.Points(geo, new THREE.PointsMaterial({ color: "#f5deb3", size: 0.12, transparent: true, opacity: 0.55, depthWrite: false }));
    this.scene.add(this.dust);
  }

  private buildClouds() {
    const r = rng(12);
    for (let i = 0; i < 7; i++) {
      const g = new THREE.Group();
      const mat = new THREE.MeshLambertMaterial({ color: "#fff8ee", flatShading: true, transparent: true, opacity: 0.92 });
      for (let k = 0; k < 5; k++) {
        const puff = new THREE.Mesh(new THREE.IcosahedronGeometry(4 + r() * 4, 0), mat);
        puff.position.set(k * 5 - 10, r() * 2, r() * 4);
        puff.scale.y = 0.45;
        g.add(puff);
      }
      g.position.set((r() - 0.5) * 300, 55 + r() * 25, -60 - r() * 120);
      this.clouds.push(g);
      this.scene.add(g);
    }
  }

  /* ------------------------------ time of day ------------------------------ */
  setTime(t: TimeOfDay) {
    this.target = presets[t];
  }

  private applyPreset(k: number) {
    const c = this.current;
    const t = this.target;
    const mix = (a: string, b: string) => "#" + new THREE.Color(a).lerp(new THREE.Color(b), k).getHexString();
    const num = (a: number, b: number) => a + (b - a) * k;
    (Object.keys(t) as (keyof Preset)[]).forEach((key) => {
      const v = t[key];
      if (typeof v === "string") (c as unknown as Record<string, string>)[key] = mix(c[key] as string, v);
      else (c as unknown as Record<string, number>)[key] = num(c[key] as number, v);
    });
    this.skyUniforms.top.value.set(c.skyTop);
    this.skyUniforms.horizon.value.set(c.horizon);
    (this.scene.fog as THREE.Fog).color.set(c.fog);
    this.sun.color.set(c.sun);
    this.sun.intensity = c.sunIntensity;
    this.hemi.color.set(c.skyTop).lerp(new THREE.Color("#ffffff"), 0.4);
    this.hemi.groundColor.set("#8a5a3a");
    this.hemi.intensity = c.ambient;
    const a = c.sunAngle;
    const sunPos = new THREE.Vector3(-Math.cos(a) * 120, Math.sin(a) * 160 + 6, -150);
    this.sun.position.copy(sunPos).multiplyScalar(0.4);
    this.sunDisc.position.copy(sunPos.clone().normalize().multiplyScalar(360));
    this.sunDisc.lookAt(0, 0, 0);
    (this.sunDisc.material as THREE.MeshBasicMaterial).color.set(c.sun);
    (this.stars.material as THREE.PointsMaterial).opacity = c.stars;
    this.windowMat.emissiveIntensity = c.windows;
    this.fireLight.intensity = c.fire * 30;
    (this.flame.material as THREE.MeshBasicMaterial).opacity = Math.min(1, c.fire);
    this.clouds.forEach((g) => g.children.forEach((p) => ((p as THREE.Mesh).material as THREE.MeshLambertMaterial).color.set(c.cloud)));
  }

  /* ------------------------------ camera ------------------------------ */
  private placeAtGate() {
    this.arrived = false;
    this.camera.position.set(0, 3.2, 50);
    this.camera.lookAt(0, 3.4, 20);
  }

  private placeArrived() {
    this.arrived = true;
    this.camera.position.set(10, 13, 26);
    this.camera.lookAt(-2, 0, 0);
  }

  /** The signature transition: ride the dirt road from the gate to a view over the ranch. */
  rideIn(onDone: () => void) {
    this.onArrive = onDone;
    this.ride = { t: 0, duration: 7, done: onDone };
  }

  skipRide() {
    if (!this.ride) return;
    this.ride = null;
    this.placeArrived();
    this.onArrive?.();
  }

  resetToGate() {
    this.ride = null;
    this.placeAtGate();
  }

  setPointer(x: number, y: number) {
    this.pointer.x = x;
    this.pointer.y = y;
  }

  registerMarker(id: LocationId, el: HTMLElement | null) {
    if (el) this.markerEls.set(id, el);
    else this.markerEls.delete(id);
  }

  private updateRide(dt: number) {
    if (!this.ride) return;
    this.ride.t += dt / this.ride.duration;
    const t = Math.min(1, this.ride.t);
    const e = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
    // first 75%: along the road at rider height; last 25%: rise to the overlook view
    const roadT = Math.min(1, e / 0.75) * 0.82;
    const p = this.roadCurve.getPoint(roadT);
    const ahead = this.roadCurve.getPoint(Math.min(1, roadT + 0.08));
    const riderPos = new THREE.Vector3(p.x, height(p.x, p.z) + 2.6, p.z);
    const riderLook = new THREE.Vector3(ahead.x, 2.2, ahead.z);
    const endPos = new THREE.Vector3(10, 13, 26);
    const endLook = new THREE.Vector3(-2, 0, 0);
    const k = smooth(0.62, 1, e);
    this.camera.position.copy(riderPos.lerp(endPos, k));
    // a gentle bob while riding
    this.camera.position.y += Math.sin(this.ride.t * 60) * 0.06 * (1 - k);
    this.camera.lookAt(riderLook.lerp(endLook, k));
    if (t >= 1) {
      const done = this.ride.done;
      this.ride = null;
      this.arrived = true;
      done();
    }
  }

  private updateMarkers() {
    const v = new THREE.Vector3();
    const w = this.canvas.clientWidth;
    const h = this.canvas.clientHeight;
    for (const loc of locations) {
      const el = this.markerEls.get(loc.id);
      if (!el) continue;
      v.set(loc.world[0], loc.world[1] + height(loc.world[0], loc.world[2]) + 4.2, loc.world[2]);
      v.project(this.camera);
      const visible = this.arrived && !this.ride && v.z < 1 && Math.abs(v.x) < 1.05 && Math.abs(v.y) < 1.05;
      el.style.transform = `translate(${((v.x + 1) / 2) * w}px, ${((1 - v.y) / 2) * h}px) translate(-50%, -100%)`;
      el.dataset.visible = visible ? "true" : "false";
    }
  }

  /* ------------------------------ loop ------------------------------ */
  resize() {
    const w = this.canvas.clientWidth || 1;
    const h = this.canvas.clientHeight || 1;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.fov = w < 700 ? 62 : 50;
    this.camera.updateProjectionMatrix();
  }

  setRunning(on: boolean) {
    if (on === this.running) return;
    this.running = on;
    if (on) {
      this.clock.getDelta();
      this.loop();
    } else cancelAnimationFrame(this.raf);
  }

  private loop = () => {
    if (!this.running) return;
    this.raf = requestAnimationFrame(this.loop);
    const rawDt = this.clock.getDelta();
    const dt = Math.min(0.05, rawDt);
    const time = this.clock.elapsedTime;
    this.applyPreset(Math.min(1, dt * 1.6));
    this.blades.rotation.z -= dt * 1.4;
    const dust = this.dust.geometry.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < dust.count; i++) {
      let x = dust.getX(i) + dt * (1.2 + (i % 5) * 0.3);
      if (x > 60) x = -60;
      dust.setX(i, x);
      dust.setY(i, dust.getY(i) + Math.sin(time + i) * dt * 0.1);
    }
    dust.needsUpdate = true;
    this.clouds.forEach((c, i) => {
      c.position.x += dt * (0.8 + i * 0.1);
      if (c.position.x > 180) c.position.x = -180;
    });
    const flicker = 0.85 + Math.sin(time * 13) * 0.08 + Math.sin(time * 29) * 0.06;
    this.flame.scale.set(1, flicker * 1.2, 1);
    this.fireLight.intensity = this.current.fire * 30 * flicker;

    if (this.ride) this.updateRide(Math.min(0.25, rawDt));
    else if (this.arrived) {
      const base = new THREE.Vector3(10, 13, 26);
      this.camera.position.lerp(base.add(new THREE.Vector3(this.pointer.x * 3, -this.pointer.y * 1.5 + Math.sin(time * 0.2) * 0.3, 0)), 0.04);
      this.camera.lookAt(-2, 0, 0);
    } else {
      this.camera.position.lerp(new THREE.Vector3(this.pointer.x * 1.5, 3.2 - this.pointer.y * 0.6, 50), 0.05);
      this.camera.lookAt(0, 3.4, 20);
    }
    this.updateMarkers();
    this.renderer.render(this.scene, this.camera);
  };

  dispose() {
    this.running = false;
    cancelAnimationFrame(this.raf);
    this.scene.traverse((o) => {
      const m = o as THREE.Mesh;
      m.geometry?.dispose();
      const mat = m.material as THREE.Material | THREE.Material[] | undefined;
      if (Array.isArray(mat)) mat.forEach((x) => x.dispose());
      else mat?.dispose();
    });
    this.renderer.dispose();
  }
}

export function webglAvailable(): boolean {
  try {
    const c = document.createElement("canvas");
    return !!(c.getContext("webgl2") || c.getContext("webgl"));
  } catch {
    return false;
  }
}
