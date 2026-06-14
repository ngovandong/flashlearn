import { useEffect, useState } from "react";
import {
  isExtensionInstalled,
  isChromiumBrowser,
} from "@utils/detectExtension";

// Returns the install state of the Flashlearn browser extension.
//   null    -> still checking
//   true    -> installed (or not a Chromium browser, so we shouldn't nag)
//   false   -> Chromium browser without the extension
export function useExtensionInstalled() {
  const [installed, setInstalled] = useState(null);

  useEffect(() => {
    if (!isChromiumBrowser()) {
      // Treat non-Chromium as "installed" so the reminder stays hidden.
      setInstalled(true);
      return;
    }

    let active = true;
    isExtensionInstalled().then((result) => {
      if (active) setInstalled(result);
    });
    return () => {
      active = false;
    };
  }, []);

  return installed;
}
