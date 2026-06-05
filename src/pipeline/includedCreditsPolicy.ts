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

const COPILOT_BUSINESS_LABEL = 'Copilot Business'
const COPILOT_ENTERPRISE_LABEL = 'Copilot Enterprise'

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
