// Where an element is compared with the visible screen: above it, on it, or still below it.
// Updates as the visitor scrolls (uses the browser's IntersectionObserver).

import { useEffect, useState } from 'react';

export type ElementPosition = 'above' | 'inView' | 'below';

function positionOf(entry: IntersectionObserverEntry): ElementPosition {
  if (entry.isIntersecting) return 'inView';
  return entry.boundingClientRect.top < 0 ? 'above' : 'below';
}

/** `initialPosition` is used until the browser reports the real one (and during pre-rendering). */
export function useElementPosition(
  elementId: string,
  initialPosition: ElementPosition,
): ElementPosition {
  const [position, setPosition] = useState(initialPosition);

  useEffect(() => {
    const element = document.getElementById(elementId);
    if (!element) return;

    const observer = new IntersectionObserver((entries) => {
      const latest = entries.at(-1);
      if (latest) setPosition(positionOf(latest));
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, [elementId]);

  return position;
}
