import type { Lead } from "../types/Lead";

/**
 * Replace {variable} placeholders in template with lead data.
 * Missing values become empty string.
 */
export function replaceVariables(template: string, lead: Lead): string {
  return template.replace(/\{(\w+)\}/g, (_match: string, key: string) => {
    const value = lead[key];
    if (value === undefined || value === null || value === "") return "";
    return String(value);
  });
}

/**
 * Extract all {variable} names from a template string.
 */
export function extractVariables(template: string): string[] {
  const matches: string[] = [];
  const regex = /\{(\w+)\}/g;
  let m: RegExpExecArray | null;
  while ((m = regex.exec(template)) !== null) {
    if (m[1]) matches.push(m[1]);
  }
  return [...new Set(matches)];
}

/**
 * Format a phone number for WhatsApp: strip non-digits, prepend country code.
 */
export function formatPhone(phone: string, countryCode = "55"): string {
  const digits = phone.replace(/\D/g, "");
  if (!digits) return "";
  if (digits.startsWith(countryCode)) return digits;
  return countryCode + digits;
}
