// The skinned player model (ADR-024 vertical slice), opted into with `?rig=gltf` until the slice replaces the
// mannequin. Fetched relative to the page so the toss build's `base: './'` finds it too.
import { loadPlayerModel, type PlayerModel } from '@tennis/renderer';

export async function playerModelFromQuery(): Promise<PlayerModel | null> {
  if (new URLSearchParams(location.search).get('rig') !== 'gltf') return null;
  return loadPlayerModel(`${import.meta.env.BASE_URL}models/player.glb`);
}
