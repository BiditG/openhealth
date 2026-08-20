export function getNepalDate(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kathmandu" });
}

export function getKathmanduTodayStart(): Date {
  const kathmanduDate = new Date().toLocaleDateString("en-CA", {
    timeZone: "Asia/Kathmandu",
  });
  return new Date(`${kathmanduDate}T00:00:00+05:45`);
}
