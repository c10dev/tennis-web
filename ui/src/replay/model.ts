// The 3D redesign (ADR-024): skinned players and the game pace, the default since 2026-10-16; `?rig=mannequin` brings
// back the M7 look (the mannequin, the TV director and pace). The model is fetched relative to the page, so the toss
// build's `base: './'` finds it. The camera is the fixed TV view by default (the user's call, 2026-10-17: one main
// camera, no cuts); `?cams=game` is ADR-024's chase camera and `?cams=broadcast` the M3 TV director with its cuts.
import { loadPlayerModel, type PlayerModel } from '@tennis/renderer';

export interface Slice { model: PlayerModel; style: 'game' | 'broadcast' | 'tv' }

export const sliceRequested = (): boolean => new URLSearchParams(location.search).get('rig') !== 'mannequin';

export async function sliceFromQuery(): Promise<Slice | null> {
  if (!sliceRequested()) return null;
  const cams = new URLSearchParams(location.search).get('cams');
  const style = cams === 'game' ? 'game' : cams === 'broadcast' ? 'broadcast' : 'tv';
  return { model: await loadPlayerModel(`${import.meta.env.BASE_URL}models/player.glb`), style };
}
