// On-screen graphics timing (GDD §8.2).

export const OVERLAY = {
  /** Serve speed stays up this long after contact. */
  serveSpeedSec: 2,
  /** The rally counter appears from this many shots. */
  rallyFrom: 3,
  /** Break/set/match point and tiebreak captions run from the toss until this long after the first serve. */
  lowerThirdAfterSec: 1.5,
  styleLabels: {
    big_server: 'Big server',
    baseliner: 'Baseliner',
    counter_puncher: 'Counter-puncher',
    serve_and_volley: 'Serve & volley',
    all_court: 'All-court',
  },
} as const;
