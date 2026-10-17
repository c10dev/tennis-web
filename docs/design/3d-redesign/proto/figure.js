// Style-frame prototype: primitive proxies for the character options, posed from key poses with two-bone IK.
// They stand in for a skinned glTF body to judge proportion, silhouette and camera distance, nothing more.
import * as THREE from 'three';
import { inked, PALETTE as P, toon } from './look.js';

/**
 * Proportions in metres. `heads` is total height / head height. Local frame: +z forward, −x the player's right.
 * hip: hip-joint height; torso: hips to shoulders; arm: upper + fore; racket: hand to racket-head centre.
 */
export const STYLES = {
  // C1 "Pop" — 3.5 heads at full adult height: big head, short arms, a long racket and a hop reach the serve.
  pop: { heads: 3.5, headR: 0.25, hip: 0.66, torso: 0.42, torsoW: 0.24, torsoD: 0.18, neck: 0.06, upper: 0.27, fore: 0.25, limbR: 0.075, thigh: 0.34, shin: 0.32, handR: 0.075, foot: [0.11, 0.08, 0.17], racket: 0.66, racketR: 0.17, shoulderW: 0.22, eye: 0.075 },
  // C2 "Sport" — 5.5 heads: longer limbs, a smaller head, closer to Tennis Clash.
  sport: { heads: 5.5, headR: 0.165, hip: 0.92, torso: 0.52, torsoW: 0.2, torsoD: 0.14, neck: 0.08, upper: 0.31, fore: 0.29, limbR: 0.06, thigh: 0.47, shin: 0.45, handR: 0.055, foot: [0.08, 0.06, 0.15], racket: 0.6, racketR: 0.135, shoulderW: 0.2, eye: 0.045 },
};

const v = (x, y, z) => new THREE.Vector3(x, y, z);

/** Two-bone IK: the middle joint for a chain root → end of lengths a, b, bending towards `pole`. */
export function twoBone(root, target, a, b, pole) {
  const d = target.clone().sub(root);
  const L = THREE.MathUtils.clamp(d.length(), Math.abs(a - b) + 1e-3, a + b - 1e-3);
  const dir = d.normalize();
  const x = (a * a + L * L - b * b) / (2 * L);
  const h = Math.sqrt(Math.max(0, a * a - x * x));
  const p = pole.clone().sub(dir.clone().multiplyScalar(pole.dot(dir))).normalize();
  return { mid: root.clone().addScaledVector(dir, x).addScaledVector(p, h), end: root.clone().addScaledVector(dir, L) };
}

/**
 * Key poses for a right-hander, for a body whose shoulders are at height 1 (scaled per style). `turn` rotates the
 * chest about the hips (radians, + to the player's left), `pelvis` the hips, `drop` lowers the hips (share of the hip
 * height), `lean` tips forward, `hop` lifts the whole body (metres). Hands and feet are targets in the root frame.
 */
export const POSES = {
  ready: { pelvis: 0, turn: 0, drop: 0.12, lean: 0.25, handR: [-0.12, 0.6, 0.38], handL: [0.1, 0.62, 0.36], racket: [0.05, 0.75, 0.66], feet: [[0.3, 0.05], [-0.3, 0.05]] },
  unitTurn: { pelvis: -0.5, turn: -1.1, drop: 0.12, lean: 0.15, handR: [-0.5, 0.8, -0.05], handL: [0.15, 0.82, 0.55], racket: [-0.1, 0.95, -0.25], feet: [[0.32, 0.12], [-0.34, -0.12]] },
  backswing: { pelvis: -0.7, turn: -1.35, drop: 0.2, lean: 0.12, handR: [-0.62, 0.5, -0.42], handL: [0.3, 0.78, 0.6], racket: [0.35, -0.2, -0.92], feet: [[0.36, 0.25], [-0.38, -0.1]] },
  contact: { pelvis: -0.1, turn: 0.15, drop: 0.16, lean: 0.12, handR: [-0.5, 0.62, 0.42], handL: [0.4, 0.75, 0.05], racket: [-0.96, 0.08, 0.26], feet: [[0.36, 0.35], [-0.36, -0.12]] },
  follow: { pelvis: 0.5, turn: 1.05, drop: 0.08, lean: 0.1, handR: [0.38, 1.02, 0.12], handL: [0.4, 0.72, -0.1], racket: [0.15, 0.25, -0.95], feet: [[0.34, 0.4], [-0.2, 0.0]], heel: 1 },
  recover: { pelvis: 0.1, turn: 0.1, drop: 0.14, lean: 0.2, handR: [-0.1, 0.6, 0.38], handL: [0.12, 0.62, 0.34], racket: [0.0, 0.8, 0.6], feet: [[0.42, 0.1], [-0.15, 0.05]] },
  trophy: { pelvis: -1.1, turn: -1.25, drop: 0.2, lean: -0.15, handR: [-0.45, 1.05, -0.2], handL: [0.15, 1.75, 0.2], racket: [0.2, 0.6, -0.75], feet: [[0.25, 0.25], [-0.1, -0.15]] },
  serveContact: { pelvis: -0.4, turn: -0.2, drop: -0.05, lean: 0.05, handR: [-0.2, 1.62, 0.25], handL: [0.3, 0.75, 0.25], racket: [-0.05, 0.98, 0.18], feet: [[0.12, 0.15], [-0.05, 0.1]], hop: 1 },
  cheer: { pelvis: 0, turn: 0.2, drop: 0.05, lean: -0.1, handR: [-0.55, 1.5, 0.15], handL: [0.3, 0.85, 0.3], racket: [-0.75, 0.6, 0.1], feet: [[0.28, 0.0], [-0.28, 0.0]] },
  slump: { pelvis: 0, turn: 0, drop: 0.04, lean: 0.45, handR: [-0.22, 0.28, 0.08], handL: [0.22, 0.28, 0.06], racket: [-0.1, -0.95, 0.25], feet: [[0.18, 0.0], [-0.18, 0.0]] },
};

/** Serve hop at contact, metres: the share of the contact height the body cannot reach standing. */
export const SERVE_HOP = { pop: 0.32, sport: 0.12 };

function limb(a, b, r, mat) {
  const len = a.distanceTo(b);
  const m = inked(new THREE.CapsuleGeometry(r, Math.max(0.001, len), 4, 10), mat);
  m.position.copy(a).add(b).multiplyScalar(0.5);
  m.quaternion.setFromUnitVectors(v(0, 1, 0), b.clone().sub(a).normalize());
  return m;
}

function ball(r, mat, at, scale = [1, 1, 1]) {
  const m = inked(new THREE.SphereGeometry(r, 20, 14), mat);
  m.position.copy(at);
  m.scale.set(...scale);
  return m;
}

/**
 * A posed figure as a Group in its local frame (+z forward). `kit`: { shirt, trim, hat: 'cap' | 'band', hair, skin }.
 * Returns the group and the world-ish points a frame needs (racket-head centre, head top).
 */
export function figure(styleName, poseName, kit) {
  const S = STYLES[styleName];
  const pose = POSES[poseName];
  const g = new THREE.Group();
  const shoulderH = S.hip + S.torso;
  const k = shoulderH; // pose targets are given for shoulders at height 1
  const hop = pose.hop ? SERVE_HOP[styleName] : 0;
  const hips = v(0, S.hip * (1 - pose.drop * 0.6) + hop, 0);
  const pelvisQ = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, pose.pelvis, 0));
  const chestQ = new THREE.Quaternion().setFromEuler(new THREE.Euler(pose.lean, pose.turn, 0, 'YXZ'));
  const up = v(0, 1, 0).applyQuaternion(chestQ);
  const neckBase = hips.clone().addScaledVector(up, S.torso);
  const side = (s) => v(s * S.shoulderW, 0, 0).applyQuaternion(chestQ);
  const shoulderR = neckBase.clone().add(side(-1)).addScaledVector(up, -0.04);
  const shoulderL = neckBase.clone().add(side(1)).addScaledVector(up, -0.04);
  const skin = toon(kit.skin);
  const shirt = toon(kit.shirt);

  // Torso: a bean from hips to neck, shorts below.
  const torso = ball(1, shirt, hips.clone().addScaledVector(up, S.torso * 0.55), [S.torsoW * 1.05, S.torso * 0.62, S.torsoD * 1.1]);
  torso.quaternion.copy(chestQ);
  const shorts = ball(1, toon(P.shorts), hips.clone().addScaledVector(up, 0.02), [S.torsoW * 1.0, S.torso * 0.28, S.torsoD * 1.05]);
  shorts.quaternion.copy(pelvisQ);
  g.add(torso, shorts);

  // Head with eyes, cap or band; looks a little towards the racket side on strokes.
  const head = new THREE.Group();
  head.position.copy(neckBase).addScaledVector(up, S.neck + S.headR * 0.9);
  head.quaternion.setFromEuler(new THREE.Euler(pose.lean * 0.3 - (poseName === 'slump' ? 0.5 : 0) - (poseName === 'cheer' ? -0.3 : 0), poseName === 'serveContact' || poseName === 'trophy' ? pose.turn * 0.4 : Math.min(0, pose.turn) * 0.35 + Math.max(0, pose.turn) * 0.2, 0, 'YXZ'));
  head.add(ball(S.headR, skin, v(0, 0, 0)));
  for (const s of [-1, 1]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(S.eye, 12, 10), toon(0x15171e));
    eye.position.set(s * S.headR * 0.36, -S.headR * 0.02, S.headR * 0.9);
    eye.scale.set(0.75, 1.15, 0.4);
    const glint = new THREE.Mesh(new THREE.SphereGeometry(S.eye * 0.32, 8, 6), new THREE.MeshBasicMaterial({ color: 0xffffff }));
    glint.position.set(eye.position.x + S.eye * 0.2, eye.position.y + S.eye * 0.35, eye.position.z + S.eye * 0.2);
    head.add(eye, glint);
  }
  const hair = ball(S.headR * 1.02, toon(kit.hair), v(0, S.headR * 0.12, -S.headR * 0.12), [1, 0.85, 0.95]);
  head.add(hair);
  if (kit.hat === 'cap') {
    const crown = ball(S.headR * 1.04, toon(kit.trim), v(0, S.headR * 0.28, -0.01), [1, 0.62, 1]);
    const brim = inked(new THREE.CylinderGeometry(S.headR * 0.75, S.headR * 0.75, 0.03, 20, 1, false, -Math.PI / 2, Math.PI), toon(kit.trim));
    brim.position.set(0, S.headR * 0.42, S.headR * 0.62);
    brim.rotation.x = 0.12;
    head.add(crown, brim);
  } else {
    const band = inked(new THREE.TorusGeometry(S.headR * 0.98, S.headR * 0.12, 8, 24), toon(kit.trim));
    band.rotation.x = Math.PI / 2 - 0.12;
    band.position.y = S.headR * 0.35;
    head.add(band);
  }
  g.add(head);

  // Arms: IK from each shoulder to its hand target; the elbow bends down and back.
  const handR = v(...pose.handR).multiplyScalar(k);
  const handL = v(...pose.handL).multiplyScalar(k);
  const reachR = twoBone(shoulderR, handR, S.upper, S.fore, v(-0.4, -1, -0.5));
  const reachL = twoBone(shoulderL, handL, S.upper, S.fore, v(0.4, -1, -0.3));
  for (const [sh, r] of [[shoulderR, reachR], [shoulderL, reachL]]) {
    g.add(limb(sh, r.mid, S.limbR * 1.05, shirt === skin ? skin : toon(kit.shirt)), limb(r.mid, r.end, S.limbR * 0.95, skin));
    g.add(ball(S.handR, skin, r.end));
  }
  g.add(ball(S.limbR * 1.25, toon(kit.trim), reachR.mid.clone().lerp(reachR.end, 0.85), [1, 0.7, 1]));

  // Racket: handle along the racket direction, an inked rim and a pale string bed facing across the swing.
  const dir = v(...pose.racket).normalize();
  const grip = reachR.end.clone();
  const centre = grip.clone().addScaledVector(dir, S.racket);
  const throat = grip.clone().addScaledVector(dir, S.racket - S.racketR * 1.25);
  g.add(limb(grip, throat, 0.018, toon(P.racket)));
  const faceN = v(0, 1, 0).cross(dir).normalize();
  if (faceN.lengthSq() < 0.1) faceN.set(0, 0, 1);
  const head3 = new THREE.Group();
  head3.position.copy(centre);
  const basis = new THREE.Matrix4().makeBasis(faceN.clone().cross(dir).normalize(), dir, faceN);
  head3.quaternion.setFromRotationMatrix(basis);
  const rim = inked(new THREE.TorusGeometry(S.racketR, 0.022, 8, 28), toon(kit.racket ?? 0x2b2f38));
  rim.scale.set(0.8, 1.05, 1);
  const bed = new THREE.Mesh(new THREE.CircleGeometry(S.racketR * 0.97, 24), toon(P.strings));
  bed.scale.set(0.8, 1.05, 1);
  bed.material.side = THREE.DoubleSide;
  head3.add(rim, bed);
  g.add(head3);

  // Legs: IK from each hip to its foot on the ground; knees bend forward.
  const heel = pose.heel ? 0.07 : 0;
  pose.feet.forEach(([x, z], i) => {
    const hip = hips.clone().add(v((i === 0 ? 1 : -1) * S.torsoW * 0.5, -0.03, 0).applyQuaternion(pelvisQ));
    const ankle = v(x * k * 0.55, S.foot[1] + (i === 1 ? heel : 0) + hop, z * k * 0.55);
    const leg = twoBone(hip, ankle, S.thigh, S.shin, v(0, 0.2, 1));
    g.add(limb(hip, leg.mid, S.limbR * 1.25, toon(P.shorts)), limb(leg.mid, leg.end, S.limbR * 1.05, skin));
    const sock = ball(S.limbR * 1.12, toon(0xffffff), leg.end.clone().add(v(0, S.foot[1] * 0.6, 0)), [1, 0.6, 1]);
    const shoe = ball(1, toon(P.shoes), leg.end.clone().add(v(0, -S.foot[1] * 0.45, S.foot[2] * 0.35)), [S.foot[0], S.foot[1], S.foot[2]]);
    shoe.rotation.y = i === 0 ? 0.25 : -0.4 * (pose.pelvis < -0.3 ? 2 : 1);
    g.add(sock, shoe);
  });

  // Blob shadow.
  const shadow = new THREE.Mesh(new THREE.CircleGeometry(0.45 * (styleName === 'pop' ? 1.1 : 1), 24), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.25 }));
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.005;
  g.add(shadow);

  return { group: g, racketCentre: centre, headTop: head.position.y + S.headR, racketTop: centre.y + S.racketR, grip };
}
