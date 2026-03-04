import type { Lead } from '../types/Lead'
import { toTitleCase } from '../types/Lead'

const TITLE_CASE_FIELDS = new Set([
  'nome_fantasia',
  'decisor',
  'cargo',
  'segmento',
  'razao_social',
  'cidade',
  'bairro',
  'endereco',
])

/**
 * Modifiers that can be applied to any variable via pipe syntax: {field|modifier}
 * - first: extracts the first word (e.g. "João Silva" → "João")
 * - upper: converts to UPPERCASE
 * - lower: converts to lowercase
 */
const MODIFIERS: Record<string, (value: string) => string> = {
  first: (v) => v.trim().split(/\s+/)[0] ?? '',
  upper: (v) => v.toUpperCase(),
  lower: (v) => v.toLowerCase(),
}

/**
 * Replace {variable} and {variable|modifier} placeholders in template with lead data.
 * Missing values become empty string.
 * Text fields are auto-formatted from UPPERCASE to Title Case.
 * Collapses extra spaces left by empty variables.
 *
 * Examples:
 *   {decisor}        → "João Silva" (title case)
 *   {decisor|first}  → "João" (first word only)
 *   {cidade|upper}   → "SÃO PAULO"
 */
export function replaceVariables(template: string, lead: Lead): string {
  const result = template.replace(/\{(\w+)(?:\|(\w+))?\}/g, (_match, key: string, mod?: string) => {
    const rawValue = lead[key]
    if (rawValue === undefined || rawValue === '') return ''

    let value = String(rawValue)

    // Apply title case for known text fields (before modifier)
    if (TITLE_CASE_FIELDS.has(key)) value = toTitleCase(value)

    // Apply modifier if present
    if (mod) {
      const modFn = MODIFIERS[mod]
      if (modFn) value = modFn(value)
    }

    return value
  })
  // Collapse multiple spaces (from empty variables) and trim
  return result.replace(/ {2,}/g, ' ').trim()
}

/**
 * Extract all {variable} names from a template string (ignores modifiers).
 */
export function extractVariables(template: string): string[] {
  const matches: string[] = []
  const regex = /\{(\w+)(?:\|\w+)?\}/g
  let m: RegExpExecArray | null
  while ((m = regex.exec(template)) !== null) {
    if (m[1]) matches.push(m[1])
  }
  return [...new Set(matches)]
}

/**
 * Format a phone number for WhatsApp: strip non-digits, prepend country code.
 */
export function formatPhone(phone: string, countryCode = '55'): string {
  const digits = phone.replace(/\D/g, '')
  if (!digits) return ''
  if (digits.startsWith(countryCode)) return digits
  return countryCode + digits
}
