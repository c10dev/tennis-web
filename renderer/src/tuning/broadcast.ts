// Broadcast direction: camera cuts, replays and viewing modes (GDD §8.1, §8.3, §8.5).

export const BROADCAST = {
  /** Serve Cam starts this long before the toss and hands over to the main camera just after contact. */
  serveCamLeadSec: 0.5,
  serveCamTailSec: 0.15,
  /** Reaction Cam holds on the point winner this long after the last ball lands. */
  reactionSec: 2,
  introSec: 4,
  resultSec: 12,
  /** Highlights: rallies at least this long, and winners that end a rally at least this long. */
  longRally: 10,
  winnerRally: 5,
  /** Replays: the last seconds of the point at this rate, ending a little after the last ball lands. */
  replayRate: 0.5,
  replayLeadSec: 3,
  replayTailSec: 0.6,
  /** Hawk-Eye: bounces this close to a line (metres) get a still close-up of the mark. */
  hawkeyeMarginM: 0.05,
  hawkeyeSec: 2.5,
  /** The game style's impact moment (ADR-024 S3): slow motion this long into and out of the deciding contact, at
   * `rate`, with a hit-stop (a still, `hitstopSec` of screen time) at the contact itself. */
  impact: { leadSec: 0.15, tailSec: 0.35, rate: 0.25, hitstopSec: 0.07 },
} as const;
