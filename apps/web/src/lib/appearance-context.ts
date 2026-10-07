// The portal's appearance choice, shared by the provider, the header toggle and the Account page
// (R3b design §6.5). Kept apart from the provider component so hot reloading in development
// never creates a second context.

import { createContext, useContext } from 'react';

import type { ResolvedTheme, ThemeMode } from '@/constants';

export type Appearance = {
  mode: ThemeMode; // what the person chose
  shown: ResolvedTheme; // what is on screen now
  setMode: (mode: ThemeMode) => void;
};

export const AppearanceContext = createContext<Appearance>({
  mode: 'system',
  shown: 'light',
  setMode: () => {},
});

/** The appearance choice, for the header toggle and the Account page. */
export function useAppearance(): Appearance {
  return useContext(AppearanceContext);
}
