import {
  hasNativeAiCreditsReportSignature,
  parseNativeAiCreditsUsageRecord,
  parseNormalizedTokenUsageRecord,
  validateBaseHeader,
  validateHeader as validateTokenUsageHeader,
  type TokenUsageHeader,
  type TokenUsageRecord,
} from './parser'

export type ReportFormat = 'transition-period-billing-preview' | 'native-ai-credits'

export type ReportFormatMetadata = {
  format: ReportFormat
  label: string
}

export interface UsageReportAdapter {
  metadata: ReportFormatMetadata
  validateHeader(header: TokenUsageHeader): void
  parseRecord(line: string, header: TokenUsageHeader): TokenUsageRecord | null
}

const TRANSITION_PERIOD_BILLING_PREVIEW_REPORT_ADAPTER: UsageReportAdapter = {
  metadata: {
    format: 'transition-period-billing-preview',
    label: 'Transition Period Billing Preview report',
  },
  validateHeader(header) {
    validateTokenUsageHeader(header)
  },
  parseRecord(line, header) {
    return parseNormalizedTokenUsageRecord(line, header)
  },
}

const NATIVE_AI_CREDITS_REPORT_ADAPTER: UsageReportAdapter = {
  metadata: {
    format: 'native-ai-credits',
    label: 'Native AI Credits report',
  },
  validateHeader(header) {
    validateBaseHeader(header)
  },
  parseRecord(line, header) {
    return parseNativeAiCreditsUsageRecord(line, header)
  },
}

const REPORT_ADAPTERS: Record<ReportFormat, UsageReportAdapter> = {
  'transition-period-billing-preview': TRANSITION_PERIOD_BILLING_PREVIEW_REPORT_ADAPTER,
  'native-ai-credits': NATIVE_AI_CREDITS_REPORT_ADAPTER,
}

function hasTransitionPeriodAicColumns(header: TokenUsageHeader): boolean {
  return 'aic_quantity' in header.index && 'aic_gross_amount' in header.index
}

export function getDefaultUsageReportAdapter(): UsageReportAdapter {
  return TRANSITION_PERIOD_BILLING_PREVIEW_REPORT_ADAPTER
}

export function validateUsageReportHeader(header: TokenUsageHeader): UsageReportAdapter {
  validateBaseHeader(header)

  if (!('exceeds_quota' in header.index) && !hasTransitionPeriodAicColumns(header)) {
    NATIVE_AI_CREDITS_REPORT_ADAPTER.validateHeader(header)
    return NATIVE_AI_CREDITS_REPORT_ADAPTER
  }

  const adapter = getDefaultUsageReportAdapter()
  adapter.validateHeader(header)
  return adapter
}

export function detectReportFormat(header: TokenUsageHeader, firstRecord: TokenUsageRecord): ReportFormat {
  // This intentionally mirrors the existing preflight check: format detection only samples the first data row.
  if (hasNativeAiCreditsReportSignature(header, firstRecord)) {
    return 'native-ai-credits'
  }

  return 'transition-period-billing-preview'
}

export function selectUsageReportAdapter(header: TokenUsageHeader, firstRecord: TokenUsageRecord): UsageReportAdapter {
  return REPORT_ADAPTERS[detectReportFormat(header, firstRecord)]
}

export function validateUsageReportFirstRecord(
  header: TokenUsageHeader,
  firstRecord: TokenUsageRecord,
): UsageReportAdapter {
  const adapter = selectUsageReportAdapter(header, firstRecord)
  adapter.validateHeader(header)
  return adapter
}
