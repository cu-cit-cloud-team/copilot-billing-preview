import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import type { CostCenterResult } from '../pipeline/aggregators/costCenterAggregator'
import type { ModelUsageResult } from '../pipeline/aggregators/modelUsageAggregator'
import type { OrganizationResult } from '../pipeline/aggregators/organizationAggregator'
import type { UserUsage } from '../pipeline/aggregators/userUsageAggregator'
import { EXISTING_DISCOUNT_DISCLAIMER } from '../components/ui/ExistingDiscountDisclaimer'
import { CostCentersView } from './CostCentersView'
import { ModelsView } from './ModelsView'
import { OrganizationsView } from './OrganizationsView'
import { UserDetailsView } from './UserDetailsView'

const nativeTotals = {
  requests: 0,
  grossAmount: 0,
  discountAmount: 0,
  netAmount: 0,
  aicQuantity: 250.24,
  aicGrossAmount: 2.5024,
  aicNetAmount: 0,
}

const modelName = 'Auto: GPT-5.3-Codex'

function countOccurrences(value: string, search: string): number {
  return value.split(search).length - 1
}

describe('native billing cards in views', () => {
  it('reuses the shared usage-based billing card title and disclosures', () => {
    const organizationResult: OrganizationResult = {
      organizations: [{
        organization: 'example-org',
        userCount: 1,
        totals: nativeTotals,
        totalsByModel: { [modelName]: nativeTotals },
        totalsByUser: {
          mona: {
            requests: nativeTotals.requests,
            grossAmount: nativeTotals.grossAmount,
            netAmount: nativeTotals.netAmount,
            aicQuantity: nativeTotals.aicQuantity,
            aicGrossAmount: nativeTotals.aicGrossAmount,
            aicNetAmount: nativeTotals.aicNetAmount,
          },
        },
      }],
    }
    const costCenterResult: CostCenterResult = {
      costCenters: [{
        costCenterName: 'Cost Center A',
        userCount: 1,
        netCostPerUser: 0,
        totals: nativeTotals,
        totalsByModel: { [modelName]: nativeTotals },
        totalsByUser: {
          mona: {
            requests: nativeTotals.requests,
            grossAmount: nativeTotals.grossAmount,
            netAmount: nativeTotals.netAmount,
            aicQuantity: nativeTotals.aicQuantity,
            aicGrossAmount: nativeTotals.aicGrossAmount,
            aicNetAmount: nativeTotals.aicNetAmount,
          },
        },
      }],
    }
    const modelUsage: ModelUsageResult = {
      models: [modelName],
      byModel: {
        [modelName]: [{
          date: '2026-06-01',
          ...nativeTotals,
        }],
      },
      totalsByModel: {
        [modelName]: nativeTotals,
      },
    }
    const userUsage: UserUsage = {
      username: 'mona',
      spendSegment: 'typical',
      totalMonthlyQuota: 3900,
      organizations: ['example-org'],
      costCenters: ['Cost Center A'],
      daily: {
        '2026-06-01': {
          date: '2026-06-01',
          ...nativeTotals,
          models: {
            [modelName]: nativeTotals,
          },
        },
      },
      products: {},
      totals: {
        ...nativeTotals,
        distinctModels: 1,
      },
    }

    const html = [
      renderToStaticMarkup(createElement(OrganizationsView, {
        data: organizationResult,
        rangeStart: '2026-06-01',
        reportMode: 'native-ai-credits',
        showOrganizationPromotionalDataDisclaimer: true,
      })),
      renderToStaticMarkup(createElement(CostCentersView, {
        data: costCenterResult,
        rangeStart: '2026-06-01',
        reportMode: 'native-ai-credits',
        showOrganizationPromotionalDataDisclaimer: true,
      })),
      renderToStaticMarkup(createElement(ModelsView, {
        modelUsage,
        isIndividualReport: false,
        rangeStart: '2026-06-01',
        rangeEnd: '2026-06-01',
        reportMode: 'native-ai-credits',
        showOrganizationPromotionalDataDisclaimer: true,
      })),
      renderToStaticMarkup(createElement(UserDetailsView, {
        user: userUsage,
        rangeStart: '2026-06-01',
        rangeEnd: '2026-06-01',
        reportMode: 'native-ai-credits',
        showOrganizationPromotionalDataDisclaimer: true,
      })),
    ].join('\n')

    expect(countOccurrences(html, 'Usage-based billing (AICs)')).toBe(4)
    expect(countOccurrences(html, EXISTING_DISCOUNT_DISCLAIMER)).toBe(4)
    expect(countOccurrences(html, 'Promotional amounts are used in this simulation.')).toBe(4)
    expect(html).not.toContain('AI Credits usage')
    expect(html).not.toContain('Current billing (PRUs)')
  })
})
