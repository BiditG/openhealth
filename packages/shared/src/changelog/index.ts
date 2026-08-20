export interface ChangelogEntry {
  /** Semver-style version string, e.g. "1.5.0" */
  version: string;
  /** ISO date string, e.g. "2026-03-28" */
  date: string;
  /** Title keyed by locale */
  title: Record<string, string>;
  /** List of feature items */
  items: {
    emoji: string;
    text: Record<string, string>;
  }[];
}

/**
 * Changelog entries, ordered newest-first.
 *
 * === HOW TO ADD A NEW RELEASE ===
 * 1. Add a new entry at the TOP of this array
 * 2. Bump the version string
 * 3. Commit & deploy — users will see the modal on next visit
 */
export const CHANGELOG: ChangelogEntry[] = [
  {
    version: "1.5.0",
    date: "2026-03-28",
    title: { en: "New Features 🎉" },
    items: [
      {
        emoji: "📊",
        text: {
          en: "Feature Hub — overview of all health tracking features",
        },
      },
      {
        emoji: "🧘",
        text: {
          en: "Meditation timer — track your mindfulness practice",
        },
      },
      {
        emoji: "🏋️",
        text: {
          en: "Workout log — custom exercise templates & set tracking",
        },
      },
      {
        emoji: "💤",
        text: {
          en: "Sleep tracking — log sleep duration & quality",
        },
      },
    ],
  },
];

export function getLatestVersion(): string {
  return CHANGELOG[0]?.version ?? "0.0.0";
}

export function getUnseenEntries(
  lastSeenVersion: string | null
): ChangelogEntry[] {
  if (!lastSeenVersion) return CHANGELOG.slice(0, 3);
  if (lastSeenVersion === CHANGELOG[0]?.version) return [];
  const idx = CHANGELOG.findIndex((e) => e.version === lastSeenVersion);
  if (idx === -1) return CHANGELOG.slice(0, 3); // unknown version, show recent
  return CHANGELOG.slice(0, idx);
}
