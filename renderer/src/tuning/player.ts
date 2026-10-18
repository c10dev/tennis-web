// The skinned player (ADR-024): which parts of the source model ship, and how the rig scales and dresses it.

/** What `renderer/cli/prune-player.ts` keeps of KayKit's Rogue (CC0) and what the rig expects to find. */
export const PLAYER_MODEL = {
  /** Body parts; the cape and the weapons are dropped. */
  bodyMeshes: ['Rogue_ArmLeft', 'Rogue_ArmRight', 'Rogue_Body', 'Rogue_Head', 'Rogue_LegLeft', 'Rogue_LegRight'],
  /** Bones a clip may turn; the IK and control helpers of the source rig are never animated here. */
  deformBones: [
    'hips', 'spine', 'chest', 'head',
    'upperarm.l', 'lowerarm.l', 'wrist.l', 'hand.l', 'upperarm.r', 'lowerarm.r', 'wrist.r', 'hand.r',
    'upperleg.l', 'lowerleg.l', 'foot.l', 'toes.l', 'upperleg.r', 'lowerleg.r', 'foot.r', 'toes.r',
  ],
  /** Locomotion and reactions; strokes are effector keys, not clips (ADR-024). KayKit's strafes run forward with a
   * twist (their feet hardly move sideways), so sideways moves turn the legs instead (PLAYER_RIG.legTurnMax). */
  clips: ['Idle', 'Running_A', 'Walking_A', 'Walking_Backwards', 'Cheer', 'Hit_A'],
  /** Ceiling on the committed glb (bytes, uncompressed). */
  maxBytes: 400_000,
} as const;

/** How the rig wears the model: Pop proportions (docs/3d-redesign.md §4.2) and the racket on `handslot.r`. */
export const PLAYER_RIG = {
  /** Standing height in metres; the body keeps the source's size and only the head shrinks to it. */
  height: 1.75,
  /** Uniform scale on the head bone (a leaf: nothing below it can shear): about three heads tall. */
  headScale: 0.57,
  /** Grip to racket-head centre, head radius and its width share, handle radius, the frame's tube, metres: the head
   *  and handle oversized for the TV view (ADR-031 B1: 0.16 and 0.032 before). */
  /** `handleRadius`: thick enough to read at chase distance (TD-063; 0.02 m vanished there). */
  racket: { length: 0.68, headRadius: 0.2, headAspect: 0.8, handleRadius: 0.045, frameTube: 0.02 },
  /** Both arms are this much longer than the source's (ADR-031 B2: the swing's silhouette at TV size). */
  armScale: 1.2,
  /** The arm may lengthen by this share near contact (child bones slide out along it: no shear), squash-and-stretch. */
  stretchMax: 0.15,
  /** How far (as the forward share of the racket's horizontal side) from the plane through the player's front the strings
   *  start turning through it instead of picking a side (strokeSolver `racketFace`, TD-079). */
  faceBlend: 0.25,
  /** Racket-head centre at full stretch straight up, standing: shoulders 1.09 m + arm 0.691 m (0.576 m × armScale)
   * × 1.15 + racket 0.68 m. A serve struck higher is reached by a hop (STROKE.serve). */
  standingReach: 2.56,
  /** Contact the body cannot reach by leaning is met by shifting the whole body up to this far. */
  lungeMax: 0.9,
  /** The racket shoulder at rest in the player's frame (x left, y up, z forward; a test measures it on the rig), and
   *  how far from it the racket head reaches a ball: the arm at full stretch (0.691 m × 1.15) plus the racket. A ball
   *  further away is a lunge of the difference (TD-058). */
  shoulderR: [-0.211, 1.093, 0.018] as const,
  contactReach: 1.475,
  /** The lunge's step (TD-058): the lead foot lifts `liftPerMetre` × the shift (at most `liftMax`) halfway through; a
   *  leg still out of reach lifts up to `dragLift`, fully once `dragLiftOver` short, instead of dragging. A foot
   *  stepping onto or off a plant lifts `plantLiftPerMetre` × the way (A5), never above `liftClearance` of the leg
   *  below the hip. Knees bend the clip's way, leaning `legPoleBias` towards the front where the clip leg is straight. */
  /** The foot joint's height standing on the ground (a test measures it on the rig). */
  footHeight: 0.145,
  step: { liftMax: 0.14, liftPerMetre: 0.5, plantLiftPerMetre: 1.5, liftClearance: 0.35, legPoleBias: 0.1, dragLift: 0.08, dragLiftOver: 0.03 },
  /** Metres travelled per cycle of each locomotion clip (measured from the clips by a test): the clip's phase is
   * distance / stride, so feet in stance stay put (ADR-024). */
  strides: { Running_A: 1.91, Walking_A: 0.58, Walking_Backwards: 0.54 },
  /** Speeds (m/s) where walking starts and where the run has fully taken over; backpedalling only below `backMax`.
   * Walk and run cycles blend at their own phases, so a narrow band slides the feet and a quick change of weight jumps
   * the knees (A6 widened it from 1.4–2 to 1.2–2.4). */
  gait: { moveFrom: 0.15, moveFull: 0.6, runFrom: 1.2, runFull: 2.4, backMax: 2.5 },
  /** Moving sideways or back-diagonally, the hips and legs turn towards the move by up to this (radians) while the
   * chest keeps facing; further round than `backFrom` the player backpedals instead. */
  legTurnMax: 1.75,
  backFrom: 2.0,
  /** Extra crouch for a low ball, metres. */
  dropMax: 0.15,
  /** Ring on the ground under *my* player (Mini Tennis's device), in the accent colour. */
  ring: { radius: 0.55, width: 0.07, colour: 0xd6f53a },
} as const;

/** Kits on the skinned players (TD-062): the KayKit palette is an 8×4 grid of gradient swatches; the Rogue's tunic
 *  and its hood and scarf use these cells (column, row from the top), recoloured per player keeping their shading,
 *  never darker than `shadeFloor` of the kit colour. `skinCells` are never recoloured. */
export const PLAYER_KIT = {
  grid: { cols: 8, rows: 4 },
  cells: { shirt: [[0, 1]] as const, trim: [[1, 1]] as const },
  skinCells: [[0, 0]] as const,
  shadeFloor: 0.6,
  /** The trim is the shirt colour this far towards the shorts colour. */
  trimToShorts: 0.5,
} as const;
