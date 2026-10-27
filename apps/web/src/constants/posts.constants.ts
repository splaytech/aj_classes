// Public posts page (/posts, posts.md): the website's own feed of admin updates. Shown as "News"
// in the header and footer, only when at least one post exists (ADR-0001).

export const POSTS_PUBLIC_PAGE = {
  heading: 'Latest news',
  intro: "What's happening at AJ Classes, posted by our team.",
  seo: {
    title: 'Latest News | AJ Classes',
    description: 'Updates and announcements from AJ Classes.',
  },
  loading: 'Loading the latest news…',
  // No "coming soon" or "check back" wording anywhere on the site (R1 F2.1, AC-1.6).
  empty: 'There are no news posts at the moment.',
  error: "We couldn't load the news just now. Please try again later.",
  emptyLinks: {
    home: 'Back to the home page',
    registerInterest: 'Register interest',
  },
  errorBoundary: {
    heading: 'Something went wrong',
    text: "This page couldn't be shown. Please try again later.",
    backHome: 'Back to the home page',
  },
  // Byline is stored but hidden by default (posts.md Q5); flip this on to show "Posted by …".
  showByline: false,
  byline: (name: string) => `Posted by ${name}`,
} as const;
