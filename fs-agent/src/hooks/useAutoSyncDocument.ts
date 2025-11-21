import { useCallback, useEffect, useRef, useState } from "react";

export type AutoSaveStatus = "idle" | "saving" | "saved" | "offline" | "error";

export type AutoSaveState = {
  status: AutoSaveStatus;
  lastSavedAt: string | null;
  error: string | null;
  retryCount: number;
};

type UseAutoSyncDocumentOptions = {
  documentId: string;
  content: string;
  saveEndpoint: string;
  debounceMs?: number;
  maxRetries?: number;
  onStatusChange?: (status: AutoSaveStatus) => void;
  onSaveComplete?: (savedAt: string) => void;
  onSaveError?: (error: string) => void;
};

const DEFAULT_DEBOUNCE_MS = 1500;
const DEFAULT_MAX_RETRIES = 5;
const RETRY_BACKOFF_MS = 1000;

// IndexedDB helper for offline persistence
const DB_NAME = "autosave_db";
const STORE_NAME = "pending_saves";
const DB_VERSION = 1;

async function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "id" });
      }
    };
  });
}

async function savePendingToDB(
  documentId: string,
  content: string,
): Promise<void> {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    await store.put({
      id: documentId,
      content,
      timestamp: Date.now(),
    });
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (error) {
    console.error("[autosave] Failed to save to IndexedDB:", error);
  }
}

async function removePendingFromDB(documentId: string): Promise<void> {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    await store.delete(documentId);
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (error) {
    console.error("[autosave] Failed to remove from IndexedDB:", error);
  }
}

async function loadPendingFromDB(
  documentId: string,
): Promise<string | null> {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, "readonly");
    const store = tx.objectStore(STORE_NAME);
    const result = await store.get(documentId);
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    if (result && typeof result === 'object' && 'content' in result) {
      return (result as { content: string }).content || null;
    }
    return null;
  } catch (error) {
    console.error("[autosave] Failed to load from IndexedDB:", error);
    return null;
  }
}

export function useAutoSyncDocument({
  documentId,
  content,
  saveEndpoint,
  debounceMs = DEFAULT_DEBOUNCE_MS,
  maxRetries = DEFAULT_MAX_RETRIES,
  onStatusChange,
  onSaveComplete,
  onSaveError,
}: UseAutoSyncDocumentOptions) {
  const [state, setState] = useState<AutoSaveState>({
    status: "idle",
    lastSavedAt: null,
    error: null,
    retryCount: 0,
  });

  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const saveInProgressRef = useRef(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  const previousContentRef = useRef<string>(content);

  // Check online status
  const isOnline = typeof navigator !== "undefined" && navigator.onLine;

  const performSave = useCallback(
    async (contentToSave: string, retryCount = 0): Promise<void> => {
      if (saveInProgressRef.current) {
        // Queue this save for after the current one completes
        return;
      }

      saveInProgressRef.current = true;
      setState((prev) => ({ ...prev, status: "saving", error: null }));
      onStatusChange?.("saving");

      // Save to IndexedDB as backup
      await savePendingToDB(documentId, contentToSave);

      const controller = new AbortController();
      abortControllerRef.current = controller;

      try {
        const response = await fetch(saveEndpoint, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            content_html: contentToSave,
            content_text: stripHtml(contentToSave),
          }),
          signal: controller.signal,
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(
            errorData.error || `Save failed: ${response.statusText}`,
          );
        }

        const data = await response.json();
        const savedAt = data.last_auto_saved_at || new Date().toISOString();

        // Remove from IndexedDB on success
        await removePendingFromDB(documentId);

        setState({
          status: "saved",
          lastSavedAt: savedAt,
          error: null,
          retryCount: 0,
        });
        onStatusChange?.("saved");
        onSaveComplete?.(savedAt);

        // Reset to idle after 3 seconds
        setTimeout(() => {
          setState((prev) => {
            if (prev.status === "saved") {
              return { ...prev, status: "idle" };
            }
            return prev;
          });
        }, 3000);
      } catch (error) {
        if (controller.signal.aborted) {
          // Save was cancelled, ignore
          return;
        }

        const errorMessage =
          error instanceof Error ? error.message : "Unknown error";
        const isNetworkError =
          error instanceof TypeError || !navigator.onLine;

        if (isNetworkError && retryCount < maxRetries) {
          // Retry with backoff
          const backoffMs = RETRY_BACKOFF_MS * Math.pow(2, retryCount);
          setState((prev) => ({
            ...prev,
            status: "offline",
            error: `Retrying... (${retryCount + 1}/${maxRetries})`,
            retryCount: retryCount + 1,
          }));
          onStatusChange?.("offline");

          await new Promise((resolve) => setTimeout(resolve, backoffMs));
          return performSave(contentToSave, retryCount + 1);
        }

        // Max retries reached or non-network error
        setState({
          status: retryCount >= maxRetries ? "error" : "offline",
          lastSavedAt: state.lastSavedAt,
          error: errorMessage,
          retryCount,
        });
        onStatusChange?.(retryCount >= maxRetries ? "error" : "offline");
        onSaveError?.(errorMessage);

        // Show toast for persistent errors
        if (retryCount >= maxRetries - 1) {
          console.error("[autosave] Failed after retries:", errorMessage);
        }
      } finally {
        saveInProgressRef.current = false;
        abortControllerRef.current = null;
      }
    },
    [
      documentId,
      saveEndpoint,
      maxRetries,
      state.lastSavedAt,
      onStatusChange,
      onSaveComplete,
      onSaveError,
    ],
  );

  // Debounced save trigger
  useEffect(() => {
    if (content === previousContentRef.current) {
      return;
    }

    previousContentRef.current = content;

    // Clear existing timer
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    // Set new timer
    debounceTimerRef.current = setTimeout(() => {
      if (content !== previousContentRef.current) {
        // Content changed during debounce, skip this save
        return;
      }
      performSave(content);
    }, debounceMs);

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [content, debounceMs, performSave]);

  // Check online status
  useEffect(() => {
    const handleOnline = () => {
      if (state.status === "offline" && previousContentRef.current) {
        // Retry save when coming back online
        performSave(previousContentRef.current, state.retryCount);
      }
    };

    const handleOffline = () => {
      setState((prev) => ({ ...prev, status: "offline" }));
      onStatusChange?.("offline");
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [state.status, state.retryCount, performSave, onStatusChange]);

  // Load pending saves on mount
  useEffect(() => {
    loadPendingFromDB(documentId).then((pendingContent) => {
      if (pendingContent && pendingContent !== content) {
        // There's unsaved content, retry save
        performSave(pendingContent, 0);
      }
    });
  }, [documentId]); // Only run on mount

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  // Manual save trigger (for navigation safety)
  const forceSave = useCallback(async (): Promise<void> => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    await performSave(content, 0);
  }, [content, performSave]);

  return {
    ...state,
    isSaving: state.status === "saving",
    forceSave,
  };
}

function stripHtml(html: string): string {
  if (typeof document === "undefined") {
    // Server-side fallback
    return html.replace(/<[^>]*>/g, "").trim();
  }
  const div = document.createElement("div");
  div.innerHTML = html;
  return div.textContent || div.innerText || "";
}

