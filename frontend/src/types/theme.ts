export interface TenantThemeConfig {
  tenantId: string;
  tenantName: string;
  facilityCode: string;
  logoUrl?: string;
  badgeWatermark: string;
  primaryColor: string; // HSL e.g. "217 91% 60%"
  accentColor: string;
  portalHeaderTitle: string;
  confidentialityNotice: string;
  supportContact: string;
}

export interface ThemeStore {
  isDarkMode: boolean;
  tenantConfig: TenantThemeConfig;
  toggleDarkMode: () => void;
  setDarkMode: (dark: boolean) => void;
  updateTenantTheme: (config: Partial<TenantThemeConfig>) => void;
  resetToDefaultTheme: () => void;
}
