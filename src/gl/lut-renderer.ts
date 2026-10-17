import type { Lut } from '../lut/lut';

export const VERTEX_SHADER = `#version 300 es
out vec2 vUv;
void main() {
  // Ein bildschirmfüllendes Dreieck ohne Vertexdaten.
  vec2 corner = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));
  vUv = corner;
  gl_Position = vec4(corner * 2.0 - 1.0, 0.0, 1.0);
}
`;

// Wendet die 3D-LUT auf jedes Pixel an. uSplit trennt Vorher (links) und Nachher (rechts),
// uStrength mischt zwischen Original und Korrektur.
export const FRAGMENT_SHADER = `#version 300 es
precision highp float;
precision highp sampler3D;
uniform sampler2D uImage;
uniform sampler3D uLut;
uniform float uLutSize;
uniform float uStrength;
uniform float uSplit;
in vec2 vUv;
out vec4 outColor;
void main() {
  vec3 original = texture(uImage, vUv).rgb;
  // Auf Texelmitten abbilden, damit 0 und 1 genau die ersten und letzten Gitterpunkte treffen.
  vec3 coord = original * ((uLutSize - 1.0) / uLutSize) + 0.5 / uLutSize;
  vec3 corrected = texture(uLut, coord).rgb;
  vec3 result = mix(original, corrected, uStrength);
  outColor = vec4(vUv.x < uSplit ? original : result, 1.0);
}
`;

interface RenderOptions {
  // Anteil der Korrektur: 0 = Original, 1 = volle Korrektur.
  strength: number;
  // Trennlinie als Anteil der Breite: links Original, rechts korrigiert (0 = alles korrigiert).
  split: number;
}

export interface LutRenderer {
  setLut: (lut: Lut) => void;
  render: (source: TexImageSource, options: RenderOptions) => void;
  dispose: () => void;
}

// WebGL liefert bei Ressourcenmangel null; das soll als verständlicher Fehler enden.
function required<T>(value: T | null, what: string): T {
  if (value === null) {
    throw new Error(`WebGL konnte ${what} nicht anlegen.`);
  }
  return value;
}

function compile(gl: WebGL2RenderingContext, type: number, source: string): WebGLShader {
  const shader = required(gl.createShader(type), 'einen Shader');
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (gl.getShaderParameter(shader, gl.COMPILE_STATUS) === false) {
    const log = gl.getShaderInfoLog(shader) ?? '';
    gl.deleteShader(shader);
    throw new Error(`Shader konnte nicht übersetzt werden: ${log}`);
  }
  return shader;
}

function link(gl: WebGL2RenderingContext): WebGLProgram {
  const program = required(gl.createProgram(), 'ein Shader-Programm');
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
    throw new Error(`Shader-Programm konnte nicht gelinkt werden: ${log}`);
  }
  return program;
}

function configureTexture(gl: WebGL2RenderingContext, target: number): void {
  gl.texParameteri(target, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(target, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(target, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(target, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
}

// Dünner Adapter um WebGL2: zeichnet ein Bild (Video, Canvas) mit angewandter 3D-LUT.
export function createLutRenderer(gl: WebGL2RenderingContext): LutRenderer {
  const program = link(gl);
  const vao = required(gl.createVertexArray(), 'ein Vertex-Array');
  const imageTexture = required(gl.createTexture(), 'die Bildtextur');
  const lutTexture = required(gl.createTexture(), 'die LUT-Textur');
  const uniforms = {
    image: gl.getUniformLocation(program, 'uImage'),
    lut: gl.getUniformLocation(program, 'uLut'),
    lutSize: gl.getUniformLocation(program, 'uLutSize'),
    strength: gl.getUniformLocation(program, 'uStrength'),
    split: gl.getUniformLocation(program, 'uSplit'),
  };
  let lutSize = 2;

  gl.bindTexture(gl.TEXTURE_2D, imageTexture);
  configureTexture(gl, gl.TEXTURE_2D);
  gl.bindTexture(gl.TEXTURE_3D, lutTexture);
  configureTexture(gl, gl.TEXTURE_3D);
  gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_WRAP_R, gl.CLAMP_TO_EDGE);

  return {
    setLut(lut: Lut): void {
      lutSize = lut.size;
      gl.bindTexture(gl.TEXTURE_3D, lutTexture);
      gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
      gl.texImage3D(
        gl.TEXTURE_3D,
        0,
        gl.RGB16F,
        lut.size,
        lut.size,
        lut.size,
        0,
        gl.RGB,
        gl.FLOAT,
        lut.data,
      );
    },

    render(source: TexImageSource, options: RenderOptions): void {
      gl.useProgram(program);
      gl.bindVertexArray(vao);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, imageTexture);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_3D, lutTexture);
      gl.uniform1i(uniforms.image, 0);
      gl.uniform1i(uniforms.lut, 1);
      gl.uniform1f(uniforms.lutSize, lutSize);
      gl.uniform1f(uniforms.strength, options.strength);
      gl.uniform1f(uniforms.split, options.split);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    },

    dispose(): void {
      gl.deleteTexture(imageTexture);
      gl.deleteTexture(lutTexture);
      gl.deleteVertexArray(vao);
      gl.deleteProgram(program);
    },
  };
}
