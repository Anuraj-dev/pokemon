/**
 * NPC visuals — one interface over the two representations: human NPCs are
 * procedural 3D humanoids (palette per character archetype), while item
 * balls and overworld creatures stay camera-facing sprite billboards.
 */
import * as THREE from 'three';
import type { Facing } from '../engine/state';
import { HumanoidAvatar } from './avatar';
import { Billboard } from './billboard';
import { charPalette } from '../render/spriteGen';

export interface NpcVisual {
  obj: THREE.Object3D;
  setPosition(x: number, z: number): void;
  setFacing(f: Facing): void;
  setMoving(speed: number): void;
  setVisible(v: boolean): void;
  update(dt: number, camPos: THREE.Vector3): void;
  dispose(): void;
}

export class HumanNpc implements NpcVisual {
  private avatar: HumanoidAvatar;
  obj: THREE.Object3D;

  constructor(sprite: string, facing: Facing) {
    this.avatar = new HumanoidAvatar(charPalette(sprite));
    this.avatar.setFacing(facing);
    this.obj = this.avatar.group;
  }

  setPosition(x: number, z: number): void {
    this.obj.position.set(x, 0, z);
  }

  setFacing(f: Facing): void {
    this.avatar.setFacing(f);
  }

  setMoving(speed: number): void {
    this.avatar.setMoving(speed);
  }

  setVisible(v: boolean): void {
    this.obj.visible = v;
  }

  update(dt: number): void {
    this.avatar.update(dt);
  }

  dispose(): void {
    this.avatar.dispose();
  }
}

export class BillboardNpc implements NpcVisual {
  private bb: Billboard;
  obj: THREE.Object3D;

  constructor(spriteKey: string, size: number) {
    this.bb = new Billboard(spriteKey, size, size);
    this.obj = this.bb.mesh;
  }

  setPosition(x: number, z: number): void {
    this.bb.setPosition(x, z);
  }

  setFacing(): void {
    /* sprites always face the camera */
  }

  setMoving(): void {
    /* no walk cycle */
  }

  setVisible(v: boolean): void {
    this.obj.visible = v;
  }

  update(_dt: number, camPos: THREE.Vector3): void {
    this.bb.update(camPos);
  }

  dispose(): void {
    this.bb.dispose();
  }
}
