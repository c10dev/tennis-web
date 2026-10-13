// Stands, ad boards and the umpire chair: something for the Side and Reaction cameras to frame (ADR-009).
// Stands are stepped blocks, one per tier, built from the same profile `standHeightAt` describes.
import { BoxGeometry, Group, Mesh } from 'three';
import type { Surface } from '@tennis/engine';
import { COURT_DRAW, VENUE } from '../tuning/index.ts';
import { lit } from './materials.ts';

/** Height of the stands at court position (x, y), 0 where there are none. */
export function standHeightAt(x: number, y: number): number {
  const ax = Math.abs(x);
  const ay = Math.abs(y);
  let into = -1;
  if (ax >= VENUE.sideStandX && ay <= VENUE.sideStandHalfLength) into = ax - VENUE.sideStandX;
  else if (ay >= VENUE.endStandY && ax < VENUE.sideStandX) into = ay - VENUE.endStandY;
  if (into < 0) return 0;
  const tier = Math.floor(into / VENUE.tierDepth);
  return tier < VENUE.tiers ? (tier + 1) * VENUE.tierRise : 0;
}

function stand(name: string, axis: 'x' | 'z', sign: 1 | -1, inner: number, length: number, colour: number): Group {
  const group = new Group();
  group.name = name;
  const material = lit(colour);
  for (let k = 0; k < VENUE.tiers; k++) {
    const h = (k + 1) * VENUE.tierRise;
    const across = sign * (inner + VENUE.tierDepth * (k + 0.5));
    const tier = axis === 'x'
      ? new Mesh(new BoxGeometry(VENUE.tierDepth, h, length), material)
      : new Mesh(new BoxGeometry(length, h, VENUE.tierDepth), material);
    tier.position.set(axis === 'x' ? across : 0, h / 2, axis === 'z' ? across : 0);
    group.add(tier);
  }
  return group;
}

function board(name: string, width: number, depth: number, x: number, z: number, colour: number): Mesh {
  const mesh = new Mesh(new BoxGeometry(width, VENUE.boardHeight, depth), lit(colour));
  mesh.position.set(x, VENUE.boardHeight / 2, z);
  mesh.name = name;
  return mesh;
}

function umpireChair(): Group {
  const chair = new Group();
  chair.name = 'umpire-chair';
  const material = lit(VENUE.chair);
  const legs = new Mesh(new BoxGeometry(0.6, VENUE.umpireChairHeight - 0.4, 0.6), material);
  legs.position.y = (VENUE.umpireChairHeight - 0.4) / 2;
  const seat = new Mesh(new BoxGeometry(0.8, 0.4, 0.8), material);
  seat.position.y = VENUE.umpireChairHeight - 0.2;
  const back = new Mesh(new BoxGeometry(0.1, 0.8, 0.8), material);
  back.position.set(-0.35, VENUE.umpireChairHeight + 0.2, 0);
  chair.add(legs, seat, back);
  chair.position.x = VENUE.umpireChairX;
  return chair;
}

export function buildVenue(surface: Surface): Group {
  const venue = new Group();
  venue.name = 'venue';
  const seats = VENUE.seats[surface];
  const sideLength = 2 * VENUE.sideStandHalfLength;
  const endLength = 2 * VENUE.sideStandX;
  venue.add(
    stand('stand-east', 'x', 1, VENUE.sideStandX, sideLength, seats),
    stand('stand-west', 'x', -1, VENUE.sideStandX, sideLength, seats),
    stand('stand-north', 'z', -1, VENUE.endStandY, endLength, seats),
    stand('stand-south', 'z', 1, VENUE.endStandY, endLength, seats),
  );
  const W = COURT_DRAW.surroundHalfWidth;
  const L = COURT_DRAW.surroundHalfLength;
  const colour = VENUE.boards[surface];
  venue.add(
    board('ad-board-east', 0.1, 2 * L, W, 0, colour),
    board('ad-board-west', 0.1, 2 * L, -W, 0, colour),
    board('ad-board-north', 2 * W, 0.1, 0, -L, colour),
    board('ad-board-south', 2 * W, 0.1, 0, L, colour),
    umpireChair(),
  );
  return venue;
}
