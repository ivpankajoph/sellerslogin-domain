"use client";

import { useCallback, useEffect, useState } from "react";
import { domainApi } from "./domain-api";

type CacheEntry = { value: unknown; expiresAt: number };
const cache = new Map<string, CacheEntry>();
const pending = new Map<string, Promise<unknown>>();

const cacheKey = (token: string, path: string) => `${token.slice(-12)}:${path}`;

export function clearDomainResource(pathPrefix = "") {
  for (const key of cache.keys()) if (!pathPrefix || key.includes(pathPrefix)) cache.delete(key);
}

export function useDomainResource<T>(token: string, path: string, ttlMs = 30_000) {
  const key = cacheKey(token, path);
  const initial = cache.get(key);
  const [data, setData] = useState<T | null>(() => initial && initial.expiresAt > Date.now() ? initial.value as T : null);
  const [loading, setLoading] = useState(!data);
  const [error, setError] = useState("");
  const [version, setVersion] = useState(0);
  const reload = useCallback(() => { cache.delete(key); setVersion((value) => value + 1); }, [key]);

  useEffect(() => {
    let active = true;
    if (!path) {
      return () => { active = false; };
    }
    const cached = cache.get(key);
    if (cached && cached.expiresAt > Date.now()) {
      queueMicrotask(() => { if (active) { setData(cached.value as T); setLoading(false); setError(""); } });
      return () => { active = false; };
    }
    queueMicrotask(() => { if (active) { setLoading(true); setError(""); } });
    const request = (pending.get(key) as Promise<T> | undefined) || domainApi<T>(token, path);
    pending.set(key, request);
    request.then((value) => {
      if (ttlMs > 0) cache.set(key, { value, expiresAt: Date.now() + ttlMs });
      if (active) setData(value);
    }).catch((cause) => {
      if (active) setError(cause instanceof Error ? cause.message : "This information could not be loaded. Please try again.");
    }).finally(() => {
      pending.delete(key);
      if (active) setLoading(false);
    });
    return () => { active = false; };
  }, [key, path, token, ttlMs, version]);

  return { data, loading, error, reload };
}
