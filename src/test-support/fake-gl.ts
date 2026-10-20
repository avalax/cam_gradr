import { vi } from 'vitest';

// Stand-in for WebGL2: every method is a spy, constants (UPPERCASE) are numbers.
// Individual return values can be replaced via `overrides`.
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
    getShaderInfoLog: () => 'Shader error',
    getProgramInfoLog: () => 'Link error',
  };
  const gl = new Proxy<Record<string, unknown>>(
    {},
    {
      get(target, property: string) {
        // Values a test has set itself (e.g. drawingBufferWidth) take precedence.
        if (Object.hasOwn(target, property)) {
          return target[property];
        }
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
