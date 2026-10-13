import { describe, expect, it } from 'vitest';
import { Mesh, Scene } from 'three';
import { SUPPORTED_SCHEMA_VERSION } from '../src/index.ts';
import { SCHEMA_VERSION } from '@tennis/engine';

describe('renderer workspace', () => {
  it('builds a Three.js scene graph in Node without WebGL', () => {
    const scene = new Scene();
    scene.add(new Mesh());
    expect(scene.children).toHaveLength(1);
  });

  it('reads the schema version the engine writes, through its public index', () => {
    expect(SUPPORTED_SCHEMA_VERSION).toBe(SCHEMA_VERSION);
  });
});
