/**
 * Escapes a string value for inclusion in a CSV field.
 *
 * If the value contains commas, double-quotes, or newlines, it is wrapped in
 * double-quotes and any internal double-quotes are escaped as `""`.
 * Otherwise the value is returned as-is.
 *
 * Requirements: 4.8
 */
export function csvEscape(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n') || value.includes('\r')) {
    return '"' + value.replace(/"/g, '""') + '"'
  }
  return value
}
