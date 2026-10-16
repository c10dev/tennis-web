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
  /** Grip to racket-head centre, head radius and its width share, metres. */
  racket: { length: 0.68, headRadius: 0.16, headAspect: 0.8 },
  /** The arm may lengthen by this share near contact (child bones slide out along it: no shear), squash-and-stretch. */
  stretchMax: 0.15,
  /** Racket-head centre at full stretch straight up, standing: shoulders 1.09 m + arm 0.576 m × 1.15 + racket 0.68 m.
   * A serve struck higher is reached by a hop (STROKE.serve). */
  standingReach: 2.43,
  /** Contact the body cannot reach by leaning is met by shifting the whole body up to this far (feet slide: TD-058). */
  lungeMax: 0.9,
  /** Metres travelled per cycle of each locomotion clip (measured from the clips by a test): the clip's phase is
   * distance / stride, so feet in stance stay put (ADR-024). */
  strides: { Running_A: 1.91, Walking_A: 0.58, Walking_Backwards: 0.54 },
  /** Speeds (m/s) where walking starts and where the run has fully taken over (a narrow band: walk and run cycles
   * blended at their own phases slide the feet); backpedalling only below `backMax`. */
  gait: { moveFrom: 0.15, moveFull: 0.6, runFrom: 1.4, runFull: 2, backMax: 2.5 },
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
