// Server-safe locale configuration (no browser APIs)
// Used by middleware, layouts, and server components

export const defaultLocale = "en" as const;
export const locales = ["en"] as const;
export type Locale = (typeof locales)[number];

export function isValidLocale(locale: string): locale is Locale {
  return (locales as readonly string[]).includes(locale);
}

/**
 * Get the path prefix for a locale.
 * English is the only public locale, so public links stay unprefixed.
 */
export function getLocalePrefix(locale: Locale): string {
  void locale;
  return "";
}
