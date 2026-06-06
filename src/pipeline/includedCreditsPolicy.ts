import type { ReportFormat, ReportFormatMetadata } from './reportAdapters'
import { isValidIsoDate } from './isoDate'

export type QuotaUnit = 'pru' | 'aic'
export type OrganizationIncludedCreditTier = 'business' | 'enterprise'

export type PlanIdentity<TTier extends string = string> = {
  readonly tier: TTier
  readonly quotaUnit: QuotaUnit
  readonly monthlyQuota: number
}

export type IncludedCreditsPlan<TTier extends OrganizationIncludedCreditTier = OrganizationIncludedCreditTier> = {
  readonly identity: PlanIdentity<TTier>
  readonly label: string
  readonly monthlyIncludedCredits: number
}

export type OrganizationIncludedCreditPlans = {
  readonly [Tier in OrganizationIncludedCreditTier]: IncludedCreditsPlan<Tier>
}

export type IncludedCreditsPolicyId =
  | 'transition-period-billing-preview'
  | 'native-ai-credits-summer-promo'
  | 'native-ai-credits-standard'

export type IncludedCreditsPolicy = {
  readonly id: IncludedCreditsPolicyId
  readonly organizationPlans: OrganizationIncludedCreditPlans
}

export type ReportPeriod = {
  readonly startDate?: string | null
  readonly endDate?: string | null
}

const COPILOT_BUSINESS_LABEL = 'Copilot Business'
const COPILOT_ENTERPRISE_LABEL = 'Copilot Enterprise'
const NATIVE_AI_CREDITS_STANDARD_POLICY_START_DATE = '2026-09-01'

export const TRANSITION_PERIOD_INCLUDED_CREDITS_POLICY = {
  id: 'transition-period-billing-preview',
  organizationPlans: {
    business: {
      identity: {
        tier: 'business',
        quotaUnit: 'pru',
        monthlyQuota: 300,
      },
      label: COPILOT_BUSINESS_LABEL,
      monthlyIncludedCredits: 3000,
    },
    enterprise: {
      identity: {
        tier: 'enterprise',
        quotaUnit: 'pru',
        monthlyQuota: 1000,
      },
      label: COPILOT_ENTERPRISE_LABEL,
      monthlyIncludedCredits: 7000,
    },
  },
} as const satisfies IncludedCreditsPolicy

export const NATIVE_AI_CREDITS_SUMMER_PROMO_INCLUDED_CREDITS_POLICY = {
  id: 'native-ai-credits-summer-promo',
  organizationPlans: {
    business: {
      identity: {
        tier: 'business',
        quotaUnit: 'aic',
        monthlyQuota: 1900,
      },
      label: COPILOT_BUSINESS_LABEL,
      monthlyIncludedCredits: 3000,
    },
    enterprise: {
      identity: {
        tier: 'enterprise',
        quotaUnit: 'aic',
        monthlyQuota: 3900,
      },
      label: COPILOT_ENTERPRISE_LABEL,
      monthlyIncludedCredits: 7000,
    },
  },
} as const satisfies IncludedCreditsPolicy

export const NATIVE_AI_CREDITS_STANDARD_INCLUDED_CREDITS_POLICY = {
  id: 'native-ai-credits-standard',
  organizationPlans: {
    business: {
      identity: {
        tier: 'business',
        quotaUnit: 'aic',
        monthlyQuota: 1900,
      },
      label: COPILOT_BUSINESS_LABEL,
      monthlyIncludedCredits: 1900,
    },
    enterprise: {
      identity: {
        tier: 'enterprise',
        quotaUnit: 'aic',
        monthlyQuota: 3900,
      },
      label: COPILOT_ENTERPRISE_LABEL,
      monthlyIncludedCredits: 3900,
    },
  },
} as const satisfies IncludedCreditsPolicy

function getReportFormat(reportMetadataOrFormat: ReportFormat | ReportFormatMetadata): ReportFormat {
  return typeof reportMetadataOrFormat === 'string'
    ? reportMetadataOrFormat
    : reportMetadataOrFormat.format
}

function isBeforeIsoDate(value: string | null | undefined, boundary: string): boolean {
  if (!value || !isValidIsoDate(value)) return false

  return value < boundary
}

export function resolveIncludedCreditsPolicy(
  reportMetadataOrFormat: ReportFormat | ReportFormatMetadata,
  reportPeriod: ReportPeriod = {},
): IncludedCreditsPolicy {
  if (getReportFormat(reportMetadataOrFormat) === 'transition-period-billing-preview') {
    return TRANSITION_PERIOD_INCLUDED_CREDITS_POLICY
  }

  if (isBeforeIsoDate(reportPeriod.startDate, NATIVE_AI_CREDITS_STANDARD_POLICY_START_DATE)) {
    return NATIVE_AI_CREDITS_SUMMER_PROMO_INCLUDED_CREDITS_POLICY
  }

  return NATIVE_AI_CREDITS_STANDARD_INCLUDED_CREDITS_POLICY
}
