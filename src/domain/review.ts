import type { GraphNode, Reference, ReviewStatus } from './types';

export function applyReviewStatusToNode(node: GraphNode, status: ReviewStatus, nowIso: string): void {
  node.reviewStatus = status;
  if (status === 'approved' || status === 'rejected') {
    node.lastReviewedAt = nowIso;
  }
}

export function applyReviewStatusToReference(ref: Reference, status: ReviewStatus): void {
  ref.reviewStatus = status;
  if (status === 'approved') {
    ref.processingStatus = 'approved';
    return;
  }
  if (status === 'rejected') {
    ref.processingStatus = 'rejected';
    return;
  }
  if (!ref.processingStatus) {
    ref.processingStatus = 'imported-draft';
  }
}
