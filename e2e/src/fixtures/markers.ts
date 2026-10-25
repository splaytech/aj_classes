// A single prefix for the whole process run, so a crashed run's orphan rows
// are greppable and bulk-removable with `WHERE field LIKE 'e2e-<runId>-%'`.
const runId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

export interface Marker {
  value: string;
  prefix: string;
}

export function newMarker(kind: string): Marker {
  const suffix = Math.random().toString(36).slice(2, 8);
  return {
    value: `e2e-${runId}-${kind}-${suffix}`,
    prefix: `e2e-${runId}-`,
  };
}
