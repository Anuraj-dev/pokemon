/**
 * Procedural low-poly humanoids — head, torso, swinging arms and legs,
 * optional cap — rigged in code with idle/walk cycles. The player and every
 * human NPC share this body, each tinted by their charPalette, so the whole
 * cast is true 3D with zero asset files.
 */
import * as THREE from 'three';
import { charPalette, type CharPalette } from '../render/spriteGen';
import type { Facing } from '../engine/state';

const FACING_HEADING: Record<Facing, number> = {
  down: 0,
  right: Math.PI / 2,
  up: Math.PI,
  left: -Math.PI / 2,
};

function box(w: number, h: number, d: number, color: string): THREE.Mesh {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshLambertMaterial({ color }));
  m.castShadow = true;
  return m;
}

export class HumanoidAvatar {
  group: THREE.Group;
  protected body: THREE.Group;
  private leftArm: THREE.Group;
  private rightArm: THREE.Group;
  private leftLeg: THREE.Group;
  private rightLeg: THREE.Group;
  private phase = 0;
  private speed = 0;
  /** heading in radians; 0 faces south (+z) toward the default camera */
  heading = 0;

  constructor(pal: CharPalette) {
    this.group = new THREE.Group();
    this.body = new THREE.Group();
    this.group.add(this.body);

    const torso = box(0.42, 0.4, 0.26, pal.shirt);
    torso.position.y = 0.62;
    const hips = box(0.38, 0.14, 0.24, pal.pants);
    hips.position.y = 0.4;
    const head = box(0.34, 0.3, 0.32, pal.skin);
    head.position.y = 0.99;
    const hair = box(0.36, 0.12, 0.34, pal.hair);
    hair.position.y = 1.15;
    this.body.add(torso, hips, head, hair);
    if (pal.hat) {
      const cap = box(0.38, 0.09, 0.36, pal.hat);
      cap.position.y = 1.21;
      const brim = box(0.3, 0.05, 0.22, pal.hat);
      brim.position.set(0, 1.16, 0.26);
      this.body.add(cap, brim);
    }

    const makeArm = (side: number) => {
      const g = new THREE.Group();
      g.position.set(side * 0.29, 0.8, 0);
      const sleeve = box(0.13, 0.18, 0.15, pal.shirt);
      sleeve.position.y = -0.08;
      const arm = box(0.11, 0.26, 0.13, pal.skin);
      arm.position.y = -0.28;
      g.add(sleeve, arm);
      return g;
    };
    this.leftArm = makeArm(-1);
    this.rightArm = makeArm(1);

    const makeLeg = (side: number) => {
      const g = new THREE.Group();
      g.position.set(side * 0.11, 0.36, 0);
      const leg = box(0.15, 0.3, 0.18, pal.pants);
      leg.position.y = -0.17;
      const shoe = box(0.16, 0.09, 0.24, '#282830');
      shoe.position.set(0, -0.34, 0.02);
      g.add(leg, shoe);
      return g;
    };
    this.leftLeg = makeLeg(-1);
    this.rightLeg = makeLeg(1);
    this.body.add(this.leftArm, this.rightArm, this.leftLeg, this.rightLeg);
  }

  setFacing(f: Facing): void {
    this.heading = FACING_HEADING[f];
  }

  /** speed in tiles/sec; 0 = idle */
  setMoving(speed: number): void {
    this.speed = speed;
  }

  update(dt: number): void {
    this.body.rotation.y = this.heading;
    if (this.speed > 0.05) {
      this.phase += dt * this.speed * 5.2;
      const swing = Math.sin(this.phase) * Math.min(0.8, this.speed * 0.22);
      this.leftLeg.rotation.x = swing;
      this.rightLeg.rotation.x = -swing;
      this.leftArm.rotation.x = -swing * 0.85;
      this.rightArm.rotation.x = swing * 0.85;
      this.body.position.y = Math.abs(Math.sin(this.phase)) * 0.045;
    } else {
      // ease limbs back to rest
      for (const part of [this.leftLeg, this.rightLeg, this.leftArm, this.rightArm]) {
        part.rotation.x *= Math.max(0, 1 - dt * 10);
      }
      this.body.position.y *= Math.max(0, 1 - dt * 10);
      this.phase = 0;
    }
  }

  dispose(): void {
    this.group.traverse((o) => {
      if (o instanceof THREE.Mesh) {
        o.geometry.dispose();
        (o.material as THREE.Material).dispose();
      }
    });
  }
}

export class PlayerAvatar extends HumanoidAvatar {
  private surfMesh: THREE.Mesh;

  constructor() {
    super(charPalette('player'));
    // surf board, shown while crossing water
    this.surfMesh = box(0.7, 0.08, 1.3, '#58a8e8');
    this.surfMesh.position.y = 0.06;
    this.surfMesh.visible = false;
    this.body.add(this.surfMesh);
  }

  setSurfing(on: boolean): void {
    this.surfMesh.visible = on;
  }
}
