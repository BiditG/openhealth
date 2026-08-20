"use client";

/**
 * Returns a locale-aware path for public pages.
 * English is the only public locale, so links stay unprefixed.
 *
 * Only use for links between public pages (landing, blog, docs, privacy).
 * Dashboard routes (/hub, /settings) don't need locale prefix.
 */
export function useLocalePath() {
  return (path: string): string => {
    return path;
  };
}
