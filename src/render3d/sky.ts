/**
 * Outdoor sky — gradient dome, drifting clouds, sun light and horizon fog
 * that hides the chunk-stream edge. Follows the player; fog range tracks
 * the live chunk-distance setting so the slider applies instantly.
 */
import * as THREE from 'three';
import { viewRadiusTiles } from '../engine/viewSettings';

const ZENITH = new THREE.Color(0x3f86d4);
const HORIZON = new THREE.Color(0xbfe0f2);
// subtle dusk tint blended in and out on a slow cycle
const ZENITH_DUSK = new THREE.Color(0x2f5a9e);
const HORIZON_DUSK = new THREE.Color(0xe8c8a8);
const DAY_CYCLE_S = 480;

function cloudTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 64;
  const ctx = c.getContext('2d')!;
  const blob = (x: number, y: number, r: number, a: number) => {
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, `rgba(255,255,255,${a})`);
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 128, 64);
  };
  blob(40, 36, 26, 0.9);
  blob(64, 30, 30, 0.85);
  blob(90, 38, 24, 0.9);
  blob(56, 42, 34, 0.6);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export class Sky {
  group = new THREE.Group();
  private dome: THREE.Mesh;
  private domeMat: THREE.ShaderMaterial;
  private clouds: THREE.InstancedMesh;
  private cloudSeeds: { x: number; z: number; y: number; s: number; v: number }[] = [];
  private sun: THREE.DirectionalLight;
  private ambient: THREE.AmbientLight;
  private hemi: THREE.HemisphereLight;
  private fog: THREE.Fog;
  private t = 0;
  private disposables: { dispose(): void }[] = [];

  constructor(scene: THREE.Scene) {
    this.domeMat = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
      uniforms: {
        zenith: { value: ZENITH.clone() },
        horizon: { value: HORIZON.clone() },
      },
      vertexShader: `
        varying vec3 vPos;
        void main() {
          vPos = position;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }`,
      fragmentShader: `
        uniform vec3 zenith;
        uniform vec3 horizon;
        varying vec3 vPos;
        void main() {
          float k = clamp(normalize(vPos).y, 0.0, 1.0);
          gl_FragColor = vec4(mix(horizon, zenith, pow(k, 0.55)), 1.0);
        }`,
    });
    const domeGeo = new THREE.SphereGeometry(220, 24, 12);
    this.dome = new THREE.Mesh(domeGeo, this.domeMat);
    this.dome.renderOrder = -10;
    this.group.add(this.dome);
    this.disposables.push(domeGeo, this.domeMat);

    const tex = cloudTexture();
    const cloudGeo = new THREE.PlaneGeometry(18, 9);
    const cloudMat = new THREE.MeshBasicMaterial({
      map: tex,
      transparent: true,
      depthWrite: false,
      opacity: 0.85,
      fog: false,
    });
    const N = 34;
    this.clouds = new THREE.InstancedMesh(cloudGeo, cloudMat, N);
    const m = new THREE.Matrix4();
    for (let i = 0; i < N; i++) {
      const seed = {
        x: (Math.random() - 0.5) * 300,
        z: (Math.random() - 0.5) * 300,
        y: 26 + Math.random() * 12,
        s: 0.7 + Math.random() * 1.8,
        v: 0.6 + Math.random() * 0.9,
      };
      this.cloudSeeds.push(seed);
      m.makeRotationX(-Math.PI / 2);
      m.scale(new THREE.Vector3(seed.s, seed.s, seed.s));
      m.setPosition(seed.x, seed.y, seed.z);
      this.clouds.setMatrixAt(i, m);
    }
    this.group.add(this.clouds);
    this.disposables.push(cloudGeo, cloudMat, tex, this.clouds);

    this.ambient = new THREE.AmbientLight(0xffffff, 0.55);
    this.hemi = new THREE.HemisphereLight(0xcfe8ff, 0x6a8f5a, 0.5);
    this.sun = new THREE.DirectionalLight(0xfff4e0, 0.95);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    const span = 30;
    this.sun.shadow.camera.left = -span;
    this.sun.shadow.camera.right = span;
    this.sun.shadow.camera.top = span;
    this.sun.shadow.camera.bottom = -span;
    this.sun.shadow.camera.far = 120;
    this.group.add(this.ambient, this.hemi, this.sun, this.sun.target);

    this.fog = new THREE.Fog(HORIZON.clone(), 30, 60);
    scene.fog = this.fog;
    scene.background = null; // the dome is the sky
  }

  update(dt: number, px: number, pz: number): void {
    this.t += dt;
    // dome + clouds ride along so the horizon never recedes
    this.dome.position.set(px, 0, pz);

    const m = new THREE.Matrix4();
    const rot = new THREE.Matrix4().makeRotationX(-Math.PI / 2);
    this.cloudSeeds.forEach((c, i) => {
      c.x += c.v * dt;
      // wrap drifting clouds inside a band around the player
      let rx = px + ((((c.x - px) % 300) + 450) % 300) - 150;
      let rz = pz + ((((c.z - pz) % 300) + 450) % 300) - 150;
      m.copy(rot);
      m.scale(new THREE.Vector3(c.s, c.s, c.s));
      m.setPosition(rx, c.y, rz);
      this.clouds.setMatrixAt(i, m);
    });
    this.clouds.instanceMatrix.needsUpdate = true;

    // subtle day/dusk breathing
    const k = (Math.sin((this.t * Math.PI * 2) / DAY_CYCLE_S) + 1) / 2;
    const dusk = k * 0.35;
    (this.domeMat.uniforms.zenith.value as THREE.Color).copy(ZENITH).lerp(ZENITH_DUSK, dusk);
    (this.domeMat.uniforms.horizon.value as THREE.Color).copy(HORIZON).lerp(HORIZON_DUSK, dusk);
    this.sun.intensity = 0.95 - dusk * 0.25;
    this.ambient.intensity = 0.55 - dusk * 0.1;

    // sun follows the player so the shadow window stays centered
    this.sun.position.set(px + 14, 26, pz + 8);
    this.sun.target.position.set(px, 0, pz);

    // fog tracks chunk distance: solid wall of haze right at the stream edge
    const R = viewRadiusTiles();
    this.fog.near = R * 0.45;
    this.fog.far = R * 0.95;
    this.fog.color.copy(this.domeMat.uniforms.horizon.value as THREE.Color);
  }

  dispose(scene: THREE.Scene): void {
    scene.fog = null;
    for (const d of this.disposables) d.dispose();
  }
}
