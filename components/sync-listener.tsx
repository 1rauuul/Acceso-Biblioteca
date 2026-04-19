"use client";

import { useEffect } from "react";
import { syncWithServer } from "@/lib/idb";

/**
 * Listens for:
 *   1. Background Sync pings from the Service Worker (postMessage).
 *   2. The window regaining network connectivity ("online" event).
 * In both cases we ask IndexedDB to push any pending records/surveys to
 * the server. Errors are swallowed: the data stays local and we will
 * retry on the next trigger.
 */
export function SyncListener() {
  useEffect(() => {
    function trySync() {
      if (!navigator.onLine) return;
      syncWithServer().catch(() => {});
    }

    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === "sync-records") {
        trySync();
      }
    };

    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.addEventListener("message", handleMessage);
    }
    window.addEventListener("online", trySync);

    // Attempt an initial sync on mount in case we had pending data
    // from a previous offline session.
    trySync();

    return () => {
      if ("serviceWorker" in navigator) {
        navigator.serviceWorker.removeEventListener("message", handleMessage);
      }
      window.removeEventListener("online", trySync);
    };
  }, []);

  return null;
}
