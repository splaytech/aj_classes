// The HTML document shared by every page: <head> tags, fonts, global styles and analytics.

import { Analytics } from '@vercel/analytics/react';
import type { ReactNode } from 'react';
import { Links, Meta, Outlet, Scripts, ScrollRestoration } from 'react-router';

import { APP_CONFIG, ASSETS } from '@/constants';
import './styles/theme.css';
import './styles/global.css';

export function Layout({ children }: { children: ReactNode }) {
  return (
    <html lang={APP_CONFIG.language}>
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="theme-color" content={APP_CONFIG.themeColor} />
        <link rel="icon" href={ASSETS.favicon} type="image/svg+xml" />
        <link rel="apple-touch-icon" href={ASSETS.appleTouchIcon} />
        <Meta />
        <Links />
      </head>
      <body>
        {children}
        <ScrollRestoration />
        <Scripts />
        {APP_CONFIG.features.analytics && <Analytics />}
      </body>
    </html>
  );
}

export default function App() {
  return <Outlet />;
}
