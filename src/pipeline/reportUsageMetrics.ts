import { getUsageMetrics, type TokenUsageRecord } from './parser'
import type { ReportFormat, ReportFormatMetadata } from './reportAdapters'

export type CanonicalAiCreditsMetrics = {
  quantity: number
  grossAmount: number
  discountAmount: number
  netAmount: number
}

export type TransitionPeriodComparisonMetrics = {
  requests: number
  grossAmount: number
  discountAmount: number
  netAmount: number
}

export type ReportUsageMetrics = {
  aiCredits: CanonicalAiCreditsMetrics
  transitionPeriodComparison: TransitionPeriodComparisonMetrics | null
}

function getReportFormat(reportMetadataOrFormat: ReportFormat | ReportFormatMetadata): ReportFormat {
  return typeof reportMetadataOrFormat === 'string'
    ? reportMetadataOrFormat
    : reportMetadataOrFormat.format
}

function getTransitionPeriodReportUsageMetrics(record: TokenUsageRecord): ReportUsageMetrics {
  const metrics = getUsageMetrics(record)

  return {
    aiCredits: {
      quantity: metrics.aicQuantity,
      grossAmount: metrics.aicGrossAmount,
      discountAmount: metrics.aicGrossAmount - metrics.aicNetAmount,
      netAmount: metrics.aicNetAmount,
    },
    transitionPeriodComparison: {
      requests: metrics.requests,
      grossAmount: metrics.grossAmount,
      discountAmount: metrics.discountAmount,
      netAmount: metrics.netAmount,
    },
  }
}

function getNativeAiCreditsReportUsageMetrics(record: TokenUsageRecord): ReportUsageMetrics {
  return {
    aiCredits: {
      quantity: record.quantity,
      grossAmount: record.gross_amount,
      discountAmount: record.discount_amount,
      netAmount: record.net_amount,
    },
    transitionPeriodComparison: null,
  }
}

export function getReportUsageMetrics(
  record: TokenUsageRecord,
  reportMetadataOrFormat: ReportFormat | ReportFormatMetadata,
): ReportUsageMetrics {
  if (getReportFormat(reportMetadataOrFormat) === 'native-ai-credits') {
    return getNativeAiCreditsReportUsageMetrics(record)
  }

  return getTransitionPeriodReportUsageMetrics(record)
}
