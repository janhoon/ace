import { describe, it, expect } from 'vitest'
import {
  formatValue,
  formatNumber,
  formatShort,
  formatBinaryBytes,
  formatDecimalBytes,
  formatBits,
  formatDataRate,
  formatFrequency,
  formatDuration,
  applyThresholds,
  applyMappings,
  formatDisplayValue,
} from './formatting'

describe('formatNumber', () => {
  it('formats numbers with specified decimals', () => {
    expect(formatNumber(Math.PI, 2)).toBe('3.14')
    expect(formatNumber(Math.PI, 4)).toBe('3.1416')
    expect(formatNumber(100, 0)).toBe('100')
    expect(formatNumber(100, 2)).toBe('100.00')
  })

  it('handles negative numbers', () => {
    expect(formatNumber(-Math.PI, 2)).toBe('-3.14')
  })

  it('handles zero', () => {
    expect(formatNumber(0, 2)).toBe('0.00')
  })
})

describe('formatShort', () => {
  it('formats thousands with K suffix', () => {
    expect(formatShort(1000, 2)).toBe('1.00K')
    expect(formatShort(1500, 1)).toBe('1.5K')
    expect(formatShort(999999, 0)).toBe('1000K')
  })

  it('formats millions with M suffix', () => {
    expect(formatShort(1000000, 2)).toBe('1.00M')
    expect(formatShort(1500000, 1)).toBe('1.5M')
  })

  it('formats billions with B suffix', () => {
    expect(formatShort(1000000000, 2)).toBe('1.00B')
    expect(formatShort(2500000000, 1)).toBe('2.5B')
  })

  it('formats trillions with T suffix', () => {
    expect(formatShort(1000000000000, 2)).toBe('1.00T')
  })

  it('handles small values without suffix', () => {
    expect(formatShort(999, 0)).toBe('999')
    expect(formatShort(100, 2)).toBe('100.00')
  })

  it('handles negative values', () => {
    expect(formatShort(-1500, 1)).toBe('-1.5K')
    expect(formatShort(-2500000, 1)).toBe('-2.5M')
  })
})

describe('formatBinaryBytes', () => {
  it('formats bytes correctly', () => {
    expect(formatBinaryBytes(0, 2)).toBe('0B')
    expect(formatBinaryBytes(500, 0)).toBe('500B')
    expect(formatBinaryBytes(1023, 0)).toBe('1023B')
  })

  it('formats kilobytes correctly (1KB = 1024B)', () => {
    expect(formatBinaryBytes(1024, 2)).toBe('1.00KB')
    expect(formatBinaryBytes(1536, 1)).toBe('1.5KB')
  })

  it('formats megabytes correctly (1MB = 1048576B)', () => {
    expect(formatBinaryBytes(1048576, 2)).toBe('1.00MB')
    expect(formatBinaryBytes(1572864, 1)).toBe('1.5MB')
  })

  it('formats gigabytes correctly', () => {
    expect(formatBinaryBytes(1073741824, 2)).toBe('1.00GB')
  })

  it('formats terabytes correctly', () => {
    expect(formatBinaryBytes(1099511627776, 2)).toBe('1.00TB')
  })
})

describe('formatDecimalBytes', () => {
  it('formats kilobytes correctly (1kB = 1000B)', () => {
    expect(formatDecimalBytes(1000, 2)).toBe('1.00kB')
    expect(formatDecimalBytes(1500, 1)).toBe('1.5kB')
  })

  it('formats megabytes correctly (1MB = 1000000B)', () => {
    expect(formatDecimalBytes(1000000, 2)).toBe('1.00MB')
  })
})

describe('formatBits', () => {
  it('formats bits correctly', () => {
    expect(formatBits(0, 2)).toBe('0b')
    expect(formatBits(1000, 2)).toBe('1.00Kb')
    expect(formatBits(1000000, 2)).toBe('1.00Mb')
  })
})

describe('formatDataRate', () => {
  it('formats data rates correctly', () => {
    expect(formatDataRate(1024, 2)).toBe('1.00KB/s')
    expect(formatDataRate(1048576, 2)).toBe('1.00MB/s')
  })
})

describe('formatFrequency', () => {
  it('formats frequency correctly', () => {
    expect(formatFrequency(1000, 2)).toBe('1.00kHz')
    expect(formatFrequency(1000000, 2)).toBe('1.00MHz')
    expect(formatFrequency(1000000000, 2)).toBe('1.00GHz')
  })
})

describe('formatDuration', () => {
  it('formats seconds correctly', () => {
    expect(formatDuration(1, 2)).toBe('1.00s')
    expect(formatDuration(30, 0)).toBe('30s')
  })

  it('formats minutes correctly', () => {
    expect(formatDuration(60, 2)).toBe('1.00m')
    expect(formatDuration(90, 1)).toBe('1.5m')
  })

  it('formats hours correctly', () => {
    expect(formatDuration(3600, 2)).toBe('1.00h')
    expect(formatDuration(5400, 1)).toBe('1.5h')
  })

  it('formats days correctly', () => {
    expect(formatDuration(86400, 2)).toBe('1.00d')
    expect(formatDuration(129600, 1)).toBe('1.5d')
  })

  it('formats milliseconds correctly', () => {
    expect(formatDuration(0.001, 2)).toBe('1.00ms')
    expect(formatDuration(0.5, 0)).toBe('500ms')
  })

  it('formats microseconds correctly', () => {
    expect(formatDuration(0.000001, 2)).toBe('1.00μs')
  })

  it('formats nanoseconds correctly', () => {
    expect(formatDuration(0.000000001, 2)).toBe('1.00ns')
  })
})

describe('formatValue', () => {
  it('handles null values', () => {
    expect(formatValue(null)).toBe('-')
    expect(formatValue(undefined)).toBe('-')
    expect(formatValue(NaN)).toBe('-')
    expect(formatValue(null, { nullValue: 'N/A' })).toBe('N/A')
  })

  it('formats with unit none', () => {
    expect(formatValue(100, { unit: 'none', decimals: 2 })).toBe('100.00')
  })

  it('formats with unit short', () => {
    expect(formatValue(1500, { unit: 'short', decimals: 1 })).toBe('1.5K')
  })

  it('formats with unit percent', () => {
    expect(formatValue(75.5, { unit: 'percent', decimals: 1 })).toBe('75.5%')
  })

  it('formats with unit percentunit (0-1 to percent)', () => {
    expect(formatValue(0.755, { unit: 'percentunit', decimals: 1 })).toBe('75.5%')
  })

  it('formats with unit bytes', () => {
    expect(formatValue(1048576, { unit: 'bytes', decimals: 0 })).toBe('1MB')
  })

  it('formats with unit decbytes', () => {
    expect(formatValue(1000000, { unit: 'decbytes', decimals: 0 })).toBe('1MB')
  })

  it('formats with unit bits', () => {
    expect(formatValue(1000000, { unit: 'bits', decimals: 0 })).toBe('1Mb')
  })

  it('formats with unit seconds', () => {
    expect(formatValue(3600, { unit: 'seconds', decimals: 0 })).toBe('1h')
  })

  it('formats with unit milliseconds', () => {
    expect(formatValue(1500, { unit: 'milliseconds', decimals: 1 })).toBe('1.5s')
  })

  it('formats with unit microseconds', () => {
    expect(formatValue(1000, { unit: 'microseconds', decimals: 0 })).toBe('1ms')
  })

  it('formats with unit nanoseconds', () => {
    expect(formatValue(1000000, { unit: 'nanoseconds', decimals: 0 })).toBe('1ms')
  })

  it('formats with unit hertz', () => {
    expect(formatValue(1000000, { unit: 'hertz', decimals: 0 })).toBe('1MHz')
  })

  it('formats with unit datarate', () => {
    expect(formatValue(1048576, { unit: 'datarate', decimals: 0 })).toBe('1MB/s')
  })

  it('formats with unit temperature_c', () => {
    expect(formatValue(25.5, { unit: 'temperature_c', decimals: 1 })).toBe('25.5°C')
  })

  it('formats with unit temperature_f', () => {
    expect(formatValue(77.9, { unit: 'temperature_f', decimals: 1 })).toBe('77.9°F')
  })

  it('formats with unit currency_usd', () => {
    expect(formatValue(1234.56, { unit: 'currency_usd', decimals: 2 })).toBe('$1234.56')
  })

  it('formats with unit currency_eur', () => {
    expect(formatValue(1234.56, { unit: 'currency_eur', decimals: 2 })).toBe('€1234.56')
  })

  it('formats with unit currency_gbp', () => {
    expect(formatValue(1234.56, { unit: 'currency_gbp', decimals: 2 })).toBe('£1234.56')
  })

  it('formats with custom unit suffix', () => {
    expect(formatValue(100, { unit: 'rpm', decimals: 0 })).toBe('100rpm')
    expect(formatValue(50, { unit: ' items', decimals: 0 })).toBe('50 items')
  })
})

describe('applyThresholds', () => {
  it('returns default color when no thresholds', () => {
    const result = applyThresholds(50, [])
    expect(result.color).toBe('#f5f5f5')
  })

  it('returns default color when below all thresholds', () => {
    const thresholds = [
      { value: 50, color: '#feca57' },
      { value: 80, color: '#ff6b6b' },
    ]
    const result = applyThresholds(30, thresholds)
    expect(result.color).toBe('#f5f5f5')
  })

  it('returns first threshold color when above first threshold', () => {
    const thresholds = [
      { value: 50, color: '#feca57' },
      { value: 80, color: '#ff6b6b' },
    ]
    const result = applyThresholds(60, thresholds)
    expect(result.color).toBe('#feca57')
  })

  it('returns highest applicable threshold color', () => {
    const thresholds = [
      { value: 50, color: '#feca57' },
      { value: 80, color: '#ff6b6b' },
    ]
    const result = applyThresholds(90, thresholds)
    expect(result.color).toBe('#ff6b6b')
  })

  it('handles exact threshold values', () => {
    const thresholds = [{ value: 80, color: '#ff6b6b' }]
    const result = applyThresholds(80, thresholds)
    expect(result.color).toBe('#ff6b6b')
  })

  it('handles unsorted thresholds', () => {
    const thresholds = [
      { value: 80, color: '#ff6b6b' },
      { value: 50, color: '#feca57' },
    ]
    const result = applyThresholds(90, thresholds)
    expect(result.color).toBe('#ff6b6b')
  })

  it('includes background color when provided', () => {
    const thresholds = [
      { value: 80, color: '#ff6b6b', background: 'rgba(255, 0, 0, 0.1)' },
    ]
    const result = applyThresholds(90, thresholds)
    expect(result.color).toBe('#ff6b6b')
    expect(result.background).toBe('rgba(255, 0, 0, 0.1)')
  })

  it('uses custom default color', () => {
    const result = applyThresholds(50, [], '#4ecdc4')
    expect(result.color).toBe('#4ecdc4')
  })
})

describe('applyMappings', () => {
  it('returns null when no mappings', () => {
    expect(applyMappings(0, [])).toBeNull()
  })

  it('returns null when no match found', () => {
    const mappings = [
      { value: 0, text: 'Down' },
      { value: 1, text: 'Up' },
    ]
    expect(applyMappings(2, mappings)).toBeNull()
  })

  it('returns mapped text for matching value', () => {
    const mappings = [
      { value: 0, text: 'Down' },
      { value: 1, text: 'Up' },
    ]
    expect(applyMappings(0, mappings)).toEqual({ text: 'Down', color: undefined })
    expect(applyMappings(1, mappings)).toEqual({ text: 'Up', color: undefined })
  })

  it('returns mapped text with color when provided', () => {
    const mappings = [
      { value: 0, text: 'Down', color: '#ff6b6b' },
      { value: 1, text: 'Up', color: '#4ecdc4' },
    ]
    expect(applyMappings(0, mappings)).toEqual({ text: 'Down', color: '#ff6b6b' })
  })

  it('handles string values', () => {
    const mappings = [
      { value: 'error', text: 'Error State' },
      { value: 'ok', text: 'OK' },
    ]
    expect(applyMappings('error', mappings)).toEqual({ text: 'Error State', color: undefined })
  })

  it('handles numeric string comparison', () => {
    const mappings = [
      { value: '0', text: 'Zero' },
    ]
    expect(applyMappings(0, mappings)).toEqual({ text: 'Zero', color: undefined })
  })
})

describe('formatDisplayValue', () => {
  it('handles null values', () => {
    expect(formatDisplayValue(null)).toEqual({ text: '-', mapped: false })
    expect(formatDisplayValue(undefined, { nullValue: 'N/A' })).toEqual({ text: 'N/A', mapped: false })
  })

  it('applies mappings first', () => {
    const result = formatDisplayValue(0, {
      mappings: [{ value: 0, text: 'Down' }],
      unit: 'percent',
    })
    expect(result).toEqual({ text: 'Down', mapped: true })
  })

  it('falls back to formatted value when no mapping matches', () => {
    const result = formatDisplayValue(50, {
      mappings: [{ value: 0, text: 'Down' }],
      unit: 'percent',
      decimals: 0,
    })
    expect(result).toEqual({ text: '50%', mapped: false })
  })

  it('formats value when no mappings provided', () => {
    const result = formatDisplayValue(1048576, {
      unit: 'bytes',
      decimals: 0,
    })
    expect(result).toEqual({ text: '1MB', mapped: false })
  })
})
