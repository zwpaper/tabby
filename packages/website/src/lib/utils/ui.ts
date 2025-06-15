import moment from "moment";

/**
 * Formats a timestamp into a human-readable relative time string.
 *
 * - If the time is within the last month, it returns a string like "a few seconds ago", "2 hours ago", etc.
 * - If the time is within the last year but older than a month, it returns a string like "on Jan 1".
 * - If the time is older than a year, it returns a string like "on Jan 1, 2023".
 *
 * @param time The timestamp to format, in a format that moment() can parse.
 * @param prefix A string to prepend to the formatted time string.
 * @returns The formatted relative time string.
 */
export function formatRelativeTime(time: string, prefix: string) {
  const targetTime = moment(time);

  if (targetTime.isBefore(moment().subtract(1, "year"))) {
    const timeText = targetTime.format("MMM D, YYYY");
    return `${prefix} on ${timeText}`;
  }

  if (targetTime.isBefore(moment().subtract(1, "month"))) {
    const timeText = targetTime.format("MMM D");
    return `${prefix} on ${timeText}`;
  }

  return `${prefix} ${targetTime.fromNow()}`;
}
