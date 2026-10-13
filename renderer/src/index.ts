// Public API of the renderer: turns a MatchResult into frames and draws them with Three.js (GDD §8).
// It reads engine data through @tennis/engine's index only and never imports ui/.
export { SUPPORTED_SCHEMA_VERSION } from './version.ts';
export { broadcastFrameAt, type BroadcastFrame } from './broadcast/frame.ts';
export { lineCall, type LineCall } from './broadcast/hawkeye.ts';
export { selectPoints } from './broadcast/modes.ts';
export { isCloseCall, replayInserts, wantsReplay } from './broadcast/replay.ts';
export { buildProgramme, clipAt, programmeTimeFor } from './broadcast/programme.ts';
export type { CameraId, Clip, ClipKind, Programme, ViewMode } from './broadcast/types.ts';
export { cameraPose } from './camera/cameras.ts';
export { dampPan, mainCamPose, panTarget, type CamPose } from './camera/mainCam.ts';
export { scoreBugModel, type ScoreBugModel, type ScoreBugRow } from './overlay/scoreBug.ts';
export { createScoreBug, type ScoreBugView } from './overlay/scoreBugDom.ts';
export { clockReducer, createClock, type ClockAction, type ClockState, type Seekable } from './playback/clock.ts';
export { matchFrameAt, type Frame } from './playback/frame.ts';
export { playerPose, type PlayerPose, type Reaction, type SwingKind } from './playback/pose.ts';
export { buildTimeline, scoreAt, segmentAt, type GapKind, type PointSegment, type Timeline } from './playback/timeline.ts';
export { CapsuleRig, type PlayerRig } from './scene/rig.ts';
export { createStage, type Stage, type StageFrame } from './scene/stage.ts';
export { buildVenue, standHeightAt } from './scene/venue.ts';
export { BROADCAST, PLAYBACK } from './tuning/index.ts';
export { createViewer, type Viewer } from './viewer.ts';
