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
   Stockyard → Skyline
   One number drives everything: progress `p` in [0, 1].

     0.00 – 0.12   a stockpile of steel; a blueprint ghost of the tower
     0.12 – 0.66   560 members leave the pile, heat to ember in flight,
                   and cool into a 14-storey frame, floor by floor
     0.56 – 0.87   decks and curtain wall rise
     0.80 – 0.88   the crown is set
     0.87 – 1.00   dawn; the lights come on
------------------------------------------------------------------- */

const NX = 3;
const NZ = 3;
const BAY = 1.6;
const FLOORS = 14;
const FH = 1.1;
const W = NX * BAY;
const D = NZ * BAY;
const H = FLOORS * FH;

const TIME = {
  steelStart: 0.12,
  steelSpan: 0.44,
  steelDur: 0.085,
  glassStart: 0.56,
  glassSpan: 0.25,
  glassDur: 0.06,
  crownStart: 0.8,
  crownEnd: 0.88,
  lightsStart: 0.87,
  lightsSpan: 0.09,
};

export const BUILD_STEPS = [0, 0.12, 0.35, 0.56, 0.8, 0.87];
export const BUILD_MEMBERS = FLOORS * ((NX + 1) * (NZ + 1) + NX * (NZ + 1) + NZ * (NX + 1));
export const BUILD_FLOORS = FLOORS;

/** Unit I-beam: length 1 along X, 1 × 1 profile. Scaled per instance. */
function iBeamGeometry() {
  const flange = 0.2;
  const web = 0.22;
  const top = new THREE.BoxGeometry(1, flange, 1).translate(0, 0.5 - flange / 2, 0);
  const bottom = new THREE.BoxGeometry(1, flange, 1).translate(0, -0.5 + flange / 2, 0);
  const middle = new THREE.BoxGeometry(1, 1 - flange * 2, web);
  return mergeGeometries([top, bottom, middle]);
}

export function createBuildScene(canvas) {
  const rand = mulberry32(20261112);
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

  // two studios: the forge at night, and a white cyclorama for the day theme
  const envNight = makeStudioEnv(renderer);
  const envDay = makeStudioEnv(renderer, true);
  const scene = new THREE.Scene();
  scene.environment = envNight;
  scene.fog = new THREE.Fog(NIGHT.clone(), 38, 130);
  let day = false;

  const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 400);

  /* ---------- sky: night that turns to first light (or paper, by day) ---------- */
  const sky = makeDawnSky();
  scene.add(sky);

  /* ---------- ground ---------- */
  const groundMaterial = new THREE.MeshStandardMaterial({ color: 0x0a0b0d, metalness: 0.55, roughness: 0.58 });
  const ground = new THREE.Mesh(new THREE.CircleGeometry(140, 64), groundMaterial);
  ground.rotation.x = -Math.PI / 2;
  scene.add(ground);

  const grid = new THREE.GridHelper(96, 60, 0x4a3312, 0x1b1c20);
  const gridDay = new THREE.GridHelper(96, 60, 0xc98a3a, 0xa4a7ab);
  [grid, gridDay].forEach((g) => {
    g.position.y = 0.01;
    g.material.transparent = true;
    g.material.opacity = 0.55;
    scene.add(g);
  });
  gridDay.visible = false;

  const spill = new THREE.Mesh(
    new THREE.PlaneGeometry(26, 26),
    new THREE.MeshBasicMaterial({
      map: glowTexture(256, 'rgba(255,170,80,1)', 'rgba(255,140,40,0)'),
      transparent: true,
      opacity: 0,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      fog: false,
    })
  );
  spill.rotation.x = -Math.PI / 2;
  spill.position.y = 0.03;
  scene.add(spill);

  /* ---------- a quiet city on the horizon ---------- */
  const CITY = 190;
  const cityMaterial = new THREE.MeshBasicMaterial({ color: 0x030304 });
  const city = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), cityMaterial, CITY);
  {
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    for (let i = 0; i < CITY; i++) {
      const angle = rand() * Math.PI * 2;
      const radius = 62 + rand() * 60;
      const w = 2 + rand() * 5;
      const h = 2 + Math.pow(rand(), 2.4) * 22;
      q.setFromAxisAngle(THREE.Object3D.DEFAULT_UP, rand() * Math.PI);
      m.compose(
        new THREE.Vector3(Math.sin(angle) * radius, h / 2, Math.cos(angle) * radius),
        q,
        new THREE.Vector3(w, h, 2 + rand() * 5)
      );
      city.setMatrixAt(i, m);
    }
  }
  city.frustumCulled = false;
  scene.add(city);

  /* ---------- blueprint ghost ---------- */
  const ghostMaterial = new THREE.LineBasicMaterial({ color: 0xf7ad45, transparent: true, opacity: 0, depthWrite: false });
  {
    const pts = [];
    const x0 = -W / 2;
    const z0 = -D / 2;
    for (let f = 0; f <= FLOORS; f++) {
      const y = f * FH;
      pts.push(x0, y, z0, -x0, y, z0, -x0, y, z0, -x0, y, -z0, -x0, y, -z0, x0, y, -z0, x0, y, -z0, x0, y, z0);
    }
    for (let ix = 0; ix <= NX; ix++) {
      for (let iz = 0; iz <= NZ; iz++) {
        if (ix > 0 && ix < NX && iz > 0 && iz < NZ) continue;
        pts.push(x0 + ix * BAY, 0, z0 + iz * BAY, x0 + ix * BAY, H, z0 + iz * BAY);
      }
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
    scene.add(new THREE.LineSegments(geometry, ghostMaterial));
  }

  /* ---------- steel members ---------- */
  const qIdentity = new THREE.Quaternion();
  const qY = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI / 2);
  const qZ = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), Math.PI / 2);
  const qStack = qY; // in the yard everything lies along Z

  const pieces = [];
  for (let f = 0; f < FLOORS; f++) {
    const y0 = f * FH;
    const tFloor = TIME.steelStart + (f / FLOORS) * TIME.steelSpan;
    for (let ix = 0; ix <= NX; ix++) {
      for (let iz = 0; iz <= NZ; iz++) {
        pieces.push({
          floor: f,
          pos: new THREE.Vector3(ix * BAY - W / 2, y0 + FH / 2, iz * BAY - D / 2),
          quat: qZ,
          scale: new THREE.Vector3(FH, 0.18, 0.18),
          t0: tFloor + rand() * 0.022,
        });
      }
    }
    for (let ix = 0; ix < NX; ix++) {
      for (let iz = 0; iz <= NZ; iz++) {
        pieces.push({
          floor: f,
          pos: new THREE.Vector3((ix + 0.5) * BAY - W / 2, y0 + FH - 0.09, iz * BAY - D / 2),
          quat: qIdentity,
          scale: new THREE.Vector3(BAY - 0.18, 0.17, 0.12),
          t0: tFloor + 0.028 + rand() * 0.022,
        });
      }
    }
    for (let ix = 0; ix <= NX; ix++) {
      for (let iz = 0; iz < NZ; iz++) {
        pieces.push({
          floor: f,
          pos: new THREE.Vector3(ix * BAY - W / 2, y0 + FH - 0.09, (iz + 0.5) * BAY - D / 2),
          quat: qY,
          scale: new THREE.Vector3(BAY - 0.18, 0.17, 0.12),
          t0: tFloor + 0.028 + rand() * 0.022,
        });
      }
    }
  }
  const N = pieces.length;

  // Yard slots: the first members to leave sit on top of the pile.
  const COLS = 16;
  const ROWS = 3;
  const PER_LAYER = COLS * ROWS;
  [...pieces]
    .sort((a, b) => a.t0 - b.t0)
    .forEach((piece, order) => {
      const rank = N - 1 - order;
      const layer = Math.floor(rank / PER_LAYER);
      const index = rank % PER_LAYER;
      const col = index % COLS;
      const row = Math.floor(index / COLS);
      piece.stack = new THREE.Vector3((col - (COLS - 1) / 2) * 0.2, 0.1 + layer * 0.19, (row - 1) * 1.74);
      piece.lift = 1.6 + rand() * 2.2;
      piece.lastT = -1;
    });

  const steel = new THREE.InstancedMesh(
    iBeamGeometry(),
    new THREE.MeshStandardMaterial({ color: 0xffffff, metalness: 1, roughness: 0.42, envMapIntensity: 0.95 }),
    N
  );
  steel.frustumCulled = false;
  steel.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  scene.add(steel);

  const cStack = new THREE.Color(0x5d6169);
  const cPlaced = new THREE.Color(0x9da3ad);
  const cHot = new THREE.Color(1.9, 0.95, 0.24);

  /* ---------- decks ---------- */
  const deckMaterial = new THREE.MeshStandardMaterial({ color: 0x23252a, metalness: 0.4, roughness: 0.75 });
  const decks = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), deckMaterial, FLOORS);
  decks.frustumCulled = false;
  scene.add(decks);

  /* ---------- curtain wall + lit windows ---------- */
  const panels = [];
  for (let f = 0; f < FLOORS; f++) {
    const y0 = f * FH;
    const t0 = TIME.glassStart + (f / FLOORS) * TIME.glassSpan;
    const add = (x, z, rotated, nx, nz) =>
      panels.push({ x, z, y0, rotated, nx, nz, t0: t0 + rand() * 0.02, lit: rand() < 0.58, lastT: -1, lastL: -1 });
    for (let i = 0; i < NX; i++) {
      add((i + 0.5) * BAY - W / 2, D / 2, false, 0, 1);
      add((i + 0.5) * BAY - W / 2, -D / 2, false, 0, -1);
    }
    for (let i = 0; i < NZ; i++) {
      add(W / 2, (i + 0.5) * BAY - D / 2, true, 1, 0);
      add(-W / 2, (i + 0.5) * BAY - D / 2, true, -1, 0);
    }
  }
  const glassMaterial = new THREE.MeshPhysicalMaterial({
    color: 0x1a2f45,
    metalness: 0.9,
    roughness: 0.07,
    transparent: true,
    opacity: 0.74,
    depthWrite: false,
    envMapIntensity: 2.1,
  });
  const glass = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), glassMaterial, panels.length);
  glass.frustumCulled = false;
  glass.renderOrder = 2;
  scene.add(glass);

  const litPanels = panels.filter((p) => p.lit);
  litPanels.forEach((p) => {
    p.lightAt = TIME.lightsStart + rand() * TIME.lightsSpan;
    p.warm = rand();
  });
  const lights = new THREE.InstancedMesh(
    new THREE.BoxGeometry(1, 1, 1),
    // additive, just proud of the glass: reads as light pouring out of a room
    new THREE.MeshBasicMaterial({
      color: 0xffffff,
      fog: false,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    }),
    litPanels.length
  );
  lights.frustumCulled = false;
  lights.renderOrder = 3;
  scene.add(lights);

  /* ---------- crown ---------- */
  const goldMaterial = new THREE.MeshStandardMaterial({
    color: 0xf5a83c,
    metalness: 1,
    roughness: 0.25,
    emissive: 0xff8a1e,
    emissiveIntensity: 0,
  });
  const crown = new THREE.Group();
  {
    const beam = new THREE.BoxGeometry(1, 0.2, 0.2);
    const edge = (x, z, length, rotated) => {
      const mesh = new THREE.Mesh(beam, goldMaterial);
      mesh.position.set(x, 0.1, z);
      mesh.scale.x = length;
      if (rotated) mesh.rotation.y = Math.PI / 2;
      crown.add(mesh);
    };
    edge(0, D / 2 + 0.1, W + 0.4, false);
    edge(0, -D / 2 - 0.1, W + 0.4, false);
    edge(W / 2 + 0.1, 0, D + 0.4, true);
    edge(-W / 2 - 0.1, 0, D + 0.4, true);
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.08, 3.4, 10), goldMaterial);
    mast.position.y = 1.7;
    crown.add(mast);
  }
  crown.position.y = H + 0.08;
  crown.visible = false;
  scene.add(crown);

  const beacon = new THREE.Mesh(
    new THREE.SphereGeometry(0.11, 12, 12),
    new THREE.MeshBasicMaterial({ color: new THREE.Color(3, 1.4, 0.3), fog: false })
  );
  beacon.position.y = H + 3.6;
  beacon.visible = false;
  scene.add(beacon);

  /* ---------- lights ---------- */
  const sun = new THREE.DirectionalLight(0xffb060, 0);
  scene.add(sun);
  const fill = new THREE.HemisphereLight(0x8fa0c0, 0x100c08, 0.35);
  scene.add(fill);

  /* ---------- layout (landscape vs portrait) ---------- */
  const stackOrigin = new THREE.Vector3();
  const cfg = {};
  let force = true;

  function layout() {
    // styles can land a tick after the module runs — fall back to the viewport
    const w = canvas.clientWidth || window.innerWidth;
    const h = canvas.clientHeight || window.innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    const portrait = camera.aspect < 0.95;

    if (portrait) {
      camera.fov = 46;
      camera.clearViewOffset();
      stackOrigin.set(-0.8, 0, 6.2);
      Object.assign(cfg, {
        a0: -0.42,
        a1: 0.62,
        d0: 21,
        d1: 36,
        y0: 3.4,
        y1: 7.5,
        from: new THREE.Vector3(-0.6, 0.2, 4.4),
        to: new THREE.Vector3(0, H * 0.4, 0),
      });
    } else {
      camera.fov = 38;
      // push the subject right of centre so the copy has room on the left
      camera.setViewOffset(w, h, -w * 0.19, 0, w, h);
      stackOrigin.set(-6.4, 0, 2.6);
      Object.assign(cfg, {
        a0: -0.5,
        a1: 0.72,
        d0: 17,
        d1: 32,
        y0: 2.8,
        y1: 6.4,
        from: new THREE.Vector3(-3.4, 1.9, 1.2),
        to: new THREE.Vector3(0, H * 0.57, 0),
      });
    }
    camera.updateProjectionMatrix();

    // dawn breaks behind the tower as seen from the final camera position
    sunDir.set(-Math.sin(cfg.a1 - 0.35), 0, -Math.cos(cfg.a1 - 0.35)).normalize();
    sky.material.uniforms.uSun.value.copy(sunDir);
    placeSun();
    force = true;
    playback.invalidate();
  }

  const sunDir = new THREE.Vector3(0, 0, -1);
  function placeSun() {
    // night: a low sun behind the tower. day: high and from the camera's side, so the frame reads
    if (day) sun.position.set(-sunDir.x * 18 - sunDir.z * 26, 44, -sunDir.z * 18 + sunDir.x * 26);
    else sun.position.copy(sunDir).multiplyScalar(40).setY(9);
  }

  /** Night forge or white cyclorama — follows the page theme. */
  function setTheme(theme) {
    day = theme === 'light';
    scene.environment = day ? envDay : envNight;
    scene.fog.color.copy(day ? PAPER : NIGHT);
    sky.material.uniforms.uDay.value = day ? 1 : 0;
    groundMaterial.color.set(day ? 0xcfcfcb : 0x0a0b0d);
    groundMaterial.metalness = day ? 0 : 0.55;
    groundMaterial.roughness = day ? 0.92 : 0.58;
    grid.visible = !day;
    gridDay.visible = day;
    if (day) cityMaterial.color.setRGB(0.7, 0.71, 0.73);
    else cityMaterial.color.set(0x030304);
    ghostMaterial.color.set(day ? 0xb3600e : 0xf7ad45);
    cStack.set(day ? 0x30333a : 0x5d6169);
    cPlaced.set(day ? 0x4a4e56 : 0x9da3ad);
    steel.material.envMapIntensity = day ? 0.8 : 0.95;
    deckMaterial.color.set(day ? 0x6b6f76 : 0x23252a);
    glassMaterial.color.set(day ? 0x20303d : 0x1a2f45);
    glassMaterial.envMapIntensity = day ? 1.2 : 2.1;
    fill.intensity = day ? 1.15 : 0.35;
    sun.color.set(day ? 0xfff0dc : 0xffb060);
    placeSun();
    force = true;
    playback.invalidate();
  }

  /* ---------- per-frame update ---------- */
  const m4 = new THREE.Matrix4();
  const pos = new THREE.Vector3();
  const quat = new THREE.Quaternion();
  const scl = new THREE.Vector3();
  const col = new THREE.Color();
  const target = new THREE.Vector3();
  const ZERO_SCALE = new THREE.Vector3(0, 0, 0);
  const info = { p: 0, placed: 0, floor: 0 };

  function updateSteel(p) {
    let placed = 0;
    let floor = 0;
    let dirty = false;
    for (let i = 0; i < N; i++) {
      const piece = pieces[i];
      const t = clamp01((p - piece.t0) / TIME.steelDur);
      if (t >= 1) {
        placed++;
        if (piece.floor + 1 > floor) floor = piece.floor + 1;
      }
      if (!force && t === piece.lastT) continue;
      piece.lastT = t;
      dirty = true;

      // lift first, then travel: like a crane pick
      const up = easeOutCubic(clamp01(t * 1.6));
      const across = easeInOutCubic(clamp01((t - 0.12) / 0.88));
      const sx = stackOrigin.x + piece.stack.x;
      const sy = piece.stack.y;
      const sz = stackOrigin.z + piece.stack.z;
      pos.set(
        lerp(sx, piece.pos.x, across),
        lerp(sy, piece.pos.y, up) + Math.sin(Math.PI * across) * piece.lift * (1 - across * 0.4),
        lerp(sz, piece.pos.z, across)
      );
      quat.copy(qStack).slerp(piece.quat, across);
      m4.compose(pos, quat, piece.scale);
      steel.setMatrixAt(i, m4);

      const heat = Math.sin(Math.PI * clamp01(t * 1.05));
      col.copy(cStack).lerp(cPlaced, across).lerp(cHot, heat * 0.92);
      steel.setColorAt(i, col);
    }
    if (dirty) {
      steel.instanceMatrix.needsUpdate = true;
      steel.instanceColor.needsUpdate = true;
    }
    info.placed = placed;
    info.floor = floor;
  }

  const deckState = new Float32Array(FLOORS).fill(-1);
  function updateDecks(p) {
    let dirty = false;
    for (let f = 0; f < FLOORS; f++) {
      const t0 = TIME.steelStart + (f / FLOORS) * TIME.steelSpan + 0.12;
      const t = easeOutCubic(clamp01((p - t0) / 0.05));
      if (!force && t === deckState[f]) continue;
      deckState[f] = t;
      dirty = true;
      pos.set(0, (f + 1) * FH + 0.03, 0);
      scl.set((W + 0.26) * t, 0.07, (D + 0.26) * t);
      m4.compose(pos, qIdentity, t > 0 ? scl : ZERO_SCALE);
      decks.setMatrixAt(f, m4);
    }
    if (dirty) decks.instanceMatrix.needsUpdate = true;
  }

  function updateGlass(p) {
    let dirty = false;
    let dirtyLights = false;
    let li = 0;
    for (let i = 0; i < panels.length; i++) {
      const panel = panels[i];
      const t = easeOutCubic(clamp01((p - panel.t0) / TIME.glassDur));
      if (force || t !== panel.lastT) {
        panel.lastT = t;
        dirty = true;
        const height = (FH - 0.06) * t;
        pos.set(panel.x + panel.nx * 0.14, panel.y0 + 0.03 + height / 2, panel.z + panel.nz * 0.14);
        scl.set(BAY - 0.05, height, 0.035);
        m4.compose(pos, panel.rotated ? qY : qIdentity, t > 0 ? scl : ZERO_SCALE);
        glass.setMatrixAt(i, m4);
      }
      if (panel.lit) {
        const l = clamp01((p - panel.lightAt) / 0.012);
        if (force || l !== panel.lastL) {
          panel.lastL = l;
          dirtyLights = true;
          pos.set(panel.x + panel.nx * 0.17, panel.y0 + FH / 2 - 0.02, panel.z + panel.nz * 0.17);
          scl.set(BAY - 0.22, FH - 0.3, 0.01);
          m4.compose(pos, panel.rotated ? qY : qIdentity, l > 0 ? scl : ZERO_SCALE);
          lights.setMatrixAt(li, m4);
          const k = (0.42 + panel.warm * 0.5) * l;
          col.setRGB(1.0 * k, lerp(0.46, 0.66, panel.warm) * k, lerp(0.1, 0.3, panel.warm) * k);
          lights.setColorAt(li, col);
        }
        li++;
      }
    }
    if (dirty) glass.instanceMatrix.needsUpdate = true;
    if (dirtyLights) {
      lights.instanceMatrix.needsUpdate = true;
      lights.instanceColor.needsUpdate = true;
    }
  }

  function apply(p, time) {
    updateSteel(p);
    updateDecks(p);
    updateGlass(p);
    force = false;

    const dawn = smoothstep(0.5, 1, p);
    const alive = smoothstep(TIME.lightsStart, 1, p);

    ghostMaterial.opacity = smoothstep(0, 0.08, p) * (1 - smoothstep(0.45, 0.8, p)) * (day ? 0.6 : 0.3);
    sky.material.uniforms.uDawn.value = dawn;
    sun.intensity = day ? 1.3 + dawn * 0.9 : dawn * 2.0;
    spill.material.opacity = day ? 0 : alive * 0.5;
    renderer.toneMappingExposure = day ? 1.0 : lerp(0.95, 1.12, dawn);

    const crownT = easeOutCubic(clamp01((p - TIME.crownStart) / (TIME.crownEnd - TIME.crownStart)));
    crown.visible = crownT > 0;
    crown.scale.set(1, Math.max(crownT, 0.001), 1);
    goldMaterial.emissiveIntensity = alive * 0.9;
    beacon.visible = crownT >= 1;
    if (beacon.visible) beacon.scale.setScalar(0.7 + (Math.sin(time * 3.2) * 0.5 + 0.5) * 0.9);

    // camera: a slow orbit that pulls back and rises as the tower does
    const angle = lerp(cfg.a0, cfg.a1, p);
    const dist = lerp(cfg.d0, cfg.d1, easeInOutCubic(p));
    target.lerpVectors(cfg.from, cfg.to, smoothstep(0.04, 0.6, p));
    camera.position.set(
      target.x + Math.sin(angle) * dist,
      lerp(cfg.y0, cfg.y1, p),
      target.z + Math.cos(angle) * dist
    );
    camera.lookAt(target);
  }

  const observer = new ResizeObserver(layout);
  observer.observe(canvas);
  layout();

  // draw one frame immediately so the canvas is never blank
  playback.setActive(true);
  playback.frame();
  playback.setActive(false);

  return {
    frame: playback.frame,
    setProgress(value) {
      playback.setProgress(value);
    },
    setActive(value) {
      playback.setActive(value);
    },
    onFrame(fn) {
      listener = fn;
    },
    setTheme,
    dispose() {
      observer.disconnect();
      renderer.dispose();
    },
  };
}
