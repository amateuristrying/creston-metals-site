import * as THREE from 'three';
import { makeStudioEnv, brushedTexture, glowTexture, lerp } from './studio.js';

const DEG = Math.PI / 180;

/** The logo's C: two arcs with steep diagonal cuts at the terminals. */
function cShape(R, r) {
  const shape = new THREE.Shape();
  const outerStart = 40 * DEG;
  const outerEnd = 320 * DEG;
  const innerStart = 27 * DEG;
  const innerEnd = 333 * DEG;
  shape.moveTo(Math.cos(outerStart) * R, Math.sin(outerStart) * R);
  shape.absarc(0, 0, R, outerStart, outerEnd, false);
  shape.lineTo(Math.cos(innerEnd) * r, Math.sin(innerEnd) * r);
  shape.absarc(0, 0, r, innerEnd, innerStart, true);
  shape.closePath();
  return shape;
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
  const cGeometry = new THREE.ExtrudeGeometry(cShape(1.72, 1.04), {
    depth: 0.6,
    bevelEnabled: true,
    bevelThickness: 0.045,
    bevelSize: 0.045,
    bevelSegments: 5,
    curveSegments: 96,
  });
  cGeometry.center();
  const cMesh = new THREE.Mesh(cGeometry, steel);
  spin.add(cMesh);

  // --- ember ribbons (partial rings, flattened into bands)
  const gold = new THREE.MeshPhysicalMaterial({
    color: 0xf5a83c,
    metalness: 1,
    roughness: 0.2,
    emissive: 0x6b3200,
    emissiveIntensity: 0.9,
    envMapIntensity: 1.4,
  });
  const ribbons = [
    { radius: 2.36, tube: 0.022, arc: 1.5 * Math.PI, tilt: [74 * DEG, 0, 16 * DEG], width: 3.4, speed: 0.34 },
    { radius: 2.66, tube: 0.014, arc: 1.15 * Math.PI, tilt: [68 * DEG, 0.25, 24 * DEG], width: 3, speed: -0.22 },
  ].map((cfg) => {
    const holder = new THREE.Group();
    holder.rotation.set(...cfg.tilt);
    const mesh = new THREE.Mesh(new THREE.TorusGeometry(cfg.radius, cfg.tube, 10, 220, cfg.arc), gold);
    mesh.scale.z = cfg.width;
    holder.add(mesh);
    spin.add(holder);
    return { mesh, speed: cfg.speed };
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
  const key = new THREE.DirectionalLight(0xffffff, 2.2);
  key.position.set(3, 5, 6);
  scene.add(key);

  const state = { intro: 0, scroll: 0 };
  const pointer = { x: 0, y: 0, tx: 0, ty: 0 };
  let active = true;
  let portrait = false;

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
      rig.position.set(halfW * 0.2, halfH * 0.46, 0);
      rig.scale.setScalar(Math.min(0.8, halfW / 2.9));
    } else {
      rig.position.set(halfW * 0.54, halfH * 0.14, 0);
      rig.scale.setScalar(Math.min(1.1, halfW / 4.9));
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
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    if (!active) return;
    const t = now / 1000;

    pointer.x = lerp(pointer.x, pointer.tx, 0.06);
    pointer.y = lerp(pointer.y, pointer.ty, 0.06);
    pivot.rotation.y = pointer.x * 0.42;
    pivot.rotation.x = pointer.y * 0.24;

    const intro = state.intro;
    const scroll = state.scroll;
    spin.rotation.y = -0.5 + Math.sin(t * 0.35) * 0.1 + scroll * 1.9 - (1 - intro) * 2.6;
    spin.rotation.x = 0.08 + Math.sin(t * 0.27) * 0.04 + scroll * 0.35;
    spin.position.y = Math.sin(t * 0.6) * 0.07 + scroll * 1.6;
    spin.scale.setScalar(lerp(0.55, 1, intro) * (1 - scroll * 0.18));

    ribbons.forEach((r) => (r.mesh.rotation.z += r.speed * dt * (1 + scroll * 4)));
    ember.intensity = 60 * intro * (0.85 + Math.sin(t * 1.3) * 0.15);

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
    dispose() {
      window.removeEventListener('pointermove', onPointer);
      observer.disconnect();
      renderer.dispose();
    },
  };
}
