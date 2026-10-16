// The sound setting and when to pause (ADR-022, M7 step 6). Pure; session.ts applies it.

/** Where the on/off setting is kept (platform settings). */
export const SOUND_KEY = 'tennis-sound';

/** On unless the player turned it off. */
export const parseSound = (value: string | null): boolean => value !== 'off';

/** Hidden pages always go quiet (checklist: sound stops at once in the background); a return resumes only if on. */
export function audioAction(hidden: boolean, on: boolean): 'suspend' | 'resume' | 'none' {
  if (hidden) return 'suspend';
  return on ? 'resume' : 'none';
}
