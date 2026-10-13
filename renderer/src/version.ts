/** Event schemas this renderer plays: v2 added ShotEvent.flightSec, v3 starting fatigue and tactic changes. */
export const SUPPORTED_SCHEMA_VERSIONS: readonly number[] = [2, 3];

/** The newest of them, the one the engine writes. */
export const SUPPORTED_SCHEMA_VERSION = 3;
