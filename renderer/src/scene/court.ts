// The court as flat low-poly meshes: surround, playing surface, ITF lines, net and posts (GDD §10 M2).
import {
  BufferGeometry, CylinderGeometry, DoubleSide, Group, Line, LineBasicMaterial, Mesh, MeshBasicMaterial, MeshLambertMaterial,
  PlaneGeometry, Vector3,
} from 'three';
import { COURT, type Surface } from '@tennis/engine';
import { COLOURS, COURT_DRAW, NET } from '../tuning/index.ts';

const { halfLength: L, halfWidth: W, serviceLine: S } = COURT;
const D = COURT_DRAW.doublesHalfWidth;

/** A flat rectangle on the ground, centred at (x, z) in Three coordinates. */
function patch(name: string, width: number, depth: number, x: number, z: number, y: number, colour: number): Mesh {
  const geometry = new PlaneGeometry(width, depth);
  geometry.rotateX(-Math.PI / 2);
  const mesh = new Mesh(geometry, new MeshLambertMaterial({ color: colour }));
  mesh.position.set(x, y, z);
  mesh.name = name;
  return mesh;
}

const line = (name: string, width: number, depth: number, x: number, z: number) =>
  patch(`line-${name}`, width, depth, x, z, 0.003, COLOURS.lines);

function lines(): Mesh[] {
  const lw = COURT_DRAW.lineWidth;
  const bw = COURT_DRAW.baselineWidth;
  const mark = COURT_DRAW.centreMarkLength;
  return [
    line('baseline-near', 2 * D + lw, bw, 0, L),
    line('baseline-far', 2 * D + lw, bw, 0, -L),
    line('singles-left', lw, 2 * L, -W, 0),
    line('singles-right', lw, 2 * L, W, 0),
    line('doubles-left', lw, 2 * L, -D, 0),
    line('doubles-right', lw, 2 * L, D, 0),
    line('service-near', 2 * W, lw, 0, S),
    line('service-far', 2 * W, lw, 0, -S),
    line('centre-service', lw, 2 * S, 0, 0),
    line('centre-mark-near', lw, mark, 0, L - mark / 2),
    line('centre-mark-far', lw, mark, 0, -L + mark / 2),
  ];
}

function net(): Group {
  const half = D + COURT_DRAW.postOutside;
  const geometry = new PlaneGeometry(2 * half, NET.postHeight, 2, 1);
  // Top row (left, centre, right) sags to the centre strap height; the bottom row sits on the ground.
  const pos = geometry.getAttribute('position');
  [NET.postHeight, NET.centerHeight, NET.postHeight].forEach((h, i) => pos.setY(i, h));
  for (let i = 3; i < 6; i++) pos.setY(i, 0);
  geometry.computeVertexNormals();
  const mesh = new Mesh(geometry, new MeshBasicMaterial({ color: COLOURS.net, transparent: true, opacity: 0.7, side: DoubleSide }));
  mesh.name = 'net';
  const tape = new Line(
    new BufferGeometry().setFromPoints([new Vector3(-half, NET.postHeight, 0), new Vector3(0, NET.centerHeight, 0), new Vector3(half, NET.postHeight, 0)]),
    new LineBasicMaterial({ color: COLOURS.lines }),
  );
  tape.name = 'net-tape';
  const group = new Group();
  group.add(mesh, tape);
  for (const [side, x] of [['left', -half], ['right', half]] as const) {
    const post = new Mesh(new CylinderGeometry(0.04, 0.04, NET.postHeight, 8), new MeshLambertMaterial({ color: COLOURS.post }));
    post.position.set(x, NET.postHeight / 2, 0);
    post.name = `net-post-${side}`;
    group.add(post);
  }
  return group;
}

export function buildCourt(surface: Surface): Group {
  const colours = COLOURS.surface[surface];
  const group = new Group();
  group.name = 'court';
  group.add(patch('ground', 160, 160, 0, 0, -0.01, COLOURS.ground));
  group.add(patch('surround', 2 * COURT_DRAW.surroundHalfWidth, 2 * COURT_DRAW.surroundHalfLength, 0, 0, 0, colours.surround));
  group.add(patch('court-surface', 2 * D, 2 * L, 0, 0, 0.001, colours.court));
  if ('stripe' in colours) {
    const n = COURT_DRAW.grassStripes;
    const depth = (2 * COURT_DRAW.surroundHalfLength) / n;
    for (let i = 0; i < n; i += 2) {
      const z = -COURT_DRAW.surroundHalfLength + depth * (i + 0.5);
      group.add(patch(`grass-stripe-${i}`, 2 * COURT_DRAW.surroundHalfWidth, depth, 0, z, 0.002, colours.stripe));
    }
  }
  group.add(...lines(), net());
  return group;
}
