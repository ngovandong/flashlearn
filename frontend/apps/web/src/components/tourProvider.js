import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { useLocation } from "react-router-dom";
import GuideTour, { isStepVisible } from "./guideTour";
import { getTourById, getTourForPath } from "@constants/tours";
import {
  areToursDisabled,
  disableAllTours,
  markStepDone,
  remainingSteps,
} from "@utils/tourStorage";

const TourContext = createContext({ startTour: () => {} });

export function useTour() {
  return useContext(TourContext);
}

// Give a freshly-navigated (lazy-loaded) page time to render its targets.
const AUTO_SHOW_DELAY_MS = 1200;

/**
 * Hosts the guided tour overlay and drives it from the current route.
 *
 * - Auto-shows a page's remaining steps the first time the user lands on it.
 * - `startTour(id, { all })` lets components (e.g. the Dragon chat) replay a
 *   tour on demand; `all: true` shows every step regardless of progress.
 */
export function TourProvider({ children }) {
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const [steps, setSteps] = useState([]);
  // Track which page paths we've already auto-shown this session.
  const autoShownRef = useRef(new Set());

  useEffect(() => {
    // The user has opted out of all auto-popups ("skip all").
    if (areToursDisabled()) return undefined;

    const path = location.pathname;
    const search = location.search;
    const key = path + search;
    const tour = getTourForPath(path, search);
    if (!tour) return undefined;
    if (autoShownRef.current.has(key)) return undefined;

    const remaining = remainingSteps(tour.steps);
    if (remaining.length === 0) return undefined;

    const timer = setTimeout(() => {
      // Re-check at fire time in case the user navigated away meanwhile.
      if (location.pathname + location.search !== key) return;
      if (areToursDisabled()) return;
      const stillLeft = remainingSteps(tour.steps);
      if (stillLeft.length === 0) return;
      // Only show steps whose target is actually rendered on screen.
      const visible = stillLeft.filter(isStepVisible);
      if (visible.length === 0) return;
      autoShownRef.current.add(key);
      setSteps(visible);
      setOpen(true);
    }, AUTO_SHOW_DELAY_MS);

    return () => clearTimeout(timer);
  }, [location.pathname, location.search]);

  const startTour = useCallback(
    (tourId, { all = false } = {}) => {
      const tour =
        getTourById(tourId) ||
        getTourForPath(location.pathname, location.search);
      if (!tour) return;
      const remaining = remainingSteps(tour.steps);
      // Manual launches default to remaining steps, but never show an empty
      // tour — fall back to the full set so "Show me the guide" always works.
      const toShow = all || remaining.length === 0 ? tour.steps : remaining;
      // Skip steps whose target isn't visible on screen right now.
      const visible = toShow.filter(isStepVisible);
      if (visible.length === 0) return;
      setSteps(visible);
      setOpen(true);
    },
    [location.pathname, location.search]
  );

  const handleSkipAll = useCallback(() => {
    disableAllTours();
    setOpen(false);
  }, []);

  return (
    <TourContext.Provider value={{ startTour }}>
      {children}
      <GuideTour
        open={open}
        steps={steps}
        onStepDone={markStepDone}
        onClose={() => setOpen(false)}
        onSkipAll={handleSkipAll}
      />
    </TourContext.Provider>
  );
}

export default TourProvider;
