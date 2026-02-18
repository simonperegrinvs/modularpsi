import type { GraphData } from '../domain/types';
import type { DiscoveryEvent } from './discovery';

export type MetricsPeriod = 'daily' | 'weekly' | 'monthly';

function periodDays(period: MetricsPeriod): number {
  if (period === 'daily') return 1;
  if (period === 'weekly') return 7;
  return 30;
}

function startOfWindow(now: Date, days: number): Date {
  return new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
}

function inWindow(iso: string | undefined, start: Date, end: Date): boolean {
  if (!iso) return false;
  const t = new Date(iso);
  return t >= start && t <= end;
}

export interface MetricsReport {
  period: MetricsPeriod;
  windowStart: string;
  windowEnd: string;
  precisionProxy: number;
  noveltyProxy: number;
  stabilityProxy: number;
  throughput: {
    discoveryEvents: number;
    candidates: number;
    importedDraftRefs: number;
  };
  reviewFlow: {
    draftRefs: number;
    approvedRefs: number;
    rejectedRefs: number;
    draftHypotheses: number;
    approvedHypotheses: number;
    rejectedHypotheses: number;
  };
}

export function buildMetricsReport(
  data: GraphData,
  discoveryEvents: DiscoveryEvent[],
  period: MetricsPeriod,
  nowIso = new Date().toISOString(),
): MetricsReport {
  const now = new Date(nowIso);
  const start = startOfWindow(now, periodDays(period));

  const hypothesesInWindow = data.hypotheses.filter((h) => inWindow(h.createdAt, start, now));
  const approvedInWindow = hypothesesInWindow.filter((h) => h.status === 'approved');
  const rejectedInWindow = hypothesesInWindow.filter((h) => h.status === 'rejected');
  const decisionTotal = approvedInWindow.length + rejectedInWindow.length;
  const precisionProxy = decisionTotal > 0 ? approvedInWindow.length / decisionTotal : 0;

  const nodeById = new Map(data.nodes.map((n) => [n.id, n]));
  const approvedAll = data.hypotheses.filter((h) => h.status === 'approved');
  const approvedCrossCategory = approvedAll.filter((h) => {
    const cats = new Set(h.linkedNodeIds.map((id) => nodeById.get(id)?.categoryId).filter(Boolean));
    return cats.size > 1;
  });
  const noveltyProxy = approvedAll.length > 0 ? approvedCrossCategory.length / approvedAll.length : 0;

  const oldApproved = approvedAll.filter((h) => {
    const created = new Date(h.createdAt);
    const ageDays = (now.getTime() - created.getTime()) / (24 * 60 * 60 * 1000);
    return ageDays >= 30;
  });
  const stabilityProxy = approvedAll.length > 0 ? oldApproved.length / approvedAll.length : 0;

  const eventsInWindow = discoveryEvents.filter((e) => inWindow(e.timestamp, start, now));
  const candidateIds = new Set(eventsInWindow.map((e) => e.candidateId));
  const importedDraftRefs = data.references.filter((r) => r.processingStatus === 'imported-draft').length;

  return {
    period,
    windowStart: start.toISOString(),
    windowEnd: now.toISOString(),
    precisionProxy,
    noveltyProxy,
    stabilityProxy,
    throughput: {
      discoveryEvents: eventsInWindow.length,
      candidates: candidateIds.size,
      importedDraftRefs,
    },
    reviewFlow: {
      draftRefs: data.references.filter((r) => r.reviewStatus === 'draft').length,
      approvedRefs: data.references.filter((r) => r.reviewStatus === 'approved').length,
      rejectedRefs: data.references.filter((r) => r.reviewStatus === 'rejected').length,
      draftHypotheses: data.hypotheses.filter((h) => h.status === 'draft').length,
      approvedHypotheses: data.hypotheses.filter((h) => h.status === 'approved').length,
      rejectedHypotheses: data.hypotheses.filter((h) => h.status === 'rejected').length,
    },
  };
}
