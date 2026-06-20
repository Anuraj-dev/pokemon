/**
 * Upright billboard sprites — NPCs, wild-creature statues, item balls.
 * Planes that rotate around Y to face the camera; character billboards
 * swap their 4-direction frames by viewing angle, DOOM-style.
 */
import * as THREE from 'three';
import type { Facing } from '../engine/state';
import { spriteTexture, charKey } from './textures';

const FACING_ANGLE: Record<Facing, number> = {
  down: 0,
  right: Math.PI / 2,
  up: Math.PI,
  left: -Math.PI / 2,
};

function wrapAngle(a: number): number {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}

function makeMat(key: string): THREE.MeshBasicMaterial {
  return new THREE.MeshBasicMaterial({
    map: spriteTexture(key),
    transparent: true,
    alphaTest: 0.15,
    side: THREE.DoubleSide,
  });
}

/** A flat sprite that stays upright and turns to face the camera. */
export class Billboard {
  mesh: THREE.Mesh;
  private mat: THREE.MeshBasicMaterial;
  private height: number;

  constructor(key: string, width: number, height: number) {
    this.mat = makeMat(key);
    this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(width, height), this.mat);
    this.height = height;
    this.mesh.castShadow = false;
  }

  setSprite(key: string): void {
    this.mat.map = spriteTexture(key);
    this.mat.needsUpdate = true;
  }

  setPosition(x: number, z: number, yOffset = 0): void {
    this.mesh.position.set(x, this.height / 2 + 0.02 + yOffset, z);
  }

  /** Turn to face the camera (yaw only). */
  update(camPos: THREE.Vector3): void {
    const dx = camPos.x - this.mesh.position.x;
    const dz = camPos.z - this.mesh.position.z;
    this.mesh.rotation.y = Math.atan2(dx, dz);
  }

  dispose(): void {
    this.mesh.geometry.dispose();
    this.mat.dispose();
  }
}

/** A character billboard with facing-relative 4-direction frames. */
export class CharBillboard extends Billboard {
  private charName: string;
  facing: Facing = 'down';
  /** walk animation frame: 0 idle, 1/2 step */
  frame = 0;

  constructor(charName: string, facing: Facing) {
    super(charKey(charName, facing, 0), 0.92, 0.92);
    this.charName = charName;
    this.facing = facing;
  }

  update(camPos: THREE.Vector3): void {
    super.update(camPos);
    // pick the sprite direction the camera actually sees
    const toCam = Math.atan2(camPos.x - this.mesh.position.x, camPos.z - this.mesh.position.z);
    const rel = wrapAngle(FACING_ANGLE[this.facing] - toCam);
    const dir: Facing =
      Math.abs(rel) < Math.PI / 4 ? 'down' : Math.abs(rel) > (3 * Math.PI) / 4 ? 'up' : rel > 0 ? 'left' : 'right';
    this.setSprite(charKey(this.charName, dir, this.frame));
  }
}
