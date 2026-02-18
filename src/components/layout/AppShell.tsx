import { useState, useEffect, useCallback } from 'react';
import { ReactFlowProvider } from '@xyflow/react';
import { GraphCanvas } from '../graph/GraphCanvas';
import { GraphToolbar } from '../graph/GraphToolbar';
import { FilterPanel } from '../graph/FilterPanel';
import { Legend } from '../graph/Legend';
import { NodePanel } from '../panels/NodePanel';
import { EdgePanel } from '../panels/EdgePanel';
import { SearchDialog } from '../panels/SearchDialog';
import { useGraphStore } from '../../store/graph-store';
import { undo, redo } from '../../store/history';
import { saveGraphToFile, loadGraphFromFile } from '../../io/json-io';
import { importLegacyData } from '../../io/legacy-import';

export function AppShell() {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [searchOpen, setSearchOpen] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const selectedNodeId = useGraphStore((s) => s.selectedNodeId);
  const selectedEdgeId = useGraphStore((s) => s.selectedEdgeId);
  const loadGraph = useGraphStore((s) => s.loadGraph);
  const getGraphData = useGraphStore((s) => s.getGraphData);
  const fileHandle = useGraphStore((s) => s.fileHandle);
  const setFileHandle = useGraphStore((s) => s.setFileHandle);

  // Keyboard shortcuts
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      const ctrl = e.ctrlKey || e.metaKey;
      if (ctrl && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        undo();
      } else if (ctrl && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
        e.preventDefault();
        redo();
      } else if (ctrl && e.key === 'f') {
        e.preventDefault();
        setSearchOpen(true);
      } else if (ctrl && e.key === 's') {
        e.preventDefault();
        saveGraphToFile(getGraphData(), fileHandle).then((handle) => {
          if (handle) setFileHandle(handle);
        });
      }
    },
    [getGraphData, fileHandle, setFileHandle],
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  async function handleOpen() {
    const result = await loadGraphFromFile();
    if (result) {
      loadGraph(result.data);
      if (result.handle) setFileHandle(result.handle);
    }
  }

  async function handleSave() {
    const handle = await saveGraphToFile(getGraphData(), fileHandle);
    if (handle) setFileHandle(handle);
  }

  async function handleImportLegacy() {
    if (!('showDirectoryPicker' in window)) {
      alert('Directory picker not supported in this browser. Use Chrome or Edge.');
      return;
    }
    try {
      const dirHandle = await (window as unknown as { showDirectoryPicker(): Promise<FileSystemDirectoryHandle> }).showDirectoryPicker();
      const files = new Map<string, string>();
      for await (const entry of dirHandle as unknown as AsyncIterable<{ kind: string; name: string; getFile(): Promise<File> }>) {
        if (entry.kind === 'file' && (entry.name.endsWith('.mpsi') || entry.name.endsWith('.graphml') || entry.name.endsWith('.xsql'))) {
          const file = await entry.getFile();
          const text = await file.text();
          files.set(entry.name, text);
        }
      }
      const data = importLegacyData(files);
      loadGraph(data);
    } catch {
      // User cancelled
    }
  }

  return (
    <div className="flex flex-col h-screen w-screen">
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 py-2 bg-gray-800 text-white text-sm">
        <div className="flex items-center gap-3">
          <span className="font-bold text-lg">ModularPsi</span>
          <button onClick={handleOpen} className="hover:text-blue-300 transition-colors">Open</button>
          <button onClick={handleSave} className="hover:text-blue-300 transition-colors">Save</button>
          <button onClick={handleImportLegacy} className="hover:text-blue-300 transition-colors">Import Legacy</button>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setSearchOpen(true)}
            className="hover:text-blue-300 transition-colors"
          >
            Search (Ctrl+F)
          </button>
          <button
            onClick={() => setSidebarOpen((v) => !v)}
            className="hover:text-blue-300 transition-colors"
          >
            {sidebarOpen ? 'Hide Panel' : 'Show Panel'}
          </button>
        </div>
      </div>

      {/* Toolbar */}
      <GraphToolbar
        onToggleFilters={() => setFiltersOpen((v) => !v)}
        filtersOpen={filtersOpen}
      />

      {/* Main content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Filter panel (left sidebar) */}
        {filtersOpen && (
          <FilterPanel onClose={() => setFiltersOpen(false)} />
        )}

        {/* Graph area */}
        <div className="flex-1 relative">
          <ReactFlowProvider>
            <GraphCanvas />
          </ReactFlowProvider>
        </div>

        {/* Side panel */}
        {sidebarOpen && (
          <div className="w-72 border-l border-gray-200 bg-white overflow-y-auto">
            {selectedNodeId && <NodePanel />}
            {selectedEdgeId && !selectedNodeId && <EdgePanel />}
            {!selectedNodeId && !selectedEdgeId && (
              <div className="p-4 text-gray-500 text-sm">
                Click a node or edge to view/edit its properties.
              </div>
            )}
          </div>
        )}
      </div>

      {/* Legend */}
      <Legend />

      {/* Search dialog */}
      <SearchDialog open={searchOpen} onClose={() => setSearchOpen(false)} />
    </div>
  );
}
