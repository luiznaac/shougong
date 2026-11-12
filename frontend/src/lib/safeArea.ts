// The chrome and any viewport-docked primitive share these inset strings, so a
// notch or home indicator never moves one without the other. `index.html` opts
// into `viewport-fit=cover`, which makes the insets non-zero.
export const SAFE_AREA_TOP = "max(0.75rem, env(safe-area-inset-top))";
export const SAFE_AREA_BOTTOM = "max(0.5rem, env(safe-area-inset-bottom))";

/** Clearance for a floating card or toast that must sit above the mobile tab bar. */
export const DOCKED_BOTTOM = "calc(5.5rem + env(safe-area-inset-bottom))";

/**
 * The full-screen practice stage sits outside the shell, so it owns its own
 * insets here rather than re-reading `env()` in a component. Portrait puts the
 * notch at the top and the home indicator at the bottom; landscape moves the
 * notch to a side edge, so the stage carries all four.
 */
export const STAGE_TOP = "max(1.75rem, env(safe-area-inset-top))";
export const STAGE_BOTTOM = "max(0.6rem, env(safe-area-inset-bottom))";
export const STAGE_LEFT = "max(1rem, env(safe-area-inset-left))";
export const STAGE_RIGHT = "max(1rem, env(safe-area-inset-right))";

/** The band and the dock share one horizontal base, so their content lines up. */
export const STAGE_HORIZONTAL_PADDING = {
  paddingLeft: STAGE_LEFT,
  paddingRight: STAGE_RIGHT,
} as const;
