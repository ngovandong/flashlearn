import { useCallback, useRef } from "react";

/**
 * Horizontal swipe handler. Calls onSwipeLeft / onSwipeRight when distance exceeds threshold.
 */
export function useSwipeGesture({ onSwipeLeft, onSwipeRight, threshold = 50 }) {
  const touchStartRef = useRef(null);

  const handleTouchStart = useCallback((event) => {
    touchStartRef.current = event.touches[0].clientX;
  }, []);

  const handleTouchEnd = useCallback(
    (event) => {
      const touchStart = touchStartRef.current;
      if (touchStart == null) return;
      const distance = event.changedTouches[0].clientX - touchStart;
      if (distance > threshold) {
        onSwipeRight?.();
      } else if (distance < -threshold) {
        onSwipeLeft?.();
      }
    },
    [onSwipeLeft, onSwipeRight, threshold]
  );

  return { handleTouchStart, handleTouchEnd };
}
