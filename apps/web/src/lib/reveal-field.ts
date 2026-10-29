// Moving focus to a field with an error isn't enough on its own: in Chromium the page can stay
// scrolled at the Save button (item 4 dev notes O1). Scrolling the field to the middle of the
// screen also shows its label above and its error below.

/** Focuses `element` (when it can take focus) and scrolls it to the middle of the screen. */
export function revealField(element: HTMLElement | null): void {
  if (!element) return;
  element.focus({ preventScroll: true });
  element.scrollIntoView({ block: 'center' });
}
