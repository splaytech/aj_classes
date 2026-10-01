// Sliding flyers beside the hero headline (replaces the static illustration).
//
// Accessibility (WCAG 2.2.2): slides move on their own only when the visitor hasn't asked
// for reduced motion, and they pause while hovered or focused. There is always a pause button.

import { useEffect, useState } from 'react';

import { APP_CONFIG, HERO_SLIDES } from '@/constants';
import { usePrefersReducedMotion } from '@/lib/use-prefers-reduced-motion';

import { FlyerSlide } from './FlyerSlide';
import styles from './HeroSlideshow.module.css';

const slides = HERO_SLIDES.slides;
const millisecondsPerSlide = APP_CONFIG.heroSlideshow.secondsPerSlide * 1000;

export function HeroSlideshow() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);
  const [isHovered, setIsHovered] = useState(false);
  const prefersReducedMotion = usePrefersReducedMotion();

  const shouldAutoPlay = isPlaying && !isHovered && !prefersReducedMotion;

  function showNext() {
    setCurrentIndex((index) => (index + 1) % slides.length);
  }

  function showPrevious() {
    setCurrentIndex((index) => (index - 1 + slides.length) % slides.length);
  }

  // Move to the next slide after a pause. Restarts whenever the slide changes,
  // so a slide picked by hand always gets its full time on screen.
  useEffect(() => {
    if (!shouldAutoPlay) return;
    const timer = setTimeout(showNext, millisecondsPerSlide);
    return () => clearTimeout(timer);
  }, [shouldAutoPlay, currentIndex]);

  return (
    <section
      className={styles.slideshow}
      aria-roledescription="carousel"
      aria-label={HERO_SLIDES.label}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onFocus={() => setIsHovered(true)}
      onBlur={() => setIsHovered(false)}
    >
      <div className={styles.viewport} aria-live={shouldAutoPlay ? 'off' : 'polite'}>
        <div className={styles.track} style={{ transform: `translateX(-${currentIndex * 100}%)` }}>
          {slides.map((slide, index) => (
            <FlyerSlide
              key={slide.title}
              slide={slide}
              isActive={index === currentIndex}
              label={HERO_SLIDES.slideOf(index + 1, slides.length)}
            />
          ))}
        </div>
      </div>

      <div className={styles.controls}>
        <button
          type="button"
          className={styles.controlButton}
          aria-label={isPlaying ? HERO_SLIDES.pause : HERO_SLIDES.play}
          onClick={() => setIsPlaying(!isPlaying)}
        >
          <span aria-hidden="true">{isPlaying ? HERO_SLIDES.pauseIcon : HERO_SLIDES.playIcon}</span>
        </button>

        <button
          type="button"
          className={styles.controlButton}
          aria-label={HERO_SLIDES.previous}
          onClick={showPrevious}
        >
          <span aria-hidden="true">{HERO_SLIDES.previousIcon}</span>
        </button>

        <div className={styles.dots}>
          {slides.map((slide, index) => (
            <button
              key={slide.title}
              type="button"
              className={styles.dot}
              aria-label={HERO_SLIDES.goToSlide(index + 1)}
              aria-current={index === currentIndex}
              onClick={() => setCurrentIndex(index)}
            />
          ))}
        </div>

        <button
          type="button"
          className={styles.controlButton}
          aria-label={HERO_SLIDES.next}
          onClick={showNext}
        >
          <span aria-hidden="true">{HERO_SLIDES.nextIcon}</span>
        </button>
      </div>
    </section>
  );
}
