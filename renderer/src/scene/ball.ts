// The optic ball, its blob shadow and its trail (ADR-018). Unlit, oversized and kept out of fog and tone mapping so
// it reads at the far baseline; the shadow is how a viewer reads its height without real shadows.
import { CircleGeometry, Group, Mesh, MeshBasicMaterial, SphereGeometry } from 'three';
import type { Vec3 } from '@tennis/engine';
import { BALL_LOOK, COLOURS } from '../tuning/index.ts';
import type { TrailPoint } from './ballMotion.ts';
import { groundToThree, toThree } from './coords.ts';
import { createTrail } from './trail.ts';

export interface BallLook {
  /** Camera scale (close-ups draw it smaller) times the contact pop. */
  scale: number;
  pop: number;
  trail: readonly TrailPoint[];
}

export interface BallView {
  readonly object3d: Group;
  apply(ball: Vec3 | null, look?: BallLook): void;
}

export function createBall(): BallView {
  const material = new MeshBasicMaterial({ color: COLOURS.ball, toneMapped: false, fog: false });
  const ball = new Mesh(new SphereGeometry(BALL_LOOK.radius, 16, 12), material);
  ball.name = 'ball';
  const shadow = new Mesh(
    new CircleGeometry(BALL_LOOK.radius * 1.2, 16),
    new MeshBasicMaterial({ color: COLOURS.shadow, transparent: true, opacity: BALL_LOOK.shadowOpacity, depthWrite: false }),
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.name = 'ball-shadow';
  const trail = createTrail();
  const object3d = new Group();
  object3d.add(ball, shadow, trail.object3d);
  return {
    object3d,
    apply(position, look = { scale: 1, pop: 1, trail: [] }) {
      ball.visible = shadow.visible = position !== null;
      if (!position) {
        trail.apply([], look.scale);
        return;
      }
      // Raised by its radius, so a ball at height 0 rests on the court instead of sinking into it.
      ball.scale.setScalar(look.scale * look.pop);
      ball.position.copy(toThree(position)).setY(Math.max(0, position.z) + BALL_LOOK.radius * look.scale);
      shadow.scale.setScalar(look.scale);
      shadow.position.copy(groundToThree(position, 0.005));
      trail.apply(look.trail, look.scale);
    },
  };
}
