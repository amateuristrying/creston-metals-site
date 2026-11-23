import * as THREE from 'three';
import { createScrollDriver } from './scroll-driver.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import {
  makeStudioEnv,
  makeDawnSky,
  PAPER,
  NIGHT,
  glowTexture,
  clamp01,
  lerp,
  smoothstep,
  easeInOutCubic,
  easeOutCubic,
  mulberry32,
} from './studio.js';

/* ------------------------------------------------------------------
   Coil → Open road
   One number drives everything: progress `p` in [0, 1].

     0.00 – 0.08   a hot-rolled coil glows on its mandrel
     0.08 – 0.30   it pays out; the strip runs down the table and cools
     0.27 – 0.65   the press cuts blanks; each one forms in flight and
                   lands on the body — 15 steel panels, then wheels
     0.59 – 0.69   glass is set
     0.66 – 0.74   the raw steel is finished; lights on
     0.74 – 1.00   the mill falls behind — the car drives into first light
------------------------------------------------------------------- */

const TIME = {
  feedStart: 0.08,
  feedEnd: 0.3,
  coreStart: 0.27,
  coreEnd: 0.34,
  panelStart: 0.32,
  panelSpan: 0.24,
  panelDur: 0.085,
  wheelStart: 0.36,
  wheelDur: 0.1,
  glassStart: 0.59,
  glassSpan: 0.05,
  glassDur: 0.05,
  paintStart: 0.665,
  paintSpan: 0.04,
  paintDur: 0.03,
  lightsOn: 0.715,
  driveStart: 0.74,
};

export const AUTO_STEPS = [0, 0.08, 0.27, 0.44, 0.59, 0.74];
export const AUTO_PANELS = 21;

/* ---------- the car, as numbers ---------- */
const LH = 2.35; // half length
const HW = 0.95; // half width
const WHEEL_R = 0.34;
const ARCH_R = 0.41;
const AXLES = [1.42, -1.42];
const TRACK = 0.81;

/** 1D Catmull-Rom through sorted [x, y] keys. */
function spline(keys) {
  const n = keys.length;
  const slope = keys.map((_, i) => {
    const a = keys[Math.max(i - 1, 0)];
    const b = keys[Math.min(i + 1, n - 1)];
    return (b[1] - a[1]) / (b[0] - a[0]);
  });
  return (x) => {
    if (x <= keys[0][0]) return keys[0][1];
    if (x >= keys[n - 1][0]) return keys[n - 1][1];
    let i = 0;
    while (x > keys[i + 1][0]) i++;
    const [x0, y0] = keys[i];
    const [x1, y1] = keys[i + 1];
    const h = x1 - x0;
    const t = (x - x0) / h;
    const t2 = t * t;
    const t3 = t2 * t;
    return (2 * t3 - 3 * t2 + 1) * y0 + (t3 - 2 * t2 + t) * h * slope[i] + (-2 * t3 + 3 * t2) * y1 + (t3 - t2) * h * slope[i + 1];
  };
}

// side profile, rear (−x) to nose (+x): a fastback
const yTop = spline([
  [-2.35, 0.8],
  [-2.1, 0.93],
  [-1.6, 1.0],
  [-1.0, 1.17],
  [-0.35, 1.3],
  [0.1, 1.31],
  [0.55, 1.16],
  [0.95, 0.92],
  [1.3, 0.87],
  [1.9, 0.8],
  [2.2, 0.72],
  [2.35, 0.63],
]);
const yBelt = spline([
  [-2.35, 0.74],
  [-2.0, 0.86],
  [-1.0, 0.9],
  [0, 0.87],
  [1.0, 0.84],
  [1.9, 0.77],
  [2.2, 0.69],
  [2.35, 0.6],
]);
const yLow = spline([
  [-2.35, 0.42],
  [-2.0, 0.24],
  [-1.6, 0.17],
  [1.6, 0.17],
  [2.05, 0.22],
  [2.35, 0.38],
]);
const halfWidth = (x) => HW * Math.cbrt(Math.max(0, 1 - Math.pow(Math.abs(x) / LH, 6)));

// each cross-section is a spline through seven points, floor to roof
const SPAN = [4, 2, 4, 4, 6, 7];
const J = { A: 0, B: 4, C: 6, D: 10, E: 14, F: 20, G: 27 };
const HALF = 28;
const RING = 55;
const LAST = RING - 1;

const cr = (a, b, c, d, t) => 0.5 * (2 * b + (c - a) * t + (2 * a - 5 * b + 4 * c - d) * t * t + (3 * b - a - 3 * c + d) * t * t * t);

/** Half section at station x: 28 × [z, y], from the floor centre to the roof centre. */
function halfSection(x, out) {
  const w = halfWidth(x);
  const yl = yLow(x);
  const ys = yBelt(x);
  const yt = yTop(x);
  const ym = lerp(yl, ys, 0.5);
  const pts = [
    [0, yl],
    [0.78 * w, yl],
    [0.97 * w, yl + (ym - yl) * 0.42],
    [w, ym],
    [0.975 * w, ys],
    [0.72 * w, ys + 0.86 * (yt - ys)],
    [0, yt],
  ];
  const ext = [[-pts[1][0], pts[1][1]], ...pts, [-pts[5][0], pts[5][1]]];
  let k = 0;
  for (let s = 0; s < 6; s++) {
    const [p0, p1, p2, p3] = [ext[s], ext[s + 1], ext[s + 2], ext[s + 3]];
    for (let i = 0; i < SPAN[s]; i++) {
      const t = i / SPAN[s];
      out[k++] = cr(p0[0], p1[0], p2[0], p3[0], t);
      out[k++] = cr(p0[1], p1[1], p2[1], p3[1], t);
    }
  }
  out[k++] = 0;
  out[k] = yt;
  return out;
}

const archHeight = (x) => {
  for (const axle of AXLES) {
    const dx = Math.abs(x - axle);
    if (dx < ARCH_R - 1e-6) return WHEEL_R + Math.sqrt(ARCH_R * ARCH_R - dx * dx);
  }
  return 0;
};

/** Point on the body at station x and (fractional) ring index j. */
const scratch = new Float32Array(HALF * 2);
function surfacePoint(x, j, target) {
  halfSection(x, scratch);
  const m = j <= J.G ? j : LAST - j;
  const i = Math.min(Math.floor(m), HALF - 2);
  const f = m - i;
  const z = lerp(scratch[i * 2], scratch[i * 2 + 2], f);
  const y = lerp(scratch[i * 2 + 1], scratch[i * 2 + 3], f);
  return target.set(x, Math.max(y, archHeight(x)), j <= J.G ? z : -z);
}

// where one panel ends and the next begins
const CUTS = [2.0, 0.98, 0.95, 0.92, 0.12, -0.1, -0.16, -0.72, -0.95, -1.2, -1.55, -2.05];

function buildLoft() {
  const list = [];
  const N = 150;
  for (let i = 0; i <= N; i++) list.push(LH * Math.sin((i / N - 0.5) * Math.PI));
  for (const axle of AXLES) {
    const r = ARCH_R - 0.003;
    list.push(axle - ARCH_R, axle + ARCH_R);
    for (let k = 0; k <= 16; k++) list.push(axle + r * Math.cos((k / 16) * Math.PI));
  }
  list.push(...CUTS);
  list.sort((a, b) => a - b);
  const xs = list.filter((x, i) => i === 0 || x - list[i - 1] > 1e-3);
  xs[0] = -LH;
  xs[xs.length - 1] = LH;

  const rows = xs.length;
  const positions = new Float32Array(rows * RING * 3);
  const half = new Float32Array(HALF * 2);
  for (let i = 0; i < rows; i++) {
    const x = xs[i];
    halfSection(x, half);
    const arch = archHeight(x);
    for (let j = 0; j < RING; j++) {
      const m = j <= J.G ? j : LAST - j;
      const o = (i * RING + j) * 3;
      positions[o] = x;
      positions[o + 1] = Math.max(half[m * 2 + 1], arch);
      positions[o + 2] = j <= J.G ? half[m * 2] : -half[m * 2];
    }
  }
  const index = (x) => {
    let best = 0;
    for (let i = 1; i < rows; i++) if (Math.abs(xs[i] - x) < Math.abs(xs[best] - x)) best = i;
    return best;
  };
  return { xs, rows, positions, index };
}

function gridIndices(rows, cols) {
  const indices = [];
  for (let r = 0; r < rows - 1; r++) {
    for (let c = 0; c < cols - 1; c++) {
      const a = r * cols + c;
      const b = a + cols;
      indices.push(a, b, b + 1, a, b + 1, a + 1);
    }
  }
  return indices;
}

/** A panel: one rectangular patch of the loft, pulled in at its edges to leave a shut line. */
function makePatch(loft, x0, x1, j0, j1, gap) {
  const i0 = loft.index(x0);
  const i1 = loft.index(x1);
  const rows = i1 - i0 + 1;
  const cols = j1 - j0 + 1;
  const formed = new Float32Array(rows * cols * 3);
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const src = ((i0 + r) * RING + j0 + c) * 3;
      formed.set(loft.positions.subarray(src, src + 3), (r * cols + c) * 3);
    }
  }

  // the blank this panel is pressed from: the same patch, unrolled flat
  const flat = new Float32Array(rows * cols * 3);
  const mid = Math.floor(rows / 2) * cols * 3;
  const girth = [0];
  for (let c = 1; c < cols; c++) {
    const a = mid + (c - 1) * 3;
    const b = mid + c * 3;
    girth.push(girth[c - 1] + Math.hypot(formed[b] - formed[a], formed[b + 1] - formed[a + 1], formed[b + 2] - formed[a + 2]));
  }
  const total = girth[cols - 1];
  const squeeze = Math.min(1, 1.84 / total); // nothing leaves the press wider than the strip
  const xMid = (loft.xs[i0] + loft.xs[i1]) / 2;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const o = (r * cols + c) * 3;
      flat[o] = loft.xs[i0 + r] - xMid;
      flat[o + 1] = 0;
      flat[o + 2] = -(girth[c] - total / 2) * squeeze;
    }
  }

  const pull = (a, b) => {
    const dx = formed[b] - formed[a];
    const dy = formed[b + 1] - formed[a + 1];
    const dz = formed[b + 2] - formed[a + 2];
    const d = Math.hypot(dx, dy, dz);
    if (d < 1e-6) return;
    const k = Math.min(gap, d * 0.45) / d;
    formed[a] += dx * k;
    formed[a + 1] += dy * k;
    formed[a + 2] += dz * k;
  };
  const at = (r, c) => (r * cols + c) * 3;
  for (let c = 0; c < cols; c++) {
    if (i0 > 0) pull(at(0, c), at(1, c));
    if (i1 < loft.rows - 1) pull(at(rows - 1, c), at(rows - 2, c));
  }
  for (let r = 0; r < rows; r++) {
    pull(at(r, 0), at(r, 1));
    pull(at(r, cols - 1), at(r, cols - 2));
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(formed.slice(), 3));
  geometry.setIndex(gridIndices(rows, cols));
  geometry.computeVertexNormals();
  const normals = geometry.attributes.normal.array.slice();

  const centre = new THREE.Vector3();
  for (let i = 0; i < formed.length; i += 3) centre.add(new THREE.Vector3(formed[i], formed[i + 1], formed[i + 2]));
  centre.multiplyScalar(3 / formed.length);
  for (let i = 0; i < formed.length; i += 3) {
    formed[i] -= centre.x;
    formed[i + 1] -= centre.y;
    formed[i + 2] -= centre.z;
  }
  return { geometry, formed, flat, normals, centre };
}

/** A strip of light or trim laid on the body between two ring positions. */
function makeTrim(x0, x1, j0, j1, lift, nx = 26, nj = 3) {
  const positions = [];
  const point = new THREE.Vector3();
  for (let r = 0; r <= nx; r++) {
    for (let c = 0; c <= nj; c++) {
      surfacePoint(lerp(x0, x1, r / nx), lerp(j0, j1, c / nj), point);
      positions.push(point.x, point.y, point.z);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(gridIndices(nx + 1, nj + 1));
  geometry.computeVertexNormals();
  const pos = geometry.attributes.position;
  const nor = geometry.attributes.normal;
  for (let i = 0; i < pos.count; i++) {
    pos.setXYZ(i, pos.getX(i) + nor.getX(i) * lift, pos.getY(i) + nor.getY(i) * lift, pos.getZ(i) + nor.getZ(i) * lift);
  }
  return geometry;
}

function makeWheel(materials) {
  const wheel = new THREE.Group();
  const profile = [
    [0.2, -0.125],
    [0.3, -0.13],
    [0.333, -0.105],
    [WHEEL_R, -0.05],
    [WHEEL_R, 0.05],
    [0.333, 0.105],
    [0.3, 0.13],
    [0.2, 0.125],
  ].map(([r, y]) => new THREE.Vector2(r, y));
  wheel.add(new THREE.Mesh(new THREE.LatheGeometry(profile, 44).rotateX(Math.PI / 2), materials.tyre));

  const barrel = new THREE.CylinderGeometry(0.205, 0.205, 0.2, 36, 1, true).rotateX(Math.PI / 2);
  const back = new THREE.CylinderGeometry(0.2, 0.2, 0.04, 28).rotateX(Math.PI / 2);
  wheel.add(new THREE.Mesh(mergeGeometries([barrel, back]), materials.barrel));

  const alloy = [new THREE.CylinderGeometry(0.052, 0.06, 0.25, 20).rotateX(Math.PI / 2)];
  for (const side of [-1, 1]) {
    alloy.push(new THREE.TorusGeometry(0.207, 0.013, 8, 44).translate(0, 0, side * 0.112));
    for (let s = 0; s < 5; s++) {
      const angle = (s / 5) * Math.PI * 2;
      for (const split of [-0.16, 0.16]) {
        alloy.push(
          new THREE.BoxGeometry(0.17, 0.026, 0.028)
            .translate(0.125, 0, side * 0.1)
            .rotateZ(angle + split)
        );
      }
    }
  }
  wheel.add(new THREE.Mesh(mergeGeometries(alloy.map((g) => (g.index ? g.toNonIndexed() : g))), materials.alloy));
  return wheel;
}

/* ---------- the mill, as numbers ---------- */
const COIL = { x: -13, y: 1.62, outer: 1.25, inner: 0.42, turns: 16, perTurn: 56, width: 1.9 };
const TABLE_Y = 0.92;
const PINCH_X = COIL.x + 2.3;
const PRESS_X = -5.6;

function makeCoil(rand) {
  const steps = COIL.turns * COIL.perTurn;
  const pitch = (COIL.outer - COIL.inner) / COIL.turns;
  const thick = pitch * 0.66;
  const hz = COIL.width / 2;
  const positions = [];
  const colors = [];
  const indices = [];
  let shade = 1;
  for (let k = 0; k <= steps; k++) {
    const angle = (k / COIL.perTurn) * Math.PI * 2;
    const radius = COIL.outer - (pitch * k) / COIL.perTurn;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    const ro = radius + thick / 2;
    const ri = radius - thick / 2;
    if (k % 19 === 0) shade = 0.72 + rand() * 0.5;
    const depth = 1 - (k / steps) * 0.25; // the heart of the coil is a touch duller
    // outer face, inner face, +z edge, −z edge
    positions.push(ro * cos, ro * sin, hz, ro * cos, ro * sin, -hz);
    positions.push(ri * cos, ri * sin, hz, ri * cos, ri * sin, -hz);
    positions.push(ro * cos, ro * sin, hz, ri * cos, ri * sin, hz);
    positions.push(ro * cos, ro * sin, -hz, ri * cos, ri * sin, -hz);
    const face = [0.95 * shade, 0.2 * shade, 0.02 * shade];
    const dark = [0.4 * shade, 0.07 * shade, 0.008 * shade];
    const edge = [1.9 * shade * depth, 0.56 * shade * depth, 0.06 * shade * depth];
    colors.push(...face, ...face, ...dark, ...dark, ...edge, ...edge, ...edge, ...edge);
    if (k < steps) {
      const v = k * 8;
      for (let q = 0; q < 4; q++) {
        const a = v + q * 2;
        indices.push(a, a + 1, a + 9, a, a + 9, a + 8);
      }
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.setIndex(indices);
  return { geometry, steps, pitch };
}

export function createAutoScene(canvas) {
  const rand = mulberry32(20261114);
  const coarse = window.matchMedia('(pointer: coarse)').matches;
  let listener = null;
  const playback = createScrollDriver((p, time) => {
    apply(p, time);
    renderer.render(scene, camera);
    info.p = p;
    listener?.(info);
  });

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, coarse ? 1.75 : 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;

  const scene = new THREE.Scene();
  // two studios: the mill at night, and a white cyclorama for the day theme
  const envNight = makeStudioEnv(renderer);
  const envDay = makeStudioEnv(renderer, true);
  scene.environment = envNight;
  scene.fog = new THREE.Fog(NIGHT.clone(), 40, 150);
  let day = false;

  const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 500);

  const sky = makeDawnSky({ radius: 220, band: [18, 12.5], glow: [0, 0.62], floor: 0.1, focus: 3.2, ember: [1.0, 0.36, 0.08] });
  const sunDir = new THREE.Vector3(0.95, 0, -0.31).normalize();
  sky.material.uniforms.uSun.value.copy(sunDir);
  scene.add(sky);

  const groundMaterial = new THREE.MeshStandardMaterial({ color: 0x0a0b0d, metalness: 0.35, roughness: 0.7 });
  const ground = new THREE.Mesh(
    new THREE.CircleGeometry(190, 64),
    groundMaterial
  );
  ground.rotation.x = -Math.PI / 2;
  scene.add(ground);

  /* ---------- a quiet city, ahead ---------- */
  const cityMaterial = new THREE.MeshBasicMaterial({ color: 0x030304 });
  {
    const COUNT = 150;
    const city = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), cityMaterial, COUNT);
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    for (let i = 0; i < COUNT; i++) {
      const angle = (rand() - 0.5) * Math.PI * 1.5 + Math.PI / 2; // mostly toward +x
      const radius = 150 + rand() * 34;
      const h = 2 + Math.pow(rand(), 2.6) * 22;
      q.setFromAxisAngle(THREE.Object3D.DEFAULT_UP, rand() * Math.PI);
      m.compose(
        new THREE.Vector3(Math.sin(angle) * radius, h / 2, Math.cos(angle) * radius),
        q,
        new THREE.Vector3(2 + rand() * 6, h, 2 + rand() * 6)
      );
      city.setMatrixAt(i, m);
    }
    city.frustumCulled = false;
    scene.add(city);
  }

  /* =====================================================================
     THE MILL — everything here is left behind when the car drives off
  ===================================================================== */
  const mill = new THREE.Group();
  scene.add(mill);

  const iron = new THREE.MeshStandardMaterial({ color: 0x2b2d32, metalness: 0.85, roughness: 0.5 });
  const ironDark = new THREE.MeshStandardMaterial({ color: 0x17181b, metalness: 0.7, roughness: 0.62 });
  const hz = COIL.width / 2;

  // coil
  const coilData = makeCoil(rand);
  const coilMaterial = new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide });
  const coil = new THREE.Mesh(coilData.geometry, coilMaterial);
  coil.position.set(COIL.x, COIL.y, 0);
  coil.frustumCulled = false;
  mill.add(coil);

  const coilGlow = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: glowTexture(256, 'rgba(255,150,50,1)', 'rgba(255,110,20,0)'),
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      transparent: true,
      fog: false,
    })
  );
  coilGlow.position.set(COIL.x, COIL.y, -0.4);
  coilGlow.scale.setScalar(8.5);
  mill.add(coilGlow);

  // static ironwork: mandrel, stands, pinch housing, table frame, press frame
  {
    const box = (w, h, d, x, y, z) => new THREE.BoxGeometry(w, h, d).translate(x, y, z);
    const parts = [new THREE.CylinderGeometry(COIL.inner - 0.03, COIL.inner - 0.03, COIL.width + 1, 28).rotateX(Math.PI / 2).translate(COIL.x, COIL.y, 0)];
    for (const side of [-1, 1]) {
      const z = side * (hz + 0.42);
      parts.push(box(0.36, COIL.y + 0.22, 0.2, COIL.x, (COIL.y + 0.22) / 2, z));
      parts.push(box(1.3, 0.14, 0.44, COIL.x, 0.07, z));
      parts.push(box(0.42, 1.75, 0.2, PINCH_X, 0.875, side * (hz + 0.24)));
      // table: side beams and legs
      const x0 = PINCH_X + 0.3;
      const x1 = PRESS_X - 1.05;
      parts.push(box(x1 - x0, 0.2, 0.1, (x0 + x1) / 2, TABLE_Y - 0.19, side * (hz + 0.16)));
      for (let x = x0 + 0.3; x < x1; x += 1.5) parts.push(box(0.1, TABLE_Y - 0.28, 0.1, x, (TABLE_Y - 0.28) / 2, side * (hz + 0.16)));
      // press columns
      for (const dx of [-0.78, 0.78]) parts.push(box(0.3, 3.5, 0.3, PRESS_X + dx, 1.75, side * (hz + 0.42)));
    }
    parts.push(box(2.2, 0.7, COIL.width + 1.3, PRESS_X, 3.5, 0)); // crown
    parts.push(box(1.9, TABLE_Y - 0.03, COIL.width + 0.34, PRESS_X, (TABLE_Y - 0.03) / 2, 0)); // bed
    mill.add(new THREE.Mesh(mergeGeometries(parts.map((g) => g.toNonIndexed())), iron));

    // rollers
    const x0 = PINCH_X + 0.45;
    const x1 = PRESS_X - 1.15;
    const count = Math.floor((x1 - x0) / 0.4) + 1;
    const rollers = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.08, 0.08, COIL.width + 0.2, 14).rotateX(Math.PI / 2), ironDark, count + 2);
    const m = new THREE.Matrix4();
    for (let i = 0; i < count; i++) rollers.setMatrixAt(i, m.makeTranslation(x0 + i * 0.4, TABLE_Y - 0.085, 0));
    // pinch rolls, above and below the strip
    rollers.setMatrixAt(count, m.makeScale(2, 2, 1).setPosition(PINCH_X, TABLE_Y - 0.165, 0));
    rollers.setMatrixAt(count + 1, m.makeScale(2, 2, 1).setPosition(PINCH_X, TABLE_Y + 0.17, 0));
    mill.add(rollers);
  }

  const ramMaterial = new THREE.MeshStandardMaterial({ color: 0x2b2d32, metalness: 0.85, roughness: 0.5, emissive: 0xff6a12, emissiveIntensity: 0 });
  const ram = new THREE.Mesh(new THREE.BoxGeometry(1.55, 0.6, COIL.width + 0.12), ramMaterial);
  ram.position.set(PRESS_X, 2.8, 0);
  mill.add(ram);

  // strip: coil → pinch → table. Rebuilt every frame (it is 100 vertices).
  const STRIP_N = 50;
  const stripGeometry = new THREE.BufferGeometry();
  stripGeometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(STRIP_N * 6), 3).setUsage(THREE.DynamicDrawUsage));
  stripGeometry.setAttribute('color', new THREE.BufferAttribute(new Float32Array(STRIP_N * 6), 3).setUsage(THREE.DynamicDrawUsage));
  stripGeometry.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(STRIP_N * 6).fill(0).map((_, i) => (i % 3 === 1 ? 1 : 0)), 3));
  {
    const indices = [];
    for (let i = 0; i < STRIP_N - 1; i++) indices.push(i * 2, i * 2 + 1, i * 2 + 3, i * 2, i * 2 + 3, i * 2 + 2);
    stripGeometry.setIndex(indices);
  }
  const stripMaterial = new THREE.MeshStandardMaterial({ color: 0x6f747c, metalness: 1, roughness: 0.42, side: THREE.DoubleSide });
  const strip = new THREE.Mesh(stripGeometry, stripMaterial);
  const stripHeat = new THREE.Mesh(
    stripGeometry,
    new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true })
  );
  stripHeat.position.y = 0.004;
  strip.frustumCulled = stripHeat.frustumCulled = false;
  mill.add(strip, stripHeat);

  // sparks: scale off the coil, and a burst at every stamp
  const makeSparks = (count, colour) => {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(count * 3), 3).setUsage(THREE.DynamicDrawUsage));
    const points = new THREE.Points(
      geometry,
      new THREE.PointsMaterial({
        size: 0.075,
        map: glowTexture(64, 'rgba(255,200,120,1)', 'rgba(255,150,40,0)'),
        color: colour,
        transparent: true,
        opacity: 0,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        fog: false,
      })
    );
    points.frustumCulled = false;
    const seeds = Array.from({ length: count }, () => ({
      phase: rand(),
      life: 0.55 + rand() * 0.9,
      vx: (rand() - 0.25) * 3.2,
      vy: 0.6 + rand() * 3.4,
      vz: (rand() - 0.5) * 2.6,
      ox: rand() - 0.5,
      oz: rand() - 0.5,
    }));
    mill.add(points);
    return { points, seeds };
  };
  const coilSparks = makeSparks(150, new THREE.Color(2.2, 1.5, 0.8));
  const pressSparks = makeSparks(110, new THREE.Color(2.4, 1.7, 0.9));

  const coilLight = new THREE.PointLight(0xff7a22, 0, 26, 1.7);
  coilLight.position.set(COIL.x + 1.2, COIL.y + 0.4, 2.2);
  const pressLight = new THREE.PointLight(0xff8a30, 0, 13, 1.8);
  pressLight.position.set(PRESS_X + 0.6, 1.5, 1.4);
  mill.add(coilLight, pressLight);

  /* =====================================================================
     THE CAR — sits at the origin, nose toward +x; the world moves past it
  ===================================================================== */
  const car = new THREE.Group();
  scene.add(car);
  const loft = buildLoft();

  // dark core + blueprint: what the panels are hung on
  const core = new THREE.Group();
  car.add(core);
  const ghostMaterial = new THREE.LineBasicMaterial({ color: 0xf7ad45, transparent: true, opacity: 0, depthWrite: false });
  {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(loft.positions.slice(), 3));
    geometry.setIndex(gridIndices(loft.rows, RING));
    geometry.computeVertexNormals();
    const pos = geometry.attributes.position;
    const nor = geometry.attributes.normal;
    const inset = (i, d, out) => out.push(pos.getX(i) - nor.getX(i) * d, pos.getY(i) - nor.getY(i) * d, pos.getZ(i) - nor.getZ(i) * d);

    const lines = [];
    const ribs = [...new Set([...CUTS.map((x) => loft.index(x)), ...AXLES.map((x) => loft.index(x)), loft.index(1.5), loft.index(-0.4), loft.index(0.5)])];
    for (const i of ribs) {
      for (let j = J.B; j < LAST - J.B; j++) {
        inset(i * RING + j, 0.004, lines);
        inset(i * RING + j + 1, 0.004, lines);
      }
    }
    for (const j of [J.B, J.D, J.E, J.F, J.G, LAST - J.F, LAST - J.E, LAST - J.D, LAST - J.B]) {
      for (let i = 0; i < loft.rows - 1; i++) {
        inset(i * RING + j, 0.004, lines);
        inset((i + 1) * RING + j, 0.004, lines);
      }
    }
    const ghost = new THREE.BufferGeometry();
    ghost.setAttribute('position', new THREE.Float32BufferAttribute(lines, 3));
    core.add(new THREE.LineSegments(ghost, ghostMaterial));

    for (let i = 0; i < pos.count; i++) pos.setXYZ(i, pos.getX(i) - nor.getX(i) * 0.016, pos.getY(i) - nor.getY(i) * 0.016, pos.getZ(i) - nor.getZ(i) * 0.016);
    geometry.computeVertexNormals();
    const coreMaterial = new THREE.MeshStandardMaterial({ color: 0x070809, metalness: 0.2, roughness: 0.9 });
    core.add(new THREE.Mesh(geometry, coreMaterial));
    // what you would otherwise see straight through the wheel arches
    const blocks = AXLES.map((x) => new THREE.BoxGeometry(0.74, 0.5, 1.2).translate(x, 0.47, 0));
    core.add(new THREE.Mesh(mergeGeometries(blocks), coreMaterial));
  }

  // panels
  const E = J.E;
  const F = J.F;
  const B = J.B;
  const M = LAST;
  const BODY = [
    [-2.05, -0.95, B, E],
    [-2.05, -0.95, M - E, M - B],
    [-0.95, -0.1, B, E],
    [-0.95, -0.1, M - E, M - B],
    [-0.1, 0.95, B, E],
    [-0.1, 0.95, M - E, M - B],
    [0.95, 2.0, B, E],
    [0.95, 2.0, M - E, M - B],
    [-LH, -2.05, B, M - B],
    [2.0, LH, B, M - B],
    [0.98, 2.0, E, M - E],
    [-2.05, -1.55, E, M - E],
    [-1.55, -1.2, E, F],
    [-1.55, -1.2, M - F, M - E],
    [-0.72, 0.12, F, M - F],
  ];
  const GLASS = [
    [0.12, 0.98, F, M - F],
    [-1.55, -0.72, F, M - F],
    [-0.1, 0.92, E, F],
    [-0.1, 0.92, M - F, M - E],
    [-1.2, -0.16, E, F],
    [-1.2, -0.16, M - F, M - E],
  ];

  // raw steel off the press, and how it is finished: liquid silver at night, graphite by day
  const RAW = { color: new THREE.Color(0x8b9199), roughness: 0.5, env: 1.0 };
  const FINISH = { color: new THREE.Color(0xdfe2e6), roughness: 0.2, env: 1.55 };

  const panels = BODY.map(([x0, x1, j0, j1], k) => {
    const patch = makePatch(loft, x0, x1, j0, j1, 0.006);
    patch.geometry.attributes.position.setUsage(THREE.DynamicDrawUsage);
    patch.geometry.attributes.normal.setUsage(THREE.DynamicDrawUsage);
    const material = new THREE.MeshPhysicalMaterial({
      color: RAW.color.clone(),
      metalness: 1,
      roughness: RAW.roughness,
      clearcoat: 0,
      clearcoatRoughness: 0.08,
      envMapIntensity: RAW.env,
      emissive: new THREE.Color(1, 0.36, 0.06),
      emissiveIntensity: 0,
      side: THREE.DoubleSide,
    });
    const mesh = new THREE.Mesh(patch.geometry, material);
    mesh.frustumCulled = false;
    mesh.visible = false;
    car.add(mesh);
    return {
      ...patch,
      mesh,
      material,
      t0: TIME.panelStart + (k / (BODY.length - 1)) * TIME.panelSpan,
      lift: 1.1 + rand() * 1.3,
      // finishing sweeps nose to tail
      paintAt: TIME.paintStart + (1 - (patch.centre.x + LH) / (2 * LH)) * TIME.paintSpan,
      lastT: -1,
      lastPaint: -1,
    };
  });

  const glassBase = new THREE.MeshPhysicalMaterial({ color: 0x05070a, metalness: 0.9, roughness: 0.06, envMapIntensity: 2.2, transparent: true, opacity: 0 });
  const glazing = GLASS.map(([x0, x1, j0, j1], k) => {
    const patch = makePatch(loft, x0, x1, j0, j1, 0.02);
    const material = glassBase.clone();
    const mesh = new THREE.Mesh(patch.geometry, material);
    mesh.visible = false;
    car.add(mesh);
    return { mesh, material, t0: TIME.glassStart + (k / (GLASS.length - 1)) * TIME.glassSpan, lastT: -1 };
  });

  // trim: lamps and intake, laid on the finished surface
  const trim = new THREE.Group();
  trim.visible = false;
  car.add(trim);
  const headMaterial = new THREE.MeshBasicMaterial({ color: 0x15161a, side: THREE.DoubleSide });
  const tailMaterial = new THREE.MeshBasicMaterial({ color: 0x160604, side: THREE.DoubleSide });
  {
    const pair = (x0, x1, j0, j1, material, lift = 0.005) => {
      trim.add(new THREE.Mesh(makeTrim(x0, x1, j0, j1, lift), material));
      trim.add(new THREE.Mesh(makeTrim(x0, x1, M - j1, M - j0, lift), material));
    };
    pair(2.0, 2.315, E - 1.55, E - 0.85, headMaterial);
    pair(-2.346, -2.06, E - 1.15, E - 0.5, tailMaterial);
    pair(2.13, 2.346, B + 0.6, B + 4.4, new THREE.MeshStandardMaterial({ color: 0x050506, metalness: 0.6, roughness: 0.35, side: THREE.DoubleSide }), 0.004);
  }

  // wheels
  const wheelMaterials = {
    tyre: new THREE.MeshStandardMaterial({ color: 0x0b0b0c, metalness: 0.1, roughness: 0.88 }),
    barrel: new THREE.MeshStandardMaterial({ color: 0x121316, metalness: 0.8, roughness: 0.5 }),
    alloy: new THREE.MeshStandardMaterial({ color: 0xcfd2d7, metalness: 1, roughness: 0.26, envMapIntensity: 1.4 }),
  };
  const wheelProto = makeWheel(wheelMaterials);
  const wheels = [];
  AXLES.forEach((x, a) => {
    [1, -1].forEach((side, s) => {
      const wheel = wheelProto.clone();
      wheel.visible = false;
      car.add(wheel);
      wheels.push({ wheel, x, z: side * TRACK, t0: TIME.wheelStart + (a * 2 + s) * 0.022 });
    });
  });

  // contact shadow, lamp glows, beams
  const shadow = new THREE.Mesh(
    new THREE.PlaneGeometry(6.6, 3.5),
    new THREE.MeshBasicMaterial({ map: glowTexture(128, 'rgba(0,0,0,1)', 'rgba(0,0,0,0)'), transparent: true, opacity: 0, depthWrite: false, fog: false })
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.022;
  scene.add(shadow);

  const lampTexture = glowTexture(128, 'rgba(255,236,200,1)', 'rgba(255,200,120,0)');
  const glowSprite = (texture, colour, x, y, z, sx, sy) => {
    const sprite = new THREE.Sprite(
      new THREE.SpriteMaterial({ map: texture, color: colour, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0, fog: false })
    );
    sprite.position.set(x, y, z);
    sprite.scale.set(sx, sy, 1);
    car.add(sprite);
    return sprite;
  };
  const headGlows = [1, -1].map((side) => glowSprite(lampTexture, 0xffffff, 2.2, 0.64, side * 0.6, 1.15, 0.7));
  const tailGlow = glowSprite(glowTexture(128, 'rgba(255,70,20,1)', 'rgba(255,40,0,0)'), 0xffffff, -2.36, 0.8, 0, 2.6, 0.6);
  const beam = new THREE.Mesh(
    new THREE.PlaneGeometry(13, 5.4),
    new THREE.MeshBasicMaterial({ map: lampTexture, color: 0xffe2b8, blending: THREE.AdditiveBlending, transparent: true, opacity: 0, depthWrite: false })
  );
  beam.rotation.x = -Math.PI / 2;
  beam.position.set(8, 0.03, 0);
  scene.add(beam);

  /* =====================================================================
     THE ROAD — appears as the car is finished, then runs forever
  ===================================================================== */
  const road = new THREE.Group();
  road.visible = false;
  scene.add(road);
  const LANE_Z = -1.9; // centre line; the car keeps to the near lane

  const asphalt = new THREE.MeshStandardMaterial({ color: 0x101114, metalness: 0.15, roughness: 0.8, transparent: true, opacity: 0 });
  const tarmac = new THREE.Mesh(new THREE.PlaneGeometry(760, 7.7), asphalt);
  tarmac.rotation.x = -Math.PI / 2;
  tarmac.position.set(60, 0.012, LANE_Z);
  road.add(tarmac);

  const paint = new THREE.MeshBasicMaterial({ color: 0x9a9ea6, transparent: true, opacity: 0 });
  for (const z of [LANE_Z + 3.66, LANE_Z - 3.66]) {
    const edge = new THREE.Mesh(new THREE.PlaneGeometry(760, 0.14), paint);
    edge.rotation.x = -Math.PI / 2;
    edge.position.set(60, 0.02, z);
    road.add(edge);
  }

  const flat = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -Math.PI / 2);
  const one = new THREE.Vector3(1, 1, 1);
  const upright = new THREE.Quaternion();

  const DASH = { count: 44, gap: 12 };
  const dashes = new THREE.InstancedMesh(new THREE.PlaneGeometry(4, 0.14), paint, DASH.count);
  const POST = { count: 38, gap: 14 };
  const posts = new THREE.InstancedMesh(new THREE.BoxGeometry(0.07, 0.8, 0.07).translate(0, 0.4, 0), ironDark, POST.count * 2);
  const studMaterial = new THREE.MeshBasicMaterial({ color: new THREE.Color(2.6, 1.3, 0.3), transparent: true, opacity: 0 });
  const studs = new THREE.InstancedMesh(new THREE.BoxGeometry(0.05, 0.14, 0.09).translate(0, 0.68, 0), studMaterial, POST.count * 2);
  const LAMP = { count: 12, gap: 46, z: LANE_Z - 5.6 };
  const poles = new THREE.InstancedMesh(
    mergeGeometries([
      new THREE.CylinderGeometry(0.06, 0.1, 7.6, 8).translate(0, 3.8, 0).toNonIndexed(),
      new THREE.BoxGeometry(0.08, 0.08, 2.5).translate(0, 7.55, 1.25).toNonIndexed(),
    ]),
    ironDark,
    LAMP.count
  );
  const headsMaterial = new THREE.MeshBasicMaterial({ color: new THREE.Color(3.4, 2.3, 1.1), transparent: true, opacity: 0 });
  const heads = new THREE.InstancedMesh(new THREE.BoxGeometry(0.7, 0.08, 0.24).translate(0, 7.48, 2.4), headsMaterial, LAMP.count);
  const poolMaterial = new THREE.MeshBasicMaterial({
    map: glowTexture(128, 'rgba(255,190,110,1)', 'rgba(255,150,60,0)'),
    blending: THREE.AdditiveBlending,
    transparent: true,
    opacity: 0,
    depthWrite: false,
  });
  const pools = new THREE.InstancedMesh(new THREE.PlaneGeometry(17, 12), poolMaterial, LAMP.count);
  const haloGeometry = new THREE.BufferGeometry();
  haloGeometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(LAMP.count * 3), 3).setUsage(THREE.DynamicDrawUsage));
  const halos = new THREE.Points(
    haloGeometry,
    new THREE.PointsMaterial({
      size: 5.5,
      map: glowTexture(128, 'rgba(255,205,140,1)', 'rgba(255,160,70,0)'),
      transparent: true,
      opacity: 0,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      fog: false,
    })
  );
  [dashes, posts, studs, poles, heads, pools, halos].forEach((mesh) => {
    mesh.frustumCulled = false;
    road.add(mesh);
  });

  const wrap = (value, span) => ((value % span) + span) % span;
  const m4 = new THREE.Matrix4();
  const v3 = new THREE.Vector3();

  function updateRoad(travel) {
    for (let i = 0; i < DASH.count; i++) {
      v3.set(wrap(i * DASH.gap - travel, DASH.count * DASH.gap) - 170, 0.02, LANE_Z);
      dashes.setMatrixAt(i, m4.compose(v3, flat, one));
    }
    for (let i = 0; i < POST.count; i++) {
      const x = wrap(i * POST.gap - travel, POST.count * POST.gap) - 170;
      for (let s = 0; s < 2; s++) {
        // both rows stand on the far verge, so nothing crosses in front of the car
        v3.set(x + s * (POST.gap / 2), 0, LANE_Z - 4.5 - s * 1.2);
        m4.compose(v3, upright, one);
        posts.setMatrixAt(i * 2 + s, m4);
        studs.setMatrixAt(i * 2 + s, m4);
      }
    }
    const halo = haloGeometry.attributes.position;
    for (let i = 0; i < LAMP.count; i++) {
      const x = wrap(i * LAMP.gap + 20 - travel, LAMP.count * LAMP.gap) - 180;
      v3.set(x, 0, LAMP.z);
      m4.compose(v3, upright, one);
      poles.setMatrixAt(i, m4);
      heads.setMatrixAt(i, m4);
      halo.setXYZ(i, x, 7.4, LAMP.z + 2.4);
      v3.set(x, 0.026, LAMP.z + 3.6);
      pools.setMatrixAt(i, m4.compose(v3, flat, one));
    }
    dashes.instanceMatrix.needsUpdate = true;
    posts.instanceMatrix.needsUpdate = true;
    studs.instanceMatrix.needsUpdate = true;
    poles.instanceMatrix.needsUpdate = true;
    heads.instanceMatrix.needsUpdate = true;
    pools.instanceMatrix.needsUpdate = true;
    halo.needsUpdate = true;
  }

  /* ---------- lights ---------- */
  const sun = new THREE.DirectionalLight(0xffb060, 0);
  sun.position.copy(sunDir).multiplyScalar(40).setY(8);
  scene.add(sun);
  const key = new THREE.DirectionalLight(0xdfe6ff, 0.55);
  key.position.set(3, 9, 7);
  scene.add(key);
  const fill = new THREE.HemisphereLight(0x8fa0c0, 0x100c08, 0.32);
  scene.add(fill);

  /* ---------- camera path ---------- */
  //            p     target x   target y   azimuth   distance   height
  const SHOTS = [
    [0.0, -12.6, 1.5, 0.62, 6.6, 2.1],
    [0.1, -12.2, 1.4, 0.5, 7.4, 2.3],
    [0.22, -10.0, 1.1, 0.28, 9.6, 2.8],
    [0.32, -7.4, 1.0, 0.14, 11.2, 3.1],
    [0.46, -3.2, 0.95, 0.3, 12.4, 3.3],
    [0.6, -0.8, 0.8, 0.56, 9.2, 2.6],
    [0.72, 0.1, 0.65, 0.84, 7.0, 1.6],
    [0.8, 0.2, 0.62, 0.5, 6.8, 1.25],
    [0.9, 0.4, 0.65, -0.05, 7.5, 1.2],
    [1.0, 1.5, 0.8, -1.12, 8.4, 2.0],
  ];
  const channel = (c) => spline(SHOTS.map((shot) => [shot[0], shot[c]]));
  const shot = { tx: channel(1), ty: channel(2), az: channel(3), dist: channel(4), cy: channel(5) };
  const rig = { reach: 1, drop: 0, rise: 0 };

  function layout() {
    const w = canvas.clientWidth || window.innerWidth;
    const h = canvas.clientHeight || window.innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    if (camera.aspect < 0.95) {
      camera.fov = 46;
      camera.clearViewOffset();
      Object.assign(rig, { reach: 2.15, drop: 1.5, rise: 1.2 });
    } else {
      camera.fov = 38;
      // push the subject right of centre so the copy has room on the left
      camera.setViewOffset(w, h, -w * 0.17, 0, w, h);
      Object.assign(rig, { reach: 1, drop: 0, rise: 0 });
    }
    camera.updateProjectionMatrix();
    playback.invalidate();
  }

  /* ---------- per-frame update ---------- */
  const info = { p: 0, panels: 0, speed: 0 };
  const target = new THREE.Vector3();
  const colour = new THREE.Color();
  const BLANK = new THREE.Vector3(PRESS_X, TABLE_Y + 0.03, 0);
  const HOLD = 0.16; // share of a panel's time spent under the ram
  let stamp = 0;

  function updatePanels(p) {
    let fitted = 0;
    stamp = 0;
    for (const panel of panels) {
      const t = clamp01((p - panel.t0) / TIME.panelDur);
      if (t >= 1) fitted++;
      if (t > 0 && t < HOLD) stamp = Math.max(stamp, Math.sin((Math.PI * t) / HOLD));

      const painted = clamp01((p - panel.paintAt) / TIME.paintDur);
      if (painted !== panel.lastPaint) {
        panel.lastPaint = painted;
        const k = easeInOutCubic(painted);
        panel.material.color.copy(RAW.color).lerp(FINISH.color, k);
        panel.material.roughness = lerp(RAW.roughness, FINISH.roughness, k);
        panel.material.clearcoat = k;
        panel.material.envMapIntensity = lerp(RAW.env, FINISH.env, k);
      }

      if (t === panel.lastT) continue;
      panel.lastT = t;
      panel.mesh.visible = t > 0;
      if (t <= 0) continue;

      // under the ram it is a flat, hot blank; in flight it takes its shape
      const move = easeInOutCubic(clamp01((t - HOLD) / (1 - HOLD)));
      const form = smoothstep(0, 0.62, move);
      const ox = lerp(BLANK.x, panel.centre.x, move);
      const oy = lerp(BLANK.y, panel.centre.y, move) + Math.sin(Math.PI * move) * panel.lift;
      const oz = lerp(BLANK.z, panel.centre.z, move);
      const pos = panel.geometry.attributes.position.array;
      const nor = panel.geometry.attributes.normal.array;
      const { flat: a, formed: b, normals: n } = panel;
      for (let i = 0; i < pos.length; i += 3) {
        pos[i] = ox + a[i] + (b[i] - a[i]) * form;
        pos[i + 1] = oy + a[i + 1] + (b[i + 1] - a[i + 1]) * form;
        pos[i + 2] = oz + a[i + 2] + (b[i + 2] - a[i + 2]) * form;
        const nx = n[i] * form;
        const ny = 1 + (n[i + 1] - 1) * form;
        const nz = n[i + 2] * form;
        const len = Math.hypot(nx, ny, nz) || 1;
        nor[i] = nx / len;
        nor[i + 1] = ny / len;
        nor[i + 2] = nz / len;
      }
      panel.geometry.attributes.position.needsUpdate = true;
      panel.geometry.attributes.normal.needsUpdate = true;
      panel.material.emissiveIntensity = 2.6 * (1 - smoothstep(0.3, 0.96, t));
    }

    for (const pane of glazing) {
      const t = clamp01((p - pane.t0) / TIME.glassDur);
      if (t >= 1) fitted++;
      if (t === pane.lastT) continue;
      pane.lastT = t;
      const k = easeOutCubic(t);
      pane.mesh.visible = t > 0;
      pane.mesh.position.y = (1 - k) * 0.9;
      pane.material.opacity = k;
      pane.material.transparent = t < 1;
    }
    info.panels = fitted;
  }

  function updateMill(p, time, heat) {
    // the coil gives up its outer wraps; the mandrel turns to keep the strip leaving at one tangent
    const unwound = clamp01((p - TIME.feedStart) / (0.62 - TIME.feedStart));
    const start = Math.floor(coilData.steps * 0.44 * unwound);
    coilData.geometry.setDrawRange(start * 24, (coilData.steps - start) * 24);
    const radius = COIL.outer - (coilData.pitch * start) / COIL.perTurn + coilData.pitch * 0.33;
    const dx = PINCH_X - COIL.x;
    const dy = TABLE_Y - COIL.y;
    const leave = Math.atan2(dy, dx) + Math.acos(radius / Math.hypot(dx, dy));
    coil.rotation.z = leave - (start / COIL.perTurn) * Math.PI * 2;
    coilMaterial.color.setScalar(lerp(0.05, 1, heat) * (0.94 + Math.sin(time * 7.3) * 0.03 + Math.sin(time * 2.1) * 0.03));
    coilGlow.material.opacity = 0.5 * heat * (day ? 0.3 : 1);
    coilLight.intensity = (day ? 110 : 260) * heat * (0.9 + Math.sin(time * 5.1) * 0.1);

    // strip
    const feed = easeInOutCubic(clamp01((p - TIME.feedStart) / (TIME.feedEnd - TIME.feedStart)));
    const head = lerp(PINCH_X + 0.25, PRESS_X + 0.85, feed);
    const pos = stripGeometry.attributes.position;
    const col = stripGeometry.attributes.color;
    const flow = unwound * 46;
    for (let i = 0; i < STRIP_N; i++) {
      let x;
      let y = TABLE_Y;
      if (i === 0) {
        x = COIL.x + Math.cos(leave) * radius;
        y = COIL.y + Math.sin(leave) * radius;
      } else {
        x = lerp(PINCH_X, head, (i - 1) / (STRIP_N - 2));
      }
      pos.setXYZ(i * 2, x, y, hz);
      pos.setXYZ(i * 2 + 1, x, y, -hz);
      const run = x - COIL.x;
      const glow = heat * Math.exp(-Math.max(0, run - 1.2) / 4.6) * (0.86 + 0.14 * Math.sin(run * 2.6 - flow));
      const g = Math.pow(glow, 1.25);
      col.setXYZ(i * 2, 2.5 * g, 0.86 * g * glow, 0.12 * g * glow);
      col.setXYZ(i * 2 + 1, 2.5 * g, 0.86 * g * glow, 0.12 * g * glow);
    }
    pos.needsUpdate = true;
    col.needsUpdate = true;

    // press
    ram.position.y = lerp(2.8, TABLE_Y + 0.36, stamp);
    ramMaterial.emissiveIntensity = stamp * 0.7;
    pressLight.intensity = (day ? 70 : 150) * stamp;

    const fly = (set, ox, oy, oz, spread, strength) => {
      const points = set.points.geometry.attributes.position;
      set.seeds.forEach((s, i) => {
        const age = ((time / s.life + s.phase) % 1) * s.life;
        points.setXYZ(
          i,
          ox + s.ox * spread + s.vx * age,
          Math.max(0.02, oy + s.vy * age - 4.9 * age * age),
          oz + s.oz * COIL.width + s.vz * age
        );
      });
      points.needsUpdate = true;
      set.points.material.opacity = strength;
    };
    fly(coilSparks, COIL.x + 0.9, COIL.y + 0.5, 0, 1.4, 0.85 * heat * (0.35 + 0.65 * smoothstep(0.02, 0.2, unwound) * (1 - smoothstep(0.9, 1, unwound))));
    fly(pressSparks, PRESS_X, TABLE_Y + 0.05, 0, 1.5, stamp);
  }

  function apply(p, time) {
    updatePanels(p);

    const heat = 1 - smoothstep(0.64, 0.78, p);
    const drive = clamp01((p - TIME.driveStart) / (1 - TIME.driveStart));
    const base = 190 * drive * drive;
    const travel = base;

    mill.visible = base < 150;
    if (mill.visible) {
      mill.position.x = -base;
      updateMill(p, time, heat);
    }

    // body core and blueprint
    const coreT = easeOutCubic(clamp01((p - TIME.coreStart) / (TIME.coreEnd - TIME.coreStart)));
    core.visible = coreT > 0;
    core.scale.set(1, Math.max(coreT, 0.001), 1);
    ghostMaterial.opacity = coreT * (1 - smoothstep(0.5, 0.66, p)) * (day ? 0.75 : 0.5);
    shadow.material.opacity = coreT * (day ? 0.5 : 0.9);

    // wheels roll in from the press, then turn with the road
    for (const w of wheels) {
      const t = easeOutCubic(clamp01((p - w.t0) / TIME.wheelDur));
      w.wheel.visible = t > 0;
      const x = lerp(PRESS_X + 1.6, w.x, t);
      w.wheel.position.set(x, WHEEL_R, w.z);
      w.wheel.rotation.z = -(x - w.x + travel) / WHEEL_R;
    }

    // lamps
    const lit = smoothstep(TIME.lightsOn, TIME.lightsOn + 0.02, p);
    trim.visible = p > TIME.glassStart;
    headMaterial.color.setRGB(lerp(0.02, 5.2, lit), lerp(0.02, 4.4, lit), lerp(0.025, 3.2, lit));
    tailMaterial.color.setRGB(lerp(0.03, 1.7, lit), lerp(0.006, 0.07, lit), lerp(0.004, 0.015, lit));
    headGlows.forEach((g) => (g.material.opacity = lit * (day ? 0.5 : 0.95)));
    tailGlow.material.opacity = lit * (day ? 0.35 : 0.7);
    beam.material.opacity = day ? 0 : lit * 0.42;

    // road
    const roadT = smoothstep(0.66, 0.76, p);
    road.visible = roadT > 0;
    if (road.visible) {
      asphalt.opacity = roadT;
      paint.opacity = roadT * 0.85;
      studMaterial.opacity = roadT;
      headsMaterial.opacity = roadT;
      poolMaterial.opacity = day ? 0 : roadT * 0.3;
      halos.material.opacity = day ? 0 : roadT * 0.9;
      updateRoad(travel);
    }

    // a little life in the suspension once it is moving
    car.position.y = Math.sin(time * 2.3) * 0.005 * smoothstep(0.8, 0.9, p);

    const dawn = smoothstep(0.7, 1, p);
    sky.material.uniforms.uDawn.value = dawn;
    sun.intensity = day ? 1.3 + dawn * 0.7 : dawn * 1.25;
    renderer.toneMappingExposure = day ? 1.0 : lerp(1.0, 1.08, dawn);

    info.speed = Math.round(96 * Math.min(1, drive * 1.12));

    // camera
    const azimuth = shot.az(p);
    const distance = shot.dist(p) * rig.reach;
    target.set(shot.tx(p), shot.ty(p) - rig.drop * (distance / 12), 0);
    camera.position.set(
      target.x + Math.sin(azimuth) * distance,
      shot.cy(p) + rig.rise,
      target.z + Math.cos(azimuth) * distance
    );
    camera.lookAt(target);
  }

  const observer = new ResizeObserver(layout);
  observer.observe(canvas);
  layout();

  /** Night mill or white cyclorama — follows the page theme. */
  function setTheme(theme) {
    day = theme === 'light';
    scene.environment = day ? envDay : envNight;
    scene.fog.color.copy(day ? PAPER : NIGHT);
    sky.material.uniforms.uDay.value = day ? 1 : 0;
    groundMaterial.color.set(day ? 0xcfcfcb : 0x0a0b0d);
    groundMaterial.metalness = day ? 0 : 0.35;
    groundMaterial.roughness = day ? 0.92 : 0.7;
    if (day) cityMaterial.color.setRGB(0.7, 0.71, 0.73);
    else cityMaterial.color.set(0x030304);

    // mill
    iron.color.set(day ? 0x3a3d43 : 0x2b2d32);
    ironDark.color.set(day ? 0x25272b : 0x17181b);
    stripMaterial.color.set(day ? 0x474b52 : 0x6f747c);
    stripHeat.material.color.setScalar(day ? 0.5 : 1);
    for (const set of [coilSparks, pressSparks]) {
      // additive sparks vanish on paper: by day they are solid embers
      set.points.material.blending = day ? THREE.NormalBlending : THREE.AdditiveBlending;
      set.points.material.color.setRGB(...(day ? [1.5, 0.5, 0.06] : [2.3, 1.6, 0.85]));
      set.points.material.needsUpdate = true;
    }

    // car
    ghostMaterial.color.set(day ? 0xb3600e : 0xf7ad45);
    RAW.color.set(day ? 0x767c85 : 0x8b9199);
    FINISH.color.set(day ? 0x23262b : 0xdfe2e6);
    FINISH.roughness = day ? 0.24 : 0.2;
    FINISH.env = day ? 1.25 : 1.55;
    panels.forEach((panel) => (panel.lastPaint = -1));

    // road
    asphalt.color.set(day ? 0x45474c : 0x101114);
    asphalt.roughness = day ? 0.9 : 0.8;
    if (day) paint.color.setRGB(1.9, 1.9, 1.86);
    else paint.color.set(0x9a9ea6);
    headsMaterial.color.setRGB(...(day ? [0.5, 0.5, 0.52] : [3.4, 2.3, 1.1])); // lamps are off by day

    // light
    fill.intensity = day ? 1.15 : 0.32;
    key.intensity = day ? 0.9 : 0.55;
    sun.color.set(day ? 0xfff0dc : 0xffb060);
    if (day) sun.position.set(14, 42, 26);
    else sun.position.copy(sunDir).multiplyScalar(40).setY(8);
    playback.invalidate();
  }

  // draw one frame immediately so the canvas is never blank
  playback.setActive(true);
  playback.frame();
  playback.setActive(false);

  return {
    frame: playback.frame,
    setTheme,
    setProgress(value) {
      playback.setProgress(value);
    },
    setActive(value) {
      playback.setActive(value);
    },
    onFrame(fn) {
      listener = fn;
    },
    dispose() {
      observer.disconnect();
      renderer.dispose();
    },
  };
}
