import React, { useState } from 'react';
import { Building2, UserPlus, Palette, ShieldCheck, Check } from 'lucide-react';
import { useThemeStore } from '../stores/themeStore';

export const ClientPortalPage: React.FC = () => {
  const { tenantConfig, updateTenantTheme, resetToDefaultTheme } = useThemeStore();
  const [tenantNameInput, setTenantNameInput] = useState(tenantConfig.tenantName);
  const [primaryColorInput, setPrimaryColorInput] = useState(tenantConfig.primaryColor);
  const [savedSuccess, setSavedSuccess] = useState(false);

  const handleSaveTheme = (e: React.FormEvent) => {
    e.preventDefault();
    updateTenantTheme({
      tenantName: tenantNameInput,
      primaryColor: primaryColorInput,
    });
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 2500);
  };

  return (
    <div className="space-y-6">
      {/* Dynamic White-Labeled Header */}
      <div className="p-6 rounded-2xl bg-card border border-border shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-primary/20 text-primary border border-primary/40 rounded-xl shadow-glow-primary">
            <Building2 className="w-8 h-8" />
          </div>
          <div>
            <span className="text-[10px] font-mono uppercase tracking-widest text-primary font-bold">
              WHITE-LABELED CLIENT PORTAL
            </span>
            <h1 className="text-2xl font-bold font-mono text-foreground tracking-tight">
              {tenantConfig.tenantName}
            </h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              Facility Code: <span className="font-mono text-foreground">{tenantConfig.facilityCode}</span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-semibold rounded-lg shadow-glow-primary"
          >
            <UserPlus className="w-4 h-4" />
            Pre-Register Client Visitor
          </button>
        </div>
      </div>

      {/* Tenant Branding & Color Customization Studio */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1 bg-card border border-border rounded-xl p-5 space-y-4">
          <div className="flex items-center gap-2 font-mono text-xs font-bold uppercase text-foreground">
            <Palette className="w-4 h-4 text-primary" />
            White-Label Theme Engine
          </div>

          <form onSubmit={handleSaveTheme} className="space-y-3 font-mono text-xs">
            <div>
              <label className="block text-muted-foreground mb-1">TENANT / CORPORATE NAME</label>
              <input
                type="text"
                value={tenantNameInput}
                onChange={(e) => setTenantNameInput(e.target.value)}
                className="w-full p-2 bg-background border border-input rounded text-foreground outline-none focus:ring-1 focus:ring-primary"
              />
            </div>

            <div>
              <label className="block text-muted-foreground mb-1">
                PRIMARY BRAND COLOR (HSL FORMAT)
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={primaryColorInput}
                  onChange={(e) => setPrimaryColorInput(e.target.value)}
                  placeholder="217 91% 60%"
                  className="flex-1 p-2 bg-background border border-input rounded text-foreground outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
            </div>

            {savedSuccess && (
              <div className="p-2 bg-emerald-950/60 border border-emerald-800 text-emerald-300 rounded text-[11px] flex items-center gap-1.5">
                <Check className="w-3.5 h-3.5" />
                Theme variables applied live to CSS tokens!
              </div>
            )}

            <div className="pt-2 flex items-center gap-2">
              <button
                type="submit"
                className="flex-1 py-2 bg-primary hover:bg-primary/90 text-primary-foreground font-bold rounded transition-colors"
              >
                Apply Live Theme
              </button>
              <button
                type="button"
                onClick={resetToDefaultTheme}
                className="px-3 py-2 bg-secondary hover:bg-secondary/80 text-foreground rounded transition-colors"
              >
                Reset
              </button>
            </div>
          </form>
        </div>

        {/* Tenant Confidentiality Notice & Badge Preview */}
        <div className="lg:col-span-2 bg-card border border-border rounded-xl p-5 space-y-4">
          <h2 className="font-mono text-xs font-bold uppercase text-foreground">
            Contractor & Guest Entry Policy Preview
          </h2>

          <div className="p-4 bg-background border border-border rounded-lg text-xs space-y-3 font-sans">
            <p className="text-foreground leading-relaxed">
              {tenantConfig.confidentialityNotice}
            </p>
            <div className="flex items-center justify-between text-xs font-mono text-muted-foreground pt-2 border-t border-border">
              <span>Support Contact: {tenantConfig.supportContact}</span>
              <span className="text-emerald-400 flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5" /> Air-Gap Isolation Active
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
