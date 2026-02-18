import type { GraphData } from '../domain/types';

/**
 * Export graph data as Graphviz DOT format.
 */
export function graphToDot(data: GraphData): string {
  const lines: string[] = [];
  lines.push('digraph ModularPsi {');
  lines.push('  rankdir=TB;');
  lines.push('  node [shape=ellipse, style=filled, fillcolor=white];');
  lines.push('');

  for (const node of data.nodes) {
    const shape = node.type === 0 ? 'ellipse' : 'box';
    const label = node.name.replace(/"/g, '\\"');
    lines.push(`  "${node.id}" [label="${label}", shape=${shape}];`);
  }

  lines.push('');

  for (const edge of data.edges) {
    const style = edge.type === 0 ? 'solid' : edge.type === 1 ? 'dashed' : 'dotted';
    const label = edge.trust >= 0 ? edge.trust.toFixed(2) : 'N/C';
    lines.push(`  "${edge.sourceId}" -> "${edge.targetId}" [label="${label}", style=${style}];`);
  }

  lines.push('}');
  return lines.join('\n');
}

/**
 * Export the graph canvas as a PNG image.
 * Uses the React Flow viewport's SVG and converts to PNG via canvas.
 */
export async function exportCanvasToPng(): Promise<Blob | null> {
  const svgEl = document.querySelector('.react-flow__viewport');
  if (!svgEl) return null;

  const flowEl = document.querySelector('.react-flow');
  if (!flowEl) return null;

  const { width, height } = flowEl.getBoundingClientRect();

  // Clone the entire react-flow container
  const clone = flowEl.cloneNode(true) as HTMLElement;
  clone.style.width = `${width}px`;
  clone.style.height = `${height}px`;

  // Serialize to SVG data
  const svgData = new XMLSerializer().serializeToString(clone);
  const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(svgBlob);

  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = width * 2;
      canvas.height = height * 2;
      const ctx = canvas.getContext('2d')!;
      ctx.scale(2, 2);
      ctx.fillStyle = 'white';
      ctx.fillRect(0, 0, width, height);
      ctx.drawImage(img, 0, 0, width, height);
      canvas.toBlob((blob) => {
        URL.revokeObjectURL(url);
        resolve(blob);
      }, 'image/png');
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(null);
    };
    img.src = url;
  });
}
