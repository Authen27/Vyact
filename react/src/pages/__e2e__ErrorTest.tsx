import React from 'react';

// Intentionally throws during render to exercise the top-level ErrorBoundary
// from the CON-E2E-005 spec. Explicit return type is required because TS
// infers throw-only functions as () => void, which doesn't satisfy React's
// ComponentType<any> contract used by React.lazy() in App.tsx.
export default function E2EErrorTest(): React.ReactElement {
  throw new Error('E2E-test-intentional-throw');
}
