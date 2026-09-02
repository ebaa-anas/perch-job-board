"use client";

import * as React from "react";

import {
  SAVED_JOBS_STORAGE_KEY,
  readSavedIds,
  writeSavedIds,
} from "@/features/saved-jobs/storage";

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
}: {
  children: React.ReactNode;
}) {
  // Starts empty so the server HTML and the first client render agree; the real
  // list is revealed after mount (see `hydrated`), which also avoids a
  // bookmark-icon hydration mismatch.
  const [savedIds, setSavedIds] = React.useState<string[]>([]);
  const [hydrated, setHydrated] = React.useState(false);

  React.useEffect(() => {
    // One-time hydration from localStorage + subscription to cross-tab changes.
    // The post-mount setState is intentional: it keeps the SSR markup stable and
    // only then reveals this device's saved list.
    /* eslint-disable react-hooks/set-state-in-effect */
    setSavedIds(readSavedIds());
    setHydrated(true);
    /* eslint-enable react-hooks/set-state-in-effect */

    const onStorage = (event: StorageEvent) => {
      if (event.key === SAVED_JOBS_STORAGE_KEY) {
        setSavedIds(readSavedIds());
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const commit = React.useCallback((next: string[]) => {
    setSavedIds(next);
    writeSavedIds(next);
  }, []);

  const isSaved = React.useCallback(
    (jobId: string) => savedIds.includes(jobId),
    [savedIds],
  );

  const toggle = React.useCallback(
    (jobId: string) => {
      commit(
        savedIds.includes(jobId)
          ? savedIds.filter((id) => id !== jobId)
          : [jobId, ...savedIds],
      );
    },
    [savedIds, commit],
  );

  const remove = React.useCallback(
    (jobId: string) => commit(savedIds.filter((id) => id !== jobId)),
    [savedIds, commit],
  );

  const clear = React.useCallback(() => commit([]), [commit]);

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
