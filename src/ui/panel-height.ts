// Reports every change of an element's height; returns a function that stops observing.
export function trackHeight(element: HTMLElement, onChange: (height: number) => void): () => void {
  const observer = new ResizeObserver((entries) => {
    const entry = entries[0];
    if (entry !== undefined) {
      onChange(Math.round(entry.target.getBoundingClientRect().height));
    }
  });
  observer.observe(element);
  return () => {
    observer.disconnect();
  };
}
