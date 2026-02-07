/**
 * Haptic feedback via the Vibration API.
 *
 * Gracefully no-ops on devices that don't support vibration.
 */

function vibrate(pattern: number | number[]) {
  try {
    if (navigator.vibrate) {
      navigator.vibrate(pattern);
    }
  } catch {
    // Silently ignore
  }
}

export const haptics = {
  /** Light tap — tile placement, button press. */
  light: () => vibrate(10),

  /** Medium tap — move submitted, exchange. */
  medium: () => vibrate(25),

  /** Error buzz — invalid move. */
  error: () => vibrate([30, 50, 30]),

  /** Warning — timer running low. */
  warning: () => vibrate([15, 30, 15]),

  /** Strong — game over. */
  strong: () => vibrate(50),
};
