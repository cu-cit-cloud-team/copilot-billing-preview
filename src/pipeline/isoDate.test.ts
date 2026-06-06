import { describe, expect, it } from 'vitest'

import { isValidIsoDate } from './isoDate'

describe('isValidIsoDate', () => {
  it('accepts only real YYYY-MM-DD calendar dates', () => {
    expect(isValidIsoDate('2026-03-01')).toBe(true)
    expect(isValidIsoDate('2024-02-29')).toBe(true)
    expect(isValidIsoDate('2026-02-30')).toBe(false)
    expect(isValidIsoDate('2026-13-01')).toBe(false)
    expect(isValidIsoDate('03/01/2026')).toBe(false)
    expect(isValidIsoDate(' 2026-03-01 ')).toBe(false)
  })
})
