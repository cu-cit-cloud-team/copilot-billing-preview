import {
  getAicUsageMetrics,
  parseTokenUsageHeader,
  parseNormalizedTokenUsageRecord,
  type TokenUsageHeader,
  type TokenUsageRecord,
} from './parser'
import {
  TRANSITION_PERIOD_INCLUDED_CREDITS_POLICY,
  type IncludedCreditsPolicy,
  type OrganizationIncludedCreditTier,
  type PlanIdentity,
} from './includedCreditsPolicy'
import { streamLines, type StreamProgress } from './streamer'

type IndividualPlan = 'pro-student' | 'pro-plus'

type IndividualIncludedCreditsPlans = {
  readonly [Tier in IndividualPlan]: {
    readonly identity: PlanIdentity<Tier>
    readonly label: string
    readonly monthlyIncludedCredits: number
  }
}

const INDIVIDUAL_INCLUDED_CREDIT_PLANS = {
  'pro-student': {
    identity: {
      tier: 'pro-student',
      quotaUnit: 'pru',
      monthlyQuota: 300,
    },
    label: 'Copilot Pro/Student',
    monthlyIncludedCredits: 1500,
  },
  'pro-plus': {
    identity: {
      tier: 'pro-plus',
      quotaUnit: 'pru',
      monthlyQuota: 1500,
    },
    label: 'Copilot Pro+',
    monthlyIncludedCredits: 7000,
  },
} as const satisfies IndividualIncludedCreditsPlans

export const BUSINESS_MONTHLY_QUOTA = TRANSITION_PERIOD_INCLUDED_CREDITS_POLICY.organizationPlans.business.identity.monthlyQuota
export const ENTERPRISE_MONTHLY_QUOTA = TRANSITION_PERIOD_INCLUDED_CREDITS_POLICY.organizationPlans.enterprise.identity.monthlyQuota
export const PRO_MONTHLY_QUOTA = INDIVIDUAL_INCLUDED_CREDIT_PLANS['pro-student'].identity.monthlyQuota
export const PRO_PLUS_MONTHLY_QUOTA = INDIVIDUAL_INCLUDED_CREDIT_PLANS['pro-plus'].identity.monthlyQuota
const INDIVIDUAL_KNOWN_MONTHLY_QUOTAS = new Set<number>([
  PRO_MONTHLY_QUOTA,
  PRO_PLUS_MONTHLY_QUOTA,
])
const TRANSITION_PERIOD_KNOWN_MONTHLY_QUOTAS = new Set<number>([
  BUSINESS_MONTHLY_QUOTA,
  ENTERPRISE_MONTHLY_QUOTA,
  ...INDIVIDUAL_KNOWN_MONTHLY_QUOTAS,
])

export const BUSINESS_MONTHLY_AIC_INCLUDED_CREDITS = TRANSITION_PERIOD_INCLUDED_CREDITS_POLICY.organizationPlans.business.monthlyIncludedCredits
export const ENTERPRISE_MONTHLY_AIC_INCLUDED_CREDITS = TRANSITION_PERIOD_INCLUDED_CREDITS_POLICY.organizationPlans.enterprise.monthlyIncludedCredits
export const PRO_MONTHLY_AIC_INCLUDED_CREDITS = INDIVIDUAL_INCLUDED_CREDIT_PLANS['pro-student'].monthlyIncludedCredits
export const PRO_PLUS_MONTHLY_AIC_INCLUDED_CREDITS = INDIVIDUAL_INCLUDED_CREDIT_PLANS['pro-plus'].monthlyIncludedCredits

export type AicIncludedCreditsOverrides = {
  business?: number
  enterprise?: number
}

export type ReportPlanScope = 'individual' | 'organization'
export type AicIncludedCreditTier = OrganizationIncludedCreditTier | null
export type IndividualPlanTier = IndividualPlan | null

export type LicenseSummaryRow = {
  label: string
  users: number
  includedAic: number
}

export type LicenseSummary = {
  rows: LicenseSummaryRow[]
  totalUsers: number
  totalIncludedAic: number
}

export interface AicIncludedCreditsProgressOptions {
  onProgress?: (progress: StreamProgress) => void
  includedCreditsPolicy?: IncludedCreditsPolicy
}

type ReportScopeUser = {
  organizations?: string[]
  costCenters?: string[]
}

export type AicIncludedCreditsContext = {
  reportPlanScope: ReportPlanScope
  organizationIncludedCreditsPool: number
  individualMonthlyIncludedCredits: number
}

function normalizeSeatCount(value: number | undefined): number | null {
  if (value === undefined || !Number.isFinite(value)) return null
  return Math.max(0, Math.floor(value))
}

function calculateOrganizationIncludedCreditsPool(
  overrides: AicIncludedCreditsOverrides,
  policy: IncludedCreditsPolicy,
): number | null {
  const businessSeats = normalizeSeatCount(overrides.business)
  const enterpriseSeats = normalizeSeatCount(overrides.enterprise)

  if (businessSeats === null && enterpriseSeats === null) return null

  return (
    (businessSeats ?? 0) * policy.organizationPlans.business.monthlyIncludedCredits
    + (enterpriseSeats ?? 0) * policy.organizationPlans.enterprise.monthlyIncludedCredits
  )
}

function findOrganizationIncludedCreditsPlan(
  totalMonthlyQuota: number,
  reportPlanScope: ReportPlanScope,
  policy: IncludedCreditsPolicy,
) {
  if (reportPlanScope !== 'organization') return null

  return Object.values(policy.organizationPlans)
    .find((plan) => plan.identity.monthlyQuota === totalMonthlyQuota) ?? null
}

function findIndividualIncludedCreditsPlan(
  totalMonthlyQuota: number,
  reportPlanScope: ReportPlanScope,
) {
  if (reportPlanScope !== 'individual') return null

  return Object.values(INDIVIDUAL_INCLUDED_CREDIT_PLANS)
    .find((plan) => plan.identity.monthlyQuota === totalMonthlyQuota) ?? null
}

export function isKnownMonthlyQuota(totalMonthlyQuota: number): boolean {
  return isKnownMonthlyQuotaForPolicy(totalMonthlyQuota, TRANSITION_PERIOD_INCLUDED_CREDITS_POLICY)
}

function isKnownMonthlyQuotaForPolicy(totalMonthlyQuota: number, policy: IncludedCreditsPolicy): boolean {
  if (!Number.isFinite(totalMonthlyQuota)) return false
  if (policy === TRANSITION_PERIOD_INCLUDED_CREDITS_POLICY) {
    return TRANSITION_PERIOD_KNOWN_MONTHLY_QUOTAS.has(totalMonthlyQuota)
  }

  return (
    INDIVIDUAL_KNOWN_MONTHLY_QUOTAS.has(totalMonthlyQuota)
    || Object.values(policy.organizationPlans).some((plan) => plan.identity.monthlyQuota === totalMonthlyQuota)
  )
}

export function selectKnownMonthlyQuota(
  currentQuota: number,
  candidateQuota: number,
  policy: IncludedCreditsPolicy = TRANSITION_PERIOD_INCLUDED_CREDITS_POLICY,
): number {
  const currentKnownQuota = isKnownMonthlyQuotaForPolicy(currentQuota, policy) ? currentQuota : 0
  if (!isKnownMonthlyQuotaForPolicy(candidateQuota, policy)) return currentKnownQuota
  return Math.max(currentKnownQuota, candidateQuota)
}

export function inferReportPlanScope(userCount: number, hasOrganizationContext = false): ReportPlanScope {
  return userCount === 1 && !hasOrganizationContext ? 'individual' : 'organization'
}

export function getPlanLabel(
  totalMonthlyQuota: number,
  reportPlanScope: ReportPlanScope = 'organization',
  policy: IncludedCreditsPolicy = TRANSITION_PERIOD_INCLUDED_CREDITS_POLICY,
): string {
  const organizationPlan = findOrganizationIncludedCreditsPlan(totalMonthlyQuota, reportPlanScope, policy)
  if (organizationPlan) return organizationPlan.label

  const individualPlan = findIndividualIncludedCreditsPlan(totalMonthlyQuota, reportPlanScope)
  if (individualPlan) return individualPlan.label

  if (totalMonthlyQuota > 0) return `Unknown (${totalMonthlyQuota.toLocaleString()} PRUs/month)`
  return 'Unknown'
}

export function getAicIncludedCreditTier(
  totalMonthlyQuota: number,
  reportPlanScope: ReportPlanScope = 'organization',
  policy: IncludedCreditsPolicy = TRANSITION_PERIOD_INCLUDED_CREDITS_POLICY,
): AicIncludedCreditTier {
  return findOrganizationIncludedCreditsPlan(totalMonthlyQuota, reportPlanScope, policy)?.identity.tier ?? null
}

export function getIndividualPlanTier(
  totalMonthlyQuota: number,
  reportPlanScope: ReportPlanScope = 'individual',
): IndividualPlanTier {
  return findIndividualIncludedCreditsPlan(totalMonthlyQuota, reportPlanScope)?.identity.tier ?? null
}

export function getMonthlyAicIncludedCredits(
  totalMonthlyQuota: number,
  reportPlanScope: ReportPlanScope = 'organization',
  policy: IncludedCreditsPolicy = TRANSITION_PERIOD_INCLUDED_CREDITS_POLICY,
): number {
  return findOrganizationIncludedCreditsPlan(totalMonthlyQuota, reportPlanScope, policy)?.monthlyIncludedCredits ?? 0
}

export function getIndividualMonthlyAicIncludedCredits(
  totalMonthlyQuota: number,
  reportPlanScope: ReportPlanScope = 'individual',
): number {
  return findIndividualIncludedCreditsPlan(totalMonthlyQuota, reportPlanScope)?.monthlyIncludedCredits ?? 0
}

export function calculateLicenseSummary(
  users: Array<{ totalMonthlyQuota: number } & ReportScopeUser>,
  policy: IncludedCreditsPolicy = TRANSITION_PERIOD_INCLUDED_CREDITS_POLICY,
): LicenseSummary {
  const reportPlanScope = inferReportPlanScope(users.length, hasOrganizationContext(users))
  if (reportPlanScope === 'individual') {
    const quota = users[0]?.totalMonthlyQuota ?? 0
    const includedAic = getIndividualMonthlyAicIncludedCredits(quota, reportPlanScope)

    return {
      rows: users.length === 1
        ? [{ label: getPlanLabel(quota, reportPlanScope), users: 1, includedAic }]
        : [],
      totalUsers: users.length,
      totalIncludedAic: includedAic,
    }
  }

  const rows: LicenseSummaryRow[] = [
    { label: policy.organizationPlans.business.label, users: 0, includedAic: 0 },
    { label: policy.organizationPlans.enterprise.label, users: 0, includedAic: 0 },
  ]

  users.forEach((user) => {
    const plan = findOrganizationIncludedCreditsPlan(user.totalMonthlyQuota, reportPlanScope, policy)
    if (!plan) return

    if (plan.identity.tier === 'business') {
      rows[0].users += 1
      rows[0].includedAic += plan.monthlyIncludedCredits
    }

    if (plan.identity.tier === 'enterprise') {
      rows[1].users += 1
      rows[1].includedAic += plan.monthlyIncludedCredits
    }
  })

  return {
    rows,
    totalUsers: rows.reduce((sum, row) => sum + row.users, 0),
    totalIncludedAic: rows.reduce((sum, row) => sum + row.includedAic, 0),
  }
}

export async function calculateAicIncludedCreditsContext(
  file: File,
  overrides: AicIncludedCreditsOverrides = {},
  options?: AicIncludedCreditsProgressOptions,
): Promise<AicIncludedCreditsContext> {
  const includedCreditsPolicy = options?.includedCreditsPolicy ?? TRANSITION_PERIOD_INCLUDED_CREDITS_POLICY
  let header: TokenUsageHeader | null = null
  const quotasByUser = new Map<string, number>()
  let hasOrganizationContext = false

  for await (const line of streamLines(file, options)) {
    const trimmed = line.trimEnd()
    if (!trimmed) continue

    if (!header) {
      header = parseTokenUsageHeader(trimmed)
      continue
    }

    const record = parseNormalizedTokenUsageRecord(trimmed, header)
    if (!record) continue

    const username = record.username.trim()
    if (!username) continue

    if (record.organization.trim() || (record.cost_center_name?.trim() ?? '')) {
      hasOrganizationContext = true
    }

    const currentQuota = quotasByUser.get(username) ?? 0
    quotasByUser.set(username, selectKnownMonthlyQuota(
      currentQuota,
      record.total_monthly_quota,
      includedCreditsPolicy,
    ))
  }

  const reportPlanScope = inferReportPlanScope(quotasByUser.size, hasOrganizationContext)
  if (reportPlanScope === 'individual') {
    const quota = quotasByUser.values().next().value ?? 0
    return {
      reportPlanScope,
      organizationIncludedCreditsPool: 0,
      individualMonthlyIncludedCredits: getIndividualMonthlyAicIncludedCredits(quota, reportPlanScope),
    }
  }

  const overriddenOrganizationIncludedCreditPool = calculateOrganizationIncludedCreditsPool(overrides, includedCreditsPolicy)

  return {
    reportPlanScope,
    organizationIncludedCreditsPool: overriddenOrganizationIncludedCreditPool ?? Array.from(quotasByUser.values()).reduce(
      (total, quota) => total + getMonthlyAicIncludedCredits(quota, reportPlanScope, includedCreditsPolicy),
      0,
    ),
    individualMonthlyIncludedCredits: 0,
  }
}

export async function calculateAicIncludedCreditsPool(
  file: File,
  overrides: AicIncludedCreditsOverrides = {},
): Promise<number> {
  const includedCreditsContext = await calculateAicIncludedCreditsContext(file, overrides)

  return includedCreditsContext.organizationIncludedCreditsPool
}

export class PooledAicIncludedCreditsAllocator {
  private remainingIncludedCredits: number

  constructor(totalIncludedCredits: number) {
    this.remainingIncludedCredits = totalIncludedCredits
  }

  apply(record: TokenUsageRecord): TokenUsageRecord {
    const { aicQuantity, aicGrossAmount } = getAicUsageMetrics(record)

    if (aicQuantity <= 0) {
      record.aic_net_amount = aicGrossAmount
      return record
    }

    if (aicGrossAmount <= 0) {
      record.aic_net_amount = aicGrossAmount
      return record
    }

    const coveredQuantity = Math.min(aicQuantity, this.remainingIncludedCredits)
    this.remainingIncludedCredits = Math.max(this.remainingIncludedCredits - coveredQuantity, 0)

    const uncoveredRatio = Math.max(aicQuantity - coveredQuantity, 0) / aicQuantity
    record.aic_net_amount = aicGrossAmount * uncoveredRatio
    return record
  }

  remaining(): number {
    return this.remainingIncludedCredits
  }
}

export class IndividualAicIncludedCreditsAllocator {
  private readonly remainingIncludedCreditsByMonth = new Map<string, number>()
  private readonly monthlyIncludedCredits: number

  constructor(monthlyIncludedCredits: number) {
    this.monthlyIncludedCredits = monthlyIncludedCredits
  }

  apply(record: TokenUsageRecord): TokenUsageRecord {
    const { aicQuantity, aicGrossAmount } = getAicUsageMetrics(record)

    if (aicQuantity <= 0) {
      record.aic_net_amount = aicGrossAmount
      return record
    }

    if (aicGrossAmount <= 0) {
      record.aic_net_amount = aicGrossAmount
      return record
    }

    const username = record.username.trim()
    const monthKey = getUsageMonthKey(record.date.trim())
    if (!username || !monthKey || this.monthlyIncludedCredits <= 0) {
      record.aic_net_amount = aicGrossAmount
      return record
    }

    const monthlyKey = `${username}\u0000${monthKey}`
    const remainingIncludedCredits = this.remainingIncludedCreditsByMonth.get(monthlyKey) ?? this.monthlyIncludedCredits
    const coveredQuantity = Math.min(aicQuantity, remainingIncludedCredits)
    this.remainingIncludedCreditsByMonth.set(monthlyKey, Math.max(remainingIncludedCredits - coveredQuantity, 0))

    const uncoveredRatio = Math.max(aicQuantity - coveredQuantity, 0) / aicQuantity
    record.aic_net_amount = aicGrossAmount * uncoveredRatio
    return record
  }

  remainingFor(username: string, date: string): number {
    const monthKey = getUsageMonthKey(date.trim())
    if (!monthKey) return 0
    return this.remainingIncludedCreditsByMonth.get(`${username.trim()}\u0000${monthKey}`) ?? this.monthlyIncludedCredits
  }
}

export async function createAicIncludedCreditsAllocator(
  file: File,
  overrides: AicIncludedCreditsOverrides = {},
  options?: AicIncludedCreditsProgressOptions,
): Promise<PooledAicIncludedCreditsAllocator | IndividualAicIncludedCreditsAllocator> {
  const includedCreditsContext = await calculateAicIncludedCreditsContext(file, overrides, options)

  if (includedCreditsContext.reportPlanScope === 'individual') {
    return new IndividualAicIncludedCreditsAllocator(includedCreditsContext.individualMonthlyIncludedCredits)
  }

  return new PooledAicIncludedCreditsAllocator(includedCreditsContext.organizationIncludedCreditsPool)
}

export function getUsageMonthKey(value: string): string | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!match) return null

  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const date = new Date(Date.UTC(year, month - 1, day))

  if (
    date.getUTCFullYear() !== year
    || date.getUTCMonth() !== month - 1
    || date.getUTCDate() !== day
  ) {
    return null
  }

  return value.slice(0, 7)
}

function hasOrganizationContext(users: ReportScopeUser[]): boolean {
  return users.some((user) => {
    const organizations = user.organizations ?? []
    const costCenters = user.costCenters ?? []
    return organizations.length > 0 || costCenters.length > 0
  })
}
