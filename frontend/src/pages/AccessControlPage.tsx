import React, { useState } from 'react';
import { Unlock, Lock } from 'lucide-react';
import { StatusBadge } from '../components/common/StatusBadge';

export const AccessControlPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'doors' | 'elevators' | 'matrix'>('doors');

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl bg-card border border-border">
        <div>
          <h1 className="text-xl font-bold font-mono text-foreground tracking-tight">
            ACCESS CONTROL & ELEVATOR DESTINATION DISPATCH
          </h1>
          <p className="text-xs text-muted-foreground">
            100 Hikvision door controllers (VLAN 20) & Otis Compass elevator system (VLAN 30)
          </p>
        </div>

        <div className="flex items-center gap-2">
          <StatusBadge status="online" label="100 CONTROLLERS" />
          <StatusBadge status="online" label="8 OTIS CARS" />
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-border pb-2 font-mono text-xs">
        <button
          onClick={() => setActiveTab('doors')}
          className={`px-4 py-2 rounded-lg font-semibold transition-colors ${
            activeTab === 'doors' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted'
          }`}
        >
          Door Controllers & Turnstiles (100)
        </button>
        <button
          onClick={() => setActiveTab('elevators')}
          className={`px-4 py-2 rounded-lg font-semibold transition-colors ${
            activeTab === 'elevators' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted'
          }`}
        >
          Otis Compass Dispatch Simulation
        </button>
        <button
          onClick={() => setActiveTab('matrix')}
          className={`px-4 py-2 rounded-lg font-semibold transition-colors ${
            activeTab === 'matrix' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted'
          }`}
        >
          Floor Authorization Matrix
        </button>
      </div>

      {activeTab === 'doors' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 bg-card border border-border rounded-xl font-mono text-xs space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-bold text-foreground">DOOR-101: MAIN LOBBY TURNSTILE A</span>
                <span className="text-emerald-400">ONLINE</span>
              </div>
              <div className="text-[11px] text-muted-foreground font-sans">
                Hikvision DS-K2604T • Firmware v2.4.1 (VLAN 20)
              </div>
              <div className="flex items-center gap-2 pt-2 border-t border-border">
                <button className="flex-1 py-1.5 bg-secondary hover:bg-secondary/80 rounded flex items-center justify-center gap-1.5 text-foreground">
                  <Unlock className="w-3.5 h-3.5 text-emerald-400" />
                  Remote Unlock
                </button>
                <button className="flex-1 py-1.5 bg-rose-950/60 hover:bg-rose-900/80 text-rose-300 border border-rose-800 rounded flex items-center justify-center gap-1.5">
                  <Lock className="w-3.5 h-3.5" />
                  Lock Down
                </button>
              </div>
            </div>

            <div className="p-4 bg-card border border-border rounded-xl font-mono text-xs space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-bold text-foreground">DOOR-102: SERVER ENCLAVE FL 04</span>
                <span className="text-emerald-400">ONLINE</span>
              </div>
              <div className="text-[11px] text-muted-foreground font-sans">
                Hikvision Face Recognition Terminal • MinMoe (VLAN 20)
              </div>
              <div className="flex items-center gap-2 pt-2 border-t border-border">
                <button className="flex-1 py-1.5 bg-secondary hover:bg-secondary/80 rounded flex items-center justify-center gap-1.5 text-foreground">
                  <Unlock className="w-3.5 h-3.5 text-emerald-400" />
                  Remote Unlock
                </button>
                <button className="flex-1 py-1.5 bg-rose-950/60 hover:bg-rose-900/80 text-rose-300 border border-rose-800 rounded flex items-center justify-center gap-1.5">
                  <Lock className="w-3.5 h-3.5" />
                  Lock Down
                </button>
              </div>
            </div>

            <div className="p-4 bg-card border border-border rounded-xl font-mono text-xs space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-bold text-foreground">DOOR-103: EXECUTIVE FLOOR 14</span>
                <span className="text-emerald-400">ONLINE</span>
              </div>
              <div className="text-[11px] text-muted-foreground font-sans">
                Hikvision Maglock & Keycard Reader (VLAN 20)
              </div>
              <div className="flex items-center gap-2 pt-2 border-t border-border">
                <button className="flex-1 py-1.5 bg-secondary hover:bg-secondary/80 rounded flex items-center justify-center gap-1.5 text-foreground">
                  <Unlock className="w-3.5 h-3.5 text-emerald-400" />
                  Remote Unlock
                </button>
                <button className="flex-1 py-1.5 bg-rose-950/60 hover:bg-rose-900/80 text-rose-300 border border-rose-800 rounded flex items-center justify-center gap-1.5">
                  <Lock className="w-3.5 h-3.5" />
                  Lock Down
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'elevators' && (
        <div className="p-6 bg-card border border-border rounded-xl font-mono text-xs space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-foreground">OTIS COMPASS DISPATCH PREVIEW</h2>
            <span className="text-emerald-400">VLAN 30 (10.30.0.0/24)</span>
          </div>

          <div className="p-4 bg-background border border-border rounded-lg text-center space-y-2">
            <div className="text-[11px] text-muted-foreground">Kiosk / Turnstile Display Preview:</div>
            <div className="text-2xl font-bold font-mono text-amber-400">
              "Proceed to Elevator Car D for Floor 12"
            </div>
            <p className="text-xs text-muted-foreground font-sans">
              Dynamic algorithm groups passengers to optimize transit time and enforces floor access
              privileges.
            </p>
          </div>
        </div>
      )}

      {activeTab === 'matrix' && (
        <div className="p-4 bg-card border border-border rounded-xl font-mono text-xs">
          <h2 className="text-sm font-bold text-foreground mb-3">FLOOR AUTHORIZATION ACCESS MATRIX</h2>
          <p className="text-muted-foreground font-sans mb-4">
            Defines which clearance tiers and temporary visitor badges are permitted to exit on
            individual building floors.
          </p>
          <div className="p-4 bg-background border border-border rounded text-muted-foreground text-center">
            Floor Matrix Grid loaded for Sovereign Tower (Floors G to 24).
          </div>
        </div>
      )}
    </div>
  );
};
