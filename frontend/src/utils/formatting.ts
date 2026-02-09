/**
 * Universal formatting utilities for chart visualizations
 */

interface Threshold {
  value: number
  color: string
  background?: string
}

interface ValueMapping {
  value: number | string
  text: string
  color?: string
}

type UnitType =
  | 'none'
  | 'short'
  | 'percent'
  | 'percentunit' // value is 0-1, display as percent
  | 'bytes'
  | 'decbytes' // decimal bytes (1KB = 1000B)
  | 'bits'
  | 'seconds'
  | 'milliseconds'
  | 'microseconds'
  | 'nanoseconds'
  | 'hertz'
  | 'datarate' // bytes/s
  | 'temperature_c'
  | 'temperature_f'
  | 'currency_usd'
  | 'currency_eur'
  | 'currency_gbp'

interface FormatOptions {
  unit?: UnitType | string
  decimals?: number
  nullValue?: string
}

// Binary byte suffixes (1KB = 1024B)
const BYTE_UNITS = ['B', 'KB', 'MB', 'GB', 'TB', 'PB']
const BYTE_BASE = 1024

// Decimal byte suffixes (1KB = 1000B)
const DEC_BYTE_UNITS = ['B', 'kB', 'MB', 'GB', 'TB', 'PB']
const DEC_BYTE_BASE = 1000

// Bit suffixes
const BIT_UNITS = ['b', 'Kb', 'Mb', 'Gb', 'Tb']

// Time suffixes (from seconds)
const TIME_UNITS = [
  { unit: 'd', factor: 86400 },
  { unit: 'h', factor: 3600 },
  { unit: 'm', factor: 60 },
  { unit: 's', factor: 1 },
  { unit: 'ms', factor: 0.001 },
  { unit: 'μs', factor: 0.000001 },
  { unit: 'ns', factor: 0.000000001 },
]

// Data rate suffixes
const DATA_RATE_UNITS = ['B/s', 'KB/s', 'MB/s', 'GB/s', 'TB/s']

// Frequency suffixes
const FREQUENCY_UNITS = ['Hz', 'kHz', 'MHz', 'GHz', 'THz']

/**
 * Format a value with the specified unit type and decimal places
 */
export function formatValue(
  value: number | null | undefined,
  options: FormatOptions = {}
): string {
  const { unit = 'none', decimals = 2, nullValue = '-' } = options

  if (value === null || value === undefined || Number.isNaN(value)) {
    return nullValue
  }

  switch (unit) {
    case 'none':
      return formatNumber(value, decimals)

    case 'short':
      return formatShort(value, decimals)

    case 'percent':
      return `${formatNumber(value, decimals)}%`

    case 'percentunit':
      return `${formatNumber(value * 100, decimals)}%`

    case 'bytes':
      return formatBinaryBytes(value, decimals)

    case 'decbytes':
      return formatDecimalBytes(value, decimals)

    case 'bits':
      return formatBits(value, decimals)

    case 'seconds':
      return formatDuration(value, decimals)

    case 'milliseconds':
      return formatDuration(value / 1000, decimals)

    case 'microseconds':
      return formatDuration(value / 1000000, decimals)

    case 'nanoseconds':
      return formatDuration(value / 1000000000, decimals)

    case 'hertz':
      return formatFrequency(value, decimals)

    case 'datarate':
      return formatDataRate(value, decimals)

    case 'temperature_c':
      return `${formatNumber(value, decimals)}°C`

    case 'temperature_f':
      return `${formatNumber(value, decimals)}°F`

    case 'currency_usd':
      return `$${formatNumber(value, decimals)}`

    case 'currency_eur':
      return `€${formatNumber(value, decimals)}`

    case 'currency_gbp':
      return `£${formatNumber(value, decimals)}`

    default:
      // Custom unit - append as suffix
      return `${formatNumber(value, decimals)}${unit ? unit : ''}`
  }
}

/**
 * Format a number with specified decimal places
 */
export function formatNumber(value: number, decimals: number): string {
  return value.toFixed(decimals)
}

/**
 * Format a number with short suffix (K, M, B, T)
 */
export function formatShort(value: number, decimals: number): string {
  const absValue = Math.abs(value)
  const sign = value < 0 ? '-' : ''

  if (absValue >= 1e12) {
    return `${sign}${(absValue / 1e12).toFixed(decimals)}T`
  }
  if (absValue >= 1e9) {
    return `${sign}${(absValue / 1e9).toFixed(decimals)}B`
  }
  if (absValue >= 1e6) {
    return `${sign}${(absValue / 1e6).toFixed(decimals)}M`
  }
  if (absValue >= 1e3) {
    return `${sign}${(absValue / 1e3).toFixed(decimals)}K`
  }
  return `${sign}${absValue.toFixed(decimals)}`
}

/**
 * Format bytes using binary units (1KB = 1024B)
 */
export function formatBinaryBytes(bytes: number, decimals: number): string {
  return formatWithUnits(bytes, BYTE_BASE, BYTE_UNITS, decimals)
}

/**
 * Format bytes using decimal units (1KB = 1000B)
 */
export function formatDecimalBytes(bytes: number, decimals: number): string {
  return formatWithUnits(bytes, DEC_BYTE_BASE, DEC_BYTE_UNITS, decimals)
}

/**
 * Format bits with appropriate units
 */
export function formatBits(bits: number, decimals: number): string {
  return formatWithUnits(bits, 1000, BIT_UNITS, decimals)
}

/**
 * Format data rate (bytes per second)
 */
export function formatDataRate(bytesPerSec: number, decimals: number): string {
  return formatWithUnits(bytesPerSec, 1024, DATA_RATE_UNITS, decimals)
}

/**
 * Format frequency in Hertz
 */
export function formatFrequency(hertz: number, decimals: number): string {
  return formatWithUnits(hertz, 1000, FREQUENCY_UNITS, decimals)
}

/**
 * Format duration from seconds to appropriate unit
 */
export function formatDuration(seconds: number, decimals: number): string {
  const absSeconds = Math.abs(seconds)
  const sign = seconds < 0 ? '-' : ''

  // Find the best unit
  for (const { unit, factor } of TIME_UNITS) {
    if (absSeconds >= factor) {
      return `${sign}${(absSeconds / factor).toFixed(decimals)}${unit}`
    }
  }

  // Very small values - use nanoseconds
  return `${sign}${(absSeconds / 0.000000001).toFixed(decimals)}ns`
}

/**
 * Helper to format with unit suffixes
 */
function formatWithUnits(
  value: number,
  base: number,
  units: string[],
  decimals: number
): string {
  const absValue = Math.abs(value)
  const sign = value < 0 ? '-' : ''

  if (absValue === 0) {
    return `0${units[0]}`
  }

  let unitIndex = 0
  let scaledValue = absValue

  while (scaledValue >= base && unitIndex < units.length - 1) {
    scaledValue /= base
    unitIndex++
  }

  return `${sign}${scaledValue.toFixed(decimals)}${units[unitIndex]}`
}

/**
 * Apply thresholds to get the appropriate color for a value
 */
export function applyThresholds(
  value: number,
  thresholds: Threshold[],
  defaultColor: string = '#f5f5f5'
): { color: string; background?: string } {
  if (!thresholds || thresholds.length === 0) {
    return { color: defaultColor }
  }

  // Sort thresholds by value ascending
  const sortedThresholds = [...thresholds].sort((a, b) => a.value - b.value)

  let result = { color: defaultColor, background: undefined as string | undefined }

  // Find the highest threshold that is <= the value
  for (const threshold of sortedThresholds) {
    if (value >= threshold.value) {
      result = {
        color: threshold.color,
        background: threshold.background,
      }
    }
  }

  return result
}

/**
 * Apply value mappings to convert values to text
 */
export function applyMappings(
  value: number | string,
  mappings: ValueMapping[]
): { text: string; color?: string } | null {
  if (!mappings || mappings.length === 0) {
    return null
  }

  // Find exact match
  for (const mapping of mappings) {
    if (mapping.value === value) {
      return { text: mapping.text, color: mapping.color }
    }
    // Handle numeric string comparison
    if (typeof mapping.value === 'string' && String(value) === mapping.value) {
      return { text: mapping.text, color: mapping.color }
    }
  }

  return null
}

/**
 * Format a value with all formatting options applied
 */
export function formatDisplayValue(
  value: number | null | undefined,
  options: {
    unit?: UnitType | string
    decimals?: number
    nullValue?: string
    mappings?: ValueMapping[]
  } = {}
): { text: string; mapped: boolean } {
  const { unit, decimals, nullValue, mappings } = options

  if (value === null || value === undefined || Number.isNaN(value)) {
    return { text: nullValue || '-', mapped: false }
  }

  // Check for value mappings first
  if (mappings && mappings.length > 0) {
    const mapping = applyMappings(value, mappings)
    if (mapping) {
      return { text: mapping.text, mapped: true }
    }
  }

  // Fall back to formatted value
  return { text: formatValue(value, { unit, decimals }), mapped: false }
}
