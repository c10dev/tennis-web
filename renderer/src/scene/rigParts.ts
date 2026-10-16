// Mesh parts of the mannequin rig (rig.ts), Rally Pop phase 3 (ADR-028): rounded limbs, mitten hands, chunky shoes and
// a cap. The arms themselves are motion track A's two-bone arm (arm.ts, ADR-023). Every size comes from RIG; the parts
// are named so outlines and tests can find them.
import { CapsuleGeometry, CylinderGeometry, Mesh, SphereGeometry } from 'three';
import { COLOURS, RIG } from '../tuning/index.ts';
import { lit } from './materials.ts';

const capsule = (radius: number, length: number) => new CapsuleGeometry(radius, Math.max(0, length - 2 * radius), RIG.segments.cap, RIG.segments.radial);

/** A capsule `length` long hanging down from its group's origin. */
export function limb(name: string, radius: number, length: number, colour: number): Mesh {
  const mesh = new Mesh(capsule(radius, length), lit(colour));
  mesh.position.y = -length / 2;
  mesh.name = name;
  return mesh;
}

/** A mitten hand at `x` along its arm's axis (the racket arm's wrist, the tossing arm's end). */
export function hand(name: string, x: number): Mesh {
  const mesh = new Mesh(new SphereGeometry(RIG.hand.radius, 10, 8), lit(COLOURS.skin));
  mesh.position.x = x;
  mesh.name = name;
  return mesh;
}

/** A rounded shoe under the shin's end (the ankle): sole on the ground when standing, toe reaching forward (+z). */
export function shoe(name: string): Mesh {
  const { length, width, height } = RIG.shoe;
  const mesh = new Mesh(capsule(height / 2, length), lit(COLOURS.shoes));
  mesh.rotation.x = Math.PI / 2;
  mesh.scale.set(width / height, 1, 1);
  mesh.position.set(0, -RIG.legSegment + height / 2, length * 0.22);
  mesh.name = name;
  return mesh;
}

/** Head, cap crown in the kit colour and the visor (it shows which way the player faces), at head height `y`. */
export function headParts(y: number, kit: number): Mesh[] {
  const r = RIG.headRadius;
  const [w, h] = RIG.segments.sphere;
  const head = new Mesh(new SphereGeometry(r, w, h), lit(COLOURS.skin));
  head.position.y = y;
  head.name = 'head';
  const cap = new Mesh(new SphereGeometry(r * 1.03, w, h / 2, 0, Math.PI * 2, 0, Math.PI / 2), lit(kit));
  // A slightly flattened crown starting just above the head's middle, so the figure stays under 2 m.
  cap.position.y = y + r * 0.15;
  cap.scale.y = 0.85;
  cap.name = 'cap';
  const brim = r * 0.75;
  const visor = new Mesh(new CylinderGeometry(brim, brim, 0.025, 10, 1, false, -Math.PI / 2, Math.PI), lit(COLOURS.visor));
  visor.position.set(0, y + r * 0.18, r * 0.82);
  visor.name = 'visor';
  return [head, cap, visor];
}
