import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { HERO_SLIDES } from '@/constants';

import { HeroSlideshow } from './HeroSlideshow';

/** Pretends the visitor has (or hasn't) asked their device to reduce motion. */
function mockReducedMotion(prefersReducedMotion: boolean) {
  vi.stubGlobal('matchMedia', () => ({
    matches: prefersReducedMotion,
    addEventListener: () => {},
    removeEventListener: () => {},
  }));
}

/** The slide groups, in order. Hidden slides are marked `inert`. */
function slideGroups() {
  return screen
    .getAllByRole('group', { hidden: true })
    .filter((element) => element.getAttribute('aria-label')?.startsWith('Slide'));
}

describe('HeroSlideshow', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  describe('with reduced motion requested', () => {
    beforeEach(() => mockReducedMotion(true));

    it('shows the first slide and keeps the others out of reach', () => {
      render(<HeroSlideshow />);
      const [first, second] = slideGroups();
      expect(first).not.toHaveAttribute('inert');
      expect(second).toHaveAttribute('inert');
    });

    it('moves with the next, previous and dot buttons', async () => {
      const user = userEvent.setup();
      render(<HeroSlideshow />);

      await user.click(screen.getByRole('button', { name: HERO_SLIDES.next }));
      expect(slideGroups()[1]).not.toHaveAttribute('inert');

      await user.click(screen.getByRole('button', { name: HERO_SLIDES.previous }));
      expect(slideGroups()[0]).not.toHaveAttribute('inert');

      await user.click(screen.getByRole('button', { name: HERO_SLIDES.goToSlide(3) }));
      expect(slideGroups()[2]).not.toHaveAttribute('inert');
    });

    it('never moves on its own', () => {
      vi.useFakeTimers();
      render(<HeroSlideshow />);
      act(() => vi.advanceTimersByTime(60_000));
      expect(slideGroups()[0]).not.toHaveAttribute('inert');
    });
  });

  describe('with normal motion', () => {
    beforeEach(() => mockReducedMotion(false));

    it('moves to the next slide after the set time', () => {
      vi.useFakeTimers();
      render(<HeroSlideshow />);
      act(() => vi.advanceTimersByTime(6_000));
      expect(slideGroups()[1]).not.toHaveAttribute('inert');
    });
  });
});
