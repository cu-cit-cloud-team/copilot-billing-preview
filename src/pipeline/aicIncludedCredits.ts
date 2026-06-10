import {
  getAicUsageMetrics,
  parseNativeAiCreditsUsageRecord,
  parseTokenUsageHeader,
  parseNormalizedTokenUsageRecord,
  type TokenUsageHeader,
  type TokenUsageRecord,
} from './parser'
import {
  TRANSITION_PERIOD_INCLUDED_CREDITS_POLICY,
  resolveIncludedCreditsPolicy,
  type IncludedCreditsPolicy,
  type IndividualIncludedCreditTier,
  type OrganizationIncludedCreditTier,
  type ReportPeriod,
} from './includedCreditsPolicy'
import { isValidIsoDate } from './isoDate'
import { streamLines, type StreamProgress } from './streamer'
import type { ReportFormatMetadata } from './reportAdapters'

type IndividualIncludedCreditsPlan = NonNullable<IncludedCreditsPolicy['individualPlans'][IndividualIncludedCreditTier]>

function getIndividualIncludedCreditsPlans(policy: IncludedCreditsPolicy): IndividualIncludedCreditsPlan[] {
  return Object.values(policy.individualPlans)
    .filter((plan): plan is IndividualIncludedCreditsPlan => plan !== undefined)
}

function getRequiredIndividualIncludedCreditsPlan(
  policy: IncludedCreditsPolicy,
  tier: IndividualIncludedCreditTier,
): IndividualIncludedCreditsPlan {
  const plan = policy.individualPlans[tier]
  if (!plan) {
    throw new Error(`Included credits policy ${policy.id} does not define ${tier}.`)
  }
  return plan
}

const TRANSITION_PERIOD_PRO_PLAN = getRequiredIndividualIncludedCreditsPlan(
  TRANSITION_PERIOD_INCLUDED_CREDITS_POLICY,
  'pro-student',
)
const TRANSITION_PERIOD_PRO_PLUS_PLAN = getRequiredIndividualIncludedCreditsPlan(
  TRANSITION_PERIOD_INCLUDED_CREDITS_POLICY,
  'pro-plus',
)

export const BUSINESS_MONTHLY_QUOTA = TRANSITION_PERIOD_INCLUDED_CREDITS_POLICY.organizationPlans.business.identity.monthlyQuota
export const ENTERPRISE_MONTHLY_QUOTA = TRANSITION_PERIOD_INCLUDED_CREDITS_POLICY.organizationPlans.enterprise.identity.monthlyQuota
export const PRO_MONTHLY_QUOTA = TRANSITION_PERIOD_PRO_PLAN.identity.monthlyQuota
export const PRO_PLUS_MONTHLY_QUOTA = TRANSITION_PERIOD_PRO_PLUS_PLAN.identity.monthlyQuota

export const BUSINESS_MONTHLY_AIC_INCLUDED_CREDITS = TRANSITION_PERIOD_INCLUDED_CREDITS_POLICY.organizationPlans.business.monthlyIncludedCredits
export const ENTERPRISE_MONTHLY_AIC_INCLUDED_CREDITS = TRANSITION_PERIOD_INCLUDED_CREDITS_POLICY.organizationPlans.enterprise.monthlyIncludedCredits
export const PRO_MONTHLY_AIC_INCLUDED_CREDITS = TRANSITION_PERIOD_PRO_PLAN.monthlyIncludedCredits
export const PRO_PLUS_MONTHLY_AIC_INCLUDED_CREDITS = TRANSITION_PERIOD_PRO_PLUS_PLAN.monthlyIncludedCredits

export type AicIncludedCreditsOverrides = {
  business?: number
  enterprise?: number
}

export type ReportPlanScope = 'individual' | 'organization'
export type AicIncludedCreditTier = OrganizationIncludedCreditTier | null
export type IndividualPlanTier = IndividualIncludedCreditTier | null

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
  reportMetadata?: ReportFormatMetadata
}

type ReportScopeUser = {
  organizations?: string[]
  costCenters?: string[]
}

export type AicIncludedCreditsContext = {
  reportPlanScope: ReportPlanScope
  includedCreditsPolicy: IncludedCreditsPolicy
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
  policy: IncludedCreditsPolicy,
) {
  if (reportPlanScope !== 'individual') return null

  return getIndividualIncludedCreditsPlans(policy)
    .find((plan) => plan.identity.monthlyQuota === totalMonthlyQuota) ?? null
}

export function isKnownMonthlyQuota(totalMonthlyQuota: number): boolean {
  return isKnownMonthlyQuotaForPolicy(totalMonthlyQuota, TRANSITION_PERIOD_INCLUDED_CREDITS_POLICY)
}

function isKnownMonthlyQuotaForPolicy(totalMonthlyQuota: number, policy: IncludedCreditsPolicy): boolean {
  if (!Number.isFinite(totalMonthlyQuota)) return false

  return (
    getIndividualIncludedCreditsPlans(policy).some((plan) => plan.identity.monthlyQuota === totalMonthlyQuota)
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

  const individualPlan = findIndividualIncludedCreditsPlan(totalMonthlyQuota, reportPlanScope, policy)
  if (individualPlan) return individualPlan.label

  if (totalMonthlyQuota > 0) {
    return `Unknown (${totalMonthlyQuota.toLocaleString()} ${getUnknownQuotaLabel(reportPlanScope, policy)})`
  }
  return 'Unknown'
}

function getUnknownQuotaLabel(reportPlanScope: ReportPlanScope, policy: IncludedCreditsPolicy): string {
  const quotaUnit = reportPlanScope === 'individual'
    ? getIndividualIncludedCreditsPlans(policy)[0]?.identity.quotaUnit ?? policy.organizationPlans.business.identity.quotaUnit
    : policy.organizationPlans.business.identity.quotaUnit

  return quotaUnit === 'aic' ? 'AI Credits/month' : 'PRUs/month'
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
  policy: IncludedCreditsPolicy = TRANSITION_PERIOD_INCLUDED_CREDITS_POLICY,
): IndividualPlanTier {
  return findIndividualIncludedCreditsPlan(totalMonthlyQuota, reportPlanScope, policy)?.identity.tier ?? null
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
  policy: IncludedCreditsPolicy = TRANSITION_PERIOD_INCLUDED_CREDITS_POLICY,
): number {
  return findIndividualIncludedCreditsPlan(totalMonthlyQuota, reportPlanScope, policy)?.monthlyIncludedCredits ?? 0
}

function includeDateInReportPeriod(reportPeriod: ReportPeriod, rawDate: string): ReportPeriod {
  const date = rawDate.trim()
  if (!isValidIsoDate(date)) return reportPeriod

  return {
    startDate: !reportPeriod.startDate || date < reportPeriod.startDate ? date : reportPeriod.startDate,
    endDate: !reportPeriod.endDate || date > reportPeriod.endDate ? date : reportPeriod.endDate,
  }
}

function resolvePolicyForContext(
  options: AicIncludedCreditsProgressOptions | undefined,
  reportPeriod: ReportPeriod,
): IncludedCreditsPolicy {
  if (options?.includedCreditsPolicy) {
    return options.includedCreditsPolicy
  }

  if (options?.reportMetadata) {
    return resolveIncludedCreditsPolicy(options.reportMetadata, reportPeriod)
  }

  return TRANSITION_PERIOD_INCLUDED_CREDITS_POLICY
}

function parseIncludedCreditsRecord(
  line: string,
  header: TokenUsageHeader,
  options: AicIncludedCreditsProgressOptions | undefined,
): TokenUsageRecord | null {
  if (options?.reportMetadata?.format === 'native-ai-credits') {
    return parseNativeAiCreditsUsageRecord(line, header)
  }

  return parseNormalizedTokenUsageRecord(line, header)
}

export function calculateLicenseSummary(
  users: Array<{ totalMonthlyQuota: number } & ReportScopeUser>,
  policy: IncludedCreditsPolicy = TRANSITION_PERIOD_INCLUDED_CREDITS_POLICY,
): LicenseSummary {
  const reportPlanScope = inferReportPlanScope(users.length, hasOrganizationContext(users))
  if (reportPlanScope === 'individual') {
    const quota = users[0]?.totalMonthlyQuota ?? 0
    const includedAic = getIndividualMonthlyAicIncludedCredits(quota, reportPlanScope, policy)

    return {
      rows: users.length === 1
        ? [{ label: getPlanLabel(quota, reportPlanScope, policy), users: 1, includedAic }]
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
  let header: TokenUsageHeader | null = null
  const quotaCandidatesByUser = new Map<string, Set<number>>()
  let hasOrganizationContext = false
  let reportPeriod: ReportPeriod = {}

  for await (const line of streamLines(file, options)) {
    const trimmed = line.trimEnd()
    if (!trimmed) continue

    if (!header) {
      header = parseTokenUsageHeader(trimmed)
      continue
    }

    const record = parseIncludedCreditsRecord(trimmed, header, options)
    if (!record) continue

    reportPeriod = includeDateInReportPeriod(reportPeriod, record.date)

    const username = record.username.trim()
    if (!username) continue

    if (record.organization.trim() || (record.cost_center_name?.trim() ?? '')) {
      hasOrganizationContext = true
    }

    const quotaCandidates = quotaCandidatesByUser.get(username) ?? new Set<number>()
    quotaCandidates.add(record.total_monthly_quota)
    quotaCandidatesByUser.set(username, quotaCandidates)
  }

  const includedCreditsPolicy = resolvePolicyForContext(options, reportPeriod)
  const quotasByUser = new Map<string, number>()
  quotaCandidatesByUser.forEach((quotaCandidates, username) => {
    quotasByUser.set(username, Array.from(quotaCandidates).reduce(
      (currentQuota, candidateQuota) => selectKnownMonthlyQuota(currentQuota, candidateQuota, includedCreditsPolicy),
      0,
    ))
  })

  const reportPlanScope = inferReportPlanScope(quotaCandidatesByUser.size, hasOrganizationContext)
  if (reportPlanScope === 'individual') {
    const quota = quotasByUser.values().next().value ?? 0
    return {
      reportPlanScope,
      includedCreditsPolicy,
      organizationIncludedCreditsPool: 0,
      individualMonthlyIncludedCredits: getIndividualMonthlyAicIncludedCredits(quota, reportPlanScope, includedCreditsPolicy),
    }
  }

  const overriddenOrganizationIncludedCreditPool = calculateOrganizationIncludedCreditsPool(overrides, includedCreditsPolicy)

  return {
    reportPlanScope,
    includedCreditsPolicy,
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

  return createAicIncludedCreditsAllocatorFromContext(includedCreditsContext)
}

export function createAicIncludedCreditsAllocatorFromContext(
  includedCreditsContext: AicIncludedCreditsContext,
): PooledAicIncludedCreditsAllocator | IndividualAicIncludedCreditsAllocator {
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
