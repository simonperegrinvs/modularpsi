import { useEffect } from 'react';
import { AppShell } from './components/layout/AppShell';
import { useGraphStore } from './store/graph-store';
import { createEmptyGraph } from './io/json-io';

export default function App() {
  const nodes = useGraphStore((s) => s.nodes);
  const loadGraph = useGraphStore((s) => s.loadGraph);

  // Load an empty graph if none is loaded
  useEffect(() => {
    if (nodes.length === 0) {
      loadGraph(createEmptyGraph());
    }
  }, []);

  return <AppShell />;
}
