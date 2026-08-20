export function formatCalories(calories: number): string {
  return Math.round(calories).toLocaleString();
}

export function formatMacro(grams: number): string {
  return grams.toFixed(1);
}

export function formatDate(date: Date): string {
  return date.toISOString().split("T")[0];
}

export function todayString(): string {
  return formatDate(new Date());
}

/**
 * Format seconds into h:mm:ss or m:ss string.
 */
export function formatDurationSeconds(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) {
    return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }
  return `${m}:${String(s).padStart(2, "0")}`;
}

/**
 * Format seconds into a human-readable preset label.
 */
export function formatMinutesLabel(seconds: number): string {
  const m = Math.floor(seconds / 60);
  return `${m}`;
}
