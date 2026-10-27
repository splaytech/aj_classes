// Whether to show the News link in the header and footer (AC-1.6, AC-1.8, AC-1.9). The
// pre-rendered HTML can't know if posts exist, so the link starts hidden and appears only once
// the live check says at least one post exists. Any failure keeps it hidden (AC-1.7).

import { useEffect, useState } from 'react';

import { hasPublishedPosts } from '@/services';

export function useHasNews(): boolean {
  const [hasNews, setHasNews] = useState(false);

  useEffect(() => {
    let isMounted = true;
    void hasPublishedPosts().then((result) => {
      if (isMounted) setHasNews(result);
    });
    return () => {
      isMounted = false;
    };
  }, []);

  return hasNews;
}
