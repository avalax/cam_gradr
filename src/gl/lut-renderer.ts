import { t } from '../lang';
import type { Lut } from '../lut/lut';

export const VERTEX_SHADER = `#version 300 es
out vec2 vUv;
void main() {
  // A full-screen triangle without vertex data.
  vec2 corner = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));
  vUv = corner;
  gl_Position = vec4(corner * 2.0 - 1.0, 0.0, 1.0);
}
`;

// Applies the 3D LUT to every pixel. uSplit separates before (left) and after (right); left of it
// the original stays, or with uLeftCorrected the second LUT applies (the correction without look).
export const FRAGMENT_SHADER = `#version 300 es
precision highp float;
precision highp sampler3D;
uniform sampler2D uImage;
uniform sampler3D uLut;
uniform float uLutSize;
uniform sampler3D uLeftLut;
uniform float uLeftLutSize;
uniform float uLeftCorrected;
uniform float uSplit;
in vec2 vUv;
out vec4 outColor;
vec3 lookup(sampler3D lut, float size, vec3 color) {
  // Map to texel centers so that 0 and 1 hit exactly the first and last grid points.
  return texture(lut, color * ((size - 1.0) / size) + 0.5 / size).rgb;
}
void main() {
  vec3 original = texture(uImage, vUv).rgb;
  vec3 left = uLeftCorrected > 0.5 ? lookup(uLeftLut, uLeftLutSize, original) : original;
  outColor = vec4(vUv.x < uSplit ? left : lookup(uLut, uLutSize, original), 1.0);
}
`;

interface RenderOptions {
  // Split line as a fraction of the width: original left, corrected right (0 = all corrected).
  split: number;
}

// Image sources that can be drawn both into a WebGL texture and onto a 2D surface.
export type RenderSource = HTMLVideoElement | HTMLCanvasElement;

export interface LutRenderer {
  // What is drawn with: the graphics card (WebGL2) or software on the CPU.
  kind: 'webgl2' | 'cpu';
  // Size of the drawing surface for an image source of this size.
  outputSize: (source: { width: number; height: number }) => { width: number; height: number };
  setLut: (lut: Lut) => void;
  // LUT left of the split line; null leaves the original there.
  setLeftLut: (lut: Lut | null) => void;
  render: (source: RenderSource, options: RenderOptions) => void;
  dispose: () => void;
}

// WebGL returns null when resources run out; this should end as an understandable error.
function required<T>(value: T | null, what: string): T {
  if (value === null) {
    throw new Error(t('preview.errors.createFailed', { what }));
  }
  return value;
}

function compile(gl: WebGL2RenderingContext, type: number, source: string): WebGLShader {
  const shader = required(gl.createShader(type), t('preview.errors.shader'));
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (gl.getShaderParameter(shader, gl.COMPILE_STATUS) === false) {
    const log = gl.getShaderInfoLog(shader) ?? '';
    gl.deleteShader(shader);
    throw new Error(t('preview.errors.compileFailed', { log }));
  }
  return shader;
}

function link(gl: WebGL2RenderingContext): WebGLProgram {
  const program = required(gl.createProgram(), t('preview.errors.program'));
  const vertex = compile(gl, gl.VERTEX_SHADER, VERTEX_SHADER);
  const fragment = compile(gl, gl.FRAGMENT_SHADER, FRAGMENT_SHADER);
  gl.attachShader(program, vertex);
  gl.attachShader(program, fragment);
  gl.linkProgram(program);
  gl.deleteShader(vertex);
  gl.deleteShader(fragment);
  if (gl.getProgramParameter(program, gl.LINK_STATUS) === false) {
    const log = gl.getProgramInfoLog(program) ?? '';
    gl.deleteProgram(program);
    throw new Error(t('preview.errors.linkFailed', { log }));
  }
  return program;
}

function configureTexture(gl: WebGL2RenderingContext, target: number): void {
  gl.texParameteri(target, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(target, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(target, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(target, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
}

// RGB float data of the LUT as RGBA bytes (alpha 255).
function toRgba8(lut: Lut): Uint8Array {
  const count = lut.size ** 3;
  const bytes = new Uint8Array(count * 4);
  for (let index = 0; index < count; index++) {
    for (let channel = 0; channel < 3; channel++) {
      const value = Math.min(Math.max(Number(lut.data[index * 3 + channel]), 0), 1);
      bytes[index * 4 + channel] = Math.round(value * 255);
    }
    bytes[index * 4 + 3] = 255;
  }
  return bytes;
}

// Thin adapter around WebGL2: draws an image (video, canvas) with the 3D LUT applied.
export function createLutRenderer(gl: WebGL2RenderingContext): LutRenderer {
  const program = link(gl);
  const vao = required(gl.createVertexArray(), t('preview.errors.vertexArray'));
  const imageTexture = required(gl.createTexture(), t('preview.errors.imageTexture'));
  const lutTexture = required(gl.createTexture(), t('preview.errors.lutTexture'));
  const leftLutTexture = required(gl.createTexture(), t('preview.errors.lutTexture'));
  const uniforms = {
    image: gl.getUniformLocation(program, 'uImage'),
    lut: gl.getUniformLocation(program, 'uLut'),
    lutSize: gl.getUniformLocation(program, 'uLutSize'),
    leftLut: gl.getUniformLocation(program, 'uLeftLut'),
    leftLutSize: gl.getUniformLocation(program, 'uLeftLutSize'),
    leftCorrected: gl.getUniformLocation(program, 'uLeftCorrected'),
    split: gl.getUniformLocation(program, 'uSplit'),
  };
  let lutSize = 2;
  let leftLutSize = 2;
  let leftCorrected = false;

  gl.bindTexture(gl.TEXTURE_2D, imageTexture);
  configureTexture(gl, gl.TEXTURE_2D);
  for (const texture of [lutTexture, leftLutTexture]) {
    gl.bindTexture(gl.TEXTURE_3D, texture);
    configureTexture(gl, gl.TEXTURE_3D);
    gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_WRAP_R, gl.CLAMP_TO_EDGE);
  }

  function upload(texture: WebGLTexture, lut: Lut): void {
    gl.bindTexture(gl.TEXTURE_3D, texture);
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
    // The image upload in render() turns the flip on; a flipped LUT would swap the green axis.
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    // 8 bits per channel are enough for the output and work everywhere, even with software GL.
    gl.texImage3D(
      gl.TEXTURE_3D,
      0,
      gl.RGBA8,
      lut.size,
      lut.size,
      lut.size,
      0,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      toRgba8(lut),
    );
  }

  return {
    kind: 'webgl2',

    outputSize: (source) => ({ width: source.width, height: source.height }),

    setLut(lut: Lut): void {
      lutSize = lut.size;
      upload(lutTexture, lut);
    },

    setLeftLut(lut: Lut | null): void {
      leftCorrected = lut !== null;
      if (lut !== null) {
        leftLutSize = lut.size;
        upload(leftLutTexture, lut);
      }
    },

    render(source: RenderSource, options: RenderOptions): void {
      // The viewport follows the drawing surface, whose size changes with the image.
      gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
      gl.useProgram(program);
      gl.bindVertexArray(vao);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, imageTexture);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_3D, lutTexture);
      // Bound even when unused: two samplers of different types must not share a texture unit.
      gl.activeTexture(gl.TEXTURE2);
      gl.bindTexture(gl.TEXTURE_3D, leftLutTexture);
      gl.uniform1i(uniforms.image, 0);
      gl.uniform1i(uniforms.lut, 1);
      gl.uniform1i(uniforms.leftLut, 2);
      gl.uniform1f(uniforms.lutSize, lutSize);
      gl.uniform1f(uniforms.leftLutSize, leftLutSize);
      gl.uniform1f(uniforms.leftCorrected, leftCorrected ? 1 : 0);
      gl.uniform1f(uniforms.split, options.split);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    },

    dispose(): void {
      gl.deleteTexture(imageTexture);
      gl.deleteTexture(lutTexture);
      gl.deleteTexture(leftLutTexture);
      gl.deleteVertexArray(vao);
      gl.deleteProgram(program);
    },
  };
}
