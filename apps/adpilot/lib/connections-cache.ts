"use client";

import * as React from "react";

import type { SafeAccountConnection } from "@/lib/connections";

type ConnectionsCache = {
  connections: SafeAccountConnection[] | null;
  /** In-flight fetch shared across subscribers. */
  promise: Promise<SafeAccountConnection[]> | null;
};

let cache: ConnectionsCache = {
  connections: null,
  promise: null,
};

const listeners = new Set<() => void>();

function notify() {
  for (const listener of listeners) {
    listener();
  }
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

async function fetchConnectionsFromApi(): Promise<SafeAccountConnection[]> {
  const response = await fetch("/api/connections");
  if (!response.ok) {
    throw new Error("Failed to load connections");
  }
  const payload = (await response.json()) as {
    connections?: SafeAccountConnection[];
  };
  return payload.connections ?? [];
}

/**
 * Returns cached connections when available. Pass `{ force: true }` to bypass
 * the cache (e.g. after OAuth redirect or disconnect).
 */
export async function loadConnections(options?: {
  force?: boolean;
}): Promise<SafeAccountConnection[]> {
  if (!options?.force && cache.connections) {
    return cache.connections;
  }

  if (!options?.force && cache.promise) {
    return cache.promise;
  }

  const promise = fetchConnectionsFromApi()
    .then((connections) => {
      cache.connections = connections;
      notify();
      return connections;
    })
    .finally(() => {
      if (cache.promise === promise) {
        cache.promise = null;
      }
    });

  cache.promise = promise;
  return promise;
}

export function getCachedConnections(): SafeAccountConnection[] | null {
  return cache.connections;
}

export function setCachedConnections(connections: SafeAccountConnection[]) {
  cache.connections = connections;
  notify();
}

/** Drop a connection from the cache after a successful disconnect. */
export function removeCachedConnection(provider: string, service: string) {
  if (!cache.connections) return;
  cache.connections = cache.connections.filter(
    (connection) =>
      !(connection.provider === provider && connection.service === service),
  );
  notify();
}

export function invalidateConnectionsCache() {
  cache = { connections: null, promise: null };
  notify();
}

export function useConnections(options?: { revalidate?: boolean }) {
  const revalidate = options?.revalidate ?? true;
  const [connections, setConnections] = React.useState<SafeAccountConnection[]>(
    () => cache.connections ?? [],
  );
  const [loading, setLoading] = React.useState(() => cache.connections === null);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    return subscribe(() => {
      setConnections(cache.connections ?? []);
      if (cache.connections !== null) {
        setLoading(false);
      }
    });
  }, []);

  React.useEffect(() => {
    let cancelled = false;

    void (async () => {
      const hasCache = cache.connections !== null;

      if (hasCache) {
        setConnections(cache.connections ?? []);
        setLoading(false);
        if (!revalidate) return;
        try {
          await loadConnections({ force: true });
          if (!cancelled) {
            setConnections(cache.connections ?? []);
            setError(null);
          }
        } catch (err) {
          if (!cancelled) {
            setError(
              err instanceof Error ? err.message : "Failed to load connections",
            );
          }
        }
        return;
      }

      setLoading(true);
      try {
        const next = await loadConnections();
        if (!cancelled) {
          setConnections(next);
          setError(null);
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : "Failed to load connections",
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [revalidate]);

  const refetch = React.useCallback(async () => {
    setLoading(cache.connections === null);
    try {
      const next = await loadConnections({ force: true });
      setConnections(next);
      setError(null);
      return next;
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to load connections",
      );
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    connections,
    /** True only when there is no cached data to show yet. */
    loading,
    error,
    refetch,
  };
}
