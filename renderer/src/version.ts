/** Event schemas this renderer plays: v2 added ShotEvent.flightSec, v3 starting fatigue and tactic changes, v4 Fast4
 *  and the cards played on each point (which the renderer does not need to draw). */
export const SUPPORTED_SCHEMA_VERSIONS: readonly number[] = [2, 3, 4];

/** The newest of them, the one the engine writes. */
export const SUPPORTED_SCHEMA_VERSION = 4;
