import { useGraphStore } from './graph-store';

/** Undo the last action */
export function undo() {
  useGraphStore.temporal.getState().undo();
}

/** Redo the last undone action */
export function redo() {
  useGraphStore.temporal.getState().redo();
}

/** Check if undo is available */
export function canUndo(): boolean {
  return useGraphStore.temporal.getState().pastStates.length > 0;
}

/** Check if redo is available */
export function canRedo(): boolean {
  return useGraphStore.temporal.getState().futureStates.length > 0;
}
