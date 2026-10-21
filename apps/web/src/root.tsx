// The HTML document shared by every page: <head> tags, fonts, global styles and analytics.
// Staging and dev get their own tab icon, phone bar colour and marker (environments.md).

import { Analytics } from '@vercel/analytics/react';
import type { ReactNode } from 'react';
import { Links, Meta, Outlet, Scripts, ScrollRestoration } from 'react-router';

import { EnvironmentMarker } from '@/components/layout/EnvironmentMarker';
import { APP_CONFIG, ASSETS, CURRENT_MARKER } from '@/constants';
import './styles/theme.css';
import './styles/global.css';

export function Layout({ children }: { children: ReactNode }) {
  return (
    <html lang={APP_CONFIG.language}>
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="theme-color" content={CURRENT_MARKER?.themeColor ?? APP_CONFIG.themeColor} />
        <link rel="icon" href={CURRENT_MARKER?.favicon ?? ASSETS.favicon} type="image/svg+xml" />
        <link rel="apple-touch-icon" href={ASSETS.appleTouchIcon} />
        <Meta />
        <Links />
      </head>
      <body>
        <EnvironmentMarker />
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
