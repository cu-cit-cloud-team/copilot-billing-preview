import {
  getIndividualPlanTier,
} from '../pipeline/aicIncludedCredits'
import {
  TRANSITION_PERIOD_INCLUDED_CREDITS_POLICY,
  type IncludedCreditsPolicy,
  type IndividualIncludedCreditTier,
} from '../pipeline/includedCreditsPolicy'
import { AIC_UNIT_PRICE_USD } from './billingConstants'

export const PRO_LICENSE_MONTHLY_COST = 10
export const PRO_PLUS_LICENSE_MONTHLY_COST = 39
export const MAX_LICENSE_MONTHLY_COST = 100
export const MAX_PROMOTIONAL_MONTHLY_AIC_INCLUDED_CREDITS = 20000

type RecommendableIndividualPlan = {
  tier: IndividualIncludedCreditTier
  label: string
  monthlyLicenseCostUsd: number
  monthlyIncludedAic: number
}

const RECOMMENDABLE_INDIVIDUAL_PLAN_ORDER = ['pro-student', 'pro-plus', 'max'] as const satisfies readonly IndividualIncludedCreditTier[]

const INDIVIDUAL_PLAN_METADATA: Record<IndividualIncludedCreditTier, {
  label: string
  monthlyLicenseCostUsd: number
}> = {
  'pro-student': {
    label: 'Pro',
    monthlyLicenseCostUsd: PRO_LICENSE_MONTHLY_COST,
  },
  'pro-plus': {
    label: 'Pro+',
    monthlyLicenseCostUsd: PRO_PLUS_LICENSE_MONTHLY_COST,
  },
  max: {
    label: 'Max',
    monthlyLicenseCostUsd: MAX_LICENSE_MONTHLY_COST,
  },
}

function getRecommendableIndividualPlans(policy: IncludedCreditsPolicy): RecommendableIndividualPlan[] {
  const policyPlans = RECOMMENDABLE_INDIVIDUAL_PLAN_ORDER.flatMap((tier) => {
    const plan = policy.individualPlans[tier]
    if (!plan) return []

    return [{
      tier,
      label: INDIVIDUAL_PLAN_METADATA[tier].label,
      monthlyLicenseCostUsd: INDIVIDUAL_PLAN_METADATA[tier].monthlyLicenseCostUsd,
      monthlyIncludedAic: plan.monthlyIncludedCredits,
    }]
  })

  if (policy.id !== TRANSITION_PERIOD_INCLUDED_CREDITS_POLICY.id || policy.individualPlans.max) {
    return policyPlans
  }

  return [
    ...policyPlans,
    {
      tier: 'max',
      label: INDIVIDUAL_PLAN_METADATA.max.label,
      monthlyLicenseCostUsd: INDIVIDUAL_PLAN_METADATA.max.monthlyLicenseCostUsd,
      monthlyIncludedAic: MAX_PROMOTIONAL_MONTHLY_AIC_INCLUDED_CREDITS,
    },
  ]
}

export type IndividualPlanUpgradeRecommendation = {
  currentPlanLabel: string
  nextPlanTier: RecommendableIndividualPlan['tier']
  nextPlanLabel: string
  currentAdditionalUsageAic: number
  currentAdditionalUsageCostUsd: number
  extraIncludedAic: number
  additionalUsageBillReductionUsd: number
  licenseCostIncreaseUsd: number
  netSavingsUsd: number
  upgradedTotalBillUsd: number
}

export function getIndividualLicenseMonthlyCost(
  totalMonthlyQuota: number,
  includedCreditsPolicy: IncludedCreditsPolicy = TRANSITION_PERIOD_INCLUDED_CREDITS_POLICY,
): number | undefined {
  const planTier = getIndividualPlanTier(totalMonthlyQuota, 'individual', includedCreditsPolicy)
  return planTier ? INDIVIDUAL_PLAN_METADATA[planTier].monthlyLicenseCostUsd : undefined
}

export function calculateIndividualPlanUpgradeRecommendation({
  totalMonthlyQuota,
  currentMonthlyAicAdditionalUsageBillsUsd,
  includedCreditsPolicy = TRANSITION_PERIOD_INCLUDED_CREDITS_POLICY,
}: {
  totalMonthlyQuota: number
  currentMonthlyAicAdditionalUsageBillsUsd: number[]
  includedCreditsPolicy?: IncludedCreditsPolicy
}): IndividualPlanUpgradeRecommendation | null {
  const planTier = getIndividualPlanTier(totalMonthlyQuota, 'individual', includedCreditsPolicy)
  if (!planTier || currentMonthlyAicAdditionalUsageBillsUsd.length === 0) {
    return null
  }

  const currentAicAdditionalUsageBillUsd = currentMonthlyAicAdditionalUsageBillsUsd.reduce((sum, amount) => sum + amount, 0)
  if (currentAicAdditionalUsageBillUsd <= 0) {
    return null
  }

  const recommendableIndividualPlans = getRecommendableIndividualPlans(includedCreditsPolicy)
  const currentPlanIndex = recommendableIndividualPlans.findIndex((plan) => plan.tier === planTier)
  const currentPlan = recommendableIndividualPlans[currentPlanIndex]
  if (!currentPlan) {
    return null
  }

  const currentAdditionalUsageAic = currentAicAdditionalUsageBillUsd / AIC_UNIT_PRICE_USD
  const recommendation = recommendableIndividualPlans
    .slice(currentPlanIndex + 1)
    .map((targetPlan) => {
      const extraIncludedAic = targetPlan.monthlyIncludedAic - currentPlan.monthlyIncludedAic
      const monthlyAdditionalUsageBillReductionLimitUsd = extraIncludedAic * AIC_UNIT_PRICE_USD
      const additionalUsageBillReductionUsd = currentMonthlyAicAdditionalUsageBillsUsd.reduce(
        (sum, amount) => sum + Math.min(amount, monthlyAdditionalUsageBillReductionLimitUsd),
        0,
      )
      const licenseCostIncreaseUsd = currentMonthlyAicAdditionalUsageBillsUsd.length * (
        targetPlan.monthlyLicenseCostUsd - currentPlan.monthlyLicenseCostUsd
      )
      const netSavingsUsd = additionalUsageBillReductionUsd - licenseCostIncreaseUsd
      const upgradedTotalBillUsd = (
        currentAicAdditionalUsageBillUsd
        + (currentMonthlyAicAdditionalUsageBillsUsd.length * targetPlan.monthlyLicenseCostUsd)
        - additionalUsageBillReductionUsd
      )

      return {
        currentPlanLabel: currentPlan.label,
        nextPlanTier: targetPlan.tier,
        nextPlanLabel: targetPlan.label,
        currentAdditionalUsageAic,
        currentAdditionalUsageCostUsd: currentAicAdditionalUsageBillUsd,
        extraIncludedAic,
        additionalUsageBillReductionUsd,
        licenseCostIncreaseUsd,
        netSavingsUsd,
        upgradedTotalBillUsd,
      }
    })
    .filter((candidate) => candidate.netSavingsUsd > 0)
    .sort((a, b) => b.netSavingsUsd - a.netSavingsUsd)[0]

  if (!recommendation) {
    return null
  }

  return recommendation
}
