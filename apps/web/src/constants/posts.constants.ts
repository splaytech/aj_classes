// Public posts page (/posts, posts.md): the website's own feed of admin updates.

export const POSTS_PUBLIC_PAGE = {
  heading: 'Latest news',
  intro: "What's happening at AJ Classes, posted by our team.",
  seo: {
    title: 'Latest News | AJ Classes',
    description: 'Updates and announcements from AJ Classes.',
  },
  empty: 'Nothing posted yet. Check back soon.',
  // Byline is stored but hidden by default (posts.md Q5); flip this on to show "Posted by …".
  showByline: false,
  byline: (name: string) => `Posted by ${name}`,
} as const;
