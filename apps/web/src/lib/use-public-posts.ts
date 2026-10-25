// Loads the /posts list in the browser after the page shows. The page itself is pre-rendered
// (ADR-0001), so it can't use a clientLoader: that would pre-render a fallback instead of the
// real heading and intro.

import { useEffect, useState } from 'react';

import { listPublicPosts } from '@/services';
import type { PublicPost } from '@/services';

export type PublicPostsState =
  | { status: 'loading' }
  | { status: 'ready'; posts: PublicPost[] } // posts may be empty
  | { status: 'error' };

export function usePublicPosts(): PublicPostsState {
  const [state, setState] = useState<PublicPostsState>({ status: 'loading' });

  useEffect(() => {
    let isMounted = true;
    void listPublicPosts().then((result) => {
      if (!isMounted) return;
      setState(result.ok ? { status: 'ready', posts: result.data } : { status: 'error' });
    });
    return () => {
      isMounted = false;
    };
  }, []);

  return state;
}
