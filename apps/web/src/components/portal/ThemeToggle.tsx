// Header button that switches the portal between light and dark (R3b story FS4). The full
// choice, including "same as this device", is on the Account page.

import DarkModeOutlined from '@mui/icons-material/DarkModeOutlined';
import LightModeOutlined from '@mui/icons-material/LightModeOutlined';
import IconButton from '@mui/material/IconButton';

import { PORTAL_COMMON } from '@/constants';
import { useAppearance } from '@/lib/appearance-context';
import { toggledMode } from '@/lib/theme-mode';

export function ThemeToggle() {
  const { shown, setMode } = useAppearance();
  const label =
    shown === 'dark' ? PORTAL_COMMON.themeToggle.toLight : PORTAL_COMMON.themeToggle.toDark;

  return (
    <IconButton
      size="large"
      aria-label={label}
      title={label}
      onClick={() => setMode(toggledMode(shown))}
      sx={{ color: 'text.primary', border: 1, borderColor: 'divider' }}
    >
      {shown === 'dark' ? <LightModeOutlined /> : <DarkModeOutlined />}
    </IconButton>
  );
}
