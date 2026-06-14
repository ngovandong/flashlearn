import { lazy } from "react";

const RELOAD_FLAG = "fl:chunk-reload";

/**
 * Wraps React.lazy with resilience against failed dynamic imports.
 *
 * Two failure modes are handled:
 *  - Transient network errors: retried a few times with a short backoff.
 *  - Stale chunks after a new deploy (the running bundle references chunk
 *    hashes that no longer exist on the server): the page is reloaded once so
 *    the browser fetches the fresh index.html + chunk manifest. A sessionStorage
 *    flag prevents an infinite reload loop if the failure is not deploy-related.
 *
 * Without this, a rejected import() throws past <Suspense> (which only handles
 * the pending state) and unmounts the tree, producing a blank screen.
 */
export default function lazyWithRetry(factory, { retries = 2, interval = 400 } = {}) {
  return lazy(async () => {
    try {
      const component = await loadWithRetry(factory, retries, interval);
      // Successful load — clear the guard so future deploys can reload again.
      window.sessionStorage.removeItem(RELOAD_FLAG);
      return component;
    } catch (error) {
      const alreadyReloaded = window.sessionStorage.getItem(RELOAD_FLAG);
      if (!alreadyReloaded) {
        window.sessionStorage.setItem(RELOAD_FLAG, "1");
        window.location.reload();
        // Return a never-resolving promise so React keeps the fallback shown
        // while the page reloads, instead of flashing an error.
        return new Promise(() => {});
      }
      throw error;
    }
  });
}

async function loadWithRetry(factory, retries, interval) {
  try {
    return await factory();
  } catch (error) {
    if (retries <= 0) throw error;
    await new Promise((resolve) => setTimeout(resolve, interval));
    return loadWithRetry(factory, retries - 1, interval);
  }
}
