import { describe, expect, it } from 'vitest';

import { setLocale } from '../lang';
import { identityLut } from '../lut/lut';
import { createFakeGl } from '../test-support/fake-gl';

import { FRAGMENT_SHADER, VERTEX_SHADER, createLutRenderer } from './lut-renderer';

const source = { width: 4, height: 2 } as unknown as HTMLCanvasElement;

describe('Shader', () => {
  it('are GLSL ES 3.00 and contain the required uniforms', () => {
    expect(VERTEX_SHADER.startsWith('#version 300 es')).toBe(true);
    expect(FRAGMENT_SHADER.startsWith('#version 300 es')).toBe(true);
    for (const name of ['uImage', 'uLut', 'uLutSize', 'uSplit']) {
      expect(FRAGMENT_SHADER).toContain(name);
    }
  });
});

describe('createLutRenderer', () => {
  it('compiles both shaders, links the program and sets up the textures', () => {
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

  it('uploads the LUT as an RGBA byte texture at cube size', () => {
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
    // Values outside 0..1 are clamped; the second grid point (R=1) is unchanged.
    expect([...bytes.slice(0, 4)]).toEqual([0, 255, 0, 255]);
    expect([...bytes.slice(4, 8)]).toEqual([255, 0, 0, 255]);
  });

  it('describes itself as a WebGL2 renderer with unchanged output size', () => {
    const renderer = createLutRenderer(createFakeGl().gl);
    expect(renderer.kind).toBe('webgl2');
    expect(renderer.outputSize({ width: 1280, height: 720 })).toEqual({ width: 1280, height: 720 });
  });

  it('draws the image with split line and LUT size as uniforms', () => {
    const { gl, call, constant } = createFakeGl();
    const renderer = createLutRenderer(gl);
    renderer.setLut(identityLut(9));
    renderer.render(source, { split: 0.4 });
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
    expect(floats).toEqual({ uLutSize: 9, uSplit: 0.4 });
    expect(call('drawArrays')).toHaveBeenCalledWith(constant('TRIANGLES'), 0, 3);
  });

  it('adapts the viewport to the current size of the drawing surface', () => {
    const fake = createFakeGl();
    Object.assign(fake.gl, { drawingBufferWidth: 1280, drawingBufferHeight: 720 });
    createLutRenderer(fake.gl).render(source, { split: 0 });
    expect(fake.call('viewport')).toHaveBeenCalledWith(0, 0, 1280, 720);
  });

  it('flips the image on upload (video has y pointing down)', () => {
    const { gl, call, constant } = createFakeGl();
    createLutRenderer(gl).render(source, { split: 0 });
    expect(call('pixelStorei')).toHaveBeenCalledWith(constant('UNPACK_FLIP_Y_WEBGL'), true);
  });

  it('uploads a new LUT after rendering without the image flip', () => {
    const { gl, call, constant } = createFakeGl();
    const renderer = createLutRenderer(gl);
    renderer.render(source, { split: 0 });
    renderer.setLut(identityLut(2));
    const flips = call('pixelStorei').mock.calls.map((arguments_, index) => ({
      arguments_,
      order: call('pixelStorei').mock.invocationCallOrder[index] ?? 0,
    }));
    const upload = call('texImage3D').mock.invocationCallOrder[0] ?? 0;
    const last = flips.findLast(
      (entry) => entry.arguments_[0] === constant('UNPACK_FLIP_Y_WEBGL') && entry.order < upload,
    );
    expect(last?.arguments_[1]).toBe(false);
  });

  it('releases all resources', () => {
    const { gl, call } = createFakeGl();
    createLutRenderer(gl).dispose();
    expect(call('deleteTexture')).toHaveBeenCalledTimes(2);
    expect(call('deleteVertexArray')).toHaveBeenCalledTimes(1);
    expect(call('deleteProgram')).toHaveBeenCalledTimes(1);
  });

  it('reports errors when compiling a shader, with the log', () => {
    const { gl, call } = createFakeGl({ getShaderParameter: () => false });
    expect(() => createLutRenderer(gl)).toThrow(
      'Shader konnte nicht übersetzt werden: Shader error',
    );
    expect(call('deleteShader')).toHaveBeenCalledTimes(1);
  });

  it('reports errors when linking', () => {
    const { gl, call } = createFakeGl({ getProgramParameter: () => false });
    expect(() => createLutRenderer(gl)).toThrow('gelinkt werden: Link error');
    expect(call('deleteProgram')).toHaveBeenCalledTimes(1);
  });

  it('handles missing logs', () => {
    const shader = createFakeGl({ getShaderParameter: () => false, getShaderInfoLog: () => null });
    expect(() => createLutRenderer(shader.gl)).toThrow('übersetzt werden: ');
    const program = createFakeGl({
      getProgramParameter: () => false,
      getProgramInfoLog: () => null,
    });
    expect(() => createLutRenderer(program.gl)).toThrow('gelinkt werden: ');
  });

  it('reports missing WebGL resources', () => {
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

describe('createLutRenderer (English)', () => {
  it('reports errors in English', () => {
    setLocale('en');
    expect(() => createLutRenderer(createFakeGl({ getShaderParameter: () => false }).gl)).toThrow(
      'Shader could not be compiled: Shader error',
    );
    expect(() => createLutRenderer(createFakeGl({ getProgramParameter: () => false }).gl)).toThrow(
      'Shader program could not be linked: Link error',
    );
    expect(() => createLutRenderer(createFakeGl({ createShader: () => null }).gl)).toThrow(
      'WebGL could not create a shader.',
    );
    expect(() => createLutRenderer(createFakeGl({ createTexture: () => null }).gl)).toThrow(
      'WebGL could not create the image texture.',
    );
  });
});
