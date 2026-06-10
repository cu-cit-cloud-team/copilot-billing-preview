import type { ReportFormat, ReportFormatMetadata } from '../pipeline/reportAdapters'

export type ReportMode = ReportFormat

export function getReportMode(reportMetadata: ReportFormatMetadata | null | undefined): ReportMode {
  return reportMetadata?.format ?? 'transition-period-billing-preview'
}

export function isNativeAiCreditsMode(reportMode: ReportMode): boolean {
  return reportMode === 'native-ai-credits'
}
