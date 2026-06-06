import { describe, expect, it } from 'vitest'

import type { ReportFormatMetadata } from './reportAdapters'
import {
  NATIVE_AI_CREDITS_STANDARD_INCLUDED_CREDITS_POLICY,
  NATIVE_AI_CREDITS_SUMMER_PROMO_INCLUDED_CREDITS_POLICY,
  TRANSITION_PERIOD_INCLUDED_CREDITS_POLICY,
  resolveIncludedCreditsPolicy,
} from './includedCreditsPolicy'

const TRANSITION_PERIOD_REPORT_METADATA = {
  format: 'transition-period-billing-preview',
  label: 'Transition Period Billing Preview report',
  supported: true,
} satisfies ReportFormatMetadata

const NATIVE_AI_CREDITS_REPORT_METADATA = {
  format: 'native-ai-credits',
  label: 'Native AI Credits report',
  supported: false,
} satisfies ReportFormatMetadata

describe('resolveIncludedCreditsPolicy', () => {
  it('returns the transition-period billing preview policy for transition reports', () => {
    expect(resolveIncludedCreditsPolicy(TRANSITION_PERIOD_REPORT_METADATA)).toBe(
      TRANSITION_PERIOD_INCLUDED_CREDITS_POLICY,
    )
    expect(resolveIncludedCreditsPolicy('transition-period-billing-preview', {
      startDate: '2026-09-01',
      endDate: '2026-09-30',
    })).toBe(TRANSITION_PERIOD_INCLUDED_CREDITS_POLICY)
  })

  it('returns the native AI Credits summer promo policy for native report periods before September 2026', () => {
    expect(resolveIncludedCreditsPolicy(NATIVE_AI_CREDITS_REPORT_METADATA, {
      startDate: '2026-06-01',
      endDate: '2026-06-30',
    })).toBe(NATIVE_AI_CREDITS_SUMMER_PROMO_INCLUDED_CREDITS_POLICY)
  })

  it('uses period start to keep native report periods starting on 2026-08-31 in the summer promo policy', () => {
    expect(resolveIncludedCreditsPolicy(NATIVE_AI_CREDITS_REPORT_METADATA, {
      startDate: '2026-08-31',
      endDate: '2026-09-30',
    })).toBe(NATIVE_AI_CREDITS_SUMMER_PROMO_INCLUDED_CREDITS_POLICY)
  })

  it('returns the native AI Credits standard policy for native report periods starting on 2026-09-01 onward', () => {
    expect(resolveIncludedCreditsPolicy(NATIVE_AI_CREDITS_REPORT_METADATA, {
      startDate: '2026-09-01',
      endDate: '2026-09-30',
    })).toBe(NATIVE_AI_CREDITS_STANDARD_INCLUDED_CREDITS_POLICY)
    expect(resolveIncludedCreditsPolicy(NATIVE_AI_CREDITS_REPORT_METADATA, {
      startDate: '2026-10-01',
      endDate: '2026-10-31',
    })).toBe(NATIVE_AI_CREDITS_STANDARD_INCLUDED_CREDITS_POLICY)
  })

  it('defaults native AI Credits reports without a valid period start to the standard policy', () => {
    expect(resolveIncludedCreditsPolicy(NATIVE_AI_CREDITS_REPORT_METADATA)).toBe(
      NATIVE_AI_CREDITS_STANDARD_INCLUDED_CREDITS_POLICY,
    )
    expect(resolveIncludedCreditsPolicy(NATIVE_AI_CREDITS_REPORT_METADATA, {
      endDate: '2026-08-31',
    })).toBe(NATIVE_AI_CREDITS_STANDARD_INCLUDED_CREDITS_POLICY)
    expect(resolveIncludedCreditsPolicy(NATIVE_AI_CREDITS_REPORT_METADATA, {
      startDate: '8/31/26',
      endDate: '2026-08-31',
    })).toBe(NATIVE_AI_CREDITS_STANDARD_INCLUDED_CREDITS_POLICY)
  })
})
