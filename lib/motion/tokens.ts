/**
 * Centralized motion system for Motion (framer-motion) component
 * interactions — see MOTION FOUNDATION. GSAP is intentionally not
 * initialized here; it's reserved for landing-page/scroll-driven sequences
 * added in Prompt 9. Values mirror the CSS custom properties in
 * app/globals.css so JS-driven and CSS-driven motion never drift apart.
 */

export const duration = {
  fast: 0.12,
  base: 0.2,
  slow: 0.36,
} as const;

export const ease = {
  standard: [0.4, 0, 0.2, 1] as const,
  emphasized: [0.2, 0, 0, 1] as const,
};

/** Default transition for small UI interactions (hover, tap, toggle). */
export const transitionBase = {
  duration: duration.base,
  ease: ease.standard,
};

/** Fade + rise, for cards/panels entering the viewport or a dialog opening. */
export const fadeInUp = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: 8 },
  transition: transitionBase,
};

export const fadeIn = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 },
  transition: transitionBase,
};
