import { describe, expect, it } from 'vitest';

import { identityLut } from '../lut/lut';
import { createFakeGl } from '../test-support/fake-gl';

import { FRAGMENT_SHADER, VERTEX_SHADER, createLutRenderer } from './lut-renderer';

const source = { width: 4, height: 2 } as unknown as HTMLCanvasElement;

describe('Shader', () => {
  it('sind GLSL ES 3.00 und enthalten die benötigten Uniforms', () => {
    expect(VERTEX_SHADER.startsWith('#version 300 es')).toBe(true);
    expect(FRAGMENT_SHADER.startsWith('#version 300 es')).toBe(true);
    for (const name of ['uImage', 'uLut', 'uLutSize', 'uStrength', 'uSplit']) {
      expect(FRAGMENT_SHADER).toContain(name);
    }
  });
});

describe('createLutRenderer', () => {
  it('übersetzt beide Shader, linkt das Programm und richtet die Texturen ein', () => {
    const { gl, call, constant } = createFakeGl();
    createLutRenderer(gl);
    expect(call('createShader')).toHaveBeenCalledTimes(2);
    expect(call('shaderSource')).toHaveBeenCalledWith(expect.anything(), VERTEX_SHADER);
    expect(call('shaderSource')).toHaveBeenCalledWith(expect.anything(), FRAGMENT_SHADER);
    expect(call('linkProgram')).toHaveBeenCalledTimes(1);
    expect(call('deleteShader')).toHaveBeenCalledTimes(2);
    expect(call('createTexture')).toHaveBeenCalledTimes(2);
    expect(call('texParameteri')).toHaveBeenCalledWith(
      constant('TEXTURE_3D'),
      constant('TEXTURE_WRAP_R'),
      constant('CLAMP_TO_EDGE'),
    );
  });

  it('lädt die LUT als RGBA-Bytetextur in der Würfelgröße', () => {
    const { gl, call, constant } = createFakeGl();
    const renderer = createLutRenderer(gl);
    const lut = identityLut(2);
    lut.data[0] = -0.5;
    lut.data[1] = 2;
    renderer.setLut(lut);
    const bytes = call('texImage3D').mock.calls[0]?.[9] as Uint8Array;
    expect(call('texImage3D')).toHaveBeenCalledWith(
      constant('TEXTURE_3D'),
      0,
      constant('RGBA8'),
      2,
      2,
      2,
      0,
      constant('RGBA'),
      constant('UNSIGNED_BYTE'),
      expect.any(Uint8Array),
    );
    expect(bytes).toHaveLength(2 ** 3 * 4);
    // Werte außerhalb 0..1 werden begrenzt; der zweite Gitterpunkt (R=1) ist unverändert.
    expect([...bytes.slice(0, 4)]).toEqual([0, 255, 0, 255]);
    expect([...bytes.slice(4, 8)]).toEqual([255, 0, 0, 255]);
  });

  it('beschreibt sich als WebGL2-Renderer mit unveränderter Ausgabegröße', () => {
    const renderer = createLutRenderer(createFakeGl().gl);
    expect(renderer.kind).toBe('webgl2');
    expect(renderer.outputSize({ width: 1280, height: 720 })).toEqual({ width: 1280, height: 720 });
  });

  it('zeichnet das Bild mit Stärke, Trennlinie und LUT-Größe als Uniforms', () => {
    const { gl, call, constant } = createFakeGl();
    const renderer = createLutRenderer(gl);
    renderer.setLut(identityLut(9));
    renderer.render(source, { strength: 0.75, split: 0.4 });
    expect(call('texImage2D')).toHaveBeenCalledWith(
      constant('TEXTURE_2D'),
      0,
      constant('RGBA'),
      constant('RGBA'),
      constant('UNSIGNED_BYTE'),
      source,
    );
    const floats = Object.fromEntries(
      call('uniform1f').mock.calls.map(([location, value]) => [
        (location as { name: string }).name,
        value as number,
      ]),
    );
    expect(floats).toEqual({ uLutSize: 9, uStrength: 0.75, uSplit: 0.4 });
    expect(call('drawArrays')).toHaveBeenCalledWith(constant('TRIANGLES'), 0, 3);
  });

  it('passt den Ausschnitt an die aktuelle Größe der Zeichenfläche an', () => {
    const fake = createFakeGl();
    Object.assign(fake.gl, { drawingBufferWidth: 1280, drawingBufferHeight: 720 });
    createLutRenderer(fake.gl).render(source, { strength: 1, split: 0 });
    expect(fake.call('viewport')).toHaveBeenCalledWith(0, 0, 1280, 720);
  });

  it('kehrt das Bild beim Hochladen um (Video hat y nach unten)', () => {
    const { gl, call, constant } = createFakeGl();
    createLutRenderer(gl).render(source, { strength: 1, split: 0 });
    expect(call('pixelStorei')).toHaveBeenCalledWith(constant('UNPACK_FLIP_Y_WEBGL'), true);
  });

  it('gibt alle Ressourcen frei', () => {
    const { gl, call } = createFakeGl();
    createLutRenderer(gl).dispose();
    expect(call('deleteTexture')).toHaveBeenCalledTimes(2);
    expect(call('deleteVertexArray')).toHaveBeenCalledTimes(1);
    expect(call('deleteProgram')).toHaveBeenCalledTimes(1);
  });

  it('meldet Fehler beim Übersetzen eines Shaders mit dem Protokoll', () => {
    const { gl, call } = createFakeGl({ getShaderParameter: () => false });
    expect(() => createLutRenderer(gl)).toThrow(
      'Shader konnte nicht übersetzt werden: Fehler im Shader',
    );
    expect(call('deleteShader')).toHaveBeenCalledTimes(1);
  });

  it('meldet Fehler beim Linken', () => {
    const { gl, call } = createFakeGl({ getProgramParameter: () => false });
    expect(() => createLutRenderer(gl)).toThrow('gelinkt werden: Fehler beim Linken');
    expect(call('deleteProgram')).toHaveBeenCalledTimes(1);
  });

  it('behandelt fehlende Protokolle', () => {
    const shader = createFakeGl({ getShaderParameter: () => false, getShaderInfoLog: () => null });
    expect(() => createLutRenderer(shader.gl)).toThrow('übersetzt werden: ');
    const program = createFakeGl({
      getProgramParameter: () => false,
      getProgramInfoLog: () => null,
    });
    expect(() => createLutRenderer(program.gl)).toThrow('gelinkt werden: ');
  });

  it('meldet fehlende WebGL-Ressourcen', () => {
    expect(() => createLutRenderer(createFakeGl({ createShader: () => null }).gl)).toThrow(
      'einen Shader',
    );
    expect(() => createLutRenderer(createFakeGl({ createProgram: () => null }).gl)).toThrow(
      'ein Shader-Programm',
    );
    expect(() => createLutRenderer(createFakeGl({ createVertexArray: () => null }).gl)).toThrow(
      'ein Vertex-Array',
    );
    expect(() => createLutRenderer(createFakeGl({ createTexture: () => null }).gl)).toThrow(
      'die Bildtextur',
    );
  });
});
