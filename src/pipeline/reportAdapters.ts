import {
  UnsupportedNativeAiCreditsReportError,
  hasNativeAiCreditsReportSignature,
  validateHeader as validateTokenUsageHeader,
  validateSupportedReportRecord,
  type TokenUsageHeader,
  type TokenUsageRecord,
} from './parser'

export type ReportFormat = 'transition-period-billing-preview' | 'native-ai-credits'

export type ReportFormatMetadata = {
  format: ReportFormat
  label: string
  supported: boolean
}

export interface UsageReportAdapter {
  metadata: ReportFormatMetadata
  validateHeader(header: TokenUsageHeader): void
  validateFirstRecord(header: TokenUsageHeader, record: TokenUsageRecord): void
}

const TRANSITION_PERIOD_BILLING_PREVIEW_REPORT_ADAPTER: UsageReportAdapter = {
  metadata: {
    format: 'transition-period-billing-preview',
    label: 'Transition Period Billing Preview report',
    supported: true,
  },
  validateHeader(header) {
    validateTokenUsageHeader(header)
  },
  validateFirstRecord(header, record) {
    validateSupportedReportRecord(header, record)
  },
}

const NATIVE_AI_CREDITS_REPORT_ADAPTER: UsageReportAdapter = {
  metadata: {
    format: 'native-ai-credits',
    label: 'Native AI Credits report',
    supported: false,
  },
  validateHeader(header) {
    validateTokenUsageHeader(header)
  },
  validateFirstRecord() {
    throw new UnsupportedNativeAiCreditsReportError()
  },
}

const REPORT_ADAPTERS: Record<ReportFormat, UsageReportAdapter> = {
  'transition-period-billing-preview': TRANSITION_PERIOD_BILLING_PREVIEW_REPORT_ADAPTER,
  'native-ai-credits': NATIVE_AI_CREDITS_REPORT_ADAPTER,
}

export function validateUsageReportHeader(header: TokenUsageHeader): void {
  validateTokenUsageHeader(header)
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
  adapter.validateFirstRecord(header, firstRecord)
  return adapter
}
