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
} as const;
