// Sun, sky and haze for the Rally Pop look (ADR-018). No tone mapping: the palette is picked in sRGB and the toon
// bands come from one directional sun, so a filmic curve would only desaturate it.
import { BackSide, BufferAttribute, Color, DirectionalLight, Fog, HemisphereLight, Mesh, MeshBasicMaterial, SphereGeometry, type Scene } from 'three';
import { DAYLIGHT } from '../tuning/index.ts';

/** A dome blending from the horizon colour up to the zenith; the fog matches its horizon so nothing halos. */
function skyDome(): Mesh {
  const { zenith, horizon, radius } = DAYLIGHT.sky;
  const geometry = new SphereGeometry(radius, 24, 12);
  const pos = geometry.getAttribute('position');
  const colours = new Float32Array(pos.count * 3);
  const low = new Color(horizon);
  const high = new Color(zenith);
  const c = new Color();
  for (let i = 0; i < pos.count; i++) {
    const up = Math.max(0, pos.getY(i) / radius);
    c.lerpColors(low, high, Math.sqrt(up)).toArray(colours, i * 3);
  }
  geometry.setAttribute('color', new BufferAttribute(colours, 3));
  const sky = new Mesh(geometry, new MeshBasicMaterial({ vertexColors: true, side: BackSide, fog: false, depthWrite: false }));
  sky.name = 'sky';
  sky.renderOrder = -1;
  return sky;
}

export function addDaylight(scene: Scene): void {
  scene.background = new Color(DAYLIGHT.sky.horizon);
  scene.fog = new Fog(DAYLIGHT.sky.horizon, DAYLIGHT.fog.near, DAYLIGHT.fog.far);
  const { hemisphere: h, sun: s } = DAYLIGHT;
  const sun = new DirectionalLight(s.colour, s.intensity);
  sun.position.set(...s.position);
  sun.name = 'sun';
  scene.add(new HemisphereLight(h.sky, h.ground, h.intensity), sun, skyDome());
}
