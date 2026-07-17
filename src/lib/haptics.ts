/** Short tap-like vibration burst for interactive taps. Silently no-ops wherever the Vibration
 * API isn't supported — notably iOS Safari, which has never implemented it, so this only does
 * anything on Android. There's no "haptic intensity" on the web, just vibration duration. */
export function triggerHaptic(durationMs = 10) {
  if (typeof navigator !== "undefined" && "vibrate" in navigator) {
    navigator.vibrate(durationMs);
  }
}
