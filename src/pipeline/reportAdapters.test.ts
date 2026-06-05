import { describe, expect, it } from 'vitest'

import {
  InvalidReportError,
  UnsupportedNativeAiCreditsReportError,
  UnsupportedReportVersionError,
  parseTokenUsageHeader,
  parseTokenUsageRecord,
} from './parser'
import {
  detectReportFormat,
  selectUsageReportAdapter,
  validateUsageReportFirstRecord,
  validateUsageReportHeader,
} from './reportAdapters'

const TRANSITION_PERIOD_HEADER = [
  'date',
  'username',
  'product',
  'sku',
  'model',
  'quantity',
  'unit_type',
  'applied_cost_per_quantity',
  'gross_amount',
  'discount_amount',
  'net_amount',
  'exceeds_quota',
  'total_monthly_quota',
  'organization',
  'cost_center_name',
  'aic_quantity',
  'aic_gross_amount',
].join(',')

const HEADER_WITHOUT_EXCEEDS_QUOTA = [
  'date',
  'username',
  'product',
  'sku',
  'model',
  'quantity',
  'unit_type',
  'applied_cost_per_quantity',
  'gross_amount',
  'discount_amount',
  'net_amount',
  'total_monthly_quota',
  'organization',
  'cost_center_name',
  'aic_quantity',
  'aic_gross_amount',
].join(',')

function buildRow(values: string[]): string {
  return values.join(',')
}

describe('usage report adapters', () => {
  it('detects and selects the Transition Period Billing Preview adapter for current preview reports', () => {
    const header = parseTokenUsageHeader(TRANSITION_PERIOD_HEADER)
    const record = parseTokenUsageRecord(
      buildRow([
        '2026-05-29',
        'mona',
        'copilot',
        'copilot_premium_request',
        'Auto: Claude Haiku 4.5',
        '2',
        'requests',
        '0.04',
        '0.08',
        '0',
        '0.08',
        'False',
        '300',
        'example-org',
        'Cost Center A',
        '20',
        '0.20',
      ]),
      header,
    )

    expect(detectReportFormat(header, record)).toBe('transition-period-billing-preview')
    expect(selectUsageReportAdapter(header, record).metadata).toMatchObject({
      format: 'transition-period-billing-preview',
      supported: true,
    })
    expect(() => validateUsageReportFirstRecord(header, record)).not.toThrow()
  })

  it('keeps missing-exceeds premium request rows on the Transition Period Billing Preview adapter', () => {
    const header = parseTokenUsageHeader(HEADER_WITHOUT_EXCEEDS_QUOTA)
    const record = parseTokenUsageRecord(
      buildRow([
        '2026-05-29',
        'mona',
        'copilot',
        'copilot_premium_request',
        'Auto: Claude Haiku 4.5',
        '2',
        'requests',
        '0.04',
        '0.08',
        '0',
        '0.08',
        '300',
        'example-org',
        'Cost Center A',
        '20',
        '0.20',
      ]),
      header,
    )

    expect(detectReportFormat(header, record)).toBe('transition-period-billing-preview')
    expect(selectUsageReportAdapter(header, record).metadata.format).toBe('transition-period-billing-preview')
    expect(() => validateUsageReportFirstRecord(header, record)).not.toThrow()
  })

  it('detects native AI Credits reports and routes them to an unsupported adapter', () => {
    const header = parseTokenUsageHeader(HEADER_WITHOUT_EXCEEDS_QUOTA)
    const record = parseTokenUsageRecord(
      buildRow([
        '2026-06-01',
        'mona',
        'copilot',
        'copilot_ai_credit',
        'Auto: Claude Haiku 4.5',
        '96.9990345',
        'ai-credits',
        '0.01',
        '0.969990345',
        '0',
        '0.969990345',
        '3900',
        'example-org',
        '',
        '96.9990345',
        '0.969990345',
      ]),
      header,
    )

    expect(detectReportFormat(header, record)).toBe('native-ai-credits')
    expect(selectUsageReportAdapter(header, record).metadata).toMatchObject({
      format: 'native-ai-credits',
      supported: false,
    })
    expect(() => validateUsageReportFirstRecord(header, record)).toThrow(UnsupportedNativeAiCreditsReportError)
  })

  it('fails clearly for malformed billing headers before adapter selection', () => {
    const header = parseTokenUsageHeader('foo,bar,baz')

    expect(() => validateUsageReportHeader(header)).toThrow(InvalidReportError)
  })

  it('fails clearly for pre-AIC report headers before adapter selection', () => {
    const header = parseTokenUsageHeader([
      'date',
      'username',
      'product',
      'sku',
      'model',
      'quantity',
      'unit_type',
      'applied_cost_per_quantity',
      'gross_amount',
      'discount_amount',
      'net_amount',
      'exceeds_quota',
      'total_monthly_quota',
      'organization',
      'cost_center_name',
    ].join(','))

    expect(() => validateUsageReportHeader(header)).toThrow(UnsupportedReportVersionError)
  })
})
