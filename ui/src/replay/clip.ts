// The clock of a quick-match clip (Broadcast.playWindow): match seconds advance with real time × speed. The first frame
// of a window draws its start, so a slow first frame (shader compile, scene build) cannot skip the clip's opening (TD-037).

/** The most real time one frame may count; a longer stall (hidden tab, compile) only freezes the picture. */
export const MAX_FRAME_SEC = 0.25;

/** The clip clock after a frame that took `dt` real seconds; `first` is the window's first frame. */
export const clipStep = (t: number, end: number, dt: number, speed: number, first: boolean): number =>
  first ? t : Math.min(end, t + Math.min(dt, MAX_FRAME_SEC) * speed);
