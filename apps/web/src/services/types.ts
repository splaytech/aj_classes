// Result types shared by all services. Components only ever see these, never backend details.

/** Outcome of sending something to the backend. */
export type SubmitResult = 'success' | 'error' | 'not-configured';
