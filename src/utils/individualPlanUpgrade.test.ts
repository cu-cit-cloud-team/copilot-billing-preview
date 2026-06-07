import { describe, expect, it } from 'vitest'

import { PRO_MONTHLY_QUOTA, PRO_PLUS_MONTHLY_QUOTA } from '../pipeline/aicIncludedCredits'
import {
  NATIVE_AI_CREDITS_STANDARD_INCLUDED_CREDITS_POLICY,
  NATIVE_AI_CREDITS_SUMMER_PROMO_INCLUDED_CREDITS_POLICY,
} from '../pipeline/includedCreditsPolicy'
import {
  calculateIndividualPlanUpgradeRecommendation,
  getIndividualLicenseMonthlyCost,
  MAX_LICENSE_MONTHLY_COST,
  PRO_LICENSE_MONTHLY_COST,
  PRO_PLUS_LICENSE_MONTHLY_COST,
} from './individualPlanUpgrade'

describe('individual plan upgrade recommendations', () => {
  it('returns individual plan license costs', () => {
    expect(getIndividualLicenseMonthlyCost(PRO_MONTHLY_QUOTA)).toBe(PRO_LICENSE_MONTHLY_COST)
    expect(getIndividualLicenseMonthlyCost(PRO_PLUS_MONTHLY_QUOTA)).toBe(PRO_PLUS_LICENSE_MONTHLY_COST)
    expect(getIndividualLicenseMonthlyCost(0)).toBeUndefined()
  })

  it('returns native summer individual plan license costs', () => {
    expect(getIndividualLicenseMonthlyCost(
      1500,
      NATIVE_AI_CREDITS_SUMMER_PROMO_INCLUDED_CREDITS_POLICY,
    )).toBe(PRO_LICENSE_MONTHLY_COST)
    expect(getIndividualLicenseMonthlyCost(
      7000,
      NATIVE_AI_CREDITS_SUMMER_PROMO_INCLUDED_CREDITS_POLICY,
    )).toBe(PRO_PLUS_LICENSE_MONTHLY_COST)
    expect(getIndividualLicenseMonthlyCost(
      20000,
      NATIVE_AI_CREDITS_SUMMER_PROMO_INCLUDED_CREDITS_POLICY,
    )).toBe(MAX_LICENSE_MONTHLY_COST)
    expect(getIndividualLicenseMonthlyCost(
      20000,
      NATIVE_AI_CREDITS_STANDARD_INCLUDED_CREDITS_POLICY,
    )).toBe(MAX_LICENSE_MONTHLY_COST)
    expect(getIndividualLicenseMonthlyCost(1000)).toBeUndefined()
  })

  it('recommends Pro+ when extra included AICs exceed the higher subscription cost', () => {
    const recommendation = calculateIndividualPlanUpgradeRecommendation({
      totalMonthlyQuota: PRO_MONTHLY_QUOTA,
      currentMonthlyAicAdditionalUsageBillsUsd: [70],
    })

    expect(recommendation).toEqual({
      currentPlanLabel: 'Pro',
      nextPlanTier: 'pro-plus',
      nextPlanLabel: 'Pro+',
      currentAdditionalUsageAic: 7000,
      currentAdditionalUsageCostUsd: 70,
      extraIncludedAic: 5500,
      additionalUsageBillReductionUsd: 55,
      licenseCostIncreaseUsd: 29,
      netSavingsUsd: 26,
      upgradedTotalBillUsd: 54,
    })
  })

  it('does not recommend upgrading when Pro+ would not reduce the total bill', () => {
    expect(calculateIndividualPlanUpgradeRecommendation({
      totalMonthlyQuota: PRO_MONTHLY_QUOTA,
      currentMonthlyAicAdditionalUsageBillsUsd: [29],
    })).toBeNull()
  })

  it('recommends Max from Pro+ when it reduces the total bill', () => {
    const recommendation = calculateIndividualPlanUpgradeRecommendation({
      totalMonthlyQuota: PRO_PLUS_MONTHLY_QUOTA,
      currentMonthlyAicAdditionalUsageBillsUsd: [100],
    })

    expect(recommendation).toEqual({
      currentPlanLabel: 'Pro+',
      nextPlanTier: 'max',
      nextPlanLabel: 'Max',
      currentAdditionalUsageAic: 10000,
      currentAdditionalUsageCostUsd: 100,
      extraIncludedAic: 13000,
      additionalUsageBillReductionUsd: 100,
      licenseCostIncreaseUsd: 61,
      netSavingsUsd: 39,
      upgradedTotalBillUsd: MAX_LICENSE_MONTHLY_COST,
    })
  })

  it('applies the extra included AICs and subscription increase per month', () => {
    const recommendation = calculateIndividualPlanUpgradeRecommendation({
      totalMonthlyQuota: PRO_MONTHLY_QUOTA,
      currentMonthlyAicAdditionalUsageBillsUsd: [70, 20],
    })

    expect(recommendation?.currentAdditionalUsageAic).toBe(9000)
    expect(recommendation?.additionalUsageBillReductionUsd).toBe(75)
    expect(recommendation?.licenseCostIncreaseUsd).toBe(58)
    expect(recommendation?.netSavingsUsd).toBe(17)
    expect(recommendation?.upgradedTotalBillUsd).toBe(93)
  })

  it('recommends Max from Pro when it saves more than Pro+', () => {
    const recommendation = calculateIndividualPlanUpgradeRecommendation({
      totalMonthlyQuota: PRO_MONTHLY_QUOTA,
      currentMonthlyAicAdditionalUsageBillsUsd: [200],
    })

    expect(recommendation?.nextPlanLabel).toBe('Max')
    expect(recommendation?.extraIncludedAic).toBe(18500)
    expect(recommendation?.additionalUsageBillReductionUsd).toBe(185)
    expect(recommendation?.licenseCostIncreaseUsd).toBe(90)
    expect(recommendation?.netSavingsUsd).toBe(95)
    expect(recommendation?.upgradedTotalBillUsd).toBe(115)
  })

  it('does not recommend Max from Pro+ when it would not reduce the total bill', () => {
    expect(calculateIndividualPlanUpgradeRecommendation({
      totalMonthlyQuota: PRO_PLUS_MONTHLY_QUOTA,
      currentMonthlyAicAdditionalUsageBillsUsd: [61],
    })).toBeNull()
  })

  it('does not recommend an upgrade for native summer Max users', () => {
    expect(calculateIndividualPlanUpgradeRecommendation({
      totalMonthlyQuota: 20000,
      currentMonthlyAicAdditionalUsageBillsUsd: [200],
      includedCreditsPolicy: NATIVE_AI_CREDITS_SUMMER_PROMO_INCLUDED_CREDITS_POLICY,
    })).toBeNull()
  })

  it('uses post-preview individual allotments for native upgrade recommendations', () => {
    const recommendation = calculateIndividualPlanUpgradeRecommendation({
      totalMonthlyQuota: 7000,
      currentMonthlyAicAdditionalUsageBillsUsd: [100],
      includedCreditsPolicy: NATIVE_AI_CREDITS_SUMMER_PROMO_INCLUDED_CREDITS_POLICY,
    })

    expect(recommendation).toEqual({
      currentPlanLabel: 'Pro+',
      nextPlanTier: 'max',
      nextPlanLabel: 'Max',
      currentAdditionalUsageAic: 10000,
      currentAdditionalUsageCostUsd: 100,
      extraIncludedAic: 13000,
      additionalUsageBillReductionUsd: 100,
      licenseCostIncreaseUsd: 61,
      netSavingsUsd: 39,
      upgradedTotalBillUsd: MAX_LICENSE_MONTHLY_COST,
    })
  })

  it('uses post-preview individual allotments for native standard upgrade recommendations', () => {
    expect(calculateIndividualPlanUpgradeRecommendation({
      totalMonthlyQuota: 7000,
      currentMonthlyAicAdditionalUsageBillsUsd: [61],
      includedCreditsPolicy: NATIVE_AI_CREDITS_STANDARD_INCLUDED_CREDITS_POLICY,
    })).toBeNull()
  })
})
