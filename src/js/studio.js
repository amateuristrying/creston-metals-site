import * as THREE from 'three';

/**
 * A tiny procedural photo studio, baked to an environment map.
 * No HDRI download: a dark room with a few emissive softboxes — one cool key,
 * one warm ember strip — which is what gives the metal its brushed highlights.
 */
export function makeStudioEnv(renderer) {
  const scene = new THREE.Scene();
  const box = new THREE.BoxGeometry(1, 1, 1);

  const room = new THREE.Mesh(box, new THREE.MeshBasicMaterial({ color: 0x030304, side: THREE.BackSide }));
  room.scale.setScalar(60);
  scene.add(room);

  const light = (hex, intensity, position, scale) => {
    const material = new THREE.MeshBasicMaterial({ color: new THREE.Color(hex).multiplyScalar(intensity) });
    const mesh = new THREE.Mesh(box, material);
    mesh.position.set(...position);
    mesh.scale.set(...scale);
    scene.add(mesh);
  };

  light(0xffffff, 9, [0, 18, 4], [30, 0.2, 14]); // overhead softbox
  light(0xdde6ff, 6, [-20, 4, 8], [0.2, 16, 10]); // cool strip, left
  light(0xffa94a, 11, [18, 1, -10], [0.2, 8, 10]); // ember strip, back right
  light(0xffc27a, 5, [-10, -3, -18], [10, 3, 0.2]); // low warm kicker
  light(0xffffff, 3.2, [4, 2, 22], [22, 10, 0.2]); // broad front fill

  const pmrem = new THREE.PMREMGenerator(renderer);
  const texture = pmrem.fromScene(scene, 0.035).texture;
  pmrem.dispose();
  box.dispose();
  return texture;
}

/** Fine horizontal streaks — used as roughness + bump for a brushed finish. */
export function brushedTexture(size = 512) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#8a8a8a';
  ctx.fillRect(0, 0, size, size);

  for (let i = 0; i < 3200; i++) {
    const y = Math.random() * size;
    const x = Math.random() * size - size * 0.2;
    const length = 30 + Math.random() * size * 0.9;
    const v = (70 + Math.random() * 130) | 0;
    ctx.strokeStyle = `rgba(${v},${v},${v},${0.06 + Math.random() * 0.2})`;
    ctx.lineWidth = 0.3 + Math.random() * 1.1;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + length, y);
    ctx.stroke();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.anisotropy = 8;
  return texture;
}

/** Soft round sprite for sparks and ground glow. */
export function glowTexture(size = 128, inner = 'rgba(255,255,255,1)', outer = 'rgba(255,255,255,0)') {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  gradient.addColorStop(0, inner);
  gradient.addColorStop(0.35, inner.replace(/[\d.]+\)$/, '0.35)'));
  gradient.addColorStop(1, outer);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

export const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const smoothstep = (a, b, v) => {
  const t = clamp01((v - a) / (b - a));
  return t * t * (3 - 2 * t);
};
export const easeInOutCubic = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
export const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);

/** Deterministic PRNG so the building assembles identically every visit. */
export function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
