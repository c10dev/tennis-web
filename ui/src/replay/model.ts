// The 3D redesign's vertical slice (ADR-024), opted into with `?rig=gltf` until it replaces today's look: skinned
// players and the game camera. The model is fetched relative to the page, so the toss build's `base: './'` finds it.
// `&cams=tv` keeps the skinned players under today's TV direction, to compare the two looks.
import { loadPlayerModel, type PlayerModel } from '@tennis/renderer';

export interface Slice { model: PlayerModel; style: 'game' | 'broadcast' }

export const sliceRequested = (): boolean => new URLSearchParams(location.search).get('rig') === 'gltf';

export async function sliceFromQuery(): Promise<Slice | null> {
  if (!sliceRequested()) return null;
  const style = new URLSearchParams(location.search).get('cams') === 'tv' ? 'broadcast' : 'game';
  return { model: await loadPlayerModel(`${import.meta.env.BASE_URL}models/player.glb`), style };
}
