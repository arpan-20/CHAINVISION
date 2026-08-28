/**
 * Indian rupee formatting + money helpers used across the dashboard.
 * All numbers in CHAINVISION flow as raw numbers; this gives the human-
 * readable ₹ Cr / L / K / plain form the Cognizant supply chain audience
 * expects (the seed data already uses ₹ costs).
 */

/** Compact form: ₹1.2L, ₹4.5Cr, ₹860, ₹5, etc. */
export function formatINR(value: number, options: { compact?: boolean; decimals?: number } = {}): string {
  const { compact = true, decimals = 1 } = options
  if (value == null || Number.isNaN(value)) return '—'
  const abs = Math.abs(value)
  const sign = value < 0 ? '-' : ''
  if (!compact) {
    return `${sign}₹${abs.toLocaleString('en-IN')}`
  }
  if (abs >= 10_000_000) return `${sign}₹${(abs / 10_000_000).toFixed(decimals)} Cr`
  if (abs >= 100_000)    return `${sign}₹${(abs / 100_000).toFixed(decimals)} L`
  if (abs >= 1_000)      return `${sign}₹${(abs / 1_000).toFixed(decimals)}K`
  return `${sign}₹${abs.toLocaleString('en-IN')}`
}

/** Always full form: ₹86,800 — never Cr / L. Use for small amounts that need precision. */
export function formatINRFull(value: number): string {
  if (value == null || Number.isNaN(value)) return '—'
  return `₹${Math.round(value).toLocaleString('en-IN')}`
}

/** Sum of an array of {unitCost, quantity} style items. */
export function totalValue(items: Array<{ unitCost?: number; quantity?: number }>): number {
  return items.reduce((sum, it) => sum + (it.unitCost ?? 0) * (it.quantity ?? 0), 0)
}
