import { create } from 'zustand';
import { TenantThemeConfig, ThemeStore } from '../types/theme';

const DEFAULT_TENANT_CONFIG: TenantThemeConfig = {
  tenantId: 'facility-hq-01',
  tenantName: 'Kigali Financial District • Sovereign Tower',
  facilityCode: 'HQ-VMS-VLAN',
  badgeWatermark: 'RESTRICTED FACILITY ENTRY',
  primaryColor: '217 91% 60%',
  accentColor: '217 33% 22%',
  portalHeaderTitle: 'Visitor & Contractor Access Portal',
  confidentialityNotice: 'Air-Gapped Access System. Unlawful reproduction or badge tampering is subject to high security prosecution.',
  supportContact: 'SOC Command Center (Ext 9911)',
};

const savedDark =
  typeof localStorage !== 'undefined'
    ? localStorage.getItem('vms_acs_dark_mode') !== 'false'
    : true;
const savedTenant =
  typeof localStorage !== 'undefined' ? localStorage.getItem('vms_acs_tenant_theme') : null;
const initialTenant: TenantThemeConfig = savedTenant
  ? JSON.parse(savedTenant)
  : DEFAULT_TENANT_CONFIG;

function applyThemeToDom(isDark: boolean, tenant: TenantThemeConfig) {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  if (!root) return;
  if (isDark) {
    root.classList.add('dark');
    root.classList.remove('light');
  } else {
    root.classList.remove('dark');
    root.classList.add('light');
  }

  // Update primary color CSS variable if customized
  if (tenant.primaryColor) {
    root.style.setProperty('--primary', tenant.primaryColor);
  }
}

// Initial application
if (typeof document !== 'undefined') {
  applyThemeToDom(savedDark, initialTenant);
}

export const useThemeStore = create<ThemeStore>((set, get) => ({
  isDarkMode: savedDark,
  tenantConfig: initialTenant,

  toggleDarkMode: () => {
    const nextDark = !get().isDarkMode;
    localStorage.setItem('vms_acs_dark_mode', String(nextDark));
    applyThemeToDom(nextDark, get().tenantConfig);
    set({ isDarkMode: nextDark });
  },

  setDarkMode: (dark: boolean) => {
    localStorage.setItem('vms_acs_dark_mode', String(dark));
    applyThemeToDom(dark, get().tenantConfig);
    set({ isDarkMode: dark });
  },

  updateTenantTheme: (config: Partial<TenantThemeConfig>) => {
    const updated = { ...get().tenantConfig, ...config };
    localStorage.setItem('vms_acs_tenant_theme', JSON.stringify(updated));
    applyThemeToDom(get().isDarkMode, updated);
    set({ tenantConfig: updated });
  },

  resetToDefaultTheme: () => {
    localStorage.removeItem('vms_acs_tenant_theme');
    applyThemeToDom(get().isDarkMode, DEFAULT_TENANT_CONFIG);
    set({ tenantConfig: DEFAULT_TENANT_CONFIG });
  },
}));
