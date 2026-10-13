// The ball and the blob shadow beneath it: the shadow is how a viewer reads the ball's height without real shadows.
import { CircleGeometry, Group, Mesh, MeshBasicMaterial, MeshLambertMaterial, SphereGeometry } from 'three';
import type { Vec3 } from '@tennis/engine';
import { BALL, COLOURS } from '../tuning.ts';
import { groundToThree, toThree } from './coords.ts';

export interface BallView {
  readonly object3d: Group;
  apply(ball: Vec3 | null): void;
}

export function createBall(): BallView {
  const ball = new Mesh(new SphereGeometry(BALL.visualRadius, 12, 8), new MeshLambertMaterial({ color: COLOURS.ball }));
  ball.name = 'ball';
  const shadow = new Mesh(new CircleGeometry(BALL.visualRadius * 1.2, 12), new MeshBasicMaterial({ color: COLOURS.shadow, transparent: true, opacity: 0.35 }));
  shadow.rotation.x = -Math.PI / 2;
  shadow.name = 'ball-shadow';
  const object3d = new Group();
  object3d.add(ball, shadow);
  return {
    object3d,
    apply(position) {
      ball.visible = shadow.visible = position !== null;
      if (!position) return;
      // Raised by its radius, so a ball at height 0 rests on the court instead of sinking into it.
      ball.position.copy(toThree(position)).setY(Math.max(0, position.z) + BALL.visualRadius);
      shadow.position.copy(groundToThree(position, 0.005));
    },
  };
}
