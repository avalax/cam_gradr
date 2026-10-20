import type { Frame } from './frame';

export interface DrawContext {
  createImageData: (width: number, height: number) => ImageData;
  putImageData: (image: ImageData, x: number, y: number) => void;
}

const MAX_CODE = 255;

// Draws an averaged RGB frame onto a canvas (preview of the still image).
export function drawFrame(context: DrawContext, frame: Frame): void {
  const image = context.createImageData(frame.width, frame.height);
  const pixels = frame.width * frame.height;
  for (let pixel = 0; pixel < pixels; pixel++) {
    for (let channel = 0; channel < 3; channel++) {
      image.data[pixel * 4 + channel] = (frame.data[pixel * 3 + channel] ?? 0) * MAX_CODE;
    }
    image.data[pixel * 4 + 3] = MAX_CODE;
  }
  context.putImageData(image, 0, 0);
}
