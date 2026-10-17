// Cuts KayKit's Rogue (CC0) down to the player model the rig uses (ADR-024): the body meshes, every joint, the
// palette texture and a few locomotion and reaction clips that only turn deform bones.
//   curl -LO https://raw.githubusercontent.com/KayKit-Game-Assets/KayKit-Character-Pack-Adventures-1.0/main/addons/kaykit_character_pack_adventures/Characters/gltf/Rogue.glb
//   npx tsx renderer/cli/prune-player.ts Rogue.glb
import { readFileSync, writeFileSync } from 'node:fs';
import { pruneGlb, readGlb, writeGlb } from '../src/asset/glb.ts';
import { PLAYER_MODEL } from '../src/tuning/player.ts';

const [source, target = 'ui/public/models/player.glb'] = process.argv.slice(2);
if (!source) {
  console.error('Usage: npx tsx renderer/cli/prune-player.ts <Rogue.glb> [out.glb]');
  process.exit(2);
}
const deform: readonly string[] = PLAYER_MODEL.deformBones;
const glb = pruneGlb(readGlb(new Uint8Array(readFileSync(source))), {
  meshNodes: PLAYER_MODEL.bodyMeshes,
  animations: PLAYER_MODEL.clips,
  channel: (node, path) => deform.includes(node) && (path === 'rotation' || (path === 'translation' && node === 'hips')),
});
const bytes = writeGlb(glb);
writeFileSync(target, bytes);
console.log(`${target}: ${bytes.byteLength} bytes, ${glb.json.meshes.length} meshes, ${glb.json.animations.length} clips`);
