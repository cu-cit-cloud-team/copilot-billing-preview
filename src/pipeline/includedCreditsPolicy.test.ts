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
} satisfies ReportFormatMetadata

const NATIVE_AI_CREDITS_REPORT_METADATA = {
  format: 'native-ai-credits',
  label: 'Native AI Credits report',
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

  it('defines post-preview individual plan quota identities and included AI Credits', () => {
    expect(NATIVE_AI_CREDITS_SUMMER_PROMO_INCLUDED_CREDITS_POLICY.individualPlans['pro-student']).toEqual({
      identity: {
        tier: 'pro-student',
        quotaUnit: 'aic',
        monthlyQuota: 1500,
      },
      label: 'Copilot Pro',
      monthlyIncludedCredits: 1500,
    })
    expect(NATIVE_AI_CREDITS_SUMMER_PROMO_INCLUDED_CREDITS_POLICY.individualPlans['pro-plus']).toEqual({
      identity: {
        tier: 'pro-plus',
        quotaUnit: 'aic',
        monthlyQuota: 7000,
      },
      label: 'Copilot Pro+',
      monthlyIncludedCredits: 7000,
    })
    expect(NATIVE_AI_CREDITS_SUMMER_PROMO_INCLUDED_CREDITS_POLICY.individualPlans.max).toEqual({
      identity: {
        tier: 'max',
        quotaUnit: 'aic',
        monthlyQuota: 20000,
      },
      label: 'Copilot Max',
      monthlyIncludedCredits: 20000,
    })
  })

  it('uses the same individual plan identities and allotments for native standard periods', () => {
    expect(NATIVE_AI_CREDITS_STANDARD_INCLUDED_CREDITS_POLICY.individualPlans).toEqual(
      NATIVE_AI_CREDITS_SUMMER_PROMO_INCLUDED_CREDITS_POLICY.individualPlans,
    )
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
