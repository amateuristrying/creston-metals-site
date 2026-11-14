import * as THREE from 'three';
import { makeStudioEnv, brushedTexture, glowTexture, lerp, clamp01 } from './studio.js';

const DEG = Math.PI / 180;

/**
 * The logo's C, traced from the mark: a round bowl whose top and bottom run
 * out flat and are cut on the diagonal. Unit = outer radius.
 */
function cShape(S) {
  const shape = new THREE.Shape();
  shape.moveTo(0, S);
  shape.lineTo(1.12 * S, S); // flat top edge, out to the tip
  shape.lineTo(0.765 * S, 0.41 * S); // diagonal cut
  shape.quadraticCurveTo(0.62 * S, 0.575 * S, 0.333 * S, 0.647 * S); // claw back into the bowl
  shape.absarc(0.16 * S, 0, 0.67 * S, 75 * DEG, 270 * DEG, false); // inner bowl, set right of centre
  shape.lineTo(0.45 * S, -0.67 * S);
  shape.lineTo(0.695 * S, -0.365 * S); // the notch of the lower arm
  shape.lineTo(1.1 * S, -0.365 * S);
  shape.lineTo(0.72 * S, -S); // diagonal cut
  shape.lineTo(0, -S); // flat base
  shape.absarc(0, 0, S, 270 * DEG, 90 * DEG, true); // outer bowl
  return shape;
}

/**
 * A gold swoosh: a flat band on a circular arc that tapers to a point at both
 * ends and twists a little along its length. Built tail-first so a growing
 * draw range "draws" it toward the tip.
 */
function ribbonGeometry({ radius, from, to, width, twist = [0, 0], segments = 180 }) {
  const positions = [];
  const indices = [];
  for (let i = 0; i <= segments; i++) {
    const u = i / segments;
    const angle = from + (to - from) * u;
    const half = Math.max(0.002, width * 0.5 * Math.pow(Math.sin(Math.PI * Math.pow(u, 0.8)), 0.85));
    const roll = twist[0] + (twist[1] - twist[0]) * u;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    const dr = Math.cos(roll) * half;
    const dz = Math.sin(roll) * half;
    positions.push((radius - dr) * cos, (radius - dr) * sin, -dz, (radius + dr) * cos, (radius + dr) * sin, dz);
    if (i < segments) {
      const k = i * 2;
      indices.push(k, k + 1, k + 3, k, k + 3, k + 2);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

/**
 * Hero: the Creston mark rebuilt in 3D — a brushed-steel C with two ember
 * ribbons in orbit. Reacts to the pointer; `state.intro` and `state.scroll`
 * are tweened from outside by GSAP.
 */
export function createHeroScene(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;

  const scene = new THREE.Scene();
  scene.environment = makeStudioEnv(renderer);

  const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 100);
  camera.position.set(0, 0, 11);

  const rig = new THREE.Group(); // placement in frame
  const pivot = new THREE.Group(); // pointer tilt
  const spin = new THREE.Group(); // intro + scroll rotation
  scene.add(rig);
  rig.add(pivot);
  pivot.add(spin);

  // --- steel C
  const brushed = brushedTexture();
  brushed.repeat.set(0.45, 0.45);
  brushed.center.set(0.5, 0.5);
  brushed.rotation = 0.42; // the grain in the mark runs on the diagonal
  const steel = new THREE.MeshPhysicalMaterial({
    color: 0xeef0f3,
    metalness: 1,
    roughness: 0.5,
    roughnessMap: brushed,
    bumpMap: brushed,
    bumpScale: 0.35,
    clearcoat: 0.25,
    clearcoatRoughness: 0.4,
    envMapIntensity: 1.9,
  });
  const S = 1.72;
  const DEPTH = 0.5;
  const cGeometry = new THREE.ExtrudeGeometry(cShape(S), {
    depth: DEPTH,
    bevelEnabled: true,
    bevelThickness: 0.04,
    bevelSize: 0.035,
    bevelSegments: 5,
    curveSegments: 96,
  });
  // keep the bowl's centre at the origin: the ribbons are placed against it
  cGeometry.translate(0, 0, -DEPTH / 2);
  const cMesh = new THREE.Mesh(cGeometry, steel);
  spin.add(cMesh);

  // --- ember ribbons: two swooshes that rise from under the C, round its left
  //     side and cross in front of the bowl — as in the mark
  const gold = new THREE.MeshPhysicalMaterial({
    color: 0xffb648,
    metalness: 1,
    roughness: 0.26,
    // the swooshes are lit from within, like the glow in the mark
    emissive: 0xc8741a,
    emissiveIntensity: 0.95,
    envMapIntensity: 1.6,
    side: THREE.DoubleSide,
  });
  const ribbons = [
    { radius: 1.45 * S, centre: [-0.087 * S, -0.154 * S], from: 250, to: 60, width: 0.21 * S, tilt: 70, roll: 20, twist: [0.3, -0.5], orbit: 0.11 },
    { radius: 1.22 * S, centre: [-0.1 * S, -0.2 * S], from: 255, to: 108, width: 0.15 * S, tilt: 69, roll: 18, twist: [0.2, -0.35], orbit: 0.085 },
  ].map((cfg) => {
    const holder = new THREE.Group();
    holder.position.set(cfg.centre[0], cfg.centre[1], 0);
    holder.rotation.order = 'ZXY'; // tip toward the viewer first, then roll in the picture plane
    holder.rotation.set(cfg.tilt * DEG, 0, cfg.roll * DEG);
    const geometry = ribbonGeometry({ radius: cfg.radius, from: cfg.from * DEG, to: cfg.to * DEG, width: cfg.width, twist: cfg.twist });
    const mesh = new THREE.Mesh(geometry, gold);
    holder.add(mesh);
    spin.add(holder);
    return { mesh, geometry, total: geometry.index.count, orbit: cfg.orbit, angle: 0 };
  });

  // --- sparks
  const SPARKS = 220;
  const sparkPos = new Float32Array(SPARKS * 3);
  const sparkVel = new Float32Array(SPARKS);
  for (let i = 0; i < SPARKS; i++) {
    sparkPos[i * 3] = (Math.random() - 0.5) * 18;
    sparkPos[i * 3 + 1] = (Math.random() - 0.5) * 9;
    sparkPos[i * 3 + 2] = (Math.random() - 0.7) * 8;
    sparkVel[i] = 0.08 + Math.random() * 0.32;
  }
  const sparkGeometry = new THREE.BufferGeometry();
  sparkGeometry.setAttribute('position', new THREE.BufferAttribute(sparkPos, 3));
  const sparks = new THREE.Points(
    sparkGeometry,
    new THREE.PointsMaterial({
      size: 0.07,
      map: glowTexture(64, 'rgba(255,190,110,1)', 'rgba(255,150,40,0)'),
      transparent: true,
      opacity: 0.85,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    })
  );
  scene.add(sparks);

  // --- light from behind-left, like the glow in the logo
  const ember = new THREE.PointLight(0xffa040, 60, 14, 2);
  ember.position.set(-2.6, 0.4, -1.6);
  rig.add(ember);
  // a hot highlight where the swooshes turn, front-left
  const kiss = new THREE.PointLight(0xffd08a, 0, 9, 2);
  kiss.position.set(-3.4, -0.9, 2.6);
  rig.add(kiss);
  const key = new THREE.DirectionalLight(0xffffff, 2.2);
  key.position.set(3, 5, 6);
  scene.add(key);

  const state = { intro: 0, scroll: 0 };
  const pointer = { x: 0, y: 0, tx: 0, ty: 0 };
  let active = true;
  let portrait = false;
  let orbitGain = 0; // eases the orbit in once the intro has finished
  const stillness = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function layout() {
    const w = canvas.clientWidth || window.innerWidth;
    const h = canvas.clientHeight || window.innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    const halfH = Math.tan((camera.fov / 2) * DEG) * camera.position.z;
    const halfW = halfH * camera.aspect;
    portrait = camera.aspect < 0.95;
    if (portrait) {
      rig.position.set(halfW * 0.16, halfH * 0.5, 0);
      rig.scale.setScalar(Math.min(0.8, halfW / 3.15));
    } else {
      rig.position.set(halfW * 0.54, halfH * 0.1, 0);
      rig.scale.setScalar(Math.min(1.06, halfW / 5.1));
    }
  }

  const onPointer = (e) => {
    pointer.tx = (e.clientX / window.innerWidth) * 2 - 1;
    pointer.ty = (e.clientY / window.innerHeight) * 2 - 1;
  };
  window.addEventListener('pointermove', onPointer, { passive: true });

  const observer = new ResizeObserver(layout);
  observer.observe(canvas);
  layout();

  let last = performance.now();
  function frame(now) {
    const step = Math.min(0.25, (now - last) / 1000); // true elapsed time: keeps the orbit even at any frame rate
    const dt = Math.min(0.05, step);
    last = now;
    if (!active) return;
    const t = now / 1000;

    pointer.x = lerp(pointer.x, pointer.tx, 0.06);
    pointer.y = lerp(pointer.y, pointer.ty, 0.06);
    pivot.rotation.y = pointer.x * 0.42;
    pivot.rotation.x = pointer.y * 0.24;

    const intro = state.intro;
    const scroll = state.scroll;
    spin.rotation.y = -0.34 + Math.sin(t * 0.35) * 0.08 + scroll * 1.9 - (1 - intro) * 2.6;
    spin.rotation.x = 0.06 + Math.sin(t * 0.27) * 0.035 + scroll * 0.35;
    spin.position.y = Math.sin(t * 0.6) * 0.07 + scroll * 1.6;
    spin.scale.setScalar(lerp(0.55, 1, intro) * (1 - scroll * 0.18));

    // the swooshes draw themselves in at the logo's pose, then orbit the C —
    // tip first, about a minute a lap — and sweep faster as the page scrolls
    const drawn = clamp01((intro - 0.25) / 0.75);
    if (!stillness) orbitGain += ((drawn >= 1 ? 1 : 0) - orbitGain) * (1 - Math.exp(-step * 0.7));
    ribbons.forEach((r) => {
      r.geometry.setDrawRange(0, Math.floor((r.total * drawn) / 6) * 6);
      r.angle -= r.orbit * orbitGain * step;
      r.mesh.rotation.z = r.angle - scroll * 1.5;
    });
    ember.intensity = 60 * intro * (0.85 + Math.sin(t * 1.3) * 0.15);
    kiss.intensity = 26 * intro * (0.8 + Math.sin(t * 0.9 + 1) * 0.2);

    const pos = sparkGeometry.attributes.position;
    for (let i = 0; i < SPARKS; i++) {
      let y = pos.getY(i) + sparkVel[i] * dt;
      if (y > 4.6) y = -4.6;
      pos.setY(i, y);
      pos.setX(i, pos.getX(i) + Math.sin(t * 0.6 + i) * 0.0009);
    }
    pos.needsUpdate = true;
    sparks.material.opacity = 0.85 * intro * (1 - scroll);
    sparks.rotation.y = pointer.x * 0.05;

    renderer.render(scene, camera);
  }

  return {
    state,
    frame,
    setActive(value) {
      active = value;
    },
    /** On paper, additive sparks wash out: swap them for ink-safe embers. */
    setTheme(theme) {
      const light = theme === 'light';
      sparks.material.blending = light ? THREE.NormalBlending : THREE.AdditiveBlending;
      sparks.material.color.set(light ? 0xd2761a : 0xffffff);
      sparks.material.needsUpdate = true;
    },
    dispose() {
      window.removeEventListener('pointermove', onPointer);
      observer.disconnect();
      renderer.dispose();
    },
  };
}
