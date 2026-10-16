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
  /** Locomotion and reactions; strokes are effector keys, not clips (ADR-024). */
  clips: ['Idle', 'Running_A', 'Running_Strafe_Left', 'Running_Strafe_Right', 'Walking_A', 'Walking_Backwards', 'Cheer', 'Hit_A'],
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
  /** Extra crouch for a low ball, metres. */
  dropMax: 0.15,
  /** Ring on the ground under *my* player (Mini Tennis's device), in the accent colour. */
  ring: { radius: 0.55, width: 0.07, colour: 0xd6f53a },
} as const;
