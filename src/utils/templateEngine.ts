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

// Virtual variables derived from lead data
const VIRTUAL_FIELDS: Record<string, (lead: Lead) => string> = {
  primeiro_nome: (lead) => {
    const decisor = lead['decisor']
    if (!decisor) return ''
    return toTitleCase(String(decisor).trim().split(/\s+/)[0] ?? '')
  },
}

/**
 * Replace {variable} placeholders in template with lead data.
 * Missing values become empty string.
 * Text fields are auto-formatted from UPPERCASE to Title Case.
 * Supports virtual variables like {primeiro_nome} (first name from decisor).
 * Collapses extra spaces left by empty variables.
 */
export function replaceVariables(template: string, lead: Lead): string {
  const result = template.replace(/\{(\w+)\}/g, (_match: string, key: string) => {
    // Check virtual fields first
    const virtualFn = VIRTUAL_FIELDS[key]
    if (virtualFn) return virtualFn(lead)

    const value = lead[key]
    if (value === undefined || value === '') return ''
    if (TITLE_CASE_FIELDS.has(key)) return toTitleCase(String(value))
    return String(value)
  })
  // Collapse multiple spaces (from empty variables) and trim
  return result.replace(/ {2,}/g, ' ').trim()
}

/**
 * Extract all {variable} names from a template string.
 */
export function extractVariables(template: string): string[] {
  const matches: string[] = []
  const regex = /\{(\w+)\}/g
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
