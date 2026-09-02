"use client";

import * as React from "react";

import {
  SAVED_JOBS_STORAGE_KEY,
  readSavedIds,
  writeSavedIds,
} from "@/features/saved-jobs/storage";
import {
  mergeGuestSavedJobs,
  saveJob,
  unsaveJob,
} from "@/features/saved-jobs/actions";

interface SavedJobsContextValue {
  /** Job ids, most recently saved first. */
  savedIds: string[];
  count: number;
  hydrated: boolean;
  isSaved: (jobId: string) => boolean;
  toggle: (jobId: string) => void;
  remove: (jobId: string) => void;
  clear: () => void;
}

const SavedJobsContext = React.createContext<SavedJobsContextValue | null>(null);

export function SavedJobsProvider({
  children,
  authedSeeker = false,
  serverIds = [],
}: {
  children: React.ReactNode;
  authedSeeker?: boolean;
  serverIds?: string[];
}) {
  // Starts empty so the server HTML and the first client render agree; the real
  // list is revealed after mount (see `hydrated`).
  const [savedIds, setSavedIds] = React.useState<string[]>([]);
  const [hydrated, setHydrated] = React.useState(false);

  // Stable primitive key so the hydration effect runs once per identity change,
  // not on every render (the array prop is a fresh reference each server render).
  const serverKey = serverIds.join(",");

  React.useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
    let cancelled = false;

    if (authedSeeker) {
      // Account-backed: fold any guest saves in, then use the DB list.
      const guestIds = readSavedIds();
      const finish = (ids: string[]) => {
        if (cancelled) return;
        setSavedIds(ids);
        setHydrated(true);
      };
      if (guestIds.length > 0) {
        mergeGuestSavedJobs(guestIds)
          .then((merged) => {
            writeSavedIds([]);
            finish(merged);
          })
          .catch(() => finish(serverIds));
      } else {
        finish(serverIds);
      }
      return () => {
        cancelled = true;
      };
    }

    // Guest: localStorage + cross-tab sync.
    setSavedIds(readSavedIds());
    setHydrated(true);
    const onStorage = (event: StorageEvent) => {
      if (event.key === SAVED_JOBS_STORAGE_KEY) setSavedIds(readSavedIds());
    };
    window.addEventListener("storage", onStorage);
    return () => {
      cancelled = true;
      window.removeEventListener("storage", onStorage);
    };
    /* eslint-enable react-hooks/set-state-in-effect */
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authedSeeker, serverKey]);

  const persistGuest = React.useCallback(
    (next: string[]) => {
      setSavedIds(next);
      if (!authedSeeker) writeSavedIds(next);
    },
    [authedSeeker],
  );

  const isSaved = React.useCallback(
    (jobId: string) => savedIds.includes(jobId),
    [savedIds],
  );

  const toggle = React.useCallback(
    (jobId: string) => {
      const has = savedIds.includes(jobId);
      const next = has
        ? savedIds.filter((id) => id !== jobId)
        : [jobId, ...savedIds];

      if (!authedSeeker) {
        persistGuest(next);
        return;
      }

      // Account-backed: optimistic, revert on failure.
      const prev = savedIds;
      setSavedIds(next);
      const action = has ? unsaveJob(jobId) : saveJob(jobId);
      action
        .then((r) => {
          if (!r.ok) setSavedIds(prev);
        })
        .catch(() => setSavedIds(prev));
    },
    [savedIds, authedSeeker, persistGuest],
  );

  const remove = React.useCallback(
    (jobId: string) => {
      if (!savedIds.includes(jobId)) return;
      toggle(jobId);
    },
    [savedIds, toggle],
  );

  const clear = React.useCallback(() => {
    if (!authedSeeker) {
      persistGuest([]);
      return;
    }
    const prev = savedIds;
    setSavedIds([]);
    Promise.all(prev.map((id) => unsaveJob(id))).catch(() => setSavedIds(prev));
  }, [authedSeeker, persistGuest, savedIds]);

  const value = React.useMemo<SavedJobsContextValue>(
    () => ({
      savedIds,
      count: savedIds.length,
      hydrated,
      isSaved,
      toggle,
      remove,
      clear,
    }),
    [savedIds, hydrated, isSaved, toggle, remove, clear],
  );

  return (
    <SavedJobsContext.Provider value={value}>
      {children}
    </SavedJobsContext.Provider>
  );
}

export function useSavedJobs(): SavedJobsContextValue {
  const context = React.useContext(SavedJobsContext);
  if (!context) {
    throw new Error("useSavedJobs must be used within a SavedJobsProvider");
  }
  return context;
}
