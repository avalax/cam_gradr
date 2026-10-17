import { vi } from 'vitest';

// Attrappe für WebGL2: jede Methode ist ein Spion, Konstanten (GROSSBUCHSTABEN) sind Zahlen.
// Einzelne Rückgabewerte lassen sich über `overrides` ersetzen.
type Implementation = (...args: never[]) => unknown;

export function createFakeGl(overrides: Record<string, Implementation> = {}) {
  const cache = new Map<string, unknown>();
  const constants = new Map<string, number>();
  const defaults: Record<string, Implementation> = {
    createShader: () => ({ kind: 'shader' }),
    createProgram: () => ({ kind: 'program' }),
    createVertexArray: () => ({ kind: 'vao' }),
    createTexture: () => ({ kind: 'texture' }),
    getUniformLocation: (_program: never, name: string) => ({ name }),
    getShaderParameter: () => true,
    getProgramParameter: () => true,
    getShaderInfoLog: () => 'Fehler im Shader',
    getProgramInfoLog: () => 'Fehler beim Linken',
  };
  const gl = new Proxy<Record<string, unknown>>(
    {},
    {
      get(_target, property: string) {
        if (/^[A-Z0-9_]+$/.test(property)) {
          if (!constants.has(property)) {
            constants.set(property, constants.size + 1);
          }
          return constants.get(property);
        }
        if (!cache.has(property)) {
          cache.set(property, vi.fn(overrides[property] ?? defaults[property]));
        }
        return cache.get(property);
      },
    },
  );
  return {
    gl: gl as unknown as WebGL2RenderingContext,
    call: (name: string) => gl[name] as ReturnType<typeof vi.fn>,
    constant: (name: string) => gl[name] as number,
  };
}
