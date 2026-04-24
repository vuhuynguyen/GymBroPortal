import { definePreset } from '@primeuix/themes';
import Aura from '@primeuix/themes/aura';
import { providePrimeNG } from 'primeng/config';

/**
 * Blue primary palette — keep in sync with `src/styles.scss` `--inv-primary-*`.
 * Figma (MCP) is source of truth; update hex values when tokens change in the file.
 */
const GymBroAura = definePreset(Aura, {
  primitive: {
    borderRadius: {
      sm: '8px',
      md: '12px',
      lg: '16px',
      xl: '16px'
    }
  },
  semantic: {
    formField: {
      paddingX: '0.75rem',
      paddingY: '0.75rem',
      borderRadius: '{border.radius.sm}'
    },
    primary: {
      50: '#eff6ff',
      100: '#dbeafe',
      200: '#bfdbfe',
      300: '#93c5fd',
      400: '#60a5fa',
      500: '#3b82f6',
      600: '#2563eb',
      700: '#1d4ed8',
      800: '#1e40af',
      900: '#1e3a8a',
      950: '#172554'
    }
  }
});

export function providePrimeNgTheming() {
  return providePrimeNG({
    theme: {
      preset: GymBroAura,
      options: {
        darkModeSelector: 'none'
      }
    }
  });
}
