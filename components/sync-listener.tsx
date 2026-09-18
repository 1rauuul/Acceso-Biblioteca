"use client";

import { useEffect } from "react";
import { syncWithServer } from "@/lib/idb";

/**
 * Pushes pending records/surveys to the server when:
 *   1. The app mounts (covers data left over from an offline session).
 *   2. The browser regains network connectivity ("online" event).
 *   3. The app becomes visible again ("visibilitychange"), e.g. the user
 *      switches back to the PWA after being offline.
 * Errors are swallowed: the data stays local and we retry on the next
 * trigger (plus the explicit syncs after entry/exit/survey/registro).
 */
export function SyncListener() {
  useEffect(() => {
    function trySync() {
      if (!navigator.onLine) return;
      syncWithServer().catch(() => {});
    }

    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") trySync();
    };

    window.addEventListener("online", trySync);
    document.addEventListener("visibilitychange", onVisibilityChange);

    trySync();

    return () => {
      window.removeEventListener("online", trySync);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, []);

  return null;
}
