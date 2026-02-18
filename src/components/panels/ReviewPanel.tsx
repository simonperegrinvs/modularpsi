import { useMemo, useState } from 'react';
import { summarizeHypothesisContradictions, summarizeNodeContradictions } from '../../agent/contradictions';
import { useGraphStore } from '../../store/graph-store';

export function ReviewPanel() {
  const [tab, setTab] = useState<'hypotheses' | 'contradictions'>('hypotheses');
  const nodes = useGraphStore((s) => s.nodes);
  const edges = useGraphStore((s) => s.edges);
  const references = useGraphStore((s) => s.references);
  const hypotheses = useGraphStore((s) => s.hypotheses);
  const rootId = useGraphStore((s) => s.rootId);
  const updateHypothesis = useGraphStore((s) => s.updateHypothesis);

  const contradictionSummary = useMemo(() => {
    const nodeSummary = summarizeNodeContradictions({
      version: 1,
      prefix: 'P',
      rootId,
      lastNodeNumber: nodes.length,
      nodes,
      edges,
      categories: [],
      references,
      hypotheses,
    })
      .filter((n) => n.status === 'mixed')
      .slice(0, 8);

    const hypothesisSummary = summarizeHypothesisContradictions(hypotheses)
      .filter((h) => h.status === 'mixed')
      .slice(0, 8);

    return { nodeSummary, hypothesisSummary };
  }, [nodes, edges, references, hypotheses, rootId]);

  const pending = hypotheses
    .filter((h) => h.status === 'draft' || h.status === 'pending-review')
    .sort((a, b) => b.score - a.score)
    .slice(0, 10);

  return (
    <div className="p-4 space-y-4 text-sm">
      <h3 className="font-semibold text-base">Review Queue</h3>

      <div className="flex gap-2">
        <button
          className={`px-2 py-1 rounded border ${tab === 'hypotheses' ? 'bg-gray-100 border-gray-400' : 'border-gray-300'}`}
          onClick={() => setTab('hypotheses')}
        >
          Hypotheses
        </button>
        <button
          className={`px-2 py-1 rounded border ${tab === 'contradictions' ? 'bg-gray-100 border-gray-400' : 'border-gray-300'}`}
          onClick={() => setTab('contradictions')}
        >
          Contradictions
        </button>
      </div>

      {tab === 'hypotheses' && (
        <div className="space-y-3">
          {pending.length === 0 && <div className="text-gray-500">No pending hypotheses.</div>}
          {pending.map((h) => (
            <div key={h.id} className="border border-gray-200 rounded p-2 space-y-2">
              <div className="font-medium">{h.id} · {h.status} · score {h.score.toFixed(2)}</div>
              <div className="text-gray-700">{h.statement}</div>
              <div className="flex gap-2">
                <button
                  className="px-2 py-1 rounded border border-yellow-500 text-yellow-700"
                  onClick={() => updateHypothesis(h.id, { status: 'pending-review' })}
                >
                  Pending
                </button>
                <button
                  className="px-2 py-1 rounded border border-green-600 text-green-700"
                  onClick={() => updateHypothesis(h.id, { status: 'approved' })}
                >
                  Approve
                </button>
                <button
                  className="px-2 py-1 rounded border border-red-600 text-red-700"
                  onClick={() => updateHypothesis(h.id, { status: 'rejected' })}
                >
                  Reject
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === 'contradictions' && (
        <div className="space-y-3">
          <div>
            <div className="font-medium mb-1">Mixed Nodes</div>
            {contradictionSummary.nodeSummary.length === 0 && <div className="text-gray-500">No mixed nodes found.</div>}
            {contradictionSummary.nodeSummary.map((n) => (
              <div key={n.nodeId} className="text-xs text-gray-700">
                {n.nodeId} ({n.nodeName}): +{n.supportClaims} / -{n.contradictClaims}
              </div>
            ))}
          </div>
          <div>
            <div className="font-medium mb-1">Mixed Hypotheses</div>
            {contradictionSummary.hypothesisSummary.length === 0 && <div className="text-gray-500">No mixed hypotheses found.</div>}
            {contradictionSummary.hypothesisSummary.map((h) => (
              <div key={h.hypothesisId} className="text-xs text-gray-700">
                {h.hypothesisId}: +{h.supportRefs} / -{h.contradictRefs} (score {h.score.toFixed(2)})
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
