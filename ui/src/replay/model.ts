// The 3D redesign (ADR-024): skinned players, the game camera and the game pace, the default since 2026-10-16;
// `?rig=mannequin` brings back the M7 look (the mannequin, the TV director and pace). The model is fetched relative to
// the page, so the toss build's `base: './'` finds it. `?cams=tv` keeps the skinned players under the TV direction.
import { loadPlayerModel, type PlayerModel } from '@tennis/renderer';

export interface Slice { model: PlayerModel; style: 'game' | 'broadcast' }

export const sliceRequested = (): boolean => new URLSearchParams(location.search).get('rig') !== 'mannequin';

export async function sliceFromQuery(): Promise<Slice | null> {
  if (!sliceRequested()) return null;
  const style = new URLSearchParams(location.search).get('cams') === 'tv' ? 'broadcast' : 'game';
  return { model: await loadPlayerModel(`${import.meta.env.BASE_URL}models/player.glb`), style };
}
